const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { generateReceiptPdf, generateWorkOrderPdf, copyFileToClipboard } = require('./pdfService');

/**
 * Normaliza e formata o telefone para o padrão internacional do WhatsApp (+55 Brasil).
 * Lida com múltiplos números no mesmo campo, DDD ausente e marcadores nulos.
 */
function cleanPhoneNumber(rawPhone, fallbackDdd = '61') {
  if (!rawPhone) return '';
  const str = String(rawPhone).trim();

  // Ignora marcadores comuns de telefone ausente
  const lower = str.toLowerCase();
  if (['undefined', 'null', 'n/a', 'nao informado', 'não informado', 'nenhum', '0', ''].includes(lower)) {
    return '';
  }

  // Se houver múltiplos telefones (ex: "(61) 3226-6883 / (61) 98888-7777")
  const parts = str.split(/[\/,;|\n]|\s+ou\s+|\s+e\s+/i);
  let candidate = str;
  for (const part of parts) {
    const d = part.replace(/\D/g, '');
    // Prioriza celular (11 dígitos com 9 no 3º dígito, ou 9 dígitos iniciando em 9)
    if ((d.length === 11 && d[2] === '9') || (d.length === 9 && d[0] === '9')) {
      candidate = part;
      break;
    }
    if (d.length >= 8 && candidate === str) {
      candidate = part;
    }
  }

  let digits = candidate.replace(/\D/g, '');

  // Remove zero à esquerda do DDD (ex: 011988887777 -> 11988887777)
  if (digits.startsWith('0') && digits.length >= 11) {
    digits = digits.substring(1);
  }

  // Se já tiver 12 ou 13 dígitos começando com 55 (Brasil)
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return digits;
  }

  // DDD (2 dígitos) + Telefone (8 ou 9 dígitos) -> 10 ou 11 dígitos
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  // Se foram digitados apenas 8 ou 9 dígitos (sem DDD), tenta usar fallbackDdd
  if ((digits.length === 8 || digits.length === 9) && fallbackDdd) {
    const cleanDdd = String(fallbackDdd).replace(/\D/g, '').slice(-2);
    if (cleanDdd.length === 2) {
      return `55${cleanDdd}${digits}`;
    }
  }

  return digits;
}

/**
 * Envia mensagem diretamente pelo WhatsApp Desktop / WhatsApp Business no Windows
 * SEM abrir nenhuma aba de navegador e com envio automático via simulação de Enter.
 */
function sendViaWhatsAppDesktop(phone, text, autoSend = true) {
  return new Promise((resolve, reject) => {
    // Em servidores Linux / VPS na nuvem, a automação com wscript.exe Windows não se aplica
    if (process.platform !== 'win32') {
      return resolve({
        success: false,
        mode: 'cloud_fallback',
        message: 'Disparo via WhatsApp Desktop suportado apenas em ambiente Windows local. Utilize link direto no navegador/celular.'
      });
    }

    try {
      const targetPhone = cleanPhoneNumber(phone);
      const encodedText = encodeURIComponent(text || '');
      
      const waUrl = targetPhone
        ? `whatsapp://send?phone=${targetPhone}&text=${encodedText}`
        : `whatsapp://send?text=${encodedText}`;

      const shouldAutoSend = autoSend && Boolean(targetPhone);
      const safeUrl = waUrl.replace(/"/g, '""');

      const vbsContent = `
Set WshShell = CreateObject("WScript.Shell")
On Error Resume Next

' 1. Dispara o protocolo nativo do WhatsApp Desktop (sem navegador)
waUrl = "${safeUrl}"
WshShell.Run waUrl, 1, False

' 2. Se tiver telefone e envio automático ativado, simula o Enter
If ${shouldAutoSend ? 'True' : 'False'} Then
    ' Aguarda carregar o chat do contato e posicionar na caixa de texto
    WScript.Sleep 2200
    WshShell.AppActivate "WhatsApp"
    WshShell.AppActivate "WhatsApp Business"
    WScript.Sleep 300
    WshShell.SendKeys "~"

    ' 2ª tentativa (garante envio caso a máquina demore 1 a 2 segundos a mais para carregar o chat)
    WScript.Sleep 1800
    WshShell.AppActivate "WhatsApp"
    WshShell.AppActivate "WhatsApp Business"
    WScript.Sleep 200
    WshShell.SendKeys "~"

    ' 3ª tentativa (garante envio em cold start se o WhatsApp estava fechado)
    WScript.Sleep 2000
    WshShell.AppActivate "WhatsApp"
    WshShell.AppActivate "WhatsApp Business"
    WScript.Sleep 200
    WshShell.SendKeys "~"
End If
`;

      const tempFile = path.join(os.tmpdir(), `powertech_wa_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.vbs`);
      fs.writeFileSync(tempFile, vbsContent, { encoding: 'utf-8' });

      // Executa de forma 100% oculta via wscript.exe (sem janela de console/terminal)
      execFile('wscript.exe', ['//nologo', tempFile], (err) => {
        try {
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }
        } catch (e) {}

        if (err) {
          console.error('[WhatsApp Desktop] Erro na execução do script:', err);
        }
      });

      // Retorna sucesso imediatamente para o frontend não ficar travado
      resolve({
        success: true,
        mode: 'desktop',
        phone: targetPhone,
        autoSend: shouldAutoSend
      });
    } catch (err) {
      console.error('[WhatsApp Desktop] Erro ao preparar envio:', err);
      reject(err);
    }
  });
}

/**
 * Envia exclusivamente o ARQUIVO PDF do recibo de venda pelo WhatsApp Desktop no Windows.
 * ZERO links são enviados: o PDF é gerado no modelo exato de impressão, colocado na área de
 * transferência do Windows e colado como documento anexo na conversa do cliente.
 */
async function sendSalePdfViaWhatsAppDesktop(phone, sale, port = 4567, autoSend = true, fallbackDdd = '61', customText = '', documentsDirectory = '') {
  const targetPhone = cleanPhoneNumber(phone, fallbackDdd);
  
  if (!sale || !sale.receiptToken) {
    throw new Error('Venda inválida ou sem token de recibo.');
  }

  // 1. Gera o arquivo PDF real em disco no formato idêntico ao de impressão
  const pdfPath = await generateReceiptPdf(sale.receiptToken, port);
  let finalPdfPath = pdfPath;

  // Salva uma cópia no diretório de documentos configurado com o nome padronizado
  try {
    const rawClient = (sale.customerName || 'Cliente').trim();
    const cleanClient = rawClient.replace(/[\\/:*?"<>|]/g, '_');
    const namedFileName = `Recibo ${sale.number || '0'} - ${cleanClient}.pdf`;
    const targetDir = documentsDirectory || path.join(os.homedir(), 'Documents', 'InfoTech_Documentos');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const namedPath = path.join(targetDir, namedFileName);
    fs.copyFileSync(pdfPath, namedPath);
    finalPdfPath = namedPath;
  } catch (copyErr) {
    console.warn('[WhatsApp Venda] Não foi possível salvar no diretório configurado:', copyErr.message);
  }

  // 2. Prepara URLs de acesso tanto Desktop quanto Web com a mensagem personalizada
  const encodedText = customText ? encodeURIComponent(customText) : '';
  const webUrl = targetPhone
    ? `https://web.whatsapp.com/send?phone=${targetPhone}${encodedText ? `&text=${encodedText}` : ''}`
    : `https://web.whatsapp.com`;
  const waUrl = targetPhone
    ? `whatsapp://send?phone=${targetPhone}${encodedText ? `&text=${encodedText}` : ''}`
    : `whatsapp://${encodedText ? `send?text=${encodedText}` : ''}`;

  // 3. Se for ambiente Linux / VPS na nuvem, retorna pronto para uso web
  if (process.platform !== 'win32') {
    return {
      success: true,
      mode: 'cloud_pdf_ready',
      phone: targetPhone,
      webUrl,
      desktopUrl: waUrl,
      pdfPath: finalPdfPath
    };
  }

  // 4. No Windows, copia o arquivo físico nomeado para a área de transferência do sistema (CF_HDROP)
  await copyFileToClipboard(finalPdfPath);

  return new Promise((resolve) => {
    try {
      const shouldAutoSend = autoSend && Boolean(targetPhone);
      const safeUrl = waUrl.replace(/"/g, '""');

      const vbsContent = `
Set WshShell = CreateObject("WScript.Shell")
On Error Resume Next

' 1. Dispara o WhatsApp Desktop direto na conversa do contato
waUrl = "${safeUrl}"
WshShell.Run waUrl, 1, False

' 2. Se tiver telefone e automação ativada, cola o arquivo PDF (Ctrl+V) e envia (Enter)
If ${shouldAutoSend ? 'True' : 'False'} Then
    WScript.Sleep 2500
    WshShell.AppActivate "WhatsApp"
    WshShell.AppActivate "WhatsApp Business"
    WshShell.AppActivate "WhatsApp.Root"
    WshShell.AppActivate "5319275A.WhatsAppDesktop"
    WScript.Sleep 400

    ' Cola o arquivo PDF da área de transferência como documento
    WshShell.SendKeys "^v"

    ' Aguarda a janela de pré-visualização de anexo do WhatsApp
    WScript.Sleep 1200
    WshShell.AppActivate "WhatsApp"
    WshShell.AppActivate "WhatsApp Business"
    WshShell.AppActivate "WhatsApp.Root"
    WshShell.AppActivate "5319275A.WhatsAppDesktop"
    WScript.Sleep 300

    ' Envia o arquivo PDF
    WshShell.SendKeys "~"
End If
`;

      const tempFile = path.join(os.tmpdir(), `powertech_wa_pdf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.vbs`);
      fs.writeFileSync(tempFile, vbsContent, { encoding: 'utf-8' });

      execFile('wscript.exe', ['//nologo', tempFile], (err) => {
        try {
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        } catch (e) {}

        if (err) {
          console.error('[WhatsApp Desktop PDF] Erro no script de automação:', err);
        }
      });

      resolve({
        success: true,
        mode: 'desktop_pdf_attached',
        phone: targetPhone,
        webUrl,
        desktopUrl: waUrl,
        pdfPath: pdfPath,
        autoSend: shouldAutoSend
      });
    } catch (err) {
      console.error('[WhatsApp Desktop PDF] Erro ao preparar envio:', err);
      resolve({
        success: false,
        error: err.message,
        webUrl,
        desktopUrl: waUrl,
        pdfPath: pdfPath
      });
    }
  });
}

/**
 * Envia exclusivamente o ARQUIVO PDF da Ordem de Serviço pelo WhatsApp Desktop no Windows.
 * ZERO links são enviados: o PDF é gerado no modelo exato A4 da loja, colocado na área de
 * transferência do Windows e anexado com a mensagem simples de agradecimento.
 */
async function sendWorkOrderPdfViaWhatsAppDesktop(phone, osData, port = 4567, autoSend = true, fallbackDdd = '61', customText = '', documentsDirectory = '') {
  const targetPhone = cleanPhoneNumber(phone, fallbackDdd);
  
  if (!osData || !osData.trackingToken) {
    throw new Error('Ordem de serviço inválida ou sem token.');
  }

  // 1. Gera o arquivo PDF real em disco no formato idêntico ao de impressão da OS
  const pdfPath = await generateWorkOrderPdf(osData.trackingToken, port);
  let finalPdfPath = pdfPath;

  // Salva uma cópia no diretório de documentos configurado com o padrão: [número da os] - [nome do cliente].pdf
  try {
    const rawClient = (osData.customerName || 'Cliente').trim();
    const cleanClient = rawClient.replace(/[\\/:*?"<>|]/g, '_');
    const namedFileName = `${osData.number || '0'} - ${cleanClient}.pdf`;
    const targetDir = documentsDirectory || path.join(os.homedir(), 'Documents', 'InfoTech_Documentos');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const namedPath = path.join(targetDir, namedFileName);
    fs.copyFileSync(pdfPath, namedPath);
    finalPdfPath = namedPath;
  } catch (copyErr) {
    console.warn('[WhatsApp OS] Não foi possível salvar no diretório configurado:', copyErr.message);
  }

  // 2. Prepara URLs de acesso tanto Desktop quanto Web com o texto simples de agradecimento
  const encodedText = customText ? encodeURIComponent(customText) : '';
  const webUrl = targetPhone
    ? `https://web.whatsapp.com/send?phone=${targetPhone}${encodedText ? `&text=${encodedText}` : ''}`
    : `https://web.whatsapp.com`;
  const waUrl = targetPhone
    ? `whatsapp://send?phone=${targetPhone}${encodedText ? `&text=${encodedText}` : ''}`
    : `whatsapp://${encodedText ? `send?text=${encodedText}` : ''}`;

  // 3. Se for ambiente Linux / VPS na nuvem, retorna pronto para uso web
  if (process.platform !== 'win32') {
    return {
      success: true,
      mode: 'cloud_pdf_ready',
      phone: targetPhone,
      webUrl,
      desktopUrl: waUrl,
      pdfPath: finalPdfPath
    };
  }

  // 4. No Windows, copia o arquivo físico nomeado para a área de transferência do sistema (CF_HDROP)
  await copyFileToClipboard(finalPdfPath);

  return new Promise((resolve) => {
    try {
      const shouldAutoSend = autoSend && Boolean(targetPhone);
      const safeUrl = waUrl.replace(/"/g, '""');

      const vbsContent = `
Set WshShell = CreateObject("WScript.Shell")
On Error Resume Next

' 1. Dispara o WhatsApp Desktop direto na conversa do contato com o texto de agradecimento
waUrl = "${safeUrl}"
WshShell.Run waUrl, 1, False

' 2. Se tiver telefone e automação ativada, cola o arquivo PDF (Ctrl+V) e envia (Enter)
If ${shouldAutoSend ? 'True' : 'False'} Then
    WScript.Sleep 2500
    WshShell.AppActivate "WhatsApp"
    WshShell.AppActivate "WhatsApp Business"
    WshShell.AppActivate "WhatsApp.Root"
    WshShell.AppActivate "5319275A.WhatsAppDesktop"
    WScript.Sleep 400

    ' Cola o arquivo PDF da área de transferência como documento
    WshShell.SendKeys "^v"

    ' Aguarda a janela de pré-visualização de anexo do WhatsApp
    WScript.Sleep 1200
    WshShell.AppActivate "WhatsApp"
    WshShell.AppActivate "WhatsApp Business"
    WshShell.AppActivate "WhatsApp.Root"
    WshShell.AppActivate "5319275A.WhatsAppDesktop"
    WScript.Sleep 300

    ' Envia o arquivo PDF
    WshShell.SendKeys "~"
End If
`;

      const tempFile = path.join(os.tmpdir(), `powertech_wa_os_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.vbs`);
      fs.writeFileSync(tempFile, vbsContent, { encoding: 'utf-8' });

      execFile('wscript.exe', ['//nologo', tempFile], (err) => {
        try {
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        } catch (e) {}

        if (err) {
          console.error('[WhatsApp Desktop OS PDF] Erro no script de automação:', err);
        }
      });

      resolve({
        success: true,
        mode: 'desktop_pdf_attached',
        phone: targetPhone,
        webUrl,
        desktopUrl: waUrl,
        pdfPath: pdfPath,
        autoSend: shouldAutoSend
      });
    } catch (err) {
      console.error('[WhatsApp Desktop OS PDF] Erro ao preparar envio:', err);
      resolve({
        success: false,
        error: err.message,
        webUrl,
        desktopUrl: waUrl,
        pdfPath: pdfPath
      });
    }
  });
}

module.exports = {
  cleanPhoneNumber,
  sendViaWhatsAppDesktop,
  sendSalePdfViaWhatsAppDesktop,
  sendWorkOrderPdfViaWhatsAppDesktop
};
