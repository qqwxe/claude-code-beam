const state = {
  sessions: [],
  selected: new Set(),
  receivePeer: null,
};

const PEER_ID_PREFIX = 'cst1-';
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // без 0/O/1/I/L, чтобы не путать на слух/глаз

function generateCode() {
  const bytes = new Uint8Array(8);
  window.crypto.getRandomValues(bytes);
  let raw = '';
  for (let i = 0; i < bytes.length; i++) {
    raw += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function codeToPeerId(code) {
  return PEER_ID_PREFIX + code.trim().toUpperCase().replace(/\s+/g, '');
}

function moveNavIndicator(tab) {
  const nav = document.querySelector('.bottom-nav');
  const indicator = document.querySelector('.nav-indicator');
  const navRect = nav.getBoundingClientRect();
  const tabRect = tab.getBoundingClientRect();
  indicator.style.width = `${tabRect.width}px`;
  indicator.style.left = `${tabRect.left - navRect.left}px`;
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active', 'bounce'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active', 'bounce');
    setTimeout(() => tab.classList.remove('bounce'), 300);
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
    moveNavIndicator(tab);
  });
});

window.addEventListener('resize', () => {
  const active = document.querySelector('.tab.active');
  if (active) moveNavIndicator(active);
});

requestAnimationFrame(() => {
  const active = document.querySelector('.tab.active');
  if (active) moveNavIndicator(active);
});

function fmtSize(bytes) {
  if (bytes < 1024) return t('sizeB', bytes);
  if (bytes < 1024 * 1024) return t('sizeKB', (bytes / 1024).toFixed(1));
  return t('sizeMB', (bytes / 1024 / 1024).toFixed(2));
}

function fmtDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const lang = getCurrentLanguage();
  return d.toLocaleString(lang === 'ru' ? 'ru-RU' : lang);
}

function renderSessions() {
  const listEl = document.getElementById('session-list');
  const q = document.getElementById('search').value.trim().toLowerCase();
  const filtered = state.sessions.filter((s) => {
    if (!q) return true;
    return s.preview.toLowerCase().includes(q) || s.project.toLowerCase().includes(q);
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-hint">${escapeHtml(t('sessionsNotFound'))}</div>`;
    updateSelectedCount();
    return;
  }

  listEl.innerHTML = '';
  for (const s of filtered) {
    const card = document.createElement('div');
    card.className = 'session-card' + (state.selected.has(s.id) ? ' selected' : '');
    card.innerHTML = `
      <input type="checkbox" ${state.selected.has(s.id) ? 'checked' : ''} data-id="${s.id}" />
      <div class="session-meta">
        <div class="session-title">${escapeHtml(s.project)}</div>
        <div class="session-preview">${escapeHtml(s.preview)}</div>
        <div class="session-info">
          <span>${fmtDate(s.mtimeMs)}</span>
          <span>${escapeHtml(t('msgCount', s.messageCount))}</span>
          <span>${fmtSize(s.sizeBytes)}</span>
        </div>
      </div>
    `;
    card.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT') {
        const cb = card.querySelector('input');
        cb.checked = !cb.checked;
      }
      toggleSelection(s.id, card.querySelector('input').checked);
      card.classList.toggle('selected', state.selected.has(s.id));
      card.classList.add('bump');
      setTimeout(() => card.classList.remove('bump'), 120);
      updateSelectedCount();
    });
    listEl.appendChild(card);
  }
  updateSelectedCount();
}

function toggleSelection(id, checked) {
  if (checked) state.selected.add(id);
  else state.selected.delete(id);
}

function updateSelectedCount() {
  window.__cstSelectedCount = state.selected.size;
  document.getElementById('selected-count').textContent = t('selectedCount', state.selected.size);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function loadSessions() {
  const listEl = document.getElementById('session-list');
  listEl.innerHTML = `<div class="empty-hint">${escapeHtml(t('loadingSessions'))}</div>`;
  state.sessions = await window.api.scanSessions();
  renderSessions();
}

document.getElementById('search').addEventListener('input', renderSessions);
document.getElementById('refresh-btn').addEventListener('click', () => {
  const btn = document.getElementById('refresh-btn');
  btn.classList.remove('spin');
  void btn.offsetWidth;
  btn.classList.add('spin');
  loadSessions();
});

function appendLog(elId, text, cls) {
  const el = document.getElementById(elId);
  const line = document.createElement('div');
  line.className = `log-line${cls ? ' ' + cls : ''}`;
  const lang = getCurrentLanguage();
  const time = new Date().toLocaleTimeString(lang === 'ru' ? 'ru-RU' : lang);
  line.textContent = `[${time}] ${text}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

document.getElementById('send-btn').addEventListener('click', async () => {
  const code = document.getElementById('target-code').value.trim();
  const sessions = state.sessions.filter((s) => state.selected.has(s.id));
  const btn = document.getElementById('send-btn');

  if (!code) return appendLog('send-log', t('enterCode'), 'err');
  if (sessions.length === 0) return appendLog('send-log', t('selectAtLeastOne'), 'err');

  const uniqueCwds = [...new Set(sessions.map((s) => s.cwd).filter(Boolean))];
  let includeProjectPaths = [];
  if (uniqueCwds.length > 0) {
    const result = await askIncludeProjects(uniqueCwds);
    if (result === null) return; // пользователь отменил
    includeProjectPaths = result;
  }

  const targetId = codeToPeerId(code);
  btn.disabled = true;
  appendLog('send-log', t('connecting'));

  const peer = new Peer();

  const cleanup = () => {
    btn.disabled = false;
    setTimeout(() => peer.destroy(), 500);
  };

  peer.on('error', (err) => {
    appendLog('send-log', t('connectionError', err.type || err.message), 'err');
    cleanup();
  });

  peer.on('open', () => {
    const conn = peer.connect(targetId, { reliable: true, serialization: 'binary' });

    conn.on('open', async () => {
      appendLog('send-log', t('connectionEstablishedSending'), 'ok');
      for (const s of sessions) {
        try {
          const data = await window.api.readSessionFile(s.filePath);
          conn.send({ type: 'file', project: s.project, filename: s.file, data });
          appendLog('send-log', t('sentFile', s.project, s.file, fmtSize(data.length || data.byteLength || 0)));
        } catch (e) {
          appendLog('send-log', t('failedToRead', s.id, e.message), 'err');
        }
      }

      for (const cwd of includeProjectPaths) {
        try {
          appendLog('send-log', t('archivingProject', cwd));
          const zipData = await window.api.createProjectArchive(cwd);
          const folderName = cwd.split(/[\\/]/).filter(Boolean).pop() || 'project';
          conn.send({ type: 'project', folderName, data: zipData });
          appendLog('send-log', t('sentProject', folderName, fmtSize(zipData.length || zipData.byteLength || 0)), 'ok');
        } catch (e) {
          appendLog('send-log', t('failedToSendProject', cwd, e.message), 'err');
        }
      }

      conn.send({ type: 'done' });

      let acked = false;
      const ackTimeout = setTimeout(() => {
        if (acked) return;
        appendLog('send-log', t('notAckedInTime'), 'warn');
        conn.close();
        cleanup();
      }, 15000);

      conn.on('data', (msg) => {
        if (msg && msg.type === 'ack') {
          acked = true;
          clearTimeout(ackTimeout);
          appendLog('send-log', t('doneAcked', sessions.length), 'ok');
          conn.close();
          cleanup();
        }
      });
    });

    conn.on('error', (err) => {
      appendLog('send-log', t('transferError', err.type || err.message), 'err');
      cleanup();
    });
  });
});

function refreshServerUi(running, code) {
  const dot = document.getElementById('server-dot');
  const btn = document.getElementById('server-toggle-btn');
  const pinCard = document.getElementById('pin-card');
  if (running) {
    dot.classList.add('on');
    btn.textContent = t('stopReceivingBtn');
    pinCard.style.display = '';
    document.getElementById('pin-value').textContent = code;
    pinCard.classList.remove('pop');
    void pinCard.offsetWidth;
    pinCard.classList.add('pop');
  } else {
    dot.classList.remove('on');
    btn.textContent = t('showCodeBtn');
    pinCard.style.display = 'none';
  }
}

function handleIncomingConnection(conn) {
  const remote = conn.peer;
  appendLog('incoming-log', t('incomingConn', remote));
  let received = 0;

  conn.on('data', async (msg) => {
    if (!msg || !msg.type) return;
    if (msg.type === 'file') {
      try {
        const res = await window.api.saveReceivedSession({
          project: msg.project,
          filename: msg.filename,
          data: msg.data,
        });
        received++;
        appendLog(
          'incoming-log',
          t('receivedSession', res.project, res.savedAs, fmtSize(res.bytes)) + (res.renamed ? t('renamedNote') : ''),
          'ok'
        );
        loadSessions();
      } catch (e) {
        appendLog('incoming-log', t('saveError', e.message), 'err');
      }
    } else if (msg.type === 'project') {
      try {
        appendLog('incoming-log', t('projectChooseFolder', msg.folderName));
        const destDir = await window.api.chooseProjectFolder(msg.folderName);
        const res = await window.api.extractProjectArchive({ folderName: msg.folderName, data: msg.data, destDir });
        appendLog('incoming-log', t('projectExtracted', res.destDir), 'ok');
      } catch (e) {
        appendLog('incoming-log', t('projectExtractError', e.message), 'err');
      }
    } else if (msg.type === 'done') {
      appendLog('incoming-log', t('transferDone', received), 'ok');
      conn.send({ type: 'ack' });
    }
  });

  conn.on('close', () => appendLog('incoming-log', t('connClosed', remote)));
  conn.on('error', (err) => appendLog('incoming-log', t('connectionError', err.type || err.message), 'err'));
}

document.getElementById('server-toggle-btn').addEventListener('click', () => {
  const btn = document.getElementById('server-toggle-btn');
  if (state.receivePeer) {
    state.receivePeer.destroy();
    state.receivePeer = null;
    refreshServerUi(false);
    appendLog('incoming-log', t('receiveStopped'));
    window.api.setPresence({ receiving: false, code: null });
    return;
  }

  btn.disabled = true;
  const code = generateCode();
  const peer = new Peer(codeToPeerId(code));

  peer.on('open', () => {
    state.receivePeer = peer;
    btn.disabled = false;
    refreshServerUi(true, code);
    appendLog('incoming-log', t('receiveStarted', code), 'ok');
    window.api.setPresence({ receiving: true, code });
  });

  peer.on('connection', handleIncomingConnection);

  peer.on('error', (err) => {
    btn.disabled = false;
    if (err.type === 'unavailable-id') {
      appendLog('incoming-log', t('idTaken'), 'warn');
      peer.destroy();
      setTimeout(() => document.getElementById('server-toggle-btn').click(), 300);
      return;
    }
    appendLog('incoming-log', t('receiveError', err.type || err.message), 'err');
    refreshServerUi(false);
    state.receivePeer = null;
    window.api.setPresence({ receiving: false, code: null });
  });
});

function renderDevices(devices) {
  const el = document.getElementById('device-list');
  if (!devices.length) {
    el.innerHTML = `<div class="empty-hint" style="padding:14px 0">${escapeHtml(t('devicesEmpty'))}</div>`;
    return;
  }
  el.innerHTML = '';
  for (const d of devices) {
    const card = document.createElement('div');
    card.className = 'device-card' + (d.receiving ? ' ready' : '');
    card.innerHTML = `
      <span class="device-dot"></span>
      <div>
        <div class="device-name">${escapeHtml(d.deviceName)}</div>
        <div class="device-status">${escapeHtml(d.receiving ? t('deviceReadyStatus') : t('deviceIdleStatus'))}</div>
      </div>
    `;
    if (d.receiving) {
      card.addEventListener('click', () => {
        document.getElementById('target-code').value = d.code;
        appendLog('send-log', t('deviceChosen', d.deviceName), 'ok');
      });
    }
    el.appendChild(card);
  }
}

async function pollDevices() {
  try {
    const devices = await window.api.getDiscoveredDevices();
    renderDevices(devices);
  } catch (e) {}
}

setInterval(pollDevices, 2000);
pollDevices();

const updateState = { phase: null, version: null }; // 'available' | 'downloading' | 'downloaded'

function showUpdateBanner(text) {
  document.getElementById('update-banner-text').textContent = text;
  document.getElementById('update-banner').classList.remove('hidden');
}

function refreshUpdateBanner() {
  const actionBtn = document.getElementById('update-action-btn');
  if (updateState.phase === 'available') {
    actionBtn.disabled = false;
    actionBtn.textContent = t('updateNowBtn');
    showUpdateBanner(t('updateAvailableText', updateState.version));
  } else if (updateState.phase === 'downloading') {
    actionBtn.disabled = true;
    actionBtn.textContent = t('updateNowBtn');
    showUpdateBanner(t('updateDownloadingText', updateState.percent || 0));
  } else if (updateState.phase === 'downloaded') {
    actionBtn.disabled = false;
    actionBtn.textContent = t('updateInstallBtn');
    showUpdateBanner(t('updateReadyText'));
  }
}

document.getElementById('update-action-btn').addEventListener('click', () => {
  if (updateState.phase === 'available') {
    updateState.phase = 'downloading';
    updateState.percent = 0;
    refreshUpdateBanner();
    window.api.downloadUpdate();
  } else if (updateState.phase === 'downloaded') {
    window.api.installUpdateNow();
  }
});

document.getElementById('update-later-btn').addEventListener('click', () => {
  document.getElementById('update-banner').classList.add('hidden');
});

if (window.api.onUpdateAvailable) {
  window.api.onUpdateAvailable((info) => {
    updateState.phase = 'available';
    updateState.version = info.version;
    refreshUpdateBanner();
  });
  window.api.onUpdateDownloadProgress((percent) => {
    updateState.phase = 'downloading';
    updateState.percent = percent;
    refreshUpdateBanner();
  });
  window.api.onUpdateDownloaded(() => {
    updateState.phase = 'downloaded';
    refreshUpdateBanner();
  });
  window.api.onUpdateError(() => {});
}

loadSessions();
