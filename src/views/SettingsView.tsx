import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Store,
  ShieldCheck,
  Printer,
  CheckCircle2,
  Search,
  Loader2,
  AlertCircle,
  Palette,
  Type,
  Sliders,
  Sun,
  Moon,
  Layers,
  Sparkles,
  Check,
  Globe,
  Cloud,
  ExternalLink,
  RefreshCw,
  Copy,
  UserCog,
  Users,
  UserPlus,
  Lock,
  KeyRound,
  Shield,
  Trash2,
  Edit,
  X,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  BadgeDollarSign,
  Briefcase,
  Phone,
  Percent,
  Image as ImageIcon,
  Plus,
  Minus,
  RotateCcw,
  Wrench,
  Laptop,
  Calendar,
  ShoppingCart,
  Tag,
  DollarSign,
  MessageSquare,
  PlusCircle,
  CreditCard,
  TrendingDown,
  Utensils,
  Fuel,
  Receipt,
  Droplets,
  Zap,
  Wifi,
  FileText,
  FileDown,
  Folder,
  Building2,
  ShoppingBag,
  Star
} from 'lucide-react';
import {
  StoreSettings,
  ThemeMode,
  FontFamily,
  FontSizeText,
  FontSizeHeading,
  FontSizeFooter,
  AuthUser,
  SystemUser,
  UserPermissions,
  DEFAULT_ADMIN_PERMISSIONS,
  DEFAULT_OPERATOR_PERMISSIONS,
  Seller,
  ExpenseCategoryDef
} from '../types';
import { DEFAULT_EXPENSE_CATEGORIES, resolveCategoryIcon } from './ExpensesView';
import { DEFAULT_OS_READY_MESSAGE, DEFAULT_OS_DELIVERED_MESSAGE, DEFAULT_POS_SALE_MESSAGE, DEFAULT_POS_REVIEW_MESSAGE, DEFAULT_OS_REVIEW_MESSAGE } from '../services/whatsapp';
import { lookupCNPJ, formatCNPJ, cleanDigits } from '../services/cnpj';
import { api, setAuthToken } from '../services/api';
import {
  applyVisualCustomizations,
  COLOR_PALETTES,
  DEFAULT_VISUAL_OPTIONS,
  VisualCustomizationOptions,
  DEFAULT_STATUS_COLORS,
  STATUS_LIST,
  getStatusBadgeStyle
} from '../utils/themeCustomizer';
import { AdminPasswordModal, useAdminPasswordModal } from '../components/AdminPasswordModal';

export type SettingsModuleTab =
  | 'pdv'
  | 'os'
  | 'gastos'
  | 'usuarios'
  | 'vendedores'
  | 'layout'
  | 'loja';

interface SettingsViewProps {
  settings: StoreSettings;
  onSaveSettings: (settings: Partial<StoreSettings>) => Promise<void>;
  onLivePreviewSettings?: (preview: Partial<StoreSettings>) => void;
  currentUser?: AuthUser | null;
  onUpdateCurrentUser?: (user: AuthUser) => void;
  sellers?: Seller[];
  onSaveSeller?: (seller: Partial<Seller>) => Promise<void>;
  onDeleteSeller?: (id: string, adminPassword?: string) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onLivePreviewSettings,
  currentUser,
  onUpdateCurrentUser,
  sellers = [],
  onSaveSeller,
  onDeleteSeller
}) => {
  // Confirmação de Senha do Administrador
  const { requestConfirmation: requestAdminConfirmation, modalProps: adminModalProps } = useAdminPasswordModal();

  // Controle de Abas Modulares de Configurações
  const [activeTab, setActiveTab] = useState<SettingsModuleTab>(() => {
    try {
      const saved = localStorage.getItem('powertech_settings_active_tab') as SettingsModuleTab;
      if (saved && ['pdv', 'os', 'gastos', 'usuarios', 'vendedores', 'layout', 'loja'].includes(saved)) {
        return saved;
      }
    } catch (e) {
      // ignore
    }
    return 'pdv';
  });

  const handleTabChange = (tab: SettingsModuleTab) => {
    setActiveTab(tab);
    try {
      localStorage.setItem('powertech_settings_active_tab', tab);
    } catch (e) {
      // ignore
    }
  };

  const [formData, setFormData] = useState<StoreSettings>({
    ...settings,
    themeMode: settings.themeMode || (localStorage.getItem('powertech_theme') as ThemeMode) || 'escuro',
    fontFamily: settings.fontFamily || (localStorage.getItem('powertech_font_family') as FontFamily) || 'system',
    fontSizeText: settings.fontSizeText || (localStorage.getItem('powertech_font_size_text') as FontSizeText) || 'padrao',
    fontSizeHeading: settings.fontSizeHeading || (localStorage.getItem('powertech_font_size_heading') as FontSizeHeading) || 'padrao',
    fontSizeFooter: settings.fontSizeFooter || (localStorage.getItem('powertech_font_size_footer') as FontSizeFooter) || 'padrao',
    systemUrl: settings.systemUrl || '',
    publicTrackingUrl: settings.publicTrackingUrl || '',
    dashboardLogoSize:
      settings.dashboardLogoSize ??
      Number(localStorage.getItem('powertech_logo_size') || DEFAULT_VISUAL_OPTIONS.dashboardLogoSize),
    storeNameFontSize:
      settings.storeNameFontSize ??
      Number(localStorage.getItem('powertech_store_name_size') || DEFAULT_VISUAL_OPTIONS.storeNameFontSize),
    storeNameColor:
      settings.storeNameColor ||
      localStorage.getItem('powertech_store_name_color') ||
      DEFAULT_VISUAL_OPTIONS.storeNameColor,
    selectionTabFontSize:
      settings.selectionTabFontSize ??
      Number(localStorage.getItem('powertech_tab_font_size') || DEFAULT_VISUAL_OPTIONS.selectionTabFontSize),
    selectionTabActiveColor:
      settings.selectionTabActiveColor ||
      localStorage.getItem('powertech_tab_active_color') ||
      DEFAULT_VISUAL_OPTIONS.selectionTabActiveColor,
    selectionTabTextColor:
      settings.selectionTabTextColor ||
      localStorage.getItem('powertech_tab_text_color') ||
      DEFAULT_VISUAL_OPTIONS.selectionTabTextColor,
    iconSizeGeneral:
      settings.iconSizeGeneral ??
      Number(localStorage.getItem('powertech_icon_size') || DEFAULT_VISUAL_OPTIONS.iconSizeGeneral),
    iconColorGeneral:
      settings.iconColorGeneral ??
      (localStorage.getItem('powertech_icon_color') || ''),
    badgeFontSize:
      settings.badgeFontSize ??
      Number(localStorage.getItem('powertech_badge_font_size') || DEFAULT_VISUAL_OPTIONS.badgeFontSize),
    badgePadding:
      settings.badgePadding ||
      (localStorage.getItem('powertech_badge_padding') as any) ||
      DEFAULT_VISUAL_OPTIONS.badgePadding,
    priceHighlightColor:
      settings.priceHighlightColor ||
      localStorage.getItem('powertech_price_color') ||
      DEFAULT_VISUAL_OPTIONS.priceHighlightColor,
    primaryColor:
      settings.primaryColor ||
      localStorage.getItem('powertech_primary_color') ||
      DEFAULT_VISUAL_OPTIONS.primaryColor,
    customerNameFontSize:
      settings.customerNameFontSize ??
      Number(localStorage.getItem('powertech_customer_name_size') || DEFAULT_VISUAL_OPTIONS.customerNameFontSize),
    customerNameColor:
      settings.customerNameColor ||
      localStorage.getItem('powertech_customer_name_color') ||
      DEFAULT_VISUAL_OPTIONS.customerNameColor,
    osNumberFontSize:
      settings.osNumberFontSize ??
      Number(localStorage.getItem('powertech_os_number_size') || DEFAULT_VISUAL_OPTIONS.osNumberFontSize),
    osNumberColor:
      settings.osNumberColor ||
      localStorage.getItem('powertech_os_number_color') ||
      DEFAULT_VISUAL_OPTIONS.osNumberColor,
    actionIconSize:
      settings.actionIconSize ??
      Number(localStorage.getItem('powertech_action_icon_size') || DEFAULT_VISUAL_OPTIONS.actionIconSize),
    statusColors: {
      ...DEFAULT_STATUS_COLORS,
      ...(settings.statusColors || {})
    },
    osReadyMessageEnabled: settings.osReadyMessageEnabled ?? true,
    osReadyMessageTemplate: settings.osReadyMessageTemplate ?? DEFAULT_OS_READY_MESSAGE,
    osDeliveredMessageEnabled: settings.osDeliveredMessageEnabled ?? false,
    osDeliveredMessageTemplate: settings.osDeliveredMessageTemplate ?? DEFAULT_OS_DELIVERED_MESSAGE,
    osReviewMessageEnabled: settings.osReviewMessageEnabled ?? true,
    osReviewMessageTemplate: settings.osReviewMessageTemplate ?? DEFAULT_OS_REVIEW_MESSAGE,
    posSaleMessageEnabled: settings.posSaleMessageEnabled ?? false,
    posSaleMessageTemplate: settings.posSaleMessageTemplate ?? DEFAULT_POS_SALE_MESSAGE,
    posReviewMessageEnabled: settings.posReviewMessageEnabled ?? true,
    posReviewMessageTemplate: settings.posReviewMessageTemplate ?? DEFAULT_POS_REVIEW_MESSAGE,
    googleReviewUrl: settings.googleReviewUrl || '',
    autoSendPdfWhatsApp: settings.autoSendPdfWhatsApp ?? true,
    posAutoSendPdfWhatsApp: settings.posAutoSendPdfWhatsApp ?? true,
    osAutoSendPdfWhatsApp: settings.osAutoSendPdfWhatsApp ?? true,
    documentsDirectory: settings.documentsDirectory || 'C:\\InfoTech_Documentos'
  });

  const updateVisualField = <K extends keyof StoreSettings>(field: K, value: StoreSettings[K]) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      applyVisualCustomizations(updated);
      onLivePreviewSettings?.(updated);
      return updated;
    });
  };

  const adjustNumericVisual = (
    field:
      | 'dashboardLogoSize'
      | 'storeNameFontSize'
      | 'selectionTabFontSize'
      | 'iconSizeGeneral'
      | 'badgeFontSize'
      | 'customerNameFontSize'
      | 'osNumberFontSize'
      | 'actionIconSize',
    delta: number,
    minVal: number,
    maxVal: number
  ) => {
    setFormData((prev) => {
      const current = Number(prev[field]) || (DEFAULT_VISUAL_OPTIONS[field as keyof VisualCustomizationOptions] as number);
      const next = Math.max(minVal, Math.min(maxVal, current + delta));
      const updated = { ...prev, [field]: next };
      applyVisualCustomizations(updated);
      onLivePreviewSettings?.(updated);
      return updated;
    });
  };

  const updateStatusColor = (statusKey: string, colorHex: string) => {
    setFormData((prev) => {
      const updatedColors = {
        ...(prev.statusColors || DEFAULT_STATUS_COLORS),
        [statusKey]: colorHex
      };
      const updated = { ...prev, statusColors: updatedColors };
      applyVisualCustomizations(updated);
      onLivePreviewSettings?.(updated);
      return updated;
    });
  };

  const handleResetStatusColor = (statusKey: string) => {
    const defaultColor = DEFAULT_STATUS_COLORS[statusKey] || '#64748b';
    updateStatusColor(statusKey, defaultColor);
  };

  const handleResetAllStatusColors = () => {
    setFormData((prev) => {
      const updated = { ...prev, statusColors: { ...DEFAULT_STATUS_COLORS } };
      applyVisualCustomizations(updated);
      onLivePreviewSettings?.(updated);
      return updated;
    });
  };

  const handleResetVisualDefaults = () => {
    if (window.confirm('Deseja restaurar todos os tamanhos, fontes, logo e cores visuais para os padrões de fábrica?')) {
      setFormData((prev) => {
        const updated = {
          ...prev,
          ...DEFAULT_VISUAL_OPTIONS
        };
        applyVisualCustomizations(updated);
        onLivePreviewSettings?.(updated);
        return updated;
      });
    }
  };
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isSearchingCnpj, setIsSearchingCnpj] = useState<boolean>(false);
  const [cnpjFeedback, setCnpjFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleThemeModeChange = (mode: ThemeMode) => {
    setFormData((prev) => ({ ...prev, themeMode: mode }));
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('powertech_theme', mode);
    onLivePreviewSettings?.({ ...formData, themeMode: mode });
  };

  const handleFontFamilyChange = (font: FontFamily) => {
    setFormData((prev) => ({ ...prev, fontFamily: font }));
    document.documentElement.setAttribute('data-font', font);
    localStorage.setItem('powertech_font_family', font);
    onLivePreviewSettings?.({ ...formData, fontFamily: font });
  };

  const handleFontSizeTextChange = (size: FontSizeText) => {
    setFormData((prev) => ({ ...prev, fontSizeText: size }));
    document.documentElement.setAttribute('data-font-size-text', size);
    localStorage.setItem('powertech_font_size_text', size);
    onLivePreviewSettings?.({ ...formData, fontSizeText: size });
  };

  const handleFontSizeHeadingChange = (size: FontSizeHeading) => {
    setFormData((prev) => ({ ...prev, fontSizeHeading: size }));
    document.documentElement.setAttribute('data-font-size-heading', size);
    localStorage.setItem('powertech_font_size_heading', size);
    onLivePreviewSettings?.({ ...formData, fontSizeHeading: size });
  };

  const handleFontSizeFooterChange = (size: FontSizeFooter) => {
    setFormData((prev) => ({ ...prev, fontSizeFooter: size }));
    document.documentElement.setAttribute('data-font-size-footer', size);
    localStorage.setItem('powertech_font_size_footer', size);
    onLivePreviewSettings?.({ ...formData, fontSizeFooter: size });
  };

  const performCnpjLookup = async (digits: string) => {
    setIsSearchingCnpj(true);
    setCnpjFeedback({ type: 'info', message: 'Consultando Receita Federal...' });
    try {
      const data = await lookupCNPJ(digits);
      if (data) {
        setFormData((prev) => ({
          ...prev,
          storeName: data.razaoSocial || prev.storeName,
          tradeName: data.nomeFantasia || prev.tradeName || data.razaoSocial || prev.storeName,
          phone: data.phone || prev.phone,
          street: data.street || prev.street,
          number: data.number || prev.number,
          neighborhood: data.neighborhood || prev.neighborhood,
          city: data.city || prev.city,
          state: data.state || prev.state,
          cep: data.cep ? data.cep.replace(/\D/g, '') : prev.cep,
          email: data.email || prev.email,
          ie: data.stateRegistration || prev.ie
        }));
        setCnpjFeedback({
          type: 'success',
          message: `Dados preenchidos com sucesso: ${data.razaoSocial}`
        });
      } else {
        setCnpjFeedback({
          type: 'error',
          message: 'CNPJ não encontrado na base pública. Preencha manualmente.'
        });
      }
    } catch (err: any) {
      setCnpjFeedback({
        type: 'error',
        message: err.message || 'Erro ao consultar CNPJ. Preencha manualmente.'
      });
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNPJ(e.target.value);
    setFormData({ ...formData, cnpj: formatted });
    const clean = cleanDigits(formatted);
    if (clean.length === 14) {
      performCnpjLookup(clean);
    } else {
      setCnpjFeedback(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formatted: StoreSettings = {
      ...formData,
      storeName: formData.storeName.trim().toUpperCase(),
      tradeName: (formData.tradeName || '').trim().toUpperCase(),
      street: (formData.street || '').trim().toUpperCase(),
      neighborhood: (formData.neighborhood || '').trim().toUpperCase(),
      city: (formData.city || '').trim().toUpperCase(),
      state: (formData.state || '').trim().toUpperCase(),
      systemUrl: (formData.systemUrl || '').trim(),
      publicTrackingUrl: (formData.publicTrackingUrl || '').trim(),
      themeMode: formData.themeMode || 'escuro',
      fontFamily: formData.fontFamily || 'system',
      fontSizeText: formData.fontSizeText || 'padrao',
      fontSizeHeading: formData.fontSizeHeading || 'padrao',
      fontSizeFooter: formData.fontSizeFooter || 'padrao',
      dashboardLogoSize: Number(formData.dashboardLogoSize) || DEFAULT_VISUAL_OPTIONS.dashboardLogoSize,
      storeNameFontSize: Number(formData.storeNameFontSize) || DEFAULT_VISUAL_OPTIONS.storeNameFontSize,
      storeNameColor: formData.storeNameColor || DEFAULT_VISUAL_OPTIONS.storeNameColor,
      selectionTabFontSize: Number(formData.selectionTabFontSize) || DEFAULT_VISUAL_OPTIONS.selectionTabFontSize,
      selectionTabActiveColor: formData.selectionTabActiveColor || DEFAULT_VISUAL_OPTIONS.selectionTabActiveColor,
      selectionTabTextColor: formData.selectionTabTextColor || DEFAULT_VISUAL_OPTIONS.selectionTabTextColor,
      iconSizeGeneral: Number(formData.iconSizeGeneral) || DEFAULT_VISUAL_OPTIONS.iconSizeGeneral,
      iconColorGeneral: formData.iconColorGeneral || '',
      badgeFontSize: Number(formData.badgeFontSize) || DEFAULT_VISUAL_OPTIONS.badgeFontSize,
      badgePadding: formData.badgePadding || DEFAULT_VISUAL_OPTIONS.badgePadding,
      priceHighlightColor: formData.priceHighlightColor || DEFAULT_VISUAL_OPTIONS.priceHighlightColor,
      primaryColor: formData.primaryColor || DEFAULT_VISUAL_OPTIONS.primaryColor,
      customerNameFontSize: Number(formData.customerNameFontSize) || DEFAULT_VISUAL_OPTIONS.customerNameFontSize,
      customerNameColor: formData.customerNameColor || DEFAULT_VISUAL_OPTIONS.customerNameColor,
      osNumberFontSize: Number(formData.osNumberFontSize) || DEFAULT_VISUAL_OPTIONS.osNumberFontSize,
      osNumberColor: formData.osNumberColor || DEFAULT_VISUAL_OPTIONS.osNumberColor,
      actionIconSize: Number(formData.actionIconSize) || DEFAULT_VISUAL_OPTIONS.actionIconSize,
      statusColors: formData.statusColors || DEFAULT_STATUS_COLORS
    };
    await onSaveSettings(formatted);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // ==========================================
  // CREDENCIAIS DO ADMINISTRADOR
  // ==========================================
  const [adminName, setAdminName] = useState<string>(currentUser?.name || '');
  const [adminUsername, setAdminUsername] = useState<string>(currentUser?.username || '');
  const [adminCurrentPassword, setAdminCurrentPassword] = useState<string>('');
  const [adminNewPassword, setAdminNewPassword] = useState<string>('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState<string>('');
  const [showAdminCurrentPass, setShowAdminCurrentPass] = useState<boolean>(false);
  const [showAdminNewPass, setShowAdminNewPass] = useState<boolean>(false);
  const [adminLoading, setAdminLoading] = useState<boolean>(false);
  const [adminFeedback, setAdminFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (currentUser) {
      setAdminName(currentUser.name || '');
      setAdminUsername(currentUser.username || '');
    }
  }, [currentUser]);

  const handleSaveAdminCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminFeedback(null);

    if (!adminName.trim() || !adminUsername.trim()) {
      setAdminFeedback({ type: 'error', message: 'Nome e Usuário de Login são obrigatórios.' });
      return;
    }

    if (adminNewPassword) {
      if (adminNewPassword.length < 4) {
        setAdminFeedback({ type: 'error', message: 'A nova senha deve ter no mínimo 4 caracteres.' });
        return;
      }
      if (adminNewPassword !== adminConfirmPassword) {
        setAdminFeedback({ type: 'error', message: 'A confirmação de senha não confere.' });
        return;
      }
      if (!adminCurrentPassword) {
        setAdminFeedback({ type: 'error', message: 'Informe a senha atual para autorizar a troca de senha.' });
        return;
      }
    }

    setAdminLoading(true);
    try {
      const payload: any = {
        name: adminName.trim(),
        username: adminUsername.trim()
      };
      if (adminNewPassword) {
        payload.currentPassword = adminCurrentPassword;
        payload.newPassword = adminNewPassword;
      }

      const res = await api.updateProfile(payload);
      if (res.user && onUpdateCurrentUser) {
        onUpdateCurrentUser(res.user);
      }
      if (res.token) {
        setAuthToken(res.token);
      }

      setAdminFeedback({ type: 'success', message: 'Credenciais do Administrador atualizadas com sucesso!' });
      setAdminCurrentPassword('');
      setAdminNewPassword('');
      setAdminConfirmPassword('');
    } catch (err: any) {
      setAdminFeedback({
        type: 'error',
        message: err.response?.data?.error || err.message || 'Erro ao atualizar credenciais do Administrador.'
      });
    } finally {
      setAdminLoading(false);
    }
  };

  // ==========================================
  // GESTÃO DE USUÁRIOS E PERMISSÕES
  // ==========================================
  const [usersList, setUsersList] = useState<SystemUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [userListFeedback, setUserListFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [userModalOpen, setUserModalOpen] = useState<boolean>(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [savingUser, setSavingUser] = useState<boolean>(false);
  const [userModalFeedback, setUserModalFeedback] = useState<string | null>(null);

  const [userFormData, setUserFormData] = useState<{
    name: string;
    username: string;
    password: string;
    role: 'admin' | 'operador';
    active: boolean;
    permissions: UserPermissions;
  }>({
    name: '',
    username: '',
    password: '',
    role: 'operador',
    active: true,
    permissions: { ...DEFAULT_OPERATOR_PERMISSIONS }
  });

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.getUsers();
      setUsersList(res.users || []);
    } catch (err: any) {
      console.error('Erro ao buscar lista de usuários:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      fetchUsers();
    }
  }, [currentUser]);

  const handleOpenNewUser = () => {
    setEditingUserId(null);
    setUserFormData({
      name: '',
      username: '',
      password: '',
      role: 'operador',
      active: true,
      permissions: { ...DEFAULT_OPERATOR_PERMISSIONS }
    });
    setUserModalFeedback(null);
    setUserModalOpen(true);
  };

  const handleOpenEditUser = (u: SystemUser) => {
    setEditingUserId(u.id);
    setUserFormData({
      name: u.name,
      username: u.username,
      password: '',
      role: u.role,
      active: u.active !== false,
      permissions: {
        ...(u.role === 'admin' ? DEFAULT_ADMIN_PERMISSIONS : DEFAULT_OPERATOR_PERMISSIONS),
        ...(u.permissions || {})
      }
    });
    setUserModalFeedback(null);
    setUserModalOpen(true);
  };

  const handleApplyPermissionPreset = (preset: 'admin' | 'balcao' | 'tecnico') => {
    if (preset === 'admin') {
      setUserFormData((prev) => ({
        ...prev,
        role: 'admin',
        permissions: { ...DEFAULT_ADMIN_PERMISSIONS }
      }));
    } else if (preset === 'balcao') {
      setUserFormData((prev) => ({
        ...prev,
        role: 'operador',
        permissions: {
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
          reports: true
        }
      }));
    } else if (preset === 'tecnico') {
      setUserFormData((prev) => ({
        ...prev,
        role: 'operador',
        permissions: {
          dashboard: true,
          workOrders: true,
          workOrdersDelete: false,
          pos: false,
          quotes: true,
          inventory: false,
          services: true,
          customers: true,
          fiscal: false,
          backup: false,
          settings: false,
          reports: false
        }
      }));
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserModalFeedback(null);

    if (!userFormData.name.trim() || !userFormData.username.trim()) {
      setUserModalFeedback('Nome e Usuário de Login são obrigatórios.');
      return;
    }

    if (!editingUserId && (!userFormData.password || userFormData.password.length < 6)) {
      setUserModalFeedback('Para novo usuário, a senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (editingUserId && userFormData.password && userFormData.password.length < 6) {
      setUserModalFeedback('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setSavingUser(true);
    try {
      const payload: any = {
        name: userFormData.name.trim(),
        username: userFormData.username.trim(),
        role: userFormData.role,
        active: userFormData.active,
        permissions: userFormData.role === 'admin' ? DEFAULT_ADMIN_PERMISSIONS : userFormData.permissions
      };
      if (userFormData.password) {
        payload.password = userFormData.password;
      }

      if (editingUserId) {
        await api.updateUser(editingUserId, payload);
        setUserListFeedback({ type: 'success', message: 'Usuário atualizado com sucesso!' });
      } else {
        await api.createUser(payload);
        setUserListFeedback({ type: 'success', message: 'Novo usuário cadastrado com sucesso!' });
      }

      setUserModalOpen(false);
      await fetchUsers();
      setTimeout(() => setUserListFeedback(null), 4000);
    } catch (err: any) {
      setUserModalFeedback(
        err.response?.data?.error || err.message || 'Erro ao salvar dados do usuário.'
      );
    } finally {
      setSavingUser(false);
    }
  };

  const handleToggleUserActive = async (u: SystemUser) => {
    if (u.id === currentUser?.id) {
      alert('Você não pode desativar seu próprio usuário em uso.');
      return;
    }
    const newActive = u.active === false;
    try {
      await api.updateUser(u.id, { active: newActive });
      setUserListFeedback({
        type: 'success',
        message: `Usuário "${u.name}" ${newActive ? 'ativado' : 'desativado'} com sucesso.`
      });
      await fetchUsers();
      setTimeout(() => setUserListFeedback(null), 3000);
    } catch (err: any) {
      setUserListFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Erro ao alterar status do usuário.'
      });
    }
  };

  const handleDeleteUser = (u: SystemUser) => {
    if (u.id === currentUser?.id) {
      alert('Você não pode excluir sua própria conta enquanto estiver conectado.');
      return;
    }
    requestAdminConfirmation({
      title: 'Excluir Usuário do Sistema',
      itemDescription: `Usuário "${u.name}" (Login: ${u.username})`,
      actionType: 'delete',
      onConfirm: async (adminPassword) => {
        try {
          await api.deleteUser(u.id, adminPassword);
          setUserListFeedback({
            type: 'success',
            message: `Usuário "${u.name}" excluído com sucesso.`
          });
          await fetchUsers();
          setTimeout(() => setUserListFeedback(null), 3000);
        } catch (err: any) {
          setUserListFeedback({
            type: 'error',
            message: err.message || err.response?.data?.error || 'Erro ao excluir usuário.'
          });
        }
      }
    });
  };

  const permissionModulesList = [
    { key: 'dashboard', label: 'Painel Geral & Métricas', desc: 'Visualizar faturamento, resumos e indicadores da loja', icon: '📊' },
    { key: 'reports', label: 'Relatórios de Vendas & OS', desc: 'Acesso aos relatórios de faturamento geral e por vendedor', icon: '📈' },
    { key: 'workOrders', label: 'Ordens de Serviço (OS)', desc: 'Visualizar, abrir, emitir laudos e editar OS', icon: '🛠️' },
    { key: 'workOrdersDelete', label: 'Excluir Ordens de Serviço', desc: 'Permissão para apagar registros de OS do banco', icon: '🗑️' },
    { key: 'pos', label: 'Frente de Caixa (PDV)', desc: 'Realizar vendas rápidas e emitir comprovantes', icon: '🛒' },
    { key: 'quotes', label: 'Orçamentos', desc: 'Criar e imprimir orçamentos comerciais', icon: '📝' },
    { key: 'inventory', label: 'Estoque & Produtos', desc: 'Cadastrar produtos, editar preços e gerenciar estoque', icon: '📦' },
    { key: 'services', label: 'Catálogo de Serviços', desc: 'Gerenciar tabela de serviços e mão de obra', icon: '⚙️' },
    { key: 'customers', label: 'Cadastro de Clientes', desc: 'Criar e editar cadastros de clientes e empresas', icon: '👥' },
    { key: 'fiscal', label: 'Módulo Fiscal (NFS-e / NFC-e)', desc: 'Emissão e consulta de notas fiscais eletrônicas', icon: '📑' },
    { key: 'backup', label: 'Backup do Sistema', desc: 'Exportar cópias de segurança do banco de dados', icon: '💾' },
    { key: 'settings', label: 'Configurações do Sistema', desc: 'Acesso total às opções da loja, layout e credenciais', icon: '⚙️' }
  ];

  // ==========================================
  // CADASTRO DE VENDEDORES
  // ==========================================
  const [sellerModalOpen, setSellerModalOpen] = useState<boolean>(false);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [savingSeller, setSavingSeller] = useState<boolean>(false);
  const [sellerFeedback, setSellerFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [sellerListFeedback, setSellerListFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [sellerFormData, setSellerFormData] = useState<{
    name: string;
    phone: string;
    commissionRate: number;
    active: boolean;
  }>({
    name: '',
    phone: '',
    commissionRate: 0,
    active: true
  });

  const handleOpenNewSeller = () => {
    setEditingSeller(null);
    setSellerFormData({
      name: '',
      phone: '',
      commissionRate: 0,
      active: true
    });
    setSellerFeedback(null);
    setSellerModalOpen(true);
  };

  const handleOpenEditSeller = (s: Seller) => {
    setEditingSeller(s);
    setSellerFormData({
      name: s.name,
      phone: s.phone || '',
      commissionRate: Number(s.commissionRate) || 0,
      active: s.active !== false
    });
    setSellerFeedback(null);
    setSellerModalOpen(true);
  };

  const handleSaveSellerForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSellerFeedback(null);

    if (!sellerFormData.name.trim()) {
      setSellerFeedback({ type: 'error', message: 'O nome do vendedor é obrigatório.' });
      return;
    }

    setSavingSeller(true);
    try {
      const payload: Partial<Seller> = {
        name: sellerFormData.name.trim().toUpperCase(),
        phone: sellerFormData.phone.trim(),
        commissionRate: Number(sellerFormData.commissionRate) || 0,
        active: sellerFormData.active
      };

      if (editingSeller) {
        payload.id = editingSeller.id;
      }

      if (onSaveSeller) {
        await onSaveSeller(payload);
      } else {
        if (editingSeller) {
          await api.updateSeller(editingSeller.id, payload);
        } else {
          await api.createSeller(payload);
        }
      }

      setSellerListFeedback({
        type: 'success',
        message: editingSeller ? 'Vendedor atualizado com sucesso!' : 'Novo vendedor cadastrado com sucesso!'
      });
      setSellerModalOpen(false);
      setTimeout(() => setSellerListFeedback(null), 3500);
    } catch (err: any) {
      setSellerFeedback({
        type: 'error',
        message: err.response?.data?.error || err.message || 'Erro ao salvar vendedor.'
      });
    } finally {
      setSavingSeller(false);
    }
  };

  const handleToggleSellerActive = async (s: Seller) => {
    try {
      const payload: Partial<Seller> = { id: s.id, active: s.active === false };
      if (onSaveSeller) {
        await onSaveSeller(payload);
      } else {
        await api.updateSeller(s.id, { active: s.active === false });
      }
      setSellerListFeedback({
        type: 'success',
        message: `Vendedor "${s.name}" ${s.active === false ? 'ativado' : 'desativado'} com sucesso.`
      });
      setTimeout(() => setSellerListFeedback(null), 3000);
    } catch (err: any) {
      setSellerListFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Erro ao alterar status do vendedor.'
      });
    }
  };

  const handleDeleteSellerClick = (s: Seller) => {
    requestAdminConfirmation({
      title: 'Excluir Vendedor',
      itemDescription: `Vendedor "${s.name}"`,
      actionType: 'delete',
      onConfirm: async (adminPassword) => {
        try {
          if (onDeleteSeller) {
            await onDeleteSeller(s.id, adminPassword);
          } else {
            await api.deleteSeller(s.id, adminPassword);
          }
          setSellerListFeedback({
            type: 'success',
            message: `Vendedor "${s.name}" excluído com sucesso.`
          });
          setTimeout(() => setSellerListFeedback(null), 3000);
        } catch (err: any) {
          setSellerListFeedback({
            type: 'error',
            message: err.message || err.response?.data?.error || 'Erro ao excluir vendedor.'
          });
        }
      }
    });
  };

  // ==========================================
  // GESTÃO DE CATEGORIAS DE GASTOS
  // ==========================================
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategoryDef[]>(() => {
    if (settings.expenseCategories && settings.expenseCategories.length > 0) {
      return settings.expenseCategories;
    }
    return DEFAULT_EXPENSE_CATEGORIES;
  });

  const [newCatLabel, setNewCatLabel] = useState<string>('');
  const [newCatShortLabel, setNewCatShortLabel] = useState<string>('');
  const [selectedColorIndex, setSelectedColorIndex] = useState<number>(3); // Azul
  const [selectedIconName, setSelectedIconName] = useState<string>('Receipt');
  const [categoryFeedback, setCategoryFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSavingCategory, setIsSavingCategory] = useState<boolean>(false);

  const CATEGORY_COLOR_PRESETS = [
    { name: 'Azul', color: 'text-blue-400', bgColor: 'bg-blue-500/15', borderColor: 'border-blue-500/30', hex: '#3b82f6' },
    { name: 'Índigo', color: 'text-indigo-400', bgColor: 'bg-indigo-500/15', borderColor: 'border-indigo-500/30', hex: '#6366f1' },
    { name: 'Ciano', color: 'text-cyan-400', bgColor: 'bg-cyan-500/15', borderColor: 'border-cyan-500/30', hex: '#06b6d4' },
    { name: 'Céu', color: 'text-sky-400', bgColor: 'bg-sky-500/15', borderColor: 'border-sky-500/30', hex: '#0ea5e9' },
    { name: 'Esmeralda', color: 'text-emerald-400', bgColor: 'bg-emerald-500/15', borderColor: 'border-emerald-500/30', hex: '#10b981' },
    { name: 'Verde', color: 'text-green-400', bgColor: 'bg-green-500/15', borderColor: 'border-green-500/30', hex: '#22c55e' },
    { name: 'Âmbar', color: 'text-amber-400', bgColor: 'bg-amber-500/15', borderColor: 'border-amber-500/30', hex: '#f59e0b' },
    { name: 'Laranja', color: 'text-orange-400', bgColor: 'bg-orange-500/15', borderColor: 'border-orange-500/30', hex: '#f97316' },
    { name: 'Vermelho', color: 'text-rose-400', bgColor: 'bg-rose-500/15', borderColor: 'border-rose-500/30', hex: '#f43f5e' },
    { name: 'Roxo', color: 'text-purple-400', bgColor: 'bg-purple-500/15', borderColor: 'border-purple-500/30', hex: '#a855f7' },
    { name: 'Pink', color: 'text-pink-400', bgColor: 'bg-pink-500/15', borderColor: 'border-pink-500/30', hex: '#ec4899' },
    { name: 'Cinza', color: 'text-slate-400', bgColor: 'bg-slate-500/15', borderColor: 'border-slate-500/30', hex: '#64748b' }
  ];

  const CATEGORY_ICON_PRESETS: Array<{ name: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { name: 'Receipt', label: 'Recibo', icon: Receipt },
    { name: 'Building2', label: 'Empresa', icon: Building2 },
    { name: 'ShoppingBag', label: 'Mercadoria', icon: ShoppingBag },
    { name: 'Wrench', label: 'Equipamento', icon: Wrench },
    { name: 'Utensils', label: 'Alimentação', icon: Utensils },
    { name: 'Zap', label: 'Energia', icon: Zap },
    { name: 'Wifi', label: 'Internet', icon: Wifi },
    { name: 'Droplets', label: 'Água', icon: Droplets },
    { name: 'Fuel', label: 'Combustível', icon: Fuel },
    { name: 'FileText', label: 'Imposto', icon: FileText },
    { name: 'DollarSign', label: 'Taxa / Banco', icon: DollarSign },
    { name: 'Briefcase', label: 'Serviços', icon: Briefcase },
    { name: 'Tag', label: 'Etiqueta', icon: Tag },
    { name: 'Sparkles', label: 'Limpeza', icon: Sparkles }
  ];

  const handleAddExpenseCategory = async () => {
    const clean = newCatLabel.trim().toUpperCase();
    if (!clean) {
      setCategoryFeedback({ type: 'error', message: 'Por favor, informe o nome da categoria.' });
      return;
    }

    const generatedId = clean
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || `cat_${Date.now()}`;

    if (expenseCategories.some((c) => c.id === generatedId || c.label.toUpperCase() === clean)) {
      setCategoryFeedback({ type: 'error', message: 'Já existe uma categoria cadastrada com este nome.' });
      return;
    }

    const colorPreset = CATEGORY_COLOR_PRESETS[selectedColorIndex] || CATEGORY_COLOR_PRESETS[0];

    const newCategory: ExpenseCategoryDef = {
      id: generatedId,
      label: clean,
      shortLabel: newCatShortLabel.trim().toUpperCase() || clean,
      iconName: selectedIconName,
      color: colorPreset.color,
      bgColor: colorPreset.bgColor,
      borderColor: colorPreset.borderColor,
      isCustom: true
    };

    const updated = [...expenseCategories, newCategory];
    setExpenseCategories(updated);
    setNewCatLabel('');
    setNewCatShortLabel('');
    setCategoryFeedback({ type: 'success', message: `Categoria "${clean}" adicionada com sucesso!` });
    setTimeout(() => setCategoryFeedback(null), 3500);

    setIsSavingCategory(true);
    try {
      await onSaveSettings({ expenseCategories: updated });
    } catch (err: any) {
      setCategoryFeedback({ type: 'error', message: `Erro ao salvar: ${err.message}` });
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleRemoveExpenseCategory = async (catId: string, label: string) => {
    if (expenseCategories.length <= 1) {
      alert('O sistema precisa de pelo menos uma categoria cadastrada.');
      return;
    }

    if (!window.confirm(`Deseja realmente remover a categoria "${label}"?\n\nOs gastos já cadastrados não serão perdidos, mas ela deixará de aparecer para novos lançamentos.`)) {
      return;
    }

    const updated = expenseCategories.filter((c) => c.id !== catId);
    setExpenseCategories(updated);
    setCategoryFeedback({ type: 'success', message: `Categoria "${label}" removida com sucesso!` });
    setTimeout(() => setCategoryFeedback(null), 3500);

    setIsSavingCategory(true);
    try {
      await onSaveSettings({ expenseCategories: updated });
    } catch (err: any) {
      setCategoryFeedback({ type: 'error', message: `Erro ao salvar remoção: ${err.message}` });
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleRestoreDefaultExpenseCategories = async () => {
    if (!window.confirm('Deseja restaurar as categorias padrão do sistema (Alimentação, Mercadoria, Equipamento, Internet, Água, Energia, Imposto, DAS-MEI, Gasolina, Outros)?')) {
      return;
    }

    setExpenseCategories(DEFAULT_EXPENSE_CATEGORIES);
    setCategoryFeedback({ type: 'success', message: 'Categorias padrão restauradas com sucesso!' });
    setTimeout(() => setCategoryFeedback(null), 3500);

    setIsSavingCategory(true);
    try {
      await onSaveSettings({ expenseCategories: DEFAULT_EXPENSE_CATEGORIES });
    } catch (err: any) {
      setCategoryFeedback({ type: 'error', message: `Erro ao salvar: ${err.message}` });
    } finally {
      setIsSavingCategory(false);
    }
  };

  const fontOptions = [
    {
      id: 'system' as FontFamily,
      label: 'Sistema / Inter',
      fontName: 'Inter',
      desc: 'Projetada especialmente para telas e interfaces de alta precisão'
    },
    {
      id: 'roboto' as FontFamily,
      label: 'Roboto',
      fontName: 'Roboto',
      desc: 'Tipografia clássica da Google, nítida e bem estruturada'
    },
    {
      id: 'segoe' as FontFamily,
      label: 'Segoe UI',
      fontName: 'Segoe UI',
      desc: 'Nativa do ecossistema Windows, familiar e límpida'
    },
    {
      id: 'poppins' as FontFamily,
      label: 'Poppins',
      fontName: 'Poppins',
      desc: 'Geométrica, contemporânea e com contornos suaves'
    },
    {
      id: 'opensans' as FontFamily,
      label: 'Open Sans',
      fontName: 'Open Sans',
      desc: 'Humanista, neutra e com leitura extremamente confortável'
    },
    {
      id: 'fira' as FontFamily,
      label: 'Fira Sans',
      fontName: 'Fira Sans',
      desc: 'Técnica, elegante e com excelente firmeza tipográfica'
    }
  ];

  const SETTINGS_MODULE_TABS: Array<{
    id: SettingsModuleTab;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    desc: string;
  }> = [
    {
      id: 'pdv',
      label: 'Módulo de PDV',
      shortLabel: 'PDV / Vendas',
      icon: ShoppingCart,
      desc: 'Impressora, PIX & Vendas Balcão'
    },
    {
      id: 'os',
      label: 'Ordens de Serviços',
      shortLabel: 'Ordens de Serviço',
      icon: Wrench,
      desc: 'Status, Cores, Garantia & Link'
    },
    {
      id: 'gastos',
      label: 'Gastos da Empresa',
      shortLabel: 'Gastos & Categorias',
      icon: TrendingDown,
      desc: 'Categorias de despesas e custos'
    },
    {
      id: 'usuarios',
      label: 'Usuários',
      shortLabel: 'Usuários & Permissões',
      icon: Users,
      desc: 'Acesso, Perfis, Senhas & Segurança'
    },
    {
      id: 'vendedores',
      label: 'Vendedores',
      shortLabel: 'Vendedores',
      icon: BadgeDollarSign,
      desc: 'Atendentes & Comissões'
    },
    {
      id: 'layout',
      label: 'Layout Geral do Sistema',
      shortLabel: 'Layout & Cores',
      icon: Palette,
      desc: 'Temas, Fontes, Cores, Logo & Simulador'
    },
    {
      id: 'loja',
      label: 'Informações da Loja',
      shortLabel: 'Dados da Loja',
      icon: Store,
      desc: 'Razão Social, CNPJ, Contato & Endereço'
    }
  ];

  return (
    <div className="max-w-5xl space-y-6">
      {/* Cabeçalho da Página de Configurações */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-blue-400" />
            <span>Configurações do Sistema</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Selecione o módulo abaixo para gerenciar preferências de vendas, ordens de serviço, equipe, segurança e identidade visual.
          </p>
        </div>

        {isSaved && (
          <div className="p-2.5 px-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Configurações salvas e aplicadas com sucesso!</span>
          </div>
        )}
      </div>

      {/* ABAS MODULARES DE CONFIGURAÇÃO */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {SETTINGS_MODULE_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`p-3 rounded-2xl border transition-all text-left flex flex-col justify-between gap-2.5 relative overflow-hidden group cursor-pointer ${
                isActive
                  ? 'bg-blue-600/15 border-blue-500 text-white shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/20'
                  : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-300 group-hover:text-blue-400 group-hover:bg-slate-750'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                {tab.id === 'vendedores' && sellers.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {sellers.length}
                  </span>
                )}
                {tab.id === 'usuarios' && currentUser?.role === 'admin' && usersList.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    {usersList.length}
                  </span>
                )}
              </div>
              <div>
                <span className="font-extrabold text-xs block leading-tight">
                  {tab.label}
                </span>
                <span className="text-[10px] text-slate-400 block leading-tight mt-0.5 truncate">
                  {tab.desc}
                </span>
              </div>
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================
          ABA 1: MÓDULO DE PDV (PONTO DE VENDA)
          ======================================================== */}
      {activeTab === 'pdv' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Módulo de PDV (Frente de Caixa & Vendas)</h3>
                  <p className="text-[11px] text-slate-400">
                    Preferências de comprovantes, formato de impressão não fiscal, chave PIX e destaque de valores no caixa.
                  </p>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
                Caixa & Impressão
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Formato de Impressão */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                  <Printer className="w-4 h-4 text-blue-400" />
                  <h4 className="text-xs font-bold text-white">Impressora de Comprovantes do PDV</h4>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Formato Padrão de Impressão</label>
                  <select
                    value={formData.printerType}
                    onChange={(e) => setFormData({ ...formData, printerType: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="termica_80mm">Impressora Térmica Não Fiscal 80mm (Bobina Padrão PDV)</option>
                    <option value="termica_58mm">Impressora Térmica 58mm (Mini Impressora Portátil)</option>
                    <option value="a4">Folha Padrão A4 (Comprovante Completo com Canhoto)</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Compatível com impressoras térmicas USB, Rede e Bluetooth (Bematech, Elgin, Epson, Daruma, etc.).
                  </p>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer pt-2 border-t border-slate-800/80">
                  <input
                    type="checkbox"
                    checked={formData.autoPrintAfterSave}
                    onChange={(e) => setFormData({ ...formData, autoPrintAfterSave: e.target.checked })}
                    className="rounded border-slate-700 text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs text-slate-300 font-medium">
                    Abrir janela de impressão automaticamente ao finalizar venda no PDV
                  </span>
                </label>
              </div>

              {/* Chave PIX do Caixa */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-white">Chave PIX para Recebimentos no Caixa</h4>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Tipo da Chave PIX</label>
                  <select
                    value={formData.pixType}
                    onChange={(e) => setFormData({ ...formData, pixType: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="cnpj">CNPJ</option>
                    <option value="cpf">CPF</option>
                    <option value="telefone">Celular / WhatsApp</option>
                    <option value="email">E-mail</option>
                    <option value="aleatoria">Chave Aleatória (EVP)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Chave PIX Cadastrada</label>
                  <input
                    type="text"
                    placeholder="Informe a chave PIX da loja..."
                    value={formData.pixKey}
                    onChange={(e) => setFormData({ ...formData, pixKey: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    A chave PIX é impressa no rodapé dos comprovantes para o cliente escanear e pagar instantaneamente.
                  </p>
                </div>
              </div>
            </div>

            {/* Cor de Preços e Totais */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Destaque de Preços e Totais do PDV</h4>
                    <p className="text-[10px] text-slate-400">
                      Cor dos valores finais de vendas, totais a pagar e métricas financeiras.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.priceHighlightColor || '#34d399'}
                    onChange={(e) => updateVisualField('priceHighlightColor', e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border border-slate-700 bg-transparent p-0"
                  />
                  <span className="font-mono text-xs text-white uppercase font-bold">
                    {formData.priceHighlightColor || '#34d399'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {COLOR_PALETTES.price.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => updateVisualField('priceHighlightColor', c.hex)}
                    className={`w-6 h-6 rounded-full border transition cursor-pointer ${
                      formData.priceHighlightColor?.toLowerCase() === c.hex.toLowerCase()
                        ? 'ring-2 ring-white scale-110 border-white'
                        : 'border-slate-700'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.label}
                  />
                ))}
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold">Exemplo Total no Caixa:</span>
                <span
                  className="font-extrabold text-base"
                  style={{ color: formData.priceHighlightColor || '#34d399' }}
                >
                  R$ 1.849,90
                </span>
              </div>
            </div>

            {/* Mensagem Personalizada de Agradecimento / Pós-Venda via WhatsApp */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Mensagens via WhatsApp (Pós-Venda PDV)</h4>
                    <p className="text-[10px] text-slate-400">
                      Envie uma mensagem personalizada salva junto com o recibo da venda enviado via WhatsApp.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.posSaleMessageEnabled || false}
                    onChange={(e) => setFormData({ ...formData, posSaleMessageEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold">
                  Status do Envio no Recibo:
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${formData.posSaleMessageEnabled ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                  {formData.posSaleMessageEnabled ? '✓ ATIVADA (Envia junto ao recibo)' : 'DESATIVADA'}
                </span>
              </div>

              {/* Campo da Mensagem Salva */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] text-slate-300 font-medium">
                    Mensagem Salva para o Cliente
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, posSaleMessageTemplate: DEFAULT_POS_SALE_MESSAGE })}
                    className="text-[10px] text-slate-400 hover:text-emerald-400 underline transition cursor-pointer"
                  >
                    Restaurar mensagem padrão
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={formData.posSaleMessageTemplate ?? DEFAULT_POS_SALE_MESSAGE}
                  onChange={(e) => setFormData({ ...formData, posSaleMessageTemplate: e.target.value })}
                  placeholder="Digite a mensagem de agradecimento que será enviada junto com o recibo..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans leading-relaxed"
                />
                
                {/* Tags Dinâmicas */}
                <div className="pt-2">
                  <span className="text-[10px] text-slate-400 block mb-1">Tags dinâmicas disponíveis (clique para inserir no texto):</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { tag: '{cliente}', desc: 'Nome do cliente' },
                      { tag: '{numero_venda}', desc: 'Nº do recibo da venda' },
                      { tag: '{valor}', desc: 'Valor total pago' },
                      { tag: '{loja}', desc: 'Nome da loja' },
                      { tag: '{telefone}', desc: 'Telefone da loja' }
                    ].map((t) => (
                      <button
                        key={t.tag}
                        type="button"
                        onClick={() => {
                          const current = formData.posSaleMessageTemplate ?? DEFAULT_POS_SALE_MESSAGE;
                          setFormData({ ...formData, posSaleMessageTemplate: `${current} ${t.tag}` });
                        }}
                        className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-emerald-400 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer"
                        title={t.desc}
                      >
                        {t.tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Mensagem de Avaliação do Cliente (Pós-Venda PDV) */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Mensagem de Avaliação do Cliente (Pós-Venda PDV)</h4>
                    <p className="text-[10px] text-slate-400">
                      Configure a mensagem disparada pelo botão "Avaliação" no Histórico de Vendas para solicitar feedback e avaliação aos clientes no WhatsApp.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.posReviewMessageEnabled !== false}
                    onChange={(e) => setFormData({ ...formData, posReviewMessageEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold">
                  Status do Botão de Avaliação no Histórico:
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${formData.posReviewMessageEnabled !== false ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                  {formData.posReviewMessageEnabled !== false ? '✓ ATIVADA (Disponível no histórico de vendas)' : 'DESATIVADA'}
                </span>
              </div>

              {/* Link do Google Meu Negócio / Avaliação (Opcional) */}
              <div>
                <label className="text-[11px] text-slate-300 font-medium block mb-1">
                  Link de Avaliação da Loja (Google Meu Negócio / Avaliação Online) <span className="text-slate-500 text-[10px]">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={formData.googleReviewUrl || ''}
                  onChange={(e) => setFormData({ ...formData, googleReviewUrl: e.target.value })}
                  placeholder="Ex: https://g.page/r/.../review"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-sans"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Se preenchido, esse link será inserido automaticamente onde estiver a tag <code className="text-amber-400 font-mono">{"{link_avaliacao}"}</code>.
                </p>
              </div>

              {/* Campo da Mensagem de Avaliação Salva */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] text-slate-300 font-medium">
                    Mensagem de Avaliação Salva para Edição
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, posReviewMessageTemplate: DEFAULT_POS_REVIEW_MESSAGE })}
                    className="text-[10px] text-slate-400 hover:text-amber-400 underline transition cursor-pointer"
                  >
                    Restaurar mensagem padrão
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={formData.posReviewMessageTemplate ?? DEFAULT_POS_REVIEW_MESSAGE}
                  onChange={(e) => setFormData({ ...formData, posReviewMessageTemplate: e.target.value })}
                  placeholder="Digite a mensagem de avaliação que será enviada para o cliente..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-sans leading-relaxed"
                />
                
                {/* Tags Dinâmicas */}
                <div className="pt-2">
                  <span className="text-[10px] text-slate-400 block mb-1">Tags dinâmicas disponíveis (clique para inserir no texto):</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { tag: '{cliente}', desc: 'Nome do cliente' },
                      { tag: '{numero_venda}', desc: 'Nº do recibo da venda' },
                      { tag: '{valor}', desc: 'Valor total da compra' },
                      { tag: '{loja}', desc: 'Nome da loja' },
                      { tag: '{telefone}', desc: 'Telefone da loja' },
                      { tag: '{link_avaliacao}', desc: 'Link de avaliação do Google configurado acima' }
                    ].map((t) => (
                      <button
                        key={t.tag}
                        type="button"
                        onClick={() => {
                          const current = formData.posReviewMessageTemplate ?? DEFAULT_POS_REVIEW_MESSAGE;
                          setFormData({ ...formData, posReviewMessageTemplate: `${current} ${t.tag}` });
                        }}
                        className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-amber-400 border border-slate-800 hover:border-amber-500/50 transition cursor-pointer"
                        title={t.desc}
                      >
                        {t.tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Opção de Baixar PDF e Enviar Automaticamente via WhatsApp (PDV) */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <FileDown className="w-4 h-4 text-emerald-400" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Baixar PDF e Enviar Automaticamente no WhatsApp (PDV)</h4>
                    <p className="text-[10px] text-slate-400">
                      Ao finalizar a venda ou clicar no botão de WhatsApp, baixa automaticamente o arquivo PDF do recibo e abre o WhatsApp do cliente com o recibo e a mensagem preparados para envio.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.posAutoSendPdfWhatsApp || false}
                    onChange={(e) => setFormData({ ...formData, posAutoSendPdfWhatsApp: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold">
                  Status da Automação de Envio no PDV:
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${formData.posAutoSendPdfWhatsApp ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                  {formData.posAutoSendPdfWhatsApp ? '✓ ATIVADA (Baixa o PDF e dispara o envio automaticamente)' : 'DESATIVADA'}
                </span>
              </div>
            </div>

            {/* Diretório de Armazenamento e Envio de Documentos (PDV) */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-emerald-400" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Diretório de Salvamento e Envio de Documentos</h4>
                    <p className="text-[10px] text-slate-400">
                      Pasta no computador onde são baixados, salvos e organizados os recibos de vendas, ordens de serviço e relatórios.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
                  Armazenamento Local
                </span>
              </div>

              <div>
                <label className="text-[11px] text-slate-300 font-medium block mb-1.5">
                  Caminho do Diretório no Computador
                </label>
                <input
                  type="text"
                  placeholder="Ex: C:\InfoTech_Documentos ou C:\Users\Power\Documents\InfoTech_Documentos"
                  value={formData.documentsDirectory || ''}
                  onChange={(e) => setFormData({ ...formData, documentsDirectory: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-1.5">
                  📄 <strong>Padrão de nomeação das Ordens de Serviço:</strong> [Número da OS] - [Nome do Cliente].pdf (Ex: <em>1042 - João Silva.pdf</em>)
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80 flex-wrap">
                <span className="text-[10px] text-slate-400">Sugestões rápidas:</span>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, documentsDirectory: 'C:\\InfoTech_Documentos' })}
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-emerald-400 border border-slate-800 hover:border-emerald-500/40 transition cursor-pointer"
                >
                  C:\InfoTech_Documentos
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, documentsDirectory: 'C:\\Users\\Power\\Documents\\InfoTech_Documentos' })}
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-cyan-400 border border-slate-800 hover:border-cyan-500/40 transition cursor-pointer"
                >
                  Documentos do Usuário
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition active:scale-[0.98] cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Configurações do PDV</span>
            </button>
          </div>
        </form>
      )}

      {/* ========================================================
          ABA 2: ORDENS DE SERVIÇOS (OS)
          ======================================================== */}
      {activeTab === 'os' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Módulo de Ordens de Serviço (OS)</h3>
                  <p className="text-[11px] text-slate-400">
                    Personalize fontes, cores dos status, espaçamento dos badges, ícones de ações, termos de garantia e link de acompanhamento.
                  </p>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold uppercase">
                Tabela & Status
              </span>
            </div>

            {/* Grid de Controles Visuais da OS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Tamanho dos Status (Badges) */}
              <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Tamanho dos Status</span>
                  </label>
                  <span className="text-[11px] font-mono text-cyan-400 font-bold">
                    {formData.badgeFontSize || 10}px
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Fonte e preenchimento das etiquetas de status da OS.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustNumericVisual('badgeFontSize', -1, 8, 18)}
                    className="p-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="range"
                    min="8"
                    max="18"
                    step="0.5"
                    value={formData.badgeFontSize || 10}
                    onChange={(e) => updateVisualField('badgeFontSize', Number(e.target.value))}
                    className="flex-1 accent-cyan-500 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => adjustNumericVisual('badgeFontSize', 1, 8, 18)}
                    className="p-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="pt-1">
                  <span className="text-[10px] text-slate-400 block mb-1">Espaçamento do Badge:</span>
                  <div className="grid grid-cols-2 gap-1">
                    {(
                      [
                        { id: 'compacto', label: 'Compacto' },
                        { id: 'padrao', label: 'Padrão' },
                        { id: 'amplo', label: 'Amplo' },
                        { id: 'destaque', label: 'Destaque' }
                      ] as const
                    ).map((pad) => (
                      <button
                        key={pad.id}
                        type="button"
                        onClick={() => updateVisualField('badgePadding', pad.id)}
                        className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border transition ${
                          (formData.badgePadding || 'padrao') === pad.id
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {pad.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. Nome do Cliente na OS */}
              <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <span>Nome do Cliente</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-mono text-blue-400 font-bold">
                      {formData.customerNameFontSize || 13}px
                    </span>
                    <input
                      type="color"
                      value={formData.customerNameColor || '#e2e8f0'}
                      onChange={(e) => updateVisualField('customerNameColor', e.target.value)}
                      className="w-5 h-5 rounded cursor-pointer border border-slate-700 bg-transparent p-0"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Tamanho e cor de exibição do cliente na OS.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustNumericVisual('customerNameFontSize', -1, 10, 24)}
                    className="p-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="range"
                    min="10"
                    max="24"
                    step="0.5"
                    value={formData.customerNameFontSize || 13}
                    onChange={(e) => updateVisualField('customerNameFontSize', Number(e.target.value))}
                    className="flex-1 accent-blue-500 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => adjustNumericVisual('customerNameFontSize', 1, 10, 24)}
                    className="p-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  {COLOR_PALETTES.customer.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => updateVisualField('customerNameColor', c.hex)}
                      className={`w-4 h-4 rounded-full border transition ${
                        formData.customerNameColor?.toLowerCase() === c.hex.toLowerCase()
                          ? 'ring-2 ring-white scale-110 border-white'
                          : 'border-slate-700'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              {/* 3. Número da OS */}
              <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-sky-400" />
                    <span>Número da OS (#)</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-mono text-sky-400 font-bold">
                      {formData.osNumberFontSize || 14}px
                    </span>
                    <input
                      type="color"
                      value={formData.osNumberColor || '#38bdf8'}
                      onChange={(e) => updateVisualField('osNumberColor', e.target.value)}
                      className="w-5 h-5 rounded cursor-pointer border border-slate-700 bg-transparent p-0"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Tamanho e cor de destaque do número da OS.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustNumericVisual('osNumberFontSize', -1, 10, 26)}
                    className="p-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="range"
                    min="10"
                    max="26"
                    step="0.5"
                    value={formData.osNumberFontSize || 14}
                    onChange={(e) => updateVisualField('osNumberFontSize', Number(e.target.value))}
                    className="flex-1 accent-sky-500 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => adjustNumericVisual('osNumberFontSize', 1, 10, 26)}
                    className="p-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  {COLOR_PALETTES.osNumber.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => updateVisualField('osNumberColor', c.hex)}
                      className={`w-4 h-4 rounded-full border transition ${
                        formData.osNumberColor?.toLowerCase() === c.hex.toLowerCase()
                          ? 'ring-2 ring-white scale-110 border-white'
                          : 'border-slate-700'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              {/* 4. Tamanho dos Ícones de Ações */}
              <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ícones de Ações</span>
                  </label>
                  <span className="text-[11px] font-mono text-amber-400 font-bold">
                    {formData.actionIconSize || 14}px
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Tamanho dos botões de ação na tabela de OS.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustNumericVisual('actionIconSize', -1, 12, 26)}
                    className="p-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="range"
                    min="12"
                    max="26"
                    step="1"
                    value={formData.actionIconSize || 14}
                    onChange={(e) => updateVisualField('actionIconSize', Number(e.target.value))}
                    className="flex-1 accent-amber-500 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => adjustNumericVisual('actionIconSize', 1, 12, 26)}
                    className="p-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                  {[
                    { label: '12px Mini', size: 12 },
                    { label: '14px Padrão', size: 14 },
                    { label: '16px Médio', size: 16 },
                    { label: '18px Amplo', size: 18 }
                  ].map((item) => (
                    <button
                      key={item.size}
                      type="button"
                      onClick={() => updateVisualField('actionIconSize', item.size)}
                      className={`py-0.5 px-1.5 rounded-lg text-[10px] font-semibold border transition ${
                        (formData.actionIconSize || 14) === item.size
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Cores dos Status das Ordens de Serviço */}
            <div className="border-t border-slate-800/80 pt-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-bold text-white flex items-center gap-2">
                    <Palette className="w-4 h-4 text-purple-400" />
                    <span>Cores dos Status das Ordens de Serviço (Personalização Individual)</span>
                  </label>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Altere a cor de qualquer status do sistema. Atualiza instantaneamente em todas as listagens de OS.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetAllStatusColors}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-[11px] font-semibold border border-slate-700 transition"
                  title="Restaurar todas as cores de status para os padrões originais"
                >
                  <RotateCcw className="w-3 h-3 text-purple-400" />
                  <span>Restaurar Cores dos Status</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-1">
                {STATUS_LIST.map((st) => {
                  const currentColor = formData.statusColors?.[st.key] || DEFAULT_STATUS_COLORS[st.key] || '#64748b';
                  return (
                    <div
                      key={st.key}
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span
                          style={getStatusBadgeStyle(
                            st.key,
                            formData.statusColors,
                            formData.badgeFontSize,
                            formData.badgePadding
                          )}
                          className="app-status-badge"
                        >
                          {st.label}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={currentColor}
                            onChange={(e) => updateStatusColor(st.key, e.target.value)}
                            className="w-5 h-5 rounded cursor-pointer border border-slate-700 bg-transparent p-0"
                            title={`Alterar cor de ${st.label}`}
                          />
                          <button
                            type="button"
                            onClick={() => handleResetStatusColor(st.key)}
                            className="text-slate-500 hover:text-amber-400 p-0.5 transition"
                            title="Restaurar cor padrão deste status"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight truncate" title={st.desc}>
                        {st.desc}
                      </p>
                      <div className="flex items-center gap-1 pt-1 flex-wrap">
                        {COLOR_PALETTES.statusSwatches.slice(0, 8).map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => updateStatusColor(st.key, hex)}
                            className={`w-3.5 h-3.5 rounded-full border transition ${
                              currentColor.toLowerCase() === hex.toLowerCase()
                                ? 'ring-2 ring-white scale-110 border-white'
                                : 'border-slate-700/60'
                            }`}
                            style={{ backgroundColor: hex }}
                            title={hex}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Super Simulador ao Vivo de OS */}
            <div className="border-t border-slate-800/80 pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-400" />
                  <span>Simulador em Tempo Real da Ordem de Serviço</span>
                </label>
                <span className="text-[10px] text-slate-400">
                  Reflete exatamente as cores, fontes e tamanhos configurados acima
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 shadow-2xl">
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                      <Laptop className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-extrabold app-os-number"
                          style={{
                            fontSize: `${formData.osNumberFontSize || 14}px`,
                            color: formData.osNumberColor || '#38bdf8'
                          }}
                        >
                          OS #1042
                        </span>
                        <span
                          style={getStatusBadgeStyle(
                            'manutencao',
                            formData.statusColors,
                            formData.badgeFontSize,
                            formData.badgePadding
                          )}
                          className="app-status-badge"
                        >
                          Na Bancada
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 font-medium truncate mt-0.5">
                        Notebook Dell Vostro 3520 — Troca de Teclado e Bateria
                      </p>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Cliente:{' '}
                        <strong
                          className="app-customer-name"
                          style={{
                            fontSize: `${formData.customerNameFontSize || 13}px`,
                            color: formData.customerNameColor || '#e2e8f0'
                          }}
                        >
                          Carlos Eduardo Silveira
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Valor Total</span>
                      <span
                        className="font-extrabold text-sm"
                        style={{ color: formData.priceHighlightColor || '#34d399' }}
                      >
                        R$ 480,00
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30" title="Visualizar">
                        <Eye style={{ width: `${formData.actionIconSize || 14}px`, height: `${formData.actionIconSize || 14}px` }} />
                      </div>
                      <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30" title="Adicionar">
                        <PlusCircle style={{ width: `${formData.actionIconSize || 14}px`, height: `${formData.actionIconSize || 14}px` }} />
                      </div>
                      <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" title="WhatsApp">
                        <MessageSquare style={{ width: `${formData.actionIconSize || 14}px`, height: `${formData.actionIconSize || 14}px` }} />
                      </div>
                      <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/30" title="Link">
                        <ExternalLink style={{ width: `${formData.actionIconSize || 14}px`, height: `${formData.actionIconSize || 14}px` }} />
                      </div>
                      <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30" title="Imprimir">
                        <Printer style={{ width: `${formData.actionIconSize || 14}px`, height: `${formData.actionIconSize || 14}px` }} />
                      </div>
                      <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700" title="Editar">
                        <Edit style={{ width: `${formData.actionIconSize || 14}px`, height: `${formData.actionIconSize || 14}px` }} />
                      </div>
                      <div className="p-1.5 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30" title="Excluir">
                        <Trash2 style={{ width: `${formData.actionIconSize || 14}px`, height: `${formData.actionIconSize || 14}px` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/60">
                  <span className="text-[10px] text-slate-400 block mb-1.5 font-semibold">
                    Demonstração de todos os status com suas cores personalizadas:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {STATUS_LIST.map((st) => (
                      <span
                        key={st.key}
                        style={getStatusBadgeStyle(
                          st.key,
                          formData.statusColors,
                          formData.badgeFontSize,
                          formData.badgePadding
                        )}
                        className="app-status-badge"
                      >
                        {st.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Termo de Garantia Legal */}
            <div className="border-t border-slate-800/80 pt-5 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-bold text-white">
                  Termo de Garantia e Responsabilidade Técnica (Impresso na OS)
                </h4>
              </div>
              <p className="text-xs text-slate-400">
                Este texto é impresso na via assinada pelo cliente, respaldando a oficina contra peças violadas ou aparelhos abandonados.
              </p>
              <textarea
                rows={5}
                value={formData.warrantyTerms}
                onChange={(e) => setFormData({ ...formData, warrantyTerms: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono leading-relaxed focus:outline-none focus:border-blue-500"
              />
            </div>
            {/* Mensagem ao Marcar Pronto para Retirada (Concluída) via WhatsApp */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Mensagens via WhatsApp (Pronto para Retirada)</h4>
                    <p className="text-[10px] text-slate-400">
                      Mensagem enviada com o laudo em PDF pelo WhatsApp quando o status for alterado para &quot;Pronto para Retirada&quot; (Concluída).
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.osReadyMessageEnabled ?? true}
                    onChange={(e) => setFormData({ ...formData, osReadyMessageEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold">
                  Status do Envio:
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${(formData.osReadyMessageEnabled ?? true) ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                  {(formData.osReadyMessageEnabled ?? true) ? '✓ ATIVADA (Envia ao marcar Pronto Retirada)' : 'DESATIVADA'}
                </span>
              </div>

              {/* Campo da Mensagem Salva */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] text-slate-300 font-medium">
                    Mensagem Salva para o Cliente ao Ficar Pronto para Retirada
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, osReadyMessageTemplate: DEFAULT_OS_READY_MESSAGE })}
                    className="text-[10px] text-slate-400 hover:text-emerald-400 underline transition cursor-pointer"
                  >
                    Restaurar mensagem padrão
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={formData.osReadyMessageTemplate ?? DEFAULT_OS_READY_MESSAGE}
                  onChange={(e) => setFormData({ ...formData, osReadyMessageTemplate: e.target.value })}
                  placeholder="Digite a mensagem que será enviada ao cliente quando o aparelho estiver pronto para retirada..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans leading-relaxed"
                />

                {/* Tags Dinâmicas */}
                <div className="pt-2">
                  <span className="text-[10px] text-slate-400 block mb-1">Tags dinâmicas disponíveis (clique para inserir no texto):</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { tag: '{cliente}', desc: 'Nome do cliente' },
                      { tag: '{numero_os}', desc: 'Nº da Ordem de Serviço' },
                      { tag: '{equipamento}', desc: 'Marca e Modelo / Equipamento' },
                      { tag: '{valor}', desc: 'Valor total da OS' },
                      { tag: '{loja}', desc: 'Nome da loja' },
                      { tag: '{telefone}', desc: 'Telefone da loja' },
                      { tag: '{endereco}', desc: 'Endereço da loja' }
                    ].map((t) => (
                      <button
                        key={t.tag}
                        type="button"
                        onClick={() => {
                          const current = formData.osReadyMessageTemplate ?? DEFAULT_OS_READY_MESSAGE;
                          setFormData({ ...formData, osReadyMessageTemplate: `${current} ${t.tag}` });
                        }}
                        className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-emerald-400 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer"
                        title={t.desc}
                      >
                        {t.tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Mensagem Automática ao Entregar OS via WhatsApp */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Mensagens via WhatsApp (OS Entregue)</h4>
                    <p className="text-[10px] text-slate-400">
                      Disparo automático de mensagem no WhatsApp assim que o status da Ordem de Serviço for alterado para &quot;Entregue&quot;.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.osDeliveredMessageEnabled || false}
                    onChange={(e) => setFormData({ ...formData, osDeliveredMessageEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold">
                  Status do Envio Automático:
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${formData.osDeliveredMessageEnabled ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                  {formData.osDeliveredMessageEnabled ? '✓ ATIVADA (Envia ao marcar Entregue)' : 'DESATIVADA'}
                </span>
              </div>

              {/* Campo da Mensagem Salva */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] text-slate-300 font-medium">
                    Mensagem Salva para o Cliente ao Entregar
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, osDeliveredMessageTemplate: DEFAULT_OS_DELIVERED_MESSAGE })}
                    className="text-[10px] text-slate-400 hover:text-blue-400 underline transition cursor-pointer"
                  >
                    Restaurar mensagem padrão
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={formData.osDeliveredMessageTemplate ?? DEFAULT_OS_DELIVERED_MESSAGE}
                  onChange={(e) => setFormData({ ...formData, osDeliveredMessageTemplate: e.target.value })}
                  placeholder="Digite a mensagem que será enviada automaticamente ao cliente quando a OS for entregue..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans leading-relaxed"
                />
                
                {/* Tags Dinâmicas */}
                <div className="pt-2">
                  <span className="text-[10px] text-slate-400 block mb-1">Tags dinâmicas disponíveis (clique para inserir no texto):</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { tag: '{cliente}', desc: 'Nome do cliente' },
                      { tag: '{numero_os}', desc: 'Nº da Ordem de Serviço' },
                      { tag: '{equipamento}', desc: 'Marca e Modelo / Equipamento' },
                      { tag: '{valor}', desc: 'Valor total da OS' },
                      { tag: '{loja}', desc: 'Nome da loja' },
                      { tag: '{telefone}', desc: 'Telefone da loja' }
                    ].map((t) => (
                      <button
                        key={t.tag}
                        type="button"
                        onClick={() => {
                          const current = formData.osDeliveredMessageTemplate ?? DEFAULT_OS_DELIVERED_MESSAGE;
                          setFormData({ ...formData, osDeliveredMessageTemplate: `${current} ${t.tag}` });
                        }}
                        className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-cyan-400 border border-slate-800 hover:border-cyan-500/50 transition cursor-pointer"
                        title={t.desc}
                      >
                        {t.tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Mensagem de Avaliação da Ordem de Serviço (Pós-Serviço) */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Mensagem de Avaliação da Ordem de Serviço (Pós-Serviço)</h4>
                    <p className="text-[10px] text-slate-400">
                      Disponibiliza o botão e a ação &quot;Mensagem de avaliação&quot; nas Ordens de Serviço (desktop, mobile e visualização da OS) para solicitar um feedback honesto do cliente pelo WhatsApp.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.osReviewMessageEnabled !== false}
                    onChange={(e) => setFormData({ ...formData, osReviewMessageEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold">
                  Status da Ação de Avaliação na OS:
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${formData.osReviewMessageEnabled !== false ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                  {formData.osReviewMessageEnabled !== false ? '✓ ATIVADA (Disponível nas ações da OS)' : 'DESATIVADA'}
                </span>
              </div>

              {/* Link de Avaliação da Loja (Google Meu Negócio / Avaliação Online) */}
              <div>
                <label className="text-[11px] text-slate-300 font-medium block mb-1">
                  Link de Avaliação da Loja (Google Meu Negócio / Avaliação Online) <span className="text-slate-500 text-[10px]">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={formData.googleReviewUrl || ''}
                  onChange={(e) => setFormData({ ...formData, googleReviewUrl: e.target.value })}
                  placeholder="Ex: https://g.page/r/.../review"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-sans"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Se preenchido, esse link será inserido automaticamente onde estiver a tag <code className="text-amber-400 font-mono">{"{link_avaliacao}"}</code>.
                </p>
              </div>

              {/* Campo da Mensagem Salva */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] text-slate-300 font-medium">
                    Mensagem de Avaliação Salva para Edição
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, osReviewMessageTemplate: DEFAULT_OS_REVIEW_MESSAGE })}
                    className="text-[10px] text-slate-400 hover:text-amber-400 underline transition cursor-pointer"
                  >
                    Restaurar mensagem padrão
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={formData.osReviewMessageTemplate ?? DEFAULT_OS_REVIEW_MESSAGE}
                  onChange={(e) => setFormData({ ...formData, osReviewMessageTemplate: e.target.value })}
                  placeholder="Digite a mensagem de avaliação da OS para o WhatsApp..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-sans leading-relaxed"
                />

                {/* Tags Dinâmicas */}
                <div className="pt-2">
                  <span className="text-[10px] text-slate-400 block mb-1">Tags dinâmicas disponíveis (clique para inserir no texto):</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { tag: '{cliente}', desc: 'Nome do cliente' },
                      { tag: '{numero_os}', desc: 'Nº da Ordem de Serviço' },
                      { tag: '{equipamento}', desc: 'Marca e Modelo / Equipamento' },
                      { tag: '{valor}', desc: 'Valor total da OS' },
                      { tag: '{loja}', desc: 'Nome da loja' },
                      { tag: '{telefone}', desc: 'Telefone da loja' },
                      { tag: '{link_avaliacao}', desc: 'Link de avaliação da loja' }
                    ].map((t) => (
                      <button
                        key={t.tag}
                        type="button"
                        onClick={() => {
                          const current = formData.osReviewMessageTemplate ?? DEFAULT_OS_REVIEW_MESSAGE;
                          setFormData({ ...formData, osReviewMessageTemplate: `${current} ${t.tag}` });
                        }}
                        className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-amber-400 border border-slate-800 hover:border-amber-500/50 transition cursor-pointer"
                        title={t.desc}
                      >
                        {t.tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Opção de Baixar PDF e Enviar Automaticamente via WhatsApp (OS) */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <FileDown className="w-4 h-4 text-blue-400" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Baixar PDF e Enviar Automaticamente no WhatsApp (OS)</h4>
                    <p className="text-[10px] text-slate-400">
                      Ao marcar a Ordem de Serviço como &quot;Entregue&quot; ou clicar no botão de WhatsApp da OS, baixa automaticamente o arquivo PDF oficial e abre o WhatsApp do cliente com o documento e a mensagem preparados para envio.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.osAutoSendPdfWhatsApp || false}
                    onChange={(e) => setFormData({ ...formData, osAutoSendPdfWhatsApp: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold">
                  Status da Automação de Envio na OS:
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${formData.osAutoSendPdfWhatsApp ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                  {formData.osAutoSendPdfWhatsApp ? '✓ ATIVADA (Baixa o PDF e dispara o envio automaticamente)' : 'DESATIVADA'}
                </span>
              </div>
            </div>

            {/* Diretório de Armazenamento e Envio de Documentos (OS) */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-blue-400" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Diretório de Salvamento e Envio de Documentos</h4>
                    <p className="text-[10px] text-slate-400">
                      Pasta no computador onde são salvas e organizadas as ordens de serviço, recibos de vendas e relatórios.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold uppercase">
                  Armazenamento Local
                </span>
              </div>

              <div>
                <label className="text-[11px] text-slate-300 font-medium block mb-1.5">
                  Caminho do Diretório no Computador
                </label>
                <input
                  type="text"
                  placeholder="Ex: C:\InfoTech_Documentos ou C:\Users\Power\Documents\InfoTech_Documentos"
                  value={formData.documentsDirectory || ''}
                  onChange={(e) => setFormData({ ...formData, documentsDirectory: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[10px] text-slate-400 mt-1.5">
                  📄 <strong>Padrão de nomeação das Ordens de Serviço:</strong> [Número da OS] - [Nome do Cliente].pdf (Ex: <em>1042 - João Silva.pdf</em>)
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80 flex-wrap">
                <span className="text-[10px] text-slate-400">Sugestões rápidas:</span>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, documentsDirectory: 'C:\\InfoTech_Documentos' })}
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-blue-400 border border-slate-800 hover:border-blue-500/40 transition cursor-pointer"
                >
                  C:\InfoTech_Documentos
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, documentsDirectory: 'C:\\Users\\Power\\Documents\\InfoTech_Documentos' })}
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-cyan-400 border border-slate-800 hover:border-cyan-500/40 transition cursor-pointer"
                >
                  Documentos do Usuário
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition active:scale-[0.98] cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Configurações de Ordens de Serviço</span>
            </button>
          </div>
        </form>
      )}

      {/* ========================================================
          ABA 3: GASTOS DA EMPRESA & CATEGORIAS
          ======================================================== */}
      {activeTab === 'gastos' && (
        <div className="space-y-6">
          {/* Top Banner de Gastos */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-600/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shadow-lg shadow-rose-500/10 shrink-0">
                <TrendingDown className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Gestão de Categorias de Gastos da Empresa</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold uppercase">
                    Módulo Financeiro
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Adicione ou remova categorias de gastos para organizar saídas financeiras, compras, despesas da equipe e custos da loja.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRestoreDefaultExpenseCategories}
              disabled={isSavingCategory}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
              title="Restaurar lista original com as categorias padrão"
            >
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>Restaurar Padrões de Fábrica</span>
            </button>
          </div>

          {/* Feedback */}
          {categoryFeedback && (
            <div
              className={`p-4 rounded-xl border flex items-center justify-between gap-2 text-xs font-semibold ${
                categoryFeedback.type === 'success'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {categoryFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{categoryFeedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setCategoryFeedback(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Formulário: Adicionar Nova Categoria */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <PlusCircle className="w-5 h-5 text-rose-400" />
              <div>
                <h4 className="text-sm font-bold text-white">Adicionar Nova Categoria de Gasto</h4>
                <p className="text-xs text-slate-400">Personalize o nome, ícone e cor da nova categoria</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Nome Completo da Categoria *
                </label>
                <input
                  type="text"
                  placeholder="Ex: ALUGUEL DO PONTO, CONTABILIDADE, MARKETING..."
                  value={newCatLabel}
                  onChange={(e) => setNewCatLabel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 uppercase font-semibold"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Nome Curto / Botão de Aba (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: ALUGUEL, CONTADOR, TRÁFEGO..."
                  value={newCatShortLabel}
                  onChange={(e) => setNewCatShortLabel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 uppercase font-semibold"
                />
              </div>
            </div>

            {/* Escolha da Cor */}
            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-2">
                Cor Visual da Categoria
              </label>
              <div className="flex flex-wrap items-center gap-2.5">
                {CATEGORY_COLOR_PRESETS.map((preset, idx) => {
                  const isSelected = selectedColorIndex === idx;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setSelectedColorIndex(idx)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                        isSelected
                          ? `${preset.bgColor} ${preset.borderColor} ring-2 ring-rose-500 text-white font-bold`
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: preset.hex }}
                      />
                      <span>{preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Escolha do Ícone */}
            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-2">
                Ícone Representativo
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {CATEGORY_ICON_PRESETS.map((iconItem) => {
                  const Icon = iconItem.icon;
                  const isSelected = selectedIconName === iconItem.name;
                  const activeColor = CATEGORY_COLOR_PRESETS[selectedColorIndex];
                  return (
                    <button
                      key={iconItem.name}
                      type="button"
                      onClick={() => setSelectedIconName(iconItem.name)}
                      className={`p-2.5 rounded-xl border text-center flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                        isSelected
                          ? `${activeColor.bgColor} ${activeColor.borderColor} ring-2 ring-rose-500 text-white shadow-md`
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[10px] truncate w-full">{iconItem.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preview do Botão da Aba */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Pré-visualização:
                </span>
                {(() => {
                  const PreviewIcon = resolveCategoryIcon(selectedIconName);
                  const activeColor = CATEGORY_COLOR_PRESETS[selectedColorIndex];
                  return (
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 shadow-sm">
                      <div className={`w-7 h-7 rounded-lg ${activeColor.bgColor} ${activeColor.color} flex items-center justify-center shrink-0`}>
                        <PreviewIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">
                          {newCatShortLabel.trim().toUpperCase() || newCatLabel.trim().toUpperCase() || 'NOVA CATEGORIA'}
                        </span>
                        <span className="text-[9px] text-slate-400 block font-mono">R$ 0,00</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <button
                type="button"
                onClick={handleAddExpenseCategory}
                disabled={isSavingCategory}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {isSavingCategory ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>Adicionar Categoria de Gasto</span>
              </button>
            </div>
          </div>

          {/* Lista de Categorias Cadastradas */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white">
                  Categorias Ativas no Sistema ({expenseCategories.length})
                </h4>
                <p className="text-xs text-slate-400">
                  Todas as categorias abaixo estarão disponíveis para seleção nas abas do dashboard e no formulário de inserção de gastos.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {expenseCategories.map((cat) => {
                const Icon = resolveCategoryIcon(cat.iconName);
                return (
                  <div
                    key={cat.id}
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between gap-3 group hover:border-slate-700 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl ${cat.bgColor || 'bg-slate-800'} ${cat.color || 'text-slate-300'} flex items-center justify-center shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white block truncate">{cat.label}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-400 block truncate">
                            Aba: {cat.shortLabel || cat.label}
                          </span>
                          {cat.isCustom ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold uppercase">
                              Personalizada
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-bold uppercase">
                              Padrão
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveExpenseCategory(cat.id, cat.label)}
                      disabled={isSavingCategory}
                      className="p-2 rounded-lg bg-slate-900 hover:bg-rose-600/30 text-slate-500 hover:text-rose-400 border border-slate-800 hover:border-rose-500/40 transition shrink-0 cursor-pointer"
                      title={`Remover categoria "${cat.label}"`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          ABA 4: USUÁRIOS & PERMISSÕES
          ======================================================== */}
      {activeTab === 'usuarios' && (
        <div className="space-y-6">
          {/* A. CREDENCIAIS DO ADMINISTRADOR */}
          {currentUser?.role === 'admin' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <UserCog className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Credenciais de Acesso do Administrador</h3>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold uppercase">
                  Acesso Master
                </span>
              </div>

              <p className="text-xs text-slate-400">
                Altere aqui o seu nome de exibição, nome de usuário de login e senha da conta de administrador principal do sistema.
              </p>

              {adminFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                    adminFeedback.type === 'success'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {adminFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{adminFeedback.message}</span>
                </div>
              )}

              <form onSubmit={handleSaveAdminCredentials} className="space-y-4 pt-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Nome Completo do Administrador *</label>
                    <input
                      type="text"
                      required
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Usuário de Login (Username) *</label>
                    <input
                      type="text"
                      required
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-800/80 pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">Alteração de Senha (Opcional)</span>
                    <span className="text-[10px] text-slate-500">(deixe em branco para manter a senha atual)</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Senha Atual</label>
                      <div className="relative">
                        <input
                          type={showAdminCurrentPass ? 'text' : 'password'}
                          placeholder="Digite a senha atual..."
                          value={adminCurrentPassword}
                          onChange={(e) => setAdminCurrentPassword(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white pr-8 focus:outline-none focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminCurrentPass(!showAdminCurrentPass)}
                          className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-200"
                        >
                          {showAdminCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Nova Senha</label>
                      <div className="relative">
                        <input
                          type={showAdminNewPass ? 'text' : 'password'}
                          placeholder="Nova senha (mín. 4 dígitos)..."
                          value={adminNewPassword}
                          onChange={(e) => setAdminNewPassword(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white pr-8 focus:outline-none focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminNewPass(!showAdminNewPass)}
                          className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-200"
                        >
                          {showAdminNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Confirmar Nova Senha</label>
                      <input
                        type={showAdminNewPass ? 'text' : 'password'}
                        placeholder="Repita a nova senha..."
                        value={adminConfirmPassword}
                        onChange={(e) => setAdminConfirmPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={adminLoading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    {adminLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>Salvar Credenciais do Administrador</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* B. GERENCIAMENTO DE USUÁRIOS & PERMISSÕES */}
          {currentUser?.role === 'admin' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Usuários do Sistema & Níveis de Acesso</h3>
                    <p className="text-[11px] text-slate-400">
                      Cadastre operadores, técnicos e defina exatamente quais módulos cada colaborador pode acessar.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleOpenNewUser}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/30 transition active:scale-[0.98] cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Novo Usuário</span>
                </button>
              </div>

              {userListFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                    userListFeedback.type === 'success'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {userListFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{userListFeedback.message}</span>
                </div>
              )}

              {/* Tabela de Usuários */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                {loadingUsers ? (
                  <div className="py-8 flex items-center justify-center gap-2 text-slate-400 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                    <span>Carregando usuários cadastrados...</span>
                  </div>
                ) : usersList.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    Nenhum usuário cadastrado. Clique no botão acima para adicionar.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                        <th className="py-2.5 px-3 font-semibold">Nome</th>
                        <th className="py-2.5 px-3 font-semibold">Usuário (Login)</th>
                        <th className="py-2.5 px-3 font-semibold">Cargo / Perfil</th>
                        <th className="py-2.5 px-3 font-semibold">Permissões</th>
                        <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {usersList.map((u) => {
                        const isSelf = u.id === currentUser?.id;
                        const permsCount = Object.values(u.permissions || {}).filter(Boolean).length;
                        return (
                          <tr key={u.id} className="hover:bg-slate-900/40 transition">
                            <td className="py-3 px-3 font-medium text-white flex items-center gap-2">
                              <span>{u.name}</span>
                              {isSelf && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold uppercase">
                                  Você
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-300">{u.username}</td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  u.role === 'admin'
                                    ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                                }`}
                              >
                                {u.role === 'admin' ? 'Administrador' : 'Operador'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-[11px] text-slate-400">
                              {u.role === 'admin' ? (
                                <span className="text-emerald-400 font-semibold">Acesso Total</span>
                              ) : (
                                <span>{permsCount} módulos liberados</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                  u.active !== false
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${u.active !== false ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                {u.active !== false ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditUser(u)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                                  title="Editar perfil e permissões"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                {!isSelf && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleUserActive(u)}
                                      className={`p-1.5 rounded-lg transition ${
                                        u.active !== false
                                          ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-400'
                                          : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400'
                                      }`}
                                      title={u.active !== false ? 'Desativar usuário' : 'Ativar usuário'}
                                    >
                                      {u.active !== false ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteUser(u)}
                                      className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 transition"
                                      title="Excluir usuário permanentemente"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Modal de Cadastro / Edição de Usuário */}
          {userModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl my-8">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-purple-400" />
                    <h3 className="text-base font-bold text-white">
                      {editingUserId ? 'Editar Usuário & Permissões' : 'Cadastrar Novo Usuário'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUserModalOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {userModalFeedback && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{userModalFeedback}</span>
                  </div>
                )}

                <form onSubmit={handleSaveUser} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Nome Completo *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: João da Silva"
                        value={userFormData.name}
                        onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Usuário de Login (Username) *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: joao.silva"
                        value={userFormData.username}
                        onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        {editingUserId ? 'Nova Senha (deixe vazio para manter)' : 'Senha de Acesso *'}
                      </label>
                      <input
                        type="password"
                        placeholder={editingUserId ? 'Manter senha atual...' : 'Mínimo 6 caracteres'}
                        value={userFormData.password}
                        onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Cargo / Papel no Sistema</label>
                      <select
                        value={userFormData.role}
                        onChange={(e) => {
                          const newRole = e.target.value as 'admin' | 'operador';
                          setUserFormData({
                            ...userFormData,
                            role: newRole,
                            permissions: newRole === 'admin' ? { ...DEFAULT_ADMIN_PERMISSIONS } : userFormData.permissions
                          });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="operador">Operador / Colaborador (Acesso Personalizado)</option>
                        <option value="admin">Administrador (Acesso Irrestrito)</option>
                      </select>
                    </div>
                  </div>

                  {userFormData.role === 'operador' && (
                    <div className="space-y-3 border-t border-slate-800/80 pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs font-bold text-white flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-purple-400" />
                          <span>Permissões de Acesso por Módulo</span>
                        </label>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="text-slate-400">Atalhos rápidos:</span>
                          <button
                            type="button"
                            onClick={() => handleApplyPermissionPreset('balcao')}
                            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                          >
                            Operador Balcão
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPermissionPreset('tecnico')}
                            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                          >
                            Técnico Bancada
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                        {permissionModulesList.map((m) => {
                          const isChecked = !!(userFormData.permissions as any)[m.key];
                          return (
                            <label
                              key={m.key}
                              className={`flex items-start gap-2.5 p-2 rounded-xl border cursor-pointer transition ${
                                isChecked
                                  ? 'bg-purple-950/30 border-purple-500/40 text-purple-200'
                                  : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  setUserFormData({
                                    ...userFormData,
                                    permissions: {
                                      ...userFormData.permissions,
                                      [m.key]: e.target.checked
                                    }
                                  });
                                }}
                                className="mt-0.5 rounded border-slate-700 text-purple-600 focus:ring-0 w-3.5 h-3.5"
                              />
                              <div className="min-w-0">
                                <span className="font-semibold text-xs block text-white leading-tight">
                                  {m.icon} {m.label}
                                </span>
                                <span className="text-[10px] text-slate-400 block leading-tight mt-0.5">
                                  {m.desc}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={userFormData.active}
                        onChange={(e) => setUserFormData({ ...userFormData, active: e.target.checked })}
                        className="rounded border-slate-700 text-purple-600 focus:ring-0 w-4 h-4"
                      />
                      <span>Usuário Ativo (Pode fazer login)</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setUserModalOpen(false)}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={savingUser}
                        className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/30 transition active:scale-[0.98] disabled:opacity-50"
                      >
                        {savingUser && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>{editingUserId ? 'Salvar Alterações' : 'Criar Usuário'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          ABA 4: VENDEDORES
          ======================================================== */}
      {activeTab === 'vendedores' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BadgeDollarSign className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Módulo de Vendedores & Atendentes</h3>
                  <p className="text-[11px] text-slate-400">
                    Cadastre vendedores e comissões para separação automática do faturamento em relatórios diários, semanais, mensais e anuais.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenNewSeller}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition active:scale-[0.98] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Cadastrar Novo Vendedor</span>
              </button>
            </div>

            {sellerListFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  sellerListFeedback.type === 'success'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                }`}
              >
                {sellerListFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{sellerListFeedback.message}</span>
              </div>
            )}

            {/* Tabela de Vendedores */}
            {sellers.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 p-6 space-y-2">
                <BadgeDollarSign className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="font-semibold text-slate-300">Nenhum vendedor cadastrado ainda.</p>
                <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                  Cadastre seus atendentes para selecionar o responsável no fechamento de cada venda ou abertura de Ordem de Serviço.
                </p>
                <button
                  type="button"
                  onClick={handleOpenNewSeller}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Cadastrar Primeiro Vendedor</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                      <th className="py-2.5 px-3 font-semibold">Nome do Vendedor</th>
                      <th className="py-2.5 px-3 font-semibold">Telefone / WhatsApp</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Comissão</th>
                      <th className="py-2.5 px-3 font-semibold">Cadastrado em</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {sellers.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-900/40 transition">
                        <td className="py-3 px-3 font-medium text-white flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-[10px]">
                            {s.name.charAt(0)}
                          </div>
                          <span>{s.name}</span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">{s.phone || '—'}</td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            {Number(s.commissionRate || 0)}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400 text-[11px]">
                          {s.createdAt ? new Date(s.createdAt).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              s.active !== false
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${s.active !== false ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            {s.active !== false ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditSeller(s)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                              title="Editar vendedor"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleSellerActive(s)}
                              className={`p-1.5 rounded-lg transition ${
                                s.active !== false
                                  ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-400'
                                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400'
                              }`}
                              title={s.active !== false ? 'Desativar vendedor' : 'Ativar vendedor'}
                            >
                              {s.active !== false ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSellerClick(s)}
                              className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 transition"
                              title="Excluir vendedor"
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
            )}
          </div>

          {/* Modal de Cadastro / Edição de Vendedor */}
          {sellerModalOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
              onClick={(e) => {
                if (e.target === e.currentTarget) setSellerModalOpen(false);
              }}
            >
              <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/50">
                  <div className="flex items-center gap-2">
                    <BadgeDollarSign className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">
                      {editingSeller ? 'Editar Vendedor' : 'Cadastrar Novo Vendedor'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSellerModalOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveSellerForm} className="p-5 space-y-4">
                  {sellerFeedback && (
                    <div
                      className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                        sellerFeedback.type === 'success'
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      {sellerFeedback.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{sellerFeedback.message}</span>
                    </div>
                  )}

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Nome Completo do Vendedor *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Carlos Oliveira"
                      value={sellerFormData.name}
                      onChange={(e) => setSellerFormData({ ...sellerFormData, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 uppercase"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Telefone / WhatsApp</label>
                      <input
                        type="text"
                        placeholder="(00) 00000-0000"
                        value={sellerFormData.phone}
                        onChange={(e) => setSellerFormData({ ...sellerFormData, phone: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Comissão Padrão (%)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={sellerFormData.commissionRate}
                          onChange={(e) => setSellerFormData({ ...sellerFormData, commissionRate: Number(e.target.value) })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 pr-8"
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-bold">%</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={sellerFormData.active}
                        onChange={(e) => setSellerFormData({ ...sellerFormData, active: e.target.checked })}
                        className="rounded border-slate-700 text-emerald-600 focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                      <span>Vendedor Ativo (Aparece na seleção do PDV e OS)</span>
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSellerModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingSeller}
                      className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                    >
                      {savingSeller && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{editingSeller ? 'Salvar Vendedor' : 'Cadastrar Vendedor'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          ABA 5: LAYOUT GERAL DO SISTEMA
          ======================================================== */}
      {activeTab === 'layout' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Tema do Layout */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Esquema de Cores & Tema do Layout</h3>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
                3 Opções Disponíveis
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => handleThemeModeChange('escuro')}
                className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                  formData.themeMode === 'escuro'
                    ? 'bg-blue-600/15 border-blue-500 shadow-md shadow-blue-500/10 ring-2 ring-blue-500/30'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Moon className="w-4 h-4 text-blue-400" />
                    <span className="font-bold text-xs text-white">Tema Escuro</span>
                  </div>
                  {formData.themeMode === 'escuro' && (
                    <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Fundo escuro profundo. Reduz o cansaço visual em ambientes de bancada e pouca luz.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleThemeModeChange('claro')}
                className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                  formData.themeMode === 'claro'
                    ? 'bg-blue-600/15 border-blue-500 shadow-md shadow-blue-500/10 ring-2 ring-blue-500/30'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-xs text-white">Tema Claro</span>
                  </div>
                  {formData.themeMode === 'claro' && (
                    <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Fundo limpo e claro em toda a aplicação. Ideal para escritórios iluminados e balcões de atendimento.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleThemeModeChange('misto')}
                className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                  formData.themeMode === 'misto'
                    ? 'bg-blue-600/15 border-blue-500 shadow-md shadow-blue-500/10 ring-2 ring-blue-500/30'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <span className="font-bold text-xs text-white">Tema Misto</span>
                  </div>
                  {formData.themeMode === 'misto' && (
                    <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Menu lateral escuro com área principal e formulários em fundo branco. Máximo contraste profissional.
                </p>
              </button>
            </div>
          </div>

          {/* 2. Tipografia e Fontes */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Type className="w-5 h-5 text-sky-400" />
                <h3 className="text-sm font-bold text-white">Tipografia & Configuração de Fontes</h3>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold">
                Família & Tamanhos
              </span>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Tipo de Fonte do Programa</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {fontOptions.map((font) => {
                  const isSelected = formData.fontFamily === font.id;
                  return (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => handleFontFamilyChange(font.id)}
                      className={`p-3 rounded-xl border text-left transition-all relative cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600/15 border-blue-500 shadow-sm ring-1 ring-blue-500/40 text-white'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-950'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs" style={{ fontFamily: font.fontName }}>
                          {font.label}
                        </span>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        {font.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tamanhos Individuais de Fontes */}
            <div className="border-t border-slate-800/80 pt-6 space-y-4">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tamanhos de Fontes Individuais</span>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-2.5">
                  <label className="text-[11px] font-bold text-white block">Tamanho da Fonte de Texto</label>
                  <select
                    value={formData.fontSizeText || 'padrao'}
                    onChange={(e) => handleFontSizeTextChange(e.target.value as FontSizeText)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="pequeno">Pequeno (11.5px)</option>
                    <option value="padrao">Padrão (13px)</option>
                    <option value="medio">Médio (14.5px)</option>
                    <option value="grande">Grande (16px)</option>
                    <option value="extra_grande">Extra Grande (17.5px)</option>
                  </select>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-2.5">
                  <label className="text-[11px] font-bold text-white block">Tamanho da Fonte de Títulos</label>
                  <select
                    value={formData.fontSizeHeading || 'padrao'}
                    onChange={(e) => handleFontSizeHeadingChange(e.target.value as FontSizeHeading)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="pequeno">Pequeno (14px)</option>
                    <option value="padrao">Padrão (16px)</option>
                    <option value="medio">Médio (18px)</option>
                    <option value="grande">Grande (20px)</option>
                    <option value="extra_grande">Extra Grande (22px)</option>
                  </select>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-2.5">
                  <label className="text-[11px] font-bold text-white block">Fonte de Rodapés / Legendas</label>
                  <select
                    value={formData.fontSizeFooter || 'padrao'}
                    onChange={(e) => handleFontSizeFooterChange(e.target.value as FontSizeFooter)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="pequeno">Pequeno (9.5px)</option>
                    <option value="padrao">Padrão (11px)</option>
                    <option value="medio">Médio (12.5px)</option>
                    <option value="grande">Grande (14px)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Personalização da Marca (Logo, Nome da Loja, Abas, Ícones, Cor Primária) */}
            <div className="border-t border-slate-800/80 pt-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Personalização da Logo, Marca, Abas e Cores
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Ajuste o tamanho da logo, fontes da marca, cores de destaque e botões com pré-visualização instantânea.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetVisualDefaults}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition cursor-pointer"
                  title="Restaurar todos os tamanhos, fontes e cores para os padrões originais"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Restaurar Padrões Visuais</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Tamanho da Logo */}
                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-sky-400" />
                      <span>Tamanho da Logo no Dashboard</span>
                    </label>
                    <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-mono font-bold">
                      {formData.dashboardLogoSize || 44}px
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adjustNumericVisual('dashboardLogoSize', -4, 28, 96)}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="range"
                      min="28"
                      max="96"
                      step="2"
                      value={formData.dashboardLogoSize || 44}
                      onChange={(e) => updateVisualField('dashboardLogoSize', Number(e.target.value))}
                      className="flex-1 accent-sky-500 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => adjustNumericVisual('dashboardLogoSize', 4, 28, 96)}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {[
                      { label: '36px Pequena', size: 36 },
                      { label: '44px Padrão', size: 44 },
                      { label: '56px Média', size: 56 },
                      { label: '72px Grande', size: 72 }
                    ].map((item) => (
                      <button
                        key={item.size}
                        type="button"
                        onClick={() => updateVisualField('dashboardLogoSize', item.size)}
                        className={`py-1 px-2 rounded-lg text-[10px] font-semibold border transition ${
                          formData.dashboardLogoSize === item.size
                            ? 'bg-blue-600/20 text-blue-300 border-blue-500'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nome da Loja */}
                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-2">
                      <Store className="w-4 h-4 text-blue-400" />
                      <span>Nome da Loja (Tamanho & Cor)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-mono font-bold">
                        {formData.storeNameFontSize || 14}px
                      </span>
                      <input
                        type="color"
                        value={formData.storeNameColor || '#ffffff'}
                        onChange={(e) => updateVisualField('storeNameColor', e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer border border-slate-700 bg-transparent p-0"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adjustNumericVisual('storeNameFontSize', -1, 12, 32)}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="range"
                      min="12"
                      max="32"
                      step="1"
                      value={formData.storeNameFontSize || 14}
                      onChange={(e) => updateVisualField('storeNameFontSize', Number(e.target.value))}
                      className="flex-1 accent-blue-500 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => adjustNumericVisual('storeNameFontSize', 1, 12, 32)}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {COLOR_PALETTES.brand.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => updateVisualField('storeNameColor', c.hex)}
                        className={`w-5 h-5 rounded-full border transition ${
                          formData.storeNameColor?.toLowerCase() === c.hex.toLowerCase()
                            ? 'ring-2 ring-blue-400 scale-110 border-white'
                            : 'border-slate-700'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Abas de Seleção */}
                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-400" />
                      <span>Abas de Seleção / Navegação</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-mono font-bold">
                        {formData.selectionTabFontSize || 12}px
                      </span>
                      <input
                        type="color"
                        value={formData.selectionTabActiveColor || '#2563eb'}
                        onChange={(e) => updateVisualField('selectionTabActiveColor', e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer border border-slate-700 bg-transparent p-0"
                        title="Cor da Aba Ativa"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adjustNumericVisual('selectionTabFontSize', -1, 10, 22)}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="range"
                      min="10"
                      max="22"
                      step="1"
                      value={formData.selectionTabFontSize || 12}
                      onChange={(e) => updateVisualField('selectionTabFontSize', Number(e.target.value))}
                      className="flex-1 accent-indigo-500 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => adjustNumericVisual('selectionTabFontSize', 1, 10, 22)}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {COLOR_PALETTES.primary.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => updateVisualField('selectionTabActiveColor', c.hex)}
                        className={`w-5 h-5 rounded-full border transition ${
                          formData.selectionTabActiveColor?.toLowerCase() === c.hex.toLowerCase()
                            ? 'ring-2 ring-white scale-110 border-white'
                            : 'border-slate-700'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Ícones Gerais e Cor Primária */}
                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Ícones Gerais do Sistema</span>
                    </label>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-mono font-bold">
                      {formData.iconSizeGeneral || 18}px
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adjustNumericVisual('iconSizeGeneral', -2, 12, 34)}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="range"
                      min="12"
                      max="34"
                      step="2"
                      value={formData.iconSizeGeneral || 18}
                      onChange={(e) => updateVisualField('iconSizeGeneral', Number(e.target.value))}
                      className="flex-1 accent-amber-500 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => adjustNumericVisual('iconSizeGeneral', 2, 12, 34)}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <label className="text-[11px] text-slate-400">Cor Primária de Botões:</label>
                    <input
                      type="color"
                      value={formData.primaryColor || '#2563eb'}
                      onChange={(e) => updateVisualField('primaryColor', e.target.value)}
                      className="w-5 h-5 rounded cursor-pointer border border-slate-700 bg-transparent p-0"
                    />
                    <span className="text-[10px] font-mono text-white uppercase">{formData.primaryColor || '#2563eb'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition active:scale-[0.98] cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Configurações de Layout</span>
            </button>
          </div>
        </form>
      )}

      {/* ========================================================
          ABA 6: INFORMAÇÕES DA LOJA
          ======================================================== */}
      {activeTab === 'loja' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30 flex items-center justify-center">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Identificação da Loja / Assistência Técnica</h3>
                  <p className="text-[11px] text-slate-400">
                    Dados cadastrais que aparecem nos cabeçalhos de ordens de serviço, comprovantes do PDV e notas.
                  </p>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold uppercase">
                Dados Cadastrais
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Razão Social *</label>
                <input
                  type="text"
                  required
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white uppercase focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Nome Fantasia (Aparece no Cupom e OS)</label>
                <input
                  type="text"
                  value={formData.tradeName}
                  onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white uppercase focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-slate-400">CNPJ</label>
                  {cleanDigits(formData.cnpj).length === 14 && (
                    <button
                      type="button"
                      disabled={isSearchingCnpj}
                      onClick={() => performCnpjLookup(cleanDigits(formData.cnpj))}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 transition"
                    >
                      {isSearchingCnpj ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                      <span>Consultar Dados na Receita</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="00.000.000/0000-00"
                  value={formData.cnpj}
                  onChange={handleCnpjChange}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
                {cnpjFeedback && (
                  <div
                    className={`mt-1.5 p-2 rounded-lg border text-[11px] flex items-center gap-1.5 ${
                      cnpjFeedback.type === 'success'
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                        : cnpjFeedback.type === 'error'
                        ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                        : 'bg-blue-950/60 text-blue-300 border-blue-800/60'
                    }`}
                  >
                    {cnpjFeedback.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />}
                    {cnpjFeedback.type === 'error' && <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />}
                    {cnpjFeedback.type === 'info' && <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-blue-400" />}
                    <span className="truncate">{cnpjFeedback.message}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Inscrição Estadual (IE)</label>
                <input
                  type="text"
                  value={formData.ie || ''}
                  onChange={(e) => setFormData({ ...formData, ie: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white uppercase focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Telefone Fixo / Comercial</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">WhatsApp da Loja</label>
                <input
                  type="text"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">E-mail de Contato</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white normal-case focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="border-t border-slate-800/80 pt-4 space-y-4">
              <h4 className="text-xs font-bold text-white">Endereço da Empresa</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">CEP</label>
                  <input
                    type="text"
                    value={formData.cep}
                    onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[11px] text-slate-400 block mb-1">Logradouro (Rua / Avenida)</label>
                  <input
                    type="text"
                    value={formData.street}
                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white uppercase focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Número</label>
                  <input
                    type="text"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white uppercase focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Bairro</label>
                  <input
                    type="text"
                    value={formData.neighborhood}
                    onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white uppercase focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Cidade</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white uppercase focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Estado (UF)</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white uppercase font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Diretório de Armazenamento e Envio de Documentos (Loja / Sistema) */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-sky-400" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Diretório de Salvamento e Envio de Documentos</h4>
                    <p className="text-[10px] text-slate-400">
                      Pasta no computador onde são baixadas, salvas e organizadas as ordens de serviço, recibos de vendas e relatórios emitidos.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold uppercase">
                  Armazenamento Local
                </span>
              </div>

              <div>
                <label className="text-[11px] text-slate-300 font-medium block mb-1.5">
                  Caminho da Pasta / Diretório no Computador
                </label>
                <input
                  type="text"
                  placeholder="Ex: C:\InfoTech_Documentos ou C:\Users\Power\Documents\InfoTech_Documentos"
                  value={formData.documentsDirectory || ''}
                  onChange={(e) => setFormData({ ...formData, documentsDirectory: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-sky-500"
                />
                <p className="text-[10px] text-slate-400 mt-1.5">
                  📄 <strong>Padrão de nomeação das Ordens de Serviço:</strong> [Número da OS] - [Nome do Cliente].pdf (Ex: <em>1042 - João Silva.pdf</em>)
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80 flex-wrap">
                <span className="text-[10px] text-slate-400">Sugestões rápidas:</span>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, documentsDirectory: 'C:\\InfoTech_Documentos' })}
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-sky-400 border border-slate-800 hover:border-sky-500/40 transition cursor-pointer"
                >
                  C:\InfoTech_Documentos
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, documentsDirectory: 'C:\\Users\\Power\\Documents\\InfoTech_Documentos' })}
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-cyan-400 border border-slate-800 hover:border-cyan-500/40 transition cursor-pointer"
                >
                  Documentos do Usuário
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition active:scale-[0.98] cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Informações da Loja</span>
            </button>
          </div>
        </form>
      )}

      {/* MODAL DE SENHA DO ADMINISTRADOR PARA EXCLUSÕES */}
      <AdminPasswordModal {...adminModalProps} />
    </div>
  );
};
