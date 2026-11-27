import React, { useState, useEffect } from 'react';
import { api, getAuthToken, setAuthToken, setOnUnauthorizedCallback } from './services/api';
import {
  Customer,
  Product,
  ServiceItem,
  WorkOrder,
  Sale,
  Quote,
  FiscalConfig,
  FiscalInvoice,
  BackupSettings,
  BackupHistoryItem,
  StoreSettings,
  ThemeMode,
  FontFamily,
  FontSizeText,
  FontSizeHeading,
  FontSizeFooter,
  AuthUser,
  Seller,
  Expense
} from './types';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { PrintModal } from './components/PrintModal';

import { DashboardView } from './views/DashboardView';
import { WorkOrdersView } from './views/WorkOrdersView';
import { PosView } from './views/PosView';
import { QuotesView } from './views/QuotesView';
import { InventoryView } from './views/InventoryView';
import { ServicesView } from './views/ServicesView';
import { CustomersView } from './views/CustomersView';
import { CompaniesView } from './views/CompaniesView';
import { FiscalView } from './views/FiscalView';
import { BackupView } from './views/BackupView';
import { SettingsView } from './views/SettingsView';
import { ExpensesView } from './views/ExpensesView';
import { RevenueReportView } from './views/RevenueReportView';
import { LoginView } from './views/LoginView';
import { applyVisualCustomizations } from './utils/themeCustomizer';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Entities State
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fiscalInvoices, setFiscalInvoices] = useState<FiscalInvoice[]>([]);
  const [fiscalConfig, setFiscalConfig] = useState<FiscalConfig | null>(null);
  const [backupSettings, setBackupSettings] = useState<BackupSettings | null>(null);
  const [backupHistory, setBackupHistory] = useState<BackupHistoryItem[]>([]);
  const [backupFiles, setBackupFiles] = useState<any[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);

  // Print Modal
  const [printModalData, setPrintModalData] = useState<{
    type: 'os' | 'sale' | 'quote';
    data: any;
    initialOSCopiesMode?: 'inteira' | 'ambas' | 'cliente';
  } | null>(null);

  // Quick action modal trigger & navigation triggers
  const [resetToOverviewTrigger, setResetToOverviewTrigger] = useState<number>(0);
  const [openCreateOSTrigger, setOpenCreateOSTrigger] = useState<number>(0);
  const [openCreateExpenseTrigger, setOpenCreateExpenseTrigger] = useState<number>(0);

  // Opção de Ocultar/Exibir Faturamentos (Modo Privacidade / Balcão)
  const [hideRevenue, setHideRevenue] = useState<boolean>(() => {
    try {
      return localStorage.getItem('powertech_hide_revenue') === 'true';
    } catch {
      return false;
    }
  });

  const toggleHideRevenue = () => {
    setHideRevenue((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('powertech_hide_revenue', String(next));
      } catch {}
      return next;
    });
  };

  // Configurações Visuais e Tipografia
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('powertech_theme') as ThemeMode) || 'escuro';
  });
  const [fontFamily, setFontFamily] = useState<FontFamily>(() => {
    return (localStorage.getItem('powertech_font_family') as FontFamily) || 'system';
  });
  const [fontSizeText, setFontSizeText] = useState<FontSizeText>(() => {
    return (localStorage.getItem('powertech_font_size_text') as FontSizeText) || 'padrao';
  });
  const [fontSizeHeading, setFontSizeHeading] = useState<FontSizeHeading>(() => {
    return (localStorage.getItem('powertech_font_size_heading') as FontSizeHeading) || 'padrao';
  });
  const [fontSizeFooter, setFontSizeFooter] = useState<FontSizeFooter>(() => {
    return (localStorage.getItem('powertech_font_size_footer') as FontSizeFooter) || 'padrao';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    document.documentElement.setAttribute('data-font-family', fontFamily);
    document.documentElement.setAttribute('data-font-size-text', fontSizeText);
    document.documentElement.setAttribute('data-font-size-heading', fontSizeHeading);
    document.documentElement.setAttribute('data-font-size-footer', fontSizeFooter);

    localStorage.setItem('powertech_theme', themeMode);
    localStorage.setItem('powertech_font_family', fontFamily);
    localStorage.setItem('powertech_font_size_text', fontSizeText);
    localStorage.setItem('powertech_font_size_heading', fontSizeHeading);
    localStorage.setItem('powertech_font_size_footer', fontSizeFooter);

    applyVisualCustomizations();
  }, [themeMode, fontFamily, fontSizeText, fontSizeHeading, fontSizeFooter]);

  const handleLivePreviewSettings = (preview: Partial<StoreSettings>) => {
    if (preview.themeMode) setThemeMode(preview.themeMode);
    if (preview.fontFamily) setFontFamily(preview.fontFamily);
    if (preview.fontSizeText) setFontSizeText(preview.fontSizeText);
    if (preview.fontSizeHeading) setFontSizeHeading(preview.fontSizeHeading);
    if (preview.fontSizeFooter) setFontSizeFooter(preview.fontSizeFooter);
    applyVisualCustomizations(preview);
  };

  // Load all initial data
  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        dashRes,
        osRes,
        prodRes,
        servRes,
        custRes,
        salesRes,
        quotesRes,
        fiscInvRes,
        fiscConfRes,
        bkpRes,
        settingsRes,
        sellersRes,
        expensesRes
      ] = await Promise.all([
        api.getDashboard(),
        api.getWorkOrders(),
        api.getProducts(),
        api.getServices(),
        api.getCustomers(),
        api.getSales(),
        api.getQuotes(),
        api.getFiscalInvoices(),
        api.getFiscalConfig(),
        api.getBackupInfo(),
        api.getSettings(),
        api.getSellers().catch(() => []),
        api.getExpenses().catch(() => [])
      ]);

      setDashboardData(dashRes);
      setWorkOrders(osRes);
      setProducts(prodRes);
      setServices(servRes);
      setCustomers(custRes);
      setSales(salesRes);
      setQuotes(quotesRes);
      setSellers(sellersRes || []);
      setExpenses(expensesRes || []);
      setFiscalInvoices(fiscInvRes);
      setFiscalConfig(fiscConfRes);
      setBackupSettings(bkpRes.settings);
      setBackupHistory(bkpRes.history);
      setBackupFiles(bkpRes.files);
      setStoreSettings(settingsRes);
      applyVisualCustomizations(settingsRes);
      if (settingsRes?.themeMode) setThemeMode(settingsRes.themeMode);
      if (settingsRes?.fontFamily) setFontFamily(settingsRes.fontFamily);
      if (settingsRes?.fontSizeText) setFontSizeText(settingsRes.fontSizeText);
      if (settingsRes?.fontSizeHeading) setFontSizeHeading(settingsRes.fontSizeHeading);
      if (settingsRes?.fontSizeFooter) setFontSizeFooter(settingsRes.fontSizeFooter);
    } catch (err: any) {
      console.error('Erro ao carregar dados:', err);
      setError(err.message || 'Erro ao comunicar com o servidor local.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setOnUnauthorizedCallback(() => {
      setCurrentUser(null);
      setAuthToken(null);
    });

    const token = getAuthToken();
    if (token) {
      api.getMe()
        .then((res) => {
          setCurrentUser(res.user);
          return loadAllData();
        })
        .catch((err) => {
          console.warn('Sessão expirada ou não autenticada:', err);
          setAuthToken(null);
          setCurrentUser(null);
          setLoading(false);
        })
        .finally(() => {
          setAuthChecking(false);
        });
    } else {
      setAuthChecking(false);
      setLoading(false);
    }
  }, []);

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setDashboardData(null);
    setWorkOrders([]);
    setProducts([]);
    setServices([]);
    setCustomers([]);
    setSales([]);
    setQuotes([]);
    setSellers([]);
    setExpenses([]);
  };

  // Redirecionamento automático caso o operador logado não possua permissão na aba atual
  useEffect(() => {
    if (!currentUser || currentUser.role === 'admin' || !currentUser.permissions) return;
    const perms = currentUser.permissions;
    const isTabPermitted = (tab: NavTab): boolean => {
      switch (tab) {
        case 'dashboard': return perms.dashboard !== false;
        case 'os': return perms.workOrders !== false;
        case 'pdv': return perms.pos !== false;
        case 'orcamentos': return perms.quotes !== false;
        case 'produtos': return perms.inventory !== false;
        case 'servicos': return perms.services !== false;
        case 'clientes': return perms.customers !== false;
        case 'despesas': return perms.expenses !== false;
        case 'relatorios': return perms.reports !== false;
        case 'fiscal': return perms.fiscal !== false;
        case 'backup': return perms.backup !== false;
        case 'configuracoes': return perms.settings !== false;
        default: return true;
      }
    };

    if (!isTabPermitted(currentTab)) {
      const tabsInOrder: NavTab[] = [
        'dashboard',
        'os',
        'pdv',
        'orcamentos',
        'produtos',
        'servicos',
        'clientes',
        'despesas',
        'relatorios',
        'fiscal',
        'backup',
        'configuracoes'
      ];
      const fallbackTab = tabsInOrder.find(isTabPermitted) || 'dashboard';
      setCurrentTab(fallbackTab);
    }
  }, [currentUser, currentTab]);

  // Fechar modal de impressão/recibo ao pressionar tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && printModalData) {
        setPrintModalData(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [printModalData]);

  // Handlers para OS
  const handleSaveWorkOrder = async (osData: Partial<WorkOrder>): Promise<WorkOrder | void> => {
    let result: WorkOrder | undefined;
    if (osData.id) {
      result = await api.updateWorkOrder(osData.id, osData);
    } else {
      const created = await api.createWorkOrder(osData);
      result = created;
      if (storeSettings?.autoPrintAfterSave) {
        setPrintModalData({ type: 'os', data: created });
      }
    }
    await loadAllData();
    return result;
  };

  const handleDeleteWorkOrder = async (id: string, adminPassword?: string) => {
    await api.deleteWorkOrder(id, adminPassword);
    await loadAllData();
  };

  // Handlers para Vendas (PDV)
  const handleFinishSale = async (saleData: Partial<Sale>) => {
    const created = await api.createSale(saleData);
    await loadAllData();
    return created;
  };

  const handleCancelSale = async (id: string, adminPassword?: string) => {
    await api.cancelSale(id, adminPassword);
    await loadAllData();
  };

  // Handlers para Orçamentos
  const handleCreateQuote = async (quoteData: Partial<Quote>) => {
    await api.createQuote(quoteData);
    await loadAllData();
  };

  const handleUpdateQuote = async (id: string, quoteData: Partial<Quote>) => {
    await api.updateQuote(id, quoteData);
    await loadAllData();
  };

  const handleConvertToOS = async (quoteId: string) => {
    const res = await api.convertQuoteToOS(quoteId);
    alert(res.message);
    await loadAllData();
    setCurrentTab('os');
    setResetToOverviewTrigger((prev) => prev + 1);
  };

  // Handlers para Produtos
  const handleSaveProduct = async (prodData: Partial<Product>) => {
    if (prodData.id) {
      await api.updateProduct(prodData.id, prodData);
    } else {
      await api.createProduct(prodData);
    }
    await loadAllData();
  };

  const handleDeleteProduct = async (id: string, adminPassword?: string) => {
    await api.deleteProduct(id, adminPassword);
    await loadAllData();
  };

  // Handlers para Serviços
  const handleSaveService = async (srvData: Partial<ServiceItem>) => {
    if (srvData.id) {
      await api.updateService(srvData.id, srvData);
    } else {
      await api.createService(srvData);
    }
    await loadAllData();
  };

  const handleDeleteService = async (id: string, adminPassword?: string) => {
    await api.deleteService(id, adminPassword);
    await loadAllData();
  };

  // Handlers para Clientes
  const handleSaveCustomer = async (custData: Partial<Customer>) => {
    let saved: Customer;
    if (custData.id) {
      saved = await api.updateCustomer(custData.id, custData);
    } else {
      saved = await api.createCustomer(custData);
    }
    await loadAllData();
    return saved;
  };

  const handleDeleteCustomer = async (id: string, adminPassword?: string) => {
    await api.deleteCustomer(id, adminPassword);
    await loadAllData();
  };

  // Handlers para Vendedores & Atribuição em Vendas
  const handleSaveSeller = async (sellerData: Partial<Seller>) => {
    if (sellerData.id) {
      await api.updateSeller(sellerData.id, sellerData);
    } else {
      await api.createSeller(sellerData);
    }
    await loadAllData();
  };

  const handleDeleteSeller = async (id: string, adminPassword?: string) => {
    await api.deleteSeller(id, adminPassword);
    await loadAllData();
  };

  const handleUpdateSaleSeller = async (saleId: string, sellerId: string, sellerName: string) => {
    await api.updateSaleSeller(saleId, sellerId, sellerName);
    await loadAllData();
  };

  // Handlers para Despesas / Gastos da Empresa
  const handleSaveExpense = async (expData: Partial<Expense>) => {
    if (expData.id) {
      await api.updateExpense(expData.id, expData);
    } else {
      await api.createExpense(expData);
    }
    await loadAllData();
  };

  const handleDeleteExpense = async (id: string, adminPassword?: string) => {
    await api.deleteExpense(id, adminPassword);
    await loadAllData();
  };

  // Handlers para Módulo Fiscal
  const handleEmitFiscal = async (payload: any) => {
    const res = await api.emitInvoice(payload);
    await loadAllData();
    return res;
  };

  const handleUpdateFiscalConfig = async (cfg: Partial<FiscalConfig>) => {
    await api.updateFiscalConfig(cfg);
    await loadAllData();
  };

  // Handlers para Backup
  const handleRunBackup = async (customDest?: string) => {
    const res = await api.runBackupNow(customDest);
    await loadAllData();
    return res;
  };

  const handleUpdateBackupSettings = async (settings: Partial<BackupSettings>) => {
    await api.updateBackupSettings(settings);
    await loadAllData();
  };

  const handleRestoreBackup = async (filePath: string) => {
    return api.restoreBackup(filePath);
  };

  // Handlers para Configurações da Loja
  const handleSaveSettings = async (settings: Partial<StoreSettings>) => {
    if (settings.themeMode) setThemeMode(settings.themeMode);
    if (settings.fontFamily) setFontFamily(settings.fontFamily);
    if (settings.fontSizeText) setFontSizeText(settings.fontSizeText);
    if (settings.fontSizeHeading) setFontSizeHeading(settings.fontSizeHeading);
    if (settings.fontSizeFooter) setFontSizeFooter(settings.fontSizeFooter);
    applyVisualCustomizations(settings);
    await api.updateSettings(settings);
    await loadAllData();
  };

  // Disparo Rápido de Backup na Barra
  const handleQuickBackup = async () => {
    try {
      const res = await api.runBackupNow();
      alert(`Backup seguro gerado com sucesso!\nArquivo: ${res.fileName}\nTamanho: ${(res.size / 1024).toFixed(1)} KB`);
      await loadAllData();
    } catch (err: any) {
      alert(`Falha ao realizar backup: ${err.message}`);
    }
  };

  const handleQuickNewOS = () => {
    setCurrentTab('os');
    setOpenCreateOSTrigger((prev) => prev + 1);
  };

  const handleQuickNewExpense = () => {
    setCurrentTab('despesas');
    setOpenCreateExpenseTrigger((prev) => prev + 1);
  };
  // Verificando autenticação salva na inicialização
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-16 h-16 rounded-2xl bg-white p-2 flex items-center justify-center mb-4 shadow-xl shadow-blue-500/10">
          <img src="/logo.png" alt="Power Tech Logo" className="w-full h-full object-contain" />
        </div>
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <h2 className="text-lg font-extrabold tracking-wider uppercase">Power Tech</h2>
        <p className="text-xs text-slate-400 mt-1">Verificando credenciais de acesso seguro...</p>
      </div>
    );
  }

  // Não autenticado -> tela de Login
  if (!currentUser) {
    return (
      <LoginView
        storeName={storeSettings?.tradeName || 'Power Tech'}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          loadAllData();
        }}
      />
    );
  }

  // Loading Screen
  if (loading && !dashboardData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-16 h-16 rounded-2xl bg-white p-2 flex items-center justify-center mb-4 shadow-xl shadow-blue-500/10">
          <img src="/logo.png" alt="Power Tech Logo" className="w-full h-full object-contain" />
        </div>
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <h2 className="text-lg font-extrabold tracking-wider uppercase">Power Tech</h2>
        <p className="text-xs text-slate-400 mt-1">Carregando banco de dados local e verificando backup diário...</p>
      </div>
    );
  }

  // Error fallback
  if (error && !dashboardData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl max-w-md">
          <h2 className="text-base font-bold text-rose-400">Falha ao Conectar ao Servidor Local</h2>
          <p className="text-xs text-slate-400 mt-2">{error}</p>
          <button
            onClick={() => loadAllData()}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  const openOSCount = dashboardData?.metrics?.openOSCount || 0;
  const lowStockCount = dashboardData?.metrics?.lowStockCount || 0;
  const backupOk = backupSettings?.lastBackupStatus === 'sucesso';
  const lastBackupText = backupSettings?.lastBackupAt
    ? new Date(backupSettings.lastBackupAt).toLocaleDateString('pt-BR')
    : 'Pendente';

  return (
    <div
      className="app-root-shell flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans"
      data-theme={themeMode}
      data-font-family={fontFamily}
      data-font-size-text={fontSizeText}
      data-font-size-heading={fontSizeHeading}
      data-font-size-footer={fontSizeFooter}
    >
      {/* Sidebar Lateral (Desktop e Gaveta Mobile) */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setOpenCreateExpenseTrigger(0);
          if (tab === 'os') {
            setResetToOverviewTrigger((prev) => prev + 1);
          }
        }}
        openOSCount={openOSCount}
        lowStockCount={lowStockCount}
        backupOk={backupOk}
        onNewOSClick={handleQuickNewOS}
        onQuickBackupClick={handleQuickBackup}
        currentUser={currentUser}
        storeName={storeSettings?.tradeName || storeSettings?.storeName || 'Power Tech'}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Área Central Principal */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header Superior */}
        <Header
          currentTab={currentTab}
          storeName={storeSettings?.tradeName || 'Power Tech'}
          lastBackupText={lastBackupText}
          backupSuccess={backupOk}
          onOpenBackupTab={() => setCurrentTab('backup')}
          hideRevenue={hideRevenue}
          onToggleHideRevenue={toggleHideRevenue}
          currentUser={currentUser}
          onLogout={handleLogout}
          onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
        />

        {/* Conteúdo Dinâmico das Telas */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-slate-950">
          {currentTab === 'dashboard' && dashboardData && (
            <DashboardView
              metrics={dashboardData.metrics}
              recentWorkOrders={dashboardData.recentWorkOrders}
              recentSales={dashboardData.recentSales}
              lowStockProducts={dashboardData.lowStockProducts}
              backupSettings={backupSettings || undefined}
              onNavigate={(tab) => {
                setCurrentTab(tab);
                if (tab === 'os') {
                  setResetToOverviewTrigger((prev) => prev + 1);
                }
              }}
              onNewOS={handleQuickNewOS}
              onNewSale={() => setCurrentTab('pdv')}
              onNewQuote={() => setCurrentTab('orcamentos')}
              onNewExpense={handleQuickNewExpense}
              onQuickBackup={handleQuickBackup}
              onPrintOS={(os) => setPrintModalData({ type: 'os', data: os })}
              onPrintSale={(sale) => setPrintModalData({ type: 'sale', data: sale })}
              hideRevenue={hideRevenue}
              onToggleHideRevenue={toggleHideRevenue}
              storeName={storeSettings?.tradeName || storeSettings?.storeName || 'Power Tech'}
              storeSettings={storeSettings || undefined}
            />
          )}

          {currentTab === 'os' && (
            <WorkOrdersView
              workOrders={workOrders}
              customers={customers}
              products={products}
              services={services}
              sales={sales}
              sellers={sellers}
              storeSettings={storeSettings || undefined}
              canDelete={currentUser?.role === 'admin' || currentUser?.permissions?.workOrdersDelete !== false}
              onSaveWorkOrder={handleSaveWorkOrder}
              onDeleteWorkOrder={handleDeleteWorkOrder}
              onPrintWorkOrder={(os, copiesMode) => setPrintModalData({ type: 'os', data: os, initialOSCopiesMode: copiesMode })}
              onSaveProduct={handleSaveProduct}
              onSaveService={handleSaveService}
              openCreateModalTrigger={openCreateOSTrigger}
              resetToOverviewTrigger={resetToOverviewTrigger}
              onOpenGeneralReport={() => setCurrentTab('relatorios')}
              hideRevenue={hideRevenue}
              onToggleHideRevenue={toggleHideRevenue}
            />
          )}

          {currentTab === 'pdv' && (
            <PosView
              products={products}
              services={services}
              customers={customers}
              sales={sales}
              workOrders={workOrders}
              sellers={sellers}
              storeSettings={storeSettings || undefined}
              onFinishSale={handleFinishSale}
              onCancelSale={handleCancelSale}
              onUpdateSaleSeller={handleUpdateSaleSeller}
              onPrintSale={(sale) => setPrintModalData({ type: 'sale', data: sale })}
              onPrintOS={(os) => setPrintModalData({ type: 'os', data: os })}
              onSaveCustomer={handleSaveCustomer}
              onSaveProduct={handleSaveProduct}
              onSaveService={handleSaveService}
              onOpenGeneralReport={() => setCurrentTab('relatorios')}
              hideRevenue={hideRevenue}
              onToggleHideRevenue={toggleHideRevenue}
            />
          )}

          {currentTab === 'orcamentos' && (
            <QuotesView
              quotes={quotes}
              customers={customers}
              products={products}
              services={services}
              storeSettings={storeSettings || undefined}
              onCreateQuote={handleCreateQuote}
              onUpdateQuote={handleUpdateQuote}
              onConvertToOS={handleConvertToOS}
              onPrintQuote={(quote) => setPrintModalData({ type: 'quote', data: quote })}
            />
          )}

          {currentTab === 'produtos' && (
            <InventoryView
              products={products}
              services={services}
              onSaveProduct={handleSaveProduct}
              onDeleteProduct={handleDeleteProduct}
              onSaveService={handleSaveService}
              onDeleteService={handleDeleteService}
            />
          )}

          {currentTab === 'servicos' && (
            <ServicesView
              services={services}
              onSaveService={handleSaveService}
              onDeleteService={handleDeleteService}
            />
          )}

          {currentTab === 'clientes' && (
            <CustomersView
              customers={customers}
              workOrders={workOrders}
              sales={sales}
              storeSettings={storeSettings || undefined}
              onSaveCustomer={handleSaveCustomer}
              onDeleteCustomer={handleDeleteCustomer}
              onPrintOS={(os) => setPrintModalData({ type: 'os', data: os })}
              onPrintSale={(sale) => setPrintModalData({ type: 'sale', data: sale })}
              onNewOS={(customer) => {
                setCurrentTab('os');
                setOpenCreateOSTrigger((prev) => prev + 1);
              }}
              onNewSale={(customer) => {
                setCurrentTab('pdv');
              }}
            />
          )}

          {currentTab === 'empresas' && (
            <CompaniesView
              storeSettings={storeSettings || undefined}
              onNavigateToOS={(companyName) => {
                setCurrentTab('os');
              }}
            />
          )}

          {currentTab === 'despesas' && (
            <ExpensesView
              expenses={expenses}
              sellers={sellers}
              storeSettings={storeSettings || undefined}
              onSaveExpense={handleSaveExpense}
              onDeleteExpense={handleDeleteExpense}
              hideRevenue={hideRevenue}
              onToggleHideRevenue={toggleHideRevenue}
              onOpenGeneralReport={() => setCurrentTab('relatorios')}
              openCreateTrigger={openCreateExpenseTrigger}
              onResetCreateTrigger={() => setOpenCreateExpenseTrigger(0)}
            />
          )}

          {currentTab === 'relatorios' && (
            <RevenueReportView
              sales={sales}
              workOrders={workOrders}
              sellers={sellers}
              expenses={expenses}
              products={products}
              services={services}
              storeSettings={storeSettings || undefined}
              hideRevenue={hideRevenue}
              onToggleHideRevenue={toggleHideRevenue}
            />
          )}

          {currentTab === 'fiscal' && fiscalConfig && (
            <FiscalView
              invoices={fiscalInvoices}
              config={fiscalConfig}
              customers={customers}
              products={products}
              services={services}
              onEmitInvoice={handleEmitFiscal}
              onUpdateConfig={handleUpdateFiscalConfig}
            />
          )}

          {currentTab === 'backup' && backupSettings && (
            <BackupView
              settings={backupSettings}
              history={backupHistory}
              files={backupFiles}
              onRunBackup={handleRunBackup}
              onUpdateSettings={handleUpdateBackupSettings}
              onRestoreBackup={handleRestoreBackup}
            />
          )}

          {currentTab === 'configuracoes' && storeSettings && (
            <SettingsView
              settings={storeSettings}
              onSaveSettings={handleSaveSettings}
              onLivePreviewSettings={handleLivePreviewSettings}
              currentUser={currentUser}
              onUpdateCurrentUser={(updated) => setCurrentUser(updated)}
              sellers={sellers}
              onSaveSeller={handleSaveSeller}
              onDeleteSeller={handleDeleteSeller}
            />
          )}
        </main>
      </div>

      {/* Modal de Impressão Global */}
      {printModalData && (
        <PrintModal
          type={printModalData.type}
          data={printModalData.data}
          initialOSCopiesMode={printModalData.initialOSCopiesMode}
          storeSettings={storeSettings || undefined}
          customers={customers}
          onClose={() => setPrintModalData(null)}
        />
      )}
    </div>
  );
};
