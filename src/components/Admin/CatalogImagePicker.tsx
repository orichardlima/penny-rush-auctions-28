import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Images, Search } from "lucide-react";

const sb = supabase as any;

interface TemplateRow {
  id: string;
  title: string;
  category: string | null;
  image_url: string | null;
}

/**
 * Permite escolher a imagem de um produto do catálogo de leilões
 * (product_templates) e reaproveitá-la como imagem do prêmio da loja.
 */
export function CatalogImagePicker({ onSelect }: { onSelect: (url: string, title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open || rows.length) return;
    (async () => {
      setLoading(true);
      const { data } = await sb
        .from("product_templates")
        .select("id, title, category, image_url")
        .not("image_url", "is", null)
        .order("title", { ascending: true });
      setRows(data || []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = rows.filter((r) => r.title.toLowerCase().includes(q.toLowerCase().trim()));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <Images className="h-4 w-4 mr-1" />
          Importar do catálogo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Imagens do catálogo de leilões</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar produto (ex.: PlayStation, JBL...)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : !filtered.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum produto encontrado.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                className="border rounded overflow-hidden text-left hover:border-primary transition-colors"
                onClick={() => {
                  onSelect(t.image_url as string, t.title);
                  setOpen(false);
                }}
              >
                <img src={t.image_url as string} alt={t.title} className="h-24 w-full object-cover" loading="lazy" />
                <div className="p-2">
                  <p className="text-xs font-medium line-clamp-2">{t.title}</p>
                  {t.category && <p className="text-[10px] text-muted-foreground">{t.category}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
