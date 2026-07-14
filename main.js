const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const dgram = require('dgram');
const readline = require('readline');
const archiver = require('archiver');
const extractZip = require('extract-zip');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;

const EXCLUDED_DIR_NAMES = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  '__pycache__', 'venv', '.venv', 'target', '.cache', '.parcel-cache',
  '.turbo', 'coverage', '.pytest_cache',
]);

function getProjectsDir() {
  return path.join(os.homedir(), '.claude', 'projects');
}

function readSessionPreview(filePath) {
  return new Promise((resolve) => {
    let preview = '';
    let messageCount = 0;
    let firstTimestamp = null;
    let cwd = null;
    const rl = readline.createInterface({ input: fs.createReadStream(filePath, { encoding: 'utf8' }) });
    rl.on('line', (line) => {
      if (!line.trim()) return;
      messageCount++;
      let obj;
      try {
        obj = JSON.parse(line);
      } catch (e) {
        return;
      }
      if (!cwd && typeof obj.cwd === 'string') cwd = obj.cwd;
      if (preview) return;
      if (obj.type === 'user' && obj.message && typeof obj.message.content === 'string') {
        preview = obj.message.content.slice(0, 140);
        firstTimestamp = obj.timestamp || firstTimestamp;
      } else if (obj.type === 'user' && obj.message && Array.isArray(obj.message.content)) {
        const textPart = obj.message.content.find((c) => c.type === 'text');
        if (textPart) {
          preview = String(textPart.text || '').slice(0, 140);
          firstTimestamp = obj.timestamp || firstTimestamp;
        }
      }
    });
    rl.on('close', () => resolve({ preview, messageCount, firstTimestamp, cwd }));
    rl.on('error', () => resolve({ preview, messageCount, firstTimestamp, cwd }));
  });
}

async function scanSessions() {
  const projectsDir = getProjectsDir();
  if (!fs.existsSync(projectsDir)) return [];
  const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  const sessions = [];
  for (const dir of projectDirs) {
    const projectPath = path.join(projectsDir, dir.name);
    let files;
    try {
      files = fs.readdirSync(projectPath).filter((f) => f.endsWith('.jsonl'));
    } catch (e) {
      continue;
    }
    for (const file of files) {
      const filePath = path.join(projectPath, file);
      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch (e) {
        continue;
      }
      if (stat.size === 0) continue;
      const { preview, messageCount, firstTimestamp, cwd } = await readSessionPreview(filePath);
      sessions.push({
        id: `${dir.name}/${file}`,
        project: dir.name,
        file,
        filePath,
        sizeBytes: stat.size,
        mtimeMs: stat.mtimeMs,
        firstTimestamp,
        messageCount,
        preview: preview || '(нет текстового превью)',
        cwd: cwd && fs.existsSync(cwd) ? cwd : null,
      });
    }
  }
  sessions.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return sessions;
}

function readSessionFile(filePath) {
  const projectsDir = path.resolve(getProjectsDir());
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(projectsDir + path.sep)) {
    throw new Error('Недопустимый путь к файлу сессии');
  }
  return fs.readFileSync(resolved);
}

function saveReceivedSession({ project, filename, data }) {
  const safeProject = String(project).replace(/[\\/:*?"<>|]/g, '_');
  const safeFilename = path.basename(String(filename));
  const projectsDir = getProjectsDir();
  const targetProjectDir = path.join(projectsDir, safeProject);
  fs.mkdirSync(targetProjectDir, { recursive: true });
  let targetFile = path.join(targetProjectDir, safeFilename);
  let renamed = false;
  if (fs.existsSync(targetFile)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = safeFilename.replace(/\.jsonl$/, '');
    targetFile = path.join(targetProjectDir, `${base}-received-${stamp}.jsonl`);
    renamed = true;
  }
  const buffer = Buffer.from(data);
  fs.writeFileSync(targetFile, buffer);
  return { savedAs: path.basename(targetFile), project: safeProject, bytes: buffer.length, renamed };
}

function walkProjectDir(dirPath, onFile) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (e) {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;
      walkProjectDir(path.join(dirPath, entry.name), onFile);
    } else if (entry.isFile()) {
      onFile(path.join(dirPath, entry.name));
    }
  }
}

function getFolderSizeInfo(cwd) {
  if (!cwd || !fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
    throw new Error('Папка проекта не найдена на диске');
  }
  let totalBytes = 0;
  let fileCount = 0;
  walkProjectDir(cwd, (filePath) => {
    try {
      totalBytes += fs.statSync(filePath).size;
      fileCount++;
    } catch (e) {}
  });
  return { totalBytes, fileCount };
}

function createProjectArchive(cwd) {
  return new Promise((resolve, reject) => {
    if (!cwd || !fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
      reject(new Error('Папка проекта не найдена на диске'));
      return;
    }
    const chunks = [];
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('error', (err) => reject(err));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.glob('**/*', {
      cwd,
      ignore: [...EXCLUDED_DIR_NAMES].flatMap((n) => [`${n}/**`, `**/${n}/**`]),
      dot: false,
    });
    archive.finalize();
  });
}

async function chooseProjectFolder(folderName) {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: `Куда сохранить проект «${folderName}»?`,
    buttonLabel: 'Сохранить сюда',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
}

function extractProjectArchive({ data, folderName, destDir }) {
  return new Promise((resolve, reject) => {
    (async () => {
      const safeFolderName = String(folderName || 'project').replace(/[\\/:*?"<>|]/g, '_');
      let finalDestDir = destDir;
      if (!finalDestDir) {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const destRoot = path.join(os.homedir(), 'ClaudeSessionTransfer', 'received-projects');
        finalDestDir = path.join(destRoot, `${safeFolderName}-${stamp}`);
      }
      const tmpZip = path.join(os.tmpdir(), `cst-project-${crypto.randomUUID()}.zip`);
      try {
        fs.mkdirSync(finalDestDir, { recursive: true });
        fs.writeFileSync(tmpZip, Buffer.from(data));
        await extractZip(tmpZip, { dir: finalDestDir });
        resolve({ destDir: finalDestDir });
      } catch (err) {
        reject(err);
      } finally {
        fs.rm(tmpZip, { force: true }, () => {});
      }
    })();
  });
}

const DISCOVERY_PORT = 47823;
const DISCOVERY_APP_ID = 'claude-session-transfer-v1';
const DISCOVERY_TTL_MS = 8000;
const instanceId = crypto.randomUUID();

let presence = { receiving: false, code: null };
const discoveredDevices = new Map(); // instanceId -> { deviceName, receiving, code, address, lastSeen }

function getBroadcastAddresses() {
  const addresses = new Set(['255.255.255.255']);
  const interfaces = os.networkInterfaces();
  for (const ifaceList of Object.values(interfaces)) {
    if (!ifaceList) continue;
    for (const iface of ifaceList) {
      if (iface.family !== 'IPv4' || iface.internal) continue;
      const ipParts = iface.address.split('.').map(Number);
      const maskParts = iface.netmask.split('.').map(Number);
      if (ipParts.length !== 4 || maskParts.length !== 4) continue;
      const broadcastParts = ipParts.map((octet, i) => (octet | (~maskParts[i] & 0xff)) & 0xff);
      addresses.add(broadcastParts.join('.'));
    }
  }
  return [...addresses];
}

function broadcastPresence(sock) {
  const payload = Buffer.from(JSON.stringify({
    app: DISCOVERY_APP_ID,
    id: instanceId,
    deviceName: os.hostname(),
    receiving: presence.receiving,
    code: presence.receiving ? presence.code : null,
  }));
  for (const address of getBroadcastAddresses()) {
    sock.send(payload, 0, payload.length, DISCOVERY_PORT, address, () => {});
  }
}

function startDiscovery() {
  const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  sock.on('message', (msg, rinfo) => {
    let data;
    try {
      data = JSON.parse(msg.toString());
    } catch (e) {
      return;
    }
    if (data.app !== DISCOVERY_APP_ID || data.id === instanceId) return;
    discoveredDevices.set(data.id, {
      deviceName: data.deviceName,
      receiving: !!data.receiving,
      code: data.code || null,
      address: rinfo.address,
      lastSeen: Date.now(),
    });
  });

  sock.on('error', () => {});

  sock.bind(DISCOVERY_PORT, () => {
    sock.setBroadcast(true);
    broadcastPresence(sock);
    setInterval(() => broadcastPresence(sock), 2500);
  });
}

function getLiveDiscoveredDevices() {
  const now = Date.now();
  const list = [];
  for (const [id, dev] of discoveredDevices) {
    if (now - dev.lastSeen > DISCOVERY_TTL_MS) {
      discoveredDevices.delete(id);
      continue;
    }
    list.push({ id, ...dev });
  }
  list.sort((a, b) => a.deviceName.localeCompare(b.deviceName));
  return list;
}

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function setupAutoUpdater() {
  autoUpdater.on('update-available', (info) => {
    mainWindow && mainWindow.webContents.send('update-available', { version: info.version });
  });
  autoUpdater.on('download-progress', (progress) => {
    mainWindow && mainWindow.webContents.send('update-download-progress', Math.round(progress.percent));
  });
  autoUpdater.on('update-downloaded', () => {
    mainWindow && mainWindow.webContents.send('update-downloaded');
  });
  autoUpdater.on('error', (err) => {
    mainWindow && mainWindow.webContents.send('update-error', err.message);
  });

  if (!app.isPackaged) return;

  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(check, 3000);
  setInterval(check, 4 * 60 * 60 * 1000);
}

ipcMain.handle('scan-sessions', async () => scanSessions());
ipcMain.handle('read-session-file', (event, filePath) => readSessionFile(filePath));
ipcMain.handle('save-received-session', (event, args) => saveReceivedSession(args));
ipcMain.handle('set-presence', (event, args) => {
  presence = { receiving: !!(args && args.receiving), code: (args && args.code) || null };
});
ipcMain.handle('get-discovered-devices', () => getLiveDiscoveredDevices());
ipcMain.handle('get-folder-size', (event, cwd) => getFolderSizeInfo(cwd));
ipcMain.handle('create-project-archive', (event, cwd) => createProjectArchive(cwd));
ipcMain.handle('extract-project-archive', (event, args) => extractProjectArchive(args));
ipcMain.handle('choose-project-folder', (event, folderName) => chooseProjectFolder(folderName));
ipcMain.handle('update-download', () => autoUpdater.downloadUpdate());
ipcMain.handle('update-install-now', () => autoUpdater.quitAndInstall());

ipcMain.on('window-minimize', () => mainWindow && mainWindow.minimize());
ipcMain.on('window-maximize-toggle', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow && mainWindow.close());
ipcMain.handle('window-is-maximized', () => (mainWindow ? mainWindow.isMaximized() : false));

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 700,
    minWidth: 760,
    minHeight: 560,
    backgroundColor: '#0b0c10',
    frame: false,
    icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setTitle('Claude Code Beam');
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('maximize', () => mainWindow.webContents.send('window-maximized-changed', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-maximized-changed', false));
}

app.whenReady().then(() => {
  createWindow();
  startDiscovery();
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
