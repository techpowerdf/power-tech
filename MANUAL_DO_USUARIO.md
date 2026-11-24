# 🖥️ InfoTech Gestão - Manual de Uso do Sistema

Sistema comercial e de assistência técnica desenvolvido especialmente para lojas do segmento de informática (manutenção e venda de computadores, notebooks, monitores e impressoras).

---

## 🚀 1. Como Iniciar o Sistema no Computador

Você pode abrir o sistema de três maneiras simples:

1. **Pelo Atalho na Área de Trabalho**:
   - Dê um duplo clique no ícone **InfoTech Gestão** que já foi criado na sua Área de Trabalho.
2. **Pela Pasta do Sistema**:
   - Abra a pasta `C:\Users\Power\.gemini\antigravity\scratch\infotech-gestao`
   - Dê um duplo clique em `INICIAR_INFOTECH.bat` (ou em `INICIAR_SILENCIOSO.vbs`).
3. **Pelo Navegador (Rede Local ou Terminal Adicional)**:
   - Acesse diretamente: `http://localhost:4567`

---

## 🛠️ 2. Módulos e Recursos do Sistema

### 📋 A. Ordens de Serviço (OS)
- **Entrada do Aparelho**: Selecione o cliente, tipo de equipamento (Computador, Notebook, Monitor, Impressora ou Outro), marca, modelo, número de série e acessórios deixados (fonte, cabo de força, cabos de dados).
- **Checklist de Entrada**: Registre se o aparelho liga, se veio com carregador/fonte, avarias visíveis (arranhões, tampa trincada) e senha do Windows/BIOS para testes da bancada.
- **Defeito e Laudo Técnico**: Campo exclusivo para o relato do cliente e campo para o diagnóstico e laudo do laboratório.
- **Peças & Mão de Obra**: Adicione serviços de mão de obra e peças diretamente do seu estoque (dá baixa automática nas peças utilizadas).
- **Fluxo de Status**: Aberta ➔ Em Análise ➔ Aguardando Orçamento ➔ Aprovada ➔ Na Bancada ➔ Aguardando Peça ➔ Pronta Retirada ➔ Entregue.
- **Notificação no WhatsApp**: Botão com ícone do WhatsApp que gera a mensagem pré-formatada para o cliente com número da OS, modelo do aparelho e valor total com 1 clique!
- **Impressão**:
  - **Formato A4**: Comprovante com via da loja e via do cliente com canhoto destacável e **Termo de Garantia de 90 dias (CDC)**.
  - **Formato Térmico (80mm / 58mm)**: Para impressoras de cupom não fiscal de balcão (Epson, Elgin, Bematech).

### 🛒 B. Frente de Caixa & Ponto de Venda (PDV)
- **Venda Ágil**: Leitura por leitor de código de barras ou busca rápida por nome.
- **Catálogo Visual**: Filtros por categorias (Peças de PC/Notebook, Monitores, Impressoras e Tintas/Toners, Periféricos, Cabos).
- **Formas de Pagamento**:
  - **Dinheiro**: Cálculo automático de troco a devolver.
  - **PIX**: Exibição da chave PIX cadastrada da sua loja.
  - **Cartão de Débito**.
  - **Cartão de Crédito**: Parcelamento de 1x a 12x.
  - **A Prazo / Crediário / Faturado**: Para clientes e empresas parceiras.
- **Cupom e NF-e**: Impressão instantânea de comprovante e opção de emissão de NF-e.

### 📑 C. Orçamentos & Propostas Comerciais
- Elaboração rápida de orçamentos para consertos ou montagem de computadores.
- Definição da validade da proposta (ex: 7 a 15 dias).
- **Ações em 1 Clique**:
  - **"Gerar OS"**: Converte o orçamento aprovado em uma Ordem de Serviço na bancada sem precisar digitar nada novamente.
  - **"Enviar no WhatsApp"**: Envia o resumo e valor para aprovação do cliente.
  - **"Imprimir Orçamento"**: Layout executivo para impressão.

### 📦 D. Estoque de Peças e Produtos
- Cadastro de peças, periféricos, toners, tintas e computadores.
- Preço de custo, cálculo automático de margem de lucro % e preço de venda.
- Estoque mínimo com alerta visual na barra lateral quando os itens estiverem esgotando.
- NCM e CFOP vinculados para emissão fiscal.

### ⚙️ E. Tabela de Mão de Obra (Serviços)
- Cadastro de serviços padrão: Formatação com Backup, Limpeza Preventiva com Pasta Térmica, Reparo de Placa-mãe, Troca de Tela, Desentupimento de Impressora Epson, Troca de Roletes.
- Definição de tempo médio e prazo de garantia padrão (90 dias).

### 👥 F. Clientes
- Cadastro completo de pessoa física (CPF) ou jurídica (CNPJ).
- Endereço, telefones e botão direto para abrir conversa no WhatsApp.
- Histórico de aparelhos e manutenções anteriores.

### 🧾 G. Módulo Fiscal (NF-e & NFS-e)
- **NF-e (Venda de Mercadorias)**: Para produtos e peças de informática junto à SEFAZ.
- **NFS-e (Serviços de Manutenção)**: Para serviços técnicos junto à Prefeitura.
- **Simulador / Homologação**: Ativo por padrão para você treinar e testar sem gerar custos fiscais.
- **Integração Real**: Suporta provedores modernos de API fiscal (Nuvem Fiscal ou Focus NFe). Basta assinar e colar o Token nas configurações fiscais.

### 🛡️ H. Backup Diário Automático & Segurança
- **Automático**: O sistema verifica e grava uma cópia de segurança diária completa dos seus dados.
- **Localização Padrão**: `C:\Users\Power\InfoTech_Backups`.
- **Botão "Fazer Backup Agora"**: Presente na barra lateral para gerar cópias instantâneas a qualquer hora.
- **Pen Drive ou Nuvem**: Nas configurações de backup, você pode alterar a pasta para uma pasta sincronizada do Google Drive, OneDrive ou Pen Drive (ex: `D:\Backups_Loja`).
- **Retenção de 30 Dias**: Exclui automaticamente backups com mais de 30 dias para economizar espaço em disco.
- **Restauração em 1 Clique**: Em caso de troca de computador ou reinstalação, selecione o arquivo de backup e recupere 100% dos seus dados com segurança.

---

## 🏢 3. Personalização dos Dados da sua Loja

Na aba **Configurações**:
1. Preencha a **Razão Social, Nome Fantasia, CNPJ, IE e Telefones/WhatsApp**.
2. Cadastre sua **Chave PIX** para aparecer no caixa e no comprovante do cliente.
3. Escolha o formato da impressora: **Térmica 80mm**, **Térmica 58mm** ou **Folha A4**.
4. Revise o **Termo de Garantia Legal (CDC Art. 26)** para proteger a sua assistência técnica contra aparelhos que sofreram quedas, contato com líquidos ou lacres violados.
