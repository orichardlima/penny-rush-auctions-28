import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Image as ImageIcon, Copy, Download, Share2, FileText, Video, Layout } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAffiliateMaterials, type MaterialType } from '@/hooks/useAffiliateMaterials';

const typeIcon = (t: MaterialType) => {
  const map: Record<MaterialType, React.ReactNode> = {
    image: <ImageIcon className="h-4 w-4" />,
    video: <Video className="h-4 w-4" />,
    copy: <FileText className="h-4 w-4" />,
    banner: <Layout className="h-4 w-4" />,
    story: <Layout className="h-4 w-4" />,
  };
  return map[t];
};

const typeLabel: Record<MaterialType, string> = {
  image: 'Imagem',
  video: 'Vídeo',
  copy: 'Copy',
  banner: 'Banner',
  story: 'Story',
};

export const AffiliateMaterialsLibrary = ({ affiliateCode }: { affiliateCode?: string }) => {
  const { materials, loading } = useAffiliateMaterials(true);

  const copyText = (text: string) => {
    const final = affiliateCode ? text.replaceAll('{LINK}', `${window.location.origin}/?ref=${affiliateCode}`) : text;
    navigator.clipboard.writeText(final);
    toast({ title: 'Copiado!', description: 'Texto pronto para colar.' });
  };

  const downloadImage = async (url: string, title: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${title.replace(/\s+/g, '-').toLowerCase()}.${blob.type.split('/')[1] || 'jpg'}`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      window.open(url, '_blank');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">Carregando materiais...</CardContent>
      </Card>
    );
  }

  if (materials.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nenhum material disponível ainda.</p>
          <p className="text-sm mt-1">A equipe está preparando criativos para você.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Biblioteca de Materiais</h3>
        <p className="text-sm text-muted-foreground">
          Use estes criativos prontos para divulgar. Substitua {'{LINK}'} pelo seu link de afiliado automaticamente.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {materials.map((m) => (
          <Card key={m.id} className="overflow-hidden flex flex-col">
            {m.image_url && (
              <div className="aspect-video bg-muted overflow-hidden">
                <img src={m.image_url} alt={m.title} className="w-full h-full object-cover" loading="lazy" />
              </div>
            )}
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base leading-tight">{m.title}</CardTitle>
                <Badge variant="secondary" className="flex items-center gap-1 flex-shrink-0">
                  {typeIcon(m.material_type)}
                  {typeLabel[m.material_type]}
                </Badge>
              </div>
              {m.description && <CardDescription className="line-clamp-2">{m.description}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-2 mt-auto">
              {m.copy_text && (
                <div className="bg-muted/50 rounded-md p-2 text-xs max-h-24 overflow-y-auto whitespace-pre-wrap">
                  {m.copy_text}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {m.copy_text && (
                  <Button size="sm" variant="outline" onClick={() => copyText(m.copy_text!)}>
                    <Copy className="h-3 w-3 mr-1" /> Copiar texto
                  </Button>
                )}
                {m.image_url && (
                  <Button size="sm" variant="outline" onClick={() => downloadImage(m.image_url!, m.title)}>
                    <Download className="h-3 w-3 mr-1" /> Baixar
                  </Button>
                )}
                {m.image_url && navigator.share && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      navigator
                        .share({ title: m.title, text: m.copy_text || m.description || '', url: m.image_url! })
                        .catch(() => {})
                    }
                  >
                    <Share2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
