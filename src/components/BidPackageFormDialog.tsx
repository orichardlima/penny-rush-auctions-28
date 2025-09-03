import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { calculateBidBreakdown, validatePackageConfig } from '@/utils/bidCalculations';

const bidPackageSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  bids_count: z.number().min(1, 'Quantidade de lances deve ser maior que 0'),
  price: z.number().min(0.01, 'Preço deve ser maior que 0'),
  original_price: z.number().optional(),
  icon: z.string().optional(),
  is_popular: z.boolean().default(false),
  features: z.array(z.string()).default([])
});

type BidPackageFormData = z.infer<typeof bidPackageSchema>;

interface BidPackage {
  id: string;
  name: string;
  bids_count: number;
  price: number;
  original_price?: number;
  icon?: string;
  is_popular: boolean;
  features: string[];
}

interface BidPackageFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  package?: BidPackage | null;
  onSuccess: () => void;
}

export const BidPackageFormDialog: React.FC<BidPackageFormDialogProps> = ({
  open,
  onOpenChange,
  package: editingPackage,
  onSuccess
}) => {
  const isEditing = !!editingPackage;
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [newFeature, setNewFeature] = React.useState('');

  const form = useForm<BidPackageFormData>({
    resolver: zodResolver(bidPackageSchema),
    defaultValues: {
      name: '',
      bids_count: 0,
      price: 0,
      original_price: 0,
      icon: 'Package',
      is_popular: false,
      features: []
    }
  });

  const { register, handleSubmit, formState: { errors }, setValue, watch, reset } = form;
  const watchedFeatures = watch('features');

  // Reset form when dialog opens/closes or package changes
  useEffect(() => {
    if (open) {
      if (editingPackage) {
        reset({
          name: editingPackage.name,
          bids_count: editingPackage.bids_count,
          price: editingPackage.price,
          original_price: editingPackage.original_price || 0,
          icon: editingPackage.icon || 'Package',
          is_popular: editingPackage.is_popular,
          features: editingPackage.features || []
        });
      } else {
        reset({
          name: '',
          bids_count: 0,
          price: 0,
          original_price: 0,
          icon: 'Package',
          is_popular: false,
          features: []
        });
      }
    }
  }, [open, editingPackage, reset]);

  const addFeature = () => {
    if (newFeature.trim()) {
      const currentFeatures = watchedFeatures || [];
      setValue('features', [...currentFeatures, newFeature.trim()]);
      setNewFeature('');
    }
  };

  const removeFeature = (index: number) => {
    const currentFeatures = watchedFeatures || [];
    setValue('features', currentFeatures.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: BidPackageFormData) => {
    setIsSubmitting(true);
    
    try {
      // Validate package configuration
      const validation = validatePackageConfig(data.price, data.bids_count);
      if (!validation.isValid) {
        toast({
          title: "Configuração inválida",
          description: validation.error,
          variant: "destructive"
        });
        setIsSubmitting(false);
        return;
      }

      // Generate features with correct bid calculation
      const { baseDescription } = calculateBidBreakdown(data.price, data.bids_count);
      const additionalFeatures = data.features.filter(f => 
        f.trim() !== '' && 
        !f.toLowerCase().includes('lance') && 
        !f.toLowerCase().includes('bônus')
      );
      const updatedFeatures = [baseDescription, ...additionalFeatures];

      const packageData = {
        name: data.name,
        bids_count: data.bids_count,
        price: data.price,
        original_price: data.original_price || null,
        icon: data.icon || 'Package',
        is_popular: data.is_popular,
        features: updatedFeatures
      };

      if (isEditing && editingPackage) {
        const { error } = await supabase
          .from('bid_packages')
          .update(packageData)
          .eq('id', editingPackage.id);

        if (error) throw error;
        
        toast({
          title: 'Pacote atualizado!',
          description: `${data.name} foi atualizado com sucesso.`
        });
      } else {
        const { error } = await supabase
          .from('bid_packages')
          .insert([packageData]);

        if (error) throw error;
        
        toast({
          title: 'Pacote criado!',
          description: `${data.name} foi criado com sucesso.`
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar pacote:', error);
      toast({
        title: 'Erro!',
        description: 'Não foi possível salvar o pacote. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Pacote' : 'Criar Novo Pacote'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Pacote</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Ex: Pacote Básico"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bids_count">Quantidade de Lances</Label>
              <Input
                id="bids_count"
                type="number"
                min="1"
                {...register('bids_count', { valueAsNumber: true })}
              />
              {errors.bids_count && (
                <p className="text-sm text-destructive">{errors.bids_count.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Preço (R$)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0.01"
                {...register('price', { valueAsNumber: true })}
              />
              {errors.price && (
                <p className="text-sm text-destructive">{errors.price.message}</p>
              )}
            </div>
          </div>

          {/* Calculation Preview */}
          {watch("price") > 0 && watch("bids_count") > 0 && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Cálculo:</p>
              <p className="text-sm text-muted-foreground">
                {(() => {
                  const calc = calculateBidBreakdown(watch("price"), watch("bids_count"));
                  return `${calc.baseBids} lances base + ${calc.bonusBids} bônus = ${calc.totalBids} total`;
                })()}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="original_price">Preço Original (R$)</Label>
              <Input
                id="original_price"
                type="number"
                step="0.01"
                min="0"
                {...register('original_price', { valueAsNumber: true })}
                placeholder="Opcional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="icon">Ícone</Label>
              <Input
                id="icon"
                {...register('icon')}
                placeholder="Package"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_popular"
              {...register('is_popular')}
            />
            <Label htmlFor="is_popular">Marcar como popular</Label>
          </div>

          <div className="space-y-2">
            <Label>Características</Label>
            <div className="flex space-x-2">
              <Input
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                placeholder="Adicionar característica"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
              />
              <Button type="button" onClick={addFeature} variant="outline">
                Adicionar
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {watchedFeatures?.map((feature, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {feature}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => removeFeature(index)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Criar')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};