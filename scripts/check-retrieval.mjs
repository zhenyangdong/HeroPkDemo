import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeArticleToPassages } = require('../modules/normalize');

const sample = {
  title: 'Demo',
  text: '第一段\n\n第二段内容\n\n第三段内容',
  relPath: 'demo.md',
};

const passages = normalizeArticleToPassages(sample);
if (!Array.isArray(passages) || passages.length < 2) {
  throw new Error('passage normalization failed');
}

console.log('RETRIEVAL_BASE_OK');
