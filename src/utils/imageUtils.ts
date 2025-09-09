// Image validation and optimization utilities

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export interface ImageOptimizationOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  format: 'webp' | 'jpeg';
}

// Configurações padrão
export const DEFAULT_IMAGE_OPTIONS: ImageOptimizationOptions = {
  maxWidth: 1200,
  maxHeight: 900,
  quality: 0.85,
  format: 'webp'
};

// Validar arquivo de imagem
export const validateImageFile = (file: File): ImageValidationResult => {
  // Verificar se é arquivo
  if (!file) {
    return { valid: false, error: 'Nenhum arquivo selecionado' };
  }

  // Verificar tamanho máximo (5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB em bytes
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: `Arquivo muito grande. Máximo permitido: 5MB (atual: ${(file.size / 1024 / 1024).toFixed(1)}MB)` 
    };
  }

  // Verificar tipo de arquivo
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: 'Formato não suportado. Use: JPEG, PNG ou WebP' 
    };
  }

  return { valid: true };
};

// Validar dimensões da imagem
export const validateImageDimensions = (
  width: number, 
  height: number
): ImageValidationResult => {
  const minWidth = 200;
  const minHeight = 200;
  const maxWidth = 4000;
  const maxHeight = 4000;

  if (width < minWidth || height < minHeight) {
    return { 
      valid: false, 
      error: `Imagem muito pequena. Mínimo: ${minWidth}x${minHeight}px (atual: ${width}x${height}px)` 
    };
  }

  if (width > maxWidth || height > maxHeight) {
    return { 
      valid: false, 
      error: `Imagem muito grande. Máximo: ${maxWidth}x${maxHeight}px (atual: ${width}x${height}px)` 
    };
  }

  return { valid: true };
};

// Otimizar imagem (redimensionar e comprimir)
export const optimizeImage = (
  file: File, 
  options: Partial<ImageOptimizationOptions> = {}
): Promise<File> => {
  const opts = { ...DEFAULT_IMAGE_OPTIONS, ...options };
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Não foi possível criar contexto do canvas'));
      return;
    }

    img.onload = () => {
      // Validar dimensões originais
      const dimensionValidation = validateImageDimensions(img.width, img.height);
      if (!dimensionValidation.valid) {
        reject(new Error(dimensionValidation.error));
        return;
      }

      // Calcular novas dimensões mantendo proporção
      let { width, height } = calculateOptimalDimensions(
        img.width, 
        img.height, 
        opts.maxWidth, 
        opts.maxHeight
      );

      // Configurar canvas
      canvas.width = width;
      canvas.height = height;

      // Desenhar imagem redimensionada
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Converter para blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Erro ao processar imagem'));
            return;
          }

          // Criar novo arquivo com nome otimizado
          const optimizedFileName = generateOptimizedFileName(file.name, opts.format);
          const optimizedFile = new File([blob], optimizedFileName, {
            type: `image/${opts.format}`,
            lastModified: Date.now()
          });

          resolve(optimizedFile);
        },
        `image/${opts.format}`,
        opts.quality
      );
    };

    img.onerror = () => {
      reject(new Error('Erro ao carregar imagem'));
    };

    // Carregar imagem
    img.src = URL.createObjectURL(file);
  });
};

// Calcular dimensões ideais mantendo proporção
const calculateOptimalDimensions = (
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } => {
  // Se já está dentro dos limites, manter original
  if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
    return { width: originalWidth, height: originalHeight };
  }

  // Calcular proporção
  const aspectRatio = originalWidth / originalHeight;

  let width = maxWidth;
  let height = width / aspectRatio;

  // Se altura ultrapassar limite, ajustar por altura
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  return {
    width: Math.round(width),
    height: Math.round(height)
  };
};

// Gerar nome otimizado para arquivo
const generateOptimizedFileName = (originalName: string, format: string): string => {
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
  const timestamp = Date.now();
  return `${nameWithoutExt}_optimized_${timestamp}.${format}`;
};

// Função completa de validação e otimização
export const processImageFile = async (
  file: File,
  options?: Partial<ImageOptimizationOptions>
): Promise<File> => {
  // Validar arquivo
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Otimizar imagem
  const optimizedFile = await optimizeImage(file, options);
  
  return optimizedFile;
};

// Utilitário para preview de imagem
export const createImagePreview = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error('Erro ao criar preview'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsDataURL(file);
  });
};