/**
 * scripts/upload_local_to_supabase.js
 * 
 * Script de migração assistida de máxima segurança da base local (data/database.json)
 * para a tabela public.system_store no Supabase PostgreSQL.
 * 
 * PROTOCOLO DE SEGURANÇA E AUDITORIA:
 * 1. MODO PADRÃO: --dry-run (somente validação em memória/leitura, ZERO arquivos criados, ZERO gravações).
 *    - Suporta Cenário A (Supabase Versão 1: validação completa de fábrica).
 *    - Suporta Cenário B (Supabase Versão 2: conferência criptográfica SHA-256 canônica byte a byte vs local).
 *    - Rejeita versões diferentes de 1 e 2.
 * 2. CONFIRMAÇÃO TRIPLA: --execute E --confirm-overwrite E digitação manual obrigatória de "MIGRAR BASE POWER TECH".
 * 3. CONTROLE DE VERSÃO E ESTADO REMOTO:
 *    - Exige que o registro 'main_database' exista no Supabase com versão estritamente 1 para execução da migração.
 *    - Presença obrigatória de todas as 18 propriedades de primeiro nível com os tipos exatos.
 *    - Exige que todos os 14 arrays operacionais e corporativos estejam estritamente vazios ([]), incluindo companyPlans.
 *    - Validação integral e sem duplicidades dos dois administradores de fábrica (admin e powertech),
 *      confrontando ID, name, username, role, active e mapa completo de permissões com INITIAL_DATA oficial.
 *    - Preservação dos hashes de senha existentes (validação de formato PBKDF2 sem exigir hash padrão de fábrica).
 *    - Comparação estrutural profunda de configurações (storeSettings, fiscalConfig, backupSettings) via canonicalJson
 *      contra o modelo oficial INITIAL_DATA.
 *    - INITIAL_DATA é OBRIGATÓRIO: se server/db.js não puder ser lido, interrompe imediatamente a execução.
 * 4. VALIDAÇÃO RIGOROSA DAS 18 PROPRIEDADES LOCAIS:
 *    - Verifica existência de todas as 18 chaves, tipos exatos e quantidades consolidadas da base local.
 * 5. VALIDAÇÃO DOS ADMINISTRADORES LOCAIS (PBKDF2):
 *    - Validação de formato regex exato de 161 caracteres (/^[a-f0-9]{32}:[a-f0-9]{128}$/i).
 *    - Validação de papel 'admin' ativo e permissões administrativas completas, sem expor hashes.
 * 6. BACKUP EXTERNO INDEPENDENTE E REFORÇADO:
 *    - Destino obrigatoriamente fora da pasta do projeto via limites de diretório seguros.
 *    - Confirmação de criação efetiva no disco, tamanho maior que zero e conferência de igualdade
 *      criptográfica SHA-256 com a base original antes de qualquer conexão de escrita no Supabase.
 * 7. INTEGRIDADE DA ORIGEM ANTES DA TRANSAÇÃO (ANTI-TAMPERING):
 *    - Recálculo do SHA-256 de data/database.json imediatamente antes do comando BEGIN.
 *    - Garantia de que o objeto enviado ao PostgreSQL corresponde byte a byte ao validado.
 * 8. TRANSAÇÃO ATÔMICA, CONCORRÊNCIA E TRATAMENTO DE COMMIT E ROLLBACK:
 *    - BEGIN -> SELECT data, version FOR UPDATE -> Revalidação integral sobre a linha bloqueada ->
 *      UPDATE condicional (WHERE key = 'main_database' AND version = 1) ->
 *      Leitura de retorno -> Comparação SHA-256 Canônico -> COMMIT.
 *    - Tratamento correto pós-COMMIT via isMigrationSuccessful: erros de liberação/encerramento
 *      NÃO anulam nem transformam a migração bem-sucedida em falha.
 *    - Se a conexão cair durante envio do COMMIT, trata como INDETERMINADO sem repetição automática.
 * 9. PRIVACIDADE DA CONEXÃO E IDENTIFICAÇÃO DE HOSTS:
 *    - Identificação precisa de hosts locais via parser new URL() (apenas localhost, 127.0.0.1 e ::1).
 *    - Validação estrita de certificado SSL (rejectUnauthorized: true) OBRIGATÓRIA para hosts remotos.
 *    - Mensagens genéricas de conexão sem expor credenciais.
 * 10. ENCERRAMENTO SEGURO DE RECURSOS GARANTIDO (FINALLY):
 *    - Liberação garantida da conexão (client.release) e encerramento do pool (pool.end) no bloco finally.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const vm = require('vm');
const { Pool } = require('pg');

const EXPECTED_PROPERTY_TYPES = {
  storeSettings: 'object',
  fiscalConfig: 'object',
  backupSettings: 'object',
  backupHistory: 'array',
  customers: 'array',
  products: 'array',
  services: 'array',
  workOrders: 'array',
  sales: 'array',
  quotes: 'array',
  fiscalInvoices: 'array',
  users: 'array',
  sellers: 'array',
  expenses: 'array',
  companies: 'array',
  companyPlans: 'array',
  companyEquipments: 'array',
  companyMaintenances: 'array'
};

// Estrutura da semente legada de 14 propriedades gerada na primeira inicialização serverless (Vercel)
const EXPECTED_LEGACY_PROPERTY_TYPES = {
  workOrders: 'array',
  sales: 'array',
  customers: 'array',
  products: 'array',
  services: 'array',
  quotes: 'array',
  expenses: 'array',
  sellers: 'array',
  companies: 'array',
  companyPlans: 'array',
  companyEquipments: 'array',
  companyMaintenances: 'array',
  settings: 'object',
  users: 'array'
};

const LEGACY_EMPTY_ARRAY_KEYS = [
  'workOrders',
  'sales',
  'customers',
  'products',
  'services',
  'quotes',
  'expenses',
  'sellers',
  'companies',
  'companyPlans',
  'companyEquipments',
  'companyMaintenances'
];

const EXPECTED_COUNTS = {
  customers: 64,
  workOrders: [58, 59, 60], // 58 originais ou 59/60 com OSs de teste (#1060, #1061) geradas nos testes do servidor
  sales: 99,
  products: 39,
  services: [12, 13], // 12 originais ou 13 com o serviço 'REPARO DC JACK'
  expenses: 18,
  sellers: 3,
  users: 2
};

const REQUIRED_CONFIRMATION_PHRASE = 'MIGRAR BASE POWER TECH';

const PBKDF2_REGEX = /^[a-f0-9]{32}:[a-f0-9]{128}$/i;

// Lista canônica dos 14 arrays operacionais, corporativos e de histórico que devem estar estritamente vazios ([])
const EMPTY_ARRAY_KEYS = [
  'customers',
  'workOrders',
  'sales',
  'products',
  'services',
  'expenses',
  'quotes',
  'fiscalInvoices',
  'sellers',
  'backupHistory',
  'companies',
  'companyPlans',
  'companyEquipments',
  'companyMaintenances'
];

function computeSha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Converte qualquer objeto ou array JSON para uma representação canônica
 * com chaves ordenadas alfabeticamente e sem espaços em branco, permitindo
 * comparação criptográfica de igualdade estrita (SHA-256) com JSONB do PostgreSQL.
 */
function canonicalJson(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj).sort();
  return '{' + sortedKeys.map(k => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}';
}

function promptInteractiveConfirmation(questionText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(questionText, answer => {
      rl.close();
      resolve((answer || '').trim());
    });
  });
}

/**
 * Carrega OBRIGATORIAMENTE a definição oficial de INITIAL_DATA a partir de server/db.js.
 * Se o arquivo estiver ausente ou o bloco não puder ser interpretado, lança exceção imediata.
 * Nenhum fallback silencioso é permitido.
 */
function loadProjectInitialData() {
  const dbFilePath = path.resolve(__dirname, '..', 'server', 'db.js');
  if (!fs.existsSync(dbFilePath)) {
    throw new Error(`Arquivo server/db.js não encontrado em: ${dbFilePath}`);
  }

  const code = fs.readFileSync(dbFilePath, 'utf8');
  const match = code.match(/const INITIAL_DATA = ({[\s\S]*?\n\};)/);
  if (!match) {
    throw new Error('Não foi possível localizar a declaração const INITIAL_DATA dentro de server/db.js.');
  }

  const sandbox = { path, process, INITIAL_DATA: null };
  vm.createContext(sandbox);
  try {
    const script = new vm.Script('INITIAL_DATA = ' + match[1]);
    script.runInContext(sandbox);
  } catch (parseErr) {
    throw new Error(`Falha ao interpretar INITIAL_DATA de server/db.js: ${parseErr.message}`);
  }

  if (!sandbox.INITIAL_DATA || typeof sandbox.INITIAL_DATA !== 'object') {
    throw new Error('A estrutura INITIAL_DATA extraída de server/db.js é inválida.');
  }

  // Validação de presença dos componentes fundamentais de INITIAL_DATA
  if (!sandbox.INITIAL_DATA.users || !sandbox.INITIAL_DATA.storeSettings || !sandbox.INITIAL_DATA.fiscalConfig || !sandbox.INITIAL_DATA.backupSettings) {
    throw new Error('A estrutura INITIAL_DATA carregada de server/db.js não contém todos os módulos obrigatórios.');
  }

  return sandbox.INITIAL_DATA;
}

/**
 * Compara um objeto de configuração remoto com o modelo oficial INITIAL_DATA.
 * Utiliza canonicalJson para comparação estrutural profunda de valores, objetos e arrays aninhados,
 * garantindo que nenhuma propriedade aninhada seja ignorada e que diferenças reais sejam rejeitadas.
 * Permite somente validações para valores comprovadamente dinâmicos (ex: timestamps e diretório).
 */
function compareConfigObject(remoteObj, refObj, propName, dynamicValidators = {}) {
  if (!remoteObj || typeof remoteObj !== 'object' || Array.isArray(remoteObj)) {
    return { isValid: false, reason: `Configuração remota "${propName}" não é um objeto válido.` };
  }

  const remoteKeys = Object.keys(remoteObj);
  const refKeys = Object.keys(refObj);

  // 1. Verifica ausência de chaves esperadas da inicialização oficial
  for (const k of refKeys) {
    if (!remoteObj.hasOwnProperty(k) || remoteObj[k] === undefined) {
      return { isValid: false, reason: `Chave obrigatória "${k}" ausente na configuração remota "${propName}".` };
    }
  }

  // 2. Rejeita configurações alteradas ou inesperadas
  for (const k of remoteKeys) {
    if (!refObj.hasOwnProperty(k)) {
      return { isValid: false, reason: `Configuração inesperada encontrada em "${propName}": chave desconhecida "${k}".` };
    }
  }

  // 3. Compara valores estruturalmente com o padrão oficial usando canonicalJson
  for (const k of refKeys) {
    if (dynamicValidators[k]) {
      const isValidDynamic = dynamicValidators[k](remoteObj[k]);
      if (!isValidDynamic) {
        return { isValid: false, reason: `Valor dinâmico inválido para "${propName}.${k}".` };
      }
    } else {
      const remoteValCanonical = canonicalJson(remoteObj[k]);
      const refValCanonical = canonicalJson(refObj[k]);
      if (remoteValCanonical !== refValCanonical) {
        return {
          isValid: false,
          reason: `Divergência estrutural de configuração em "${propName}.${k}": o valor remoto não corresponde ao padrão oficial INITIAL_DATA.`
        };
      }
    }
  }

  return { isValid: true };
}

/**
 * Validação rigorosa dos dois administradores de fábrica (admin e powertech, sem duplicidades),
 * confrontando ID, name, username, role, active e mapa completo de permissões com INITIAL_DATA oficial.
 * Preserva hashes existentes sem exigir que sejam os de fábrica, validando o formato PBKDF2 (161 caracteres).
 * Retorna { isValid: boolean, reason?: string }
 */
function verifyFactoryUsers(usersArray, projectInitialData) {
  if (!Array.isArray(usersArray)) {
    return { isValid: false, reason: 'A propriedade remota "users" não é um array.' };
  }
  if (usersArray.length !== 2) {
    return { isValid: false, reason: `Quantidade incorreta de usuários no banco remoto: ${usersArray.length} (esperado exatamente 2 de fábrica).` };
  }

  const seenUsernames = new Set();

  for (const u of usersArray) {
    if (!u || typeof u !== 'object') {
      return { isValid: false, reason: 'Item de usuário remoto inválido (não é objeto).' };
    }
    const uname = (u.username || '').toLowerCase();
    if (!uname) {
      return { isValid: false, reason: 'Usuário remoto sem nome de usuário (username).' };
    }
    if (uname !== 'admin' && uname !== 'powertech') {
      return { isValid: false, reason: `Encontrado usuário não-fábrica no banco remoto: "${u.username}".` };
    }
    if (seenUsernames.has(uname)) {
      return { isValid: false, reason: `Nome de usuário duplicado no banco remoto: "${u.username}".` };
    }
    seenUsernames.add(uname);

    // Localiza o usuário correspondente no INITIAL_DATA oficial
    const refUser = projectInitialData.users.find(ru => (ru.username || '').toLowerCase() === uname);
    if (!refUser) {
      return { isValid: false, reason: `Usuário "${u.username}" não encontrado na referência oficial INITIAL_DATA.` };
    }

    // Comparação de correspondência integral dos campos relevantes
    if (u.id !== refUser.id) {
      return { isValid: false, reason: `ID do usuário "${u.username}" diverge do INITIAL_DATA (${u.id} !== ${refUser.id}).` };
    }
    if (u.name !== refUser.name) {
      return { isValid: false, reason: `Nome do usuário "${u.username}" diverge do INITIAL_DATA (${u.name} !== ${refUser.name}).` };
    }
    if (u.role !== refUser.role) {
      return { isValid: false, reason: `Papel do usuário "${u.username}" diverge do INITIAL_DATA (${u.role} !== ${refUser.role}).` };
    }
    if (u.active !== refUser.active) {
      return { isValid: false, reason: `Estado ativo do usuário "${u.username}" diverge do INITIAL_DATA (${u.active} !== ${refUser.active}).` };
    }

    // Validação de formato PBKDF2 (161 caracteres) preservando hashes existentes sem exigir igualdade ao hash inicial de fábrica
    if (!u.passwordHash || typeof u.passwordHash !== 'string' || !PBKDF2_REGEX.test(u.passwordHash) || u.passwordHash.length !== 161) {
      return { isValid: false, reason: `Usuário remoto "${u.username}" possui formato de hash PBKDF2 inválido ou corrompido.` };
    }

    // Comparação integral do mapa completo de permissões
    if (!u.permissions || typeof u.permissions !== 'object' || Array.isArray(u.permissions)) {
      return { isValid: false, reason: `Usuário remoto "${u.username}" não possui objeto de permissões válido.` };
    }

    const refPermKeys = Object.keys(refUser.permissions);
    const userPermKeys = Object.keys(u.permissions);

    for (const pKey of refPermKeys) {
      if (!u.permissions.hasOwnProperty(pKey)) {
        return { isValid: false, reason: `Permissão obrigatória "${pKey}" ausente no usuário "${u.username}".` };
      }
      if (u.permissions[pKey] !== refUser.permissions[pKey]) {
        return { isValid: false, reason: `Permissão "${pKey}" do usuário "${u.username}" diverge do INITIAL_DATA.` };
      }
    }

    for (const pKey of userPermKeys) {
      if (!refUser.permissions.hasOwnProperty(pKey)) {
        return { isValid: false, reason: `Permissão inesperada "${pKey}" encontrada no usuário "${u.username}".` };
      }
    }
  }

  if (!seenUsernames.has('admin') || !seenUsernames.has('powertech') || seenUsernames.size !== 2) {
    return { isValid: false, reason: 'O banco remoto deve conter obrigatoriamente os usuários "admin" e "powertech" sem duplicidades.' };
  }

  return { isValid: true };
}

/**
 * Inspeciona integralmente se o registro remoto corresponde a uma semente inicial válida pré-migração.
 * Suporta dois cenários estritos:
 *
 * CENÁRIO 1 - Semente Padrão de 18 propriedades (schema completo de fábrica):
 * 1. Presença OBRIGATÓRIA de todas as 18 propriedades com tipos exatos.
 * 2. Ausência total de propriedades de primeiro nível inesperadas.
 * 3. Garantia de que todos os 14 arrays operacionais e corporativos estão estritamente vazios ([]).
 * 4. Validação completa dos dois administradores de fábrica (admin e powertech).
 * 5. Comparação estrutural real dos objetos storeSettings, fiscalConfig e backupSettings contra INITIAL_DATA.
 *
 * CENÁRIO 2 - Semente Legada de 14 propriedades (deploy inicial Vercel):
 * 1. Presença OBRIGATÓRIA de todas as 14 propriedades legadas com tipos exatos.
 * 2. Ausência total de propriedades de primeiro nível inesperadas (exatamente as 14 permitidas).
 * 3. Garantia de que todos os 12 arrays operacionais e corporativos estão estritamente vazios ([]).
 * 4. Garantia estrita de que "settings" é um objeto vazio ({}). Se preenchido com qualquer dado, rejeita.
 * 5. Validação completa dos dois administradores de fábrica (admin e powertech).
 *
 * Retorna { isValid: boolean, reason?: string, seedType?: 'standard_18' | 'legacy_14' }
 */
function verifyIsFactorySeedState(remoteData, projectInitialData) {
  if (!projectInitialData || typeof projectInitialData !== 'object') {
    return { isValid: false, reason: 'A referência oficial INITIAL_DATA é obrigatória para a validação remota e não foi fornecida.' };
  }

  if (!remoteData || typeof remoteData !== 'object' || Array.isArray(remoteData)) {
    return { isValid: false, reason: 'O registro remoto não é um objeto JSON válido.' };
  }

  // Identificação do formato da semente:
  // Se possuir 'storeSettings', valida pelo formato padrão de 18 propriedades.
  // Se não possuir 'storeSettings', mas possuir 'settings', valida pelo formato legado de 14 propriedades (deploy inicial Vercel).
  const isLegacySeed = !remoteData.hasOwnProperty('storeSettings') && remoteData.hasOwnProperty('settings');

  if (isLegacySeed) {
    // -------------------------------------------------------------
    // CENÁRIO LEGADO DE 14 PROPRIEDADES (Seed gerada pelo deploy Vercel)
    // -------------------------------------------------------------
    // 1. Presença OBRIGATÓRIA de todas as 14 propriedades legadas com tipos exatos
    for (const [propName, expectedType] of Object.entries(EXPECTED_LEGACY_PROPERTY_TYPES)) {
      if (!remoteData.hasOwnProperty(propName) || remoteData[propName] === undefined) {
        return { isValid: false, reason: `Propriedade obrigatória ausente no banco remoto legado: "${propName}".` };
      }
      if (expectedType === 'array') {
        if (!Array.isArray(remoteData[propName])) {
          return { isValid: false, reason: `Propriedade remota legada "${propName}" deveria ser um Array, mas é ${typeof remoteData[propName]}.` };
        }
      } else if (expectedType === 'object') {
        if (remoteData[propName] === null || typeof remoteData[propName] !== 'object' || Array.isArray(remoteData[propName])) {
          return { isValid: false, reason: `Propriedade remota legada "${propName}" deveria ser um Objeto válido.` };
        }
      }
    }

    // 2. Rejeição de propriedades de primeiro nível inesperadas (deve conter estritamente as 14)
    for (const key of Object.keys(remoteData)) {
      if (!EXPECTED_LEGACY_PROPERTY_TYPES.hasOwnProperty(key)) {
        return { isValid: false, reason: `Propriedade de primeiro nível inesperada no banco remoto legado: "${key}".` };
      }
    }

    // 3. Garantia de que todos os 12 arrays operacionais e corporativos estão estritamente vazios ([])
    for (const key of LEGACY_EMPTY_ARRAY_KEYS) {
      if (remoteData[key].length > 0) {
        return { isValid: false, reason: `Módulo remoto "${key}" contém ${remoteData[key].length} registro(s). Esperado array estritamente vazio ([]).` };
      }
    }

    // 4. Garantia estrita de que "settings" é um objeto estritamente vazio ({})
    const settingsKeys = Object.keys(remoteData.settings);
    if (settingsKeys.length > 0) {
      return {
        isValid: false,
        reason: `A propriedade legada "settings" no banco remoto deve ser um objeto estritamente vazio ({}), mas contém ${settingsKeys.length} propriedade(s): [${settingsKeys.join(', ')}].`
      };
    }

    // 5. Validação rigorosa dos dois usuários de fábrica
    const userCheck = verifyFactoryUsers(remoteData.users, projectInitialData);
    if (!userCheck.isValid) return userCheck;

    return { isValid: true, seedType: 'legacy_14' };
  }

  // -------------------------------------------------------------
  // CENÁRIO PADRÃO DE 18 PROPRIEDADES (Seed completa atual)
  // -------------------------------------------------------------
  // 1. Presença OBRIGATÓRIA de todas as 18 propriedades e validação rigorosa de tipos
  for (const [propName, expectedType] of Object.entries(EXPECTED_PROPERTY_TYPES)) {
    if (!remoteData.hasOwnProperty(propName) || remoteData[propName] === undefined) {
      return { isValid: false, reason: `Propriedade obrigatória ausente no banco remoto: "${propName}".` };
    }
    if (expectedType === 'array') {
      if (!Array.isArray(remoteData[propName])) {
        return { isValid: false, reason: `Propriedade remota "${propName}" deveria ser um Array, mas é ${typeof remoteData[propName]}.` };
      }
    } else if (expectedType === 'object') {
      if (remoteData[propName] === null || typeof remoteData[propName] !== 'object' || Array.isArray(remoteData[propName])) {
        return { isValid: false, reason: `Propriedade remota "${propName}" deveria ser um Objeto válido.` };
      }
    }
  }

  // 2. Rejeição de propriedades de primeiro nível inesperadas
  for (const key of Object.keys(remoteData)) {
    if (!EXPECTED_PROPERTY_TYPES.hasOwnProperty(key)) {
      return { isValid: false, reason: `Propriedade de primeiro nível inesperada no banco remoto: "${key}".` };
    }
  }

  // 3. Garantia de que todos os 14 arrays operacionais e corporativos estão estritamente vazios ([])
  for (const key of EMPTY_ARRAY_KEYS) {
    if (remoteData[key].length > 0) {
      return { isValid: false, reason: `Módulo remoto "${key}" contém ${remoteData[key].length} registro(s). Esperado array estritamente vazio ([]).` };
    }
  }

  // 4. Validação rigorosa dos dois usuários de fábrica
  const userCheck = verifyFactoryUsers(remoteData.users, projectInitialData);
  if (!userCheck.isValid) return userCheck;

  // 5. Comparação estrutural real dos objetos de configuração contra INITIAL_DATA oficial
  // 5.1 storeSettings
  const storeCheck = compareConfigObject(remoteData.storeSettings, projectInitialData.storeSettings, 'storeSettings');
  if (!storeCheck.isValid) return storeCheck;

  // 5.2 fiscalConfig
  const fiscalCheck = compareConfigObject(remoteData.fiscalConfig, projectInitialData.fiscalConfig, 'fiscalConfig');
  if (!fiscalCheck.isValid) return fiscalCheck;

  // 5.3 backupSettings (aceita diferenças comprovadamente normais: timestamp ISO ou null inicial e diretório)
  const backupCheck = compareConfigObject(remoteData.backupSettings, projectInitialData.backupSettings, 'backupSettings', {
    lastBackupAt: val => val === null || (typeof val === 'string' && !isNaN(Date.parse(val))),
    backupDirectory: val => typeof val === 'string' && val.trim().length > 0
  });
  if (!backupCheck.isValid) return backupCheck;

  return { isValid: true, seedType: 'standard_18' };
}

/**
 * Extrai o hostname normalizado de uma connection string PostgreSQL usando o parser new URL().
 */
function extractDatabaseHostname(postgresUrl) {
  if (!postgresUrl || typeof postgresUrl !== 'string') return '';
  try {
    const parsed = new URL(postgresUrl);
    return (parsed.hostname || '').toLowerCase().replace(/^\[|\]$/g, '').trim();
  } catch {
    return '';
  }
}

/**
 * Determina se o host da URL do PostgreSQL é estritamente local (localhost, 127.0.0.1 ou ::1).
 * Não utiliza simples substring que possa coincidir com domínios remotos.
 */
function isLocalDatabaseHost(postgresUrl) {
  const hostname = extractDatabaseHostname(postgresUrl);
  if (!hostname) return false;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

/**
 * Determina a configuração de SSL para a conexão PostgreSQL:
 * - Hosts estritamente locais (localhost, 127.0.0.1, ::1) não utilizam SSL.
 * - Conexões remotas exigem validação TLS estrita com rejectUnauthorized: true.
 * - Suporta CA customizado via PGSSLROOTCERT ou SSL_CA_PATH.
 * - Nenhuma flexibilização ou desativação de validação TLS é permitida para conexões remotas.
 */
function getSslConfiguration(postgresUrl) {
  if (isLocalDatabaseHost(postgresUrl)) {
    return false;
  }

  const customCaPath = process.env.PGSSLROOTCERT || process.env.SSL_CA_PATH;
  if (customCaPath && fs.existsSync(customCaPath)) {
    console.log(`   ✓ Utilizando certificado CA customizado para validação TLS estrita: ${customCaPath}`);
    return {
      rejectUnauthorized: true,
      ca: fs.readFileSync(customCaPath, 'utf8')
    };
  }

  // TLS estrito obrigatório por padrão. Nenhuma opção de bypass inseguro.
  return { rejectUnauthorized: true };
}

/**
 * Verifica se childDir reside dentro de parentDir ou é idêntico a ele,
 * considerando os limites reais de diretórios para evitar falsos positivos
 * em diretórios irmãos com nomes que compartilham o mesmo prefixo.
 */
function isPathInsideOrEqual(parentDir, childDir) {
  const resolvedParent = path.resolve(parentDir).toLowerCase();
  const resolvedChild = path.resolve(childDir).toLowerCase();

  if (resolvedParent === resolvedChild) {
    return true;
  }

  const relative = path.relative(resolvedParent, resolvedChild);
  const isInsideRelative = !relative.startsWith('..') && !path.isAbsolute(relative);

  const parentWithSep = resolvedParent.endsWith(path.sep) ? resolvedParent : resolvedParent + path.sep;
  const isInsidePrefix = resolvedChild.startsWith(parentWithSep);

  return isInsideRelative || isInsidePrefix;
}

/**
 * Valida se o diretório de backup externo é seguro e reside fora da pasta do projeto.
 */
function validateExternalBackupPath(backupDir, projectRoot) {
  if (!backupDir || typeof backupDir !== 'string') {
    return { isValid: false, reason: 'Diretório de backup não informado.' };
  }
  if (!projectRoot || typeof projectRoot !== 'string') {
    return { isValid: false, reason: 'Raiz do projeto não informada.' };
  }

  const resolvedBackup = path.resolve(backupDir);
  const resolvedProject = path.resolve(projectRoot);

  if (isPathInsideOrEqual(resolvedProject, resolvedBackup)) {
    return {
      isValid: false,
      reason: `O diretório de backup (${resolvedBackup}) reside dentro da pasta do projeto (${resolvedProject}).`
    };
  }

  if (isPathInsideOrEqual(resolvedBackup, resolvedProject)) {
    return {
      isValid: false,
      reason: `A pasta do projeto (${resolvedProject}) reside dentro do diretório de backup (${resolvedBackup}).`
    };
  }

  return { isValid: true };
}

async function main() {
  console.log('================================================================');
  console.log('  POWER TECH - PROTOCOLO DE MIGRAÇÃO SEGURA PARA O SUPABASE');
  console.log('================================================================\n');

  let pool = null;
  let client = null;
  let inTransaction = false;
  let commitAttempted = false;
  let isMigrationSuccessful = false;

  try {
    const args = process.argv.slice(2);
    const isExecute = args.includes('--execute');
    const isConfirmed = args.includes('--confirm-overwrite');
    const isDryRun = !isExecute || args.includes('--dry-run');

    if (isDryRun) {
      console.log('>>> MODO SIMULAÇÃO ATIVO (--dry-run).');
      console.log('>>> Nenhuma gravação no banco e nenhum arquivo de backup será criado no disco. <<<\n');
    } else if (!isConfirmed) {
      throw new Error(
        'Para executar a gravação real, é obrigatório passar:\n' +
        '   node scripts/upload_local_to_supabase.js --execute --confirm-overwrite\n' +
        'A execução foi interrompida para prevenir gravações acidentais.'
      );
    } else {
      console.log('⚠️  MODO DE EXECUÇÃO REAL ATIVADO COM CONFIRMAÇÃO EXPLÍCITA. ⚠️\n');
    }

    // 1. Carregamento OBRIGATÓRIO da referência oficial INITIAL_DATA de server/db.js
    console.log('1. Carregando referência oficial INITIAL_DATA de server/db.js...');
    const projectInitialData = loadProjectInitialData();
    console.log('   ✓ Estrutura oficial INITIAL_DATA carregada com sucesso para validação rigorosa.\n');

    // 2. Localização e Leitura da base original (somente leitura)
    const dbPath = path.resolve(__dirname, '..', 'data', 'database.json');
    if (!fs.existsSync(dbPath)) {
      throw new Error(`Arquivo de banco de dados não encontrado em: ${dbPath}`);
    }

    console.log(`2. Lendo base original: ${dbPath}`);
    const rawOriginalContent = fs.readFileSync(dbPath, 'utf8');
    const initialOriginSha256 = computeSha256(rawOriginalContent);
    const sizeKb = (Buffer.byteLength(rawOriginalContent, 'utf8') / 1024).toFixed(1);

    let localData;
    try {
      localData = JSON.parse(rawOriginalContent);
    } catch (err) {
      throw new Error(`JSON local corrompido ou inválido: ${err.message}`);
    }

    console.log(`   ✓ Tamanho da base local: ${sizeKb} KB`);
    console.log(`   ✓ SHA-256 original: ${initialOriginSha256}\n`);

    // 3. Validação Rigorosa das 18 Chaves, Tipos e Ausência de Chaves Inesperadas Locais
    console.log('3. Validando integridade das 18 propriedades de primeiro nível locais:');
    const localKeys = Object.keys(localData);
    const expectedKeyList = Object.keys(EXPECTED_PROPERTY_TYPES);

    // 3.1 Verifica se todas as 18 existem
    const missingKeys = expectedKeyList.filter(k => !localKeys.includes(k));
    if (missingKeys.length > 0) {
      throw new Error(`Faltam propriedades obrigatórias na base local: ${missingKeys.join(', ')}`);
    }

    // 3.2 Identifica propriedades extras inesperadas
    const unexpectedKeys = localKeys.filter(k => !EXPECTED_PROPERTY_TYPES.hasOwnProperty(k));
    if (unexpectedKeys.length > 0) {
      throw new Error(`Propriedades extras não reconhecidas encontradas na base local: ${unexpectedKeys.join(', ')}`);
    }

    // 3.3 Valida os tipos de cada uma das 18 propriedades
    for (const [propName, expectedType] of Object.entries(EXPECTED_PROPERTY_TYPES)) {
      const val = localData[propName];
      if (expectedType === 'array') {
        if (!Array.isArray(val)) {
          throw new Error(`Propriedade local "${propName}" deveria ser um Array, encontrado: ${typeof val}`);
        }
      } else if (expectedType === 'object') {
        if (val === null || typeof val !== 'object' || Array.isArray(val)) {
          throw new Error(`Propriedade local "${propName}" deveria ser um Objeto, encontrado: ${val === null ? 'null' : typeof val}`);
        }
      }
    }
    console.log('   ✓ Todas as 18 propriedades existem com os tipos exatos e sem chaves inesperadas.\n');

    // 4. Conferência das Quantidades dos Módulos Locais
    console.log('4. Conferindo contagens dos módulos locais:');
    for (const [moduleName, expectedCount] of Object.entries(EXPECTED_COUNTS)) {
      const actualCount = localData[moduleName].length;
      const isMatch = Array.isArray(expectedCount)
        ? expectedCount.includes(actualCount)
        : actualCount === expectedCount;
      if (!isMatch) {
        throw new Error(`Divergência em "${moduleName}": ${actualCount} registros (esperado: ${expectedCount})`);
      }
      console.log(`   ✓ ${moduleName}: exatamente ${actualCount} registros.`);
    }
    console.log('   ✓ Todas as contagens de módulos conferem com precisão absoluta.\n');

    // 5. Validação dos Administradores Locais (PBKDF2)
    console.log('5. Validando administradores e hashes PBKDF2:');
    const users = localData.users;
    if (users.length !== 2) {
      throw new Error(`Base local deve conter exatamente 2 usuários administradores (encontrado: ${users.length})`);
    }

    for (const expectedUsername of ['admin', 'powertech']) {
      const user = users.find(u => u.username && u.username.toLowerCase() === expectedUsername);
      if (!user) {
        throw new Error(`Usuário "${expectedUsername}" não encontrado na base.`);
      }
      if (user.role !== 'admin' || user.active !== true) {
        throw new Error(`Usuário "${expectedUsername}" não possui papel 'admin' ativo.`);
      }
      if (!user.passwordHash || !PBKDF2_REGEX.test(user.passwordHash) || user.passwordHash.length !== 161) {
        throw new Error(`Formato de hash PBKDF2 de "${expectedUsername}" inválido ou incompatível com o sistema.`);
      }
      if (!user.permissions || user.permissions.workOrders !== true || user.permissions.pos !== true) {
        throw new Error(`Usuário "${expectedUsername}" com permissões administrativas incompletas.`);
      }
      console.log(`   ✓ Usuário "${user.username}": papel 'admin' ativo, permissões completas e hash PBKDF2 verificado.`);
    }
    console.log('   [Privacidade] Nenhum hash, senha, token ou dado de cliente é exibido nos logs.\n');

    // 6. Modo Simulação (--dry-run)
    if (isDryRun) {
      console.log('================================================================');
      console.log('  RELATÓRIO DO MODO SIMULAÇÃO (--dry-run)');
      console.log('================================================================');
      console.log('✓ Leitura da base local e cálculo de SHA-256: APROVADO');
      console.log('✓ Integridade das 18 propriedades e tipos locais: APROVADO');
      console.log('✓ Contagens dos clientes, OSs, produtos, vendas e serviços locais: APROVADO');
      console.log('✓ Validação dos administradores locais e formato PBKDF2: APROVADO');
      console.log('✓ Proteção do disco: NENHUM arquivo criado ou modificado durante a simulação.');

      const postgresUrl = process.env.POSTGRES_URL;
      if (postgresUrl) {
        console.log('\n--- SIMULAÇÃO REMOTA: Inspecionando Supabase em modo somente leitura ---');
        console.log('Conectando com segurança ao Supabase via PostgreSQL (identificação por URL parser e SSL estrito)...');
        const sslConfig = getSslConfiguration(postgresUrl);
        pool = new Pool({
          connectionString: postgresUrl,
          ssl: sslConfig,
          connectionTimeoutMillis: 10000,
          max: 1
        });

        try {
          client = await pool.connect();
          const res = await client.query('SELECT data, version, updated_at FROM public.system_store WHERE key = $1', ['main_database']);
          if (!res.rows || res.rows.length === 0) {
            throw new Error('Registro "main_database" não existe no Supabase.');
          }

          const row = res.rows[0];
          const v = Number(row.version);
          const remoteData = row.data;
          console.log(`✓ Conexão remota estabelecida com sucesso.`);
          console.log(`✓ Registro 'main_database' encontrado. Versão atual no Supabase: ${v}`);
          console.log(`✓ Data da última modificação: ${row.updated_at}`);

          if (v === 1) {
            console.log('\n--- CENÁRIO A: Supabase na Versão 1 (Estado de Fábrica Pré-Migração) ---');
            const seedCheck = verifyIsFactorySeedState(remoteData, projectInitialData);
            if (!seedCheck.isValid) {
              throw new Error(`Banco remoto rejeitado por conter dados não-fábrica: ${seedCheck.reason}`);
            }

            console.log('✓ Banco remoto confirmado integralmente como semente inicial de fábrica:');
            if (seedCheck.seedType === 'legacy_14') {
              console.log('  - Reconhecida semente legada de 14 propriedades (deploy inicial Vercel).');
              console.log('  - Todos os 12 módulos operacionais e corporativos estão estritamente vazios ([]).');
              console.log('  - Propriedade legada "settings" confirmada como objeto estritamente vazio ({}).');
              console.log('  - Dois administradores de fábrica validados estruturalmente em conformidade com INITIAL_DATA.');
            } else {
              console.log('  - Todas as 18 propriedades obrigatórias estão presentes com os tipos exatos.');
              console.log('  - Todos os 14 arrays operacionais e corporativos estão estritamente vazios ([]).');
              console.log('  - Dois administradores de fábrica validados estruturalmente em conformidade com INITIAL_DATA.');
              console.log('  - Configurações (storeSettings, fiscalConfig, backupSettings) validadas estruturalmente contra o modelo oficial.');
            }
            console.log('\n>>> STATUS: Supabase na Versão 1 confirmado. Pronto para receber a migração com segurança. <<<');
          } else if (v === 2) {
            console.log('\n--- CENÁRIO B: Supabase na Versão 2 (Base Já Migrada) ---');
            console.log('Conferindo integridade e correspondência entre base local e banco remoto...');

            // Validação das propriedades de primeiro nível no banco remoto
            for (const [propName] of Object.entries(EXPECTED_PROPERTY_TYPES)) {
              if (!remoteData.hasOwnProperty(propName) || remoteData[propName] === undefined) {
                throw new Error(`Propriedade obrigatória ausente no banco remoto migrado: "${propName}".`);
              }
            }

            // Conferência das quantidades esperadas no banco remoto
            console.log('  ✓ Conferindo quantidades dos módulos no banco remoto:');
            for (const [moduleName, expectedCount] of Object.entries(EXPECTED_COUNTS)) {
              const remoteCount = Array.isArray(remoteData[moduleName]) ? remoteData[moduleName].length : 0;
              const isMatch = Array.isArray(expectedCount)
                ? expectedCount.includes(remoteCount)
                : remoteCount === expectedCount;
              if (!isMatch) {
                throw new Error(`Divergência de contagem no banco remoto em "${moduleName}": ${remoteCount} registros (esperado: ${expectedCount}).`);
              }
              console.log(`     ✓ ${moduleName}: exatamente ${remoteCount} registros no Supabase.`);
            }

            // Comparação Criptográfica SHA-256 de JSON Canônico
            console.log('  ✓ Comparando SHA-256 canônico da base local vs Supabase...');
            const localCanonicalHash = computeSha256(canonicalJson(localData));
            const remoteCanonicalHash = computeSha256(canonicalJson(remoteData));

            if (localCanonicalHash === remoteCanonicalHash) {
              console.log(`  ✓ Hash canônico remoto: ${remoteCanonicalHash}`);
              console.log(`  ✓ Hash canônico local:  ${localCanonicalHash}`);
              console.log('\n>>> STATUS: Supabase na Versão 2 com dados 100% IDÊNTICOS à base local! <<<');
              console.log('>>> A migração dos dados está plenamente consolidada e confirmada na nuvem. <<<');
            } else {
              console.error(`  ❌ Hash canônico remoto: ${remoteCanonicalHash}`);
              console.error(`  ❌ Hash canônico local:  ${localCanonicalHash}`);
              throw new Error(
                'DIVERGÊNCIA DE DADOS: O Supabase está na Versão 2, porém os dados remotos DIVERGEM da base local! ' +
                'O hash SHA-256 canônico do banco remoto não corresponde ao arquivo local data/database.json.'
              );
            }
          } else {
            throw new Error(
              `Versão remota inesperada no Supabase: Versão ${v}. O sistema aceita exclusivamente a Versão 1 (base inicial de fábrica) ou Versão 2 (base migrada).`
            );
          }

          console.log('\n>>> SIMULAÇÃO COMPLETA CONCLUÍDA: NENHUMA ESCRITA EXECUTADA. <<<\n');
        } catch (remoteErr) {
          console.error(`\n❌ ERRO NA SIMULAÇÃO REMOTA: A validação do Supabase NÃO foi concluída com sucesso.`);
          console.error(`Motivo: ${remoteErr.message}`);
          if (remoteErr.message && (remoteErr.message.includes('self-signed') || remoteErr.message.includes('certificate'))) {
            console.error('Nota SSL: Erro de validação de cadeia de certificados TLS detectado.');
          }
          throw new Error(`Validação remota incompleta ou falha na inspeção do Supabase: ${remoteErr.message}`);
        }
      } else {
        console.log('\n--- SIMULAÇÃO PARCIAL (LOCAL): POSTGRES_URL não informada no ambiente ---');
        console.log('ℹ Somente a base local (data/database.json) foi validada.');
        console.log('ℹ Para validar a conexão e o estado do banco remoto, forneça a variável POSTGRES_URL.');
        console.log('\n>>> NENHUMA GRAVAÇÃO FOI EXECUTADA NO SUPABASE OU NO DISCO. <<<\n');
      }

      return;
    }

    // ================================================================
    // SEÇÃO DE EXECUÇÃO REAL (Exclusiva quando --execute é fornecido)
    // ================================================================

    console.log('================================================================');
    console.log('  PROTOCOLO DE CONFIRMAÇÃO INTERATIVA E SEGURANÇA');
    console.log('================================================================\n');

    // 7. Confirmação Obrigatória Digitada Interativamente no Terminal
    console.log('⚠️  ATENÇÃO: OPERAÇÃO DE MIGRAÇÃO DEFINITIVA.');
    console.log(`Para autorizar a gravação, digite exatamente: "${REQUIRED_CONFIRMATION_PHRASE}"\n`);
    
    const enteredPhrase = await promptInteractiveConfirmation('Confirmação do operador: ');

    if (enteredPhrase !== REQUIRED_CONFIRMATION_PHRASE) {
      throw new Error('Confirmação interativa incorreta. Nenhuma alteração foi realizada.');
    }
    console.log('✓ Confirmação interativa do operador validada com sucesso.\n');

    // 8. Backup Externo Obrigatório e Reforçado via process.env.USERPROFILE
    const projectRoot = path.resolve(__dirname, '..');
    const userProfile = process.env.USERPROFILE;
    if (!userProfile) {
      throw new Error('Variável de ambiente USERPROFILE não definida para criação do backup externo.');
    }

    const externalBackupDir = path.resolve(userProfile, 'PowerTech_Backups');

    // Confirmação segura: o destino deve estar fora da pasta do projeto com limites de diretório verificados
    const pathSafety = validateExternalBackupPath(externalBackupDir, projectRoot);
    if (!pathSafety.isValid) {
      throw new Error(`SEGURANÇA DO BACKUP: ${pathSafety.reason}`);
    }

    try {
      if (!fs.existsSync(externalBackupDir)) {
        fs.mkdirSync(externalBackupDir, { recursive: true });
      }
    } catch (err) {
      throw new Error(`Não foi possível criar o diretório de backup externo em: ${externalBackupDir} (${err.message})`);
    }

    const timestampIso = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `Backup_PowerTech_PreMigration_${timestampIso}.json`;
    const backupFilePath = path.join(externalBackupDir, backupFileName);

    console.log(`6. Criando backup independente externo fora do projeto:`);
    console.log(`   Destino: ${backupFilePath}`);
    try {
      fs.writeFileSync(backupFilePath, rawOriginalContent, 'utf8');
    } catch (err) {
      throw new Error(`Falha ao gravar arquivo de backup externo: ${err.message}`);
    }

    // Confirmação de que o arquivo foi efetivamente criado no disco e possui tamanho válido
    if (!fs.existsSync(backupFilePath)) {
      throw new Error(`Falha crítica: Arquivo de backup não encontrado no disco após gravação: ${backupFilePath}`);
    }
    const backupStat = fs.statSync(backupFilePath);
    if (backupStat.size === 0) {
      throw new Error(`Falha crítica: Arquivo de backup criado com 0 bytes em: ${backupFilePath}`);
    }

    // Validação criptográfica do arquivo de backup gerado
    const backupReadContent = fs.readFileSync(backupFilePath, 'utf8');
    const backupSha256 = computeSha256(backupReadContent);

    if (backupSha256 !== initialOriginSha256) {
      throw new Error('Falha na validação do backup externo. O SHA-256 divergiu da base original!');
    }
    console.log(`   ✓ Backup externo verificado: arquivo gravado no disco, tamanho ${(backupStat.size / 1024).toFixed(1)} KB e SHA-256 idêntico ao original.\n`);

    // 9. Proteção Contra Alteração da Origem (Anti-Tampering antes de conectar)
    console.log('7. Verificando integridade da origem antes de conectar...');
    const preConnectSha256 = computeSha256(fs.readFileSync(dbPath, 'utf8'));
    if (preConnectSha256 !== initialOriginSha256) {
      throw new Error('O arquivo original data/database.json foi modificado durante a execução!');
    }
    console.log('   ✓ Arquivo original inalterado.\n');

    // 10. Conexão ao Supabase PostgreSQL com Privacidade e Validação SSL Obrigatória
    const postgresUrl = process.env.POSTGRES_URL;
    if (!postgresUrl) {
      throw new Error('A variável de ambiente POSTGRES_URL não está configurada.');
    }

    console.log('8. Conectando com segurança ao Supabase via PostgreSQL (identificação por URL parser e SSL estrito)...');
    const sslConfig = getSslConfiguration(postgresUrl);
    pool = new Pool({
      connectionString: postgresUrl,
      ssl: sslConfig,
      connectionTimeoutMillis: 10000,
      max: 1
    });

    client = await pool.connect();
    console.log('   ✓ Conexão com o PostgreSQL estabelecida com sucesso.\n');

    // 11. Consulta Prévia Fora da Transação (Validação de Existência)
    console.log('9. Inspecionando estado inicial remoto no Supabase...');
    const preCheck = await client.query(
      'SELECT data, version, updated_at FROM public.system_store WHERE key = $1',
      ['main_database']
    );

    if (!preCheck.rows || preCheck.rows.length === 0) {
      throw new Error("O registro 'main_database' não existe no Supabase. É obrigatório que o registro inicial exista antes da migração.");
    }

    const initialRemoteVersion = Number(preCheck.rows[0].version || 1);
    console.log(`   ✓ Registro encontrado. Versão preliminar: ${initialRemoteVersion}`);
    console.log(`   ✓ Data da última modificação: ${preCheck.rows[0].updated_at}`);

    if (initialRemoteVersion !== 1) {
      if (initialRemoteVersion === 2) {
        throw new Error(
          'O Supabase já se encontra na Versão 2 (migração já realizada anteriormente). ' +
          'Execute em modo --dry-run para verificar a correspondência dos dados. Gravação não permitida.'
        );
      }
      throw new Error(`A versão preliminar no Supabase é ${initialRemoteVersion}, mas a migração exige estritamente a Versão 1.`);
    }

    // 11.1 Validação preliminar da semente remota antes da transação
    const preSeedCheck = verifyIsFactorySeedState(preCheck.rows[0].data, projectInitialData);
    if (!preSeedCheck.isValid) {
      throw new Error(`ABORTADO POR SEGURANÇA: O banco remoto contém dados não-fábrica: ${preSeedCheck.reason}`);
    }
    const preSeedDesc = preSeedCheck.seedType === 'legacy_14'
      ? 'semente legada inicial (14 propriedades vazias)'
      : 'semente de fábrica padrão (18 propriedades vazias)';
    console.log(`   ✓ Banco remoto pré-validado como base inicial de fábrica vazia (${preSeedDesc}).\n`);

    // 11.2 Verificação Criptográfica da Base Local Imediatamente Antes da Transação
    console.log('10. Verificação final de integridade da base local antes da transação...');
    const immediatePreTxContent = fs.readFileSync(dbPath, 'utf8');
    const immediatePreTxSha256 = computeSha256(immediatePreTxContent);

    if (immediatePreTxSha256 !== initialOriginSha256) {
      throw new Error(
        'ABORTADO POR SEGURANÇA: O arquivo local data/database.json foi modificado antes do início da transação! ' +
        'O SHA-256 divergiu daquele validado inicialmente.'
      );
    }

    const immediatePayloadCanonicalHash = computeSha256(canonicalJson(localData));
    const freshParsedCanonicalHash = computeSha256(canonicalJson(JSON.parse(immediatePreTxContent)));
    if (immediatePayloadCanonicalHash !== freshParsedCanonicalHash) {
      throw new Error(
        'ABORTADO POR SEGURANÇA: Divergência entre os dados locais validados em memória e a leitura do disco antes do envio!'
      );
    }
    console.log('   ✓ Integridade da base local confirmada: SHA-256 idêntico ao original validado.\n');

    // 12. Início da Transação Atômica PostgreSQL
    console.log('11. Iniciando TRANSAÇÃO ATÔMICA no PostgreSQL...');
    await client.query('BEGIN');
    inTransaction = true;

    // 12.1 Bloqueio exclusivo de linha (Row-Level Lock) lendo data e version
    console.log('   ✓ Aplicando bloqueio de concorrência (SELECT ... FOR UPDATE)...');
    const lockRes = await client.query(
      'SELECT data, version, updated_at FROM public.system_store WHERE key = $1 FOR UPDATE',
      ['main_database']
    );

    if (!lockRes.rows || lockRes.rows.length === 0) {
      throw new Error("O registro 'main_database' não foi encontrado no Supabase durante o bloqueio!");
    }

    const lockedVersion = Number(lockRes.rows[0].version || 1);
    const lockedData = lockRes.rows[0].data || {};

    if (lockedVersion !== 1) {
      throw new Error(`CONFLITO DE VERSÃO: A versão remota bloqueada é ${lockedVersion} (esperado estritamente: 1).`);
    }

    // 12.2 Verificação integral do estado remoto DENTRO DA TRANSAÇÃO sobre a linha travada
    console.log('   ✓ Executando verificação integral de integridade sobre a linha bloqueada...');
    const inTxCheck = verifyIsFactorySeedState(lockedData, projectInitialData);
    if (!inTxCheck.isValid) {
      throw new Error(`ABORTADO POR SEGURANÇA NA TRANSAÇÃO: Banco remoto rejeitado: ${inTxCheck.reason}`);
    }
    const inTxSeedDesc = inTxCheck.seedType === 'legacy_14'
      ? 'semente legada inicial de 14 propriedades'
      : 'semente de fábrica padrão de 18 propriedades';
    console.log(`   ✓ Linha bloqueada confirmada como base inicial de fábrica sem dados cadastrados (${inTxSeedDesc}).`);

    // 12.3 Atualização Condicional Atômica (Versão 1 -> Versão 2)
    console.log('   ✓ Executando UPDATE condicional atômico (Versão 1 -> Versão 2)...');
    const updateRes = await client.query(
      'UPDATE public.system_store SET data = $1, version = 2, updated_at = NOW() WHERE key = $2 AND version = 1 RETURNING version',
      [JSON.stringify(localData), 'main_database']
    );

    if (updateRes.rowCount !== 1) {
      throw new Error(`Falha na atualização condicional: esperado 1 linha atualizada, obtido ${updateRes.rowCount}.`);
    }
    console.log('   ✓ Linha atualizada com sucesso no PostgreSQL.');

    // 13. Leitura de Retorno e Conferência Criptográfica Completa (SHA-256 Canônico)
    console.log('12. Realizando leitura de retorno para validação criptográfica...');
    const verifyRes = await client.query(
      'SELECT data, version FROM public.system_store WHERE key = $1',
      ['main_database']
    );

    if (!verifyRes.rows || verifyRes.rows.length === 0 || !verifyRes.rows[0].data) {
      throw new Error('Falha na leitura de retorno do Supabase.');
    }

    const savedData = verifyRes.rows[0].data;
    const savedVersion = Number(verifyRes.rows[0].version);

    if (savedVersion !== 2) {
      throw new Error(`Versão confirmada incorreta: ${savedVersion} (esperado: 2).`);
    }

    // Conferência exata das quantidades gravadas
    console.log('    ✓ Conferindo contagens pós-gravação:');
    for (const [moduleName, expectedCount] of Object.entries(EXPECTED_COUNTS)) {
      const actualCount = Array.isArray(savedData[moduleName]) ? savedData[moduleName].length : 0;
      const isMatch = Array.isArray(expectedCount)
        ? expectedCount.includes(actualCount)
        : actualCount === expectedCount;
      if (!isMatch) {
        throw new Error(`Divergência pós-gravação em ${moduleName}: ${actualCount} gravados (esperado: ${expectedCount}).`);
      }
      console.log(`       ✓ ${moduleName}: exatamente ${actualCount} itens confirmados na nuvem.`);
    }

    // Comparação Criptográfica SHA-256 de JSON Canônico
    console.log('    ✓ Comparando SHA-256 canônico da base local vs Supabase...');
    const localCanonicalHash = computeSha256(canonicalJson(localData));
    const remoteCanonicalHash = computeSha256(canonicalJson(savedData));

    if (localCanonicalHash !== remoteCanonicalHash) {
      throw new Error('Falha crítica: O hash canônico dos dados gravados divergiu do original!');
    }
    console.log(`    ✓ Hash canônico conferido com 100% de precisão byte a byte: ${remoteCanonicalHash}`);

    // 14. Confirmação Definitiva da Transação (COMMIT)
    console.log('\n13. Enviando confirmação definitiva da transação (COMMIT)...');
    commitAttempted = true;
    await client.query('COMMIT');
    inTransaction = false;
    isMigrationSuccessful = true;
    console.log('    ✓ TRANSAÇÃO CONFIRMADA (COMMIT) COM SUCESSO!\n');

    const confirmedCustomersCount = Array.isArray(savedData.customers) ? savedData.customers.length : 0;
    const confirmedOsCount = Array.isArray(savedData.workOrders) ? savedData.workOrders.length : 0;
    const confirmedSalesCount = Array.isArray(savedData.sales) ? savedData.sales.length : 0;

    console.log('================================================================');
    console.log('  MIGRAÇÃO CONCLUÍDA COM 100% DE SUCESSO!');
    console.log('  - Versão atualizada no Supabase: 2');
    console.log(`  - ${confirmedCustomersCount} clientes, ${confirmedOsCount} ordens de serviço, ${confirmedSalesCount} vendas e produtos/serviços estão na nuvem.`);
    console.log(`  - Backup externo preservado em: ${backupFileName}`);
    console.log('================================================================\n');

  } catch (err) {
    if (isMigrationSuccessful) {
      // O COMMIT já foi 100% confirmado no banco; qualquer erro aqui é de relatórios pós-gravação
      console.log('\n✓ A MIGRAÇÃO FOI EFETUADA COM SUCESSO NO BANCO DE DADOS (COMMIT CONFIRMADO).');
      console.warn('⚠️  Aviso secundário pós-migração:', err.message);
    } else if (commitAttempted) {
      // Falha durante o envio ou confirmação do COMMIT
      console.error('\n⚠️  ALERTA CRÍTICO: FALHA DE COMUNICAÇÃO DURANTE OU APÓS O ENVIO DO COMMIT!');
      console.error('O comando COMMIT foi enviado ao servidor PostgreSQL, mas a resposta de rede falhou ou expirou.');
      console.error('O ESTADO DO BANCO REMOTO É INDETERMINADO: a transação pode ter sido confirmada no servidor.');
      console.error('NÃO tente executar a gravação novamente.');
      console.error('AÇÃO NECESSÁRIA: Execute uma consulta somente leitura no Supabase para confirmar a versão e o hash:');
      console.error('   node scripts/upload_local_to_supabase.js --dry-run\n');
      process.exitCode = 1;
    } else if (inTransaction && client) {
      // Falha anterior ao COMMIT: tenta executar ROLLBACK
      let rollbackSucceeded = false;
      try {
        await client.query('ROLLBACK');
        rollbackSucceeded = true;
        console.log('   ✓ ROLLBACK executado com sucesso. O banco remoto foi integralmente preservado.');
      } catch (rollbackErr) {
        console.error('❌ ERRO CRÍTICO AO EXECUTAR ROLLBACK:', rollbackErr.message);
      }
      inTransaction = false;

      if (!rollbackSucceeded) {
        console.error('\n⚠️  ALERTA CRÍTICO: O ROLLBACK FALHOU OU NÃO PÔDE SER CONFIRMADO!');
        console.error('O estado do banco remoto é INDETERMINADO. NÃO execute nova gravação.');
        console.error('AÇÃO NECESSÁRIA: Execute uma verificação somente leitura com:');
        console.error('   node scripts/upload_local_to_supabase.js --dry-run\n');
      }
      console.error(`\n❌ ERRO NA OPERAÇÃO: ${err.message}`);
      process.exitCode = 1;
    } else {
      console.error(`\n❌ ERRO NA OPERAÇÃO: ${err.message}`);
      process.exitCode = 1;
    }
  } finally {
    if (client) {
      try {
        client.release();
        console.log('   ✓ Conexão liberada de volta ao pool.');
      } catch (relErr) {
        console.warn('   ⚠️ Aviso ao liberar conexão (client.release):', relErr.message);
        if (!isMigrationSuccessful) {
          process.exitCode = 1;
        }
      }
      client = null;
    }
    if (pool) {
      try {
        await pool.end();
        console.log('   ✓ Pool de conexões encerrado com segurança.');
      } catch (endErr) {
        console.warn('   ⚠️ Aviso ao encerrar pool de conexões (pool.end):', endErr.message);
        if (!isMigrationSuccessful) {
          process.exitCode = 1;
        }
      }
      pool = null;
    }
  }
}

if (require.main === module) {
  main()
    .then(() => {
      if (process.exitCode && process.exitCode !== 0) {
        process.exit(process.exitCode);
      }
    })
    .catch(err => {
      console.error('Erro fatal não tratado:', err.message);
      process.exit(1);
    });
} else {
  module.exports = {
    verifyIsFactorySeedState,
    loadProjectInitialData,
    compareConfigObject,
    canonicalJson,
    computeSha256,
    extractDatabaseHostname,
    isLocalDatabaseHost,
    getSslConfiguration,
    isPathInsideOrEqual,
    validateExternalBackupPath,
    EXPECTED_PROPERTY_TYPES,
    EXPECTED_LEGACY_PROPERTY_TYPES,
    EXPECTED_COUNTS,
    EMPTY_ARRAY_KEYS,
    LEGACY_EMPTY_ARRAY_KEYS
  };
}
