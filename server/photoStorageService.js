/**
 * Servidor de Armazenamento Seguro de Fotografias de Ordens de Serviço
 * Power Tech Gestão - Módulo de Fotos de Equipamentos
 * 
 * Suporta dois modos transparentes de operação:
 * 1. Supabase Storage (Produção / Vercel):
 *    - Bucket PRIVADO 'work-order-photos' (public: false)
 *    - URLs assinadas temporárias com expiração de 1 hora (3600s)
 *    - Acesso autenticado via SUPABASE_SERVICE_ROLE_KEY
 * 2. Armazenamento Local Seguro (Contingência / Desenvolvimento):
 *    - Diretório seguro em data/uploads/photos/os-{id}/
 *    - Streaming autenticado via endpoint interno com verificação de JWT
 *    - Bloqueio estrito de acesso sem autenticação
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { isSupabaseConfigured, getSupabaseClient } = require('./supabaseService');
const { DATA_DIR } = require('./db');

const BUCKET_NAME = 'work-order-photos';
const LOCAL_PHOTOS_DIR = path.join(DATA_DIR, 'uploads', 'photos');

// Flag de simulação para testes automatizados controlados
let simulatedStorageFailure = false;
let simulatedErrorMessage = 'Falha simulada no serviço de armazenamento remoto.';

function setStorageFailureSimulation(enabled, customMessage) {
  simulatedStorageFailure = Boolean(enabled);
  if (customMessage) {
    simulatedErrorMessage = String(customMessage);
  }
}

/**
 * Sanitiza mensagens de erro para evitar qualquer vazamento de credenciais,
 * tokens JWT, chaves de serviço ou parâmetros sensíveis de query/URL.
 */
function sanitizeErrorMessage(rawMessage) {
  if (!rawMessage) return 'Erro desconhecido';
  let clean = String(rawMessage);

  // Remove JWTs (padrão eyJ...)
  clean = clean.replace(/eyJ[a-zA-Z0-9_\-\.]+/g, '[TOKEN_REDACTED]');

  // Remove Bearer tokens
  clean = clean.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [TOKEN_REDACTED]');

  // Remove parâmetros com apiKey, key, token, secret, password
  clean = clean.replace(/(?:apikey|key|token|secret|password|auth)=([^&\s]+)/gi, '$1=[REDACTED]');

  // Remove credenciais e URLs de banco / supabase
  clean = clean.replace(/postgres(?:ql)?:\/\/[^@\s]+@[^\s]+/gi, 'postgresql://[REDACTED_DB_URL]');
  clean = clean.replace(/https:\/\/[a-z0-9_-]+\.supabase\.co[^\s]*/gi, 'https://[SUPABASE_HOST]');

  // Limita tamanho para não sobrecarregar logs nem o banco de dados
  return clean.slice(0, 300).trim();
}

// Garante que o diretório local exista para modo de contingência
try {
  if (!fs.existsSync(LOCAL_PHOTOS_DIR)) {
    fs.mkdirSync(LOCAL_PHOTOS_DIR, { recursive: true });
  }
} catch (e) {
  // Ignora se não puder criar imediatamente
}

const VALID_STAGES = ['entrada', 'reparo', 'conclusao'];

function sanitizeFileName(fileName) {
  const safeBase = path.basename(fileName || 'foto.jpg');
  return safeBase.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getOsFolder(workOrderId) {
  const str = String(workOrderId || '').trim();
  const safeId = str.replace(/[^a-zA-Z0-9_-]/g, '');
  return safeId.startsWith('os-') ? safeId : `os-${safeId}`;
}

/**
 * Salva o arquivo de fotografia no storage (Supabase ou Disco Local)
 */
async function savePhotoFile({ workOrderId, stage, fileName, mimeType, buffer, username }) {
  if (!workOrderId) {
    throw new Error('ID da Ordem de Serviço é obrigatório.');
  }

  const normalizedStage = VALID_STAGES.includes(stage) ? stage : 'entrada';
  const cleanName = sanitizeFileName(fileName);
  const rawExt = (path.extname(cleanName) || '.jpg').toLowerCase();
  const safeExt = rawExt === '.jpeg' ? '.jpg' : rawExt;
  const photoId = `photo-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const storageFileName = `${normalizedStage}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}${safeExt}`;
  const osFolder = getOsFolder(workOrderId);
  
  // Caminho estritamente relativo, padronizado com forward slashes, sem barra no início e sem barras duplas
  const storagePath = `${osFolder}/${storageFileName}`
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/')
    .trim();
  const effectiveMime = mimeType || 'image/jpeg';

  let savedInCloud = false;

  // 1. Em ambiente Vercel ou quando Supabase estiver configurado: utiliza EXCLUSIVAMENTE Supabase Storage
  if (isSupabaseConfigured() || process.env.VERCEL) {
    const supabase = getSupabaseClient();
    if (!supabase || !supabase.storage) {
      throw new Error('Supabase Storage não inicializado ou indisponível no ambiente de produção.');
    }

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: effectiveMime,
        upsert: true
      });

    if (uploadErr) {
      if (uploadErr.message && (uploadErr.message.includes('not found') || uploadErr.message.includes('Bucket'))) {
        throw new Error(
          `O bucket '${BUCKET_NAME}' não foi encontrado no projeto Supabase. Por favor, configure o bucket como PRIVADO (public: false) no painel do Supabase antes de realizar uploads.`
        );
      }
      throw new Error(`Falha no envio da fotografia para o Supabase Storage: ${uploadErr.message}`);
    }

    savedInCloud = true;
  } else {
    // 2. Modo de contingência: EXCLUSIVAMENTE para desenvolvimento local em disco
    if (process.env.VERCEL) {
      throw new Error('Ambiente Vercel detectado: o uso de armazenamento em disco local é proibido em ambiente serverless.');
    }

    const osLocalDir = path.join(LOCAL_PHOTOS_DIR, osFolder);
    try {
      if (!fs.existsSync(osLocalDir)) {
        fs.mkdirSync(osLocalDir, { recursive: true });
      }
      const localFilePath = path.join(osLocalDir, storageFileName);
      fs.writeFileSync(localFilePath, buffer);
    } catch (fsErr) {
      throw new Error(`Falha ao salvar fotografia no disco local: ${fsErr.message}`);
    }
  }

  const metadata = {
    id: photoId,
    workOrderId: String(workOrderId),
    stage: normalizedStage,
    fileName: cleanName,
    storagePath,
    sizeBytes: buffer.length,
    mimeType: effectiveMime,
    createdAt: new Date().toISOString(),
    createdBy: username || 'sistema'
  };

  return metadata;
}

/**
 * Gera URL segura para visualização da foto
 * - Supabase: URL assinada temporária (3600 segundos = 1 hora)
 * - Local: Rota autenticada de contingência do backend
 */
async function resolvePhotoUrl(photo, reqBaseUrl = '') {
  if (!photo || !photo.storagePath) return null;

  if (isSupabaseConfigured() || process.env.VERCEL) {
    const supabase = getSupabaseClient();
    if (!supabase || !supabase.storage) {
      throw new Error('Supabase Storage não inicializado no ambiente de produção.');
    }

    const cleanPath = String(photo.storagePath || '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/+/g, '/')
      .trim();

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(cleanPath, 3600); // 1 hora de validade temporária

    if (error || !data || !data.signedUrl) {
      throw new Error(`Falha ao gerar URL temporária assinada no Supabase Storage: ${error ? error.message : 'URL não retornada'}`);
    }

    return data.signedUrl;
  }

  // Fallback local: Exclusivamente para ambiente de desenvolvimento local
  return `${reqBaseUrl}/api/work-orders/${photo.workOrderId}/photos/${photo.id}/file`;
}

/**
 * Remove a foto do storage (Supabase ou Disco Local) de forma idempotente e segura.
 * Retorna { success: boolean, notFound?: boolean, error?: string }
 */
async function deletePhotoFile(photoOrTarget) {
  if (!photoOrTarget) return { success: false, error: 'Identificador do arquivo não fornecido.' };

  const rawStoragePath = typeof photoOrTarget === 'string' ? photoOrTarget : photoOrTarget?.storagePath;
  if (!rawStoragePath) {
    return { success: false, error: 'Caminho de armazenamento (storagePath) não informado.' };
  }

  const storagePath = String(rawStoragePath)
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/')
    .trim();

  const workOrderId = photoOrTarget?.workOrderId || (storagePath ? storagePath.split('/')[0] : null);

  // Intercepta simulação de falha controlada (para testes automatizados)
  if (simulatedStorageFailure) {
    return {
      success: false,
      error: sanitizeErrorMessage(simulatedErrorMessage)
    };
  }

  // 1. Remove do Supabase Storage em produção
  if (isSupabaseConfigured() || process.env.VERCEL) {
    const supabase = getSupabaseClient();
    if (supabase && supabase.storage) {
      const { error } = await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
      if (error) {
        const errMsg = error.message || '';
        // Idempotência estrita: se o arquivo já não existir (404/not found), considera concluído com sucesso
        if (errMsg.toLowerCase().includes('not found') || errMsg.includes('404')) {
          return { success: true, notFound: true };
        }
        console.warn('[PhotoStorage] Aviso ao remover do Supabase Storage:', sanitizeErrorMessage(errMsg));
        return {
          success: false,
          error: sanitizeErrorMessage(errMsg)
        };
      }
    }
    return { success: true };
  }

  // 2. Remove do disco local em desenvolvimento
  try {
    const osFolder = getOsFolder(workOrderId);
    const localFilePath = path.join(LOCAL_PHOTOS_DIR, osFolder, path.basename(storagePath));
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
      return { success: true };
    }
    // Idempotência estrita: se o arquivo local já não existe, considera concluído com sucesso
    return { success: true, notFound: true };
  } catch (fsErr) {
    const errMsg = sanitizeErrorMessage(fsErr.message);
    console.warn('[PhotoStorage] Falha ao remover arquivo local:', errMsg);
    return {
      success: false,
      error: errMsg
    };
  }
}

/**
 * Adiciona uma fotografia à fila de exclusão recuperável (Outbox Pattern)
 */
function addPendingDeletion({ db, photo, workOrderId, username, initialError }) {
  if (!db) throw new Error('Objeto do banco de dados (db) é obrigatório.');
  if (!db.pendingPhotoDeletions) {
    db.pendingPhotoDeletions = [];
  }

  const storagePath = photo?.storagePath || '';
  const photoId = photo?.id || `photo-${Date.now()}`;
  const effectiveWorkOrderId = String(workOrderId || photo?.workOrderId || '');

  // Evita duplicatas se o mesmo storagePath ou photoId já estiver na fila
  const existingIndex = db.pendingPhotoDeletions.findIndex(
    item => item.photoId === photoId || (storagePath && item.storagePath === storagePath)
  );

  const pendingItem = {
    id: existingIndex >= 0 
      ? db.pendingPhotoDeletions[existingIndex].id 
      : `del-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    photoId,
    workOrderId: effectiveWorkOrderId,
    storagePath,
    fileName: photo?.fileName || path.basename(storagePath),
    stage: photo?.stage || 'entrada',
    requestedAt: new Date().toISOString(),
    requestedBy: username || 'sistema',
    status: initialError ? 'failed' : 'pending',
    attempts: initialError ? 1 : 0,
    lastAttemptAt: initialError ? new Date().toISOString() : null,
    lastError: initialError ? sanitizeErrorMessage(initialError) : null
  };

  if (existingIndex >= 0) {
    db.pendingPhotoDeletions[existingIndex] = pendingItem;
  } else {
    db.pendingPhotoDeletions.push(pendingItem);
  }

  return pendingItem;
}

/**
 * Remove um item da fila de pendências
 */
function removePendingDeletion(db, identifier) {
  if (!db || !Array.isArray(db.pendingPhotoDeletions) || !identifier) return false;
  const initialLen = db.pendingPhotoDeletions.length;
  db.pendingPhotoDeletions = db.pendingPhotoDeletions.filter(
    item => item.id !== identifier && item.photoId !== identifier && item.storagePath !== identifier
  );
  return db.pendingPhotoDeletions.length < initialLen;
}

/**
 * Consulta a lista de fotografias com exclusão pendente
 */
function getPendingDeletions(db) {
  if (!db || !Array.isArray(db.pendingPhotoDeletions)) return [];
  return db.pendingPhotoDeletions;
}

/**
 * Reprocessa itens pendentes de exclusão (idempotente e recuperável)
 */
async function processPendingDeletions(db, options = {}) {
  if (!db || !Array.isArray(db.pendingPhotoDeletions) || db.pendingPhotoDeletions.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, remaining: 0 };
  }

  const limit = options.limit && options.limit > 0 ? options.limit : db.pendingPhotoDeletions.length;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  // Cópia dos itens a serem processados
  const queueToProcess = [...db.pendingPhotoDeletions].slice(0, limit);

  for (const item of queueToProcess) {
    processed++;
    try {
      const result = await deletePhotoFile(item);
      if (result.success) {
        removePendingDeletion(db, item.id);
        succeeded++;
      } else {
        item.status = 'failed';
        item.attempts = (item.attempts || 0) + 1;
        item.lastAttemptAt = new Date().toISOString();
        item.lastError = sanitizeErrorMessage(result.error || 'Erro ao remover arquivo.');
        failed++;
      }
    } catch (err) {
      item.status = 'failed';
      item.attempts = (item.attempts || 0) + 1;
      item.lastAttemptAt = new Date().toISOString();
      item.lastError = sanitizeErrorMessage(err.message || 'Exceção ao processar exclusão.');
      failed++;
    }
  }

  return {
    processed,
    succeeded,
    failed,
    remaining: db.pendingPhotoDeletions.length
  };
}

/**
 * Obtém o caminho do arquivo local para streaming autenticado
 */
function getLocalPhotoPath(workOrderId, photo) {
  if (!photo || !photo.storagePath) return null;
  const fileName = path.basename(photo.storagePath);
  const osFolder = getOsFolder(workOrderId);
  
  // Tenta tanto na pasta osFolder quanto direto pelo storagePath
  const directPath = path.resolve(LOCAL_PHOTOS_DIR, osFolder, fileName);
  if (fs.existsSync(directPath)) {
    return directPath;
  }
  
  // Fallback para qualquer variação de prefixo os-
  const legacyPath = path.resolve(LOCAL_PHOTOS_DIR, `os-${workOrderId}`, fileName);
  if (fs.existsSync(legacyPath)) {
    return legacyPath;
  }
  
  return null;
}

module.exports = {
  BUCKET_NAME,
  savePhotoFile,
  resolvePhotoUrl,
  deletePhotoFile,
  getLocalPhotoPath,
  sanitizeErrorMessage,
  addPendingDeletion,
  removePendingDeletion,
  getPendingDeletions,
  processPendingDeletions,
  setStorageFailureSimulation,
  VALID_STAGES
};
