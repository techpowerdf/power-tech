import { StoreSettings } from '../types';

export interface VisualCustomizationOptions {
  dashboardLogoSize: number;       // em px (padrão: 44, min: 28, max: 100)
  storeNameFontSize: number;       // em px (padrão: 14, min: 12, max: 32)
  storeNameColor: string;          // cor hex (padrão: '#ffffff')
  selectionTabFontSize: number;    // em px (padrão: 12, min: 10, max: 22)
  selectionTabActiveColor: string; // cor hex (padrão: '#2563eb')
  selectionTabTextColor: string;   // cor hex (padrão: '#ffffff')
  iconSizeGeneral: number;         // em px (padrão: 18, min: 12, max: 34)
  iconColorGeneral: string;        // cor hex ou '' para contextual (padrão: '')
  badgeFontSize: number;           // em px (padrão: 10, min: 8, max: 18)
  badgePadding: 'compacto' | 'padrao' | 'amplo' | 'destaque'; // padrão: 'padrao'
  priceHighlightColor: string;     // cor hex (padrão: '#34d399')
  primaryColor: string;            // cor hex (padrão: '#2563eb')
  customerNameFontSize: number;    // em px (padrão: 13, min: 10, max: 24)
  customerNameColor: string;       // cor hex (padrão: '#e2e8f0')
  osNumberFontSize: number;        // em px (padrão: 14, min: 10, max: 26)
  osNumberColor: string;           // cor hex (padrão: '#38bdf8')
  actionIconSize: number;          // em px (padrão: 14, min: 12, max: 26)
  statusColors: Record<string, string>;
}

export const DEFAULT_STATUS_COLORS: Record<string, string> = {
  aberta: '#3b82f6',
  analise: '#a855f7',
  orcamento: '#eab308',
  aprovada: '#06b6d4',
  manutencao: '#f59e0b',
  aguardando_peca: '#f97316',
  concluida: '#10b981',
  entregue: '#64748b',
  sem_reparo: '#71717a',
  descarte: '#525252',
  cancelada: '#f43f5e'
};

export const STATUS_LABELS: Record<string, string> = {
  aberta: 'Aberta',
  analise: 'Em Análise',
  orcamento: 'Orçamento',
  aprovada: 'Aprovada',
  manutencao: 'Na Bancada',
  aguardando_peca: 'Aguardando Peça',
  concluida: 'Pronta Retirada',
  entregue: 'Entregue',
  sem_reparo: 'Sem Reparo',
  descarte: 'Descarte',
  cancelada: 'Cancelada'
};

export const STATUS_LIST: Array<{ key: string; label: string; desc: string }> = [
  { key: 'aberta', label: 'Aberta', desc: 'OS recém-aberta aguardando atendimento' },
  { key: 'analise', label: 'Em Análise', desc: 'Técnico analisando o equipamento' },
  { key: 'orcamento', label: 'Orçamento', desc: 'Orçamento gerado aguardando cliente' },
  { key: 'aprovada', label: 'Aprovada', desc: 'Orçamento aprovado pelo cliente' },
  { key: 'manutencao', label: 'Na Bancada', desc: 'Serviço em andamento na bancada' },
  { key: 'aguardando_peca', label: 'Aguardando Peça', desc: 'Esperando chegada de componente' },
  { key: 'concluida', label: 'Pronta Retirada', desc: 'Serviço finalizado pronto para retirada' },
  { key: 'entregue', label: 'Entregue', desc: 'Equipamento retirado pelo cliente' },
  { key: 'sem_reparo', label: 'Sem Reparo', desc: 'Inviabilidade técnica de conserto' },
  { key: 'descarte', label: 'Descarte', desc: 'Equipamento abandonado para descarte' },
  { key: 'cancelada', label: 'Cancelada', desc: 'Ordem de serviço cancelada' }
];

export const DEFAULT_VISUAL_OPTIONS: VisualCustomizationOptions = {
  dashboardLogoSize: 44,
  storeNameFontSize: 14,
  storeNameColor: '#ffffff',
  selectionTabFontSize: 12,
  selectionTabActiveColor: '#2563eb',
  selectionTabTextColor: '#ffffff',
  iconSizeGeneral: 18,
  iconColorGeneral: '',
  badgeFontSize: 10,
  badgePadding: 'padrao',
  priceHighlightColor: '#34d399',
  primaryColor: '#2563eb',
  customerNameFontSize: 13,
  customerNameColor: '#e2e8f0',
  osNumberFontSize: 14,
  osNumberColor: '#38bdf8',
  actionIconSize: 14,
  statusColors: { ...DEFAULT_STATUS_COLORS }
};

export const COLOR_PALETTES = {
  brand: [
    { label: 'Branco Puro', hex: '#ffffff', textColor: '#020617' },
    { label: 'Azul Tech', hex: '#38bdf8', textColor: '#020617' },
    { label: 'Ciano Neon', hex: '#22d3ee', textColor: '#020617' },
    { label: 'Dourado Âmbar', hex: '#fbbf24', textColor: '#020617' },
    { label: 'Esmeralda', hex: '#34d399', textColor: '#020617' },
    { label: 'Violeta / Roxo', hex: '#a78bfa', textColor: '#020617' },
    { label: 'Rosa Vibrante', hex: '#f472b6', textColor: '#020617' },
    { label: 'Coral Laranja', hex: '#fb923c', textColor: '#020617' }
  ],
  primary: [
    { label: 'Azul Royal', hex: '#2563eb', textColor: '#ffffff' },
    { label: 'Ciano Oceano', hex: '#0891b2', textColor: '#ffffff' },
    { label: 'Verde Esmeralda', hex: '#059669', textColor: '#ffffff' },
    { label: 'Roxo Moderno', hex: '#7c3aed', textColor: '#ffffff' },
    { label: 'Âmbar Escuro', hex: '#d97706', textColor: '#ffffff' },
    { label: 'Rosa Pink', hex: '#db2777', textColor: '#ffffff' },
    { label: 'Vermelho Intenso', hex: '#dc2626', textColor: '#ffffff' },
    { label: 'Grafite Escuro', hex: '#334155', textColor: '#ffffff' }
  ],
  price: [
    { label: 'Verde Esmeralda', hex: '#34d399' },
    { label: 'Dourado / Ouro', hex: '#fbbf24' },
    { label: 'Ciano Elétrico', hex: '#38bdf8' },
    { label: 'Branco Brilhante', hex: '#f8fafc' },
    { label: 'Verde Limão', hex: '#a3e635' },
    { label: 'Rosa Néon', hex: '#f472b6' }
  ],
  customer: [
    { label: 'Cinza Claro', hex: '#e2e8f0' },
    { label: 'Branco Puro', hex: '#ffffff' },
    { label: 'Azul Claro', hex: '#93c5fd' },
    { label: 'Ciano Suave', hex: '#67e8f9' },
    { label: 'Amarelo Claro', hex: '#fde047' },
    { label: 'Verde Menta', hex: '#86efac' },
    { label: 'Rosa Claro', hex: '#f9a8d4' },
    { label: 'Laranja Claro', hex: '#fdba74' }
  ],
  osNumber: [
    { label: 'Ciano Elétrico', hex: '#38bdf8' },
    { label: 'Branco Puro', hex: '#ffffff' },
    { label: 'Azul Cobalto', hex: '#60a5fa' },
    { label: 'Dourado / Ouro', hex: '#fbbf24' },
    { label: 'Verde Esmeralda', hex: '#34d399' },
    { label: 'Roxo Neon', hex: '#c084fc' },
    { label: 'Laranja Solar', hex: '#fb923c' },
    { label: 'Rosa Pink', hex: '#f472b6' }
  ],
  statusSwatches: [
    '#3b82f6', '#06b6d4', '#10b981', '#84cc16',
    '#eab308', '#f59e0b', '#f97316', '#ef4444',
    '#f43f5e', '#ec4899', '#a855f7', '#8b5cf6',
    '#64748b', '#71717a', '#525252', '#334155'
  ]
};

export function hexToRgba(hex: string, alpha: number = 0.2): string {
  if (!hex) return `rgba(100, 116, 139, ${alpha})`;
  let c = hex.replace('#', '').trim();
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(100, 116, 139, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getStatusBadgeStyle(
  status: string,
  customColors?: Record<string, string>,
  badgeFontSize?: number,
  badgePadding?: 'compacto' | 'padrao' | 'amplo' | 'destaque'
): React.CSSProperties {
  const color = customColors?.[status] || DEFAULT_STATUS_COLORS[status] || '#64748b';

  let padding = '2px 9px';
  if (badgePadding === 'compacto') padding = '1px 6px';
  else if (badgePadding === 'padrao') padding = '2px 9px';
  else if (badgePadding === 'amplo') padding = '4px 12px';
  else if (badgePadding === 'destaque') padding = '6px 14px';

  return {
    backgroundColor: hexToRgba(color, 0.2),
    color: color,
    borderColor: hexToRgba(color, 0.45),
    borderWidth: '1px',
    borderStyle: 'solid',
    fontSize: badgeFontSize ? `${badgeFontSize}px` : 'var(--app-badge-font-size, 10px)',
    padding: padding,
    borderRadius: '9999px',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    letterSpacing: badgePadding === 'destaque' ? '0.05em' : 'normal',
    textTransform: badgePadding === 'destaque' ? 'uppercase' : 'none'
  };
}

/**
 * Aplica as variáveis CSS globais no :root do documento e atualiza o localStorage
 */
export const applyVisualCustomizations = (settings?: Partial<StoreSettings>) => {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  const logoSize =
    settings?.dashboardLogoSize !== undefined
      ? settings.dashboardLogoSize
      : Number(localStorage.getItem('powertech_logo_size') || DEFAULT_VISUAL_OPTIONS.dashboardLogoSize);

  const storeNameSize =
    settings?.storeNameFontSize !== undefined
      ? settings.storeNameFontSize
      : Number(localStorage.getItem('powertech_store_name_size') || DEFAULT_VISUAL_OPTIONS.storeNameFontSize);

  const storeNameColor =
    settings?.storeNameColor ||
    localStorage.getItem('powertech_store_name_color') ||
    DEFAULT_VISUAL_OPTIONS.storeNameColor;

  const tabFontSize =
    settings?.selectionTabFontSize !== undefined
      ? settings.selectionTabFontSize
      : Number(localStorage.getItem('powertech_tab_font_size') || DEFAULT_VISUAL_OPTIONS.selectionTabFontSize);

  const tabActiveColor =
    settings?.selectionTabActiveColor ||
    localStorage.getItem('powertech_tab_active_color') ||
    DEFAULT_VISUAL_OPTIONS.selectionTabActiveColor;

  const tabTextColor =
    settings?.selectionTabTextColor ||
    localStorage.getItem('powertech_tab_text_color') ||
    DEFAULT_VISUAL_OPTIONS.selectionTabTextColor;

  const iconSize =
    settings?.iconSizeGeneral !== undefined
      ? settings.iconSizeGeneral
      : Number(localStorage.getItem('powertech_icon_size') || DEFAULT_VISUAL_OPTIONS.iconSizeGeneral);

  const iconColor =
    settings?.iconColorGeneral !== undefined
      ? settings.iconColorGeneral
      : (localStorage.getItem('powertech_icon_color') || '');

  const badgeSize =
    settings?.badgeFontSize !== undefined
      ? settings.badgeFontSize
      : Number(localStorage.getItem('powertech_badge_font_size') || DEFAULT_VISUAL_OPTIONS.badgeFontSize);

  const badgePad =
    settings?.badgePadding ||
    (localStorage.getItem('powertech_badge_padding') as any) ||
    DEFAULT_VISUAL_OPTIONS.badgePadding;

  let badgePaddingCss = '2px 9px';
  if (badgePad === 'compacto') badgePaddingCss = '1px 6px';
  else if (badgePad === 'padrao') badgePaddingCss = '2px 9px';
  else if (badgePad === 'amplo') badgePaddingCss = '4px 12px';
  else if (badgePad === 'destaque') badgePaddingCss = '6px 14px';

  const priceColor =
    settings?.priceHighlightColor ||
    localStorage.getItem('powertech_price_color') ||
    DEFAULT_VISUAL_OPTIONS.priceHighlightColor;

  const primaryColor =
    settings?.primaryColor ||
    localStorage.getItem('powertech_primary_color') ||
    DEFAULT_VISUAL_OPTIONS.primaryColor;

  const customerNameSize =
    settings?.customerNameFontSize !== undefined
      ? settings.customerNameFontSize
      : Number(localStorage.getItem('powertech_customer_name_size') || DEFAULT_VISUAL_OPTIONS.customerNameFontSize);

  const customerNameColor =
    settings?.customerNameColor ||
    localStorage.getItem('powertech_customer_name_color') ||
    DEFAULT_VISUAL_OPTIONS.customerNameColor;

  const osNumberSize =
    settings?.osNumberFontSize !== undefined
      ? settings.osNumberFontSize
      : Number(localStorage.getItem('powertech_os_number_size') || DEFAULT_VISUAL_OPTIONS.osNumberFontSize);

  const osNumberColor =
    settings?.osNumberColor ||
    localStorage.getItem('powertech_os_number_color') ||
    DEFAULT_VISUAL_OPTIONS.osNumberColor;

  const actionIconSize =
    settings?.actionIconSize !== undefined
      ? settings.actionIconSize
      : Number(localStorage.getItem('powertech_action_icon_size') || DEFAULT_VISUAL_OPTIONS.actionIconSize);

  // Status colors
  let statusColors: Record<string, string> = { ...DEFAULT_STATUS_COLORS };
  if (settings?.statusColors) {
    statusColors = { ...statusColors, ...settings.statusColors };
  } else {
    try {
      const stored = localStorage.getItem('powertech_status_colors');
      if (stored) {
        statusColors = { ...statusColors, ...JSON.parse(stored) };
      }
    } catch (e) {
      // ignore
    }
  }

  // Aplica nas propriedades CSS do elemento raiz (documentElement)
  root.style.setProperty('--app-logo-size', `${logoSize}px`);
  root.style.setProperty('--app-store-name-size', `${storeNameSize}px`);
  root.style.setProperty('--app-store-name-color', storeNameColor);
  root.style.setProperty('--app-tab-font-size', `${tabFontSize}px`);
  root.style.setProperty('--app-tab-active-color', tabActiveColor);
  root.style.setProperty('--app-tab-active-text', tabTextColor);
  root.style.setProperty('--app-icon-size', `${iconSize}px`);
  root.style.setProperty('--app-badge-font-size', `${badgeSize}px`);
  root.style.setProperty('--app-badge-padding', badgePaddingCss);
  root.style.setProperty('--app-price-color', priceColor);
  root.style.setProperty('--app-primary-color', primaryColor);
  root.style.setProperty('--app-customer-name-size', `${customerNameSize}px`);
  root.style.setProperty('--app-customer-name-color', customerNameColor);
  root.style.setProperty('--app-os-number-size', `${osNumberSize}px`);
  root.style.setProperty('--app-os-number-color', osNumberColor);
  root.style.setProperty('--app-action-icon-size', `${actionIconSize}px`);

  if (iconColor) {
    root.style.setProperty('--app-icon-color', iconColor);
  } else {
    root.style.removeProperty('--app-icon-color');
  }

  // CSS variables for each status
  Object.entries(statusColors).forEach(([st, col]) => {
    root.style.setProperty(`--app-status-color-${st}`, col);
    root.style.setProperty(`--app-status-bg-${st}`, hexToRgba(col, 0.2));
    root.style.setProperty(`--app-status-border-${st}`, hexToRgba(col, 0.45));
  });

  // Persiste no localStorage
  try {
    localStorage.setItem('powertech_logo_size', String(logoSize));
    localStorage.setItem('powertech_store_name_size', String(storeNameSize));
    localStorage.setItem('powertech_store_name_color', storeNameColor);
    localStorage.setItem('powertech_tab_font_size', String(tabFontSize));
    localStorage.setItem('powertech_tab_active_color', tabActiveColor);
    localStorage.setItem('powertech_tab_text_color', tabTextColor);
    localStorage.setItem('powertech_icon_size', String(iconSize));
    localStorage.setItem('powertech_badge_font_size', String(badgeSize));
    localStorage.setItem('powertech_badge_padding', badgePad);
    localStorage.setItem('powertech_price_color', priceColor);
    localStorage.setItem('powertech_primary_color', primaryColor);
    localStorage.setItem('powertech_customer_name_size', String(customerNameSize));
    localStorage.setItem('powertech_customer_name_color', customerNameColor);
    localStorage.setItem('powertech_os_number_size', String(osNumberSize));
    localStorage.setItem('powertech_os_number_color', osNumberColor);
    localStorage.setItem('powertech_action_icon_size', String(actionIconSize));
    localStorage.setItem('powertech_status_colors', JSON.stringify(statusColors));

    if (iconColor) {
      localStorage.setItem('powertech_icon_color', iconColor);
    } else {
      localStorage.removeItem('powertech_icon_color');
    }
  } catch (e) {
    // ignorar erros de storage restrito
  }
};
