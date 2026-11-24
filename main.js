const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow = null;
let serverProcess = null;

// Tenta iniciar o servidor local Express se não estiver rodando
function startLocalServer() {
  try {
    require('./server/index.js');
    console.log('[Electron Main] Servidor local Express iniciado com sucesso.');
  } catch (err) {
    console.warn('[Electron Main] Servidor já estava ativo ou erro ao subir:', err.message);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 680,
    title: 'Power Tech - Assistência Técnica & Vendas',
    icon: path.join(__dirname, 'public', 'logo.png'),
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Facilita impressão e requisições locais
    }
  });

  const appUrl = 'http://127.0.0.1:4567';
  
  let attempts = 0;
  function connectToServer() {
    attempts++;
    const req = http.get(appUrl, () => {
      if (mainWindow) {
        mainWindow.loadURL(appUrl);
      }
    });

    req.on('error', () => {
      if (attempts < 30) {
        setTimeout(connectToServer, 250);
      } else if (mainWindow) {
        mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
      }
    });
  }

  connectToServer();

  // Abre links externos (como WhatsApp Web) no navegador padrão do Windows
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Ao fechar a janela, limpa dados de sessão e autenticação para deslogar automaticamente o usuário
  mainWindow.on('close', async () => {
    try {
      if (mainWindow && mainWindow.webContents) {
        await mainWindow.webContents.session.clearStorageData({
          storages: ['sessionstorage', 'localstorage', 'cookies']
        });
      }
    } catch (e) {}
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Inicia servidor e janela
app.whenReady().then(() => {
  startLocalServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
