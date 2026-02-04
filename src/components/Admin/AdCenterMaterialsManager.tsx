import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAdCenterAdmin, AdCenterMaterial } from '@/hooks/useAdCenter';
import { ImageUploadPreview } from '@/components/ImageUploadPreview';
import { 
  Megaphone, 
  Plus, 
  Edit, 
  Trash2, 
  Image as ImageIcon,
  Calendar,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eye
} from 'lucide-react';

const AdCenterMaterialsManager: React.FC = () => {
  const {
    materials,
    stats,
    loading,
    processing,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    toggleMaterialActive,
    uploadMaterialImage,
    refreshData
  } = useAdCenterAdmin();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<AdCenterMaterial | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    target_date: ''
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      image_url: '',
      target_date: ''
    });
    setSelectedFile(null);
  };

  const handleCreate = async () => {
    if (!formData.title.trim()) return;
    
    setUploadingImage(true);
    
    try {
      let imageUrl = formData.image_url;
      
      // Se tem arquivo selecionado, fazer upload
      if (selectedFile) {
        const uploadedUrl = await uploadMaterialImage(selectedFile);
        if (!uploadedUrl) {
          setUploadingImage(false);
          return;
        }
        imageUrl = uploadedUrl;
      }

      const success = await createMaterial({
        title: formData.title,
        description: formData.description || undefined,
        image_url: imageUrl || undefined,
        target_date: formData.target_date || undefined
      });

      if (success) {
        setIsCreateOpen(false);
        resetForm();
      }
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingMaterial || !formData.title.trim()) return;

    setUploadingImage(true);
    
    try {
      let imageUrl = formData.image_url;
      
      // Se tem arquivo selecionado, fazer upload
      if (selectedFile) {
        const uploadedUrl = await uploadMaterialImage(selectedFile);
        if (!uploadedUrl) {
          setUploadingImage(false);
          return;
        }
        imageUrl = uploadedUrl;
      }

      const success = await updateMaterial(editingMaterial.id, {
        title: formData.title,
        description: formData.description || null,
        image_url: imageUrl || null,
        target_date: formData.target_date || null
      });

      if (success) {
        setEditingMaterial(null);
        resetForm();
      }
    } finally {
      setUploadingImage(false);
    }
  };

  const handleEdit = (material: AdCenterMaterial) => {
    setEditingMaterial(material);
    setFormData({
      title: material.title,
      description: material.description || '',
      image_url: material.image_url || '',
      target_date: material.target_date || ''
    });
    setSelectedFile(null);
  };

  const handleImageSelect = (file: File | null) => {
    setSelectedFile(file);
    // Se uma nova imagem foi selecionada, limpar a URL atual
    if (file) {
      setFormData(prev => ({ ...prev, image_url: '' }));
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Materiais</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMaterials}</div>
            <p className="text-xs text-muted-foreground">{stats.activeMaterials} ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmações Hoje</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.todayConfirmations}</div>
            <p className="text-xs text-muted-foreground">parceiros divulgaram</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmações na Semana</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.weekConfirmations}</div>
            <p className="text-xs text-muted-foreground">total de divulgações</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ações</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={refreshData} disabled={processing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${processing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Materiais */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Materiais Promocionais</CardTitle>
            <CardDescription>Cadastre e gerencie materiais para os parceiros divulgarem</CardDescription>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Material
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Novo Material Promocional</DialogTitle>
                <DialogDescription>
                  Cadastre um material para os parceiros divulgarem nas redes sociais
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Promoção de Fevereiro"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Legenda Sugerida</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Texto para o parceiro copiar e colar nas redes sociais"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Imagem do Material</Label>
                  <ImageUploadPreview
                    onImageSelect={handleImageSelect}
                    compact
                    maxWidth={1200}
                    maxHeight={800}
                    showCardPreview={false}
                    disabled={uploadingImage}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="target_date">Data Alvo (opcional)</Label>
                  <Input
                    id="target_date"
                    type="date"
                    value={formData.target_date}
                    onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se preenchido, este material será exibido apenas nesta data. Deixe vazio para material genérico.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={processing || uploadingImage || !formData.title.trim()}>
                  {uploadingImage ? 'Fazendo upload...' : processing ? 'Criando...' : 'Criar Material'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent>
          {materials.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Data Alvo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.map((material) => (
                    <TableRow key={material.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {material.image_url ? (
                            <img 
                              src={material.image_url} 
                              alt={material.title}
                              className="w-10 h-10 rounded object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                              <ImageIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{material.title}</p>
                            {material.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {material.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {material.target_date ? (
                          <Badge variant="outline">
                            {formatDate(material.target_date)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Genérico</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={material.is_active}
                            onCheckedChange={(checked) => toggleMaterialActive(material.id, checked)}
                            disabled={processing}
                          />
                          <span className="text-sm">
                            {material.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(material.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {material.image_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(material.image_url!, '_blank')}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          
                          <Dialog open={editingMaterial?.id === material.id} onOpenChange={(open) => !open && setEditingMaterial(null)}>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(material)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]">
                              <DialogHeader>
                                <DialogTitle>Editar Material</DialogTitle>
                              </DialogHeader>
                              
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="edit-title">Título *</Label>
                                  <Input
                                    id="edit-title"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="edit-description">Legenda Sugerida</Label>
                                  <Textarea
                                    id="edit-description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={4}
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label>Imagem do Material</Label>
                                  {formData.image_url && !selectedFile && (
                                    <div className="mb-3 p-3 bg-muted rounded-lg">
                                      <div className="flex items-center gap-3">
                                        <img 
                                          src={formData.image_url} 
                                          alt="Imagem atual"
                                          className="w-16 h-16 rounded object-cover"
                                        />
                                        <div className="flex-1">
                                          <p className="text-sm font-medium">Imagem atual</p>
                                          <p className="text-xs text-muted-foreground">Selecione uma nova imagem abaixo para substituir</p>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  <ImageUploadPreview
                                    onImageSelect={handleImageSelect}
                                    compact
                                    maxWidth={1200}
                                    maxHeight={800}
                                    showCardPreview={false}
                                    disabled={uploadingImage}
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="edit-target_date">Data Alvo</Label>
                                  <Input
                                    id="edit-target_date"
                                    type="date"
                                    value={formData.target_date}
                                    onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                                  />
                                </div>
                              </div>

                              <DialogFooter>
                                <Button variant="outline" onClick={() => setEditingMaterial(null)}>
                                  Cancelar
                                </Button>
                                <Button onClick={handleUpdate} disabled={processing || uploadingImage || !formData.title.trim()}>
                                  {uploadingImage ? 'Fazendo upload...' : processing ? 'Salvando...' : 'Salvar'}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Material</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir "{material.title}"? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMaterial(material.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum material cadastrado</p>
              <p className="text-sm mt-2">Clique em "Novo Material" para começar</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdCenterMaterialsManager;
