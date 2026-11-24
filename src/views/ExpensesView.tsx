import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingDown,
  Plus,
  Search,
  Calendar,
  Filter,
  Trash2,
  Edit2,
  DollarSign,
  Utensils,
  ShoppingBag,
  Wrench,
  Wifi,
  Droplets,
  Zap,
  FileText,
  Building2,
  Fuel,
  Receipt,
  Users,
  Eye,
  EyeOff,
  CheckCircle2,
  BarChart3,
  X,
  CreditCard,
  Wallet,
  Sparkles,
  Tag,
  Briefcase
} from 'lucide-react';
import { Expense, ExpenseCategory, ExpenseCategoryDef, Seller, StoreSettings } from '../types';
import {
  ReportPeriod,
  UNASSIGNED_SELLER_KEY,
  getLocalDateStr,
  getLocalMonthStr,
  isDateInPeriod
} from '../utils/reportHelpers';
import { AdminPasswordModal, useAdminPasswordModal } from '../components/AdminPasswordModal';

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategoryDef[] = [
  {
    id: 'alimentacao',
    label: 'Alimentação',
    shortLabel: 'Alimentação',
    iconName: 'Utensils',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15',
    borderColor: 'border-amber-500/30'
  },
  {
    id: 'compra_mercadoria',
    label: 'Compra de Mercadoria',
    shortLabel: 'Mercadorias',
    iconName: 'ShoppingBag',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/15',
    borderColor: 'border-indigo-500/30'
  },
  {
    id: 'compra_equipamento',
    label: 'Compra de Equipamento',
    shortLabel: 'Equipamentos',
    iconName: 'Wrench',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/15',
    borderColor: 'border-cyan-500/30'
  },
  {
    id: 'internet',
    label: 'Contas de Internet',
    shortLabel: 'Internet',
    iconName: 'Wifi',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/15',
    borderColor: 'border-blue-500/30'
  },
  {
    id: 'agua',
    label: 'Conta de Água',
    shortLabel: 'Água',
    iconName: 'Droplets',
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/15',
    borderColor: 'border-sky-500/30'
  },
  {
    id: 'energia',
    label: 'Conta de Energia',
    shortLabel: 'Energia',
    iconName: 'Zap',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/15',
    borderColor: 'border-yellow-500/30'
  },
  {
    id: 'imposto',
    label: 'Impostos & Taxas',
    shortLabel: 'Imposto',
    iconName: 'FileText',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/15',
    borderColor: 'border-rose-500/30'
  },
  {
    id: 'dasmei',
    label: 'DAS-MEI',
    shortLabel: 'DAS-MEI',
    iconName: 'Building2',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/15',
    borderColor: 'border-emerald-500/30'
  },
  {
    id: 'gasolina',
    label: 'Gasolina / Combustível',
    shortLabel: 'Gasolina',
    iconName: 'Fuel',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/15',
    borderColor: 'border-orange-500/30'
  },
  {
    id: 'outros',
    label: 'Outros Gastos',
    shortLabel: 'Outros',
    iconName: 'Receipt',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/15',
    borderColor: 'border-slate-500/30'
  }
];

export const resolveCategoryIcon = (iconName?: string): React.ComponentType<{ className?: string }> => {
  switch (iconName) {
    case 'Utensils': return Utensils;
    case 'ShoppingBag': return ShoppingBag;
    case 'Wrench': return Wrench;
    case 'Wifi': return Wifi;
    case 'Droplets': return Droplets;
    case 'Zap': return Zap;
    case 'FileText': return FileText;
    case 'Building2': return Building2;
    case 'Fuel': return Fuel;
    case 'DollarSign': return DollarSign;
    case 'Tag': return Tag;
    case 'Briefcase': return Briefcase;
    case 'Users': return Users;
    case 'Wallet': return Wallet;
    case 'CreditCard': return CreditCard;
    case 'Sparkles': return Sparkles;
    case 'Receipt':
    default:
      return Receipt;
  }
};

export const PAYMENT_METHODS = [
  'DINHEIRO',
  'PIX',
  'CARTÃO DE CRÉDITO',
  'CARTÃO DE DÉBITO',
  'BOLETO',
  'TRANSFERÊNCIA',
  'A COMBINAR'
];

interface ExpensesViewProps {
  expenses: Expense[];
  sellers: Seller[];
  storeSettings?: StoreSettings;
  onSaveExpense: (expense: Partial<Expense>) => Promise<void>;
  onDeleteExpense: (id: string, adminPassword?: string) => Promise<void>;
  hideRevenue?: boolean;
  onToggleHideRevenue?: () => void;
  onOpenGeneralReport?: () => void;
  openCreateTrigger?: number;
  onResetCreateTrigger?: () => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses = [],
  sellers = [],
  storeSettings,
  onSaveExpense,
  onDeleteExpense,
  hideRevenue = false,
  onToggleHideRevenue,
  onOpenGeneralReport,
  openCreateTrigger,
  onResetCreateTrigger
}) => {
  const now = new Date();
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('mensal');
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateStr(now));
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getLocalMonthStr(now));
  const [selectedYear, setSelectedYear] = useState<string>(() => String(now.getFullYear()));
  const [sellerFilter, setSellerFilter] = useState<string>('todos');
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal de Novo / Editar Gasto
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Confirmação com Senha do Administrador
  const { requestConfirmation: requestAdminConfirmation, modalProps: adminModalProps } = useAdminPasswordModal();
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form State
  const [formDescription, setFormDescription] = useState<string>('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('alimentacao');
  const [formDate, setFormDate] = useState<string>(() => getLocalDateStr(new Date()));
  const [formSellerId, setFormSellerId] = useState<string>('');
  const [formPaymentMethod, setFormPaymentMethod] = useState<string>('DINHEIRO');
  const [formNotes, setFormNotes] = useState<string>('');

  const activeCategories = useMemo<ExpenseCategoryDef[]>(() => {
    if (storeSettings?.expenseCategories && storeSettings.expenseCategories.length > 0) {
      return storeSettings.expenseCategories;
    }
    return DEFAULT_EXPENSE_CATEGORIES;
  }, [storeSettings?.expenseCategories]);

  const openNewModal = (defaultCategory?: ExpenseCategory) => {
    setEditingExpense(null);
    setFormDescription('');
    setFormAmount('');
    setFormCategory(defaultCategory || (activeCategories[0]?.id as ExpenseCategory) || 'alimentacao');
    setFormDate(getLocalDateStr(new Date()));
    setFormSellerId('');
    setFormPaymentMethod('DINHEIRO');
    setFormNotes('');
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (openCreateTrigger && openCreateTrigger > 0) {
      openNewModal();
      onResetCreateTrigger?.();
    }
  }, [openCreateTrigger, onResetCreateTrigger]);

  const openEditModal = (exp: Expense) => {
    setEditingExpense(exp);
    setFormDescription(exp.description || '');
    setFormAmount(exp.amount !== undefined ? String(exp.amount) : '');
    setFormCategory(exp.category || 'outros');
    setFormDate(exp.date ? exp.date.substring(0, 10) : getLocalDateStr(new Date()));
    setFormSellerId(exp.sellerId || '');
    setFormPaymentMethod(exp.paymentMethod || 'DINHEIRO');
    setFormNotes(exp.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDesc = formDescription.trim().toUpperCase();
    if (!cleanDesc) {
      alert('Por favor, informe a descrição do gasto.');
      return;
    }

    const parsedAmount = parseFloat(String(formAmount).replace(',', '.')) || 0;
    if (parsedAmount <= 0) {
      alert('Por favor, informe um valor de gasto válido (maior que zero).');
      return;
    }

    const chosenSeller = formSellerId ? sellers.find((s) => s.id === formSellerId) : undefined;

    setIsSaving(true);
    try {
      await onSaveExpense({
        id: editingExpense ? editingExpense.id : undefined,
        description: cleanDesc,
        amount: parsedAmount,
        category: formCategory,
        date: formDate,
        sellerId: formSellerId || undefined,
        sellerName: chosenSeller ? chosenSeller.name.toUpperCase() : undefined,
        paymentMethod: (formPaymentMethod || 'DINHEIRO').toUpperCase(),
        notes: formNotes.trim().toUpperCase() || undefined
      });
      setIsModalOpen(false);
    } catch (err: any) {
      alert(`Erro ao salvar gasto: ${err.message || 'Falha na comunicação'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (exp: Expense) => {
    requestAdminConfirmation({
      title: 'Excluir Gasto / Despesa',
      itemDescription: `Gasto "${exp.description}" - R$ ${exp.amount.toFixed(2)} (${exp.paymentMethod || 'Dinheiro'})`,
      actionType: 'delete',
      onConfirm: async (adminPassword) => {
        try {
          await onDeleteExpense(exp.id, adminPassword);
        } catch (err: any) {
          alert(`Erro ao excluir: ${err.message}`);
        }
      }
    });
  };

  const periodOptions = useMemo(
    () => ({ selectedDate, selectedMonth, selectedYear }),
    [selectedDate, selectedMonth, selectedYear]
  );

  // Gastos no período
  const expensesInPeriod = useMemo(() => {
    return expenses.filter((e) => {
      const d = e.date || e.createdAt;
      return isDateInPeriod(d, reportPeriod, periodOptions);
    });
  }, [expenses, reportPeriod, periodOptions]);

  // Filtrados por vendedor, categoria e busca
  const filteredExpenses = useMemo(() => {
    return expensesInPeriod.filter((e) => {
      if (sellerFilter !== 'todos') {
        if (sellerFilter === UNASSIGNED_SELLER_KEY) {
          if (e.sellerId) return false;
        } else if (e.sellerId !== sellerFilter) {
          return false;
        }
      }

      if (categoryFilter !== 'todas' && e.category !== categoryFilter) {
        return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchDesc = (e.description || '').toLowerCase().includes(q);
        const matchSeller = (e.sellerName || '').toLowerCase().includes(q);
        const matchNotes = (e.notes || '').toLowerCase().includes(q);
        const matchCat = (e.category || '').toLowerCase().includes(q);
        if (!matchDesc && !matchSeller && !matchNotes && !matchCat) return false;
      }

      return true;
    });
  }, [expensesInPeriod, sellerFilter, categoryFilter, searchTerm]);

  // Totais do Período
  const metrics = useMemo(() => {
    const totalExpenses = filteredExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
    const count = filteredExpenses.length;

    // Gastos por categoria
    const byCategory: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount || 0);
    });

    // Categoria com maior gasto
    let topCategory = '';
    let topCategoryVal = 0;
    Object.entries(byCategory).forEach(([cat, val]) => {
      if (val > topCategoryVal) {
        topCategoryVal = val;
        topCategory = cat;
      }
    });

    // Gastos com vendedor vs gerais da loja
    const sellerExpensesTotal = filteredExpenses
      .filter((e) => Boolean(e.sellerId))
      .reduce((acc, e) => acc + Number(e.amount || 0), 0);

    const storeExpensesTotal = filteredExpenses
      .filter((e) => !e.sellerId)
      .reduce((acc, e) => acc + Number(e.amount || 0), 0);

    return {
      totalExpenses,
      count,
      byCategory,
      topCategory,
      topCategoryVal,
      sellerExpensesTotal,
      storeExpensesTotal
    };
  }, [filteredExpenses]);

  // Detalhamento por Vendedor (quem gastou o quê no período)
  const sellerExpenseBreakdown = useMemo(() => {
    const map: Record<string, { sellerName: string; sellerId?: string; total: number; count: number }> = {};

    expensesInPeriod.forEach((e) => {
      const key = e.sellerId || UNASSIGNED_SELLER_KEY;
      const sName = e.sellerId
        ? sellers.find((s) => s.id === e.sellerId)?.name || e.sellerName || 'VENDEDOR'
        : 'GERAL / EMPRESA';

      if (!map[key]) {
        map[key] = { sellerName: sName, sellerId: e.sellerId, total: 0, count: 0 };
      }
      map[key].total += Number(e.amount || 0);
      map[key].count += 1;
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [expensesInPeriod, sellers]);

  const getCategoryConfig = (cat: ExpenseCategory | string) => {
    const found = activeCategories.find((c) => c.id === cat || c.label.toLowerCase() === String(cat).toLowerCase());
    if (found) return found;
    return {
      id: String(cat),
      label: String(cat).toUpperCase(),
      shortLabel: String(cat).toUpperCase(),
      iconName: 'Receipt',
      color: 'text-slate-400',
      bgColor: 'bg-slate-500/15',
      borderColor: 'border-slate-500/30'
    };
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-600/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shadow-lg shadow-rose-500/10 shrink-0">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white tracking-wide uppercase">Gastos & Despesas da Empresa</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Saídas Operacionais
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Controle de compras, alimentação, contas fixas e gastos atrelados por vendedor
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onToggleHideRevenue && (
            <button
              onClick={onToggleHideRevenue}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold"
              title={hideRevenue ? 'Mostrar valores' : 'Ocultar valores'}
            >
              {hideRevenue ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
              <span>{hideRevenue ? 'Valores Ocultos' : 'Ocultar'}</span>
            </button>
          )}

          {onOpenGeneralReport && (
            <button
              onClick={onOpenGeneralReport}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5"
            >
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <span>Ver no Faturamento Geral</span>
            </button>
          )}

          <button
            onClick={() => openNewModal()}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-rose-600/20 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Inserir Novo Gasto</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Gastos */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de Gastos</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-400 font-mono">
              {hideRevenue ? '••••••' : `R$ ${metrics.totalExpenses.toFixed(2)}`}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              <strong>{metrics.count}</strong> {metrics.count === 1 ? 'gasto registrado' : 'gastos registrados'} no período
            </p>
          </div>
        </div>

        {/* Gastos da Loja / Geral */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gastos Gerais da Loja</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black text-white font-mono">
              {hideRevenue ? '••••••' : `R$ ${metrics.storeExpensesTotal.toFixed(2)}`}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Contas fixas, impostos e despesas da empresa
            </p>
          </div>
        </div>

        {/* Gastos Atrelados a Vendedores */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gastos por Vendedor</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-black text-purple-300 font-mono">
              {hideRevenue ? '••••••' : `R$ ${metrics.sellerExpensesTotal.toFixed(2)}`}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Gasolina, refeições e compras vinculadas à equipe
            </p>
          </div>
        </div>

        {/* Maior Categoria */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Maior Categoria</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm font-bold text-amber-300 truncate">
              {metrics.topCategory ? getCategoryConfig(metrics.topCategory).label : 'Nenhum gasto'}
            </div>
            <div className="text-lg font-black text-white font-mono mt-0.5">
              {hideRevenue ? '••••••' : `R$ ${metrics.topCategoryVal.toFixed(2)}`}
            </div>
          </div>
        </div>
      </div>

      {/* Seletor Rápido de Categorias (Abas de Tipos de Gastos) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-rose-400" />
            <span>Categorias de Gastos (Filtrar ou Lançar Rápido)</span>
          </span>
          <span className="text-[11px] text-slate-400">
            Clique na categoria para filtrar a tabela ou no botão "+" para lançar
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          <button
            type="button"
            onClick={() => setCategoryFilter('todas')}
            className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
              categoryFilter === 'todas'
                ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/20'
                : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <div>
              <span className="text-xs font-bold block">Todas as Categorias</span>
              <span className="text-[10px] opacity-80 block font-mono">
                {hideRevenue ? '••••••' : `R$ ${metrics.totalExpenses.toFixed(2)}`}
              </span>
            </div>
          </button>

          {activeCategories.map((cat) => {
            const Icon = resolveCategoryIcon(cat.iconName);
            const isCatActive = categoryFilter === cat.id;
            const catTotal = metrics.byCategory[cat.id] || 0;
            return (
              <div
                key={cat.id}
                className={`p-2.5 rounded-xl border transition flex items-center justify-between group ${
                  isCatActive
                    ? 'bg-slate-800 border-rose-500 shadow-sm'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setCategoryFilter(isCatActive ? 'todas' : cat.id)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  <div className={`w-7 h-7 rounded-lg ${cat.bgColor} ${cat.color} flex items-center justify-center shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block truncate">{cat.shortLabel}</span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {hideRevenue ? '••••' : `R$ ${catTotal.toFixed(2)}`}
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => openNewModal(cat.id)}
                  className="w-6 h-6 rounded-lg bg-slate-900 hover:bg-rose-600 text-slate-400 hover:text-white flex items-center justify-center transition shrink-0 opacity-80 group-hover:opacity-100"
                  title={`Lançar novo gasto em ${cat.label}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filtros de Período e Vendedor */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
        {/* Seletor de Período */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          {(['diario', 'semanal', 'mensal', 'anual'] as ReportPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setReportPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition ${
                reportPeriod === p
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Inputs de Data conforme período */}
        <div className="flex items-center gap-2 flex-wrap">
          {reportPeriod === 'diario' && (
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
              <Calendar className="w-4 h-4 text-rose-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none"
              />
            </div>
          )}

          {reportPeriod === 'mensal' && (
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
              <Calendar className="w-4 h-4 text-rose-400" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none"
              />
            </div>
          )}

          {reportPeriod === 'anual' && (
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
              <Calendar className="w-4 h-4 text-rose-400" />
              <input
                type="number"
                min="2020"
                max="2035"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-transparent text-xs text-white w-20 focus:outline-none"
              />
            </div>
          )}

          {/* Filtro de Vendedor */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 shadow-sm">
            <Users className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider hidden sm:inline">Vendedor:</span>
            <select
              value={sellerFilter}
              onChange={(e) => setSellerFilter(e.target.value)}
              className="bg-slate-900 text-xs text-white font-semibold focus:outline-none cursor-pointer border-0 py-0.5"
            >
              <option value="todos" className="bg-slate-900 text-white font-semibold py-1">
                Todos os Gastos (Geral + Vendedores)
              </option>
              <option value={UNASSIGNED_SELLER_KEY} className="bg-slate-900 text-white font-semibold py-1">
                Somente Gastos da Loja / Empresa
              </option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-900 text-white font-semibold py-1">
                  Vendedor: {s.name} {s.active === false ? '(Inativo)' : ''}
                </option>
              ))}
            </select>
            {sellerFilter !== 'todos' && (
              <button
                type="button"
                onClick={() => setSellerFilter('todos')}
                className="text-[10px] text-purple-300 hover:text-white px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/40 transition font-bold"
                title="Limpar filtro de vendedor"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Busca por texto */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar gasto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 w-44"
            />
          </div>
        </div>
      </div>

      {/* Gastos por Vendedor (Card Resumo da Equipe) */}
      {sellerExpenseBreakdown.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Gastos Vinculados por Vendedor no Período
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              Clique em um vendedor para filtrar ou nos relatórios para apurar o faturamento líquido
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {sellerExpenseBreakdown.map((row) => {
              const targetKey = row.sellerId || UNASSIGNED_SELLER_KEY;
              const isSelected = sellerFilter === targetKey;
              return (
                <div
                  key={row.sellerName}
                  onClick={() => setSellerFilter(isSelected ? 'todos' : targetKey)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                    isSelected
                      ? 'bg-purple-600/20 border-purple-500/60 shadow-md ring-1 ring-purple-500/40'
                      : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                  title="Clique para filtrar gastos deste vendedor"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-200 block truncate">{row.sellerName}</span>
                      {isSelected && (
                        <span className="text-[9px] bg-purple-600 text-white font-bold px-1.5 py-0.2 rounded-full uppercase">
                          Filtrado
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block">{row.count} {row.count === 1 ? 'lançamento' : 'lançamentos'}</span>
                  </div>
                  <div className="text-right font-mono font-black text-rose-400 text-sm whitespace-nowrap">
                    {hideRevenue ? '••••••' : `R$ ${row.total.toFixed(2)}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabela Principal de Gastos */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Lançamentos de Gastos ({filteredExpenses.length})
            </h3>
          </div>
          <span className="text-xs font-bold font-mono text-rose-400">
            Total exibido: {hideRevenue ? '••••••' : `R$ ${metrics.totalExpenses.toFixed(2)}`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/90 text-[11px] font-bold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Descrição do Gasto</th>
                <th className="py-3 px-4">Categoria / Tipo</th>
                <th className="py-3 px-4">Vendedor Atrelado</th>
                <th className="py-3 px-4">Pagamento</th>
                <th className="py-3 px-4 text-right">Valor</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredExpenses.length > 0 ? (
                filteredExpenses.map((exp) => {
                  const catCfg = getCategoryConfig(exp.category);
                  const Icon = resolveCategoryIcon(catCfg.iconName);
                  return (
                    <tr key={exp.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                        {exp.date ? new Date(exp.date + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <strong className="text-white block font-semibold">{exp.description}</strong>
                        {exp.notes && (
                          <span className="text-[10px] text-slate-400 italic block mt-0.5">{exp.notes}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${catCfg.bgColor} ${catCfg.color} ${catCfg.borderColor}`}
                        >
                          <Icon className="w-3 h-3" />
                          <span>{catCfg.label}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {exp.sellerName ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            <Users className="w-2.5 h-2.5" />
                            <span>{exp.sellerName}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-semibold">Geral / Empresa</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-300 text-[11px]">
                        {exp.paymentMethod || 'DINHEIRO'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold text-rose-400 text-sm">
                        {hideRevenue ? '••••••' : `R$ ${Number(exp.amount || 0).toFixed(2)}`}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(exp)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            title="Editar este gasto"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(exp)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition"
                            title="Excluir este gasto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                    Nenhum gasto encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE INSERÇÃO / EDIÇÃO DE GASTO */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600/20 text-rose-400 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    {editingExpense ? 'Editar Lançamento de Gasto' : 'Inserir Novo Gasto da Empresa'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Registre a despesa, escolha o tipo e vincule ao vendedor responsável
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Descrição do Gasto */}
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Descrição do Gasto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Almoço da equipe de sábado, Fatura Enel Energia, Gasolina entrega moto..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 font-medium"
                  autoFocus
                />
              </div>

              {/* SELEÇÃO POR ABAS DO TIPO DO GASTO (conforme pedido pelo usuário) */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                <label className="text-xs text-slate-300 font-semibold flex items-center justify-between">
                  <span>Tipo / Categoria do Gasto *</span>
                  <span className="text-[10px] text-rose-400 font-bold">
                    Selecionado: {getCategoryConfig(formCategory).label}
                  </span>
                </label>

                {/* Abas com botões de cada categoria */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-1">
                  {activeCategories.map((cat) => {
                    const Icon = resolveCategoryIcon(cat.iconName);
                    const isSelected = formCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setFormCategory(cat.id)}
                        className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition ${
                          isSelected
                            ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : cat.color}`} />
                        <span className="truncate">{cat.shortLabel || cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Valor e Data */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">
                    Valor do Gasto (R$) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">R$</span>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      placeholder="0,00"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-rose-400 font-bold font-mono focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">
                    Data do Gasto *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Vendedor Vinculado e Forma de Pagamento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-semibold flex items-center justify-between mb-1">
                    <span>Vendedor Vinculado</span>
                    <span className="text-[10px] text-slate-500">Opcional</span>
                  </label>
                  <select
                    value={formSellerId}
                    onChange={(e) => setFormSellerId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-rose-500 cursor-pointer"
                  >
                    <option value="" className="bg-slate-900 text-white font-semibold py-1">
                      Geral / Despesa da Empresa (Sem Vendedor)
                    </option>
                    {sellers.map((s) => (
                      <option key={s.id} value={s.id} className="bg-slate-900 text-white font-semibold py-1">
                        {s.name} {s.active === false ? '(Inativo)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Se vinculado, esse gasto será deduzido do faturamento deste vendedor nos relatórios.
                  </p>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-rose-500 cursor-pointer"
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm} value={pm} className="bg-slate-900 text-white font-semibold py-1">
                        {pm}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Observações / Detalhes Adicionais
                </label>
                <textarea
                  rows={2}
                  placeholder="Número de nota fiscal, comprovante, justificativa ou detalhes do gasto..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-rose-600/30 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSaving ? 'Salvando...' : editingExpense ? 'Atualizar Gasto' : 'Salvar Gasto'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE SENHA DO ADMINISTRADOR PARA EXCLUSÃO */}
      <AdminPasswordModal {...adminModalProps} />
    </div>
  );
};
