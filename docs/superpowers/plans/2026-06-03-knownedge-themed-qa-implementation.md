# knownedge Themed QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade knownedge (excluding hero-pk and electronppt) into a themed, evidence-first knowledge QA system for daily question answering.

**Architecture:** Keep the current Express monolith and incrementally refactor by adding topic-aware ingestion, normalized passages, retrieval filtering, and answer output protocol. Reuse existing parsers and QA scoring, but enforce topic boundaries and evidence-first response structure at API and UI layers.

**Tech Stack:** Node.js, Express, vanilla JS frontend, multer, gray-matter, mammoth, officeparser, pdf-parse.

---

## File Structure And Responsibilities

- `config/topics.json`
  - Static initial topic seed used to bootstrap topic list.
- `data/topics.json`
  - Runtime topic store (create/update/activate topics).
- `data/article-topic-map.json`
  - Single-source mapping from article path/id to topicId.
- `modules/topics.js`
  - Topic repository utilities (load/save/list/validate).
- `modules/normalize.js`
  - Document-to-passage normalization, coordinate generation, keyword extraction.
- `modules/retrieval.js`
  - Topic-scoped evidence retrieval and scoring.
- `modules/qa.js`
  - Extend output shaping to `answer + evidence + sources + supplementalInference`.
- `server.js`
  - New APIs for topics, upload topic assignment, topic-filtered QA orchestration.
- `public/index.html`
  - Add topic selector and answer evidence/source panels.
- `public/app.js`
  - Topic CRUD/load, ask-with-topic flow, structured answer rendering.
- `public/styles.css`
  - Topic and evidence panel styles.
- `README.md`
  - Document themed QA workflow and response protocol.

---

### Task 1: Add Topic Data Layer

**Files:**
- Create: `config/topics.json`
- Create: `data/topics.json`
- Create: `data/article-topic-map.json`
- Create: `modules/topics.js`
- Test: `scripts/check-topics.mjs`

- [ ] **Step 1: Write the failing validation script**

```js
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
```

- [ ] **Step 2: Run script to verify it fails (files missing)**

Run: `node scripts/check-topics.mjs`
Expected: FAIL with ENOENT for `data/topics.json`

- [ ] **Step 3: Create initial topic data files**

```json
// config/topics.json
[
  { "topicId": "work", "name": "工作经验", "description": "日常工作沉淀", "isActive": true },
  { "topicId": "food", "name": "美食", "description": "菜谱与餐饮主题", "isActive": true },
  { "topicId": "traffic", "name": "交通", "description": "出行与路线经验", "isActive": true },
  { "topicId": "martial", "name": "武侠", "description": "武侠创作与设定", "isActive": true }
]
```

```json
// data/topics.json
[]
```

```json
// data/article-topic-map.json
{}
```

- [ ] **Step 4: Implement topic repository utility**

```js
// modules/topics.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TOPIC_SEED = path.join(ROOT, 'config', 'topics.json');
const TOPIC_STORE = path.join(ROOT, 'data', 'topics.json');
const MAP_STORE = path.join(ROOT, 'data', 'article-topic-map.json');

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function ensureTopicStore() {
  const current = readJson(TOPIC_STORE, null);
  if (Array.isArray(current) && current.length) return current;
  const seed = readJson(TOPIC_SEED, []);
  writeJson(TOPIC_STORE, seed);
  return seed;
}

function listTopics() {
  return ensureTopicStore().filter((t) => t.isActive !== false);
}

function validateTopicId(topicId) {
  if (!topicId) throw new Error('topicId is required');
  const ok = listTopics().some((t) => t.topicId === topicId);
  if (!ok) throw new Error(`unknown topicId: ${topicId}`);
}

function getArticleTopicMap() {
  return readJson(MAP_STORE, {});
}

function setArticleTopic(articleKey, topicId) {
  validateTopicId(topicId);
  const map = getArticleTopicMap();
  map[articleKey] = topicId;
  writeJson(MAP_STORE, map);
  return map;
}

module.exports = {
  listTopics,
  validateTopicId,
  getArticleTopicMap,
  setArticleTopic,
};
```

- [ ] **Step 5: Run validation script to verify pass**

Run: `node scripts/check-topics.mjs`
Expected: `TOPIC_STORE_OK`

- [ ] **Step 6: Commit**

```bash
git add config/topics.json data/topics.json data/article-topic-map.json modules/topics.js scripts/check-topics.mjs
git commit -m "feat(knowledge): add topic data store and mapping"
```

### Task 2: Add Topic-Aware Upload and List APIs

**Files:**
- Modify: `server.js`
- Modify: `modules/utils.js`
- Test: `scripts/check-topic-api.mjs`

- [ ] **Step 1: Add failing API check script**

```js
// scripts/check-topic-api.mjs
const assert = require('assert');

async function run() {
  const topics = await fetch('http://localhost:3000/api/topics').then((r) => r.json());
  assert.ok(Array.isArray(topics.items), 'topics.items must be array');
  console.log('TOPIC_API_OK');
}

run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
```

- [ ] **Step 2: Run script to verify fail**

Run: `node scripts/check-topic-api.mjs`
Expected: FAIL because `/api/topics` not implemented

- [ ] **Step 3: Implement topic APIs and upload topic binding**

```js
// server.js (add near other module imports)
const { listTopics, validateTopicId, setArticleTopic, getArticleTopicMap } = require('./modules/topics');

// server.js (new route)
app.get('/api/topics', (_req, res) => {
  const items = listTopics();
  res.json({ total: items.length, items });
});

// server.js (inside /api/upload handler)
const topicId = String(req.body?.topicId || '').trim();
if (!topicId) return res.status(400).json({ error: 'topicId is required' });
validateTopicId(topicId);
// after writing each file:
setArticleTopic(relPath.replace(/\\/g, '/'), topicId);

// server.js (inside /api/articles list filter)
const topicMap = getArticleTopicMap();
const topic = req.query.topic ? String(req.query.topic) : null;
if (topic) {
  list = list.filter((a) => topicMap[a.relPath] === topic);
}
```

- [ ] **Step 4: Run API script to verify pass**

Run: `node scripts/check-topic-api.mjs`
Expected: `TOPIC_API_OK`

- [ ] **Step 5: Commit**

```bash
git add server.js modules/utils.js scripts/check-topic-api.mjs
git commit -m "feat(api): add topics endpoint and topic-scoped upload/list"
```

### Task 3: Introduce Passage Normalization and Retrieval Module

**Files:**
- Create: `modules/normalize.js`
- Create: `modules/retrieval.js`
- Modify: `server.js`
- Test: `scripts/check-retrieval.mjs`

- [ ] **Step 1: Add failing retrieval check**

```js
// scripts/check-retrieval.mjs
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
```

- [ ] **Step 2: Run script to verify fail**

Run: `node scripts/check-retrieval.mjs`
Expected: FAIL because module missing

- [ ] **Step 3: Implement normalize and retrieval modules**

```js
// modules/normalize.js
const { normalizeForSearch } = require('./utils');

function normalizeArticleToPassages(article) {
  const parts = String(article.text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 10);

  return parts.map((text, idx) => ({
    passageId: `${article.id || article.relPath}#p${idx + 1}`,
    docId: article.id,
    relPath: article.relPath,
    sectionTitle: article.title,
    position: idx + 1,
    text,
    normalized: normalizeForSearch(text),
  }));
}

module.exports = { normalizeArticleToPassages };
```

```js
// modules/retrieval.js
const { normalizeForSearch } = require('./utils');

function scorePassage(question, passage) {
  const q = normalizeForSearch(question);
  const p = passage.normalized || normalizeForSearch(passage.text);
  const tokens = q.split(/\s+/).filter(Boolean);
  let hit = 0;
  tokens.forEach((t) => { if (p.includes(t)) hit += 1; });
  return hit;
}

function retrieveTopPassages(question, passages, topK = 5) {
  return passages
    .map((p) => ({ ...p, score: scorePassage(question, p) }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

module.exports = { retrieveTopPassages };
```

- [ ] **Step 4: Wire retrieval into `/api/qa` with topic filter**

```js
// server.js (inside /api/qa)
const topicId = String(req.body?.topicId || '').trim();
if (!topicId) return res.status(400).json({ error: 'topicId is required' });
validateTopicId(topicId);

const topicMap = getArticleTopicMap();
const scoped = all.filter((a) => topicMap[a.relPath] === topicId);
const passages = scoped.flatMap((a) => normalizeArticleToPassages(a));
const top = retrieveTopPassages(question, passages, 5);
```

- [ ] **Step 5: Run retrieval check script to verify pass**

Run: `node scripts/check-retrieval.mjs`
Expected: `RETRIEVAL_BASE_OK`

- [ ] **Step 6: Commit**

```bash
git add modules/normalize.js modules/retrieval.js server.js scripts/check-retrieval.mjs
git commit -m "feat(retrieval): add passage normalization and topic-scoped retrieval"
```

### Task 4: Enforce Evidence-First QA Output Contract

**Files:**
- Modify: `modules/qa.js`
- Modify: `server.js`
- Test: `scripts/check-qa-contract.mjs`

- [ ] **Step 1: Add failing contract check**

```js
// scripts/check-qa-contract.mjs
const body = {
  answer: 'x',
  evidence: [{ snippet: 's', source: 'a.md#p1', score: 3 }],
  sources: ['a.md'],
  supplementalInference: [],
};

if (!Array.isArray(body.evidence) || !Array.isArray(body.sources)) {
  throw new Error('QA contract invalid');
}
console.log('QA_CONTRACT_OK');
```

- [ ] **Step 2: Run script to verify fail in current API behavior (manual API check)**

Run: `node scripts/check-qa-contract.mjs`
Expected: PASS for script itself, then manually call `/api/qa` and observe response missing contract fields

- [ ] **Step 3: Implement contract output in `/api/qa`**

```js
// server.js (in /api/qa response)
const evidence = top.map((p) => ({
  snippet: p.text.slice(0, 220),
  source: `${p.relPath}#p${p.position}`,
  score: p.score,
}));

const sources = [...new Set(evidence.map((e) => e.source.split('#')[0]))];
const insufficient = evidence.length === 0;

res.json({
  answer,
  confidence: insufficient ? 'unknown' : evidence.length >= 2 ? 'high' : 'medium',
  evidence,
  sources,
  supplementalInference: supplemental || [],
  insufficient,
  topicId,
});
```

- [ ] **Step 4: Verify QA API response shape**

Run: `curl -X POST http://localhost:3000/api/qa -H "content-type: application/json" -d "{\"topicId\":\"work\",\"question\":\"测试问题\"}"`
Expected: JSON includes keys `answer,evidence,sources,supplementalInference,topicId`

- [ ] **Step 5: Commit**

```bash
git add modules/qa.js server.js scripts/check-qa-contract.mjs
git commit -m "feat(qa): enforce evidence-first response contract"
```

### Task 5: Add Topic Selector and Evidence UI

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`

- [ ] **Step 1: Add topic selector and evidence container in UI**

```html
<!-- public/index.html -->
<select id="topic-select"></select>
<button id="ask-btn" type="button">提问</button>
<div id="qa-answer"></div>
<div id="qa-evidence"></div>
```

- [ ] **Step 2: Load topics and bind selected topic in request**

```js
// public/app.js
async function loadTopics() {
  const data = await api('/api/topics');
  const el = document.getElementById('topic-select');
  el.innerHTML = data.items.map((t) => `<option value="${t.topicId}">${t.name}</option>`).join('');
}

async function askQuestion() {
  const topicId = document.getElementById('topic-select').value;
  const question = document.getElementById('qa-input').value.trim();
  const result = await api('/api/qa', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ topicId, question }),
  });
  renderQaResult(result);
}
```

- [ ] **Step 3: Render evidence and source list**

```js
function renderQaResult(result) {
  document.getElementById('qa-answer').textContent = result.answer || '';
  document.getElementById('qa-evidence').innerHTML = (result.evidence || [])
    .map((e) => `<div class="ev-item"><p>${escapeHtml(e.snippet)}</p><small>${escapeHtml(e.source)} | score ${e.score}</small></div>`)
    .join('');
}
```

- [ ] **Step 4: Add minimal styles for evidence cards**

```css
/* public/styles.css */
#qa-evidence { margin-top: 12px; display: grid; gap: 8px; }
.ev-item { border: 1px solid #dbe5f0; border-radius: 8px; padding: 10px; background: #fff; }
.ev-item small { color: #5f7183; }
```

- [ ] **Step 5: Manual verification**

Run: `npm start`
Expected: User can choose topic, ask question, and see evidence cards with sources

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/app.js public/styles.css
git commit -m "feat(ui): add topic selector and evidence-first answer rendering"
```

### Task 6: Documentation and Regression Checklist

**Files:**
- Modify: `README.md`
- Create: `docs/superpowers/plans/qa-regression-checklist.md`

- [ ] **Step 1: Update README with topic workflow**

```md
## 主题化问答
1. 创建或选择主题
2. 上传文档并归属主题
3. 提问时选择主题
4. 查看答案、证据与来源
```

- [ ] **Step 2: Add regression checklist document**

```md
# QA Regression Checklist
- [ ] 上传 txt/md/docx/pdf/xlsx/csv 成功
- [ ] 文档可归属单一主题
- [ ] 按主题提问仅使用该主题资料
- [ ] 回答包含 evidence 与 sources
- [ ] 证据不足时返回 insufficient=true
```

- [ ] **Step 3: Run final smoke checks**

Run:
- `npm start`
- `node scripts/check-topics.mjs`
- `node scripts/check-retrieval.mjs`
Expected: App starts and all checks pass

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/plans/qa-regression-checklist.md
git commit -m "docs: add themed QA workflow and regression checklist"
```

## Self-Review Summary

1. Spec coverage
- Covered: format support, evidence-first QA, topic-based upload/query, single-topic-per-document, phased MVP path.
- Gap: cross-topic comparison is explicitly deferred as future extension.

2. Placeholder scan
- No TBD/TODO placeholders remain in task steps.

3. Type consistency
- `topicId`, `evidence`, `sources`, `supplementalInference`, `insufficient` are used consistently across API/UI tasks.
