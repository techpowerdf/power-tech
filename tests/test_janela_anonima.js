const { spawn } = require('child_process');
const http = require('http');
const os = require('os');
const path = require('path');

const BROWSER_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DEBUG_PORT = 9446;

async function testIncognitoBrowser() {
  console.log('===============================================================');
  console.log('TESTE EM NAVEGADOR REAL (MODO ANÔNIMO / INPRIVATE HEADLESS)');
  console.log('===============================================================\n');

  const userDataDir = path.join(os.tmpdir(), `edge_inprivate_test_${Date.now()}`);

  const browserProc = spawn(BROWSER_PATH, [
    '--headless=new',
    '--inprivate',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${userDataDir}`,
    'http://localhost:5173/'
  ]);

  let passed = false;

  try {
    let targets = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 400));
      try {
        targets = await new Promise((resolve, reject) => {
          http.get(`http://127.0.0.1:${DEBUG_PORT}/json`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
          }).on('error', reject);
        });
        if (targets && targets.length > 0) break;
      } catch (e) {}
    }

    if (!targets) {
      throw new Error('Falha ao conectar com CDP na porta ' + DEBUG_PORT);
    }

    const pageTarget = targets.find(t => t.type === 'page');
    if (!pageTarget) {
      throw new Error('Aba principal do navegador não encontrada');
    }

    console.log(`[OK] Navegador Edge iniciado em modo InPrivate limpo.`);
    console.log(`[OK] Sessão anônima aberta em: ${pageTarget.url}`);

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let currentReqId = 1;
    function evaluate(expr) {
      return new Promise((resolve) => {
        const id = currentReqId++;
        const onMsg = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === id) {
            ws.removeEventListener('message', onMsg);
            resolve(msg.result?.result?.value);
          }
        };
        ws.addEventListener('message', onMsg);
        ws.send(JSON.stringify({
          id,
          method: 'Runtime.evaluate',
          params: { expression: expr, returnByValue: true }
        }));
      });
    }

    // Polling até a página renderizar os inputs (espera a compilação do Vite)
    let domData = null;
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 600));
      const res = await evaluate(`(() => {
        const userInput = document.querySelector('input[type="text"]');
        const passInput = document.querySelector('input[type="password"]');
        const bodyText = document.body ? document.body.innerText : '';
        if (!userInput || !passInput) return null;
        return {
          userValue: userInput.value,
          passValue: passInput.value,
          userPlaceholder: userInput.placeholder,
          passPlaceholder: passInput.placeholder,
          hasAdmin123Text: bodyText.includes('admin123'),
          hasFirstAccessText: bodyText.includes('Primeiro acesso padrão'),
          inputsCount: document.querySelectorAll('input').length
        };
      })()`);

      if (res) {
        domData = res;
        break;
      }
    }

    ws.close();

    if (!domData) {
      throw new Error('Timeout aguardando os campos de login renderizarem no DOM');
    }

    console.log('\n--- DADOS COLETADOS DO DOM NA JANELA ANÔNIMA ---');
    console.log('Valor do campo Usuário:', JSON.stringify(domData.userValue));
    console.log('Valor do campo Senha:', JSON.stringify(domData.passValue));
    console.log('Placeholder do Usuário:', domData.userPlaceholder);
    console.log('Placeholder da Senha:', domData.passPlaceholder);
    console.log('Contém texto "admin123" no HTML:', domData.hasAdmin123Text);
    console.log('Contém texto "Primeiro acesso padrão" no HTML:', domData.hasFirstAccessText);

    const isUserEmpty = domData.userValue === '';
    const isPassEmpty = domData.passValue === '';
    const isCleanText = !domData.hasAdmin123Text && !domData.hasFirstAccessText;

    if (isUserEmpty && isPassEmpty && isCleanText) {
      console.log('\n[APROVADO] Confirmação em Janela Anônima:');
      console.log('  1. Os campos de usuário e senha iniciam 100% VAZIOS.');
      console.log('  2. A aplicação NÃO injeta credenciais automáticas no estado do componente.');
      console.log('  3. O navegador sem perfil/cache anterior não pré-preenche dados.');
      console.log('  4. Nenhuma menção a credenciais padrão existe na interface.');
      passed = true;
    } else {
      console.error('\n[REPROVADO] Divergência encontrada no DOM:', domData);
    }
  } catch (err) {
    console.error('Erro no teste de navegador anônimo:', err.message);
  } finally {
    browserProc.kill();
    try {
      require('fs').rmSync(userDataDir, { recursive: true, force: true });
    } catch (e) {}
  }

  if (!passed) {
    process.exit(1);
  }
}

testIncognitoBrowser();
