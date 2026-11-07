import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Paperclip, Upload, Trash2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BUCKET = "withdrawal-receipts";
const MAX = 5 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

interface Receipt { id: string; file_path: string; file_name: string; mime_type: string; created_at: string }

export function WithdrawalReceiptDialog({ withdrawalId, canEdit = true }: { withdrawalId: string; canEdit?: boolean }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Receipt[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const db = supabase as any;

  const load = useCallback(async () => {
    const { data } = await db.from("partner_withdrawal_receipts")
      .select("id,file_path,file_name,mime_type,created_at")
      .eq("withdrawal_id", withdrawalId).is("deleted_at", null).order("created_at");
    setItems(data || []);
    setCount((data || []).length);
  }, [withdrawalId]);

  useEffect(() => { load(); }, [load]);

  const upload = async (file: File) => {
    if (!ALLOWED.includes(file.type)) return toast({ title: "Formato não aceito", description: "Use imagem (PNG/JPG/WEBP) ou PDF.", variant: "destructive" });
    if (file.size > MAX) return toast({ title: "Arquivo grande demais", description: "Máximo 5 MB.", variant: "destructive" });
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || (file.type === "application/pdf" ? "pdf" : "png");
      const path = `${withdrawalId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await db.from("partner_withdrawal_receipts").insert({
        withdrawal_id: withdrawalId, file_path: path, file_name: file.name || `comprovante.${ext}`,
        mime_type: file.type, size_bytes: file.size, uploaded_by: u.user?.id,
      });
      if (error) throw error;
      toast({ title: "Comprovante anexado" });
      load();
    } catch (e: any) {
      toast({ title: "Erro ao anexar", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const openFile = async (r: Receipt) => {
    const w = window.open("", "_blank");
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(r.file_path, 60);
    if (error || !data) { w?.close(); return toast({ title: "Erro ao abrir", variant: "destructive" }); }
    if (w) w.location.href = data.signedUrl;
  };

  const remove = async (r: Receipt) => {
    if (!confirm("Excluir este comprovante? A exclusão fica registrada.")) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await db.from("partner_withdrawal_receipts")
      .update({ deleted_at: new Date().toISOString(), deleted_by: u.user?.id }).eq("id", r.id);
    if (error) return toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    load();
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const f = Array.from(e.clipboardData.files)[0];
    if (f && canEdit) upload(f);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
          <Paperclip className="h-3 w-3" />
          {count ? `Comprovante (${count})` : canEdit ? "Anexar comprovante" : "Comprovante"}
        </Button>
      </DialogTrigger>
      <DialogContent onPaste={onPaste}>
        <DialogHeader><DialogTitle>Comprovantes de pagamento</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum comprovante anexado.</p>}
          {items.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded border p-2 text-sm">
              <span className="truncate">{r.file_name} <span className="text-xs text-muted-foreground">({new Date(r.created_at).toLocaleString("pt-BR")})</span></span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => openFile(r)}><ExternalLink className="h-4 w-4" /></Button>
                {canEdit && <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </div>
          ))}
          {canEdit && (
            <div className="rounded border border-dashed p-4 text-center text-sm text-muted-foreground">
              <p className="mb-2">Cole o print aqui (Ctrl+V / Cmd+V) ou escolha um arquivo. Imagem ou PDF, até 5 MB.</p>
              <label>
                <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" disabled={busy}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
                <Button asChild size="sm" disabled={busy}><span><Upload className="mr-1 h-4 w-4" />{busy ? "Enviando..." : "Escolher arquivo"}</span></Button>
              </label>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
