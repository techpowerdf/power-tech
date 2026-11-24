import React, { useState, useMemo, useEffect } from 'react';
import {
  Wrench,
  Search,
  Plus,
  Printer,
  MessageSquare,
  Edit,
  Trash2,
  Eye,
  Laptop,
  Monitor,
  Printer as PrinterIcon,
  HardDrive,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  FileCheck,
  Calendar,
  BarChart3,
  TrendingUp,
  DollarSign,
  EyeOff,
  FileDown,
  Loader2,
  Users,
  Building2,
  PlusCircle,
  ExternalLink,
  Copy,
  Check,
  CreditCard,
  History,
  BadgeDollarSign
} from 'lucide-react';
import { WorkOrder, WorkOrderStatus, Customer, Product, ServiceItem, StoreSettings, Sale, Seller } from '../types';
import {
  openWhatsAppWithText,
  formatWorkOrderWhatsAppMessage,
  formatWorkOrderReadyWhatsAppMessage,
  getWorkOrderTrackingUrl,
  sendWorkOrderDeliveredWhatsApp,
  sendWorkOrderViaWhatsApp,
  savePdfWithLocationPicker
} from '../services/whatsapp';
import { lookupCNPJ, formatCNPJ, cleanDigits } from '../services/cnpj';
import { AddItemsToOSModal } from '../components/AddItemsToOSModal';
import { SendWhatsAppModal } from '../components/SendWhatsAppModal';
import { CustomerHistoryModal } from '../components/CustomerHistoryModal';
import { AdminPasswordModal, useAdminPasswordModal } from '../components/AdminPasswordModal';
import { api } from '../services/api';
import {
  UNASSIGNED_SELLER_KEY,
  getLocalDateStr,
  getLocalMonthStr,
  getWorkOrderEffectiveDate,
  isDateInPeriod,
  matchesSellerFilter,
  buildSellerBreakdown,
  calculateWorkOrderGross,
  calculateWorkOrderCost
} from '../utils/reportHelpers';
import { WarrantySelect } from '../components/WarrantySelect';
import {
  computeAggregateWarrantyDays,
  formatWarrantyLabel,
  formatWarrantyShort,
  resolveItemWarrantyDays
} from '../utils/warrantyHelpers';
import { getStatusBadgeStyle, STATUS_LABELS } from '../utils/themeCustomizer';

interface WorkOrdersViewProps {
  workOrders: WorkOrder[];
  customers: Customer[];
  products: Product[];
  services: ServiceItem[];
  sales?: Sale[];
  sellers?: Seller[];
  storeSettings?: StoreSettings;
  canDelete?: boolean;
  onSaveWorkOrder: (os: Partial<WorkOrder>) => Promise<void>;
  onDeleteWorkOrder: (id: string, adminPassword?: string) => Promise<void>;
  onPrintWorkOrder: (os: WorkOrder, copiesMode?: 'inteira' | 'ambas' | 'cliente') => void;
  onSaveProduct?: (product: Partial<Product>) => Promise<void>;
  onSaveService?: (service: Partial<ServiceItem>) => Promise<void>;
  openCreateModalTrigger?: number;
  resetToOverviewTrigger?: number;
  onOpenGeneralReport?: () => void;
  hideRevenue?: boolean;
  onToggleHideRevenue?: () => void;
}

export const WorkOrdersView: React.FC<WorkOrdersViewProps> = ({
  workOrders,
  customers,
  products,
  services,
  sales = [],
  sellers = [],
  storeSettings,
  canDelete = true,
  onSaveWorkOrder,
  onDeleteWorkOrder,
  onPrintWorkOrder,
  onSaveProduct,
  onSaveService,
  openCreateModalTrigger = 0,
  resetToOverviewTrigger = 0,
  onOpenGeneralReport,
  hideRevenue = false,
  onToggleHideRevenue
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('todas');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingOS, setEditingOS] = useState<WorkOrder | null>(null);
  const [viewingOS, setViewingOS] = useState<WorkOrder | null>(null);
  const [osForAddingItems, setOsForAddingItems] = useState<WorkOrder | null>(null);
  const [copiedTrackLink, setCopiedTrackLink] = useState<boolean>(false);
  const [whatsAppModalOS, setWhatsAppModalOS] = useState<WorkOrder | null>(null);

  // Modal de Histórico de Cliente
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

  // Confirmação com Senha de Administrador
  const { requestConfirmation: requestAdminConfirmation, modalProps: adminModalProps } = useAdminPasswordModal();

  // Form State
  const [customerId, setCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [customerCpf, setCustomerCpf] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerTradeName, setCustomerTradeName] = useState<string>('');
  const [customerStateRegistration, setCustomerStateRegistration] = useState<string>('');
  const [customerStatus, setCustomerStatus] = useState<string>('');
  const [customerOpeningDate, setCustomerOpeningDate] = useState<string>('');
  const [customerCnae, setCustomerCnae] = useState<string>('');
  const [customerLegalNature, setCustomerLegalNature] = useState<string>('');
  const [customerPartners, setCustomerPartners] = useState<string>('');
  const [customerCep, setCustomerCep] = useState<string>('');
  const [customerStreet, setCustomerStreet] = useState<string>('');
  const [customerNumber, setCustomerNumber] = useState<string>('');
  const [customerComplement, setCustomerComplement] = useState<string>('');
  const [customerNeighborhood, setCustomerNeighborhood] = useState<string>('');
  const [customerCity, setCustomerCity] = useState<string>('');
  const [customerState, setCustomerState] = useState<string>('');
  const [equipmentType, setEquipmentType] = useState<any>('notebook');
  const [brand, setBrand] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [serialNumber, setSerialNumber] = useState<string>('');
  const [accessories, setAccessories] = useState<string>('');
  const [configuration, setConfiguration] = useState<string>('');
  const [reportedIssue, setReportedIssue] = useState<string>('');
  const [technicalReport, setTechnicalReport] = useState<string>('');
  const [additionalInfo, setAdditionalInfo] = useState<string>('');
  const [status, setStatus] = useState<WorkOrderStatus>('aberta');
  const [technicianName, setTechnicianName] = useState<string>('Técnico Responsável');
  const [sellerId, setSellerId] = useState<string>('');
  const [sellerName, setSellerName] = useState<string>('');
  const [discount, setDiscount] = useState<number>(0);
  const [warrantyDays, setWarrantyDays] = useState<number>(90);
  const [deliveredDate, setDeliveredDate] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('A COMBINAR');
  const [paymentStatus, setPaymentStatus] = useState<'pendente' | 'pago'>('pendente');

  // Checklist
  const [checklist, setChecklist] = useState({
    ligando: true,
    carregadorFonte: true,
    caboForca: false,
    avariasVisiveis: '',
    senhaAparelho: '',
    testadoNaEntrada: true
  });

  // Items (Peças e Serviços)
  const [items, setItems] = useState<any[]>([]);

  // Item Picker temporário
  const [selectedItemType, setSelectedItemType] = useState<'peca' | 'servico' | 'avulso'>('servico');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemUnitPrice, setItemUnitPrice] = useState<string>('');
  const [customItemDescription, setCustomItemDescription] = useState<string>('');
  const [customItemPrice, setCustomItemPrice] = useState<string>('');
  const [customItemCostPrice, setCustomItemCostPrice] = useState<string>('');
  const [customItemQuantity, setCustomItemQuantity] = useState<number>(1);
  const [customItemCategory, setCustomItemCategory] = useState<'servico' | 'peca'>('servico');
  const [customItemWarrantyDays, setCustomItemWarrantyDays] = useState<number>(90);
  const [customItemSaveToSystem, setCustomItemSaveToSystem] = useState<boolean>(false);
  const [registeringItemIdx, setRegisteringItemIdx] = useState<number | null>(null);

  // Consulta automática de CNPJ
  const [isSearchingCnpj, setIsSearchingCnpj] = useState<boolean>(false);
  const [cnpjFeedback, setCnpjFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const performCnpjLookupInOS = async (cnpjValue: string) => {
    const clean = cleanDigits(cnpjValue);
    if (clean.length !== 14) return;

    setIsSearchingCnpj(true);
    setCnpjFeedback({ type: 'info', message: 'Buscando todos os dados na Receita Federal...' });

    try {
      const data = await lookupCNPJ(clean);
      if (data && (data.name || data.razaoSocial)) {
        setCustomerName((data.razaoSocial || data.name).toUpperCase());
        setCustomerTradeName((data.nomeFantasia || data.razaoSocial || data.name).toUpperCase());
        setCustomerStatus((data.status || 'ATIVA').toUpperCase());
        setCustomerStateRegistration((data.stateRegistration || 'ISENTO').toUpperCase());
        if (data.openingDate) setCustomerOpeningDate(data.openingDate.toUpperCase());
        if (data.cnae) setCustomerCnae(data.cnae.toUpperCase());
        if (data.legalNature || data.porte) setCustomerLegalNature((data.legalNature || data.porte || '').toUpperCase());
        if (data.partners) setCustomerPartners(data.partners.toUpperCase());
        if (data.phone || data.whatsapp) {
          setCustomerPhone(data.whatsapp || data.phone);
        }
        if (data.email) {
          setCustomerEmail(data.email.toLowerCase());
        }
        if (data.cep) setCustomerCep(data.cep.toUpperCase());
        if (data.street) setCustomerStreet(data.street.toUpperCase());
        setCustomerNumber((data.number || 'S/N').toUpperCase());
        if (data.complement) setCustomerComplement(data.complement.toUpperCase());
        if (data.neighborhood) setCustomerNeighborhood(data.neighborhood.toUpperCase());
        if (data.city) setCustomerCity(data.city.toUpperCase());
        if (data.state) setCustomerState(data.state.toUpperCase());

        const formattedAddr = [
          data.street ? `${data.street}, Nº ${data.number || 'S/N'}` : '',
          data.complement ? `(${data.complement})` : '',
          data.neighborhood,
          data.city ? `${data.city}${data.state ? '/' + data.state : ''}` : '',
          data.cep ? `CEP: ${data.cep}` : ''
        ].filter(Boolean).join(' - ');
        setCustomerAddress((formattedAddr || data.address || '').toUpperCase());

        setCnpjFeedback({
          type: 'success',
          message: `Empresa localizada: ${data.nomeFantasia || data.razaoSocial || data.name}`
        });
      } else {
        setCnpjFeedback({
          type: 'error',
          message: 'CNPJ não encontrado na Receita Federal.'
        });
      }
    } catch (e) {
      setCnpjFeedback({
        type: 'error',
        message: 'Falha ao consultar CNPJ. Preencha manualmente.'
      });
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const handleCustomerCpfChange = (val: string) => {
    const clean = cleanDigits(val);
    if (clean.length > 11) {
      setCustomerCpf(formatCNPJ(clean));
    } else {
      setCustomerCpf(val);
    }

    if (clean.length === 14) {
      performCnpjLookupInOS(clean);
    } else {
      setCnpjFeedback(null);
    }
  };

  const openNewModal = () => {
    setActiveMainTab('ordens');
    setEditingOS(null);
    setCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setCustomerCpf('');
    setCustomerEmail('');
    setCustomerTradeName('');
    setCustomerStateRegistration('');
    setCustomerStatus('');
    setCustomerOpeningDate('');
    setCustomerCnae('');
    setCustomerLegalNature('');
    setCustomerPartners('');
    setCustomerCep('');
    setCustomerStreet('');
    setCustomerNumber('');
    setCustomerComplement('');
    setCustomerNeighborhood('');
    setCustomerCity('');
    setCustomerState('');
    setIsSearchingCnpj(false);
    setCnpjFeedback(null);
    setEquipmentType('notebook');
    setBrand('');
    setModel('');
    setSerialNumber('');
    setAccessories('CARREGADOR ORIGINAL');
    setConfiguration('');
    setReportedIssue('');
    setTechnicalReport('');
    setAdditionalInfo('');
    setStatus('aberta');
    setTechnicianName('TÉCNICO RESPONSÁVEL');
    setSellerId('');
    setSellerName('');
    setDiscount(0);
    setWarrantyDays(90);
    setDeliveredDate('');
    setEntryDate(new Date().toISOString().slice(0, 16));
    setPaymentMethod('A COMBINAR');
    setPaymentStatus('pendente');
    setChecklist({
      ligando: true,
      carregadorFonte: true,
      caboForca: false,
      avariasVisiveis: '',
      senhaAparelho: '',
      testadoNaEntrada: true
    });
    setItems([]);
    setSelectedServiceId('');
    setSelectedProductId('');
    setItemQuantity(1);
    setItemUnitPrice('');
    setCustomItemDescription('');
    setCustomItemPrice('');
    setCustomItemCostPrice('');
    setCustomItemQuantity(1);
    setCustomItemCategory('servico');
    setCustomItemWarrantyDays(90);
    setCustomItemSaveToSystem(false);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    const hasUnsavedChanges =
      customerName.trim() ||
      brand.trim() ||
      model.trim() ||
      reportedIssue.trim() ||
      additionalInfo.trim() ||
      items.length > 0;

    if (hasUnsavedChanges) {
      if (
        window.confirm(
          'Deseja fechar a janela? As alterações preenchidas nesta Ordem de Serviço serão descartadas.'
        )
      ) {
        setIsModalOpen(false);
      }
    } else {
      setIsModalOpen(false);
    }
  };

  useEffect(() => {
    if (openCreateModalTrigger && openCreateModalTrigger > 0) {
      openNewModal();
    }
  }, [openCreateModalTrigger]);

  useEffect(() => {
    if (resetToOverviewTrigger && resetToOverviewTrigger > 0) {
      setIsModalOpen(false);
      setViewingOS(null);
      setEditingOS(null);
      setActiveMainTab('ordens');
    }
  }, [resetToOverviewTrigger]);

  // Fechar modal ao pressionar tecla ESC (com confirmação se houver dados preenchidos)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewingOS) {
          setViewingOS(null);
        } else if (isModalOpen) {
          handleCloseModal();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingOS, isModalOpen, customerName, brand, model, reportedIssue, items.length]);

  const openEditModal = (os: WorkOrder) => {
    setEditingOS(os);
    setCustomerId(os.customerId || '');
    setCustomerName(os.customerName || '');
    setCustomerPhone(os.customerPhone || '');
    setCustomerAddress(os.customerAddress || '');
    setCustomerCpf(os.customerCpf || '');
    setCustomerEmail(os.customerEmail || '');
    setCustomerTradeName(os.customerTradeName || '');
    setCustomerStateRegistration(os.customerStateRegistration || '');
    setCustomerStatus(os.customerStatus || '');
    setCustomerOpeningDate(os.customerOpeningDate || '');
    setCustomerCnae(os.customerCnae || '');
    setCustomerLegalNature(os.customerLegalNature || '');
    setCustomerPartners(os.customerPartners || '');
    setCustomerCep(os.customerCep || '');
    setCustomerStreet(os.customerStreet || '');
    setCustomerNumber(os.customerNumber || '');
    setCustomerComplement(os.customerComplement || '');
    setCustomerNeighborhood(os.customerNeighborhood || '');
    setCustomerCity(os.customerCity || '');
    setCustomerState(os.customerState || '');
    setIsSearchingCnpj(false);
    setCnpjFeedback(null);
    setEquipmentType(os.equipmentType || 'notebook');
    setBrand(os.brand || '');
    setModel(os.model || '');
    setSerialNumber(os.serialNumber || '');
    setAccessories(os.accessories || '');
    setConfiguration(os.configuration || '');
    setReportedIssue(os.reportedIssue || '');
    setTechnicalReport(os.technicalReport || '');
    setAdditionalInfo(os.additionalInfo || '');
    setStatus(os.status || 'aberta');
    setTechnicianName(os.technicianName || 'Técnico Responsável');
    setSellerId(os.sellerId || '');
    setSellerName(os.sellerName || '');
    setDiscount(os.discount || 0);
    setWarrantyDays(os.warrantyDays !== undefined ? os.warrantyDays : 90);
    setDeliveredDate(os.deliveredDate || '');
    setPaymentMethod(os.paymentMethod || 'A COMBINAR');
    setPaymentStatus(os.paymentStatus || 'pendente');
    setEntryDate(
      os.entryDate
        ? new Date(os.entryDate).toISOString().slice(0, 16)
        : (os as any).createdAt
        ? new Date((os as any).createdAt).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16)
    );
    setChecklist(
      os.checklist || {
        ligando: true,
        carregadorFonte: false,
        caboForca: false,
        avariasVisiveis: '',
        senhaAparelho: '',
        testadoNaEntrada: true
      }
    );
    setItems(os.items || []);
    setSelectedServiceId('');
    setSelectedProductId('');
    setItemQuantity(1);
    setItemUnitPrice('');
    setIsModalOpen(true);
  };

  const handleOpenHistoryForOS = (os: WorkOrder) => {
    let c = os.customerId ? customers.find((cust) => cust.id === os.customerId) : undefined;
    if (!c && os.customerCpf) {
      const cleanDoc = cleanDigits(os.customerCpf);
      if (cleanDoc.length >= 11) {
        c = customers.find((cust) => cleanDigits(cust.document) === cleanDoc);
      }
    }
    if (!c && os.customerPhone) {
      const oPhone = cleanDigits(os.customerPhone);
      if (oPhone.length >= 8) {
        c = customers.find((cust) => {
          const cp = cleanDigits(cust.phone);
          const cw = cleanDigits(cust.whatsapp);
          return (
            (cp && (cp === oPhone || cp.endsWith(oPhone) || oPhone.endsWith(cp))) ||
            (cw && (cw === oPhone || cw.endsWith(oPhone) || oPhone.endsWith(cw)))
          );
        });
      }
    }
    if (!c && os.customerName) {
      const norm = os.customerName.trim().toUpperCase();
      c = customers.find((cust) => (cust.name || '').trim().toUpperCase() === norm);
    }

    if (c) {
      setHistoryCustomer(c);
      setIsHistoryModalOpen(true);
    } else {
      const virtualCustomer: Customer = {
        id: os.customerId || `os-cust-${os.id}`,
        name: (os.customerName || 'CLIENTE NÃO CADASTRADO').toUpperCase(),
        document: os.customerCpf || '',
        phone: os.customerPhone || '',
        whatsapp: os.customerPhone || '',
        street: os.customerAddress || '',
        city: 'São Paulo',
        state: 'SP',
        notes: `Histórico vinculado a partir da OS #${os.number}`,
        createdAt: os.entryDate || (os as any).createdAt || new Date().toISOString()
      };
      setHistoryCustomer(virtualCustomer);
      setIsHistoryModalOpen(true);
    }
  };

  const handleSelectCustomer = (id: string) => {
    setCustomerId(id);
    const c = customers.find((cust) => cust.id === id);
    if (c) {
      setCustomerName((c.name || '').toUpperCase());
      setCustomerTradeName((c.tradeName || '').toUpperCase());
      setCustomerStateRegistration((c.stateRegistration || '').toUpperCase());
      setCustomerStatus((c.status || '').toUpperCase());
      setCustomerOpeningDate((c.openingDate || '').toUpperCase());
      setCustomerCnae((c.cnae || '').toUpperCase());
      setCustomerLegalNature((c.legalNature || c.porte || '').toUpperCase());
      setCustomerPartners((c.partners || '').toUpperCase());
      setCustomerPhone(c.whatsapp || c.phone || '');
      setCustomerCpf(c.document || '');
      setCustomerEmail(c.email || '');
      setCustomerCep((c.cep || '').toUpperCase());
      setCustomerStreet((c.street || '').toUpperCase());
      setCustomerNumber((c.number || '').toUpperCase());
      setCustomerComplement((c.complement || '').toUpperCase());
      setCustomerNeighborhood((c.neighborhood || '').toUpperCase());
      setCustomerCity((c.city || '').toUpperCase());
      setCustomerState((c.state || '').toUpperCase());
      const addr = [
        c.street ? `${c.street}${c.number ? ', ' + c.number : ''}` : '',
        c.complement ? `(${c.complement})` : '',
        c.neighborhood,
        c.city ? `${c.city}${c.state ? '/' + c.state : ''}` : '',
        c.cep ? `CEP: ${c.cep}` : ''
      ].filter(Boolean).join(' - ');
      setCustomerAddress(addr.toUpperCase());

      // Preenche os dados do cliente nos campos da OS sem abrir automaticamente o modal de histórico
      setHistoryCustomer(c);
    }
  };

  const handleItemTypeChange = (type: 'peca' | 'servico' | 'avulso') => {
    setSelectedItemType(type);
    setSelectedServiceId('');
    setSelectedProductId('');
    setItemQuantity(1);
    setItemUnitPrice('');
  };

  const handleServiceChange = (id: string) => {
    setSelectedServiceId(id);
    const s = services.find((srv) => srv.id === id);
    if (s) {
      setItemUnitPrice(Number(s.price || 0).toFixed(2));
      setItemQuantity(1);
    } else {
      setItemUnitPrice('');
    }
  };

  const handleProductChange = (id: string) => {
    setSelectedProductId(id);
    const p = products.find((prod) => prod.id === id);
    if (p) {
      setItemUnitPrice(Number(p.sellingPrice || 0).toFixed(2));
      setItemQuantity(1);
    } else {
      setItemUnitPrice('');
    }
  };

  const handleAddItem = () => {
    if (selectedItemType === 'servico' && selectedServiceId) {
      const s = services.find((srv) => srv.id === selectedServiceId);
      if (s) {
        const qty = Math.max(1, parseInt(String(itemQuantity)) || 1);
        const rawPrice = String(itemUnitPrice).trim();
        const parsedPrice = rawPrice ? parseFloat(rawPrice.replace(',', '.')) : s.price;
        const unitPrice = isNaN(parsedPrice) || parsedPrice < 0 ? Number(s.price || 0) : parsedPrice;
        const total = qty * unitPrice;
        const itemWarranty = s.defaultWarrantyDays !== undefined ? Number(s.defaultWarrantyDays) : 90;

        const nextItems = [
          ...items,
          {
            id: `item-${Date.now()}`,
            type: 'servico',
            description: (s.name || '').toUpperCase(),
            quantity: qty,
            unitPrice: unitPrice,
            costPrice: Number(s.costPrice || 0),
            warrantyDays: itemWarranty,
            total: total,
            serviceId: s.id
          }
        ];
        setItems(nextItems);
        setWarrantyDays(computeAggregateWarrantyDays(nextItems, products, services));
        setSelectedServiceId('');
        setItemUnitPrice('');
        setItemQuantity(1);
      }
    } else if (selectedItemType === 'peca' && selectedProductId) {
      const p = products.find((prod) => prod.id === selectedProductId);
      if (p) {
        const qty = Math.max(1, parseInt(String(itemQuantity)) || 1);
        if (p.stock < qty) {
          if (!confirm(`Atenção: Estoque atual (${p.stock}) é menor que a quantidade solicitada (${qty}). Deseja adicionar mesmo assim?`)) {
            return;
          }
        }
        const rawPrice = String(itemUnitPrice).trim();
        const parsedPrice = rawPrice ? parseFloat(rawPrice.replace(',', '.')) : p.sellingPrice;
        const unitPrice = isNaN(parsedPrice) || parsedPrice < 0 ? Number(p.sellingPrice || 0) : parsedPrice;
        const total = qty * unitPrice;
        const itemWarranty = p.warrantyDays !== undefined ? Number(p.warrantyDays) : 90;

        const nextItems = [
          ...items,
          {
            id: `item-${Date.now()}`,
            type: 'peca',
            description: (p.name || '').toUpperCase(),
            quantity: qty,
            unitPrice: unitPrice,
            costPrice: Number(p.costPrice || 0),
            warrantyDays: itemWarranty,
            total: total,
            productId: p.id
          }
        ];
        setItems(nextItems);
        setWarrantyDays(computeAggregateWarrantyDays(nextItems, products, services));
        setSelectedProductId('');
        setItemUnitPrice('');
        setItemQuantity(1);
      }
    } else if (selectedItemType === 'avulso') {
      const desc = customItemDescription.trim();
      if (!desc) {
        alert('Por favor, informe a descrição do item avulso.');
        return;
      }
      const price = parseFloat(String(customItemPrice).replace(',', '.')) || 0;
      if (price <= 0) {
        alert('Por favor, informe um valor válido para o item avulso.');
        return;
      }
      const costPrice = Math.max(0, parseFloat(String(customItemCostPrice).replace(',', '.')) || 0);
      const qty = Math.max(1, parseInt(String(customItemQuantity)) || 1);
      const itemTotal = qty * price;

      if (customItemSaveToSystem) {
        (async () => {
          try {
            if (customItemCategory === 'peca') {
              const code = `PEC-${Date.now().toString().slice(-4)}`;
              const newProd: Partial<Product> = {
                code,
                name: desc.toUpperCase(),
                category: 'pecas',
                brand: 'GENÉRICO',
                costPrice,
                sellingPrice: price,
                stock: 0,
                minStock: 1,
                unit: 'UN',
                warrantyDays: Number(customItemWarrantyDays),
                isActive: true
              };
              if (onSaveProduct) {
                await onSaveProduct(newProd);
              } else {
                await api.createProduct(newProd);
              }
            } else {
              const code = `SRV-${Date.now().toString().slice(-4)}`;
              const newSrv: Partial<ServiceItem> = {
                code,
                name: desc.toUpperCase(),
                category: 'outro',
                costPrice,
                price,
                estimatedHours: 1,
                defaultWarrantyDays: Number(customItemWarrantyDays),
                description: desc.toUpperCase()
              };
              if (onSaveService) {
                await onSaveService(newSrv);
              } else {
                await api.createService(newSrv);
              }
            }
          } catch (e: any) {
            console.error('Erro ao cadastrar item no sistema:', e);
          }
        })();
      }

      const nextItems = [
        ...items,
        {
          id: `item-avulso-${Date.now()}`,
          type: customItemCategory,
          description: `${desc.toUpperCase()} (AVULSO)`,
          quantity: qty,
          unitPrice: price,
          costPrice: costPrice,
          warrantyDays: Number(customItemWarrantyDays),
          total: itemTotal,
          isCustom: true
        }
      ];
      setItems(nextItems);
      setWarrantyDays(computeAggregateWarrantyDays(nextItems, products, services));
      setCustomItemDescription('');
      setCustomItemPrice('');
      setCustomItemCostPrice('');
      setCustomItemQuantity(1);
      setCustomItemWarrantyDays(90);
      setCustomItemSaveToSystem(false);
    }
  };

  const handleRegisterItemInSystem = async (index: number) => {
    const item = items[index];
    if (!item) return;

    const cleanName = item.description.replace(/\(AVULSO\)/gi, '').trim().toUpperCase();
    const isPeca = item.type === 'peca';
    const confirmMsg = `Deseja cadastrar "${cleanName}" permanentemente no sistema como ${isPeca ? 'Produto/Peça no Estoque' : 'Mão de Obra / Serviço'}?`;
    if (!window.confirm(confirmMsg)) return;

    setRegisteringItemIdx(index);
    try {
      if (isPeca) {
        const code = `PEC-${Date.now().toString().slice(-4)}`;
        const newProdData: Partial<Product> = {
          code,
          name: cleanName,
          category: 'pecas',
          brand: 'GENÉRICO',
          costPrice: item.costPrice || 0,
          sellingPrice: item.unitPrice || 0,
          stock: 0,
          minStock: 1,
          unit: 'UN',
          warrantyDays: item.warrantyDays !== undefined ? item.warrantyDays : 90,
          isActive: true
        };
        let createdId: string | undefined;
        if (onSaveProduct) {
          await onSaveProduct(newProdData);
        } else {
          const res = await api.createProduct(newProdData);
          createdId = res.id;
        }
        setItems(items.map((it, i) => i === index ? { ...it, productId: createdId || `prod-${Date.now()}`, isCustom: false } : it));
      } else {
        const code = `SRV-${Date.now().toString().slice(-4)}`;
        const newSrvData: Partial<ServiceItem> = {
          code,
          name: cleanName,
          category: 'outro',
          costPrice: item.costPrice || 0,
          price: item.unitPrice || 0,
          estimatedHours: 1,
          defaultWarrantyDays: item.warrantyDays !== undefined ? item.warrantyDays : 90,
          description: cleanName
        };
        let createdId: string | undefined;
        if (onSaveService) {
          await onSaveService(newSrvData);
        } else {
          const res = await api.createService(newSrvData);
          createdId = res.id;
        }
        setItems(items.map((it, i) => i === index ? { ...it, serviceId: createdId || `serv-${Date.now()}`, isCustom: false } : it));
      }
      alert(`"${cleanName}" foi cadastrado com sucesso no catálogo do sistema!`);
    } catch (err: any) {
      alert(`Erro ao cadastrar item no sistema: ${err.message}`);
    } finally {
      setRegisteringItemIdx(null);
    }
  };

  const handleRemoveItem = (index: number) => {
    const nextItems = items.filter((_, idx) => idx !== index);
    setItems(nextItems);
    if (nextItems.length > 0) {
      setWarrantyDays(computeAggregateWarrantyDays(nextItems, products, services));
    }
  };

  const partsTotal = items
    .filter((it) => it.type === 'peca')
    .reduce((acc, it) => acc + (it.total || 0), 0);

  const servicesTotal = items
    .filter((it) => it.type === 'servico')
    .reduce((acc, it) => acc + (it.total || 0), 0);

  const totalCalculated = Math.max(0, partsTotal + servicesTotal - discount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !brand || !model) {
      alert('Por favor, informe ao menos o cliente, a marca e o modelo do equipamento.');
      return;
    }

    const finalAddress = customerAddress.trim() || [
      customerStreet ? `${customerStreet}${customerNumber ? ', ' + customerNumber : ''}` : '',
      customerComplement ? `(${customerComplement})` : '',
      customerNeighborhood,
      customerCity ? `${customerCity}${customerState ? '/' + customerState : ''}` : '',
      customerCep ? `CEP: ${customerCep}` : ''
    ].filter(Boolean).join(' - ');

    const payload: Partial<WorkOrder> = {
      ...(editingOS ? { id: editingOS.id, number: editingOS.number } : {}),
      customerId,
      customerName: customerName.trim().toUpperCase(),
      customerPhone: customerPhone.trim(),
      customerAddress: finalAddress.trim().toUpperCase(),
      customerCpf: customerCpf.trim(),
      customerEmail: customerEmail.trim().toLowerCase(),
      customerTradeName: customerTradeName.trim().toUpperCase(),
      customerStateRegistration: customerStateRegistration.trim().toUpperCase(),
      customerStatus: customerStatus.trim().toUpperCase(),
      customerOpeningDate: customerOpeningDate.trim().toUpperCase(),
      customerCnae: customerCnae.trim().toUpperCase(),
      customerLegalNature: customerLegalNature.trim().toUpperCase(),
      customerPartners: customerPartners.trim().toUpperCase(),
      customerCep: customerCep.trim().toUpperCase(),
      customerStreet: customerStreet.trim().toUpperCase(),
      customerNumber: customerNumber.trim().toUpperCase(),
      customerComplement: customerComplement.trim().toUpperCase(),
      customerNeighborhood: customerNeighborhood.trim().toUpperCase(),
      customerCity: customerCity.trim().toUpperCase(),
      customerState: customerState.trim().toUpperCase(),
      equipmentType,
      brand: brand.trim().toUpperCase(),
      model: model.trim().toUpperCase(),
      serialNumber: serialNumber.trim().toUpperCase(),
      accessories: accessories.trim().toUpperCase(),
      configuration: configuration.trim().toUpperCase(),
      reportedIssue: reportedIssue.trim().toUpperCase(),
      technicalReport: technicalReport.trim().toUpperCase(),
      additionalInfo: additionalInfo.trim().toUpperCase(),
      status,
      checklist,
      items,
      partsTotal,
      servicesTotal,
      discount,
      total: totalCalculated,
      warrantyDays,
      technicianName: technicianName.trim().toUpperCase(),
      sellerId: sellerId || undefined,
      sellerName: (sellerId
        ? sellers.find((s) => s.id === sellerId)?.name || sellerName
        : sellerName
      )
        .trim()
        .toUpperCase() || undefined,
      paymentMethod: (paymentMethod || 'A COMBINAR').trim().toUpperCase(),
      paymentStatus: paymentStatus || 'pendente',
      entryDate: entryDate ? new Date(entryDate).toISOString() : (editingOS?.entryDate || new Date().toISOString()),
      deliveredDate: status === 'entregue' ? (deliveredDate || editingOS?.deliveredDate || new Date().toISOString()) : editingOS?.deliveredDate,
      statusDates: {
        ...(editingOS?.statusDates || {}),
        [status]: editingOS?.statusDates?.[status] || new Date().toISOString(),
        aberta: editingOS?.statusDates?.aberta || (entryDate ? new Date(entryDate).toISOString() : new Date().toISOString())
      }
    };

    const isNowReady = payload.status === 'concluida' && (!editingOS || editingOS.status !== 'concluida');
    const isNowDelivered = payload.status === 'entregue' && (!editingOS || editingOS.status !== 'entregue');
    await onSaveWorkOrder(payload);
    setIsModalOpen(false);

    // Se o status foi alterado para concluída ("pronta retirada"), abre modal de envio do WhatsApp com PDF
    const shouldNoticeReady = storeSettings?.osReadyMessageEnabled ?? true;
    if (isNowReady && shouldNoticeReady) {
      const fullUpdatedOS: WorkOrder = {
        ...(editingOS || {}),
        ...payload
      } as WorkOrder;
      setWhatsAppModalOS(fullUpdatedOS);
    }

    // Se o status foi alterado para "entregue" e o envio automático de mensagem ou PDF estiver ativado nas configurações
    const shouldAutoDeliver = storeSettings?.osAutoSendPdfWhatsApp ?? storeSettings?.autoSendPdfWhatsApp ?? storeSettings?.osDeliveredMessageEnabled ?? true;
    if (isNowDelivered && shouldAutoDeliver) {
      const fullUpdatedOS: WorkOrder = {
        ...(editingOS || {}),
        ...payload
      } as WorkOrder;
      const custObj = customers?.find((c) => c.id === fullUpdatedOS.customerId);
      sendWorkOrderDeliveredWhatsApp(fullUpdatedOS, storeSettings, custObj);
    }
  };

  const handleQuickStatusChange = async (os: WorkOrder, newStatus: WorkOrderStatus) => {
    const isDelivered = newStatus === 'entregue';
    const nowIso = new Date().toISOString();
    await onSaveWorkOrder({
      id: os.id,
      status: newStatus,
      ...(isDelivered ? { deliveredDate: os.deliveredDate || nowIso } : {}),
      statusDates: {
        ...(os.statusDates || {}),
        [newStatus]: nowIso
      }
    });

    // Se o status foi alterado na tabela rápida para "concluida" (pronta retirada), abre modal de envio do WhatsApp com PDF
    const shouldNoticeReadyQuick = storeSettings?.osReadyMessageEnabled ?? true;
    if (newStatus === 'concluida' && os.status !== 'concluida' && shouldNoticeReadyQuick) {
      setWhatsAppModalOS({ ...os, status: 'concluida' });
    }

    // Se o status foi alterado para "entregue" e o envio automático de mensagem ou PDF estiver ativado nas configurações
    const shouldAutoDeliverQuick = storeSettings?.osAutoSendPdfWhatsApp ?? storeSettings?.autoSendPdfWhatsApp ?? storeSettings?.osDeliveredMessageEnabled ?? true;
    if (isDelivered && os.status !== 'entregue' && shouldAutoDeliverQuick) {
      const custObj = customers?.find((c) => c.id === os.customerId);
      const targetOS: WorkOrder = {
        ...os,
        status: 'entregue',
        deliveredDate: os.deliveredDate || nowIso
      };
      sendWorkOrderDeliveredWhatsApp(targetOS, storeSettings, custObj);
    }
  };

  const sendWhatsAppNotification = (os: WorkOrder) => {
    const shouldAutoSend = storeSettings?.osAutoSendPdfWhatsApp ?? true;
    const custObj = customers?.find((c) => c.id === os.customerId);
    const phone = os.customerPhone || custObj?.whatsapp || custObj?.phone;

    if (shouldAutoSend && phone) {
      // Ao clicar no botão de enviar WhatsApp, dispara diretamente apenas o arquivo PDF (sem mensagem de texto)
      sendWorkOrderViaWhatsApp(os, phone, storeSettings, custObj, 'auto', null, true);
    } else {
      // Abre a modal para confirmação/inserção do número caso não tenha telefone preenchido
      setWhatsAppModalOS(os);
    }
  };

  const handleSaveWorkOrderPdfWithPicker = async (os: WorkOrder) => {
    const token = os.trackingToken || (os.number ? String(os.number) : os.id);
    const pdfUrl = `/api/public/work-orders/${encodeURIComponent(token)}/pdf`;
    const cleanClient = (os.customerName || 'Cliente').trim().replace(/[\\/:*?"<>|]/g, '_');
    const filename = `${os.number || '0'} - ${cleanClient}.pdf`;
    await savePdfWithLocationPicker(pdfUrl, filename);
  };

  const filteredWorkOrders = useMemo(() => {
    const list = workOrders.filter((os) => {
      const matchesStatus = selectedStatus === 'todas' || os.status === selectedStatus;
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        String(os.number).includes(q) ||
        (os.customerName && os.customerName.toLowerCase().includes(q)) ||
        (os.customerPhone && os.customerPhone.includes(q)) ||
        (os.brand && os.brand.toLowerCase().includes(q)) ||
        (os.model && os.model.toLowerCase().includes(q)) ||
        (os.configuration && os.configuration.toLowerCase().includes(q)) ||
        (os.serialNumber && os.serialNumber.toLowerCase().includes(q)) ||
        (os.additionalInfo && os.additionalInfo.toLowerCase().includes(q));

      return matchesStatus && matchesSearch;
    });

    const INACTIVE_STATUSES = new Set(['entregue', 'sem_reparo', 'cancelada', 'descarte']);

    return list.sort((a, b) => {
      const aInactive = INACTIVE_STATUSES.has(a.status);
      const bInactive = INACTIVE_STATUSES.has(b.status);

      // Ordens que ainda estiverem em qualquer status exceto entregue, sem reparo, cancelada e descarte sobem no topo
      if (!aInactive && bInactive) return -1;
      if (aInactive && !bInactive) return 1;

      // Desempate: data mais recente ou número da OS decrescente
      const dateA = new Date(a.entryDate || (a as any).createdAt || 0).getTime();
      const dateB = new Date(b.entryDate || (b as any).createdAt || 0).getTime();
      if (dateB !== dateA) return dateB - dateA;

      return (Number(b.number) || 0) - (Number(a.number) || 0);
    });
  }, [workOrders, selectedStatus, searchTerm]);

  const getEquipmentIcon = (type: string, className = 'w-5 h-5') => {
    switch (type) {
      case 'notebook':
        return <Laptop className={`${className} text-blue-400 shrink-0`} />;
      case 'computador':
        return <HardDrive className={`${className} text-indigo-400 shrink-0`} />;
      case 'monitor':
        return <Monitor className={`${className} text-sky-400 shrink-0`} />;
      case 'impressora':
        return <PrinterIcon className={`${className} text-amber-400 shrink-0`} />;
      default:
        return <Wrench className={`${className} text-slate-400 shrink-0`} />;
    }
  };

  // Aba Principal: 'ordens' | 'historico' | 'relatorio'
  const [activeMainTab, setActiveMainTab] = useState<'ordens' | 'historico' | 'relatorio'>('ordens');

  // Estados do Histórico Diário de OS
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [historyDate, setHistoryDate] = useState<string>(todayStr);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('todas');
  const [historySearch, setHistorySearch] = useState<string>('');

  // Estados do Relatório de Faturamento de OS
  const [reportPeriod, setReportPeriod] = useState<'diario' | 'semanal' | 'mensal' | 'anual'>('mensal');
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateStr(new Date()));
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getLocalMonthStr(new Date())); // YYYY-MM
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [reportSellerFilter, setReportSellerFilter] = useState<string>('todos');

  // ----------------------------------------------------
  // HISTÓRICO DIÁRIO DE OS
  // ----------------------------------------------------
  const dailyWorkOrders = useMemo(() => {
    return workOrders.filter((os) => {
      const dateToCheck =
        os.deliveredDate?.slice(0, 10) ||
        os.completionDate?.slice(0, 10) ||
        os.createdAt?.slice(0, 10) ||
        '';
      const matchesDate = dateToCheck === historyDate;

      const matchesStatus =
        historyStatusFilter === 'todas' ||
        (historyStatusFilter === 'concluidas' && (os.status === 'concluida' || os.status === 'entregue')) ||
        (historyStatusFilter === 'entregues' && os.status === 'entregue') ||
        (historyStatusFilter === 'em_andamento' &&
          ['aberta', 'analise', 'orcamento', 'aprovada', 'manutencao', 'aguardando_peca'].includes(os.status)) ||
        os.status === historyStatusFilter;

      const q = historySearch.toLowerCase();
      const matchesSearch =
        !historySearch ||
        String(os.number).includes(q) ||
        (os.customerName && os.customerName.toLowerCase().includes(q)) ||
        (os.customerPhone && os.customerPhone.includes(q)) ||
        (os.brand && os.brand.toLowerCase().includes(q)) ||
        (os.model && os.model.toLowerCase().includes(q)) ||
        (os.configuration && os.configuration.toLowerCase().includes(q)) ||
        (os.technicalReport && os.technicalReport.toLowerCase().includes(q)) ||
        (os.additionalInfo && os.additionalInfo.toLowerCase().includes(q));

      return matchesDate && matchesStatus && matchesSearch;
    });
  }, [workOrders, historyDate, historyStatusFilter, historySearch]);

  const dailyOSMetrics = useMemo(() => {
    const totalRevenue = dailyWorkOrders.reduce((acc, os) => acc + (os.total || 0), 0);
    const totalServices = dailyWorkOrders.reduce((acc, os) => acc + (os.servicesTotal || 0), 0);
    const totalParts = dailyWorkOrders.reduce((acc, os) => acc + (os.partsTotal || 0), 0);
    const totalCount = dailyWorkOrders.length;
    const completedCount = dailyWorkOrders.filter(
      (os) => os.status === 'concluida' || os.status === 'entregue'
    ).length;
    const avgTicket = totalCount > 0 ? totalRevenue / totalCount : 0;

    return { totalRevenue, totalServices, totalParts, totalCount, completedCount, avgTicket };
  }, [dailyWorkOrders]);

  // ----------------------------------------------------
  // RELATÓRIO DE FATURAMENTO DE OS
  // ----------------------------------------------------
  const reportWorkOrdersByPeriod = useMemo(() => {
    return workOrders.filter((os) => {
      if (os.status === 'cancelada') return false;
      const dateStr = getWorkOrderEffectiveDate(os);
      return isDateInPeriod(dateStr, reportPeriod, {
        selectedDate,
        selectedMonth,
        selectedYear
      });
    });
  }, [workOrders, reportPeriod, selectedDate, selectedMonth, selectedYear]);

  const osSellerBreakdown = useMemo(() => {
    return buildSellerBreakdown([], reportWorkOrdersByPeriod, sellers, products, services);
  }, [reportWorkOrdersByPeriod, sellers, products, services]);

  const reportWorkOrders = useMemo(() => {
    return reportWorkOrdersByPeriod.filter((os) =>
      matchesSellerFilter(os, reportSellerFilter, sellers)
    );
  }, [reportWorkOrdersByPeriod, reportSellerFilter, sellers]);

  const reportOSMetrics = useMemo(() => {
    const totalRevenue = reportWorkOrders.reduce((acc, os) => acc + (os.total || 0), 0);
    const totalServices = reportWorkOrders.reduce((acc, os) => acc + (os.servicesTotal || 0), 0);
    const totalParts = reportWorkOrders.reduce((acc, os) => acc + (os.partsTotal || 0), 0);
    const totalGross = reportWorkOrders.reduce((acc, os) => acc + calculateWorkOrderGross(os), 0);
    let totalPartsCost = 0;
    let totalServicesCost = 0;
    let totalCost = 0;
    reportWorkOrders.forEach((os) => {
      const c = calculateWorkOrderCost(os, products, services);
      totalPartsCost += c.partsCost;
      totalServicesCost += c.servicesCost;
      totalCost += c.totalCost;
    });
    const grossProfit = totalRevenue - totalCost;
    const totalDiscounts = reportWorkOrders.reduce((acc, os) => acc + (os.discount || 0), 0);
    const count = reportWorkOrders.length;
    const avgTicket = count > 0 ? totalRevenue / count : 0;
    const deliveredCount = reportWorkOrders.filter(
      (os) => os.status === 'entregue' || os.status === 'concluida'
    ).length;

    // Faturamento por Tipo de Equipamento
    const byEquipment: Record<
      string,
      { label: string; count: number; total: number; color: string }
    > = {
      notebook: { label: 'Notebooks', count: 0, total: 0, color: 'bg-blue-500' },
      computador: { label: 'Computadores Desktop', count: 0, total: 0, color: 'bg-indigo-500' },
      impressora: { label: 'Impressoras', count: 0, total: 0, color: 'bg-amber-500' },
      monitor: { label: 'Monitores', count: 0, total: 0, color: 'bg-sky-500' },
      outro: { label: 'Outros Equipamentos', count: 0, total: 0, color: 'bg-slate-500' }
    };

    reportWorkOrders.forEach((os) => {
      const eq = os.equipmentType || 'outro';
      if (!byEquipment[eq]) {
        byEquipment[eq] = { label: eq, count: 0, total: 0, color: 'bg-slate-500' };
      }
      byEquipment[eq].count += 1;
      byEquipment[eq].total += os.total || 0;
    });

    // Contagem por Status
    const byStatus: Record<string, number> = {};
    reportWorkOrders.forEach((os) => {
      byStatus[os.status] = (byStatus[os.status] || 0) + 1;
    });

    return {
      totalRevenue,
      totalGross,
      totalServices,
      totalParts,
      totalPartsCost,
      totalServicesCost,
      totalCost,
      grossProfit,
      totalDiscounts,
      count,
      avgTicket,
      deliveredCount,
      byEquipment,
      byStatus
    };
  }, [reportWorkOrders, products, services]);

  const isDimmedOSStatus = (st?: string) =>
    st === 'sem_reparo' || st === 'descarte' || st === 'entregue' || st === 'cancelada';

  const getStatusBadge = (st: string) => {
    const bStyle = getStatusBadgeStyle(
      st,
      storeSettings?.statusColors,
      storeSettings?.badgeFontSize,
      storeSettings?.badgePadding
    );
    const label = STATUS_LABELS[st] || st;
    return (
      <span style={bStyle} className="app-status-badge">
        {label}
      </span>
    );
  };

  const STATUS_TABS = [
    { id: 'todas', label: 'Todas' },
    { id: 'aberta', label: 'Abertas' },
    { id: 'analise', label: 'Em Análise' },
    { id: 'orcamento', label: 'Orçamento' },
    { id: 'aprovada', label: 'Aprovadas' },
    { id: 'manutencao', label: 'Na Bancada' },
    { id: 'aguardando_peca', label: 'Aguardando Peça' },
    { id: 'concluida', label: 'Prontas (Retirada)' },
    { id: 'entregue', label: 'Entregues' },
    { id: 'sem_reparo', label: 'Sem Reparo' },
    { id: 'descarte', label: 'Descarte' }
  ];

  return (
    <div className="space-y-4">
      {/* Abas Superiores de Navegação da OS */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveMainTab('ordens')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition ${
              activeMainTab === 'ordens'
                ? 'shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
            style={{
              fontSize: 'var(--app-tab-font-size, 12px)',
              backgroundColor: activeMainTab === 'ordens' ? 'var(--app-tab-active-color, #2563eb)' : undefined,
              color: activeMainTab === 'ordens' ? 'var(--app-tab-active-text, #ffffff)' : undefined
            }}
          >
            <Wrench style={{ width: 'var(--app-icon-size, 16px)', height: 'var(--app-icon-size, 16px)' }} />
            <span>Ordens de Serviço</span>
            <span
              className="px-1.5 py-0.2 rounded-full"
              style={{
                fontSize: 'calc(var(--app-tab-font-size, 12px) - 2px)',
                backgroundColor: activeMainTab === 'ordens' ? 'rgba(0,0,0,0.25)' : 'rgba(30,41,59,0.8)',
                color: activeMainTab === 'ordens' ? '#ffffff' : '#94a3b8'
              }}
            >
              {workOrders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveMainTab('historico')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition ${
              activeMainTab === 'historico'
                ? 'shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
            style={{
              fontSize: 'var(--app-tab-font-size, 12px)',
              backgroundColor: activeMainTab === 'historico' ? 'var(--app-tab-active-color, #2563eb)' : undefined,
              color: activeMainTab === 'historico' ? 'var(--app-tab-active-text, #ffffff)' : undefined
            }}
          >
            <Calendar style={{ width: 'var(--app-icon-size, 16px)', height: 'var(--app-icon-size, 16px)' }} />
            <span>Histórico Diário de OS</span>
            <span
              className="px-1.5 py-0.2 rounded-full"
              style={{
                fontSize: 'calc(var(--app-tab-font-size, 12px) - 2px)',
                backgroundColor: activeMainTab === 'historico' ? 'rgba(0,0,0,0.25)' : 'rgba(30,41,59,0.8)',
                color: activeMainTab === 'historico' ? '#ffffff' : '#94a3b8'
              }}
            >
              {
                workOrders.filter(
                  (o) =>
                    (o.deliveredDate || o.completionDate || o.createdAt || '').slice(0, 10) === todayStr
                ).length
              }{' '}
              hoje
            </span>
          </button>

          <button
            onClick={() => setActiveMainTab('relatorio')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition ${
              activeMainTab === 'relatorio'
                ? 'shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
            style={{
              fontSize: 'var(--app-tab-font-size, 12px)',
              backgroundColor: activeMainTab === 'relatorio' ? 'var(--app-tab-active-color, #2563eb)' : undefined,
              color: activeMainTab === 'relatorio' ? 'var(--app-tab-active-text, #ffffff)' : undefined
            }}
          >
            <BarChart3 style={{ width: 'var(--app-icon-size, 16px)', height: 'var(--app-icon-size, 16px)' }} />
            <span>Relatório de Faturamento de OS</span>
          </button>
        </div>

        {activeMainTab === 'relatorio' && (
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
          >
            <Printer className="w-3.5 h-3.5 text-slate-300" />
            <span>Imprimir Relatório</span>
          </button>
        )}
      </div>

      {/* ABA 1: PAINEL DE ORDENS DE SERVIÇO */}
      {activeMainTab === 'ordens' && (
        <div className="space-y-4">
          {/* Action and Search Header */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por Nº OS, cliente, telefone, modelo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={openNewModal}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white font-medium shadow-md transition shrink-0 active:scale-[0.98]"
              style={{
                fontSize: 'var(--app-tab-font-size, 12px)',
                backgroundColor: 'var(--app-primary-color, #2563eb)'
              }}
            >
              <Plus style={{ width: 'var(--app-icon-size, 16px)', height: 'var(--app-icon-size, 16px)' }} />
              <span>Nova Ordem de Serviço</span>
            </button>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800">
            {STATUS_TABS.map((tab) => {
              const count =
                tab.id === 'todas'
                  ? workOrders.length
                  : workOrders.filter((o) => o.status === tab.id).length;
              const isActive = selectedStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedStatus(tab.id)}
                  className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                    isActive
                      ? 'shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                  style={{
                    fontSize: 'var(--app-tab-font-size, 12px)',
                    backgroundColor: isActive ? 'var(--app-tab-active-color, #2563eb)' : undefined,
                    color: isActive ? 'var(--app-tab-active-text, #ffffff)' : undefined
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    className="px-1.5 py-0.2 rounded-full"
                    style={{
                      fontSize: 'calc(var(--app-tab-font-size, 12px) - 2px)',
                      backgroundColor: isActive ? 'rgba(0,0,0,0.25)' : 'rgba(30,41,59,0.8)',
                      color: isActive ? '#ffffff' : '#94a3b8'
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Work Orders Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] font-bold uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">OS Nº</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Equipamento</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Valor</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredWorkOrders.length > 0 ? (
                    filteredWorkOrders.map((os) => (
                      <tr
                        key={os.id}
                        className={`transition ${
                          isDimmedOSStatus(os.status)
                            ? 'bg-slate-950/95 brightness-[0.55] opacity-75 hover:brightness-75'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setViewingOS(os)}
                            className="hover:text-blue-400 hover:underline transition cursor-pointer font-bold block app-os-number"
                            style={{
                              fontSize: 'var(--app-os-number-size, 14px)',
                              color: 'var(--app-os-number-color, #38bdf8)'
                            }}
                            title="Visualizar Ordem de Serviço"
                          >
                            #{os.number}
                          </button>
                          <span className="text-[10px] text-slate-400 block font-normal">
                            📥 Entrada: {os.entryDate ? new Date(os.entryDate).toLocaleDateString('pt-BR') : ((os as any).createdAt ? new Date((os as any).createdAt).toLocaleDateString('pt-BR') : '-')}
                          </span>
                          {os.status === 'entregue' && os.deliveredDate && (
                            <span className="text-[10px] text-emerald-400 block font-semibold">
                              ✅ Entregue: {new Date(os.deliveredDate).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenHistoryForOS(os)}
                            className="text-left font-semibold hover:text-blue-400 group flex items-center gap-1.5 transition app-customer-name"
                            style={{
                              fontSize: 'var(--app-customer-name-size, 13px)',
                              color: 'var(--app-customer-name-color, #e2e8f0)'
                            }}
                            title="Clique para ver o histórico de OS e Vendas deste cliente"
                          >
                            <span className="group-hover:underline">{os.customerName}</span>
                            <History className="w-3 h-3 text-blue-400 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition shrink-0" />
                          </button>
                          <span className="text-[10px] text-slate-400 block">
                            {os.customerPhone}
                            {os.customerCpf ? ` • CPF: ${os.customerCpf}` : ''}
                          </span>
                          {os.sellerName && (
                            <span className="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                              Vendedor: {os.sellerName}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-center shrink-0">
                              {getEquipmentIcon(os.equipmentType)}
                            </div>
                            <div>
                              <span className="font-semibold text-white block">
                                {os.brand} {os.model}
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] text-slate-500 uppercase">
                                  {os.equipmentType} &bull; S/N: {os.serialNumber || 'N/A'}{os.configuration ? ` • ${os.configuration}` : ''}
                                </span>
                                {os.warrantyDays === 0 ? (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20">
                                    Sem garantia
                                  </span>
                                ) : (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20">
                                    {formatWarrantyShort(os.warrantyDays)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <select
                            value={os.status}
                            onChange={(e) =>
                              handleQuickStatusChange(os, e.target.value as WorkOrderStatus)
                            }
                            className={`text-[11px] font-bold rounded px-2 py-1 bg-slate-950 border focus:outline-none cursor-pointer ${
                              os.status === 'concluida'
                                ? 'border-emerald-500/50 text-emerald-400'
                                : isDimmedOSStatus(os.status)
                                ? 'border-zinc-700 text-zinc-300 bg-zinc-950'
                                : os.status === 'manutencao'
                                ? 'border-amber-500/50 text-amber-400'
                                : 'border-blue-500/50 text-blue-400'
                            }`}
                          >
                            <option value="aberta">Aberta</option>
                            <option value="analise">Em Análise</option>
                            <option value="orcamento">Orçamento</option>
                            <option value="aprovada">Aprovada</option>
                            <option value="manutencao">Na Bancada</option>
                            <option value="aguardando_peca">Aguardando Peça</option>
                            <option value="concluida">Pronta Retirada</option>
                            <option value="entregue">Entregue</option>
                            <option value="sem_reparo">Sem Reparo</option>
                            <option value="descarte">Descarte</option>
                            <option value="cancelada">Cancelada</option>
                          </select>
                          {os.status === 'entregue' && os.deliveredDate && (
                            <span className="block text-[10px] text-emerald-400 font-semibold mt-1">
                              📅 Entregue: {new Date(os.deliveredDate).toLocaleDateString('pt-BR')} {new Date(os.deliveredDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </td>
                        <td
                          className="py-3 px-4 text-right font-bold whitespace-nowrap"
                          style={{ color: 'var(--app-price-color, #34d399)' }}
                        >
                          {hideRevenue ? '•••••' : `R$ ${Number(os.total).toFixed(2)}`}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingOS(os)}
                              className="p-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 transition"
                              title="Visualizar Ordem de Serviço"
                            >
                              <Eye className="app-action-icon" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setOsForAddingItems(os)}
                              className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 transition"
                              title="Adicionar Serviço ou Peça ao Equipamento"
                            >
                              <PlusCircle className="app-action-icon" />
                            </button>
                            <button
                              onClick={() => sendWhatsAppNotification(os)}
                              className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 transition"
                              title="Enviar Ordem de Serviço pelo WhatsApp"
                            >
                              <MessageSquare className="app-action-icon" />
                            </button>
                            <button
                              onClick={() => {
                                const url = getWorkOrderTrackingUrl(os, storeSettings);
                                window.open(url, '_blank');
                              }}
                              className="p-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 transition"
                              title="Abrir Link de Acompanhamento do Cliente em Nova Aba"
                            >
                              <ExternalLink className="app-action-icon" />
                            </button>
                            <button
                              onClick={() => onPrintWorkOrder(os)}
                              className="p-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 transition"
                              title="Imprimir OS (A4 ou Térmica)"
                            >
                              <Printer className="app-action-icon" />
                            </button>
                            <button
                              onClick={() => openEditModal(os)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                              title="Editar OS"
                            >
                              <Edit className="app-action-icon" />
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => {
                                  requestAdminConfirmation({
                                    title: 'Excluir Ordem de Serviço',
                                    itemDescription: `OS #${os.number} - Cliente: ${os.customerName || 'Não identificado'}`,
                                    actionType: 'delete',
                                    onConfirm: async (adminPassword) => {
                                      await onDeleteWorkOrder(os.id, adminPassword);
                                    }
                                  });
                                }}
                                className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 transition"
                                title="Excluir OS"
                              >
                                <Trash2 className="app-action-icon" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Nenhuma ordem de serviço encontrada para este filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: HISTÓRICO DIÁRIO DE ORDENS DE SERVIÇO */}
      {activeMainTab === 'historico' && (
        <div className="space-y-4">
          {/* Barra de Filtros do Histórico Diário */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-slate-200">Data de Referência:</span>
                <input
                  type="date"
                  value={historyDate}
                  onChange={(e) => setHistoryDate(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-semibold"
                />
                <button
                  onClick={() => setHistoryDate(todayStr)}
                  className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 font-semibold"
                >
                  Hoje
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">Filtrar:</span>
                <select
                  value={historyStatusFilter}
                  onChange={(e) => setHistoryStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="todas">Todas as OS do Dia</option>
                  <option value="concluidas">Prontas & Entregues</option>
                  <option value="entregues">Somente Entregues</option>
                  <option value="em_andamento">Em Andamento</option>
                  <option value="sem_reparo">Sem Reparo</option>
                  <option value="descarte">Descarte</option>
                </select>
              </div>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por Nº OS, cliente ou aparelho..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Cards de Métricas do Dia para OS */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Faturamento de OS
                  </span>
                  {onToggleHideRevenue && (
                    <button
                      type="button"
                      onClick={onToggleHideRevenue}
                      className="text-slate-400 hover:text-white p-0.5 rounded transition"
                      title={hideRevenue ? 'Exibir faturamento' : 'Ocultar faturamento'}
                    >
                      {hideRevenue ? <EyeOff className="w-3 h-3 text-amber-400" /> : <Eye className="w-3 h-3" />}
                    </button>
                  )}
                </div>
                <h3 className="text-lg font-extrabold text-emerald-400 mt-0.5">
                  {hideRevenue ? 'R$ •••••' : `R$ ${dailyOSMetrics.totalRevenue.toFixed(2)}`}
                </h3>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs">
                R$
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Mão de Obra
                </span>
                <h3 className="text-lg font-extrabold text-indigo-400 mt-0.5">
                  {hideRevenue ? 'R$ •••••' : `R$ ${dailyOSMetrics.totalServices.toFixed(2)}`}
                </h3>
              </div>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Wrench className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Peças Aplicadas
                </span>
                <h3 className="text-lg font-extrabold text-amber-400 mt-0.5">
                  {hideRevenue ? 'R$ •••••' : `R$ ${dailyOSMetrics.totalParts.toFixed(2)}`}
                </h3>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <HardDrive className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Qtd de OS do Dia
                </span>
                <h3 className="text-lg font-extrabold text-blue-400 mt-0.5">
                  {dailyOSMetrics.totalCount} ({dailyOSMetrics.completedCount} prontas)
                </h3>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Ticket Médio OS
                </span>
                <h3 className="text-lg font-extrabold text-sky-400 mt-0.5">
                  {hideRevenue ? 'R$ •••••' : `R$ ${dailyOSMetrics.avgTicket.toFixed(2)}`}
                </h3>
              </div>
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Tabela do Histórico Diário de OS */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800 tracking-wider">
                  <tr>
                    <th className="p-3">OS Nº</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Equipamento</th>
                    <th className="p-3">Mão de Obra</th>
                    <th className="p-3">Peças</th>
                    <th className="p-3 text-right">Total da OS</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {dailyWorkOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-semibold">Nenhuma Ordem de Serviço nesta data ({historyDate})</p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          As OS movimentadas, concluídas ou entregues no dia aparecerão aqui.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    dailyWorkOrders.map((os) => (
                      <tr
                        key={os.id}
                        className={`transition ${
                          isDimmedOSStatus(os.status)
                            ? 'bg-slate-950/95 brightness-[0.55] opacity-75 hover:brightness-75'
                            : 'hover:bg-slate-850/60'
                        }`}
                      >
                        <td className="p-3 font-mono font-bold text-white whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setViewingOS(os)}
                            className="hover:text-blue-400 hover:underline transition cursor-pointer font-bold font-mono app-os-number"
                            style={{
                              fontSize: 'var(--app-os-number-size, 14px)',
                              color: 'var(--app-os-number-color, #38bdf8)'
                            }}
                            title="Visualizar Ordem de Serviço"
                          >
                            #{os.number}
                          </button>
                          <span className="text-[10px] text-slate-400 block font-normal font-sans">
                            📥 Entrada: {os.entryDate ? new Date(os.entryDate).toLocaleDateString('pt-BR') : ((os as any).createdAt ? new Date((os as any).createdAt).toLocaleDateString('pt-BR') : '-')}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenHistoryForOS(os)}
                            className="text-left font-semibold hover:text-blue-400 group flex items-center gap-1.5 transition app-customer-name"
                            style={{
                              fontSize: 'var(--app-customer-name-size, 13px)',
                              color: 'var(--app-customer-name-color, #e2e8f0)'
                            }}
                            title="Clique para ver o histórico de OS e Vendas deste cliente"
                          >
                            <span className="group-hover:underline">{os.customerName}</span>
                            <History className="w-3 h-3 text-blue-400 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition shrink-0" />
                          </button>
                          <span className="text-[10px] text-slate-400 block">
                            {os.customerPhone}
                            {os.customerCpf ? ` • CPF: ${os.customerCpf}` : ''}
                          </span>
                          {os.sellerName && (
                            <span className="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                              Vendedor: {os.sellerName}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-center shrink-0">
                              {getEquipmentIcon(os.equipmentType)}
                            </div>
                            <div>
                              <span className="font-semibold text-white block">
                                {os.brand} {os.model}
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] text-slate-500 uppercase">
                                  {os.equipmentType} &bull; S/N: {os.serialNumber || 'N/A'}{os.configuration ? ` • ${os.configuration}` : ''}
                                </span>
                                {os.warrantyDays === 0 ? (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20">
                                    Sem garantia
                                  </span>
                                ) : (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20">
                                    {formatWarrantyShort(os.warrantyDays)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-indigo-300">
                          {hideRevenue ? '•••••' : `R$ ${Number(os.servicesTotal || 0).toFixed(2)}`}
                        </td>
                        <td className="p-3 font-semibold text-amber-300">
                          {hideRevenue ? '•••••' : `R$ ${Number(os.partsTotal || 0).toFixed(2)}`}
                        </td>
                        <td className="p-3 text-right font-extrabold text-emerald-400 text-sm whitespace-nowrap">
                          {hideRevenue ? '•••••' : `R$ ${Number(os.total).toFixed(2)}`}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {getStatusBadge(os.status)}
                          {os.status === 'entregue' && os.deliveredDate && (
                            <span className="block text-[10px] text-emerald-400 font-semibold mt-1">
                              📅 Entregue: {new Date(os.deliveredDate).toLocaleDateString('pt-BR')} {new Date(os.deliveredDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingOS(os)}
                              className="p-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 transition"
                              title="Visualizar Ordem de Serviço"
                            >
                              <Eye className="app-action-icon" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setOsForAddingItems(os)}
                              className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 transition"
                              title="Adicionar Serviço ou Peça ao Equipamento"
                            >
                              <PlusCircle className="app-action-icon" />
                            </button>
                            <button
                              onClick={() => sendWhatsAppNotification(os)}
                              className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 transition"
                              title="Enviar Ordem de Serviço pelo WhatsApp"
                            >
                              <MessageSquare className="app-action-icon" />
                            </button>
                            <button
                              onClick={() => {
                                const url = getWorkOrderTrackingUrl(os, storeSettings);
                                window.open(url, '_blank');
                              }}
                              className="p-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 transition"
                              title="Abrir Link de Acompanhamento do Cliente em Nova Aba"
                            >
                              <ExternalLink className="app-action-icon" />
                            </button>
                            <button
                              onClick={() => onPrintWorkOrder(os)}
                              className="p-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 transition"
                              title="Imprimir OS / Termo"
                            >
                              <Printer className="app-action-icon" />
                            </button>
                            <button
                              onClick={() => openEditModal(os)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                              title="Editar OS"
                            >
                              <Edit className="app-action-icon" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: RELATÓRIO DE FATURAMENTO DE ORDENS DE SERVIÇO */}
      {activeMainTab === 'relatorio' && (
        <div className="space-y-4">
          {/* Seletor de Período */}
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Período:
              </span>
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setReportPeriod('diario')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                    reportPeriod === 'diario'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Diário
                </button>
                <button
                  onClick={() => setReportPeriod('semanal')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                    reportPeriod === 'semanal'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Últimos 7 Dias
                </button>
                <button
                  onClick={() => setReportPeriod('mensal')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                    reportPeriod === 'mensal'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Mensal
                </button>
                <button
                  onClick={() => setReportPeriod('anual')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                    reportPeriod === 'anual'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Anual
                </button>
              </div>
            </div>

            {/* Controles Dinâmicos para Data / Mês / Ano + Vendedor + Botão Ocultar Faturamento */}
            <div className="flex flex-wrap items-center gap-2">
              {reportPeriod === 'diario' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">Dia:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500 font-semibold"
                  />
                </div>
              )}

              {reportPeriod === 'mensal' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">Mês de Referência:</span>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500 font-semibold"
                  />
                </div>
              )}

              {reportPeriod === 'anual' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">Ano:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1 text-xs text-white focus:outline-none focus:border-blue-500 font-semibold"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Filtro por Vendedor */}
              <div className="flex items-center gap-1.5">
                <BadgeDollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <select
                  value={reportSellerFilter}
                  onChange={(e) => setReportSellerFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                  title="Filtrar OS por vendedor"
                >
                  <option value="todos">Todos os Vendedores</option>
                  {sellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  <option value={UNASSIGNED_SELLER_KEY}>Sem Vendedor / Loja</option>
                </select>
              </div>

              {onOpenGeneralReport && (
                <button
                  type="button"
                  onClick={onOpenGeneralReport}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition"
                  title="Abrir Relatório de Faturamento Geral (Vendas + Serviços/OS)"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Relatório Geral</span>
                </button>
              )}

              {onToggleHideRevenue && (
                <button
                  type="button"
                  onClick={onToggleHideRevenue}
                  title={hideRevenue ? 'Exibir faturamento' : 'Ocultar faturamento'}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-300 hover:text-white hover:border-slate-700 transition"
                >
                  {hideRevenue ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[11px] font-semibold text-amber-300">Oculto</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[11px] font-semibold">Ocultar</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Cards de Métricas Principais da OS */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="bg-slate-900 border border-blue-500/30 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider">
                Valor Bruto OS
              </span>
              <h3 className="text-lg font-extrabold text-blue-300 mt-1">
                {hideRevenue ? 'R$ •••••' : `R$ ${reportOSMetrics.totalGross.toFixed(2)}`}
              </h3>
              <p className="text-[10px] text-amber-400 mt-0.5">
                {hideRevenue ? '•••••' : `Desc.: - R$ ${reportOSMetrics.totalDiscounts.toFixed(2)}`}
              </p>
            </div>

            <div className="bg-slate-900 border border-rose-500/30 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-rose-300 tracking-wider">
                Custo Total OS
              </span>
              <h3 className="text-lg font-extrabold text-rose-400 mt-1">
                {hideRevenue ? 'R$ •••••' : `R$ ${reportOSMetrics.totalCost.toFixed(2)}`}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {hideRevenue
                  ? '•••'
                  : `MO: R$ ${reportOSMetrics.totalServicesCost.toFixed(2)} | Peças: R$ ${reportOSMetrics.totalPartsCost.toFixed(2)}`}
              </p>
            </div>

            <div className="bg-slate-900 border border-emerald-500/30 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">
                Faturamento Líquido OS
              </span>
              <h3 className="text-xl font-black text-emerald-400 mt-1">
                {hideRevenue ? 'R$ •••••' : `R$ ${reportOSMetrics.totalRevenue.toFixed(2)}`}
              </h3>
            </div>

            <div className="bg-slate-900 border border-teal-500/30 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-teal-300 tracking-wider">
                Lucro Bruto Est.
              </span>
              <h3 className={`text-lg font-extrabold mt-1 ${reportOSMetrics.grossProfit >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                {hideRevenue ? 'R$ •••••' : `R$ ${reportOSMetrics.grossProfit.toFixed(2)}`}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Margem: {reportOSMetrics.totalRevenue > 0 ? ((reportOSMetrics.grossProfit / reportOSMetrics.totalRevenue) * 100).toFixed(1) : '0.0'}%
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                MO / Peças (Bruto)
              </span>
              <h3 className="text-sm font-extrabold text-indigo-400 mt-1">
                {hideRevenue ? 'MO: R$ •••' : `MO: R$ ${reportOSMetrics.totalServices.toFixed(2)}`}
              </h3>
              <p className="text-xs font-bold text-amber-400 mt-0.5">
                {hideRevenue ? 'Peças: R$ •••' : `Peças: R$ ${reportOSMetrics.totalParts.toFixed(2)}`}
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                OS & Ticket Médio
              </span>
              <h3 className="text-base font-extrabold text-blue-400 mt-1">
                {reportOSMetrics.count} OS ({reportOSMetrics.deliveredCount} entr.)
              </h3>
              <p className="text-[10px] font-bold text-sky-400 mt-0.5">
                Ticket: {hideRevenue ? 'R$ •••••' : `R$ ${reportOSMetrics.avgTicket.toFixed(2)}`}
              </p>
            </div>
          </div>

          {/* Separação de Faturamento de OS por Vendedor */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Separação de Faturamento por Vendedor (Ordens de Serviço)</span>
              </h4>
              {reportSellerFilter !== 'todos' && (
                <button
                  type="button"
                  onClick={() => setReportSellerFilter('todos')}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold underline"
                >
                  Mostrar todos os vendedores
                </button>
              )}
            </div>

            {osSellerBreakdown.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                Nenhum vendedor ou OS registrada no período.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {osSellerBreakdown.map((row) => {
                    const totalPeriodOS = osSellerBreakdown.reduce((a, r) => a + r.osNet, 0);
                    const pct = totalPeriodOS > 0 ? (row.osNet / totalPeriodOS) * 100 : 0;
                    const osProfit = row.osNet - row.osCost;
                    const isActive = reportSellerFilter === row.key;

                    return (
                      <button
                        key={row.key}
                        type="button"
                        onClick={() => setReportSellerFilter(isActive ? 'todos' : row.key)}
                        className={`p-3 rounded-xl border text-left transition ${
                          isActive
                            ? 'bg-emerald-600/15 border-emerald-500 ring-1 ring-emerald-500/40'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                        }`}
                        title="Clique para filtrar OS deste vendedor"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-white text-xs truncate">{row.sellerName}</span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {row.osCount} OS
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between mt-1.5">
                          <span className="text-sm font-black text-emerald-400">
                            {hideRevenue ? 'R$ •••••' : `R$ ${row.osNet.toFixed(2)}`}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 mt-1.5 text-[10px] bg-slate-900/70 px-2 py-1 rounded-lg">
                          <div>
                            <span className="text-slate-400 block">Bruto</span>
                            <span className="font-bold text-blue-300">
                              {hideRevenue ? '•••' : `R$ ${row.osGross.toFixed(2)}`}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Custo</span>
                            <span className="font-bold text-rose-400">
                              {hideRevenue ? '•••' : `R$ ${row.osCost.toFixed(2)}`}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Lucro</span>
                            <span className={`font-bold ${osProfit >= 0 ? 'text-teal-300' : 'text-rose-400'}`}>
                              {hideRevenue ? '•••' : `R$ ${osProfit.toFixed(2)}`}
                            </span>
                          </div>
                        </div>
                        {!hideRevenue && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            MO: R$ {row.osServices.toFixed(2)} | Peças: R$ {row.osParts.toFixed(2)}
                          </div>
                        )}
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1.5">
                          <div
                            className={`h-full rounded-full ${row.isUnassigned ? 'bg-slate-500' : 'bg-indigo-500'}`}
                            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                          />
                        </div>
                        {row.commissionRate > 0 && !hideRevenue && (
                          <p className="text-[10px] text-amber-300 mt-1">
                            Comissão ({row.commissionRate}%): R$ {((row.osNet * row.commissionRate) / 100).toFixed(2)}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Total Geral Consolidado de Vendedores (OS no Período) */}
                <div className="mt-2 pt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-950/60 p-3 rounded-xl">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block">Total Geral Bruto OS</span>
                    <span className="font-extrabold text-blue-300">
                      {hideRevenue
                        ? 'R$ •••••'
                        : `R$ ${osSellerBreakdown.reduce((a, r) => a + r.osGross, 0).toFixed(2)}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block">Total Geral Custo OS</span>
                    <span className="font-extrabold text-rose-400">
                      {hideRevenue
                        ? 'R$ •••••'
                        : `R$ ${osSellerBreakdown.reduce((a, r) => a + r.osCost, 0).toFixed(2)}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block">Total Geral Líquido OS</span>
                    <span className="font-black text-emerald-400">
                      {hideRevenue
                        ? 'R$ •••••'
                        : `R$ ${osSellerBreakdown.reduce((a, r) => a + r.osNet, 0).toFixed(2)}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block">Total Geral Lucro OS</span>
                    <span className="font-extrabold text-teal-300">
                      {hideRevenue
                        ? 'R$ •••••'
                        : `R$ ${osSellerBreakdown.reduce((a, r) => a + (r.osNet - r.osCost), 0).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Divisão: Faturamento por Equipamento & Composição Financeira */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Breakdown por Equipamento */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Laptop className="w-4 h-4 text-blue-400" />
                <span>Faturamento por Tipo de Equipamento</span>
              </h4>

              <div className="space-y-3">
                {Object.entries(reportOSMetrics.byEquipment).map(([key, data]) => {
                  const percent =
                    reportOSMetrics.totalRevenue > 0
                      ? (data.total / reportOSMetrics.totalRevenue) * 100
                      : 0;

                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                            {getEquipmentIcon(key)}
                          </div>
                          <span className="font-semibold text-slate-300">
                            {data.label} ({data.count} {data.count === 1 ? 'aparelho' : 'aparelhos'})
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-white">
                            {hideRevenue ? 'R$ •••••' : `R$ ${data.total.toFixed(2)}`}
                          </span>
                          {!hideRevenue && (
                            <span className="text-[10px] text-slate-400 ml-1.5 font-mono">
                              ({percent.toFixed(1)}%)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${data.color}`}
                          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Composição Financeira (Mão de Obra vs Peças) */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>Composição da Receita (Mão de Obra vs Peças)</span>
              </h4>

              <div className="space-y-3">
                {/* Mão de Obra */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-semibold text-indigo-300">
                      🛠️ Serviços & Mão de Obra Técnica
                    </span>
                    <div className="text-right">
                      <span className="font-bold text-white">
                        {hideRevenue ? (
                          'R$ •••••'
                        ) : (
                          `R$ ${reportOSMetrics.totalServices.toFixed(2)} (${(reportOSMetrics.totalRevenue > 0 ? (reportOSMetrics.totalServices / reportOSMetrics.totalRevenue) * 100 : 0).toFixed(1)}%)`
                        )}
                      </span>
                      {!hideRevenue && (
                        <span className="text-[10px] text-rose-400 ml-2 font-mono">
                          (Custo: R$ {reportOSMetrics.totalServicesCost.toFixed(2)})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          reportOSMetrics.totalRevenue > 0
                            ? (reportOSMetrics.totalServices / reportOSMetrics.totalRevenue) * 100
                            : 0
                        )}%`
                      }}
                    />
                  </div>
                </div>

                {/* Peças e Hardware */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-semibold text-amber-300">
                      📦 Peças & Componentes Substituídos
                    </span>
                    <div className="text-right">
                      <span className="font-bold text-white">
                        {hideRevenue ? (
                          'R$ •••••'
                        ) : (
                          `R$ ${reportOSMetrics.totalParts.toFixed(2)} (${(reportOSMetrics.totalRevenue > 0 ? (reportOSMetrics.totalParts / reportOSMetrics.totalRevenue) * 100 : 0).toFixed(1)}%)`
                        )}
                      </span>
                      {!hideRevenue && (
                        <span className="text-[10px] text-rose-400 ml-2 font-mono">
                          (Custo: R$ {reportOSMetrics.totalPartsCost.toFixed(2)})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          reportOSMetrics.totalRevenue > 0
                            ? (reportOSMetrics.totalParts / reportOSMetrics.totalRevenue) * 100
                            : 0
                        )}%`
                      }}
                    />
                  </div>
                </div>

                {/* Resumo Rápido */}
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Descontos Concedidos em OS:</span>
                    <span className="text-amber-400 font-bold">
                      {hideRevenue ? '- R$ •••••' : `- R$ ${reportOSMetrics.totalDiscounts.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-800">
                    <span className="font-bold text-slate-200">Faturamento Líquido de OS:</span>
                    <span className="font-extrabold text-emerald-400">
                      {hideRevenue ? 'R$ •••••' : `R$ ${reportOSMetrics.totalRevenue.toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova / Editar OS */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
        >
          <div
            className={`border rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl transition-all duration-300 ${
              isDimmedOSStatus(status)
                ? 'bg-slate-950 border-zinc-800 brightness-[0.58]'
                : 'bg-slate-900 border-slate-800'
            }`}
          >
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingOS ? `Editar Ordem de Serviço #${editingOS.number}` : 'Nova Ordem de Serviço'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cadastro de equipamento para manutenção, diagnóstico e peças
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form
              onSubmit={handleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                  e.preventDefault();
                }
              }}
              autoComplete="off"
              className="flex-1 overflow-y-auto p-6 space-y-6"
            >
              {/* Cliente */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wide">
                      1. Dados do Cliente
                    </h4>
                  </div>
                  {(cleanDigits(customerCpf).length === 14 || customerTradeName || customerCnae) && (
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded border border-blue-500/30 flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      Pessoa Jurídica (Empresa)
                    </span>
                  )}
                </div>

                {/* Seleção de Cliente e Identificação Documento */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-slate-400 block">Selecionar Cliente Cadastrado</label>
                      {customerId && (
                        <button
                          type="button"
                          onClick={() => {
                            const c = customers.find((cust) => cust.id === customerId);
                            if (c) {
                              setHistoryCustomer(c);
                              setIsHistoryModalOpen(true);
                            }
                          }}
                          className="text-[10px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-0.5 rounded transition"
                          title="Ver histórico de OS e Vendas deste cliente"
                        >
                          <History className="w-3 h-3" />
                          <span>Ver Histórico</span>
                        </button>
                      )}
                    </div>
                    <select
                      id="os-customer-select"
                      name="customerId"
                      value={customerId}
                      onChange={(e) => handleSelectCustomer(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Cliente Avulso / Balcão</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.document ? `(${c.document})` : ''} - {c.phone || c.whatsapp}
                        </option>
                      ))}
                    </select>
                    {customerId && (
                      <div className="mt-1 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Cliente selecionado</span>
                        <button
                          type="button"
                          onClick={() => {
                            const c = customers.find((cust) => cust.id === customerId);
                            if (c) {
                              setHistoryCustomer(c);
                              setIsHistoryModalOpen(true);
                            }
                          }}
                          className="text-blue-400 hover:text-blue-300 font-semibold underline flex items-center gap-1 text-[10px]"
                        >
                          <History className="w-3 h-3" />
                          <span>Abrir Histórico (OS e Vendas)</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="os-customer-cpf" className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                        CPF ou CNPJ
                      </label>
                      {cleanDigits(customerCpf).length === 14 && (
                        <button
                          type="button"
                          onClick={() => performCnpjLookupInOS(customerCpf)}
                          disabled={isSearchingCnpj}
                          className="text-[10px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-0.5 rounded transition"
                        >
                          {isSearchingCnpj ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                          {isSearchingCnpj ? 'Consultando...' : 'Consultar Dados na Receita'}
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id="os-customer-cpf"
                        name="customerCpf"
                        type="text"
                        value={customerCpf}
                        onChange={(e) => handleCustomerCpfChange(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white pr-8 font-mono tracking-wider focus:outline-none focus:border-blue-500"
                        placeholder="Digite o CNPJ (14 dígitos) para busca automática ou CPF"
                      />
                      {isSearchingCnpj && (
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                        </div>
                      )}
                    </div>
                    {cnpjFeedback && (
                      <div className={`mt-1.5 text-[11px] flex items-center gap-1.5 font-medium px-2.5 py-1 rounded-md border ${
                        cnpjFeedback.type === 'success' ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60' :
                        cnpjFeedback.type === 'error' ? 'bg-amber-950/60 text-amber-300 border-amber-800/60' :
                        'bg-blue-950/60 text-blue-300 border-blue-800/60'
                      }`}>
                        {cnpjFeedback.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />}
                        {cnpjFeedback.type === 'error' && <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />}
                        {cnpjFeedback.type === 'info' && <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-blue-400" />}
                        <span className="truncate">{cnpjFeedback.message}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Se for CNPJ ou possuir dados corporativos */}
                {cleanDigits(customerCpf).length === 14 || customerTradeName || customerCnae ? (
                  <div className="space-y-3 pt-1">
                    {/* Razão Social e Fantasia */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                          Razão Social / Nome da Empresa *
                        </label>
                        <input
                          id="os-customer-name"
                          name="customerName"
                          type="text"
                          required
                          value={customerName}
                          onChange={(e) => {
                            setCustomerName(e.target.value);
                            if (customerId) setCustomerId('');
                          }}
                          onBlur={() => setCustomerName((prev) => prev.toUpperCase())}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white uppercase font-semibold focus:outline-none focus:border-blue-500"
                          placeholder="Razão Social completa"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                          Nome Fantasia
                        </label>
                        <input
                          type="text"
                          value={customerTradeName}
                          onChange={(e) => setCustomerTradeName(e.target.value)}
                          onBlur={() => setCustomerTradeName((prev) => prev.toUpperCase())}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white uppercase focus:outline-none focus:border-blue-500"
                          placeholder="Nome Fantasia / Comercial"
                        />
                      </div>
                    </div>

                    {/* IE, Situação e Abertura */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Inscrição Estadual (IE)</label>
                        <input
                          type="text"
                          value={customerStateRegistration}
                          onChange={(e) => setCustomerStateRegistration(e.target.value)}
                          onBlur={() => setCustomerStateRegistration((prev) => prev.toUpperCase())}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono uppercase focus:outline-none focus:border-blue-500"
                          placeholder="Isento ou Nº"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Situação Cadastral</label>
                        <input
                          type="text"
                          value={customerStatus}
                          onChange={(e) => setCustomerStatus(e.target.value)}
                          onBlur={() => setCustomerStatus((prev) => prev.toUpperCase())}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-emerald-400 font-bold uppercase focus:outline-none focus:border-blue-500"
                          placeholder="Ex: ATIVA"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Data de Abertura</label>
                        <input
                          type="text"
                          value={customerOpeningDate}
                          onChange={(e) => setCustomerOpeningDate(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                          placeholder="DD/MM/AAAA"
                        />
                      </div>
                    </div>

                    {/* CNAE e Natureza Jurídica */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">CNAE Principal (Atividade)</label>
                        <input
                          type="text"
                          value={customerCnae}
                          onChange={(e) => setCustomerCnae(e.target.value)}
                          onBlur={() => setCustomerCnae((prev) => prev.toUpperCase())}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white uppercase focus:outline-none focus:border-blue-500"
                          placeholder="Atividade Econômica"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Natureza Jurídica / Porte</label>
                        <input
                          type="text"
                          value={customerLegalNature}
                          onChange={(e) => setCustomerLegalNature(e.target.value)}
                          onBlur={() => setCustomerLegalNature((prev) => prev.toUpperCase())}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white uppercase focus:outline-none focus:border-blue-500"
                          placeholder="Ex: Sociedade Ltda - ME"
                        />
                      </div>
                    </div>

                    {/* Sócios / QSA */}
                    {customerPartners && (
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Sócios / Administradores (QSA)</label>
                        <input
                          type="text"
                          value={customerPartners}
                          onChange={(e) => setCustomerPartners(e.target.value)}
                          onBlur={() => setCustomerPartners((prev) => prev.toUpperCase())}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 uppercase focus:outline-none focus:border-blue-500"
                          placeholder="Quadro societário"
                        />
                      </div>
                    )}

                    {/* Contatos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-300 font-semibold block mb-1">Telefone Comercial / WhatsApp *</label>
                        <input
                          id="os-customer-phone"
                          name="customerPhone"
                          type="text"
                          required
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                          placeholder="(11) 98765-4321"
                        />
                      </div>
                      <div>
                        <label htmlFor="os-customer-email" className="text-[11px] text-slate-400 block mb-1">E-mail Corporativo / NFe</label>
                        <input
                          id="os-customer-email"
                          name="customerEmail"
                          type="email"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          onBlur={() => setCustomerEmail((prev) => prev.toLowerCase())}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white lowercase focus:outline-none focus:border-blue-500"
                          placeholder="empresa@email.com"
                        />
                      </div>
                    </div>

                    {/* Endereço Detalhado da Empresa */}
                    <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800 space-y-3">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block">
                        Endereço da Empresa
                      </span>

                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">CEP</label>
                          <input
                            type="text"
                            placeholder="00000-000"
                            value={customerCep}
                            onChange={(e) => setCustomerCep(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="text-[11px] text-slate-400 block mb-1">Rua / Logradouro</label>
                          <input
                            type="text"
                            placeholder="Ex: Av. Brasil"
                            value={customerStreet}
                            onChange={(e) => setCustomerStreet(e.target.value)}
                            onBlur={() => setCustomerStreet((prev) => prev.toUpperCase())}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white uppercase"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Número</label>
                          <input
                            type="text"
                            placeholder="Nº ou S/N"
                            value={customerNumber}
                            onChange={(e) => setCustomerNumber(e.target.value)}
                            onBlur={() => setCustomerNumber((prev) => prev.toUpperCase())}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white uppercase"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Complemento</label>
                          <input
                            type="text"
                            placeholder="Sala, Galpão..."
                            value={customerComplement}
                            onChange={(e) => setCustomerComplement(e.target.value)}
                            onBlur={() => setCustomerComplement((prev) => prev.toUpperCase())}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white uppercase"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Bairro</label>
                          <input
                            type="text"
                            placeholder="Bairro"
                            value={customerNeighborhood}
                            onChange={(e) => setCustomerNeighborhood(e.target.value)}
                            onBlur={() => setCustomerNeighborhood((prev) => prev.toUpperCase())}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white uppercase"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <label className="text-[11px] text-slate-400 block mb-1">Cidade / Município</label>
                          <input
                            type="text"
                            placeholder="Ex: Brasília"
                            value={customerCity}
                            onChange={(e) => setCustomerCity(e.target.value)}
                            onBlur={() => setCustomerCity((prev) => prev.toUpperCase())}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white uppercase"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">UF (Estado)</label>
                          <input
                            type="text"
                            placeholder="DF"
                            maxLength={2}
                            value={customerState}
                            onChange={(e) => setCustomerState(e.target.value)}
                            onBlur={() => setCustomerState((prev) => prev.toUpperCase())}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono uppercase"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Modo Pessoa Física / Dados Simples */
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Nome do Cliente *</label>
                      <input
                        id="os-customer-name"
                        name="customerName"
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => {
                          setCustomerName(e.target.value);
                          if (customerId) setCustomerId('');
                        }}
                        onBlur={() => setCustomerName((prev) => prev.toUpperCase())}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 uppercase"
                        placeholder="Ex: João da Silva"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Telefone / WhatsApp</label>
                      <input
                        id="os-customer-phone"
                        name="customerPhone"
                        type="text"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                        placeholder="(11) 98765-4321"
                      />
                    </div>
                    <div>
                      <label htmlFor="os-customer-email" className="text-[11px] text-slate-400 block mb-1">E-mail</label>
                      <input
                        id="os-customer-email"
                        name="customerEmail"
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        onBlur={() => setCustomerEmail((prev) => prev.toLowerCase())}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white lowercase focus:outline-none focus:border-blue-500"
                        placeholder="cliente@email.com"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-3">
                      <label htmlFor="os-customer-address" className="text-[11px] text-slate-400 block mb-1">Endereço Completo</label>
                      <input
                        id="os-customer-address"
                        name="customerAddress"
                        type="text"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        onBlur={() => setCustomerAddress((prev) => prev.toUpperCase())}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white uppercase focus:outline-none focus:border-blue-500"
                        placeholder="Rua, Nº, Bairro, Cidade - UF"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Equipamento */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-3">
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wide">
                  2. Dados do Equipamento
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="os-equipment-type" className="text-[11px] text-slate-400 block mb-1">Tipo de Aparelho</label>
                    <select
                      id="os-equipment-type"
                      name="equipmentType"
                      value={equipmentType}
                      onChange={(e) => setEquipmentType(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white capitalize"
                    >
                      <option value="notebook">Notebook</option>
                      <option value="computador">Computador / Desktop</option>
                      <option value="impressora">Impressora</option>
                      <option value="monitor">Monitor</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="os-equipment-brand" className="text-[11px] text-slate-400 block mb-1">Marca *</label>
                    <input
                      id="os-equipment-brand"
                      name="brand"
                      type="text"
                      required
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      onBlur={() => setBrand((prev) => prev.toUpperCase())}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white uppercase"
                      placeholder="Ex: Dell, Lenovo, HP, Epson..."
                    />
                  </div>
                  <div>
                    <label htmlFor="os-equipment-model" className="text-[11px] text-slate-400 block mb-1">Modelo *</label>
                    <input
                      id="os-equipment-model"
                      name="model"
                      type="text"
                      required
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      onBlur={() => setModel((prev) => prev.toUpperCase())}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white uppercase"
                      placeholder="Ex: Inspiron 15, EcoTank L3250..."
                    />
                  </div>
                  <div>
                    <label htmlFor="os-equipment-serial" className="text-[11px] text-slate-400 block mb-1">Nº de Série / Service Tag</label>
                    <input
                      id="os-equipment-serial"
                      name="serialNumber"
                      type="text"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      onBlur={() => setSerialNumber((prev) => prev.toUpperCase())}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white uppercase"
                      placeholder="Ex: BR59X..."
                    />
                  </div>
                  <div>
                    <label htmlFor="os-equipment-config" className="text-[11px] text-slate-400 block mb-1">Configuração</label>
                    <input
                      id="os-equipment-config"
                      name="configuration"
                      type="text"
                      value={configuration}
                      onChange={(e) => setConfiguration(e.target.value)}
                      onBlur={() => setConfiguration((prev) => prev.toUpperCase())}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white uppercase"
                      placeholder="Ex: Core i5, 8GB RAM, SSD 256GB, Win 11"
                    />
                  </div>
                  <div>
                    <label htmlFor="os-equipment-accessories" className="text-[11px] text-slate-400 block mb-1">Acessórios Deixados</label>
                    <input
                      id="os-equipment-accessories"
                      name="accessories"
                      type="text"
                      value={accessories}
                      onChange={(e) => setAccessories(e.target.value)}
                      onBlur={() => setAccessories((prev) => prev.toUpperCase())}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white uppercase"
                      placeholder="Ex: Fonte/Carregador, Cabo..."
                    />
                  </div>
                  <div>
                    <label htmlFor="os-equipment-entry-date" className="text-[11px] text-slate-400 block mb-1">
                      Data e Hora de Entrada *
                    </label>
                    <input
                      id="os-equipment-entry-date"
                      name="entryDate"
                      type="datetime-local"
                      required
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Checklist de Entrada */}
                <div className="pt-2 border-t border-slate-800">
                  <p className="text-[11px] font-semibold text-slate-300 mb-2">Checklist de Entrada:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-300">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        id="chk-ligando"
                        name="chk_ligando"
                        type="checkbox"
                        checked={!!checklist.ligando}
                        onChange={(e) => setChecklist((prev) => ({ ...prev, ligando: e.target.checked }))}
                        className="rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                      <span>Aparelho Liga</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        id="chk-carregador"
                        name="chk_carregador"
                        type="checkbox"
                        checked={!!checklist.carregadorFonte}
                        onChange={(e) => setChecklist((prev) => ({ ...prev, carregadorFonte: e.target.checked }))}
                        className="rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                      <span>Fonte/Carregador</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        id="chk-cabo"
                        name="chk_cabo"
                        type="checkbox"
                        checked={!!checklist.caboForca}
                        onChange={(e) => setChecklist((prev) => ({ ...prev, caboForca: e.target.checked }))}
                        className="rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                      <span>Cabo de Força</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        id="chk-testado"
                        name="chk_testado"
                        type="checkbox"
                        checked={!!checklist.testadoNaEntrada}
                        onChange={(e) => setChecklist((prev) => ({ ...prev, testadoNaEntrada: e.target.checked }))}
                        className="rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                      <span>Testado na Entrada</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <div>
                      <label htmlFor="chk-avarias" className="text-[10px] text-slate-400 block mb-0.5">Avarias Visíveis (Riscos, trincos, tampa solta)</label>
                      <input
                        id="chk-avarias"
                        name="avariasVisiveis"
                        type="text"
                        value={checklist.avariasVisiveis || ''}
                        onChange={(e) => setChecklist((prev) => ({ ...prev, avariasVisiveis: e.target.value }))}
                        onBlur={() => setChecklist((prev) => ({ ...prev, avariasVisiveis: (prev.avariasVisiveis || '').toUpperCase() }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white uppercase"
                        placeholder="Ex: Leve risco na tampa, sem pés de borracha..."
                      />
                    </div>
                    <div>
                      <label htmlFor="chk-senha" className="text-[10px] text-slate-400 block mb-0.5">Senha do Windows / BIOS (para testes)</label>
                      <input
                        id="chk-senha"
                        name="senhaAparelho"
                        type="text"
                        value={checklist.senhaAparelho || ''}
                        onChange={(e) => setChecklist((prev) => ({ ...prev, senhaAparelho: e.target.value }))}
                        onBlur={() => setChecklist((prev) => ({ ...prev, senhaAparelho: (prev.senhaAparelho || '').toUpperCase() }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white uppercase"
                        placeholder="Ex: 1234 ou 'Sem senha'"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Defeito e Laudo Técnico */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="os-reported-issue" className="text-xs font-semibold text-slate-300">
                    Defeito Reclamado pelo Cliente *
                  </label>
                  <textarea
                    id="os-reported-issue"
                    name="reportedIssue"
                    rows={3}
                    required
                    value={reportedIssue}
                    onChange={(e) => setReportedIssue(e.target.value)}
                    onBlur={() => setReportedIssue((prev) => prev.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white uppercase focus:outline-none focus:border-blue-500"
                    placeholder="Descreva exatamente o que o cliente relatou (ex: Não liga, travando, tela piscando, impressora não puxa folha...)"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="os-technical-report" className="text-xs font-semibold text-slate-300">
                    Diagnóstico & Laudo Técnico (Bancada)
                  </label>
                  <textarea
                    id="os-technical-report"
                    name="technicalReport"
                    rows={3}
                    value={technicalReport}
                    onChange={(e) => setTechnicalReport(e.target.value)}
                    onBlur={() => setTechnicalReport((prev) => prev.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white uppercase focus:outline-none focus:border-blue-500"
                    placeholder="Anotações do técnico, testes efetuados, causa raiz e solução aplicada..."
                  />
                </div>
              </div>

              {/* Informações Adicionais */}
              <div className="space-y-1">
                <label htmlFor="os-additional-info" className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Informações Adicionais</span>
                  <span className="text-[10px] text-slate-500 font-normal">Notas de atendimento, orientações e observações da OS</span>
                </label>
                <textarea
                  id="os-additional-info"
                  name="additionalInfo"
                  rows={2}
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  onBlur={() => setAdditionalInfo((prev) => prev.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white uppercase focus:outline-none focus:border-blue-500"
                  placeholder="Observações complementares, detalhes adicionais do serviço, prazos acordados, orientações para o cliente ou técnico..."
                />
              </div>

              {/* Peças e Mão de Obra */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wide">
                      3. Peças do Estoque & Mão de Obra
                    </h4>
                    <button
                      type="button"
                      onClick={() => setSelectedItemType('avulso')}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition ${
                        selectedItemType === 'avulso'
                          ? 'bg-purple-600 text-white border-purple-500'
                          : 'bg-purple-600/10 text-purple-400 border-purple-500/30 hover:bg-purple-600/20'
                      }`}
                    >
                      + Item Avulso
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      Peças: <strong>R$ {partsTotal.toFixed(2)}</strong> | Mão de Obra:{' '}
                      <strong>R$ {servicesTotal.toFixed(2)}</strong>
                    </span>
                  </div>
                </div>

                {/* Seletor rápido de itens com opção de alterar valor */}
                <div className="space-y-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                  {/* Linha 1 (Superior): Tipo e Seleção do Serviço / Peça */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="w-full sm:w-48 shrink-0">
                      <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                        Tipo de Item:
                      </label>
                      <select
                        value={selectedItemType}
                        onChange={(e) => handleItemTypeChange(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-semibold"
                      >
                        <option value="servico">Mão de Obra (Tabela)</option>
                        <option value="peca">Peça do Estoque</option>
                        <option value="avulso">⚡ Item Avulso</option>
                      </select>
                    </div>

                    {selectedItemType === 'servico' && (
                      <div className="flex-1 min-w-0">
                        <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                          Selecione a Mão de Obra / Serviço:
                        </label>
                        <select
                          value={selectedServiceId}
                          onChange={(e) => handleServiceChange(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white"
                        >
                          <option value="">Selecione o serviço da tabela...</option>
                          {services.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} (Padrão: R$ {Number(s.price).toFixed(2)} • {formatWarrantyShort(s.defaultWarrantyDays)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {selectedItemType === 'peca' && (
                      <div className="flex-1 min-w-0">
                        <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                          Selecione a Peça do Estoque:
                        </label>
                        <select
                          value={selectedProductId}
                          onChange={(e) => handleProductChange(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-white"
                        >
                          <option value="">Selecione a peça do estoque (saldo disponível)...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                              {p.name} (Estoque: {p.stock}) - R$ {Number(p.sellingPrice).toFixed(2)} • {formatWarrantyShort(p.warrantyDays)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {selectedItemType === 'avulso' && (
                      <>
                        <div className="w-full sm:w-36 shrink-0">
                          <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                            Categoria:
                          </label>
                          <select
                            value={customItemCategory}
                            onChange={(e) => setCustomItemCategory(e.target.value as any)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white font-medium"
                          >
                            <option value="servico">Mão de Obra</option>
                            <option value="peca">Peça</option>
                          </select>
                        </div>

                        <div className="flex-1 min-w-0">
                          <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                            Descrição do Item Avulso:
                          </label>
                          <input
                            type="text"
                            placeholder="Descrição do item ou serviço avulso..."
                            value={customItemDescription}
                            onChange={(e) => setCustomItemDescription(e.target.value)}
                            onBlur={() => setCustomItemDescription((prev) => prev.toUpperCase())}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddItem();
                              }
                            }}
                            className="w-full bg-slate-900 border border-slate-700 focus:border-purple-500 rounded-lg px-3 py-2 text-xs text-white uppercase"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Linha 2 (Linha de Baixo): Quantidade, Valor Unitário, Subtotal e Botão Adicionar */}
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-2 border-t border-slate-800">
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                          Quantidade:
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={selectedItemType === 'avulso' ? customItemQuantity : itemQuantity}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            if (selectedItemType === 'avulso') {
                              setCustomItemQuantity(val);
                            } else {
                              setItemQuantity(val);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddItem();
                            }
                          }}
                          className="w-20 bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-lg px-2.5 py-2 text-xs text-white text-center font-bold"
                          title="Quantidade a adicionar na OS"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                          Valor Unitário (R$):
                        </label>
                        <div className="relative flex items-center">
                          <span className="absolute left-2.5 text-[11px] text-slate-400 font-bold">R$</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0,00"
                            value={selectedItemType === 'avulso' ? customItemPrice : itemUnitPrice}
                            onChange={(e) => {
                              if (selectedItemType === 'avulso') {
                                setCustomItemPrice(e.target.value);
                              } else {
                                setItemUnitPrice(e.target.value);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddItem();
                              }
                            }}
                            className={`w-36 bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-2.5 py-2 text-xs text-white font-bold text-right font-mono focus:outline-none ${
                              selectedItemType === 'peca'
                                ? 'focus:border-amber-500'
                                : selectedItemType === 'avulso'
                                ? 'focus:border-purple-500'
                                : 'focus:border-blue-500'
                            }`}
                            title="Valor unitário (padrão cadastrado carregado, você pode alterar livremente)"
                          />
                        </div>
                      </div>

                      <div className="pl-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                          Subtotal Item:
                        </span>
                        <div className="py-2 text-xs font-mono font-bold text-emerald-400">
                          R$ {(() => {
                            const qty = selectedItemType === 'avulso' ? customItemQuantity : itemQuantity;
                            const pr = parseFloat(String(selectedItemType === 'avulso' ? customItemPrice : itemUnitPrice).replace(',', '.')) || 0;
                            return (qty * pr).toFixed(2);
                          })()}
                        </div>
                      </div>

                      {selectedItemType === 'avulso' && (
                        <>
                          <div>
                            <label className="text-[10px] text-amber-300 font-bold uppercase block mb-1">
                              Preço Custo (R$):
                            </label>
                            <div className="relative flex items-center">
                              <span className="absolute left-2.5 text-[11px] text-slate-400 font-bold">R$</span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="0,00"
                                value={customItemCostPrice}
                                onChange={(e) => setCustomItemCostPrice(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddItem();
                                  }
                                }}
                                className="w-32 bg-slate-900 border border-amber-500/40 focus:border-amber-400 rounded-lg pl-8 pr-2.5 py-2 text-xs text-amber-300 font-bold text-right font-mono focus:outline-none"
                                title="Preço de custo unitário do item/serviço avulso para cálculo nos relatórios"
                              />
                            </div>
                          </div>

                          <div className="min-w-[170px]">
                            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                              Garantia do Item Avulso:
                            </label>
                            <WarrantySelect
                              value={customItemWarrantyDays}
                              onChange={setCustomItemWarrantyDays}
                              title="Escolha a garantia deste item ou serviço avulso"
                            />
                          </div>
                        </>
                      )}

                      {selectedItemType === 'avulso' && (
                        <div className="w-full pt-2 border-t border-slate-800/80 flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="os-custom-save-to-system"
                            checked={customItemSaveToSystem}
                            onChange={(e) => setCustomItemSaveToSystem(e.target.checked)}
                            className="rounded border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
                          />
                          <label htmlFor="os-custom-save-to-system" className="text-xs text-purple-300 font-semibold cursor-pointer select-none flex items-center gap-1.5 flex-wrap">
                            <span>Cadastrar este {customItemCategory === 'peca' ? 'produto' : 'serviço'} no catálogo do sistema</span>
                            <span className="text-[10px] text-slate-400 font-normal">(Ficará disponível permanentemente para futuras OSs e Vendas)</span>
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAddItem}
                        disabled={
                          selectedItemType === 'servico'
                            ? !selectedServiceId
                            : selectedItemType === 'peca'
                            ? !selectedProductId
                            : !customItemDescription.trim()
                        }
                        className={`w-full sm:w-auto px-5 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow ${
                          selectedItemType === 'peca'
                            ? 'bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                            : selectedItemType === 'avulso'
                            ? 'bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Adicionar Item à OS</span>
                      </button>
                    </div>
                  </div>

                  {/* Dica de valor padrão */}
                  {selectedItemType === 'servico' && selectedServiceId && (() => {
                    const selSrv = services.find((srv) => srv.id === selectedServiceId);
                    return (
                      <div className="text-[11px] text-blue-400/90 flex items-center gap-1 pl-0.5 flex-wrap">
                        <span>
                          💡 <strong>Tabela carregada:</strong> Garantia cadastrada:{' '}
                          <strong>{formatWarrantyLabel(selSrv?.defaultWarrantyDays)}</strong> (atualiza automaticamente a OS ao adicionar).
                        </span>
                      </div>
                    );
                  })()}

                  {selectedItemType === 'peca' && selectedProductId && (() => {
                    const selProd = products.find((prod) => prod.id === selectedProductId);
                    return (
                      <div className="text-[11px] text-amber-400/90 flex items-center gap-1 pl-0.5 flex-wrap">
                        <span>
                          💡 <strong>Estoque carregado:</strong> Garantia cadastrada:{' '}
                          <strong>{formatWarrantyLabel(selProd?.warrantyDays)}</strong> (atualiza automaticamente a OS ao adicionar).
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Lista de Itens Adicionados (com opção de alterar valores e quantidades) */}
                <div className="space-y-1.5 mt-2">
                  {items.map((it, idx) => {
                    const itemWarr = resolveItemWarrantyDays(it, products, services);
                    return (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs gap-2"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                            it.isCustom
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                              : it.type === 'peca'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-indigo-500/20 text-indigo-300'
                          }`}
                        >
                          {it.isCustom ? `${it.type} avulso` : it.type}
                        </span>
                        <span className="text-white font-medium truncate" title={it.description}>
                          {it.description}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            itemWarr === 0
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {formatWarrantyShort(itemWarr)}
                        </span>
                        {it.isCustom && !it.productId && !it.serviceId ? (
                          <button
                            type="button"
                            onClick={() => handleRegisterItemInSystem(idx)}
                            disabled={registeringItemIdx === idx}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-600/20 text-purple-300 hover:bg-purple-600 hover:text-white border border-purple-500/40 transition flex items-center gap-1 shrink-0 cursor-pointer"
                            title="Cadastrar este item avulso permanentemente no catálogo do sistema"
                          >
                            <PlusCircle className="w-3 h-3" />
                            <span>{registeringItemIdx === idx ? 'Cadastrando...' : 'Cadastrar no Sistema'}</span>
                          </button>
                        ) : it.isCustom && (it.productId || it.serviceId) ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                            <Check className="w-2.5 h-2.5" />
                            <span>No Sistema</span>
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-end sm:self-center">
                        <div className="flex items-center gap-1" title="Alterar quantidade do item">
                          <span className="text-[10px] text-slate-400">Qtd:</span>
                          <input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value) || 1);
                              setItems(items.map((item, i) => i === idx ? { ...item, quantity: val, total: val * item.unitPrice } : item));
                            }}
                            className="w-12 bg-slate-950 border border-slate-700 focus:border-blue-500 rounded px-1.5 py-1 text-xs text-white text-center font-bold"
                          />
                        </div>

                        <div className="flex items-center gap-1" title="Preço de custo unitário (para cálculo nos relatórios)">
                          <span className="text-[10px] text-amber-300">Custo:</span>
                          <div className="relative flex items-center">
                            <span className="absolute left-1.5 text-[9px] text-slate-500 font-bold">R$</span>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={
                                it.costPrice !== undefined
                                  ? it.costPrice
                                  : it.type === 'peca'
                                  ? products.find((p) => p.id === it.productId)?.costPrice ?? 0
                                  : services.find((s) => s.id === it.serviceId)?.costPrice ?? 0
                              }
                              onChange={(e) => {
                                const val = Math.max(0, parseFloat(e.target.value) || 0);
                                setItems(items.map((item, i) => (i === idx ? { ...item, costPrice: val } : item)));
                              }}
                              className="w-20 bg-slate-950 border border-amber-500/30 focus:border-amber-400 rounded pl-5 pr-1.5 py-1 text-xs text-amber-300 font-bold text-right font-mono"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-1" title="Alterar valor unitário deste item">
                          <span className="text-[10px] text-slate-400">Unit:</span>
                          <div className="relative flex items-center">
                            <span className="absolute left-1.5 text-[9px] text-slate-500 font-bold">R$</span>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={it.unitPrice}
                              onChange={(e) => {
                                const val = Math.max(0, parseFloat(e.target.value) || 0);
                                setItems(items.map((item, i) => i === idx ? { ...item, unitPrice: val, total: item.quantity * val } : item));
                              }}
                              className="w-20 bg-slate-950 border border-slate-700 focus:border-blue-500 rounded pl-5 pr-1.5 py-1 text-xs text-white font-bold text-right font-mono"
                            />
                          </div>
                        </div>

                        <span className="font-bold text-emerald-400 font-mono text-xs w-20 text-right">
                          R$ {Number(it.total).toFixed(2)}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded transition"
                          title="Remover item da OS"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    );
                  })}
                  {items.length === 0 && (
                    <p className="text-xs text-slate-500 italic p-2 text-center">
                      Nenhuma peça ou mão de obra adicionada ainda.
                    </p>
                  )}
                </div>
              </div>

              {/* Status, Vendedor, Técnico, Garantia, Desconto e Total Final */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Status da OS</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-bold"
                  >
                    <option value="aberta">Aberta</option>
                    <option value="analise">Em Análise</option>
                    <option value="orcamento">Aguardando Aprovação de Orçamento</option>
                    <option value="aprovada">Orçamento Aprovado</option>
                    <option value="manutencao">Em Manutenção (Na Bancada)</option>
                    <option value="aguardando_peca">Aguardando Peça / Encomenda</option>
                    <option value="concluida">Concluída (Pronta para Retirada)</option>
                    <option value="entregue">Entregue ao Cliente</option>
                    <option value="sem_reparo">Sem Reparo</option>
                    <option value="descarte">Descarte</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="os-seller-select" className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
                    <BadgeDollarSign className="w-3 h-3 text-emerald-400" />
                    <span>Vendedor / Atendente Responsável</span>
                  </label>
                  <select
                    id="os-seller-select"
                    name="sellerId"
                    value={sellerId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSellerId(id);
                      const found = sellers.find((s) => s.id === id);
                      setSellerName(found ? found.name : '');
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Sem vendedor específico / Loja</option>
                    {sellers
                      .filter((s) => s.active !== false || s.id === sellerId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.nickname ? `(${s.nickname})` : ''}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="os-technician-name" className="text-[11px] text-slate-400 block mb-1">Técnico Responsável</label>
                  <input
                    id="os-technician-name"
                    name="technicianName"
                    type="text"
                    value={technicianName}
                    onChange={(e) => setTechnicianName(e.target.value)}
                    onBlur={() => setTechnicianName((prev) => prev.toUpperCase())}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white uppercase"
                  />
                </div>
                <div>
                  <label htmlFor="os-warranty-days" className="text-[11px] text-slate-400 block mb-1 font-semibold text-slate-300">
                    Garantia da OS (Automática / Editável)
                  </label>
                  <WarrantySelect
                    id="os-warranty-days"
                    name="warrantyDays"
                    value={warrantyDays}
                    onChange={setWarrantyDays}
                    title="Atualizada automaticamente conforme serviços e peças inseridos, ou ajuste manualmente"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Desconto Concedido (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Valor Total da OS</label>
                  <div className="bg-slate-900 border border-blue-500/40 rounded-lg px-3 py-1.5 text-base font-black text-blue-400 flex items-center justify-between">
                    <span>R$</span>
                    <span>{totalCalculated.toFixed(2)}</span>
                  </div>
                </div>

                {status === 'entregue' && (
                  <div className="col-span-1 sm:col-span-2 lg:col-span-3 bg-emerald-950/40 border border-emerald-500/40 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-emerald-300">Data e Hora de Entrega do Equipamento</span>
                        <p className="text-[10px] text-emerald-400/80">
                          Registrada formalmente no dashboard da assistência e no link do cliente:
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="os-delivered-date"
                        type="datetime-local"
                        value={deliveredDate ? new Date(deliveredDate).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)}
                        onChange={(e) => setDeliveredDate(e.target.value ? new Date(e.target.value).toISOString() : new Date().toISOString())}
                        className="bg-slate-900 border border-emerald-500/50 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Seção Forma e Condições de Pagamento */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Forma de Pagamento da Ordem de Serviço
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      paymentStatus === 'pago'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {paymentStatus === 'pago' ? 'PAGO' : 'PENDENTE'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Forma de Pagamento
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="A COMBINAR">A Combinar / Na Entrega</option>
                      <option value="DINHEIRO">Dinheiro (Espécie)</option>
                      <option value="PIX">PIX</option>
                      <option value="CARTÃO DE DÉBITO">Cartão de Débito</option>
                      <option value="CARTÃO DE CRÉDITO">Cartão de Crédito</option>
                      <option value="FATURADO">Faturado / Boleto</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Status do Pagamento
                    </label>
                    <select
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value as 'pendente' | 'pago')}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="pendente">Pendente (Aguardando Pagamento)</option>
                      <option value="pago">Pago (Valor Recebido)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Botões do Modal */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition active:scale-[0.98]"
                >
                  {editingOS ? 'Salvar Alterações da OS' : 'Gerar Ordem de Serviço'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Visualização da Ordem de Serviço */}
      {viewingOS && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingOS(null);
          }}
        >
          <div
            className={`border rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 transition-all ${
              isDimmedOSStatus(viewingOS.status)
                ? 'bg-slate-950 border-zinc-800 brightness-[0.58]'
                : 'bg-slate-900 border-slate-700/80'
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 px-6 border-b border-slate-800 bg-slate-950/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-white">
                      Ordem de Serviço #{viewingOS.number}
                    </h3>
                    {getStatusBadge(viewingOS.status)}
                  </div>
                  <p className="text-xs text-slate-400">
                    {viewingOS.brand} {viewingOS.model} &bull; Entrada em {new Date(viewingOS.entryDate || (viewingOS as any).createdAt || Date.now()).toLocaleDateString('pt-BR')} às {new Date(viewingOS.entryDate || (viewingOS as any).createdAt || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    {viewingOS.status === 'entregue' && viewingOS.deliveredDate && (
                      <span className="text-emerald-400 font-bold ml-2">
                        &bull; Entregue em {new Date(viewingOS.deliveredDate).toLocaleDateString('pt-BR')} às {new Date(viewingOS.deliveredDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveWorkOrderPdfWithPicker(viewingOS)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition shadow-md shadow-rose-600/30"
                  title="Salvar Ordem de Serviço em PDF (Escolher Local)"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Salvar como PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => onPrintWorkOrder(viewingOS)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-md shadow-blue-600/30"
                  title="Imprimir 2 vias A4 ou cupom térmico"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Imprimir</span>
                </button>
                <button
                  type="button"
                  onClick={() => sendWhatsAppNotification(viewingOS)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-md shadow-emerald-600/30"
                  title="Enviar Ordem de Serviço completa pelo WhatsApp"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Enviar WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingOS;
                    setViewingOS(null);
                    setOsForAddingItems(target);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition shadow-md shadow-amber-600/30"
                  title="Adicionar Serviço ou Peça ao Equipamento"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Adicionar Peça/Serviço</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingOS;
                    setViewingOS(null);
                    openEditModal(target);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition"
                  title="Editar dados da OS"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Editar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingOS(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {/* Card Destaque: Link de Acompanhamento Online para o Cliente */}
              <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-blue-500/30 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-blue-950/20">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
                    <ExternalLink className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">
                        Link de Acompanhamento em Tempo Real do Cliente
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-500/30 uppercase">
                        Online
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Este é o link enviado pelo WhatsApp que o cliente abre diretamente no celular para ver o status e etapas.
                    </p>
                    <div className="text-[11px] text-blue-300 font-mono font-semibold mt-1 break-all select-all">
                      {getWorkOrderTrackingUrl(viewingOS, storeSettings)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      const url = getWorkOrderTrackingUrl(viewingOS, storeSettings);
                      navigator.clipboard.writeText(url);
                      setCopiedTrackLink(true);
                      setTimeout(() => setCopiedTrackLink(false), 2000);
                    }}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                    title="Copiar Link para a Área de Transferência"
                  >
                    {copiedTrackLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedTrackLink ? 'Copiado!' : 'Copiar Link'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const url = getWorkOrderTrackingUrl(viewingOS, storeSettings);
                      window.open(url, '_blank');
                    }}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-600/30"
                    title="Abrir página de rastreamento do cliente agora"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Abrir Página do Cliente</span>
                  </button>
                </div>
              </div>

              {/* Card Destaque: Equipamento Entregue */}
              {viewingOS.status === 'entregue' && viewingOS.deliveredDate && (
                <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-emerald-950/40 border border-emerald-500/40 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-emerald-950/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">
                          Equipamento Entregue ao Cliente
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 uppercase">
                          Finalizado
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-400/80 mt-0.5">
                        Registro oficial de entrega e início do período de garantia.
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <span className="font-mono font-bold text-xs bg-emerald-900/60 px-3 py-1.5 rounded-lg border border-emerald-700/60 text-white inline-flex items-center gap-1.5">
                      📅 Data de Entrega: {new Date(viewingOS.deliveredDate).toLocaleDateString('pt-BR')} às {new Date(viewingOS.deliveredDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              )}

              {/* Grid 1: Cliente e Equipamento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dados do Cliente */}
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h4 className="text-[11px] font-bold text-blue-400 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-800/80 pb-1.5">
                    1. Dados do Cliente
                  </h4>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p>
                        <span className="text-slate-400 font-medium">Nome / Razão Social:</span>{' '}
                        <strong className="text-white font-bold">{viewingOS.customerName}</strong>
                      </p>
                      <button
                        type="button"
                        onClick={() => handleOpenHistoryForOS(viewingOS)}
                        className="text-[10px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-0.5 rounded transition"
                        title="Ver histórico de OS e Vendas deste cliente"
                      >
                        <History className="w-3 h-3" />
                        <span>Ver Histórico</span>
                      </button>
                    </div>
                    {viewingOS.customerTradeName && (
                      <p><span className="text-slate-400 font-medium">Nome Fantasia:</span> <span className="text-slate-200">{viewingOS.customerTradeName}</span></p>
                    )}
                    <p><span className="text-slate-400 font-medium">CPF / CNPJ:</span> <span className="text-slate-200 font-mono font-semibold">{viewingOS.customerCpf || 'NÃO INFORMADO'}</span></p>
                    {viewingOS.customerStateRegistration && (
                      <p><span className="text-slate-400 font-medium">Inscrição Estadual (IE):</span> <span className="text-slate-200 font-mono">{viewingOS.customerStateRegistration}</span></p>
                    )}
                    {viewingOS.customerStatus && (
                      <p><span className="text-slate-400 font-medium">Situação Cadastral:</span> <span className="text-emerald-400 font-bold uppercase">{viewingOS.customerStatus}</span></p>
                    )}
                    {viewingOS.customerCnae && (
                      <p><span className="text-slate-400 font-medium">CNAE Principal:</span> <span className="text-slate-200">{viewingOS.customerCnae}</span></p>
                    )}
                    <p><span className="text-slate-400 font-medium">Telefone / WhatsApp:</span> <span className="text-slate-200 font-mono font-semibold">{viewingOS.customerPhone || 'NÃO INFORMADO'}</span></p>
                    <p><span className="text-slate-400 font-medium">E-mail:</span> <span className="text-slate-200">{viewingOS.customerEmail || 'NÃO INFORMADO'}</span></p>
                    <p><span className="text-slate-400 font-medium">Endereço Completo:</span> <span className="text-slate-200">{viewingOS.customerAddress || 'NÃO INFORMADO'}</span></p>
                  </div>
                </div>

                {/* Dados do Equipamento */}
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h4 className="text-[11px] font-bold text-blue-400 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-800/80 pb-1.5">
                    2. Dados do Equipamento
                  </h4>
                  <div className="space-y-1.5">
                    <p>
                      <span className="text-slate-400 font-medium">Data de Entrada:</span>{' '}
                      <strong className="text-white font-mono font-bold">
                        {new Date(viewingOS.entryDate || (viewingOS as any).createdAt || Date.now()).toLocaleDateString('pt-BR')} às {new Date(viewingOS.entryDate || (viewingOS as any).createdAt || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                    </p>
                    <p>
                      <span className="text-slate-400 font-medium">Tipo:</span>{' '}
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 text-slate-200 uppercase font-semibold text-[10px]">
                        {getEquipmentIcon(viewingOS.equipmentType)}
                        {viewingOS.equipmentType}
                      </span>
                    </p>
                    <p><span className="text-slate-400 font-medium">Marca & Modelo:</span> <strong className="text-white font-bold">{viewingOS.brand} {viewingOS.model}</strong></p>
                    <p><span className="text-slate-400 font-medium">Nº de Série / Tag:</span> <span className="text-slate-200 font-mono">{viewingOS.serialNumber || 'NÃO INFORMADO'}</span></p>
                    <p><span className="text-slate-400 font-medium">Configuração:</span> <span className="text-slate-200">{viewingOS.configuration || 'NÃO INFORMADA'}</span></p>
                    <p><span className="text-slate-400 font-medium">Acessórios Deixados:</span> <span className="text-slate-200">{viewingOS.accessories || 'NENHUM'}</span></p>
                  </div>
                </div>
              </div>

              {/* Grid 2: Defeito Reclamado, Laudo Técnico e Checklist */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div>
                    <h5 className="text-[10px] font-bold text-amber-400 uppercase mb-1">Defeito Informado pelo Cliente:</h5>
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 italic">
                      "{viewingOS.reportedIssue || 'Sem observações adicionais.'}"
                    </div>
                  </div>
                  <div>
                    <h5 className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Diagnóstico & Laudo Técnico (Bancada):</h5>
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200">
                      {viewingOS.technicalReport || 'Ainda não preenchido pelo técnico de bancada.'}
                    </div>
                  </div>
                  {viewingOS.additionalInfo && (
                    <div>
                      <h5 className="text-[10px] font-bold text-sky-400 uppercase mb-1">Informações Adicionais:</h5>
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 whitespace-pre-line">
                        {viewingOS.additionalInfo}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h4 className="text-[11px] font-bold text-blue-400 uppercase tracking-wide border-b border-slate-800/80 pb-1.5">
                    Checklist de Entrada & Segurança
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800/60 flex items-center justify-between">
                      <span className="text-slate-400">Aparelho Ligando:</span>
                      <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${viewingOS.checklist?.ligando ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50' : 'bg-rose-950/80 text-rose-400 border border-rose-800/50'}`}>
                        {viewingOS.checklist?.ligando ? 'SIM' : 'NÃO'}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800/60 flex items-center justify-between">
                      <span className="text-slate-400">Fonte / Carregador:</span>
                      <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${viewingOS.checklist?.carregadorFonte ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50' : 'bg-slate-800 text-slate-400'}`}>
                        {viewingOS.checklist?.carregadorFonte ? 'SIM' : 'NÃO'}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800/60 flex items-center justify-between">
                      <span className="text-slate-400">Cabo de Força:</span>
                      <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${viewingOS.checklist?.caboForca ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50' : 'bg-slate-800 text-slate-400'}`}>
                        {viewingOS.checklist?.caboForca ? 'SIM' : 'NÃO'}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800/60 flex items-center justify-between">
                      <span className="text-slate-400">Testado na Entrada:</span>
                      <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${viewingOS.checklist?.testadoNaEntrada ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50' : 'bg-slate-800 text-slate-400'}`}>
                        {viewingOS.checklist?.testadoNaEntrada ? 'SIM' : 'NÃO'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 pt-1">
                    <p><span className="text-slate-400">Senha do Aparelho:</span> <strong className="text-white font-mono">{viewingOS.checklist?.senhaAparelho || 'NÃO FORNECIDA'}</strong></p>
                    <p><span className="text-slate-400">Avarias Visíveis / Detalhes:</span> <span className="text-slate-300">{viewingOS.checklist?.avariasVisiveis || 'NENHUMA AVARIA NOTADA NA ENTRADA'}</span></p>
                  </div>
                </div>
              </div>

              {/* Tabela de Peças e Mão de Obra */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-purple-400 uppercase tracking-wide">
                    3. Peças do Estoque & Mão de Obra
                  </h4>
                  <span className="text-xs text-slate-400">
                    Peças: <strong className="text-white">R$ {(viewingOS.partsTotal || 0).toFixed(2)}</strong> | Mão de Obra: <strong className="text-white">R$ {(viewingOS.servicesTotal || 0).toFixed(2)}</strong>
                  </span>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-3">Tipo</th>
                        <th className="py-2 px-3">Descrição</th>
                        <th className="py-2 px-3 text-center">Qtd</th>
                        <th className="py-2 px-3 text-right">Valor Unit.</th>
                        <th className="py-2 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {viewingOS.items && viewingOS.items.length > 0 ? (
                        viewingOS.items.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/40">
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                it.isCustom
                                  ? 'bg-purple-900/60 text-purple-300 border border-purple-700/50'
                                  : it.type === 'peca'
                                  ? 'bg-amber-900/50 text-amber-300'
                                  : 'bg-indigo-900/50 text-indigo-300'
                              }`}>
                                {it.isCustom ? `${it.type} avulso` : it.type === 'peca' ? 'Peça' : 'Mão de Obra'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-white font-medium">
                              <span>{it.description}</span>
                              {it.warrantyDays !== undefined && (
                                <span className={`ml-2 text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                  it.warrantyDays === 0
                                    ? 'bg-amber-500/15 text-amber-300'
                                    : 'bg-indigo-500/15 text-indigo-300'
                                }`}>
                                  {formatWarrantyShort(it.warrantyDays)}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center">{it.quantity}</td>
                            <td className="py-2 px-3 text-right">R$ {Number(it.unitPrice || 0).toFixed(2)}</td>
                            <td className="py-2 px-3 text-right font-bold text-white">R$ {Number(it.total || 0).toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-slate-500 italic">
                            Nenhuma peça ou serviço vinculado até o momento.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Resumo Financeiro e Técnico */}
              <div className={`grid grid-cols-1 sm:grid-cols-2 ${viewingOS.status === 'entregue' && viewingOS.deliveredDate ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800`}>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Técnico / Vendedor</span>
                  <strong className="text-white text-xs block">{viewingOS.technicianName || 'NÃO ATRIBUÍDO'}</strong>
                  {viewingOS.sellerName && (
                    <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
                      Vendedor: {viewingOS.sellerName}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Forma de Pagamento</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <strong className="text-emerald-400 text-xs uppercase font-semibold">
                      {viewingOS.paymentMethod || 'A COMBINAR'}
                    </strong>
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                      viewingOS.paymentStatus === 'pago'
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                        : 'bg-amber-950/80 text-amber-300 border border-amber-800/50'
                    }`}>
                      {viewingOS.paymentStatus === 'pago' ? 'PAGO' : 'PENDENTE'}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Garantia Oferecida</span>
                  <strong className={`text-xs ${viewingOS.warrantyDays === 0 ? 'text-amber-400 font-bold' : 'text-indigo-400'}`}>
                    {viewingOS.warrantyDays === 0 ? 'Sem garantia' : `${viewingOS.warrantyDays || 90} dias após entrega`}
                  </strong>
                </div>
                {viewingOS.status === 'entregue' && viewingOS.deliveredDate && (
                  <div>
                    <span className="text-[10px] text-emerald-400 uppercase font-bold block mb-0.5">Data de Entrega</span>
                    <strong className="text-emerald-300 text-xs font-mono">
                      {new Date(viewingOS.deliveredDate).toLocaleDateString('pt-BR')} às {new Date(viewingOS.deliveredDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </strong>
                  </div>
                )}
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Desconto Concedido</span>
                  <strong className="text-rose-400 text-xs">R$ {(viewingOS.discount || 0).toFixed(2)}</strong>
                </div>
                <div className="sm:text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Total Geral da OS</span>
                  <strong className="text-emerald-400 text-lg font-black leading-tight">
                    R$ {(viewingOS.total || 0).toFixed(2)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 px-6 border-t border-slate-800 bg-slate-950/70">
              <span className="text-xs text-slate-500 font-mono">
                ID interno: {viewingOS.id}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveWorkOrderPdfWithPicker(viewingOS)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-rose-600/20"
                  title="Salvar Ordem de Serviço em PDF (Escolher Local)"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Salvar como PDF
                </button>
                <button
                  type="button"
                  onClick={() => onPrintWorkOrder(viewingOS)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir OS
                </button>
                <button
                  type="button"
                  onClick={() => setViewingOS(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rápido de Adição de Serviços / Peças à OS */}
      {osForAddingItems && (
        <AddItemsToOSModal
          workOrder={osForAddingItems}
          products={products}
          services={services}
          isOpen={!!osForAddingItems}
          onClose={() => setOsForAddingItems(null)}
          onSaveSuccess={async () => {
            await onSaveWorkOrder({ id: osForAddingItems.id });
            setOsForAddingItems(null);
          }}
        />
      )}

      {/* Modal de Envio da Ordem de Serviço via WhatsApp em PDF */}
      {whatsAppModalOS && (
        <SendWhatsAppModal
          isOpen={Boolean(whatsAppModalOS)}
          onClose={() => setWhatsAppModalOS(null)}
          type="os"
          workOrder={whatsAppModalOS}
          storeSettings={storeSettings}
          customer={customers?.find((c) => c.id === whatsAppModalOS.customerId)}
        />
      )}

      {/* Modal de Histórico Completo do Cliente */}
      <CustomerHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        customer={historyCustomer}
        workOrders={workOrders}
        sales={sales || []}
        storeSettings={storeSettings}
        onPrintOS={onPrintWorkOrder}
      />

      {/* Modal de Senha do Administrador para Exclusões */}
      <AdminPasswordModal {...adminModalProps} />
    </div>
  );
};
