import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  QrCode,
  CreditCard,
  Receipt,
  Printer,
  CheckCircle2,
  X,
  Package,
  Layers,
  ArrowRight,
  Calendar,
  BarChart3,
  TrendingUp,
  Clock,
  Filter,
  ArrowUpRight,
  FileText,
  UserPlus,
  Building2,
  User,
  Edit2,
  PlusCircle,
  PackagePlus,
  Tag,
  ShieldCheck,
  MessageSquare,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  XCircle,
  Camera,
  Image as ImageIcon,
  Upload,
  History,
  BadgeDollarSign,
  Users,
  Star
} from 'lucide-react';
import { Product, Customer, Sale, SaleItem, StoreSettings, WorkOrder, Seller, ServiceItem } from '../types';
import { openWhatsAppWithText, formatSaleReceiptWhatsAppMessage, sendSaleReceiptViaWhatsApp } from '../services/whatsapp';
import { lookupCNPJ, formatCNPJ, cleanDigits } from '../services/cnpj';
import { SendWhatsAppModal } from '../components/SendWhatsAppModal';
import { SendReviewModal } from '../components/SendReviewModal';
import { CustomerHistoryModal } from '../components/CustomerHistoryModal';
import { AdminPasswordModal, useAdminPasswordModal } from '../components/AdminPasswordModal';
import { api } from '../services/api';
import { compressImageFileToBase64 } from '../utils/imageHelper';
import {
  UNASSIGNED_SELLER_KEY,
  getLocalDateStr,
  getLocalMonthStr,
  isDateInPeriod,
  matchesSellerFilter,
  resolveRecordSeller,
  buildSellerBreakdown,
  calculateSaleGross,
  calculateSaleCost
} from '../utils/reportHelpers';
import { WarrantySelect } from '../components/WarrantySelect';
import {
  computeAggregateWarrantyDays,
  formatWarrantyShort,
  resolveItemWarrantyDays
} from '../utils/warrantyHelpers';

interface PosViewProps {
  products: Product[];
  services?: ServiceItem[];
  customers: Customer[];
  sales?: Sale[];
  workOrders?: WorkOrder[];
  sellers?: Seller[];
  storeSettings?: StoreSettings;
  onFinishSale: (sale: Partial<Sale>) => Promise<Sale>;
  onCancelSale?: (id: string, adminPassword?: string) => Promise<void>;
  onUpdateSaleSeller?: (saleId: string, sellerId: string, sellerName: string) => Promise<void>;
  onPrintSale: (sale: Sale) => void;
  onPrintOS?: (os: WorkOrder) => void;
  onSaveCustomer?: (customer: Partial<Customer>) => Promise<Customer | void>;
  onSaveProduct?: (product: Partial<Product>) => Promise<void>;
  onSaveService?: (service: Partial<ServiceItem>) => Promise<void>;
  onOpenGeneralReport?: () => void;
  hideRevenue?: boolean;
  onToggleHideRevenue?: () => void;
}

export const PosView: React.FC<PosViewProps> = ({
  products,
  services = [],
  customers,
  sales = [],
  workOrders = [],
  sellers = [],
  storeSettings,
  onFinishSale,
  onCancelSale,
  onUpdateSaleSeller,
  onPrintSale,
  onPrintOS,
  onSaveCustomer,
  onSaveProduct,
  onSaveService,
  onOpenGeneralReport,
  hideRevenue = false,
  onToggleHideRevenue
}) => {
  // Aba ativa: 'pdv' (frente de caixa), 'historico' (vendas do dia), 'relatorio' (faturamento)
  const [activeTab, setActiveTab] = useState<'pdv' | 'historico' | 'relatorio'>('pdv');

  // Estados do PDV
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [cartItems, setCartItems] = useState<SaleItem[]>([]);
  const [customerId, setCustomerId] = useState<string>('');
  const [sellerId, setSellerId] = useState<string>('');
  const selectedCustomer = useMemo(() => customers.find(c => c.id === customerId), [customers, customerId]);
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  // Modal de Histórico de Cliente (OS e Vendas)
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

  // Confirmação de Senha do Administrador
  const { requestConfirmation: requestAdminConfirmation, modalProps: adminModalProps } = useAdminPasswordModal();

  const handleOpenHistoryForSale = (sale: Sale) => {
    let c = sale.customerId ? customers.find((cust) => cust.id === sale.customerId) : undefined;
    if (!c && sale.customerCpf) {
      const cleanDoc = cleanDigits(sale.customerCpf);
      if (cleanDoc.length >= 11) {
        c = customers.find((cust) => cleanDigits(cust.document) === cleanDoc);
      }
    }
    if (!c && sale.customerPhone) {
      const sPhone = cleanDigits(sale.customerPhone);
      if (sPhone.length >= 8) {
        c = customers.find((cust) => {
          const cp = cleanDigits(cust.phone);
          const cw = cleanDigits(cust.whatsapp);
          return (
            (cp && (cp === sPhone || cp.endsWith(sPhone) || sPhone.endsWith(cp))) ||
            (cw && (cw === sPhone || cw.endsWith(sPhone) || sPhone.endsWith(cw)))
          );
        });
      }
    }
    if (!c && sale.customerName && sale.customerName !== 'CONSUMIDOR FINAL' && sale.customerName !== 'Consumidor Final') {
      const norm = sale.customerName.trim().toUpperCase();
      c = customers.find((cust) => (cust.name || '').trim().toUpperCase() === norm);
    }

    if (c) {
      setHistoryCustomer(c);
      setIsHistoryModalOpen(true);
    } else if (sale.customerName && sale.customerName !== 'CONSUMIDOR FINAL' && sale.customerName !== 'Consumidor Final') {
      const virtualCustomer: Customer = {
        id: sale.customerId || `sale-cust-${sale.id}`,
        name: sale.customerName.toUpperCase(),
        document: sale.customerCpf || '',
        phone: sale.customerPhone || '',
        whatsapp: sale.customerPhone || '',
        city: 'São Paulo',
        state: 'SP',
        notes: `Histórico vinculado a partir da Venda #${sale.number || sale.id}`,
        createdAt: sale.createdAt || new Date().toISOString()
      };
      setHistoryCustomer(virtualCustomer);
      setIsHistoryModalOpen(true);
    }
  };

  // Modal de Cadastro Rápido de Cliente (no carrinho)
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState<boolean>(false);
  const [customerPersonType, setCustomerPersonType] = useState<'fisica' | 'juridica'>('fisica');

  // Campos PF
  const [pfName, setPfName] = useState<string>('');
  const [pfCpf, setPfCpf] = useState<string>('');
  const [pfPhone, setPfPhone] = useState<string>('');
  const [pfEmail, setPfEmail] = useState<string>('');
  const [pfCity, setPfCity] = useState<string>('');

  // Campos PJ / Empresa
  const [pjCompanyName, setPjCompanyName] = useState<string>('');
  const [pjTradeName, setPjTradeName] = useState<string>('');
  const [pjCnpj, setPjCnpj] = useState<string>('');
  const [pjStateRegistration, setPjStateRegistration] = useState<string>('');
  const [pjStatus, setPjStatus] = useState<string>('');
  const [pjOpeningDate, setPjOpeningDate] = useState<string>('');
  const [pjCnae, setPjCnae] = useState<string>('');
  const [pjLegalNature, setPjLegalNature] = useState<string>('');
  const [pjPartners, setPjPartners] = useState<string>('');
  const [pjPhone, setPjPhone] = useState<string>('');
  const [pjWhatsapp, setPjWhatsapp] = useState<string>('');
  const [pjEmail, setPjEmail] = useState<string>('');
  const [pjContactPerson, setPjContactPerson] = useState<string>('');
  const [pjCep, setPjCep] = useState<string>('');
  const [pjStreet, setPjStreet] = useState<string>('');
  const [pjNumber, setPjNumber] = useState<string>('');
  const [pjComplement, setPjComplement] = useState<string>('');
  const [pjNeighborhood, setPjNeighborhood] = useState<string>('');
  const [pjCity, setPjCity] = useState<string>('');
  const [pjState, setPjState] = useState<string>('');
  const [isSavingCustomer, setIsSavingCustomer] = useState<boolean>(false);

  // Consulta automática de CNPJ
  const [isSearchingCnpj, setIsSearchingCnpj] = useState<boolean>(false);
  const [cnpjFeedback, setCnpjFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const performCnpjLookupInPos = async (cnpjValue: string) => {
    const clean = cleanDigits(cnpjValue);
    if (clean.length !== 14) return;

    setIsSearchingCnpj(true);
    setCnpjFeedback({ type: 'info', message: 'Buscando todos os dados na Receita Federal...' });

    try {
      const data = await lookupCNPJ(clean);
      if (data && (data.name || data.razaoSocial)) {
        setCustomerPersonType('juridica');
        setPjCnpj(formatCNPJ(clean));
        setPjCompanyName(data.razaoSocial || data.name);
        setPjTradeName(data.nomeFantasia || data.razaoSocial || data.name);
        setPjStateRegistration(data.stateRegistration || 'ISENTO');
        setPjStatus(data.status || 'ATIVA');
        if (data.openingDate) setPjOpeningDate(data.openingDate);
        if (data.cnae) setPjCnae(data.cnae);
        if (data.legalNature || data.porte) setPjLegalNature(data.legalNature || data.porte || '');
        if (data.partners) setPjPartners(data.partners);
        if (data.phone) setPjPhone(data.phone);
        if (data.whatsapp || data.phone) setPjWhatsapp(data.whatsapp || data.phone);
        if (data.email) setPjEmail(data.email);
        if (data.cep) setPjCep(data.cep);
        if (data.street) setPjStreet(data.street);
        setPjNumber(data.number || 'S/N');
        if (data.complement) setPjComplement(data.complement);
        if (data.neighborhood) setPjNeighborhood(data.neighborhood);
        if (data.city) setPjCity(data.city);
        if (data.state) setPjState(data.state);
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
    } catch (err) {
      setCnpjFeedback({
        type: 'error',
        message: 'Falha ao buscar CNPJ. Preencha manualmente.'
      });
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const handlePfCpfChange = (val: string) => {
    const clean = cleanDigits(val);
    setPfCpf(val);
    // Se digitou ou colou 14 dígitos de CNPJ na aba PF, muda automaticamente para PJ e busca
    if (clean.length === 14) {
      setCustomerPersonType('juridica');
      setPjCnpj(formatCNPJ(clean));
      performCnpjLookupInPos(clean);
    }
  };

  const handlePjCnpjChange = (val: string) => {
    const clean = cleanDigits(val);
    if (clean.length > 11) {
      setPjCnpj(formatCNPJ(clean));
    } else {
      setPjCnpj(val);
    }

    if (clean.length === 14) {
      performCnpjLookupInPos(clean);
    } else {
      setCnpjFeedback(null);
    }
  };

  // Modal de Item Avulso
  const [isCustomItemModalOpen, setIsCustomItemModalOpen] = useState<boolean>(false);
  const [customItemName, setCustomItemName] = useState<string>('');
  const [customItemCode, setCustomItemCode] = useState<string>('');
  const [customItemCategory, setCustomItemCategory] = useState<string>('pecas');
  const [customItemBrand, setCustomItemBrand] = useState<string>('Genérico');
  const [customItemUnit, setCustomItemUnit] = useState<string>('UN');
  const [customItemQuantity, setCustomItemQuantity] = useState<number>(1);
  const [customItemPrice, setCustomItemPrice] = useState<number | string>('');
  const [customItemCostPrice, setCustomItemCostPrice] = useState<number | string>('');
  const [customItemNcm, setCustomItemNcm] = useState<string>('84717090');
  const [customItemCfop, setCustomItemCfop] = useState<string>('5102');
  const [saveToInventory, setSaveToInventory] = useState<boolean>(false);
  const [customItemStock, setCustomItemStock] = useState<number>(5);
  const [customItemMinStock, setCustomItemMinStock] = useState<number>(2);
  const [customItemWarrantyDays, setCustomItemWarrantyDays] = useState<number>(90);
  const [customItemImageUrl, setCustomItemImageUrl] = useState<string>('');
  const [isCompressingCustomImage, setIsCompressingCustomImage] = useState<boolean>(false);
  const customImageInputRef = useRef<HTMLInputElement>(null);
  const [isSavingCustomItem, setIsSavingCustomItem] = useState<boolean>(false);
  const [saleWarrantyDays, setSaleWarrantyDays] = useState<number>(90);

  useEffect(() => {
    setSaleWarrantyDays(computeAggregateWarrantyDays(cartItems, products, services));
  }, [cartItems, products, services]);

  // Modal de Pagamento
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'pix' | 'debito' | 'credito' | 'faturado'>('dinheiro');
  const [receivedAmount, setReceivedAmount] = useState<number>(0);
  const [installments, setInstallments] = useState<number>(1);
  const [shouldEmitNFe, setShouldEmitNFe] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [whatsAppModalData, setWhatsAppModalData] = useState<{ sale: Sale; customer?: Customer } | null>(null);
  const [reviewModalData, setReviewModalData] = useState<{ sale: Sale; customer?: Customer } | null>(null);

  // Fechar modais ao pressionar tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (reviewModalData) setReviewModalData(null);
        else if (whatsAppModalData) setWhatsAppModalData(null);
        else if (isCheckoutOpen) setIsCheckoutOpen(false);
        else if (isCustomItemModalOpen) setIsCustomItemModalOpen(false);
        else if (isCustomerModalOpen) setIsCustomerModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCheckoutOpen, isCustomItemModalOpen, isCustomerModalOpen, whatsAppModalData, reviewModalData]);

  // Estados do Histórico Diário
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [historyDate, setHistoryDate] = useState<string>(todayStr);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyPaymentFilter, setHistoryPaymentFilter] = useState<string>('todos');
  const [cancellingSaleId, setCancellingSaleId] = useState<string | null>(null);

  // Estados do Relatório de Faturamento
  const [reportPeriod, setReportPeriod] = useState<'diario' | 'semanal' | 'mensal' | 'anual'>('mensal');
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateStr(new Date()));
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getLocalMonthStr(new Date())); // YYYY-MM
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [reportSellerFilter, setReportSellerFilter] = useState<string>('todos');

  // Categorias de Produtos
  const CATEGORIES = [
    { id: 'todas', label: 'Todos os Produtos' },
    { id: 'pecas', label: 'Peças & Hardware' },
    { id: 'suprimentos', label: 'Tintas & Toners' },
    { id: 'monitor', label: 'Monitores' },
    { id: 'perifericos', label: 'Periféricos' },
    { id: 'cabos', label: 'Cabos & Adaptadores' }
  ];

  // Adicionar produto ao carrinho
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert('Produto com estoque zerado no momento.');
      return;
    }

    const existingIndex = cartItems.findIndex((it) => it.productId === product.id);
    if (existingIndex > -1) {
      const updated = [...cartItems];
      const newQty = updated[existingIndex].quantity + 1;
      if (newQty > product.stock) {
        alert(`Quantidade máxima em estoque atingida (${product.stock} un).`);
        return;
      }
      updated[existingIndex].quantity = newQty;
      updated[existingIndex].total = newQty * updated[existingIndex].unitPrice;
      if (!updated[existingIndex].imageUrl && product.imageUrl) {
        updated[existingIndex].imageUrl = product.imageUrl;
      }
      setCartItems(updated);
    } else {
      setCartItems([
        ...cartItems,
        {
          id: `item-${Date.now()}`,
          productId: product.id,
          productName: product.name,
          code: product.code,
          quantity: 1,
          unitPrice: product.sellingPrice,
          costPrice: Number(product.costPrice || 0),
          warrantyDays: product.warrantyDays !== undefined ? Number(product.warrantyDays) : 90,
          total: product.sellingPrice,
          imageUrl: product.imageUrl
        }
      ]);
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const updated = [...cartItems];
    const item = updated[index];
    const product = products.find((p) => p.id === item.productId);
    const maxStock = product ? product.stock : 999;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else if (newQty > maxStock) {
      alert(`Quantidade limitada pelo estoque (${maxStock} un).`);
      return;
    } else {
      item.quantity = newQty;
      item.total = newQty * item.unitPrice;
    }
    setCartItems(updated);
  };

  const removeItem = (index: number) => {
    setCartItems(cartItems.filter((_, idx) => idx !== index));
  };

  // Atualizar Preço Unitário de um item no Carrinho
  const updateItemPrice = (index: number, newPrice: number) => {
    const updated = [...cartItems];
    const item = updated[index];
    const safePrice = Math.max(0, newPrice);
    item.unitPrice = safePrice;
    item.total = item.quantity * safePrice;
    setCartItems(updated);
  };

  // Salvar Cliente Rápido no Carrinho
  const handleQuickSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveCustomer) {
      alert('Função de salvar cliente não configurada.');
      return;
    }

    setIsSavingCustomer(true);
    try {
      let customerPayload: Partial<Customer>;

      if (customerPersonType === 'fisica') {
        if (!pfName.trim()) {
          alert('Por favor, informe o nome completo do cliente.');
          setIsSavingCustomer(false);
          return;
        }
        customerPayload = {
          name: pfName.trim().toUpperCase(),
          document: pfCpf.trim().toUpperCase(),
          phone: pfPhone.trim(),
          whatsapp: pfPhone.trim(),
          email: pfEmail.trim().toLowerCase() || undefined,
          city: pfCity.trim().toUpperCase() || undefined,
          notes: 'CLIENTE CADASTRADO VIA CAIXA/PDV (PESSOA FÍSICA)'
        };
      } else {
        if (!pjCompanyName.trim()) {
          alert('Por favor, informe a Razão Social da empresa.');
          setIsSavingCustomer(false);
          return;
        }
        const displayName = pjTradeName.trim()
          ? `${pjCompanyName.trim().toUpperCase()} (${pjTradeName.trim().toUpperCase()})`
          : pjCompanyName.trim().toUpperCase();

        customerPayload = {
          name: pjCompanyName.trim().toUpperCase(),
          tradeName: pjTradeName.trim().toUpperCase(),
          document: pjCnpj.trim().toUpperCase(),
          stateRegistration: pjStateRegistration.trim().toUpperCase(),
          status: pjStatus.trim().toUpperCase() || 'ATIVA',
          openingDate: pjOpeningDate.trim().toUpperCase(),
          cnae: pjCnae.trim().toUpperCase(),
          legalNature: pjLegalNature.trim().toUpperCase(),
          partners: pjPartners.trim().toUpperCase(),
          phone: pjPhone.trim(),
          whatsapp: (pjWhatsapp || pjPhone).trim(),
          email: pjEmail.trim().toLowerCase() || undefined,
          street: pjStreet.trim().toUpperCase() || undefined,
          number: pjNumber.trim().toUpperCase() || undefined,
          complement: pjComplement.trim().toUpperCase() || undefined,
          neighborhood: pjNeighborhood.trim().toUpperCase() || undefined,
          city: pjCity.trim().toUpperCase() || undefined,
          state: pjState.trim().toUpperCase() || undefined,
          cep: pjCep.trim().toUpperCase() || undefined,
          notes: `EMPRESA CADASTRADA NO CAIXA. CONTATO: ${(pjContactPerson || 'N/A').toUpperCase()}${
            pjStateRegistration ? ` | IE: ${pjStateRegistration.toUpperCase()}` : ''
          }`
        };
      }

      const saved = await onSaveCustomer(customerPayload);
      if (saved && (saved as Customer).id) {
        setCustomerId((saved as Customer).id);
      }
      setIsCustomerModalOpen(false);

      // Limpar formulário
      setPfName('');
      setPfCpf('');
      setPfPhone('');
      setPfEmail('');
      setPfCity('');
      setPjCompanyName('');
      setPjTradeName('');
      setPjCnpj('');
      setPjStateRegistration('');
      setPjStatus('');
      setPjOpeningDate('');
      setPjCnae('');
      setPjLegalNature('');
      setPjPartners('');
      setPjPhone('');
      setPjWhatsapp('');
      setPjEmail('');
      setPjContactPerson('');
      setPjCep('');
      setPjStreet('');
      setPjNumber('');
      setPjComplement('');
      setPjNeighborhood('');
      setPjCity('');
      setPjState('');
      setIsSearchingCnpj(false);
      setCnpjFeedback(null);
    } catch (err: any) {
      alert(`Erro ao cadastrar cliente: ${err.message}`);
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Abrir Modal de Item Avulso com valores padrão
  const openCustomItemModal = () => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setCustomItemCode(`AVULSO-${randomSuffix}`);
    setCustomItemName('');
    setCustomItemCategory('pecas');
    setCustomItemBrand('GENÉRICO');
    setCustomItemUnit('UN');
    setCustomItemQuantity(1);
    setCustomItemPrice('');
    setCustomItemCostPrice('');
    setCustomItemNcm('84717090');
    setCustomItemCfop('5102');
    setSaveToInventory(false);
    setCustomItemStock(5);
    setCustomItemMinStock(2);
    setCustomItemWarrantyDays(90);
    setCustomItemImageUrl('');
    setIsCustomItemModalOpen(true);
  };

  const handleCustomCategoryChange = (cat: string) => {
    setCustomItemCategory(cat);
    if (cat === 'mao_de_obra') {
      if (!customItemBrand || customItemBrand === 'GENÉRICO' || customItemBrand === 'Genérico') {
        setCustomItemBrand('SERVIÇO');
      }
      if (customItemUnit === 'UN') {
        setCustomItemUnit('SV');
      }
      if (customItemNcm === '84717090') {
        setCustomItemNcm('00000000');
      }
      if (customItemCfop === '5102') {
        setCustomItemCfop('5933');
      }
    } else {
      if (customItemBrand === 'SERVIÇO') {
        setCustomItemBrand('GENÉRICO');
      }
      if (customItemUnit === 'SV' || customItemUnit === 'HR') {
        setCustomItemUnit('UN');
      }
      if (customItemNcm === '00000000') {
        setCustomItemNcm('84717090');
      }
      if (customItemCfop === '5933') {
        setCustomItemCfop('5102');
      }
    }
  };

  // Inserir Item Avulso no Carrinho
  const handleAddCustomItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customItemName.trim()) {
      alert('Por favor, informe a descrição ou nome do produto avulso.');
      return;
    }

    const unitPrice = parseFloat(String(customItemPrice).replace(',', '.')) || 0;
    if (unitPrice <= 0) {
      alert('Por favor, informe um valor unitário de venda válido (maior que zero). Exemplo: 10, 50, 100 ou 25.50');
      return;
    }

    const costPrice = parseFloat(String(customItemCostPrice).replace(',', '.')) || 0;

    setIsSavingCustomItem(true);
    try {
      const qty = Math.max(1, parseInt(String(customItemQuantity)) || 1);
      const itemTotal = qty * unitPrice;
      const itemId = `avulso-${Date.now()}`;
      const itemCode = (customItemCode.trim() || `AVULSO-${Date.now().toString().slice(-4)}`).toUpperCase();

      // Se o usuário solicitou salvar no catálogo/estoque permanente
      let registeredProdId: string | undefined = undefined;
      if (saveToInventory) {
        if (customItemCategory === 'mao_de_obra') {
          const srvData: Partial<ServiceItem> = {
            code: itemCode,
            name: customItemName.trim().toUpperCase(),
            category: 'outro',
            costPrice: costPrice,
            price: unitPrice,
            estimatedHours: 1,
            defaultWarrantyDays: Number(customItemWarrantyDays),
            description: customItemName.trim().toUpperCase()
          };
          if (onSaveService) {
            await onSaveService(srvData);
          } else {
            const res = await api.createService(srvData);
            registeredProdId = res.id;
          }
        } else if (onSaveProduct) {
          await onSaveProduct({
            code: itemCode,
            name: customItemName.trim().toUpperCase(),
            category: customItemCategory as any,
            brand: (customItemBrand.trim() || 'GENÉRICO').toUpperCase(),
            costPrice: costPrice,
            sellingPrice: unitPrice,
            stock: Math.max(0, (customItemStock || qty) - qty),
            minStock: customItemMinStock || 2,
            unit: (customItemUnit || 'UN').toUpperCase(),
            ncm: (customItemNcm.trim() || '84717090').toUpperCase(),
            cfop: (customItemCfop.trim() || '5102').toUpperCase(),
            warrantyDays: Number(customItemWarrantyDays),
            imageUrl: customItemImageUrl.trim() || undefined,
            isActive: true
          });
        } else {
          const res = await api.createProduct({
            code: itemCode,
            name: customItemName.trim().toUpperCase(),
            category: customItemCategory as any,
            brand: (customItemBrand.trim() || 'GENÉRICO').toUpperCase(),
            costPrice: costPrice,
            sellingPrice: unitPrice,
            stock: Math.max(0, (customItemStock || qty) - qty),
            minStock: customItemMinStock || 2,
            unit: (customItemUnit || 'UN').toUpperCase(),
            warrantyDays: Number(customItemWarrantyDays),
            imageUrl: customItemImageUrl.trim() || undefined,
            isActive: true
          });
          registeredProdId = res.id;
        }
      }

      // Adiciona ao carrinho
      const newCartItem: SaleItem = {
        id: itemId,
        productId: registeredProdId || (saveToInventory ? `reg-${itemId}` : itemId),
        productName: `${customItemName.trim().toUpperCase()} (AVULSO)`,
        code: itemCode,
        quantity: qty,
        unitPrice,
        costPrice,
        warrantyDays: Number(customItemWarrantyDays),
        total: itemTotal,
        imageUrl: customItemImageUrl.trim() || undefined
      };

      setCartItems([...cartItems, newCartItem]);
      setIsCustomItemModalOpen(false);
    } catch (err: any) {
      alert(`Erro ao adicionar item avulso: ${err.message}`);
    } finally {
      setIsSavingCustomItem(false);
    }
  };

  const [registeringCartIdx, setRegisteringCartIdx] = useState<number | null>(null);

  const handleRegisterCartItem = async (index: number) => {
    const item = cartItems[index];
    if (!item) return;

    const cleanName = item.productName.replace(/\(AVULSO\)/gi, '').trim().toUpperCase();
    const isService = cleanName.includes('SERVIÇO') || cleanName.includes('MÃO DE OBRA') || cleanName.includes('MANUTENÇÃO') || cleanName.includes('FORMATAÇÃO');
    const confirmMsg = `Deseja cadastrar "${cleanName}" permanentemente no sistema como ${isService ? 'Mão de Obra / Serviço' : 'Produto no Estoque'}?`;
    if (!window.confirm(confirmMsg)) return;

    setRegisteringCartIdx(index);
    try {
      if (isService) {
        const code = item.code || `SRV-${Date.now().toString().slice(-4)}`;
        const srvData: Partial<ServiceItem> = {
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
          await onSaveService(srvData);
        } else {
          const res = await api.createService(srvData);
          createdId = res.id;
        }
        setCartItems(cartItems.map((it, i) => i === index ? { ...it, productId: createdId || `serv-${Date.now()}` } : it));
      } else {
        const code = item.code || `PRD-${Date.now().toString().slice(-4)}`;
        const prodData: Partial<Product> = {
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
          imageUrl: item.imageUrl,
          isActive: true
        };
        let createdId: string | undefined;
        if (onSaveProduct) {
          await onSaveProduct(prodData);
        } else {
          const res = await api.createProduct(prodData);
          createdId = res.id;
        }
        setCartItems(cartItems.map((it, i) => i === index ? { ...it, productId: createdId || `prod-${Date.now()}` } : it));
      }
      alert(`"${cleanName}" foi cadastrado com sucesso no sistema!`);
    } catch (err: any) {
      alert(`Erro ao cadastrar item no sistema: ${err.message}`);
    } finally {
      setRegisteringCartIdx(null);
    }
  };

  const clearCart = () => {
    if (cartItems.length > 0 && confirm('Deseja cancelar a venda e esvaziar o carrinho?')) {
      setCartItems([]);
      setDiscount(0);
      setNotes('');
    }
  };

  // Cálculos do Carrinho
  const subtotal = cartItems.reduce((acc, it) => acc + (it.total || 0), 0);
  const total = Math.max(0, subtotal - discount);
  const changeAmount = paymentMethod === 'dinheiro' ? Math.max(0, receivedAmount - total) : 0;

  // Filtragem de catálogo
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategory === 'todas' || p.category === selectedCategory;
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q);
      return matchesCategory && matchesSearch && p.isActive;
    });
  }, [products, selectedCategory, searchTerm]);

  const openCheckout = () => {
    if (cartItems.length === 0) {
      alert('Adicione ao menos um item ao carrinho para finalizar a venda.');
      return;
    }
    setReceivedAmount(total);
    setIsCheckoutOpen(true);
  };

  const handleCompleteSale = async (action: 'print' | 'whatsapp' = 'print') => {
    setIsProcessing(true);
    try {
      const selectedCustomer = customers.find((c) => c.id === customerId);

      const customerAddressFormatted = selectedCustomer
        ? [
            selectedCustomer.street,
            selectedCustomer.number,
            selectedCustomer.neighborhood,
            selectedCustomer.city ? `${selectedCustomer.city}/${selectedCustomer.state || ''}` : ''
          ]
            .filter(Boolean)
            .join(', ')
        : undefined;

      const chosenSeller = sellers.find((s) => s.id === sellerId);

      const salePayload: Partial<Sale> = {
        customerId: customerId || undefined,
        customerName: selectedCustomer ? selectedCustomer.name : 'Consumidor Final',
        customerCpf: selectedCustomer?.document || (selectedCustomer as any)?.cpfCnpj || undefined,
        customerAddress: customerAddressFormatted || undefined,
        customerPhone: selectedCustomer?.phone || selectedCustomer?.whatsapp || undefined,
        sellerId: chosenSeller ? chosenSeller.id : undefined,
        sellerName: chosenSeller ? chosenSeller.name : undefined,
        notes: notes.trim().toUpperCase() || undefined,
        items: cartItems,
        subtotal,
        discount,
        total,
        warrantyDays: saleWarrantyDays,
        paymentMethod,
        installments: paymentMethod === 'credito' ? installments : 1,
        receivedAmount: paymentMethod === 'dinheiro' ? receivedAmount : total,
        changeAmount,
        fiscalStatus: shouldEmitNFe ? 'emitida' : 'nao_emitida'
      };

      const createdSale = await onFinishSale(salePayload);
      setIsCheckoutOpen(false);
      setCartItems([]);
      setDiscount(0);
      setNotes('');
      setSellerId('');

      if (action === 'whatsapp') {
        const autoSend = storeSettings?.posAutoSendPdfWhatsApp ?? storeSettings?.autoSendPdfWhatsApp ?? true;
        const targetPhone = createdSale.customerPhone || selectedCustomer?.whatsapp || selectedCustomer?.phone;

        if (autoSend && targetPhone) {
          // Baixa o PDF do recibo e dispara o WhatsApp automaticamente para o cliente
          sendSaleReceiptViaWhatsApp(createdSale, targetPhone, storeSettings, selectedCustomer);
        } else {
          // Abre modal para confirmar/inserir o número de telefone e enviar o recibo em PDF
          setWhatsAppModalData({ sale: createdSale, customer: selectedCustomer });
        }
      } else {
        // Imprime comprovante automaticamente
        onPrintSale(createdSale);
      }
    } catch (err: any) {
      alert(`Erro ao finalizar venda: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendSaleWhatsApp = (sale: Sale) => {
    const customerObj =
      customers && sale.customerId
        ? customers.find((c) => c.id === sale.customerId)
        : undefined;
    const phone = sale.customerPhone || customerObj?.whatsapp || customerObj?.phone;
    sendSaleReceiptViaWhatsApp(sale, phone, storeSettings, customerObj);
  };

  const handleCancelSaleAction = (sale: Sale) => {
    requestAdminConfirmation({
      title: 'Cancelar Venda e Estornar',
      itemDescription: `Venda #${sale.number || sale.id} - Total: R$ ${Number(sale.total).toFixed(2)} (${sale.customerName || 'Cliente não identificado'})`,
      actionType: 'cancel',
      onConfirm: async (adminPassword) => {
        try {
          setCancellingSaleId(sale.id);
          if (onCancelSale) {
            await onCancelSale(sale.id, adminPassword);
          } else {
            await api.cancelSale(sale.id, adminPassword);
          }
        } catch (err: any) {
          alert(`Erro ao cancelar a venda: ${err.message || 'Falha na comunicação com o servidor'}`);
        } finally {
          setCancellingSaleId(null);
        }
      }
    });
  };

  // ----------------------------------------------------
  // HISTÓRICO DIÁRIO DE VENDAS
  // ----------------------------------------------------
  const dailySales = useMemo(() => {
    return sales.filter((s) => {
      const saleDate = s.createdAt ? s.createdAt.slice(0, 10) : '';
      const matchesDate = saleDate === historyDate;
      const matchesPayment =
        historyPaymentFilter === 'todos' || s.paymentMethod === historyPaymentFilter;
      const q = historySearch.toLowerCase();
      const matchesSearch =
        !historySearch ||
        (s.customerName && s.customerName.toLowerCase().includes(q)) ||
        (s.id && s.id.toLowerCase().includes(q)) ||
        s.items.some((it) => it.productName.toLowerCase().includes(q));
      return matchesDate && matchesPayment && matchesSearch;
    });
  }, [sales, historyDate, historyPaymentFilter, historySearch]);

  const dailyMetrics = useMemo(() => {
    const activeDailySales = dailySales.filter((s) => s.status !== 'cancelada');
    const totalRevenue = activeDailySales.reduce((acc, s) => acc + (s.total || 0), 0);
    const totalCount = activeDailySales.length;
    const avgTicket = totalCount > 0 ? totalRevenue / totalCount : 0;
    const totalItems = activeDailySales.reduce(
      (acc, s) => acc + s.items.reduce((sum, it) => sum + (it.quantity || 1), 0),
      0
    );
    const cancelledCount = dailySales.filter((s) => s.status === 'cancelada').length;
    return { totalRevenue, totalCount, avgTicket, totalItems, cancelledCount };
  }, [dailySales]);

  // ----------------------------------------------------
  // RELATÓRIO DE FATURAMENTO (DIÁRIO, SEMANAL, MENSAL, ANUAL)
  // ----------------------------------------------------
  const reportSalesByPeriod = useMemo(() => {
    return sales.filter((s) => {
      if (s.status === 'cancelada') return false;
      return isDateInPeriod(s.createdAt, reportPeriod, {
        selectedDate,
        selectedMonth,
        selectedYear
      });
    });
  }, [sales, reportPeriod, selectedDate, selectedMonth, selectedYear]);

  const salesSellerBreakdown = useMemo(() => {
    return buildSellerBreakdown(reportSalesByPeriod, [], sellers, products, services);
  }, [reportSalesByPeriod, sellers, products, services]);

  const reportSales = useMemo(() => {
    return reportSalesByPeriod.filter((s) => matchesSellerFilter(s, reportSellerFilter, sellers));
  }, [reportSalesByPeriod, reportSellerFilter, sellers]);

  const reportMetrics = useMemo(() => {
    const totalGross = reportSales.reduce((acc, s) => acc + calculateSaleGross(s), 0);
    const totalCost = reportSales.reduce((acc, s) => acc + calculateSaleCost(s, products, services), 0);
    const totalDiscounts = reportSales.reduce((acc, s) => acc + (s.discount || 0), 0);
    const totalNet = reportSales.reduce((acc, s) => acc + (s.total || 0), 0);
    const grossProfit = totalNet - totalCost;
    const count = reportSales.length;
    const avgTicket = count > 0 ? totalNet / count : 0;

    // Faturamento por forma de pagamento
    const byPayment: Record<string, { count: number; total: number }> = {
      dinheiro: { count: 0, total: 0 },
      pix: { count: 0, total: 0 },
      debito: { count: 0, total: 0 },
      credito: { count: 0, total: 0 },
      faturado: { count: 0, total: 0 }
    };

    reportSales.forEach((s) => {
      const pm = s.paymentMethod || 'dinheiro';
      if (!byPayment[pm]) byPayment[pm] = { count: 0, total: 0 };
      byPayment[pm].count += 1;
      byPayment[pm].total += s.total || 0;
    });

    // Top Produtos Vendidos
    const productStats: Record<string, { code: string; name: string; quantity: number; revenue: number }> = {};
    reportSales.forEach((s) => {
      s.items.forEach((it) => {
        const key = it.productId || it.productName;
        if (!productStats[key]) {
          productStats[key] = {
            code: it.code || '',
            name: it.productName,
            quantity: 0,
            revenue: 0
          };
        }
        productStats[key].quantity += it.quantity;
        productStats[key].revenue += it.total;
      });
    });

    const topProducts = Object.values(productStats).sort((a, b) => b.revenue - a.revenue);

    return { totalGross, totalCost, totalDiscounts, totalNet, grossProfit, count, avgTicket, byPayment, topProducts };
  }, [reportSales, products, services]);

  // Função para imprimir relatório executivo
  const handlePrintReport = () => {
    window.print();
  };

  const getPaymentBadge = (method: string, installments?: number) => {
    switch (method) {
      case 'dinheiro':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">Dinheiro</span>;
      case 'pix':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300">PIX</span>;
      case 'debito':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300">Cartão Débito</span>;
      case 'credito':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300">
            Cartão Crédito {installments && installments > 1 ? `(${installments}x)` : ''}
          </span>
        );
      case 'faturado':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300">Faturado (A Prazo)</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">{method}</span>;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Abas Superiores de Navegação do PDV */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('pdv')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'pdv'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Frente de Caixa (PDV)</span>
          </button>

          <button
            onClick={() => setActiveTab('historico')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'historico'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Histórico Diário de Vendas</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
              {sales.filter((s) => s.createdAt && s.createdAt.slice(0, 10) === todayStr).length} hoje
            </span>
          </button>

          <button
            onClick={() => setActiveTab('relatorio')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'relatorio'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Relatório de Faturamento</span>
          </button>
        </div>

        {activeTab === 'relatorio' && (
          <button
            onClick={handlePrintReport}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
          >
            <Printer className="w-3.5 h-3.5 text-slate-300" />
            <span>Imprimir Relatório</span>
          </button>
        )}
      </div>

      {/* ABA 1: FRENTE DE CAIXA (PDV) */}
      {activeTab === 'pdv' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-170px)]">
          {/* Coluna Esquerda: Catálogo e Busca de Produtos (2 colunas no desktop) */}
          <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden">
            {/* Barra de Pesquisa e Categorias */}
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Escanear leitor de código de barras ou digitar nome do produto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  onClick={openCustomItemModal}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 whitespace-nowrap transition active:scale-[0.98]"
                  title="Inserir produto ou peça avulsa diretamente na venda com dados completos"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>+ Item Avulso</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                      selectedCategory === cat.id
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white bg-slate-950/60 hover:bg-slate-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grade de Produtos */}
            <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pr-1">
              {filteredProducts.map((p) => {
                const isOutOfStock = p.stock <= 0;
                return (
                  <button
                    key={p.id}
                    disabled={isOutOfStock}
                    onClick={() => addToCart(p)}
                    className={`group flex flex-col justify-between p-2.5 rounded-xl border text-left transition active:scale-[0.98] ${
                      isOutOfStock
                        ? 'bg-slate-950/40 border-slate-800/40 opacity-50 cursor-not-allowed'
                        : 'bg-slate-900 border-slate-800 hover:border-blue-500/50 hover:bg-slate-850 shadow-sm'
                    }`}
                  >
                    <div>
                      {/* Foto do Produto */}
                      <div className="w-full h-28 bg-slate-950 rounded-lg overflow-hidden mb-2 relative flex items-center justify-center border border-slate-800/80">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-600 gap-1 p-2">
                            <Package className="w-7 h-7 stroke-1" />
                            <span className="text-[9px] uppercase font-mono tracking-wider text-slate-500">Sem foto</span>
                          </div>
                        )}
                        <span
                          className={`absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm backdrop-blur-sm ${
                            isOutOfStock
                              ? 'bg-rose-950/90 border border-rose-500/50 text-rose-300'
                              : p.stock <= p.minStock
                              ? 'bg-amber-950/90 border border-amber-500/50 text-amber-300'
                              : 'bg-emerald-950/90 border border-emerald-500/50 text-emerald-300'
                          }`}
                        >
                          {p.stock} un
                        </span>
                      </div>

                      <div className="flex justify-between items-center gap-1 mb-1">
                        <span className="text-[10px] font-mono text-slate-400 truncate max-w-[55%]">{p.code}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                          p.warrantyDays === 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-indigo-500/15 text-indigo-300'
                        }`}>
                          {formatWarrantyShort(p.warrantyDays)}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug min-h-[2rem]" title={p.name}>
                        {p.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">{p.brand}</p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-xs font-extrabold text-blue-400">
                        R$ {p.sellingPrice.toFixed(2)}
                      </span>
                      <span className="text-[10px] bg-blue-500/10 group-hover:bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-semibold transition">
                        + Carrinho
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Coluna Direita: Carrinho e Checkout (1 coluna no desktop) */}
          <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            {/* Cabeçalho do Carrinho */}
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Carrinho de Venda
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openCustomItemModal}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 rounded-md transition"
                  title="Inserir item avulso diretamente no carrinho"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>+ Item Avulso</span>
                </button>
                <button
                  onClick={clearCart}
                  disabled={cartItems.length === 0}
                  className="text-[11px] text-rose-400 hover:text-rose-300 disabled:opacity-30 disabled:hover:text-rose-400"
                >
                  Limpar
                </button>
              </div>
            </div>

            {/* Seleção de Cliente */}
            <div className="p-3 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Cliente
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="text-[11px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-0.5 rounded-md transition"
                  title="Cadastrar cliente rápido (Pessoa Física ou Empresa/PJ)"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Cadastrar Cliente</span>
                </button>
              </div>
              <select
                value={customerId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setCustomerId(newId);
                  if (newId) {
                    const c = customers.find((cust) => cust.id === newId);
                    if (c) {
                      setHistoryCustomer(c);
                      setIsHistoryModalOpen(true);
                    }
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Consumidor Final (Sem identificação)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.document || (c as any).cpfCnpj ? `(${c.document || (c as any).cpfCnpj})` : ''}
                  </option>
                ))}
              </select>

              {/* Card com Detalhes do Cliente Selecionado (PJ ou PF) */}
              {selectedCustomer && (
                <div className="mt-2 p-2 bg-slate-950/90 rounded-lg border border-slate-800 text-[11px] space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-white truncate max-w-[220px]" title={selectedCustomer.name}>
                      {selectedCustomer.name}
                    </span>
                    {selectedCustomer.status && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 shrink-0">
                        {selectedCustomer.status}
                      </span>
                    )}
                  </div>
                  {selectedCustomer.tradeName && (
                    <p className="text-[10px] text-blue-300 font-semibold truncate">Fantasia: {selectedCustomer.tradeName}</p>
                  )}
                  <div className="flex flex-wrap gap-x-2 text-[10px] text-slate-400 font-mono">
                    {selectedCustomer.document && <span>DOC: {selectedCustomer.document}</span>}
                    {selectedCustomer.stateRegistration && <span>IE: {selectedCustomer.stateRegistration}</span>}
                  </div>
                  {(selectedCustomer.phone || selectedCustomer.whatsapp) && (
                    <p className="text-[10px] text-slate-400">
                      Tel: {selectedCustomer.whatsapp || selectedCustomer.phone}
                    </p>
                  )}
                  {(selectedCustomer.street || selectedCustomer.city) && (
                    <p className="text-[10px] text-slate-500 truncate">
                      {[selectedCustomer.street, selectedCustomer.number, selectedCustomer.neighborhood, selectedCustomer.city, selectedCustomer.state].filter(Boolean).join(', ')}
                    </p>
                  )}

                  {/* Botão de Histórico de OS e Vendas do Cliente */}
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryCustomer(selectedCustomer);
                      setIsHistoryModalOpen(true);
                    }}
                    className="w-full mt-2 py-1 px-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 font-bold text-[11px] flex items-center justify-center gap-1.5 transition"
                    title="Ver histórico de OS e Vendas deste cliente"
                  >
                    <History className="w-3.5 h-3.5 text-blue-400" />
                    <span>Ver Histórico de OS e Vendas</span>
                  </button>
                </div>
              )}

              {/* Seleção de Vendedor no Carrinho */}
              <div className="mt-2.5 pt-2.5 border-t border-slate-800/80">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <BadgeDollarSign className="w-3 h-3 text-emerald-400" />
                  <span>Vendedor Responsável</span>
                </label>
                <select
                  value={sellerId}
                  onChange={(e) => setSellerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
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
            </div>

            {/* Lista de Itens no Carrinho */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cartItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center py-12">
                  <Package className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-xs">Carrinho vazio</p>
                  <p className="text-[10px] text-slate-600 mt-1">
                    Clique em um produto à esquerda ou passe o leitor de código de barras
                  </p>
                </div>
              ) : (
                cartItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col gap-2 hover:border-slate-700 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="w-9 h-9 rounded-lg object-cover border border-slate-800 shrink-0 bg-slate-900"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 text-slate-600">
                            <Package className="w-4 h-4" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate" title={item.productName}>
                            {item.productName}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.code && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                Cód: {item.code}
                              </span>
                            )}
                            {(() => {
                              const wDays = resolveItemWarrantyDays(item, products, services);
                              return (
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                  wDays === 0
                                    ? 'bg-amber-500/15 text-amber-300'
                                    : 'bg-indigo-500/15 text-indigo-300'
                                }`}>
                                  {formatWarrantyShort(wDays)}
                                </span>
                              );
                            })()}
                            {(item.id.startsWith('avulso') || item.productName.includes('(AVULSO)')) && (
                              item.productId.startsWith('avulso') ? (
                                <button
                                  type="button"
                                  onClick={() => handleRegisterCartItem(index)}
                                  disabled={registeringCartIdx === index}
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-600/20 text-purple-300 hover:bg-purple-600 hover:text-white border border-purple-500/40 transition flex items-center gap-1 cursor-pointer"
                                  title="Cadastrar este item avulso permanentemente no sistema"
                                >
                                  <PlusCircle className="w-2.5 h-2.5" />
                                  <span>{registeringCartIdx === index ? 'Cadastrando...' : 'Cadastrar no Sistema'}</span>
                                </button>
                              ) : (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  <span>No Sistema</span>
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(index)}
                        className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition shrink-0"
                        title="Remover do carrinho"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-850/80 text-xs">
                      {/* Quantidade */}
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                        <button
                          onClick={() => updateQuantity(index, -1)}
                          className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs"
                          title="Diminuir quantidade"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(index, 1)}
                          className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs"
                          title="Aumentar quantidade"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>

                      {/* Editar Valor Unitário do Produto */}
                      <div className="flex items-center gap-1" title="Clique para editar o valor unitário deste produto">
                        <span className="text-[10px] text-slate-400 font-semibold">Unit: R$</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) => updateItemPrice(index, parseFloat(e.target.value) || 0)}
                          className="w-20 bg-slate-900 border border-slate-700 focus:border-blue-500 rounded px-1.5 py-0.5 text-xs text-emerald-400 font-bold text-right focus:outline-none"
                          title="Altere o valor unitário deste produto nesta venda"
                        />
                      </div>

                      {/* Total do Item */}
                      <div className="text-right">
                        <span className="text-xs font-black text-blue-400">
                          R$ {item.total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Resumo Financeiro & Desconto */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Subtotal:</span>
                <span className="font-semibold text-white">R$ {subtotal.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Desconto (R$):</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-20 bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-right text-xs text-amber-400 font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Campo de Observação no Carrinho */}
              <div className="pt-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Observação da Venda:
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.toUpperCase())}
                  placeholder="Ex: Entregar à tarde, cliente vai retirar amanhã, garantia 90 dias..."
                  className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2 text-xs text-white placeholder-slate-600 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-200">TOTAL A PAGAR:</span>
                <span className="text-xl font-extrabold text-emerald-400">
                  R$ {total.toFixed(2)}
                </span>
              </div>

              <button
                disabled={cartItems.length === 0}
                onClick={openCheckout}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition active:scale-[0.99] mt-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>FINALIZAR VENDA (F8)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: HISTÓRICO DIÁRIO DE VENDAS */}
      {activeTab === 'historico' && (
        <div className="space-y-4">
          {/* Barra de Filtros do Histórico */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-slate-200">Data da Venda:</span>
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
                <span className="text-xs text-slate-400">Pagamento:</span>
                <select
                  value={historyPaymentFilter}
                  onChange={(e) => setHistoryPaymentFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="todos">Todos</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="pix">PIX</option>
                  <option value="debito">Cartão Débito</option>
                  <option value="credito">Cartão Crédito</option>
                  <option value="faturado">Faturado</option>
                </select>
              </div>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por cliente, pedido ou produto..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Cards de Resumo do Dia */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Faturamento do Dia
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
                  {hideRevenue ? 'R$ •••••' : `R$ ${dailyMetrics.totalRevenue.toFixed(2)}`}
                </h3>
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                R$
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Vendas Concluídas
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <h3 className="text-lg font-extrabold text-blue-400">
                    {dailyMetrics.totalCount} {dailyMetrics.totalCount === 1 ? 'venda' : 'vendas'}
                  </h3>
                  {dailyMetrics.cancelledCount > 0 && (
                    <span className="text-[11px] font-semibold text-rose-400">
                      ({dailyMetrics.cancelledCount} canc.)
                    </span>
                  )}
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
                <ShoppingCart className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Ticket Médio
                </span>
                <h3 className="text-lg font-extrabold text-indigo-400 mt-0.5">
                  {hideRevenue ? 'R$ •••••' : `R$ ${dailyMetrics.avgTicket.toFixed(2)}`}
                </h3>
              </div>
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Total de Peças/Itens
                </span>
                <h3 className="text-lg font-extrabold text-amber-400 mt-0.5">
                  {dailyMetrics.totalItems} un
                </h3>
              </div>
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                <Package className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Tabela do Histórico Diário */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800 tracking-wider">
                  <tr>
                    <th className="p-3">Hora</th>
                    <th className="p-3">Pedido / ID</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Itens Comprados</th>
                    <th className="p-3">Pagamento</th>
                    <th className="p-3 text-right">Subtotal</th>
                    <th className="p-3 text-right">Total Pago</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {dailySales.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-semibold">Nenhuma venda registrada nesta data ({historyDate})</p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          As vendas realizadas no caixa aparecerão automaticamente aqui.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    dailySales.map((sale) => {
                      const isCancelled = sale.status === 'cancelada';
                      const isCancelling = cancellingSaleId === sale.id;
                      const timeStr = sale.createdAt
                        ? new Date(sale.createdAt).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : '--:--';

                      return (
                        <tr
                          key={sale.id}
                          className={`transition ${
                            isCancelled
                              ? 'bg-rose-950/15 hover:bg-rose-950/25 opacity-75'
                              : 'hover:bg-slate-850/60'
                          }`}
                        >
                          <td className="p-3 font-mono text-slate-400 font-semibold">{timeStr}</td>
                          <td className="p-3 font-mono text-slate-300 font-bold">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>#{sale.number || sale.id}</span>
                              {isCancelled && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30 tracking-wider uppercase">
                                  CANCELADA
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 font-semibold text-white">
                            {sale.customerName && sale.customerName !== 'Consumidor Final' && sale.customerName !== 'CONSUMIDOR FINAL' ? (
                              <button
                                type="button"
                                onClick={() => handleOpenHistoryForSale(sale)}
                                className="text-left font-bold text-white hover:text-blue-400 group flex items-center gap-1.5 transition"
                                title="Ver histórico de OS e Vendas deste cliente"
                              >
                                <span className="group-hover:underline">{sale.customerName}</span>
                                <History className="w-3 h-3 text-blue-400 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition shrink-0" />
                              </button>
                            ) : (
                              <div>{sale.customerName || 'Consumidor Final'}</div>
                            )}
                            {sale.notes ? (
                              <div
                                className="text-[10px] text-amber-300/90 italic font-normal mt-0.5 truncate max-w-[200px]"
                                title={sale.notes}
                              >
                                Obs: {sale.notes}
                              </div>
                            ) : null}
                            {(sale.sellerName || sellers.length > 0) && (
                              <div className="mt-1 flex items-center gap-1">
                                <span className="text-[10px] text-slate-400">Vendedor:</span>
                                {onUpdateSaleSeller && sellers.length > 0 ? (
                                  <select
                                    value={sale.sellerId || ''}
                                    onChange={(e) => {
                                      const sId = e.target.value;
                                      const sObj = sellers.find((sl) => sl.id === sId);
                                      onUpdateSaleSeller(sale.id, sId, sObj ? sObj.name : '');
                                    }}
                                    className="bg-slate-950 border border-slate-700/80 rounded px-1.5 py-0.5 text-[10px] text-emerald-300 font-semibold focus:outline-none focus:border-emerald-500"
                                    title="Alterar ou atribuir vendedor desta venda"
                                  >
                                    <option value="">Sem vendedor</option>
                                    {sellers.map((sl) => (
                                      <option key={sl.id} value={sl.id}>
                                        {sl.name}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-[10px] font-semibold text-emerald-400">
                                    {sale.sellerName || 'Loja'}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-3 max-w-xs">
                            <div className="space-y-0.5">
                              {sale.items.map((it, idx) => (
                                <div key={idx} className="text-[11px] text-slate-300 truncate">
                                  <span className="font-bold text-blue-400">{it.quantity}x</span>{' '}
                                  <span className={isCancelled ? 'line-through text-slate-400' : ''}>
                                    {it.productName}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col gap-1 items-start">
                              {getPaymentBadge(sale.paymentMethod, sale.installments)}
                              {isCancelled && (
                                <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">
                                  Estornada
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-right text-slate-400">
                            {hideRevenue ? (
                              '•••••'
                            ) : (
                              <span className={isCancelled ? 'line-through text-slate-500' : ''}>
                                R$ {(sale.subtotal || sale.total).toFixed(2)}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right font-extrabold text-sm">
                            {hideRevenue ? (
                              <span className="text-emerald-400">•••••</span>
                            ) : isCancelled ? (
                              <span className="line-through text-rose-400/80 font-semibold text-xs">
                                R$ {sale.total.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-emerald-400">
                                R$ {sale.total.toFixed(2)}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <button
                                onClick={() => onPrintSale(sale)}
                                title="Reimprimir Cupom / Recibo"
                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-white text-xs font-semibold inline-flex items-center gap-1 transition"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Recibo</span>
                              </button>
                              <button
                                onClick={() => {
                                  const customerObj =
                                    customers && sale.customerId
                                      ? customers.find((c) => c.id === sale.customerId)
                                      : undefined;
                                  setWhatsAppModalData({ sale, customer: customerObj });
                                }}
                                title="Enviar Recibo em PDF pelo WhatsApp"
                                className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white text-xs font-semibold inline-flex items-center gap-1 transition"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>WhatsApp</span>
                              </button>

                              {storeSettings?.posReviewMessageEnabled !== false && !isCancelled && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const customerObj =
                                      customers && sale.customerId
                                        ? customers.find((c) => c.id === sale.customerId)
                                        : undefined;
                                    setReviewModalData({ sale, customer: customerObj });
                                  }}
                                  title="Enviar Mensagem de Avaliação pelo WhatsApp"
                                  className="px-2.5 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-white border border-amber-500/30 text-xs font-semibold inline-flex items-center gap-1 transition active:scale-[0.98]"
                                >
                                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                  <span>Avaliação</span>
                                </button>
                              )}

                              {isCancelled ? (
                                <span
                                  title={`Venda cancelada${sale.cancelledAt ? ' em ' + new Date(sale.cancelledAt).toLocaleString('pt-BR') : ''}`}
                                  className="px-2.5 py-1 rounded bg-rose-950/60 text-rose-400 border border-rose-800/60 text-xs font-bold inline-flex items-center gap-1 cursor-default"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Cancelada</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isCancelling}
                                  onClick={() => handleCancelSaleAction(sale)}
                                  title="Cancelar Venda e Estornar Estoque"
                                  className="px-2.5 py-1 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 hover:text-white border border-rose-500/20 text-xs font-semibold inline-flex items-center gap-1 transition disabled:opacity-50"
                                >
                                  {isCancelling ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <XCircle className="w-3.5 h-3.5" />
                                  )}
                                  <span>{isCancelling ? 'Cancelando...' : 'Cancelar'}</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: RELATÓRIO DE FATURAMENTO */}
      {activeTab === 'relatorio' && (
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

            {/* Controles Dinâmicos para Data / Mês / Ano + Filtro Vendedor */}
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
                  title="Filtrar vendas por vendedor"
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
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                    hideRevenue
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                  }`}
                  title={hideRevenue ? 'Exibir faturamento' : 'Ocultar faturamento'}
                >
                  {hideRevenue ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{hideRevenue ? 'Oculto' : 'Ocultar'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Cards de Métricas Principais */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="bg-slate-900 border border-blue-500/30 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider">
                Valor Bruto Vendas
              </span>
              <h3 className="text-lg font-extrabold text-blue-300 mt-1">
                {hideRevenue ? 'R$ •••••' : `R$ ${reportMetrics.totalGross.toFixed(2)}`}
              </h3>
              <p className="text-[10px] text-amber-400 mt-0.5">
                {hideRevenue ? '•••••' : `Desc.: - R$ ${reportMetrics.totalDiscounts.toFixed(2)}`}
              </p>
            </div>

            <div className="bg-slate-900 border border-rose-500/30 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-rose-300 tracking-wider">
                Custo Total Vendas
              </span>
              <h3 className="text-lg font-extrabold text-rose-400 mt-1">
                {hideRevenue ? 'R$ •••••' : `R$ ${reportMetrics.totalCost.toFixed(2)}`}
              </h3>
            </div>

            <div className="bg-slate-900 border border-emerald-500/30 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">
                Faturamento Líquido
              </span>
              <h3 className="text-xl font-black text-emerald-400 mt-1">
                {hideRevenue ? 'R$ •••••' : `R$ ${reportMetrics.totalNet.toFixed(2)}`}
              </h3>
            </div>

            <div className="bg-slate-900 border border-teal-500/30 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-teal-300 tracking-wider">
                Lucro Bruto Est.
              </span>
              <h3 className={`text-lg font-extrabold mt-1 ${reportMetrics.grossProfit >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                {hideRevenue ? 'R$ •••••' : `R$ ${reportMetrics.grossProfit.toFixed(2)}`}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Margem: {reportMetrics.totalNet > 0 ? ((reportMetrics.grossProfit / reportMetrics.totalNet) * 100).toFixed(1) : '0.0'}%
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Total de Vendas
              </span>
              <h3 className="text-lg font-extrabold text-blue-400 mt-1">
                {reportMetrics.count}
              </h3>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Ticket Médio
              </span>
              <h3 className="text-lg font-extrabold text-indigo-400 mt-1">
                {hideRevenue ? 'R$ •••••' : `R$ ${reportMetrics.avgTicket.toFixed(2)}`}
              </h3>
            </div>
          </div>

          {/* Separação de Faturamento de Vendas por Vendedor */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Separação de Faturamento por Vendedor (Vendas)</span>
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

            {salesSellerBreakdown.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                Nenhum vendedor ou venda no período.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {salesSellerBreakdown.map((row) => {
                    const totalPeriodNet = salesSellerBreakdown.reduce((a, r) => a + r.salesNet, 0);
                    const pct = totalPeriodNet > 0 ? (row.salesNet / totalPeriodNet) * 100 : 0;
                    const sellerProfit = row.salesNet - row.salesCost;
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
                        title="Clique para filtrar este vendedor"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-white text-xs truncate">{row.sellerName}</span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {row.salesCount} {row.salesCount === 1 ? 'venda' : 'vendas'}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between mt-1.5">
                          <span className="text-sm font-black text-emerald-400">
                            {hideRevenue ? 'R$ •••••' : `R$ ${row.salesNet.toFixed(2)}`}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 mt-1.5 text-[10px] bg-slate-900/70 px-2 py-1 rounded-lg">
                          <div>
                            <span className="text-slate-400 block">Bruto</span>
                            <span className="font-bold text-blue-300">
                              {hideRevenue ? '•••' : `R$ ${row.salesGross.toFixed(2)}`}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Custo</span>
                            <span className="font-bold text-rose-400">
                              {hideRevenue ? '•••' : `R$ ${row.salesCost.toFixed(2)}`}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Lucro</span>
                            <span className={`font-bold ${sellerProfit >= 0 ? 'text-teal-300' : 'text-rose-400'}`}>
                              {hideRevenue ? '•••' : `R$ ${sellerProfit.toFixed(2)}`}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1.5">
                          <div
                            className={`h-full rounded-full ${row.isUnassigned ? 'bg-slate-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                          />
                        </div>
                        {row.commissionRate > 0 && !hideRevenue && (
                          <p className="text-[10px] text-amber-300 mt-1">
                            Comissão ({row.commissionRate}%): R$ {((row.salesNet * row.commissionRate) / 100).toFixed(2)}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Total Geral Consolidado de Vendedores (Período) */}
                <div className="mt-2 pt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-950/60 p-3 rounded-xl">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block">Total Geral Bruto</span>
                    <span className="font-extrabold text-blue-300">
                      {hideRevenue
                        ? 'R$ •••••'
                        : `R$ ${salesSellerBreakdown.reduce((a, r) => a + r.salesGross, 0).toFixed(2)}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block">Total Geral Custo</span>
                    <span className="font-extrabold text-rose-400">
                      {hideRevenue
                        ? 'R$ •••••'
                        : `R$ ${salesSellerBreakdown.reduce((a, r) => a + r.salesCost, 0).toFixed(2)}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block">Total Geral Líquido</span>
                    <span className="font-black text-emerald-400">
                      {hideRevenue
                        ? 'R$ •••••'
                        : `R$ ${salesSellerBreakdown.reduce((a, r) => a + r.salesNet, 0).toFixed(2)}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block">Total Geral Lucro</span>
                    <span className="font-extrabold text-teal-300">
                      {hideRevenue
                        ? 'R$ •••••'
                        : `R$ ${salesSellerBreakdown.reduce((a, r) => a + (r.salesNet - r.salesCost), 0).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Divisão: Formas de Pagamento & Ranking de Produtos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Breakdown por Forma de Pagamento */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-400" />
                <span>Faturamento por Forma de Pagamento</span>
              </h4>

              <div className="space-y-2.5">
                {[
                  { key: 'dinheiro', label: 'Dinheiro', color: 'bg-emerald-500' },
                  { key: 'pix', label: 'PIX', color: 'bg-teal-500' },
                  { key: 'debito', label: 'Cartão de Débito', color: 'bg-blue-500' },
                  { key: 'credito', label: 'Cartão de Crédito', color: 'bg-indigo-500' },
                  { key: 'faturado', label: 'Faturado (A Prazo)', color: 'bg-amber-500' }
                ].map((item) => {
                  const stat = reportMetrics.byPayment[item.key] || { count: 0, total: 0 };
                  const percent =
                    reportMetrics.totalNet > 0 ? (stat.total / reportMetrics.totalNet) * 100 : 0;

                  return (
                    <div key={item.key} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-300">
                          {item.label} ({stat.count} {stat.count === 1 ? 'venda' : 'vendas'})
                        </span>
                        <div className="text-right">
                          <span className="font-bold text-white">
                            {hideRevenue ? 'R$ •••••' : `R$ ${stat.total.toFixed(2)}`}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1.5 font-mono">
                            ({percent.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.color}`}
                          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ranking dos Produtos Mais Vendidos */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Top Produtos Mais Vendidos</span>
              </h4>

              <div className="overflow-y-auto max-h-60 space-y-1.5 pr-1">
                {reportMetrics.topProducts.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">Nenhum produto vendido no período.</p>
                ) : (
                  reportMetrics.topProducts.slice(0, 8).map((prod, index) => (
                    <div
                      key={index}
                      className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">{prod.name}</p>
                          <p className="text-[10px] text-slate-400">
                            {prod.code ? `Cód: ${prod.code} • ` : ''}
                            {prod.quantity} unidades vendidas
                          </p>
                        </div>
                      </div>
                      <span className="font-extrabold text-blue-400 shrink-0 ml-2">
                        R$ {prod.revenue.toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PAGAMENTO & FECHAMENTO DE VENDA (PDV) */}
      {isCheckoutOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCheckoutOpen(false);
          }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            {/* Cabeçalho do Modal */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-sm">Recebimento & Fechamento de Venda</h3>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Valor Total Destacado */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Valor Total a Receber
                  </span>
                  <h2 className="text-2xl font-black text-emerald-400">
                    R$ {total.toFixed(2)}
                  </h2>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <p>{cartItems.length} item(ns)</p>
                  {discount > 0 && <p className="text-amber-400">Desconto: R$ {discount.toFixed(2)}</p>}
                </div>
              </div>

              {/* Formas de Pagamento */}
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                  Forma de Pagamento
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'dinheiro', label: 'Dinheiro', icon: DollarSign },
                    { id: 'pix', label: 'PIX Instantâneo', icon: QrCode },
                    { id: 'debito', label: 'Cartão Débito', icon: CreditCard },
                    { id: 'credito', label: 'Cartão Crédito', icon: CreditCard },
                    { id: 'faturado', label: 'Faturado / A Prazo', icon: Receipt }
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id as any)}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition ${
                          isSelected
                            ? 'bg-blue-600/20 border-blue-500 text-white font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-400' : 'text-slate-400'}`} />
                        <span className="text-[11px] text-center leading-tight">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dinheiro: Troco */}
              {paymentMethod === 'dinheiro' && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-300">Valor Recebido do Cliente:</label>
                    <input
                      type="number"
                      step="0.5"
                      value={receivedAmount}
                      onChange={(e) => setReceivedAmount(parseFloat(e.target.value) || 0)}
                      className="w-28 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-right text-xs text-white font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-850">
                    <span className="text-slate-400">Troco a Devolver:</span>
                    <span className="text-sm font-extrabold text-amber-400">
                      R$ {changeAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Cartão de Crédito: Parcelamento */}
              {paymentMethod === 'credito' && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <label className="text-xs text-slate-300">Parcelas:</label>
                  <select
                    value={installments}
                    onChange={(e) => setInstallments(parseInt(e.target.value) || 1)}
                    className="bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-semibold"
                  >
                    {[1, 2, 3, 4, 5, 6, 10, 12].map((num) => (
                      <option key={num} value={num}>
                        {num}x de R$ {(total / num).toFixed(2)} {num === 1 ? '(à vista)' : 'sem juros'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Vendedor da Venda */}
              <div>
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
                  <BadgeDollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>VENDEDOR RESPONSÁVEL:</span>
                </label>
                <select
                  value={sellerId}
                  onChange={(e) => setSellerId(e.target.value)}
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

              {/* Garantia e Observação da Venda */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    GARANTIA DA VENDA (AUTOMÁTICA):
                  </label>
                  <WarrantySelect
                    value={saleWarrantyDays}
                    onChange={setSaleWarrantyDays}
                    title="Calculada automaticamente pelas garantias dos itens, podendo ser ajustada"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    OBSERVAÇÃO DA VENDA:
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value.toUpperCase())}
                    placeholder="EX: RETIRADA AMANHÃ..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white uppercase placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Opção Fiscal */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <input
                  type="checkbox"
                  id="emitir-nfe"
                  checked={shouldEmitNFe}
                  onChange={(e) => setShouldEmitNFe(e.target.checked)}
                  className="rounded border-slate-700 text-blue-600 focus:ring-0"
                />
                <label htmlFor="emitir-nfe" className="text-xs text-slate-300 cursor-pointer">
                  Transmitir Nota Fiscal Eletrônica (NF-e) para esta venda
                </label>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-end gap-2.5 pt-2 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleCompleteSale('whatsapp')}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition"
                  title="Finalizar venda e abrir envio de recibo em PDF via WhatsApp"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{isProcessing ? 'Gravando...' : 'Confirmar & WhatsApp (PDF)'}</span>
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleCompleteSale('print')}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center gap-1.5 transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isProcessing ? 'Gravando...' : 'Confirmar & Imprimir Cupom'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO RÁPIDO DE CLIENTE (NO CARRINHO) */}
      {isCustomerModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCustomerModalOpen(false);
          }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Cabeçalho */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Cadastro Rápido de Cliente</h3>
                  <p className="text-[11px] text-slate-400">Cadastre e vincule diretamente à venda atual</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Alternância: Pessoa Física vs Empresa / PJ */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 shrink-0">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setCustomerPersonType('fisica')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition ${
                    customerPersonType === 'fisica'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>Pessoa Física</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerPersonType('juridica')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition ${
                    customerPersonType === 'juridica'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Empresa (PJ)</span>
                </button>
              </div>
            </div>

            {/* Formulário */}
            <form onSubmit={handleQuickSaveCustomer} className="p-5 space-y-4 overflow-y-auto flex-1">
              {customerPersonType === 'fisica' ? (
                /* DADOS BÁSICOS PESSOA FÍSICA */
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">
                      Nome Completo do Cliente *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: João da Silva"
                      value={pfName}
                      onChange={(e) => setPfName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-300 font-semibold block mb-1">
                        CPF
                      </label>
                      <input
                        type="text"
                        placeholder="000.000.000-00"
                        value={pfCpf}
                        onChange={(e) => handlePfCpfChange(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-300 font-semibold block mb-1">
                        WhatsApp / Celular *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="(61) 99999-9999"
                        value={pfPhone}
                        onChange={(e) => setPfPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-300 font-semibold block mb-1">
                        E-mail
                      </label>
                      <input
                        type="email"
                        placeholder="cliente@email.com"
                        value={pfEmail}
                        onChange={(e) => setPfEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-300 font-semibold block mb-1">
                        Cidade / Bairro
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Brasília - DF"
                        value={pfCity}
                        onChange={(e) => setPfCity(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* DADOS COMPLETOS EMPRESA / PESSOA JURÍDICA */
                <div className="space-y-3">
                  {/* Busca e Identificação CNPJ */}
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-blue-400 font-bold flex items-center gap-1.5 uppercase">
                        <Building2 className="w-3.5 h-3.5" />
                        CNPJ da Empresa *
                      </label>
                      {cleanDigits(pjCnpj).length === 14 && (
                        <button
                          type="button"
                          onClick={() => performCnpjLookupInPos(pjCnpj)}
                          disabled={isSearchingCnpj}
                          className="text-[11px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-0.5 rounded transition"
                        >
                          {isSearchingCnpj ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                          {isSearchingCnpj ? 'Consultando...' : 'Consultar Dados na Receita'}
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="00.000.000/0001-00"
                        value={pjCnpj}
                        onChange={(e) => handlePjCnpjChange(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono tracking-wider pr-8"
                        autoFocus
                      />
                      {isSearchingCnpj && (
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                        </div>
                      )}
                    </div>
                    {cnpjFeedback && (
                      <div className={`text-[11px] flex items-center gap-1.5 font-medium px-2.5 py-1.5 rounded-lg border ${
                        cnpjFeedback.type === 'success' ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80' :
                        cnpjFeedback.type === 'error' ? 'bg-amber-950/70 text-amber-300 border-amber-800/80' :
                        'bg-blue-950/70 text-blue-300 border-blue-800/80'
                      }`}>
                        {cnpjFeedback.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />}
                        {cnpjFeedback.type === 'error' && <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />}
                        {cnpjFeedback.type === 'info' && <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-blue-400" />}
                        <span>{cnpjFeedback.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Razão Social e Fantasia */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-300 font-semibold block mb-1">
                        Razão Social / Nome da Empresa *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Razão Social completa"
                        value={pjCompanyName}
                        onChange={(e) => setPjCompanyName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 uppercase font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-300 font-semibold block mb-1">
                        Nome Fantasia
                      </label>
                      <input
                        type="text"
                        placeholder="Nome Fantasia / Comercial"
                        value={pjTradeName}
                        onChange={(e) => setPjTradeName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 uppercase"
                      />
                    </div>
                  </div>

                  {/* IE, Situação e Abertura */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Inscrição Estadual (IE)
                      </label>
                      <input
                        type="text"
                        placeholder="Isento ou Nº"
                        value={pjStateRegistration}
                        onChange={(e) => setPjStateRegistration(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Situação Cadastral
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: ATIVA"
                        value={pjStatus}
                        onChange={(e) => setPjStatus(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-emerald-400 font-bold uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Data de Abertura
                      </label>
                      <input
                        type="text"
                        placeholder="DD/MM/AAAA"
                        value={pjOpeningDate}
                        onChange={(e) => setPjOpeningDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  {/* CNAE e Natureza Jurídica */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        CNAE Principal (Atividade)
                      </label>
                      <input
                        type="text"
                        placeholder="CNAE Principal"
                        value={pjCnae}
                        onChange={(e) => setPjCnae(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Natureza Jurídica / Porte
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Sociedade Ltda - ME"
                        value={pjLegalNature}
                        onChange={(e) => setPjLegalNature(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white uppercase"
                      />
                    </div>
                  </div>

                  {/* Contato Responsável e Sócios */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Contato / Responsável
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Carlos (Financeiro)"
                        value={pjContactPerson}
                        onChange={(e) => setPjContactPerson(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Sócios / QSA
                      </label>
                      <input
                        type="text"
                        placeholder="Sócios ou administradores"
                        value={pjPartners}
                        onChange={(e) => setPjPartners(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 uppercase"
                      />
                    </div>
                  </div>

                  {/* Telefones e E-mail */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-slate-300 font-semibold block mb-1">
                        Telefone Comercial *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="(61) 3333-0000"
                        value={pjPhone}
                        onChange={(e) => setPjPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        WhatsApp / Celular
                      </label>
                      <input
                        type="text"
                        placeholder="(61) 98888-7777"
                        value={pjWhatsapp}
                        onChange={(e) => setPjWhatsapp(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        E-mail Financeiro / NFe
                      </label>
                      <input
                        type="email"
                        placeholder="financeiro@empresa.com"
                        value={pjEmail}
                        onChange={(e) => setPjEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Endereço Detalhado */}
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
                          value={pjCep}
                          onChange={(e) => setPjCep(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="text-[11px] text-slate-400 block mb-1">Rua / Logradouro</label>
                        <input
                          type="text"
                          placeholder="Ex: Av. Comercial Norte"
                          value={pjStreet}
                          onChange={(e) => setPjStreet(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white uppercase"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Número</label>
                        <input
                          type="text"
                          placeholder="Nº ou S/N"
                          value={pjNumber}
                          onChange={(e) => setPjNumber(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white uppercase"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Complemento</label>
                        <input
                          type="text"
                          placeholder="Sala, Lote, Galpão..."
                          value={pjComplement}
                          onChange={(e) => setPjComplement(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white uppercase"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Bairro</label>
                        <input
                          type="text"
                          placeholder="Bairro / Setor"
                          value={pjNeighborhood}
                          onChange={(e) => setPjNeighborhood(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white uppercase"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="text-[11px] text-slate-400 block mb-1">Cidade / Município</label>
                        <input
                          type="text"
                          placeholder="Ex: Brasília"
                          value={pjCity}
                          onChange={(e) => setPjCity(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white uppercase"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">UF (Estado)</label>
                        <input
                          type="text"
                          placeholder="DF"
                          maxLength={2}
                          value={pjState}
                          onChange={(e) => setPjState(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono uppercase"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomer}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center gap-2 transition active:scale-[0.98]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSavingCustomer ? 'Gravando...' : 'Salvar & Vincular à Venda'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE ITEM AVULSO (COM AS MESMAS DESCRIÇÕES DOS CADASTRADOS) */}
      {isCustomItemModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCustomItemModalOpen(false);
          }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
            {/* Cabeçalho */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Inserir Item Avulso na Venda</h3>
                  <p className="text-[11px] text-slate-400">
                    Mesmas descrições comerciais e fiscais dos produtos cadastrados
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomItemModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulário */}
            <form onSubmit={handleAddCustomItem} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Foto do Produto (Opcional) */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Foto do Produto (Visível no PDV)</span>
                  </label>
                  {customItemImageUrl && (
                    <button
                      type="button"
                      onClick={() => setCustomItemImageUrl('')}
                      className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold"
                    >
                      Remover foto
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0 relative">
                    {customItemImageUrl ? (
                      <img src={customItemImageUrl} alt="Prévia" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-600 stroke-1" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="file"
                      ref={customImageInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            setIsCompressingCustomImage(true);
                            const base64 = await compressImageFileToBase64(file);
                            setCustomItemImageUrl(base64);
                          } catch (err: any) {
                            alert(`Erro ao processar imagem: ${err.message}`);
                          } finally {
                            setIsCompressingCustomImage(false);
                            if (e.target) e.target.value = '';
                          }
                        }
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isCompressingCustomImage}
                        onClick={() => customImageInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        {isCompressingCustomImage ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        <span>{isCompressingCustomImage ? 'Processando...' : customItemImageUrl ? 'Trocar Foto' : 'Carregar Imagem'}</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      JPG, PNG ou WebP. Redimensionada automaticamente para exibição rápida no PDV.
                    </p>
                  </div>
                </div>
              </div>

              {/* Linha 1: Nome do Produto */}
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Nome do Produto / Descrição Detalhada *
                </label>
                <input
                  type="text"
                  required
                  placeholder={customItemCategory === 'mao_de_obra' ? 'Ex: Mão de Obra Formatação, Limpeza, Troca de Tela...' : 'Ex: Cabo de Força Tripolar 1.5m 10A ou Fonte ATX 500W'}
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                  autoFocus
                />
              </div>

              {/* Linha 2: Código, Categoria e Marca */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">
                    Código / Referência
                  </label>
                  <input
                    type="text"
                    placeholder="AVULSO-0001"
                    value={customItemCode}
                    onChange={(e) => setCustomItemCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">
                    Categoria *
                  </label>
                  <select
                    value={customItemCategory}
                    onChange={(e) => handleCustomCategoryChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
                  >
                    <option value="pecas">Peças & Hardware</option>
                    <option value="mao_de_obra">Mão de Obra</option>
                    <option value="cabos">Cabos & Adaptadores</option>
                    <option value="perifericos">Periféricos & Acessórios</option>
                    <option value="suprimentos">Tintas & Toners</option>
                    <option value="monitor">Monitores</option>
                    <option value="notebook">Notebooks & Peças</option>
                    <option value="computador">Computadores Desktop</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">
                    Marca / Fabricante
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Genérico, Dell, etc."
                    value={customItemBrand}
                    onChange={(e) => setCustomItemBrand(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Linha 3: Quantidade, Unidade, Preço de Venda e Preço de Custo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">
                    Quantidade *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={customItemQuantity}
                    onChange={(e) => setCustomItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-indigo-500 text-center"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">
                    Unidade
                  </label>
                  <select
                    value={customItemUnit}
                    onChange={(e) => setCustomItemUnit(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
                  >
                    <option value="UN">UN (Unidade)</option>
                    <option value="SV">SV (Serviço)</option>
                    <option value="HR">HR (Hora)</option>
                    <option value="CX">CX (Caixa)</option>
                    <option value="M">M (Metros)</option>
                    <option value="PCT">PCT (Pacote)</option>
                    <option value="PAR">PAR (Par)</option>
                    <option value="KG">KG (Quilo)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-emerald-400 font-bold block mb-1">
                    Preço Venda (R$) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    placeholder="Ex: 50 ou 50.00"
                    value={customItemPrice}
                    onChange={(e) => setCustomItemPrice(e.target.value)}
                    className="w-full bg-slate-900 border border-emerald-500/50 rounded-lg px-2.5 py-1.5 text-xs text-emerald-400 font-black text-right focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">
                    Preço Custo (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Ex: 30 ou 30.00"
                    value={customItemCostPrice}
                    onChange={(e) => setCustomItemCostPrice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-bold text-right focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="col-span-2 sm:col-span-4 pt-1 border-t border-slate-800/80">
                  <label className="text-xs text-slate-300 font-semibold flex items-center gap-1.5 mb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Garantia do Produto / Serviço Avulso</span>
                  </label>
                  <WarrantySelect
                    value={customItemWarrantyDays}
                    onChange={setCustomItemWarrantyDays}
                    title="Escolha a garantia deste produto ou serviço avulso"
                  />
                </div>
              </div>

              {/* Linha 4: Informações Fiscais (NFe / NFCe) */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Informações Fiscais do Item (NF-e / NFC-e)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Código NCM (8 dígitos)
                    </label>
                    <input
                      type="text"
                      placeholder="84717090"
                      value={customItemNcm}
                      onChange={(e) => setCustomItemNcm(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      CFOP de Venda
                    </label>
                    <input
                      type="text"
                      placeholder="5102"
                      value={customItemCfop}
                      onChange={(e) => setCustomItemCfop(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Linha 5: Salvar no Estoque Permanente */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="save-to-inventory"
                    checked={saveToInventory}
                    onChange={(e) => setSaveToInventory(e.target.checked)}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <label htmlFor="save-to-inventory" className="text-xs text-slate-200 font-semibold cursor-pointer">
                    {customItemCategory === 'mao_de_obra'
                      ? 'Cadastrar também no catálogo de serviços do sistema para futuros atendimentos e vendas'
                      : 'Cadastrar também no estoque permanente de produtos para futuras vendas'}
                  </label>
                </div>

                {saveToInventory && customItemCategory !== 'mao_de_obra' && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-850">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Estoque Cadastrado (un)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={customItemStock}
                        onChange={(e) => setCustomItemStock(parseInt(e.target.value) || 1)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Estoque Mínimo para Alerta
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={customItemMinStock}
                        onChange={(e) => setCustomItemMinStock(parseInt(e.target.value) || 2)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Total do Item em Destaque */}
              <div className="p-3 bg-indigo-950/30 border border-indigo-500/30 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">
                    Total deste Item
                  </span>
                  <p className="text-xs text-slate-400">
                    {customItemQuantity} un x R${' '}
                    {(parseFloat(String(customItemPrice).replace(',', '.')) || 0).toFixed(2)}
                  </p>
                </div>
                <span className="text-xl font-black text-emerald-400">
                  R${' '}
                  {(
                    customItemQuantity *
                    (parseFloat(String(customItemPrice).replace(',', '.')) || 0)
                  ).toFixed(2)}
                </span>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCustomItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomItem}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition active:scale-[0.98]"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{isSavingCustomItem ? 'Inserindo...' : 'Inserir Item no Carrinho'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Envio de Recibo em PDF via WhatsApp */}
      {whatsAppModalData && (
        <SendWhatsAppModal
          isOpen={!!whatsAppModalData}
          onClose={() => setWhatsAppModalData(null)}
          type="sale"
          sale={whatsAppModalData.sale}
          customer={whatsAppModalData.customer}
          storeSettings={storeSettings}
          onDownloadPDF={() => onPrintSale(whatsAppModalData.sale)}
        />
      )}

      {/* Modal de Envio de Mensagem de Avaliação via WhatsApp */}
      {reviewModalData && (
        <SendReviewModal
          isOpen={!!reviewModalData}
          onClose={() => setReviewModalData(null)}
          sale={reviewModalData.sale}
          customer={reviewModalData.customer}
          storeSettings={storeSettings}
        />
      )}

      {/* Modal de Histórico Completo do Cliente */}
      <CustomerHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        customer={historyCustomer}
        workOrders={workOrders}
        sales={sales}
        storeSettings={storeSettings}
        onPrintSale={onPrintSale}
        onPrintOS={onPrintOS}
      />

      {/* Modal de Confirmação com Senha de Administrador */}
      <AdminPasswordModal {...adminModalProps} />
    </div>
  );
};
