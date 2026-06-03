const { normalizeForSearch } = require('./utils');

function normalizeArticleToPassages(article) {
  const parts = String(article.text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 4);

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

module.exports = {
  normalizeArticleToPassages,
};
