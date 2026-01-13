import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { FieldStatus } from '@/components/ui/field-status';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useFieldValidation } from '@/hooks/useFieldValidation';
import { Eye, EyeOff, Mail, Lock, User, MapPin } from 'lucide-react';
import { validateCPF, validatePhone, validateCEP, formatCPF, formatPhone, formatCEP, fetchAddressByCEP } from '@/utils/validators';
import { getReferralCode, clearReferralTracking } from '@/hooks/useReferralTracking';
import { SEOHead } from '@/components/SEOHead';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

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
  
  const { signIn, signUp, user, resetPassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { validationState, isValidating, validateEmail, validateCPF: validateCPFAvailability, clearValidation } = useFieldValidation();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

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
        navigate('/');
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
    
    setLoading(true);

    try {
      // Capturar código de referral antes do cadastro
      const referralCode = getReferralCode();
      
      const userData = {
        full_name: formData.fullName,
        cpf: formData.cpf.replace(/\D/g, ''), // Sempre salvar CPF sem formatação
        phone: formData.phone,
        birth_date: formData.birthDate,
        cep: formData.cep,
        street: formData.street,
        number: formData.number,
        complement: formData.complement,
        neighborhood: formData.neighborhood,
        city: formData.city,
        state: formData.state,
        referral_code: referralCode, // Adicionar código de referral
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
        // Limpar tracking de referral após cadastro bem sucedido
        clearReferralTracking();
        
        // Primeiro toast de confirmação de cadastro
        toast({
          title: "Cadastro realizado!",
          description: "Verifique seu email para confirmar a conta.",
        });

        // Toast adicional sobre bônus após um pequeno delay
        setTimeout(() => {
          toast({
            title: "🎉 Bônus Creditado!",
            description: "Você já recebeu lances gratuitos e pode começar a participar dos leilões imediatamente!",
            duration: 6000,
          });
        }, 2000);

        // Limpar formulário após sucesso
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
          <Tabs defaultValue="signin" className="w-full">
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
                    <Label htmlFor="birthDate">Data de Nascimento *</Label>
                    <Input
                      id="birthDate"
                      name="birthDate"
                      type="date"
                      value={formData.birthDate}
                      onChange={handleInputChange}
                      className={errors.birthDate ? "border-destructive" : ""}
                      aria-label="Selecione sua data de nascimento"
                      required
                    />
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
      </div>
    </>
  );
};

export default Auth;