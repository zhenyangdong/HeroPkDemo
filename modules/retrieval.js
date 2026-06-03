const { normalizeForSearch } = require('./utils');

function scorePassage(question, passage) {
  const q = normalizeForSearch(question);
  const p = passage.normalized || normalizeForSearch(passage.text);
  const tokens = q.split(/\s+/).filter(Boolean);
  let hit = 0;

  tokens.forEach((t) => {
    if (p.includes(t)) {
      hit += 1;
    }
  });

  return hit;
}

function retrieveTopPassages(question, passages, topK = 5) {
  return passages
    .map((p) => ({ ...p, score: scorePassage(question, p) }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

module.exports = {
  retrieveTopPassages,
};
