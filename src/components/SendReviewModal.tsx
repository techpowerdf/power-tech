import React, { useState, useEffect } from 'react';
import {
  Star,
  MessageSquare,
  Phone,
  X,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  User,
  DollarSign,
  Receipt
} from 'lucide-react';
import { Sale, StoreSettings, Customer } from '../types';
import {
  cleanAndFormatPhoneNumber,
  formatSaleReviewCustomMessage,
  sendSaleReviewViaWhatsApp,
  DEFAULT_POS_REVIEW_MESSAGE
} from '../services/whatsapp';

interface SendReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale;
  storeSettings?: StoreSettings;
  customer?: Customer;
}

export const SendReviewModal: React.FC<SendReviewModalProps> = ({
  isOpen,
  onClose,
  sale,
  storeSettings,
  customer
}) => {
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [messageText, setMessageText] = useState<string>('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendSuccess, setSendSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && sale) {
      setPhoneError(null);
      setSendSuccess(false);
      setIsSending(false);

      const initialPhone = sale.customerPhone || customer?.whatsapp || customer?.phone || '';
      setPhoneNumber(initialPhone);

      const generated = formatSaleReviewCustomMessage(sale, storeSettings, customer);
      setMessageText(generated);
    }
  }, [isOpen, sale, storeSettings, customer]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !sale) return null;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneNumber(e.target.value);
    if (phoneError) setPhoneError(null);
  };

  const handleResetMessage = () => {
    const fresh = formatSaleReviewCustomMessage(sale, storeSettings, customer);
    setMessageText(fresh);
  };

  const handleSend = async (preferredMode: 'auto' | 'web' = 'auto') => {
    setPhoneError(null);
    const storeDdd = storeSettings?.phone || storeSettings?.whatsapp || '';
    const cleanPhone = cleanAndFormatPhoneNumber(phoneNumber, storeDdd);

    if (!cleanPhone) {
      setPhoneError('Por favor, informe o número de WhatsApp do cliente com DDD.');
      return;
    }

    let preOpenedWindow: Window | null = null;
    if (preferredMode === 'web') {
      try {
        preOpenedWindow = window.open('about:blank', '_blank');
      } catch (e) {
        console.warn('Não foi possível pré-abrir aba para WhatsApp Web:', e);
      }
    }

    try {
      setIsSending(true);
      await sendSaleReviewViaWhatsApp(
        sale,
        cleanPhone,
        messageText,
        storeSettings,
        customer,
        preferredMode,
        preOpenedWindow
      );
      setSendSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      if (preOpenedWindow && !preOpenedWindow.closed) preOpenedWindow.close();
      setPhoneError(err.message || 'Erro ao preparar envio da mensagem de avaliação.');
    } finally {
      setIsSending(false);
    }
  };

  const clientName = (sale.customerName || customer?.name || 'Cliente').trim();
  const total = Number(sale.total || 0).toFixed(2);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Cabeçalho */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Star className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Enviar Avaliação pelo WhatsApp</span>
                <span className="text-amber-400 text-xs">⭐⭐⭐⭐⭐</span>
              </h2>
              <p className="text-xs text-slate-400">
                Venda #{sale.number} • {clientName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            title="Fechar (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-4 space-y-4">
          {phoneError && (
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <X className="w-4 h-4 shrink-0" />
              <span>{phoneError}</span>
            </div>
          )}

          {sendSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Mensagem de avaliação aberta com sucesso no WhatsApp do cliente!
              </span>
            </div>
          )}

          {/* Resumo da Venda */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="truncate">
                <span className="text-slate-500 block text-[10px]">Cliente</span>
                <strong className="text-white text-xs truncate block">{clientName}</strong>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-300 justify-self-end">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div className="text-right">
                <span className="text-slate-500 block text-[10px]">Total Pago</span>
                <strong className="text-emerald-400 font-mono font-bold text-xs block">R$ {total}</strong>
              </div>
            </div>
          </div>

          {/* Campo de Telefone */}
          <div>
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mb-1.5">
              <Phone className="w-3.5 h-3.5 text-amber-400" />
              <span>WhatsApp do Cliente:</span>
            </label>
            <input
              type="text"
              autoFocus
              placeholder="Ex: (11) 99999-8888 ou 11999998888"
              value={phoneNumber}
              onChange={handlePhoneChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSend('auto');
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              DDD + Número para abrir a conversa diretamente com o cliente.
            </p>
          </div>

          {/* Campo de Edição da Mensagem */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>Mensagem de Avaliação:</span>
              </label>
              <button
                type="button"
                onClick={handleResetMessage}
                title="Recarregar mensagem salva das configurações"
                className="text-[11px] text-slate-400 hover:text-amber-400 inline-flex items-center gap-1 underline transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restaurar mensagem salva</span>
              </button>
            </div>
            <textarea
              rows={7}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Digite a mensagem de avaliação..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none font-sans leading-relaxed resize-y"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Você pode editar o texto acima antes de enviar para este cliente específico ou manter o padrão configurado no sistema.
            </p>
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSending}
              onClick={() => handleSend('web')}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white border border-slate-700 font-semibold text-xs flex items-center gap-1.5 transition active:scale-[0.98] disabled:opacity-50"
              title="Abre a conversa na aba do WhatsApp Web no navegador"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>WhatsApp Web</span>
            </button>

            <button
              type="button"
              disabled={isSending}
              onClick={() => handleSend('auto')}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition active:scale-[0.98] disabled:opacity-50"
              title="Abre o WhatsApp e envia a mensagem de avaliação"
            >
              <Star className="w-4 h-4 fill-slate-950" />
              <span>{isSending ? 'Enviando...' : 'Enviar Avaliação'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
