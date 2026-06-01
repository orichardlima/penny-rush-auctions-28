import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useFieldValidation } from '@/hooks/useFieldValidation';
import { FieldStatus } from '@/components/ui/field-status';
import { supabase } from '@/integrations/supabase/client';
import {
  validateCPF,
  validatePhone,
  validateCEP,
  formatCPF,
  formatPhone,
  formatCEP,
  fetchAddressByCEP,
} from '@/utils/validators';
import {
  getPartnerReferralCode,
  clearPartnerReferralTracking,
} from '@/hooks/usePartnerReferralTracking';
import {
  getReferralCode,
  clearReferralTracking,
} from '@/hooks/useReferralTracking';
import { SEOHead } from '@/components/SEOHead';
import { UserCheck } from 'lucide-react';

const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 100 }, (_, i) => String(currentYear - 18 - i));

const CompleteProfile = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { validationState, isValidating, validateCPF: validateCPFAvailability } = useFieldValidation();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [loadingSponsor, setLoadingSponsor] = useState(false);
  const [sponsorName, setSponsorName] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');

  const initialRef = searchParams.get('ref') || getPartnerReferralCode() || '';

  const [form, setForm] = useState({
    fullName: '',
    cpf: '',
    phone: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    partnerReferralCode: initialRef,
  });

  // Guard: precisa estar logado e perfil incompleto
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }
    if (profile && (profile as any).profile_complete === true) {
      navigate('/dashboard', { replace: true });
    }
    if (profile?.full_name && !form.fullName) {
      setForm((f) => ({ ...f, full_name: profile.full_name ?? '' } as any));
      setForm((f) => ({ ...f, fullName: profile.full_name ?? '' }));
    }
  }, [user, profile, authLoading, navigate]);

  // Buscar nome do parceiro indicador
  useEffect(() => {
    const code = form.partnerReferralCode?.trim().toUpperCase();
    if (!code) {
      setSponsorName(null);
      return;
    }
    setLoadingSponsor(true);
    (async () => {
      try {
        const { data: contracts } = await supabase.rpc('get_contract_by_referral_code', { code });
        const contract = contracts?.[0];
        if (contract) {
          const { data: profiles } = await supabase.rpc('get_public_profiles', {
            user_ids: [contract.user_id],
          });
          setSponsorName(profiles?.[0]?.full_name ?? null);
        } else {
          setSponsorName(null);
        }
      } catch {
        setSponsorName(null);
      } finally {
        setLoadingSponsor(false);
      }
    })();
  }, [form.partnerReferralCode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let v = value;
    if (name === 'cpf') v = formatCPF(value);
    if (name === 'phone') v = formatPhone(value);
    if (name === 'cep') v = formatCEP(value);
    if (name === 'partnerReferralCode') v = value.toUpperCase();
    setForm((f) => ({ ...f, [name]: v }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: '' }));
  };

  const handleCEPBlur = async () => {
    const cep = form.cep.replace(/\D/g, '');
    if (cep.length !== 8) return;
    setLoadingAddress(true);
    const address = await fetchAddressByCEP(cep);
    setLoadingAddress(false);
    if (address) {
      setForm((f) => ({
        ...f,
        street: address.street || f.street,
        neighborhood: address.neighborhood || f.neighborhood,
        city: address.city || f.city,
        state: address.state || f.state,
      }));
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName = 'Nome obrigatório';
    if (!validateCPF(form.cpf)) e.cpf = 'CPF inválido';
    if (!validatePhone(form.phone)) e.phone = 'Telefone inválido';
    if (!birthDay || !birthMonth || !birthYear) e.birthDate = 'Data de nascimento obrigatória';
    if (!validateCEP(form.cep)) e.cep = 'CEP inválido';
    if (!form.street.trim()) e.street = 'Rua obrigatória';
    if (!form.number.trim()) e.number = 'Número obrigatório';
    if (!form.neighborhood.trim()) e.neighborhood = 'Bairro obrigatório';
    if (!form.city.trim()) e.city = 'Cidade obrigatória';
    if (!form.state.trim()) e.state = 'Estado obrigatório';
    if (validationState.cpf?.exists) e.cpf = 'CPF já cadastrado';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const birthDate = `${birthYear}-${birthMonth}-${birthDay}`;
      const affiliateRef = getReferralCode();

      const { data, error } = await supabase.rpc('complete_oauth_profile', {
        p_full_name: form.fullName.trim(),
        p_cpf: form.cpf,
        p_phone: form.phone,
        p_birth_date: birthDate,
        p_cep: form.cep,
        p_street: form.street,
        p_number: form.number,
        p_complement: form.complement || null,
        p_neighborhood: form.neighborhood,
        p_city: form.city,
        p_state: form.state,
        p_partner_referral_code: form.partnerReferralCode || null,
        p_affiliate_referral_code: affiliateRef || null,
      });

      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result?.success) {
        const msg =
          result?.error === 'cpf_already_used'
            ? 'Este CPF já está cadastrado.'
            : result?.error === 'cpf_invalid'
            ? 'CPF inválido.'
            : 'Não foi possível salvar. Tente novamente.';
        toast({ title: 'Erro', description: msg, variant: 'destructive' });
        return;
      }

      clearPartnerReferralTracking();
      clearReferralTracking();
      await refreshProfile();
      toast({ title: 'Cadastro concluído!', description: 'Bem-vindo ao Show de Lances.' });
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Erro',
        description: err?.message || 'Erro ao completar cadastro.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead title="Complete seu cadastro" description="Finalize seus dados para começar a participar dos leilões." />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Complete seu cadastro
            </CardTitle>
            <p className="text-muted-foreground">
              Precisamos de mais alguns dados para liberar seu acesso aos leilões.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {sponsorName && (
                <div className="p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/20 rounded-full">
                      <UserCheck className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Você foi indicado por</p>
                      <p className="font-semibold text-lg">{sponsorName}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo *</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  required
                  className={errors.fullName ? 'border-destructive' : ''}
                />
                {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF *</Label>
                  <Input
                    id="cpf"
                    name="cpf"
                    value={form.cpf}
                    onChange={handleChange}
                    onBlur={() => validateCPFAvailability(form.cpf)}
                    maxLength={14}
                    placeholder="000.000.000-00"
                    required
                    className={errors.cpf ? 'border-destructive' : ''}
                  />
                  {errors.cpf && <p className="text-sm text-destructive">{errors.cpf}</p>}
                  <FieldStatus
                    isValidating={isValidating.cpf}
                    isValid={form.cpf.length > 0 ? validateCPF(form.cpf) : undefined}
                    isAvailable={validationState.cpf?.available}
                    hasError={!!validationState.cpf?.error}
                    message={
                      validationState.cpf?.exists
                        ? 'Este CPF já possui cadastro.'
                        : undefined
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone *</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    maxLength={15}
                    placeholder="(00) 00000-0000"
                    required
                    className={errors.phone ? 'border-destructive' : ''}
                  />
                  {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Data de Nascimento *</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Select value={birthDay} onValueChange={setBirthDay}>
                    <SelectTrigger><SelectValue placeholder="Dia" /></SelectTrigger>
                    <SelectContent>{days.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={birthMonth} onValueChange={setBirthMonth}>
                    <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
                    <SelectContent>{months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={birthYear} onValueChange={setBirthYear}>
                    <SelectTrigger><SelectValue placeholder="Ano" /></SelectTrigger>
                    <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {errors.birthDate && <p className="text-sm text-destructive">{errors.birthDate}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="cep">CEP *</Label>
                  <Input
                    id="cep"
                    name="cep"
                    value={form.cep}
                    onChange={handleChange}
                    onBlur={handleCEPBlur}
                    maxLength={9}
                    placeholder="00000-000"
                    required
                    className={errors.cep ? 'border-destructive' : ''}
                  />
                  {loadingAddress && <p className="text-xs text-muted-foreground">Buscando endereço...</p>}
                  {errors.cep && <p className="text-sm text-destructive">{errors.cep}</p>}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="street">Rua *</Label>
                  <Input id="street" name="street" value={form.street} onChange={handleChange} required className={errors.street ? 'border-destructive' : ''} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="number">Número *</Label>
                  <Input id="number" name="number" value={form.number} onChange={handleChange} required className={errors.number ? 'border-destructive' : ''} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="complement">Complemento</Label>
                  <Input id="complement" name="complement" value={form.complement} onChange={handleChange} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="neighborhood">Bairro *</Label>
                  <Input id="neighborhood" name="neighborhood" value={form.neighborhood} onChange={handleChange} required className={errors.neighborhood ? 'border-destructive' : ''} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade *</Label>
                  <Input id="city" name="city" value={form.city} onChange={handleChange} required className={errors.city ? 'border-destructive' : ''} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">UF *</Label>
                  <Input id="state" name="state" value={form.state} onChange={handleChange} maxLength={2} required className={errors.state ? 'border-destructive' : ''} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="partnerReferralCode">Código de indicação (opcional)</Label>
                <Input
                  id="partnerReferralCode"
                  name="partnerReferralCode"
                  value={form.partnerReferralCode}
                  onChange={handleChange}
                  placeholder="Código do parceiro que te indicou"
                />
                {loadingSponsor && <p className="text-xs text-muted-foreground">Verificando código...</p>}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Salvando...' : 'Concluir cadastro'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default CompleteProfile;
