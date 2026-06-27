import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Presentation, Megaphone, Scale, File, Download, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { usePlatformDownloads, CATEGORY_LABELS, DownloadCategory, getSignedDownloadUrl, PlatformDownload } from '@/hooks/usePlatformDownloads';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';
import { SEOHead } from '@/components/SEOHead';

const CATEGORY_ICONS: Record<DownloadCategory, any> = {
  contrato: FileText,
  apresentacao: Presentation,
  kit_divulgacao: Megaphone,
  regulamento: Scale,
  outros: File,
};

const CATEGORY_ORDER: DownloadCategory[] = ['contrato', 'apresentacao', 'kit_divulgacao', 'regulamento', 'outros'];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const DownloadCard = ({ item }: { item: PlatformDownload }) => {
  const Icon = CATEGORY_ICONS[item.category];
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    try {
      setBusy(true);
      const url = await getSignedDownloadUrl(item.storage_path, item.file_name);
      await supabase.rpc('increment_platform_download', { p_id: item.id });
      const a = document.createElement('a');
      a.href = url;
      a.download = item.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      toast({ title: 'Erro ao baixar', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base leading-tight">{item.title}</CardTitle>
            {item.description && (
              <CardDescription className="mt-1 text-xs">{item.description}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 mt-auto flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate" title={item.file_name}>{item.file_name}</span>
          <Badge variant="secondary" className="shrink-0">{formatSize(item.file_size)}</Badge>
        </div>
        <Button onClick={handleDownload} disabled={busy} className="w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Baixar
        </Button>
      </CardContent>
    </Card>
  );
};

const Downloads = () => {
  const { user, loading: authLoading } = useAuth();
  const { items, loading } = usePlatformDownloads(false);
  const navigate = useNavigate();

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth?redirect=/downloads" replace />;

  const grouped = CATEGORY_ORDER
    .map(cat => ({ cat, list: items.filter(i => i.category === cat) }))
    .filter(g => g.list.length > 0);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead title="Downloads — Show de Lances" description="Materiais oficiais da plataforma: contratos, apresentações e kit de divulgação." />
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Central de Downloads</h1>
          <p className="text-muted-foreground mt-1">Materiais oficiais da plataforma APN / Show de Lances.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : grouped.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              Nenhum arquivo disponível no momento.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-10">
            {grouped.map(({ cat, list }) => {
              const Icon = CATEGORY_ICONS[cat];
              return (
                <section key={cat}>
                  <div className="flex items-center gap-2 mb-4">
                    <Icon className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold">{CATEGORY_LABELS[cat]}</h2>
                    <Badge variant="outline">{list.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {list.map(item => <DownloadCard key={item.id} item={item} />)}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Downloads;
