/**
 * 知识库后端服务（多格式版）
 * 支持: .md / .txt / .html / .docx / .pptx / .xlsx / .pdf
 * 不支持的旧格式会显示提示，建议另存为新格式。
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const cookieParser = require('cookie-parser');

// 导入模块
const { escapeHtml, stripScripts, htmlToPlain, countWords, makeSummary, normalizeForSearch, sanitizeFileName, sanitizeCategoryPath, uniqueFilePath, walkDir, SUPPORTED_EXTS, KNOWN_UNSUPPORTED, ACCEPT_UPLOAD_EXTS } = require('./modules/utils');
const { userConfig, createSession, getSession, requireAuth } = require('./modules/auth');
const { loadComments, saveComments, sanitizeCommentHtml } = require('./modules/comments');
const { EXTRACTORS, extractUnsupported, extractAutoTags } = require('./modules/parsers');
const { tokenizeForQA, paragraphCandidates, scoreParagraph, buildAnswerFromParagraphs } = require('./modules/qa');

const app = express();
const PORT = process.env.PORT || 3000;
const ARTICLES_DIR = path.join(__dirname, 'articles');
const DATA_DIR = path.join(__dirname, 'data');
const COMMENT_IMG_DIR = path.join(DATA_DIR, 'comment-images');

if (!fs.existsSync(ARTICLES_DIR)) fs.mkdirSync(ARTICLES_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(COMMENT_IMG_DIR)) fs.mkdirSync(COMMENT_IMG_DIR, { recursive: true });

// ========== 文件缓存 ==========
const fileCache = new Map(); // relPath -> { mtimeMs, article }

async function analyzeArticle(relPath) {
  const fullPath = path.join(ARTICLES_DIR, relPath);
  const stat = fs.statSync(fullPath);
  const cached = fileCache.get(relPath);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.article;

  const ext = path.extname(relPath).toLowerCase();
  const extractor = EXTRACTORS[ext];
  let extracted;
  try {
    extracted = extractor
      ? await extractor(fullPath)
      : await extractUnsupported(fullPath, ext);
  } catch (e) {
    console.error(`解析 ${relPath} 失败:`, e.message);
    extracted = {
      text: `解析失败: ${e.message}`,
      html: `<div class="unsupported"><p>❌ 解析失败: ${escapeHtml(e.message)}</p></div>`,
    };
  }

  const fm = extracted.frontmatter || {};
  const text = extracted.text || '';

  let title = fm.title;
  if (!title) {
    const h1 = text.match(/^#\s+(.+)$/m);
    title = h1 ? h1[1].trim() : path.basename(relPath, path.extname(relPath));
  }

  let summary = fm.summary || fm.description;
  if (!summary) {
    const plain = text
      .replace(/^---[\s\S]*?---/, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[#*_`>\[\]\(\)!]/g, '');
    summary = makeSummary(plain);
  }

  const tags = Array.isArray(fm.tags) ? fm.tags
    : (typeof fm.tags === 'string' ? fm.tags.split(/[,，\s]+/).filter(Boolean) : []);

  // 若 frontmatter 未提供 tags，则尝试自动从正文+标题中抽取
  const finalTags = tags.length ? tags : extractAutoTags(text, title);

  const dirParts = relPath.split(path.sep);
  const category = fm.category || (dirParts.length > 1 ? dirParts[0] : '未分类');

  const wordCount = countWords(text);
  const readingMinutes = Math.max(1, Math.round(wordCount / 400));
  const id = Buffer.from(relPath).toString('base64url');
  const fileType = ext.replace('.', '') || 'unknown';

  const article = {
    id,
    relPath: relPath.replace(/\\/g, '/'),
    fileType,
    supported: !!extractor,
    title,
    summary,
    tags: finalTags,
    category,
    author: fm.author || '',
    date: fm.date ? new Date(fm.date).toISOString() : stat.mtime.toISOString(),
    mtime: stat.mtime.toISOString(),
    wordCount,
    readingMinutes,
    text,
    html: extracted.html || '',
  };

  fileCache.set(relPath, { mtimeMs: stat.mtimeMs, article });
  return article;
}

let articlesPromise = null;
let lastScan = 0;
const SCAN_TTL = 3000;

async function getArticles(force = false) {
  const now = Date.now();
  if (!force && articlesPromise && now - lastScan < SCAN_TTL) return articlesPromise;
  lastScan = now;

  const files = walkDir(ARTICLES_DIR);
  const fileSet = new Set(files);
  for (const key of fileCache.keys()) {
    if (!fileSet.has(key)) fileCache.delete(key);
  }

  articlesPromise = Promise.all(
    files.map((f) => analyzeArticle(f).catch((e) => {
      console.error('analyze error:', f, e.message);
      return null;
    }))
  ).then((arr) =>
    arr.filter(Boolean).sort((a, b) => new Date(b.date) - new Date(a.date))
  );
  return articlesPromise;
}

// ========== 上传配置 ==========
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 20,
    fileSize: 50 * 1024 * 1024,
  },
});

// 评论图片上传：磁盘存储
const commentImageUpload = multer({
  storage: multer.diskStorage({
    destination: COMMENT_IMG_DIR,
    filename: (_req, file, cb) => {
      const ext = (path.extname(file.originalname) || '').toLowerCase();
      const safeExt = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext) ? ext : '.png';
      const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`;
      cb(null, name);
    },
  }),
  limits: { files: 1, fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext)) {
      return cb(new Error('仅支持 png/jpg/jpeg/gif/webp/bmp'));
    }
    if (file.mimetype && !/^image\//i.test(file.mimetype) && file.mimetype !== 'application/octet-stream') {
      return cb(new Error('文件 MIME 类型非法'));
    }
    cb(null, true);
  },
});

// ========== 中间件 ==========
app.use(express.json());
app.use(cookieParser());

// 静态资源：登录页公开，其他页面要求登录
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/login.css', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.css')));
app.get('/login.js', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.js')));

// 评论图片静态访问（已登录用户在页面内引用，登录态依赖站点 cookie）
app.use('/uploads/comment-images', express.static(COMMENT_IMG_DIR, { fallthrough: true, maxAge: '7d' }));

// 首页与其他静态资源前置鉴权
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (req.path === '/login.html' || req.path === '/login.css' || req.path === '/login.js') return next();

  const session = getSession(req.cookies?.kb_token);
  // 仅对页面入口（/, /index.html）做强校验，资源文件依赖页面内调用 API 时再校验
  if (req.path === '/' || req.path === '/index.html') {
    if (!session) return res.redirect('/login.html');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// ========== API 路由 ==========

// 登录相关
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = userConfig.users.find(
    (u) => u.username === username && u.password === password
  );
  if (!user) return res.status(401).json({ error: '用户名或密码错误' });
  const token = createSession(user);
  res.cookie('kb_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({
    ok: true,
    user: { username: user.username, displayName: user.displayName, role: user.role },
  });
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies?.kb_token;
  if (token) {
    // sessions.delete(token); // 可选：清理会话
  }
  res.clearCookie('kb_token');
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const session = getSession(req.cookies?.kb_token);
  if (!session) return res.status(401).json({ error: '未登录' });
  res.json({ user: session });
});

// 其他 API 全部要求登录
app.use('/api', (req, res, next) => {
  if (
    req.path === '/login' ||
    req.path === '/logout' ||
    req.path === '/me'
  ) return next();
  return requireAuth(req, res, next);
});

// 文章相关
app.get('/api/articles', async (req, res) => {
  try {
    const all = await getArticles();
    const { q, tag, category, type } = req.query;
    let list = all;

    if (category) list = list.filter((a) => a.category === category);
    if (tag) list = list.filter((a) => a.tags.includes(tag));
    if (type) list = list.filter((a) => a.fileType === type);
    if (q) {
      const kw = String(q).toLowerCase();
      list = list.filter((a) =>
        a.title.toLowerCase().includes(kw) ||
        (a.summary || '').toLowerCase().includes(kw) ||
        (a.text || '').toLowerCase().includes(kw) ||
        a.tags.some((t) => t.toLowerCase().includes(kw))
      );
    }

    const items = list.map(({ text, html, ...meta }) => meta);
    res.json({ total: items.length, items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/articles/:id', async (req, res) => {
  try {
    const list = await getArticles();
    const article = list.find((a) => a.id === req.params.id);
    if (!article) return res.status(404).json({ error: '文章不存在' });
    res.json(article);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/articles/:id', async (req, res) => {
  try {
    const list = await getArticles();
    const article = list.find((a) => a.id === req.params.id);
    if (!article) return res.status(404).json({ error: '文章不存在' });

    const fullPath = path.resolve(ARTICLES_DIR, article.relPath);
    const articlesRoot = path.resolve(ARTICLES_DIR);
    if (fullPath !== articlesRoot && !fullPath.startsWith(articlesRoot + path.sep)) {
      return res.status(400).json({ error: '非法路径' });
    }
    if (!fs.existsSync(fullPath)) {
      fileCache.delete(article.relPath);
      await getArticles(true);
      return res.status(404).json({ error: '文件已不存在' });
    }

    fs.unlinkSync(fullPath);
    fileCache.delete(article.relPath);

    // 自下而上清理空目录（限制在 ARTICLES_DIR 内，最多 5 层）
    let dir = path.dirname(fullPath);
    for (let i = 0; i < 5; i += 1) {
      if (dir === articlesRoot || !dir.startsWith(articlesRoot + path.sep)) break;
      const remaining = fs.readdirSync(dir);
      if (remaining.length === 0) {
        fs.rmdirSync(dir);
        dir = path.dirname(dir);
      } else {
        break;
      }
    }

    await getArticles(true);
    res.json({ ok: true, deleted: article.relPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/refresh', async (req, res) => {
  try {
    const list = await getArticles(true);
    res.json({ ok: true, count: list.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/upload', upload.array('files', 20), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ error: '没有接收到文件' });
    }

    const safeCategory = sanitizeCategoryPath(req.body?.category || '');
    const targetDir = safeCategory
      ? path.join(ARTICLES_DIR, safeCategory)
      : ARTICLES_DIR;

    if (!targetDir.startsWith(ARTICLES_DIR)) {
      return res.status(400).json({ error: '非法目录' });
    }

    fs.mkdirSync(targetDir, { recursive: true });

    const saved = [];
    const rejected = [];

    for (const file of files) {
      const ext = path.extname(file.originalname || '').toLowerCase();
      if (!ACCEPT_UPLOAD_EXTS.has(ext)) {
        rejected.push({
          name: file.originalname,
          reason: `不支持的格式: ${ext || 'unknown'}`,
        });
        continue;
      }

      const targetPath = uniqueFilePath(targetDir, file.originalname || 'untitled');
      fs.writeFileSync(targetPath, file.buffer);
      saved.push(path.relative(ARTICLES_DIR, targetPath).replace(/\\/g, '/'));
    }

    await getArticles(true);
    res.json({ ok: true, saved, rejected, count: saved.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// QA 相关
app.post('/api/qa', async (req, res) => {
  try {
    const question = String(req.body?.question || '').trim();
    if (!question) {
      return res.status(400).json({ error: 'question 不能为空' });
    }

    const queryText = normalizeForSearch(question);
    const queryTokens = tokenizeForQA(queryText);
    if (!queryTokens.length) {
      return res.status(400).json({ error: '问题缺少有效关键词' });
    }

    const articles = await getArticles();
    const ranked = [];
    for (const article of articles) {
      const paras = paragraphCandidates(article);
      for (const paragraph of paras) {
        const score = scoreParagraph(queryTokens, queryText, paragraph);
        if (score > 0.9) {
          ranked.push({ article, paragraph, score });
        }
      }
    }

    ranked.sort((a, b) => b.score - a.score);
    const topScore = ranked[0]?.score || 0;
    const isTopic = require('./modules/qa').isTopicQuery(question);
    const limit = isTopic ? 12 : 5;
    const topRanked = ranked
      .filter((r) => r.score >= Math.max(1.0, topScore * (isTopic ? 0.45 : 0.62)))
      .filter((r) => !require('./modules/qa').isTocLike(r.paragraph) || r.score >= topScore * 0.9)
      .slice(0, limit);
    const composed = buildAnswerFromParagraphs(question, topRanked);

    const sources = topRanked.map((item) => ({
      id: item.article.id,
      title: item.article.title,
      relPath: item.article.relPath,
      fileType: item.article.fileType,
      snippet: item.paragraph.slice(0, 220),
      score: Number(item.score.toFixed(3)),
    }));

    res.json({
      question,
      answer: composed.answer,
      confidence: Number(composed.confidence.toFixed(2)),
      sources,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 统计相关
app.get('/api/stats', async (req, res) => {
  try {
    const list = await getArticles();
    const tagMap = {}, catMap = {}, typeMap = {};
    let totalWords = 0;
    for (const a of list) {
      totalWords += a.wordCount;
      catMap[a.category] = (catMap[a.category] || 0) + 1;
      typeMap[a.fileType] = (typeMap[a.fileType] || 0) + 1;
      for (const t of a.tags) tagMap[t] = (tagMap[t] || 0) + 1;
    }
    const sortByCount = (m) => Object.entries(m)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    res.json({
      totalArticles: list.length,
      totalWords,
      categories: sortByCount(catMap),
      tags: sortByCount(tagMap),
      fileTypes: sortByCount(typeMap),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 评论相关
app.post('/api/comments/upload-image', (req, res) => {
  commentImageUpload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: '未收到文件' });
    const url = `/uploads/comment-images/${req.file.filename}`;
    res.json({ ok: true, url, size: req.file.size, name: req.file.originalname });
  });
});

app.get('/api/articles/:id/comments', async (req, res) => {
  try {
    const list = await getArticles();
    if (!list.find((a) => a.id === req.params.id)) {
      return res.status(404).json({ error: '文章不存在' });
    }
    const all = loadComments();
    res.json({ items: all[req.params.id] || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/articles/:id/comments', async (req, res) => {
  try {
    const list = await getArticles();
    if (!list.find((a) => a.id === req.params.id)) {
      return res.status(404).json({ error: '文章不存在' });
    }
    const rawContent = String(req.body?.content || '');
    const sanitized = sanitizeCommentHtml(rawContent);
    const plain = htmlToPlain(sanitized);
    const hasImage = /<img\b/i.test(sanitized);
    if (!plain && !hasImage) return res.status(400).json({ error: '内容不能为空' });
    if (plain.length > 4000) return res.status(400).json({ error: '内容过长（≤4000）' });

    const all = loadComments();
    const list2 = all[req.params.id] || [];
    const item = {
      id: crypto.randomBytes(8).toString('hex'),
      author: req.user.username,
      authorName: req.user.displayName,
      content: sanitized,
      format: 'html',
      createdAt: new Date().toISOString(),
    };
    list2.push(item);
    all[req.params.id] = list2;
    saveComments(all);
    res.json({ ok: true, item });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/articles/:id/comments/:commentId', async (req, res) => {
  try {
    const all = loadComments();
    const list = all[req.params.id] || [];
    const idx = list.findIndex((c) => c.id === req.params.commentId);
    if (idx === -1) return res.status(404).json({ error: '评论不存在' });
    const target = list[idx];
    if (target.author !== req.user.username && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权限删除该评论' });
    }
    list.splice(idx, 1);
    all[req.params.id] = list;
    saveComments(all);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n📚 知识库已启动: http://localhost:${PORT}`);
  console.log(`📁 文章目录:     ${ARTICLES_DIR}`);
  console.log(`✅ 支持格式:     ${SUPPORTED_EXTS.join(', ')}`);
  console.log(`⚠️  暂不支持:     ${KNOWN_UNSUPPORTED.join(', ')} (建议另存为新格式)\n`);
});