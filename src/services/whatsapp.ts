import { WorkOrder, Sale, Quote, StoreSettings, Customer } from '../types';
import { api } from './api';
import { computeAggregateWarrantyDays, formatDynamicWarrantyTerms } from '../utils/warrantyHelpers';
import {
  savePdfWithLocationPicker,
  triggerBlobDownload,
  generateWorkOrderPdfBlob
} from '../utils/pdfGenerator';

export {
  savePdfWithLocationPicker,
  triggerBlobDownload,
  generateWorkOrderPdfBlob
};

/**
 * Normaliza e formata o telefone para o padrão internacional do WhatsApp (+55 Brasil).
 * Trata múltiplos telefones no mesmo campo (ex: fixo + celular) e preenche DDD ausente.
 */
export const cleanAndFormatPhoneNumber = (rawPhone?: string | null, fallbackDdd?: string): string => {
  if (!rawPhone) return '';
  const str = String(rawPhone).trim();

  // Ignora marcadores comuns de telefone ausente
  const lower = str.toLowerCase();
  if (['undefined', 'null', 'n/a', 'nao informado', 'não informado', 'nenhum', '0', ''].includes(lower)) {
    return '';
  }

  // Se houver múltiplos telefones no mesmo campo (ex: "(61) 3226-6883 / (61) 98888-7777")
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
};

/**
 * Abre o WhatsApp Web ou App com a mensagem pré-formatada.
 * Se o telefone estiver em branco, solicita confirmação ou permite escolher o contato no WhatsApp.
 */
export const openWhatsAppWithText = (
  phone: string | undefined | null,
  text: string,
  askIfEmpty: boolean = true
): boolean => {
  let targetPhone = cleanAndFormatPhoneNumber(phone);

  if (!targetPhone && askIfEmpty) {
    const input = window.prompt(
      'Informe o número de WhatsApp do cliente com DDD (Ex: 11999998888):\n(Deixe em branco para escolher o contato diretamente no WhatsApp)',
      ''
    );

    // Se o usuário clicou em Cancelar
    if (input === null) {
      return false;
    }

    if (input.trim()) {
      targetPhone = cleanAndFormatPhoneNumber(input.trim());
    }
  }

  // URLs oficiais
  const encodedText = encodeURIComponent(text);
  const desktopUrl = targetPhone
    ? `whatsapp://send?phone=${targetPhone}&text=${encodedText}`
    : `whatsapp://send?text=${encodedText}`;
  const webUrl = targetPhone
    ? `https://web.whatsapp.com/send?phone=${targetPhone}&text=${encodedText}`
    : `https://web.whatsapp.com`;

  // 1. Tenta envio nativo direto pelo aplicativo WhatsApp Desktop no Windows se disponível
  const apiUrl = '/api/whatsapp/send-desktop';
  fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: targetPhone,
      text: text,
      autoSend: Boolean(targetPhone)
    })
  }).catch(() => {});

  // 2. Dispara abertura segura via âncora no protocolo nativo Desktop (whatsapp://)
  // Utilizar <a href="..."> evita bloqueios de segurança do Chromium em iframes
  try {
    const a = document.createElement('a');
    a.href = desktopUrl;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) document.body.removeChild(a);
    }, 1500);
  } catch (e) {
    // Fallback caso ocorra erro ao clicar no link nativo
    window.open(webUrl, '_blank', 'noopener,noreferrer');
  }

  return true;
};

/**
 * Garante que o link possua um domínio web reconhecido (com TLD válido como .nip.io)
 * para que o WhatsApp transforme a mensagem em um link clicável (azul) no celular e no computador.
 */
export const formatClickableUrl = (rawUrl: string, store?: StoreSettings): string => {
  let url = (rawUrl || '').trim();
  if (!url) return '';

  // Se for IP puro com ou sem porta (ex: http://192.168.1.8 ou http://192.168.1.8:4567)
  const ipMatch = url.match(/^https?:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?(\/.*)?$/);
  if (ipMatch) {
    const ip = ipMatch[1];
    const port = ipMatch[2] || '';
    const pathAndQuery = ipMatch[3] || '';
    // Converte para .nip.io (DNS wildcard que aponta para o próprio IP)
    // Isso faz o WhatsApp reconhecer a extensão .io como domínio de internet e colorir de azul
    return `http://${ip}.nip.io${port}${pathAndQuery}`;
  }

  return url;
};

/**
 * Retorna o link de acompanhamento público em tempo real da Ordem de Serviço.
 * Utiliza o trackingToken criptográfico aleatório para impedir vazamento de dados de outras OSs.
 */
export const getWorkOrderTrackingUrl = (_os: WorkOrder, _store?: StoreSettings): string => {
  return '';
};

/**
 * Retorna o link de acompanhamento público do comprovante/recibo de venda.
 */
export const getSaleReceiptTrackingUrl = (_sale: Sale, _store?: StoreSettings): string => {
  return '';
};

/**
 * Retorna o link direto e oficial para download / visualização do PDF da Ordem de Serviço.
 */
export const getWorkOrderPdfUrl = (os: WorkOrder, store?: StoreSettings): string => {
  const token = os.trackingToken || (os.number ? String(os.number) : os.id);

  if (store?.publicTrackingUrl && store.publicTrackingUrl.trim().length > 0) {
    const base = store.publicTrackingUrl.trim().replace(/\/+$/, '');
    return `${base}/api/public/work-orders/${encodeURIComponent(token)}/pdf`;
  }

  if (store?.systemUrl && store.systemUrl.trim().length > 0) {
    const base = store.systemUrl.trim().replace(/\/+$/, '');
    if (base.includes('trycloudflare.com') || base.startsWith('https://')) {
      return `${base}/api/public/work-orders/${encodeURIComponent(token)}/pdf`;
    }
    return formatClickableUrl(`${base}/api/public/work-orders/${encodeURIComponent(token)}/pdf`, store);
  }

  if (store?.detectedLocalUrl && store.detectedLocalUrl.trim().length > 0) {
    const base = store.detectedLocalUrl.trim().replace(/\/+$/, '');
    if (base.includes('trycloudflare.com') || base.startsWith('https://')) {
      return `${base}/api/public/work-orders/${encodeURIComponent(token)}/pdf`;
    }
    return formatClickableUrl(`${base}/api/public/work-orders/${encodeURIComponent(token)}/pdf`, store);
  }

  if (store?.detectedLocalIp && store.detectedLocalIp !== 'localhost') {
    return `http://${store.detectedLocalIp}.nip.io/api/public/work-orders/${encodeURIComponent(token)}/pdf`;
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    if (isIp && hostname !== '127.0.0.1') {
      const portPart = window.location.port && window.location.port !== '80' ? `:${window.location.port}` : '';
      return `http://${hostname}.nip.io${portPart}/api/public/work-orders/${encodeURIComponent(token)}/pdf`;
    }
    const origin = window.location.origin;
    return `${origin}/api/public/work-orders/${encodeURIComponent(token)}/pdf`;
  }

  return `http://localhost:4567/api/public/work-orders/${encodeURIComponent(token)}/pdf`;
};

/**
 * Gera mensagem simplificada de agradecimento para envio de ORDEM DE SERVIÇO pelo WhatsApp.
 * Não inclui links na mensagem, conforme solicitação (envio apenas do texto com menção ao PDF anexo).
 */
export const formatWorkOrderWhatsAppMessage = (
  os: WorkOrder,
  store?: StoreSettings
): string => {
  const storeName = (store?.storeName || store?.tradeName || 'Power Tech - Assistência Técnica').toUpperCase();
  const phone = store?.phone || store?.whatsapp || '';
  const address = store ? [store.street, store.number, store.neighborhood, store.city ? `${store.city}/${store.state || ''}` : ''].filter(Boolean).join(', ') : '';

  const clientName = (os.customerName || 'Cliente').trim();
  const equipment = [os.brand, os.model].filter(Boolean).join(' ') || (os.equipmentType ? os.equipmentType.toUpperCase() : 'Equipamento');

  let msg = `*${storeName}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `Olá, *${clientName}*! 👋\n\n`;
  msg += `Agradecemos imensamente pela preferência e pela confiança em nossos serviços!\n\n`;
  msg += `📋 *ORDEM DE SERVIÇO #${os.number}*`;
  if (equipment) {
    msg += ` (${equipment})`;
  }
  msg += `\n\n`;
  msg += `📄 *Segue em anexo a sua Ordem de Serviço em formato PDF.*\n\n`;
  msg += `Qualquer dúvida ou caso necessite de mais informações, estamos à sua inteira disposição!\n\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  if (address) {
    msg += `📍 *Nossa Loja:* ${address}\n`;
  }
  if (phone) {
    msg += `📞 *Atendimento:* ${phone}\n`;
  }
  msg += `_Power Tech - Qualidade e transparência para você!_ 🚀`;

  return msg;
};

/**
 * Gera mensagem simplificada de agradecimento para APARELHO PRONTO PARA RETIRADA.
 * Não inclui links na mensagem (envio apenas do texto com menção ao PDF anexo).
 */
export const formatWorkOrderReadyWhatsAppMessage = (
  os: WorkOrder,
  store?: StoreSettings
): string => {
  const storeName = (store?.storeName || store?.tradeName || 'Power Tech - Assistência Técnica').toUpperCase();
  const phone = store?.phone || store?.whatsapp || '';
  const address = store ? [store.street, store.number, store.neighborhood, store.city ? `${store.city}/${store.state || ''}` : ''].filter(Boolean).join(', ') : '';

  const clientName = (os.customerName || 'Cliente').trim();
  const equipment = [os.brand, os.model].filter(Boolean).join(' ') || (os.equipmentType ? os.equipmentType.toUpperCase() : 'Equipamento');

  let msg = `*${storeName}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `Olá, *${clientName}*! 👋\n\n`;
  msg += `Agradecemos imensamente pela preferência e confiança em nosso trabalho!\n\n`;
  msg += `🎉 Temos uma ótima notícia: o seu equipamento *${equipment}* está *PRONTO PARA RETIRADA*!\n\n`;
  msg += `📋 *ORDEM DE SERVIÇO #${os.number}*\n\n`;
  msg += `📄 *Segue em anexo a sua Ordem de Serviço em formato PDF com o laudo e os detalhes dos serviços concluídos.*\n\n`;
  msg += `Você já pode passar em nossa loja para retirar o seu aparelho. Qualquer dúvida, estamos à disposição!\n\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  if (address) {
    msg += `📍 *Retirada na Loja:* ${address}\n`;
  }
  if (phone) {
    msg += `📞 *Atendimento:* ${phone}\n`;
  }
  msg += `_Power Tech - Sempre à sua disposição!_ 🙏`;

  return msg;
};

export const DEFAULT_OS_READY_MESSAGE = `Olá, *{cliente}*! 👋\n\nAgradecemos imensamente pela preferência e confiança em nosso trabalho!\n\n🎉 Temos uma ótima notícia: o seu equipamento *{equipamento}* está *PRONTO PARA RETIRADA*!\n\n📋 *ORDEM DE SERVIÇO #{numero_os}*\n💰 *Valor Total: {valor}*\n\n📄 *Segue em anexo a sua Ordem de Serviço em formato PDF com o laudo e os detalhes dos serviços concluídos.*\n\nVocê já pode passar em nossa loja para retirar o seu aparelho. Qualquer dúvida, estamos à disposição!\n\n📍 *Retirada na Loja:* {endereco}\n📞 *Atendimento:* {telefone}\n_{loja} - Sempre à sua disposição!_ 🙏`;

export const DEFAULT_OS_DELIVERED_MESSAGE = `Olá, *{cliente}*! 👋\n\nSeu equipamento *{equipamento}* (Ordem de Serviço *#{numero_os}*) foi entregue com sucesso! 🤝🎉\n\nAgradecemos imensamente pela preferência e pela confiança em nossos serviços.\n\nQualquer dúvida ou caso necessite de suporte, estamos à sua inteira disposição!\n\n_Power Tech - Qualidade e transparência para você!_ 🚀`;

export const DEFAULT_POS_SALE_MESSAGE = `Olá, *{cliente}*! 👋\n\nAgradecemos imensamente pela preferência em realizar sua compra conosco na *{loja}*! 🤝🎉\n\nQualquer dúvida sobre os produtos ou caso precise de suporte com a garantia, conte sempre conosco!\n\n_Power Tech - Volte sempre!_ 🚀`;

export const DEFAULT_POS_REVIEW_MESSAGE = `Olá, *{cliente}*! 👋\n\nAgradecemos imensamente pela preferência em realizar sua compra conosco na *{loja}*! 🤝🎉\n\nSua opinião é fundamental para aprimorarmos continuamente nosso atendimento. Você poderia nos avaliar e contar como foi sua experiência?\n\n{link_avaliacao}Se puder nos deixar uma avaliação 5 estrelas, ficaremos muito felizes e gratos pelo seu feedback! ⭐⭐⭐⭐⭐\n\nQualquer dúvida ou caso necessite de suporte com a garantia dos produtos, estamos sempre à sua inteira disposição!\n\n_{loja} - Volte sempre!_ 🙏`;

export const DEFAULT_OS_REVIEW_MESSAGE = `Olá, *{cliente}*! 👋\n\nAgradecemos pela confiança em nossos serviços na *{loja}*! 🤝🎉\n\nSeu equipamento *{equipamento}* (Ordem de Serviço *#{numero_os}*) foi finalizado e entregue.\n\nSua opinião é muito importante para nós! Você poderia nos avaliar e contar com sinceridade como foi sua experiência com o nosso atendimento e serviço?\n\n{link_avaliacao}Qualquer dúvida ou caso necessite de suporte com a garantia dos serviços, estamos sempre à sua inteira disposição!\n\n_{loja} - Sempre à sua disposição!_ 🙏`;

/**
 * Substitui tags dinâmicas como {cliente}, {numero_os}, {equipamento}, {valor}, {loja}, {telefone}
 */
export const parseMessageTemplate = (
  template: string,
  variables: Record<string, string | number | undefined | null>
): string => {
  let result = template || '';
  for (const [key, val] of Object.entries(variables)) {
    const replacement = val !== undefined && val !== null ? String(val) : '';
    const regex = new RegExp(`\\{${key}\\}`, 'gi');
    result = result.replace(regex, replacement);
  }
  return result;
};

/**
 * Formata a mensagem personalizada salva para envio de OS quando o status for alterado para PRONTO PARA RETIRADA (Concluída).
 */
export const formatWorkOrderReadyCustomMessage = (
  os: WorkOrder,
  store?: StoreSettings
): string => {
  const template = store?.osReadyMessageTemplate?.trim() || DEFAULT_OS_READY_MESSAGE;
  const storeName = store?.tradeName || store?.storeName || 'Power Tech';
  const phone = store?.phone || store?.whatsapp || '';
  const clientName = (os.customerName || 'Cliente').trim();
  const equipment = [os.brand, os.model].filter(Boolean).join(' ') || (os.equipmentType ? os.equipmentType.toUpperCase() : 'Equipamento');
  const total = Number(os.total || 0).toFixed(2);
  const address = store ? [store.street, store.number, store.neighborhood, store.city ? `${store.city}/${store.state || ''}` : ''].filter(Boolean).join(', ') : '';

  return parseMessageTemplate(template, {
    cliente: clientName,
    numero_os: os.number,
    equipamento: equipment,
    valor: `R$ ${total}`,
    loja: storeName,
    telefone: phone,
    endereco: address
  });
};

/**
 * Formata a mensagem personalizada salva para envio de OS quando o status for alterado para ENTREGUE.
 */
export const formatWorkOrderDeliveredCustomMessage = (
  os: WorkOrder,
  store?: StoreSettings
): string => {
  const template = store?.osDeliveredMessageTemplate?.trim() || DEFAULT_OS_DELIVERED_MESSAGE;
  const storeName = store?.tradeName || store?.storeName || 'Power Tech';
  const phone = store?.phone || store?.whatsapp || '';
  const clientName = (os.customerName || 'Cliente').trim();
  const equipment = [os.brand, os.model].filter(Boolean).join(' ') || (os.equipmentType ? os.equipmentType.toUpperCase() : 'Equipamento');
  const total = Number(os.total || 0).toFixed(2);

  return parseMessageTemplate(template, {
    cliente: clientName,
    numero_os: os.number,
    equipamento: equipment,
    valor: `R$ ${total}`,
    loja: storeName,
    telefone: phone
  });
};

/**
 * Formata a mensagem personalizada salva para envio de RECIBO DE VENDA PDV.
 */
export const formatSaleReceiptCustomMessage = (
  sale: Sale,
  store?: StoreSettings,
  customer?: Customer
): string => {
  const template = store?.posSaleMessageTemplate?.trim() || DEFAULT_POS_SALE_MESSAGE;
  const storeName = store?.tradeName || store?.storeName || 'Power Tech';
  const phone = store?.phone || store?.whatsapp || '';
  const clientName = (sale.customerName || customer?.name || 'Cliente').trim();
  const total = Number(sale.total || 0).toFixed(2);

  return parseMessageTemplate(template, {
    cliente: clientName,
    numero_venda: sale.number,
    valor: `R$ ${total}`,
    loja: storeName,
    telefone: phone
  });
};

/**
 * Formata a mensagem personalizada para solicitação de avaliação pós-venda PDV.
 */
export const formatSaleReviewCustomMessage = (
  sale: Sale,
  store?: StoreSettings,
  customer?: Customer
): string => {
  const template = store?.posReviewMessageTemplate?.trim() || DEFAULT_POS_REVIEW_MESSAGE;
  const storeName = store?.tradeName || store?.storeName || 'Power Tech';
  const phone = store?.phone || store?.whatsapp || '';
  const clientName = (sale.customerName || customer?.name || 'Cliente').trim();
  const total = Number(sale.total || 0).toFixed(2);
  const reviewLink = store?.googleReviewUrl?.trim()
    ? `⭐ *Deixe sua avaliação no link abaixo:*\n${store.googleReviewUrl.trim()}\n\n`
    : '';

  return parseMessageTemplate(template, {
    cliente: clientName,
    numero_venda: sale.number,
    valor: `R$ ${total}`,
    loja: storeName,
    telefone: phone,
    link_avaliacao: reviewLink
  }).replace(/\n{3,}/g, '\n\n');
};

/**
 * Envia mensagem de avaliação de compra/atendimento pelo WhatsApp.
 */
export const sendSaleReviewViaWhatsApp = async (
  sale: Sale,
  phone?: string,
  customMessage?: string,
  storeSettings?: StoreSettings,
  customer?: Customer,
  preferredPlatform: 'auto' | 'web' | 'desktop' = 'auto',
  targetWindow?: Window | null
): Promise<{ success: boolean; mode: string }> => {
  const storeDdd = storeSettings?.phone || storeSettings?.whatsapp || '';
  let targetPhone = cleanAndFormatPhoneNumber(
    phone || sale.customerPhone || customer?.whatsapp || customer?.phone,
    storeDdd
  );

  if (!targetPhone) {
    const input = window.prompt(
      'Informe o número de WhatsApp do cliente com DDD (Ex: 11999998888):\n(Deixe em branco para escolher o contato diretamente no WhatsApp)',
      ''
    );
    if (input === null) {
      if (targetWindow && !targetWindow.closed) targetWindow.close();
      return { success: false, mode: 'cancelled' };
    }
    if (input.trim()) {
      targetPhone = cleanAndFormatPhoneNumber(input.trim(), storeDdd);
    }
  }

  const messageToSend = customMessage !== undefined
    ? customMessage
    : formatSaleReviewCustomMessage(sale, storeSettings, customer);

  const encodedMsg = encodeURIComponent(messageToSend);
  const webUrl = targetPhone
    ? `https://web.whatsapp.com/send?phone=${targetPhone}&text=${encodedMsg}`
    : `https://web.whatsapp.com`;
  const desktopUrl = targetPhone
    ? `whatsapp://send?phone=${targetPhone}&text=${encodedMsg}`
    : `whatsapp://${encodedMsg ? `send?text=${encodedMsg}` : ''}`;

  try {
    if (targetPhone) {
      await api.sendWhatsAppDesktop(targetPhone, messageToSend, true);
    }
  } catch (err) {
    console.warn('[WhatsApp] Erro ao enviar mensagem de avaliação desktop:', err);
  }

  launchWhatsAppConversation(desktopUrl, webUrl, preferredPlatform, targetWindow);
  return { success: true, mode: 'sent' };
};

/**
 * Formata a mensagem personalizada para solicitação de avaliação sincera pós-serviço da Ordem de Serviço.
 */
export const formatWorkOrderReviewCustomMessage = (
  os: WorkOrder,
  store?: StoreSettings,
  customer?: Customer
): string => {
  const template = store?.osReviewMessageTemplate?.trim() || DEFAULT_OS_REVIEW_MESSAGE;
  const storeName = store?.tradeName || store?.storeName || 'Power Tech';
  const phone = store?.phone || store?.whatsapp || '';
  const clientName = (os.customerName || customer?.name || 'Cliente').trim();
  const equipment = [os.brand, os.model].filter(Boolean).join(' ') || (os.equipmentType ? os.equipmentType.toUpperCase() : 'Equipamento');
  const total = Number(os.total || 0).toFixed(2);
  const reviewLink = store?.googleReviewUrl?.trim()
    ? `⭐ *Deixe sua avaliação no link abaixo:*\n${store.googleReviewUrl.trim()}\n\n`
    : '';

  return parseMessageTemplate(template, {
    cliente: clientName,
    numero_os: os.number,
    equipamento: equipment,
    valor: `R$ ${total}`,
    loja: storeName,
    telefone: phone,
    link_avaliacao: reviewLink
  }).replace(/\n{3,}/g, '\n\n');
};

/**
 * Prepara e abre a mensagem de avaliação de Ordem de Serviço no WhatsApp (sem envio automático).
 * O texto é posicionado na caixa de mensagem da conversa pronta para revisão e envio pelo operador.
 */
export const sendWorkOrderReviewViaWhatsApp = async (
  os: WorkOrder,
  phone?: string,
  customMessage?: string,
  storeSettings?: StoreSettings,
  customer?: Customer,
  preferredPlatform: 'auto' | 'web' | 'desktop' = 'auto',
  targetWindow?: Window | null
): Promise<{ success: boolean; mode: string }> => {
  const storeDdd = storeSettings?.phone || storeSettings?.whatsapp || '';
  const targetPhone = cleanAndFormatPhoneNumber(
    phone || os.customerPhone || customer?.whatsapp || customer?.phone,
    storeDdd
  );

  const messageToSend = customMessage !== undefined
    ? customMessage
    : formatWorkOrderReviewCustomMessage(os, storeSettings, customer);

  const encodedMsg = encodeURIComponent(messageToSend);
  const webUrl = targetPhone
    ? `https://web.whatsapp.com/send?phone=${targetPhone}&text=${encodedMsg}`
    : `https://web.whatsapp.com`;
  const desktopUrl = targetPhone
    ? `whatsapp://send?phone=${targetPhone}&text=${encodedMsg}`
    : `whatsapp://${encodedMsg ? `send?text=${encodedMsg}` : ''}`;

  launchWhatsAppConversation(desktopUrl, webUrl, preferredPlatform, targetWindow);
  return { success: true, mode: 'sent' };
};

/**
 * Dispara envio automático da mensagem e do PDF de OS Entregue via WhatsApp.
 */
export const sendWorkOrderDeliveredWhatsApp = async (
  os: WorkOrder,
  storeSettings?: StoreSettings,
  customer?: Customer
): Promise<{ success: boolean; mode: string }> => {
  const storeDdd = storeSettings?.phone || storeSettings?.whatsapp || '';
  const targetPhone = cleanAndFormatPhoneNumber(
    os.customerPhone || customer?.whatsapp || customer?.phone,
    storeDdd
  );

  const onlyPdf = !storeSettings?.osDeliveredMessageEnabled;
  return sendWorkOrderViaWhatsApp(os, targetPhone || undefined, storeSettings, customer, 'auto', null, onlyPdf);
};

/**
 * Gera mensagem profissional e completa para envio de RECIBO DE COMPRA/VENDA pelo WhatsApp.
 */
export const formatSaleReceiptWhatsAppMessage = (
  sale: Sale,
  store?: StoreSettings,
  customer?: Customer
): string => {
  const storeName = (store?.storeName || 'Power Tech - Assistência Técnica & Vendas').toUpperCase();
  const phone = store?.phone || '(11) 3456-7890';
  const address = store ? `${store.street}, ${store.number} - ${store.neighborhood}, ${store.city}/${store.state}` : '';

  const customerName = sale.customerName || customer?.name || 'CONSUMIDOR FINAL';
  const customerCpf = sale.customerCpf || customer?.document || (customer as any)?.cpfCnpj;
  const customerAddress =
    sale.customerAddress ||
    (customer
      ? [customer.street, customer.number, customer.neighborhood, customer.city ? `${customer.city}/${customer.state || ''}` : '']
          .filter(Boolean)
          .join(', ')
      : undefined);

  let msg = `*${storeName}*\n`;
  msg += `🧾 *COMPROVANTE / RECIBO DE VENDA #${sale.number}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `📅 *Data da Compra:* ${new Date(sale.createdAt).toLocaleString('pt-BR')}\n`;
  msg += `👤 *Cliente:* ${customerName}\n`;
  if (customerCpf && customerCpf !== 'NÃO INFORMADO') {
    msg += `📄 *CPF/CNPJ:* ${customerCpf}\n`;
  }
  if (customerAddress && customerAddress !== 'NÃO INFORMADO') {
    msg += `📍 *Endereço:* ${customerAddress}\n`;
  }

  msg += `\n🛒 *ITENS DA COMPRA:*\n`;
  if (sale.items && Array.isArray(sale.items)) {
    sale.items.forEach((item) => {
      const name = item.productName || (item as any).description || 'Produto';
      msg += `• ${item.quantity}x ${name} (R$ ${Number(item.unitPrice).toFixed(2)}) = *R$ ${Number(item.total).toFixed(2)}*\n`;
    });
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💳 *Forma de Pagamento:* ${sale.paymentMethod.toUpperCase()}`;
  if (sale.installments && sale.installments > 1) {
    msg += ` (${sale.installments}x no Cartão)`;
  }
  msg += `\n`;

  if (sale.changeAmount && sale.changeAmount > 0) {
    msg += `💵 *Troco Devolvido:* R$ ${Number(sale.changeAmount).toFixed(2)}\n`;
  }
  if (sale.discount && sale.discount > 0) {
    msg += `🏷️ *Desconto:* R$ ${Number(sale.discount).toFixed(2)}\n`;
  }
  msg += `💰 *TOTAL PAGO: R$ ${Number(sale.total).toFixed(2)}*\n\n`;

  if (sale.notes) {
    msg += `📝 *Observações:* ${sale.notes}\n\n`;
  }

  const saleWarrantyDays =
    sale.warrantyDays !== undefined && sale.warrantyDays !== null
      ? Math.max(0, Number(sale.warrantyDays))
      : computeAggregateWarrantyDays(sale.items || []);

  msg += `🛡️ *Termo de Garantia:*\n`;
  msg += `${formatDynamicWarrantyTerms(saleWarrantyDays, store?.warrantyTerms, 'sale')}\n\n`;

  if (store?.pixKey) {
    msg += `🔑 *Chave PIX:* ${store.pixKey}\n`;
  }
  if (address) {
    msg += `📍 *Endereço da Loja:* ${address}\n`;
  }
  msg += `📞 *Telefone/WhatsApp:* ${phone}\n\n`;

  if (store?.posSaleMessageEnabled) {
    const customMsg = formatSaleReceiptCustomMessage(sale, store, customer);
    if (customMsg.trim()) {
      msg += `━━━━━━━━━━━━━━━━━━━━━\n${customMsg}\n\n`;
    }
  }

  msg += `_Agradecemos a sua preferência! Volte sempre!_ 🚀`;

  return msg;
};

/**
 * Gera mensagem profissional para envio de ORÇAMENTO pelo WhatsApp.
 */
export const formatQuoteWhatsAppMessage = (
  quote: Quote,
  store?: StoreSettings
): string => {
  const storeName = (store?.storeName || 'Power Tech - Assistência Técnica & Vendas').toUpperCase();
  const phone = store?.phone || '(11) 3456-7890';

  let msg = `*${storeName}*\n`;
  msg += `📋 *ORÇAMENTO #${quote.number}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `👤 *Cliente:* ${quote.customerName}\n`;
  msg += `💻 *Equipamento:* ${quote.equipmentDesc}\n`;
  if (quote.reportedIssue) {
    msg += `⚠️ *Problema Relatado:* ${quote.reportedIssue}\n`;
  }

  msg += `\n🛠️ *ITENS / SERVIÇOS ESTIMADOS:*\n`;
  if (quote.items && Array.isArray(quote.items)) {
    quote.items.forEach((it) => {
      msg += `• ${it.quantity}x ${it.description} - R$ ${Number(it.total).toFixed(2)}\n`;
    });
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💰 *VALOR TOTAL: R$ ${Number(quote.total).toFixed(2)}*\n`;
  msg += `⏳ *Validade da Proposta:* ${quote.validDays || 10} dias\n\n`;

  if (quote.notes) {
    msg += `📝 *Observações:* ${quote.notes}\n\n`;
  }

  msg += `Podemos agendar a realização do serviço? Aguardamos seu retorno!\n`;
  msg += `📞 *Atendimento:* ${phone}\n`;

  return msg;
};

/**
 * Realiza download físico e direto do arquivo PDF em formato Blob.
 * Garante que o arquivo seja salvo no computador do lojista sem ser bloqueado ou cancelado por navegações de protocolo.
 */
export const triggerPdfDownload = async (url: string, filename: string): Promise<boolean> => {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      try { window.URL.revokeObjectURL(blobUrl); } catch {}
    }, 30000);
    return true;
  } catch (err) {
    console.warn('[PDF Download] Falha ao baixar via Blob, tentando link direto:', err);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    } catch (e) {
      console.error('[PDF Download] Falha total no download do PDF:', e);
      return false;
    }
  }
};


/**
 * Dispara abertura segura da conversa no WhatsApp sem abortar requisições ou downloads na página.
 * Suporta redirecionamento de abas pré-abertas para contornar bloqueadores de pop-up após awaits.
 */
export const launchWhatsAppConversation = (
  desktopUrl: string,
  webUrl: string,
  preferredPlatform: 'auto' | 'web' | 'desktop' = 'auto',
  targetWindow?: Window | null
) => {
  if (preferredPlatform === 'web') {
    if (targetWindow && !targetWindow.closed) {
      targetWindow.location.href = webUrl;
    } else {
      window.open(webUrl, '_blank', 'noopener,noreferrer');
    }
    return;
  }

  // Tenta abrir o protocolo nativo Desktop (whatsapp://) usando um elemento <a> temporário
  // (evita bloqueios de iframe no Chromium e abre o aplicativo oficial do Windows)
  try {
    const a = document.createElement('a');
    a.href = desktopUrl;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    }, 1500);
  } catch (err) {
    console.warn('[WhatsApp] Erro ao disparar protocolo desktop via anchor:', err);
    if (targetWindow && !targetWindow.closed) {
      targetWindow.location.href = webUrl;
    } else {
      window.open(webUrl, '_blank', 'noopener,noreferrer');
    }
  }

  // Se preferir desktop explicitamente, fecha a janela pré-aberta se houver
  if (preferredPlatform === 'desktop') {
    if (targetWindow && !targetWindow.closed) {
      targetWindow.close();
    }
    return;
  }

  // No modo automático, se houver janela pré-aberta na aba, redireciona para a versão Web
  if (preferredPlatform === 'auto' && targetWindow && !targetWindow.closed) {
    targetWindow.location.href = webUrl;
  }
};

/**
 * Envia exclusivamente o ARQUIVO PDF do recibo de venda via WhatsApp.
 * Não envia nenhum link: aciona a automação desktop para colar o PDF anexo
 * e/ou faz o download local do arquivo PDF para envio manual ou via WhatsApp Web.
 */
export const sendSaleReceiptViaWhatsApp = async (
  sale: Sale,
  phone?: string,
  storeSettings?: StoreSettings,
  customer?: Customer,
  preferredPlatform: 'auto' | 'web' | 'desktop' = 'auto',
  targetWindow?: Window | null,
  onlyPdf: boolean = true
): Promise<{ success: boolean; mode: string }> => {
  const storeDdd = storeSettings?.phone || storeSettings?.whatsapp || '';
  let targetPhone = cleanAndFormatPhoneNumber(
    phone || sale.customerPhone || customer?.whatsapp || customer?.phone,
    storeDdd
  );

  // Se o telefone estiver ausente ou vazio (ex: Consumidor Final)
  if (!targetPhone) {
    const input = window.prompt(
      'Informe o número de WhatsApp do cliente com DDD (Ex: 11999998888):\n(Deixe em branco para abrir o WhatsApp e escolher o contato manualmente)',
      ''
    );
    if (input === null) {
      if (targetWindow && !targetWindow.closed) targetWindow.close();
      return { success: false, mode: 'cancelled' };
    }
    if (input.trim()) {
      targetPhone = cleanAndFormatPhoneNumber(input.trim(), storeDdd);
    }
  }

  // 1. Mensagem de texto: quando onlyPdf for true (padrão), NÃO envia texto, envia apenas o arquivo PDF!
  const messageToSend = onlyPdf
    ? ''
    : (storeSettings?.posSaleMessageEnabled
        ? formatSaleReceiptCustomMessage(sale, storeSettings, customer)
        : formatSaleReceiptWhatsAppMessage(sale, storeSettings, customer));

  let backendHandledDesktop = false;
  try {
    const res = await api.sendSalePdfViaWhatsApp(sale.id, targetPhone || undefined, messageToSend);
    if (res && res.mode === 'desktop_pdf_attached') {
      backendHandledDesktop = true;
    }
  } catch (err) {
    console.warn('[WhatsApp] Erro na automação de cópia para clipboard:', err);
  }

  // 2. Dispara o download automático do arquivo físico do PDF para a máquina do usuário
  try {
    const token = sale.receiptToken || (sale.number ? String(sale.number) : sale.id);
    if (token) {
      const pdfUrl = `/api/public/sales/receipt/${encodeURIComponent(token)}/pdf`;
      const clientName = (sale.customerName || 'Cliente').trim().replace(/[\\/:*?"<>|]/g, '_');
      const filename = `Recibo ${sale.number || '0'} - ${clientName}.pdf`;
      await triggerPdfDownload(pdfUrl, filename);
    }
  } catch (e) {
    console.warn('[WhatsApp] Erro ao disparar download do PDF:', e);
  }

  // 3. URLs oficiais para WhatsApp Web e Desktop
  const encodedMsg = messageToSend ? encodeURIComponent(messageToSend) : '';
  const webUrl = targetPhone
    ? `https://web.whatsapp.com/send?phone=${targetPhone}${encodedMsg ? `&text=${encodedMsg}` : ''}`
    : `https://web.whatsapp.com`;
  const desktopUrl = targetPhone
    ? `whatsapp://send?phone=${targetPhone}${encodedMsg ? `&text=${encodedMsg}` : ''}`
    : `whatsapp://${encodedMsg ? `send?text=${encodedMsg}` : ''}`;

  // 4. Executa a abertura segura apenas se não tiver sido manipulada pelo backend desktop
  if (preferredPlatform === 'web' || !backendHandledDesktop) {
    launchWhatsAppConversation(desktopUrl, webUrl, preferredPlatform, targetWindow);
  } else if (targetWindow && !targetWindow.closed) {
    targetWindow.close();
  }

  return { success: true, mode: 'sent' };
};

export interface SendWorkOrderWhatsAppResult {
  success: boolean;
  mode:
    | 'web_share'
    | 'share_cancelled'
    | 'desktop_download_and_chat'
    | 'mobile_download_and_chat'
    | 'cancelled'
    | 'error'
    | 'sent';
  filename?: string;
  blob?: Blob;
  error?: string;
}

/**
 * Compartilha a Ordem de Serviço pelo WhatsApp de forma unificada e multiplataforma:
 * - No Celular (quando Web Share API com arquivos for suportada):
 *   Gera o PDF da OS, valida suporte a compartilhamento nativo de arquivos e abre
 *   a folha de compartilhamento nativa do sistema operacional (Android/iOS) com o PDF
 *   e a mensagem de texto da OS, permitindo ao usuário selecionar o contato no WhatsApp
 *   e confirmar o envio.
 * - No Computador (ou Celulares sem suporte a compartilhamento de arquivos):
 *   Gera o PDF da OS via canvas no cliente (Etapa 1), baixa o arquivo PDF diretamente
 *   na máquina do usuário, abre a conversa do WhatsApp com o telefone do cliente e o texto
 *   da OS pré-formatado, e orienta de forma clara a anexar o documento baixado.
 * - Trata cancelamentos da folha de compartilhamento (AbortError) sem exibir erro ao usuário.
 * - Evita gerar o PDF duas vezes no mesmo fluxo.
 */
export const sendWorkOrderViaWhatsApp = async (
  os: WorkOrder,
  phone?: string,
  storeSettings?: StoreSettings,
  customer?: Customer,
  preferredPlatform: 'auto' | 'web' | 'desktop' = 'auto',
  targetWindow?: Window | null,
  includeMessage: boolean = true,
  printableElement?: HTMLElement | null
): Promise<SendWorkOrderWhatsAppResult> => {
  const storeDdd = storeSettings?.phone || storeSettings?.whatsapp || '';
  let targetPhone = cleanAndFormatPhoneNumber(
    phone || os.customerPhone || customer?.whatsapp || customer?.phone,
    storeDdd
  );

  // Se o telefone estiver ausente ou vazio
  if (!targetPhone) {
    const input = window.prompt(
      'Informe o número de WhatsApp do cliente com DDD (Ex: 11999998888):\n(Deixe em branco para abrir o WhatsApp e escolher o contato manualmente)',
      ''
    );
    if (input === null) {
      if (targetWindow && !targetWindow.closed) targetWindow.close();
      return { success: false, mode: 'cancelled' };
    }
    if (input.trim()) {
      targetPhone = cleanAndFormatPhoneNumber(input.trim(), storeDdd);
    }
  }

  // 1. Mensagem de texto: formata a mensagem com as informações da OS e cliente
  const msgText = includeMessage !== false
    ? (os.status === 'concluida'
        ? (storeSettings?.osReadyMessageEnabled !== false
            ? formatWorkOrderReadyCustomMessage(os, storeSettings)
            : formatWorkOrderReadyWhatsAppMessage(os, storeSettings))
        : (os.status === 'entregue' && storeSettings?.osDeliveredMessageEnabled
            ? formatWorkOrderDeliveredCustomMessage(os, storeSettings)
            : formatWorkOrderWhatsAppMessage(os, storeSettings)))
    : '';

  // 2. Geração do PDF no cliente (gerado uma única vez)
  let generatedPdf: { blob: Blob; filename: string };
  try {
    generatedPdf = await generateWorkOrderPdfBlob(os, printableElement, storeSettings);
  } catch (pdfErr: any) {
    console.error('[WhatsApp] Erro ao gerar PDF da OS:', pdfErr);
    if (targetWindow && !targetWindow.closed) targetWindow.close();
    return {
      success: false,
      mode: 'error',
      error: 'Não foi possível gerar o PDF da ordem de serviço. Verifique a conexão e tente novamente.'
    };
  }

  const { blob, filename } = generatedPdf;

  // 3. Verifica suporte à Web Share API com arquivos (dispositivos móveis modernos)
  let fileToShare: File | null = null;
  try {
    if (typeof File !== 'undefined') {
      fileToShare = new File([blob], filename, { type: 'application/pdf' });
    }
  } catch (e) {
    console.warn('[WhatsApp] Falha ao criar File a partir do Blob:', e);
  }

  const canShareFiles = Boolean(
    fileToShare &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [fileToShare] })
  );

  // FLUXO CELULAR (WEB SHARE API COM ARQUIVOS):
  if (canShareFiles && fileToShare) {
    const shareData: ShareData = {
      title: `Ordem de Serviço #${os.number || ''}`,
      files: [fileToShare],
    };

    if (msgText && navigator.canShare({ ...shareData, text: msgText })) {
      shareData.text = msgText;
    }

    try {
      await navigator.share(shareData);
      if (targetWindow && !targetWindow.closed) targetWindow.close();
      return { success: true, mode: 'web_share', filename, blob };
    } catch (shareErr: any) {
      if (shareErr.name === 'AbortError') {
        // Usuário cancelou ou fechou o menu de compartilhamento
        if (targetWindow && !targetWindow.closed) targetWindow.close();
        return { success: false, mode: 'share_cancelled', filename, blob };
      }
      console.warn('[WhatsApp] navigator.share falhou, acionando fallback de download:', shareErr);
      // Se falhar por outra razão técnica, prossegue para o fallback abaixo
    }
  }

  // FLUXO COMPUTADOR / FALLBACK CELULAR:
  // 4. Dispara download direto do arquivo PDF no dispositivo do usuário
  try {
    triggerBlobDownload(blob, filename);
  } catch (dlErr) {
    console.warn('[WhatsApp] Erro no download do Blob da OS:', dlErr);
  }

  // 5. Prepara URLs do WhatsApp Web e Desktop com a mensagem preenchida
  const encodedMsg = encodeURIComponent(msgText);
  const webUrl = targetPhone
    ? `https://web.whatsapp.com/send?phone=${targetPhone}${encodedMsg ? `&text=${encodedMsg}` : ''}`
    : `https://web.whatsapp.com`;
  const desktopUrl = targetPhone
    ? `whatsapp://send?phone=${targetPhone}${encodedMsg ? `&text=${encodedMsg}` : ''}`
    : `whatsapp://${encodedMsg ? `send?text=${encodedMsg}` : ''}`;

  // 6. Abre a conversa no WhatsApp
  launchWhatsAppConversation(desktopUrl, webUrl, preferredPlatform, targetWindow);

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    typeof navigator !== 'undefined' ? navigator.userAgent : ''
  );

  return {
    success: true,
    mode: isMobile ? 'mobile_download_and_chat' : 'desktop_download_and_chat',
    filename,
    blob
  };
};
