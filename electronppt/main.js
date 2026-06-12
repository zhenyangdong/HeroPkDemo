const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { pathToFileURL } = require('url');

const execFileAsync = promisify(execFile);
const RECENT_LIMIT = 12;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

async function ensureImportDir() {
  const importDir = path.join(app.getPath('userData'), 'imports');
  await fs.mkdir(importDir, { recursive: true });
  return importDir;
}

function getRecentFilePath() {
  return path.join(app.getPath('userData'), 'recent-imports.json');
}

async function readRecentImports() {
  const filePath = getRecentFilePath();

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return [];
    }
    return [];
  }
}

async function writeRecentImports(items) {
  const filePath = getRecentFilePath();
  await fs.writeFile(filePath, JSON.stringify(items, null, 2), 'utf8');
}

async function pushRecentImport(entry) {
  const current = await readRecentImports();
  const next = [entry, ...current.filter((item) => item.id !== entry.id)].slice(0, RECENT_LIMIT);
  await writeRecentImports(next);
  return next;
}

function getZipPathForSlideDir(slideDir) {
  return `${slideDir}.zip`;
}

async function createZipArchive(sourceDir, zipPath) {
  const scriptContent = [
    'param([string]$sourceDir, [string]$zipPath)',
    '$ErrorActionPreference = "Stop"',
    'if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }',
    'Compress-Archive -Path (Join-Path $sourceDir "*") -DestinationPath $zipPath -Force',
    'Write-Output "ZIP:$zipPath"',
  ].join('\n');

  const scriptPath = path.join(os.tmpdir(), `electronppt-zip-${Date.now()}.ps1`);

  try {
    await fs.writeFile(scriptPath, `\uFEFF${scriptContent}`, 'utf8');

    const winPsExe = path.join(
      process.env.SystemRoot || 'C:\\Windows',
      'System32',
      'WindowsPowerShell',
      'v1.0',
      'powershell.exe'
    );
    const pwshExe = path.join(
      process.env.ProgramFiles || 'C:\\Program Files',
      'PowerShell',
      '7',
      'pwsh.exe'
    );

    const shellCandidates = [
      { exe: pwshExe, args: ['-NoProfile', '-NonInteractive', '-Sta'] },
      { exe: 'pwsh', args: ['-NoProfile', '-NonInteractive', '-Sta'] },
      { exe: winPsExe, args: ['-NoProfile', '-NonInteractive', '-Sta', '-ExecutionPolicy', 'Bypass'] },
    ];

    let lastShellError = '';

    for (const shell of shellCandidates) {
      try {
        const { stdout } = await execFileAsync(shell.exe, [
          ...shell.args,
          '-File',
          scriptPath,
          sourceDir,
          zipPath,
        ]);

        const zipLine = stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find((line) => line.startsWith('ZIP:'));

        if (!zipLine) {
          throw new Error(`NO_ZIP_LINE:${stdout || 'empty output'}`);
        }

        return zipPath;
      } catch (error) {
        lastShellError = error?.message || String(error);
      }
    }

    throw new Error(`ZIP_CREATE_FAILED:${lastShellError}`);
  } finally {
    await fs.rm(scriptPath, { force: true });
  }
}

async function exportSlidesByOfficeApp(pptPath, outputDir) {
  const scriptContent = [
    'param([string]$pptPath, [string]$outputDir)',
    '$ErrorActionPreference = "Stop"',
    '$apps = @(',
    '  @{ ProgId = "PowerPoint.Application"; Name = "Microsoft PowerPoint" },',
    '  @{ ProgId = "PowerPoint.Application.16"; Name = "Microsoft PowerPoint 16" },',
    '  @{ ProgId = "Kwpp.Application"; Name = "WPS Presentation" }',
    ')',
    '$errors = @()',
    'foreach ($appInfo in $apps) {',
    '  $officeApp = $null',
    '  $presentation = $null',
    '  try {',
    '    $officeApp = New-Object -ComObject $appInfo.ProgId',
    '    $officeApp.Visible = -1',
    '    $presentation = $officeApp.Presentations.Open($pptPath, $false, $true, $true)',
    '    if (-not (Test-Path -LiteralPath $outputDir)) { New-Item -ItemType Directory -Path $outputDir | Out-Null }',
    '    $presentation.Export($outputDir, "PNG", 1920, 1080)',
    '    $count = $presentation.Slides.Count',
    '    Write-Output "ENGINE:$($appInfo.Name)"',
    '    Write-Output "COUNT:$count"',
    '    return',
    '  } catch {',
    '    $errors += "$($appInfo.ProgId): $($_.Exception.Message)"',
    '  } finally {',
    '    if ($presentation -ne $null) { $presentation.Close() }',
    '    if ($officeApp -ne $null) { $officeApp.Quit() }',
    '  }',
    '}',
    'if ($errors.Count -eq 0) { throw "NO_OFFICE_APP:Unknown error" }',
    'throw ("NO_OFFICE_APP:" + ($errors -join " | "))',
  ].join('\n');

  const scriptPath = path.join(os.tmpdir(), `electronppt-export-${Date.now()}.ps1`);

  try {
    // PowerShell 5 on Windows can misread UTF-8 without BOM and break parsing.
    await fs.writeFile(scriptPath, `\uFEFF${scriptContent}`, 'utf8');
    const winPsExe = path.join(
      process.env.SystemRoot || 'C:\\Windows',
      'System32',
      'WindowsPowerShell',
      'v1.0',
      'powershell.exe'
    );
    const pwshExe = path.join(
      process.env.ProgramFiles || 'C:\\Program Files',
      'PowerShell',
      '7',
      'pwsh.exe'
    );

    const shellCandidates = [
      { exe: pwshExe, args: ['-NoProfile', '-NonInteractive', '-Sta'] },
      { exe: 'pwsh', args: ['-NoProfile', '-NonInteractive', '-Sta'] },
      { exe: winPsExe, args: ['-NoProfile', '-NonInteractive', '-Sta', '-ExecutionPolicy', 'Bypass'] },
    ];

    let lastShellError = '';

    for (const shell of shellCandidates) {
      try {
        const { stdout, stderr } = await execFileAsync(shell.exe, [
          ...shell.args,
          '-File',
          scriptPath,
          pptPath,
          outputDir,
        ]);

        const engineLine = stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find((line) => line.startsWith('ENGINE:'));

        if (!engineLine) {
          throw new Error(`NO_ENGINE_LINE:${stdout || stderr || 'empty output'}`);
        }

        return {
          engine: engineLine.replace('ENGINE:', ''),
          rawStderr: stderr || '',
        };
      } catch (error) {
        lastShellError = error?.message || String(error);
      }
    }

    throw new Error(`NO_OFFICE_APP:${lastShellError}`);
  } finally {
    await fs.rm(scriptPath, { force: true });
  }
}

async function collectSlideImages(outputDir) {
  const files = await fs.readdir(outputDir);

  const slideFiles = files
    .filter((file) => /\.(png|jpg|jpeg)$/i.test(file))
    .sort((a, b) => {
      const aNum = Number((a.match(/\d+/) || ['0'])[0]);
      const bNum = Number((b.match(/\d+/) || ['0'])[0]);

      if (aNum !== bNum) {
        return aNum - bNum;
      }

      return a.localeCompare(b, 'zh-CN');
    });

  return slideFiles.map((file) => {
    const fullPath = path.join(outputDir, file);
    return {
      name: file,
      path: fullPath,
      url: pathToFileURL(fullPath).href,
    };
  });
}

async function buildImportResult(name, slideDir, engine) {
  const slides = await collectSlideImages(slideDir);

  if (slides.length === 0) {
    throw new Error('导入目录中未找到可展示图片，请重新导入该 PPT。');
  }

  const zipPath = getZipPathForSlideDir(slideDir);
  await createZipArchive(slideDir, zipPath);

  return {
    ok: true,
    name,
    pageCount: slides.length,
    engine,
    slides,
    slideDir,
    zipPath,
  };
}

function validatePptPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.ppt' && ext !== '.pptx') {
    throw new Error('仅支持 .ppt / .pptx 文件');
  }
}

ipcMain.handle('pick-ppt-file', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择 PPT 文件',
    properties: ['openFile'],
    filters: [{ name: 'PowerPoint', extensions: ['ppt', 'pptx'] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('import-ppt', async (_event, pptPath) => {
  try {
    validatePptPath(pptPath);

    const importDir = await ensureImportDir();
    const baseName = path.basename(pptPath, path.extname(pptPath));
    const safeName = baseName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
    const targetDir = path.join(importDir, `${safeName}-${Date.now()}`);
    await fs.mkdir(targetDir, { recursive: true });
    const exportInfo = await exportSlidesByOfficeApp(pptPath, targetDir);
    const result = await buildImportResult(path.basename(pptPath), targetDir, exportInfo.engine);

    await pushRecentImport({
      id: `${Date.now()}-${safeName}`,
      name: result.name,
      pptPath,
      slideDir: targetDir,
      pageCount: result.pageCount,
      engine: result.engine,
      importedAt: new Date().toISOString(),
    });

    return result;
  } catch (error) {
    let message = error?.message || '导入失败';

    if (/NO_OFFICE_APP/i.test(message)) {
      const detail = message.replace(/^NO_OFFICE_APP:/i, '').trim();
      message = detail
        ? `未检测到可用的演示引擎。请安装 Microsoft PowerPoint 或 WPS 演示后再导入。底层错误: ${detail}`
        : '未检测到可用的演示引擎。请安装 Microsoft PowerPoint 或 WPS 演示后再导入。';
    } else if (/Open|Presentations|Export|SaveAs|0x800/i.test(message)) {
      message = `演示软件调用失败: ${message}`;
    }

    return {
      ok: false,
      message,
    };
  }
});

ipcMain.handle('save-slide-zip', async (_event, payload) => {
  try {
    const zipPath = payload?.zipPath;
    const suggestedName = payload?.suggestedName || 'slides.zip';

    if (!zipPath) {
      return {
        ok: false,
        message: '缺少 ZIP 文件，请先重新导入 PPT。',
      };
    }

    await fs.access(zipPath);

    const target = await dialog.showSaveDialog({
      title: '保存全部图片 ZIP',
      defaultPath: suggestedName,
      filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }],
    });

    if (target.canceled || !target.filePath) {
      return { ok: false, canceled: true };
    }

    await fs.copyFile(zipPath, target.filePath);

    return {
      ok: true,
      savedPath: target.filePath,
    };
  } catch (error) {
    return {
      ok: false,
      message: error?.message || 'ZIP 保存失败',
    };
  }
});

ipcMain.handle('get-recent-imports', async () => {
  return readRecentImports();
});

ipcMain.handle('open-recent-import', async (_event, recentId) => {
  try {
    const items = await readRecentImports();
    const target = items.find((item) => item.id === recentId);

    if (!target) {
      return {
        ok: false,
        message: '未找到该历史记录，请重新导入。',
      };
    }

    await fs.access(target.slideDir);
    return await buildImportResult(target.name, target.slideDir, target.engine || 'history');
  } catch (error) {
    return {
      ok: false,
      message: '历史导入记录已失效，请重新导入 PPT。',
    };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
