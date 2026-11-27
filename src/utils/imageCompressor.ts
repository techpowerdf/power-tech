/**
 * Utilitário de Compressão e Otimização de Imagens no Cliente
 * Power Tech Gestão - Módulo de Fotografias de OS
 * 
 * Redimensiona e comprime fotos capturadas pela câmera ou selecionadas da galeria
 * antes do upload para o servidor / Supabase Storage, reduzindo arquivos de 4-12MB para ~150-350KB
 * preservando a nitidez necessária para laudos, números de série e avarias.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 a 1.0
  mimeType?: 'image/jpeg' | 'image/webp';
}

export interface CompressedImageResult {
  blob: Blob;
  base64Data: string; // data URI completo (data:image/jpeg;base64,...)
  rawBase64: string;  // apenas a string base64 pura
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  compressionRatio: number; // percentual reduzido (ex: 75%)
}

/**
 * Formata bytes em texto amigável (ex: 245 KB, 1.2 MB)
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Comprime um arquivo de imagem recebido do input de arquivo ou câmera
 */
export async function compressImage(
  file: File | Blob,
  fileName?: string,
  options: CompressionOptions = {}
): Promise<CompressedImageResult> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.82,
    mimeType = 'image/jpeg'
  } = options;

  const originalSizeBytes = file.size;
  const name = fileName || (file instanceof File ? file.name : `foto_${Date.now()}.jpg`);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem'));

    reader.onload = (event) => {
      const img = new Image();

      img.onerror = () => reject(new Error('Falha ao carregar a imagem no navegador'));

      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Calcula novas dimensões mantendo a proporção de aspecto
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Não foi possível obter o contexto 2D do Canvas'));
        }

        // Renderiza no canvas com suavização de alta qualidade
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Gera a representação comprimida
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Falha ao gerar o blob da imagem comprimida'));
            }

            const dataUrl = canvas.toDataURL(mimeType, quality);
            const rawBase64 = dataUrl.split(',')[1] || '';
            const compressedSizeBytes = blob.size;
            const compressionRatio = originalSizeBytes > 0
              ? Math.max(0, Math.round(((originalSizeBytes - compressedSizeBytes) / originalSizeBytes) * 100))
              : 0;

            // Limpa canvas
            canvas.width = 0;
            canvas.height = 0;

            resolve({
              blob,
              base64Data: dataUrl,
              rawBase64,
              fileName: name,
              mimeType,
              width,
              height,
              originalSizeBytes,
              compressedSizeBytes,
              compressionRatio
            });
          },
          mimeType,
          quality
        );
      };

      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}
