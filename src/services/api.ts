import {
  Customer,
  Product,
  ServiceItem,
  WorkOrder,
  WorkOrderPhoto,
  WorkOrderPhotoStage,
  PendingPhotoDeletion,
  Sale,
  Quote,
  FiscalConfig,
  FiscalInvoice,
  BackupSettings,
  BackupHistoryItem,
  StoreSettings,
  AuthUser,
  SystemUser,
  UserPermissions,
  Seller,
  Expense,
  Company,
  CompanyPlan,
  CompanyEquipment,
  CompanyEquipmentMaintenance
} from '../types';

const envApiUrl = (import.meta as any).env?.VITE_API_URL;
const isLocalVite = typeof window !== 'undefined' && Boolean(
  window.location.port && window.location.port !== '4567' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
);
const BASE_URL = envApiUrl
  ? (String(envApiUrl).replace(/\/+$/, '').endsWith('/api') ? String(envApiUrl).replace(/\/+$/, '') : `${String(envApiUrl).replace(/\/+$/, '')}/api`)
  : (isLocalVite ? 'http://localhost:4567/api' : `${typeof window !== 'undefined' ? window.location.origin : ''}/api`);

const TOKEN_KEY = 'powertech_auth_token';

// O token agora reside estritamente em sessionStorage.
// Ao fechar a aba, janela ou o aplicativo desktop, a sessão é destruída automaticamente.
export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TOKEN_KEY);
};

export const setAuthToken = (token: string | null): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TOKEN_KEY); // Limpa resquícios antigos do localStorage para não persistir em disco
  } catch {}
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
  }
};

let onUnauthorizedCallback: (() => void) | null = null;
export const setOnUnauthorizedCallback = (cb: () => void) => {
  onUnauthorizedCallback = cb;
};

let tempAdminPassword: string | null = null;
export const setTempAdminPassword = (password: string | null) => {
  tempAdminPassword = password;
};
export const getTempAdminPassword = (): string | null => tempAdminPassword;

function buildAdminHeader(adminPassword?: string): Record<string, string> {
  const pass = adminPassword || tempAdminPassword;
  return pass ? { 'x-admin-password': encodeURIComponent(pass) } : {};
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const adminHeaders: Record<string, string> = tempAdminPassword ? { 'x-admin-password': encodeURIComponent(tempAdminPassword) } : {};

  const res = await fetch(`${BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...adminHeaders,
      ...options?.headers
    },
    ...options
  });

  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/auth/login') && !url.startsWith('/public/') && !url.startsWith('/auth/verify-admin-password')) {
      if (onUnauthorizedCallback) onUnauthorizedCallback();
    }
    let errorMsg = `Erro ${res.status}: ${res.statusText}`;
    try {
      const json = await res.json();
      if (json.error) errorMsg = json.error;
    } catch (e) {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

export const api = {
  // Autenticação
  login: (username: string, password: string) =>
    fetchJson<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),
  getMe: () => fetchJson<{ user: AuthUser }>('/auth/me'),
  updateProfile: (data: { name: string; username: string; currentPassword?: string; newPassword?: string }) =>
    fetchJson<{ success: boolean; token: string; user: AuthUser; message: string }>('/auth/profile', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    fetchJson<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    }),
  verifyAdminPassword: (password: string) =>
    fetchJson<{ success: boolean; message: string }>('/auth/verify-admin-password', {
      method: 'POST',
      body: JSON.stringify({ password })
    }),
  logout: () => {
    setAuthToken(null);
    try {
      sessionStorage.clear();
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
  },

  // Gerenciamento de Usuários (Admin)
  getUsers: () => fetchJson<{ users: SystemUser[] }>('/users'),
  createUser: (user: { name: string; username: string; password: string; role: 'admin' | 'operador'; permissions: UserPermissions; active: boolean }) =>
    fetchJson<{ success: boolean; user: SystemUser; message: string }>('/users', {
      method: 'POST',
      body: JSON.stringify(user)
    }),
  updateUser: (id: string, user: Partial<SystemUser> & { password?: string }) =>
    fetchJson<{ success: boolean; user: SystemUser; message: string }>(`/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(user)
    }),
  deleteUser: (id: string, adminPassword?: string) =>
    fetchJson<{ success: boolean; message: string }>(`/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: buildAdminHeader(adminPassword)
    }),

  // Dashboard
  getDashboard: () => fetchJson<{
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
    backupStatus: BackupSettings;
  }>('/dashboard'),

  // Work Orders (OS)
  getWorkOrders: (status?: string, search?: string) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    return fetchJson<WorkOrder[]>(`/work-orders?${params.toString()}`);
  },
  createWorkOrder: (data: Partial<WorkOrder>) =>
    fetchJson<WorkOrder>('/work-orders', { method: 'POST', body: JSON.stringify(data) }),
  updateWorkOrder: (id: string, data: Partial<WorkOrder>) =>
    fetchJson<WorkOrder>(`/work-orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWorkOrder: (id: string, adminPassword?: string) =>
    fetchJson<{ success: boolean }>(`/work-orders/${id}`, { method: 'DELETE', headers: buildAdminHeader(adminPassword) }),
  getWorkOrderById: (id: string) =>
    fetchJson<WorkOrder>(`/work-orders/${id}`),
  trackWorkOrder: (tokenOrId: string) =>
    fetchJson<{ workOrder: WorkOrder; store: Partial<StoreSettings> }>(`/public/work-orders/track/${encodeURIComponent(tokenOrId)}`),
  addItemsToWorkOrder: (id: string, items: any[], paymentMethod?: string, paymentStatus?: string) =>
    fetchJson<WorkOrder>(`/work-orders/${id}/items`, {
      method: 'POST',
      body: JSON.stringify({ items, paymentMethod, paymentStatus })
    }),
  getWorkOrderPhotos: (workOrderId: string) =>
    fetchJson<{ success: boolean; photos: WorkOrderPhoto[] }>(`/work-orders/${workOrderId}/photos`),
  uploadWorkOrderPhoto: (
    workOrderId: string,
    data: { stage: WorkOrderPhotoStage; fileName: string; base64Data: string; mimeType: string }
  ) =>
    fetchJson<{ success: boolean; message: string; photo: WorkOrderPhoto }>(`/work-orders/${workOrderId}/photos`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  deleteWorkOrderPhoto: (workOrderId: string, photoId: string) =>
    fetchJson<{ success: boolean; message: string; pendingStorageDeletion?: boolean; pendingId?: string }>(`/work-orders/${workOrderId}/photos/${photoId}`, {
      method: 'DELETE'
    }),
  getPendingPhotoDeletions: () =>
    fetchJson<{ success: boolean; total: number; pendingDeletions: PendingPhotoDeletion[] }>('/work-orders/photos/pending-deletions'),
  cleanupPendingPhotoDeletions: () =>
    fetchJson<{ success: boolean; message: string; results: { processed: number; succeeded: number; failed: number; remaining: number } }>('/work-orders/photos/cleanup-pending', {
      method: 'POST'
    }),

  // Products (Estoque)
  getProducts: () => fetchJson<Product[]>('/products'),
  createProduct: (data: Partial<Product>) =>
    fetchJson<Product>('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: string, data: Partial<Product>) =>
    fetchJson<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id: string, adminPassword?: string) =>
    fetchJson<{ success: boolean }>(`/products/${id}`, { method: 'DELETE', headers: buildAdminHeader(adminPassword) }),

  // Services (Mão de Obra)
  getServices: () => fetchJson<ServiceItem[]>('/services'),
  createService: (data: Partial<ServiceItem>) =>
    fetchJson<ServiceItem>('/services', { method: 'POST', body: JSON.stringify(data) }),
  updateService: (id: string, data: Partial<ServiceItem>) =>
    fetchJson<ServiceItem>(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteService: (id: string, adminPassword?: string) =>
    fetchJson<{ success: boolean }>(`/services/${id}`, { method: 'DELETE', headers: buildAdminHeader(adminPassword) }),

  // Customers
  getCustomers: () => fetchJson<Customer[]>('/customers'),
  getCustomerHistory: (id: string) =>
    fetchJson<{
      customer: Customer;
      workOrders: WorkOrder[];
      sales: Sale[];
      metrics: {
        totalWorkOrders: number;
        totalSales: number;
        totalSpentWorkOrders: number;
        totalSpentSales: number;
        totalSpent: number;
        equipmentList: string[];
        lastInteraction: string | null;
      };
    }>(`/customers/${id}/history`),
  createCustomer: (data: Partial<Customer>) =>
    fetchJson<Customer>('/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id: string, data: Partial<Customer>) =>
    fetchJson<Customer>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomer: (id: string, adminPassword?: string) =>
    fetchJson<{ success: boolean }>(`/customers/${id}`, { method: 'DELETE', headers: buildAdminHeader(adminPassword) }),

  // Sales (PDV)
  getSales: () => fetchJson<Sale[]>('/sales'),
  createSale: (data: Partial<Sale>) =>
    fetchJson<Sale>('/sales', { method: 'POST', body: JSON.stringify(data) }),
  updateSaleSeller: (id: string, sellerId: string, sellerName: string) =>
    fetchJson<Sale>(`/sales/${encodeURIComponent(id)}/seller`, {
      method: 'PUT',
      body: JSON.stringify({ sellerId, sellerName })
    }),
  cancelSale: (id: string, adminPassword?: string) =>
    fetchJson<{ success: boolean; message: string; sale?: Sale }>(`/sales/${id}/cancel`, {
      method: 'POST',
      headers: buildAdminHeader(adminPassword)
    }),
  deleteSale: (id: string, adminPassword?: string) =>
    fetchJson<{ success: boolean; message: string }>(`/sales/${id}`, {
      method: 'DELETE',
      headers: buildAdminHeader(adminPassword)
    }),
  trackSale: (tokenOrId: string) =>
    fetchJson<{ sale: Sale; store: Partial<StoreSettings> }>(`/public/sales/receipt/${encodeURIComponent(tokenOrId)}`),

  // Quotes (Orçamentos)
  getQuotes: () => fetchJson<Quote[]>('/quotes'),
  createQuote: (data: Partial<Quote>) =>
    fetchJson<Quote>('/quotes', { method: 'POST', body: JSON.stringify(data) }),
  updateQuote: (id: string, data: Partial<Quote>) =>
    fetchJson<Quote>(`/quotes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteQuote: (id: string, adminPassword?: string) =>
    fetchJson<{ success: boolean; message: string }>(`/quotes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: buildAdminHeader(adminPassword)
    }),
  convertQuoteToOS: (id: string) =>
    fetchJson<{ message: string; workOrder: WorkOrder }>(`/quotes/${id}/convert-to-os`, { method: 'POST' }),

  // Fiscal
  getFiscalInvoices: () => fetchJson<FiscalInvoice[]>('/fiscal/invoices'),
  emitInvoice: (payload: {
    type: 'nfe' | 'nfse';
    referenceType: 'venda' | 'os';
    referenceId: string;
    recipient: { name: string; document: string };
    items: any[];
    total: number;
  }) => fetchJson<{ success: boolean; invoice: FiscalInvoice; message: string }>('/fiscal/emit', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  getFiscalConfig: () => fetchJson<FiscalConfig>('/fiscal/config'),
  updateFiscalConfig: (data: Partial<FiscalConfig>) =>
    fetchJson<FiscalConfig>('/fiscal/config', { method: 'PUT', body: JSON.stringify(data) }),

  // Backup
  getBackupInfo: () => fetchJson<{
    settings: BackupSettings;
    history: BackupHistoryItem[];
    files: Array<{ fileName: string; filePath: string; size: number; mtime: string; type: string }>;
  }>('/backup'),
  runBackupNow: (customDestination?: string) =>
    fetchJson<{ success: boolean; fileName: string; filePath: string; size: number; message: string }>('/backup/run', {
      method: 'POST',
      body: JSON.stringify({ customDestination })
    }),
  updateBackupSettings: (data: Partial<BackupSettings>) =>
    fetchJson<BackupSettings>('/backup/settings', { method: 'PUT', body: JSON.stringify(data) }),
  restoreBackup: (backupFilePath: string) =>
    fetchJson<{ success: boolean; message: string }>('/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ backupFilePath })
    }),

  // Vendedores
  getSellers: () => fetchJson<Seller[]>('/sellers'),
  createSeller: (data: Partial<Seller>) =>
    fetchJson<Seller>('/sellers', { method: 'POST', body: JSON.stringify(data) }),
  updateSeller: (id: string, data: Partial<Seller>) =>
    fetchJson<Seller>(`/sellers/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSeller: (id: string, adminPassword?: string) =>
    fetchJson<{ success: boolean }>(`/sellers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: buildAdminHeader(adminPassword)
    }),

  // Expenses (Gastos / Despesas da Empresa)
  getExpenses: () => fetchJson<Expense[]>('/expenses'),
  createExpense: (data: Partial<Expense>) =>
    fetchJson<Expense>('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  updateExpense: (id: string, data: Partial<Expense>) =>
    fetchJson<Expense>(`/expenses/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExpense: (id: string, adminPassword?: string) =>
    fetchJson<{ success: boolean }>(`/expenses/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: buildAdminHeader(adminPassword)
    }),

  // Settings
  getSettings: () => fetchJson<StoreSettings>('/settings'),
  updateSettings: (data: Partial<StoreSettings>) =>
    fetchJson<StoreSettings>('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Consulta de CNPJ
  getCNPJ: (cnpj: string) => fetchJson<any>(`/cnpj/${cnpj.replace(/\D/g, '')}`),

  // Disparo de mensagem no WhatsApp Desktop
  sendWhatsAppDesktop: (phone: string, text: string, autoSend: boolean = true) =>
    fetchJson<{ success: boolean; mode?: string }>('/whatsapp/send-desktop', {
      method: 'POST',
      body: JSON.stringify({ phone, text, autoSend })
    }),

  // Disparo de Recibo de Venda em PDF via WhatsApp
  sendSalePdfViaWhatsApp: (saleId: string, phone?: string, text?: string) =>
    fetchJson<{ success: boolean; mode: string; pdfPath?: string }>('/whatsapp/send-sale-pdf', {
      method: 'POST',
      body: JSON.stringify({ saleId, phone, text })
    }),

  // Disparo de Ordem de Serviço em PDF via WhatsApp
  sendWorkOrderPdfViaWhatsApp: (workOrderId: string, phone?: string, text?: string) =>
    fetchJson<{ success: boolean; mode: string; pdfPath?: string }>('/whatsapp/send-work-order-pdf', {
      method: 'POST',
      body: JSON.stringify({ workOrderId, phone, text })
    }),

  // Salvar relatório no diretório configurado
  saveReportToDirectory: (fileName: string, content: string) =>
    fetchJson<{ success: boolean; filePath: string }>('/documents/save-report', {
      method: 'POST',
      body: JSON.stringify({ fileName, content })
    }),

  // Empresas & B2B
  getCompanies: () => fetchJson<Company[]>('/companies'),
  createCompany: (data: Partial<Company>) =>
    fetchJson<Company>('/companies', { method: 'POST', body: JSON.stringify(data) }),
  updateCompany: (id: string, data: Partial<Company>) =>
    fetchJson<Company>(`/companies/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCompany: (id: string, adminPassword?: string) =>
    fetchJson<{ success: boolean }>(`/companies/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: buildAdminHeader(adminPassword)
    }),

  // Planos Corporativos
  getCompanyPlans: () => fetchJson<CompanyPlan[]>('/company-plans'),
  createCompanyPlan: (data: Partial<CompanyPlan>) =>
    fetchJson<CompanyPlan>('/company-plans', { method: 'POST', body: JSON.stringify(data) }),
  updateCompanyPlan: (id: string, data: Partial<CompanyPlan>) =>
    fetchJson<CompanyPlan>(`/company-plans/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCompanyPlan: (id: string, adminPassword?: string) =>
    fetchJson<{ success: boolean }>(`/company-plans/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: buildAdminHeader(adminPassword)
    }),

  // Equipamentos das Empresas (Patrimônio)
  getCompanyEquipments: (companyId?: string) =>
    fetchJson<CompanyEquipment[]>(companyId ? `/company-equipments?companyId=${encodeURIComponent(companyId)}` : '/company-equipments'),
  createCompanyEquipment: (data: Partial<CompanyEquipment>) =>
    fetchJson<CompanyEquipment>('/company-equipments', { method: 'POST', body: JSON.stringify(data) }),
  updateCompanyEquipment: (id: string, data: Partial<CompanyEquipment>) =>
    fetchJson<CompanyEquipment>(`/company-equipments/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCompanyEquipment: (id: string, adminPassword?: string) =>
    fetchJson<{ success: boolean }>(`/company-equipments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: buildAdminHeader(adminPassword)
    }),

  // Histórico de Manutenções dos Equipamentos (Dinâmica de OS)
  getCompanyMaintenances: (equipmentId?: string, companyId?: string) => {
    const params = new URLSearchParams();
    if (equipmentId) params.append('equipmentId', equipmentId);
    if (companyId) params.append('companyId', companyId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return fetchJson<CompanyEquipmentMaintenance[]>(`/company-maintenances${qs}`);
  },
  createCompanyMaintenance: (data: Partial<CompanyEquipmentMaintenance>) =>
    fetchJson<CompanyEquipmentMaintenance>('/company-maintenances', { method: 'POST', body: JSON.stringify(data) }),
  updateCompanyMaintenance: (id: string, data: Partial<CompanyEquipmentMaintenance>) =>
    fetchJson<CompanyEquipmentMaintenance>(`/company-maintenances/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCompanyMaintenance: (id: string, adminPassword?: string) =>
    fetchJson<{ success: boolean }>(`/company-maintenances/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: buildAdminHeader(adminPassword)
    })
};
