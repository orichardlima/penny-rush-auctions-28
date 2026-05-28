import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock, ShieldAlert, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatCPF, formatPhone, formatCEP, fetchAddressByCEP } from '@/utils/validators';
import { ChangePasswordDialog } from './ChangePasswordDialog';

interface EditableFields {
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

const emptyFields: EditableFields = {
  phone: '', cep: '', street: '', number: '',
  complement: '', neighborhood: '', city: '', state: '',
};

interface Props {
  isAffiliate?: boolean | null;
  hasPartnerContract?: boolean | null;
  onNavigateAffiliate?: () => void;
  onNavigatePartner?: () => void;
}

export const UserProfileEditor: React.FC<Props> = ({
  isAffiliate, hasPartnerContract, onNavigateAffiliate, onNavigatePartner,
}) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [readonly, setReadonly] = useState({
    full_name: '', cpf: '', birth_date: '',
  });
  const [form, setForm] = useState<EditableFields>(emptyFields);
  const [original, setOriginal] = useState<EditableFields>(emptyFields);
  const [email, setEmail] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  useEffect(() => {
    if (user?.id) loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, cpf, birth_date, email, phone, cep, street, number, complement, neighborhood, city, state')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;

      setReadonly({
        full_name: data?.full_name || '',
        cpf: data?.cpf || '',
        birth_date: data?.birth_date || '',
      });
      const editable: EditableFields = {
        phone: data?.phone || '',
        cep: data?.cep || '',
        street: data?.street || '',
        number: data?.number || '',
        complement: data?.complement || '',
        neighborhood: data?.neighborhood || '',
        city: data?.city || '',
        state: data?.state || '',
      };
      setForm(editable);
      setOriginal(editable);
      const currentEmail = data?.email || user?.email || '';
      setEmail(currentEmail);
      setOriginalEmail(currentEmail);
    } catch (err) {
      console.error('[UserProfileEditor] load error', err);
      toast({ title: 'Erro', description: 'Não foi possível carregar seu cadastro.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCepChange = async (value: string) => {
    const formatted = formatCEP(value);
    setForm(p => ({ ...p, cep: formatted }));
    const clean = value.replace(/\D/g, '');
    if (clean.length === 8) {
      setFetchingCep(true);
      try {
        const addr = await fetchAddressByCEP(clean);
        if (addr && !addr.erro) {
          setForm(p => ({
            ...p,
            street: addr.logradouro || p.street,
            neighborhood: addr.bairro || p.neighborhood,
            city: addr.localidade || p.city,
            state: addr.uf || p.state,
          }));
        }
      } finally {
        setFetchingCep(false);
      }
    }
  };

  const hasChanges = (Object.keys(form) as (keyof EditableFields)[])
    .some(k => form[k] !== original[k]);

  const handleSave = async () => {
    if (!hasChanges) {
      toast({ title: 'Nada para salvar', description: 'Nenhum campo foi alterado.' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update(form)
        .eq('user_id', user!.id);
      if (error) throw error;
      setOriginal(form);
      toast({ title: 'Dados atualizados', description: 'Seus dados de contato e endereço foram salvos.' });
    } catch (err: any) {
      console.error('[UserProfileEditor] save error', err);
      toast({ title: 'Erro', description: err?.message || 'Não foi possível salvar.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmail = async () => {
    const newEmail = email.trim().toLowerCase();
    if (!newEmail || newEmail === originalEmail.trim().toLowerCase()) {
      toast({ title: 'Sem alteração', description: 'O e-mail informado é o mesmo.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast({ title: 'E-mail inválido', description: 'Verifique o endereço informado.', variant: 'destructive' });
      return;
    }
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { email: newEmail },
        { emailRedirectTo: `${window.location.origin}/` }
      );
      if (error) throw error;
      toast({
        title: 'Confirmação enviada',
        description: 'Enviamos um link de confirmação para o novo e-mail. A alteração só será efetivada após a confirmação.',
      });
    } catch (err: any) {
      console.error('[UserProfileEditor] email error', err);
      toast({ title: 'Erro', description: err?.message || 'Não foi possível atualizar o e-mail.', variant: 'destructive' });
    } finally {
      setSavingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Dados pessoais (somente leitura) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" /> Dados pessoais
          </CardTitle>
          <CardDescription>
            Esses dados não podem ser alterados por você. Para corrigir nome, CPF ou data de nascimento, fale com o suporte.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Nome completo</Label>
            <Input value={readonly.full_name} disabled readOnly />
          </div>
          <div>
            <Label>CPF</Label>
            <Input value={readonly.cpf ? formatCPF(readonly.cpf) : ''} disabled readOnly />
          </div>
          <div>
            <Label>Data de nascimento</Label>
            <Input
              value={readonly.birth_date ? new Date(readonly.birth_date).toLocaleDateString('pt-BR') : ''}
              disabled
              readOnly
            />
          </div>
        </CardContent>
      </Card>

      {/* Contato e endereço */}
      <Card>
        <CardHeader>
          <CardTitle>Contato e endereço</CardTitle>
          <CardDescription>Mantenha esses dados sempre atualizados para receber comunicações e prêmios.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="up-email">E-mail</Label>
              <div className="flex gap-2">
                <Input
                  id="up-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveEmail}
                  disabled={savingEmail || email.trim().toLowerCase() === originalEmail.trim().toLowerCase()}
                >
                  {savingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Atualizar'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Após salvar, enviaremos um link de confirmação para o novo e-mail.
              </p>
            </div>
            <div>
              <Label htmlFor="up-phone">Telefone / WhatsApp</Label>
              <Input
                id="up-phone"
                value={form.phone}
                maxLength={15}
                onChange={e => setForm(p => ({ ...p, phone: formatPhone(e.target.value) }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="up-cep">CEP</Label>
              <div className="relative">
                <Input
                  id="up-cep"
                  value={form.cep}
                  maxLength={9}
                  onChange={e => handleCepChange(e.target.value)}
                />
                {fetchingCep && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </div>
            <div className="col-span-2">
              <Label htmlFor="up-street">Rua</Label>
              <Input id="up-street" value={form.street} onChange={e => setForm(p => ({ ...p, street: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="up-number">Número</Label>
              <Input id="up-number" value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="up-complement">Complemento</Label>
              <Input id="up-complement" value={form.complement} onChange={e => setForm(p => ({ ...p, complement: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="up-neighborhood">Bairro</Label>
              <Input id="up-neighborhood" value={form.neighborhood} onChange={e => setForm(p => ({ ...p, neighborhood: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="up-city">Cidade</Label>
              <Input id="up-city" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="up-state">Estado</Label>
              <Input
                id="up-state"
                value={form.state}
                maxLength={2}
                onChange={e => setForm(p => ({ ...p, state: e.target.value.toUpperCase() }))}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || !hasChanges}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : 'Salvar alterações'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Segurança */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" /> Segurança
          </CardTitle>
          <CardDescription>Altere sua senha de acesso periodicamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => setShowPasswordDialog(true)}>
            Alterar senha
          </Button>
        </CardContent>
      </Card>

      {/* Chave PIX */}
      {(isAffiliate || hasPartnerContract) && (
        <Card>
          <CardHeader>
            <CardTitle>Chave PIX para recebimentos</CardTitle>
            <CardDescription>
              Sua chave PIX é gerenciada na área de saques de cada programa em que você participa.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {isAffiliate && onNavigateAffiliate && (
              <Button variant="outline" onClick={onNavigateAffiliate}>
                Gerenciar PIX do Afiliado
              </Button>
            )}
            {hasPartnerContract && onNavigatePartner && (
              <Button variant="outline" onClick={onNavigatePartner}>
                Gerenciar PIX da Parceria
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          Por segurança, todas as alterações ficam registradas. Em caso de dúvida, entre em contato com o suporte.
        </AlertDescription>
      </Alert>

      <ChangePasswordDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog} userEmail={originalEmail} />
    </div>
  );
};

export default UserProfileEditor;
