import React, { useState } from 'react';
import {
  DatabaseBackup,
  ShieldCheck,
  HardDrive,
  Clock,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Calendar,
  Save,
  FileCode
} from 'lucide-react';
import { BackupSettings, BackupHistoryItem } from '../types';

interface BackupViewProps {
  settings: BackupSettings;
  history: BackupHistoryItem[];
  files: Array<{ fileName: string; filePath: string; size: number; mtime: string; type: string }>;
  onRunBackup: (customDest?: string) => Promise<any>;
  onUpdateSettings: (settings: Partial<BackupSettings>) => Promise<void>;
  onRestoreBackup: (filePath: string) => Promise<any>;
}

export const BackupView: React.FC<BackupViewProps> = ({
  settings,
  history,
  files,
  onRunBackup,
  onUpdateSettings,
  onRestoreBackup
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Settings Form
  const [autoDailyBackup, setAutoDailyBackup] = useState<boolean>(settings.autoDailyBackup ?? true);
  const [backupTime, setBackupTime] = useState<string>(settings.backupTime || '18:00');
  const [backupDirectory, setBackupDirectory] = useState<string>(
    settings.backupDirectory || 'C:\\PowerTech_Backups'
  );
  const [retainDays, setRetainDays] = useState<number>(settings.retainDays || 30);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  const handleManualBackup = async () => {
    setIsRunning(true);
    setFeedback(null);
    try {
      const res = await onRunBackup(backupDirectory);
      setFeedback({
        type: 'success',
        message: `Backup realizado com sucesso! Arquivo gerado: ${res.fileName} (${(res.size / 1024).toFixed(1)} KB)`
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Falha ao realizar backup: ${err.message}`
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await onUpdateSettings({
        autoDailyBackup,
        backupTime,
        backupDirectory,
        retainDays
      });
      setFeedback({
        type: 'success',
        message: 'Configurações de rotina de backup salvas com sucesso!'
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Erro ao salvar configurações: ${err.message}`
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleRestore = async (filePath: string, fileName: string) => {
    if (
      confirm(
        `ATENÇÃO: Deseja realmente restaurar os dados do backup "${fileName}"?\n\nOs dados atuais serão substituídos pelo conteúdo deste arquivo. (Uma cópia de segurança preventiva será feita automaticamente antes da restauração).`
      )
    ) {
      try {
        const res = await onRestoreBackup(filePath);
        alert(res.message || 'Sistema restaurado com sucesso! A página será recarregada.');
        window.location.reload();
      } catch (err: any) {
        alert(`Erro na restauração: ${err.message}`);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Principal de Status */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Rotina de Backup Diário Ativa</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  PROTEGIDO
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Seus arquivos de Ordens de Serviço, Vendas, Clientes e Estoque estão seguros e isolados.
              </p>
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>
                  Último backup realizado:{' '}
                  <strong className="text-slate-300">
                    {settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString('pt-BR') : 'Nunca'}
                  </strong>
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleManualBackup}
              disabled={isRunning}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition active:scale-[0.98] disabled:opacity-50"
            >
              <DatabaseBackup className="w-4 h-4" />
              <span>{isRunning ? 'Gerando Cópia...' : 'Fazer Backup Agora'}</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`mt-4 p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}
      </div>

      {/* Grid: Configurações de Backup & Explicações */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário de Configuração (2 colunas) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <HardDrive className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-bold text-white">Configurações de Destino e Agendamento</h3>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoDailyBackup}
                  onChange={(e) => setAutoDailyBackup(e.target.checked)}
                  className="rounded border-slate-700 text-blue-600 focus:ring-0"
                />
                <span className="text-xs font-semibold text-slate-200">
                  Executar backup diário automaticamente ao abrir o sistema
                </span>
              </label>
              <p className="text-[11px] text-slate-500 pl-6">
                Garante que ao menos uma cópia com carimbo de data seja gravada todos os dias.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Pasta de Destino dos Backups no Computador:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={backupDirectory}
                    onChange={(e) => setBackupDirectory(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                    placeholder="C:\PowerTech_Backups"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Dica: Você pode apontar para um <strong>Pen Drive (ex: D:\Backups)</strong> ou pasta do <strong>Google Drive / OneDrive</strong>!
                </p>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Retenção Automática de Cópias (Dias):
                </label>
                <input
                  type="number"
                  min="7"
                  max="365"
                  value={retainDays}
                  onChange={(e) => setRetainDays(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Backups com mais de {retainDays} dias serão limpos automaticamente para não lotar seu HD.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Configurações</span>
              </button>
            </div>
          </form>
        </div>

        {/* Guia de Melhores Práticas */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-blue-400">
            <DatabaseBackup className="w-5 h-5" />
            <h4 className="text-xs font-bold text-white">Recomendações da Informática</h4>
          </div>

          <div className="space-y-2 text-[11px] text-slate-400 leading-relaxed">
            <p>
              <strong className="text-slate-200">1. Regra 3-2-1:</strong> Recomendamos deixar a pasta padrão de backup apontando para uma pasta sincronizada com a nuvem (ex: Google Drive para computador ou OneDrive).
            </p>
            <p>
              <strong className="text-slate-200">2. Pen Drive Semanal:</strong> Ao final da semana de trabalho, você pode clicar em "Fazer Backup Agora" e salvar uma cópia em um Pen Drive externo.
            </p>
            <p>
              <strong className="text-slate-200">3. Em caso de Formatação:</strong> Basta copiar a pasta de backups para o novo Windows e usar o botão "Restaurar" para trazer todos os clientes, OS e vendas de volta instantaneamente!
            </p>
          </div>
        </div>
      </div>

      {/* Histórico e Arquivos Físicos de Backup */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white">
              Arquivos de Backup Encontrados no Disco ({files.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Destino: {settings.backupDirectory}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] font-bold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Nome do Arquivo</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Tamanho</th>
                <th className="py-3 px-4">Data da Cópia</th>
                <th className="py-3 px-4 text-center">Restauração</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {files.map((file, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 font-mono text-[11px] text-white flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{file.fileName}</span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        file.type === 'automatico'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      }`}
                    >
                      {file.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                    {(file.size / 1024).toFixed(1)} KB
                  </td>
                  <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                    {new Date(file.mtime).toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <button
                      onClick={() => handleRestore(file.filePath, file.fileName)}
                      className="px-3 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[11px] font-bold border border-amber-500/30 transition flex items-center gap-1.5 mx-auto"
                      title="Restaurar o sistema para esta data"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restaurar Esta Cópia</span>
                    </button>
                  </td>
                </tr>
              ))}
              {files.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Nenhum arquivo de backup gerado na pasta configurada ainda. Clique em "Fazer Backup Agora".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
