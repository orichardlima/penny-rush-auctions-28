import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { formatCPF, formatPhone, formatCEP, fetchAddressByCEP } from '@/utils/validators';

interface ProfileData {
  full_name: string;
  cpf: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

const emptyProfile: ProfileData = {
  full_name: '', cpf: '', phone: '', cep: '', street: '',
  number: '', complement: '', neighborhood: '', city: '', state: '',
};

interface Props {
  userId: string;
  userName: string;
  userEmail: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
  logAdminAction: (actionType: string, oldValues: any, newValues: any, description: string) => Promise<void>;
}

export const AdminEditProfileDialog: React.FC<Props> = ({
  userId, userName, userEmail, isOpen, onClose, onUpdated, logAdminAction
}) => {
  const [form, setForm] = useState<ProfileData>(emptyProfile);
  const [original, setOriginal] = useState<ProfileData>(emptyProfile);
  const [email, setEmail] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEmail(userEmail || '');
      setOriginalEmail(userEmail || '');
      loadProfile();
    }
  }, [isOpen, userEmail]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, cpf, phone, cep, street, number, complement, neighborhood, city, state')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      const profile: ProfileData = {
        full_name: data.full_name || '',
        cpf: data.cpf || '',
        phone: data.phone || '',
        cep: data.cep || '',
        street: data.street || '',
        number: data.number || '',
        complement: data.complement || '',
        neighborhood: data.neighborhood || '',
        city: data.city || '',
        state: data.state || '',
      };
      setForm(profile);
      setOriginal(profile);
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({ title: 'Erro', description: 'Erro ao carregar dados do perfil', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCepChange = async (value: string) => {
    const formatted = formatCEP(value);
    setForm(prev => ({ ...prev, cep: formatted }));

    const clean = value.replace(/\D/g, '');
    if (clean.length === 8) {
      setFetchingCep(true);
      const addr = await fetchAddressByCEP(clean);
      if (addr && !addr.erro) {
        setForm(prev => ({
          ...prev,
          street: addr.logradouro || prev.street,
          neighborhood: addr.bairro || prev.neighborhood,
          city: addr.localidade || prev.city,
          state: addr.uf || prev.state,
        }));
      }
      setFetchingCep(false);
    }
  };

  const handleSave = async () => {
    // Find changed profile fields
    const changedFields: Partial<ProfileData> = {};
    const oldValues: Partial<ProfileData> = {};
    const newValues: Partial<ProfileData> = {};

    (Object.keys(form) as (keyof ProfileData)[]).forEach(key => {
      if (form[key] !== original[key]) {
        changedFields[key] = form[key];
        oldValues[key] = original[key];
        newValues[key] = form[key];
      }
    });

    const emailChanged = email.trim().toLowerCase() !== originalEmail.trim().toLowerCase();

    if (Object.keys(changedFields).length === 0 && !emailChanged) {
      toast({ title: 'Info', description: 'Nenhum campo foi alterado' });
      return;
    }

    setSaving(true);
    try {
      // Update email via edge function if changed
      if (emailChanged) {
        const { data: emailResult, error: emailError } = await supabase.functions.invoke('admin-update-user-email', {
          body: { userId, newEmail: email.trim().toLowerCase() }
        });

        if (emailError || (emailResult && emailResult.error)) {
          const msg = emailResult?.error || emailError?.message || 'Erro ao atualizar e-mail';
          toast({ title: 'Erro', description: msg, variant: 'destructive' });
          setSaving(false);
          return;
        }
      }

      // Update profile fields if any changed
      if (Object.keys(changedFields).length > 0) {
        const { error } = await supabase
          .from('profiles')
          .update(changedFields)
          .eq('user_id', userId);

        if (error) throw error;
      }

      const allOld = { ...oldValues, ...(emailChanged ? { email: originalEmail } : {}) };
      const allNew = { ...newValues, ...(emailChanged ? { email: email.trim().toLowerCase() } : {}) };
      const changedLabels = Object.keys({ ...changedFields, ...(emailChanged ? { email: true } : {}) }).join(', ');

      await logAdminAction(
        'profile_edited',
        allOld,
        allNew,
        `Cadastro editado pelo admin. Campos alterados: ${changedLabels}`
      );

      toast({ title: 'Sucesso', description: 'Dados cadastrais atualizados com sucesso' });
      onUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({ title: 'Erro', description: 'Erro ao atualizar dados cadastrais', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Cadastro</DialogTitle>
          <DialogDescription>{userName} ({userEmail})</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="ep-name">Nome Completo</Label>
              <Input id="ep-name" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
            </div>

            <div>
              <Label htmlFor="ep-email">E-mail</Label>
              <Input id="ep-email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ep-cpf">CPF</Label>
                <Input id="ep-cpf" value={form.cpf} maxLength={14}
                  onChange={e => setForm(p => ({ ...p, cpf: formatCPF(e.target.value) }))} />
              </div>
              <div>
                <Label htmlFor="ep-phone">Telefone</Label>
                <Input id="ep-phone" value={form.phone} maxLength={15}
                  onChange={e => setForm(p => ({ ...p, phone: formatPhone(e.target.value) }))} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="ep-cep">CEP</Label>
                <div className="relative">
                  <Input id="ep-cep" value={form.cep} maxLength={9}
                    onChange={e => handleCepChange(e.target.value)} />
                  {fetchingCep && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
              <div className="col-span-2">
                <Label htmlFor="ep-street">Rua</Label>
                <Input id="ep-street" value={form.street} onChange={e => setForm(p => ({ ...p, street: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="ep-number">Número</Label>
                <Input id="ep-number" value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label htmlFor="ep-complement">Complemento</Label>
                <Input id="ep-complement" value={form.complement} onChange={e => setForm(p => ({ ...p, complement: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <Label htmlFor="ep-neighborhood">Bairro</Label>
                <Input id="ep-neighborhood" value={form.neighborhood} onChange={e => setForm(p => ({ ...p, neighborhood: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="ep-city">Cidade</Label>
                <Input id="ep-city" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="ep-state">Estado</Label>
                <Input id="ep-state" value={form.state} maxLength={2}
                  onChange={e => setForm(p => ({ ...p, state: e.target.value.toUpperCase() }))} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
