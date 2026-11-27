import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  FileDown,
  Phone,
  X,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Receipt,
  User,
  DollarSign
} from 'lucide-react';
import { Sale, WorkOrder, StoreSettings, Customer } from '../types';
import { api } from '../services/api';
import {
  openWhatsAppWithText,
  formatSaleReceiptWhatsAppMessage,
  formatWorkOrderWhatsAppMessage,
  formatWorkOrderReadyCustomMessage,
  formatSaleReceiptCustomMessage,
  formatWorkOrderDeliveredCustomMessage,
  cleanAndFormatPhoneNumber,
  sendSaleReceiptViaWhatsApp,
  sendWorkOrderViaWhatsApp,
  triggerPdfDownload,
  savePdfWithLocationPicker
} from '../services/whatsapp';
import { generateWorkOrderPdfBlob, triggerBlobDownload } from '../utils/pdfGenerator';

interface SendWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  type?: 'sale' | 'os';
  sale?: Sale | null;
  workOrder?: WorkOrder | null;
  storeSettings?: StoreSettings;
  customer?: Customer;
  onDownloadPDF?: () => void;
}

export const SendWhatsAppModal: React.FC<SendWhatsAppModalProps> = ({
  isOpen,
  onClose,
  type = 'sale',
  sale,
  workOrder,
  storeSettings,
  customer,
  onDownloadPDF
}) => {
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [downloadedPdf, setDownloadedPdf] = useState<boolean>(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendSuccess, setSendSuccess] = useState<boolean>(false);
  const [includeTextMessage, setIncludeTextMessage] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setDownloadedPdf(false);
      setPhoneError(null);
      setSendSuccess(false);
      setIsSending(false);
      setIncludeTextMessage(false);
      let initialPhone = '';
      if (type === 'sale' && sale) {
        initialPhone = sale.customerPhone || customer?.whatsapp || customer?.phone || '';
      } else if (type === 'os' && workOrder) {
        initialPhone = workOrder.customerPhone || '';
      }
      setPhoneNumber(initialPhone);
    }
  }, [isOpen, type, sale, workOrder, customer]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPhoneNumber(val);
    if (phoneError) setPhoneError(null);
  };

  const handleTriggerDownloadPDF = async () => {
    if (type === 'sale' && sale) {
      const token = sale.receiptToken || (sale.number ? String(sale.number) : sale.id);
      const pdfUrl = `/api/public/sales/receipt/${encodeURIComponent(token)}/pdf`;
      const clientName = (sale.customerName || 'Cliente').trim().replace(/[\\/:*?"<>|]/g, '_');
      const filename = `Recibo ${sale.number || '0'} - ${clientName}.pdf`;
      const saved = await savePdfWithLocationPicker(pdfUrl, filename);
      if (saved) setDownloadedPdf(true);
      return;
    }

    if (type === 'os' && workOrder) {
      const { blob, filename } = await generateWorkOrderPdfBlob(workOrder, null, storeSettings);
      triggerBlobDownload(blob, filename);
      setDownloadedPdf(true);
      return;
    }

    if (onDownloadPDF) {
      onDownloadPDF();
      setDownloadedPdf(true);
    }
  };

  const handleSendWhatsApp = async (preferredMode: 'auto' | 'web' | 'desktop' = 'auto') => {
    setPhoneError(null);
    const storeDdd = storeSettings?.phone || storeSettings?.whatsapp || '';
    const cleanPhone = cleanAndFormatPhoneNumber(phoneNumber, storeDdd);

    if (!cleanPhone && (type === 'sale' || type === 'os')) {
      setPhoneError('Por favor, informe o número de telefone com DDD para abrir a conversa.');
      return;
    }

    // Se preferir Web, abre a aba imediatamente no momento do clique do usuário para contornar bloqueador de pop-ups
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

      const onlyPdf = !includeTextMessage;

      if (type === 'sale' && sale) {
        await sendSaleReceiptViaWhatsApp(sale, cleanPhone, storeSettings, customer, preferredMode, preOpenedWindow, onlyPdf);
        setSendSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2200);
        return;
      }

      if (type === 'os' && workOrder) {
        if (cleanPhone && cleanPhone !== workOrder.customerPhone) {
          try {
            await api.updateWorkOrder(workOrder.id, { customerPhone: cleanPhone });
            workOrder.customerPhone = cleanPhone;
          } catch (e) {
            console.warn('Erro ao atualizar telefone na OS:', e);
          }
        }
        const res = await sendWorkOrderViaWhatsApp(
          workOrder,
          cleanPhone,
          storeSettings,
          customer,
          preferredMode,
          preOpenedWindow,
          true
        );
        if (res.success) {
          setSendSuccess(true);
          setTimeout(() => {
            onClose();
          }, 2400);
        } else if (res.mode === 'error') {
          setPhoneError(res.error || 'Erro ao preparar envio pelo WhatsApp.');
        }
        return;
      }

      openWhatsAppWithText(cleanPhone || undefined, '', false);
      setSendSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      if (preOpenedWindow && !preOpenedWindow.closed) preOpenedWindow.close();
      setPhoneError(err.message || 'Erro ao preparar envio pelo WhatsApp.');
    } finally {
      setIsSending(false);
    }
  };

  const targetTitle = type === 'sale' ? 'Comprovante / Recibo de Venda' : 'Ordem de Serviço';
  const targetNumber = type === 'sale' ? sale?.number : workOrder?.number;
  const targetClient =
    type === 'sale'
      ? sale?.customerName || customer?.name || 'Consumidor Final'
      : workOrder?.customerName || 'Cliente';
  const targetTotal = type === 'sale' ? Number(sale?.total || 0) : Number(workOrder?.total || 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Cabeçalho */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                {type === 'sale' ? 'Enviar Recibo via WhatsApp' : 'Enviar Ordem de Serviço via WhatsApp'}
              </h2>
              <p className="text-xs text-slate-400">
                {targetTitle} #{targetNumber}
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
                Conversa aberta no WhatsApp e PDF da OS baixado com sucesso! Basta anexar o arquivo na conversa para enviar ao cliente.
              </span>
            </div>
          )}

          {/* Card Resumo do Documento */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-slate-400">
              <span>Cliente:</span>
              <strong className="text-slate-200">{targetClient}</strong>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Total da Operação:</span>
              <strong className="text-emerald-400 font-bold font-mono text-sm">
                R$ {targetTotal.toFixed(2)}
              </strong>
            </div>
          </div>

          {/* Campo de Telefone */}
          <div>
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mb-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Número do WhatsApp do Destinatário:</span>
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
                  handleSendWhatsApp('auto');
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Informe o DDD + número do cliente para abrir a conversa diretamente.
            </p>
          </div>

          {/* Dica para Envio do PDF */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-500/20 text-[11px] text-slate-300 flex items-start gap-2.5">
            <span className="text-emerald-400 text-base leading-none">📄</span>
            <div className="space-y-0.5">
              <strong className="text-white">Envio da Ordem de Serviço com PDF:</strong>
              <p className="text-slate-400 leading-relaxed">
                Ao clicar no botão de envio, o sistema baixa o arquivo PDF da {type === 'sale' ? 'venda' : 'Ordem de Serviço'} e abre a conversa do cliente no WhatsApp com a mensagem pré-formatada, orientando o anexo do documento.
              </p>
            </div>
          </div>

          {/* Opção para incluir texto caso o lojista queira */}
          {((type === 'os' && ((workOrder?.status === 'concluida' && storeSettings?.osReadyMessageEnabled) || (workOrder?.status === 'entregue' && storeSettings?.osDeliveredMessageEnabled))) ||
            (type === 'sale' && storeSettings?.posSaleMessageEnabled)) && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:bg-slate-900 transition">
                <input
                  type="checkbox"
                  checked={includeTextMessage}
                  onChange={(e) => setIncludeTextMessage(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-0 bg-slate-900"
                />
                <span className="text-xs text-slate-300 font-medium">
                  Incluir mensagem de texto personalizada junto com o PDF
                </span>
              </label>

              {includeTextMessage && type === 'sale' && sale && storeSettings?.posSaleMessageEnabled && (
                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Mensagem Pós-Venda Ativa (Será enviada junto):</span>
                  </div>
                  <p className="text-slate-300 text-[11px] bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 whitespace-pre-line leading-relaxed font-sans">
                    {formatSaleReceiptCustomMessage(sale, storeSettings, customer || undefined)}
                  </p>
                </div>
              )}

              {includeTextMessage && type === 'os' && workOrder && workOrder.status === 'concluida' && (
                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Mensagem de Pronto para Retirada (Será enviada junto):</span>
                  </div>
                  <p className="text-slate-300 text-[11px] bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 whitespace-pre-line leading-relaxed font-sans">
                    {formatWorkOrderReadyCustomMessage(workOrder, storeSettings)}
                  </p>
                </div>
              )}

              {includeTextMessage && type === 'os' && workOrder && workOrder.status === 'entregue' && storeSettings?.osDeliveredMessageEnabled && (
                <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/30 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 text-blue-400 font-bold text-[11px]">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Mensagem de Entrega Ativa (Será enviada junto):</span>
                  </div>
                  <p className="text-slate-300 text-[11px] bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 whitespace-pre-line leading-relaxed font-sans">
                    {formatWorkOrderDeliveredCustomMessage(workOrder, storeSettings)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Opção de Salvar / Baixar o PDF */}
          {(onDownloadPDF || (type === 'os' && (workOrder?.trackingToken || workOrder?.id)) || (type === 'sale' && (sale?.receiptToken || sale?.id))) && (
            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
              <div className="flex items-start gap-2">
                <FileDown className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <strong className="text-emerald-300">Salvar Arquivo Físico em PDF:</strong>
                  <p className="text-slate-400 mt-0.5 leading-relaxed text-[11px]">
                    Escolha a pasta ou diretório do seu computador onde deseja salvar o documento.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTriggerDownloadPDF}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 border border-slate-700"
              >
                <FileDown className="w-3.5 h-3.5 text-emerald-400" />
                <span>{downloadedPdf ? 'PDF Salvo no Local Escolhido ✓' : 'Salvar como PDF (Escolher Local)'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            Fechar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSending}
              onClick={() => handleSendWhatsApp('web')}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-white border border-slate-700 font-semibold text-xs flex items-center gap-1.5 transition active:scale-[0.98] disabled:opacity-50"
              title="Abre a conversa na aba do WhatsApp Web no navegador"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>WhatsApp Web</span>
            </button>

            <button
              type="button"
              disabled={isSending}
              onClick={() => handleSendWhatsApp('auto')}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition active:scale-[0.98] disabled:opacity-50"
              title="Abre a conversa e envia apenas o arquivo PDF da Ordem de Serviço"
            >
              <MessageSquare className="w-4 h-4" />
              <span>{isSending ? 'Enviando PDF...' : (includeTextMessage ? 'Enviar WhatsApp (PDF + Texto)' : 'Enviar WhatsApp (Apenas PDF)')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
