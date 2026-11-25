import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Lock, Eye, EyeOff, AlertTriangle, X, CheckCircle, Loader2 } from 'lucide-react';
import { api, setTempAdminPassword } from '../services/api';

export interface AdminPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  itemDescription?: string;
  actionType?: 'delete' | 'cancel';
  onConfirm: (password: string) => Promise<void> | void;
}

export const AdminPasswordModal: React.FC<AdminPasswordModalProps> = ({
  isOpen,
  onClose,
  title = 'Autorização de Administrador',
  itemDescription = 'este registro',
  actionType = 'delete',
  onConfirm
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(null);
      setIsVerifying(false);
      setShowPassword(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password.trim()) {
      setError('Por favor, digite a senha do administrador.');
      inputRef.current?.focus();
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      // Pré-validação com a API
      await api.verifyAdminPassword(password);
      
      // Define a senha em memória para as requisições subsequentes imediatas
      setTempAdminPassword(password);

      try {
        await onConfirm(password);
        onClose();
      } finally {
        setTempAdminPassword(null);
      }
    } catch (err: any) {
      setTempAdminPassword(null);
      const msg = err.message || 'Senha de administrador incorreta.';
      setError(msg.includes('Senha de administrador incorreta') ? 'Senha de administrador incorreta. Tente novamente.' : msg);
      setIsVerifying(false);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  };

  const isDelete = actionType === 'delete';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Accent Bar */}
        <div className={`h-1.5 w-full ${isDelete ? 'bg-gradient-to-r from-rose-500 via-red-500 to-rose-600' : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600'}`} />

        {/* Header */}
        <div className="p-6 pb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl border ${isDelete ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'}`}>
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                {title}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Ação restrita • Requer confirmação de administrador
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isVerifying}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-sm text-slate-300">
            <p>
              Você está prestes a <span className={`font-semibold ${isDelete ? 'text-rose-400' : 'text-amber-400'}`}>{isDelete ? 'EXCLUIR DEFINITIVAMENTE' : 'CANCELAR'}</span>:
            </p>
            <p className="mt-1 font-medium text-white break-words bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-700/40">
              {itemDescription}
            </p>
            <p className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              Esta operação não poderá ser desfeita.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Senha do Administrador
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isVerifying}
                placeholder="Digite a senha de admin"
                className={`w-full pl-9 pr-10 py-2.5 bg-slate-950 border rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none transition-all normal-case ${
                  error
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                    : 'border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500'
                }`}
                style={{ textTransform: 'none' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && (
              <p className="text-xs text-rose-400 font-medium flex items-center gap-1.5 mt-1.5 animate-in fade-in duration-150">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isVerifying}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-medium transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isVerifying || !password.trim()}
              className={`px-5 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center gap-2 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                isDelete
                  ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-950/50'
                  : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-950/50'
              }`}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validando...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>{isDelete ? 'Confirmar Exclusão' : 'Confirmar Cancelamento'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export function useAdminPasswordModal() {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title?: string;
    itemDescription?: string;
    actionType?: 'delete' | 'cancel';
    onConfirmAction?: (password: string) => Promise<void> | void;
  }>({
    isOpen: false
  });

  const requestConfirmation = ({
    title,
    itemDescription,
    actionType = 'delete',
    onConfirm
  }: {
    title?: string;
    itemDescription: string;
    actionType?: 'delete' | 'cancel';
    onConfirm: (password: string) => Promise<void> | void;
  }) => {
    setModalState({
      isOpen: true,
      title,
      itemDescription,
      actionType,
      onConfirmAction: onConfirm
    });
  };

  const closeModal = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleConfirm = async (password: string) => {
    if (modalState.onConfirmAction) {
      await modalState.onConfirmAction(password);
    }
  };

  return {
    requestConfirmation,
    modalProps: {
      isOpen: modalState.isOpen,
      onClose: closeModal,
      title: modalState.title,
      itemDescription: modalState.itemDescription,
      actionType: modalState.actionType,
      onConfirm: handleConfirm
    }
  };
}
