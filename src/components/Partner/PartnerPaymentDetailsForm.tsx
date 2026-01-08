import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CreditCard, Save } from 'lucide-react';
import { PaymentDetails } from '@/hooks/usePartnerWithdrawals';

interface PartnerPaymentDetailsFormProps {
  initialData?: Partial<PaymentDetails>;
  onSave: (data: PaymentDetails) => Promise<{ success: boolean }>;
  loading?: boolean;
  compact?: boolean;
}

const PartnerPaymentDetailsForm: React.FC<PartnerPaymentDetailsFormProps> = ({
  initialData,
  onSave,
  loading = false,
  compact = false
}) => {
  const [pixKeyType, setPixKeyType] = useState<PaymentDetails['pix_key_type']>(
    initialData?.pix_key_type || 'cpf'
  );
  const [pixKey, setPixKey] = useState(initialData?.pix_key || '');
  const [holderName, setHolderName] = useState(initialData?.holder_name || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pixKey.trim()) {
      return;
    }

    setSaving(true);
    await onSave({
      pix_key: pixKey.trim(),
      pix_key_type: pixKeyType,
      holder_name: holderName.trim() || undefined
    });
    setSaving(false);
  };

  const getPixKeyPlaceholder = () => {
    switch (pixKeyType) {
      case 'cpf': return '000.000.000-00';
      case 'cnpj': return '00.000.000/0000-00';
      case 'email': return 'email@exemplo.com';
      case 'phone': return '(00) 00000-0000';
      case 'random': return 'Chave aleatória';
      default: return '';
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pixKeyType">Tipo de Chave PIX</Label>
          <Select value={pixKeyType} onValueChange={(v: PaymentDetails['pix_key_type']) => setPixKeyType(v)}>
            <SelectTrigger id="pixKeyType">
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cpf">CPF</SelectItem>
              <SelectItem value="cnpj">CNPJ</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
              <SelectItem value="phone">Telefone</SelectItem>
              <SelectItem value="random">Chave Aleatória</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pixKey">Chave PIX</Label>
          <Input
            id="pixKey"
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            placeholder={getPixKeyPlaceholder()}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="holderName">Nome do Titular (opcional)</Label>
        <Input
          id="holderName"
          value={holderName}
          onChange={(e) => setHolderName(e.target.value)}
          placeholder="Nome completo do titular"
        />
      </div>

      <Button type="submit" disabled={loading || saving || !pixKey.trim()} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {saving ? 'Salvando...' : 'Salvar Dados de Pagamento'}
      </Button>
    </form>
  );

  if (compact) {
    return formContent;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Dados para Recebimento
        </CardTitle>
        <CardDescription>
          Configure sua chave PIX para receber os saques
        </CardDescription>
      </CardHeader>
      <CardContent>
        {formContent}
      </CardContent>
    </Card>
  );
};

export default PartnerPaymentDetailsForm;
