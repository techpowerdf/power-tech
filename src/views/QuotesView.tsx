import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Printer,
  MessageSquare,
  Wrench,
  ShoppingCart,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  X
} from 'lucide-react';
import { Quote, Customer, Product, ServiceItem, StoreSettings } from '../types';
import { WarrantySelect } from '../components/WarrantySelect';
import { formatWarrantyShort, resolveItemWarrantyDays } from '../utils/warrantyHelpers';

interface QuotesViewProps {
  quotes: Quote[];
  customers: Customer[];
  products: Product[];
  services: ServiceItem[];
  storeSettings?: StoreSettings;
  onCreateQuote: (quote: Partial<Quote>) => Promise<void>;
  onUpdateQuote: (id: string, quote: Partial<Quote>) => Promise<void>;
  onConvertToOS: (id: string) => Promise<void>;
  onPrintQuote: (quote: Quote) => void;
}

export const QuotesView: React.FC<QuotesViewProps> = ({
  quotes,
  customers,
  products,
  services,
  storeSettings,
  onCreateQuote,
  onUpdateQuote,
  onConvertToOS,
  onPrintQuote
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Form State
  const [customerId, setCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [equipmentDesc, setEquipmentDesc] = useState<string>('');
  const [reportedIssue, setReportedIssue] = useState<string>('');
  const [validDays, setValidDays] = useState<number>(10);
  const [notes, setNotes] = useState<string>('Condições: Pagamento em até 3x no cartão ou 5% de desconto no PIX.');
  const [discount, setDiscount] = useState<number>(0);
  const [items, setItems] = useState<any[]>([]);

  // Picker
  const [itemType, setItemType] = useState<'servico' | 'peca' | 'avulso'>('servico');
  const [serviceId, setServiceId] = useState<string>('');
  const [productId, setProductId] = useState<string>('');
  const [itemQty, setItemQty] = useState<number>(1);
  const [itemUnitPrice, setItemUnitPrice] = useState<string>('');
  const [customItemDesc, setCustomItemDesc] = useState<string>('');
  const [customItemPrice, setCustomItemPrice] = useState<string>('');
  const [customItemCostPrice, setCustomItemCostPrice] = useState<string>('');
  const [customItemCategory, setCustomItemCategory] = useState<'servico' | 'peca'>('servico');
  const [customItemWarrantyDays, setCustomItemWarrantyDays] = useState<number>(90);

  // Fechar modal ao pressionar tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const openNewModal = () => {
    setCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
    setEquipmentDesc('');
    setReportedIssue('');
    setValidDays(10);
    setNotes('Condições: Pagamento em até 3x no cartão ou 5% de desconto no PIX.');
    setDiscount(0);
    setItems([]);
    setCustomItemDesc('');
    setCustomItemPrice('');
    setCustomItemCostPrice('');
    setCustomItemCategory('servico');
    setCustomItemWarrantyDays(90);
    setIsModalOpen(true);
  };

  const handleSelectCustomer = (id: string) => {
    setCustomerId(id);
    const c = customers.find((cust) => cust.id === id);
    if (c) {
      setCustomerName((c.name || '').toUpperCase());
      setCustomerPhone(c.whatsapp || c.phone || '');
    }
  };

  const handleItemTypeChange = (type: 'peca' | 'servico' | 'avulso') => {
    setItemType(type);
    setServiceId('');
    setProductId('');
    setItemQty(1);
    setItemUnitPrice('');
  };

  const handleServiceChange = (id: string) => {
    setServiceId(id);
    const s = services.find((srv) => srv.id === id);
    if (s) {
      setItemUnitPrice(Number(s.price || 0).toFixed(2));
      setItemQty(1);
    } else {
      setItemUnitPrice('');
    }
  };

  const handleProductChange = (id: string) => {
    setProductId(id);
    const p = products.find((prod) => prod.id === id);
    if (p) {
      setItemUnitPrice(Number(p.sellingPrice || 0).toFixed(2));
      setItemQty(1);
    } else {
      setItemUnitPrice('');
    }
  };

  const handleAddItem = () => {
    if (itemType === 'servico' && serviceId) {
      const s = services.find((srv) => srv.id === serviceId);
      if (s) {
        const qty = Math.max(1, parseInt(String(itemQty)) || 1);
        const rawPrice = String(itemUnitPrice).trim();
        const parsedPrice = rawPrice ? parseFloat(rawPrice.replace(',', '.')) : s.price;
        const unitPrice = isNaN(parsedPrice) || parsedPrice < 0 ? Number(s.price || 0) : parsedPrice;
        const total = qty * unitPrice;

        setItems([
          ...items,
          {
            id: `qit-${Date.now()}`,
            type: 'servico',
            description: (s.name || '').toUpperCase(),
            quantity: qty,
            unitPrice: unitPrice,
            costPrice: Number(s.costPrice || 0),
            warrantyDays: s.defaultWarrantyDays !== undefined ? Number(s.defaultWarrantyDays) : 90,
            total: total,
            serviceId: s.id
          }
        ]);
        setServiceId('');
        setItemUnitPrice('');
        setItemQty(1);
      }
    } else if (itemType === 'peca' && productId) {
      const p = products.find((prod) => prod.id === productId);
      if (p) {
        const qty = Math.max(1, parseInt(String(itemQty)) || 1);
        const rawPrice = String(itemUnitPrice).trim();
        const parsedPrice = rawPrice ? parseFloat(rawPrice.replace(',', '.')) : p.sellingPrice;
        const unitPrice = isNaN(parsedPrice) || parsedPrice < 0 ? Number(p.sellingPrice || 0) : parsedPrice;
        const total = qty * unitPrice;

        setItems([
          ...items,
          {
            id: `qit-${Date.now()}`,
            type: 'peca',
            description: (p.name || '').toUpperCase(),
            quantity: qty,
            unitPrice: unitPrice,
            costPrice: Number(p.costPrice || 0),
            warrantyDays: p.warrantyDays !== undefined ? Number(p.warrantyDays) : 90,
            total: total,
            productId: p.id
          }
        ]);
        setProductId('');
        setItemUnitPrice('');
        setItemQty(1);
      }
    } else if (itemType === 'avulso') {
      const desc = customItemDesc.trim();
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
      const qty = Math.max(1, parseInt(String(itemQty)) || 1);
      setItems([
        ...items,
        {
          id: `qit-avulso-${Date.now()}`,
          type: customItemCategory,
          description: `${desc.toUpperCase()} (AVULSO)`,
          quantity: qty,
          unitPrice: price,
          costPrice: costPrice,
          warrantyDays: Number(customItemWarrantyDays),
          total: qty * price,
          isCustom: true
        }
      ]);
      setCustomItemDesc('');
      setCustomItemPrice('');
      setCustomItemCostPrice('');
      setCustomItemWarrantyDays(90);
    }
  };

  const subtotal = items.reduce((acc, it) => acc + (it.total || 0), 0);
  const total = Math.max(0, subtotal - discount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || items.length === 0) {
      alert('Informe o cliente e ao menos um item ou serviço no orçamento.');
      return;
    }

    await onCreateQuote({
      customerId,
      customerName: customerName.trim().toUpperCase(),
      customerPhone: customerPhone.trim(),
      equipmentDesc: equipmentDesc.trim().toUpperCase(),
      reportedIssue: reportedIssue.trim().toUpperCase(),
      items: items.map((it) => ({
        ...it,
        description: (it.description || '').toUpperCase()
      })),
      subtotal,
      discount,
      total,
      validDays,
      notes: notes.trim().toUpperCase()
    });

    setIsModalOpen(false);
  };

  const sendWhatsApp = (quote: Quote) => {
    const phone = (quote.customerPhone || '').replace(/\D/g, '');
    if (!phone) {
      alert('Telefone do cliente não disponível neste orçamento.');
      return;
    }
    const fullPhone = phone.startsWith('55') ? phone : `55${phone}`;

    let msg = `Olá *${quote.customerName}*, segue o orçamento solicitado na *${storeSettings?.storeName || 'Power Tech'}*:\n\n`;
    msg += `📄 *Orçamento #${quote.number}*\n`;
    msg += `Item/Equipamento: *${quote.equipmentDesc}*\n\n`;
    msg += `Itens detalhados:\n`;
    quote.items.forEach((it) => {
      msg += `• ${it.quantity}x ${it.description} - R$ ${Number(it.total).toFixed(2)}\n`;
    });
    msg += `\n💰 *Total da Proposta: R$ ${Number(quote.total).toFixed(2)}*\n`;
    msg += `Validade da proposta: ${quote.validDays} dias.\n`;
    if (quote.notes) msg += `Obs: ${quote.notes}\n\n`;
    msg += `Para aprovar o início do serviço, basta nos responder aqui!`;

    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const filteredQuotes = quotes.filter((q) => {
    const term = searchTerm.toLowerCase();
    return (
      !searchTerm ||
      String(q.number).includes(term) ||
      q.customerName.toLowerCase().includes(term) ||
      (q.equipmentDesc && q.equipmentDesc.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por orçamento, cliente, equipamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <button
          onClick={openNewModal}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs shadow-md shadow-purple-600/30 transition shrink-0 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Orçamento</span>
        </button>
      </div>

      {/* Tabela de Orçamentos */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {/* Tabela Desktop (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] font-bold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Nº</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Equipamento / Descrição</th>
                <th className="py-3 px-4">Validade</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Valor Total</th>
                <th className="py-3 px-4 text-center">Ações Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredQuotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                    #{quote.number}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="font-semibold text-white block">{quote.customerName}</span>
                    <span className="text-[10px] text-slate-400">{quote.customerPhone}</span>
                  </td>
                  <td className="py-3 px-4 max-w-xs truncate text-slate-300">
                    {quote.equipmentDesc || 'Não informado'}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                    {new Date(quote.validUntil).toLocaleDateString('pt-BR')} ({quote.validDays}d)
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {quote.status === 'pendente' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Pendente
                      </span>
                    )}
                    {quote.status === 'convertido_os' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Convertido em OS
                      </span>
                    )}
                    {quote.status === 'convertido_venda' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Vendido
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-white whitespace-nowrap">
                    R$ {Number(quote.total).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      {quote.status === 'pendente' && (
                        <button
                          onClick={() => {
                            if (confirm(`Aprovar e gerar automaticamente Ordem de Serviço da proposta #${quote.number}?`)) {
                              onConvertToOS(quote.id);
                            }
                          }}
                          className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm transition"
                          title="Aprovar e Gerar OS em 1 clique"
                        >
                          <Wrench className="w-3 h-3" />
                          <span>Gerar OS</span>
                        </button>
                      )}

                      <button
                        onClick={() => sendWhatsApp(quote)}
                        className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 transition"
                        title="Enviar no WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onPrintQuote(quote)}
                        className="p-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 transition"
                        title="Imprimir Orçamento"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredQuotes.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Nenhum orçamento cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Cards Mobile (< md) */}
        <div className="md:hidden divide-y divide-slate-800/60 p-2 space-y-3">
          {filteredQuotes.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              Nenhum orçamento cadastrado.
            </div>
          ) : (
            filteredQuotes.map((quote) => (
              <div key={quote.id} className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-purple-400 text-sm">#{quote.number}</span>
                      {quote.status === 'pendente' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Pendente
                        </span>
                      )}
                      {quote.status === 'convertido_os' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          Convertido em OS
                        </span>
                      )}
                      {quote.status === 'convertido_venda' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Vendido
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-white text-sm mt-1">{quote.customerName}</h4>
                    {quote.customerPhone && (
                      <span className="text-[11px] text-slate-400 block">{quote.customerPhone}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-black text-white text-base block">
                      R$ {Number(quote.total).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Val: {new Date(quote.validUntil).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                {quote.equipmentDesc && (
                  <p className="text-xs text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                    <strong className="text-slate-400 font-medium">Equipamento: </strong>
                    {quote.equipmentDesc}
                  </p>
                )}

                {/* Ações Touch-Friendly */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80 flex-wrap">
                  {quote.status === 'pendente' && (
                    <button
                      onClick={() => {
                        if (confirm(`Aprovar e gerar automaticamente Ordem de Serviço da proposta #${quote.number}?`)) {
                          onConvertToOS(quote.id);
                        }
                      }}
                      className="flex-1 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Gerar OS</span>
                    </button>
                  )}
                  <button
                    onClick={() => sendWhatsApp(quote)}
                    className="flex-1 py-2 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                  <button
                    onClick={() => onPrintQuote(quote)}
                    className="p-2 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 transition"
                    title="Imprimir"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Novo Orçamento */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Novo Orçamento Técnico / Comercial</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                  e.preventDefault();
                }
              }}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Cliente Cadastrado</label>
                  <select
                    value={customerId}
                    onChange={(e) => handleSelectCustomer(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  >
                    <option value="">Cliente Avulso</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Nome do Cliente *</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    onBlur={() => setCustomerName(prev => prev.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white uppercase"
                    placeholder="Ex: Maria Pereira"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">WhatsApp / Telefone</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    placeholder="(11) 98888-7777"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Equipamento ou Demanda *</label>
                <input
                  type="text"
                  required
                  value={equipmentDesc}
                  onChange={(e) => setEquipmentDesc(e.target.value)}
                  onBlur={() => setEquipmentDesc(prev => prev.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white uppercase"
                  placeholder="Ex: Notebook Lenovo Ideapad 3 - Upgrade de SSD e Memória + Manutenção"
                />
              </div>

              {/* Itens */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-400 uppercase">Peças e Mão de Obra</span>
                  <button
                    type="button"
                    onClick={() => setItemType('avulso')}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition ${
                      itemType === 'avulso'
                        ? 'bg-purple-600 text-white border-purple-500'
                        : 'bg-purple-600/10 text-purple-400 border-purple-500/30 hover:bg-purple-600/20'
                    }`}
                  >
                    + Item Avulso
                  </button>
                </div>
                <div className="space-y-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                  {/* Linha 1: Tipo e Seleção do Item */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="w-full sm:w-48 shrink-0">
                      <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                        Tipo de Item:
                      </label>
                      <select
                        value={itemType}
                        onChange={(e) => handleItemTypeChange(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                      >
                        <option value="servico">Mão de Obra</option>
                        <option value="peca">Peça do Estoque</option>
                        <option value="avulso">⚡ Item Avulso</option>
                      </select>
                    </div>

                    {itemType === 'servico' && (
                      <div className="flex-1 min-w-0">
                        <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                          Selecione o Serviço:
                        </label>
                        <select
                          value={serviceId}
                          onChange={(e) => handleServiceChange(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                        >
                          <option value="">Selecione o serviço...</option>
                          {services.map((s) => (
                            <option key={s.id} value={s.id}>{s.name} (Padrão: R$ {Number(s.price).toFixed(2)})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {itemType === 'peca' && (
                      <div className="flex-1 min-w-0">
                        <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                          Selecione a Peça do Estoque:
                        </label>
                        <select
                          value={productId}
                          onChange={(e) => handleProductChange(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                        >
                          <option value="">Selecione a peça...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name} (Estoque: {p.stock}) - Padrão: R$ {Number(p.sellingPrice).toFixed(2)}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {itemType === 'avulso' && (
                      <>
                        <div className="w-full sm:w-36 shrink-0">
                          <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                            Categoria:
                          </label>
                          <select
                            value={customItemCategory}
                            onChange={(e) => setCustomItemCategory(e.target.value as any)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-medium"
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
                            placeholder="Descrição do item avulso..."
                            value={customItemDesc}
                            onChange={(e) => setCustomItemDesc(e.target.value)}
                            onBlur={() => setCustomItemDesc(prev => prev.toUpperCase())}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddItem();
                              }
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white uppercase"
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
                          value={itemQty}
                          onChange={(e) => setItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-20 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white text-center font-bold"
                          title="Quantidade"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                          Valor Unitário (R$):
                        </label>
                        <div className="relative flex items-center">
                          <span className="absolute left-2.5 text-[10px] text-slate-400 font-bold">R$</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0,00"
                            value={itemType === 'avulso' ? customItemPrice : itemUnitPrice}
                            onChange={(e) => {
                              if (itemType === 'avulso') {
                                setCustomItemPrice(e.target.value);
                              } else {
                                setItemUnitPrice(e.target.value);
                              }
                            }}
                            className="w-32 bg-slate-900 border border-slate-700 focus:border-purple-500 rounded-lg pl-7 pr-2.5 p-2 text-xs text-white font-bold text-right font-mono"
                            title="Valor Unitário (editável)"
                          />
                        </div>
                      </div>

                      <div className="pl-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                          Subtotal Item:
                        </span>
                        <div className="py-2 text-xs font-mono font-bold text-emerald-400">
                          R$ {(() => {
                            const qty = itemQty;
                            const pr = parseFloat(String(itemType === 'avulso' ? customItemPrice : itemUnitPrice).replace(',', '.')) || 0;
                            return (qty * pr).toFixed(2);
                          })()}
                        </div>
                      </div>

                      {itemType === 'avulso' && (
                        <>
                          <div>
                            <label className="text-[10px] text-amber-300 font-bold uppercase block mb-1">
                              Preço Custo (R$):
                            </label>
                            <div className="relative flex items-center">
                              <span className="absolute left-2.5 text-[10px] text-slate-400 font-bold">R$</span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="0,00"
                                value={customItemCostPrice}
                                onChange={(e) => setCustomItemCostPrice(e.target.value)}
                                className="w-28 bg-slate-900 border border-amber-500/40 focus:border-amber-400 rounded-lg pl-7 pr-2.5 p-2 text-xs text-amber-300 font-bold text-right font-mono"
                                title="Preço de custo unitário do item/serviço avulso"
                              />
                            </div>
                          </div>

                          <div className="min-w-[170px]">
                            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                              Garantia Item Avulso:
                            </label>
                            <WarrantySelect
                              value={customItemWarrantyDays}
                              onChange={setCustomItemWarrantyDays}
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleAddItem}
                      disabled={
                        itemType === 'servico'
                          ? !serviceId
                          : itemType === 'peca'
                          ? !productId
                          : !customItemDesc.trim()
                      }
                      className="w-full sm:w-auto px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar Item ao Orçamento</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 mt-2">
                  {items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 rounded bg-slate-900 text-xs">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                          it.isCustom ? 'bg-purple-900/60 text-purple-300 border border-purple-700/50' :
                          it.type === 'servico' ? 'bg-indigo-900/50 text-indigo-300' : 'bg-amber-900/50 text-amber-300'
                        }`}>
                          {it.isCustom ? `${it.type} avulso` : it.type}
                        </span>
                        <span className="truncate">{it.description}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                          resolveItemWarrantyDays(it, products, services) === 0
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-emerald-500/10 text-emerald-300'
                        }`}>
                          {formatWarrantyShort(resolveItemWarrantyDays(it, products, services))}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1" title="Alterar quantidade">
                          <span className="text-[10px] text-slate-400">Qtd:</span>
                          <input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value) || 1);
                              setItems(items.map((item, i) => i === idx ? { ...item, quantity: val, total: val * item.unitPrice } : item));
                            }}
                            className="w-12 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white text-center font-bold"
                          />
                        </div>

                        <div className="flex items-center gap-1" title="Alterar valor unitário">
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
                              className="w-20 bg-slate-950 border border-slate-700 rounded pl-5 pr-1.5 py-0.5 text-xs text-white font-bold text-right font-mono"
                            />
                          </div>
                        </div>

                        <span className="font-bold text-white font-mono w-20 text-right">R$ {Number(it.total).toFixed(2)}</span>
                        <button
                          type="button"
                          onClick={() => setItems(items.filter((_, i) => i !== idx))}
                          className="text-rose-400 hover:text-rose-300 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Validade da Proposta (Dias)</label>
                  <input
                    type="number"
                    value={validDays}
                    onChange={(e) => setValidDays(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Desconto (R$)</label>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Valor Total</label>
                  <div className="p-2 rounded-lg bg-slate-950 border border-purple-500/50 font-black text-purple-400 text-sm">
                    R$ {total.toFixed(2)}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Observações e Condições de Pagamento</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg shadow-md shadow-purple-600/30"
                >
                  Criar Orçamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
