import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Link2, Share2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { QRCodeModal } from '@/components/Affiliate/QRCodeModal';

interface Props {
  affiliateCode: string;
}

export const ManagerRecruitmentLinkCard = ({ affiliateCode }: Props) => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://showdelances.com';
  const recruitmentUrl = `${baseUrl}/?ref=${affiliateCode}`;

  const copy = () => {
    navigator.clipboard.writeText(recruitmentUrl);
    toast({ title: 'Link copiado!', description: 'Cole onde quiser para recrutar influencers.' });
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Junte-se à minha rede de afiliados',
          text: 'Faça parte do programa de afiliados Show de Lances',
          url: recruitmentUrl,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      copy();
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          Seu Link de Recrutamento
        </CardTitle>
        <CardDescription>
          Quem se cadastrar como afiliado por este link entra automaticamente na sua rede como Influencer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input value={recruitmentUrl} readOnly className="font-mono text-sm" />
          <div className="flex gap-2">
            <Button onClick={copy} variant="outline" size="sm">
              <Copy className="h-4 w-4 mr-2" /> Copiar
            </Button>
            <Button onClick={share} size="sm">
              <Share2 className="h-4 w-4 mr-2" /> Compartilhar
            </Button>
            <QRCodeModal affiliateLink={recruitmentUrl} affiliateCode={affiliateCode} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          💡 Compartilhe nas suas redes, grupos e comunidades. Toda venda gerada pelos seus influencers gera override
          automaticamente para você.
        </p>
      </CardContent>
    </Card>
  );
};
