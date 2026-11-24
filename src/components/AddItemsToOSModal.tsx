import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Package,
  Plus,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Laptop,
  CreditCard
} from 'lucide-react';
import { WorkOrder, Product, ServiceItem } from '../types';
import { api } from '../services/api';
import { WarrantySelect } from './WarrantySelect';
import { computeAggregateWarrantyDays, formatWarrantyLabel, formatWarrantyShort } from '../utils/warrantyHelpers';

interface AddItemsToOSModalProps {
  workOrder: WorkOrder | null;
  products: Product[];
  services: ServiceItem[];
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => Promise<void>;
}

type TabType = 'servico_cadastrado' | 'servico_avulso' | 'produto_cadastrado' | 'produto_avulso';

interface PendingItem {
  id: string;
  type: 'peca' | 'servico';
  description: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  warrantyDays?: number;
  total: number;
  productId?: string;
  serviceId?: string;
  isCustom?: boolean;
}

export const AddItemsToOSModal: React.FC<AddItemsToOSModalProps> = ({
  workOrder,
  products,
  services,
  isOpen,
  onClose,
  onSaveSuccess
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('servico_cadastrado');
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Campos para Serviço Cadastrado
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [serviceQty, setServiceQty] = useState<number>(1);
  const [servicePrice, setServicePrice] = useState<number | string>('');

  // Campos para Serviço Avulso
  const [customServiceDesc, setCustomServiceDesc] = useState<string>('');
  const [customServiceQty, setCustomServiceQty] = useState<number>(1);
  const [customServicePrice, setCustomServicePrice] = useState<number | string>('');
  const [customServiceCostPrice, setCustomServiceCostPrice] = useState<number | string>('');
  const [customServiceWarrantyDays, setCustomServiceWarrantyDays] = useState<number>(90);
  const [saveCustomServiceToSystem, setSaveCustomServiceToSystem] = useState<boolean>(false);

  // Campos para Peça/Produto do Estoque
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productQty, setProductQty] = useState<number>(1);
  const [productPrice, setProductPrice] = useState<number | string>('');

  // Campos para Peça/Produto Avulso
  const [customProductDesc, setCustomProductDesc] = useState<string>('');
  const [customProductQty, setCustomProductQty] = useState<number>(1);
  const [customProductPrice, setCustomProductPrice] = useState<number | string>('');
  const [customProductCostPrice, setCustomProductCostPrice] = useState<number | string>('');
  const [customProductWarrantyDays, setCustomProductWarrantyDays] = useState<number>(90);
  const [saveCustomProductToSystem, setSaveCustomProductToSystem] = useState<boolean>(false);

  // Forma e Status de Pagamento
  const [paymentMethod, setPaymentMethod] = useState<string>(workOrder?.paymentMethod || 'A COMBINAR');
  const [paymentStatus, setPaymentStatus] = useState<'pendente' | 'pago'>(workOrder?.paymentStatus || 'pendente');

  // Reseta estados quando abre para nova OS
  useEffect(() => {
    if (isOpen) {
      setPendingItems([]);
      setErrorMsg(null);
      setActiveTab('servico_cadastrado');
      setSelectedServiceId('');
      setServiceQty(1);
      setServicePrice('');
      setSelectedProductId('');
      setProductQty(1);
      setProductPrice('');
      setCustomServiceDesc('');
      setCustomServicePrice('');
      setCustomServiceCostPrice('');
      setCustomServiceWarrantyDays(90);
      setCustomProductDesc('');
      setCustomProductPrice('');
      setCustomProductCostPrice('');
      setCustomProductWarrantyDays(90);
      setPaymentMethod(workOrder?.paymentMethod || 'A COMBINAR');
      setPaymentStatus(workOrder?.paymentStatus || 'pendente');
    }
  }, [isOpen, workOrder]);

  // Tecla ESC para fechar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Atualiza preço padrão ao selecionar serviço
  const handleSelectService = (servId: string) => {
    setSelectedServiceId(servId);
    const serv = services.find((s) => s.id === servId);
    if (serv) {
      setServicePrice(Number(serv.price || 0).toFixed(2));
      setServiceQty(1);
    } else {
      setServicePrice('');
    }
  };

  // Atualiza preço padrão ao selecionar produto
  const handleSelectProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setProductPrice(Number(prod.sellingPrice || 0).toFixed(2));
      setProductQty(1);
    } else {
      setProductPrice('');
    }
  };

  // Adiciona Serviço Cadastrado
  const handleAddRegisteredService = () => {
    if (!selectedServiceId) {
      setErrorMsg('Selecione um serviço cadastrado da lista.');
      return;
    }
    const serv = services.find((s) => s.id === selectedServiceId);
    if (!serv) return;

    const qty = Math.max(1, serviceQty);
    const rawPrice = String(servicePrice).trim();
    const parsedPrice = rawPrice ? parseFloat(rawPrice.replace(',', '.')) : serv.price;
    const unitPrice = isNaN(parsedPrice) || parsedPrice < 0 ? Number(serv.price || 0) : parsedPrice;
    const newItem: PendingItem = {
      id: `new-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'servico',
      description: serv.name.toUpperCase(),
      quantity: qty,
      unitPrice,
      costPrice: Number(serv.costPrice || 0),
      warrantyDays: serv.defaultWarrantyDays !== undefined ? Number(serv.defaultWarrantyDays) : 90,
      total: qty * unitPrice,
      serviceId: serv.id,
      isCustom: false
    };

    setPendingItems((prev) => [...prev, newItem]);
    setSelectedServiceId('');
    setServicePrice('');
    setServiceQty(1);
    setErrorMsg(null);
  };

  // Adiciona Serviço Avulso
  const handleAddCustomService = () => {
    if (!customServiceDesc.trim()) {
      setErrorMsg('Informe a descrição do serviço avulso.');
      return;
    }
    const qty = Math.max(1, customServiceQty);
    const rawPrice = String(customServicePrice).trim();
    const parsedPrice = rawPrice ? parseFloat(rawPrice.replace(',', '.')) : 0;
    const unitPrice = isNaN(parsedPrice) || parsedPrice < 0 ? 0 : parsedPrice;
    const rawCost = String(customServiceCostPrice).trim();
    const parsedCost = rawCost ? parseFloat(rawCost.replace(',', '.')) : 0;
    const costPrice = isNaN(parsedCost) || parsedCost < 0 ? 0 : parsedCost;
    const newItem: PendingItem = {
      id: `new-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'servico',
      description: customServiceDesc.trim().toUpperCase(),
      quantity: qty,
      unitPrice,
      costPrice,
      warrantyDays: Number(customServiceWarrantyDays),
      total: qty * unitPrice,
      isCustom: true
    };

    if (saveCustomServiceToSystem) {
      api.createService({
        code: `SRV-${Date.now().toString().slice(-4)}`,
        name: customServiceDesc.trim().toUpperCase(),
        category: 'outro',
        costPrice,
        price: unitPrice,
        estimatedHours: 1,
        defaultWarrantyDays: Number(customServiceWarrantyDays),
        description: customServiceDesc.trim().toUpperCase()
      }).then(res => {
        if (res?.id) newItem.serviceId = res.id;
      }).catch(err => console.error('Erro ao cadastrar serviço no sistema:', err));
    }

    setPendingItems((prev) => [...prev, newItem]);
    setCustomServiceDesc('');
    setCustomServicePrice('');
    setCustomServiceCostPrice('');
    setCustomServiceQty(1);
    setCustomServiceWarrantyDays(90);
    setSaveCustomServiceToSystem(false);
    setErrorMsg(null);
  };

  // Adiciona Peça do Estoque
  const handleAddRegisteredProduct = () => {
    if (!selectedProductId) {
      setErrorMsg('Selecione um produto/peça do estoque.');
      return;
    }
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    const qty = Math.max(1, productQty);
    if (prod.stock < qty) {
      if (!confirm(`Atenção: Estoque atual (${prod.stock}) é menor que a quantidade solicitada (${qty}). Deseja adicionar mesmo assim?`)) {
        return;
      }
    }

    const rawPrice = String(productPrice).trim();
    const parsedPrice = rawPrice ? parseFloat(rawPrice.replace(',', '.')) : prod.sellingPrice;
    const unitPrice = isNaN(parsedPrice) || parsedPrice < 0 ? Number(prod.sellingPrice || 0) : parsedPrice;
    const newItem: PendingItem = {
      id: `new-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'peca',
      description: prod.name.toUpperCase(),
      quantity: qty,
      unitPrice,
      costPrice: Number(prod.costPrice || 0),
      warrantyDays: prod.warrantyDays !== undefined ? Number(prod.warrantyDays) : 90,
      total: qty * unitPrice,
      productId: prod.id,
      isCustom: false
    };

    setPendingItems((prev) => [...prev, newItem]);
    setSelectedProductId('');
    setProductPrice('');
    setProductQty(1);
    setErrorMsg(null);
  };

  // Adiciona Peça Avulsa
  const handleAddCustomProduct = () => {
    if (!customProductDesc.trim()) {
      setErrorMsg('Informe a descrição da peça/produto avulso.');
      return;
    }
    const qty = Math.max(1, customProductQty);
    const rawPrice = String(customProductPrice).trim();
    const parsedPrice = rawPrice ? parseFloat(rawPrice.replace(',', '.')) : 0;
    const unitPrice = isNaN(parsedPrice) || parsedPrice < 0 ? 0 : parsedPrice;
    const rawCost = String(customProductCostPrice).trim();
    const parsedCost = rawCost ? parseFloat(rawCost.replace(',', '.')) : 0;
    const costPrice = isNaN(parsedCost) || parsedCost < 0 ? 0 : parsedCost;
    const newItem: PendingItem = {
      id: `new-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'peca',
      description: customProductDesc.trim().toUpperCase(),
      quantity: qty,
      unitPrice,
      costPrice,
      warrantyDays: Number(customProductWarrantyDays),
      total: qty * unitPrice,
      isCustom: true
    };

    if (saveCustomProductToSystem) {
      api.createProduct({
        code: `PEC-${Date.now().toString().slice(-4)}`,
        name: customProductDesc.trim().toUpperCase(),
        category: 'pecas',
        brand: 'GENÉRICO',
        costPrice,
        sellingPrice: unitPrice,
        stock: 0,
        minStock: 1,
        unit: 'UN',
        warrantyDays: Number(customProductWarrantyDays),
        isActive: true
      }).then(res => {
        if (res?.id) newItem.productId = res.id;
      }).catch(err => console.error('Erro ao cadastrar produto no sistema:', err));
    }

    setPendingItems((prev) => [...prev, newItem]);
    setCustomProductDesc('');
    setCustomProductPrice('');
    setCustomProductCostPrice('');
    setCustomProductQty(1);
    setCustomProductWarrantyDays(90);
    setSaveCustomProductToSystem(false);
    setErrorMsg(null);
  };

  const handleUpdatePendingItem = (id: string, field: 'quantity' | 'unitPrice' | 'costPrice', val: number) => {
    setPendingItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const newQty = field === 'quantity' ? Math.max(1, val) : it.quantity;
        const newUnitPrice = field === 'unitPrice' ? Math.max(0, val) : it.unitPrice;
        const newCostPrice = field === 'costPrice' ? Math.max(0, val) : (it.costPrice ?? 0);
        return {
          ...it,
          quantity: newQty,
          unitPrice: newUnitPrice,
          costPrice: newCostPrice,
          total: newQty * newUnitPrice
        };
      })
    );
  };

  const handleRemovePendingItem = (id: string) => {
    setPendingItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleSaveToWorkOrder = async () => {
    if (!workOrder) return;
    if (pendingItems.length === 0) {
      setErrorMsg('Adicione pelo menos um serviço ou peça antes de salvar.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await api.addItemsToWorkOrder(workOrder.id, pendingItems, paymentMethod, paymentStatus);
      await onSaveSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao adicionar itens à OS:', err);
      setErrorMsg(err.message || 'Erro ao adicionar itens à Ordem de Serviço.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !workOrder) return null;

  const newItemsTotal = pendingItems.reduce((acc, it) => acc + it.total, 0);
  const currentTotal = Number(workOrder.total) || 0;
  const projectedTotal = currentTotal + newItemsTotal;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Cabeçalho do Modal */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Adicionar Serviço ou Peça ao Equipamento
                <span className="text-blue-400 font-black">#OS {workOrder.number}</span>
              </h2>
              <p className="text-xs text-slate-400">
                {workOrder.brand} {workOrder.model} • Cliente: {workOrder.customerName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            title="Fechar (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagem de Erro */}
        {errorMsg && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Corpo do Modal com Scroll */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* Navegação entre as 4 Opções */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab('servico_cadastrado');
                setErrorMsg(null);
              }}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'servico_cadastrado'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Serviço Cadastrado</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('servico_avulso');
                setErrorMsg(null);
              }}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'servico_avulso'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Serviço Avulso</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('produto_cadastrado');
                setErrorMsg(null);
              }}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'produto_cadastrado'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Peça do Estoque</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('produto_avulso');
                setErrorMsg(null);
              }}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'produto_avulso'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Peça Avulsa</span>
            </button>
          </div>

          {/* Form Aba 1: Serviço Cadastrado */}
          {activeTab === 'servico_cadastrado' && (
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
              <label className="text-xs font-semibold text-slate-300 block">
                Selecione o Serviço Cadastrado:
              </label>
              <select
                value={selectedServiceId}
                onChange={(e) => handleSelectService(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-white focus:outline-none"
              >
                <option value="">-- Escolha um serviço --</option>
                {services.map((serv) => (
                  <option key={serv.id} value={serv.id}>
                    {serv.name} (R$ {Number(serv.price || 0).toFixed(2)} • {formatWarrantyShort(serv.defaultWarrantyDays)})
                  </option>
                ))}
              </select>

              {selectedServiceId && (() => {
                const s = services.find((srv) => srv.id === selectedServiceId);
                return s ? (
                  <p className="text-[11px] text-blue-300">
                    Garantia cadastrada do serviço: <strong>{formatWarrantyLabel(s.defaultWarrantyDays)}</strong>
                  </p>
                ) : null;
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Quantidade:</label>
                  <input
                    type="number"
                    min="1"
                    value={serviceQty}
                    onChange={(e) => setServiceQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Valor Unitário (R$): <span className="text-slate-500 font-normal">(padrão da tabela, pode alterar)</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0,00"
                    value={servicePrice}
                    onChange={(e) => setServicePrice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2 text-xs text-white font-mono focus:outline-none font-bold"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddRegisteredService}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Incluir Serviço na Lista</span>
              </button>
            </div>
          )}

          {/* Form Aba 2: Serviço Avulso */}
          {activeTab === 'servico_avulso' && (
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Descrição do Serviço Avulso:
                </label>
                <input
                  type="text"
                  placeholder="Ex: Troca de conector tipo C, regravação de BIOS..."
                  value={customServiceDesc}
                  onChange={(e) => setCustomServiceDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Quantidade:</label>
                  <input
                    type="number"
                    min="1"
                    value={customServiceQty}
                    onChange={(e) => setCustomServiceQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Valor Unitário (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={customServicePrice || ''}
                    onChange={(e) => setCustomServicePrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-amber-300 font-semibold block mb-1">Preço Custo (R$):</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={customServiceCostPrice}
                    onChange={(e) => setCustomServiceCostPrice(e.target.value)}
                    className="w-full bg-slate-900 border border-amber-500/40 focus:border-amber-400 rounded-lg p-2 text-xs text-amber-300 font-mono font-bold focus:outline-none"
                    title="Preço de custo unitário deste serviço para cálculo nos relatórios"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Garantia do Serviço:</label>
                  <WarrantySelect
                    value={customServiceWarrantyDays}
                    onChange={setCustomServiceWarrantyDays}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                <input
                  type="checkbox"
                  id="chk-save-custom-service"
                  checked={saveCustomServiceToSystem}
                  onChange={(e) => setSaveCustomServiceToSystem(e.target.checked)}
                  className="rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="chk-save-custom-service" className="text-xs text-blue-300 font-semibold cursor-pointer select-none">
                  Cadastrar também este serviço no catálogo do sistema para futuros atendimentos
                </label>
              </div>

              <button
                type="button"
                onClick={handleAddCustomService}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Incluir Serviço Avulso na Lista</span>
              </button>
            </div>
          )}

          {/* Form Aba 3: Peça / Produto do Estoque */}
          {activeTab === 'produto_cadastrado' && (
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
              <label className="text-xs font-semibold text-slate-300 block">
                Selecione o Produto/Peça do Estoque:
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => handleSelectProduct(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-xs text-white focus:outline-none"
              >
                <option value="">-- Escolha um produto --</option>
                {products
                  .filter((p) => p.isActive)
                  .map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} (Estoque: {prod.stock} {prod.unit}) - R${' '}
                      {Number(prod.sellingPrice || 0).toFixed(2)} • {formatWarrantyShort(prod.warrantyDays)}
                    </option>
                  ))}
              </select>

              {selectedProductId && (() => {
                const p = products.find((prod) => prod.id === selectedProductId);
                return p ? (
                  <p className="text-[11px] text-amber-300">
                    Garantia cadastrada do produto: <strong>{formatWarrantyLabel(p.warrantyDays)}</strong>
                  </p>
                ) : null;
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Quantidade:</label>
                  <input
                    type="number"
                    min="1"
                    value={productQty}
                    onChange={(e) => setProductQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Valor Unitário (R$): <span className="text-slate-500 font-normal">(padrão do estoque, pode alterar)</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0,00"
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-xs text-white font-mono focus:outline-none font-bold"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddRegisteredProduct}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Incluir Peça do Estoque na Lista</span>
              </button>
            </div>
          )}

          {/* Form Aba 4: Peça Avulsa */}
          {activeTab === 'produto_avulso' && (
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Descrição da Peça / Produto Avulso:
                </label>
                <input
                  type="text"
                  placeholder="Ex: Teclado US prata Dell, Cooler fan específico..."
                  value={customProductDesc}
                  onChange={(e) => setCustomProductDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Quantidade:</label>
                  <input
                    type="number"
                    min="1"
                    value={customProductQty}
                    onChange={(e) => setCustomProductQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Valor Unitário (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={customProductPrice || ''}
                    onChange={(e) => setCustomProductPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-amber-300 font-semibold block mb-1">Preço Custo (R$):</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={customProductCostPrice}
                    onChange={(e) => setCustomProductCostPrice(e.target.value)}
                    className="w-full bg-slate-900 border border-amber-500/40 focus:border-amber-400 rounded-lg p-2 text-xs text-amber-300 font-mono font-bold focus:outline-none"
                    title="Preço de custo unitário desta peça para cálculo nos relatórios"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Garantia da Peça/Produto:</label>
                  <WarrantySelect
                    value={customProductWarrantyDays}
                    onChange={setCustomProductWarrantyDays}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                <input
                  type="checkbox"
                  id="chk-save-custom-product"
                  checked={saveCustomProductToSystem}
                  onChange={(e) => setSaveCustomProductToSystem(e.target.checked)}
                  className="rounded border-slate-700 text-amber-600 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="chk-save-custom-product" className="text-xs text-amber-300 font-semibold cursor-pointer select-none">
                  Cadastrar também este produto no catálogo/estoque do sistema para futuras vendas e OS
                </label>
              </div>

              <button
                type="button"
                onClick={handleAddCustomProduct}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Incluir Peça Avulsa na Lista</span>
              </button>
            </div>
          )}

          {/* Lista de Novos Itens Adicionados */}
          <div className="border border-slate-800 rounded-xl p-3 bg-slate-950/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Novos Itens a Incluir ({pendingItems.length})
              </span>
              <span className="text-xs text-slate-400">
                Subtotal novos: <strong className="text-white font-mono">R$ {newItemsTotal.toFixed(2)}</strong>
              </span>
            </div>

            {pendingItems.length === 0 ? (
              <div className="text-center py-5 text-xs text-slate-500 italic">
                Nenhum item adicionado ainda. Escolha uma opção acima para incluir.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {pendingItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                          item.type === 'peca'
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-blue-500/15 text-blue-400'
                        }`}
                      >
                        {item.type === 'peca' ? 'Peça' : 'Serviço'}
                        {item.isCustom ? ' (Avulso)' : ''}
                      </span>
                      <span className="text-slate-200 font-medium truncate">{item.description}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                          item.warrantyDays === 0
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-emerald-500/10 text-emerald-300'
                        }`}
                      >
                        {formatWarrantyShort(item.warrantyDays)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1" title="Alterar quantidade">
                        <span className="text-[10px] text-slate-400">Qtd:</span>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdatePendingItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
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
                            value={item.costPrice ?? 0}
                            onChange={(e) => handleUpdatePendingItem(item.id, 'costPrice', parseFloat(e.target.value) || 0)}
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
                            value={item.unitPrice}
                            onChange={(e) => handleUpdatePendingItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-20 bg-slate-950 border border-slate-700 focus:border-blue-500 rounded pl-5 pr-1.5 py-1 text-xs text-white font-bold text-right font-mono"
                          />
                        </div>
                      </div>

                      <span className="font-bold text-emerald-400 font-mono text-xs w-20 text-right">
                        R$ {Number(item.total).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemovePendingItem(item.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition"
                        title="Remover"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Garantia automática da OS após incluir itens:</span>
                  <strong className="text-indigo-300">
                    {formatWarrantyLabel(
                      computeAggregateWarrantyDays(
                        [...(workOrder.items || []), ...pendingItems],
                        products,
                        services
                      )
                    )}
                  </strong>
                </div>
              </div>
            )}
          </div>

          {/* Seção Forma de Pagamento da Ordem de Serviço */}
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Forma de Pagamento da OS
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Selecione a Forma de Pagamento:
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg p-2 text-xs text-white font-semibold focus:outline-none"
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
                  Status do Pagamento:
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as 'pendente' | 'pago')}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg p-2 text-xs text-white font-semibold focus:outline-none"
                >
                  <option value="pendente">Pendente (Aguardando Pagamento)</option>
                  <option value="pago">Já Pago (Confirmado)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Comparativo de Totais */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400">Total Atual da OS: </span>
              <strong className="text-slate-200 font-mono">R$ {currentTotal.toFixed(2)}</strong>
            </div>
            <div className="text-right">
              <span className="text-slate-400">Novo Total da OS: </span>
              <strong className="text-emerald-400 font-extrabold text-sm font-mono">
                R$ {projectedTotal.toFixed(2)}
              </strong>
            </div>
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSubmitting || pendingItems.length === 0}
            onClick={handleSaveToWorkOrder}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? 'Salvando na OS...' : 'Confirmar e Salvar na OS'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
