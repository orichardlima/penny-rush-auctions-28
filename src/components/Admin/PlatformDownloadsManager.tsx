import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Pencil, Loader2, Download as DownloadIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { usePlatformDownloads, CATEGORY_LABELS, DownloadCategory, PlatformDownload } from '@/hooks/usePlatformDownloads';
import { uploadResumable } from '@/utils/resumableUpload';



const emptyForm = {
  id: '' as string | null,
  title: '',
  description: '',
  category: 'contrato' as DownloadCategory,
  display_order: 0,
  is_active: true,
  file: null as File | null,
};

export const PlatformDownloadsManager = () => {
  const { items, loading, refresh } = usePlatformDownloads(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  const openNew = () => { setForm({ ...emptyForm, id: null }); setOpen(true); };
  const openEdit = (it: PlatformDownload) => {
    setForm({
      id: it.id,
      title: it.title,
      description: it.description || '',
      category: it.category,
      display_order: it.display_order,
      is_active: it.is_active,
      file: null,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ title: 'Título obrigatório', variant: 'destructive' }); return; }
    if (!form.id && !form.file) { toast({ title: 'Selecione um arquivo', variant: 'destructive' }); return; }

    setSaving(true);
    try {
      let storage_path: string | undefined;
      let file_name: string | undefined;
      let file_size: number | undefined;
      let mime_type: string | undefined;

      if (form.file) {
        const ext = form.file.name.split('.').pop() || 'bin';
        storage_path = `${form.category}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        setProgress(0);
        await uploadResumable('platform-downloads', storage_path, form.file, setProgress);
        file_name = form.file.name;
        file_size = form.file.size;
        mime_type = form.file.type;
      }

      if (form.id) {
        const patch: any = {
          title: form.title,
          description: form.description || null,
          category: form.category,
          display_order: form.display_order,
          is_active: form.is_active,
        };
        if (storage_path) {
          // delete old file
          const old = items.find(i => i.id === form.id);
          if (old) await supabase.storage.from('platform-downloads').remove([old.storage_path]);
          patch.storage_path = storage_path;
          patch.file_name = file_name;
          patch.file_size = file_size;
          patch.mime_type = mime_type;
        }
        const { error } = await supabase.from('platform_downloads').update(patch).eq('id', form.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('platform_downloads').insert({
          title: form.title,
          description: form.description || null,
          category: form.category,
          display_order: form.display_order,
          is_active: form.is_active,
          storage_path: storage_path!,
          file_name: file_name!,
          file_size: file_size!,
          mime_type: mime_type ?? null,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
      }

      toast({ title: 'Salvo com sucesso' });
      setOpen(false);
      refresh();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (it: PlatformDownload) => {
    if (!confirm(`Excluir "${it.title}"?`)) return;
    try {
      await supabase.storage.from('platform-downloads').remove([it.storage_path]);
      const { error } = await supabase.from('platform_downloads').delete().eq('id', it.id);
      if (error) throw error;
      toast({ title: 'Excluído' });
      refresh();
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' });
    }
  };

  const toggleActive = async (it: PlatformDownload) => {
    const { error } = await supabase.from('platform_downloads').update({ is_active: !it.is_active }).eq('id', it.id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    refresh();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle>Central de Downloads</CardTitle>
          <p className="text-sm text-muted-foreground">Gerencie arquivos disponíveis para os usuários logados.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Novo arquivo</Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : items.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum arquivo cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {items.map(it => (
              <div key={it.id} className="flex items-center gap-3 p-3 border rounded-md flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{it.title}</span>
                    <Badge variant="outline">{CATEGORY_LABELS[it.category]}</Badge>
                    {!it.is_active && <Badge variant="secondary">Inativo</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                    <span>{it.file_name}</span>
                    <span className="flex items-center gap-1"><DownloadIcon className="h-3 w-3" /> {it.download_count}</span>
                    <span>Ordem: {it.display_order}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={it.is_active} onCheckedChange={() => toggleActive(it)} />
                  <Button size="sm" variant="outline" onClick={() => openEdit(it)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(it)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar arquivo' : 'Novo arquivo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v: DownloadCategory) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CATEGORY_LABELS) as DownloadCategory[]).map(c => (
                      <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ordem</Label>
                <Input type="number" value={form.display_order} onChange={e => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <Label>Arquivo {form.id && <span className="text-xs text-muted-foreground">(deixe vazio para manter atual)</span>}</Label>
              <Input type="file" onChange={e => setForm({ ...form, file: e.target.files?.[0] || null })} />
              <p className="text-xs text-muted-foreground mt-1">Sem limite de tamanho.</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Ativo (visível para usuários)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {saving ? (progress > 0 && progress < 100 ? `Enviando ${progress}%` : 'Salvando...') : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default PlatformDownloadsManager;
