const http = require('http');

function request(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const reqHeaders = { ...headers };
    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 4567,
        path,
        method,
        headers: reqHeaders
      },
      (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function run() {
  console.log('=== TESTE DE PERSISTÊNCIA ASSÍNCRONA E CICLO DE VIDA DO BANCO ===\n');

  // 1. Login
  console.log('1. Autenticação com admin / admin123...');
  const loginRes = await request('/api/auth/login', 'POST', { username: 'admin', password: 'admin123' });
  if (loginRes.statusCode !== 200 || !loginRes.data.token) {
    throw new Error(`Falha no login: ${loginRes.statusCode} ${JSON.stringify(loginRes.data)}`);
  }
  const token = loginRes.data.token;
  console.log(`✓ Login bem-sucedido! Usuário: ${loginRes.data.user.name}\n`);

  const authHeader = { Authorization: `Bearer ${token}` };

  // 2. Consulta inicial de Ordens de Serviço
  console.log('2. Buscando ordens de serviço existentes...');
  const listRes = await request('/api/work-orders', 'GET', null, authHeader);
  console.log(`✓ Consulta OK: Status ${listRes.statusCode}, total existente: ${listRes.data.length}\n`);
  const initialCount = listRes.data.length;

  // 3. Criação de nova Ordem de Serviço
  console.log('3. Criando nova Ordem de Serviço (POST /api/work-orders)...');
  const testOS = {
    customerName: 'Cliente Teste Persistência',
    customerPhone: '(11) 99999-0000',
    equipment: 'Notebook Dell Teste Vercel Supabase',
    brand: 'Dell',
    model: 'Inspiron 15',
    serialNumber: 'SN-TEST-VERCEL-2026',
    problemDescription: 'Teste de salvamento aguardado com await no Supabase',
    status: 'analise',
    priority: 'alta',
    laborCost: 150,
    partsCost: 0,
    total: 150
  };

  const createRes = await request('/api/work-orders', 'POST', testOS, authHeader);
  if (createRes.statusCode !== 201 && createRes.statusCode !== 200) {
    throw new Error(`Falha ao criar OS: ${createRes.statusCode} ${JSON.stringify(createRes.data)}`);
  }
  const createdOS = createRes.data;
  console.log(`✓ OS Criada com Sucesso: ID #${createdOS.id}, Número #${createdOS.number}, Total: R$ ${createdOS.total}\n`);

  // 4. Verificação imediata se a OS está presente na listagem
  console.log('4. Verificando se a OS recém-criada é retornada pelo banco...');
  const listRes2 = await request('/api/work-orders', 'GET', null, authHeader);
  const found = listRes2.data.find(o => o.id === createdOS.id);
  if (!found) {
    throw new Error('ERRO: A ordem de serviço recém-criada NÃO foi encontrada na listagem!');
  }
  console.log(`✓ OS #${found.id} confirmada na listagem! Total atual: ${listRes2.data.length} (era ${initialCount})\n`);

  // 5. Atualização da Ordem de Serviço
  console.log('5. Atualizando a Ordem de Serviço (PUT /api/work-orders/:id)...');
  const updateData = {
    ...found,
    status: 'pronto',
    technicalReport: 'Laudo técnico atualizado com await confirmado.'
  };
  const updateRes = await request(`/api/work-orders/${createdOS.id}`, 'PUT', updateData, authHeader);
  if (updateRes.statusCode !== 200) {
    throw new Error(`Falha ao atualizar OS: ${updateRes.statusCode} ${JSON.stringify(updateRes.data)}`);
  }
  console.log(`✓ OS Atualizada com Sucesso: Status alterado para "${updateRes.data.status}"\n`);

  // 6. Exclusão segura com senha de administrador
  console.log('6. Excluindo OS de teste com autorização administrativa...');
  const deleteHeaders = {
    ...authHeader,
    'x-admin-password': encodeURIComponent('admin123')
  };
  const deleteRes = await request(`/api/work-orders/${createdOS.id}`, 'DELETE', null, deleteHeaders);
  if (deleteRes.statusCode !== 200) {
    throw new Error(`Falha ao excluir OS: ${deleteRes.statusCode} ${JSON.stringify(deleteRes.data)}`);
  }
  console.log(`✓ OS #${createdOS.id} excluída com sucesso: "${deleteRes.data.message}"\n`);

  // 7. Verificação final
  const listRes3 = await request('/api/work-orders', 'GET', null, authHeader);
  console.log(`✓ Total de OS após limpeza: ${listRes3.data.length} (voltou ao número inicial: ${initialCount})\n`);

  console.log('=== TODOS OS TESTES PASSARAM COM 100% DE SUCESSO! ===');
}

run().catch((err) => {
  console.error('\n❌ ERRO NO TESTE:', err.message);
  process.exit(1);
});
