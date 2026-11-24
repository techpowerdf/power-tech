import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, MessageSquare, Edit, Trash2, X, Phone, Mail, MapPin, Loader2, CheckCircle, AlertCircle, Building2, History } from 'lucide-react';
import { Customer, WorkOrder, Sale, StoreSettings } from '../types';
import { lookupCNPJ, formatCNPJ, cleanDigits } from '../services/cnpj';
import { CustomerHistoryModal } from '../components/CustomerHistoryModal';
import { AdminPasswordModal, useAdminPasswordModal } from '../components/AdminPasswordModal';

interface CustomersViewProps {
  customers: Customer[];
  workOrders?: WorkOrder[];
  sales?: Sale[];
  storeSettings?: StoreSettings;
  onSaveCustomer: (customer: Partial<Customer>) => Promise<any>;
  onDeleteCustomer: (id: string, adminPassword?: string) => Promise<void>;
  onPrintOS?: (os: WorkOrder) => void;
  onPrintSale?: (sale: Sale) => void;
  onNewOS?: (customer: Customer) => void;
  onNewSale?: (customer: Customer) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  workOrders = [],
  sales = [],
  storeSettings,
  onSaveCustomer,
  onDeleteCustomer,
  onPrintOS,
  onPrintSale,
  onNewOS,
  onNewSale
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState<Customer | null>(null);

  // Confirmação de Exclusão com Senha de Administrador
  const { requestConfirmation: requestAdminConfirmation, modalProps: adminModalProps } = useAdminPasswordModal();

  const [name, setName] = useState<string>('');
  const [tradeName, setTradeName] = useState<string>('');
  const [document, setDocument] = useState<string>('');
  const [stateRegistration, setStateRegistration] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [openingDate, setOpeningDate] = useState<string>('');
  const [cnae, setCnae] = useState<string>('');
  const [legalNature, setLegalNature] = useState<string>('');
  const [porte, setPorte] = useState<string>('');
  const [simplesNacional, setSimplesNacional] = useState<string>('');
  const [partners, setPartners] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [whatsapp, setWhatsapp] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [street, setStreet] = useState<string>('');
  const [number, setNumber] = useState<string>('');
  const [complement, setComplement] = useState<string>('');
  const [neighborhood, setNeighborhood] = useState<string>('');
  const [city, setCity] = useState<string>('São Paulo');
  const [state, setState] = useState<string>('SP');
  const [cep, setCep] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [isSearchingCnpj, setIsSearchingCnpj] = useState<boolean>(false);
  const [cnpjFeedback, setCnpjFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

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

  const isCnpjMode = cleanDigits(document).length === 14 || Boolean(tradeName) || Boolean(cnae);

  const performCnpjLookup = async (cnpjValue: string) => {
    const clean = cleanDigits(cnpjValue);
    if (clean.length !== 14) return;

    setIsSearchingCnpj(true);
    setCnpjFeedback({ type: 'info', message: 'Buscando todos os dados na Receita Federal...' });

    try {
      const data = await lookupCNPJ(clean);
      if (data && (data.name || data.razaoSocial)) {
        setName(data.razaoSocial || data.name);
        setTradeName(data.nomeFantasia || data.razaoSocial || data.name);
        setStateRegistration(data.stateRegistration || 'ISENTO');
        setStatus(data.status || 'ATIVA');
        if (data.openingDate) setOpeningDate(data.openingDate);
        if (data.cnae) setCnae(data.cnae);
        if (data.legalNature) setLegalNature(data.legalNature);
        if (data.porte) setPorte(data.porte);
        if (data.simplesNacional) setSimplesNacional(data.simplesNacional);
        if (data.partners) setPartners(data.partners);
        if (data.phone) setPhone(data.phone);
        if (data.whatsapp || data.phone) setWhatsapp(data.whatsapp || data.phone);
        if (data.email) setEmail(data.email);
        if (data.street) setStreet(data.street);
        setNumber(data.number || 'S/N');
        if (data.complement) setComplement(data.complement);
        if (data.neighborhood) setNeighborhood(data.neighborhood);
        if (data.city) setCity(data.city);
        if (data.state) setState(data.state);
        if (data.cep) setCep(data.cep);
        if (data.status) {
          setNotes((prev) => prev ? `${prev} | SITUAÇÃO RECEITA: ${data.status}` : `SITUAÇÃO RECEITA: ${data.status}`);
        }
        setCnpjFeedback({
          type: 'success',
          message: `Dados da empresa carregados com sucesso: ${data.nomeFantasia || data.razaoSocial || data.name}`
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
        message: 'Falha ao buscar CNPJ. Preencha manualmente.'
      });
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const handleDocumentChange = (value: string) => {
    const clean = cleanDigits(value);
    if (clean.length > 11) {
      setDocument(formatCNPJ(clean));
    } else {
      setDocument(value);
    }

    if (clean.length === 14) {
      performCnpjLookup(clean);
    } else {
      setCnpjFeedback(null);
    }
  };

  const openNewModal = () => {
    setEditingCustomer(null);
    setName('');
    setTradeName('');
    setDocument('');
    setStateRegistration('');
    setStatus('');
    setOpeningDate('');
    setCnae('');
    setLegalNature('');
    setPorte('');
    setSimplesNacional('');
    setPartners('');
    setPhone('');
    setWhatsapp('');
    setEmail('');
    setStreet('');
    setNumber('');
    setComplement('');
    setNeighborhood('');
    setCity('São Paulo');
    setState('SP');
    setCep('');
    setNotes('');
    setIsSearchingCnpj(false);
    setCnpjFeedback(null);
    setIsModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name || '');
    setTradeName(c.tradeName || '');
    setDocument(c.document || '');
    setStateRegistration(c.stateRegistration || '');
    setStatus(c.status || '');
    setOpeningDate(c.openingDate || '');
    setCnae(c.cnae || '');
    setLegalNature(c.legalNature || '');
    setPorte(c.porte || '');
    setSimplesNacional(c.simplesNacional || '');
    setPartners(c.partners || '');
    setPhone(c.phone || '');
    setWhatsapp(c.whatsapp || '');
    setEmail(c.email || '');
    setStreet(c.street || '');
    setNumber(c.number || '');
    setComplement(c.complement || '');
    setNeighborhood(c.neighborhood || '');
    setCity(c.city || '');
    setState(c.state || '');
    setCep(c.cep || '');
    setNotes(c.notes || '');
    setIsSearchingCnpj(false);
    setCnpjFeedback(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      alert('Informe o nome / razão social do cliente.');
      return;
    }

    await onSaveCustomer({
      ...(editingCustomer ? { id: editingCustomer.id } : {}),
      name: name.trim().toUpperCase(),
      tradeName: tradeName.trim().toUpperCase(),
      document: document.trim().toUpperCase(),
      stateRegistration: stateRegistration.trim().toUpperCase(),
      status: status.trim().toUpperCase(),
      openingDate: openingDate.trim().toUpperCase(),
      cnae: cnae.trim().toUpperCase(),
      legalNature: legalNature.trim().toUpperCase(),
      porte: porte.trim().toUpperCase(),
      simplesNacional: simplesNacional.trim().toUpperCase(),
      partners: partners.trim().toUpperCase(),
      phone: phone.trim(),
      whatsapp: (whatsapp || phone).trim(),
      email: email.trim().toLowerCase(),
      street: street.trim().toUpperCase(),
      number: number.trim().toUpperCase(),
      complement: complement.trim().toUpperCase(),
      neighborhood: neighborhood.trim().toUpperCase(),
      city: city.trim().toUpperCase(),
      state: state.trim().toUpperCase(),
      cep: cep.trim().toUpperCase(),
      notes: notes.trim().toUpperCase()
    });

    setIsModalOpen(false);
  };

  const openWhatsApp = (c: Customer) => {
    const raw = (c.whatsapp || c.phone || '').replace(/\D/g, '');
    if (!raw) {
      alert('Cliente sem telefone cadastrado.');
      return;
    }
    const full = raw.startsWith('55') ? raw : `55${raw}`;
    window.open(`https://wa.me/${full}?text=Olá%20${encodeURIComponent(c.name)},%20tudo%20bem?`, '_blank');
  };

  const getCustomerMetrics = (c: Customer) => {
    const cleanDoc = cleanDigits(c.document);
    const cleanP = cleanDigits(c.phone);
    const cleanW = cleanDigits(c.whatsapp);
    const normName = (c.name || '').trim().toUpperCase();

    const osCount = (workOrders || []).filter((o) => {
      if (o.customerId && o.customerId === c.id) return true;
      if (cleanDoc && cleanDoc.length >= 11 && cleanDigits(o.customerCpf) === cleanDoc) return true;
      const oPhone = cleanDigits(o.customerPhone);
      if (oPhone && oPhone.length >= 8) {
        if (cleanP && (cleanP === oPhone || cleanP.endsWith(oPhone) || oPhone.endsWith(cleanP))) return true;
        if (cleanW && (cleanW === oPhone || cleanW.endsWith(oPhone) || oPhone.endsWith(cleanW))) return true;
      }
      if (normName && (o.customerName || '').trim().toUpperCase() === normName) return true;
      return false;
    }).length;

    const salesCount = (sales || []).filter((s) => {
      if (s.customerId && s.customerId === c.id) return true;
      if (cleanDoc && cleanDoc.length >= 11 && cleanDigits(s.customerCpf) === cleanDoc) return true;
      const sPhone = cleanDigits(s.customerPhone);
      if (sPhone && sPhone.length >= 8) {
        if (cleanP && (cleanP === sPhone || cleanP.endsWith(sPhone) || sPhone.endsWith(cleanP))) return true;
        if (cleanW && (cleanW === sPhone || cleanW.endsWith(sPhone) || sPhone.endsWith(cleanW))) return true;
      }
      const sName = (s.customerName || '').trim().toUpperCase();
      if (sName && normName && sName === normName && sName !== 'CONSUMIDOR FINAL') return true;
      return false;
    }).length;

    return { osCount, salesCount };
  };

  const filteredCustomers = customers.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      !searchTerm ||
      c.name.toLowerCase().includes(term) ||
      (c.document && c.document.includes(term)) ||
      (c.phone && c.phone.includes(term)) ||
      (c.whatsapp && c.whatsapp.includes(term))
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, CPF/CNPJ, WhatsApp..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          onClick={openNewModal}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-md shadow-blue-600/30 transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Cliente</span>
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] font-bold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Nome do Cliente</th>
                <th className="py-3 px-4">CPF / CNPJ</th>
                <th className="py-3 px-4">Contatos</th>
                <th className="py-3 px-4">Endereço</th>
                <th className="py-3 px-4">Observações</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredCustomers.map((c) => {
                const metrics = getCustomerMetrics(c);
                return (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedCustomerForHistory(c)}
                        className="text-left font-bold text-white hover:text-blue-400 flex flex-col group transition"
                        title="Clique para ver o histórico completo de OS e Vendas deste cliente"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="group-hover:underline text-xs">{c.name}</span>
                          <History className="w-3 h-3 text-blue-400 opacity-70 group-hover:opacity-100 group-hover:scale-110 transition shrink-0" />
                        </div>
                        {c.tradeName && <span className="text-[10px] text-slate-400 font-normal">{c.tradeName}</span>}
                        <div className="flex items-center gap-1.5 mt-1">
                          {metrics.osCount > 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20">
                              {metrics.osCount} {metrics.osCount === 1 ? 'OS' : 'OSs'}
                            </span>
                          )}
                          {metrics.salesCount > 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                              {metrics.salesCount} {metrics.salesCount === 1 ? 'Venda' : 'Vendas'}
                            </span>
                          )}
                          {metrics.osCount === 0 && metrics.salesCount === 0 && (
                            <span className="text-[9px] text-slate-500">Sem histórico</span>
                          )}
                        </div>
                      </button>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {c.document || 'Não informado'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="block text-slate-200">{c.phone || c.whatsapp || 'Sem telefone'}</span>
                      {c.email && <span className="text-[10px] text-slate-400 block">{c.email}</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                      {c.street ? `${c.street}, ${c.number || 'S/N'} - ${c.city}/${c.state}` : 'Sem endereço'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                      {c.notes || '-'}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedCustomerForHistory(c)}
                          className="p-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400"
                          title="Ver Histórico de Ordens de Serviço e Vendas"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openWhatsApp(c)}
                          className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400"
                          title="Conversar no WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(c)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                          title="Editar"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            requestAdminConfirmation({
                              title: 'Excluir Cliente',
                              itemDescription: `Cliente "${c.name}" (${c.document || 'Sem documento'})`,
                              actionType: 'delete',
                              onConfirm: async (adminPassword) => {
                                await onDeleteCustomer(c.id, adminPassword);
                              }
                            });
                          }}
                          className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col my-auto">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {isCnpjMode ? (
                  <Building2 className="w-5 h-5 text-blue-400" />
                ) : (
                  <Users className="w-5 h-5 text-blue-400" />
                )}
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingCustomer ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {isCnpjMode ? 'Pessoa Jurídica (Empresa / CNPJ)' : 'Pessoa Física (Consumidor / CPF)'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Documento e Busca Inteligente */}
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-blue-400 flex items-center gap-1.5 uppercase tracking-wide">
                    {isCnpjMode ? <Building2 className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                    CPF ou CNPJ do Cliente
                  </label>
                  {cleanDigits(document).length === 14 && (
                    <button
                      type="button"
                      onClick={() => performCnpjLookup(document)}
                      disabled={isSearchingCnpj}
                      className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-lg transition"
                    >
                      {isSearchingCnpj ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      {isSearchingCnpj ? 'Consultando...' : 'Consultar Dados na Receita'}
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={document}
                    onChange={(e) => handleDocumentChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white pr-10 font-mono tracking-wider focus:outline-none focus:border-blue-500"
                    placeholder="Digite o CNPJ (14 dígitos) para busca automática ou CPF"
                    autoFocus
                  />
                  {isSearchingCnpj && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                    </div>
                  )}
                </div>

                {cnpjFeedback && (
                  <div className={`text-xs flex items-center gap-2 font-medium px-3 py-2 rounded-lg border ${
                    cnpjFeedback.type === 'success' ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80' :
                    cnpjFeedback.type === 'error' ? 'bg-amber-950/70 text-amber-300 border-amber-800/80' :
                    'bg-blue-950/70 text-blue-300 border-blue-800/80'
                  }`}>
                    {cnpjFeedback.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />}
                    {cnpjFeedback.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />}
                    {cnpjFeedback.type === 'info' && <Loader2 className="w-4 h-4 shrink-0 animate-spin text-blue-400" />}
                    <span>{cnpjFeedback.message}</span>
                  </div>
                )}
              </div>

              {/* CAMPOS ESPECÍFICOS DE CNPJ / EMPRESA */}
              {isCnpjMode ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-300 font-semibold block mb-1">Razão Social / Nome Empresarial *</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500 uppercase font-semibold"
                        placeholder="Razão Social completa"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-300 font-semibold block mb-1">Nome Fantasia</label>
                      <input
                        type="text"
                        value={tradeName}
                        onChange={(e) => setTradeName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500 uppercase"
                        placeholder="Nome Comercial da Empresa"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Inscrição Estadual (IE)</label>
                      <input
                        type="text"
                        value={stateRegistration}
                        onChange={(e) => setStateRegistration(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono uppercase"
                        placeholder="Isento ou Nº Estadual"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Situação Cadastral</label>
                      <input
                        type="text"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-emerald-400 font-bold uppercase"
                        placeholder="Ex: ATIVA"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Data de Abertura</label>
                      <input
                        type="text"
                        value={openingDate}
                        onChange={(e) => setOpeningDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                        placeholder="DD/MM/AAAA"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">CNAE Principal (Atividade Econômica)</label>
                      <input
                        type="text"
                        value={cnae}
                        onChange={(e) => setCnae(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white uppercase"
                        placeholder="Código e Descrição da Atividade"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Natureza Jurídica / Porte</label>
                      <input
                        type="text"
                        value={legalNature || porte}
                        onChange={(e) => setLegalNature(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white uppercase"
                        placeholder="Ex: Sociedade Empresária Limitada - ME"
                      />
                    </div>
                  </div>

                  {partners && (
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Sócios / Administradores (QSA)</label>
                      <input
                        type="text"
                        value={partners}
                        onChange={(e) => setPartners(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-300 uppercase"
                        placeholder="Sócios ou representantes"
                      />
                    </div>
                  )}
                </div>
              ) : (
                /* CAMPOS PESSOA FÍSICA */
                <div>
                  <label className="text-[11px] text-slate-300 font-semibold block mb-1">Nome Completo do Cliente *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500 uppercase font-semibold"
                    placeholder="Ex: Carlos Silva"
                  />
                </div>
              )}

              {/* CONTATOS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Telefone Fixo / Comercial</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                    placeholder="(11) 3333-4444"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">WhatsApp / Celular</label>
                  <input
                    type="text"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                    placeholder="(11) 98888-7777"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">E-mail Corporativo / Financeiro</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    placeholder="empresa@email.com"
                  />
                </div>
              </div>

              {/* ENDEREÇO COMPLETO DIVIDIDO */}
              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800 space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block">
                  Endereço Cadastral
                </span>

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">CEP</label>
                    <input
                      type="text"
                      value={cep}
                      onChange={(e) => setCep(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                      placeholder="00000-000"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="text-[11px] text-slate-400 block mb-1">Rua / Logradouro</label>
                    <input
                      type="text"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white uppercase"
                      placeholder="Ex: Av. Paulista"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Número</label>
                    <input
                      type="text"
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white uppercase"
                      placeholder="Nº ou S/N"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Complemento / Sala</label>
                    <input
                      type="text"
                      value={complement}
                      onChange={(e) => setComplement(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white uppercase"
                      placeholder="Sala, Galpão, Bloco..."
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Bairro</label>
                    <input
                      type="text"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white uppercase"
                      placeholder="Bairro"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-[11px] text-slate-400 block mb-1">Cidade / Município</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white uppercase"
                      placeholder="Cidade"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Estado (UF)</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={state}
                      onChange={(e) => setState(e.target.value.toUpperCase())}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white uppercase text-center font-bold"
                      placeholder="UF"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Anotações Internas do Cliente</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white uppercase"
                  placeholder="Ex: Empresa parceira com faturamento mensal..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow-md shadow-blue-600/30 transition"
                >
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE HISTÓRICO COMPLETO DO CLIENTE (OS e Vendas) */}
      <CustomerHistoryModal
        isOpen={Boolean(selectedCustomerForHistory)}
        onClose={() => setSelectedCustomerForHistory(null)}
        customer={selectedCustomerForHistory}
        workOrders={workOrders}
        sales={sales}
        storeSettings={storeSettings}
        onPrintOS={onPrintOS}
        onPrintSale={onPrintSale}
        onNewOS={onNewOS}
        onNewSale={onNewSale}
      />

      {/* MODAL DE SENHA DO ADMINISTRADOR PARA EXCLUSÃO */}
      <AdminPasswordModal {...adminModalProps} />
    </div>
  );
};
