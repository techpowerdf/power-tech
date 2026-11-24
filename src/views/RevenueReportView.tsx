import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart3,
  DollarSign,
  ShoppingCart,
  Wrench,
  BadgeDollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Printer,
  Eye,
  EyeOff,
  Download,
  Filter,
  X,
  Users,
  Calendar,
  CheckCircle2,
  Package,
  Cpu
} from 'lucide-react';
import { Sale, WorkOrder, Seller, StoreSettings, Product, ServiceItem, Expense } from '../types';
import { api } from '../services/api';
import {
  ReportPeriod,
  UNASSIGNED_SELLER_KEY,
  getLocalDateStr,
  getLocalMonthStr,
  getWorkOrderEffectiveDate,
  isDateInPeriod,
  matchesSellerFilter,
  resolveRecordSeller,
  buildSellerBreakdown,
  calculateSaleGross,
  calculateSaleCost,
  calculateWorkOrderGross,
  calculateWorkOrderCost
} from '../utils/reportHelpers';

interface RevenueReportViewProps {
  sales: Sale[];
  workOrders: WorkOrder[];
  sellers: Seller[];
  expenses?: Expense[];
  products?: Product[];
  services?: ServiceItem[];
  storeSettings?: StoreSettings;
  hideRevenue?: boolean;
  onToggleHideRevenue?: () => void;
}

export const RevenueReportView: React.FC<RevenueReportViewProps> = ({
  sales,
  workOrders,
  sellers,
  expenses = [],
  products = [],
  services = [],
  storeSettings,
  hideRevenue = false,
  onToggleHideRevenue
}) => {
  const now = new Date();
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('mensal');
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateStr(now));
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getLocalMonthStr(now));
  const [selectedYear, setSelectedYear] = useState<string>(() => String(now.getFullYear()));
  const [sourceFilter, setSourceFilter] = useState<'geral' | 'vendas' | 'servicos'>('geral');
  const [sellerFilter, setSellerFilter] = useState<string>('todos');
  const [osStatusScope, setOsStatusScope] = useState<'ativas' | 'finalizadas'>('ativas');
  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showPrintPreview) {
        setShowPrintPreview(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPrintPreview]);

  const periodOptions = useMemo(
    () => ({ selectedDate, selectedMonth, selectedYear }),
    [selectedDate, selectedMonth, selectedYear]
  );

  // Vendas e OS dentro do período selecionado (antes do filtro de vendedor, para o ranking completo por vendedor)
  const salesInPeriod = useMemo(() => {
    if (sourceFilter === 'servicos') return [];
    return sales.filter((s) => {
      if (s.status === 'cancelada') return false;
      return isDateInPeriod(s.createdAt, reportPeriod, periodOptions);
    });
  }, [sales, sourceFilter, reportPeriod, periodOptions]);

  const workOrdersInPeriod = useMemo(() => {
    if (sourceFilter === 'vendas') return [];
    return workOrders.filter((os) => {
      if (os.status === 'cancelada') return false;
      if (osStatusScope === 'finalizadas' && os.status !== 'concluida' && os.status !== 'entregue') {
        return false;
      }
      const dateStr = getWorkOrderEffectiveDate(os);
      return isDateInPeriod(dateStr, reportPeriod, periodOptions);
    });
  }, [workOrders, sourceFilter, osStatusScope, reportPeriod, periodOptions]);

  // Despesas dentro do período selecionado
  const expensesInPeriod = useMemo(() => {
    return (expenses || []).filter((e) => {
      const dateStr = e.date || e.createdAt;
      return isDateInPeriod(dateStr, reportPeriod, periodOptions);
    });
  }, [expenses, reportPeriod, periodOptions]);

  // Separação por vendedor no período (ranking geral de todos os vendedores no período com faturamento, custos e gastos)
  const sellerBreakdown = useMemo(() => {
    return buildSellerBreakdown(salesInPeriod, workOrdersInPeriod, sellers, products, services, expensesInPeriod);
  }, [salesInPeriod, workOrdersInPeriod, sellers, products, services, expensesInPeriod]);

  // Dados filtrados pelo vendedor selecionado
  const filteredSales = useMemo(() => {
    return salesInPeriod.filter((s) => matchesSellerFilter(s, sellerFilter, sellers));
  }, [salesInPeriod, sellerFilter, sellers]);

  const filteredWorkOrders = useMemo(() => {
    return workOrdersInPeriod.filter((os) => matchesSellerFilter(os, sellerFilter, sellers));
  }, [workOrdersInPeriod, sellerFilter, sellers]);

  const filteredExpenses = useMemo(() => {
    return expensesInPeriod.filter((e) => matchesSellerFilter(e, sellerFilter, sellers));
  }, [expensesInPeriod, sellerFilter, sellers]);

  // Métricas Consolidadas
  const metrics = useMemo(() => {
    const salesGross = filteredSales.reduce((acc, s) => acc + calculateSaleGross(s), 0);
    const salesCost = filteredSales.reduce((acc, s) => acc + calculateSaleCost(s, products, services), 0);
    const salesDiscounts = filteredSales.reduce((acc, s) => acc + Number(s.discount || 0), 0);
    const salesNet = filteredSales.reduce((acc, s) => acc + Number(s.total || 0), 0);
    const salesCount = filteredSales.length;

    const osServices = filteredWorkOrders.reduce((acc, os) => acc + Number(os.servicesTotal || 0), 0);
    const osParts = filteredWorkOrders.reduce((acc, os) => acc + Number(os.partsTotal || 0), 0);
    const osGross = filteredWorkOrders.reduce((acc, os) => acc + calculateWorkOrderGross(os), 0);
    let osPartsCost = 0;
    let osServicesCost = 0;
    let osCost = 0;
    filteredWorkOrders.forEach((os) => {
      const c = calculateWorkOrderCost(os, products, services);
      osPartsCost += c.partsCost;
      osServicesCost += c.servicesCost;
      osCost += c.totalCost;
    });
    const osDiscounts = filteredWorkOrders.reduce((acc, os) => acc + Number(os.discount || 0), 0);
    const osNet = filteredWorkOrders.reduce((acc, os) => acc + Number(os.total || 0), 0);
    const osCount = filteredWorkOrders.length;

    const totalGross = salesGross + osGross;
    const totalCost = salesCost + osCost;
    const totalRevenue = salesNet + osNet;
    const grossProfit = totalRevenue - totalCost;
    const totalExpenses = filteredExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
    const netProfit = grossProfit - totalExpenses;
    const totalDiscounts = salesDiscounts + osDiscounts;
    const totalCount = salesCount + osCount;
    const avgTicket = totalCount > 0 ? totalRevenue / totalCount : 0;

    // Formas de Pagamento Consolidado
    const byPayment: Record<string, { label: string; count: number; total: number; color: string }> = {
      dinheiro: { label: 'Dinheiro', count: 0, total: 0, color: 'bg-emerald-500' },
      pix: { label: 'PIX', count: 0, total: 0, color: 'bg-teal-500' },
      debito: { label: 'Cartão Débito', count: 0, total: 0, color: 'bg-blue-500' },
      credito: { label: 'Cartão Crédito', count: 0, total: 0, color: 'bg-indigo-500' },
      faturado: { label: 'Faturado / A Prazo', count: 0, total: 0, color: 'bg-amber-500' },
      outro: { label: 'A Combinar / Outros', count: 0, total: 0, color: 'bg-slate-500' }
    };

    const normalizePm = (raw?: string): string => {
      const m = (raw || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (m.includes('pix')) return 'pix';
      if (m.includes('dinheiro')) return 'dinheiro';
      if (m.includes('debito')) return 'debito';
      if (m.includes('credito')) return 'credito';
      if (m.includes('faturado') || m.includes('prazo') || m.includes('boleto')) return 'faturado';
      return 'outro';
    };

    filteredSales.forEach((s) => {
      const key = normalizePm(s.paymentMethod);
      byPayment[key].count += 1;
      byPayment[key].total += Number(s.total || 0);
    });

    filteredWorkOrders.forEach((os) => {
      const key = normalizePm(os.paymentMethod);
      byPayment[key].count += 1;
      byPayment[key].total += Number(os.total || 0);
    });

    return {
      salesGross,
      salesCost,
      salesDiscounts,
      salesNet,
      salesCount,
      osServices,
      osParts,
      osGross,
      osPartsCost,
      osServicesCost,
      osCost,
      osDiscounts,
      osNet,
      osCount,
      totalGross,
      totalCost,
      totalRevenue,
      totalExpenses,
      grossProfit,
      netProfit,
      totalDiscounts,
      totalCount,
      avgTicket,
      byPayment
    };
  }, [filteredSales, filteredWorkOrders, filteredExpenses, products, services]);

  // Movimentações unificadas para listagem detalhada
  const unifiedEntries = useMemo(() => {
    const entries: Array<{
      id: string;
      kind: 'VENDA' | 'OS';
      number: number;
      date: string;
      customerName: string;
      sellerName: string;
      paymentMethod: string;
      statusLabel: string;
      gross: number;
      cost: number;
      total: number;
      detail: string;
    }> = [];

    filteredSales.forEach((s) => {
      const resolved = resolveRecordSeller(s, sellers);
      entries.push({
        id: s.id,
        kind: 'VENDA',
        number: s.number,
        date: s.createdAt,
        customerName: s.customerName || 'CONSUMIDOR FINAL',
        sellerName: resolved.sellerName,
        paymentMethod: (s.paymentMethod || 'DINHEIRO').toUpperCase(),
        statusLabel: 'CONCLUÍDA',
        gross: calculateSaleGross(s),
        cost: calculateSaleCost(s, products, services),
        total: Number(s.total || 0),
        detail: `${(s.items || []).length} item(ns)`
      });
    });

    filteredWorkOrders.forEach((os) => {
      const resolved = resolveRecordSeller(os, sellers);
      const dateStr = getWorkOrderEffectiveDate(os) || '';
      const osCosts = calculateWorkOrderCost(os, products, services);
      entries.push({
        id: os.id,
        kind: 'OS',
        number: os.number,
        date: dateStr,
        customerName: os.customerName || 'CLIENTE BALCÃO',
        sellerName: resolved.sellerName,
        paymentMethod: (os.paymentMethod || 'A COMBINAR').toUpperCase(),
        statusLabel: (os.status || 'aberta').toUpperCase(),
        gross: calculateWorkOrderGross(os),
        cost: osCosts.totalCost,
        total: Number(os.total || 0),
        detail: [os.brand, os.model].filter(Boolean).join(' ') || os.equipmentType
      });
    });

    return entries.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [filteredSales, filteredWorkOrders, sellers, products, services]);

  const periodDescription = useMemo(() => {
    if (reportPeriod === 'diario') {
      const [y, m, d] = selectedDate.split('-');
      return `Diário (${d}/${m}/${y})`;
    }
    if (reportPeriod === 'semanal') return 'Semanal (Últimos 7 Dias)';
    if (reportPeriod === 'mensal') {
      const [y, m] = selectedMonth.split('-');
      return `Mensal (${m}/${y})`;
    }
    return `Anual (${selectedYear})`;
  }, [reportPeriod, selectedDate, selectedMonth, selectedYear]);

  const selectedSellerLabel = useMemo(() => {
    if (sellerFilter === 'todos') return 'Todos os Vendedores';
    if (sellerFilter === UNASSIGNED_SELLER_KEY) return 'Sem Vendedor / Loja';
    const found = sellerBreakdown.find((b) => b.key === sellerFilter) || sellers.find((s) => s.id === sellerFilter);
    return found ? ('name' in found ? found.name : found.sellerName) : 'Selecionado';
  }, [sellerFilter, sellerBreakdown, sellers]);

  const totalPeriodAllSellersRevenue = useMemo(() => {
    return sellerBreakdown.reduce((acc, r) => acc + r.totalRevenue, 0);
  }, [sellerBreakdown]);

  const sellerTotals = useMemo(() => {
    return sellerBreakdown.reduce(
      (acc, r) => ({
        salesCount: acc.salesCount + r.salesCount,
        salesGross: acc.salesGross + r.salesGross,
        salesCost: acc.salesCost + r.salesCost,
        salesNet: acc.salesNet + r.salesNet,
        osCount: acc.osCount + r.osCount,
        osGross: acc.osGross + r.osGross,
        osServices: acc.osServices + r.osServices,
        osParts: acc.osParts + r.osParts,
        osCost: acc.osCost + r.osCost,
        osNet: acc.osNet + r.osNet,
        totalGross: acc.totalGross + r.totalGross,
        totalCost: acc.totalCost + r.totalCost,
        totalRevenue: acc.totalRevenue + r.totalRevenue,
        expensesTotal: acc.expensesTotal + (r.expensesTotal || 0),
        grossProfit: acc.grossProfit + r.grossProfit,
        netProfit: acc.netProfit + (r.netProfit ?? (r.grossProfit - (r.expensesTotal || 0))),
        estimatedCommission: acc.estimatedCommission + r.estimatedCommission
      }),
      {
        salesCount: 0,
        salesGross: 0,
        salesCost: 0,
        salesNet: 0,
        osCount: 0,
        osGross: 0,
        osServices: 0,
        osParts: 0,
        osCost: 0,
        osNet: 0,
        totalGross: 0,
        totalCost: 0,
        totalRevenue: 0,
        expensesTotal: 0,
        grossProfit: 0,
        netProfit: 0,
        estimatedCommission: 0
      }
    );
  }, [sellerBreakdown]);

  const handleExportCSV = () => {
    const lines: string[] = [];
    lines.push(`RELATORIO DE FATURAMENTO GERAL - ${periodDescription}`);
    lines.push(`Filtro Vendedor:;${selectedSellerLabel};Origem:;${sourceFilter.toUpperCase()}`);
    lines.push('');
    lines.push('RESUMO CONSOLIDADO');
    lines.push(`Valor Bruto Geral (R$);${metrics.totalGross.toFixed(2).replace('.', ',')}`);
    lines.push(`Descontos (R$);${metrics.totalDiscounts.toFixed(2).replace('.', ',')}`);
    lines.push(`Faturamento Liquido Geral (R$);${metrics.totalRevenue.toFixed(2).replace('.', ',')}`);
    lines.push(`Custo Total Geral (R$);${metrics.totalCost.toFixed(2).replace('.', ',')}`);
    lines.push(`Total de Gastos (R$);${metrics.totalExpenses.toFixed(2).replace('.', ',')}`);
    lines.push(`Lucro Bruto Estimado (R$);${metrics.grossProfit.toFixed(2).replace('.', ',')}`);
    lines.push(`Lucro Liquido Real (R$);${metrics.netProfit.toFixed(2).replace('.', ',')}`);
    lines.push('');
    lines.push('RESUMO POR VENDEDOR');
    lines.push('Vendedor;Qtd Vendas;Bruto Vendas (R$);Custo Vendas (R$);Liquido Vendas (R$);Qtd OS;Bruto OS (R$);Mao de Obra OS (R$);Pecas OS (R$);Custo OS (R$);Liquido OS (R$);Valor Bruto Geral (R$);Custo Geral (R$);Faturamento Liquido Geral (R$);Gastos Vendedor (R$);Lucro Bruto (R$);Lucro Liquido Real (R$);Comissao (%);Comissao Estimada (R$)');
    sellerBreakdown.forEach((row) => {
      lines.push(
        [
          `"${row.sellerName}"`,
          row.salesCount,
          row.salesGross.toFixed(2).replace('.', ','),
          row.salesCost.toFixed(2).replace('.', ','),
          row.salesNet.toFixed(2).replace('.', ','),
          row.osCount,
          row.osGross.toFixed(2).replace('.', ','),
          row.osServices.toFixed(2).replace('.', ','),
          row.osParts.toFixed(2).replace('.', ','),
          row.osCost.toFixed(2).replace('.', ','),
          row.osNet.toFixed(2).replace('.', ','),
          row.totalGross.toFixed(2).replace('.', ','),
          row.totalCost.toFixed(2).replace('.', ','),
          row.totalRevenue.toFixed(2).replace('.', ','),
          (row.expensesTotal || 0).toFixed(2).replace('.', ','),
          row.grossProfit.toFixed(2).replace('.', ','),
          (row.netProfit ?? (row.grossProfit - (row.expensesTotal || 0))).toFixed(2).replace('.', ','),
          row.commissionRate.toFixed(1).replace('.', ','),
          row.estimatedCommission.toFixed(2).replace('.', ',')
        ].join(';')
      );
    });
    lines.push(
      [
        '"TOTAL GERAL"',
        sellerTotals.salesCount,
        sellerTotals.salesGross.toFixed(2).replace('.', ','),
        sellerTotals.salesCost.toFixed(2).replace('.', ','),
        sellerTotals.salesNet.toFixed(2).replace('.', ','),
        sellerTotals.osCount,
        sellerTotals.osGross.toFixed(2).replace('.', ','),
        sellerTotals.osServices.toFixed(2).replace('.', ','),
        sellerTotals.osParts.toFixed(2).replace('.', ','),
        sellerTotals.osCost.toFixed(2).replace('.', ','),
        sellerTotals.osNet.toFixed(2).replace('.', ','),
        sellerTotals.totalGross.toFixed(2).replace('.', ','),
        sellerTotals.totalCost.toFixed(2).replace('.', ','),
        sellerTotals.totalRevenue.toFixed(2).replace('.', ','),
        sellerTotals.expensesTotal.toFixed(2).replace('.', ','),
        sellerTotals.grossProfit.toFixed(2).replace('.', ','),
        sellerTotals.netProfit.toFixed(2).replace('.', ','),
        '',
        sellerTotals.estimatedCommission.toFixed(2).replace('.', ',')
      ].join(';')
    );
    lines.push('');
    lines.push('MOVIMENTACOES DETALHADAS');
    lines.push('Data;Tipo;Numero;Cliente;Vendedor;Detalhe;Pagamento;Status;Valor Bruto (R$);Custo (R$);Valor Liquido (R$)');
    unifiedEntries.forEach((e) => {
      const dt = e.date ? new Date(e.date).toLocaleString('pt-BR') : '-';
      lines.push(
        [
          `"${dt}"`,
          e.kind,
          e.number,
          `"${e.customerName.replace(/"/g, '""')}"`,
          `"${e.sellerName.replace(/"/g, '""')}"`,
          `"${(e.detail || '').replace(/"/g, '""')}"`,
          `"${e.paymentMethod}"`,
          e.statusLabel,
          e.gross.toFixed(2).replace('.', ','),
          e.cost.toFixed(2).replace('.', ','),
          e.total.toFixed(2).replace('.', ',')
        ].join(';')
      );
    });

    const csvContent = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const fileName = `Relatorio_Faturamento_${reportPeriod}_${getLocalDateStr(new Date())}.csv`;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);

    // Salva automaticamente cópia física no diretório de documentos do sistema
    try {
      api.saveReportToDirectory(fileName, csvContent).catch(() => {});
    } catch {}
  };

  const maskVal = (val: number, prefix = 'R$ ') => {
    if (hideRevenue) return `${prefix}•••••`;
    return `${prefix}${val.toFixed(2)}`;
  };

  return (
    <div className="space-y-5">
      {/* Cabeçalho e Ações Rápidas */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            <span>Relatório de Faturamento Geral (Vendas + Serviços / OS)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Consolidado financeiro diário, semanal, mensal e anual com separação completa de faturamento por vendedor.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onToggleHideRevenue && (
            <button
              type="button"
              onClick={onToggleHideRevenue}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                hideRevenue
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white hover:bg-slate-800'
              }`}
              title={hideRevenue ? 'Exibir valores' : 'Ocultar valores'}
            >
              {hideRevenue ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4" />}
              <span>{hideRevenue ? 'Valores Ocultos' : 'Ocultar Valores'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition"
            title="Exportar relatório completo para CSV / Excel"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Exportar Excel (CSV)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPrintPreview(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Relatório Geral</span>
          </button>
        </div>
      </div>

      {/* Barra Completa de Filtros */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Períodos */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              Período:
            </span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {(
                [
                  { id: 'diario', label: 'Diário' },
                  { id: 'semanal', label: 'Semanal (7 Dias)' },
                  { id: 'mensal', label: 'Mensal' },
                  { id: 'anual', label: 'Anual' }
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setReportPeriod(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    reportPeriod === p.id
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {reportPeriod === 'diario' && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-blue-500"
              />
            )}

            {reportPeriod === 'mensal' && (
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-blue-500"
              />
            )}

            {reportPeriod === 'anual' && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-blue-500"
              >
                {[2023, 2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Origem & Vendedor */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filtro de Origem */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {(
                [
                  { id: 'geral', label: 'Geral (Vendas + OS)' },
                  { id: 'vendas', label: 'Somente Vendas' },
                  { id: 'servicos', label: 'Somente Serviços (OS)' }
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSourceFilter(opt.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                    sourceFilter === opt.id
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Filtro de Vendedor */}
            <div className="flex items-center gap-1.5">
              <BadgeDollarSign className="w-4 h-4 text-emerald-400" />
              <select
                value={sellerFilter}
                onChange={(e) => setSellerFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-emerald-500"
                title="Filtrar relatório por vendedor"
              >
                <option value="todos">Todos os Vendedores ({sellerBreakdown.length})</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.active === false ? '(Inativo)' : ''}
                  </option>
                ))}
                <option value={UNASSIGNED_SELLER_KEY}>Sem Vendedor / Loja</option>
              </select>
            </div>

            {sourceFilter !== 'vendas' && (
              <select
                value={osStatusScope}
                onChange={(e) => setOsStatusScope(e.target.value as any)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 font-semibold focus:outline-none focus:border-blue-500"
                title="Filtrar status das Ordens de Serviço contabilizadas"
              >
                <option value="ativas">OS: Todas (exceto canceladas)</option>
                <option value="finalizadas">OS: Somente Concluídas / Entregues</option>
              </select>
            )}
          </div>
        </div>

        {sellerFilter !== 'todos' && (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs">
            <span className="text-emerald-300 font-semibold flex items-center gap-2">
              <Filter className="w-3.5 h-3.5" />
              Exibindo faturamento filtrado para o vendedor: <strong className="text-white">{selectedSellerLabel}</strong>
            </span>
            <button
              type="button"
              onClick={() => setSellerFilter('todos')}
              className="text-emerald-300 hover:text-white underline font-bold text-[11px]"
            >
              Limpar filtro de vendedor
            </button>
          </div>
        )}
      </div>

      {/* Cards KPIs Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-blue-500/30 p-4 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider">
              Valor Bruto Geral
            </span>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <h3 className="text-xl font-black text-blue-300 mt-1.5">
            {maskVal(metrics.totalGross)}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">
            Descontos: {maskVal(metrics.totalDiscounts, '- R$ ')}
          </p>
        </div>

        <div className="bg-slate-900 border border-rose-500/30 p-4 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-rose-300 tracking-wider">
              Custo Total Geral
            </span>
            <BadgeDollarSign className="w-4 h-4 text-rose-400" />
          </div>
          <h3 className="text-xl font-black text-rose-400 mt-1.5">
            {maskVal(metrics.totalCost)}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">
            {hideRevenue ? '•••' : `PDV: R$ ${metrics.salesCost.toFixed(2)} | OS: R$ ${metrics.osCost.toFixed(2)}`}
          </p>
        </div>

        <div className="bg-slate-900 border border-amber-500/30 p-4 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">
              Total de Gastos (Despesas)
            </span>
            <TrendingDown className="w-4 h-4 text-amber-400" />
          </div>
          <h3 className="text-xl font-black text-amber-400 mt-1.5">
            {maskVal(metrics.totalExpenses)}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">
            {filteredExpenses.length} lançamento(s) de despesa
          </p>
        </div>

        <div className="bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/30 p-4 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">
              Faturamento Líquido
            </span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="text-xl font-black text-emerald-400 mt-1.5">
            {maskVal(metrics.totalRevenue)}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">
            {metrics.totalCount} mov. • Ticket: {maskVal(metrics.avgTicket)}
          </p>
        </div>

        <div className="bg-slate-900 border border-teal-500/30 p-4 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-teal-300 tracking-wider">
              Lucro Bruto Estimado
            </span>
            <CheckCircle2 className="w-4 h-4 text-teal-400" />
          </div>
          <h3 className={`text-xl font-black mt-1.5 ${metrics.grossProfit >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
            {maskVal(metrics.grossProfit)}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">
            Margem: {metrics.totalRevenue > 0 ? ((metrics.grossProfit / metrics.totalRevenue) * 100).toFixed(1) : '0.0'}%
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-950/50 to-slate-900 border border-purple-500/30 p-4 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-purple-300 tracking-wider">
              Lucro Líquido Real
            </span>
            <DollarSign className="w-4 h-4 text-purple-400" />
          </div>
          <h3 className={`text-xl font-black mt-1.5 ${metrics.netProfit >= 0 ? 'text-purple-300' : 'text-rose-400'}`}>
            {maskVal(metrics.netProfit)}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">
            Líquido - Custos - Gastos ({metrics.totalRevenue > 0 ? ((metrics.netProfit / metrics.totalRevenue) * 100).toFixed(1) : '0.0'}%)
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Vendas (PDV)
            </span>
            <ShoppingCart className="w-4 h-4 text-blue-400" />
          </div>
          <h3 className="text-xl font-extrabold text-blue-400 mt-1.5">
            {maskVal(metrics.salesNet)}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">
            {metrics.salesCount} {metrics.salesCount === 1 ? 'venda' : 'vendas'} • Bruto: {maskVal(metrics.salesGross)}
          </p>
          <p className="text-[10px] text-rose-400 mt-0.5">
            Custo PDV: {maskVal(metrics.salesCost)}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Serviços & OS
            </span>
            <Wrench className="w-4 h-4 text-indigo-400" />
          </div>
          <h3 className="text-xl font-extrabold text-indigo-400 mt-1.5">
            {maskVal(metrics.osNet)}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">
            {metrics.osCount} OS • Bruto: {maskVal(metrics.osGross)}
          </p>
          <p className="text-[10px] text-rose-400 mt-0.5">
            Custo OS: {maskVal(metrics.osCost)}
          </p>
        </div>
      </div>

      {/* SEPARAÇÃO DE FATURAMENTO POR VENDEDOR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white">
                Separação de Faturamento por Vendedor ({periodDescription})
              </h3>
              <p className="text-[11px] text-slate-400">
                Desempenho individual separado entre Vendas (PDV), Mão de Obra / Peças (OS) e Faturamento Consolidado. Clique em um vendedor para filtrar.
              </p>
            </div>
          </div>
          {sellerFilter !== 'todos' && (
            <button
              type="button"
              onClick={() => setSellerFilter('todos')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white font-semibold transition"
            >
              Mostrar Todos
            </button>
          )}
        </div>

        {sellerBreakdown.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Nenhum vendedor ou movimentação encontrada para o período selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  <th className="py-2.5 px-3">Vendedor</th>
                  <th className="py-2.5 px-3 text-right">Vendas (PDV)</th>
                  <th className="py-2.5 px-3 text-right">Custo Vendas</th>
                  <th className="py-2.5 px-3 text-right">Ordens de Serviço</th>
                  <th className="py-2.5 px-3 text-right">Custo OS</th>
                  <th className="py-2.5 px-3 text-right">Valor Bruto Total</th>
                  <th className="py-2.5 px-3 text-right">Custo Total</th>
                  <th className="py-2.5 px-3 text-right">Gastos</th>
                  <th className="py-2.5 px-3 text-right">Líquido / Lucro</th>
                  <th className="py-2.5 px-3 text-center">% Part.</th>
                  <th className="py-2.5 px-3 text-right">Comissão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {sellerBreakdown.map((row) => {
                  const share = totalPeriodAllSellersRevenue > 0
                    ? (row.totalRevenue / totalPeriodAllSellersRevenue) * 100
                    : 0;
                  const isSelected = sellerFilter === row.key;

                  return (
                    <tr
                      key={row.key}
                      onClick={() => setSellerFilter(isSelected ? 'todos' : row.key)}
                      className={`cursor-pointer transition ${
                        isSelected
                          ? 'bg-emerald-500/15 hover:bg-emerald-500/20'
                          : 'hover:bg-slate-800/40'
                      }`}
                      title="Clique para filtrar por este vendedor"
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              row.isUnassigned ? 'bg-slate-500' : row.active ? 'bg-emerald-400' : 'bg-amber-400'
                            }`}
                          />
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{row.sellerName}</span>
                              {isSelected && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500 text-white font-bold uppercase">
                                  Filtrado
                                </span>
                              )}
                            </div>
                            {!row.active && (
                              <span className="text-[10px] text-amber-400">Vendedor inativo</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="font-bold text-blue-300">
                          {maskVal(row.salesGross)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {row.salesCount} {row.salesCount === 1 ? 'venda' : 'vendas'}
                          {row.salesDiscounts > 0 && !hideRevenue ? ` • Líq: R$ ${row.salesNet.toFixed(2)}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-rose-400">
                        {maskVal(row.salesCost)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="font-bold text-indigo-300">{maskVal(row.osGross)}</div>
                        <div className="text-[10px] text-slate-400">
                          {row.osCount} OS
                          {row.osCount > 0 && !hideRevenue
                            ? ` (MO: R$ ${row.osServices.toFixed(2)} | Peças: R$ ${row.osParts.toFixed(2)})`
                            : ''}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-rose-400">
                        {maskVal(row.osCost)}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-blue-300">
                        {maskVal(row.totalGross)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-rose-400">
                        {maskVal(row.totalCost)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-amber-400">
                        {maskVal(row.expensesTotal)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="font-black text-emerald-400 text-sm">
                          {maskVal(row.totalRevenue)}
                        </div>
                        <div className={`text-[10px] font-semibold ${row.netProfit >= 0 ? 'text-teal-300' : 'text-rose-400'}`}>
                          Líq. Real: {maskVal(row.netProfit)}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2 min-w-[90px]">
                          <div className="flex-1 bg-slate-950 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${row.isUnassigned ? 'bg-slate-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(100, Math.max(0, share))}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-slate-300 w-11 text-right">
                            {share.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {row.commissionRate > 0 ? (
                          <div>
                            <div className="font-bold text-amber-300">
                              {maskVal(row.estimatedCommission)}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              ({row.commissionRate.toFixed(1)}%)
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-700 bg-slate-950/70 text-xs font-extrabold">
                <tr>
                  <td className="py-3 px-3 text-white uppercase tracking-wider">Total Geral</td>
                  <td className="py-3 px-3 text-right text-blue-300">
                    <div>{maskVal(sellerTotals.salesGross)}</div>
                    <div className="text-[10px] font-normal text-slate-400">
                      {sellerTotals.salesCount} vendas
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right text-rose-400">
                    {maskVal(sellerTotals.salesCost)}
                  </td>
                  <td className="py-3 px-3 text-right text-indigo-300">
                    <div>{maskVal(sellerTotals.osGross)}</div>
                    <div className="text-[10px] font-normal text-slate-400">
                      {sellerTotals.osCount} OS
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right text-rose-400">
                    {maskVal(sellerTotals.osCost)}
                  </td>
                  <td className="py-3 px-3 text-right text-blue-300">
                    {maskVal(sellerTotals.totalGross)}
                  </td>
                  <td className="py-3 px-3 text-right text-rose-400">
                    {maskVal(sellerTotals.totalCost)}
                  </td>
                  <td className="py-3 px-3 text-right text-amber-400">
                    {maskVal(sellerTotals.expensesTotal)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="text-emerald-400 text-sm">{maskVal(sellerTotals.totalRevenue)}</div>
                    <div className={`text-[10px] ${sellerTotals.netProfit >= 0 ? 'text-teal-300' : 'text-rose-400'}`}>
                      Líq. Real: {maskVal(sellerTotals.netProfit)}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center text-slate-400 font-mono">100.0%</td>
                  <td className="py-3 px-3 text-right text-amber-300">
                    {maskVal(sellerTotals.estimatedCommission)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Composição de Origem & Formas de Pagamento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Formas de Pagamento */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-400" />
            <span>Faturamento Consolidado por Forma de Pagamento</span>
          </h4>
          <div className="space-y-2.5">
            {Object.entries(metrics.byPayment).map(([key, stat]) => {
              if (stat.count === 0 && key === 'outro') return null;
              const percent = metrics.totalRevenue > 0 ? (stat.total / metrics.totalRevenue) * 100 : 0;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-300">
                      {stat.label} ({stat.count} {stat.count === 1 ? 'lançamento' : 'lançamentos'})
                    </span>
                    <div className="text-right">
                      <span className="font-bold text-white">{maskVal(stat.total)}</span>
                      <span className="text-[10px] text-slate-400 ml-1.5 font-mono">
                        ({percent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${stat.color}`}
                      style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Composição Origem */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Distribuição da Receita (Vendas x Mão de Obra x Peças)</span>
          </h4>
          <div className="space-y-3 pt-1">
            {[
              { label: 'Vendas Diretas (PDV)', icon: ShoppingCart, color: 'bg-blue-500', textColor: 'text-blue-300', val: metrics.salesNet, cost: metrics.salesCost },
              { label: 'Serviços / Mão de Obra (OS)', icon: Cpu, color: 'bg-indigo-500', textColor: 'text-indigo-300', val: metrics.osServices, cost: metrics.osServicesCost },
              { label: 'Peças & Componentes (OS)', icon: Package, color: 'bg-amber-500', textColor: 'text-amber-300', val: metrics.osParts, cost: metrics.osPartsCost }
            ].map((item) => {
              const sumComponents = metrics.salesNet + metrics.osServices + metrics.osParts;
              const pct = sumComponents > 0 ? (item.val / sumComponents) * 100 : 0;
              const Icon = item.icon;
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className={`font-semibold flex items-center gap-1.5 ${item.textColor}`}>
                      <Icon className="w-3.5 h-3.5" />
                      {item.label}
                    </span>
                    <div className="text-right">
                      <span className="font-bold text-white">{maskVal(item.val)}</span>
                      <span className="text-[10px] text-rose-400 ml-2 font-mono">
                        (Custo: {maskVal(item.cost)})
                      </span>
                      <span className="text-[10px] text-slate-400 ml-1.5 font-mono">
                        ({pct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Listagem Detalhada de Vendas e OS no Período */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-400" />
            <span>Detalhamento de Lançamentos no Período ({unifiedEntries.length})</span>
          </h4>
          <span className="text-[11px] text-slate-400">
            Ordenado do mais recente para o mais antigo
          </span>
        </div>

        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/90 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-800 sticky top-0">
              <tr>
                <th className="py-2.5 px-3">Data / Hora</th>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3">Nº</th>
                <th className="py-2.5 px-3">Cliente</th>
                <th className="py-2.5 px-3">Vendedor</th>
                <th className="py-2.5 px-3">Detalhes</th>
                <th className="py-2.5 px-3">Pagamento</th>
                <th className="py-2.5 px-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {unifiedEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Nenhuma venda ou ordem de serviço registrada neste período/filtro.
                  </td>
                </tr>
              ) : (
                unifiedEntries.map((entry) => (
                  <tr
                    key={`${entry.kind}-${entry.id}`}
                    className={`transition ${
                      entry.kind === 'OS' && (entry.statusLabel === 'SEM_REPARO' || entry.statusLabel === 'DESCARTE')
                        ? 'bg-slate-950/95 brightness-[0.55] opacity-75 hover:brightness-75'
                        : 'hover:bg-slate-800/30'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {entry.date ? new Date(entry.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          entry.kind === 'VENDA'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        }`}
                      >
                        {entry.kind === 'VENDA' ? 'VENDA PDV' : 'ORDEM SERVIÇO'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-white">#{entry.number}</td>
                    <td className="py-2.5 px-3 font-semibold text-white max-w-[200px] truncate">{entry.customerName}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          entry.sellerName === 'SEM VENDEDOR / LOJA'
                            ? 'bg-slate-800 text-slate-400'
                            : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {entry.sellerName}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 max-w-[180px] truncate">{entry.detail}</td>
                    <td className="py-2.5 px-3 text-[11px] text-slate-300">{entry.paymentMethod}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-400 whitespace-nowrap">
                      {maskVal(entry.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE IMPRESSÃO DO RELATÓRIO GERAL (compatível com @media print .print-modal-overlay) */}
      {showPrintPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto print-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPrintPreview(false);
          }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl print-modal-box">
            {/* Barra de ações (não impressa) */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between no-print">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Pré-visualização para Impressão — Relatório Geral</h3>
                  <p className="text-[11px] text-slate-400">{periodDescription} • {selectedSellerLabel}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir / Salvar PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintPreview(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Corpo Imprimível */}
            <div className="p-6 bg-white text-black overflow-y-auto flex-1 print-modal-body text-xs space-y-5">
              {/* Cabeçalho Loja */}
              <div className="border-b-2 border-black pb-3 flex items-start justify-between">
                <div>
                  <h1 className="text-base font-black uppercase">
                    {storeSettings?.tradeName || storeSettings?.storeName || 'POWER TECH INFORMÁTICA'}
                  </h1>
                  {storeSettings?.cnpj && <p className="text-[11px]">CNPJ: {storeSettings.cnpj}</p>}
                  {(storeSettings?.phone || storeSettings?.whatsapp) && (
                    <p className="text-[11px]">Tel/WhatsApp: {storeSettings.phone || storeSettings.whatsapp}</p>
                  )}
                </div>
                <div className="text-right">
                  <h2 className="text-sm font-black uppercase">Relatório de Faturamento Geral</h2>
                  <p className="text-[11px] font-semibold">Período: {periodDescription}</p>
                  <p className="text-[11px]">Vendedor: {selectedSellerLabel}</p>
                  <p className="text-[10px] text-gray-600">Emitido em: {new Date().toLocaleString('pt-BR')}</p>
                </div>
              </div>

              {/* Resumo Consolidado */}
              <div className="grid grid-cols-6 gap-2">
                <div className="border border-gray-400 p-2 rounded">
                  <div className="text-[10px] uppercase font-bold text-gray-600">Valor Bruto Geral</div>
                  <div className="text-sm font-black">R$ {metrics.totalGross.toFixed(2)}</div>
                </div>
                <div className="border border-gray-400 p-2 rounded">
                  <div className="text-[10px] uppercase font-bold text-gray-600">Custo Total Geral</div>
                  <div className="text-sm font-black">R$ {metrics.totalCost.toFixed(2)}</div>
                </div>
                <div className="border border-gray-400 p-2 rounded">
                  <div className="text-[10px] uppercase font-bold text-gray-600">Total Gastos (Despesas)</div>
                  <div className="text-sm font-black text-red-600">R$ {metrics.totalExpenses.toFixed(2)}</div>
                </div>
                <div className="border border-gray-400 p-2 rounded">
                  <div className="text-[10px] uppercase font-bold text-gray-600">Faturamento Líquido</div>
                  <div className="text-base font-black">R$ {metrics.totalRevenue.toFixed(2)}</div>
                </div>
                <div className="border border-gray-400 p-2 rounded">
                  <div className="text-[10px] uppercase font-bold text-gray-600">Lucro Líquido Real</div>
                  <div className="text-sm font-black text-green-700">R$ {metrics.netProfit.toFixed(2)}</div>
                </div>
                <div className="border border-gray-400 p-2 rounded">
                  <div className="text-[10px] uppercase font-bold text-gray-600">Vendas ({metrics.salesCount}) / OS ({metrics.osCount})</div>
                  <div className="text-[11px] font-bold">
                    PDV: R$ {metrics.salesNet.toFixed(2)} | OS: R$ {metrics.osNet.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Tabela por Vendedor */}
              <div>
                <h3 className="font-black uppercase text-xs mb-1.5 border-b border-gray-400 pb-1">
                  Separação por Vendedor
                </h3>
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-gray-200 border-b border-black">
                      <th className="py-1.5 px-1.5 text-left">Vendedor</th>
                      <th className="py-1.5 px-1.5 text-right">Vendas Bruto (Qtd)</th>
                      <th className="py-1.5 px-1.5 text-right">Custo Vendas</th>
                      <th className="py-1.5 px-1.5 text-right">OS Bruto (Qtd)</th>
                      <th className="py-1.5 px-1.5 text-right">Custo OS</th>
                      <th className="py-1.5 px-1.5 text-right">Bruto Geral</th>
                      <th className="py-1.5 px-1.5 text-right">Custo Geral</th>
                      <th className="py-1.5 px-1.5 text-right">Gastos</th>
                      <th className="py-1.5 px-1.5 text-right">Líquido Geral</th>
                      <th className="py-1.5 px-1.5 text-right">Lucro Líq.</th>
                      <th className="py-1.5 px-1.5 text-right">Comissão Est.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellerBreakdown.map((r) => (
                      <tr key={r.key} className="border-b border-gray-300">
                        <td className="py-1.5 px-1.5 font-bold">{r.sellerName}</td>
                        <td className="py-1.5 px-1.5 text-right">R$ {r.salesGross.toFixed(2)} ({r.salesCount})</td>
                        <td className="py-1.5 px-1.5 text-right">R$ {r.salesCost.toFixed(2)}</td>
                        <td className="py-1.5 px-1.5 text-right">R$ {r.osGross.toFixed(2)} ({r.osCount})</td>
                        <td className="py-1.5 px-1.5 text-right">R$ {r.osCost.toFixed(2)}</td>
                        <td className="py-1.5 px-1.5 text-right font-bold">R$ {r.totalGross.toFixed(2)}</td>
                        <td className="py-1.5 px-1.5 text-right">R$ {r.totalCost.toFixed(2)}</td>
                        <td className="py-1.5 px-1.5 text-right text-red-600 font-semibold">R$ {(r.expensesTotal || 0).toFixed(2)}</td>
                        <td className="py-1.5 px-1.5 text-right font-bold">R$ {r.totalRevenue.toFixed(2)}</td>
                        <td className="py-1.5 px-1.5 text-right font-bold text-green-700">R$ {(r.netProfit ?? (r.grossProfit - (r.expensesTotal || 0))).toFixed(2)}</td>
                        <td className="py-1.5 px-1.5 text-right">
                          {r.commissionRate > 0 ? `R$ ${r.estimatedCommission.toFixed(2)}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 border-t-2 border-black font-black">
                      <td className="py-1.5 px-1.5">TOTAL GERAL</td>
                      <td className="py-1.5 px-1.5 text-right">R$ {sellerTotals.salesGross.toFixed(2)} ({sellerTotals.salesCount})</td>
                      <td className="py-1.5 px-1.5 text-right">R$ {sellerTotals.salesCost.toFixed(2)}</td>
                      <td className="py-1.5 px-1.5 text-right">R$ {sellerTotals.osGross.toFixed(2)} ({sellerTotals.osCount})</td>
                      <td className="py-1.5 px-1.5 text-right">R$ {sellerTotals.osCost.toFixed(2)}</td>
                      <td className="py-1.5 px-1.5 text-right">R$ {sellerTotals.totalGross.toFixed(2)}</td>
                      <td className="py-1.5 px-1.5 text-right">R$ {sellerTotals.totalCost.toFixed(2)}</td>
                      <td className="py-1.5 px-1.5 text-right text-red-600">R$ {sellerTotals.expensesTotal.toFixed(2)}</td>
                      <td className="py-1.5 px-1.5 text-right">R$ {sellerTotals.totalRevenue.toFixed(2)}</td>
                      <td className="py-1.5 px-1.5 text-right text-green-700">R$ {sellerTotals.netProfit.toFixed(2)}</td>
                      <td className="py-1.5 px-1.5 text-right">R$ {sellerTotals.estimatedCommission.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Movimentações */}
              <div>
                <h3 className="font-black uppercase text-xs mb-1.5 border-b border-gray-400 pb-1">
                  Lançamentos do Período ({unifiedEntries.length})
                </h3>
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-gray-200 border-b border-black">
                      <th className="py-1 px-1.5 text-left">Data</th>
                      <th className="py-1 px-1.5 text-left">Tipo/Nº</th>
                      <th className="py-1 px-1.5 text-left">Cliente</th>
                      <th className="py-1 px-1.5 text-left">Vendedor</th>
                      <th className="py-1 px-1.5 text-left">Pgto</th>
                      <th className="py-1 px-1.5 text-right">Bruto</th>
                      <th className="py-1 px-1.5 text-right">Custo</th>
                      <th className="py-1 px-1.5 text-right">Líquido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unifiedEntries.map((e) => (
                      <tr key={`${e.kind}-${e.id}`} className="border-b border-gray-200">
                        <td className="py-1 px-1.5">
                          {e.date ? new Date(e.date).toLocaleDateString('pt-BR') : '-'}
                        </td>
                        <td className="py-1 px-1.5 font-bold">{e.kind} #{e.number}</td>
                        <td className="py-1 px-1.5">{e.customerName}</td>
                        <td className="py-1 px-1.5">{e.sellerName}</td>
                        <td className="py-1 px-1.5">{e.paymentMethod}</td>
                        <td className="py-1 px-1.5 text-right">R$ {e.gross.toFixed(2)}</td>
                        <td className="py-1 px-1.5 text-right">R$ {e.cost.toFixed(2)}</td>
                        <td className="py-1 px-1.5 text-right font-bold">R$ {e.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
