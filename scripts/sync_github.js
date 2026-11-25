const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const GIT_EXE = fs.existsSync('C:\\Users\\Power\\AppData\\Local\\Programs\\Git\\cmd\\git.exe')
  ? 'C:\\Users\\Power\\AppData\\Local\\Programs\\Git\\cmd\\git.exe'
  : 'git';

function run(command) {
  try {
    return execSync(command, {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      encoding: 'utf8'
    }).trim();
  } catch (err) {
    console.error(`Erro ao executar: ${command}`);
    if (err.stdout) console.log(err.stdout);
    if (err.stderr) console.error(err.stderr);
    throw err;
  }
}

try {
  console.log('[Auto-Sync] Verificando alterações no repositório...');
  const status = run(`"${GIT_EXE}" status --porcelain`);
  
  if (!status) {
    console.log('[Auto-Sync] Nenhuma alteração pendente. Repositório já está atualizado.');
    process.exit(0);
  }

  console.log('[Auto-Sync] Alterações encontradas:\n' + status);
  console.log('[Auto-Sync] Adicionando arquivos...');
  run(`"${GIT_EXE}" add -A`);

  const timestamp = new Date().toLocaleString('pt-BR');
  const commitMsg = process.argv[2] || `atualizacao automatica do sistema (${timestamp})`;
  console.log(`[Auto-Sync] Criando commit: "${commitMsg}"...`);
  run(`"${GIT_EXE}" commit -m "${commitMsg.replace(/"/g, '\\"')}"`);

  console.log('[Auto-Sync] Enviando alterações para o GitHub (origin main)...');
  const pushOutput = run(`"${GIT_EXE}" push origin main`);
  console.log('[Auto-Sync] Sincronização concluída com sucesso!');
  if (pushOutput) console.log(pushOutput);
} catch (err) {
  console.error('[Auto-Sync] Falha na sincronização:', err.message);
  process.exit(1);
}
