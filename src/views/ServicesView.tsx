import React, { useState, useEffect } from 'react';
import { Cpu, Plus, Search, Edit, Trash2, X, Clock, ShieldCheck } from 'lucide-react';
import { ServiceItem } from '../types';
import { WarrantySelect } from '../components/WarrantySelect';
import { formatWarrantyLabel } from '../utils/warrantyHelpers';
import { AdminPasswordModal, useAdminPasswordModal } from '../components/AdminPasswordModal';

interface ServicesViewProps {
  services: ServiceItem[];
  onSaveService: (service: Partial<ServiceItem>) => Promise<void>;
  onDeleteService: (id: string, adminPassword?: string) => Promise<void>;
}

export const ServicesView: React.FC<ServicesViewProps> = ({
  services,
  onSaveService,
  onDeleteService
}) => {
  // Confirmação com Senha de Administrador
  const { requestConfirmation: requestAdminConfirmation, modalProps: adminModalProps } = useAdminPasswordModal();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);

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

  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<any>('formatacao');
  const [costPrice, setCostPrice] = useState<number>(0);
  const [price, setPrice] = useState<number>(100);
  const [estimatedHours, setEstimatedHours] = useState<number>(2);
  const [defaultWarrantyDays, setDefaultWarrantyDays] = useState<number>(90);

  const openNewModal = () => {
    setEditingService(null);
    setCode(`SRV${Date.now().toString().slice(-4)}`);
    setName('');
    setCategory('formatacao');
    setCostPrice(0);
    setPrice(120);
    setEstimatedHours(2);
    setDefaultWarrantyDays(90);
    setIsModalOpen(true);
  };

  const openEditModal = (s: ServiceItem) => {
    setEditingService(s);
    setCode(s.code);
    setName(s.name);
    setCategory(s.category);
    setCostPrice(s.costPrice || 0);
    setPrice(s.price);
    setEstimatedHours(s.estimatedHours);
    setDefaultWarrantyDays(s.defaultWarrantyDays !== undefined ? s.defaultWarrantyDays : 90);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || price <= 0) {
      alert('Informe o nome e o valor do serviço.');
      return;
    }

    await onSaveService({
      ...(editingService ? { id: editingService.id } : {}),
      code,
      name,
      category,
      costPrice: Number(costPrice || 0),
      price: Number(price),
      estimatedHours: Number(estimatedHours),
      defaultWarrantyDays: Number(defaultWarrantyDays)
    });

    setIsModalOpen(false);
  };

  const filteredServices = services.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      !searchTerm ||
      s.name.toLowerCase().includes(term) ||
      s.code.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar serviço por nome ou código..."
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
          <span>Cadastrar Mão de Obra</span>
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] font-bold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Descrição do Serviço / Mão de Obra</th>
                <th className="py-3 px-4">Tempo Estimado</th>
                <th className="py-3 px-4">Garantia Padrão</th>
                <th className="py-3 px-4 text-right">Preço de Custo</th>
                <th className="py-3 px-4 text-right">Preço de Tabela</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredServices.map((s) => (
                <tr key={s.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-400">{s.code}</td>
                  <td className="py-3 px-4 font-bold text-white">{s.name}</td>
                  <td className="py-3 px-4 text-slate-400">{s.estimatedHours} horas</td>
                  <td className="py-3 px-4">
                    <span className={`text-[11px] font-semibold ${s.defaultWarrantyDays === 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                      {formatWarrantyLabel(s.defaultWarrantyDays)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-amber-400">
                    R$ {Number(s.costPrice || 0).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-400">
                    R$ {Number(s.price).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => openEditModal(s)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          requestAdminConfirmation({
                            title: 'Excluir Serviço',
                            itemDescription: `Serviço "${s.name}" (${s.code || 'S/N'})`,
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
            </tbody>
          </table>
        </div>
      </div>

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
                <Cpu className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-white">
                  {editingService ? 'Editar Serviço' : 'Cadastrar Serviço / Mão de Obra'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Código do Serviço *</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Categoria *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  >
                    <option value="formatacao">Formatação & Software</option>
                    <option value="limpeza">Limpeza & Manutenção Térmica</option>
                    <option value="hardware">Hardware & Reparo em Placa</option>
                    <option value="tela_teclado">Troca de Tela / Teclado</option>
                    <option value="impressora">Manutenção de Impressora</option>
                    <option value="outro">Outro Serviço</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Descrição do Serviço *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  placeholder="Ex: Formatação com Backup e Instalação de Windows 11"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Preço de Custo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-amber-400 font-bold"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Preço Sugerido (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-emerald-400 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Tempo Médio (Horas)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Garantia Padrão</label>
                  <WarrantySelect
                    value={defaultWarrantyDays}
                    onChange={setDefaultWarrantyDays}
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
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow-md shadow-blue-600/30"
                >
                  Salvar Serviço
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
