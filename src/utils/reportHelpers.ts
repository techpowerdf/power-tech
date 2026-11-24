import { Sale, WorkOrder, Seller, Product, ServiceItem, Expense } from '../types';

export type ReportPeriod = 'diario' | 'semanal' | 'mensal' | 'anual';

export const UNASSIGNED_SELLER_KEY = '__SEM_VENDEDOR__';

/** Formata objeto Date para YYYY-MM-DD no fuso horário local. */
export function getLocalDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Formata objeto Date para YYYY-MM no fuso horário local. */
export function getLocalMonthStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/** Retorna a data de referência efetiva para faturamento de uma Ordem de Serviço. */
export function getWorkOrderEffectiveDate(os: WorkOrder): string | undefined {
  return os.deliveredDate || os.completionDate || os.entryDate || os.createdAt;
}

/** Verifica se uma data ISO/string pertence ao período de relatório selecionado. */
export function isDateInPeriod(
  dateStr: string | undefined,
  period: ReportPeriod,
  options: {
    selectedDate?: string;   // YYYY-MM-DD (para diário)
    selectedMonth?: string;  // YYYY-MM (para mensal)
    selectedYear?: string;   // YYYY (para anual)
  } = {}
): boolean {
  if (!dateStr) return false;
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return false;

  const now = new Date();

  if (period === 'diario') {
    const targetDay = options.selectedDate || getLocalDateStr(now);
    return getLocalDateStr(parsed) === targetDay;
  }

  if (period === 'semanal') {
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startSevenDays = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    return parsed >= startSevenDays && parsed <= endOfToday;
  }

  if (period === 'mensal') {
    const targetMonth = options.selectedMonth || getLocalMonthStr(now);
    return getLocalMonthStr(parsed) === targetMonth;
  }

  if (period === 'anual') {
    const targetYear = options.selectedYear || String(now.getFullYear());
    return String(parsed.getFullYear()) === targetYear;
  }

  return true;
}

const normText = (val?: string) => (val || '').trim().toUpperCase();

/** Calcula o valor bruto de uma venda (antes dos descontos). */
export function calculateSaleGross(sale: Sale): number {
  if (sale.subtotal !== undefined && Number(sale.subtotal) > 0) {
    return Number(sale.subtotal);
  }
  return Number(sale.total || 0) + Number(sale.discount || 0);
}

/** Calcula o custo total dos itens de uma venda (com fallback no catálogo de produtos/serviços). */
export function calculateSaleCost(
  sale: Sale,
  products: Product[] = [],
  services: ServiceItem[] = []
): number {
  return (sale.items || []).reduce((sum, it) => {
    const qty = Number(it.quantity || 1);
    let unitCost = 0;

    if (it.costPrice !== undefined && it.costPrice !== null) {
      unitCost = Number(it.costPrice) || 0;
    } else if (it.productId) {
      const prod = products.find((p) => p.id === it.productId);
      if (prod) unitCost = Number(prod.costPrice || 0);
    }

    if (unitCost === 0 && (it.costPrice === undefined || it.costPrice === null) && it.productName) {
      const cleanItemName = normText(it.productName).replace(/\s*\(AVULSO\)$/, '');
      const prodByName = products.find((p) => normText(p.name) === cleanItemName);
      if (prodByName) {
        unitCost = Number(prodByName.costPrice || 0);
      } else {
        const srvByName = services.find((s) => normText(s.name) === cleanItemName);
        if (srvByName) unitCost = Number(srvByName.costPrice || 0);
      }
    }

    return sum + qty * unitCost;
  }, 0);
}

/** Calcula o valor bruto de uma Ordem de Serviço (antes dos descontos). */
export function calculateWorkOrderGross(os: WorkOrder): number {
  const partsAndServices = Number(os.partsTotal || 0) + Number(os.servicesTotal || 0);
  if (partsAndServices > 0) return partsAndServices;
  return Number(os.total || 0) + Number(os.discount || 0);
}

/** Calcula o custo total dos itens (peças e mão de obra) de uma Ordem de Serviço. */
export function calculateWorkOrderCost(
  os: WorkOrder,
  products: Product[] = [],
  services: ServiceItem[] = []
): { totalCost: number; partsCost: number; servicesCost: number } {
  let partsCost = 0;
  let servicesCost = 0;

  (os.items || []).forEach((it) => {
    const qty = Number(it.quantity || 1);
    let unitCost = 0;

    if (it.costPrice !== undefined && it.costPrice !== null) {
      unitCost = Number(it.costPrice) || 0;
    } else if (it.type === 'peca') {
      const prod = it.productId
        ? products.find((p) => p.id === it.productId)
        : products.find((p) => normText(p.name) === normText(it.description));
      if (prod) unitCost = Number(prod.costPrice || 0);
    } else if (it.type === 'servico') {
      const srv = it.serviceId
        ? services.find((s) => s.id === it.serviceId)
        : services.find((s) => normText(s.name) === normText(it.description));
      if (srv) unitCost = Number(srv.costPrice || 0);
    }

    const itemTotalCost = qty * unitCost;
    if (it.type === 'peca') partsCost += itemTotalCost;
    else servicesCost += itemTotalCost;
  });

  return {
    totalCost: partsCost + servicesCost,
    partsCost,
    servicesCost
  };
}

export interface ResolvedSeller {
  key: string;
  sellerId?: string;
  sellerName: string;
  commissionRate: number;
  active: boolean;
  isUnassigned: boolean;
}

/** Resolve o vendedor responsável por uma venda ou OS comparando ID e nome cadastrado. */
export function resolveRecordSeller(
  record: { sellerId?: string; sellerName?: string },
  sellers: Seller[]
): ResolvedSeller {
  if (record.sellerId) {
    const foundById = sellers.find((s) => s.id === record.sellerId);
    if (foundById) {
      return {
        key: foundById.id,
        sellerId: foundById.id,
        sellerName: foundById.name,
        commissionRate: Number(foundById.commissionRate || 0),
        active: foundById.active !== false,
        isUnassigned: false
      };
    }
  }

  const recName = normText(record.sellerName);
  if (recName) {
    const foundByName = sellers.find((s) => normText(s.name) === recName);
    if (foundByName) {
      return {
        key: foundByName.id,
        sellerId: foundByName.id,
        sellerName: foundByName.name,
        commissionRate: Number(foundByName.commissionRate || 0),
        active: foundByName.active !== false,
        isUnassigned: false
      };
    }
    return {
      key: `name:${recName}`,
      sellerName: recName,
      commissionRate: 0,
      active: true,
      isUnassigned: false
    };
  }

  return {
    key: UNASSIGNED_SELLER_KEY,
    sellerName: 'SEM VENDEDOR / LOJA',
    commissionRate: 0,
    active: true,
    isUnassigned: true
  };
}

/** Verifica se um registro atende ao filtro selecionado de vendedor (`'todos'`, `UNASSIGNED_SELLER_KEY` ou `seller.id`). */
export function matchesSellerFilter(
  record: { sellerId?: string; sellerName?: string },
  sellerFilter: string,
  sellers: Seller[]
): boolean {
  if (!sellerFilter || sellerFilter === 'todos') return true;
  const resolved = resolveRecordSeller(record, sellers);
  return resolved.key === sellerFilter;
}

export interface SellerBreakdownRow {
  key: string;
  sellerId?: string;
  sellerName: string;
  commissionRate: number;
  active: boolean;
  isUnassigned: boolean;
  salesCount: number;
  salesGross: number;
  salesCost: number;
  salesDiscounts: number;
  salesNet: number;
  osCount: number;
  osGross: number;
  osServices: number;
  osParts: number;
  osCost: number;
  osDiscounts: number;
  osNet: number;
  totalCount: number;
  totalGross: number;
  totalCost: number;
  totalRevenue: number;
  expensesTotal: number;
  grossProfit: number;
  netProfit: number;
  estimatedCommission: number;
}

/** Consolida métricas de Vendas (PDV) e Ordens de Serviço separadas por vendedor, com Bruto, Custo, Gastos e Lucro. */
export function buildSellerBreakdown(
  sales: Sale[],
  workOrders: WorkOrder[],
  sellers: Seller[],
  products: Product[] = [],
  services: ServiceItem[] = [],
  expenses: Expense[] = []
): SellerBreakdownRow[] {
  const map: Record<string, SellerBreakdownRow> = {};

  const createEmptyRow = (opts: {
    key: string;
    sellerId?: string;
    sellerName: string;
    commissionRate: number;
    active: boolean;
    isUnassigned: boolean;
  }): SellerBreakdownRow => ({
    ...opts,
    salesCount: 0,
    salesGross: 0,
    salesCost: 0,
    salesDiscounts: 0,
    salesNet: 0,
    osCount: 0,
    osGross: 0,
    osServices: 0,
    osParts: 0,
    osCost: 0,
    osDiscounts: 0,
    osNet: 0,
    totalCount: 0,
    totalGross: 0,
    totalCost: 0,
    totalRevenue: 0,
    expensesTotal: 0,
    grossProfit: 0,
    netProfit: 0,
    estimatedCommission: 0
  });

  // Inicializa todos os vendedores ativos (para que apareçam no ranking mesmo se R$ 0 no período)
  sellers.forEach((s) => {
    if (s.active !== false) {
      map[s.id] = createEmptyRow({
        key: s.id,
        sellerId: s.id,
        sellerName: s.name,
        commissionRate: Number(s.commissionRate || 0),
        active: true,
        isUnassigned: false
      });
    }
  });

  const ensureRow = (resolved: ResolvedSeller): SellerBreakdownRow => {
    if (!map[resolved.key]) {
      map[resolved.key] = createEmptyRow(resolved);
    }
    return map[resolved.key];
  };

  sales.forEach((s) => {
    if (s.status === 'cancelada') return;
    const resolved = resolveRecordSeller(s, sellers);
    const row = ensureRow(resolved);
    const net = Number(s.total || 0);
    const disc = Number(s.discount || 0);
    const gross = calculateSaleGross(s);
    const cost = calculateSaleCost(s, products, services);

    row.salesCount += 1;
    row.salesGross += gross;
    row.salesCost += cost;
    row.salesDiscounts += disc;
    row.salesNet += net;

    row.totalCount += 1;
    row.totalGross += gross;
    row.totalCost += cost;
    row.totalRevenue += net;
  });

  workOrders.forEach((os) => {
    const resolved = resolveRecordSeller(os, sellers);
    const row = ensureRow(resolved);
    const net = Number(os.total || 0);
    const gross = calculateWorkOrderGross(os);
    const { totalCost } = calculateWorkOrderCost(os, products, services);

    row.osCount += 1;
    row.osGross += gross;
    row.osServices += Number(os.servicesTotal || 0);
    row.osParts += Number(os.partsTotal || 0);
    row.osCost += totalCost;
    row.osDiscounts += Number(os.discount || 0);
    row.osNet += net;

    row.totalCount += 1;
    row.totalGross += gross;
    row.totalCost += totalCost;
    row.totalRevenue += net;
  });

  (expenses || []).forEach((e) => {
    const val = Number(e.amount || 0);
    if (val <= 0) return;
    const resolved = resolveRecordSeller(e, sellers);
    const row = ensureRow(resolved);
    row.expensesTotal += val;
  });

  return Object.values(map)
    .map((row) => ({
      ...row,
      grossProfit: row.totalRevenue - row.totalCost,
      netProfit: row.totalRevenue - row.totalCost - row.expensesTotal,
      estimatedCommission:
        row.commissionRate > 0 ? (row.totalRevenue * row.commissionRate) / 100 : 0
    }))
    .filter((row) => row.totalCount > 0 || row.expensesTotal > 0 || !row.isUnassigned)
    .sort((a, b) => {
      if (a.isUnassigned !== b.isUnassigned) return a.isUnassigned ? 1 : -1;
      if (b.totalRevenue !== a.totalRevenue) return b.totalRevenue - a.totalRevenue;
      return a.sellerName.localeCompare(b.sellerName);
    });
}
