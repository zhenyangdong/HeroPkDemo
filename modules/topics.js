const fs = require('fs');
const path = require('path');

const TOPICS_DATA_FILE = path.join(__dirname, '..', 'data', 'topics.json');
const TOPICS_CONFIG_FILE = path.join(__dirname, '..', 'config', 'topics.json');
const ARTICLE_TOPIC_MAP_FILE = path.join(__dirname, '..', 'data', 'article-topic-map.json');

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function ensureTopicStore() {
  const storedTopics = readJson(TOPICS_DATA_FILE, []);
  if (Array.isArray(storedTopics) && storedTopics.length > 0) {
    return storedTopics;
  }

  const seededTopics = readJson(TOPICS_CONFIG_FILE, []);
  writeJson(TOPICS_DATA_FILE, seededTopics);
  return seededTopics;
}

function listTopics() {
  const topics = ensureTopicStore();
  return topics.filter((topic) => topic && topic.isActive !== false);
}

function validateTopicId(topicId) {
  if (!topicId) {
    throw new Error('topicId is required');
  }

  const topics = ensureTopicStore();
  const exists = topics.some((topic) => topic && topic.topicId === topicId);
  if (!exists) {
    throw new Error(`unknown topicId: ${topicId}`);
  }
}

function getArticleTopicMap() {
  const map = readJson(ARTICLE_TOPIC_MAP_FILE, {});
  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    return {};
  }
  return map;
}

function setArticleTopic(articleKey, topicId) {
  validateTopicId(topicId);

  const map = getArticleTopicMap();
  map[articleKey] = topicId;
  writeJson(ARTICLE_TOPIC_MAP_FILE, map);
  return map;
}

module.exports = {
  readJson,
  writeJson,
  ensureTopicStore,
  listTopics,
  validateTopicId,
  getArticleTopicMap,
  setArticleTopic,
};
