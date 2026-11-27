const fs = require('fs');
const path = require('path');
const { isSupabaseConfigured, initSupabase, saveToSupabase, getCloudVersion } = require('./supabaseService');

const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', 'powertech_data')
  : (process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const DB_FILE = path.join(DATA_DIR, 'database.json');

const INITIAL_DATA = {
  storeSettings: {
    storeName: "Power Tech - Assistência Técnica & Vendas",
    tradeName: "Power Tech",
    cnpj: "12.345.678/0001-90",
    ie: "123.456.789.110",
    phone: "(11) 3456-7890",
    whatsapp: "5511987654321",
    email: "contato@powertech.com.br",
    street: "Av. Principal do Comércio",
    number: "500",
    neighborhood: "Centro",
    city: "São Paulo",
    state: "SP",
    cep: "01001-000",
    pixKey: "12.345.678/0001-90",
    pixType: "cnpj",
    warrantyTerms: "1. A garantia cobre exclusivamente os serviços executados e peças substituídas pelo prazo de 90 dias (conforme Art. 26 do Código de Defesa do Consumidor).\n2. A garantia é automaticamente invalidada em caso de violação dos lacres internos, queda física, derramamento de líquidos, descargas elétricas ou intervenção de terceiros.\n3. O cliente tem o prazo máximo de 90 dias para retirar o equipamento pronto ou com orçamento recusado, sob pena de cobrança de taxa de guarda ou descarte conforme a lei.",
    printerType: "termica_80mm",
    autoPrintAfterSave: true,
    osDeliveredMessageEnabled: false,
    osDeliveredMessageTemplate: "Olá, *{cliente}*! 👋\n\nSeu equipamento *{equipamento}* (Ordem de Serviço *#{numero_os}*) foi entregue com sucesso! 🤝🎉\n\nAgradecemos imensamente pela preferência e pela confiança em nossos serviços.\n\nQualquer dúvida ou caso necessite de suporte, estamos à sua inteira disposição!\n\n_Power Tech - Qualidade e transparência para você!_ 🚀",
    posSaleMessageEnabled: false,
    posSaleMessageTemplate: "Olá, *{cliente}*! 👋\n\nAgradecemos imensamente pela preferência em realizar sua compra conosco na *{loja}*! 🤝🎉\n\nQualquer dúvida sobre os produtos ou caso precise de suporte com a garantia, conte sempre conosco!\n\n_Power Tech - Volte sempre!_ 🚀"
  },
  fiscalConfig: {
    companyName: "Power Tech Soluções em Informática Ltda",
    tradeName: "Power Tech",
    cnpj: "12.345.678/0001-90",
    stateRegistration: "123.456.789.110",
    municipalRegistration: "987654-3",
    taxRegime: "simples_nacional",
    apiProvider: "simulador",
    apiToken: "TOKEN_DEMO_NUVEM_FISCAL_12345",
    environment: "homologacao",
    defaultNfeCfop: "5102",
    defaultNfseCnae: "9511-8/00",
    defaultNfseServiceCode: "14.01",
    issRate: 3.5
  },
  backupSettings: {
    autoDailyBackup: true,
    backupTime: "18:00",
    backupDirectory: path.join(process.env.USERPROFILE || 'C:\\', 'PowerTech_Backups'),
    lastBackupAt: new Date().toISOString(),
    lastBackupStatus: "sucesso",
    lastBackupMessage: "Backup inicial gerado com sucesso.",
    retainDays: 30
  },
  backupHistory: [],
  customers: [
    {
      id: "cust-1",
      name: "Carlos Eduardo da Silva",
      document: "123.456.789-00",
      phone: "(11) 98765-1122",
      whatsapp: "5511987651122",
      email: "carlos.edu@gmail.com",
      street: "Rua das Flores",
      number: "120",
      neighborhood: "Jardim Paulista",
      city: "São Paulo",
      state: "SP",
      cep: "01415-000",
      notes: "Cliente fiel, sempre traz notebooks da família.",
      createdAt: new Date().toISOString()
    },
    {
      id: "cust-2",
      name: "Mariana Souza Santos",
      document: "987.654.321-99",
      phone: "(11) 97711-2233",
      whatsapp: "5511977112233",
      email: "mariana.adv@hotmail.com",
      street: "Alameda Santos",
      number: "850",
      complement: "Sala 42",
      neighborhood: "Cerqueira César",
      city: "São Paulo",
      state: "SP",
      cep: "01418-100",
      notes: "Escritório de advocacia, necessita de agilidade em impressoras.",
      createdAt: new Date().toISOString()
    },
    {
      id: "cust-3",
      name: "Tech Soluções Empresariais ME",
      document: "33.444.555/0001-22",
      phone: "(11) 3222-4455",
      whatsapp: "5511999887766",
      email: "compras@techsolucoes.com.br",
      street: "Rua Bela Cintra",
      number: "1000",
      neighborhood: "Consolação",
      city: "São Paulo",
      state: "SP",
      cep: "01415-001",
      notes: "Contrato de manutenção e compra de peças.",
      createdAt: new Date().toISOString()
    }
  ],
  products: [
    {
      id: "prod-1",
      code: "SSD500NV2",
      name: "SSD Kingston NV2 500GB M.2 NVMe PCIe 4.0",
      category: "pecas",
      brand: "Kingston",
      costPrice: 175.00,
      sellingPrice: 280.00,
      stock: 12,
      minStock: 4,
      unit: "UN",
      ncm: "84717090",
      cfop: "5102",
      isActive: true
    },
    {
      id: "prod-2",
      code: "SSD240SATA",
      name: "SSD Kingston A400 240GB SATA III 2.5",
      category: "pecas",
      brand: "Kingston",
      costPrice: 95.00,
      sellingPrice: 160.00,
      stock: 8,
      minStock: 3,
      unit: "UN",
      ncm: "84717090",
      cfop: "5102",
      isActive: true
    },
    {
      id: "prod-3",
      code: "MEM8GD4",
      name: "Memória RAM Kingston Fury Beast 8GB DDR4 3200MHz",
      category: "pecas",
      brand: "Kingston",
      costPrice: 110.00,
      sellingPrice: 185.00,
      stock: 6,
      minStock: 2,
      unit: "UN",
      ncm: "84733042",
      cfop: "5102",
      isActive: true
    },
    {
      id: "prod-4",
      code: "FONTE500W",
      name: "Fonte de Alimentação 500W 80 Plus Bronze PFC Ativo",
      category: "pecas",
      brand: "Mancer",
      costPrice: 155.00,
      sellingPrice: 260.00,
      stock: 5,
      minStock: 2,
      unit: "UN",
      ncm: "85044021",
      cfop: "5102",
      isActive: true
    },
    {
      id: "prod-5",
      code: "TONER105A",
      name: "Toner Compatível HP W1105A / 105A Preto Laser",
      category: "suprimentos",
      brand: "Premium",
      costPrice: 42.00,
      sellingPrice: 85.00,
      stock: 10,
      minStock: 3,
      unit: "UN",
      ncm: "84439923",
      cfop: "5102",
      isActive: true
    },
    {
      id: "prod-6",
      code: "TINTA544BK",
      name: "Refil de Tinta Epson T544 544 Preto Original 65ml",
      category: "suprimentos",
      brand: "Epson",
      costPrice: 38.00,
      sellingPrice: 65.00,
      stock: 14,
      minStock: 5,
      unit: "UN",
      ncm: "32159000",
      cfop: "5102",
      isActive: true
    },
    {
      id: "prod-7",
      code: "MON22LG",
      name: "Monitor LG 21.5'' Full HD IPS 75Hz HDMI/VGA",
      category: "monitor",
      brand: "LG",
      costPrice: 440.00,
      sellingPrice: 650.00,
      stock: 3,
      minStock: 2,
      unit: "UN",
      ncm: "85285200",
      cfop: "5102",
      isActive: true
    },
    {
      id: "prod-8",
      code: "CABOHDMI2M",
      name: "Cabo HDMI 2.0 4K Ultra HD Blindado 2 Metros",
      category: "cabos",
      brand: "MD9",
      costPrice: 12.00,
      sellingPrice: 28.00,
      stock: 25,
      minStock: 6,
      unit: "UN",
      ncm: "85444200",
      cfop: "5102",
      isActive: true
    },
    {
      id: "prod-9",
      code: "PASTASILVER",
      name: "Pasta Térmica Alta Condutividade Prata 1.5g",
      category: "pecas",
      brand: "Snowman",
      costPrice: 9.00,
      sellingPrice: 25.00,
      stock: 15,
      minStock: 5,
      unit: "UN",
      ncm: "38249999",
      cfop: "5102",
      isActive: true
    },
    {
      id: "prod-10",
      code: "KBMSUSB",
      name: "Kit Teclado e Mouse USB ABNT2 Preto Confort",
      category: "perifericos",
      brand: "Logitech",
      costPrice: 65.00,
      sellingPrice: 110.00,
      stock: 7,
      minStock: 3,
      unit: "UN",
      ncm: "84716052",
      cfop: "5102",
      isActive: true
    }
  ],
  services: [
    {
      id: "serv-1",
      code: "SRV-FORMAT",
      name: "Formatação Completa com Backup e Instalação de Drivers/Softwares",
      category: "formatacao",
      price: 130.00,
      estimatedHours: 2.5,
      defaultWarrantyDays: 90
    },
    {
      id: "serv-2",
      code: "SRV-LIMP",
      name: "Limpeza Preventiva e Troca de Pasta Térmica (Desktop/Notebook)",
      category: "limpeza",
      price: 120.00,
      estimatedHours: 1.5,
      defaultWarrantyDays: 90
    },
    {
      id: "serv-3",
      code: "SRV-COMBO",
      name: "Combo Preventivo: Formatação + Limpeza Física + Troca de Pasta Térmica",
      category: "formatacao",
      price: 200.00,
      estimatedHours: 3.5,
      defaultWarrantyDays: 90
    },
    {
      id: "serv-4",
      code: "SRV-TELA-NB",
      name: "Mão de Obra de Troca de Tela de Notebook / Ultrabook",
      category: "tela_teclado",
      price: 150.00,
      estimatedHours: 1.0,
      defaultWarrantyDays: 90
    },
    {
      id: "serv-5",
      code: "SRV-REPARO-CARCACA",
      name: "Reparo Estrutural de Carcaça e Reconstrução de Dobradiças de Notebook",
      category: "hardware",
      price: 180.00,
      estimatedHours: 4.0,
      defaultWarrantyDays: 90
    },
    {
      id: "serv-6",
      code: "SRV-IMP-DESENT",
      name: "Desobstrução e Limpeza Química de Cabeça de Impressão Tanque de Tinta",
      category: "impressora",
      price: 140.00,
      estimatedHours: 2.0,
      defaultWarrantyDays: 90
    },
    {
      id: "serv-7",
      code: "SRV-IMP-MECANICA",
      name: "Manutenção Mecânica de Tracionamento e Troca de Roletes de Impressora",
      category: "impressora",
      price: 160.00,
      estimatedHours: 2.5,
      defaultWarrantyDays: 90
    },
    {
      id: "serv-8",
      code: "SRV-PLACA-MAE",
      name: "Reparo Eletrônico em Placa Mãe (Curto na linha de 19V / 3V / 5V)",
      category: "hardware",
      price: 320.00,
      estimatedHours: 6.0,
      defaultWarrantyDays: 90
    }
  ],
  workOrders: [],
  pendingPhotoDeletions: [],
  sales: [],
  quotes: [],
  fiscalInvoices: [],
  users: [
    {
      id: "usr-admin-default-admin",
      username: "admin",
      name: "Administrador Power Tech",
      role: "admin",
      permissions: {
        dashboard: true,
        workOrders: true,
        workOrdersDelete: true,
        pos: true,
        quotes: true,
        inventory: true,
        services: true,
        customers: true,
        fiscal: true,
        backup: true,
        settings: true
      },
      active: true,
      passwordHash: "987074b834ccf519e53dc6aa9dc37d38:4bbffaa23cf5ad024d3b989793b3a15df68a70847239fc053a084eba0170dd06f514a7eca5dc535456aba2febb7992ad48839855bd84178d8bc7d519d4a6b829",
      createdAt: "2026-11-25T12:00:00.000Z"
    },
    {
      id: "usr-admin-powertech",
      username: "Powertech",
      name: "Power Tech Suporte",
      role: "admin",
      permissions: {
        dashboard: true,
        workOrders: true,
        workOrdersDelete: true,
        pos: true,
        quotes: true,
        inventory: true,
        services: true,
        customers: true,
        fiscal: true,
        backup: true,
        settings: true
      },
      active: true,
      passwordHash: "9e03ccc03a118fdd8c6a570f538d9d0f:b5c7600fb3118da215a12b33c42663c73a2d6051877d9cf550b8c478170f16a217dfdfe17dad82b747cb15cb7bb7283f7588c33ab7d6844bebb2857291c1855c",
      createdAt: "2026-11-25T12:00:00.000Z"
    }
  ],
  sellers: [],
  expenses: []
};

// Ensure directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  // Ignora se não puder criar de início
}

// In-memory cache e controle de sincronização com Supabase
let inMemoryDb = null;
let currentDbVersion = 1;
let isLoadedFromCloud = false;
let writeQueue = Promise.resolve();

function loadLocalDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      let baseData = INITIAL_DATA;
      const exampleFile = path.join(__dirname, '..', 'data', 'database.example.json');
      if (fs.existsSync(exampleFile)) {
        try {
          baseData = JSON.parse(fs.readFileSync(exampleFile, 'utf-8'));
          if (!baseData.users || baseData.users.length === 0) {
            baseData.users = INITIAL_DATA.users;
          }
        } catch (e) {
          baseData = INITIAL_DATA;
        }
      }
      return JSON.parse(JSON.stringify(baseData));
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    const data = JSON.parse(content);
    if (!data.expenses) data.expenses = [];
    if (!data.companies) data.companies = [];
    if (!data.companyPlans) {
      data.companyPlans = [
        {
          id: 'plan-1',
          name: 'PLANO BRONZE - SUPORTE PREVENTIVO',
          code: 'BRONZE-10',
          description: 'Manutenção preventiva periódica, limpeza interna e suporte remoto para até 10 equipamentos.',
          monthlyFee: 450,
          billingCycle: 'mensal',
          slaHours: 24,
          equipmentLimit: 10,
          preventiveVisitsPerMonth: 1,
          includesRemoteSupport: true,
          includesParts: false,
          coverageDetails: 'Atendimento presencial com 1 visita mensal agendada, monitoramento preventivo e suporte remoto em horário comercial.',
          active: true,
          createdAt: new Date().toISOString()
        },
        {
          id: 'plan-2',
          name: 'PLANO PRATA - TI CORPORATIVA & MANUTENÇÃO',
          code: 'PRATA-25',
          description: 'Cobertura preventiva e corretiva com SLA ágil de 8 horas para até 25 equipamentos.',
          monthlyFee: 980,
          billingCycle: 'mensal',
          slaHours: 8,
          equipmentLimit: 25,
          preventiveVisitsPerMonth: 2,
          includesRemoteSupport: true,
          includesParts: false,
          coverageDetails: '2 visitas preventivas mensais, chamados corretivos prioritários, suporte remoto ilimitado e inventário de patrimônio.',
          active: true,
          createdAt: new Date().toISOString()
        },
        {
          id: 'plan-3',
          name: 'PLANO OURO - GESTÃO TOTAL DE TI',
          code: 'OURO-ILIMITADO',
          description: 'Gestão completa do parque computacional, SLA urgente de 4 horas, visitas semanais e atendimento VIP.',
          monthlyFee: 1850,
          billingCycle: 'mensal',
          slaHours: 4,
          equipmentLimit: 0,
          preventiveVisitsPerMonth: 4,
          includesRemoteSupport: true,
          includesParts: true,
          coverageDetails: 'Equipamentos ilimitados, visitas preventivas semanais, consultoria em segurança, backup monitorado e desconto em peças.',
          active: true,
          createdAt: new Date().toISOString()
        }
      ];
    }
    if (!data.companyEquipments) data.companyEquipments = [];
    if (!data.companyMaintenances) data.companyMaintenances = [];
    if (!data.pendingPhotoDeletions) data.pendingPhotoDeletions = [];
    return data;
  } catch (error) {
    console.error('Erro ao ler banco de dados local:', error);
    return JSON.parse(JSON.stringify(INITIAL_DATA));
  }
}

/**
 * Garante que o banco de dados seja carregado do Supabase
 * antes de qualquer rota processar a requisição.
 * Se o Supabase estiver configurado e falhar, bloqueia a operação para evitar uso de cópia desatualizada.
 */
async function ensureDatabaseLoaded() {
  if (isSupabaseConfigured()) {
    try {
      // 1. Se já carregou na memória deste contêiner, verifica se a versão na nuvem mudou
      if (isLoadedFromCloud && inMemoryDb) {
        const cloudVersion = await getCloudVersion();
        if (cloudVersion !== null && cloudVersion === currentDbVersion) {
          return inMemoryDb;
        }
      }

      // 2. Primeira carga ou versão mais recente detectada no Supabase
      const fallback = inMemoryDb || loadLocalDatabase();
      const cloudResult = await initSupabase(fallback);
      if (cloudResult && cloudResult.data) {
        inMemoryDb = cloudResult.data;
        currentDbVersion = Number(cloudResult.version || 1);
        isLoadedFromCloud = true;
        try {
          const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
          fs.writeFileSync(tempFile, JSON.stringify(inMemoryDb, null, 2), 'utf-8');
          fs.renameSync(tempFile, DB_FILE);
          console.log(`[Supabase Sync] Banco carregado da nuvem com sucesso (Versão ${currentDbVersion}).`);
        } catch (e) {}
        return inMemoryDb;
      }

      throw new Error('Falha ao obter os dados atualizados do banco Supabase.');
    } catch (err) {
      console.error('[Supabase Load Error]', err.message);
      // Em produção (com Supabase configurado), NUNCA usar cópia local desatualizada silenciosamente!
      throw new Error(`Falha de conexão com o banco de dados remoto: ${err.message}. Operação bloqueada para proteção dos dados.`);
    }
  }

  // Apenas em desenvolvimento local (sem Supabase configurado)
  if (!inMemoryDb) {
    inMemoryDb = loadLocalDatabase();
    currentDbVersion = 1;
  }
  return inMemoryDb;
}

// Atomic load
function getDatabase() {
  if (!inMemoryDb) {
    inMemoryDb = loadLocalDatabase();
    currentDbVersion = 1;
  }
  return inMemoryDb;
}

function getCurrentDbVersion() {
  return currentDbVersion;
}

// Atomic save assíncrono com mutex de processo e controle de concorrência otimista (OCC)
async function saveDatabase(data) {
  return new Promise((resolve, reject) => {
    writeQueue = writeQueue.then(async () => {
      try {
        // Se o Supabase estiver configurado, persiste na nuvem com controle otimista de versão
        if (isSupabaseConfigured()) {
          const result = await saveToSupabase(data, currentDbVersion);
          if (result && result.version) {
            currentDbVersion = Number(result.version);
          }
        } else {
          currentDbVersion++;
        }

        inMemoryDb = data;

        // 2. Grava cópia local em disco (para desenvolvimento e backup físico)
        try {
          const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
          fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
          fs.renameSync(tempFile, DB_FILE);
        } catch (error) {
          console.error('Erro ao salvar cópia local em disco:', error.message);
        }

        resolve(true);
      } catch (err) {
        reject(err);
      }
    });
  });
}

module.exports = {
  getDatabase,
  saveDatabase,
  ensureDatabaseLoaded,
  getCurrentDbVersion,
  DB_FILE,
  DATA_DIR
};
