/**
 * Teste End-to-End no Navegador Real (Chromium / Edge CDP)
 * Valida a interface de Fotografias da Ordem de Serviço (Etapa 4)
 */

const { spawn } = require('child_process');
const http = require('http');

const BROWSER_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9222;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve(body); }
      });
    }).on('error', reject);
  });
}

function sendCDP(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 100000);
    const handler = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      } catch (e) {}
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function runBrowserTest() {
  console.log('========================================================');
  console.log('  TESTE E2E NO NAVEGADOR: FOTOGRAFIAS DA OS (ETAPA 4)');
  console.log('========================================================\n');

  console.log('1. Iniciando navegador Chromium / Edge em modo remoto...');
  const browserProc = spawn(BROWSER_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,800',
    'http://localhost:5173'
  ]);

  let ws = null;
  try {
    await delay(3000);

    const versionData = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/version`);
    console.log('   ✓ Navegador conectado:', versionData.Browser);

    const targets = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const pageTarget = targets.find(t => t.type === 'page');
    if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
      throw new Error('Nenhuma página ativa encontrada para depuração.');
    }

    ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    console.log('   ✓ Canal CDP WebSocket estabelecido.\n');

    await sendCDP(ws, 'Page.enable');
    await sendCDP(ws, 'Runtime.enable');

    console.log('2. Aguardando carregamento da interface...');
    await delay(2000);

    // Avalia login se necessário
    console.log('3. Verificando estado de autenticação...');
    const loginEval = await sendCDP(ws, 'Runtime.evaluate', {
      expression: `
        (async () => {
          const userInput = document.querySelector('input[type="text"]');
          const passInput = document.querySelector('input[type="password"]');
          const loginBtn = document.querySelector('button[type="submit"]');
          if (userInput && passInput && loginBtn) {
            userInput.value = 'admin';
            userInput.dispatchEvent(new Event('input', { bubbles: true }));
            passInput.value = 'admin123';
            passInput.dispatchEvent(new Event('input', { bubbles: true }));
            loginBtn.click();
            return 'logging_in';
          }
          return 'already_logged_in';
        })()
      `,
      awaitPromise: true
    });

    if (loginEval.result?.value === 'logging_in') {
      console.log('   ✓ Formulário de login preenchido e submetido. Aguardando dashboard...');
      await delay(3000);
    } else {
      console.log('   ✓ Usuário já autenticado na sessão.\n');
    }

    // Navega para aba Ordens de Serviço
    console.log('4. Abrindo tela de Ordens de Serviço...');
    await sendCDP(ws, 'Runtime.evaluate', {
      expression: `
        (() => {
          const buttons = Array.from(document.querySelectorAll('button, nav a'));
          const osTab = buttons.find(b => b.textContent.includes('Ordens de Serviço') || b.textContent.includes('Ordens'));
          if (osTab) osTab.click();
        })()
      `
    });
    await delay(2000);

    // Clica na primeira OS para abrir o modal viewingOS
    console.log('5. Clicando na primeira OS para abrir modal de detalhes...');
    const clickOsRes = await sendCDP(ws, 'Runtime.evaluate', {
      expression: `
        (() => {
          const osBtn = document.querySelector('.app-os-number') || document.querySelector('button[title*="Visualizar"]');
          if (osBtn) {
            osBtn.click();
            return true;
          }
          return false;
        })()
      `
    });

    if (!clickOsRes.result?.value) {
      throw new Error('Não foi possível encontrar botão da OS para abrir o modal.');
    }
    console.log('   ✓ Modal de detalhes da OS aberto.\n');
    await delay(1500);

    // 6. Validar a presença da Seção 4 (Fotografias do Equipamento)
    console.log('6. Verificando seção "4. Fotografias do Equipamento & Vistoria"...');
    const sectionCheck = await sendCDP(ws, 'Runtime.evaluate', {
      expression: `
        (() => {
          const bodyText = document.body.innerText.toLowerCase();
          const hasTitle = bodyText.includes('fotografias do equipamento');
          const hasCameraBtn = Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Tirar Foto'));
          const hasGalleryBtn = Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Adicionar da Galeria'));
          const hasCameraInput = Boolean(document.querySelector('input[type="file"][capture="environment"]'));
          const hasGalleryInput = Boolean(document.querySelector('input[type="file"][multiple]'));
          
          return {
            hasTitle,
            hasCameraBtn,
            hasGalleryBtn,
            hasCameraInput,
            hasGalleryInput
          };
        })()
      `,
      returnByValue: true
    });

    const info = sectionCheck.result.value;
    console.log('   ✓ Título da seção presente:', info.hasTitle);
    console.log('   ✓ Botão "Tirar Foto" presente:', info.hasCameraBtn);
    console.log('   ✓ Botão "Adicionar da Galeria" presente:', info.hasGalleryBtn);
    console.log('   ✓ Input com capture="environment" (câmera mobile) configurado:', info.hasCameraInput);
    console.log('   ✓ Input com multiple (seleção de várias fotos) configurado:', info.hasGalleryInput);

    if (!info.hasTitle || !info.hasCameraBtn || !info.hasCameraInput) {
      throw new Error('Falha na renderização da seção de fotografias.');
    }
    console.log('');

    // 7. Simular adição de uma foto via input da interface e verificar compressão + upload
    console.log('7. Testando adição de foto via input da interface (Compressão Canvas + Upload)...');
    const uploadSimulation = await sendCDP(ws, 'Runtime.evaluate', {
      expression: `
        (async () => {
          const input = document.querySelector('input[type="file"][multiple]');
          if (!input) return { error: 'Input de galeria não encontrado' };
          
          // Cria um File objeto de teste no próprio navegador usando HTML5 Canvas
          const canvas = document.createElement('canvas');
          canvas.width = 300;
          canvas.height = 200;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(0, 0, 300, 200);
          ctx.fillStyle = '#ffffff';
          ctx.font = '20px sans-serif';
          ctx.fillText('FOTO TESTE BANCADA', 20, 100);
          
          const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
          const testFile = new File([blob], 'foto_vistoria_bancada.jpg', { type: 'image/jpeg' });
          
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(testFile);
          input.files = dataTransfer.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true, originalSize: blob.size };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('   ✓ Evento de upload acionado pela interface:', uploadSimulation.result.value);

    // Aguarda o processo de compressão e upload (mostra barra de progresso e salva)
    await delay(3000);

    // 8. Verificar se o card da foto e a miniatura aparecem no DOM
    console.log('8. Verificando exibição da foto na galeria do modal...');
    const cardCheck = await sendCDP(ws, 'Runtime.evaluate', {
      expression: `
        (() => {
          const img = document.querySelector('img[alt*="foto_vistoria_bancada"]');
          const hasBadge = document.body.innerText.includes('Entrada');
          const hasCard = Boolean(img);
          return {
            hasCard,
            imgSrc: img ? img.src.slice(0, 70) : null,
            hasBadge
          };
        })()
      `,
      returnByValue: true
    });

    console.log('   ✓ Card e miniatura renderizados no grid:', cardCheck.result.value.hasCard);
    console.log('   ✓ Badge do estágio visível:', cardCheck.result.value.hasBadge);

    if (!cardCheck.result.value.hasCard) {
      throw new Error('Miniatura da fotografia não apareceu na galeria da OS.');
    }

    // 9. Testar abertura do Lightbox ao clicar na imagem
    console.log('\n9. Testando abertura do Lightbox / Visualizador Ampliado...');
    await sendCDP(ws, 'Runtime.evaluate', {
      expression: `
        (() => {
          const imgContainer = document.querySelector('img[alt*="foto_vistoria_bancada"]')?.parentElement;
          if (imgContainer) {
            imgContainer.click();
            return true;
          }
          return false;
        })()
      `
    });

    await delay(1200);
    const lightboxCheck = await sendCDP(ws, 'Runtime.evaluate', {
      expression: `
        (() => {
          const hasZoomIn = Boolean(document.querySelector('button[title*="Aumentar zoom"]'));
          const hasRotate = Boolean(document.querySelector('button[title*="Girar"]'));
          const hasClose = Boolean(document.querySelector('button[title*="Fechar visualizador"]'));
          const hasDeleteInLightbox = Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Excluir Fotografia'));
          return { hasZoomIn, hasRotate, hasClose, hasDeleteInLightbox };
        })()
      `,
      returnByValue: true
    });

    console.log('   ✓ Botão de Zoom presente no Lightbox:', lightboxCheck.result.value.hasZoomIn);
    console.log('   ✓ Botão de Girar 90° presente no Lightbox:', lightboxCheck.result.value.hasRotate);
    console.log('   ✓ Botão de Fechar presente no Lightbox:', lightboxCheck.result.value.hasClose);
    console.log('   ✓ Botão de Excluir presente no Lightbox:', lightboxCheck.result.value.hasDeleteInLightbox);

    if (!lightboxCheck.result.value.hasClose) {
      throw new Error('Lightbox não abriu ao clicar na miniatura.');
    }

    // Fecha o lightbox
    await sendCDP(ws, 'Runtime.evaluate', {
      expression: `
        (() => {
          const closeBtn = document.querySelector('button[title*="Fechar visualizador"]');
          if (closeBtn) closeBtn.click();
        })()
      `
    });
    await delay(1000);

    // 10. Testar exclusão com confirmação na interface
    console.log('\n10. Testando fluxo de exclusão de foto com confirmação na interface...');
    const clickDeleteRes = await sendCDP(ws, 'Runtime.evaluate', {
      expression: `
        (() => {
          const delBtn = document.querySelector('button[title*="Excluir fotografia"]');
          if (delBtn) {
            delBtn.click();
            return true;
          }
          return false;
        })()
      `
    });
    await delay(800);

    // Verifica modal de confirmação
    const confirmModalCheck = await sendCDP(ws, 'Runtime.evaluate', {
      expression: `
        (() => {
          const modalText = document.body.innerText;
          const hasConfirmTitle = modalText.includes('Confirmar Exclusão');
          const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Excluir');
          if (confirmBtn) {
            confirmBtn.click();
            return { hasConfirmTitle, clicked: true };
          }
          return { hasConfirmTitle, clicked: false };
        })()
      `,
      returnByValue: true
    });

    console.log('    ✓ Modal de confirmação exibido:', confirmModalCheck.result.value.hasConfirmTitle);
    console.log('    ✓ Botão "Excluir" confirmado e acionado.');
    await delay(1500);

    // Confirma que a miniatura foi removida da galeria
    const afterDeleteCheck = await sendCDP(ws, 'Runtime.evaluate', {
      expression: `
        (() => {
          const img = document.querySelector('img[alt*="foto_vistoria_bancada"]');
          return { stillExists: Boolean(img) };
        })()
      `,
      returnByValue: true
    });
    console.log('    ✓ Foto removida da galeria com sucesso:', !afterDeleteCheck.result.value.stillExists);

    if (afterDeleteCheck.result.value.stillExists) {
      throw new Error('A foto ainda permanece visível após confirmação de exclusão.');
    }

    console.log('\n========================================================');
    console.log('  TESTE E2E NO NAVEGADOR CONCLUÍDO COM 100% DE SUCESSO');
    console.log('========================================================');

  } finally {
    if (ws) ws.close();
    browserProc.kill();
  }
}

runBrowserTest().catch(err => {
  console.error('\n❌ ERRO NO TESTE E2E:', err.message);
  process.exit(1);
});
