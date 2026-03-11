import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { FieldStatus } from '@/components/ui/field-status';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useFieldValidation } from '@/hooks/useFieldValidation';
import { Eye, EyeOff, Mail, Lock, User, MapPin, UserCheck } from 'lucide-react';
import { validateCPF, validatePhone, validateCEP, formatCPF, formatPhone, formatCEP, fetchAddressByCEP } from '@/utils/validators';
import { getReferralCode, clearReferralTracking } from '@/hooks/useReferralTracking';
import { getPartnerReferralCode, clearPartnerReferralTracking } from '@/hooks/usePartnerReferralTracking';
import { SEOHead } from '@/components/SEOHead';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';
import { BettorContractTermsDialog } from '@/components/BettorContractTermsDialog';

const Auth = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    cpf: '',
    phone: '',
    birthDate: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: ''
  });
  const [loading, setLoading] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sponsorName, setSponsorName] = useState<string | null>(null);
  const [loadingSponsor, setLoadingSponsor] = useState(false);
  const [showBettorContract, setShowBettorContract] = useState(false);
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  
  const { signIn, signUp, user, resetPassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { validationState, isValidating, validateEmail, validateCPF: validateCPFAvailability, clearValidation } = useFieldValidation();

  // Determinar tab padrão baseado no parâmetro da URL
  const defaultTab = searchParams.get('tab') === 'signup' ? 'signup' : 'signin';

  // Buscar nome do patrocinador quando tiver ref na URL
  useEffect(() => {
    const refCode = searchParams.get('ref');
    
    if (refCode) {
      setLoadingSponsor(true);
      supabase
        .from('partner_contracts')
        .select('id, referral_code, user_id')
        .eq('referral_code', refCode.trim().toUpperCase())
        .eq('status', 'ACTIVE')
        .maybeSingle()
        .then(async ({ data: contract, error }) => {
          if (contract && !error) {
            // Buscar nome do usuário
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', contract.user_id)
              .maybeSingle();
            
            if (profile?.full_name) {
              setSponsorName(profile.full_name);
            }
          }
          setLoadingSponsor(false);
        });
    }
  }, [searchParams]);

  // Obter redirect, plan e ref da URL para preservar após login/cadastro
  const redirectUrl = useMemo(() => {
    const redirect = searchParams.get('redirect') || '/dashboard';
    const plan = searchParams.get('plan');
    const ref = searchParams.get('ref');
    
    let finalUrl = redirect;
    const params: string[] = [];
    
    if (plan) params.push(`plan=${plan}`);
    if (ref) params.push(`ref=${ref}`);
    
    if (params.length > 0) {
      const separator = redirect.includes('?') ? '&' : '?';
      finalUrl = `${redirect}${separator}${params.join('&')}`;
    }
    
    return finalUrl;
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      navigate(redirectUrl);
    }
  }, [user, navigate, redirectUrl]);

  // Debounced validation
  const debounceTimeout = React.useRef<NodeJS.Timeout>();
  
  const debouncedEmailValidation = useCallback((email: string) => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    debounceTimeout.current = setTimeout(() => {
      validateEmail(email);
    }, 800);
  }, [validateEmail]);

  const debouncedCPFValidation = useCallback((cpf: string) => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    debounceTimeout.current = setTimeout(() => {
      if (validateCPF(cpf)) {
        validateCPFAvailability(cpf);
      }
    }, 800);
  }, [validateCPFAvailability]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;
    
    // Aplicar máscaras
    if (name === 'cpf') {
      formattedValue = formatCPF(value);
    } else if (name === 'phone') {
      formattedValue = formatPhone(value);
    } else if (name === 'cep') {
      formattedValue = formatCEP(value);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: formattedValue
    }));
    
    // Limpar erro do campo quando o usuário digitar
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }

    // Clear validation when user starts typing
    if (name === 'email' || name === 'cpf') {
      clearValidation(name as 'email' | 'cpf');
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // Validações básicas
    if (!formData.email) newErrors.email = "Email é obrigatório";
    if (!formData.password || formData.password.length < 6) newErrors.password = "Senha deve ter pelo menos 6 caracteres";
    if (!formData.fullName) newErrors.fullName = "Nome completo é obrigatório";
    if (!formData.cpf) newErrors.cpf = "CPF é obrigatório";
    else if (!validateCPF(formData.cpf)) newErrors.cpf = "CPF inválido";
    if (!formData.phone) newErrors.phone = "Telefone é obrigatório";
    else if (!validatePhone(formData.phone)) newErrors.phone = "Telefone inválido";
    if (!formData.birthDate) newErrors.birthDate = "Data de nascimento é obrigatória";
    if (!formData.cep) newErrors.cep = "CEP é obrigatório";
    else if (!validateCEP(formData.cep)) newErrors.cep = "CEP inválido";
    if (!formData.street) newErrors.street = "Logradouro é obrigatório";
    if (!formData.number) newErrors.number = "Número é obrigatório";
    if (!formData.neighborhood) newErrors.neighborhood = "Bairro é obrigatório";
    if (!formData.city) newErrors.city = "Cidade é obrigatória";
    if (!formData.state) newErrors.state = "Estado é obrigatório";
    
    // Verificar disponibilidade
    if (validationState.email?.exists) {
      newErrors.email = "Este email já está cadastrado";
    }
    if (validationState.cpf?.exists) {
      newErrors.cpf = "Este CPF já está cadastrado";
    }

    // Bloquear submissão se ainda estiver validando
    if (isValidating.email || isValidating.cpf) {
      toast({
        variant: "destructive",
        title: "Aguarde a validação",
        description: "Aguarde a verificação de disponibilidade antes de continuar.",
      });
      return false;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCEPBlur = async () => {
    if (!validateCEP(formData.cep)) return;
    
    setLoadingAddress(true);
    try {
      const addressData = await fetchAddressByCEP(formData.cep);
      
      if (addressData && !addressData.erro) {
        setFormData(prev => ({
          ...prev,
          street: addressData.logradouro || "",
          neighborhood: addressData.bairro || "",
          city: addressData.localidade || "",
          state: addressData.uf || ""
        }));
        
        toast({
          title: "Endereço encontrado!",
          description: "Dados do endereço preenchidos automaticamente.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "CEP não encontrado",
          description: "Verifique o CEP digitado e tente novamente.",
        });
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    } finally {
      setLoadingAddress(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signIn(formData.email, formData.password);
      
      if (error) {
        toast({
          title: 'Erro no login',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Login realizado com sucesso!',
          description: 'Bem-vindo de volta!',
        });
        navigate(redirectUrl);
      }
    } catch (error) {
      toast({
        title: 'Erro inesperado',
        description: 'Ocorreu um erro durante o login',
        variant: 'destructive',
      });
    }

    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        variant: "destructive",
        title: "Erro no formulário",
        description: "Por favor, corrija os campos destacados em vermelho.",
      });
      return;
    }
    
    // Abrir dialog do contrato do apostador em vez de cadastrar direto
    setShowBettorContract(true);
  };

  const handleBettorContractAccept = async () => {
    setLoading(true);

    try {
      // Capturar código de referral antes do cadastro
      const rawReferralCode = getReferralCode();
      const rawPartnerReferralCode = getPartnerReferralCode();
      
      // Diferenciar: se o código pertence a um parceiro ativo, usar como partner_referral_code
      // e NÃO enviar como referral_code (afiliado). Caso contrário, enviar como referral_code.
      let finalReferralCode: string | null = null;
      let finalPartnerReferralCode: string | null = null;
      
      const codeToCheck = rawPartnerReferralCode || rawReferralCode;
      
      if (codeToCheck) {
        // Verificar se é código de parceiro
        const { data: partnerMatch } = await supabase
          .from('partner_contracts')
          .select('id')
          .eq('referral_code', codeToCheck.trim().toUpperCase())
          .eq('status', 'ACTIVE')
          .maybeSingle();
        
        if (partnerMatch) {
          // É código de parceiro — só enviar como partner_referral_code
          finalPartnerReferralCode = codeToCheck;
        } else {
          // Não é parceiro — enviar como referral_code (afiliado)
          finalReferralCode = codeToCheck;
        }
      }
      
      const userData = {
        full_name: formData.fullName,
        cpf: formData.cpf.replace(/\D/g, ''),
        phone: formData.phone,
        birth_date: formData.birthDate,
        cep: formData.cep,
        street: formData.street,
        number: formData.number,
        complement: formData.complement,
        neighborhood: formData.neighborhood,
        city: formData.city,
        state: formData.state,
        referral_code: finalReferralCode,
        partner_referral_code: finalPartnerReferralCode,
      };

      const { error } = await signUp(formData.email, formData.password, userData);

      if (error) {
        if (error.message.includes('already registered')) {
          toast({
            variant: "destructive",
            title: "Erro no cadastro",
            description: "Este email já está cadastrado. Tente fazer login ou use outro email.",
          });
        } else if (error.message.includes('duplicate key') || error.message.includes('idx_profiles_cpf')) {
          toast({
            variant: "destructive",
            title: "Erro no cadastro",
            description: "Este CPF já está cadastrado. Verifique os dados ou entre em contato conosco.",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Erro no cadastro",
            description: error.message || "Ocorreu um erro inesperado. Tente novamente.",
          });
        }
      } else {
        clearReferralTracking();
        clearPartnerReferralTracking();
        
        toast({
          title: "Cadastro realizado!",
          description: "Verifique seu email para confirmar a conta.",
        });

        setTimeout(() => {
          toast({
            title: "🎉 Bônus Creditado!",
            description: "Você já recebeu lances gratuitos e pode começar a participar dos leilões imediatamente!",
            duration: 6000,
          });
        }, 2000);

        setFormData({
          email: "",
          password: "",
          fullName: "",
          cpf: "",
          phone: "",
          birthDate: "",
          cep: "",
          street: "",
          number: "",
          complement: "",
          neighborhood: "",
          city: "",
          state: ""
        });
        setErrors({});
      }
    } catch (error) {
      console.error('Erro no cadastro:', error);
      toast({
        variant: "destructive",
        title: "Erro no cadastro",
        description: "Ocorreu um erro inesperado. Tente novamente.",
      });
    } finally {
      setLoading(false);
      setShowBettorContract(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await resetPassword(resetEmail);
      
      if (error) {
        toast({
          title: 'Erro',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Email enviado!',
          description: 'Verifique sua caixa de entrada para redefinir sua senha. O link expira em 24 horas.',
        });
        setShowForgotPassword(false);
        setResetEmail('');
      }
    } catch (error) {
      toast({
        title: 'Erro inesperado',
        description: 'Ocorreu um erro ao enviar o email',
        variant: 'destructive',
      });
    }

    setLoading(false);
  };

  return (
    <>
      <SEOHead 
        title="Entrar ou Cadastrar" 
        description="Acesse sua conta ou crie uma nova no Show de Lances. Participe de leilões de centavos e ganhe produtos incríveis com descontos de até 99%."
      />
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 p-4">
          <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Show de Lances
          </CardTitle>
          <p className="text-muted-foreground">
            Entre ou cadastre-se para participar dos leilões
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              {!showForgotPassword ? (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="seu@email.com"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="pl-10"
                        aria-label="Digite seu email de acesso"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleInputChange}
                        className="pl-10 pr-10"
                        aria-label="Digite sua senha"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Entrando...' : 'Entrar'}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-primary hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="resetEmail">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="resetEmail"
                        type="email"
                        placeholder="seu@email.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="pl-10"
                        aria-label="Digite seu email para recuperação de senha"
                        required
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Enviaremos um link para redefinir sua senha
                    </p>
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(false)}
                      className="text-sm text-primary hover:underline"
                    >
                      Voltar para login
                    </button>
                  </div>
                </form>
              )}
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-6">
                {/* Banner do Patrocinador */}
                {sponsorName && (
                  <div className="p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/20 rounded-full">
                        <UserCheck className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Você foi indicado por</p>
                        <p className="font-semibold text-lg text-foreground">{sponsorName}</p>
                      </div>
                    </div>
                  </div>
                )}

                {loadingSponsor && (
                  <div className="p-4 bg-muted rounded-lg animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted-foreground/20 rounded-full" />
                      <div className="space-y-2">
                        <div className="h-3 w-24 bg-muted-foreground/20 rounded" />
                        <div className="h-5 w-36 bg-muted-foreground/20 rounded" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Dados Pessoais */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Dados Pessoais</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome Completo *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="fullName"
                        name="fullName"
                        type="text"
                        placeholder="Seu nome completo"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        className={`pl-10 ${errors.fullName ? "border-destructive" : ""}`}
                        aria-label="Digite seu nome completo"
                        required
                      />
                    </div>
                    {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cpf">CPF *</Label>
                      <Input
                        id="cpf"
                        name="cpf"
                        type="text"
                        placeholder="000.000.000-00"
                        value={formData.cpf}
                        onChange={handleInputChange}
                        onBlur={() => debouncedCPFValidation(formData.cpf)}
                        className={errors.cpf ? "border-destructive" : ""}
                        maxLength={14}
                        aria-label="Digite seu CPF"
                        required
                      />
                      {errors.cpf && <p className="text-sm text-destructive">{errors.cpf}</p>}
                      <FieldStatus
                        isValidating={isValidating.cpf}
                        isValid={formData.cpf.length > 0 ? validateCPF(formData.cpf) : undefined}
                        isAvailable={validationState.cpf?.available}
                        hasError={!!validationState.cpf?.error}
                        message={
                          validationState.cpf?.error 
                            ? validationState.cpf.error
                            : validationState.cpf?.exists 
                            ? "Este CPF já possui cadastro. Use outro CPF ou faça login." 
                            : validationState.cpf?.available 
                            ? "CPF disponível para cadastro" 
                            : undefined
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone *</Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="text"
                        placeholder="(11) 99999-9999"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className={errors.phone ? "border-destructive" : ""}
                        maxLength={15}
                        aria-label="Digite seu telefone com DDD"
                        required
                      />
                      {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Data de Nascimento *</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Select value={birthDay} onValueChange={(val) => {
                        setBirthDay(val);
                        if (birthMonth && birthYear) {
                          setFormData(prev => ({ ...prev, birthDate: `${birthYear}-${birthMonth}-${val}` }));
                        }
                      }}>
                        <SelectTrigger className={errors.birthDate ? "border-destructive" : ""}>
                          <SelectValue placeholder="Dia" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: (() => {
                            if (!birthMonth) return 31;
                            const m = parseInt(birthMonth);
                            const y = birthYear ? parseInt(birthYear) : 2000;
                            return new Date(y, m, 0).getDate();
                          })() }, (_, i) => (
                            <SelectItem key={i + 1} value={String(i + 1).padStart(2, '0')}>
                              {i + 1}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={birthMonth} onValueChange={(val) => {
                        setBirthMonth(val);
                        // Adjust day if needed
                        const y = birthYear ? parseInt(birthYear) : 2000;
                        const maxDay = new Date(y, parseInt(val), 0).getDate();
                        const adjustedDay = birthDay && parseInt(birthDay) > maxDay ? String(maxDay).padStart(2, '0') : birthDay;
                        if (adjustedDay !== birthDay) setBirthDay(adjustedDay);
                        if (adjustedDay && birthYear) {
                          setFormData(prev => ({ ...prev, birthDate: `${birthYear}-${val}-${adjustedDay}` }));
                        }
                      }}>
                        <SelectTrigger className={errors.birthDate ? "border-destructive" : ""}>
                          <SelectValue placeholder="Mês" />
                        </SelectTrigger>
                        <SelectContent>
                          {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((month, i) => (
                            <SelectItem key={i} value={String(i + 1).padStart(2, '0')}>
                              {month}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={birthYear} onValueChange={(val) => {
                        setBirthYear(val);
                        if (birthMonth) {
                          const maxDay = new Date(parseInt(val), parseInt(birthMonth), 0).getDate();
                          const adjustedDay = birthDay && parseInt(birthDay) > maxDay ? String(maxDay).padStart(2, '0') : birthDay;
                          if (adjustedDay !== birthDay) setBirthDay(adjustedDay);
                          if (adjustedDay && birthMonth) {
                            setFormData(prev => ({ ...prev, birthDate: `${val}-${birthMonth}-${adjustedDay}` }));
                          }
                        }
                      }}>
                        <SelectTrigger className={errors.birthDate ? "border-destructive" : ""}>
                          <SelectValue placeholder="Ano" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: new Date().getFullYear() - 18 - 1920 + 1 }, (_, i) => {
                            const year = new Date().getFullYear() - 18 - i;
                            return (
                              <SelectItem key={year} value={String(year)}>
                                {year}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    {errors.birthDate && <p className="text-sm text-destructive">{errors.birthDate}</p>}
                  </div>
                </div>

                <Separator />

                {/* Endereço */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">Endereço para Entrega</h3>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cep">CEP *</Label>
                    <Input
                      id="cep"
                      name="cep"
                      type="text"
                      placeholder="00000-000"
                      value={formData.cep}
                      onChange={handleInputChange}
                      onBlur={handleCEPBlur}
                      className={errors.cep ? "border-destructive" : ""}
                      maxLength={9}
                      aria-label="Digite seu CEP"
                      required
                    />
                    {errors.cep && <p className="text-sm text-destructive">{errors.cep}</p>}
                    {loadingAddress && <p className="text-sm text-muted-foreground">Buscando endereço...</p>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="street">Logradouro *</Label>
                      <Input
                        id="street"
                        name="street"
                        type="text"
                        placeholder="Rua, Avenida, etc."
                        value={formData.street}
                        onChange={handleInputChange}
                        className={errors.street ? "border-destructive" : ""}
                        aria-label="Digite sua rua ou avenida"
                        required
                      />
                      {errors.street && <p className="text-sm text-destructive">{errors.street}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="number">Número *</Label>
                      <Input
                        id="number"
                        name="number"
                        type="text"
                        placeholder="123"
                        value={formData.number}
                        onChange={handleInputChange}
                        className={errors.number ? "border-destructive" : ""}
                        aria-label="Digite o número do endereço"
                        required
                      />
                      {errors.number && <p className="text-sm text-destructive">{errors.number}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="complement">Complemento</Label>
                    <Input
                      id="complement"
                      name="complement"
                      type="text"
                      placeholder="Apartamento, bloco, etc. (opcional)"
                      value={formData.complement}
                      onChange={handleInputChange}
                      aria-label="Digite o complemento (opcional)"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="neighborhood">Bairro *</Label>
                      <Input
                        id="neighborhood"
                        name="neighborhood"
                        type="text"
                        placeholder="Bairro"
                        value={formData.neighborhood}
                        onChange={handleInputChange}
                        className={errors.neighborhood ? "border-destructive" : ""}
                        aria-label="Digite seu bairro"
                        required
                      />
                      {errors.neighborhood && <p className="text-sm text-destructive">{errors.neighborhood}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="city">Cidade *</Label>
                      <Input
                        id="city"
                        name="city"
                        type="text"
                        placeholder="Cidade"
                        value={formData.city}
                        onChange={handleInputChange}
                        className={errors.city ? "border-destructive" : ""}
                        aria-label="Digite sua cidade"
                        required
                      />
                      {errors.city && <p className="text-sm text-destructive">{errors.city}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="state">Estado *</Label>
                      <Input
                        id="state"
                        name="state"
                        type="text"
                        placeholder="UF"
                        value={formData.state}
                        onChange={handleInputChange}
                        className={errors.state ? "border-destructive" : ""}
                        maxLength={2}
                        aria-label="Digite seu estado (UF)"
                        required
                      />
                      {errors.state && <p className="text-sm text-destructive">{errors.state}</p>}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Dados de Acesso */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Dados de Acesso</h3>
                  
                   <div className="space-y-2">
                     <Label htmlFor="email-signup">Email *</Label>
                     <div className="relative">
                       <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                       <Input
                         id="email-signup"
                         name="email"
                         type="email"
                         placeholder="seu@email.com"
                         value={formData.email}
                         onChange={handleInputChange}
                         onBlur={() => debouncedEmailValidation(formData.email)}
                         className={`pl-10 ${errors.email ? "border-destructive" : ""}`}
                         aria-label="Digite seu email para criar a conta"
                         required
                       />
                     </div>
                     {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                     <FieldStatus
                       isValidating={isValidating.email}
                       isValid={formData.email.length > 0 ? formData.email.includes('@') : undefined}
                       isAvailable={validationState.email?.available}
                       hasError={!!validationState.email?.error}
                       message={
                         validationState.email?.error 
                           ? validationState.email.error
                           : validationState.email?.exists 
                           ? "Este email já possui cadastro. Use outro email ou faça login." 
                           : validationState.email?.available 
                           ? "Email disponível para cadastro" 
                           : undefined
                       }
                     />
                   </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password-signup">Senha *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password-signup"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Mínimo 6 caracteres"
                        value={formData.password}
                        onChange={handleInputChange}
                        className={`pl-10 pr-10 ${errors.password ? "border-destructive" : ""}`}
                        aria-label="Crie uma senha segura com no mínimo 6 caracteres"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                  </div>
                </div>
                
                <Button type="submit" className="w-full" disabled={loading || isValidating.email || isValidating.cpf || validationState.email?.exists || validationState.cpf?.exists}>
                  {loading ? "Cadastrando..." : "Cadastrar"}
                </Button>
                
                <p className="text-sm text-muted-foreground text-center">
                  * Campos obrigatórios
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
        </main>
        <Footer />

        <BettorContractTermsDialog
          open={showBettorContract}
          onClose={() => setShowBettorContract(false)}
          onAccept={handleBettorContractAccept}
          loading={loading}
        />
      </div>
    </>
  );
};

export default Auth;