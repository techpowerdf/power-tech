import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Package,
  Search,
  Plus,
  AlertTriangle,
  Edit,
  Trash2,
  X,
  TrendingUp,
  DollarSign,
  Cpu,
  Receipt,
  Clock,
  ShieldCheck,
  FileText,
  Info,
  Image as ImageIcon,
  Upload,
  ImageOff,
  Camera
} from 'lucide-react';
import { Product, ServiceItem } from '../types';
import { compressImageFileToBase64 } from '../utils/imageHelper';
import { WarrantySelect } from '../components/WarrantySelect';
import { formatWarrantyLabel, formatWarrantyShort } from '../utils/warrantyHelpers';
import { AdminPasswordModal, useAdminPasswordModal } from '../components/AdminPasswordModal';

interface InventoryViewProps {
  products: Product[];
  services: ServiceItem[];
  onSaveProduct: (product: Partial<Product>) => Promise<void>;
  onDeleteProduct: (id: string, adminPassword?: string) => Promise<void>;
  onSaveService: (service: Partial<ServiceItem>) => Promise<void>;
  onDeleteService: (id: string, adminPassword?: string) => Promise<void>;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  services,
  onSaveProduct,
  onDeleteProduct,
  onSaveService,
  onDeleteService
}) => {
  // Confirmação de Senha do Administrador
  const { requestConfirmation: requestAdminConfirmation, modalProps: adminModalProps } = useAdminPasswordModal();

  const [activeTab, setActiveTab] = useState<'produtos' | 'servicos'>('produtos');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Estados de Produtos
  const [selectedProductCategory, setSelectedProductCategory] = useState<string>('todas');
  const [onlyLowStock, setOnlyLowStock] = useState<boolean>(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form Produto
  const [prodCode, setProdCode] = useState<string>('');
  const [prodName, setProdName] = useState<string>('');
  const [prodCategory, setProdCategory] = useState<any>('pecas');
  const [prodBrand, setProdBrand] = useState<string>('');
  const [prodCostPrice, setProdCostPrice] = useState<number>(0);
  const [prodSellingPrice, setProdSellingPrice] = useState<number>(0);
  const [prodStock, setProdStock] = useState<number>(0);
  const [prodMinStock, setProdMinStock] = useState<number>(2);
  const [prodUnit, setProdUnit] = useState<string>('UN');
  const [prodNcm, setProdNcm] = useState<string>('84717090');
  const [prodCfop, setProdCfop] = useState<string>('5102');
  const [prodWarrantyDays, setProdWarrantyDays] = useState<number>(90);
  const [prodImageUrl, setProdImageUrl] = useState<string>('');
  const [isCompressingImage, setIsCompressingImage] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressingImage(true);
      const base64 = await compressImageFileToBase64(file);
      setProdImageUrl(base64);
    } catch (err: any) {
      alert(err.message || 'Erro ao processar imagem.');
    } finally {
      setIsCompressingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Estados de Serviços
  const [selectedServiceCategory, setSelectedServiceCategory] = useState<string>('todas');
  const [isServiceModalOpen, setIsServiceModalOpen] = useState<boolean>(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);

  // Form Serviço
  const [servCode, setServCode] = useState<string>('');
  const [servName, setServName] = useState<string>('');
  const [servDescription, setServDescription] = useState<string>('');
  const [servCategory, setServCategory] = useState<any>('formatacao');
  const [servCostPrice, setServCostPrice] = useState<number>(0);
  const [servPrice, setServPrice] = useState<number>(120);
  const [servEstimatedHours, setServEstimatedHours] = useState<number>(2);
  const [servDefaultWarrantyDays, setServDefaultWarrantyDays] = useState<number>(90);
  // Campos Fiscais NFS-e
  const [servServiceCode, setServServiceCode] = useState<string>('14.01');
  const [servCnae, setServCnae] = useState<string>('9511-8/00');
  const [servIssRate, setServIssRate] = useState<number>(3.5);
  const [servIssRetention, setServIssRetention] = useState<boolean>(false);
  const [servMunicipalTaxCode, setServMunicipalTaxCode] = useState<string>('');

  // Fechar modais ao pressionar tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isProductModalOpen) setIsProductModalOpen(false);
        else if (isServiceModalOpen) setIsServiceModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProductModalOpen, isServiceModalOpen]);

  // Modal Handlers Produto
  const openNewProductModal = () => {
    setEditingProduct(null);
    setProdCode(`PRD${Date.now().toString().slice(-4)}`);
    setProdName('');
    setProdCategory('pecas');
    setProdBrand('');
    setProdCostPrice(0);
    setProdSellingPrice(0);
    setProdStock(1);
    setProdMinStock(2);
    setProdUnit('UN');
    setProdNcm('84717090');
    setProdCfop('5102');
    setProdWarrantyDays(90);
    setProdImageUrl('');
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (p: Product) => {
    setEditingProduct(p);
    setProdCode(p.code);
    setProdName(p.name);
    setProdCategory(p.category);
    setProdBrand(p.brand || '');
    setProdCostPrice(p.costPrice || 0);
    setProdSellingPrice(p.sellingPrice || 0);
    setProdStock(p.stock || 0);
    setProdMinStock(p.minStock || 2);
    setProdUnit(p.unit || 'UN');
    setProdNcm(p.ncm || '84717090');
    setProdCfop(p.cfop || '5102');
    setProdWarrantyDays(p.warrantyDays !== undefined ? p.warrantyDays : 90);
    setProdImageUrl(p.imageUrl || '');
    setIsProductModalOpen(true);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName || !prodSellingPrice) {
      alert('Informe o nome e o preço de venda do produto.');
      return;
    }

    await onSaveProduct({
      ...(editingProduct ? { id: editingProduct.id } : {}),
      code: (prodCode || '').trim().toUpperCase(),
      name: prodName.trim().toUpperCase(),
      category: prodCategory,
      brand: (prodBrand || '').trim().toUpperCase(),
      costPrice: Number(prodCostPrice),
      sellingPrice: Number(prodSellingPrice),
      stock: Number(prodStock),
      minStock: Number(prodMinStock),
      unit: (prodUnit || 'UN').trim().toUpperCase(),
      ncm: (prodNcm || '').trim().toUpperCase(),
      cfop: (prodCfop || '').trim().toUpperCase(),
      warrantyDays: Number(prodWarrantyDays),
      imageUrl: prodImageUrl || undefined,
      isActive: true
    });

    setIsProductModalOpen(false);
  };

  // Modal Handlers Serviço
  const openNewServiceModal = () => {
    setEditingService(null);
    setServCode(`SRV${Date.now().toString().slice(-4)}`);
    setServName('');
    setServDescription('');
    setServCategory('formatacao');
    setServCostPrice(0);
    setServPrice(120);
    setServEstimatedHours(2);
    setServDefaultWarrantyDays(90);
    setServServiceCode('14.01');
    setServCnae('9511-8/00');
    setServIssRate(3.5);
    setServIssRetention(false);
    setServMunicipalTaxCode('');
    setIsServiceModalOpen(true);
  };

  const openEditServiceModal = (s: ServiceItem) => {
    setEditingService(s);
    setServCode(s.code);
    setServName(s.name);
    setServDescription(s.description || '');
    setServCategory(s.category);
    setServCostPrice(s.costPrice || 0);
    setServPrice(s.price);
    setServEstimatedHours(s.estimatedHours);
    setServDefaultWarrantyDays(s.defaultWarrantyDays !== undefined ? s.defaultWarrantyDays : 90);
    setServServiceCode(s.serviceCode || '14.01');
    setServCnae(s.cnae || '9511-8/00');
    setServIssRate(s.issRate !== undefined ? s.issRate : 3.5);
    setServIssRetention(Boolean(s.issRetention));
    setServMunicipalTaxCode(s.municipalTaxCode || '');
    setIsServiceModalOpen(true);
  };

  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!servName || servPrice <= 0) {
      alert('Informe o nome e o preço do serviço.');
      return;
    }

    await onSaveService({
      ...(editingService ? { id: editingService.id } : {}),
      code: (servCode || '').trim().toUpperCase(),
      name: servName.trim().toUpperCase(),
      description: (servDescription || servName).trim().toUpperCase(),
      category: servCategory,
      costPrice: Number(servCostPrice || 0),
      price: Number(servPrice),
      estimatedHours: Number(servEstimatedHours),
      defaultWarrantyDays: Number(servDefaultWarrantyDays),
      serviceCode: (servServiceCode || '14.01').trim().toUpperCase(),
      cnae: (servCnae || '9511-8/00').trim().toUpperCase(),
      issRate: Number(servIssRate),
      issRetention: servIssRetention,
      municipalTaxCode: (servMunicipalTaxCode || '').trim().toUpperCase()
    });

    setIsServiceModalOpen(false);
  };

  const profitMarginPercent = prodCostPrice > 0
    ? (((prodSellingPrice - prodCostPrice) / prodCostPrice) * 100).toFixed(1)
    : '100.0';

  // Filtros de Produtos
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedProductCategory === 'todas' || p.category === selectedProductCategory;
      const matchesLowStock = !onlyLowStock || p.stock <= p.minStock;
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q);

      return matchesCategory && matchesLowStock && matchesSearch;
    });
  }, [products, selectedProductCategory, onlyLowStock, searchTerm]);

  // Filtros de Serviços
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchesCategory = selectedServiceCategory === 'todas' || s.category === selectedServiceCategory;
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        (s.serviceCode && s.serviceCode.includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [services, selectedServiceCategory, searchTerm]);

  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;

  return (
    <div className="space-y-4">
      {/* Abas Superiores: Produtos & Peças vs Serviços (NFS-e) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveTab('produtos');
              setSearchTerm('');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'produtos'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Peças & Produtos Físicos</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeTab === 'produtos' ? 'bg-blue-800 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {products.length}
            </span>
            {lowStockCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                {lowStockCount} baixo
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('servicos');
              setSearchTerm('');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'servicos'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Serviços & Mão de Obra (NFS-e)</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeTab === 'servicos' ? 'bg-purple-800 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {services.length}
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
              Fiscal NFS-e
            </span>
          </button>
        </div>

        {activeTab === 'produtos' ? (
          <button
            onClick={openNewProductModal}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Produto / Peça</span>
          </button>
        ) : (
          <button
            onClick={openNewServiceModal}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/30 transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Serviço (NFS-e)</span>
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* SEÇÃO 1: PRODUTOS & PEÇAS */}
      {/* ========================================================= */}
      {activeTab === 'produtos' && (
        <div className="space-y-4">
          {/* Barra de Pesquisa e Filtros de Produtos */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar produto por código, nome, marca..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                onClick={() => setOnlyLowStock(!onlyLowStock)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0 ${
                  onlyLowStock
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Estoque Crítico</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
              {[
                { id: 'todas', label: 'Todas as Peças' },
                { id: 'pecas', label: 'Peças & Hardware' },
                { id: 'suprimentos', label: 'Tintas & Toners' },
                { id: 'monitor', label: 'Monitores' },
                { id: 'perifericos', label: 'Periféricos' },
                { id: 'cabos', label: 'Cabos' },
                { id: 'mao_de_obra', label: 'Mão de Obra' }
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedProductCategory(c.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                    selectedProductCategory === c.id
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                      : 'text-slate-400 hover:text-white bg-slate-900'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabela de Produtos */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] font-bold uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Cód/SKU</th>
                    <th className="py-3 px-4">Produto & Marca</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4 text-right">Custo</th>
                    <th className="py-3 px-4 text-right">Venda</th>
                    <th className="py-3 px-4 text-center">NCM Fiscal</th>
                    <th className="py-3 px-4 text-center">Estoque Atual</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredProducts.map((p) => {
                    const isLow = p.stock <= p.minStock;
                    return (
                      <tr key={p.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400">{p.code}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                              {p.imageUrl ? (
                                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-4 h-4 text-slate-600" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-white block truncate max-w-xs" title={p.name}>{p.name}</span>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] text-slate-500">{p.brand || 'Sem marca'}</span>
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${p.warrantyDays === 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-indigo-500/15 text-indigo-300'}`}>
                                  {formatWarrantyShort(p.warrantyDays)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 capitalize text-slate-400">{p.category}</td>
                        <td className="py-3 px-4 text-right text-slate-400">R$ {Number(p.costPrice).toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-400">
                          R$ {Number(p.sellingPrice).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-[10px] text-slate-400">
                          {p.ncm || '84717090'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.stock <= 0
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : isLow
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {p.stock} {p.unit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openEditProductModal(p)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                              title="Editar Produto"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                requestAdminConfirmation({
                                  title: 'Excluir Produto',
                                  itemDescription: `Produto "${p.name}" (Código: ${p.code || 'S/N'})`,
                                  actionType: 'delete',
                                  onConfirm: async (adminPassword) => {
                                    await onDeleteProduct(p.id, adminPassword);
                                  }
                                });
                              }}
                              className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400"
                              title="Excluir Produto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Nenhum produto cadastrado com esses filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SEÇÃO 2: SERVIÇOS & MÃO DE OBRA (COM DADOS FISCAIS NFS-E) */}
      {/* ========================================================= */}
      {activeTab === 'servicos' && (
        <div className="space-y-4">
          {/* Banner Informativo NFS-e */}
          <div className="bg-purple-950/40 border border-purple-800/60 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-600/20 text-purple-400 rounded-lg">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-purple-200">
                  Catálogo de Serviços com Tributação de NFS-e (Nota de Serviços Municipal)
                </h4>
                <p className="text-[11px] text-purple-300/80">
                  Serviços cadastrados com Código da Lista LC 116/03, CNAE, Alíquota de ISS e retração fiscal para emissão automática.
                </p>
              </div>
            </div>
            <button
              onClick={openNewServiceModal}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shrink-0 shadow-md shadow-purple-600/30"
            >
              + Adicionar Novo Serviço
            </button>
          </div>

          {/* Barra de Pesquisa e Filtros de Serviços */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar serviço por código, nome, descrição ou código fiscal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
              {[
                { id: 'todas', label: 'Todos os Serviços' },
                { id: 'formatacao', label: 'Formatação & Software' },
                { id: 'limpeza', label: 'Limpeza Térmica' },
                { id: 'hardware', label: 'Placa-Mãe & Hardware' },
                { id: 'tela_teclado', label: 'Telas & Teclados' },
                { id: 'impressora', label: 'Impressoras' }
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedServiceCategory(c.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                    selectedServiceCategory === c.id
                      ? 'bg-purple-600/20 text-purple-400 border border-purple-500/40'
                      : 'text-slate-400 hover:text-white bg-slate-900'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabela de Serviços */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] font-bold uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Serviço & Descrição Técnica</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4 text-center">Tributação NFS-e</th>
                    <th className="py-3 px-4 text-center">Garantia</th>
                    <th className="py-3 px-4 text-right">Preço de Custo</th>
                    <th className="py-3 px-4 text-right">Preço de Tabela</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredServices.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">{s.code}</td>
                      <td className="py-3 px-4 max-w-sm">
                        <span className="font-bold text-white block">{s.name}</span>
                        <span className="text-[11px] text-slate-400 line-clamp-1">
                          {s.description || 'Sem descrição complementar'}
                        </span>
                      </td>
                      <td className="py-3 px-4 capitalize text-slate-400">{s.category}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            LC 116: {s.serviceCode || '14.01'}
                          </span>
                          <span className="text-[10px] text-slate-500 mt-0.5">
                            ISS: {s.issRate ?? 3.5}% {s.issRetention ? '(Retido)' : ''}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-[11px] font-semibold ${s.defaultWarrantyDays === 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                          {formatWarrantyLabel(s.defaultWarrantyDays)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-amber-400 whitespace-nowrap">
                        R$ {Number(s.costPrice || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-400 whitespace-nowrap">
                        R$ {Number(s.price).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditServiceModal(s)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                            title="Editar Serviço"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              requestAdminConfirmation({
                                title: 'Excluir Serviço',
                                itemDescription: `Serviço "${s.name}" (Código: ${s.code || 'S/N'})`,
                                actionType: 'delete',
                                onConfirm: async (adminPassword) => {
                                  await onDeleteService(s.id, adminPassword);
                                }
                              });
                            }}
                            className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400"
                            title="Excluir Serviço"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredServices.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Nenhum serviço cadastrado com esses filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CADASTRO / EDIÇÃO DE PRODUTO */}
      {/* ========================================================= */}
      {isProductModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsProductModalOpen(false);
          }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-white">
                  {editingProduct ? 'Editar Produto / Peça' : 'Cadastrar Produto / Peça no Estoque'}
                </h3>
              </div>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="p-6 space-y-4">
              {/* Foto do Produto */}
              <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-blue-400" />
                    <span>Foto do Produto (Visível no PDV)</span>
                  </label>
                  {prodImageUrl && (
                    <button
                      type="button"
                      onClick={() => setProdImageUrl('')}
                      className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remover Foto</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {/* Preview da Foto */}
                  <div className="w-20 h-20 rounded-xl bg-slate-900 border border-slate-700/80 overflow-hidden flex items-center justify-center shrink-0 relative group">
                    {prodImageUrl ? (
                      <img src={prodImageUrl} alt="Prévia" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-600 gap-1 text-center p-1">
                        <ImageIcon className="w-6 h-6 text-slate-600" />
                        <span className="text-[8px] font-bold uppercase text-slate-500">Sem foto</span>
                      </div>
                    )}
                  </div>

                  {/* Ações de Upload */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                        id="prod-image-upload"
                      />
                      <label
                        htmlFor="prod-image-upload"
                        className={`cursor-pointer px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow ${
                          isCompressingImage ? 'opacity-50 pointer-events-none' : ''
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isCompressingImage ? 'Processando...' : prodImageUrl ? 'Trocar Foto' : 'Carregar Foto'}</span>
                      </label>
                      <span className="text-[10px] text-slate-400">JPG, PNG ou WebP</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500">ou link:</span>
                      <input
                        type="text"
                        placeholder="https://exemplo.com/foto.jpg"
                        value={prodImageUrl}
                        onChange={(e) => setProdImageUrl(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none placeholder-slate-600 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Código de Barras / SKU *</label>
                  <input
                    type="text"
                    required
                    value={prodCode}
                    onChange={(e) => setProdCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Categoria *</label>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white capitalize"
                  >
                    <option value="pecas">Peças & Hardware (SSD, RAM, Fonte...)</option>
                    <option value="notebook">Notebooks & Acessórios</option>
                    <option value="computador">Computadores Montados</option>
                    <option value="monitor">Monitores</option>
                    <option value="impressora">Impressoras</option>
                    <option value="suprimentos">Suprimentos (Toners, Tintas...)</option>
                    <option value="perifericos">Periféricos (Teclado, Mouse...)</option>
                    <option value="cabos">Cabos & Adaptadores</option>
                    <option value="mao_de_obra">Mão de Obra</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Nome Completo do Produto / Peça *</label>
                <input
                  type="text"
                  required
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  placeholder="Ex: SSD Kingston NV2 1TB M.2 NVMe PCIe 4.0"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Marca / Fabricante</label>
                  <input
                    type="text"
                    value={prodBrand}
                    onChange={(e) => setProdBrand(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    placeholder="Ex: Kingston, HP, Epson, Dell..."
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Unidade de Medida</label>
                  <input
                    type="text"
                    value={prodUnit}
                    onChange={(e) => setProdUnit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    placeholder="UN, PC, M..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Preço de Custo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={prodCostPrice}
                    onChange={(e) => setProdCostPrice(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Preço de Venda (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={prodSellingPrice}
                    onChange={(e) => setProdSellingPrice(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-emerald-400 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Margem Lucro</label>
                  <div className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-blue-400">
                    +{profitMarginPercent}%
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Estoque Atual *</label>
                  <input
                    type="number"
                    min="0"
                    value={prodStock}
                    onChange={(e) => setProdStock(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Estoque Mínimo (Alerta)</label>
                  <input
                    type="number"
                    min="1"
                    value={prodMinStock}
                    onChange={(e) => setProdMinStock(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">NCM Fiscal (NF-e)</label>
                  <input
                    type="text"
                    value={prodNcm}
                    onChange={(e) => setProdNcm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                    placeholder="84717090"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">CFOP Padrão</label>
                  <input
                    type="text"
                    value={prodCfop}
                    onChange={(e) => setProdCfop(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                    placeholder="5102"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Garantia Padrão</label>
                  <WarrantySelect
                    value={prodWarrantyDays}
                    onChange={setProdWarrantyDays}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow-md shadow-blue-600/30"
                >
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CADASTRO / EDIÇÃO DE SERVIÇO (COM DADOS NFS-E) */}
      {/* ========================================================= */}
      {isServiceModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsServiceModalOpen(false);
          }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingService ? 'Editar Serviço Técnico' : 'Cadastrar Serviço / Mão de Obra'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Parâmetros operacionais e tributação de NFS-e</p>
                </div>
              </div>
              <button
                onClick={() => setIsServiceModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleServiceSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Código do Serviço *</label>
                  <input
                    type="text"
                    required
                    value={servCode}
                    onChange={(e) => setServCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Categoria de Atuação *</label>
                  <select
                    value={servCategory}
                    onChange={(e) => setServCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  >
                    <option value="formatacao">Formatação & Instalação de Sistema</option>
                    <option value="limpeza">Limpeza Preventiva & Pasta Térmica</option>
                    <option value="hardware">Reparo Eletrônico / Placa-Mãe</option>
                    <option value="tela_teclado">Troca de Tela / Teclado / Carcaça</option>
                    <option value="impressora">Manutenção de Impressora & Cabeça</option>
                    <option value="outro">Outro Serviço Técnico</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Nome do Serviço / Produto *</label>
                <input
                  type="text"
                  required
                  value={servName}
                  onChange={(e) => setServName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  placeholder="Ex: Formatação Completa com Backup e Instalação de Softwares"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Descrição Detalhada do Serviço (Impresso na NFS-e) *</label>
                <textarea
                  rows={2}
                  required
                  value={servDescription}
                  onChange={(e) => setServDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  placeholder="Ex: Prestação de serviços de manutenção técnica em equipamento de informática, limpeza interna de componentes, reinstalação de sistema operacional e drivers."
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Preço de Custo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={servCostPrice}
                    onChange={(e) => setServCostPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-amber-400 font-bold"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Preço do Serviço (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={servPrice}
                    onChange={(e) => setServPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-emerald-400 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Tempo Médio (Horas)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={servEstimatedHours}
                    onChange={(e) => setServEstimatedHours(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Garantia Padrão</label>
                  <WarrantySelect
                    value={servDefaultWarrantyDays}
                    onChange={setServDefaultWarrantyDays}
                  />
                </div>
              </div>

              {/* Bloco de Informações Fiscais para NFS-e */}
              <div className="bg-slate-950 p-4 rounded-xl border border-purple-900/60 space-y-3">
                <div className="flex items-center gap-2 text-purple-400 border-b border-purple-900/40 pb-2">
                  <Receipt className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    Informações Fiscais para Emissão de NFS-e (Prefeitura)
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Código LC 116/03 (Item Lista de Serviços) *
                    </label>
                    <select
                      value={servServiceCode}
                      onChange={(e) => setServServiceCode(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                    >
                      <option value="14.01">14.01 - Manutenção, conserto, restauração e revisão de computadores</option>
                      <option value="1.07">1.07 - Suporte técnico em informática, configuração de programas</option>
                      <option value="1.03">1.03 - Processamento, armazenamento ou hospedagem de dados</option>
                      <option value="14.02">14.02 - Assistência técnica em equipamentos eletrônicos</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">CNAE de Serviço Fiscal *</label>
                    <input
                      type="text"
                      required
                      value={servCnae}
                      onChange={(e) => setServCnae(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                      placeholder="9511-8/00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Alíquota ISS (%) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={servIssRate}
                      onChange={(e) => setServIssRate(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                      placeholder="3.5"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Cód. Tributação Municipal</label>
                    <input
                      type="text"
                      value={servMunicipalTaxCode}
                      onChange={(e) => setServMunicipalTaxCode(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                      placeholder="Opcional (ex: 140101)"
                    />
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={servIssRetention}
                        onChange={(e) => setServIssRetention(e.target.checked)}
                        className="rounded border-slate-700 text-purple-600 focus:ring-0"
                      />
                      <span>ISS Retido na Fonte</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsServiceModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg shadow-md shadow-purple-600/30"
                >
                  Salvar Serviço (NFS-e)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE SENHA DO ADMINISTRADOR PARA EXCLUSÃO */}
      <AdminPasswordModal {...adminModalProps} />
    </div>
  );
};
