import { app, BrowserWindow, dialog } from 'electron';
import log from 'electron-log/main';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RELEASES_API_URL = 'https://api.github.com/repos/TKiller420-dev/cyb3rwrld-checkers-baby-edition/releases/latest';
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

type GitHubReleaseAsset = {
  name: string;
  browser_download_url: string;
};

type GitHubRelease = {
  tag_name: string;
  name: string;
  assets: GitHubReleaseAsset[];
};

let mainWindow: BrowserWindow | null = null;
let updateCheckInFlight = false;
let downloadedUpdatePath: string | null = null;

log.initialize();
log.transports.file.level = 'info';

function normalizeVersion(version: string) {
  return version.replace(/^v/i, '').trim();
}

function compareVersions(left: string, right: string) {
  const leftParts = normalizeVersion(left).split('.').map((part) => Number(part) || 0);
  const rightParts = normalizeVersion(right).split('.').map((part) => Number(part) || 0);
  const totalParts = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < totalParts; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue > rightValue) {
      return 1;
    }

    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

async function fetchLatestRelease() {
  const response = await fetch(RELEASES_API_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Cyb3rWrld-Checkers-Baby-Edition'
    }
  });

  if (!response.ok) {
    throw new Error(`Release lookup failed with ${response.status}.`);
  }

  return response.json() as Promise<GitHubRelease>;
}

async function downloadAsset(downloadUrl: string, destinationPath: string) {
  const response = await fetch(downloadUrl, {
    headers: {
      Accept: 'application/octet-stream',
      'User-Agent': 'Cyb3rWrld-Checkers-Baby-Edition'
    }
  });

  if (!response.ok || !response.body) {
    throw new Error(`Update download failed with ${response.status}.`);
  }

  const output = createWriteStream(destinationPath);
  await pipeline(Readable.fromWeb(response.body as never), output);
}

async function installDownloadedUpdate(updatePath: string) {
  const executablePath = process.execPath;
  const scriptPath = path.join(app.getPath('temp'), `cyb3rwrld-checkers-update-${Date.now()}.cmd`);
  const quotedUpdatePath = `"${updatePath}"`;
  const quotedExecutablePath = `"${executablePath}"`;
  const quotedScriptPath = `"${scriptPath}"`;
  const script = [
    '@echo off',
    'setlocal',
    ':retry',
    `copy /Y ${quotedUpdatePath} ${quotedExecutablePath} >nul 2>nul`,
    'if errorlevel 1 (',
    '  timeout /t 1 /nobreak >nul',
    '  goto retry',
    ')',
    `del /F /Q ${quotedUpdatePath} >nul 2>nul`,
    `start "" ${quotedExecutablePath}`,
    `del /F /Q ${quotedScriptPath} >nul 2>nul`
  ].join('\r\n');

  await writeFile(scriptPath, script, 'utf8');

  spawn('cmd.exe', ['/c', scriptPath], {
    detached: true,
    stdio: 'ignore'
  }).unref();

  app.quit();
}

async function promptToRestartForUpdate() {
  if (!downloadedUpdatePath || !mainWindow) {
    return;
  }

  const choice = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    buttons: ['Restart now', 'Later'],
    defaultId: 0,
    cancelId: 1,
    title: 'Update ready',
    message: 'A newer build of Cyb3rWrld Checkers (Baby edition) is ready.',
    detail: 'Restart now to apply the update.'
  });

  if (choice.response === 0) {
    await installDownloadedUpdate(downloadedUpdatePath);
  }
}

async function checkForUpdates() {
  if (!app.isPackaged || process.platform !== 'win32' || updateCheckInFlight) {
    return;
  }

  updateCheckInFlight = true;

  try {
    const latestRelease = await fetchLatestRelease();
    const latestVersion = normalizeVersion(latestRelease.tag_name);

    if (compareVersions(latestVersion, app.getVersion()) <= 0) {
      return;
    }

    const executableAsset = latestRelease.assets.find((asset) => asset.name.toLowerCase().endsWith('.exe'));
    if (!executableAsset) {
      log.warn('Latest release is missing an exe asset.');
      return;
    }

    const updatesDir = path.join(app.getPath('userData'), 'updates');
    await mkdir(updatesDir, { recursive: true });

    const updatePath = path.join(updatesDir, executableAsset.name);
    await downloadAsset(executableAsset.browser_download_url, updatePath);
    downloadedUpdatePath = updatePath;
    log.info(`Downloaded update ${latestVersion} to ${updatePath}`);
    await promptToRestartForUpdate();
  } catch (error) {
    log.error('Automatic update check failed.', error);
  } finally {
    updateCheckInFlight = false;
  }
}



function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    title: 'Cyb3rWrld Checkers (Baby edition)',
    backgroundColor: '#070b18',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    window.loadURL(process.env.VITE_DEV_SERVER_URL);
    return window;
  }

  window.loadFile(path.join(__dirname, '../dist/index.html'));
  return window;
}



app.whenReady().then(() => {
  mainWindow = createWindow();
  void checkForUpdates();
  setInterval(() => {
    void checkForUpdates();
  }, UPDATE_CHECK_INTERVAL_MS);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
