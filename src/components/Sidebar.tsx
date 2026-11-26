import React from 'react';
import {
  LayoutDashboard,
  Wrench,
  ShoppingCart,
  FileSpreadsheet,
  Package,
  Cpu,
  Users,
  Receipt,
  DatabaseBackup,
  Settings,
  PlusCircle,
  HardDrive,
  BarChart3,
  TrendingDown,
  Building2,
  X
} from 'lucide-react';
import { AuthUser } from '../types';

export type NavTab =
  | 'dashboard'
  | 'os'
  | 'pdv'
  | 'orcamentos'
  | 'produtos'
  | 'servicos'
  | 'clientes'
  | 'empresas'
  | 'despesas'
  | 'relatorios'
  | 'fiscal'
  | 'backup'
  | 'configuracoes';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  openOSCount?: number;
  lowStockCount?: number;
  backupOk?: boolean;
  onNewOSClick: () => void;
  onQuickBackupClick: () => void;
  currentUser?: AuthUser | null;
  storeName?: string;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  openOSCount = 0,
  lowStockCount = 0,
  backupOk = true,
  onNewOSClick,
  onQuickBackupClick,
  currentUser,
  storeName,
  isOpenMobile = false,
  onCloseMobile
}) => {
  const isAllowed = (tab: NavTab): boolean => {
    if (!currentUser) return true;
    if (currentUser.role === 'admin') return true;
    const perms = currentUser.permissions;
    if (!perms) return true;

    switch (tab) {
      case 'dashboard': return perms.dashboard !== false;
      case 'os': return perms.workOrders !== false;
      case 'pdv': return perms.pos !== false;
      case 'orcamentos': return perms.quotes !== false;
      case 'produtos': return perms.inventory !== false;
      case 'servicos': return perms.services !== false;
      case 'clientes': return perms.customers !== false;
      case 'empresas': return perms.companies !== false;
      case 'despesas': return perms.expenses !== false;
      case 'relatorios': return perms.reports !== false;
      case 'fiscal': return perms.fiscal !== false;
      case 'backup': return perms.backup !== false;
      case 'configuracoes': return perms.settings !== false;
      default: return true;
    }
  };

  const menuItems = [
    { id: 'dashboard' as NavTab, label: 'Painel Geral', icon: LayoutDashboard },
    {
      id: 'os' as NavTab,
      label: 'Ordens de Serviço',
      icon: Wrench,
      badge: openOSCount > 0 ? openOSCount : null,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    },
    { id: 'pdv' as NavTab, label: 'Ponto de Venda (PDV)', icon: ShoppingCart },
    { id: 'orcamentos' as NavTab, label: 'Orçamentos', icon: FileSpreadsheet },
    {
      id: 'produtos' as NavTab,
      label: 'Estoque & Peças',
      icon: Package,
      badge: lowStockCount > 0 ? lowStockCount : null,
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    },
    { id: 'servicos' as NavTab, label: 'Mão de Obra', icon: Cpu },
    { id: 'clientes' as NavTab, label: 'Clientes', icon: Users },
    { id: 'empresas' as NavTab, label: 'Empresas', icon: Building2 },
    { id: 'despesas' as NavTab, label: 'Gastos da Empresa', icon: TrendingDown },
    { id: 'relatorios' as NavTab, label: 'Faturamento Geral', icon: BarChart3 },
    { id: 'fiscal' as NavTab, label: 'Notas Fiscais', icon: Receipt },
    {
      id: 'backup' as NavTab,
      label: 'Backup Diário',
      icon: DatabaseBackup,
      badge: backupOk ? 'OK' : 'Pendente',
      badgeColor: backupOk
        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
        : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    },
    { id: 'configuracoes' as NavTab, label: 'Configurações', icon: Settings }
  ];

  const visibleMenuItems = menuItems.filter(item => isAllowed(item.id));

  const renderSidebarContent = (isMobile: boolean = false) => (
    <>
      {/* Brand Header */}
      <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between gap-3 bg-slate-950/80">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="app-brand-logo rounded-xl bg-white p-1 flex items-center justify-center shadow-md shadow-blue-500/10 shrink-0 border border-slate-700/60 overflow-hidden"
            style={{
              width: 'var(--app-logo-size, 44px)',
              height: 'var(--app-logo-size, 44px)'
            }}
          >
            <img src="/logo.png" alt="Logo da Loja" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <h1
              className="app-store-name font-extrabold tracking-wider uppercase truncate"
              style={{
                fontSize: 'var(--app-store-name-size, 14px)',
                color: 'var(--app-store-name-color, #ffffff)'
              }}
            >
              {storeName || 'Power Tech'}
            </h1>
            <p className="text-[10px] text-blue-400 font-semibold tracking-wide uppercase">Assistência & Vendas</p>
          </div>
        </div>

        {isMobile && onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition shrink-0"
            aria-label="Fechar menu"
            title="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Quick Action Buttons */}
      {(isAllowed('os') || isAllowed('backup')) && (
        <div className="p-3 space-y-2 border-b border-slate-800/60">
          {isAllowed('os') && (
            <button
              onClick={() => {
                onNewOSClick();
                if (isMobile && onCloseMobile) onCloseMobile();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition shadow-sm shadow-blue-600/30 active:scale-[0.98]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nova Ordem de Serviço</span>
            </button>
          )}

          {isAllowed('backup') && (
            <button
              onClick={() => {
                onQuickBackupClick();
                if (isMobile && onCloseMobile) onCloseMobile();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white font-medium text-xs border border-slate-700/60 transition active:scale-[0.98]"
              title="Executa cópia dos dados imediatamente"
            >
              <DatabaseBackup className="w-3.5 h-3.5 text-emerald-400" />
              <span>Fazer Backup Agora</span>
            </button>
          )}
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {visibleMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectTab(item.id);
                if (isMobile && onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-medium transition cursor-pointer text-left ${
                isActive
                  ? 'border shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 active:bg-slate-800'
              }`}
              style={{
                fontSize: 'var(--app-tab-font-size, 13px)',
                backgroundColor: isActive ? 'var(--app-tab-active-color, rgba(37, 99, 235, 0.2))' : undefined,
                color: isActive ? 'var(--app-tab-active-text, #ffffff)' : undefined,
                borderColor: isActive ? 'var(--app-tab-active-color, rgba(59, 130, 246, 0.4))' : undefined
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className="shrink-0 transition-all"
                  style={{
                    width: 'var(--app-icon-size, 16px)',
                    height: 'var(--app-icon-size, 16px)'
                  }}
                />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge !== null && item.badge !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold shrink-0 ml-1.5 ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 text-[11px] text-slate-400">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Banco Local Ativo
          </span>
          <span className="text-[10px] text-slate-400">v1.0.0</span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Sidebar Fixo para Computadores e Notebooks (Desktop) */}
      <aside className="hidden lg:flex w-64 bg-slate-950 border-r border-slate-800 flex-col h-screen select-none shrink-0 no-print">
        {renderSidebarContent(false)}
      </aside>

      {/* Drawer Lateral Mobile com Animação e Overlay de Fundo */}
      <div
        className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 no-print ${
          isOpenMobile ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop escurecido com toque para fechar */}
        <div
          className="absolute inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />

        {/* Painel lateral deslizante */}
        <aside
          className={`absolute top-0 bottom-0 left-0 w-72 max-w-[85vw] bg-slate-950 border-r border-slate-800 flex flex-col h-full select-none shadow-2xl transition-transform duration-300 ease-out z-10 ${
            isOpenMobile ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {renderSidebarContent(true)}
        </aside>
      </div>
    </>
  );
};
