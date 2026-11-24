# Manual de Implantação e Operação em Produção (VPS Linux)
## Sistema InfoTech Gestão / Power Tech

Este documento detalha todos os procedimentos técnicos para implantar, hospedar, configurar, fazer backup e restaurar o sistema em uma VPS Linux (Ubuntu 22.04 / 24.04 LTS ou Debian 12) com 100% de disponibilidade 24/7, segurança contra acessos indevidos e domínio próprio com certificado SSL.

---

## 1. Requisitos de Infraestrutura Recomendados

- **Servidor:** VPS Linux (Ubuntu 22.04 / 24.04 LTS ou Debian 12).
- **Recursos mínimos:** 1 vCPU, 1 GB a 2 GB de RAM, 20 GB de armazenamento SSD/NVMe.
  *(Provedores recomendados de excelente custo-benefício: Hetzner, Contabo, DigitalOcean, Linode ou Hostinger VPS - aprox. R$ 25 a R$ 45/mês)*.
- **Domínio próprio:** Exemplo: `sistema.sualoja.com.br` ou `os.sualoja.com.br`.
- **Runtimes necessários:** Node.js 20+ ou 22+ LTS, NPM, PM2, Nginx, Certbot (Let's Encrypt).

---

## 2. Preparação do Servidor Linux

### 2.1. Atualização do Sistema Operacional e Instalação de Utilitários
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw nginx certbot python3-certbot-nginx
```

### 2.2. Instalação do Node.js LTS (Versão 22.x)
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v # Deve exibir v22.x ou superior
```

### 2.3. Instalação do Gerenciador de Processos PM2
```bash
sudo npm install -g pm2
```

### 2.4. Criação dos Diretórios Persistentes de Dados e Backup
```bash
sudo mkdir -p /var/data/infotech
sudo mkdir -p /var/backups/infotech
sudo chown -R $USER:$USER /var/data/infotech
sudo chown -R $USER:$USER /var/backups/infotech
chmod 700 /var/data/infotech
chmod 700 /var/backups/infotech
```

---

## 3. Implantação do Código do Sistema

### 3.1. Clonagem ou Envio dos Arquivos para a VPS
Recomenda-se colocar o sistema no diretório `/var/www/infotech-gestao`:
```bash
sudo mkdir -p /var/www/infotech-gestao
sudo chown -R $USER:$USER /var/www/infotech-gestao
cd /var/www/infotech-gestao
```
*(Envie os arquivos do projeto via Git, SCP, SFTP ou rsync)*

### 3.2. Instalação de Dependências e Build do Frontend
```bash
cd /var/www/infotech-gestao
npm ci --omit=dev # ou npm install
npm run build
```

### 3.3. Configuração das Variáveis de Ambiente (`.env`)
Copie o modelo `.env.example` e edite os valores reais:
```bash
cp .env.example .env
nano .env
```
Exemplo de preenchimento do `.env`:
```env
NODE_ENV=production
PORT=4567
APP_URL=https://sistema.sualoja.com.br
JWT_SECRET=c2e8f190e8a712f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9
INITIAL_ADMIN_PASSWORD=SenhaAdminForte@2026!
DATA_DIR=/var/data/infotech
BACKUP_DIR=/var/backups/infotech
ENABLE_CLOUDFLARE_TUNNEL=false
```
> [!IMPORTANT]
> Gere uma chave aleatória para o `JWT_SECRET` com o comando:
> `openssl rand -hex 32`

---

## 4. Migração e Preservação dos Dados Históricos

Para transferir o banco de dados original da loja sem nenhuma perda de OSs, vendas, clientes ou produtos:

1. Localize o arquivo `data/database.json` no computador de origem.
2. Copie para a VPS no diretório `/var/data/infotech/database.json`.
3. Certifique-se de que as permissões pertencem ao usuário que executa a aplicação:
   ```bash
   chmod 600 /var/data/infotech/database.json
   ```
4. Ao iniciar pela primeira vez, o sistema irá:
   - Preservar todas as ordens de serviço e seus números sequenciais (#1001, #1002...).
   - Gerar de forma transparente os tokens criptográficos únicos (`trackingToken` e `receiptToken`) para os registros legados.
   - Criar o usuário `admin` caso ainda não exista tabela de usuários.

---

## 5. Inicialização com PM2 e Autoinicialização no Boot

Para garantir que o sistema reinicie automaticamente se a VPS for reiniciada:

```bash
cd /var/www/infotech-gestao
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
# Execute o comando sudo gerado pelo pm2 startup na tela
```

Comandos úteis do PM2:
- Ver status: `pm2 status`
- Ver logs em tempo real: `pm2 logs infotech-gestao`
- Reiniciar o sistema: `pm2 restart infotech-gestao`
- Monitorar CPU e memória: `pm2 monit`

---

## 6. Configuração do Servidor Web Reverso Nginx

Crie um arquivo de configuração para o site no Nginx:
```bash
sudo nano /etc/nginx/sites-available/infotech.conf
```

Cole a seguinte configuração:
```nginx
server {
    listen 80;
    server_name sistema.sualoja.com.br;

    # Limite de upload de 30MB para fotos de produtos e anexos
    client_max_body_size 30M;

    # Cabeçalhos de segurança HTTP
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://127.0.0.1:4567;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }
}
```

Ative o site e reinicie o Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/infotech.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. Emissão de Certificado SSL Gratuito (HTTPS)

Com o DNS do domínio apontando para o IP da VPS, emita o certificado SSL oficial via Let's Encrypt:
```bash
sudo certbot --nginx -d sistema.sualoja.com.br
```
O Certbot configurará o redirecionamento automático de HTTP para HTTPS e a renovação automática a cada 90 dias.

---

## 8. Configuração de Firewall do Servidor (UFW)

Mantenha apenas as portas estritamente necessárias abertas para a internet:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
sudo ufw status
```
*(A porta interna 4567 do Node.js fica protegida atrás do Nginx e não deve ser exposta diretamente)*.

---

## 9. Política de Backup e Procedimento de Restauração

### 9.1. Backups Automáticos
- O sistema realiza backups automáticos diários em `/var/backups/infotech/`.
- Cada backup é gravado com data e hora: `backup_diario_infotech_YYYY-MM-DDTHH-mm-ss.json`.

### 9.2. Envio Seguro de Cópia Externa (Recomendado)
Para proteger o negócio caso a VPS inteira sofra uma pane de hardware, configure uma rotina de envio do backup para uma nuvem externa (ex: Google Drive, AWS S3 ou cópia local na loja via rclone ou cron com scp):
```bash
# Exemplo de sincronização via cron diário às 23:00 para outra máquina:
0 23 * * * rsync -avz -e ssh /var/backups/infotech/ usuario@servidor-backup:/backups-loja/
```

### 9.3. Procedimento de Restauração de Desastre (Disaster Recovery)

Se precisar restaurar um backup anterior:

1. Pare o processo da aplicação para garantir consistência de escrita:
   ```bash
   pm2 stop infotech-gestao
   ```
2. Faça uma cópia do banco atual por precaução:
   ```bash
   cp /var/data/infotech/database.json /var/data/infotech/database.antes-do-restore.json
   ```
3. Escolha o arquivo de backup desejado em `/var/backups/infotech/` e copie sobre o banco principal:
   ```bash
   cp /var/backups/infotech/backup_diario_infotech_YYYY-MM-DD.json /var/data/infotech/database.json
   ```
4. Verifique as permissões do arquivo:
   ```bash
   chmod 600 /var/data/infotech/database.json
   ```
5. Reinicie a aplicação:
   ```bash
   pm2 start infotech-gestao
   ```
6. Acesse o painel ou execute `npm run test:security` para confirmar a integridade e operação do sistema.
