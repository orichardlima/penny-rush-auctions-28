import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Upload, Trash2, Star, ImagePlus } from "lucide-react";

const sb = supabase as any;
const BUCKET = "product-images";

export async function uploadStoreImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `loja/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Upload da imagem principal (usado dentro do formulário do item) */
export function MainImageUploader({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadStoreImage(file);
      onChange(url);
      toast.success("Imagem enviada");
    } catch (e: any) {
      toast.error(e.message || "Falha no upload");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Imagem principal</Label>
      <div className="flex items-start gap-3">
        <div className="h-24 w-24 rounded border bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {value ? (
            <img src={value} alt="Prévia da imagem principal" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <Input
            placeholder="Cole uma URL ou envie um arquivo"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" />
              {busy ? "Enviando..." : "Enviar imagem"}
            </Button>
            <CatalogImagePicker
              onSelect={(url) => {
                onChange(url);
                toast.success("Imagem importada do catálogo");
              }}
            />
            {value && (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
                Remover
              </Button>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0] || undefined)}
          />
        </div>
      </div>
    </div>
  );
}

/** Galeria de imagens adicionais do item */
export function StoreItemImagesManager({ itemId, onMainChange }: { itemId: string; onMainChange?: (url: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await sb
      .from("points_store_item_images")
      .select("*")
      .eq("item_id", itemId)
      .order("sort_order", { ascending: true });
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [itemId]);

  const add = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadStoreImage(file);
      const { error } = await sb.from("points_store_item_images").insert({
        item_id: itemId,
        url,
        sort_order: rows.length,
        alt: file.name.replace(/\.[^.]+$/, ""),
      });
      if (error) throw error;
      toast.success("Imagem adicionada à galeria");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Falha no upload");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await sb.from("points_store_item_images").delete().eq("id", id);
    if (error) toast.error(error.message);
    else await load();
  };

  const setAsMain = async (url: string) => {
    const { error } = await sb.from("points_store_items").update({ main_image_url: url }).eq("id", itemId);
    if (error) toast.error(error.message);
    else { toast.success("Definida como imagem principal"); onMainChange?.(url); }
  };

  if (loading) return <Skeleton className="h-24 w-full" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Galeria do produto</Label>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1" />
          {busy ? "Enviando..." : "Adicionar imagem"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => add(e.target.files?.[0] || undefined)}
        />
      </div>

      {!rows.length ? (
        <p className="text-xs text-muted-foreground">Nenhuma imagem adicional. A galeria aparece na página do produto.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {rows.map((r) => (
            <div key={r.id} className="relative group border rounded overflow-hidden">
              <img src={r.url} alt={r.alt || "Imagem do produto"} className="h-24 w-full object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button type="button" size="icon" variant="secondary" className="h-7 w-7" onClick={() => setAsMain(r.url)} title="Definir como principal">
                  <Star className="h-3 w-3" />
                </Button>
                <Button type="button" size="icon" variant="destructive" className="h-7 w-7" onClick={() => remove(r.id)} title="Remover">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
