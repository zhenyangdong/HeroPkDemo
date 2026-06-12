const importBtn = document.getElementById('importBtn');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const statusBar = document.getElementById('statusBar');
const metaText = document.getElementById('metaText');
const pageInfo = document.getElementById('pageInfo');
const pageList = document.getElementById('pageList');
const slideImage = document.getElementById('slideImage');
const recentList = document.getElementById('recentList');

const state = {
  slides: [],
  pageCount: 0,
  currentPage: 0,
  name: '',
  zipPath: '',
  recentImports: [],
};

function setStatus(text) {
  statusBar.textContent = text;
}

function setControlsEnabled(enabled) {
  prevBtn.disabled = !enabled;
  nextBtn.disabled = !enabled;
}

function updateZipButtonState() {
  downloadZipBtn.disabled = !state.zipPath;
}

function buildPageList() {
  pageList.innerHTML = '';

  for (let page = 1; page <= state.pageCount; page += 1) {
    const btn = document.createElement('button');
    btn.className = 'page-item';
    btn.textContent = `第 ${page} 页`;
    btn.dataset.page = String(page);
    btn.addEventListener('click', () => {
      goToPage(page);
    });
    pageList.appendChild(btn);
  }
}

function refreshActivePage() {
  const buttons = pageList.querySelectorAll('.page-item');
  buttons.forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.page) === state.currentPage);
  });
}

function updatePageInfo() {
  if (!state.pageCount) {
    pageInfo.textContent = '- / -';
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  pageInfo.textContent = `${state.currentPage} / ${state.pageCount}`;
  prevBtn.disabled = state.currentPage <= 1;
  nextBtn.disabled = state.currentPage >= state.pageCount;
}

function formatRecentTime(isoText) {
  const value = new Date(isoText);
  if (Number.isNaN(value.getTime())) {
    return '';
  }
  return `${value.getMonth() + 1}/${value.getDate()} ${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function renderRecentList() {
  recentList.innerHTML = '';

  if (!state.recentImports.length) {
    const empty = document.createElement('div');
    empty.className = 'recent-empty';
    empty.textContent = '暂无记录';
    recentList.appendChild(empty);
    return;
  }

  state.recentImports.forEach((item) => {
    const button = document.createElement('button');
    button.className = 'recent-item';
    button.type = 'button';

    const title = document.createElement('div');
    title.className = 'recent-title';
    title.textContent = item.name || '未命名文件';

    const sub = document.createElement('div');
    sub.className = 'recent-sub';
    const timeText = formatRecentTime(item.importedAt);
    sub.textContent = `${item.pageCount || '-'} 页${timeText ? ` | ${timeText}` : ''}`;

    button.appendChild(title);
    button.appendChild(sub);

    button.addEventListener('click', async () => {
      setStatus('正在打开历史导入记录...');
      const result = await window.pptApi.openRecentImport(item.id);
      if (!result?.ok) {
        setStatus(`打开失败: ${result?.message || '未知错误'}`);
        return;
      }
      applyImportResult(result);
      setStatus('已从历史记录恢复展示');
    });

    recentList.appendChild(button);
  });
}

function applyImportResult(result) {
  state.slides = result.slides;
  state.pageCount = result.pageCount;
  state.name = result.name;
  state.zipPath = result.zipPath || '';

  metaText.textContent = `${state.name} | 共 ${state.pageCount} 页`;
  buildPageList();
  goToPage(1);
  updateZipButtonState();
}

async function loadRecentImports() {
  const recent = await window.pptApi.getRecentImports();
  state.recentImports = Array.isArray(recent) ? recent : [];
  renderRecentList();
}

function goToPage(page) {
  if (!state.slides.length || page < 1 || page > state.pageCount) {
    return;
  }

  state.currentPage = page;
  slideImage.src = state.slides[page - 1].url;
  refreshActivePage();
  updatePageInfo();
}

async function importPptFlow() {
  setStatus('请选择一个 PPT/PPTX 文件...');
  const picked = await window.pptApi.pickPptFile();

  if (!picked) {
    setStatus('已取消导入');
    return;
  }

  setStatus('正在导出每一页图片，请稍候...');
  importBtn.disabled = true;
  setControlsEnabled(false);
  downloadZipBtn.disabled = true;

  try {
    const result = await window.pptApi.importPpt(picked);

    if (!result?.ok) {
      setStatus(`导入失败: ${result?.message || '未知错误'}`);
      return;
    }

    applyImportResult(result);
    await loadRecentImports();
    setStatus(`导入成功，可按页查看幻灯片图片（引擎: ${result.engine || '未知'}）`);
  } catch (error) {
    setStatus(`导入失败: ${error?.message || '未知错误'}`);
  } finally {
    importBtn.disabled = false;
  }
}

async function downloadZipFlow() {
  if (!state.zipPath) {
    setStatus('当前没有可下载的 ZIP，请先导入 PPT。');
    return;
  }

  downloadZipBtn.disabled = true;
  setStatus('正在保存 ZIP，请选择目标位置...');

  try {
    const result = await window.pptApi.saveSlideZip({
      zipPath: state.zipPath,
      suggestedName: `${state.name || 'slides'}.zip`,
    });

    if (!result?.ok) {
      if (result?.canceled) {
        setStatus('已取消保存 ZIP');
      } else {
        setStatus(`保存失败: ${result?.message || '未知错误'}`);
      }
      return;
    }

    const successText = `下载成功，ZIP 已保存: ${result.savedPath}`;
    setStatus(successText);
    window.alert(successText);
  } catch (error) {
    setStatus(`保存失败: ${error?.message || '未知错误'}`);
  } finally {
    updateZipButtonState();
  }
}

importBtn.addEventListener('click', importPptFlow);
downloadZipBtn.addEventListener('click', downloadZipFlow);

prevBtn.addEventListener('click', () => {
  goToPage(state.currentPage - 1);
});

nextBtn.addEventListener('click', () => {
  goToPage(state.currentPage + 1);
});

updatePageInfo();
loadRecentImports();
