import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useProductTemplates, ProductTemplateInput, TEMPLATE_CATEGORIES } from '@/hooks/useProductTemplates';
import { BatchAuctionGenerator } from './BatchAuctionGenerator';
import { Plus, Pencil, Trash2, Package, Rocket, Image, AlertCircle, RefreshCw, Upload, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { processImageFile, AUCTION_CARD_OPTIONS } from '@/utils/imageUtils';

export const ProductTemplatesManager = () => {
  const { templates, loading, error, fetchTemplates, createTemplate, updateTemplate, deleteTemplate } = useProductTemplates();
  
  console.log('[ProductTemplatesManager] Render:', { loading, error, templatesCount: templates?.length });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState<ProductTemplateInput>({
    title: '',
    description: '',
    image_url: '',
    market_value: 0,
    revenue_target: 0,
    starting_price: 0.01,
    bid_increment: 0.01,
    bid_cost: 1,
    category: 'geral',
    is_active: true
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      image_url: '',
      market_value: 0,
      revenue_target: 0,
      starting_price: 0.01,
      bid_increment: 0.01,
      bid_cost: 1,
      category: 'geral',
      is_active: true
    });
    setEditingTemplate(null);
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleImageSelect = (file: File) => {
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);
      
      // Process image for optimization
      const processedFile = await processImageFile(file, AUCTION_CARD_OPTIONS);
      
      // Generate unique filename
      const fileExt = processedFile.name.split('.').pop();
      const fileName = `template_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `templates/${fileName}`;
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('auction-images')
        .upload(filePath, processedFile, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) {
        console.error('Upload error:', error);
        toast.error('Erro ao fazer upload da imagem');
        return null;
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('auction-images')
        .getPublicUrl(filePath);
      
      return urlData.publicUrl;
    } catch (err) {
      console.error('Image upload error:', err);
      toast.error('Erro ao processar imagem');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleOpenDialog = (templateId?: string) => {
    if (templateId) {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        setFormData({
          title: template.title,
          description: template.description || '',
          image_url: template.image_url || '',
          market_value: template.market_value,
          revenue_target: template.revenue_target,
          starting_price: template.starting_price,
          bid_increment: template.bid_increment,
          bid_cost: template.bid_cost,
          category: template.category,
          is_active: template.is_active
        });
        setEditingTemplate(templateId);
        // Set existing image as preview
        if (template.image_url) {
          setImagePreview(template.image_url);
        }
      }
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.title) return;

    let finalImageUrl = formData.image_url;
    
    // Upload new image if selected
    if (selectedImage) {
      const uploadedUrl = await uploadImage(selectedImage);
      if (uploadedUrl) {
        finalImageUrl = uploadedUrl;
      }
    }

    const dataToSave = {
      ...formData,
      image_url: finalImageUrl
    };

    if (editingTemplate) {
      await updateTemplate(editingTemplate, dataToSave);
    } else {
      await createTemplate(dataToSave);
    }
    
    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este template?')) {
      await deleteTemplate(id);
    }
  };

  const filteredTemplates = categoryFilter === 'all' 
    ? templates 
    : templates.filter(t => t.category === categoryFilter);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Carregando templates...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-medium">Erro ao carregar templates</p>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchTemplates} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Tentar Novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            Templates de Produtos
          </h2>
          <p className="text-muted-foreground">
            Gerencie sua biblioteca de produtos para criar leilões rapidamente
          </p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isBatchDialogOpen} onOpenChange={setIsBatchDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="default" className="gap-2">
                <Rocket className="h-4 w-4" />
                Gerar Leilões em Lote
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <BatchAuctionGenerator 
                templates={templates.filter(t => t.is_active)} 
                onClose={() => setIsBatchDialogOpen(false)} 
              />
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? 'Editar Template' : 'Novo Template de Produto'}
                </DialogTitle>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Título do Produto *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: iPhone 15 Pro 256GB"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição do produto..."
                    rows={3}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Imagem do Produto</Label>
                  
                  {/* Preview da imagem existente ou selecionada */}
                  {imagePreview && (
                    <div className="relative w-full max-w-xs">
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        className="w-full h-48 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={clearSelectedImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  
                  {/* Input de arquivo */}
                  {!imagePreview && (
                    <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                      <input
                        type="file"
                        id="image-upload"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageSelect(file);
                        }}
                        disabled={uploading}
                      />
                      <label 
                        htmlFor="image-upload" 
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        <Upload className="h-10 w-10 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Clique para selecionar uma imagem
                        </span>
                        <span className="text-xs text-muted-foreground">
                          PNG, JPG ou WEBP (máx. 5MB)
                        </span>
                      </label>
                    </div>
                  )}
                  
                  {uploading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Fazendo upload...
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="market_value">Valor de Mercado (R$)</Label>
                    <Input
                      id="market_value"
                      type="number"
                      step="0.01"
                      value={formData.market_value}
                      onChange={(e) => setFormData({ ...formData, market_value: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="revenue_target">Meta de Receita (R$)</Label>
                    <Input
                      id="revenue_target"
                      type="number"
                      step="0.01"
                      value={formData.revenue_target}
                      onChange={(e) => setFormData({ ...formData, revenue_target: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="starting_price">Preço Inicial (R$)</Label>
                    <Input
                      id="starting_price"
                      type="number"
                      step="0.01"
                      value={formData.starting_price}
                      onChange={(e) => setFormData({ ...formData, starting_price: parseFloat(e.target.value) || 0.01 })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="bid_increment">Incremento (R$)</Label>
                    <Input
                      id="bid_increment"
                      type="number"
                      step="0.01"
                      value={formData.bid_increment}
                      onChange={(e) => setFormData({ ...formData, bid_increment: parseFloat(e.target.value) || 0.01 })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="bid_cost">Custo por Lance</Label>
                    <Input
                      id="bid_cost"
                      type="number"
                      step="0.01"
                      value={formData.bid_cost}
                      onChange={(e) => setFormData({ ...formData, bid_cost: parseFloat(e.target.value) || 1 })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Select 
                      value={formData.category} 
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label>Template Ativo</Label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSubmit} disabled={!formData.title}>
                    {editingTemplate ? 'Salvar Alterações' : 'Criar Template'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Biblioteca de Templates ({filteredTemplates.length})
            </CardTitle>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {TEMPLATE_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum template encontrado</p>
              <p className="text-sm">Crie seu primeiro template de produto</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor de Mercado</TableHead>
                  <TableHead className="text-right">Meta Receita</TableHead>
                  <TableHead className="text-center">Usos</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {template.image_url ? (
                          <img 
                            src={template.image_url} 
                            alt={template.title}
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                            <Image className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{template.title}</p>
                          {template.description && (
                            <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {template.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {TEMPLATE_CATEGORIES.find(c => c.value === template.category)?.label || template.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(template.market_value)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(template.revenue_target)}
                    </TableCell>
                    <TableCell className="text-center">
                      {template.times_used}x
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={template.is_active ? 'default' : 'secondary'}>
                        {template.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(template.id)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(template.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
