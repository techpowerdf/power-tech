import React, { useMemo } from 'react';
import {
  DollarSign,
  Wrench,
  CheckCircle,
  AlertTriangle,
  PlusCircle,
  ShoppingCart,
  FileSpreadsheet,
  DatabaseBackup,
  Printer,
  ChevronRight,
  Monitor,
  Laptop,
  Printer as PrinterIcon,
  HardDrive,
  Eye,
  EyeOff,
  BarChart3,
  TrendingDown
} from 'lucide-react';
import { WorkOrder, Sale, Product, BackupSettings, StoreSettings } from '../types';
import { NavTab } from '../components/Sidebar';
import { getStatusBadgeStyle, STATUS_LABELS } from '../utils/themeCustomizer';

interface DashboardViewProps {
  metrics: {
    todaySalesCount: number;
    todaySalesTotal: number;
    monthRevenueTotal: number;
    openOSCount: number;
    readyOSCount: number;
    deliveredMonthOSCount: number;
    lowStockCount: number;
  };
  recentWorkOrders: WorkOrder[];
  recentSales: Sale[];
  lowStockProducts: Product[];
  backupSettings?: BackupSettings;
  onNavigate: (tab: NavTab) => void;
  onNewOS: () => void;
  onNewSale: () => void;
  onNewQuote: () => void;
  onNewExpense?: () => void;
  onQuickBackup: () => void;
  onPrintOS: (os: WorkOrder) => void;
  onPrintSale: (sale: Sale) => void;
  hideRevenue?: boolean;
  onToggleHideRevenue?: () => void;
  storeName?: string;
  storeSettings?: StoreSettings;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  recentWorkOrders,
  recentSales,
  lowStockProducts,
  backupSettings,
  onNavigate,
  onNewOS,
  onNewSale,
  onNewQuote,
  onNewExpense,
  onQuickBackup,
  onPrintOS,
  onPrintSale,
  hideRevenue = false,
  onToggleHideRevenue,
  storeName,
  storeSettings
}) => {
  const getEquipmentIcon = (type: string, className = 'w-5 h-5') => {
    switch (type) {
      case 'notebook':
        return <Laptop className={`${className} text-blue-400 shrink-0`} />;
      case 'computador':
        return <HardDrive className={`${className} text-indigo-400 shrink-0`} />;
      case 'monitor':
        return <Monitor className={`${className} text-sky-400 shrink-0`} />;
      case 'impressora':
        return <PrinterIcon className={`${className} text-amber-400 shrink-0`} />;
      default:
        return <Wrench className={`${className} text-slate-400 shrink-0`} />;
    }
  };

  const getStatusBadge = (status: string) => {
    const style = getStatusBadgeStyle(
      status,
      storeSettings?.statusColors,
      storeSettings?.badgeFontSize,
      storeSettings?.badgePadding
    );
    const label = STATUS_LABELS[status] || status;
    return (
      <span style={style} className="app-status-badge">
        {label}
      </span>
    );
  };

  const sortedRecentWorkOrders = useMemo(() => {
    const INACTIVE_STATUSES = new Set(['entregue', 'sem_reparo', 'cancelada', 'descarte']);
    return [...(recentWorkOrders || [])].sort((a, b) => {
      const aInactive = INACTIVE_STATUSES.has(a.status);
      const bInactive = INACTIVE_STATUSES.has(b.status);
      if (!aInactive && bInactive) return -1;
      if (aInactive && !bInactive) return 1;
      const dateA = new Date(a.entryDate || (a as any).createdAt || 0).getTime();
      const dateB = new Date(b.entryDate || (b as any).createdAt || 0).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return (Number(b.number) || 0) - (Number(a.number) || 0);
    });
  }, [recentWorkOrders]);

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          onClick={onNewOS}
          className="flex items-center gap-3 p-3.5 rounded-xl bg-blue-600/15 border border-blue-500/30 hover:bg-blue-600/25 transition text-left group cursor-pointer"
        >
          <div className="p-2.5 rounded-lg bg-blue-600 text-white shadow-md shadow-blue-600/30 group-hover:scale-105 transition">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Nova OS</h4>
            <p className="text-[11px] text-slate-400">Entrada de aparelho</p>
          </div>
        </button>

        <button
          onClick={onNewSale}
          className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-600/15 border border-emerald-500/30 hover:bg-emerald-600/25 transition text-left group cursor-pointer"
        >
          <div className="p-2.5 rounded-lg bg-emerald-600 text-white shadow-md shadow-emerald-600/30 group-hover:scale-105 transition">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Venda no Balcão</h4>
            <p className="text-[11px] text-slate-400">Abrir caixa / PDV</p>
          </div>
        </button>

        <button
          onClick={onNewQuote}
          className="flex items-center gap-3 p-3.5 rounded-xl bg-purple-600/15 border border-purple-500/30 hover:bg-purple-600/25 transition text-left group cursor-pointer"
        >
          <div className="p-2.5 rounded-lg bg-purple-600 text-white shadow-md shadow-purple-600/30 group-hover:scale-105 transition">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Novo Orçamento</h4>
            <p className="text-[11px] text-slate-400">Cotação de serviço/peça</p>
          </div>
        </button>

        {onNewExpense && (
          <button
            onClick={onNewExpense}
            className="flex items-center gap-3 p-3.5 rounded-xl bg-rose-600/15 border border-rose-500/30 hover:bg-rose-600/25 transition text-left group cursor-pointer"
          >
            <div className="p-2.5 rounded-lg bg-rose-600 text-white shadow-md shadow-rose-600/30 group-hover:scale-105 transition">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Inserir Gasto</h4>
              <p className="text-[11px] text-slate-400">Despesa / saída financeira</p>
            </div>
          </button>
        )}

        <button
          onClick={onQuickBackup}
          className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 transition text-left group cursor-pointer"
        >
          <div className="p-2.5 rounded-lg bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20 group-hover:scale-105 transition">
            <DatabaseBackup className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Backup Seguro</h4>
            <p className="text-[11px] text-emerald-400">Cópia diária protegida</p>
          </div>
        </button>
      </div>

      {/* KPI Cards Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Visão Geral & Indicadores
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('relatorios')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition"
            title="Abrir Relatório de Faturamento Geral (Vendas + Serviços) por vendedor"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Relatório de Faturamento Geral</span>
          </button>
          {onToggleHideRevenue && (
            <button
              type="button"
              onClick={onToggleHideRevenue}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                hideRevenue
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700/80 hover:text-white hover:bg-slate-800'
              }`}
              title={hideRevenue ? 'Exibir valores de faturamento' : 'Ocultar valores de faturamento'}
            >
              {hideRevenue ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{hideRevenue ? 'Faturamento Oculto' : 'Ocultar Faturamento'}</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Vendas Hoje */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-400 font-medium">Vendas Hoje (Balcão)</p>
              <h3 className="text-2xl font-black text-white mt-1">
                {hideRevenue ? 'R$ •••••' : `R$ ${metrics.todaySalesTotal.toFixed(2)}`}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                {metrics.todaySalesCount} {metrics.todaySalesCount === 1 ? 'venda realizada' : 'vendas realizadas'}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Faturamento do Mês */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-400 font-medium">Faturamento do Mês</p>
              <h3 className="text-2xl font-black text-white mt-1">
                {hideRevenue ? 'R$ •••••' : `R$ ${metrics.monthRevenueTotal.toFixed(2)}`}
              </h3>
              <p className="text-[11px] text-blue-400 mt-1">
                Vendas + Manutenções entregues
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* OS em Aberto */}
        <div
          onClick={() => onNavigate('os')}
          className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 p-4 rounded-xl relative overflow-hidden cursor-pointer transition"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-400 font-medium">Aparelhos na Assistência</p>
              <h3 className="text-2xl font-black text-amber-400 mt-1">
                {metrics.openOSCount}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Em análise, bancada ou peças
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Prontas para Retirada */}
        <div
          onClick={() => onNavigate('os')}
          className="bg-slate-900 border border-slate-800 hover:border-emerald-500/40 p-4 rounded-xl relative overflow-hidden cursor-pointer transition"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-400 font-medium">Prontos para Retirada</p>
              <h3 className="text-2xl font-black text-emerald-400 mt-1">
                {metrics.readyOSCount}
              </h3>
              <p className="text-[11px] text-emerald-500/80 mt-1">
                Aguardando cliente vir buscar
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Alerta de Estoque Baixo se houver */}
      {lowStockProducts.length > 0 && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-600/20 text-rose-400 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-rose-200">
                Atenção: {lowStockProducts.length} itens com estoque crítico ou esgotando!
              </h4>
              <p className="text-[11px] text-rose-300/80">
                {lowStockProducts.map(p => `${p.name} (${p.stock} em estoque)`).slice(0, 3).join(', ')}...
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('produtos')}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition shrink-0"
          >
            Ver Estoque
          </button>
        </div>
      )}

      {/* Two columns: Recent OS & Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Work Orders */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white">Ordens de Serviço Recentes</h3>
            </div>
            <button
              onClick={() => onNavigate('os')}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
            >
              <span>Ver todas</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 flex-1">
            {sortedRecentWorkOrders.map((os) => (
              <div
                key={os.id}
                className={`p-3 rounded-lg border flex items-center justify-between transition ${
                  os.status === 'sem_reparo' || os.status === 'descarte' || os.status === 'entregue' || os.status === 'cancelada'
                    ? 'bg-slate-950/95 border-zinc-800 brightness-[0.55] opacity-75 hover:brightness-75'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                    {getEquipmentIcon(os.equipmentType)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="font-bold app-os-number"
                        style={{
                          fontSize: 'var(--app-os-number-size, 14px)',
                          color: 'var(--app-os-number-color, #38bdf8)'
                        }}
                      >
                        OS #{os.number}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {os.brand} {os.model}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      <span
                        className="font-semibold app-customer-name"
                        style={{
                          fontSize: 'var(--app-customer-name-size, 13px)',
                          color: 'var(--app-customer-name-color, #e2e8f0)'
                        }}
                      >
                        {os.customerName}
                      </span>
                      {' '}&bull; {hideRevenue ? '•••••' : `R$ ${Number(os.total).toFixed(2)}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-end">
                    {getStatusBadge(os.status)}
                    {os.status === 'entregue' && os.deliveredDate && (
                      <span className="text-[10px] text-emerald-400 font-semibold mt-1">
                        📅 Entregue: {new Date(os.deliveredDate).toLocaleDateString('pt-BR')} {new Date(os.deliveredDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onPrintOS(os)}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="Imprimir OS"
                  >
                    <Printer className="app-action-icon" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Sales */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Últimas Vendas no Caixa</h3>
            </div>
            <button
              onClick={() => onNavigate('pdv')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
            >
              <span>Abrir Caixa</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 flex-1">
            {recentSales.map((sale) => (
              <div
                key={sale.id}
                className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 flex items-center justify-between transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-white">Venda #{sale.number}</span>
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {sale.paymentMethod}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {sale.items.length} {sale.items.length === 1 ? 'item' : 'itens'} &bull; {sale.customerName || 'Balcão'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-bold text-xs text-emerald-400">
                    {hideRevenue ? '•••••' : `R$ ${Number(sale.total).toFixed(2)}`}
                  </span>
                  <button
                    onClick={() => onPrintSale(sale)}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="Imprimir Cupom"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
