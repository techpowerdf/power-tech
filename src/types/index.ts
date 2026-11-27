export type EquipmentType = 'computador' | 'notebook' | 'monitor' | 'impressora' | 'outro';

export type WorkOrderStatus =
  | 'aberta'
  | 'analise'
  | 'orcamento'
  | 'aprovada'
  | 'manutencao'
  | 'aguardando_peca'
  | 'concluida'
  | 'entregue'
  | 'sem_reparo'
  | 'descarte'
  | 'cancelada';

export interface WorkOrderItem {
  id: string;
  type: 'peca' | 'servico';
  description: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  total: number;
  warrantyDays?: number;
  productId?: string;
  serviceId?: string;
  isCustom?: boolean;
  paymentMethod?: string;
}

export interface WorkOrderChecklist {
  ligando: boolean;
  carregadorFonte: boolean;
  caboForca: boolean;
  avariasVisiveis: string;
  senhaAparelho: string;
  testadoNaEntrada: boolean;
}

export interface WorkOrder {
  id: string;
  number: number;
  trackingToken?: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  customerCpf?: string;
  customerEmail?: string;
  customerTradeName?: string;
  customerStateRegistration?: string;
  customerCnae?: string;
  customerStatus?: string;
  customerOpeningDate?: string;
  customerLegalNature?: string;
  customerPartners?: string;
  customerCep?: string;
  customerStreet?: string;
  customerNumber?: string;
  customerComplement?: string;
  customerNeighborhood?: string;
  customerCity?: string;
  customerState?: string;
  equipmentType: EquipmentType;
  brand: string;
  model: string;
  serialNumber?: string;
  accessories?: string;
  configuration?: string; // Configuração do equipamento (ex: Core i5, 8GB RAM, SSD 256GB)
  reportedIssue: string; // Defeito informado pelo cliente
  reportedDefect?: string; // Alias de compatibilidade
  technicalReport?: string; // Diagnóstico e laudo técnico
  additionalInfo?: string; // Informações adicionais da OS
  status: WorkOrderStatus;
  checklist: WorkOrderChecklist;
  items: WorkOrderItem[];
  partsTotal: number;
  servicesTotal: number;
  discount: number;
  total: number;
  warrantyDays: number;
  entryDate: string;
  estimatedDeliveryDate?: string;
  completionDate?: string;
  deliveredDate?: string;
  statusDates?: Record<string, string>;
  technicianName: string;
  sellerId?: string;
  sellerName?: string;
  paymentMethod?: string;
  paymentStatus?: 'pendente' | 'pago';
  photos?: WorkOrderPhoto[];
  createdAt?: string;
}

export type WorkOrderPhotoStage = 'entrada' | 'reparo' | 'conclusao';

export interface WorkOrderPhoto {
  id: string;
  workOrderId: string;
  stage: WorkOrderPhotoStage;
  fileName: string;
  storagePath: string;
  url?: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: string;
  createdBy?: string;
}

export interface PendingPhotoDeletion {
  id: string;
  photoId: string;
  workOrderId: string;
  storagePath: string;
  fileName: string;
  stage: WorkOrderPhotoStage;
  requestedAt: string;
  requestedBy: string;
  status: 'pending' | 'failed' | 'completed';
  attempts: number;
  lastAttemptAt?: string | null;
  lastError?: string | null;
}

export interface Seller {
  id: string;
  name: string;
  nickname?: string;
  document?: string;
  phone?: string;
  email?: string;
  commissionRate?: number;
  active: boolean;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type ExpenseCategory =
  | 'alimentacao'
  | 'compra_mercadoria'
  | 'compra_equipamento'
  | 'internet'
  | 'agua'
  | 'energia'
  | 'imposto'
  | 'dasmei'
  | 'gasolina'
  | 'outros'
  | (string & {});

export interface ExpenseCategoryDef {
  id: string;
  label: string;
  shortLabel?: string;
  iconName?: string;
  color?: string;
  bgColor?: string;
  borderColor?: string;
  isCustom?: boolean;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  sellerId?: string;
  sellerName?: string;
  paymentMethod?: string;
  receiptUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  name: string; // Razão Social ou Nome Completo
  tradeName?: string; // Nome Fantasia
  document: string; // CPF ou CNPJ
  stateRegistration?: string; // Inscrição Estadual
  status?: string; // Situação Cadastral (ATIVA, etc)
  openingDate?: string; // Data de Abertura / Início Atividades
  cnae?: string; // CNAE Principal
  legalNature?: string; // Natureza Jurídica
  porte?: string; // Porte da Empresa
  simplesNacional?: string; // Optante Simples Nacional
  partners?: string; // Sócios / Administradores
  phone: string;
  whatsapp: string;
  email?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
  notes?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: 'pecas' | 'notebook' | 'computador' | 'monitor' | 'impressora' | 'suprimentos' | 'perifericos' | 'cabos' | 'mao_de_obra';
  brand: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  ncm?: string;
  cfop?: string;
  warrantyDays?: number;
  isActive: boolean;
  imageUrl?: string;
}

export interface ServiceItem {
  id: string;
  code: string;
  name: string;
  category: 'formatacao' | 'limpeza' | 'hardware' | 'impressora' | 'tela_teclado' | 'outro';
  costPrice?: number;
  price: number;
  estimatedHours: number;
  defaultWarrantyDays: number;
  description?: string;
  // Informações Fiscais para NFS-e
  serviceCode?: string; // Item Lista de Serviços LC 116 (ex: 14.01)
  cnae?: string; // CNAE de Prestação de Serviço (ex: 9511-8/00)
  issRate?: number; // Alíquota ISS (%) (ex: 2.0 a 5.0)
  issRetention?: boolean; // ISS Retido na fonte (Sim / Não)
  municipalTaxCode?: string; // Código de Tributação Municipal da Prefeitura
}

export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  code: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  total: number;
  warrantyDays?: number;
  imageUrl?: string;
}

export interface Sale {
  id: string;
  number: number;
  receiptToken?: string;
  customerId?: string;
  customerName?: string;
  customerCpf?: string;
  customerAddress?: string;
  customerPhone?: string;
  sellerId?: string;
  sellerName?: string;
  notes?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  warrantyDays?: number;
  paymentMethod: 'dinheiro' | 'pix' | 'debito' | 'credito' | 'faturado';
  installments?: number;
  receivedAmount?: number;
  changeAmount?: number;
  createdAt: string;
  status?: 'concluida' | 'cancelada';
  cancelledAt?: string;
  fiscalStatus?: 'nao_emitida' | 'emitida' | 'cancelada';
  fiscalInvoiceId?: string;
}

export interface Quote {
  id: string;
  number: number;
  customerId: string;
  customerName: string;
  customerPhone: string;
  equipmentDesc: string;
  reportedIssue?: string;
  items: WorkOrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  validDays: number;
  validUntil: string;
  status: 'pendente' | 'aprovado' | 'rejeitado' | 'convertido_os' | 'convertido_venda';
  notes?: string;
  createdAt: string;
}

export interface FiscalConfig {
  companyName: string;
  tradeName: string;
  cnpj: string;
  stateRegistration: string;
  municipalRegistration: string;
  taxRegime: 'simples_nacional' | 'mei' | 'lucro_presumido';
  cscId?: string;
  cscToken?: string;
  apiProvider: 'nuvem_fiscal' | 'focus_nfe' | 'simulador';
  apiToken: string;
  environment: 'homologacao' | 'producao';
  defaultNfeCfop: string;
  defaultNfseCnae: string;
  defaultNfseServiceCode: string;
  issRate: number;
}

export interface FiscalInvoice {
  id: string;
  type: 'nfe' | 'nfse';
  referenceType: 'venda' | 'os';
  referenceId: string;
  number: number;
  series: number;
  accessKey?: string;
  protocol?: string;
  status: 'autorizada' | 'cancelada' | 'rejeitada' | 'processando';
  total: number;
  recipientName: string;
  recipientDocument: string;
  xmlUrl?: string;
  danfeUrl?: string;
  errorMessage?: string;
  issuedAt: string;
}

export interface BackupHistoryItem {
  id: string;
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
  createdAt: string;
  type: 'automatico' | 'manual';
  status: 'sucesso' | 'erro';
}

export interface BackupSettings {
  autoDailyBackup: boolean;
  backupTime: string; // Ex: "18:00"
  backupDirectory: string;
  lastBackupAt?: string;
  lastBackupStatus?: 'sucesso' | 'erro';
  lastBackupMessage?: string;
  retainDays: number; // Ex: 30 dias
}

export type ThemeMode = 'escuro' | 'claro' | 'misto';
export type FontFamily = 'system' | 'inter' | 'roboto' | 'segoe' | 'poppins' | 'opensans' | 'fira';
export type FontSizeText = 'pequeno' | 'padrao' | 'medio' | 'grande' | 'extra_grande';
export type FontSizeHeading = 'compacto' | 'padrao' | 'grande' | 'destaque';
export type FontSizeFooter = 'pequeno' | 'padrao' | 'medio' | 'grande';

export interface StoreSettings {
  storeName: string;
  tradeName: string;
  cnpj: string;
  ie: string;
  phone: string;
  whatsapp: string;
  email: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  pixKey: string;
  pixType: 'cpf' | 'cnpj' | 'telefone' | 'email' | 'aleatoria';
  warrantyTerms: string;
  printerType: 'termica_80mm' | 'termica_58mm' | 'a4';
  autoPrintAfterSave: boolean;
  themeMode?: ThemeMode;
  fontFamily?: FontFamily;
  fontSizeText?: FontSizeText;
  fontSizeHeading?: FontSizeHeading;
  fontSizeFooter?: FontSizeFooter;
  systemUrl?: string;
  publicTrackingUrl?: string;
  tunnelActive?: boolean;
  detectedLocalIp?: string;
  detectedLocalUrl?: string;
  dashboardLogoSize?: number;
  storeNameFontSize?: number;
  storeNameColor?: string;
  selectionTabFontSize?: number;
  selectionTabActiveColor?: string;
  selectionTabTextColor?: string;
  iconSizeGeneral?: number;
  iconColorGeneral?: string;
  badgeFontSize?: number;
  badgePadding?: 'compacto' | 'padrao' | 'amplo' | 'destaque';
  priceHighlightColor?: string;
  primaryColor?: string;
  statusColors?: Record<string, string>;
  customerNameFontSize?: number;
  customerNameColor?: string;
  osNumberFontSize?: number;
  osNumberColor?: string;
  actionIconSize?: number;
  expenseCategories?: ExpenseCategoryDef[];
  osDeliveredMessageEnabled?: boolean;
  osDeliveredMessageTemplate?: string;
  osReadyMessageEnabled?: boolean;
  osReadyMessageTemplate?: string;
  posSaleMessageEnabled?: boolean;
  posSaleMessageTemplate?: string;
  posReviewMessageEnabled?: boolean;
  posReviewMessageTemplate?: string;
  googleReviewUrl?: string;
  autoSendPdfWhatsApp?: boolean;
  posAutoSendPdfWhatsApp?: boolean;
  osAutoSendPdfWhatsApp?: boolean;
  documentsDirectory?: string;
}

export interface UserPermissions {
  dashboard: boolean;
  workOrders: boolean;
  workOrdersDelete: boolean;
  pos: boolean;
  quotes: boolean;
  inventory: boolean;
  services: boolean;
  customers: boolean;
  fiscal: boolean;
  backup: boolean;
  settings: boolean;
  reports?: boolean;
  expenses?: boolean;
  companies?: boolean;
}

export const DEFAULT_ADMIN_PERMISSIONS: UserPermissions = {
  dashboard: true,
  workOrders: true,
  workOrdersDelete: true,
  pos: true,
  quotes: true,
  inventory: true,
  services: true,
  customers: true,
  fiscal: true,
  backup: true,
  settings: true,
  reports: true,
  expenses: true,
  companies: true
};

export const DEFAULT_OPERATOR_PERMISSIONS: UserPermissions = {
  dashboard: true,
  workOrders: true,
  workOrdersDelete: false,
  pos: true,
  quotes: true,
  inventory: false,
  services: false,
  customers: true,
  fiscal: false,
  backup: false,
  settings: false,
  reports: true,
  expenses: true,
  companies: true
};

export interface CompanyPlan {
  id: string;
  name: string;
  code?: string;
  description?: string;
  monthlyFee: number;
  billingCycle: 'mensal' | 'trimestral' | 'semestral' | 'anual';
  slaHours?: number;
  equipmentLimit?: number; // 0 ou undefined para ilimitado
  preventiveVisitsPerMonth?: number;
  includesRemoteSupport?: boolean;
  includesParts?: boolean;
  coverageDetails?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Company {
  id: string;
  cnpj: string;
  corporateName: string;
  tradeName?: string;
  stateRegistration?: string;
  municipalRegistration?: string;
  contactName: string;
  contactRole?: string;
  contactPhone?: string;
  contactWhatsapp?: string;
  contactEmail?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
  planId?: string;
  planName?: string;
  planStatus: 'ativo' | 'suspenso' | 'cancelado' | 'em_negociacao';
  planValue: number;
  billingDay: number;
  contractStartDate?: string;
  contractEndDate?: string;
  notes?: string;
  customerId?: string;
  createdAt: string;
  updatedAt?: string;
}

export type EquipmentStatus = 'operacional' | 'em_manutencao' | 'reserva' | 'baixado';

export interface CompanyEquipment {
  id: string;
  companyId: string;
  companyName?: string;
  patrimonio: string;
  type: string;
  brand: string;
  model: string;
  serialNumber?: string;
  sector: string;
  location?: string;
  responsibleUser?: string;
  specifications?: string;
  status: EquipmentStatus;
  acquisitionDate?: string;
  warrantyUntil?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type MaintenanceType =
  | 'preventiva'
  | 'corretiva'
  | 'instalacao'
  | 'upgrade'
  | 'suporte_remoto'
  | 'visita_tecnica';

export interface CompanyEquipmentMaintenance {
  id: string;
  orderNumber: number;
  companyId: string;
  companyName: string;
  equipmentId: string;
  patrimonio: string;
  equipmentDescription: string;
  sector?: string;
  responsibleUser?: string;
  type: MaintenanceType;
  reportedIssue: string;
  technicalReport?: string;
  actionsTaken?: string;
  status: WorkOrderStatus;
  statusDates?: Record<string, string>;
  coveredByPlan: boolean;
  items: WorkOrderItem[];
  partsTotal: number;
  servicesTotal: number;
  discount: number;
  total: number;
  warrantyDays: number;
  entryDate: string;
  completionDate?: string;
  deliveredDate?: string;
  technicianName: string;
  notes?: string;
  workOrderId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SystemUser {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'operador';
  permissions: UserPermissions;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'operador' | 'tecnico' | 'atendente';
  permissions?: UserPermissions;
}
