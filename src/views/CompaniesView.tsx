import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Building2,
  Package,
  Wrench,
  Search,
  Plus,
  Edit,
  Trash2,
  X,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  AlertCircle,
  FileText,
  Printer,
  Calendar,
  DollarSign,
  Clock,
  ShieldCheck,
  Check,
  Tag,
  User,
  Sliders,
  Cpu,
  Monitor,
  Laptop,
  Server,
  HardDrive,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Filter,
  Layers,
  ArrowRight,
  Briefcase
} from 'lucide-react';
import {
  Company,
  CompanyPlan,
  CompanyEquipment,
  CompanyEquipmentMaintenance,
  EquipmentStatus,
  MaintenanceType,
  WorkOrderStatus,
  WorkOrderItem,
  StoreSettings
} from '../types';
import { api } from '../services/api';
import { lookupCNPJ, formatCNPJ, cleanDigits } from '../services/cnpj';
import { DEFAULT_STATUS_COLORS, STATUS_LABELS, getStatusBadgeStyle } from '../utils/themeCustomizer';
import { AdminPasswordModal, useAdminPasswordModal } from '../components/AdminPasswordModal';

interface CompaniesViewProps {
  storeSettings?: StoreSettings;
  onNavigateToOS?: (companyName: string) => void;
}

export const CompaniesView: React.FC<CompaniesViewProps> = ({
  storeSettings,
  onNavigateToOS
}) => {
  // Confirmação com Senha de Administrador
  const { requestConfirmation: requestAdminConfirmation, modalProps: adminModalProps } = useAdminPasswordModal();

  // Abas principais do módulo
  const [activeTab, setActiveTab] = useState<'empresas' | 'equipamentos' | 'manutencoes' | 'planos'>('empresas');

  // Estados principais de dados
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<CompanyPlan[]>([]);
  const [equipments, setEquipments] = useState<CompanyEquipment[]>([]);
  const [maintenances, setMaintenances] = useState<CompanyEquipmentMaintenance[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filtros e buscas
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [planFilter, setPlanFilter] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [companyFilter, setCompanyFilter] = useState<string>('todos');

  // Seleção e visualização
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedEquipmentForHistory, setSelectedEquipmentForHistory] = useState<CompanyEquipment | null>(null);

  // Modais
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState<boolean>(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const [isPlanModalOpen, setIsPlanModalOpen] = useState<boolean>(false);
  const [editingPlan, setEditingPlan] = useState<CompanyPlan | null>(null);

  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState<boolean>(false);
  const [editingEquipment, setEditingEquipment] = useState<CompanyEquipment | null>(null);

  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState<boolean>(false);
  const [editingMaintenance, setEditingMaintenance] = useState<CompanyEquipmentMaintenance | null>(null);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printDocument, setPrintDocument] = useState<{
    type: 'etiqueta_patrimonio' | 'ordem_manutencao' | 'relatorio_empresa';
    company?: Company;
    equipment?: CompanyEquipment;
    maintenance?: CompanyEquipmentMaintenance;
  } | null>(null);

  // Formulário de Empresa
  const [compCnpj, setCompCnpj] = useState<string>('');
  const [compCorporateName, setCompCorporateName] = useState<string>('');
  const [compTradeName, setCompTradeName] = useState<string>('');
  const [compIe, setCompIe] = useState<string>('');
  const [compIm, setCompIm] = useState<string>('');
  const [compContactName, setCompContactName] = useState<string>('');
  const [compContactRole, setCompContactRole] = useState<string>('');
  const [compPhone, setCompPhone] = useState<string>('');
  const [compWhatsapp, setCompWhatsapp] = useState<string>('');
  const [compEmail, setCompEmail] = useState<string>('');
  const [compStreet, setCompStreet] = useState<string>('');
  const [compNumber, setCompNumber] = useState<string>('');
  const [compComplement, setCompComplement] = useState<string>('');
  const [compNeighborhood, setCompNeighborhood] = useState<string>('');
  const [compCity, setCompCity] = useState<string>('São Paulo');
  const [compState, setCompState] = useState<string>('SP');
  const [compCep, setCompCep] = useState<string>('');
  const [compPlanId, setCompPlanId] = useState<string>('');
  const [compPlanStatus, setCompPlanStatus] = useState<'ativo' | 'suspenso' | 'cancelado' | 'em_negociacao'>('ativo');
  const [compPlanValue, setCompPlanValue] = useState<number>(0);
  const [compBillingDay, setCompBillingDay] = useState<number>(10);
  const [compContractStartDate, setCompContractStartDate] = useState<string>('');
  const [compContractEndDate, setCompContractEndDate] = useState<string>('');
  const [compNotes, setCompNotes] = useState<string>('');
  const [isSearchingCnpj, setIsSearchingCnpj] = useState<boolean>(false);
  const [cnpjFeedback, setCnpjFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Formulário de Plano
  const [planName, setPlanName] = useState<string>('');
  const [planCode, setPlanCode] = useState<string>('');
  const [planDesc, setPlanDesc] = useState<string>('');
  const [planMonthlyFee, setPlanMonthlyFee] = useState<number>(0);
  const [planBillingCycle, setPlanBillingCycle] = useState<'mensal' | 'trimestral' | 'semestral' | 'anual'>('mensal');
  const [planSlaHours, setPlanSlaHours] = useState<number>(24);
  const [planEquipmentLimit, setPlanEquipmentLimit] = useState<number>(0);
  const [planPreventiveVisits, setPlanPreventiveVisits] = useState<number>(1);
  const [planIncludesRemote, setPlanIncludesRemote] = useState<boolean>(true);
  const [planIncludesParts, setPlanIncludesParts] = useState<boolean>(false);
  const [planCoverageDetails, setPlanCoverageDetails] = useState<string>('');

  // Formulário de Equipamento (Patrimônio)
  const [eqCompanyId, setEqCompanyId] = useState<string>('');
  const [eqPatrimonio, setEqPatrimonio] = useState<string>('');
  const [eqType, setEqType] = useState<string>('Computador');
  const [eqBrand, setEqBrand] = useState<string>('');
  const [eqModel, setEqModel] = useState<string>('');
  const [eqSerial, setEqSerial] = useState<string>('');
  const [eqSector, setEqSector] = useState<string>('Administrativo');
  const [eqLocation, setEqLocation] = useState<string>('');
  const [eqUser, setEqUser] = useState<string>('');
  const [eqSpecs, setEqSpecs] = useState<string>('');
  const [eqStatus, setEqStatus] = useState<EquipmentStatus>('operacional');
  const [eqAcquisitionDate, setEqAcquisitionDate] = useState<string>('');
  const [eqWarrantyUntil, setEqWarrantyUntil] = useState<string>('');
  const [eqNotes, setEqNotes] = useState<string>('');

  // Formulário de Manutenção (Mesma dinâmica da OS)
  const [maintCompanyId, setMaintCompanyId] = useState<string>('');
  const [maintEquipmentId, setMaintEquipmentId] = useState<string>('');
  const [maintPatrimonio, setMaintPatrimonio] = useState<string>('');
  const [maintType, setMaintType] = useState<MaintenanceType>('preventiva');
  const [maintStatus, setMaintStatus] = useState<WorkOrderStatus>('aberta');
  const [maintReportedIssue, setMaintReportedIssue] = useState<string>('');
  const [maintTechnicalReport, setMaintTechnicalReport] = useState<string>('');
  const [maintActionsTaken, setMaintActionsTaken] = useState<string>('');
  const [maintCoveredByPlan, setMaintCoveredByPlan] = useState<boolean>(true);
  const [maintTechnicianName, setMaintTechnicianName] = useState<string>('');
  const [maintWarrantyDays, setMaintWarrantyDays] = useState<number>(90);
  const [maintEntryDate, setMaintEntryDate] = useState<string>('');
  const [maintCompletionDate, setMaintCompletionDate] = useState<string>('');
  const [maintItems, setMaintItems] = useState<WorkOrderItem[]>([]);
  const [maintNotes, setMaintNotes] = useState<string>('');

  // Item de manutenção temporário
  const [newItemDesc, setNewItemDesc] = useState<string>('');
  const [newItemType, setNewItemType] = useState<'peca' | 'servico'>('servico');
  const [newItemQty, setNewItemQty] = useState<number>(1);
  const [newItemPrice, setNewItemPrice] = useState<number>(0);

  // Carrega dados iniciais da API
  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [comps, pls, eqs, maints] = await Promise.all([
        api.getCompanies().catch(() => []),
        api.getCompanyPlans().catch(() => []),
        api.getCompanyEquipments().catch(() => []),
        api.getCompanyMaintenances().catch(() => [])
      ]);
      setCompanies(comps || []);
      setPlans(pls || []);
      setEquipments(eqs || []);
      setMaintenances(maints || []);
    } catch (err) {
      console.error('Erro ao carregar dados do módulo de empresas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Fechar modais ao pressionar tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isPrintModalOpen) setIsPrintModalOpen(false);
        else if (isMaintenanceModalOpen) setIsMaintenanceModalOpen(false);
        else if (isEquipmentModalOpen) setIsEquipmentModalOpen(false);
        else if (isPlanModalOpen) setIsPlanModalOpen(false);
        else if (isCompanyModalOpen) setIsCompanyModalOpen(false);
        else if (selectedEquipmentForHistory) setSelectedEquipmentForHistory(null);
        else if (selectedCompany) setSelectedCompany(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isPrintModalOpen,
    isMaintenanceModalOpen,
    isEquipmentModalOpen,
    isPlanModalOpen,
    isCompanyModalOpen,
    selectedEquipmentForHistory,
    selectedCompany
  ]);

  // Consulta CNPJ automática
  const handleCnpjLookup = async (cnpjValue: string) => {
    const clean = cleanDigits(cnpjValue);
    if (clean.length !== 14) return;

    setIsSearchingCnpj(true);
    setCnpjFeedback({ type: 'info', message: 'Consultando Receita Federal...' });

    try {
      const data = await lookupCNPJ(clean);
      if (data && (data.name || data.razaoSocial)) {
        const razao = data.razaoSocial || data.name || '';
        const fantasia = data.nomeFantasia || razao;
        setCompCorporateName(razao);
        setCompTradeName(fantasia);
        setCompIe(data.stateRegistration || 'ISENTO');
        if (data.phone) setCompPhone(data.phone);
        if (data.whatsapp || data.phone) setCompWhatsapp(data.whatsapp || data.phone);
        if (data.email) setCompEmail(data.email);
        if (data.street) setCompStreet(data.street);
        if (data.number) setCompNumber(data.number);
        if (data.complement) setCompComplement(data.complement);
        if (data.neighborhood) setCompNeighborhood(data.neighborhood);
        if (data.city) setCompCity(data.city);
        if (data.state) setCompState(data.state);
        if (data.cep) setCompCep(data.cep);
        setCnpjFeedback({ type: 'success', message: 'Dados da empresa importados com sucesso!' });
      } else {
        setCnpjFeedback({ type: 'error', message: 'Empresa não encontrada para este CNPJ.' });
      }
    } catch (e: any) {
      setCnpjFeedback({ type: 'error', message: e.message || 'Erro ao consultar CNPJ.' });
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  // Abrir modal de empresa (nova ou edição)
  const handleOpenCompanyModal = (comp?: Company) => {
    if (comp) {
      setEditingCompany(comp);
      setCompCnpj(comp.cnpj || '');
      setCompCorporateName(comp.corporateName || '');
      setCompTradeName(comp.tradeName || '');
      setCompIe(comp.stateRegistration || '');
      setCompIm(comp.municipalRegistration || '');
      setCompContactName(comp.contactName || '');
      setCompContactRole(comp.contactRole || '');
      setCompPhone(comp.contactPhone || '');
      setCompWhatsapp(comp.contactWhatsapp || '');
      setCompEmail(comp.contactEmail || '');
      setCompStreet(comp.street || '');
      setCompNumber(comp.number || '');
      setCompComplement(comp.complement || '');
      setCompNeighborhood(comp.neighborhood || '');
      setCompCity(comp.city || 'São Paulo');
      setCompState(comp.state || 'SP');
      setCompCep(comp.cep || '');
      setCompPlanId(comp.planId || '');
      setCompPlanStatus(comp.planStatus || 'ativo');
      setCompPlanValue(comp.planValue || 0);
      setCompBillingDay(comp.billingDay || 10);
      setCompContractStartDate(comp.contractStartDate || '');
      setCompContractEndDate(comp.contractEndDate || '');
      setCompNotes(comp.notes || '');
    } else {
      setEditingCompany(null);
      setCompCnpj('');
      setCompCorporateName('');
      setCompTradeName('');
      setCompIe('');
      setCompIm('');
      setCompContactName('');
      setCompContactRole('');
      setCompPhone('');
      setCompWhatsapp('');
      setCompEmail('');
      setCompStreet('');
      setCompNumber('');
      setCompComplement('');
      setCompNeighborhood('');
      setCompCity('São Paulo');
      setCompState('SP');
      setCompCep('');
      setCompPlanId(plans[0]?.id || '');
      setCompPlanStatus('ativo');
      setCompPlanValue(plans[0]?.monthlyFee || 0);
      setCompBillingDay(10);
      setCompContractStartDate(new Date().toISOString().substring(0, 10));
      setCompContractEndDate('');
      setCompNotes('');
    }
    setCnpjFeedback(null);
    setIsCompanyModalOpen(true);
  };

  // Salvar Empresa
  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compCorporateName.trim()) {
      alert('Por favor, informe a Razão Social da empresa.');
      return;
    }

    const selectedPl = plans.find(p => p.id === compPlanId);
    const planNameVal = selectedPl ? selectedPl.name : '';

    const payload: Partial<Company> = {
      cnpj: compCnpj,
      corporateName: compCorporateName,
      tradeName: compTradeName || compCorporateName,
      stateRegistration: compIe,
      municipalRegistration: compIm,
      contactName: compContactName || 'Responsável',
      contactRole: compContactRole,
      contactPhone: compPhone,
      contactWhatsapp: compWhatsapp,
      contactEmail: compEmail,
      street: compStreet,
      number: compNumber,
      complement: compComplement,
      neighborhood: compNeighborhood,
      city: compCity,
      state: compState,
      cep: compCep,
      planId: compPlanId || undefined,
      planName: planNameVal,
      planStatus: compPlanStatus,
      planValue: Number(compPlanValue || 0),
      billingDay: Number(compBillingDay || 10),
      contractStartDate: compContractStartDate,
      contractEndDate: compContractEndDate,
      notes: compNotes
    };

    try {
      if (editingCompany) {
        const updated = await api.updateCompany(editingCompany.id, payload);
        setCompanies(prev => prev.map(c => c.id === updated.id ? updated : c));
        if (selectedCompany?.id === updated.id) {
          setSelectedCompany(updated);
        }
      } else {
        const created = await api.createCompany(payload);
        setCompanies(prev => [created, ...prev]);
      }
      setIsCompanyModalOpen(false);
    } catch (err: any) {
      alert(`Erro ao salvar empresa: ${err.message || 'Falha na requisição'}`);
    }
  };

  // Excluir Empresa
  const handleDeleteCompany = (id: string, name: string) => {
    const totalEq = equipments.filter(e => e.companyId === id).length;
    let desc = `Empresa "${name}"`;
    if (totalEq > 0) {
      desc += ` (Possui ${totalEq} equipamento(s) no parque)`;
    }
    requestAdminConfirmation({
      title: 'Excluir Empresa',
      itemDescription: desc,
      actionType: 'delete',
      onConfirm: async (adminPassword) => {
        try {
          await api.deleteCompany(id, adminPassword);
          setCompanies(prev => prev.filter(c => c.id !== id));
          if (selectedCompany?.id === id) setSelectedCompany(null);
        } catch (err: any) {
          alert(`Erro ao excluir empresa: ${err.message}`);
        }
      }
    });
  };

  // Abrir modal de plano (novo ou edição)
  const handleOpenPlanModal = (pl?: CompanyPlan) => {
    if (pl) {
      setEditingPlan(pl);
      setPlanName(pl.name);
      setPlanCode(pl.code || '');
      setPlanDesc(pl.description || '');
      setPlanMonthlyFee(pl.monthlyFee || 0);
      setPlanBillingCycle(pl.billingCycle || 'mensal');
      setPlanSlaHours(pl.slaHours || 24);
      setPlanEquipmentLimit(pl.equipmentLimit || 0);
      setPlanPreventiveVisits(pl.preventiveVisitsPerMonth || 1);
      setPlanIncludesRemote(pl.includesRemoteSupport !== false);
      setPlanIncludesParts(Boolean(pl.includesParts));
      setPlanCoverageDetails(pl.coverageDetails || '');
    } else {
      setEditingPlan(null);
      setPlanName('');
      setPlanCode('');
      setPlanDesc('');
      setPlanMonthlyFee(500);
      setPlanBillingCycle('mensal');
      setPlanSlaHours(24);
      setPlanEquipmentLimit(10);
      setPlanPreventiveVisits(1);
      setPlanIncludesRemote(true);
      setPlanIncludesParts(false);
      setPlanCoverageDetails('');
    }
    setIsPlanModalOpen(true);
  };

  // Salvar Plano
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName.trim()) {
      alert('Informe o nome do plano de manutenção.');
      return;
    }

    const payload: Partial<CompanyPlan> = {
      name: planName,
      code: planCode,
      description: planDesc,
      monthlyFee: Number(planMonthlyFee || 0),
      billingCycle: planBillingCycle,
      slaHours: Number(planSlaHours || 24),
      equipmentLimit: Number(planEquipmentLimit || 0),
      preventiveVisitsPerMonth: Number(planPreventiveVisits || 1),
      includesRemoteSupport: planIncludesRemote,
      includesParts: planIncludesParts,
      coverageDetails: planCoverageDetails,
      active: true
    };

    try {
      if (editingPlan) {
        const updated = await api.updateCompanyPlan(editingPlan.id, payload);
        setPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
      } else {
        const created = await api.createCompanyPlan(payload);
        setPlans(prev => [...prev, created]);
      }
      setIsPlanModalOpen(false);
    } catch (err: any) {
      alert(`Erro ao salvar plano: ${err.message}`);
    }
  };

  // Excluir Plano
  const handleDeletePlan = (id: string, name: string) => {
    requestAdminConfirmation({
      title: 'Excluir Plano Corporativo',
      itemDescription: `Plano "${name}"`,
      actionType: 'delete',
      onConfirm: async (adminPassword) => {
        try {
          await api.deleteCompanyPlan(id, adminPassword);
          setPlans(prev => prev.filter(p => p.id !== id));
        } catch (err: any) {
          alert(`Erro ao excluir plano: ${err.message}`);
        }
      }
    });
  };

  // Abrir modal de equipamento (novo ou edição)
  const handleOpenEquipmentModal = (eq?: CompanyEquipment, defaultCompanyId?: string) => {
    if (eq) {
      setEditingEquipment(eq);
      setEqCompanyId(eq.companyId);
      setEqPatrimonio(eq.patrimonio);
      setEqType(eq.type || 'Computador');
      setEqBrand(eq.brand || '');
      setEqModel(eq.model || '');
      setEqSerial(eq.serialNumber || '');
      setEqSector(eq.sector || 'Geral');
      setEqLocation(eq.location || '');
      setEqUser(eq.responsibleUser || '');
      setEqSpecs(eq.specifications || '');
      setEqStatus(eq.status || 'operacional');
      setEqAcquisitionDate(eq.acquisitionDate || '');
      setEqWarrantyUntil(eq.warrantyUntil || '');
      setEqNotes(eq.notes || '');
    } else {
      setEditingEquipment(null);
      setEqCompanyId(defaultCompanyId || selectedCompany?.id || (companies[0]?.id || ''));
      // Sugere número de patrimônio baseado na contagem
      const nextPatNum = String(equipments.length + 1).padStart(4, '0');
      setEqPatrimonio(`PAT-${nextPatNum}`);
      setEqType('Computador');
      setEqBrand('Dell');
      setEqModel('OptiPlex 7090');
      setEqSerial('');
      setEqSector('Administrativo');
      setEqLocation('Sala 01');
      setEqUser('');
      setEqSpecs('Intel Core i5, 16GB RAM, SSD 512GB, Windows 11 Pro');
      setEqStatus('operacional');
      setEqAcquisitionDate(new Date().toISOString().substring(0, 10));
      setEqWarrantyUntil('');
      setEqNotes('');
    }
    setIsEquipmentModalOpen(true);
  };

  // Salvar Equipamento
  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eqPatrimonio.trim()) {
      alert('O número de patrimônio do equipamento é obrigatório.');
      return;
    }
    if (!eqCompanyId) {
      alert('Selecione a empresa proprietária do equipamento.');
      return;
    }

    const payload: Partial<CompanyEquipment> = {
      companyId: eqCompanyId,
      patrimonio: eqPatrimonio.trim(),
      type: eqType,
      brand: eqBrand,
      model: eqModel,
      serialNumber: eqSerial,
      sector: eqSector,
      location: eqLocation,
      responsibleUser: eqUser,
      specifications: eqSpecs,
      status: eqStatus,
      acquisitionDate: eqAcquisitionDate,
      warrantyUntil: eqWarrantyUntil,
      notes: eqNotes
    };

    try {
      if (editingEquipment) {
        const updated = await api.updateCompanyEquipment(editingEquipment.id, payload);
        setEquipments(prev => prev.map(e => e.id === updated.id ? updated : e));
        if (selectedEquipmentForHistory?.id === updated.id) {
          setSelectedEquipmentForHistory(updated);
        }
      } else {
        const created = await api.createCompanyEquipment(payload);
        setEquipments(prev => [...prev, created]);
      }
      setIsEquipmentModalOpen(false);
    } catch (err: any) {
      alert(`Erro ao salvar equipamento: ${err.message}`);
    }
  };

  // Excluir Equipamento
  const handleDeleteEquipment = (id: string, pat: string) => {
    requestAdminConfirmation({
      title: 'Excluir Equipamento do Parque',
      itemDescription: `Equipamento Patrimônio [${pat}]`,
      actionType: 'delete',
      onConfirm: async (adminPassword) => {
        try {
          await api.deleteCompanyEquipment(id, adminPassword);
          setEquipments(prev => prev.filter(e => e.id !== id));
          if (selectedEquipmentForHistory?.id === id) {
            setSelectedEquipmentForHistory(null);
          }
        } catch (err: any) {
          alert(`Erro ao excluir equipamento: ${err.message}`);
        }
      }
    });
  };

  // Abrir modal de manutenção (com dinâmica de OS)
  const handleOpenMaintenanceModal = (
    maint?: CompanyEquipmentMaintenance,
    targetEquipment?: CompanyEquipment
  ) => {
    const eq = targetEquipment || (maint ? equipments.find(e => e.id === maint.equipmentId) : selectedEquipmentForHistory);
    const comp = eq ? companies.find(c => c.id === eq.companyId) : selectedCompany;

    if (maint) {
      setEditingMaintenance(maint);
      setMaintCompanyId(maint.companyId);
      setMaintEquipmentId(maint.equipmentId);
      setMaintPatrimonio(maint.patrimonio);
      setMaintType(maint.type);
      setMaintStatus(maint.status);
      setMaintReportedIssue(maint.reportedIssue || '');
      setMaintTechnicalReport(maint.technicalReport || '');
      setMaintActionsTaken(maint.actionsTaken || '');
      setMaintCoveredByPlan(maint.coveredByPlan);
      setMaintTechnicianName(maint.technicianName || storeSettings?.storeName || 'Técnico');
      setMaintWarrantyDays(maint.warrantyDays || 90);
      setMaintEntryDate(maint.entryDate || new Date().toISOString().substring(0, 10));
      setMaintCompletionDate(maint.completionDate || '');
      setMaintItems(maint.items || []);
      setMaintNotes(maint.notes || '');
    } else {
      setEditingMaintenance(null);
      setMaintCompanyId(comp?.id || eq?.companyId || '');
      setMaintEquipmentId(eq?.id || '');
      setMaintPatrimonio(eq?.patrimonio || '');
      setMaintType('preventiva');
      setMaintStatus('aberta');
      setMaintReportedIssue('Revisão preventiva periódica de hardware, limpeza técnica interna e otimização do sistema.');
      setMaintTechnicalReport('');
      setMaintActionsTaken('');
      setMaintCoveredByPlan(Boolean(comp?.planId));
      setMaintTechnicianName(storeSettings?.storeName || 'Técnico Responsável');
      setMaintWarrantyDays(90);
      setMaintEntryDate(new Date().toISOString().substring(0, 10));
      setMaintCompletionDate('');
      setMaintItems([]);
      setMaintNotes('');
    }
    setNewItemDesc('');
    setNewItemPrice(0);
    setNewItemQty(1);
    setIsMaintenanceModalOpen(true);
  };

  // Adicionar item na manutenção
  const handleAddMaintItem = () => {
    if (!newItemDesc.trim()) {
      alert('Informe a descrição da peça ou serviço.');
      return;
    }
    const item: WorkOrderItem = {
      id: `it-${Date.now()}`,
      description: newItemDesc.trim(),
      type: newItemType,
      quantity: Math.max(1, Number(newItemQty)),
      unitPrice: Math.max(0, Number(newItemPrice)),
      total: Math.max(1, Number(newItemQty)) * Math.max(0, Number(newItemPrice))
    };
    setMaintItems(prev => [...prev, item]);
    setNewItemDesc('');
    setNewItemPrice(0);
    setNewItemQty(1);
  };

  const handleRemoveMaintItem = (itemId: string) => {
    setMaintItems(prev => prev.filter(it => it.id !== itemId));
  };

  // Salvar Manutenção
  const handleSaveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintEquipmentId) {
      alert('Selecione o equipamento e patrimônio correspondente.');
      return;
    }

    const eq = equipments.find(e => e.id === maintEquipmentId);
    const comp = companies.find(c => c.id === (eq?.companyId || maintCompanyId));

    const partsTot = maintItems.filter(i => i.type === 'peca').reduce((sum, i) => sum + i.total, 0);
    const servTot = maintItems.filter(i => i.type === 'servico').reduce((sum, i) => sum + i.total, 0);
    const subtotal = partsTot + servTot;
    const finalTotal = maintCoveredByPlan ? 0 : subtotal;

    const payload: Partial<CompanyEquipmentMaintenance> = {
      companyId: comp?.id || maintCompanyId,
      companyName: comp?.tradeName || comp?.corporateName || 'Empresa',
      equipmentId: maintEquipmentId,
      patrimonio: eq?.patrimonio || maintPatrimonio,
      equipmentDescription: eq ? `${eq.brand} ${eq.model} (${eq.type})` : 'Equipamento',
      sector: eq?.sector || '',
      responsibleUser: eq?.responsibleUser || '',
      type: maintType,
      status: maintStatus,
      reportedIssue: maintReportedIssue,
      technicalReport: maintTechnicalReport,
      actionsTaken: maintActionsTaken,
      coveredByPlan: maintCoveredByPlan,
      items: maintItems,
      partsTotal: partsTot,
      servicesTotal: servTot,
      discount: 0,
      total: finalTotal,
      warrantyDays: maintWarrantyDays,
      entryDate: maintEntryDate,
      completionDate: maintCompletionDate || (maintStatus === 'concluida' || maintStatus === 'entregue' ? new Date().toISOString().substring(0, 10) : undefined),
      deliveredDate: maintStatus === 'entregue' ? new Date().toISOString().substring(0, 10) : undefined,
      technicianName: maintTechnicianName,
      notes: maintNotes
    };

    try {
      if (editingMaintenance) {
        const updated = await api.updateCompanyMaintenance(editingMaintenance.id, payload);
        setMaintenances(prev => prev.map(m => m.id === updated.id ? updated : m));
      } else {
        const created = await api.createCompanyMaintenance(payload);
        setMaintenances(prev => [created, ...prev]);
      }

      // Atualiza status local do equipamento
      if (['concluida', 'entregue'].includes(maintStatus)) {
        setEquipments(prev => prev.map(e => e.id === maintEquipmentId ? { ...e, status: 'operacional' } : e));
      } else if (['aberta', 'analise', 'orcamento', 'aprovada', 'manutencao', 'aguardando_peca'].includes(maintStatus)) {
        setEquipments(prev => prev.map(e => e.id === maintEquipmentId ? { ...e, status: 'em_manutencao' } : e));
      }

      setIsMaintenanceModalOpen(false);
    } catch (err: any) {
      alert(`Erro ao salvar ordem de manutenção: ${err.message}`);
    }
  };

  // Atualização rápida de status da manutenção (mesma dinâmica da OS)
  const handleQuickStatusChange = async (maint: CompanyEquipmentMaintenance, newStatus: WorkOrderStatus) => {
    try {
      const updated = await api.updateCompanyMaintenance(maint.id, {
        status: newStatus,
        completionDate: (newStatus === 'concluida' || newStatus === 'entregue') ? (maint.completionDate || new Date().toISOString().substring(0, 10)) : maint.completionDate,
        deliveredDate: newStatus === 'entregue' ? new Date().toISOString().substring(0, 10) : maint.deliveredDate
      });
      setMaintenances(prev => prev.map(m => m.id === updated.id ? updated : m));

      if (['concluida', 'entregue'].includes(newStatus)) {
        setEquipments(prev => prev.map(e => e.id === maint.equipmentId ? { ...e, status: 'operacional' } : e));
      } else if (['aberta', 'analise', 'orcamento', 'aprovada', 'manutencao', 'aguardando_peca'].includes(newStatus)) {
        setEquipments(prev => prev.map(e => e.id === maint.equipmentId ? { ...e, status: 'em_manutencao' } : e));
      }
    } catch (err: any) {
      alert(`Erro ao alterar status: ${err.message}`);
    }
  };

  // Excluir manutenção
  const handleDeleteMaintenance = (id: string, num: number) => {
    requestAdminConfirmation({
      title: 'Excluir Registro de Manutenção',
      itemDescription: `Registro de Manutenção #${num}`,
      actionType: 'delete',
      onConfirm: async (adminPassword) => {
        try {
          await api.deleteCompanyMaintenance(id, adminPassword);
          setMaintenances(prev => prev.filter(m => m.id !== id));
        } catch (err: any) {
          alert(`Erro ao excluir manutenção: ${err.message}`);
        }
      }
    });
  };

  // Impressão
  const handlePrintDocument = (doc: {
    type: 'etiqueta_patrimonio' | 'ordem_manutencao' | 'relatorio_empresa';
    company?: Company;
    equipment?: CompanyEquipment;
    maintenance?: CompanyEquipmentMaintenance;
  }) => {
    setPrintDocument(doc);
    setIsPrintModalOpen(true);
  };

  // Métricas de topo
  const metrics = useMemo(() => {
    const totalCompanies = companies.length;
    const activeCompanies = companies.filter(c => c.planStatus === 'ativo').length;
    const totalEquipments = equipments.length;
    const inMaintenanceEquipments = equipments.filter(e => e.status === 'em_manutencao').length;
    const monthlyRevenue = companies
      .filter(c => c.planStatus === 'ativo')
      .reduce((sum, c) => sum + (c.planValue || 0), 0);
    const openMaintenances = maintenances.filter(m =>
      !['concluida', 'entregue', 'cancelada'].includes(m.status)
    ).length;

    return {
      totalCompanies,
      activeCompanies,
      totalEquipments,
      inMaintenanceEquipments,
      monthlyRevenue,
      openMaintenances
    };
  }, [companies, equipments, maintenances]);

  // Filtragem de Empresas
  const filteredCompanies = useMemo(() => {
    return companies.filter(comp => {
      const matchesSearch =
        comp.corporateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (comp.tradeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        comp.cnpj.includes(searchTerm) ||
        (comp.contactName || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesPlan = planFilter === 'todos' || comp.planId === planFilter;
      const matchesStatus = statusFilter === 'todos' || comp.planStatus === statusFilter;

      return matchesSearch && matchesPlan && matchesStatus;
    });
  }, [companies, searchTerm, planFilter, statusFilter]);

  // Filtragem de Equipamentos
  const filteredEquipments = useMemo(() => {
    return equipments.filter(eq => {
      const comp = companies.find(c => c.id === eq.companyId);
      const matchesCompany = companyFilter === 'todos' || eq.companyId === companyFilter;
      const matchesSearch =
        eq.patrimonio.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (eq.sector || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (eq.responsibleUser || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (eq.serialNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (comp?.tradeName || comp?.corporateName || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'todos' || eq.status === statusFilter;

      return matchesCompany && matchesSearch && matchesStatus;
    });
  }, [equipments, companies, companyFilter, searchTerm, statusFilter]);

  // Filtragem de Manutenções
  const filteredMaintenances = useMemo(() => {
    return maintenances.filter(m => {
      const matchesCompany = companyFilter === 'todos' || m.companyId === companyFilter;
      const matchesSearch =
        m.patrimonio.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(m.orderNumber).includes(searchTerm) ||
        m.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.reportedIssue || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.technicalReport || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.technicianName || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'todos' || m.status === statusFilter;

      return matchesCompany && matchesSearch && matchesStatus;
    });
  }, [maintenances, companyFilter, searchTerm, statusFilter]);

  // Equipamentos da empresa selecionada no painel de detalhes
  const selectedCompanyEquipments = useMemo(() => {
    if (!selectedCompany) return [];
    return equipments.filter(e => e.companyId === selectedCompany.id);
  }, [equipments, selectedCompany]);

  // Manutenções do equipamento selecionado para histórico
  const selectedEquipmentMaintenances = useMemo(() => {
    if (!selectedEquipmentForHistory) return [];
    return maintenances.filter(m => m.equipmentId === selectedEquipmentForHistory.id);
  }, [maintenances, selectedEquipmentForHistory]);

  const getEquipmentStatusBadge = (status: EquipmentStatus) => {
    switch (status) {
      case 'operacional':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            Operacional
          </span>
        );
      case 'em_manutencao':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            Em Manutenção
          </span>
        );
      case 'reserva':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            Reserva Técnica
          </span>
        );
      case 'baixado':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            Baixado / Desativado
          </span>
        );
      default:
        return null;
    }
  };

  const getPlanStatusBadge = (status: string) => {
    switch (status) {
      case 'ativo':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            Contrato Ativo
          </span>
        );
      case 'em_negociacao':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            Em Negociação
          </span>
        );
      case 'suspenso':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            Suspenso
          </span>
        );
      case 'cancelado':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            Cancelado
          </span>
        );
      default:
        return null;
    }
  };

  const getMaintenanceTypeBadge = (type: MaintenanceType) => {
    switch (type) {
      case 'preventiva':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Preventiva (Plano)
          </span>
        );
      case 'corretiva':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Corretiva
          </span>
        );
      case 'upgrade':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            Upgrade / Peças
          </span>
        );
      case 'instalacao':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            Instalação
          </span>
        );
      case 'suporte_remoto':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            Suporte Remoto
          </span>
        );
      case 'visita_tecnica':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            Visita Técnica
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 bg-slate-900 overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Cabeçalho do Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Gestão de Empresas & Planos Corporativos</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  B2B
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Contratos corporativos, parque de equipamentos com controle de patrimônio e histórico de manutenções.
              </p>
            </div>
          </div>
        </div>

        {/* Botões de Ação Global */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleOpenPlanModal()}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition active:scale-[0.98]"
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Planos ({plans.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenEquipmentModal()}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition active:scale-[0.98]"
          >
            <Tag className="w-4 h-4 text-emerald-400" />
            <span>+ Novo Patrimônio</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenCompanyModal()}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center gap-1.5 transition active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nova Empresa</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas e Faturamento B2B */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
              Empresas Ativas
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">{metrics.activeCompanies}</span>
              <span className="text-xs text-slate-500">/ {metrics.totalCompanies} cadastradas</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
              Parque de Equipamentos
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-400">{metrics.totalEquipments}</span>
              <span className="text-xs text-slate-500">patrimônios</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <Tag className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
              Receita Mensal Recorrente
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xs font-bold text-amber-400">R$</span>
              <span className="text-2xl font-black text-amber-400">
                {metrics.monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
              Chamados / OS Abertos
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-purple-400">{metrics.openMaintenances}</span>
              <span className="text-xs text-slate-500">em andamento</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
            <Wrench className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Navegação entre Abas do Módulo */}
      <div className="flex items-center gap-1 border-b border-slate-800 overflow-x-auto whitespace-nowrap pb-1 scrollbar-thin scrollbar-thumb-slate-800">
        <button
          type="button"
          onClick={() => { setActiveTab('empresas'); setSelectedEquipmentForHistory(null); }}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'empresas'
              ? 'border-blue-500 text-blue-400 bg-blue-500/10 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Empresas Cadastradas ({companies.length})</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('equipamentos'); setSelectedCompany(null); }}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'equipamentos'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Parque & Patrimônio ({equipments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('manutencoes')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'manutencoes'
              ? 'border-purple-500 text-purple-400 bg-purple-500/10 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Histórico de Manutenções / OS ({maintenances.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('planos')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'planos'
              ? 'border-amber-500 text-amber-400 bg-amber-500/10 rounded-t-lg'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Planos de Manutenção ({plans.length})</span>
        </button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col md:flex-row items-center gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={
              activeTab === 'empresas'
                ? 'Buscar por Razão Social, Nome Fantasia, CNPJ ou Contato...'
                : activeTab === 'equipamentos'
                ? 'Buscar por Patrimônio, Modelo, Marca, Setor, Usuário ou Empresa...'
                : activeTab === 'manutencoes'
                ? 'Buscar por Nº da OS, Patrimônio, Empresa, Problema ou Técnico...'
                : 'Buscar plano corporativo...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 focus:border-blue-500 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
          />
        </div>

        {/* Filtros específicos por aba */}
        {activeTab === 'empresas' && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="todos">Todos os Planos</option>
              {plans.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="todos">Todos os Status</option>
              <option value="ativo">Contrato Ativo</option>
              <option value="em_negociacao">Em Negociação</option>
              <option value="suspenso">Suspenso</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        )}

        {activeTab === 'equipamentos' && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 max-w-[200px]"
            >
              <option value="todos">Todas as Empresas</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.tradeName || c.corporateName}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="todos">Todos os Status</option>
              <option value="operacional">Operacional</option>
              <option value="em_manutencao">Em Manutenção</option>
              <option value="reserva">Reserva Técnica</option>
              <option value="baixado">Baixado</option>
            </select>
          </div>
        )}

        {activeTab === 'manutencoes' && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500 max-w-[200px]"
            >
              <option value="todos">Todas as Empresas</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.tradeName || c.corporateName}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
            >
              <option value="todos">Todos os Status</option>
              <option value="aberta">Aberta</option>
              <option value="analise">Em Análise</option>
              <option value="manutencao">Na Bancada</option>
              <option value="aguardando_peca">Aguardando Peça</option>
              <option value="concluida">Pronta Retirada</option>
              <option value="entregue">Entregue</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* ABA 1: EMPRESAS CADASTRADAS */}
      {/* ============================================================== */}
      {activeTab === 'empresas' && (
        <div className="space-y-4">
          {filteredCompanies.length === 0 ? (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <Building2 className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">Nenhuma empresa encontrada</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Cadastre suas empresas conveniadas, contratos de TI e controle o parque de máquinas de cada cliente corporativo.
              </p>
              <button
                type="button"
                onClick={() => handleOpenCompanyModal()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Primeira Empresa</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCompanies.map(comp => {
                const compEquips = equipments.filter(e => e.companyId === comp.id);
                const compMaints = maintenances.filter(m => m.companyId === comp.id);
                const openMaints = compMaints.filter(m => !['concluida', 'entregue', 'cancelada'].includes(m.status)).length;
                const pl = plans.find(p => p.id === comp.planId);

                return (
                  <div
                    key={comp.id}
                    className="bg-slate-950/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 space-y-4 flex flex-col justify-between transition shadow-lg group"
                  >
                    <div className="space-y-3">
                      {/* Topo do Card */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                            {formatCNPJ(comp.cnpj) || 'CNPJ NÃO INFORMADO'}
                          </span>
                          <h3 className="text-sm font-black text-white group-hover:text-blue-400 transition leading-snug line-clamp-1">
                            {comp.tradeName || comp.corporateName}
                          </h3>
                          {comp.tradeName && comp.corporateName !== comp.tradeName && (
                            <p className="text-[11px] text-slate-400 truncate">{comp.corporateName}</p>
                          )}
                        </div>
                        {getPlanStatusBadge(comp.planStatus)}
                      </div>

                      {/* Informações do Plano e Vencimento */}
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/80 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 text-[11px] flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                            <span>Plano de TI:</span>
                          </span>
                          <strong className="text-white text-[11px] truncate max-w-[140px]">
                            {pl?.name || comp.planName || 'Sem Plano Vinculado'}
                          </strong>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-800/60 pt-1.5">
                          <span className="text-slate-400 text-[11px]">Mensalidade:</span>
                          <strong className="text-emerald-400 font-mono font-bold text-xs">
                            R$ {(comp.planValue || pl?.monthlyFee || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>Vencimento:</span>
                          <span className="text-slate-300 font-medium">Dia {comp.billingDay || 10} de cada mês</span>
                        </div>
                      </div>

                      {/* Contato & Localização */}
                      <div className="space-y-1.5 text-xs text-slate-300">
                        {comp.contactName && (
                          <div className="flex items-center gap-1.5 text-slate-300 truncate">
                            <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="truncate">
                              {comp.contactName} {comp.contactRole ? `(${comp.contactRole})` : ''}
                            </span>
                          </div>
                        )}
                        {(comp.contactPhone || comp.contactWhatsapp) && (
                          <div className="flex items-center gap-1.5 text-slate-300 truncate">
                            <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>{comp.contactWhatsapp || comp.contactPhone}</span>
                          </div>
                        )}
                        {comp.city && (
                          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] truncate">
                            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="truncate">
                              {comp.neighborhood ? `${comp.neighborhood}, ` : ''}{comp.city}/{comp.state}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Contadores de Parque de Máquinas */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => {
                            setCompanyFilter(comp.id);
                            setActiveTab('equipamentos');
                          }}
                          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-left transition"
                          title="Ver equipamentos cadastrados desta empresa"
                        >
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">Equipamentos</span>
                          <span className="text-sm font-black text-emerald-400 flex items-center gap-1">
                            <Tag className="w-3.5 h-3.5" />
                            <span>{compEquips.length} Máquinas</span>
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCompanyFilter(comp.id);
                            setActiveTab('manutencoes');
                          }}
                          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-left transition"
                          title="Ver chamados e manutenções desta empresa"
                        >
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">Chamados</span>
                          <span className="text-sm font-black text-purple-400 flex items-center gap-1">
                            <Wrench className="w-3.5 h-3.5" />
                            <span>{openMaints} Abertos</span>
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Rodapé de Ações do Card da Empresa */}
                    <div className="flex items-center justify-between gap-1 pt-3 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCompany(comp);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/30 text-blue-400 text-xs font-bold inline-flex items-center gap-1 transition"
                        title="Abrir detalhes, máquinas e histórico completo desta empresa"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Ver Parque</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handlePrintDocument({ type: 'relatorio_empresa', company: comp })}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
                          title="Imprimir Relatório do Parque e Contrato"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenCompanyModal(comp)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
                          title="Editar Cadastro da Empresa"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCompany(comp.id, comp.tradeName || comp.corporateName)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition"
                          title="Excluir Empresa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 2: PARQUE DE EQUIPAMENTOS (COM PATRIMÔNIO) */}
      {/* ============================================================== */}
      {activeTab === 'equipamentos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span>Inventário de Equipamentos & Patrimônio</span>
                <span className="text-xs text-slate-400 font-normal">
                  ({filteredEquipments.length} {filteredEquipments.length === 1 ? 'item' : 'itens'})
                </span>
              </h2>
              {companyFilter !== 'todos' && (
                <p className="text-xs text-blue-400">
                  Filtrando pela empresa: <strong>{companies.find(c => c.id === companyFilter)?.tradeName}</strong>
                  <button
                    type="button"
                    onClick={() => setCompanyFilter('todos')}
                    className="ml-2 text-slate-400 hover:text-white underline text-[11px]"
                  >
                    (Limpar filtro de empresa)
                  </button>
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleOpenEquipmentModal(undefined, companyFilter !== 'todos' ? companyFilter : undefined)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>+ Cadastrar Equipamento</span>
            </button>
          </div>

          {filteredEquipments.length === 0 ? (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <Tag className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">Nenhum equipamento com patrimônio encontrado</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Registre os computadores, notebooks, servidores e periféricos das empresas com número de patrimônio e especificações completas.
              </p>
              <button
                type="button"
                onClick={() => handleOpenEquipmentModal()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Primeiro Equipamento</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEquipments.map(eq => {
                const comp = companies.find(c => c.id === eq.companyId);
                const eqMaints = maintenances.filter(m => m.equipmentId === eq.id);
                const openMaints = eqMaints.filter(m => !['concluida', 'entregue', 'cancelada'].includes(m.status)).length;

                return (
                  <div
                    key={eq.id}
                    className="bg-slate-950/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 space-y-3 flex flex-col justify-between transition shadow-lg group"
                  >
                    <div className="space-y-2.5">
                      {/* Cabeçalho do Equipamento com Patrimônio em Destaque */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-mono font-black text-xs border border-amber-500/40 shadow-sm flex items-center gap-1">
                            <Tag className="w-3.5 h-3.5 text-amber-400" />
                            <span>{eq.patrimonio}</span>
                          </span>
                          <span className="text-xs text-slate-400 font-semibold">{eq.type}</span>
                        </div>
                        {getEquipmentStatusBadge(eq.status)}
                      </div>

                      {/* Título e Modelo */}
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition leading-snug">
                          {eq.brand} {eq.model}
                        </h4>
                        <p className="text-xs text-blue-400 font-medium truncate flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-blue-400 shrink-0" />
                          <span className="truncate">{comp?.tradeName || comp?.corporateName || eq.companyName}</span>
                        </p>
                      </div>

                      {/* Setor, Sala e Usuário */}
                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/70">
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">Setor / Local</span>
                          <span className="text-slate-200 font-semibold truncate block">
                            {eq.sector || 'Geral'} {eq.location ? `• ${eq.location}` : ''}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">Usuário / Operador</span>
                          <span className="text-slate-200 font-semibold truncate block">
                            {eq.responsibleUser || 'Não atribuído'}
                          </span>
                        </div>
                      </div>

                      {/* Especificações e Número de Série */}
                      <div className="space-y-1 text-xs text-slate-300">
                        {eq.serialNumber && (
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>Nº de Série / Tag:</span>
                            <span className="font-mono text-slate-200 font-semibold">{eq.serialNumber}</span>
                          </div>
                        )}
                        {eq.specifications && (
                          <p className="text-[11px] text-slate-400 bg-slate-900/40 p-2 rounded-lg border border-slate-800/40 line-clamp-2 leading-relaxed">
                            {eq.specifications}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Rodapé de Ações do Equipamento */}
                    <div className="space-y-2 pt-2 border-t border-slate-800/80">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 text-[11px] flex items-center gap-1">
                          <Wrench className="w-3 h-3 text-purple-400" />
                          <span>{eqMaints.length} chamados no histórico</span>
                        </span>
                        {openMaints > 0 && (
                          <span className="text-[10px] font-bold text-amber-300 px-1.5 py-0.5 rounded bg-amber-500/20">
                            {openMaints} em aberto
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEquipmentForHistory(eq);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-purple-600/15 hover:bg-purple-600/30 text-purple-300 text-xs font-bold inline-flex items-center gap-1 transition"
                          title="Abrir histórico de ordens de serviço deste equipamento"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Histórico (OS)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenMaintenanceModal(undefined, eq)}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/30 text-blue-300 text-xs font-bold inline-flex items-center gap-1 transition"
                          title="Abrir novo chamado de manutenção para este patrimônio"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Nova Manutenção</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handlePrintDocument({ type: 'etiqueta_patrimonio', equipment: eq, company: comp })}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
                            title="Imprimir Etiqueta de Patrimônio com Código"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEquipmentModal(eq)}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
                            title="Editar Dados do Equipamento"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEquipment(eq.id, eq.patrimonio)}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition"
                            title="Remover Equipamento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 3: HISTÓRICO DE MANUTENÇÕES / OS DOS EQUIPAMENTOS */}
      {/* ============================================================== */}
      {activeTab === 'manutencoes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span>Histórico de Chamados & Ordens de Manutenção</span>
                <span className="text-xs text-slate-400 font-normal">
                  ({filteredMaintenances.length} registros)
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Acompanhamento completo de manutenções preventivas e corretivas com dinâmica idêntica às Ordens de Serviço.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleOpenMaintenanceModal()}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 flex items-center gap-1.5 transition active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>+ Novo Chamado / Manutenção</span>
            </button>
          </div>

          {filteredMaintenances.length === 0 ? (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <Wrench className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">Nenhum chamado de manutenção registrado</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Registre preventivas e corretivas vinculadas aos patrimônios das empresas para manter o laudo e histórico sempre em dia.
              </p>
              <button
                type="button"
                onClick={() => handleOpenMaintenanceModal()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Abrir Primeira Manutenção</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMaintenances.map(maint => {
                const bStyle = getStatusBadgeStyle(
                  maint.status,
                  storeSettings?.statusColors,
                  storeSettings?.badgeFontSize,
                  storeSettings?.badgePadding
                );
                const statusLabel = STATUS_LABELS[maint.status] || maint.status;
                const eq = equipments.find(e => e.id === maint.equipmentId);
                const comp = companies.find(c => c.id === maint.companyId);

                return (
                  <div
                    key={maint.id}
                    className="bg-slate-950/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition shadow-md space-y-3"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-xl bg-purple-600/20 text-purple-300 font-mono font-black text-sm border border-purple-500/30">
                          OS #{maint.orderNumber}
                        </span>

                        <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-mono font-black text-xs border border-amber-500/40 flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5 text-amber-400" />
                          <span>{maint.patrimonio}</span>
                        </span>

                        {getMaintenanceTypeBadge(maint.type)}

                        {maint.coveredByPlan ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                            ✓ Coberto pelo Plano
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            Cobrança Avulsa
                          </span>
                        )}
                      </div>

                      {/* Status Dinâmico da Manutenção */}
                      <div className="flex items-center gap-2">
                        <span style={bStyle}>
                          {statusLabel}
                        </span>

                        {/* Botões rápidos de transição de status da OS */}
                        <div className="flex items-center gap-1">
                          {maint.status === 'aberta' && (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusChange(maint, 'analise')}
                              className="px-2 py-1 rounded bg-purple-900/40 hover:bg-purple-800/60 text-purple-300 text-[11px] font-semibold transition"
                              title="Passar para Em Análise"
                            >
                              Iniciar Análise →
                            </button>
                          )}
                          {maint.status === 'analise' && (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusChange(maint, 'manutencao')}
                              className="px-2 py-1 rounded bg-amber-900/40 hover:bg-amber-800/60 text-amber-300 text-[11px] font-semibold transition"
                              title="Passar para Na Bancada"
                            >
                              Bancada →
                            </button>
                          )}
                          {maint.status === 'manutencao' && (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusChange(maint, 'concluida')}
                              className="px-2 py-1 rounded bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 text-[11px] font-semibold transition"
                              title="Marcar como Concluída"
                            >
                              Concluir ✓
                            </button>
                          )}
                          {maint.status === 'concluida' && (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusChange(maint, 'entregue')}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition"
                              title="Marcar como Entregue à empresa"
                            >
                              Entregar →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Dados da Empresa & Equipamento */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs bg-slate-900/80 p-3 rounded-xl border border-slate-800/70">
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-bold">Empresa</span>
                        <strong className="text-white text-xs block truncate">
                          {comp?.tradeName || comp?.corporateName || maint.companyName}
                        </strong>
                        <span className="text-slate-400 text-[11px] block">
                          Setor: {maint.sector || eq?.sector || 'Geral'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-bold">Equipamento</span>
                        <strong className="text-slate-200 text-xs block truncate">
                          {maint.equipmentDescription}
                        </strong>
                        <span className="text-slate-400 text-[11px] block">
                          Usuário: {maint.responsibleUser || eq?.responsibleUser || 'Não atribuído'}
                        </span>
                      </div>

                      <div className="flex flex-col justify-between md:items-end">
                        <span className="text-[10px] text-slate-500 block uppercase font-bold">Datas & Técnico</span>
                        <div className="text-right">
                          <span className="text-slate-300 text-[11px] block">
                            Entrada: {maint.entryDate ? new Date(maint.entryDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                          </span>
                          <span className="text-slate-400 text-[10px] block">
                            Técnico: {maint.technicianName}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Defeito e Laudo Técnico */}
                    <div className="space-y-1.5 text-xs">
                      <div>
                        <span className="text-slate-400 font-semibold">Problema / Solicitação: </span>
                        <span className="text-slate-200">{maint.reportedIssue}</span>
                      </div>
                      {maint.technicalReport && (
                        <div>
                          <span className="text-emerald-400 font-semibold">Diagnóstico & Procedimentos: </span>
                          <span className="text-slate-300">{maint.technicalReport}</span>
                        </div>
                      )}
                    </div>

                    {/* Peças, Serviços e Totais */}
                    {maint.items && maint.items.length > 0 && (
                      <div className="border-t border-slate-800/80 pt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-500 text-[11px]">Itens:</span>
                          {maint.items.map((it, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300"
                            >
                              {it.quantity}x {it.description}
                            </span>
                          ))}
                        </div>

                        <div className="text-right">
                          <span className="text-slate-400 text-xs mr-2">Valor Total:</span>
                          <strong className="text-emerald-400 font-mono font-bold text-sm">
                            {maint.coveredByPlan ? 'R$ 0,00 (Plano)' : `R$ ${maint.total.toFixed(2)}`}
                          </strong>
                        </div>
                      </div>
                    )}

                    {/* Rodapé de Ações da Manutenção */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handlePrintDocument({ type: 'ordem_manutencao', maintenance: maint, equipment: eq, company: comp })}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition"
                          title="Imprimir Comprovante / Ordem de Manutenção"
                        >
                          <Printer className="w-3.5 h-3.5 text-blue-400" />
                          <span>Imprimir OS</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenMaintenanceModal(maint)}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition"
                          title="Editar Chamado / Ordem de Manutenção"
                        >
                          <Edit className="w-3.5 h-3.5 text-amber-400" />
                          <span>Editar</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteMaintenance(maint.id, maint.orderNumber)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition"
                        title="Excluir Manutenção"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 4: PLANOS DE MANUTENÇÃO CORPORATIVOS */}
      {/* ============================================================== */}
      {activeTab === 'planos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span>Planos de Manutenção & Contratos de TI</span>
                <span className="text-xs text-slate-400 font-normal">({plans.length} planos)</span>
              </h2>
              <p className="text-xs text-slate-400">
                Cadastre pacotes de suporte com SLAs, limites de máquinas cobertas e visitas periódicas.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleOpenPlanModal()}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>+ Criar Novo Plano</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map(pl => {
              const compCount = companies.filter(c => c.planId === pl.id && c.planStatus === 'ativo').length;
              return (
                <div
                  key={pl.id}
                  className="bg-slate-950/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 space-y-4 flex flex-col justify-between transition shadow-lg"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {pl.code && (
                          <span className="text-[10px] font-mono text-slate-500 font-bold block">{pl.code}</span>
                        )}
                        <h3 className="text-sm font-black text-white leading-snug">{pl.name}</h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {compCount} empresas
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Valor da Mensalidade</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs font-bold text-emerald-400">R$</span>
                        <span className="text-2xl font-black text-emerald-400">
                          {pl.monthlyFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs text-slate-400">/ {pl.billingCycle}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{pl.description}</p>

                    <div className="space-y-2 text-xs border-t border-slate-800/80 pt-3">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Tempo de Resposta (SLA):</span>
                        <strong className="text-white">Até {pl.slaHours || 24} horas</strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Limite de Máquinas:</span>
                        <strong className="text-white">
                          {pl.equipmentLimit && pl.equipmentLimit > 0 ? `Até ${pl.equipmentLimit} equipamentos` : 'Ilimitado'}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Visitas Preventivas:</span>
                        <strong className="text-white">{pl.preventiveVisitsPerMonth || 1} visita(s) / mês</strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Suporte Remoto:</span>
                        <strong className={pl.includesRemoteSupport ? 'text-emerald-400' : 'text-slate-500'}>
                          {pl.includesRemoteSupport ? 'Incluso Ilimitado' : 'Não incluso'}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Peças em Manutenções:</span>
                        <strong className={pl.includesParts ? 'text-emerald-400' : 'text-slate-400'}>
                          {pl.includesParts ? 'Inclusas no Plano' : 'Cobrança à parte'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => handleOpenPlanModal(pl)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition"
                    >
                      <Edit className="w-3.5 h-3.5 text-amber-400" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePlan(pl.id, pl.name)}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition"
                      title="Excluir Plano"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: VISUALIZAÇÃO DO PARQUE DA EMPRESA SELECIONADA */}
      {/* ============================================================== */}
      {selectedCompany && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedCompany(null); }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            {/* Cabeçalho */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white">
                    {selectedCompany.tradeName || selectedCompany.corporateName}
                  </h2>
                  <p className="text-xs text-slate-400">
                    CNPJ: {formatCNPJ(selectedCompany.cnpj)} • {selectedCompanyEquipments.length} máquinas no parque computacional
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintDocument({ type: 'relatorio_empresa', company: selectedCompany })}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-400" />
                  <span>Imprimir Relatório</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCompany(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Conteúdo do Parque */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {/* Barra com dados do plano e botão de cadastrar máquina */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Plano Contratado</span>
                    <strong className="text-white text-xs">
                      {selectedCompany.planName || 'Sem plano'} • R$ {(selectedCompany.planValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Vencimento</span>
                    <span className="text-slate-300 text-xs">Dia {selectedCompany.billingDay || 10}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenEquipmentModal(undefined, selectedCompany.id)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Adicionar Equipamento à Empresa</span>
                </button>
              </div>

              {selectedCompanyEquipments.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs space-y-2">
                  <Tag className="w-8 h-8 text-slate-600 mx-auto" />
                  <p>Nenhum equipamento cadastrado no parque desta empresa ainda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedCompanyEquipments.map(eq => {
                    const eqMaints = maintenances.filter(m => m.equipmentId === eq.id);
                    return (
                      <div
                        key={eq.id}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5 flex flex-col justify-between"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-black text-xs border border-amber-500/40">
                              {eq.patrimonio}
                            </span>
                            {getEquipmentStatusBadge(eq.status)}
                          </div>
                          <h4 className="text-xs font-bold text-white">
                            {eq.brand} {eq.model} ({eq.type})
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            Setor: <strong className="text-slate-300">{eq.sector || 'Geral'}</strong> {eq.location ? `• ${eq.location}` : ''}
                          </p>
                          {eq.responsibleUser && (
                            <p className="text-[11px] text-slate-400">
                              Usuário: <strong className="text-slate-300">{eq.responsibleUser}</strong>
                            </p>
                          )}
                          {eq.specifications && (
                            <p className="text-[10px] text-slate-500 line-clamp-1">{eq.specifications}</p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                          <button
                            type="button"
                            onClick={() => setSelectedEquipmentForHistory(eq)}
                            className="text-purple-400 hover:text-purple-300 font-semibold text-[11px] flex items-center gap-1"
                          >
                            <Clock className="w-3 h-3" />
                            <span>{eqMaints.length} Chamados (OS)</span>
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenMaintenanceModal(undefined, eq)}
                              className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded text-[11px] font-bold"
                            >
                              + Manutenção
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePrintDocument({ type: 'etiqueta_patrimonio', equipment: eq, company: selectedCompany })}
                              className="p-1 text-slate-400 hover:text-white"
                              title="Etiqueta"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEquipmentModal(eq)}
                              className="p-1 text-slate-400 hover:text-white"
                              title="Editar"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: HISTÓRICO DE MANUTENÇÕES DO EQUIPAMENTO (DINÂMICA DE OS) */}
      {/* ============================================================== */}
      {selectedEquipmentForHistory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedEquipmentForHistory(null); }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            {/* Cabeçalho */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 font-mono font-black text-sm border border-amber-500/40">
                  {selectedEquipmentForHistory.patrimonio}
                </span>
                <div>
                  <h2 className="text-base font-black text-white">
                    Histórico de Manutenções (OS) • {selectedEquipmentForHistory.brand} {selectedEquipmentForHistory.model}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Setor: {selectedEquipmentForHistory.sector || 'Geral'} • {selectedEquipmentMaintenances.length} chamados registrados
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenMaintenanceModal(undefined, selectedEquipmentForHistory)}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nova Manutenção (OS)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedEquipmentForHistory(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Lista de Manutenções do Equipamento */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {selectedEquipmentMaintenances.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs space-y-2">
                  <Wrench className="w-8 h-8 text-slate-600 mx-auto" />
                  <p>Este equipamento ainda não possui histórico de manutenções registradas.</p>
                </div>
              ) : (
                selectedEquipmentMaintenances.map(maint => {
                  const bStyle = getStatusBadgeStyle(maint.status, storeSettings?.statusColors);
                  const statusLabel = STATUS_LABELS[maint.status] || maint.status;
                  return (
                    <div
                      key={maint.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-purple-400">
                            OS #{maint.orderNumber}
                          </span>
                          {getMaintenanceTypeBadge(maint.type)}
                          <span className="text-xs text-slate-400">
                            {maint.entryDate ? new Date(maint.entryDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span style={bStyle}>{statusLabel}</span>
                          <button
                            type="button"
                            onClick={() => handlePrintDocument({ type: 'ordem_manutencao', maintenance: maint, equipment: selectedEquipmentForHistory })}
                            className="p-1 text-slate-400 hover:text-white"
                            title="Imprimir"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenMaintenanceModal(maint, selectedEquipmentForHistory)}
                            className="p-1 text-slate-400 hover:text-white"
                            title="Editar"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-xs space-y-1">
                        <p className="text-slate-200">
                          <strong className="text-slate-400">Problema: </strong>{maint.reportedIssue}
                        </p>
                        {maint.technicalReport && (
                          <p className="text-slate-300">
                            <strong className="text-emerald-400">Laudo Técnico: </strong>{maint.technicalReport}
                          </p>
                        )}
                      </div>

                      {maint.items && maint.items.length > 0 && (
                        <div className="text-xs border-t border-slate-800/80 pt-2 flex justify-between items-center text-slate-400">
                          <span>{maint.items.length} itens aplicados</span>
                          <span className="font-mono font-bold text-emerald-400">
                            {maint.coveredByPlan ? 'R$ 0,00 (Plano)' : `R$ ${maint.total.toFixed(2)}`}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CADASTRO / EDIÇÃO DE EMPRESA */}
      {/* ============================================================== */}
      {isCompanyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setIsCompanyModalOpen(false); }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span>{editingCompany ? 'Editar Cadastro da Empresa' : 'Cadastrar Nova Empresa (B2B)'}</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsCompanyModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              {/* CNPJ com Busca Automática */}
              <div>
                <label className="text-slate-300 font-bold block mb-1">
                  CNPJ da Empresa <span className="text-blue-400">(Preencha para buscar dados automaticamente na Receita)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={compCnpj}
                    onChange={(e) => setCompCnpj(e.target.value)}
                    onBlur={(e) => handleCnpjLookup(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleCnpjLookup(compCnpj)}
                    disabled={isSearchingCnpj}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition"
                  >
                    {isSearchingCnpj ? 'Buscando...' : 'Buscar CNPJ'}
                  </button>
                </div>
                {cnpjFeedback && (
                  <p className={`text-[11px] mt-1 font-semibold ${cnpjFeedback.type === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {cnpjFeedback.message}
                  </p>
                )}
              </div>

              {/* Razão Social e Nome Fantasia */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Razão Social *</label>
                  <input
                    type="text"
                    required
                    value={compCorporateName}
                    onChange={(e) => setCompCorporateName(e.target.value)}
                    placeholder="Nome oficial da empresa"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Nome Fantasia</label>
                  <input
                    type="text"
                    value={compTradeName}
                    onChange={(e) => setCompTradeName(e.target.value)}
                    placeholder="Nome comercial / Fantasia"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Contato Principal na Empresa */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Responsável / Contato *</label>
                  <input
                    type="text"
                    value={compContactName}
                    onChange={(e) => setCompContactName(e.target.value)}
                    placeholder="Nome do gestor de TI ou diretor"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Cargo / Departamento</label>
                  <input
                    type="text"
                    value={compContactRole}
                    onChange={(e) => setCompContactRole(e.target.value)}
                    placeholder="Ex: Gerente de TI, Administrativo"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">WhatsApp / Celular</label>
                  <input
                    type="text"
                    value={compWhatsapp}
                    onChange={(e) => setCompWhatsapp(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Email Corporativo</label>
                  <input
                    type="email"
                    value={compEmail}
                    onChange={(e) => setCompEmail(e.target.value)}
                    placeholder="contato@empresa.com.br"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Plano Contratado e Vencimento */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Plano de Manutenção</label>
                  <select
                    value={compPlanId}
                    onChange={(e) => {
                      const pid = e.target.value;
                      setCompPlanId(pid);
                      const pl = plans.find(p => p.id === pid);
                      if (pl) setCompPlanValue(pl.monthlyFee);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Sem plano vinculado</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (R$ {p.monthlyFee})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Valor Acordado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={compPlanValue}
                    onChange={(e) => setCompPlanValue(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Dia do Vencimento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={compBillingDay}
                    onChange={(e) => setCompBillingDay(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Endereço */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-slate-300 font-bold block mb-1">Endereço / Rua</label>
                  <input
                    type="text"
                    value={compStreet}
                    onChange={(e) => setCompStreet(e.target.value)}
                    placeholder="Rua, Avenida..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Número</label>
                  <input
                    type="text"
                    value={compNumber}
                    onChange={(e) => setCompNumber(e.target.value)}
                    placeholder="123 ou S/N"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Bairro</label>
                  <input
                    type="text"
                    value={compNeighborhood}
                    onChange={(e) => setCompNeighborhood(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Cidade</label>
                  <input
                    type="text"
                    value={compCity}
                    onChange={(e) => setCompCity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">UF / Estado</label>
                  <input
                    type="text"
                    value={compState}
                    onChange={(e) => setCompState(e.target.value)}
                    maxLength={2}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white uppercase focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Botões do Formulário */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCompanyModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-600/30"
                >
                  {editingCompany ? 'Salvar Alterações' : 'Cadastrar Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CADASTRO / EDIÇÃO DE EQUIPAMENTO (PATRIMÔNIO) */}
      {/* ============================================================== */}
      {isEquipmentModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setIsEquipmentModalOpen(false); }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-400" />
                <span>{editingEquipment ? 'Editar Equipamento / Patrimônio' : 'Cadastrar Novo Equipamento no Parque'}</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsEquipmentModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEquipment} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              {/* Empresa Proprietária */}
              <div>
                <label className="text-slate-300 font-bold block mb-1">Empresa Proprietária *</label>
                <select
                  required
                  value={eqCompanyId}
                  onChange={(e) => setEqCompanyId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Selecione a empresa...</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.tradeName || c.corporateName}</option>
                  ))}
                </select>
              </div>

              {/* Patrimônio (DESTAQUE) & Tipo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-amber-950/20 p-3 rounded-xl border border-amber-500/30">
                <div>
                  <label className="text-amber-300 font-black block mb-1 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-amber-400" />
                    <span>Nº de Patrimônio / Tombamento *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={eqPatrimonio}
                    onChange={(e) => setEqPatrimonio(e.target.value)}
                    placeholder="Ex: PAT-001, TI-042, NB-105"
                    className="w-full bg-slate-950 border border-amber-500/50 rounded-xl px-3 py-2 text-amber-300 font-mono font-black text-sm focus:outline-none focus:border-amber-400"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Identificação na plaqueta física do aparelho.</p>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Tipo de Equipamento</label>
                  <select
                    value={eqType}
                    onChange={(e) => setEqType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Computador">Computador / Desktop</option>
                    <option value="Notebook">Notebook</option>
                    <option value="Servidor">Servidor</option>
                    <option value="Impressora">Impressora</option>
                    <option value="Monitor">Monitor</option>
                    <option value="Rede">Roteador / Switch</option>
                    <option value="Nobreak">Nobreak</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>

              {/* Marca e Modelo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Marca</label>
                  <input
                    type="text"
                    value={eqBrand}
                    onChange={(e) => setEqBrand(e.target.value)}
                    placeholder="Ex: Dell, Lenovo, HP"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Modelo</label>
                  <input
                    type="text"
                    value={eqModel}
                    onChange={(e) => setEqModel(e.target.value)}
                    placeholder="Ex: Latitude 3420, OptiPlex 7090"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Setor, Sala e Usuário Responsável */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Setor / Departamento</label>
                  <input
                    type="text"
                    value={eqSector}
                    onChange={(e) => setEqSector(e.target.value)}
                    placeholder="Ex: Financeiro, TI"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Localização / Sala</label>
                  <input
                    type="text"
                    value={eqLocation}
                    onChange={(e) => setEqLocation(e.target.value)}
                    placeholder="Ex: Sala 03, Andar 2"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Usuário do Aparelho</label>
                  <input
                    type="text"
                    value={eqUser}
                    onChange={(e) => setEqUser(e.target.value)}
                    placeholder="Ex: Maria Souza"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Número de Série e Status Operacional */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Nº de Série / Service Tag</label>
                  <input
                    type="text"
                    value={eqSerial}
                    onChange={(e) => setEqSerial(e.target.value)}
                    placeholder="Ex: 5CD1234XYZ"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Status Operacional</label>
                  <select
                    value={eqStatus}
                    onChange={(e) => setEqStatus(e.target.value as EquipmentStatus)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="operacional">Operacional (Em Uso)</option>
                    <option value="em_manutencao">Em Manutenção</option>
                    <option value="reserva">Reserva Técnica (Backup)</option>
                    <option value="baixado">Baixado / Desativado</option>
                  </select>
                </div>
              </div>

              {/* Especificações Técnicas */}
              <div>
                <label className="text-slate-300 font-bold block mb-1">Especificações Técnicas (Hardware & SO)</label>
                <textarea
                  rows={2}
                  value={eqSpecs}
                  onChange={(e) => setEqSpecs(e.target.value)}
                  placeholder="Ex: Intel Core i7 11ª Gen, 16GB RAM DDR4, SSD NVMe 512GB, Windows 11 Pro 64 bits"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500 leading-relaxed"
                />
              </div>

              {/* Botões do Formulário */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEquipmentModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/30"
                >
                  {editingEquipment ? 'Salvar Alterações' : 'Cadastrar Equipamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CADASTRO / EDIÇÃO DE MANUTENÇÃO (MESMA DINÂMICA DA OS) */}
      {/* ============================================================== */}
      {isMaintenanceModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setIsMaintenanceModalOpen(false); }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-purple-400" />
                <span>
                  {editingMaintenance
                    ? `Editar Ordem de Manutenção #${editingMaintenance.orderNumber}`
                    : 'Abertura de Chamado / Manutenção (OS Corporativa)'}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => setIsMaintenanceModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMaintenance} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              {/* Seleção de Equipamento & Patrimônio */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Equipamento & Patrimônio *</label>
                  <select
                    required
                    value={maintEquipmentId}
                    onChange={(e) => {
                      const eqId = e.target.value;
                      setMaintEquipmentId(eqId);
                      const foundEq = equipments.find(x => x.id === eqId);
                      if (foundEq) {
                        setMaintPatrimonio(foundEq.patrimonio);
                        setMaintCompanyId(foundEq.companyId);
                        const comp = companies.find(c => c.id === foundEq.companyId);
                        setMaintCoveredByPlan(Boolean(comp?.planId));
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 font-medium"
                  >
                    <option value="">Selecione o equipamento...</option>
                    {equipments.map(e => (
                      <option key={e.id} value={e.id}>
                        [{e.patrimonio}] {e.brand} {e.model} ({e.companyName || 'Empresa'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Tipo de Manutenção</label>
                  <select
                    value={maintType}
                    onChange={(e) => setMaintType(e.target.value as MaintenanceType)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="preventiva">Preventiva (Coberta pelo Plano)</option>
                    <option value="corretiva">Corretiva (Reparo / Defeito)</option>
                    <option value="upgrade">Upgrade de Hardware / Peças</option>
                    <option value="instalacao">Instalação / Configuração</option>
                    <option value="suporte_remoto">Suporte Remoto</option>
                    <option value="visita_tecnica">Visita Técnica Presencial</option>
                  </select>
                </div>
              </div>

              {/* Status da OS e Cobertura do Plano */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-purple-950/15 p-3 rounded-xl border border-purple-500/30">
                <div>
                  <label className="text-purple-300 font-bold block mb-1">Status da Ordem de Serviço</label>
                  <select
                    value={maintStatus}
                    onChange={(e) => setMaintStatus(e.target.value as WorkOrderStatus)}
                    className="w-full bg-slate-950 border border-purple-500/40 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-purple-400"
                  >
                    <option value="aberta">Aberta</option>
                    <option value="analise">Em Análise</option>
                    <option value="orcamento">Em Orçamento</option>
                    <option value="aprovada">Aprovada</option>
                    <option value="manutencao">Na Bancada (Em Manutenção)</option>
                    <option value="aguardando_peca">Aguardando Peça</option>
                    <option value="concluida">Pronta Retirada / Concluída</option>
                    <option value="entregue">Entregue à Empresa</option>
                    <option value="sem_reparo">Sem Reparo</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={maintCoveredByPlan}
                      onChange={(e) => setMaintCoveredByPlan(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                  <div>
                    <span className="text-xs font-bold text-white block">Incluso no Plano da Empresa</span>
                    <span className="text-[10px] text-slate-400">Se ativo, zera o valor a ser faturado (R$ 0,00).</span>
                  </div>
                </div>
              </div>

              {/* Defeito Relatado / Solicitação */}
              <div>
                <label className="text-slate-300 font-bold block mb-1">Problema Relatado / Solicitação da Empresa *</label>
                <textarea
                  required
                  rows={2}
                  value={maintReportedIssue}
                  onChange={(e) => setMaintReportedIssue(e.target.value)}
                  placeholder="Descreva o defeito apresentado ou o checklist da visita preventiva..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 leading-relaxed"
                />
              </div>

              {/* Laudo Técnico e Procedimentos */}
              <div>
                <label className="text-slate-300 font-bold block mb-1">Laudo Técnico & Procedimentos Executados</label>
                <textarea
                  rows={2}
                  value={maintTechnicalReport}
                  onChange={(e) => setMaintTechnicalReport(e.target.value)}
                  placeholder="Diagnóstico constatado, testes efetuados e procedimentos de resolução..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 leading-relaxed"
                />
              </div>

              {/* Tabela de Peças e Serviços */}
              <div className="space-y-2 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-300 font-bold block text-xs">Peças & Serviços Utilizados</span>
                
                {/* Linha de Inserção de Item */}
                <div className="flex flex-col md:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Descrição da peça ou serviço (ex: SSD 480GB, Limpeza Técnica)..."
                    value={newItemDesc}
                    onChange={(e) => setNewItemDesc(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-white focus:outline-none"
                  />
                  <select
                    value={newItemType}
                    onChange={(e) => setNewItemType(e.target.value as 'peca' | 'servico')}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-white"
                  >
                    <option value="servico">Serviço</option>
                    <option value="peca">Peça</option>
                  </select>
                  <input
                    type="number"
                    min="1"
                    placeholder="Qtd"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(Number(e.target.value))}
                    className="w-16 bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-white text-center"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Valor R$"
                    value={newItemPrice || ''}
                    onChange={(e) => setNewItemPrice(Number(e.target.value))}
                    className="w-24 bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-emerald-400 font-mono font-bold text-right"
                  />
                  <button
                    type="button"
                    onClick={handleAddMaintItem}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition"
                  >
                    + Adicionar
                  </button>
                </div>

                {/* Lista de itens inseridos */}
                {maintItems.length > 0 && (
                  <div className="space-y-1 pt-2">
                    {maintItems.map(it => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-900 text-xs border border-slate-800/80"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${it.type === 'peca' ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'}`}>
                            {it.type === 'peca' ? 'Peça' : 'Serviço'}
                          </span>
                          <span className="text-white font-medium">{it.quantity}x {it.description}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-emerald-400">
                            R$ {it.total.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMaintItem(it.id)}
                            className="text-slate-400 hover:text-rose-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Técnico Responsável e Garantia */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Técnico Responsável</label>
                  <input
                    type="text"
                    value={maintTechnicianName}
                    onChange={(e) => setMaintTechnicianName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Garantia (Dias)</label>
                  <input
                    type="number"
                    value={maintWarrantyDays}
                    onChange={(e) => setMaintWarrantyDays(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Data de Entrada</label>
                  <input
                    type="date"
                    value={maintEntryDate}
                    onChange={(e) => setMaintEntryDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Botões do Formulário */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsMaintenanceModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold shadow-lg shadow-purple-600/30"
                >
                  {editingMaintenance ? 'Salvar Ordem' : 'Salvar Chamado de Manutenção'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CADASTRO / EDIÇÃO DE PLANO */}
      {/* ============================================================== */}
      {isPlanModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setIsPlanModalOpen(false); }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>{editingPlan ? 'Editar Plano Corporativo' : 'Criar Novo Plano Corporativo'}</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsPlanModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Nome do Plano *</label>
                <input
                  type="text"
                  required
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="Ex: Plano Ouro - Gestão de TI 24h"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Valor da Mensalidade (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={planMonthlyFee}
                    onChange={(e) => setPlanMonthlyFee(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Periodicidade de Cobrança</label>
                  <select
                    value={planBillingCycle}
                    onChange={(e) => setPlanBillingCycle(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="mensal">Mensal</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="semestral">Semestral</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Descrição Comercial do Plano</label>
                <textarea
                  rows={2}
                  value={planDesc}
                  onChange={(e) => setPlanDesc(e.target.value)}
                  placeholder="Resumo dos serviços e vantagens deste contrato..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">SLA Atendimento</label>
                  <input
                    type="number"
                    min="1"
                    value={planSlaHours}
                    onChange={(e) => setPlanSlaHours(Number(e.target.value))}
                    placeholder="Horas (ex: 8)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-center focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 block text-center mt-0.5">horas</span>
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Limite Máquinas</label>
                  <input
                    type="number"
                    min="0"
                    value={planEquipmentLimit}
                    onChange={(e) => setPlanEquipmentLimit(Number(e.target.value))}
                    placeholder="0 = ilimitado"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-center focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 block text-center mt-0.5">0 = ilimitado</span>
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Visitas Mensais</label>
                  <input
                    type="number"
                    min="0"
                    value={planPreventiveVisits}
                    onChange={(e) => setPlanPreventiveVisits(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-center focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 block text-center mt-0.5">preventivas</span>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={planIncludesRemote}
                    onChange={(e) => setPlanIncludesRemote(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700"
                  />
                  <span className="text-slate-200">Suporte Remoto Ilimitado em Horário Comercial</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={planIncludesParts}
                    onChange={(e) => setPlanIncludesParts(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700"
                  />
                  <span className="text-slate-200">Peças de Reparo Inclusas no Plano (Sem Custo Adicional)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold shadow-lg shadow-amber-500/20"
                >
                  {editingPlan ? 'Salvar Alterações' : 'Criar Plano'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL DE IMPRESSÃO: ETIQUETA DE PATRIMÔNIO / ORDEM / RELATÓRIO */}
      {/* ============================================================== */}
      {isPrintModalOpen && printDocument && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setIsPrintModalOpen(false); }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-4">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between no-print">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Printer className="w-4 h-4 text-blue-400" />
                <span>
                  {printDocument.type === 'etiqueta_patrimonio'
                    ? 'Etiqueta de Patrimônio do Equipamento'
                    : printDocument.type === 'ordem_manutencao'
                    ? 'Ordem de Manutenção / Laudo Técnico Corporativo'
                    : 'Relatório do Parque & Contrato da Empresa'}
                </span>
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Agora</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Conteúdo Imprimível */}
            <div className="p-6 bg-white text-black font-sans text-xs rounded-xl max-h-[75vh] overflow-y-auto space-y-4 shadow-inner">
              {/* ETIQUETA DE PATRIMÔNIO */}
              {printDocument.type === 'etiqueta_patrimonio' && printDocument.equipment && (
                <div className="border-4 border-black p-5 rounded-2xl max-w-sm mx-auto text-center space-y-3 bg-amber-50">
                  <div className="border-b-2 border-black pb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider block">
                      {storeSettings?.tradeName || 'ASSISTÊNCIA TÉCNICA & GESTÃO'}
                    </span>
                    <h3 className="text-xs font-bold uppercase truncate">
                      {printDocument.company?.tradeName || printDocument.company?.corporateName || 'CONTROLE DE PATRIMÔNIO'}
                    </h3>
                  </div>

                  <div className="py-2">
                    <span className="text-[10px] font-bold uppercase text-slate-700 block">Nº DE PATRIMÔNIO</span>
                    <span className="text-3xl font-black font-mono tracking-widest block text-black">
                      {printDocument.equipment.patrimonio}
                    </span>
                  </div>

                  <div className="text-left text-[11px] border-t-2 border-black pt-2 space-y-0.5">
                    <p><strong>Equipamento:</strong> {printDocument.equipment.brand} {printDocument.equipment.model}</p>
                    <p><strong>Setor:</strong> {printDocument.equipment.sector || 'Geral'}</p>
                    {printDocument.equipment.responsibleUser && (
                      <p><strong>Usuário:</strong> {printDocument.equipment.responsibleUser}</p>
                    )}
                    {printDocument.equipment.serialNumber && (
                      <p><strong>S/N:</strong> {printDocument.equipment.serialNumber}</p>
                    )}
                  </div>
                </div>
              )}

              {/* ORDEM DE MANUTENÇÃO CORPORATIVA */}
              {printDocument.type === 'ordem_manutencao' && printDocument.maintenance && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b-2 border-black pb-3">
                    <div>
                      <h2 className="text-base font-black uppercase">{storeSettings?.tradeName || 'POWER TECH'}</h2>
                      <p className="text-[10px] text-slate-600">{storeSettings?.phone || ''} • {storeSettings?.street || ''}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black font-mono block">OS #{printDocument.maintenance.orderNumber}</span>
                      <span className="text-[10px] font-bold uppercase">
                        {STATUS_LABELS[printDocument.maintenance.status] || printDocument.maintenance.status}
                      </span>
                    </div>
                  </div>

                  {/* Dados da Empresa e Patrimônio */}
                  <div className="grid grid-cols-2 gap-2 border border-black p-2.5 rounded-lg text-[11px]">
                    <div>
                      <p><strong>Empresa:</strong> {printDocument.maintenance.companyName}</p>
                      <p><strong>Patrimônio:</strong> <span className="font-mono font-black">{printDocument.maintenance.patrimonio}</span></p>
                      <p><strong>Equipamento:</strong> {printDocument.maintenance.equipmentDescription}</p>
                    </div>
                    <div>
                      <p><strong>Setor:</strong> {printDocument.maintenance.sector || '-'}</p>
                      <p><strong>Responsável:</strong> {printDocument.maintenance.responsibleUser || '-'}</p>
                      <p><strong>Data de Entrada:</strong> {printDocument.maintenance.entryDate ? new Date(printDocument.maintenance.entryDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</p>
                    </div>
                  </div>

                  {/* Laudo e Defeito */}
                  <div className="border border-black p-2.5 rounded-lg space-y-1 text-[11px]">
                    <p><strong>Problema Relatado / Solicitação:</strong></p>
                    <p className="text-slate-800">{printDocument.maintenance.reportedIssue}</p>
                    {printDocument.maintenance.technicalReport && (
                      <div className="pt-1.5 border-t border-slate-300">
                        <p><strong>Diagnóstico e Laudo Técnico:</strong></p>
                        <p className="text-slate-800">{printDocument.maintenance.technicalReport}</p>
                      </div>
                    )}
                  </div>

                  {/* Peças e Serviços */}
                  {printDocument.maintenance.items && printDocument.maintenance.items.length > 0 && (
                    <table className="w-full border-collapse border border-black text-[11px]">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-black p-1 text-left">Item / Serviço</th>
                          <th className="border border-black p-1 text-center w-12">Qtd</th>
                          <th className="border border-black p-1 text-right w-20">Unit. (R$)</th>
                          <th className="border border-black p-1 text-right w-20">Total (R$)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {printDocument.maintenance.items.map((it, i) => (
                          <tr key={i}>
                            <td className="border border-black p-1">{it.description}</td>
                            <td className="border border-black p-1 text-center">{it.quantity}</td>
                            <td className="border border-black p-1 text-right">{it.unitPrice.toFixed(2)}</td>
                            <td className="border border-black p-1 text-right">{it.total.toFixed(2)}</td>
                          </tr>
                        ))}
                        <tr className="font-bold bg-slate-100">
                          <td colSpan={3} className="border border-black p-1 text-right">TOTAL:</td>
                          <td className="border border-black p-1 text-right">
                            {printDocument.maintenance.coveredByPlan ? 'R$ 0,00 (Plano)' : `R$ ${printDocument.maintenance.total.toFixed(2)}`}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  )}

                  {/* Assinaturas */}
                  <div className="grid grid-cols-2 gap-8 pt-8 text-center text-[10px]">
                    <div>
                      <div className="border-t border-black pt-1">
                        <strong>{printDocument.maintenance.technicianName}</strong>
                        <p>Técnico Responsável</p>
                      </div>
                    </div>
                    <div>
                      <div className="border-t border-black pt-1">
                        <strong>{printDocument.maintenance.companyName}</strong>
                        <p>Visto da Empresa / Responsável</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* RELATÓRIO DO PARQUE DA EMPRESA */}
              {printDocument.type === 'relatorio_empresa' && printDocument.company && (
                <div className="space-y-4">
                  <div className="border-b-2 border-black pb-2 flex justify-between items-center">
                    <div>
                      <h2 className="text-base font-black uppercase">
                        {printDocument.company.tradeName || printDocument.company.corporateName}
                      </h2>
                      <p className="text-[10px] text-slate-600">CNPJ: {formatCNPJ(printDocument.company.cnpj)}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold block">Relatório do Parque & Contrato de TI</span>
                      <span className="text-[10px] text-slate-500">Emitido em: {new Date().toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>

                  <div className="border border-black p-2.5 rounded-lg text-[11px] grid grid-cols-2 gap-2">
                    <div>
                      <p><strong>Plano Contratado:</strong> {printDocument.company.planName || 'Sem plano'}</p>
                      <p><strong>Status do Contrato:</strong> {printDocument.company.planStatus?.toUpperCase()}</p>
                    </div>
                    <div>
                      <p><strong>Mensalidade:</strong> R$ {(printDocument.company.planValue || 0).toFixed(2)}</p>
                      <p><strong>Dia do Vencimento:</strong> Todo dia {printDocument.company.billingDay || 10}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-xs uppercase mb-1">Equipamentos Cadastrados no Parque:</h3>
                    <table className="w-full border-collapse border border-black text-[10px]">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-black p-1 text-center w-20">Patrimônio</th>
                          <th className="border border-black p-1 text-left">Equipamento</th>
                          <th className="border border-black p-1 text-left">Setor / Local</th>
                          <th className="border border-black p-1 text-left">Usuário</th>
                          <th className="border border-black p-1 text-center w-20">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {equipments.filter(e => e.companyId === printDocument.company?.id).map((eq, i) => (
                          <tr key={i}>
                            <td className="border border-black p-1 text-center font-mono font-bold">{eq.patrimonio}</td>
                            <td className="border border-black p-1">{eq.brand} {eq.model} ({eq.type})</td>
                            <td className="border border-black p-1">{eq.sector || 'Geral'}</td>
                            <td className="border border-black p-1">{eq.responsibleUser || '-'}</td>
                            <td className="border border-black p-1 text-center uppercase">{eq.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SENHA DO ADMINISTRADOR PARA EXCLUSÕES */}
      <AdminPasswordModal {...adminModalProps} />
    </div>
  );
};
