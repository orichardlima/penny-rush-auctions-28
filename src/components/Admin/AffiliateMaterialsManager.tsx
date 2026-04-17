import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, Image as ImageIcon } from 'lucide-react';
import {
  useAffiliateMaterials,
  type AffiliateMaterial,
  type AffiliateMaterialInput,
  type MaterialType,
  type TargetAudience,
} from '@/hooks/useAffiliateMaterials';

const emptyForm: AffiliateMaterialInput = {
  title: '',
  description: '',
  image_url: '',
  copy_text: '',
  material_type: 'image',
  target_audience: 'all',
  is_active: true,
  sort_order: 0,
};

export const AffiliateMaterialsManager = () => {
  const { materials, loading, createMaterial, updateMaterial, deleteMaterial } = useAffiliateMaterials(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AffiliateMaterial | null>(null);
  const [form, setForm] = useState<AffiliateMaterialInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (m: AffiliateMaterial) => {
    setEditing(m);
    setForm({
      title: m.title,
      description: m.description || '',
      image_url: m.image_url || '',
      copy_text: m.copy_text || '',
      material_type: m.material_type,
      target_audience: m.target_audience,
      is_active: m.is_active,
      sort_order: m.sort_order,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const ok = editing ? await updateMaterial(editing.id, form) : await createMaterial(form);
    setSaving(false);
    if (ok) setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMaterial(deleteId);
    setDeleteId(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Materiais de Afiliados
          </CardTitle>
          <CardDescription>
            Biblioteca exclusiva do programa de afiliados (separada da Central de Anúncios dos parceiros).
          </CardDescription>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Material
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : materials.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum material cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Preview</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Público</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ordem</TableHead>
                  <TableHead className="w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      {m.image_url ? (
                        <img src={m.image_url} alt={m.title} className="h-10 w-10 object-cover rounded" />
                      ) : (
                        <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{m.title}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{m.material_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{m.target_audience}</Badge>
                    </TableCell>
                    <TableCell>
                      {m.is_active ? (
                        <Badge>Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{m.sort_order}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(m.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Material' : 'Novo Material'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={form.material_type}
                  onValueChange={(v) => setForm({ ...form, material_type: v as MaterialType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Imagem</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="copy">Copy</SelectItem>
                    <SelectItem value="banner">Banner</SelectItem>
                    <SelectItem value="story">Story</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Público-alvo</Label>
                <Select
                  value={form.target_audience}
                  onValueChange={(v) => setForm({ ...form, target_audience: v as TargetAudience })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="managers">Gerentes</SelectItem>
                    <SelectItem value="influencers">Influencers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>URL da Imagem/Vídeo</Label>
              <Input
                value={form.image_url || ''}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>Texto / Copy (use {'{LINK}'} para inserir o link do afiliado)</Label>
              <Textarea
                value={form.copy_text || ''}
                onChange={(e) => setForm({ ...form, copy_text: e.target.value })}
                rows={5}
                placeholder="Confira esta oportunidade incrível! {LINK}"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label>Ordem de exibição</Label>
                <Input
                  type="number"
                  value={form.sort_order || 0}
                  onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  checked={form.is_active ?? true}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
                <Label>Ativo</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.title.trim()}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover material?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
