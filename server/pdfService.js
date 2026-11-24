const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

/**
 * Localiza o executável do navegador headless (Edge ou Chrome) no sistema operacional
 */
function getBrowserExecutable() {
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  } else {
    // Linux VPS
    const linuxCandidates = [
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable'
    ];
    for (const c of linuxCandidates) {
      if (fs.existsSync(c)) return c;
    }
  }

  return null;
}

const pdfCache = new Map();

function getCachedPdf(key) {
  const item = pdfCache.get(key);
  if (item && (Date.now() - item.timestamp < 120000) && fs.existsSync(item.path)) {
    return item.path;
  }
  return null;
}

function setCachedPdf(key, filePath) {
  pdfCache.set(key, { path: filePath, timestamp: Date.now() });
}

/**
 * Gera arquivo PDF real com o mesmo modelo de impressão da loja
 */
function generateReceiptPdf(token, port = 4567) {
  return new Promise((resolve, reject) => {
    const cached = getCachedPdf('sale_' + token);
    if (cached) {
      return resolve(cached);
    }

    const browser = getBrowserExecutable();
    if (!browser) {
      return reject(new Error('Navegador para renderização de PDF não encontrado no sistema.'));
    }

    const tempFileName = `recibo_venda_${token}_${Date.now()}.pdf`;
    const outputPath = path.join(os.tmpdir(), tempFileName);
    const targetUrl = `http://127.0.0.1:${port}/api/public/sales/receipt/${encodeURIComponent(token)}/imprimir?pdf=0`;

    const args = [
      '--headless',
      '--disable-gpu',
      '--no-pdf-header-footer',
      `--print-to-pdf=${outputPath}`,
      targetUrl
    ];

    execFile(browser, args, { timeout: 25000 }, (err) => {
      if (err) {
        return reject(err);
      }

      if (!fs.existsSync(outputPath)) {
        return reject(new Error('Falha ao gerar arquivo PDF do recibo.'));
      }

      setCachedPdf('sale_' + token, outputPath);
      resolve(outputPath);
    });
  });
}

/**
 * Gera arquivo PDF real da Ordem de Serviço com o modelo A4 de impressão
 */
function generateWorkOrderPdf(token, port = 4567) {
  return new Promise((resolve, reject) => {
    const cached = getCachedPdf('os_' + token);
    if (cached) {
      return resolve(cached);
    }

    const browser = getBrowserExecutable();
    if (!browser) {
      return reject(new Error('Navegador para renderização de PDF não encontrado no sistema.'));
    }

    const tempFileName = `ordem_servico_${token}_${Date.now()}.pdf`;
    const outputPath = path.join(os.tmpdir(), tempFileName);
    const targetUrl = `http://127.0.0.1:${port}/api/public/work-orders/${encodeURIComponent(token)}/imprimir?pdf=0`;

    const args = [
      '--headless',
      '--disable-gpu',
      '--no-pdf-header-footer',
      `--print-to-pdf=${outputPath}`,
      targetUrl
    ];

    execFile(browser, args, { timeout: 25000 }, (err) => {
      if (err) {
        return reject(err);
      }

      if (!fs.existsSync(outputPath)) {
        return reject(new Error('Falha ao gerar arquivo PDF da Ordem de Serviço.'));
      }

      setCachedPdf('os_' + token, outputPath);
      resolve(outputPath);
    });
  });
}

/**
 * No Windows, coloca o arquivo PDF na área de transferência (CF_HDROP)
 * para que o WhatsApp Desktop / Web possa colá-lo instantaneamente como anexo com Ctrl+V
 */
function copyFileToClipboard(filePath) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve(false);

    const safePath = filePath.replace(/'/g, "''");
    const script = `Set-Clipboard -Path '${safePath}'`;

    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], (err) => {
      if (err) {
        console.warn('[PDF] Falha ao copiar para área de transferência:', err.message);
        return resolve(false);
      }
      resolve(true);
    });
  });
}

module.exports = {
  getBrowserExecutable,
  generateReceiptPdf,
  generateWorkOrderPdf,
  copyFileToClipboard
};
