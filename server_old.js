/**
 * 知识库后端服务（多格式版）
 * 支持: .md / .markdown / .txt / .html / .htm / .docx / .pptx / .xlsx / .pdf
 * 不支持的旧格式 (.doc / .ppt) 会显示提示，建议另存为新格式。
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const matter = require('gray-matter');
const { marked } = require('marked');
const mammoth = require('mammoth');
const officeparser = require('officeparser');
const multer = require('multer');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const ARTICLES_DIR = path.join(__dirname, 'articles');
const DATA_DIR = path.join(__dirname, 'data');
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');
const CONFIG_FILE = path.join(__dirname, 'config', 'users.json');

if (!fs.existsSync(ARTICLES_DIR)) fs.mkdirSync(ARTICLES_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ========== 用户与会话 ==========
function loadUserConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch (e) {
    console.error('加载用户配置失败，将使用默认账号:', e.message);
    return {
      users: [{ username: 'admin', password: 'admin123', displayName: '管理员', role: 'admin' }],
      sessionSecret: 'fallback-secret',
    };
  }
}
const userConfig = loadUserConfig();
const sessions = new Map(); // token -> { username, displayName, role, createdAt }
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

function createSession(user) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, {
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role || 'user',
    createdAt: Date.now(),
  });
  return token;
}

function getSession(token) {
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_TTL) {
    sessions.delete(token);
    return null;
  }
  return s;
}

function requireAuth(req, res, next) {
  const session = getSession(req.cookies?.kb_token);
  if (!session) return res.status(401).json({ error: '未登录' });
  req.user = session;
  next();
}

// ========== 评论存储 ==========
function loadComments() {
  try {
    return JSON.parse(fs.readFileSync(COMMENTS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}
function saveComments(data) {
  fs.writeFileSync(COMMENTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ========== 工具 ==========
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function stripScripts(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '');
}

// 评论富文本白名单清理
const COMMENT_ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins',
  'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'span', 'div', 'img',
]);
function sanitizeCommentHtml(html) {
  let s = String(html || '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (_m, tag, attrs) => {
    const t = tag.toLowerCase();
    if (!COMMENT_ALLOWED_TAGS.has(t)) return '';
    const isClosing = _m.startsWith('</');
    if (isClosing) return t === 'img' ? '' : `</${t}>`;
    if (t === 'a') {
      const m = attrs.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      let href = m ? (m[2] || m[3] || m[4] || '') : '';
      if (!/^(https?:|mailto:)/i.test(href)) href = '';
      return href
        ? `<a href="${href.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">`
        : '<a>';
    }
    if (t === 'img') {
      const srcM = attrs.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      let src = srcM ? (srcM[2] || srcM[3] || srcM[4] || '') : '';
      // 仅允许站内上传路径或 https/http
      if (!/^(\/uploads\/comment-images\/[\w.-]+|https?:\/\/)/i.test(src)) return '';
      const altM = attrs.match(/\balt\s*=\s*("([^"]*)"|'([^']*)')/i);
      const alt = altM ? (altM[2] || altM[3] || '') : '';
      return `<img src="${src.replace(/"/g, '&quot;')}" alt="${alt.replace(/"/g, '&quot;')}" loading="lazy">`;
    }
    return `<${t}>`;
  });
  return s;
}
function htmlToPlain(html) {
  return String(html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function htmlToText(html) {
  return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function countWords(text) {
  const cn = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const en = (text.match(/[a-zA-Z]+/g) || []).length;
  return cn + en;
}

function makeSummary(text, n = 160) {
  return text.replace(/\s+/g, ' ').trim().slice(0, n);
}

// ===== 自动标签提取 =====
const TAG_STOPWORDS_CN = new Set([
  '我们','你们','他们','自己','这个','那个','这些','那些','这里','那里','这样','那样','一个','一种','一些','一下','一起','一直','一般','一定','一样',
  '可以','可能','应该','需要','必须','或者','但是','因为','所以','如果','虽然','并且','以及','而且','只是','只要','只有','并不','不会','不是','不要','不能',
  '已经','正在','曾经','即将','目前','当前','现在','以后','以前','之后','之前','以下','以上','其中','其他','其它','另外','另一','两个','两种','三个','多个',
  '进行','使用','支持','提供','包括','包含','根据','基于','针对','通过','按照','对应','相关','相同','相似','不同','不会','不需','无需','即可','作为','成为','存在',
  '内容','信息','系统','功能','文档','文件','项目','模块','部分','章节','版本','参考','说明','要求','建议','结果','过程','方式','方法','方面','方向','原因','结果','目标',
  '管理','控制','执行','操作','流程','规范','标准','定义','分类','类型','属性','字段','参数','输入','输出','返回','调用','接口','请求','响应','服务','客户端','服务端','服务器',
  '数据','记录','内容','结构','元素','对象','变量','常量','函数','方法','类型','格式','类别','名称','编号','数量','长度','大小','时间','日期','地址','链接',
  '通常','一般','普通','整体','总体','整个','全部','所有','任何','每个','每种','部分','大部分','少部分',
  '什么','怎么','怎样','为何','为什么','是否','以及','或者','和','与','及','或','并','且','在','的','地','得','了','着','也','都','就','还','又','再','把','被','向','从','到','由','于','对','对于','关于','按','为','为了','给','让','使','用','以','则','即',
]);
const TAG_STOPWORDS_EN = new Set([
  'the','and','for','with','that','this','from','have','has','are','was','were','will','would','could','should','can','may','not','but','any','all','your','our','their','its','his','her','out','use','using','used','one','two','three','about','into','over','under','more','less','than','then','also','such','very','only','some','many','much','most','each','per','via','vs','etc','ie','eg',
]);

function extractAutoTags(text, title = '', max = 6) {
  if (!text) return [];
  const cleaned = String(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase();

  const titleLower = String(title || '').toLowerCase();
  const counts = new Map();
  const bump = (term, weight = 1) => {
    if (!term) return;
    const cur = counts.get(term) || 0;
    counts.set(term, cur + weight);
  };

  // 中文：2/3/4-gram，过滤停用词
  const zhChunks = cleaned.match(/[\u4e00-\u9fa5]+/g) || [];
  for (const chunk of zhChunks) {
    for (let n = 2; n <= 4; n += 1) {
      if (chunk.length < n) continue;
      for (let i = 0; i <= chunk.length - n; i += 1) {
        const term = chunk.slice(i, i + n);
        if (TAG_STOPWORDS_CN.has(term)) continue;
        // 单字符停用词构成的 n-gram 通常无意义
        if (/^[的地得了着也都就还又再把被向从到由于对和与及或并且]+$/.test(term)) continue;
        // 长度加权：3/4 字词更可能是术语
        bump(term, n === 2 ? 1 : n === 3 ? 1.6 : 2);
        if (titleLower.includes(term)) bump(term, 1.5);
      }
    }
  }

  // 英文：长度 >= 3 的单词
  const enWords = cleaned.match(/[a-z][a-z0-9+#.-]{2,}/g) || [];
  for (const w of enWords) {
    if (TAG_STOPWORDS_EN.has(w)) continue;
    bump(w, 1);
    if (titleLower.includes(w)) bump(w, 1.5);
  }

  // 去重叠：若较长候选已入选，移除其包含的较短候选
  const ranked = [...counts.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);

  const picked = [];
  for (const [term, score] of ranked) {
    if (picked.length >= max) break;
    // 跳过被已选项包含或包含已选项的（取分数更高的较长项）
    const conflict = picked.some((p) => p.term.includes(term) || term.includes(p.term));
    if (conflict) continue;
    picked.push({ term, score });
  }
  return picked.map((p) => p.term);
}

// ========== 各格式提取器 ==========
// 返回: { text, html, frontmatter? }

async function extractMarkdown(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  return { frontmatter: data, text: content, html: marked.parse(content) };
}

async function extractText(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return { text: raw, html: `<pre class="plain-text">${escapeHtml(raw)}</pre>` };
}

async function extractHtml(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const titleMatch = raw.match(/<title>([\s\S]*?)<\/title>/i);
  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const html = stripScripts(bodyMatch ? bodyMatch[1] : raw);
  return {
    frontmatter: titleMatch ? { title: titleMatch[1].trim() } : {},
    text: htmlToText(html),
    html,
  };
}

async function extractDocx(filePath) {
  const result = await mammoth.convertToHtml({ path: filePath });
  const html = result.value;
  return { text: htmlToText(html), html };
}

async function extractPptx(filePath) {
  const text = await officeparser.parseOfficeAsync(filePath);
  const slides = text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  const html = slides.map((s, i) =>
    `<section class="slide"><h3>幻灯片 ${i + 1}</h3><pre>${escapeHtml(s)}</pre></section>`
  ).join('\n');
  return { text, html };
}

async function extractXlsx(filePath) {
  const text = await officeparser.parseOfficeAsync(filePath);
  return { text, html: `<pre class="plain-text">${escapeHtml(text)}</pre>` };
}

async function extractPdf(filePath) {
  const pdfParse = require('pdf-parse');
  const buf = fs.readFileSync(filePath);
  const data = await pdfParse(buf);
  const text = data.text || '';
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const html = paras.map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`).join('\n');
  return { text, html };
}

async function extractUnsupported(_filePath, ext) {
  const tip = ext === '.doc'
    ? '旧版 Word 二进制格式 (.doc) 暂不支持，建议在 Word 中“另存为 .docx”后重新放入。'
    : ext === '.ppt'
      ? '旧版 PowerPoint 二进制格式 (.ppt) 暂不支持，建议另存为 .pptx 后重新放入。'
      : ext === '.xls'
        ? '旧版 Excel 二进制格式 (.xls) 暂不支持，建议另存为 .xlsx 后重新放入。'
        : `暂不支持的格式: ${ext}`;
  return {
    text: tip,
    html: `<div class="unsupported"><p>⚠️ ${escapeHtml(tip)}</p></div>`,
  };
}

const EXTRACTORS = {
  '.md': extractMarkdown,
  '.markdown': extractMarkdown,
  '.txt': extractText,
  '.html': extractHtml,
  '.htm': extractHtml,
  '.docx': extractDocx,
  '.pptx': extractPptx,
  '.xlsx': extractXlsx,
  '.pdf': extractPdf,
};

const SUPPORTED_EXTS = Object.keys(EXTRACTORS);
const KNOWN_UNSUPPORTED = ['.doc', '.ppt', '.xls'];
const ACCEPT_UPLOAD_EXTS = new Set([...SUPPORTED_EXTS, ...KNOWN_UNSUPPORTED]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 20,
    fileSize: 50 * 1024 * 1024,
  },
});

// 评论图片上传：磁盘存储
const COMMENT_IMG_DIR = path.join(DATA_DIR, 'comment-images');
if (!fs.existsSync(COMMENT_IMG_DIR)) fs.mkdirSync(COMMENT_IMG_DIR, { recursive: true });
const COMMENT_IMG_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);
const commentImageUpload = multer({
  storage: multer.diskStorage({
    destination: COMMENT_IMG_DIR,
    filename: (_req, file, cb) => {
      const ext = (path.extname(file.originalname) || '').toLowerCase();
      const safeExt = COMMENT_IMG_EXTS.has(ext) ? ext : '.png';
      const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`;
      cb(null, name);
    },
  }),
  limits: { files: 1, fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    if (!COMMENT_IMG_EXTS.has(ext)) return cb(new Error('仅支持 png/jpg/jpeg/gif/webp/bmp'));
    if (file.mimetype && !/^image\//i.test(file.mimetype) && file.mimetype !== 'application/octet-stream') {
      return cb(new Error('文件 MIME 类型非法'));
    }
    cb(null, true);
  },
});

function sanitizeFileName(name) {
  return String(name)
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeCategoryPath(input) {
  if (!input) return '';
  const parts = String(input)
    .split(/[\\/]+/)
    .map((p) => p.trim())
    .filter((p) => p && p !== '.' && p !== '..')
    .map((p) => p.replace(/[\\/:*?"<>|]/g, '_'));
  return parts.join(path.sep);
}

function uniqueFilePath(targetDir, originalName) {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext) || 'untitled';
  let fileName = sanitizeFileName(`${base}${ext}`);
  let full = path.join(targetDir, fileName);
  let i = 1;
  while (fs.existsSync(full)) {
    fileName = sanitizeFileName(`${base} (${i})${ext}`);
    full = path.join(targetDir, fileName);
    i += 1;
  }
  return full;
}

// ========== 文件扫描 ==========
function walkDir(dir, baseDir = dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.startsWith('~$')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full, baseDir));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTS.includes(ext) || KNOWN_UNSUPPORTED.includes(ext)) {
        results.push(path.relative(baseDir, full));
      }
    }
  }
  return results;
}

// ========== 文章分析（按 mtime 持久缓存） ==========
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

function normalizeForSearch(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokenizeForQA(text) {
  const raw = normalizeForSearch(text);
  const tokens = [];
  const wordMatches = raw.match(/[a-z0-9]+/g) || [];
  tokens.push(...wordMatches);

  const zhChunks = raw.match(/[\u4e00-\u9fa5]+/g) || [];
  for (const chunk of zhChunks) {
    if (chunk.length === 1) {
      tokens.push(chunk);
      continue;
    }
    for (let i = 0; i < chunk.length - 1; i += 1) {
      tokens.push(chunk.slice(i, i + 2));
    }
  }
  return tokens;
}

function paragraphCandidates(article) {
  const raw = String(article.text || '');
  let paras = raw
    .split(/\n{2,}/)
    .map((p) => p.replace(/[ \t]+/g, ' ').trim())
    .filter((p) => p.length >= 24);

  // 文档（如 docx）若只有单换行，回退按单换行切分以获得有意义的段落集
  if (paras.length < 5) {
    paras = raw
      .split(/\n+/)
      .map((p) => p.replace(/[ \t]+/g, ' ').trim())
      .filter((p) => p.length >= 12);
  }
  return paras.slice(0, 400);
}

function isTocLike(text) {
  const t = String(text || '');
  if (!t) return false;
  const hasCatalogWords = /(目录|版本控制|名词释义|图\d+|表\d+|附件|修订记录)/.test(t);
  const dashPageLike = (t.match(/-\s*\d+\s*-/g) || []).length;
  const headingDense = (t.match(/\b\d+(?:\.\d+){1,}\b/g) || []).length;
  return hasCatalogWords || dashPageLike >= 2 || headingDense >= 4;
}

function isCountQuestion(question) {
  const q = String(question || '');
  return /(几个|多少个|几项|几类|几种|数量|总数|有多少)/.test(q);
}

function containsModuleCount(sentence) {
  const s = String(sentence || '');
  if (!s) return false;
  return /([0-9一二三四五六七八九十百两]+)\s*个\s*模块/.test(s)
    || /模块\s*(共|有|包含|分为)?\s*([0-9一二三四五六七八九十百两]+)\s*个/.test(s);
}

function cnNumberToInt(raw) {
  const s = String(raw || '').trim();
  if (!s) return NaN;
  if (/^\d+$/.test(s)) return Number(s);

  const map = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (s === '十') return 10;

  // 处理十位（如 十三、二十、二十三）
  const m = s.match(/^([一二两三四五六七八九])?十([一二三四五六七八九])?$/);
  if (m) {
    const tens = m[1] ? map[m[1]] : 1;
    const ones = m[2] ? map[m[2]] : 0;
    return tens * 10 + ones;
  }

  // 处理百位简单场景（如 一百、一百二十、一百二十三）
  const h = s.match(/^([一二两三四五六七八九])百([一二三四五六七八九])?十?([一二三四五六七八九])?$/);
  if (h) {
    const hundreds = map[h[1]];
    const tens = h[2] ? map[h[2]] : 0;
    const ones = h[3] ? map[h[3]] : 0;
    const hasTen = /十/.test(s);
    return hundreds * 100 + (hasTen ? tens * 10 : 0) + ones;
  }

  return NaN;
}

function extractModuleCount(sentence) {
  const s = String(sentence || '');
  const m = s.match(/([0-9一二三四五六七八九十百两]+)\s*个\s*模块/)
    || s.match(/模块\s*(共|有|包含|分为)?\s*([0-9一二三四五六七八九十百两]+)\s*个/);
  if (!m) return null;
  const raw = m[1] || m[2];
  const value = cnNumberToInt(raw);
  if (!Number.isFinite(value)) return null;
  return { value, raw };
}

function scoreParagraph(queryTokens, queryText, para) {
  if (!para) return 0;
  const paraTokens = tokenizeForQA(para);
  if (!paraTokens.length) return 0;
  const paraSet = new Set(paraTokens);

  let overlap = 0;
  for (const tk of queryTokens) {
    if (paraSet.has(tk)) overlap += 1;
  }

  const containsPhrase = normalizeForSearch(para).includes(queryText) ? 3 : 0;
  const density = overlap / Math.max(1, Math.min(queryTokens.length, 12));
  const tocPenalty = isTocLike(para) ? 3.2 : 0;
  return overlap + containsPhrase + density - tocPenalty;
}

function buildAnswerFromParagraphs(question, ranked) {
  if (!ranked.length || ranked[0].score < 1.2) {
    return {
      answer: `结论：未能在当前资料中找到明确答案。\n\n建议：\n- 换一种问法，缩小问题范围。\n- 补充更具体的关键词（例如时间、术语、文件名）。`,
      confidence: 0.18,
    };
  }

  // 对“几个/多少”类问题强制做数量证据校验，避免目录文本被误判为答案。
  if (isCountQuestion(question) && /模块/.test(question)) {
    const evidenceSentences = ranked
      .slice(0, 8)
      .flatMap((item) => String(item.paragraph || '').split(/(?<=[。！？.!?])\s*/))
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !isTocLike(s));

    const hit = evidenceSentences
      .find((s) => containsModuleCount(s));

    if (!hit) {
      return {
        answer: '结论：未在当前资料中找到“模块数量”的明确表述。\n\n依据：\n- 已检索到相关文档内容，但命中段落多为目录/流程描述，缺少“X个模块”这类可直接回答的语句。\n\n建议：\n- 可在原文中搜索“个模块 / 模块共 / 模块有 / 模块包含”后再提问。',
        confidence: 0.25,
      };
    }

    const parsed = extractModuleCount(hit);
    if (!parsed) {
      return {
        answer: '结论：找到了模块相关语句，但未解析到可靠数字。\n\n建议：请提供包含明确数字的原文片段。',
        confidence: 0.3,
      };
    }

    return {
      answer: `结论：普天 QMS 包含 ${parsed.value} 个模块。\n\n依据：\n- ${hit}`,
      confidence: 0.78,
    };
  }

  // 主题型查询（如直接输入 "iceberg"、"qms"），生成结构化归纳答案
  if (isTopicQuery(question)) {
    return composeTopicAnswer(question, ranked);
  }

  const top = ranked[0];
  const second = ranked[1];

  const topSentence = cleanForAnswer(top.paragraph)
    .split(/(?<=[。！？.!?])\s*/)
    .filter(Boolean)
    .slice(0, 2)
    .join(' ');

  let answer = `结论：${topSentence}`;
  const evidences = [`- ${topSentence}`];

  if (second && second.score >= top.score * 0.78 && second.article.id !== top.article.id) {
    const secondSentence = cleanForAnswer(second.paragraph)
      .split(/(?<=[。！？.!?])\s*/)
      .filter(Boolean)
      .slice(0, 1)
      .join(' ');
    if (secondSentence) {
      evidences.push(`- ${secondSentence}`);
    }
  }

  answer += `\n\n依据：\n${evidences.join('\n')}`;

  const confidence = Math.max(0.2, Math.min(0.95, top.score / 8));
  return { answer, confidence };
}

// ====== 主题型查询的结构化归纳 ======
function cleanForAnswer(text) {
  return String(text || '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function isTopicQuery(question) {
  const q = String(question || '').trim();
  if (!q) return false;
  if (/[？?]$/.test(q)) return false;
  if (/(吗|呢|如何|怎么|怎样|为何|为什么|什么|是否|哪些|哪个|几个|多少)/.test(q)) return false;
  // 主题型：纯短关键词查询
  const tokens = q.match(/[\u4e00-\u9fa5]+|[a-zA-Z][a-zA-Z0-9_+#.-]*/g) || [];
  const totalLen = tokens.join('').length;
  return tokens.length <= 4 && totalLen <= 16;
}

const TOPIC_BUCKETS = [
  {
    key: 'features',
    title: '功能 / 支持的能力',
    cues: /(支持|提供|具备|实现了|新增|引入|允许|可以|能够|包含|包括|内置|提供了|特性|功能|feature)/i,
    boost: /(支持|提供|引入|新增|specification|feature)/i,
  },
  {
    key: 'how',
    title: '实现方式 / 原理',
    cues: /(通过|利用|基于|采用|使用|借助|结合|依赖|调用|调度|流程|步骤|过程|执行|生成|写入|读取|分区|提交|快照|metadata|实现)/i,
    boost: /(通过|基于|采用|流程|步骤|metadata|快照|提交)/i,
  },
  {
    key: 'keys',
    title: '关键点 / 注意事项',
    cues: /(关键|核心|重点|前提|约束|限制|注意|要求|不能|必须|需要|否则|风险|失败|异常|配置|参数)/i,
    boost: /(关键|核心|前提|约束|限制|必须)/i,
  },
  {
    key: 'problem',
    title: '解决的问题',
    cues: /(解决|避免|防止|减少|降低|提升|改善|优化|缓解|消除|痛点|问题|难点|不足|缺陷)/i,
    boost: /(解决|避免|痛点|问题)/i,
  },
  {
    key: 'scene',
    title: '适用场景',
    cues: /(场景|适用|适合|用于|应用于|常用于|典型|案例|实践|生产|应用|当.{0,10}时|在.{0,10}场景)/i,
    boost: /(场景|适用|适合|用于|典型|案例)/i,
  },
];

function splitSentences(text) {
  const cleaned = cleanForAnswer(text);
  let parts = cleaned
    .split(/(?<=[。！？.!?；;])\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  // 若文本几乎没有句末标点，用换行/分号/逗号回退切分
  if (parts.length <= 1) {
    parts = String(text || '')
      .split(/\n+|[;；]|(?<=[。！？.!?])/)
      .map((s) => cleanForAnswer(s))
      .filter(Boolean);
  }
  return parts.filter((s) => s.length >= 6 && s.length <= 240).filter((s) => !isTocLike(s));
}

function composeTopicAnswer(question, ranked) {
  const queryText = normalizeForSearch(question);
  const queryTokens = new Set(tokenizeForQA(queryText));
  const sentencePool = [];
  const seen = new Set();

  // 收集候选句子（扩大命中段落数，覆盖多源）
  for (const item of ranked.slice(0, 12)) {
    const sents = splitSentences(item.paragraph);
    for (const s of sents) {
      const norm = s.replace(/\s+/g, '');
      if (seen.has(norm)) continue;
      seen.add(norm);
      // 必须与查询有交集，避免无关句子
      const sLower = s.toLowerCase();
      const overlapWithQuery = [...queryTokens].some((t) => sLower.includes(t));
      if (!overlapWithQuery) continue;
      sentencePool.push({ sentence: s, article: item.article, score: item.score });
    }
  }

  if (!sentencePool.length) {
    return {
      answer: `结论：知识库中找到了与「${question}」相关的内容，但未能提取到结构化要点。\n\n建议：\n- 尝试用更完整的问句提问，例如「${question} 是怎么实现的？」`,
      confidence: 0.3,
    };
  }

  const buckets = {};
  for (const def of TOPIC_BUCKETS) buckets[def.key] = [];

  // 分桶：一句话可能落入多个桶，取其中"最匹配"的一个，避免重复
  for (const item of sentencePool) {
    let bestKey = null;
    let bestScore = 0;
    for (const def of TOPIC_BUCKETS) {
      if (!def.cues.test(item.sentence)) continue;
      let s = 1;
      if (def.boost.test(item.sentence)) s += 1;
      if (s > bestScore) {
        bestScore = s;
        bestKey = def.key;
      }
    }
    if (bestKey) {
      buckets[bestKey].push({ ...item, bucketScore: bestScore });
    }
  }

  // 每个桶按 (bucketScore + article.score) 排序，去除已被更长句子包含的短句
  const pickedByBucket = {};
  for (const def of TOPIC_BUCKETS) {
    const arr = buckets[def.key]
      .sort((a, b) => (b.bucketScore + b.score) - (a.bucketScore + a.score));
    const chosen = [];
    for (const it of arr) {
      const norm = it.sentence.replace(/\s+/g, '');
      const dup = chosen.some((c) => {
        const cn = c.sentence.replace(/\s+/g, '');
        return cn.includes(norm) || norm.includes(cn);
      });
      if (dup) continue;
      chosen.push(it);
      if (chosen.length >= 3) break;
    }
    pickedByBucket[def.key] = chosen;
  }

  // 总览：取分数最高且关键词命中的一句作为开篇
  const overview = sentencePool
    .slice()
    .sort((a, b) => b.score - a.score)[0];

  const sourceTitles = [...new Set(ranked.slice(0, 5).map((r) => r.article.title))];

  const lines = [];
  lines.push(`结论：根据知识库中 ${sourceTitles.length} 篇相关资料，对「${question}」的归纳如下。`);
  if (overview) {
    lines.push('');
    lines.push(`概述：${overview.sentence}`);
  }

  let bucketCount = 0;
  for (const def of TOPIC_BUCKETS) {
    const items = pickedByBucket[def.key];
    if (!items.length) continue;
    bucketCount += 1;
    lines.push('');
    lines.push(`${def.title}：`);
    for (const it of items) {
      lines.push(`- ${it.sentence}（来源：${it.article.title}）`);
    }
  }

  if (bucketCount === 0) {
    lines.push('');
    lines.push('要点：');
    for (const it of sentencePool.slice(0, 4)) {
      lines.push(`- ${it.sentence}（来源：${it.article.title}）`);
    }
  }

  // 置信度：覆盖的桶越多越自信
  const baseConf = Math.max(0.3, Math.min(0.9, ranked[0].score / 8));
  const confidence = Math.min(0.95, baseConf + bucketCount * 0.05);

  return {
    answer: lines.join('\n'),
    confidence,
  };
}

// ========== API ==========
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

// ===== 登录相关 =====
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
    maxAge: SESSION_TTL,
  });
  res.json({
    ok: true,
    user: { username: user.username, displayName: user.displayName, role: user.role },
  });
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies?.kb_token;
  if (token) sessions.delete(token);
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
    const isTopic = isTopicQuery(question);
    const limit = isTopic ? 12 : 5;
    const topRanked = ranked
      .filter((r) => r.score >= Math.max(1.0, topScore * (isTopic ? 0.45 : 0.62)))
      .filter((r) => !isTocLike(r.paragraph) || r.score >= topScore * 0.9)
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

// ========== 评论 ==========
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
