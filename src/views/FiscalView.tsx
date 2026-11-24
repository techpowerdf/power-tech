import React, { useState, useEffect } from 'react';
import {
  Receipt,
  FileCheck,
  Send,
  Download,
  Printer,
  Settings,
  ShieldCheck,
  AlertCircle,
  Plus,
  X,
  FileText,
  Search,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { FiscalInvoice, FiscalConfig, Customer, Product, ServiceItem } from '../types';
import { lookupCNPJ, formatCNPJ, cleanDigits } from '../services/cnpj';

interface FiscalViewProps {
  invoices: FiscalInvoice[];
  config: FiscalConfig;
  customers: Customer[];
  products: Product[];
  services: ServiceItem[];
  onEmitInvoice: (payload: any) => Promise<any>;
  onUpdateConfig: (data: Partial<FiscalConfig>) => Promise<void>;
}

export const FiscalView: React.FC<FiscalViewProps> = ({
  invoices,
  config,
  customers,
  products,
  services,
  onEmitInvoice,
  onUpdateConfig
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'notas' | 'configuracoes'>('notas');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isEmitting, setIsEmitting] = useState<boolean>(false);

  // Form de Emissão Avulsa
  const [docType, setDocType] = useState<'nfe' | 'nfse'>('nfe');
  const [recipientName, setRecipientName] = useState<string>('');
  const [recipientDoc, setRecipientDoc] = useState<string>('');
  const [itemDesc, setItemDesc] = useState<string>('');
  const [itemPrice, setItemPrice] = useState<number>(100);
  const [itemQty, setItemQty] = useState<number>(1);

  // Config State
  const [formConfig, setFormConfig] = useState<FiscalConfig>(config);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isSearchingCnpj, setIsSearchingCnpj] = useState<boolean>(false);
  const [cnpjFeedback, setCnpjFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const performCnpjLookup = async (cnpjVal: string) => {
    const clean = cleanDigits(cnpjVal);
    if (clean.length !== 14) return;
    setIsSearchingCnpj(true);
    setCnpjFeedback({ type: 'info', message: 'Consultando dados da empresa na Receita Federal e SEFAZ...' });
    try {
      const data = await lookupCNPJ(clean);
      if (data && (data.name || data.razaoSocial)) {
        setFormConfig((prev) => ({
          ...prev,
          cnpj: formatCNPJ(clean),
          companyName: (data.razaoSocial || data.name || '').toUpperCase(),
          tradeName: (data.nomeFantasia || data.razaoSocial || data.name || '').toUpperCase(),
          stateRegistration: (data.stateRegistration || prev.stateRegistration || 'ISENTO').toUpperCase()
        }));
        setCnpjFeedback({
          type: 'success',
          message: `Empresa localizada: ${data.nomeFantasia || data.razaoSocial || data.name}`
        });
      } else {
        setCnpjFeedback({ type: 'error', message: 'CNPJ não encontrado na Receita Federal.' });
      }
    } catch (e) {
      setCnpjFeedback({ type: 'error', message: 'Erro ao consultar CNPJ. Preencha manualmente.' });
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const handleCnpjChange = (val: string) => {
    const clean = cleanDigits(val);
    if (clean.length > 11) {
      setFormConfig((prev) => ({ ...prev, cnpj: formatCNPJ(clean) }));
    } else {
      setFormConfig((prev) => ({ ...prev, cnpj: val }));
    }
    if (clean.length === 14) {
      performCnpjLookup(clean);
    } else {
      setCnpjFeedback(null);
    }
  };

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

  const handleSelectCustomer = (id: string) => {
    const c = customers.find((cust) => cust.id === id);
    if (c) {
      setRecipientName(c.name);
      setRecipientDoc(c.document || '');
    }
  };

  const handleEmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName || !recipientDoc) {
      alert('Informe o nome e o CPF/CNPJ do destinatário.');
      return;
    }

    setIsEmitting(true);
    try {
      const total = itemPrice * itemQty;
      const res = await onEmitInvoice({
        type: docType,
        referenceType: docType === 'nfe' ? 'venda' : 'os',
        referenceId: `manual-${Date.now()}`,
        recipient: {
          name: recipientName.trim().toUpperCase(),
          document: recipientDoc.trim().toUpperCase()
        },
        items: [
          {
            description: (
              itemDesc || (docType === 'nfe' ? 'VENDA DE PRODUTOS DE INFORMÁTICA' : 'MANUTENÇÃO TÉCNICA E INFORMÁTICA')
            ).trim().toUpperCase(),
            unitPrice: itemPrice,
            quantity: itemQty,
            total
          }
        ],
        total
      });

      alert(res.message || 'Nota emitida com sucesso!');
      setIsModalOpen(false);
      setItemDesc('');
    } catch (err: any) {
      alert(`Falha na emissão: ${err.message}`);
    } finally {
      setIsEmitting(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = {
      ...formConfig,
      companyName: (formConfig.companyName || '').trim().toUpperCase(),
      tradeName: (formConfig.tradeName || '').trim().toUpperCase(),
      stateRegistration: (formConfig.stateRegistration || '').trim().toUpperCase(),
      municipalRegistration: (formConfig.municipalRegistration || '').trim().toUpperCase(),
      defaultNfeCfop: (formConfig.defaultNfeCfop || '').trim().toUpperCase(),
      defaultNfseCnae: (formConfig.defaultNfseCnae || '').trim().toUpperCase(),
      defaultNfseServiceCode: (formConfig.defaultNfseServiceCode || '').trim().toUpperCase()
    };
    await onUpdateConfig(formatted);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Sub Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('notas')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeSubTab === 'notas'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-900'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Notas Emitidas (NF-e & NFS-e)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('configuracoes')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeSubTab === 'configuracoes'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Configurações Tributárias & APIs</span>
          </button>
        </div>

        {activeSubTab === 'notas' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Emitir Nota Fiscal</span>
          </button>
        )}
      </div>

      {/* Conteúdo da Aba NOTAS */}
      {activeSubTab === 'notas' && (
        <div className="space-y-4">
          {/* Status do Provedor Fiscal */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">
                  Módulo Fiscal Ativo ({config.environment === 'producao' ? 'Produção SEFAZ' : 'Modo Homologação / Simulação'})
                </h4>
                <p className="text-[11px] text-slate-400">
                  Provedor configurado: <strong className="text-blue-400 uppercase">{config.apiProvider}</strong> &bull; CNPJ Emissor: {config.cnpj}
                </p>
              </div>
            </div>

            <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              Pronto para Emissão
            </span>
          </div>

          {/* Tabela de Notas Fiscais */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] font-bold uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Nº / Série</th>
                    <th className="py-3 px-4">Destinatário</th>
                    <th className="py-3 px-4">Chave de Acesso / Protocolo</th>
                    <th className="py-3 px-4">Data Emissão</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Valor Total</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            inv.type === 'nfe'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          }`}
                        >
                          {inv.type === 'nfe' ? 'NF-e Venda' : 'NFS-e Serviço'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                        #{inv.number} / S.{inv.series}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-semibold text-white block">{inv.recipientName}</span>
                        <span className="text-[10px] text-slate-500">{inv.recipientDocument}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-400 max-w-xs truncate" title={inv.accessKey}>
                        {inv.accessKey || inv.protocol || 'Autorizada'}
                      </td>
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {new Date(inv.issuedAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {inv.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-400 whitespace-nowrap">
                        R$ {Number(inv.total).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => alert(`Imprimindo DANFE da nota #${inv.number}...\nChave: ${inv.accessKey}`)}
                            className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25"
                            title="Imprimir DANFE"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => alert(`Download do XML da nota #${inv.number} efetuado!`)}
                            className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                            title="Baixar XML"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {invoices.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Nenhuma nota fiscal emitida ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo da Aba CONFIGURAÇÕES FISCAIS */}
      {activeSubTab === 'configuracoes' && (
        <form onSubmit={handleSaveConfig} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Parâmetros Fiscais da Empresa</h3>
              <p className="text-xs text-slate-400">
                Configure os dados da sua empresa e a API de emissão fiscal (Nuvem Fiscal / Focus NFe)
              </p>
            </div>
            {saveSuccess && (
              <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/30">
                Configurações Fiscais Salvas!
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Razão Social *</label>
              <input
                type="text"
                required
                value={formConfig.companyName}
                onChange={(e) => setFormConfig({ ...formConfig, companyName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Nome Fantasia</label>
              <input
                type="text"
                value={formConfig.tradeName}
                onChange={(e) => setFormConfig({ ...formConfig, tradeName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-slate-400 font-semibold">CNPJ *</label>
                {cleanDigits(formConfig.cnpj).length === 14 && (
                  <button
                    type="button"
                    onClick={() => performCnpjLookup(formConfig.cnpj)}
                    disabled={isSearchingCnpj}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 transition"
                  >
                    {isSearchingCnpj ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                    <span>{isSearchingCnpj ? 'Buscando...' : 'Buscar CNPJ'}</span>
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={formConfig.cnpj}
                  onChange={(e) => handleCnpjChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                  placeholder="00.000.000/0000-00"
                />
                {isSearchingCnpj && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                  </div>
                )}
              </div>
              {cnpjFeedback && (
                <div
                  className={`mt-1 text-[10px] flex items-center gap-1 font-medium ${
                    cnpjFeedback.type === 'success'
                      ? 'text-emerald-400'
                      : cnpjFeedback.type === 'error'
                      ? 'text-amber-400'
                      : 'text-blue-400'
                  }`}
                >
                  {cnpjFeedback.type === 'success' && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                  {cnpjFeedback.type === 'error' && <AlertCircle className="w-3 h-3 shrink-0" />}
                  {cnpjFeedback.type === 'info' && <Loader2 className="w-3 h-3 shrink-0 animate-spin" />}
                  <span className="truncate">{cnpjFeedback.message}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Inscrição Estadual (IE)</label>
              <input
                type="text"
                value={formConfig.stateRegistration}
                onChange={(e) => setFormConfig({ ...formConfig, stateRegistration: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Inscrição Municipal (IM)</label>
              <input
                type="text"
                value={formConfig.municipalRegistration}
                onChange={(e) => setFormConfig({ ...formConfig, municipalRegistration: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Regime Tributário</label>
              <select
                value={formConfig.taxRegime}
                onChange={(e) => setFormConfig({ ...formConfig, taxRegime: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
              >
                <option value="simples_nacional">Simples Nacional (Padrão)</option>
                <option value="mei">Microempreendedor Individual (MEI)</option>
                <option value="lucro_presumido">Lucro Presumido / Real</option>
              </select>
            </div>
          </div>

          {/* Provedor de API Fiscal */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wide">
              Integração de Emissão Automática
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Provedor Fiscal</label>
                <select
                  value={formConfig.apiProvider}
                  onChange={(e) => setFormConfig({ ...formConfig, apiProvider: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-bold"
                >
                  <option value="simulador">Simulador Homologação (Sem Custo para Testes)</option>
                  <option value="nuvem_fiscal">Nuvem Fiscal API</option>
                  <option value="focus_nfe">Focus NFe API</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Ambiente de Operação</label>
                <select
                  value={formConfig.environment}
                  onChange={(e) => setFormConfig({ ...formConfig, environment: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                >
                  <option value="homologacao">Homologação (Sem validade jurídica / Testes)</option>
                  <option value="producao">Produção (SEFAZ Oficial / Validade Jurídica)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Token de Acesso da API</label>
                <input
                  type="password"
                  value={formConfig.apiToken}
                  onChange={(e) => setFormConfig({ ...formConfig, apiToken: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                  placeholder="Insira o Token fornecido pelo provedor..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">CFOP Padrão de Venda</label>
                <input
                  type="text"
                  value={formConfig.defaultNfeCfop}
                  onChange={(e) => setFormConfig({ ...formConfig, defaultNfeCfop: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                  placeholder="5102"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">CNAE de Serviço</label>
                <input
                  type="text"
                  value={formConfig.defaultNfseCnae}
                  onChange={(e) => setFormConfig({ ...formConfig, defaultNfseCnae: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                  placeholder="9511-8/00"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Alíquota ISS (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formConfig.issRate}
                  onChange={(e) => setFormConfig({ ...formConfig, issRate: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition"
            >
              Salvar Configurações Fiscais
            </button>
          </div>
        </form>
      )}

      {/* Modal Emissão Avulsa */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Emitir Nota Fiscal Direta</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEmitManual} className="p-6 space-y-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Tipo de Documento Fiscal *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDocType('nfe')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition ${
                      docType === 'nfe'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    NF-e (Venda de Produtos/Peças)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocType('nfse')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition ${
                      docType === 'nfse'
                        ? 'bg-purple-600/20 border-purple-500 text-purple-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    NFS-e (Prestação de Serviços)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Buscar Cliente Cadastrado</label>
                <select
                  onChange={(e) => handleSelectCustomer(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                >
                  <option value="">Selecionar da lista ou digitar abaixo...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.document})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Nome / Razão Social *</label>
                  <input
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    placeholder="Ex: João Silva"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">CPF ou CNPJ *</label>
                  <input
                    type="text"
                    required
                    value={recipientDoc}
                    onChange={(e) => setRecipientDoc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Descrição do Item / Serviço *</label>
                <input
                  type="text"
                  required
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  placeholder={docType === 'nfe' ? 'Ex: SSD Kingston NV2 500GB' : 'Ex: Manutenção e Limpeza em Notebook'}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    value={itemQty}
                    onChange={(e) => setItemQty(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Valor Unitário (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-emerald-400 font-bold"
                  />
                </div>
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
                  disabled={isEmitting}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-md shadow-emerald-600/30 flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isEmitting ? 'Transmitindo...' : 'Transmitir & Autorizar Nota'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
