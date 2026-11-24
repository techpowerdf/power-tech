import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  Wrench,
  Search,
  Package,
  Phone,
  MapPin,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Laptop,
  AlertTriangle,
  FileText,
  DollarSign,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Printer
} from 'lucide-react';
import { api } from '../services/api';
import { WorkOrder, Sale, StoreSettings, WorkOrderStatus } from '../types';
import { SaleReceiptDocument } from '../components/SaleReceiptDocument';

interface PublicTrackingViewProps {
  trackId: string;
  type?: 'os' | 'sale';
  onBackToSystem?: () => void;
}

export const PublicTrackingView: React.FC<PublicTrackingViewProps> = ({
  trackId,
  type = 'os',
  onBackToSystem
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [sale, setSale] = useState<Sale | null>(null);
  const [store, setStore] = useState<Partial<StoreSettings>>({});
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [copiedPix, setCopiedPix] = useState<boolean>(false);

  const fetchData = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    try {
      if (type === 'os') {
        const res = await api.trackWorkOrder(trackId);
        setWorkOrder(res.workOrder);
        setStore(res.store || {});
      } else {
        const res = await api.trackSale(trackId);
        setSale(res.sale);
        setStore(res.store || {});
      }
      setError(null);
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      console.error('Erro ao buscar dados de rastreamento:', err);
      setWorkOrder(null);
      setError(err.message || 'Essa ordem de serviço não existe mais.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh a cada 10 segundos para atualização em tempo real
    const interval = setInterval(() => {
      fetchData();
    }, 10000);

    return () => clearInterval(interval);
  }, [trackId, type]);

  const handleCopyPix = () => {
    if (!store?.pixKey) return;
    navigator.clipboard.writeText(store.pixKey);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2500);
  };

  const handleDownloadReceiptPDF = () => {
    if (!sale) return;
    const originalTitle = document.title;
    const clientSanitized = (sale.customerName || 'Cliente').replace(/[^a-zA-Z0-9_-]/g, '_');
    document.title = `Recibo_Venda_${sale.number || '0'}_${clientSanitized}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 2500);
  };

  useEffect(() => {
    if (sale) {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('pdf') === '1' || params.get('print') === '1' || params.get('download') === '1') {
          const timer = setTimeout(() => {
            handleDownloadReceiptPDF();
          }, 600);
          return () => clearTimeout(timer);
        }
      } catch (e) {}
    }
  }, [sale]);

  const getStatusStepIndex = (status: WorkOrderStatus): number => {
    switch (status) {
      case 'aberta':
        return 0;
      case 'analise':
        return 1;
      case 'orcamento':
        return 2;
      case 'aprovada':
        return 3;
      case 'manutencao':
      case 'aguardando_peca':
        return 4;
      case 'concluida':
        return 5;
      case 'entregue':
        return 6;
      case 'sem_reparo':
      case 'descarte':
      case 'cancelada':
        return -1;
      default:
        return 0;
    }
  };

  const steps = [
    { key: 'aberta', title: 'Entrada na Loja', desc: 'Aparelho recebido e cadastrado' },
    { key: 'analise', title: 'Análise Técnica', desc: 'Testes e diagnóstico inicial' },
    { key: 'orcamento', title: 'Orçamento', desc: 'Cotação de peças e serviços' },
    { key: 'aprovada', title: 'Aprovado', desc: 'Orçamento aprovado pelo cliente' },
    { key: 'manutencao', title: 'Em Manutenção', desc: 'Serviço em execução na bancada' },
    { key: 'concluida', title: 'Pronto para Retirada', desc: 'Finalizado, testado e pronto' },
    { key: 'entregue', title: 'Entregue', desc: 'Aparelho entregue ao cliente' }
  ];

  const getStepDate = (idx: number, stepKey: string, isCurrent: boolean): Date | null => {
    if (!workOrder) return null;
    const sd = workOrder.statusDates || {};
    let dateStr: string | undefined = sd[stepKey];

    if (!dateStr) {
      if (stepKey === 'aberta') {
        dateStr = workOrder.entryDate || (workOrder as any).createdAt;
      } else if (stepKey === 'concluida') {
        dateStr = workOrder.completionDate;
      } else if (stepKey === 'entregue') {
        dateStr = workOrder.deliveredDate;
      } else if (stepKey === 'manutencao' && sd['aguardando_peca']) {
        dateStr = sd['aguardando_peca'];
      } else if (isCurrent) {
        dateStr = (workOrder as any).updatedAt || (workOrder as any).createdAt;
      }
    }

    if (dateStr) {
      try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d;
      } catch {
        return null;
      }
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-400">Carregando informações em tempo real...</p>
      </div>
    );
  }

  // Se a OS foi excluída, cancelada ou não existe mais: o link fica 100% inativo e exibe apenas a mensagem
  if (error || (!workOrder && !sale) || (workOrder && workOrder.status === 'cancelada')) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-6 shadow-2xl shadow-rose-500/10">
          <AlertTriangle className="w-10 h-10" />
        </div>
        
        <span className="px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-black tracking-wider uppercase mb-3">
          Link Inativo
        </span>

        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-3">
          Essa ordem de serviço não existe mais.
        </h1>

        <p className="text-sm text-slate-400 max-w-md leading-relaxed">
          O link de acompanhamento foi desativado pois essa ordem de serviço foi cancelada ou excluída do sistema.
        </p>
      </div>
    );
  }

  const currentStep = workOrder ? getStatusStepIndex(workOrder.status) : 0;
  const isCancelled = workOrder?.status === 'cancelada';
  const isSemReparo = workOrder?.status === 'sem_reparo';
  const isDescarte = workOrder?.status === 'descarte';
  const isDimmed = isSemReparo || isDescarte;
  const isApproved = workOrder?.status === 'aprovada';
  const isReady = workOrder?.status === 'concluida';
  const isDelivered = workOrder?.status === 'entregue';
  const hasItems = Array.isArray(workOrder?.items) && (workOrder?.items?.length || 0) > 0;

  const storePhoneClean = (store.whatsapp || store.phone || '').replace(/\D/g, '');
  const storeWhatsAppUrl = storePhoneClean
    ? `https://api.whatsapp.com/send?phone=${storePhoneClean.startsWith('55') ? storePhoneClean : `55${storePhoneClean}`}&text=${encodeURIComponent(
        `Olá! Estou acompanhando a OS #${workOrder?.number || ''} e gostaria de tirar uma dúvida.`
      )}`
    : '';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-500 selection:text-white pb-16">
      {/* Barra de Status em Tempo Real no Topo */}
      <div className="bg-slate-900 border-b border-slate-800/80 px-4 py-2.5">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-slate-300 font-medium hidden sm:inline">Acompanhamento em Tempo Real</span>
            <span className="text-slate-400 text-[11px]">
              (Sincronizado às {lastRefreshedAt.toLocaleTimeString('pt-BR')})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 disabled:opacity-50 transition"
              title="Atualizar agora"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        {/* Cabeçalho da Assistência Técnica */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold tracking-wider uppercase">
                  Assistência Técnica Autorizada
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {store.tradeName || store.storeName || 'Power Tech Informática'}
              </h1>
              {(store.street || store.city) && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>
                    {store.street}
                    {store.number ? `, ${store.number}` : ''} - {store.neighborhood || ''}{' '}
                    {store.city ? `(${store.city}/${store.state || ''})` : ''}
                  </span>
                </div>
              )}
            </div>

            {storeWhatsAppUrl && (
              <a
                href={storeWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/20 shrink-0"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Falar com a Loja</span>
              </a>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* RASTREAMENTO DE ORDEM DE SERVIÇO */}
        {/* ======================================================== */}
        {workOrder && (
          <>
            {/* Card Principal: Número da OS e Status */}
            <div
              className={`border rounded-2xl p-5 shadow-xl relative overflow-hidden transition-all ${
                isDimmed
                  ? 'bg-slate-950 border-zinc-800 brightness-[0.58] opacity-80'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="text-xs text-slate-400 font-medium">Ordem de Serviço</div>
                  <div className="text-3xl font-black text-white flex items-center gap-2">
                    #{workOrder.number}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Cliente: <strong className="text-slate-200">{workOrder.customerName}</strong>
                  </div>
                </div>

                <div>
                  {isCancelled ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 font-black text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      <span>ORDEM CANCELADA</span>
                    </div>
                  ) : isSemReparo ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 font-black text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      <span>SEM REPARO</span>
                    </div>
                  ) : isDescarte ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-300 font-black text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      <span>DESCARTE</span>
                    </div>
                  ) : isReady ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-black text-sm shadow-lg shadow-emerald-500/20 animate-pulse">
                      <Sparkles className="w-4 h-4" />
                      <span>PRONTO PARA RETIRADA</span>
                    </div>
                  ) : isDelivered ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-400 font-black text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>ENTREGUE AO CLIENTE</span>
                    </div>
                  ) : isApproved ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-black text-sm shadow-lg shadow-emerald-500/10">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>ORÇAMENTO APROVADO</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-black text-sm">
                      <Clock className="w-4 h-4" />
                      <span>EM ANDAMENTO</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Banner de Aviso de Orçamento Aprovado */}
              {isApproved && (
                <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-emerald-950/60 to-blue-950/40 border border-emerald-500/40 flex items-start gap-3">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-300">
                      Serviço Aprovado com Sucesso!
                    </h3>
                    <p className="text-xs text-emerald-400/90 mt-1 leading-relaxed">
                      O orçamento foi aprovado e seu equipamento está na fila de execução técnica para os reparos necessários.
                    </p>
                  </div>
                </div>
              )}

              {/* Banner de Aviso de Pronto para Retirada */}
              {isReady && (
                <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-emerald-950/60 to-emerald-900/40 border border-emerald-500/40 flex items-start gap-3">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-300">
                      Ótima notícia! Seu equipamento está pronto para retirada.
                    </h3>
                    <p className="text-xs text-emerald-400/90 mt-1 leading-relaxed">
                      Os testes finais foram concluídos com sucesso. Você já pode passar na nossa loja para retirar o seu aparelho.
                    </p>
                  </div>
                </div>
              )}

              {/* Banner de Aviso de Aparelho Entregue com Data e Hora */}
              {isDelivered && (
                <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-emerald-950/60 to-blue-950/50 border border-emerald-500/50 flex items-start gap-3 shadow-lg shadow-emerald-950/30">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-white">
                        Equipamento Entregue ao Cliente!
                      </h3>
                      {workOrder.deliveredDate && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono text-xs font-bold w-fit">
                          📅 Data de Entrega: {new Date(workOrder.deliveredDate).toLocaleDateString('pt-BR')} às {new Date(workOrder.deliveredDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                      Seu aparelho foi retirado e entregue com sucesso. Agradecemos pela preferência e confiança!
                      {workOrder.warrantyDays !== 0 && (
                        <span className="block mt-1 text-emerald-400 font-medium">
                          🛡️ O prazo de garantia ({workOrder.warrantyDays !== undefined ? workOrder.warrantyDays : 90} {(workOrder.warrantyDays ?? 90) === 1 ? 'dia' : 'dias'}) está registrado e em vigor a partir da data de entrega.
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Linha do Tempo / Stepper Visual */}
              {!isCancelled && (
                <div className="mt-6">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>Progresso do Serviço</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                    {steps.map((st, idx) => {
                      const isCompleted = currentStep > idx;
                      const isCurrent = currentStep === idx;
                      const stepDate = getStepDate(idx, st.key, isCurrent);
                      return (
                        <div
                          key={st.title}
                          className={`p-3 rounded-xl border flex flex-col justify-between transition ${
                            isCurrent
                              ? 'bg-blue-600/15 border-blue-500 shadow-lg shadow-blue-500/10'
                              : isCompleted
                              ? 'bg-slate-950 border-emerald-500/30 text-slate-300'
                              : 'bg-slate-950/40 border-slate-800/80 text-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                isCurrent
                                  ? 'bg-blue-500 text-white'
                                  : isCompleted
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-slate-800 text-slate-500'
                              }`}
                            >
                              {isCompleted ? '✓' : idx + 1}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-extrabold text-blue-400 animate-pulse">
                                AGORA
                              </span>
                            )}
                          </div>
                          <div>
                            <div
                              className={`text-xs font-bold leading-tight ${
                                isCurrent ? 'text-blue-300' : isCompleted ? 'text-slate-200' : 'text-slate-500'
                              }`}
                            >
                              {st.title}
                            </div>
                            {stepDate && (isCompleted || isCurrent) ? (
                              <div className="mt-1.5 pt-1.5 border-t border-slate-800/80">
                                <span className={`text-[10px] font-bold block leading-tight ${
                                  isCurrent ? 'text-blue-300' : 'text-emerald-400'
                                }`}>
                                  📅 {stepDate.toLocaleDateString('pt-BR')}
                                </span>
                                <span className="text-[9px] text-slate-400 font-mono block leading-tight mt-0.5">
                                  às {stepDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-500 mt-0.5 leading-snug hidden sm:block">
                                {st.desc}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Informações do Equipamento & Defeito Relatado */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Dados do Aparelho */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <Laptop className="w-4 h-4 text-blue-400" />
                  <span>Aparelho Registrado</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800/80">
                    <span className="text-slate-400">Tipo:</span>
                    <span className="font-bold text-white uppercase">{workOrder.equipmentType}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/80">
                    <span className="text-slate-400">Marca / Modelo:</span>
                    <span className="font-bold text-white">
                      {workOrder.brand} {workOrder.model}
                    </span>
                  </div>
                  {workOrder.serialNumber && (
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Nº de Série:</span>
                      <span className="font-mono text-slate-300">{workOrder.serialNumber}</span>
                    </div>
                  )}
                  {workOrder.accessories && (
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Acessórios Deixados:</span>
                      <span className="text-slate-300 font-medium text-right">{workOrder.accessories}</span>
                    </div>
                  )}
                  {workOrder.checklist?.avariasVisiveis && (
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Avarias Visíveis:</span>
                      <span className="text-amber-300 font-medium text-right">{workOrder.checklist.avariasVisiveis}</span>
                    </div>
                  )}
                  <div className={`flex justify-between py-1 ${workOrder.deliveredDate ? 'border-b border-slate-800/80' : ''}`}>
                    <span className="text-slate-400">Data de Entrada:</span>
                    <span className="text-slate-300 font-medium">
                      {new Date(workOrder.entryDate || workOrder.createdAt || Date.now()).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  {workOrder.deliveredDate && (
                    <div className="flex justify-between py-1">
                      <span className="text-emerald-400 font-semibold">Data de Entrega:</span>
                      <span className="text-emerald-300 font-bold font-mono">
                        {new Date(workOrder.deliveredDate).toLocaleDateString('pt-BR')} às {new Date(workOrder.deliveredDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Defeito e Diagnóstico */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-300 uppercase tracking-wider">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>Relato do Cliente & Laudo</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-400 mb-1">Defeito Informado:</div>
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-slate-300 italic leading-relaxed">
                        "{workOrder.reportedIssue || 'Não informado'}"
                      </div>
                    </div>

                    {workOrder.technicalReport && (
                      <div>
                        <div className="text-[11px] font-semibold text-blue-400 mb-1">
                          Diagnóstico & Laudo Técnico:
                        </div>
                        <div className="bg-blue-950/20 p-2.5 rounded-xl border border-blue-900/40 text-blue-200 leading-relaxed font-medium">
                          {workOrder.technicalReport}
                        </div>
                      </div>
                    )}

                    {workOrder.additionalInfo && (
                      <div>
                        <div className="text-[11px] font-semibold text-emerald-400 mb-1">
                          Informações Adicionais:
                        </div>
                        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-slate-300 leading-relaxed font-medium whitespace-pre-line">
                          {workOrder.additionalInfo}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {workOrder.technicianName && (
                  <div className="mt-3 text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
                    Técnico Responsável: <span className="text-slate-400 font-semibold">{workOrder.technicianName}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Peças, Serviços & Valores */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <Wrench className="w-4 h-4 text-emerald-400" />
                  <span>Serviços & Peças da Ordem</span>
                </div>
                <div className="text-xs text-slate-400">
                  {workOrder.items?.length || 0} {workOrder.items?.length === 1 ? 'item' : 'itens'}
                </div>
              </div>

              {hasItems ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-left">
                          <th className="pb-2 font-semibold">Descrição</th>
                          <th className="pb-2 text-center font-semibold">Tipo</th>
                          <th className="pb-2 text-center font-semibold">Qtd</th>
                          <th className="pb-2 text-right font-semibold">Unitário</th>
                          <th className="pb-2 text-right font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {workOrder.items.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-slate-800/30">
                            <td className="py-2.5 font-medium text-slate-200">{item.description}</td>
                            <td className="py-2.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  item.type === 'peca'
                                    ? 'bg-amber-500/15 text-amber-400'
                                    : 'bg-blue-500/15 text-blue-400'
                                }`}
                              >
                                {item.type === 'peca' ? 'Peça' : 'Serviço'}
                              </span>
                            </td>
                            <td className="py-2.5 text-center text-slate-400">{item.quantity}</td>
                            <td className="py-2.5 text-right text-slate-400 font-mono">
                              R$ {Number(item.unitPrice).toFixed(2)}
                            </td>
                            <td className="py-2.5 text-right font-bold text-slate-100 font-mono">
                              R$ {Number(item.total).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Resumo Financeiro */}
                  <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>
                        Garantia:{' '}
                        <strong className="text-slate-200">
                          {workOrder.warrantyDays === 0 ? 'Sem garantia' : `${workOrder.warrantyDays !== undefined ? workOrder.warrantyDays : 90} ${(workOrder.warrantyDays ?? 90) === 1 ? 'dia' : 'dias'}`}
                        </strong>
                        {isDelivered && workOrder.deliveredDate && workOrder.warrantyDays !== 0 && (
                          <span className="text-emerald-400 font-medium ml-1">
                            (a partir de {new Date(workOrder.deliveredDate).toLocaleDateString('pt-BR')})
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="w-full sm:w-auto bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between sm:justify-end gap-6 text-xs flex-wrap">
                      {workOrder.paymentMethod && (
                        <div className="text-slate-400">
                          Pagamento:{' '}
                          <span className="text-emerald-400 font-bold uppercase">
                            {workOrder.paymentMethod}
                            {workOrder.paymentStatus === 'pago' ? ' (CONFIRMADO)' : ''}
                          </span>
                        </div>
                      )}
                      {workOrder.discount > 0 && (
                        <div className="text-slate-400">
                          Desconto:{' '}
                          <span className="text-rose-400 font-bold font-mono">
                            - R$ {Number(workOrder.discount).toFixed(2)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-slate-300 font-bold">TOTAL DA OS:</span>
                        <span className="text-xl font-extrabold text-emerald-400 font-mono">
                          R$ {Number(workOrder.total).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-6 rounded-xl bg-slate-950/80 border border-slate-800 text-center space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-200">Aparelho em Fase de Diagnóstico Técnico</h4>
                  <p className="text-[11px] text-slate-400 max-w-md mx-auto leading-relaxed">
                    Nenhum serviço ou peça foi adicionado à ordem até o momento. Assim que a bancada técnica realizar os testes e lançar os serviços, os valores e prazos de garantia aparecerão aqui automaticamente.
                  </p>
                </div>
              )}
            </div>

            {/* Chave PIX da Loja para Pagamento */}
            {store.pixKey && hasItems && (
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                      <DollarSign className="w-4 h-4" />
                      <span>Pagamento Facilitado via PIX</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Chave PIX da loja para pagamento ou transferência bancária:
                    </p>
                    <div className="mt-2 font-mono text-sm font-bold text-white bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 inline-block break-all">
                      {store.pixKey}
                    </div>
                  </div>

                  <button
                    onClick={handleCopyPix}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition shrink-0"
                  >
                    {copiedPix ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedPix ? 'Chave Copiada!' : 'Copiar Chave PIX'}</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ======================================================== */}
        {/* RASTREAMENTO DE COMPROVANTE DE VENDA                     */}
        {/* MODELO OFICIAL DE IMPRESSÃO EM FOLHA / PDF               */}
        {/* ======================================================== */}
        {sale && (
          <div className="space-y-4">
            {/* Barra de Ações Rápidas (Download PDF e Impressão) */}
            <div className="no-print bg-slate-900/95 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">Recibo de Venda Oficial</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      AUTENTICADO
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Número: <strong className="text-slate-200">#{sale.number}</strong> &bull; Total:{' '}
                    <strong className="text-emerald-400 font-mono">R$ {Number(sale.total).toFixed(2)}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleDownloadReceiptPDF}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition active:scale-[0.98]"
                  title="Baixar ou Imprimir o Recibo Oficial em PDF"
                >
                  <Printer className="w-4 h-4" />
                  <span>Baixar em PDF / Imprimir</span>
                </button>

                {store.whatsapp && (
                  <a
                    href={`https://wa.me/${store.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                      `Olá! Estou com uma dúvida sobre a minha compra (Recibo #${sale.number}).`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition active:scale-[0.98]"
                    title="Falar com a loja pelo WhatsApp"
                  >
                    <Phone className="w-4 h-4" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </a>
                )}
              </div>
            </div>

            {/* Documento Físico do Recibo - O MESMO MODELO QUE VAI PARA IMPRESSÃO */}
            <div className="flex justify-center">
              <div
                id="printable-document"
                className="bg-white text-slate-900 w-full max-w-[210mm] rounded-xl shadow-2xl overflow-hidden border border-slate-300"
              >
                <SaleReceiptDocument
                  sale={sale}
                  storeSettings={store}
                  viaLabel="RECIBO DE VENDA"
                  isPublicView={true}
                />
              </div>
            </div>
          </div>
        )}

        {/* Rodapé institucional */}
        <div className="text-center text-xs text-slate-500 pt-6 space-y-1">
          <p>© {new Date().getFullYear()} {store.storeName || 'Power Tech'}. Todos os direitos reservados.</p>
          <p className="text-[11px] text-slate-600">
            Página atualizada automaticamente. Não é necessário atualizar a página manualmente.
          </p>
        </div>
      </div>
    </div>
  );
};
