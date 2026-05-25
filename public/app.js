/* 知识库前端逻辑（多格式版） */
const state = {
  articles: [],
  filterCategory: null,
  filterTag: null,
  filterType: null,
  keyword: '',
  pendingFiles: [],
  currentUser: null,
  currentArticleId: null,
  viewMode: localStorage.getItem('kb_view_mode') || 'grid',
};

const $ = (sel) => document.querySelector(sel);
const debounce = (fn, ms = 250) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

async function api(path, opts) {
  const r = await fetch(path, opts);
  if (r.status === 401) {
    window.location.href = '/login.html';
    throw new Error('未登录');
  }
  if (!r.ok) throw new Error(`API ${path} ${r.status}`);
  return r.json();
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function formatAnswerHtml(raw) {
  const lines = String(raw || '')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!lines.length) return '<p>暂无回答</p>';

  const out = [];
  let listItems = [];
  const flushList = () => {
    if (!listItems.length) return;
    out.push(`<ul>${listItems.map((it) => `<li>${it}</li>`).join('')}</ul>`);
    listItems = [];
  };

  for (const line of lines) {
    const bullet = line.match(/^[-*]\s+(.+)$/);
    const numbered = line.match(/^\d+[.)、]\s+(.+)$/);
    if (bullet || numbered) {
      listItems.push(escapeHtml((bullet || numbered)[1]));
      continue;
    }

    flushList();

    const section = line.match(/^([^：:]{1,12})[：:](.+)$/);
    if (section) {
      out.push(
        `<p><span class="qa-section-title">${escapeHtml(section[1])}：</span>${escapeHtml(section[2].trim())}</p>`
      );
      continue;
    }

    const sentences = line
      .split(/(?<=[。！？.!?])\s+/)
      .filter(Boolean)
      .map((s) => `<p>${escapeHtml(s)}</p>`)
      .join('');
    out.push(sentences || `<p>${escapeHtml(line)}</p>`);
  }

  flushList();
  return out.join('');
}

const TYPE_COLORS = {
  md: '#3b82f6', markdown: '#3b82f6',
  txt: '#6b7280',
  docx: '#2563eb', doc: '#9ca3af',
  pptx: '#f97316', ppt: '#9ca3af',
  xlsx: '#16a34a', xls: '#9ca3af',
  pdf: '#dc2626',
  html: '#a855f7', htm: '#a855f7',
};
function typeBadge(t) {
  const color = TYPE_COLORS[t] || '#6b7280';
  return `<span class="type-badge" style="background:${color}">${escapeHtml(t.toUpperCase())}</span>`;
}

async function loadStats() {
  const stats = await api('/api/stats');
  $('#stats').innerHTML = `
    <div><span class="num">${stats.totalArticles}</span><span>文章</span></div>
    <div><span class="num">${(stats.totalWords / 1000).toFixed(1)}k</span><span>字数</span></div>
    <div><span class="num">${stats.categories.length}</span><span>分类</span></div>
  `;

  const catEl = $('#categories');
  catEl.innerHTML = `<li data-cat="" class="${!state.filterCategory ? 'active' : ''}">
    全部 <span class="count">${stats.totalArticles}</span></li>` +
    stats.categories.map((c) => `
      <li data-cat="${escapeHtml(c.name)}" class="${state.filterCategory === c.name ? 'active' : ''}">
        ${escapeHtml(c.name)} <span class="count">${c.count}</span>
      </li>`).join('');
  catEl.querySelectorAll('li').forEach((li) => {
    li.onclick = () => {
      state.filterCategory = li.dataset.cat || null;
      loadStats(); loadList();
    };
  });

  const typeEl = $('#file-types');
  if (!stats.fileTypes.length) {
    typeEl.innerHTML = '<span class="muted" style="font-size:12px;">暂无</span>';
  } else {
    typeEl.innerHTML = stats.fileTypes.map((t) => `
      <span class="type-chip ${state.filterType === t.name ? 'active' : ''}" data-type="${escapeHtml(t.name)}">
        ${typeBadge(t.name)} <small>${t.count}</small>
      </span>`).join('');
    typeEl.querySelectorAll('.type-chip').forEach((el) => {
      el.onclick = () => {
        state.filterType = state.filterType === el.dataset.type ? null : el.dataset.type;
        loadStats(); loadList();
      };
    });
  }

  const tagEl = $('#tags');
  if (!stats.tags.length) {
    tagEl.innerHTML = '<span class="muted" style="font-size:12px;">暂无标签</span>';
  } else {
    tagEl.innerHTML = stats.tags.map((t) =>
      `<span class="tag ${state.filterTag === t.name ? 'active' : ''}" data-tag="${escapeHtml(t.name)}">
        ${escapeHtml(t.name)} <small>${t.count}</small>
      </span>`
    ).join('');
    tagEl.querySelectorAll('.tag').forEach((el) => {
      el.onclick = () => {
        state.filterTag = state.filterTag === el.dataset.tag ? null : el.dataset.tag;
        loadStats(); loadList();
      };
    });
  }
}

async function loadList() {
  const params = new URLSearchParams();
  if (state.keyword) params.set('q', state.keyword);
  if (state.filterCategory) params.set('category', state.filterCategory);
  if (state.filterTag) params.set('tag', state.filterTag);
  if (state.filterType) params.set('type', state.filterType);

  const data = await api('/api/articles?' + params);
  state.articles = data.items;

  const titleParts = [];
  if (state.filterCategory) titleParts.push(`分类: ${state.filterCategory}`);
  if (state.filterTag) titleParts.push(`标签: ${state.filterTag}`);
  if (state.filterType) titleParts.push(`类型: ${state.filterType}`);
  if (state.keyword) titleParts.push(`搜索: "${state.keyword}"`);
  $('#list-title').textContent = titleParts.length ? titleParts.join(' · ') : '全部文章';
  $('#list-count').textContent = `共 ${data.total} 篇`;

  const listEl = $('#article-list');
  if (!data.items.length) {
    listEl.innerHTML = '';
    $('#empty').hidden = false;
    return;
  }
  $('#empty').hidden = true;

  listEl.classList.toggle('view-grid', state.viewMode === 'grid');
  listEl.classList.toggle('view-list', state.viewMode === 'list');

  if (state.viewMode === 'list') {
    listEl.innerHTML = `
      <div class="article-row article-row-head">
        <span class="col-type">类型</span>
        <span class="col-title">标题</span>
        <span class="col-cat">分类</span>
        <span class="col-tags">标签</span>
        <span class="col-meta">字数</span>
        <span class="col-date">日期</span>
        <span class="col-act"></span>
      </div>
    ` + data.items.map((a) => `
      <div class="article-row ${a.supported ? '' : 'unsupported-card'}" data-id="${a.id}">
        <span class="col-type">${typeBadge(a.fileType)}</span>
        <span class="col-title" title="${escapeHtml(a.title)}">${escapeHtml(a.title)}</span>
        <span class="col-cat">${escapeHtml(a.category)}</span>
        <span class="col-tags">${a.tags.slice(0, 3).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</span>
        <span class="col-meta">${a.wordCount} 字</span>
        <span class="col-date">${fmtDate(a.date)}</span>
        <span class="col-act"><button class="row-delete" data-id="${a.id}" type="button" title="删除">×</button></span>
      </div>
    `).join('');
  } else {
    listEl.innerHTML = data.items.map((a) => `
      <div class="article-card ${a.supported ? '' : 'unsupported-card'}" data-id="${a.id}">
        <button class="card-delete" data-id="${a.id}" title="删除该文件" type="button">×</button>
        <div class="card-head">
          ${typeBadge(a.fileType)}
          <span class="card-cat">${escapeHtml(a.category)}</span>
        </div>
        <h3>${escapeHtml(a.title)}</h3>
        <p class="card-summary">${escapeHtml(a.summary || '（无摘要）')}</p>
        ${a.tags.length ? `<div class="card-tags">${a.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        <div class="card-meta">
          <span>${fmtDate(a.date)}</span>
          <span>${a.wordCount} 字 · ${a.readingMinutes} 分钟</span>
        </div>
      </div>
    `).join('');
  }

  listEl.querySelectorAll('.article-card, .article-row:not(.article-row-head)').forEach((el) => {
    el.onclick = () => openArticle(el.dataset.id);
  });
  listEl.querySelectorAll('.card-delete, .row-delete').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      deleteArticle(btn.dataset.id);
    };
  });
}

function setViewMode(mode) {
  state.viewMode = mode;
  localStorage.setItem('kb_view_mode', mode);
  document.getElementById('view-grid').classList.toggle('active', mode === 'grid');
  document.getElementById('view-list-btn').classList.toggle('active', mode === 'list');
  loadList();
}

async function deleteArticle(id, opts = {}) {
  const article = state.articles.find((a) => a.id === id);
  const name = article ? article.title : '该文件';
  if (!confirm(`确定删除「${name}」？\n该操作会从 articles/ 目录中移除文件，且不可撤销。`)) return;

  try {
    const r = await fetch('/api/articles/' + id, { method: 'DELETE' });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || '删除失败');

    if (opts.fromDetail) backToList();
    await loadStats();
    await loadList();
  } catch (e) {
    alert(`删除失败: ${e.message}`);
  }
}

async function openArticle(id) {
  const a = await api('/api/articles/' + id);
  state.currentArticleId = id;
  $('#view-list').hidden = true;
  $('#view-detail').hidden = false;
  $('#article-content').innerHTML = `
    <div class="article-head">
      ${typeBadge(a.fileType)}
      <span class="muted">${escapeHtml(a.relPath)}</span>
      <button class="detail-delete" data-id="${a.id}" type="button">删除</button>
    </div>
    <h1>${escapeHtml(a.title)}</h1>
    <p class="article-meta">
      ${escapeHtml(a.category)} · ${fmtDate(a.date)} · ${a.wordCount} 字 · 约 ${a.readingMinutes} 分钟
      ${a.tags.length ? ' · ' + a.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join(' ') : ''}
    </p>
    <hr />
    <div class="article-body">${a.html}</div>
    <section class="comments">
      <h3>评论</h3>
      <div class="comment-input">
        <div class="rt-toolbar" id="rt-toolbar">
          <button type="button" data-cmd="bold" title="加粗 (Ctrl+B)"><b>B</b></button>
          <button type="button" data-cmd="italic" title="斜体 (Ctrl+I)"><i>I</i></button>
          <button type="button" data-cmd="underline" title="下划线"><u>U</u></button>
          <button type="button" data-cmd="strikeThrough" title="删除线"><s>S</s></button>
          <span class="rt-sep"></span>
          <button type="button" data-cmd="formatBlock" data-arg="h3" title="标题">H</button>
          <button type="button" data-cmd="formatBlock" data-arg="blockquote" title="引用">”</button>
          <button type="button" data-cmd="formatBlock" data-arg="pre" title="代码块">{ }</button>
          <button type="button" data-cmd="insertUnorderedList" title="无序列表">•—</button>
          <button type="button" data-cmd="insertOrderedList" title="有序列表">1.</button>
          <span class="rt-sep"></span>
          <button type="button" data-cmd="createLink" title="插入链接">🔗</button>
          <button type="button" id="rt-img-btn" title="插入图片">🖼️</button>
          <button type="button" id="rt-emoji-btn" title="插入表情">😀</button>
          <button type="button" data-cmd="removeFormat" title="清除格式">⌫</button>
          <input type="file" id="rt-img-input" accept="image/png,image/jpeg,image/gif,image/webp,image/bmp" hidden />
          <div id="rt-emoji-panel" class="rt-emoji-panel" hidden></div>
        </div>
        <div id="comment-editor" class="rt-editor" contenteditable="true" data-placeholder="写下你的看法，可使用富文本，支持表情😊"></div>
        <div class="comment-input-bar">
          <span class="muted" id="comment-tip">支持 加粗 / 标题 / 列表 / 引用 / 链接</span>
          <button id="comment-submit" type="button">发布评论</button>
        </div>
      </div>
      <div id="comment-list" class="comment-list"></div>
    </section>
  `;
  if (window.hljs) {
    $('#article-content').querySelectorAll('pre code').forEach((b) => window.hljs.highlightElement(b));
  }
  const delBtn = $('#article-content').querySelector('.detail-delete');
  if (delBtn) delBtn.onclick = () => deleteArticle(a.id, { fromDetail: true });

  $('#comment-submit').onclick = submitComment;
  bindRichTextToolbar();
  await loadComments(id);
  window.scrollTo(0, 0);
}

async function loadComments(articleId) {
  try {
    const data = await api(`/api/articles/${articleId}/comments`);
    renderComments(data.items || []);
  } catch (e) {
    $('#comment-list').innerHTML = `<p class="muted">加载评论失败: ${escapeHtml(e.message)}</p>`;
  }
}

function renderCommentBody(c) {
  const raw = String(c.content || '');
  if (c.format === 'html' || /<[a-zA-Z][^>]*>/.test(raw)) {
    return `<div class="comment-body rt-content">${raw}</div>`;
  }
  // 兼容旧的纯文本评论
  return `<div class="comment-body">${escapeHtml(raw).replace(/\n/g, '<br>')}</div>`;
}

function renderComments(items) {
  const el = $('#comment-list');
  if (!items.length) {
    el.innerHTML = '<p class="muted">还没有评论，来抢沙发～</p>';
    return;
  }
  const me = state.currentUser;
  el.innerHTML = items.map((c) => {
    const canDelete = me && (me.username === c.author || me.role === 'admin');
    return `
      <div class="comment-item" data-id="${c.id}">
        <div class="comment-head">
          <strong>${escapeHtml(c.authorName || c.author)}</strong>
          <span class="muted">${new Date(c.createdAt).toLocaleString()}</span>
          ${canDelete ? `<button class="comment-del" data-id="${c.id}" type="button">删除</button>` : ''}
        </div>
        ${renderCommentBody(c)}
      </div>
    `;
  }).join('');
  el.querySelectorAll('.comment-del').forEach((btn) => {
    btn.onclick = () => deleteComment(btn.dataset.id);
  });
}

const EMOJI_GROUPS = [
  { name: '表情', items: ['😀','😁','😂','🤣','😊','😍','😘','😎','🤔','😅','😇','🙂','🙃','😉','😌','😋','😜','🤩','🥰','😏','😒','😞','😔','😢','😭','😤','😡','🤯','😱','🥺','😴','🤗','🤫','🤥','🤐','🤓','🧐','😷','🤒','🤕','🤧'] },
  { name: '手势', items: ['👍','👎','👌','✌️','🤝','👏','🙌','🙏','💪','✊','👊','🤞','🤟','🤘','👋','🤙','👀','💯','✅','❌','❓','❗','⭐','🔥','💡','🎉','🎊','🚀','⚡','💖','💔','❤️','💙','💚','💛','🧡','💜','🖤','🤍','🤎'] },
  { name: '物品', items: ['📌','📎','📝','📄','📁','📅','⏰','🔔','🔒','🔑','🛠️','⚙️','🔍','🔗','📊','📈','📉','💻','🖥️','📱','⌨️','🖱️','💾','💿','📦','🎯','🏆','🎁','☕','🍵'] },
];

function insertHtmlAtCaret(html) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) {
    const editor = document.getElementById('comment-editor');
    if (editor) editor.insertAdjacentHTML('beforeend', html);
    return;
  }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const frag = tpl.content;
  const last = frag.lastChild;
  range.insertNode(frag);
  if (last) {
    range.setStartAfter(last);
    range.setEndAfter(last);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

function buildEmojiPanel(panel, editor) {
  panel.innerHTML = EMOJI_GROUPS.map((g) => `
    <div class="rt-emoji-group">
      <div class="rt-emoji-title">${escapeHtml(g.name)}</div>
      <div class="rt-emoji-grid">
        ${g.items.map((e) => `<button type="button" class="rt-emoji" data-emoji="${escapeHtml(e)}">${e}</button>`).join('')}
      </div>
    </div>
  `).join('');
  panel.querySelectorAll('.rt-emoji').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', () => {
      editor.focus();
      insertHtmlAtCaret(btn.dataset.emoji);
    });
  });
}

function bindRichTextToolbar() {
  const toolbar = document.getElementById('rt-toolbar');
  const editor = document.getElementById('comment-editor');
  if (!toolbar || !editor) return;

  // 粘贴时移除富格式（粘贴为纯文本，避免引入外部样式/脚本）
  editor.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  });

  // 表情面板
  const emojiBtn = document.getElementById('rt-emoji-btn');
  const emojiPanel = document.getElementById('rt-emoji-panel');
  if (emojiBtn && emojiPanel) {
    let built = false;
    emojiBtn.addEventListener('mousedown', (e) => e.preventDefault());
    emojiBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!built) { buildEmojiPanel(emojiPanel, editor); built = true; }
      emojiPanel.hidden = !emojiPanel.hidden;
    });
    document.addEventListener('click', (e) => {
      if (emojiPanel.hidden) return;
      if (e.target === emojiBtn || emojiPanel.contains(e.target)) return;
      emojiPanel.hidden = true;
    });
  }

  // 图片上传
  const imgBtn = document.getElementById('rt-img-btn');
  const imgInput = document.getElementById('rt-img-input');
  if (imgBtn && imgInput) {
    imgBtn.addEventListener('mousedown', (e) => e.preventDefault());
    imgBtn.addEventListener('click', () => imgInput.click());
    imgInput.addEventListener('change', async () => {
      const file = imgInput.files && imgInput.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        alert('图片不能超过 5MB');
        imgInput.value = '';
        return;
      }
      const placeholder = `__img_${Date.now()}__`;
      editor.focus();
      insertHtmlAtCaret(`<span data-placeholder="${placeholder}">[图片上传中...]</span>`);
      try {
        const fd = new FormData();
        fd.append('image', file);
        const r = await fetch('/api/comments/upload-image', { method: 'POST', body: fd });
        if (r.status === 401) { window.location.href = '/login.html'; return; }
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || '上传失败');
        const ph = editor.querySelector(`[data-placeholder="${placeholder}"]`);
        const imgHtml = `<img src="${data.url}" alt="${escapeHtml(data.name || '')}" loading="lazy">`;
        if (ph) {
          ph.outerHTML = imgHtml;
        } else {
          insertHtmlAtCaret(imgHtml);
        }
      } catch (e) {
        const ph = editor.querySelector(`[data-placeholder="${placeholder}"]`);
        if (ph) ph.remove();
        alert(`图片上传失败: ${e.message}`);
      } finally {
        imgInput.value = '';
      }
    });
  }

  toolbar.querySelectorAll('button[data-cmd]').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => e.preventDefault()); // 保留选区
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      let arg = btn.dataset.arg || null;
      if (cmd === 'createLink') {
        const url = prompt('请输入链接地址 (http/https/mailto):', 'https://');
        if (!url) return;
        if (!/^(https?:|mailto:)/i.test(url)) {
          alert('链接必须以 http://、https:// 或 mailto: 开头');
          return;
        }
        document.execCommand('createLink', false, url);
        return;
      }
      document.execCommand(cmd, false, arg);
      editor.focus();
    });
  });
}

async function submitComment() {
  const editor = $('#comment-editor');
  if (!editor) return;
  const html = editor.innerHTML.trim();
  const plain = (editor.innerText || '').trim();
  const hasImg = !!editor.querySelector('img');
  if (!plain && !hasImg) return;
  const btn = $('#comment-submit');
  btn.disabled = true;
  try {
    await api(`/api/articles/${state.currentArticleId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: html }),
    });
    editor.innerHTML = '';
    await loadComments(state.currentArticleId);
  } catch (e) {
    alert(`发布失败: ${e.message}`);
  } finally {
    btn.disabled = false;
  }
}

async function deleteComment(commentId) {
  if (!confirm('确定删除该评论？')) return;
  try {
    await api(`/api/articles/${state.currentArticleId}/comments/${commentId}`, {
      method: 'DELETE',
    });
    await loadComments(state.currentArticleId);
  } catch (e) {
    alert(`删除失败: ${e.message}`);
  }
}

function backToList() {
  $('#view-detail').hidden = true;
  $('#view-list').hidden = false;
}

function bindQAEvents() {
  const input = $('#qa-question');
  const askBtn = $('#qa-ask');
  const result = $('#qa-result');

  async function askQuestion() {
    const question = input.value.trim();
    if (!question) return;

    askBtn.disabled = true;
    askBtn.textContent = '思考中...';
    result.hidden = false;
    $('#qa-answer').textContent = '正在分析知识库内容，请稍候...';
    $('#qa-confidence').textContent = '';
    $('#qa-sources').innerHTML = '';

    try {
      const data = await api('/api/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      $('#qa-answer').innerHTML = formatAnswerHtml(data.answer || '未获得回答');
      $('#qa-confidence').textContent = `置信度: ${Math.round((data.confidence || 0) * 100)}%`;

      if (data.sources?.length) {
        $('#qa-sources').innerHTML = data.sources.map((s, i) => `
          <button class="qa-source" data-id="${s.id}" type="button">
            <span class="qa-source-title">来源 ${i + 1}: ${escapeHtml(s.title)}</span>
            <span class="qa-source-meta">${escapeHtml(s.relPath)} · 匹配分 ${s.score}</span>
            <span class="qa-source-snippet">${escapeHtml(s.snippet)}</span>
          </button>
        `).join('');
        $('#qa-sources').querySelectorAll('.qa-source').forEach((el) => {
          el.addEventListener('click', () => openArticle(el.dataset.id));
        });
      } else {
        $('#qa-sources').innerHTML = '<p class="muted">暂无可引用来源</p>';
      }
    } catch (e) {
      $('#qa-answer').innerHTML = `<p>${escapeHtml(`问答失败: ${e.message}`)}</p>`;
      $('#qa-confidence').textContent = '';
      $('#qa-sources').innerHTML = '';
    } finally {
      askBtn.disabled = false;
      askBtn.textContent = '提问';
    }
  }

  askBtn.addEventListener('click', askQuestion);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') askQuestion();
  });
}

function setUploadStatus(text, isError = false) {
  const el = $('#upload-status');
  el.textContent = text;
  el.style.color = isError ? '#b91c1c' : '';
}

function updateUploadState() {
  const btn = $('#upload-btn');
  btn.disabled = state.pendingFiles.length === 0;
  if (!state.pendingFiles.length) {
    setUploadStatus('');
    return;
  }
  const names = state.pendingFiles.slice(0, 2).map((f) => f.name).join('，');
  const more = state.pendingFiles.length > 2 ? ` 等 ${state.pendingFiles.length} 个文件` : '';
  setUploadStatus(`已选择: ${names}${more}`);
}

function bindUploadEvents() {
  const input = $('#upload-files');
  const pickBtn = $('#pick-files');
  const uploadBtn = $('#upload-btn');
  const dropzone = $('#upload-dropzone');

  pickBtn.addEventListener('click', () => input.click());

  input.addEventListener('change', () => {
    state.pendingFiles = Array.from(input.files || []);
    updateUploadState();
  });

  dropzone.addEventListener('click', () => input.click());
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    state.pendingFiles = Array.from(e.dataTransfer?.files || []);
    updateUploadState();
  });

  uploadBtn.addEventListener('click', async () => {
    if (!state.pendingFiles.length) return;
    const category = $('#upload-category').value.trim();
    const fd = new FormData();
    for (const f of state.pendingFiles) fd.append('files', f);
    if (category) fd.append('category', category);

    uploadBtn.disabled = true;
    pickBtn.disabled = true;
    setUploadStatus('上传中...');

    try {
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || '上传失败');

      const rejectText = data.rejected?.length ? `，拒绝 ${data.rejected.length} 个` : '';
      setUploadStatus(`上传完成: 成功 ${data.count} 个${rejectText}`);

      state.pendingFiles = [];
      input.value = '';
      updateUploadState();
      await loadStats();
      await loadList();
    } catch (e) {
      setUploadStatus(`上传失败: ${e.message}`, true);
    } finally {
      uploadBtn.disabled = state.pendingFiles.length === 0;
      pickBtn.disabled = false;
    }
  });
}

$('#search').addEventListener('input', debounce((e) => {
  state.keyword = e.target.value.trim();
  loadList();
}, 200));

$('#refresh').addEventListener('click', async () => {
  const btn = $('#refresh');
  btn.textContent = '↻ 扫描中...';
  btn.disabled = true;
  try {
    await api('/api/refresh', { method: 'POST' });
    await loadStats();
    await loadList();
  } finally {
    btn.textContent = '↻ 刷新文章';
    btn.disabled = false;
  }
});

$('#back').addEventListener('click', backToList);

document.getElementById('view-grid').addEventListener('click', () => setViewMode('grid'));
document.getElementById('view-list-btn').addEventListener('click', () => setViewMode('list'));

(async () => {
  try {
    const me = await api('/api/me');
    state.currentUser = me.user;
    const userEl = document.getElementById('current-user');
    if (userEl) userEl.textContent = `👤 ${me.user.displayName}（${me.user.role}）`;
  } catch (_) { /* api 已重定向到登录页 */ }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.onclick = async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
  };

  bindQAEvents();
  bindUploadEvents();
  document.getElementById('view-grid').classList.toggle('active', state.viewMode === 'grid');
  document.getElementById('view-list-btn').classList.toggle('active', state.viewMode === 'list');
  await loadStats();
  await loadList();
})();
