import React from 'react';
import { DatabaseBackup, Clock, ShieldCheck, Eye, EyeOff, LogOut, User as UserIcon } from 'lucide-react';
import { NavTab } from './Sidebar';
import { AuthUser } from '../types';

interface HeaderProps {
  currentTab: NavTab;
  storeName?: string;
  lastBackupText?: string;
  backupSuccess?: boolean;
  onOpenBackupTab: () => void;
  hideRevenue?: boolean;
  onToggleHideRevenue?: () => void;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

const TAB_TITLES: Record<NavTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Painel Geral de Controle',
    subtitle: 'Visão consolidada de ordens de serviço, vendas, metas e estoque'
  },
  os: {
    title: 'Ordens de Serviço (OS)',
    subtitle: 'Gestão de manutenções em computadores, notebooks, monitores e impressoras'
  },
  pdv: {
    title: 'Frente de Caixa (PDV)',
    subtitle: 'Venda ágil de produtos, peças e periféricos com múltiplos pagamentos'
  },
  orcamentos: {
    title: 'Orçamentos & Cotações',
    subtitle: 'Elaboração de propostas comerciais e conversão em OS ou Venda em 1 clique'
  },
  produtos: {
    title: 'Estoque de Peças & Produtos',
    subtitle: 'Catálogo de hardware, suprimentos de impressão e periféricos com alerta de reposição'
  },
  servicos: {
    title: 'Tabela de Mão de Obra',
    subtitle: 'Catálogo de serviços técnicos com tempo estimado e garantia'
  },
  clientes: {
    title: 'Cadastro de Clientes',
    subtitle: 'Base de clientes com histórico completo de compras e aparelhos consertados'
  },
  empresas: {
    title: 'Gestão de Empresas & Planos Corporativos',
    subtitle: 'Contratos corporativos, parque de equipamentos com controle de patrimônio e histórico de manutenções'
  },
  despesas: {
    title: 'Gastos & Despesas da Empresa',
    subtitle: 'Controle de despesas operacionais, custos por vendedor e impacto no faturamento líquido'
  },
  relatorios: {
    title: 'Relatório de Faturamento Geral',
    subtitle: 'Consolidado diário, semanal, mensal e anual (Vendas + Serviços) separado por vendedor'
  },
  fiscal: {
    title: 'Emissão Fiscal (NF-e & NFS-e)',
    subtitle: 'Gerenciamento de notas fiscais de venda de produtos e prestação de serviços'
  },
  backup: {
    title: 'Segurança & Backup Diário',
    subtitle: 'Rotinas automáticas diárias, histórico de cópias e restauração do sistema'
  },
  configuracoes: {
    title: 'Configurações do Sistema',
    subtitle: 'Dados cadastrais da empresa, termo de garantia legal e preferências'
  }
};

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  storeName = 'Power Tech',
  lastBackupText = 'Hoje',
  backupSuccess = true,
  onOpenBackupTab,
  hideRevenue = false,
  onToggleHideRevenue,
  currentUser,
  onLogout
}) => {
  const currentInfo = TAB_TITLES[currentTab] || {
    title: 'Power Tech',
    subtitle: 'Sistema Comercial e Assistência Técnica'
  };

  const todayFormatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  return (
    <header className="bg-slate-900 border-b border-slate-800/80 px-6 py-4 flex items-center justify-between no-print shrink-0">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">{currentInfo.title}</h2>
        <p className="text-xs text-slate-400 mt-0.5">{currentInfo.subtitle}</p>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Botão de Ocultar/Exibir Faturamentos */}
        {onToggleHideRevenue && (
          <button
            type="button"
            onClick={onToggleHideRevenue}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition active:scale-95 ${
              hideRevenue
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25 shadow-sm shadow-amber-500/10'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
            }`}
            title={
              hideRevenue
                ? 'Valores financeiros ocultados. Clique para exibir os faturamentos.'
                : 'Clique para ocultar os faturamentos e valores do sistema (Modo Balcão/Privacidade).'
            }
          >
            {hideRevenue ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">Faturamento Oculto</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="hidden sm:inline">Ocultar Faturamento</span>
              </>
            )}
          </button>
        )}

        {/* Date Display */}
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          <span className="capitalize">{todayFormatted}</span>
        </div>

        {/* Backup Status Pill */}
        <button
          onClick={onOpenBackupTab}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            backupSuccess
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
          }`}
          title="Clique para abrir as configurações de backup"
        >
          {backupSuccess ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          ) : (
            <DatabaseBackup className="w-4 h-4 text-amber-400" />
          )}
          <span>Backup Diário: {lastBackupText}</span>
        </button>

        {/* Usuário e Logout */}
        {currentUser && (
          <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/60 rounded-xl px-2.5 py-1">
            <div className="w-6 h-6 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center text-xs">
              <UserIcon className="w-3.5 h-3.5" />
            </div>
            <div className="text-left hidden lg:block">
              <span className="text-[11px] font-bold text-white block leading-tight truncate max-w-[100px]">
                {currentUser.name.split(' ')[0]}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-mono">
                {currentUser.role}
              </span>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition ml-1"
                title="Sair do sistema (Logout)"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Store Identifier */}
        <div className="text-right">
          <span className="text-xs font-semibold text-slate-200 block">{storeName}</span>
          <span className="text-[10px] text-emerald-400 flex items-center gap-1 justify-end">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Sistema Operacional
          </span>
        </div>
      </div>
    </header>
  );
};
