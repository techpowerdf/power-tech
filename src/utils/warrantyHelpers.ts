import { Product, ServiceItem } from '../types';

export const WARRANTY_PRESET_OPTIONS = [
  { value: 0, label: 'Sem garantia' },
  { value: 7, label: '7 dias' },
  { value: 15, label: '15 dias' },
  { value: 30, label: '30 dias' },
  { value: 60, label: '60 dias' },
  { value: 90, label: '90 dias (Padrão CDC)' },
  { value: 180, label: '180 dias (6 meses)' },
  { value: 365, label: '365 dias (1 ano)' }
] as const;

export const WARRANTY_PRESET_VALUES = new Set<number>(
  WARRANTY_PRESET_OPTIONS.map((o) => o.value)
);

/** Formata o prazo de garantia em texto legível (tratando 0 como "Sem garantia"). */
export function formatWarrantyLabel(days?: number): string {
  const num = days === undefined || days === null || Number.isNaN(Number(days))
    ? 90
    : Math.max(0, Math.round(Number(days)));

  if (num === 0) return 'Sem garantia';
  if (num === 365) return '365 dias (1 ano)';
  return `${num} ${num === 1 ? 'dia' : 'dias'}`;
}

/** Versão curta para badges de tabela e cards. */
export function formatWarrantyShort(days?: number): string {
  const num = days === undefined || days === null || Number.isNaN(Number(days))
    ? 90
    : Math.max(0, Math.round(Number(days)));
  if (num === 0) return 'Sem garantia';
  return `${num}d garantia`;
}

/**
 * Resolve o prazo de garantia de um item (prioriza o campo no item;
 * caso ausente, busca automaticamente no catálogo de serviços ou produtos).
 */
export function resolveItemWarrantyDays(
  item: {
    warrantyDays?: number;
    productId?: string;
    serviceId?: string;
    type?: string;
    productName?: string;
    description?: string;
  },
  products: Product[] = [],
  services: ServiceItem[] = []
): number {
  if (item.warrantyDays !== undefined && item.warrantyDays !== null && !Number.isNaN(Number(item.warrantyDays))) {
    return Math.max(0, Math.round(Number(item.warrantyDays)));
  }

  if (item.serviceId) {
    const srv = services.find((s) => s.id === item.serviceId);
    if (srv && srv.defaultWarrantyDays !== undefined && srv.defaultWarrantyDays !== null) {
      return Math.max(0, Math.round(Number(srv.defaultWarrantyDays)));
    }
  }

  if (item.productId) {
    const prod = products.find((p) => p.id === item.productId);
    if (prod && prod.warrantyDays !== undefined && prod.warrantyDays !== null) {
      return Math.max(0, Math.round(Number(prod.warrantyDays)));
    }
    const srvByProdId = services.find((s) => s.id === item.productId);
    if (srvByProdId && srvByProdId.defaultWarrantyDays !== undefined && srvByProdId.defaultWarrantyDays !== null) {
      return Math.max(0, Math.round(Number(srvByProdId.defaultWarrantyDays)));
    }
  }

  return 90;
}

/**
 * Calcula a garantia consolidada de uma lista de itens (OS ou Venda):
 * - Lista vazia -> 90 dias (padrão)
 * - Todos os itens com 0 -> 0 ("Sem garantia")
 * - Caso haja itens com garantia positiva -> maior prazo aplicável entre eles
 */
export function computeAggregateWarrantyDays(
  items: Array<{
    warrantyDays?: number;
    productId?: string;
    serviceId?: string;
    type?: string;
    productName?: string;
    description?: string;
  }> = [],
  products: Product[] = [],
  services: ServiceItem[] = []
): number {
  if (!items || items.length === 0) return 90;

  const resolved = items.map((it) => resolveItemWarrantyDays(it, products, services));
  const maxDays = Math.max(...resolved);
  return Math.max(0, maxDays);
}

/**
 * Gera o texto de termo de garantia adaptado exatamente ao prazo configurado.
 */
export function formatDynamicWarrantyTerms(
  warrantyDays: number | undefined,
  storeWarrantyTerms?: string,
  mode: 'os' | 'sale' = 'os'
): string {
  const days = warrantyDays === undefined || warrantyDays === null || Number.isNaN(Number(warrantyDays))
    ? 90
    : Math.max(0, Math.round(Number(warrantyDays)));

  if (days === 0) {
    return mode === 'sale'
      ? 'Produto(s)/serviço(s) vendido(s) sem garantia conforme acordado entre as partes.'
      : 'Serviço/equipamento sem garantia conforme acordado entre as partes.';
  }

  const dayWord = `${days} ${days === 1 ? 'dia' : 'dias'}`;

  if (mode === 'sale') {
    const cdcSuffix = days === 90 ? ' (Art. 26 do Código de Defesa do Consumidor)' : '';
    return `Garantia de ${dayWord} para peças, produtos e serviços contra defeitos de fabricação${cdcSuffix}. Guarde este comprovante para efeito de troca ou assistência técnica. Agradecemos a sua preferência!`;
  }

  const baseTerms =
    storeWarrantyTerms && storeWarrantyTerms.trim()
      ? storeWarrantyTerms.trim()
      : '1. A garantia cobre exclusivamente os serviços executados e peças substituídas pelo prazo de 90 dias (conforme Art. 26 do Código de Defesa do Consumidor).\n2. A garantia é automaticamente invalidada em caso de violação dos lacres internos, queda física, derramamento de líquidos, descargas elétricas ou intervenção de terceiros.\n3. O cliente tem o prazo máximo de 90 dias para retirar o equipamento pronto ou com orçamento recusado, sob pena de cobrança de taxa de guarda ou descarte conforme a lei.';

  if (days === 90) {
    return baseTerms;
  }

  if (/pelo prazo de\s+90\s+dias/i.test(baseTerms)) {
    return baseTerms.replace(/pelo prazo de\s+90\s+dias/i, `pelo prazo de ${dayWord}`);
  }

  return `Prazo de garantia concedido nesta OS: ${dayWord}.\n${baseTerms}`;
}
