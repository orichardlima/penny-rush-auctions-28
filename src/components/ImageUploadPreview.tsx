import React, { useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  X, 
  CheckCircle, 
  AlertTriangle, 
  Info,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { processImageFile, createImagePreview, validateImageFile, validateImageDimensions } from '@/utils/imageUtils';
import { toast } from '@/hooks/use-toast';

interface ImageUploadPreviewProps {
  onImageSelect: (file: File | null) => void;
  onImageProcessed?: (processedFile: File) => void;
  className?: string;
  disabled?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  showCardPreview?: boolean;
  compact?: boolean;
}

interface ValidationStatus {
  valid: boolean;
  issues: string[];
  suggestions: string[];
  score: number; // 0-100
}

export const ImageUploadPreview: React.FC<ImageUploadPreviewProps> = ({
  onImageSelect,
  onImageProcessed,
  className,
  disabled = false,
  maxWidth = 1200,
  maxHeight = 800,
  showCardPreview = true,
  compact = false
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processedFile, setProcessedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cardPreview, setCardPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validation, setValidation] = useState<ValidationStatus | null>(null);
  const [showDetails, setShowDetails] = useState(!compact);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateImage = useCallback(async (file: File, imageElement: HTMLImageElement): Promise<ValidationStatus> => {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Validação básica de arquivo
    const fileValidation = validateImageFile(file);
    if (!fileValidation.valid) {
      issues.push(fileValidation.error!);
      score -= 30;
    }

    // Validação de dimensões
    const dimensionValidation = validateImageDimensions(imageElement.width, imageElement.height);
    if (!dimensionValidation.valid) {
      issues.push(dimensionValidation.error!);
      score -= 25;
    }

    // Validar proporção ideal (4:3 ou 3:2)
    const aspectRatio = imageElement.width / imageElement.height;
    const idealRatios = [4/3, 3/2, 16/9];
    const closestRatio = idealRatios.reduce((prev, curr) => 
      Math.abs(curr - aspectRatio) < Math.abs(prev - aspectRatio) ? curr : prev
    );
    
    if (Math.abs(aspectRatio - closestRatio) > 0.2) {
      suggestions.push(`Proporção atual: ${aspectRatio.toFixed(2)}:1. Recomendado: ${closestRatio.toFixed(2)}:1`);
      score -= 10;
    }

    // Validar tamanho do arquivo (ideal: 200KB-800KB)
    const fileSizeKB = file.size / 1024;
    if (fileSizeKB < 200) {
      suggestions.push('Imagem pequena - qualidade pode ser baixa');
      score -= 5;
    } else if (fileSizeKB > 2000) {
      suggestions.push('Imagem grande - será comprimida automaticamente');
      score -= 5;
    }

    // Validar formato
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      issues.push('Formato não recomendado - use JPEG, PNG ou WebP');
      score -= 15;
    }

    // Sugestões baseadas nas dimensões
    if (imageElement.width < maxWidth || imageElement.height < maxHeight) {
      suggestions.push(`Imagem será otimizada para ${maxWidth}x${maxHeight}px`);
    }

    return {
      valid: issues.length === 0,
      issues,
      suggestions,
      score: Math.max(0, score)
    };
  }, [maxWidth, maxHeight]);

  const createCardPreviewStyle = useCallback((imageSrc: string) => {
    // Simular como a imagem ficará no AuctionCard (object-cover)
    return {
      backgroundImage: `url(${imageSrc})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    };
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    if (disabled) return;

    setSelectedFile(file);
    setProcessing(true);
    setUploadProgress(20);

    try {
      // Criar preview da imagem original
      const originalPreview = await createImagePreview(file);
      setPreview(originalPreview);
      setUploadProgress(40);

      // Validar imagem
      const img = new Image();
      img.onload = async () => {
        const validationResult = await validateImage(file, img);
        setValidation(validationResult);
        setUploadProgress(60);

        // Processar imagem automaticamente
        try {
          const optimizedFile = await processImageFile(file, {
            maxWidth,
            maxHeight,
            quality: 0.85,
            format: 'webp'
          });
          
          setProcessedFile(optimizedFile);
          setUploadProgress(80);

          // Criar preview otimizado para card
          const optimizedPreview = await createImagePreview(optimizedFile);
          setCardPreview(optimizedPreview);
          setUploadProgress(100);

          // Notificar componente pai
          onImageSelect(file);
          onImageProcessed?.(optimizedFile);

          if (validationResult.score >= 80) {
            toast({
              title: "Imagem processada!",
              description: `Qualidade excelente (${validationResult.score}/100). Pronta para upload.`
            });
          } else if (validationResult.score >= 60) {
            toast({
              title: "Imagem processada",
              description: `Qualidade boa (${validationResult.score}/100). Algumas otimizações aplicadas.`
            });
          } else {
            toast({
              title: "Imagem processada",
              description: `Qualidade baixa (${validationResult.score}/100). Considere usar uma imagem melhor.`,
              variant: "destructive"
            });
          }

        } catch (error) {
          console.error('Erro ao processar imagem:', error);
          toast({
            title: "Erro no processamento",
            description: "Não foi possível otimizar a imagem",
            variant: "destructive"
          });
        }
      };
      img.src = originalPreview;

    } catch (error) {
      console.error('Erro ao selecionar imagem:', error);
      toast({
        title: "Erro",
        description: "Não foi possível processar a imagem selecionada",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  }, [disabled, maxWidth, maxHeight, onImageSelect, onImageProcessed, validateImage]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  }, [disabled, handleFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const clearSelection = useCallback(() => {
    setSelectedFile(null);
    setProcessedFile(null);
    setPreview(null);
    setCardPreview(null);
    setValidation(null);
    setUploadProgress(0);
    onImageSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onImageSelect]);

  const getValidationIcon = () => {
    if (!validation) return null;
    if (validation.score >= 80) return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (validation.score >= 60) return <Info className="w-5 h-5 text-blue-500" />;
    return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
  };

  const getValidationColor = () => {
    if (!validation) return 'bg-gray-500';
    if (validation.score >= 80) return 'bg-green-500';
    if (validation.score >= 60) return 'bg-blue-500';
    return 'bg-yellow-500';
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Área de Upload */}
      <Card className={cn(
        "border-2 border-dashed transition-all duration-200",
        dragActive && "border-primary bg-primary/5",
        disabled && "opacity-50 cursor-not-allowed"
      )}>
        <CardContent 
          className="p-6 text-center cursor-pointer"
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={disabled}
          />
          
          {processing ? (
            <div className="space-y-4">
              <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Processando imagem...</p>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            </div>
          ) : !selectedFile ? (
            <div className="space-y-4">
              <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
              <div>
                <p className="text-lg font-medium mb-2">
                  Arraste uma imagem ou clique para selecionar
                </p>
                <p className="text-sm text-muted-foreground">
                  Formatos aceitos: JPEG, PNG, WebP • Máximo: 5MB
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ideal: {maxWidth}x{maxHeight}px • Proporção 4:3 ou 3:2
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <ImageIcon className="w-12 h-12 mx-auto text-green-500" />
              <div>
                <p className="text-lg font-medium mb-2 text-green-600">
                  Imagem selecionada e otimizada!
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedFile.name} • {(selectedFile.size / 1024).toFixed(0)}KB
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validação e Score */}
      {validation && (
        <Card>
          <CardContent className={compact ? "p-3" : "p-4"}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {getValidationIcon()}
                <span className={compact ? "text-sm font-medium" : "font-medium"}>
                  Qualidade: {validation.score}/100
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={compact ? "text-xs" : ""}>
                  {validation.score >= 80 ? 'Excelente' : 
                   validation.score >= 60 ? 'Boa' : 'Melhorar'}
                </Badge>
                {compact && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDetails(!showDetails)}
                    className="h-6 px-2 text-xs"
                  >
                    {showDetails ? 'Ocultar' : 'Ver'}
                  </Button>
                )}
              </div>
            </div>

            {!compact && <Progress value={validation.score} className={cn("h-2 mb-3", getValidationColor())} />}

            {showDetails && validation.issues.length > 0 && (
              <div className="space-y-1 mb-2">
                <p className={`font-medium text-red-600 ${compact ? "text-xs" : "text-sm"}`}>Problemas:</p>
                {(compact ? validation.issues.slice(0, 2) : validation.issues).map((issue, index) => (
                  <p key={index} className={`text-red-600 ml-3 ${compact ? "text-xs" : "text-xs"}`}>• {issue}</p>
                ))}
              </div>
            )}

            {showDetails && validation.suggestions.length > 0 && (
              <div className="space-y-1">
                <p className={`font-medium text-blue-600 ${compact ? "text-xs" : "text-sm"}`}>Sugestões:</p>
                {(compact ? validation.suggestions.slice(0, 2) : validation.suggestions).map((suggestion, index) => (
                  <p key={index} className={`text-blue-600 ml-3 ${compact ? "text-xs" : "text-xs"}`}>• {suggestion}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview das Imagens */}
      {preview && (
        <div className={compact ? "space-y-3" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
          {/* Preview Original */}
          <Card>
            <CardContent className={compact ? "p-3" : "p-4"}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className={compact ? "text-sm font-medium" : "font-medium"}>
                    {compact ? "Preview" : "Imagem Original"}
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className={`text-red-500 hover:text-red-700 ${compact ? "h-6 w-6 p-1" : ""}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className={`bg-muted rounded-lg overflow-hidden ${compact ? "aspect-[4/3]" : "aspect-[4/3]"}`}>
                  <img
                    src={preview}
                    alt="Preview original"
                    className="w-full h-full object-cover"
                  />
                </div>
                {!compact && (
                  <p className="text-xs text-muted-foreground text-center">
                    Como você enviou
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Preview do Card (se disponível) */}
          {!compact && showCardPreview && cardPreview && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <h4 className="font-medium">Como ficará no Leilão</h4>
                  <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden border-2 border-primary/20">
                    <div
                      className="w-full h-full"
                      style={createCardPreviewStyle(cardPreview)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Otimizada automaticamente
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Informações Técnicas */}
      {processedFile && (
        <Card className="bg-muted/50">
          <CardContent className={compact ? "p-3" : "p-4"}>
            {compact ? (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Otimizada:</span>
                <span className="font-medium text-green-600">
                  -{(100 - (processedFile.size / selectedFile!.size) * 100).toFixed(0)}% 
                  ({(processedFile.size / 1024).toFixed(0)}KB)
                </span>
              </div>
            ) : (
              <>
                <h4 className="font-medium mb-2">Otimização Aplicada</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Tamanho original:</p>
                    <p className="font-medium">{(selectedFile!.size / 1024).toFixed(0)}KB</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tamanho otimizado:</p>
                    <p className="font-medium text-green-600">
                      {(processedFile.size / 1024).toFixed(0)}KB
                      <span className="text-xs ml-1">
                        (-{(100 - (processedFile.size / selectedFile!.size) * 100).toFixed(0)}%)
                      </span>
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};