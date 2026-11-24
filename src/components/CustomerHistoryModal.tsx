import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  History,
  Wrench,
  ShoppingBag,
  DollarSign,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Building2,
  User,
  Printer,
  Search,
  ExternalLink,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Plus
} from 'lucide-react';
import { Customer, WorkOrder, Sale, StoreSettings } from '../types';
import { formatCNPJ, cleanDigits } from '../services/cnpj';

interface CustomerHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  workOrders: WorkOrder[];
  sales: Sale[];
  storeSettings?: StoreSettings;
  onPrintOS?: (os: WorkOrder) => void;
  onPrintSale?: (sale: Sale) => void;
  onNewOS?: (customer: Customer) => void;
  onNewSale?: (customer: Customer) => void;
}

export const CustomerHistoryModal: React.FC<CustomerHistoryModalProps> = ({
  isOpen,
  onClose,
  customer,
  workOrders,
  sales,
  storeSettings,
  onPrintOS,
  onPrintSale,
  onNewOS,
  onNewSale
}) => {
  const [activeTab, setActiveTab] = useState<'todos' | 'os' | 'vendas'>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset tab e busca quando abre modal
  useEffect(() => {
    if (isOpen) {
      setActiveTab('todos');
      setSearchTerm('');
    }
  }, [isOpen, customer]);

  // Helper de normalização
  const normalize = (val?: string) =>
    String(val || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();

  // Filtragem estrita e inteligente de OS e Vendas deste cliente
  const customerWorkOrders = useMemo(() => {
    if (!customer) return [];
    const cleanDoc = cleanDigits(customer.document);
    const cleanP = cleanDigits(customer.phone);
    const cleanW = cleanDigits(customer.whatsapp);
    const normName = normalize(customer.name);

    return workOrders
      .filter((o) => {
        if (o.customerId && o.customerId === customer.id) return true;
        if (cleanDoc && cleanDoc.length >= 11 && cleanDigits(o.customerCpf) === cleanDoc) return true;
        const oPhone = cleanDigits(o.customerPhone);
        if (oPhone && oPhone.length >= 8) {
          if (cleanP && (cleanP === oPhone || cleanP.endsWith(oPhone) || oPhone.endsWith(cleanP))) return true;
          if (cleanW && (cleanW === oPhone || cleanW.endsWith(oPhone) || oPhone.endsWith(cleanW))) return true;
        }
        const oName = normalize(o.customerName);
        if (oName && normName && oName === normName) return true;
        return false;
      })
      .sort((a, b) => new Date(b.entryDate || b.createdAt || 0).getTime() - new Date(a.entryDate || a.createdAt || 0).getTime());
  }, [customer, workOrders]);

  const customerSales = useMemo(() => {
    if (!customer) return [];
    const cleanDoc = cleanDigits(customer.document);
    const cleanP = cleanDigits(customer.phone);
    const cleanW = cleanDigits(customer.whatsapp);
    const normName = normalize(customer.name);

    return sales
      .filter((s) => {
        if (s.customerId && s.customerId === customer.id) return true;
        if (cleanDoc && cleanDoc.length >= 11 && cleanDigits(s.customerCpf) === cleanDoc) return true;
        const sPhone = cleanDigits(s.customerPhone);
        if (sPhone && sPhone.length >= 8) {
          if (cleanP && (cleanP === sPhone || cleanP.endsWith(sPhone) || sPhone.endsWith(cleanP))) return true;
          if (cleanW && (cleanW === sPhone || cleanW.endsWith(sPhone) || sPhone.endsWith(cleanW))) return true;
        }
        const sName = normalize(s.customerName);
        if (sName && normName && sName === normName && sName !== 'CONSUMIDOR FINAL') return true;
        return false;
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [customer, sales]);

  // Estatísticas e Métricas
  const totalOsSpent = useMemo(() => {
    return customerWorkOrders
      .filter((o) => o.status !== 'cancelada')
      .reduce((acc, o) => acc + Number(o.total || 0), 0);
  }, [customerWorkOrders]);

  const totalSalesSpent = useMemo(() => {
    return customerSales
      .filter((s) => s.status !== 'cancelada')
      .reduce((acc, s) => acc + Number(s.total || 0), 0);
  }, [customerSales]);

  const totalSpentCombined = totalOsSpent + totalSalesSpent;

  const equipmentList = useMemo(() => {
    const set = new Set<string>();
    customerWorkOrders.forEach((o) => {
      const parts = [o.brand, o.model].filter(Boolean);
      const name = parts.join(' ') || (o.equipmentType ? o.equipmentType.toUpperCase() : '');
      if (name) set.add(name.trim());
    });
    return Array.from(set);
  }, [customerWorkOrders]);

  // Itens unificados para a linha do tempo (timeline)
  type TimelineItem =
    | { type: 'os'; date: string; data: WorkOrder }
    | { type: 'sale'; date: string; data: Sale };

  const timelineItems: TimelineItem[] = useMemo(() => {
    const list: TimelineItem[] = [];
    if (activeTab === 'todos' || activeTab === 'os') {
      customerWorkOrders.forEach((o) => {
        list.push({
          type: 'os',
          date: o.entryDate || o.createdAt || '',
          data: o
        });
      });
    }
    if (activeTab === 'todos' || activeTab === 'vendas') {
      customerSales.forEach((s) => {
        list.push({
          type: 'sale',
          date: s.createdAt || '',
          data: s
        });
      });
    }

    list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

    if (!searchTerm.trim()) return list;

    const term = searchTerm.toLowerCase();
    return list.filter((item) => {
      if (item.type === 'os') {
        const o = item.data;
        const matchNum = String(o.number).includes(term);
        const matchEquip = `${o.brand} ${o.model} ${o.equipmentType}`.toLowerCase().includes(term);
        const matchDefect = (o.reportedIssue || '').toLowerCase().includes(term);
        const matchReport = (o.technicalReport || '').toLowerCase().includes(term);
        const matchAddInfo = (o.additionalInfo || '').toLowerCase().includes(term);
        const matchItem = (o.items || []).some((it) => it.description.toLowerCase().includes(term));
        return matchNum || matchEquip || matchDefect || matchReport || matchAddInfo || matchItem;
      } else {
        const s = item.data;
        const matchNum = String(s.number).includes(term);
        const matchPayment = (s.paymentMethod || '').toLowerCase().includes(term);
        const matchItem = (s.items || []).some((it) => (it.productName || it.code).toLowerCase().includes(term));
        return matchNum || matchPayment || matchItem;
      }
    });
  }, [activeTab, customerWorkOrders, customerSales, searchTerm]);

  if (!isOpen || !customer) return null;

  const isCompany = cleanDigits(customer.document).length === 14 || Boolean(customer.tradeName) || Boolean(customer.cnae);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aberta':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'analise':
        return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
      case 'orcamento':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'aprovada':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'manutencao':
        return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
      case 'aguardando_peca':
        return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
      case 'concluida':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold';
      case 'entregue':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/40 font-bold';
      case 'sem_reparo':
        return 'bg-zinc-900 text-zinc-300 border-zinc-700 font-bold';
      case 'descarte':
        return 'bg-neutral-900 text-neutral-300 border-neutral-700 font-bold';
      case 'cancelada':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-700/30 text-slate-300 border-slate-600/30';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'aberta':
        return 'Aberta';
      case 'analise':
        return 'Em Análise';
      case 'orcamento':
        return 'Orçamento';
      case 'aprovada':
        return 'Aprovada';
      case 'manutencao':
        return 'Manutenção';
      case 'aguardando_peca':
        return 'Aguardando Peça';
      case 'concluida':
        return 'Pronto / Concluída';
      case 'entregue':
        return 'Entregue';
      case 'sem_reparo':
        return 'Sem Reparo';
      case 'descarte':
        return 'Descarte';
      case 'cancelada':
        return 'Cancelada';
      default:
        return status.toUpperCase();
    }
  };

  const openWhatsApp = () => {
    const raw = (customer.whatsapp || customer.phone || '').replace(/\D/g, '');
    if (!raw) {
      alert('Cliente sem telefone cadastrado.');
      return;
    }
    const full = raw.startsWith('55') ? raw : `55${raw}`;
    window.open(`https://wa.me/${full}?text=Olá%20${encodeURIComponent(customer.name)},%20tudo%20bem?`, '_blank');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Cabeçalho */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30 mt-0.5">
              <History className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white leading-tight">
                  {customer.name}
                </h2>
                {isCompany ? (
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded border border-blue-500/30 flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    Pessoa Jurídica
                  </span>
                ) : (
                  <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded border border-slate-700 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Pessoa Física
                  </span>
                )}
                {customer.status && (
                  <span className="text-[9px] bg-emerald-500/15 text-emerald-300 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">
                    {customer.status}
                  </span>
                )}
              </div>

              {customer.tradeName && (
                <p className="text-xs text-blue-300 font-semibold mt-0.5">
                  Fantasia: {customer.tradeName}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1.5 font-medium">
                {customer.document && (
                  <span className="font-mono text-slate-300">
                    DOC: {cleanDigits(customer.document).length === 14 ? formatCNPJ(customer.document) : customer.document}
                  </span>
                )}
                {(customer.phone || customer.whatsapp) && (
                  <span className="flex items-center gap-1 text-slate-300">
                    <Phone className="w-3 h-3 text-emerald-400" />
                    {customer.whatsapp || customer.phone}
                  </span>
                )}
                {customer.email && (
                  <span className="flex items-center gap-1 text-slate-300 truncate max-w-xs">
                    <Mail className="w-3 h-3 text-blue-400" />
                    {customer.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(customer.whatsapp || customer.phone) && (
              <button
                type="button"
                onClick={openWhatsApp}
                className="p-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 transition flex items-center gap-1.5 text-xs font-semibold"
                title="Abrir WhatsApp do cliente"
              >
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
              title="Fechar (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Resumo de Indicadores / Cards */}
        <div className="p-4 bg-slate-900/60 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider">Ordens de Serviço</span>
              <Wrench className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <p className="text-lg font-black text-white">{customerWorkOrders.length}</p>
            <p className="text-[10px] text-blue-400 font-semibold font-mono">
              R$ {totalOsSpent.toFixed(2)}
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider">Vendas Balcão</span>
              <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-lg font-black text-white">{customerSales.length}</p>
            <p className="text-[10px] text-emerald-400 font-semibold font-mono">
              R$ {totalSalesSpent.toFixed(2)}
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider">Total Investido</span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-lg font-black text-emerald-400 font-mono">
              R$ {totalSpentCombined.toFixed(2)}
            </p>
            <p className="text-[10px] text-slate-500">
              {customerWorkOrders.length + customerSales.length} operações
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider">Equipamentos</span>
              <LaptopIcon className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <p className="text-lg font-black text-white">{equipmentList.length}</p>
            <p className="text-[10px] text-slate-400 truncate" title={equipmentList.join(', ')}>
              {equipmentList.length > 0 ? equipmentList[0] : 'Nenhum'}
            </p>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {/* Abas */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex-1 sm:flex-none ${
                activeTab === 'todos'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos ({customerWorkOrders.length + customerSales.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('os')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex-1 sm:flex-none flex items-center justify-center gap-1.5 ${
                activeTab === 'os'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Wrench className="w-3 h-3" />
              <span>OS ({customerWorkOrders.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('vendas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex-1 sm:flex-none flex items-center justify-center gap-1.5 ${
                activeTab === 'vendas'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShoppingBag className="w-3 h-3" />
              <span>Vendas ({customerSales.length})</span>
            </button>
          </div>

          {/* Campo de Busca Rápida no Histórico */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtrar por item, defeito, equipamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>
        </div>

        {/* Lista de Registros do Histórico */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {timelineItems.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-800 text-slate-500 space-y-2">
              <History className="w-8 h-8 mx-auto text-slate-600 stroke-[1.5]" />
              <p className="text-xs font-bold text-slate-400">
                Nenhum registro encontrado no histórico deste cliente.
              </p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Ao emitir novas ordens de serviço ou realizar vendas vinculadas a este cliente, o histórico será atualizado automaticamente aqui.
              </p>
            </div>
          ) : (
            timelineItems.map((item) => {
              if (item.type === 'os') {
                const os = item.data;
                const formattedDate = new Date(os.entryDate || os.createdAt || Date.now()).toLocaleDateString('pt-BR');
                const formattedTime = new Date(os.entryDate || os.createdAt || Date.now()).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div
                    key={os.id}
                    className={`p-3.5 rounded-xl bg-slate-950 border transition space-y-2.5 text-xs ${
                      os.status === 'sem_reparo' || os.status === 'descarte' || os.status === 'entregue'
                        ? 'border-zinc-800 brightness-[0.55] opacity-75 hover:brightness-75'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-black font-mono text-[11px] border border-blue-500/30">
                          OS #{os.number}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase ${getStatusColor(os.status)}`}>
                          {getStatusLabel(os.status)}
                        </span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {formattedDate} às {formattedTime}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-white">
                          R$ {Number(os.total || 0).toFixed(2)}
                        </span>
                        {onPrintOS && (
                          <button
                            type="button"
                            onClick={() => onPrintOS(os)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                            title="Imprimir / Gerar PDF da OS"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Dados do Equipamento e Defeito */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                        <span className="text-slate-400 font-bold block text-[10px] uppercase">
                          Equipamento
                        </span>
                        <p className="font-bold text-white mt-0.5">
                          {os.brand} {os.model}{' '}
                          <span className="text-slate-400 font-normal uppercase">
                            ({os.equipmentType})
                          </span>
                        </p>
                        {os.serialNumber && (
                          <p className="text-[10px] text-slate-400 font-mono">
                            S/N: {os.serialNumber}
                          </p>
                        )}
                        {os.configuration && (
                          <p className="text-[10px] text-slate-400 truncate">
                            Config: {os.configuration}
                          </p>
                        )}
                      </div>

                      <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                        <span className="text-slate-400 font-bold block text-[10px] uppercase">
                          Defeito Relatado / Observações
                        </span>
                        <p className="text-slate-200 mt-0.5 italic line-clamp-2">
                          "{os.reportedIssue || 'Sem observações adicionais.'}"
                        </p>
                      </div>
                    </div>

                    {/* Laudo Técnico (se houver) */}
                    {os.technicalReport && (
                      <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800/50 text-[11px]">
                        <span className="text-blue-400 font-bold block text-[10px] uppercase">
                          Diagnóstico & Laudo Técnico:
                        </span>
                        <p className="text-slate-300 mt-0.5 line-clamp-2">
                          {os.technicalReport}
                        </p>
                      </div>
                    )}

                    {/* Informações Adicionais (se houver) */}
                    {os.additionalInfo && (
                      <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800/50 text-[11px]">
                        <span className="text-emerald-400 font-bold block text-[10px] uppercase">
                          Informações Adicionais:
                        </span>
                        <p className="text-slate-300 mt-0.5 line-clamp-2">
                          {os.additionalInfo}
                        </p>
                      </div>
                    )}

                    {/* Peças e Serviços executados */}
                    {os.items && os.items.length > 0 && (
                      <div className="pt-1">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                          Serviços & Peças ({os.items.length}):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {os.items.map((it, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-slate-300"
                            >
                              <span className="font-semibold">{it.quantity}x {it.description}</span>
                              <span className="text-slate-500 font-mono">R$ {Number(it.total).toFixed(2)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              } else {
                const sale = item.data;
                const formattedDate = new Date(sale.createdAt || Date.now()).toLocaleDateString('pt-BR');
                const formattedTime = new Date(sale.createdAt || Date.now()).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div
                    key={sale.id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition space-y-2.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-black font-mono text-[11px] border border-emerald-500/30">
                          VENDA #{sale.number}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase bg-slate-800 text-slate-300 border-slate-700">
                          {sale.paymentMethod}
                          {sale.installments && sale.installments > 1 ? ` (${sale.installments}x)` : ''}
                        </span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {formattedDate} às {formattedTime}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-emerald-400">
                          R$ {Number(sale.total || 0).toFixed(2)}
                        </span>
                        {onPrintSale && (
                          <button
                            type="button"
                            onClick={() => onPrintSale(sale)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                            title="Imprimir Recibo de Venda"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Itens da Compra */}
                    {sale.items && sale.items.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                          Produtos da Compra ({sale.items.length}):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {sale.items.map((it, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-slate-300"
                            >
                              <span className="font-semibold">{it.quantity}x {it.productName || (it as any).description}</span>
                              <span className="text-emerald-400 font-mono">R$ {Number(it.total).toFixed(2)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {sale.notes && (
                      <p className="text-[11px] text-slate-400 italic">
                        Obs: {sale.notes}
                      </p>
                    )}
                  </div>
                );
              }
            })
          )}
        </div>

        {/* Rodapé com Ações Rápidas */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            {onNewOS && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNewOS(customer);
                }}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova OS para {customer.name.split(' ')[0]}</span>
              </button>
            )}

            {onNewSale && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNewSale(customer);
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition flex items-center gap-1.5"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Nova Venda no PDV</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition ml-auto"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

const LaptopIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16" />
  </svg>
);
