const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getDatabase, saveDatabase } = require('./db');

let tunnelProcess = null;
let publicUrl = null;
let isStarting = false;
let restartTimeout = null;
let tunnelPort = 4567;
let lastError = null;

function findCloudflaredBinary() {
  const possiblePaths = [
    path.join(__dirname, '..', 'cloudflared.exe'),
    path.join(__dirname, 'cloudflared.exe'),
    path.join(process.cwd(), 'cloudflared.exe'),
    'cloudflared.exe',
    'cloudflared'
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function startTunnel(port = 4567) {
  tunnelPort = port;
  if (isStarting || (tunnelProcess && !tunnelProcess.killed)) {
    return;
  }

  const binPath = findCloudflaredBinary();
  if (!binPath) {
    console.warn('[Cloudflare Tunnel] Executável cloudflared.exe não encontrado.');
    return;
  }

  isStarting = true;
  lastError = null;
  console.log(`[Cloudflare Tunnel] Iniciando túnel gratuito para http://127.0.0.1:${tunnelPort}...`);

  try {
    tunnelProcess = spawn(binPath, ['tunnel', '--url', `http://127.0.0.1:${tunnelPort}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });

    const checkOutput = (data) => {
      const text = data.toString();
      const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match && !publicUrl) {
        publicUrl = match[0];
        isStarting = false;
        console.log(`\n======================================================`);
        console.log(`[Cloudflare Tunnel] SERVIDOR PÚBLICO GRATUITO ATIVO!`);
        console.log(`Link Público Global: ${publicUrl}`);
        console.log(`======================================================\n`);

        try {
          const db = getDatabase();
          if (db) {
            if (!db.storeSettings) db.storeSettings = {};
            db.storeSettings.publicTrackingUrl = publicUrl;
            // Atualiza systemUrl se estiver vazio ou se for URL anterior do trycloudflare/nip.io
            const currentSysUrl = db.storeSettings.systemUrl || '';
            if (!currentSysUrl || currentSysUrl.includes('trycloudflare.com') || currentSysUrl.includes('nip.io') || currentSysUrl.includes('localhost')) {
              db.storeSettings.systemUrl = publicUrl;
            }
            saveDatabase(db);
          }
        } catch (dbErr) {
          console.error('[Cloudflare Tunnel] Erro ao salvar URL nas configurações:', dbErr);
        }
      }
    };

    tunnelProcess.stdout.on('data', checkOutput);
    tunnelProcess.stderr.on('data', checkOutput);

    tunnelProcess.on('error', (err) => {
      console.error('[Cloudflare Tunnel] Falha no processo:', err.message);
      lastError = err.message;
      isStarting = false;
    });

    tunnelProcess.on('close', (code) => {
      console.log(`[Cloudflare Tunnel] Conexão encerrada (código ${code}).`);
      publicUrl = null;
      tunnelProcess = null;
      isStarting = false;

      // Reconecta automaticamente em 6 segundos para manter o link online
      if (!restartTimeout) {
        restartTimeout = setTimeout(() => {
          restartTimeout = null;
          console.log('[Cloudflare Tunnel] Tentando reconexão automática...');
          startTunnel(tunnelPort);
        }, 6000);
      }
    });
  } catch (err) {
    console.error('[Cloudflare Tunnel] Erro ao iniciar:', err);
    isStarting = false;
  }
}

function stopTunnel() {
  if (restartTimeout) {
    clearTimeout(restartTimeout);
    restartTimeout = null;
  }
  if (tunnelProcess) {
    try {
      tunnelProcess.kill();
    } catch (e) {}
    tunnelProcess = null;
  }
  publicUrl = null;
  isStarting = false;
}

function restartTunnel(port = 4567) {
  stopTunnel();
  setTimeout(() => startTunnel(port), 1000);
}

function getPublicUrl() {
  return publicUrl;
}

function getStatus() {
  return {
    active: Boolean(publicUrl),
    publicUrl: publicUrl || null,
    provider: 'Cloudflare Quick Tunnel',
    isStarting,
    error: lastError
  };
}

// Finaliza túnel ao encerrar processo Node
process.on('exit', stopTunnel);
process.on('SIGINT', stopTunnel);
process.on('SIGTERM', stopTunnel);

module.exports = {
  startTunnel,
  stopTunnel,
  restartTunnel,
  getPublicUrl,
  getStatus
};
