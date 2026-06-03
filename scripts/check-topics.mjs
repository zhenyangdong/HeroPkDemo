// scripts/check-topics.mjs
import fs from 'fs';

const raw = fs.readFileSync('./data/topics.json', 'utf8');
const topics = JSON.parse(raw);

if (!Array.isArray(topics) || topics.length === 0) {
  throw new Error('topics store is empty');
}

const ids = new Set(topics.map((t) => t.topicId));
if (ids.size !== topics.length) {
  throw new Error('duplicate topicId found');
}

console.log('TOPIC_STORE_OK');
