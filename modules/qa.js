// ========== QA 逻辑 ==========
const { normalizeForSearch, htmlToText } = require('./utils');

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

function buildAnswerFromParagraphs(question, ranked) {
  if (!ranked.length || ranked[0].score < 1.2) {
    return {
      answer: `结论：未能在当前资料中找到明确答案。\n\n建议：\n- 换一种问法，缩小问题范围。\n- 补充更具体的关键词（例如时间、术语、文件名）。`,
      confidence: 0.18,
    };
  }

  // 对"几个/多少"类问题强制做数量证据校验，避免目录文本被误判为答案。
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
        answer: '结论：未在当前资料中找到"模块数量"的明确表述。\n\n依据：\n- 已检索到相关文档内容，但命中段落多为目录/流程描述，缺少"X个模块"这类可直接回答的语句。\n\n建议：\n- 可在原文中搜索"个模块 / 模块共 / 模块有 / 模块包含"后再提问。',
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

module.exports = {
  tokenizeForQA,
  paragraphCandidates,
  isTocLike,
  isCountQuestion,
  containsModuleCount,
  cnNumberToInt,
  extractModuleCount,
  scoreParagraph,
  cleanForAnswer,
  isTopicQuery,
  TOPIC_BUCKETS,
  splitSentences,
  composeTopicAnswer,
  buildAnswerFromParagraphs,
};