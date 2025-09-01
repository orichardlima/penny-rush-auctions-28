import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Smartphone, Building, X, QrCode, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import QRCode from 'qrcode';

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
  const [cardData, setCardData] = useState({
    cardNumber: '',
    expiryDate: '',
    securityCode: '',
    cardholderName: '',
    email: '',
    docType: 'CPF',
    docNumber: ''
  });
  const [pixQrCode, setPixQrCode] = useState('');
  const [pixQrCodeImage, setPixQrCodeImage] = useState('');
  const [showPixCode, setShowPixCode] = useState(false);
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
      let paymentData;

      if (selectedMethod === 'pix') {
        paymentData = {
          payment_method_id: 'pix',
          amount: packageData.price
        };
      } else {
        // Validar dados do cartão
        if (!cardData.cardNumber || !cardData.expiryDate || !cardData.securityCode || !cardData.cardholderName) {
          toast({
            title: "Dados incompletos",
            description: "Preencha todos os campos do cartão",
            variant: "destructive"
          });
          return;
        }

        paymentData = {
          payment_method_id: selectedMethod === 'credit' ? 'master' : 'debmaster',
          card_number: cardData.cardNumber.replace(/\s/g, ''),
          expiry_date: cardData.expiryDate,
          security_code: cardData.securityCode,
          cardholder_name: cardData.cardholderName,
          email: cardData.email,
          doc_type: cardData.docType,
          doc_number: cardData.docNumber,
          amount: packageData.price
        };
      }

      const { data, error } = await supabase.functions.invoke('mercado-pago-payment', {
        body: {
          action: 'process_payment',
          packageId: packageData.id,
          bidsCount: packageData.bids,
          price: packageData.price,
          packageName: packageData.name,
          paymentData
        }
      });

      console.log(`🔍 [PAYMENT-MODAL] Resposta completa da função:`, { data, error });

      if (error) {
        console.error(`❌ [PAYMENT-MODAL] Erro da função:`, error);
        throw new Error(error.message || 'Erro ao processar pagamento');
      }

      if (selectedMethod === 'pix' && data.qr_code) {
        console.log('✅ QR Code PIX recebido da API:', data.qr_code.substring(0, 50) + '...');
        setPixQrCode(data.qr_code);
        
        // Gerar QR Code visual
        try {
          const qrCodeImage = await QRCode.toDataURL(data.qr_code, {
            width: 256,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF',
            },
          });
          setPixQrCodeImage(qrCodeImage);
          console.log('✅ QR Code visual gerado com sucesso');
        } catch (error) {
          console.error('❌ Erro ao gerar QR Code visual:', error);
        }
        
        setShowPixCode(true);
        toast({
          title: "PIX gerado com sucesso!",
          description: "Escaneie o código QR ou copie o código PIX para pagar. O pagamento é processado automaticamente.",
          variant: "default"
        });
      } else if (data.status === 'approved') {
        toast({
          title: "Pagamento aprovado!",
          description: `${packageData.bids} lances foram adicionados à sua conta`,
          variant: "default"
        });
        
        onPaymentSuccess();
        onClose();
      } else if (data.status === 'pending') {
        toast({
          title: "Pagamento pendente",
          description: "Aguardando confirmação do pagamento",
          variant: "default"
        });
      } else {
        throw new Error('Pagamento rejeitado');
      }

    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Erro no pagamento",
        description: error instanceof Error ? error.message : "Tente novamente em alguns instantes",
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

          {/* Formulário de Cartão */}
          {(selectedMethod === 'credit' || selectedMethod === 'debit') && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dados do Cartão</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="cardNumber">Número do Cartão</Label>
                    <Input
                      id="cardNumber"
                      placeholder="1234 5678 9012 3456"
                      value={cardData.cardNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
                        setCardData({...cardData, cardNumber: value});
                      }}
                      maxLength={19}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="expiryDate">Validade</Label>
                      <Input
                        id="expiryDate"
                        placeholder="MM/AA"
                        value={cardData.expiryDate}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2');
                          setCardData({...cardData, expiryDate: value});
                        }}
                        maxLength={5}
                      />
                    </div>
                    <div>
                      <Label htmlFor="securityCode">CVV</Label>
                      <Input
                        id="securityCode"
                        placeholder="123"
                        value={cardData.securityCode}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setCardData({...cardData, securityCode: value});
                        }}
                        maxLength={4}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="cardholderName">Nome do Titular</Label>
                    <Input
                      id="cardholderName"
                      placeholder="Nome como está no cartão"
                      value={cardData.cardholderName}
                      onChange={(e) => setCardData({...cardData, cardholderName: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={cardData.email}
                      onChange={(e) => setCardData({...cardData, email: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="docNumber">CPF</Label>
                    <Input
                      id="docNumber"
                      placeholder="000.000.000-00"
                      value={cardData.docNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
                        setCardData({...cardData, docNumber: value});
                      }}
                      maxLength={14}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* PIX QR Code */}
          {selectedMethod === 'pix' && showPixCode && pixQrCode && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  Pagamento PIX
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                {/* QR Code Visual */}
                {pixQrCodeImage && (
                  <div className="flex justify-center">
                    <img 
                      src={pixQrCodeImage} 
                      alt="QR Code PIX" 
                      className="w-64 h-64 border border-border rounded-lg shadow-sm"
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <p className="text-sm font-medium">Código PIX Copia e Cola:</p>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs font-mono break-all text-muted-foreground">
                      {pixQrCode}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(pixQrCode);
                      toast({
                        title: "Código copiado!",
                        description: "Cole no seu app de pagamento",
                        variant: "default"
                      });
                    }}
                    className="w-full"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Código PIX
                  </Button>
                  
                  <p className="text-xs text-muted-foreground">
                    Escaneie o QR Code com seu app de pagamento ou copie o código PIX acima
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Botão de Pagamento */}
          {!showPixCode && (
            <Button 
              onClick={handlePayment}
              disabled={!selectedMethod || processing}
              className="w-full"
              size="lg"
            >
              {processing ? (
                "Processando pagamento..."
              ) : selectedMethod === 'pix' ? (
                "Gerar PIX"
              ) : (
                `Pagar ${formatPrice(packageData.price)}`
              )}
            </Button>
          )}

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