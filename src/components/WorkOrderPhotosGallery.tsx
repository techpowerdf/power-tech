import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Image as ImageIcon,
  UploadCloud,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { WorkOrder, WorkOrderPhoto, WorkOrderPhotoStage } from '../types';
import { api } from '../services/api';
import { compressImage, formatFileSize } from '../utils/imageCompressor';

interface WorkOrderPhotosGalleryProps {
  workOrder: WorkOrder;
  onPhotosUpdated?: (photos: WorkOrderPhoto[]) => void;
}

const STAGE_CONFIG: Record<
  WorkOrderPhotoStage,
  { label: string; badgeClass: string; activeTabClass: string; dotClass: string }
> = {
  entrada: {
    label: 'Entrada',
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    activeTabClass: 'bg-sky-600 text-white',
    dotClass: 'bg-sky-400'
  },
  reparo: {
    label: 'Durante o reparo',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    activeTabClass: 'bg-amber-600 text-white',
    dotClass: 'bg-amber-400'
  },
  conclusao: {
    label: 'Conclusão',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    activeTabClass: 'bg-emerald-600 text-white',
    dotClass: 'bg-emerald-400'
  }
};

export const WorkOrderPhotosGallery: React.FC<WorkOrderPhotosGalleryProps> = ({
  workOrder,
  onPhotosUpdated
}) => {
  const [photos, setPhotos] = useState<WorkOrderPhoto[]>(workOrder.photos || []);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<'todas' | WorkOrderPhotoStage>('todas');
  const [uploadStage, setUploadStage] = useState<WorkOrderPhotoStage>(() => {
    if (workOrder.status === 'aberta') return 'entrada';
    if (workOrder.status === 'concluida' || workOrder.status === 'entregue') return 'conclusao';
    return 'reparo';
  });

  const [uploadProgress, setUploadProgress] = useState<{
    total: number;
    current: number;
    stageMessage: string;
  } | null>(null);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Lightbox State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState<number>(1);
  const [lightboxRotation, setLightboxRotation] = useState<number>(0);

  // Modal de Confirmação de Exclusão
  const [photoToDelete, setPhotoToDelete] = useState<WorkOrderPhoto | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const isMountedRef = useRef<boolean>(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Inputs nativos
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Carrega fotos mais recentes com URLs assinadas válidas ao montar ou alterar workOrder.id
  useEffect(() => {
    let isMounted = true;
    async function loadFreshPhotos() {
      if (!workOrder.id) return;
      try {
        setLoading(true);
        const res = await api.getWorkOrderPhotos(workOrder.id);
        if (isMounted && res.success && Array.isArray(res.photos)) {
          setPhotos(res.photos);
          if (onPhotosUpdated) {
            onPhotosUpdated(res.photos);
          }
        }
      } catch (err: any) {
        console.warn('Falha ao carregar fotos da OS:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadFreshPhotos();
    return () => {
      isMounted = false;
    };
  }, [workOrder.id]);

  // Teclado para o Lightbox (navegação e fechar)
  useEffect(() => {
    if (lightboxIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLightbox();
      } else if (e.key === 'ArrowRight') {
        goToNextPhoto();
      } else if (e.key === 'ArrowLeft') {
        goToPreviousPhoto();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, photos, activeFilter]);

  const filteredPhotos = photos.filter((p) => {
    if (activeFilter === 'todas') return true;
    return p.stage === activeFilter;
  });

  const counts = {
    todas: photos.length,
    entrada: photos.filter((p) => p.stage === 'entrada').length,
    reparo: photos.filter((p) => p.stage === 'reparo').length,
    conclusao: photos.filter((p) => p.stage === 'conclusao').length
  };

  // Processa uploads de arquivos selecionados ou capturados
  const handleFilesSelected = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArray.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Por favor, selecione arquivos de imagem válidos (JPG, PNG ou WebP).'
      });
      return;
    }

    setFeedback(null);
    setUploadProgress({
      total: fileArray.length,
      current: 0,
      stageMessage: 'Iniciando otimização das fotografias...'
    });

    let uploadedCount = 0;

    try {
      for (let i = 0; i < fileArray.length; i++) {
        if (!isMountedRef.current) break;
        const file = fileArray[i];

        setUploadProgress({
          total: fileArray.length,
          current: i + 1,
          stageMessage: `Otimizando foto ${i + 1} de ${fileArray.length}...`
        });

        try {
          // Compressão via HTML5 Canvas
          const compressed = await compressImage(file, file.name, {
            maxWidth: 1600,
            maxHeight: 1600,
            quality: 0.82,
            mimeType: 'image/jpeg'
          });

          if (!isMountedRef.current) break;

          setUploadProgress({
            total: fileArray.length,
            current: i + 1,
            stageMessage: `Enviando foto ${i + 1} de ${fileArray.length} (${formatFileSize(compressed.compressedSizeBytes)})...`
          });

          // Upload para backend / Supabase
          const res = await api.uploadWorkOrderPhoto(workOrder.id, {
            stage: uploadStage,
            fileName: compressed.fileName,
            base64Data: compressed.base64Data,
            mimeType: compressed.mimeType
          });

          if (res.success && res.photo && isMountedRef.current) {
            uploadedCount++;
            // Atualização incremental imediata da galeria
            setPhotos((prev) => {
              const updated = [...prev, res.photo];
              if (onPhotosUpdated) {
                onPhotosUpdated(updated);
              }
              return updated;
            });
          }
        } catch (err: any) {
          console.error('Erro no upload de foto:', err);
          if (isMountedRef.current) {
            setFeedback({
              type: 'error',
              message: `Erro ao enviar ${file.name}: ${err.message}`
            });
          }
        }
      }

      if (uploadedCount > 0 && isMountedRef.current) {
        setFeedback({
          type: 'success',
          message: `${uploadedCount} ${uploadedCount === 1 ? 'fotografia adicionada' : 'fotografias adicionadas'} com sucesso!`
        });
      }
    } finally {
      if (isMountedRef.current) {
        setUploadProgress(null);
        if (cameraInputRef.current) cameraInputRef.current.value = '';
        if (galleryInputRef.current) galleryInputRef.current.value = '';
      }
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  // Lightbox handlers
  const openLightbox = (photo: WorkOrderPhoto) => {
    const idx = filteredPhotos.findIndex((p) => p.id === photo.id);
    if (idx !== -1) {
      setLightboxIndex(idx);
      setLightboxZoom(1);
      setLightboxRotation(0);
    }
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
    setLightboxZoom(1);
    setLightboxRotation(0);
  };

  const goToNextPhoto = () => {
    if (lightboxIndex === null || filteredPhotos.length <= 1) return;
    setLightboxIndex((prev) => ((prev! + 1) % filteredPhotos.length));
    setLightboxZoom(1);
    setLightboxRotation(0);
  };

  const goToPreviousPhoto = () => {
    if (lightboxIndex === null || filteredPhotos.length <= 1) return;
    setLightboxIndex((prev) => (prev! - 1 + filteredPhotos.length) % filteredPhotos.length);
    setLightboxZoom(1);
    setLightboxRotation(0);
  };

  // Exclusão de foto
  const handleConfirmDelete = async () => {
    if (!photoToDelete) return;
    setIsDeleting(true);
    try {
      const res = await api.deleteWorkOrderPhoto(workOrder.id, photoToDelete.id);
      if (res.success) {
        const updated = photos.filter((p) => p.id !== photoToDelete.id);
        setPhotos(updated);
        if (onPhotosUpdated) {
          onPhotosUpdated(updated);
        }
        setFeedback({
          type: 'success',
          message: 'Fotografia excluída com sucesso.'
        });
        if (lightboxIndex !== null) {
          closeLightbox();
        }
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Falha ao excluir foto: ${err.message}`
      });
    } finally {
      setIsDeleting(false);
      setPhotoToDelete(null);
    }
  };

  const currentLightboxPhoto = lightboxIndex !== null ? filteredPhotos[lightboxIndex] : null;

  return (
    <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-4">
      {/* Inputs nativos ocultos */}
      {/* 1. Câmera direta (para celulares / tablets com capture) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFilesSelected(e.target.files);
          }
        }}
      />
      {/* 2. Seleção de Múltiplos Arquivos da Galeria / Computador */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFilesSelected(e.target.files);
          }
        }}
      />

      {/* Cabeçalho da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <h4 className="text-[11px] font-bold text-sky-400 uppercase tracking-wide flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-sky-400" />
            4. Fotografias do Equipamento & Vistoria
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-slate-300 font-mono font-normal border border-slate-800">
              {photos.length} {photos.length === 1 ? 'foto' : 'fotos'}
            </span>
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Registre o estado físico do equipamento na entrada, durante o conserto ou na entrega.
          </p>
        </div>

        {/* Botões de Ação para Adicionar Fotos */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={!!uploadProgress}
            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 active:scale-95 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-sky-600/30 disabled:opacity-50 cursor-pointer"
            title="Tirar foto diretamente pela câmera do celular"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Tirar Foto</span>
          </button>

          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={!!uploadProgress}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700/80 disabled:opacity-50 cursor-pointer"
            title="Selecionar fotos da galeria ou computador"
          >
            <ImageIcon className="w-3.5 h-3.5 text-slate-300" />
            <span>Adicionar da Galeria</span>
          </button>
        </div>
      </div>

      {/* Feedback de Operação */}
      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between gap-2 transition ${
            feedback.type === 'success'
              ? 'bg-emerald-950/70 border border-emerald-800/80 text-emerald-300'
              : 'bg-rose-950/70 border border-rose-800/80 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white p-1 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Barra de Progresso de Upload */}
      {uploadProgress && (
        <div className="bg-slate-900 border border-sky-800/60 p-3 rounded-lg space-y-2">
          <div className="flex items-center justify-between text-xs text-sky-300">
            <span className="flex items-center gap-1.5 font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
              {uploadProgress.stageMessage}
            </span>
            <span className="font-mono font-bold">
              {uploadProgress.current}/{uploadProgress.total}
            </span>
          </div>
          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-sky-500 h-full transition-all duration-300"
              style={{
                width: `${Math.round((uploadProgress.current / uploadProgress.total) * 100)}%`
              }}
            />
          </div>
        </div>
      )}

      {/* Controles de Filtro e Seletor do Estágio para Novos Uploads */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
        {/* Abas de Filtro */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-xs scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveFilter('todas')}
            className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer whitespace-nowrap ${
              activeFilter === 'todas'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Todas ({counts.todas})
          </button>

          {(['entrada', 'reparo', 'conclusao'] as WorkOrderPhotoStage[]).map((stage) => {
            const config = STAGE_CONFIG[stage];
            const isActive = activeFilter === stage;
            return (
              <button
                key={stage}
                type="button"
                onClick={() => setActiveFilter(stage)}
                className={`px-2.5 py-1 rounded-md font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? config.activeTabClass
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
                {config.label} ({counts[stage]})
              </button>
            );
          })}
        </div>

        {/* Seletor do Estágio para novas fotos */}
        <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
          <span className="text-slate-400 text-[11px] whitespace-nowrap">Estágio para fotos adicionadas:</span>
          <select
            value={uploadStage}
            onChange={(e) => setUploadStage(e.target.value as WorkOrderPhotoStage)}
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-semibold"
          >
            <option value="entrada">Entrada</option>
            <option value="reparo">Durante o reparo</option>
            <option value="conclusao">Conclusão</option>
          </select>
        </div>
      </div>

      {/* Grid de Fotos ou Área de Drop Vazia */}
      {loading && photos.length === 0 ? (
        <div className="py-10 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
          <span className="text-xs">Carregando fotografias do equipamento...</span>
        </div>
      ) : filteredPhotos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filteredPhotos.map((photo) => {
            const config = STAGE_CONFIG[photo.stage] || STAGE_CONFIG.entrada;
            const formattedDate = photo.createdAt
              ? new Date(photo.createdAt).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                }) +
                ' às ' +
                new Date(photo.createdAt).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : 'Sem data';

            return (
              <div
                key={photo.id}
                className="group relative bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col shadow-sm transition hover:border-slate-700 hover:shadow-md"
              >
                {/* Miniatura / Imagem */}
                <div
                  className="relative aspect-4/3 w-full bg-slate-950 overflow-hidden cursor-pointer"
                  onClick={() => openLightbox(photo)}
                >
                  <img
                    src={photo.url}
                    alt={photo.fileName}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Badge do Estágio */}
                  <div className="absolute top-1.5 left-1.5 z-10">
                    <span
                      className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border backdrop-blur-md ${config.badgeClass}`}
                    >
                      {config.label}
                    </span>
                  </div>

                  {/* Overlay ao passar o mouse com ação de ampliar */}
                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="p-1.5 rounded-full bg-slate-900/80 text-white hover:bg-sky-600 transition">
                      <ZoomIn className="w-4 h-4" />
                    </span>
                  </div>
                </div>

                {/* Rodapé da Foto */}
                <div className="p-2 flex items-center justify-between gap-1 text-[10px] text-slate-400 bg-slate-900/90 border-t border-slate-800/80">
                  <div className="truncate">
                    <span className="block text-slate-300 font-mono text-[10px] truncate">
                      {photo.fileName}
                    </span>
                    <span className="block text-slate-500 text-[9px]">{formattedDate}</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhotoToDelete(photo);
                    }}
                    className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition cursor-pointer"
                    title="Excluir fotografia"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State com Zona de Arrastar e Soltar */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`py-8 px-4 border-2 border-dashed rounded-xl text-center flex flex-col items-center justify-center gap-2 transition ${
            isDragging
              ? 'border-sky-500 bg-sky-500/10'
              : 'border-slate-800 hover:border-slate-700 bg-slate-900/30'
          }`}
        >
          <div className="p-3 rounded-full bg-slate-800/80 text-slate-400 mb-1">
            <UploadCloud className="w-6 h-6 text-sky-400" />
          </div>
          <h5 className="text-xs font-bold text-slate-300">
            {activeFilter === 'todas'
              ? 'Nenhuma fotografia registrada para esta OS'
              : `Nenhuma fotografia registrada no estágio "${STAGE_CONFIG[activeFilter]?.label}"`}
          </h5>
          <p className="text-[11px] text-slate-500 max-w-sm">
            Arraste e solte fotos do equipamento aqui, ou use os botões acima para fotografar com o
            celular ou selecionar da galeria.
          </p>

          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-sky-600/30"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Tirar Foto Agora</span>
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Escolher Arquivos</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal Lightbox / Visualizador Ampliado */}
      {currentLightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col justify-between"
          onClick={closeLightbox}
        >
          {/* Barra Superior do Lightbox */}
          <div
            className="flex items-center justify-between p-3 sm:p-4 bg-slate-950/80 border-b border-slate-800/80 text-white z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                  STAGE_CONFIG[currentLightboxPhoto.stage]?.badgeClass
                }`}
              >
                {STAGE_CONFIG[currentLightboxPhoto.stage]?.label}
              </span>
              <span className="text-xs sm:text-sm font-medium text-slate-200 truncate max-w-[200px] sm:max-w-md">
                {currentLightboxPhoto.fileName}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                ({lightboxIndex! + 1} de {filteredPhotos.length})
              </span>
            </div>

            {/* Controles de Zoom e Fechar */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.min(z + 0.25, 3))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                title="Aumentar zoom"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.max(z - 0.25, 0.5))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                title="Diminuir zoom"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setLightboxRotation((r) => (r + 90) % 360)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                title="Girar 90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setLightboxZoom(1);
                  setLightboxRotation(0);
                }}
                className="px-2 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-mono"
                title="Redefinir visualização"
              >
                100%
              </button>
              <button
                type="button"
                onClick={closeLightbox}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white transition ml-2"
                title="Fechar visualizador (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Área Central da Imagem com Botões de Navegação */}
          <div
            className="relative flex-1 flex items-center justify-center p-2 sm:p-6 overflow-hidden select-none"
            onClick={closeLightbox}
          >
            {/* Botão Anterior */}
            {filteredPhotos.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goToPreviousPhoto();
                }}
                className="absolute left-2 sm:left-4 z-20 p-2 sm:p-3 rounded-full bg-slate-900/80 hover:bg-sky-600 text-white transition backdrop-blur-sm cursor-pointer shadow-lg active:scale-95"
                title="Foto anterior (Seta esquerda)"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Imagem Ampliada */}
            <div
              className="max-w-full max-h-full flex items-center justify-center transition-transform duration-200"
              style={{
                transform: `scale(${lightboxZoom}) rotate(${lightboxRotation}deg)`
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={currentLightboxPhoto.url}
                alt={currentLightboxPhoto.fileName}
                className="max-w-full max-h-[75vh] object-contain rounded-md shadow-2xl"
              />
            </div>

            {/* Botão Próximo */}
            {filteredPhotos.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goToNextPhoto();
                }}
                className="absolute right-2 sm:right-4 z-20 p-2 sm:p-3 rounded-full bg-slate-900/80 hover:bg-sky-600 text-white transition backdrop-blur-sm cursor-pointer shadow-lg active:scale-95"
                title="Próxima foto (Seta direita)"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Barra Inferior com Informações Detalhadas */}
          <div
            className="p-3 sm:p-4 bg-slate-950/80 border-t border-slate-800/80 text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <span>
                Data:{' '}
                <strong className="text-white">
                  {currentLightboxPhoto.createdAt
                    ? new Date(currentLightboxPhoto.createdAt).toLocaleDateString('pt-BR') +
                      ' às ' +
                      new Date(currentLightboxPhoto.createdAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'N/A'}
                </strong>
              </span>
              <span>
                Tamanho:{' '}
                <strong className="text-white">
                  {formatFileSize(currentLightboxPhoto.sizeBytes)}
                </strong>
              </span>
              {currentLightboxPhoto.createdBy && (
                <span>
                  Registrado por:{' '}
                  <strong className="text-sky-400">{currentLightboxPhoto.createdBy}</strong>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setPhotoToDelete(currentLightboxPhoto);
              }}
              className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold self-end sm:self-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir Fotografia</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {photoToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-full bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-white">Confirmar Exclusão</h4>
            </div>

            <p className="text-xs text-slate-300">
              Tem certeza que deseja excluir esta fotografia do equipamento? Esta ação removerá a
              imagem permanentemente.
            </p>

            <div className="p-2 bg-slate-950 rounded-lg flex items-center gap-2 border border-slate-800/80">
              <img
                src={photoToDelete.url}
                alt={photoToDelete.fileName}
                className="w-12 h-12 object-cover rounded"
              />
              <div className="truncate text-[11px]">
                <strong className="text-slate-200 block truncate">{photoToDelete.fileName}</strong>
                <span className="text-slate-500">
                  {STAGE_CONFIG[photoToDelete.stage]?.label} •{' '}
                  {formatFileSize(photoToDelete.sizeBytes)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPhotoToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-rose-600/30"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
