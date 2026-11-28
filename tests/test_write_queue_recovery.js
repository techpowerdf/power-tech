const path = require('path');
const fs = require('fs');

// Configura mock dinâmico do supabaseService antes de carregar db.js
let mockSaveHandler = null;
let mockConfigured = true;

const supabaseServicePath = require.resolve('../server/supabaseService');
const realSupabaseService = require(supabaseServicePath);

require.cache[supabaseServicePath] = {
  id: supabaseServicePath,
  filename: supabaseServicePath,
  loaded: true,
  exports: {
    ...realSupabaseService,
    isSupabaseConfigured: () => mockConfigured,
    saveToSupabase: async (data, version) => {
      if (mockSaveHandler) {
        return await mockSaveHandler(data, version);
      }
      return { success: true, version: Number(version || 1) + 1 };
    }
  }
};

const dbModule = require('../server/db');
const { getDatabase, saveDatabase, getCurrentDbVersion } = dbModule;

// Utilitário de delay
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  console.log('========================================================================');
  console.log('TESTES DE RECUPERAÇÃO E CONCORRÊNCIA DA FILA DE PERSISTÊNCIA (writeQueue)');
  console.log('========================================================================\n');

  const testResults = [];
  const baseDb = JSON.parse(JSON.stringify(getDatabase()));

  // -------------------------------------------------------------------------
  // TESTE A: Recuperação após falha
  // 1. Simule uma gravação que falha.
  // 2. Confirme que a primeira Promise é rejeitada.
  // 3. Execute uma segunda gravação.
  // 4. Confirme que a segunda gravação é executada normalmente.
  // -------------------------------------------------------------------------
  console.log('--- TESTE A: Recuperação após falha ---');
  let firstPromiseRejected = false;
  let secondPromiseResolved = false;

  mockSaveHandler = async () => {
    throw new Error('Falha simulada na primeira gravação (Transaction Pooler Timeout)');
  };

  const payloadA1 = { ...baseDb, testA: 'fail-1' };
  try {
    await saveDatabase(payloadA1);
  } catch (err) {
    if (err.message.includes('Falha simulada na primeira gravação')) {
      firstPromiseRejected = true;
    }
  }

  // Segunda gravação normal
  mockSaveHandler = async (data, version) => {
    return { success: true, version: Number(version || 1) + 1 };
  };

  const payloadA2 = { ...baseDb, testA: 'success-2' };
  try {
    const resA2 = await saveDatabase(payloadA2);
    if (resA2 === true && getDatabase().testA === 'success-2') {
      secondPromiseResolved = true;
    }
  } catch (err) {
    secondPromiseResolved = false;
  }

  const passA = firstPromiseRejected && secondPromiseResolved;
  console.log(`- 1. Primeira Promise rejeitada com erro esperado: ${firstPromiseRejected ? 'SIM' : 'NÃO'}`);
  console.log(`- 2. Segunda gravação executa com sucesso após a falha: ${secondPromiseResolved ? 'SIM' : 'NÃO'}`);
  console.log(`Resultado do Teste A: ${passA ? 'APROVADO' : 'FALHOU'}\n`);
  testResults.push({ name: 'Teste A — Recuperação após falha', pass: passA });

  // -------------------------------------------------------------------------
  // TESTE B: Sequenciamento estrito
  // - Dispare três gravações em sequência.
  // - Confirme que a segunda só começa depois da primeira terminar.
  // - Confirme que a terceira só começa depois da segunda terminar.
  // -------------------------------------------------------------------------
  console.log('--- TESTE B: Sequenciamento estrito (Execução FIFO sem sobreposição) ---');
  const executionEvents = [];
  let opCounter = 0;

  mockSaveHandler = async (data, version) => {
    const opId = data.opId;
    const startTime = Date.now();
    executionEvents.push({ opId, event: 'start', time: startTime });
    await sleep(40); // Simula latência de rede de 40ms
    const endTime = Date.now();
    executionEvents.push({ opId, event: 'end', time: endTime });
    return { success: true, version: Number(version || 1) + 1 };
  };

  const p1 = saveDatabase({ ...baseDb, opId: 1 });
  const p2 = saveDatabase({ ...baseDb, opId: 2 });
  const p3 = saveDatabase({ ...baseDb, opId: 3 });

  await Promise.all([p1, p2, p3]);

  // Validar ordem dos eventos: start1 -> end1 -> start2 -> end2 -> start3 -> end3
  const op1EndIdx = executionEvents.findIndex(e => e.opId === 1 && e.event === 'end');
  const op2StartIdx = executionEvents.findIndex(e => e.opId === 2 && e.event === 'start');
  const op2EndIdx = executionEvents.findIndex(e => e.opId === 2 && e.event === 'end');
  const op3StartIdx = executionEvents.findIndex(e => e.opId === 3 && e.event === 'start');

  const seq2After1 = op2StartIdx > op1EndIdx;
  const seq3After2 = op3StartIdx > op2EndIdx;
  const passB = seq2After1 && seq3After2;

  console.log(`- Operação 2 iniciou após Operação 1 terminar: ${seq2After1 ? 'SIM' : 'NÃO'} (op1End=${op1EndIdx}, op2Start=${op2StartIdx})`);
  console.log(`- Operação 3 iniciou após Operação 2 terminar: ${seq3After2 ? 'SIM' : 'NÃO'} (op2End=${op2EndIdx}, op3Start=${op3StartIdx})`);
  console.log(`Resultado do Teste B: ${passB ? 'APROVADO' : 'FALHOU'}\n`);
  testResults.push({ name: 'Teste B — Sequenciamento', pass: passB });

  // -------------------------------------------------------------------------
  // TESTE C: Falha intermediária
  // - Execute três gravações.
  // - Faça a primeira ter sucesso, a segunda falhar e a terceira ter sucesso.
  // - Confirme que a terceira não é bloqueada pela segunda.
  // -------------------------------------------------------------------------
  console.log('--- TESTE C: Falha intermediária (1: Sucesso, 2: Falha, 3: Sucesso) ---');
  let resC1 = false;
  let resC2Rejected = false;
  let resC3 = false;

  mockSaveHandler = async (data, version) => {
    if (data.cStep === 2) {
      throw new Error('Erro forçado na etapa C2');
    }
    return { success: true, version: Number(version || 1) + 1 };
  };

  const pC1 = saveDatabase({ ...baseDb, cStep: 1 })
    .then(() => { resC1 = true; })
    .catch(() => { resC1 = false; });

  const pC2 = saveDatabase({ ...baseDb, cStep: 2 })
    .then(() => { resC2Rejected = false; })
    .catch(err => {
      if (err.message.includes('Erro forçado na etapa C2')) {
        resC2Rejected = true;
      }
    });

  const pC3 = saveDatabase({ ...baseDb, cStep: 3 })
    .then(() => { resC3 = true; })
    .catch(() => { resC3 = false; });

  await Promise.allSettled([pC1, pC2, pC3]);

  const passC = resC1 === true && resC2Rejected === true && resC3 === true;
  console.log(`- 1. Primeira gravação concluiu com sucesso: ${resC1 ? 'SIM' : 'NÃO'}`);
  console.log(`- 2. Segunda gravação rejeitou com erro individual: ${resC2Rejected ? 'SIM' : 'NÃO'}`);
  console.log(`- 3. Terceira gravação executou normalmente sem ser bloqueada: ${resC3 ? 'SIM' : 'NÃO'}`);
  console.log(`Resultado do Teste C: ${passC ? 'APROVADO' : 'FALHOU'}\n`);
  testResults.push({ name: 'Teste C — Falha intermediária', pass: passC });

  // -------------------------------------------------------------------------
  // TESTE D: Consistência da memória e OCC
  // - Simule falha no Supabase.
  // - Confirme que inMemoryDb mantém a versão anterior.
  // - Confirme que currentDbVersion não avança indevidamente.
  // - Confirme que uma gravação posterior bem-sucedida atualiza a memória corretamente.
  // -------------------------------------------------------------------------
  console.log('--- TESTE D: Consistência da memória e OCC ---');
  // Prepara estado inicial limpo
  mockSaveHandler = async (data, version) => {
    return { success: true, version: 10 };
  };
  await saveDatabase({ ...baseDb, marker: 'initial-state-d' });

  const versionBeforeFail = getCurrentDbVersion();
  const memoryMarkerBeforeFail = getDatabase().marker;

  // Simula falha no Supabase
  mockSaveHandler = async () => {
    throw new Error('Supabase network error (500)');
  };

  let failHandledD = false;
  try {
    await saveDatabase({ ...baseDb, marker: 'corrupted-state-should-not-persist' });
  } catch (err) {
    failHandledD = true;
  }

  const versionAfterFail = getCurrentDbVersion();
  const memoryMarkerAfterFail = getDatabase().marker;

  const memIntactD = memoryMarkerAfterFail === memoryMarkerBeforeFail && memoryMarkerAfterFail === 'initial-state-d';
  const versionIntactD = versionAfterFail === versionBeforeFail && versionAfterFail === 10;

  // Gravação posterior bem-sucedida
  mockSaveHandler = async (data, version) => {
    return { success: true, version: 11 };
  };
  let subsequentSuccessD = false;
  try {
    await saveDatabase({ ...baseDb, marker: 'subsequent-valid-state' });
    if (getDatabase().marker === 'subsequent-valid-state' && getCurrentDbVersion() === 11) {
      subsequentSuccessD = true;
    }
  } catch (e) {}

  const passD = failHandledD && memIntactD && versionIntactD && subsequentSuccessD;
  console.log(`- 1. Exceção do Supabase capturada: ${failHandledD ? 'SIM' : 'NÃO'}`);
  console.log(`- 2. inMemoryDb manteve versão anterior intacta: ${memIntactD ? 'SIM' : 'NÃO'} (valor: "${memoryMarkerAfterFail}")`);
  console.log(`- 3. currentDbVersion não avançou indevidamente: ${versionIntactD ? 'SIM' : 'NÃO'} (versão: ${versionAfterFail})`);
  console.log(`- 4. Gravação posterior atualizou memória e versão: ${subsequentSuccessD ? 'SIM' : 'NÃO'} (nova versão: ${getCurrentDbVersion()})`);
  console.log(`Resultado do Teste D: ${passD ? 'APROVADO' : 'FALHOU'}\n`);
  testResults.push({ name: 'Teste D — Consistência da memória', pass: passD });

  // Restaura banco original limpo em memória e disco
  mockSaveHandler = null;
  mockConfigured = false;
  await saveDatabase(baseDb);

  console.log('========================================================================');
  console.log('RESUMO DOS TESTES DE RECUPERAÇÃO DA FILA (writeQueue):');
  console.log('========================================================================');
  let allPassed = true;
  for (const t of testResults) {
    console.log(`- ${t.name}: ${t.pass ? 'APROVADO' : 'FALHOU'}`);
    if (!t.pass) allPassed = false;
  }

  console.log(`\nStatus Geral da Fila: ${allPassed ? 'TODOS OS TESTES APROVADOS COM SUCESSO' : 'HOUVE FALHAS'}`);
  process.exit(allPassed ? 0 : 1);
}

run().catch(err => {
  console.error('Erro fatal no executor de testes:', err);
  process.exit(1);
});
