import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fromZonedTime } from 'date-fns-tz';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { Edit, Trash2, Plus, CheckCircle, Upload, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { processImageFile, createImagePreview, AUCTION_CARD_OPTIONS } from '@/utils/imageUtils';
import { ImageUploadPreview } from '@/components/ImageUploadPreview';
import { Auction } from './types';
import { formatPrice, formatDateTime, formatDateTimeLocal, getInitialStartTime } from './helpers';

interface AuctionManagementTabProps {
  auctions: Auction[];
  onRefresh: () => void;
}

const AuctionManagementTab: React.FC<AuctionManagementTabProps> = ({ auctions, onRefresh }) => {
  const [newAuction, setNewAuction] = useState({
    title: '', description: '', image_url: '',
    starting_price: 0.01, market_value: 0.00, revenue_target: 0.00,
    starts_at: getInitialStartTime()
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingAuction, setEditingAuction] = useState<Auction | null>(null);
  const [editingImage, setEditingImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedAuctions, setSelectedAuctions] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const uploadImage = async (file: File): Promise<string> => {
    try {
      const optimizedFile = await processImageFile(file, AUCTION_CARD_OPTIONS);
      const fileName = `${Date.now()}-${optimizedFile.name}`;
      const { data, error } = await supabase.storage.from('auction-images').upload(fileName, optimizedFile);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('auction-images').getPublicUrl(fileName);
      return publicUrl;
    } catch (error) {
      const fileName = `${Date.now()}-${file.name}`;
      const { data, error: uploadError } = await supabase.storage.from('auction-images').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('auction-images').getPublicUrl(fileName);
      return publicUrl;
    }
  };

  const createAuction = async () => {
    if (!newAuction.title || !newAuction.description) {
      toast({ title: "Erro", description: "Título e descrição são obrigatórios", variant: "destructive" });
      return;
    }
    const brazilTimezone = 'America/Sao_Paulo';
    const inputTime = new Date(newAuction.starts_at);
    const utcStartTime = fromZonedTime(inputTime, brazilTimezone);
    const now = new Date();
    if (utcStartTime <= new Date(now.getTime() + 60 * 1000)) {
      toast({ title: "Erro", description: "O horário de início deve ser pelo menos 1 minuto no futuro", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      let imageUrl = newAuction.image_url;
      if (selectedImage) imageUrl = await uploadImage(selectedImage);
      const { error } = await supabase.from('auctions').insert([{
        ...newAuction, image_url: imageUrl, current_price: newAuction.starting_price,
        status: 'waiting', starts_at: utcStartTime.toISOString()
      }]);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Leilão criado com sucesso!" });
      setNewAuction({ title: '', description: '', image_url: '', starting_price: 0.01, market_value: 0.00, revenue_target: 0.00, starts_at: getInitialStartTime() });
      setSelectedImage(null);
      onRefresh();
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao criar leilão", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const deleteAuction = async (auctionId: string) => {
    try {
      const { error } = await supabase.from('auctions').delete().eq('id', auctionId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Leilão deletado com sucesso!" });
      onRefresh();
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao deletar leilão", variant: "destructive" });
    }
  };

  const toggleAuctionVisibility = async (auctionId: string, hide: boolean) => {
    try {
      const { error } = await supabase.from('auctions').update({ is_hidden: hide }).eq('id', auctionId);
      if (error) throw error;
      toast({ title: hide ? "Leilão ocultado" : "Leilão visível", description: hide ? "O leilão não será mais exibido na home." : "O leilão voltou a ser exibido na home." });
      onRefresh();
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao alterar visibilidade do leilão", variant: "destructive" });
    }
  };

  const handleImageSelection = async (file: File | null) => {
    if (!file) { setEditingImage(null); setImagePreview(null); return; }
    setImageProcessing(true);
    try {
      const preview = await createImagePreview(file);
      setImagePreview(preview);
      setEditingImage(file);
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao processar imagem selecionada", variant: "destructive" });
    } finally {
      setImageProcessing(false);
    }
  };

  const updateAuction = async () => {
    if (!editingAuction) return;
    setUploading(true);
    try {
      let updateData: any = {
        title: editingAuction.title, description: editingAuction.description,
        starting_price: editingAuction.starting_price, market_value: editingAuction.market_value,
        revenue_target: editingAuction.revenue_target
      };
      if (editingImage) {
        const newImageUrl = await uploadImage(editingImage);
        updateData.image_url = newImageUrl;
        if (editingAuction.image_url) {
          try {
            const oldFileName = editingAuction.image_url.split('/').pop();
            if (oldFileName) await supabase.storage.from('auction-images').remove([oldFileName]);
          } catch (err) { console.warn('Erro ao remover imagem antiga:', err); }
        }
      }
      const { error } = await supabase.from('auctions').update(updateData).eq('id', editingAuction.id);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Leilão atualizado com sucesso!" });
      setIsEditDialogOpen(false); setEditingAuction(null); setEditingImage(null); setImagePreview(null);
      onRefresh();
    } catch (error) {
      toast({ title: "Erro", description: error instanceof Error ? error.message : "Erro ao atualizar leilão", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSelectAuction = (auctionId: string, checked: boolean) => {
    const newSelected = new Set(selectedAuctions);
    if (checked) newSelected.add(auctionId); else newSelected.delete(auctionId);
    setSelectedAuctions(newSelected);
  };

  const handleSelectAllAuctions = (checked: boolean) => {
    setSelectedAuctions(checked ? new Set(auctions.map((a) => a.id)) : new Set());
  };

  const deleteSelectedAuctions = async () => {
    if (selectedAuctions.size === 0) return;
    const confirmed = window.confirm(`Tem certeza que deseja excluir ${selectedAuctions.size} leilão(ões)?`);
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('auctions').delete().in('id', Array.from(selectedAuctions));
      if (error) throw error;
      toast({ title: "Sucesso", description: `${selectedAuctions.size} leilão(ões) excluído(s) com sucesso!` });
      setSelectedAuctions(new Set());
      onRefresh();
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao excluir leilões selecionados", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Gerenciar Leilões</h2>
          <Dialog>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Leilão</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Novo Leilão</DialogTitle>
                <DialogDescription>Preencha os dados do novo leilão</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input id="title" value={newAuction.title} onChange={(e) => setNewAuction({ ...newAuction, title: e.target.value })} placeholder="Título do leilão" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea id="description" value={newAuction.description} onChange={(e) => setNewAuction({ ...newAuction, description: e.target.value })} placeholder="Descrição detalhada" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image">Imagem do Produto</Label>
                  <ImageUploadPreview onImageSelect={setSelectedImage} maxWidth={1200} maxHeight={800} showCardPreview={true} disabled={uploading} compact={true} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="starting_price">Preço Inicial (R$)</Label>
                    <Input id="starting_price" type="number" step="0.01" min="0.01" value={newAuction.starting_price} onChange={(e) => setNewAuction({ ...newAuction, starting_price: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="market_value">Valor de Mercado (R$)</Label>
                    <Input id="market_value" type="number" step="0.01" min="0" value={newAuction.market_value} onChange={(e) => setNewAuction({ ...newAuction, market_value: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="revenue_target">Meta de Receita (R$)</Label>
                  <Input id="revenue_target" type="number" step="0.01" min="0" value={newAuction.revenue_target} onChange={(e) => setNewAuction({ ...newAuction, revenue_target: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="starts_at">Data de Início</Label>
                  <Input id="starts_at" type="datetime-local" value={formatDateTimeLocal(newAuction.starts_at)} onChange={(e) => setNewAuction({ ...newAuction, starts_at: e.target.value })} />
                </div>
                <Button onClick={createAuction} disabled={uploading} className="w-full">
                  {uploading ? <><Upload className="h-4 w-4 mr-2 animate-spin" />Criando...</> : 'Criar Leilão'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {selectedAuctions.size > 0 && (
          <Card className="mb-4 border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-orange-600" />
                  <span className="font-medium text-orange-800">{selectedAuctions.size} leilão(ões) selecionado(s)</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedAuctions(new Set())}>Limpar Seleção</Button>
                  <Button variant="destructive" size="sm" onClick={deleteSelectedAuctions} disabled={isDeleting}>
                    {isDeleting ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Excluindo...</> : <><Trash2 className="h-4 w-4 mr-2" />Excluir Selecionados</>}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox checked={auctions.length > 0 && selectedAuctions.size === auctions.length} onCheckedChange={handleSelectAllAuctions} aria-label="Selecionar todos" />
                  </TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Preço Atual</TableHead>
                  <TableHead>Total de Lances</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auctions.map((auction) => (
                  <TableRow key={auction.id}>
                    <TableCell>
                      <Checkbox checked={selectedAuctions.has(auction.id)} onCheckedChange={(checked) => handleSelectAuction(auction.id, checked as boolean)} />
                    </TableCell>
                    <TableCell className="font-medium">{auction.title}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge variant={auction.status === 'active' ? 'default' : 'secondary'}>{auction.status}</Badge>
                        {auction.is_hidden && <Badge variant="outline" className="text-muted-foreground"><EyeOff className="h-3 w-3 mr-1" />Oculto</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{formatPrice(auction.current_price)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {auction.total_bids}
                        {auction.status === 'finished' && auction.total_bids === 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0">Fantasma</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDateTime(auction.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {auction.status === 'finished' && (
                          <Button size="sm" variant="outline" onClick={() => toggleAuctionVisibility(auction.id, !auction.is_hidden)}>
                            {auction.is_hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => { setEditingAuction(auction); setEditingImage(null); setImagePreview(null); setIsEditDialogOpen(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive"><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Deletar Leilão</AlertDialogTitle>
                              <AlertDialogDescription>Tem certeza que deseja deletar o leilão "{auction.title}"?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteAuction(auction.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Deletar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Leilão</DialogTitle>
            <DialogDescription>Modifique os dados do leilão</DialogDescription>
          </DialogHeader>
          {editingAuction && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Título</Label>
                <Input id="edit-title" value={editingAuction.title} onChange={(e) => setEditingAuction({ ...editingAuction, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Descrição</Label>
                <Textarea id="edit-description" value={editingAuction.description} onChange={(e) => setEditingAuction({ ...editingAuction, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Imagem do Produto</Label>
                <ImageUploadPreview onImageSelect={handleImageSelection} maxWidth={1200} maxHeight={800} showCardPreview={true} disabled={uploading || imageProcessing} compact={true} />
                {editingAuction.image_url && !editingImage && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-2">Imagem atual do leilão:</p>
                    <div className="relative w-full h-32 border border-border rounded-lg overflow-hidden">
                      <img src={editingAuction.image_url} alt="Imagem atual" className="w-full h-full object-cover" />
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="text-xs">Atual</Badge>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-starting-price">Preço Inicial (R$)</Label>
                  <Input id="edit-starting-price" type="number" step="0.01" value={editingAuction.starting_price} onChange={(e) => setEditingAuction({ ...editingAuction, starting_price: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-market-value">Valor de Mercado (R$)</Label>
                  <Input id="edit-market-value" type="number" step="0.01" value={editingAuction.market_value} onChange={(e) => setEditingAuction({ ...editingAuction, market_value: Number(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-revenue-target">Meta de Receita (R$)</Label>
                <Input id="edit-revenue-target" type="number" step="0.01" value={editingAuction.revenue_target} onChange={(e) => setEditingAuction({ ...editingAuction, revenue_target: Number(e.target.value) })} />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={updateAuction} className="flex-1" disabled={uploading}>
                  {uploading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : 'Salvar Alterações'}
                </Button>
                <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingAuction(null); setEditingImage(null); setImagePreview(null); }} disabled={uploading || imageProcessing}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AuctionManagementTab;
