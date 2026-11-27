import React, { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { Printer, X, Scissors, Copy, CheckCircle2, FileDown, Loader2, Minimize2, Maximize2 } from 'lucide-react';
import { WorkOrder, Sale, Quote, StoreSettings, Customer } from '../types';
import { SaleReceiptDocument } from './SaleReceiptDocument';
import {
  computeAggregateWarrantyDays,
  formatDynamicWarrantyTerms,
  formatWarrantyLabel
} from '../utils/warrantyHelpers';
import {
  openWhatsAppWithText,
  formatWorkOrderWhatsAppMessage,
  formatWorkOrderReadyWhatsAppMessage,
  formatSaleReceiptWhatsAppMessage,
  formatQuoteWhatsAppMessage,
  sendSaleReceiptViaWhatsApp,
  sendWorkOrderViaWhatsApp,
  savePdfWithLocationPicker
} from '../services/whatsapp';
import { generateAndSavePdf } from '../utils/pdfGenerator';

const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.41a8.17 8.17 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.59c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.4-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.12-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.12.17 1.78 2.72 4.31 3.81.6.26 1.07.42 1.44.53.61.2 1.16.17 1.6.11.49-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.3z" />
  </svg>
);

interface PrintModalProps {
  type: 'os' | 'sale' | 'quote';
  data: WorkOrder | Sale | Quote;
  storeSettings?: StoreSettings;
  customers?: Customer[];
  initialOSCopiesMode?: 'inteira' | 'ambas' | 'cliente';
  onClose: () => void;
}

export const PrintModal: React.FC<PrintModalProps> = ({
  type,
  data,
  storeSettings,
  customers,
  initialOSCopiesMode,
  onClose
}) => {
  const [printFormat, setPrintFormat] = useState<'a4' | 'termica'>('a4');
  const [saleCopies, setSaleCopies] = useState<1 | 2>(1);
  const [osCopiesMode, setOsCopiesMode] = useState<'inteira' | 'ambas' | 'cliente'>(
    initialOSCopiesMode || 'inteira'
  );
  const [mobileZoomMode, setMobileZoomMode] = useState<'fit' | '100'>('fit');
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  const [docHeight, setDocHeight] = useState<number>(0);
  const printableDocRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const updateHeight = () => {
      if (printableDocRef.current) {
        setDocHeight(printableDocRef.current.offsetHeight || printableDocRef.current.scrollHeight);
      }
    };
    updateHeight();
    const timer = setTimeout(updateHeight, 120);
    return () => clearTimeout(timer);
  }, [osCopiesMode, printFormat, data, saleCopies, viewportWidth]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const getDocFileName = () => {
    const sanitize = (str: string) =>
      str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40);

    if (type === 'os') {
      const os = data as WorkOrder;
      const num = os.number || os.id?.slice(-4) || 'OS';
      const client = sanitize(os.customerName || 'Cliente');
      const suffix =
        osCopiesMode === 'cliente'
          ? '_Via_Cliente'
          : osCopiesMode === 'inteira'
          ? '_Folha_A4'
          : '_2Vias';
      return `OS_${num}_${client}${suffix}`;
    } else if (type === 'sale') {
      const sale = data as Sale;
      const id = sale.id?.slice(-6) || 'Recibo';
      const client = sanitize(sale.customerName || 'Consumidor');
      return `Recibo_Venda_${id}_${client}`;
    } else {
      const quote = data as Quote;
      const num = (quote as any).number || quote.id?.slice(-4) || 'Orcamento';
      const client = sanitize(quote.customerName || 'Cliente');
      return `Orcamento_${num}_${client}`;
    }
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = getDocFileName();
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 2500);
  };

  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [whatsAppNotice, setWhatsAppNotice] = useState<string | null>(null);

  const handleSavePDF = async () => {
    const printableElement = document.getElementById('printable-document');
    if (!printableElement) {
      window.print();
      return;
    }

    const cleanClient = (
      type === 'os'
        ? (data as WorkOrder).customerName || 'Cliente'
        : type === 'sale'
        ? (data as Sale).customerName || 'Cliente'
        : (data as Quote).customerName || 'Cliente'
    ).trim().replace(/[\\/:*?"<>|]/g, '_');

    let filename = '';
    if (type === 'os') {
      const os = data as WorkOrder;
      const suffix =
        osCopiesMode === 'cliente'
          ? '_Via_Cliente'
          : osCopiesMode === 'inteira'
          ? '_Folha_A4'
          : '_2Vias';
      filename = `${os.number || '0'} - ${cleanClient}${suffix}.pdf`;
    } else if (type === 'sale') {
      const sale = data as Sale;
      filename = `Recibo ${sale.number || '0'} - ${cleanClient}.pdf`;
    } else {
      const quote = data as Quote;
      filename = `Orcamento_${quote.number || quote.id?.slice(-4) || '0'}_${cleanClient}.pdf`;
    }

    try {
      setIsSavingPdf(true);
      await generateAndSavePdf(printableElement, filename);
    } catch (err) {
      console.error('[PrintModal] Erro ao gerar PDF diretamente:', err);
      // Fallback gracioso: aciona o diálogo de impressão do navegador
      window.print();
    } finally {
      setIsSavingPdf(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (type === 'os') {
      const os = data as WorkOrder;
      const customerObj =
        customers && os.customerId
          ? customers.find((c) => c.id === os.customerId)
          : undefined;
      const phone = os.customerPhone || customerObj?.whatsapp || customerObj?.phone;
      const printableElement = document.getElementById('printable-document');

      setIsSendingWhatsApp(true);
      setWhatsAppNotice(null);
      try {
        const res = await sendWorkOrderViaWhatsApp(
          os,
          phone,
          defaultStore,
          customerObj,
          'auto',
          null,
          true,
          printableElement
        );

        if (res.success) {
          if (res.mode === 'web_share') {
            setWhatsAppNotice('Compartilhamento da Ordem de Serviço iniciado com sucesso!');
          } else {
            setWhatsAppNotice(
              'O PDF da OS foi salvo no seu dispositivo e a conversa do WhatsApp foi aberta. Basta anexar o arquivo baixado na conversa.'
            );
          }
        }
      } catch (err: any) {
        console.error('Erro ao enviar WhatsApp:', err);
      } finally {
        setIsSendingWhatsApp(false);
      }
    } else if (type === 'sale') {
      const sale = data as Sale;
      const customerObj =
        customers && sale.customerId
          ? customers.find((c) => c.id === sale.customerId)
          : undefined;
      const phone = sale.customerPhone || customerObj?.whatsapp || customerObj?.phone;
      sendSaleReceiptViaWhatsApp(sale, phone, defaultStore, customerObj);
    } else if (type === 'quote') {
      const quote = data as Quote;
      const text = formatQuoteWhatsAppMessage(quote, defaultStore);
      openWhatsAppWithText(quote.customerPhone, text);
    }
  };

  const defaultStore: StoreSettings = storeSettings || {
    storeName: 'Power Tech - Assistência Técnica & Vendas',
    tradeName: 'Power Tech',
    cnpj: '12.345.678/0001-90',
    ie: '123.456.789.110',
    phone: '(11) 3456-7890',
    whatsapp: '5511987654321',
    email: 'contato@powertech.com.br',
    street: 'Av. Principal do Comércio',
    number: '500',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    cep: '01001-000',
    pixKey: '12.345.678/0001-90',
    pixType: 'cnpj',
    warrantyTerms:
      '1. A garantia cobre exclusivamente os serviços executados e peças substituídas pelo prazo de 90 dias (conforme Art. 26 do Código de Defesa do Consumidor).\n2. A garantia é automaticamente invalidada em caso de violação dos lacres internos, queda física, derramamento de líquidos, descargas elétricas ou intervenção de terceiros.\n3. O cliente tem o prazo máximo de 90 dias para retirar o equipamento pronto ou com orçamento recusado, sob pena de cobrança de taxa de guarda ou descarte conforme a lei.',
    printerType: 'termica_80mm',
    autoPrintAfterSave: true
  };

  // Renderiza a Ordem de Serviço em Folha Inteira A4 (Tamanho A4 Completo)
  const renderOSFullA4 = (os: WorkOrder) => {
    return (
      <div
        className="w-full text-slate-900 bg-white flex flex-col justify-between space-y-3 p-1 min-h-[268mm]"
        style={{ width: '100%', boxSizing: 'border-box' }}
      >
        <div>
          {/* Header Empresa */}
          <div className="border-b-2 border-slate-900 pb-3 mb-3 flex justify-between items-start gap-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl border border-slate-200 p-1 flex items-center justify-center shrink-0 bg-white">
                <img src="/logo.png" alt="Power Tech Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight uppercase text-blue-900 leading-tight">
                  {defaultStore.storeName}
                </h1>
                <p className="text-xs font-semibold text-slate-700">
                  CNPJ: {defaultStore.cnpj} | IE: {defaultStore.ie}
                </p>
                <p className="text-xs text-slate-600">
                  {defaultStore.street}, {defaultStore.number} - {defaultStore.neighborhood} - {defaultStore.city}/{defaultStore.state}
                </p>
                <p className="text-xs text-slate-600">
                  Telefone/WhatsApp: {defaultStore.phone} | PIX: {defaultStore.pixKey}
                </p>
              </div>
            </div>
            <div className="text-right border-l-2 border-slate-300 pl-4 shrink-0">
              <span className="inline-block px-3 py-1 bg-slate-900 text-white font-bold rounded text-xs uppercase mb-1">
                Ordem de Serviço
              </span>
              <p className="text-2xl font-black text-slate-900 leading-none">
                #{os.number}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Entrada: {new Date(os.entryDate || os.createdAt || Date.now()).toLocaleDateString('pt-BR')} às {new Date(os.entryDate || os.createdAt || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
              {os.status === 'entregue' && os.deliveredDate && (
                <p className="text-xs text-emerald-700 font-bold mt-0.5">
                  Entregue: {new Date(os.deliveredDate).toLocaleDateString('pt-BR')} às {new Date(os.deliveredDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>

          {/* Dados do Cliente e Equipamento */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 mb-3 text-xs">
            <div>
              <h4 className="font-bold uppercase text-[11px] text-blue-900 mb-1 border-b border-slate-300 pb-0.5">
                Dados do Cliente
              </h4>
              <p><strong className="font-semibold">Nome:</strong> {os.customerName}</p>
              <p><strong className="font-semibold">Telefone/WhatsApp:</strong> {os.customerPhone || 'Não informado'}</p>
              {os.customerCpf && <p><strong className="font-semibold">CPF/CNPJ:</strong> {os.customerCpf}</p>}
              {os.customerEmail && <p><strong className="font-semibold">E-mail:</strong> {os.customerEmail}</p>}
              {os.customerAddress && <p><strong className="font-semibold">Endereço:</strong> {os.customerAddress}</p>}
            </div>
            <div>
              <h4 className="font-bold uppercase text-[11px] text-blue-900 mb-1 border-b border-slate-300 pb-0.5">
                Dados do Equipamento
              </h4>
              <p><strong className="font-semibold">Tipo:</strong> <span className="uppercase font-bold">{os.equipmentType}</span></p>
              <p><strong className="font-semibold">Marca / Modelo:</strong> {os.brand} {os.model}</p>
              <p><strong className="font-semibold">Nº de Série:</strong> {os.serialNumber || 'N/A'}</p>
              {os.configuration && <p><strong className="font-semibold">Configuração:</strong> {os.configuration}</p>}
              <p><strong className="font-semibold">Acessórios Deixados:</strong> {os.accessories || 'Nenhum'}</p>
            </div>
          </div>

          {/* Defeito Reclamado e Checklist */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 mb-3 text-xs">
            <div>
              <h4 className="font-bold uppercase text-[11px] text-blue-900 mb-1 border-b border-slate-300 pb-0.5">
                Defeito Reclamado pelo Cliente
              </h4>
              <p className="italic text-slate-700 bg-white p-2 rounded border border-slate-200 min-h-[40px]">
                "{os.reportedIssue || 'Sem observações adicionais.'}"
              </p>
            </div>
            <div>
              <h4 className="font-bold uppercase text-[11px] text-blue-900 mb-1 border-b border-slate-300 pb-0.5">
                Checklist de Entrada & Estado
              </h4>
              <div className="grid grid-cols-2 gap-1 mt-1 text-[11px]">
                <p>Ligando: <strong>{os.checklist?.ligando ? 'SIM' : 'NÃO'}</strong></p>
                <p>Carregador/Fonte: <strong>{os.checklist?.carregadorFonte ? 'SIM' : 'NÃO'}</strong></p>
                <p>Cabo de Força: <strong>{os.checklist?.caboForca ? 'SIM' : 'NÃO'}</strong></p>
                <p>Senha Aparelho: <strong>{os.checklist?.senhaAparelho || 'Nenhuma'}</strong></p>
              </div>
              {os.checklist?.avariasVisiveis ? (
                <p className="mt-1 text-[11px] text-slate-800"><strong>Avarias Visíveis:</strong> {os.checklist.avariasVisiveis}</p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-500"><strong>Avarias Visíveis:</strong> Nenhuma avaria notada na entrada</p>
              )}
            </div>
          </div>

          {/* Diagnóstico & Laudo Técnico do Laboratório (se houver) */}
          {os.technicalReport && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-3 text-xs">
              <h4 className="font-bold uppercase text-[11px] text-blue-900 mb-1 border-b border-slate-300 pb-0.5">
                Diagnóstico & Laudo Técnico do Laboratório
              </h4>
              <p className="text-slate-800 mt-1 whitespace-pre-line">{os.technicalReport}</p>
            </div>
          )}

          {/* Informações Adicionais (se houver) */}
          {os.additionalInfo && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-3 text-xs">
              <h4 className="font-bold uppercase text-[11px] text-blue-900 mb-1 border-b border-slate-300 pb-0.5">
                Informações Adicionais
              </h4>
              <p className="text-slate-800 mt-1 whitespace-pre-line">{os.additionalInfo}</p>
            </div>
          )}

          {/* Tabela de Peças e Serviços */}
          <div className="mb-3">
            <table className="w-full border-collapse border border-slate-300 text-xs" style={{ width: '100%' }}>
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-left font-bold">
                  <th className="p-2 border-r border-slate-300 w-24">Tipo</th>
                  <th className="p-2 border-r border-slate-300">Descrição do Item / Serviço</th>
                  <th className="p-2 border-r border-slate-300 text-center w-16">Qtd</th>
                  <th className="p-2 border-r border-slate-300 text-right w-24">Vl. Unit.</th>
                  <th className="p-2 text-right w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {os.items && os.items.length > 0 ? (
                  os.items.map((it, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="p-1.5 px-2 border-r border-slate-200 font-semibold uppercase text-[11px]">
                        {it.type === 'peca' ? 'Peça' : 'Serviço'}
                      </td>
                      <td className="p-1.5 px-2 border-r border-slate-200">
                        {it.description}
                        {it.warrantyDays !== undefined && (
                          <span className="block text-[8.5px] text-slate-500">
                            Garantia: {formatWarrantyLabel(it.warrantyDays)}
                          </span>
                        )}
                      </td>
                      <td className="p-1.5 px-2 border-r border-slate-200 text-center">{it.quantity}</td>
                      <td className="p-1.5 px-2 border-r border-slate-200 text-right">R$ {Number(it.unitPrice).toFixed(2)}</td>
                      <td className="p-1.5 px-2 text-right font-semibold">R$ {Number(it.total).toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-3 text-center text-slate-500 italic">
                      Orçamento em análise técnica de bancada.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold border-t border-slate-300">
                  <td colSpan={3} className="p-2 text-left text-xs">
                    {os.discount > 0 && <span>DESCONTO: -R$ {Number(os.discount).toFixed(2)} | </span>}
                    <span>STATUS: {os.status.toUpperCase()}</span>
                    <span> | GARANTIA: {os.warrantyDays === 0 ? 'SEM GARANTIA' : `${os.warrantyDays !== undefined ? os.warrantyDays : 90} DIAS`}</span>
                    {os.paymentMethod && <span> | PAGTO: {os.paymentMethod.toUpperCase()}{os.paymentStatus === 'pago' ? ' (PAGO)' : ''}</span>}
                  </td>
                  <td className="p-2 text-right text-xs">TOTAL:</td>
                  <td className="p-2 text-right font-black text-sm text-slate-900">R$ {Number(os.total).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Rodapé: Termos de Garantia e Assinaturas */}
        <div className="space-y-3 pt-2">
          <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-[10px] leading-tight text-slate-600">
            <strong className="block text-slate-800 uppercase mb-0.5">Termo de Garantia e Condições Legais (CDC):</strong>
            <p className="whitespace-pre-line">
              {formatDynamicWarrantyTerms(os.warrantyDays, defaultStore.warrantyTerms, 'os')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 text-center text-xs pt-3">
            <div>
              <div className="border-t border-slate-400 pt-1">
                <p className="font-bold text-slate-800">{defaultStore.storeName}</p>
                <p className="text-[10px] text-slate-500">Técnico / Responsável</p>
              </div>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-1">
                <p className="font-bold text-slate-800">{os.customerName}</p>
                <p className="text-[10px] text-slate-500">Assinatura do Cliente</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Renderiza uma Via completa de Ordem de Serviço (A4 Compacto - Cabe 2 vias por folha, ou 1 via inteira)
  const renderOSCopy = (
    viaLabel: string,
    isClientVia: boolean,
    os: WorkOrder,
    isSingleCopy: boolean = false
  ) => {
    return (
      <div
        className={`w-full border border-slate-300 rounded-lg p-2.5 text-[10px] leading-tight bg-white flex flex-col justify-between shadow-xs ${
          isSingleCopy ? 'min-h-[135mm]' : 'h-[133mm] max-h-[135mm]'
        }`}
        style={{ width: '100%', boxSizing: 'border-box' }}
      >
        <div>
          {/* Header Compacto da OS */}
          <div className="border-b border-slate-400 pb-1 mb-1 flex justify-between items-start gap-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded border border-slate-200 p-0.5 flex items-center justify-center shrink-0 bg-white">
                <img src="/logo.png" alt="Power Tech Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h2 className="text-[13px] font-black tracking-tight uppercase text-blue-900 leading-none mb-0.5">
                  {defaultStore.storeName}
                </h2>
                <p className="text-[9px] font-semibold text-slate-700">
                  CNPJ: {defaultStore.cnpj} | IE: {defaultStore.ie} | Tel: {defaultStore.phone}
                </p>
                <p className="text-[8.5px] text-slate-600 truncate">
                  {defaultStore.street}, {defaultStore.number} - {defaultStore.neighborhood} - {defaultStore.city}/{defaultStore.state}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span
                className={`inline-block px-2 py-0.5 font-bold rounded text-[9px] uppercase tracking-wide mb-0.5 ${
                  isClientVia ? 'bg-blue-900 text-white' : 'bg-slate-800 text-white'
                }`}
              >
                {viaLabel}
              </span>
              <p className="text-base font-black text-slate-900 leading-none">
                OS #{os.number}
              </p>
              <p className="text-[8.5px] text-slate-500 mt-0.5">
                Entrada: {new Date(os.entryDate || os.createdAt || Date.now()).toLocaleDateString('pt-BR')}
              </p>
              {os.status === 'entregue' && os.deliveredDate && (
                <p className="text-[8.5px] text-emerald-700 font-bold mt-0.5">
                  Entregue: {new Date(os.deliveredDate).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
          </div>

          {/* Dados do Cliente e Equipamento */}
          <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1.5 rounded border border-slate-200 mb-1 text-[9.5px]">
            <div>
              <h4 className="font-bold uppercase text-[9px] text-blue-900 mb-0.5 border-b border-slate-200 pb-0.5">
                Dados do Cliente
              </h4>
              <p><strong className="font-semibold">NOME:</strong> {os.customerName}</p>
              <p>
                <strong className="font-semibold">FONE/WHATSAPP:</strong> {os.customerPhone || 'NÃO INFORMADO'}
                {os.customerCpf ? <span> | <strong className="font-semibold">CPF:</strong> {os.customerCpf}</span> : null}
              </p>
              {os.customerEmail ? <p className="truncate"><strong className="font-semibold">E-MAIL:</strong> {os.customerEmail}</p> : null}
              {os.customerAddress ? <p className="truncate"><strong className="font-semibold">ENDEREÇO:</strong> {os.customerAddress}</p> : null}
            </div>
            <div>
              <h4 className="font-bold uppercase text-[9px] text-blue-900 mb-0.5 border-b border-slate-200 pb-0.5">
                Dados do Equipamento
              </h4>
              <p><strong className="font-semibold">EQUIPAMENTO:</strong> <span className="uppercase font-bold">{os.equipmentType}</span> - {os.brand} {os.model}</p>
              <p>
                <strong className="font-semibold">Nº SÉRIE:</strong> {os.serialNumber || 'N/A'} |{' '}
                <strong className="font-semibold">ACESSÓRIOS:</strong> {os.accessories || 'NENHUM'}
                {os.configuration ? <span> | <strong className="font-semibold">CONFIG:</strong> {os.configuration}</span> : null}
              </p>
            </div>
          </div>

          {/* Defeito Reclamado e Checklist */}
          <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1.5 rounded border border-slate-200 mb-1 text-[9px]">
            <div>
              <strong className="block text-blue-900 font-bold uppercase text-[8.5px] mb-0.5">DEFEITO RECLAMADO:</strong>
              <p className="italic text-slate-700 bg-white p-1 rounded border border-slate-200 line-clamp-2 min-h-[20px]">
                "{os.reportedIssue || 'Sem observações adicionais.'}"
              </p>
            </div>
            <div>
              <strong className="block text-blue-900 font-bold uppercase text-[8.5px] mb-0.5">ESTADO / CHECKLIST:</strong>
              <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 text-[8.5px]">
                <p>LIGANDO: <strong>{os.checklist?.ligando ? 'SIM' : 'NÃO'}</strong></p>
                <p>FONTE: <strong>{os.checklist?.carregadorFonte ? 'SIM' : 'NÃO'}</strong></p>
                <p>CABO: <strong>{os.checklist?.caboForca ? 'SIM' : 'NÃO'}</strong></p>
                <p>SENHA: <strong>{os.checklist?.senhaAparelho || 'NENHUMA'}</strong></p>
              </div>
              <p className="mt-0.5 text-[8px] text-slate-700">
                <strong>AVARIAS VISÍVEIS:</strong> {os.checklist?.avariasVisiveis || 'NENHUMA NOTADA NA ENTRADA'}
              </p>
            </div>
          </div>

          {/* Informações Adicionais (se houver) */}
          {os.additionalInfo && (
            <div className="bg-slate-50 p-1.5 rounded border border-slate-200 mb-1 text-[8.5px]">
              <strong className="block text-blue-900 font-bold uppercase text-[8px] mb-0.5">INFORMAÇÕES ADICIONAIS:</strong>
              <p className="text-slate-700 whitespace-pre-line">{os.additionalInfo}</p>
            </div>
          )}

          {/* Tabela de Peças e Serviços */}
          <div className="mb-1">
            <table className="w-full border-collapse border border-slate-300 text-[9px]" style={{ width: '100%' }}>
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-left font-bold">
                  <th className="p-0.5 px-1 border-r border-slate-300 w-14">Tipo</th>
                  <th className="p-0.5 px-1 border-r border-slate-300">Descrição do Item / Serviço</th>
                  <th className="p-0.5 px-1 border-r border-slate-300 text-center w-8">Qtd</th>
                  <th className="p-0.5 px-1 border-r border-slate-300 text-right w-16">Vl. Unit.</th>
                  <th className="p-0.5 px-1 text-right w-16">Total</th>
                </tr>
              </thead>
              <tbody>
                {os.items && os.items.length > 0 ? (
                  os.items.map((it, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="p-0.5 px-1 border-r border-slate-200 font-semibold uppercase text-[8.5px]">
                        {it.type === 'peca' ? 'Peça' : 'Serviço'}
                      </td>
                      <td className="p-0.5 px-1 border-r border-slate-200">
                        {it.description}
                        {it.warrantyDays !== undefined && (
                          <span className="block text-[7.5px] text-slate-500">
                            Garantia: {formatWarrantyLabel(it.warrantyDays)}
                          </span>
                        )}
                      </td>
                      <td className="p-0.5 px-1 border-r border-slate-200 text-center">{it.quantity}</td>
                      <td className="p-0.5 px-1 border-r border-slate-200 text-right">R$ {Number(it.unitPrice).toFixed(2)}</td>
                      <td className="p-0.5 px-1 text-right font-semibold">R$ {Number(it.total).toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-1 text-center text-slate-500 italic text-[8.5px]">
                      Orçamento em análise técnica de bancada.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-200 font-black text-slate-900 border-t border-slate-300">
                  <td colSpan={3} className="p-0.5 px-1 text-left text-[8.5px]">
                    {os.discount > 0 && <span>DESCONTO: -R$ {Number(os.discount).toFixed(2)} | </span>}
                    <span>STATUS: {os.status.toUpperCase()}</span>
                    <span> | GARANTIA: {os.warrantyDays === 0 ? 'SEM GARANTIA' : `${os.warrantyDays !== undefined ? os.warrantyDays : 90} DIAS`}</span>
                    {os.paymentMethod && <span> | PAGTO: {os.paymentMethod.toUpperCase()}{os.paymentStatus === 'pago' ? ' (PAGO)' : ''}</span>}
                  </td>
                  <td className="p-0.5 px-1 text-right text-[8.5px]">TOTAL:</td>
                  <td className="p-0.5 px-1 text-right font-black text-[10.5px]">R$ {Number(os.total).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Rodapé: Termo de Garantia e Assinaturas */}
        <div>
          <p className="text-[7.5px] leading-tight text-slate-600 bg-slate-50 p-1 rounded border border-slate-200 mb-1">
            <strong>TERMO DE GARANTIA:</strong>{' '}
            {os.warrantyDays === 0
              ? 'Serviço/equipamento sem garantia conforme acordado entre as partes.'
              : `Garantia de ${os.warrantyDays !== undefined ? os.warrantyDays : 90} ${(os.warrantyDays ?? 90) === 1 ? 'dia' : 'dias'} sobre serviços e peças aplicadas${(os.warrantyDays ?? 90) === 90 ? ' (Art. 26 CDC)' : ''}. Válida mediante apresentação desta OS e lacres intactos. Não cobre danos por queda, água, descarga elétrica ou violação. Equipamento não retirado em 90 dias sujeito às regras da legislação vigente.`}
          </p>

          <div className="grid grid-cols-2 gap-4 text-center text-[8.5px]">
            <div>
              <div className="border-t border-slate-400 pt-0.5">
                <p className="font-bold text-slate-800">{defaultStore.storeName}</p>
                <p className="text-[7.5px] text-slate-500">Técnico / Estabelecimento</p>
              </div>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-0.5">
                <p className="font-bold text-slate-800 truncate">{os.customerName}</p>
                <p className="text-[7.5px] text-slate-500">Assinatura do Cliente</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Renderiza Comprovante / Recibo de Venda Reduzido (Máximo Metade da Folha A4)
  const renderSaleReceipt = (viaLabel: string, sale: Sale) => {
    const customerObj =
      customers && sale.customerId
        ? customers.find((c) => c.id === sale.customerId)
        : undefined;

    return (
      <SaleReceiptDocument
        sale={sale}
        storeSettings={defaultStore}
        customer={customerObj}
        viaLabel={viaLabel}
      />
    );
  };

  const baseDocWidth = 794; // ~210mm a 96 DPI
  const isMobileView = viewportWidth < 768;
  const availableWidth = Math.max(260, viewportWidth - 28);
  const scale = isMobileView && mobileZoomMode === 'fit' ? Math.min(1, availableWidth / baseDocWidth) : 1;

  return (
    <div
      className="print-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-1.5 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="print-modal-box bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col h-[96vh] sm:h-auto sm:max-h-[92vh]">
        {/* Top bar controls (no-print) */}
        <div className="no-print bg-slate-950 border-b border-slate-800">
          {/* Linha Principal do Cabeçalho */}
          <div className="p-3 sm:p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 shrink-0">
                <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-white truncate">Visualização de Impressão</h3>
                <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                  {type === 'os' ? `OS #${(data as WorkOrder).number} (${
                    osCopiesMode === 'inteira'
                      ? 'Folha Inteira A4'
                      : osCopiesMode === 'cliente'
                      ? 'Via do Cliente'
                      : '2 Vias na Folha'
                  })` : ''}
                  {type === 'sale' ? `Recibo #${(data as Sale).number} (Formato Reduzido)` : ''}
                  {type === 'quote' ? `Orçamento #${(data as Quote).number}` : ''}
                </p>
              </div>
            </div>

            {/* Ações e Controles em Desktop (ocultos em telas móveis) */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              {/* Opções de Venda: 1 Via (Meia Folha) ou 2 Vias na Folha */}
              {type === 'sale' && printFormat === 'a4' && (
                <div className="bg-slate-800 p-0.5 rounded-lg flex text-xs">
                  <button
                    type="button"
                    onClick={() => setSaleCopies(1)}
                    className={`px-2.5 py-1 rounded-md font-medium transition ${
                      saleCopies === 1 ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    1 Via (Meia)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaleCopies(2)}
                    className={`px-2.5 py-1 rounded-md font-medium transition ${
                      saleCopies === 2 ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    2 Vias
                  </button>
                </div>
              )}

              {/* Opções de Vias para Ordem de Serviço */}
              {type === 'os' && printFormat === 'a4' && (
                <div className="bg-slate-800 p-0.5 rounded-lg flex text-xs">
                  <button
                    type="button"
                    onClick={() => setOsCopiesMode('inteira')}
                    className={`px-2.5 py-1 rounded-md font-medium transition ${
                      osCopiesMode === 'inteira' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Imprimir 1 via completa no tamanho da folha A4 inteira"
                  >
                    Folha Inteira
                  </button>
                  <button
                    type="button"
                    onClick={() => setOsCopiesMode('ambas')}
                    className={`px-2.5 py-1 rounded-md font-medium transition ${
                      osCopiesMode === 'ambas' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Imprimir 2 vias na mesma folha (Loja + Cliente)"
                  >
                    2 Vias
                  </button>
                  <button
                    type="button"
                    onClick={() => setOsCopiesMode('cliente')}
                    className={`px-2.5 py-1 rounded-md font-medium transition ${
                      osCopiesMode === 'cliente' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Exibir e imprimir somente a via do cliente (Meia Folha)"
                  >
                    Via Cliente
                  </button>
                </div>
              )}

              {/* Format toggle: A4 ou Térmica */}
              <div className="bg-slate-800 p-0.5 rounded-lg flex text-xs">
                <button
                  type="button"
                  onClick={() => setPrintFormat('a4')}
                  className={`px-2.5 py-1 rounded-md font-medium transition ${
                    printFormat === 'a4' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Padrão A4
                </button>
                <button
                  type="button"
                  onClick={() => setPrintFormat('termica')}
                  className={`px-2.5 py-1 rounded-md font-medium transition ${
                    printFormat === 'termica' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Térmica (80mm)
                </button>
              </div>

              <button
                type="button"
                disabled={isSendingWhatsApp}
                onClick={handleSendWhatsApp}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition active:scale-[0.98] ${
                  isSendingWhatsApp ? 'opacity-70 cursor-wait' : ''
                }`}
                title={
                  type === 'os'
                    ? 'Enviar Ordem de Serviço completa pelo WhatsApp'
                    : type === 'sale'
                    ? 'Enviar Recibo de Venda pelo WhatsApp'
                    : 'Enviar Orçamento pelo WhatsApp'
                }
              >
                {isSendingWhatsApp ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>WhatsApp...</span>
                  </>
                ) : (
                  <>
                    <WhatsAppIcon className="w-3.5 h-3.5 fill-current" />
                    <span>WhatsApp</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isSavingPdf}
                onClick={handleSavePDF}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm transition active:scale-[0.98] ${
                  isSavingPdf ? 'opacity-70 cursor-wait' : ''
                }`}
                title={
                  type === 'os'
                    ? 'Salvar Ordem de Serviço em PDF'
                    : type === 'sale'
                    ? 'Salvar Recibo de Venda em PDF'
                    : 'Salvar Orçamento em PDF'
                }
              >
                {isSavingPdf ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Gerando...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Salvar PDF</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition active:scale-[0.98]"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Botão Fechar em Mobile (fixado no topo direito) */}
            <div className="flex sm:hidden items-center gap-2 shrink-0">
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800 active:bg-slate-700 text-slate-300 hover:text-white transition flex items-center justify-center"
                title="Fechar visualização"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Linha 2 de Controles em Mobile: Seletores de Vias e Formato */}
          <div className="sm:hidden px-3 pb-3 pt-0 flex flex-col gap-2 border-t border-slate-900/60">
            <div className="flex items-center justify-between gap-2 pt-1">
              {/* Vias OS em Mobile */}
              {type === 'os' && printFormat === 'a4' && (
                <div className="bg-slate-900 border border-slate-800 p-0.5 rounded-lg flex text-[11px] flex-1">
                  <button
                    type="button"
                    onClick={() => setOsCopiesMode('inteira')}
                    className={`flex-1 py-1.5 rounded-md font-bold transition text-center ${
                      osCopiesMode === 'inteira' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400'
                    }`}
                  >
                    Folha A4
                  </button>
                  <button
                    type="button"
                    onClick={() => setOsCopiesMode('ambas')}
                    className={`flex-1 py-1.5 rounded-md font-bold transition text-center ${
                      osCopiesMode === 'ambas' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400'
                    }`}
                  >
                    2 Vias
                  </button>
                  <button
                    type="button"
                    onClick={() => setOsCopiesMode('cliente')}
                    className={`flex-1 py-1.5 rounded-md font-bold transition text-center ${
                      osCopiesMode === 'cliente' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400'
                    }`}
                  >
                    Cliente
                  </button>
                </div>
              )}

              {/* Vias Venda em Mobile */}
              {type === 'sale' && printFormat === 'a4' && (
                <div className="bg-slate-900 border border-slate-800 p-0.5 rounded-lg flex text-[11px] flex-1">
                  <button
                    type="button"
                    onClick={() => setSaleCopies(1)}
                    className={`flex-1 py-1.5 rounded-md font-bold transition text-center ${
                      saleCopies === 1 ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400'
                    }`}
                  >
                    1 Via (Meia)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaleCopies(2)}
                    className={`flex-1 py-1.5 rounded-md font-bold transition text-center ${
                      saleCopies === 2 ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400'
                    }`}
                  >
                    2 Vias
                  </button>
                </div>
              )}

              {/* Formato: A4 / Térmica em Mobile */}
              <div className="bg-slate-900 border border-slate-800 p-0.5 rounded-lg flex text-[11px] shrink-0">
                <button
                  type="button"
                  onClick={() => setPrintFormat('a4')}
                  className={`px-3 py-1.5 rounded-md font-bold transition ${
                    printFormat === 'a4' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400'
                  }`}
                >
                  A4
                </button>
                <button
                  type="button"
                  onClick={() => setPrintFormat('termica')}
                  className={`px-3 py-1.5 rounded-md font-bold transition ${
                    printFormat === 'termica' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400'
                  }`}
                >
                  80mm
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Aviso de Orientação do WhatsApp */}
        {whatsAppNotice && (
          <div className="mx-3 sm:mx-6 mt-3 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center justify-between gap-3 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="text-base text-emerald-400 leading-none">✓</span>
              <span>{whatsAppNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setWhatsAppNotice(null)}
              className="text-emerald-400 hover:text-white p-1 rounded hover:bg-emerald-500/20"
              title="Fechar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Printable Document Container */}
        <div className="print-modal-body flex-1 overflow-y-auto p-2 sm:p-6 bg-slate-100 flex flex-col items-center">
          {printFormat === 'a4' ? (
            <div
              className="print-preview-viewport w-full flex flex-col items-center"
              style={{
                overflowX: isMobileView && mobileZoomMode === '100' ? 'auto' : 'hidden',
                overflowY: 'visible',
                WebkitOverflowScrolling: 'touch'
              }}
            >
              {/* Barra de Zoom / Info em Mobile */}
              {isMobileView && (
                <div className="no-print w-full max-w-[794px] mb-2 flex items-center justify-between px-1 text-[11px] text-slate-500 shrink-0">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                    <span>A4 Oficial (210 &times; 297 mm)</span>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-200 p-0.5 rounded-lg border border-slate-300">
                    <button
                      type="button"
                      onClick={() => setMobileZoomMode('fit')}
                      className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 text-[10px] ${
                        mobileZoomMode === 'fit'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Ajustar documento à largura da tela do celular"
                    >
                      <Minimize2 className="w-3 h-3" />
                      <span>Ajustar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileZoomMode('100')}
                      className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 text-[10px] ${
                        mobileZoomMode === '100'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Visualizar em tamanho real (100%) com rolagem suave"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>100%</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="w-full flex justify-center">
                <div
                  ref={printableDocRef}
                  id="printable-document"
                  className="bg-white text-slate-900 p-4 sm:p-6 rounded-lg shadow-md text-[10.5px] leading-relaxed border-0"
                  style={
                    isMobileView && mobileZoomMode === 'fit'
                      ? ({
                          width: `${baseDocWidth}px`,
                          minWidth: `${baseDocWidth}px`,
                          maxWidth: `${baseDocWidth}px`,
                          zoom: scale,
                          boxSizing: 'border-box'
                        } as React.CSSProperties)
                      : isMobileView && mobileZoomMode === '100'
                      ? {
                          width: `${baseDocWidth}px`,
                          minWidth: `${baseDocWidth}px`,
                          maxWidth: `${baseDocWidth}px`,
                          boxSizing: 'border-box'
                        }
                      : {
                          width: '100%',
                          maxWidth: '210mm',
                          boxSizing: 'border-box'
                        }
                  }
                >
              {/* ========================================================================= */}
              {/* ORDEM DE SERVIÇO: FOLHA INTEIRA A4 OU DUAS VIAS NA MESMA FOLHA A4          */}
              {/* OU SOMENTE VIA DO CLIENTE (QUANDO SALVAR EM PDF OU SELECIONAR 1 VIA)       */}
              {/* ========================================================================= */}
              {type === 'os' && (() => {
                const os = data as WorkOrder;

                if (osCopiesMode === 'inteira') {
                  return (
                    <div className="w-full" style={{ width: '100%' }}>
                      {renderOSFullA4(os)}
                    </div>
                  );
                }

                if (osCopiesMode === 'cliente') {
                  return (
                    <div className="w-full space-y-1" style={{ width: '100%' }}>
                      {/* APENAS A VIA DO CLIENTE */}
                      {renderOSCopy('VIA DO CLIENTE', true, os, true)}
                    </div>
                  );
                }

                return (
                  <div className="w-full space-y-1" style={{ width: '100%' }}>
                    {/* 1ª VIA: ESTABELECIMENTO / LOJA (BANCADA) */}
                    {renderOSCopy('1ª VIA - ESTABELECIMENTO / LOJA', false, os, false)}

                    {/* Linha de Destaque / Corte */}
                    <div className="py-1 my-0.5 border-t-2 border-dashed border-slate-400 text-center select-none flex items-center justify-center gap-2">
                      <span className="bg-white px-3 text-[8.5px] font-black text-slate-600 uppercase tracking-widest border border-slate-300 rounded-full shadow-xs flex items-center gap-1.5">
                        <Scissors className="w-3 h-3 text-slate-500" />
                        CORTAR AQUI &bull; DESTACAR 2ª VIA DO CLIENTE
                      </span>
                    </div>

                    {/* 2ª VIA: CLIENTE / CONSUMIDOR */}
                    {renderOSCopy('2ª VIA - CLIENTE / CONSUMIDOR', true, os, false)}
                  </div>
                );
              })()}

              {/* ========================================================================= */}
              {/* RECIBO DE VENDA: FORMATO REDUZIDO NO MÁXIMO METADE DA FOLHA A4             */}
              {/* ========================================================================= */}
              {type === 'sale' && (() => {
                const sale = data as Sale;
                return (
                  <div className="space-y-2">
                    {/* 1ª VIA DO RECIBO (Ocupa no máximo a metade superior da folha A4) */}
                    {renderSaleReceipt(saleCopies === 2 ? '1ª VIA - CLIENTE' : 'RECIBO DE VENDA', sale)}

                    {saleCopies === 2 ? (
                      <>
                        {/* Linha de Destaque / Corte para a 2ª Via */}
                        <div className="py-1 my-0.5 border-t-2 border-dashed border-slate-400 text-center select-none flex items-center justify-center gap-2">
                          <span className="bg-white px-3 text-[8.5px] font-black text-slate-600 uppercase tracking-widest border border-slate-300 rounded-full shadow-xs flex items-center gap-1.5">
                            <Scissors className="w-3 h-3 text-slate-500" />
                            CORTAR AQUI &bull; 2ª VIA DA LOJA
                          </span>
                        </div>

                        {/* 2ª VIA DO RECIBO NA MESMA FOLHA */}
                        {renderSaleReceipt('2ª VIA - LOJA / CONTROLE', sale)}
                      </>
                    ) : (
                      /* Linha indicativa de corte / limite de meia folha A4 */
                      <div className="my-2 border-t border-dashed border-slate-300 py-1 text-center select-none no-print">
                        <span className="text-[8.5px] font-semibold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1">
                          <Scissors className="w-3 h-3" />
                          Limite de meia folha A4 &bull; A metade inferior permanece livre para economia de papel
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ========================================================================= */}
              {/* PROPOSTA COMERCIAL / ORÇAMENTO (A4 COMPLETO)                               */}
              {/* ========================================================================= */}
              {type === 'quote' && (() => {
                const quote = data as Quote;
                return (
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="border-b-2 border-slate-900 pb-3 mb-3 flex justify-between items-start gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl border border-slate-200 p-1 flex items-center justify-center shrink-0 bg-white">
                          <img src="/logo.png" alt="Power Tech Logo" className="w-full h-full object-contain" />
                        </div>
                        <div>
                          <h1 className="text-base font-black tracking-tight uppercase text-blue-900">
                            {defaultStore.storeName}
                          </h1>
                          <p className="text-xs font-semibold text-slate-700">
                            CNPJ: {defaultStore.cnpj} | IE: {defaultStore.ie}
                          </p>
                          <p className="text-xs text-slate-600">
                            {defaultStore.street}, {defaultStore.number} - {defaultStore.neighborhood} - {defaultStore.city}/{defaultStore.state}
                          </p>
                          <p className="text-xs text-slate-600">
                            Tel: {defaultStore.phone} | PIX: {defaultStore.pixKey}
                          </p>
                        </div>
                      </div>
                      <div className="text-right border-l-2 border-slate-300 pl-4">
                        <span className="inline-block px-3 py-1 bg-slate-900 text-white font-bold rounded text-xs uppercase mb-1">
                          Proposta Comercial
                        </span>
                        <p className="text-xl font-black text-slate-900">
                          #{quote.number}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Data: {new Date(quote.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded border border-slate-200 flex justify-between">
                      <div>
                        <p><strong>Cliente:</strong> {quote.customerName}</p>
                        <p><strong>Telefone:</strong> {quote.customerPhone}</p>
                        <p><strong>Equipamento / Demanda:</strong> {quote.equipmentDesc}</p>
                      </div>
                      <div className="text-right">
                        <p><strong>Validade da Proposta:</strong> {quote.validDays} dias</p>
                        <p><strong>Vencimento:</strong> {new Date(quote.validUntil).toLocaleDateString('pt-BR')}</p>
                        <p><strong>Status:</strong> <span className="uppercase font-bold">{quote.status}</span></p>
                      </div>
                    </div>

                    <table className="w-full border-collapse border border-slate-300 text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-300 text-left">
                          <th className="p-1.5 border-r border-slate-300">Tipo</th>
                          <th className="p-1.5 border-r border-slate-300">Descrição do Item / Serviço</th>
                          <th className="p-1.5 border-r border-slate-300 text-center w-16">Qtd</th>
                          <th className="p-1.5 border-r border-slate-300 text-right w-24">Vl. Unit.</th>
                          <th className="p-1.5 text-right w-24">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quote.items.map((it, idx) => (
                          <tr key={idx} className="border-b border-slate-200">
                            <td className="p-1.5 border-r border-slate-200 font-semibold uppercase text-[10px]">
                              {it.type === 'peca' ? 'Peça' : 'Mão de Obra'}
                            </td>
                            <td className="p-1.5 border-r border-slate-200">{it.description}</td>
                            <td className="p-1.5 border-r border-slate-200 text-center">{it.quantity}</td>
                            <td className="p-1.5 border-r border-slate-200 text-right">R$ {Number(it.unitPrice).toFixed(2)}</td>
                            <td className="p-1.5 text-right font-medium">R$ {Number(it.total).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-200 font-black text-sm text-slate-900">
                          <td colSpan={4} className="p-2 text-right">VALOR TOTAL ESTIMADO:</td>
                          <td className="p-2 text-right">R$ {Number(quote.total).toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>

                    {quote.notes && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded text-[11px]">
                        <strong>Observações & Condições de Pagamento:</strong>
                        <p>{quote.notes}</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      ) : (
            /* Térmica 80mm format */
            <div
              id="printable-thermal"
              className="bg-white text-black font-mono w-[80mm] p-3 text-xs leading-snug shadow-md border-0"
            >
              <div className="text-center pb-2 border-b border-dashed border-slate-300">
                <p className="font-bold text-sm uppercase">{defaultStore.tradeName}</p>
                <p className="text-[11px]">CNPJ: {defaultStore.cnpj}</p>
                <p className="text-[11px]">{defaultStore.street}, {defaultStore.number}</p>
                <p className="text-[11px]">Tel/Zap: {defaultStore.phone}</p>
                <p className="font-bold mt-1 uppercase text-sm">
                  {type === 'os' && `ORDEM DE SERVIÇO #${data.number}`}
                  {type === 'sale' && `CUPOM DE VENDA #${data.number}${(data as Sale).status === 'cancelada' ? ' (CANCELADO)' : ''}`}
                  {type === 'quote' && `ORÇAMENTO #${data.number}`}
                </p>
                {type === 'sale' && (data as Sale).status === 'cancelada' && (
                  <p className="text-[11px] font-bold text-red-600 uppercase mt-0.5">*** VENDA CANCELADA ***</p>
                )}
                <p className="text-[11px]">{new Date().toLocaleString('pt-BR')}</p>
              </div>

              <div className="py-2 border-b border-dashed border-slate-300 text-[11px]">
                <p><strong>CLIENTE:</strong> {('customerName' in data ? data.customerName : 'Consumidor')}</p>
                {(() => {
                  const saleData = type === 'sale' ? (data as Sale) : null;
                  const cObj = customers && saleData?.customerId ? customers.find(c => c.id === saleData.customerId) : null;
                  const cpf = saleData?.customerCpf || cObj?.document || (cObj as any)?.cpfCnpj;
                  const addr = saleData?.customerAddress || (cObj ? [cObj.street, cObj.number, cObj.neighborhood, cObj.city ? `${cObj.city}/${cObj.state || ''}` : ''].filter(Boolean).join(', ') : null);
                  return (
                    <>
                      {cpf && <p><strong>CPF:</strong> {cpf}</p>}
                      {addr && <p className="truncate"><strong>END:</strong> {addr}</p>}
                    </>
                  );
                })()}
                {'customerPhone' in data && data.customerPhone && (
                  <p><strong>FONE:</strong> {data.customerPhone}</p>
                )}
                {type === 'os' && (
                  <>
                    <p><strong>EQUIP:</strong> {(data as WorkOrder).brand} {(data as WorkOrder).model}{(data as WorkOrder).configuration ? ` (${(data as WorkOrder).configuration})` : ''}</p>
                    <p><strong>AVARIAS:</strong> {(data as WorkOrder).checklist?.avariasVisiveis || 'NENHUMA NOTADA'}</p>
                    {(data as WorkOrder).status === 'entregue' && (data as WorkOrder).deliveredDate && (
                      <p><strong>ENTREGUE EM:</strong> {new Date((data as WorkOrder).deliveredDate!).toLocaleDateString('pt-BR')} {new Date((data as WorkOrder).deliveredDate!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    )}
                  </>
                )}
              </div>

              <div className="py-2 border-b border-dashed border-slate-300 text-[11px]">
                <p className="font-bold border-b border-slate-300 pb-0.5 mb-1">ITENS / SERVIÇOS:</p>
                {'items' in data &&
                  Array.isArray(data.items) &&
                  data.items.map((it: any, i: number) => (
                    <div key={i} className="flex justify-between items-start text-[11px] mb-1 gap-2">
                      <span className="break-words whitespace-normal leading-tight flex-1">
                        {it.quantity}x {it.description || it.productName}
                      </span>
                      <span className="shrink-0 font-medium">R$ {Number(it.total).toFixed(2)}</span>
                    </div>
                  ))}
              </div>

              <div className="py-2 border-b border-dashed border-slate-300 text-right text-xs">
                <p className="font-bold text-base">TOTAL: R$ {Number(data.total).toFixed(2)}</p>
                {'paymentMethod' in data && data.paymentMethod && (
                  <p className="text-[11px] uppercase">PAGO VIA: {data.paymentMethod}</p>
                )}
              </div>

              <div className="pt-2 text-center text-[10px] leading-tight">
                {(() => {
                  const thermalWarranty =
                    type === 'os'
                      ? (data as WorkOrder).warrantyDays !== undefined
                        ? Number((data as WorkOrder).warrantyDays)
                        : 90
                      : type === 'sale'
                      ? (data as Sale).warrantyDays !== undefined && (data as Sale).warrantyDays !== null
                        ? Number((data as Sale).warrantyDays)
                        : computeAggregateWarrantyDays((data as Sale).items || [])
                      : 90;
                  return (
                    <p>
                      {thermalWarranty === 0
                        ? 'Sem garantia para este serviço/produto.'
                        : `Garantia de ${thermalWarranty} ${thermalWarranty === 1 ? 'dia' : 'dias'}${thermalWarranty === 90 ? ' conforme CDC' : ''}.`}
                    </p>
                  );
                })()}
                <p>Obrigado pela preferência!</p>
              </div>
            </div>
          )}
        </div>

        {/* Barra de Ações Mobile Fixada na Parte Inferior do Modal */}
        <div className="no-print sm:hidden p-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2 shadow-2xl shrink-0">
          <button
            type="button"
            disabled={isSendingWhatsApp}
            onClick={handleSendWhatsApp}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-emerald-600 active:bg-emerald-700 text-white text-xs font-bold shadow-md transition active:scale-[0.98] ${
              isSendingWhatsApp ? 'opacity-70 cursor-wait' : ''
            }`}
          >
            {isSendingWhatsApp ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <WhatsAppIcon className="w-4 h-4 fill-current" />
            )}
            <span>WhatsApp</span>
          </button>

          <button
            type="button"
            disabled={isSavingPdf}
            onClick={handleSavePDF}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-rose-600 active:bg-rose-700 text-white text-xs font-bold shadow-md transition active:scale-[0.98] ${
              isSavingPdf ? 'opacity-70 cursor-wait' : ''
            }`}
          >
            {isSavingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            <span>Salvar PDF</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-blue-600 active:bg-blue-700 text-white text-xs font-bold shadow-md transition active:scale-[0.98]"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>
        </div>
      </div>
    </div>
  );
};
