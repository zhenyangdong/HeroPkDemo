// ========== 评论存储 ==========
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');

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

module.exports = {
  loadComments,
  saveComments,
  sanitizeCommentHtml,
  COMMENT_ALLOWED_TAGS,
};