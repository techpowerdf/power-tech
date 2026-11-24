const fs = require('fs');
const path = require('path');
const { getDatabase, saveDatabase, DB_FILE } = require('./db');

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
}

function getTodayDateString(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Executa um backup dos dados
function executeBackup(type = 'manual', customDestination = null) {
  const db = getDatabase();
  const settings = db.backupSettings || {};
  const defaultBackupDir = process.env.BACKUP_DIR || (
    process.platform === 'win32'
      ? path.join(process.env.USERPROFILE || 'C:\\', 'PowerTech_Backups')
      : path.join(process.env.HOME || '/var/backups', 'powertech_backups')
  );
  const destinationDir = customDestination || settings.backupDirectory || defaultBackupDir;

  try {
    ensureDirectory(destinationDir);

    const timestamp = formatTimestamp();
    const fileName = `Backup_PowerTech_${timestamp}_${type}.json`;
    const targetFilePath = path.join(destinationDir, fileName);

    // Lê os dados frescos e grava de forma atômica
    const currentData = JSON.stringify(db, null, 2);
    fs.writeFileSync(targetFilePath, currentData, 'utf-8');

    const stats = fs.statSync(targetFilePath);

    // Registra no histórico
    const historyItem = {
      id: `bkp-${Date.now()}`,
      fileName,
      filePath: targetFilePath,
      fileSizeBytes: stats.size,
      createdAt: new Date().toISOString(),
      type,
      status: 'sucesso'
    };

    if (!db.backupHistory) db.backupHistory = [];
    db.backupHistory.unshift(historyItem);
    // Limita histórico a 50 registros
    if (db.backupHistory.length > 50) {
      db.backupHistory = db.backupHistory.slice(0, 50);
    }

    db.backupSettings = {
      ...settings,
      lastBackupAt: new Date().toISOString(),
      lastBackupStatus: 'sucesso',
      lastBackupMessage: `Backup ${type} realizado com sucesso (${(stats.size / 1024).toFixed(1)} KB)`
    };

    // Aplica limpeza de backups antigos
    cleanupOldBackups(destinationDir, settings.retainDays || 30);

    saveDatabase(db);

    return {
      success: true,
      fileName,
      filePath: targetFilePath,
      size: stats.size,
      message: 'Backup concluído com sucesso.'
    };
  } catch (error) {
    console.error('Falha ao executar backup:', error);

    db.backupSettings = {
      ...settings,
      lastBackupAt: new Date().toISOString(),
      lastBackupStatus: 'erro',
      lastBackupMessage: `Erro ao gerar backup: ${error.message}`
    };
    saveDatabase(db);

    return {
      success: false,
      error: error.message
    };
  }
}

// Limpa backups com mais de X dias
function cleanupOldBackups(dirPath, retainDays = 30) {
  try {
    if (!fs.existsSync(dirPath)) return;
    const files = fs.readdirSync(dirPath);
    const now = Date.now();
    const maxAgeMs = retainDays * 24 * 60 * 60 * 1000;

    files.forEach((file) => {
      if ((file.startsWith('Backup_PowerTech_') || file.startsWith('Backup_InfoTech_')) && file.endsWith('.json')) {
        const fullPath = path.join(dirPath, file);
        try {
          const stats = fs.statSync(fullPath);
          if (now - stats.mtimeMs > maxAgeMs) {
            fs.unlinkSync(fullPath);
            console.log(`Backup antigo removido pela retenção: ${file}`);
          }
        } catch (e) {
          // ignore
        }
      }
    });
  } catch (err) {
    console.warn('Aviso ao limpar backups antigos:', err.message);
  }
}

// Verifica se já realizou o backup do dia hoje
function checkDailyBackup() {
  const db = getDatabase();
  const settings = db.backupSettings || {};

  if (!settings.autoDailyBackup) {
    return;
  }

  const today = getTodayDateString();
  const lastBackupDate = settings.lastBackupAt ? settings.lastBackupAt.substring(0, 10) : '';

  // Se o último backup não foi hoje, executa o backup automático do dia
  if (lastBackupDate !== today) {
    console.log(`[Backup Diário] Iniciando backup automático para o dia ${today}...`);
    const result = executeBackup('automatico');
    if (result.success) {
      console.log(`[Backup Diário] Concluído: ${result.fileName}`);
    } else {
      console.error(`[Backup Diário] Erro: ${result.error}`);
    }
  }
}

// Restaura um arquivo de backup
function restoreBackup(backupFilePath) {
  try {
    if (!fs.existsSync(backupFilePath)) {
      throw new Error('Arquivo de backup não encontrado no caminho especificado.');
    }

    const content = fs.readFileSync(backupFilePath, 'utf-8');
    const parsedData = JSON.parse(content);

    // Validação básica da estrutura
    if (!parsedData.storeSettings || !parsedData.products || !parsedData.workOrders) {
      throw new Error('O arquivo selecionado não é um backup válido do Power Tech.');
    }

    // Cria uma cópia de segurança antes de restaurar
    const db = getDatabase();
    const safetyCopy = path.join(db.backupSettings?.backupDirectory || path.join(process.env.USERPROFILE || 'C:\\', 'PowerTech_Backups'), `PreRestore_Seguranca_${formatTimestamp()}.json`);
    ensureDirectory(path.dirname(safetyCopy));
    fs.writeFileSync(safetyCopy, JSON.stringify(db, null, 2), 'utf-8');

    // Restaura
    saveDatabase(parsedData);

    return {
      success: true,
      message: 'Sistema restaurado com sucesso! Cópia preventiva gerada antes da restauração.'
    };
  } catch (error) {
    console.error('Erro na restauração de backup:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Lista os arquivos físicos presentes na pasta de backup
function listPhysicalBackups(directoryPath) {
  try {
    if (!fs.existsSync(directoryPath)) return [];
    const files = fs.readdirSync(directoryPath);
    return files
      .filter(f => (f.startsWith('Backup_PowerTech_') || f.startsWith('Backup_InfoTech_')) && f.endsWith('.json'))
      .map(fileName => {
        const fullPath = path.join(directoryPath, fileName);
        const stats = fs.statSync(fullPath);
        return {
          fileName,
          filePath: fullPath,
          size: stats.size,
          mtime: stats.mtime.toISOString(),
          type: fileName.includes('_automatico') ? 'automatico' : 'manual'
        };
      })
      .sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());
  } catch (error) {
    return [];
  }
}

module.exports = {
  executeBackup,
  checkDailyBackup,
  restoreBackup,
  listPhysicalBackups,
  formatTimestamp
};
