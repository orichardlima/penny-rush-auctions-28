import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Smartphone, Building, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  packageData: {
    id: string;
    name: string;
    price: number;
    bids: number;
    originalPrice?: number;
  };
  onPaymentSuccess: () => void;
}

export const PaymentModal = ({ isOpen, onClose, packageData, onPaymentSuccess }: PaymentModalProps) => {
  const [selectedMethod, setSelectedMethod] = useState<'credit' | 'debit' | 'pix' | null>(null);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const handlePayment = async () => {
    if (!selectedMethod) {
      toast({
        title: "Selecione um método de pagamento",
        description: "Escolha como deseja pagar pelos lances",
        variant: "destructive"
      });
      return;
    }

    setProcessing(true);

    try {
      // Simular processamento de pagamento
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast({
        title: "Pagamento processado com sucesso!",
        description: `${packageData.bids} lances foram adicionados à sua conta`,
        variant: "default"
      });

      onPaymentSuccess();
      onClose();
    } catch (error) {
      toast({
        title: "Erro no pagamento",
        description: "Tente novamente em alguns instantes",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  const paymentMethods = [
    {
      id: 'credit',
      name: 'Cartão de Crédito',
      icon: CreditCard,
      description: 'Pagamento aprovado na hora'
    },
    {
      id: 'debit',
      name: 'Cartão de Débito',
      icon: CreditCard,
      description: 'Débito automático'
    },
    {
      id: 'pix',
      name: 'PIX',
      icon: Smartphone,
      description: 'Aprovação instantânea'
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Finalizar Compra
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Resumo do Pacote */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{packageData.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Lances inclusos:</span>
                <Badge variant="secondary">{packageData.bids} lances</Badge>
              </div>
              
              <Separator />
              
              <div className="flex justify-between items-center">
                <span className="font-medium">Total:</span>
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">
                    {formatPrice(packageData.price)}
                  </div>
                  {packageData.originalPrice && packageData.originalPrice > packageData.price && (
                    <div className="text-sm text-muted-foreground line-through">
                      {formatPrice(packageData.originalPrice)}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Métodos de Pagamento */}
          <div className="space-y-3">
            <h3 className="font-medium">Selecione a forma de pagamento:</h3>
            
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              return (
                <Card 
                  key={method.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedMethod === method.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedMethod(method.id as any)}
                >
                  <CardContent className="flex items-center space-x-3 p-4">
                    <Icon className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <div className="font-medium">{method.name}</div>
                      <div className="text-sm text-muted-foreground">{method.description}</div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      selectedMethod === method.id 
                        ? 'bg-primary border-primary' 
                        : 'border-muted-foreground'
                    }`} />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Botão de Pagamento */}
          <Button 
            onClick={handlePayment}
            disabled={!selectedMethod || processing}
            className="w-full"
            size="lg"
          >
            {processing ? (
              "Processando pagamento..."
            ) : (
              `Pagar ${formatPrice(packageData.price)}`
            )}
          </Button>

          {/* Informações de Segurança */}
          <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
            <Building className="h-4 w-4" />
            <span>Pagamento seguro e protegido</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};