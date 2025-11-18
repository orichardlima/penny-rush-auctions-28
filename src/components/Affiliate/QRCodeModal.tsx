import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QrCode, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from '@/hooks/use-toast';

interface QRCodeModalProps {
  affiliateLink: string;
  affiliateCode: string;
}

export function QRCodeModal({ affiliateLink, affiliateCode }: QRCodeModalProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const downloadQRCode = () => {
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `qrcode-afiliado-${affiliateCode}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();

      toast({
        title: "QR Code baixado!",
        description: "O QR Code foi salvo como imagem PNG"
      });
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <QrCode className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code do Seu Link</DialogTitle>
          <DialogDescription>
            Compartilhe este QR Code em materiais impressos ou redes sociais
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="p-4 bg-white rounded-lg">
            <QRCodeSVG
              id="qr-code-svg"
              value={affiliateLink}
              size={256}
              level="H"
              includeMargin={true}
            />
          </div>
          <div className="text-center">
            <p className="text-sm font-mono text-muted-foreground">
              {affiliateCode}
            </p>
          </div>
          <Button onClick={downloadQRCode} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Baixar QR Code
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
