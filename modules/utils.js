// ========== 工具函数 ==========
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

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

function normalizeForSearch(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

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

// 常量
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

const SUPPORTED_EXTS = ['.md', '.markdown', '.txt', '.html', '.htm', '.docx', '.pptx', '.xlsx', '.pdf'];
const KNOWN_UNSUPPORTED = ['.doc', '.ppt', '.xls'];
const ACCEPT_UPLOAD_EXTS = new Set([...SUPPORTED_EXTS, ...KNOWN_UNSUPPORTED]);

module.exports = {
  escapeHtml,
  stripScripts,
  htmlToPlain,
  htmlToText,
  countWords,
  makeSummary,
  normalizeForSearch,
  sanitizeFileName,
  sanitizeCategoryPath,
  uniqueFilePath,
  walkDir,
  TAG_STOPWORDS_CN,
  TAG_STOPWORDS_EN,
  SUPPORTED_EXTS,
  KNOWN_UNSUPPORTED,
  ACCEPT_UPLOAD_EXTS,
};