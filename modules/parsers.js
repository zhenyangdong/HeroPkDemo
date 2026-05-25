// ========== 各格式提取器 ==========
const matter = require('gray-matter');
const { marked } = require('marked');
const mammoth = require('mammoth');
const officeparser = require('officeparser');
const { escapeHtml, stripScripts, htmlToText, countWords, makeSummary, TAG_STOPWORDS_CN, TAG_STOPWORDS_EN } = require('./utils');

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
    ? '旧版 Word 二进制格式 (.doc) 暂不支持，建议在 Word 中"另存为 .docx"后重新放入。'
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

// ===== 自动标签提取 =====
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

module.exports = {
  extractMarkdown,
  extractText,
  extractHtml,
  extractDocx,
  extractPptx,
  extractXlsx,
  extractPdf,
  extractUnsupported,
  EXTRACTORS,
  extractAutoTags,
};