import html2pdf from 'html2pdf.js';
import { WorkOrder, StoreSettings } from '../types';

export interface GeneratePdfOptions {
  filename?: string;
  marginMm?: number | [number, number, number, number];
  scale?: number;
  orientation?: 'portrait' | 'landscape';
}

/**
 * Aguarda todas as imagens dentro do elemento terminarem de carregar
 * para garantir que logos, códigos de barras e ícones sejam desenhados no canvas.
 */
export const waitForElementImages = async (element: HTMLElement): Promise<void> => {
  const images = Array.from(element.querySelectorAll('img'));
  if (images.length === 0) return;

  await Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalHeight !== 0) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const onDone = () => {
          img.removeEventListener('load', onDone);
          img.removeEventListener('error', onDone);
          resolve();
        };
        img.addEventListener('load', onDone);
        img.addEventListener('error', onDone);
        // Timeout de segurança para não travar caso a imagem falhe
        setTimeout(onDone, 3000);
      });
    })
  );
};

/**
 * Utilitário para converter strings contendo oklch(...) para rgb/rgba padrão.
 */
const createOklchConverter = () => {
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  const colorCache = new Map<string, string>();

  return (str: string): string => {
    if (!str || typeof str !== 'string' || !str.includes('oklch')) return str;
    if (typeof document === 'undefined') return str;

    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      ctx = canvas.getContext('2d', { willReadFrequently: true });
    }

    return str.replace(/oklch\([^)]+\)/g, (match) => {
      if (colorCache.has(match)) return colorCache.get(match)!;
      try {
        if (!ctx) return match;
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = match;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        const res = a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(2)})`;
        colorCache.set(match, res);
        return res;
      } catch {
        return match;
      }
    });
  };
};

/**
 * Gera um Blob de PDF diretamente no cliente a partir de um elemento HTML DOM
 * utilizando html2pdf.js (html2canvas + jsPDF).
 * Funciona perfeitamente na Vercel e navegadores desktop e móveis sem depender
 * de binários ou executáveis instalados no servidor.
 */
export const generatePdfBlobFromElement = async (
  element: HTMLElement,
  options: GeneratePdfOptions = {}
): Promise<Blob> => {
  const {
    filename = 'documento.pdf',
    marginMm = [3, 4, 3, 4], // mm: superior, esquerdo, inferior, direito
    scale = 2,
    orientation = 'portrait',
  } = options;

  // Garante que todas as imagens (ex: /logo.png) estejam carregadas antes da captura
  await waitForElementImages(element);

  const convertOklch = createOklchConverter();
  const origWindowGetComputedStyle = typeof window !== 'undefined' ? window.getComputedStyle : null;

  // Intercepta globalmente window.getComputedStyle durante a execução do html2canvas
  // para converter qualquer oklch(...) do Tailwind v4 em rgb(...) compatível.
  if (typeof window !== 'undefined' && origWindowGetComputedStyle) {
    (window as any).getComputedStyle = function (el: Element, pseudo?: string | null) {
      const style = origWindowGetComputedStyle.call(window, el, pseudo);
      return new Proxy(style, {
        get(target, prop) {
          if (prop === 'getPropertyValue') {
            return function (name: string) {
              const val = target.getPropertyValue(name);
              return convertOklch(val);
            };
          }
          const val = (target as any)[prop];
          if (typeof val === 'string' && val.includes('oklch')) {
            return convertOklch(val);
          }
          if (typeof val === 'function') {
            return val.bind(target);
          }
          return val;
        },
      });
    };
  }

  try {
    const opt = {
      margin: marginMm,
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      enableLinks: false,
      html2canvas: {
        scale,
        useCORS: true,
        letterRendering: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollY: 0,
        scrollX: 0,
        onclone: (clonedDoc: Document) => {
          if (clonedDoc.documentElement) {
            clonedDoc.documentElement.style.backgroundColor = '#ffffff';
            clonedDoc.documentElement.style.color = '#0f172a';
          }
          if (clonedDoc.body) {
            clonedDoc.body.style.backgroundColor = '#ffffff';
            clonedDoc.body.style.color = '#0f172a';
          }
          // Garante que o documento clonado seja renderizado no tamanho oficial A4 sem transformações mobile
          const clonedPrintable = clonedDoc.getElementById('printable-document');
          if (clonedPrintable) {
            clonedPrintable.style.transform = 'none';
            clonedPrintable.style.width = '202mm';
            clonedPrintable.style.minWidth = '202mm';
            clonedPrintable.style.maxWidth = '202mm';
            clonedPrintable.style.margin = '0 auto';
            clonedPrintable.style.boxSizing = 'border-box';
          }
          const clonedScaler = clonedDoc.querySelector('.print-preview-scaler') as HTMLElement | null;
          if (clonedScaler) {
            clonedScaler.style.width = '202mm';
            clonedScaler.style.height = 'auto';
            clonedScaler.style.minHeight = 'auto';
            clonedScaler.style.transform = 'none';
          }
        },
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation,
        compress: true,
      },
      pagebreak: { mode: ['css', 'legacy'] },
    };

    const worker = (html2pdf as any)().from(element).set(opt);
    const blob: Blob = await worker.outputPdf('blob');
    return blob;
  } finally {
    // Restaura o getComputedStyle original da janela
    if (typeof window !== 'undefined' && origWindowGetComputedStyle) {
      window.getComputedStyle = origWindowGetComputedStyle;
    }
  }
};

/**
 * Salva um PDF solicitando ao usuário onde salvar no computador (File System Access API).
 * Abre a janela nativa do Windows Explorer ("Salvar Como") permitindo escolher qualquer pasta ou disco.
 * Caso o usuário cancele, a operação é finalizada silenciosamente sem erros (AbortError).
 * Caso a API não esteja disponível no navegador (ex: mobile ou Firefox), realiza o fallback seguro via download.
 */
export const savePdfWithLocationPicker = async (
  pdfSource: string | Blob,
  suggestedFilename: string
): Promise<boolean> => {
  try {
    let blob: Blob;
    if (typeof pdfSource === 'string') {
      const res = await fetch(pdfSource);
      if (!res.ok) throw new Error(`Falha ao obter arquivo PDF: HTTP ${res.status}`);
      blob = await res.blob();
    } else {
      blob = pdfSource;
    }

    // 1. Tenta a API nativa do navegador (Chromium/Edge/Chrome no Windows)
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window && typeof (window as any).showSaveFilePicker === 'function') {
      try {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: suggestedFilename,
          types: [
            {
              description: 'Documento PDF (*.pdf)',
              accept: {
                'application/pdf': ['.pdf'],
              },
            },
          ],
        });

        const writableStream = await fileHandle.createWritable();
        await writableStream.write(blob);
        await writableStream.close();
        return true;
      } catch (pickerErr: any) {
        if (pickerErr.name === 'AbortError') {
          return false;
        }
        console.warn('[SavePDF] showSaveFilePicker falhou, tentando fallback:', pickerErr);
      }
    }

    // 2. Fallback caso showSaveFilePicker não esteja disponível
    triggerBlobDownload(blob, suggestedFilename);
    return true;
  } catch (err) {
    console.error('[SavePDF] Erro ao salvar arquivo PDF:', err);
    return false;
  }
};

/**
 * Gera o PDF a partir de um elemento DOM e aciona o salvamento no dispositivo
 * via janela do Windows Explorer (showSaveFilePicker) ou download direto (fallback móvel).
 */
export const generateAndSavePdf = async (
  element: HTMLElement,
  filename: string,
  options?: Omit<GeneratePdfOptions, 'filename'>
): Promise<boolean> => {
  const blob = await generatePdfBlobFromElement(element, { ...options, filename });
  return await savePdfWithLocationPicker(blob, filename);
};

/**
 * Dispara o download de um Blob diretamente no dispositivo do usuário
 * utilizando um link dinâmico <a> e URL.createObjectURL.
 */
export const triggerBlobDownload = (blob: Blob, filename: string): void => {
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      window.URL.revokeObjectURL(blobUrl);
    } catch {}
  }, 15000);
};

/**
 * Construtor de HTML de contingência para renderizar a OS no modelo oficial
 * caso a consulta ao endpoint de impressão falhe por qualquer razão.
 */
const buildFallbackWorkOrderHtml = (os: WorkOrder, store?: StoreSettings): string => {
  const storeName = store?.tradeName || store?.storeName || 'Power Tech - Assistência Técnica';
  const storePhone = store?.phone || store?.whatsapp || '';
  const customerName = os.customerName || 'Cliente';
  const customerPhone = os.customerPhone || 'NÃO INFORMADO';
  const equipment = [os.brand, os.model].filter(Boolean).join(' ') || (os.equipmentType ? os.equipmentType.toUpperCase() : 'Equipamento');
  const defect = os.reportedDefect || (os as any).defect || 'Não informado';
  const total = Number(os.total || 0).toFixed(2);
  const dateStr = new Date(os.entryDate || os.createdAt || Date.now()).toLocaleDateString('pt-BR');

  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; padding: 16px; color: #0f172a; font-size: 11px; background: #ffffff; width: 794px; box-sizing: border-box;">
      <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px;">
          <div>
            <h1 style="font-size: 16px; font-weight: 900; color: #1e3a8a; margin: 0; text-transform: uppercase;">${storeName}</h1>
            <div style="font-size: 9.5px; color: #475569; margin-top: 2px;">Telefone/WhatsApp: ${storePhone}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 16px; font-weight: 900;">OS #${os.number || ''}</div>
            <div style="font-size: 9.5px; color: #64748b;">Data: ${dateStr}</div>
          </div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; margin-bottom: 10px; font-size: 10px;">
          <div><strong>Cliente:</strong> ${customerName} &nbsp;|&nbsp; <strong>Telefone:</strong> ${customerPhone}</div>
          <div style="margin-top: 4px;"><strong>Equipamento:</strong> ${equipment}</div>
          <div style="margin-top: 4px;"><strong>Defeito Relatado:</strong> ${defect}</div>
        </div>
        ${os.technicalReport ? `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; margin-bottom: 10px; font-size: 10px;"><strong>Laudo Técnico:</strong> ${os.technicalReport}</div>` : ''}
        <div style="text-align: right; font-size: 13px; font-weight: 900; color: #047857; margin-bottom: 12px; padding: 6px; background: #f0fdf4; border-radius: 6px;">
          VALOR TOTAL: R$ ${total}
        </div>
        <div style="font-size: 8.5px; color: #475569; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; line-height: 1.35; margin-bottom: 12px;">
          <strong>Termos de Garantia (Art. 26 da Lei 8.078/90 - CDC):</strong> Garantia legal de 90 dias referente exclusivamente aos serviços executados e às peças substituídas pela assistência técnica.
        </div>
        <div style="display: flex; justify-content: space-around; text-align: center; margin-top: 20px; font-size: 9.5px;">
          <div style="width: 40%; border-top: 1px solid #64748b; padding-top: 4px;">Assinatura do Cliente</div>
          <div style="width: 40%; border-top: 1px solid #64748b; padding-top: 4px;">Responsável Técnico / Loja</div>
        </div>
      </div>
    </div>
  `;
};

/**
 * Gera um Blob de PDF da Ordem de Serviço de forma unificada e confiável:
 * 1. Se um elemento DOM de impressão já estiver disponível na tela (ex: #printable-document no PrintModal),
 *    utiliza-o diretamente.
 * 2. Caso contrário, carrega o modelo oficial da OS (/api/public/work-orders/:token/imprimir?pdf=0)
 *    ou monta a estrutura em um contêiner temporário offscreen, gerando o PDF de alta resolução sem travar a interface.
 */
export const generateWorkOrderPdfBlob = async (
  os: WorkOrder,
  existingElement?: HTMLElement | null,
  storeSettings?: StoreSettings
): Promise<{ blob: Blob; filename: string }> => {
  const cleanClient = (os.customerName || 'Cliente').trim().replace(/[\\/:*?"<>|]/g, '_');
  const filename = `${os.number || '0'} - ${cleanClient}.pdf`;

  // 1. Se já houver um elemento na tela renderizado (ex: PrintModal aberto)
  const targetElement = existingElement || (typeof document !== 'undefined' ? document.getElementById('printable-document') : null);
  if (targetElement) {
    const blob = await generatePdfBlobFromElement(targetElement, { filename });
    return { blob, filename };
  }

  // 2. Se não houver elemento no DOM, busca o modelo oficial da OS
  const token = os.trackingToken || (os.number ? String(os.number) : os.id);
  let html = '';
  if (token) {
    try {
      const res = await fetch(`/api/public/work-orders/${encodeURIComponent(token)}/imprimir?pdf=0`);
      if (res.ok) {
        html = await res.text();
      }
    } catch (e) {
      console.warn('[PDF] Falha ao buscar template remoto da OS:', e);
    }
  }

  // Cria contêiner offscreen temporário
  const container = document.createElement('div');
  container.id = 'offscreen-os-print-container';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px'; // ~210mm a 96 DPI
  container.style.background = '#ffffff';
  container.style.color = '#0f172a';
  container.style.zIndex = '-9999';

  if (html) {
    container.innerHTML = html;
    const actions = container.querySelector('.actions');
    if (actions) actions.remove();
  } else {
    // Fallback: monta HTML direto da OS caso o fetch falhe
    container.innerHTML = buildFallbackWorkOrderHtml(os, storeSettings);
  }

  document.body.appendChild(container);
  try {
    const blob = await generatePdfBlobFromElement(container, { filename });
    return { blob, filename };
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
};
