import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Gift, Settings, Save, Trash2, AlertTriangle, Sparkles, Clock, Calculator, Eye, Users } from "lucide-react";
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PromoMode } from '@/hooks/usePromotion';

export const SystemSettings: React.FC = () => {
  const { settings, loading, updating, updateSetting, getSettingValue } = useSystemSettings();
  const { toast } = useToast();
  
  // Signup Bonus State
  const [signupBonusEnabled, setSignupBonusEnabled] = useState<boolean>(false);
  const [signupBonusBids, setSignupBonusBids] = useState<string>('5');
  const [isResetting, setIsResetting] = useState(false);

  // Promo Multiplier State
  const [promoEnabled, setPromoEnabled] = useState<boolean>(false);
  const [promoMultiplier, setPromoMultiplier] = useState<string>('2');
  const [promoMode, setPromoMode] = useState<PromoMode>('base');
  const [promoLabel, setPromoLabel] = useState<string>('LANCES EM DOBRO 🔥');
  const [promoExpiresAt, setPromoExpiresAt] = useState<string>('');
  const [savingPromo, setSavingPromo] = useState(false);

  // Finished Auctions Display State
  const [finishedAuctionsDisplayHours, setFinishedAuctionsDisplayHours] = useState<string>('48');
  const [savingDisplayHours, setSavingDisplayHours] = useState(false);

  // Partner System State
  const [partnerSystemEnabled, setPartnerSystemEnabled] = useState<boolean>(true);
  const [partnerFundPercentage, setPartnerFundPercentage] = useState<string>('20');
  const [partnerCutoffDay, setPartnerCutoffDay] = useState<string>('10');
  const [partnerPaymentDay, setPartnerPaymentDay] = useState<string>('20');
  const [savingPartner, setSavingPartner] = useState(false);

  // Flag to prevent useEffect from resetting local state after user edits
  const [isInitialized, setIsInitialized] = useState(false);

  React.useEffect(() => {
    // Only sync from database on initial load
    if (settings.length > 0 && !isInitialized) {
      // Signup Bonus
      setSignupBonusEnabled(getSettingValue('signup_bonus_enabled', false));
      setSignupBonusBids(getSettingValue('signup_bonus_bids', 5).toString());
      
      // Promo Multiplier
      setPromoEnabled(getSettingValue('promo_multiplier_enabled', false));
      setPromoMultiplier(getSettingValue('promo_multiplier_value', 2).toString());
      setPromoMode(getSettingValue('promo_multiplier_mode', 'base') as PromoMode);
      setPromoLabel(getSettingValue('promo_multiplier_label', 'LANCES EM DOBRO 🔥'));
      const expiresAt = getSettingValue('promo_multiplier_expires_at', '');
      // Convert ISO to datetime-local format
      if (expiresAt) {
        const date = new Date(expiresAt);
        if (!isNaN(date.getTime())) {
          setPromoExpiresAt(date.toISOString().slice(0, 16));
        }
      }
      
      // Finished Auctions Display Hours
      setFinishedAuctionsDisplayHours(getSettingValue('finished_auctions_display_hours', 48).toString());
      
      // Partner System
      setPartnerSystemEnabled(getSettingValue('partner_system_enabled', true));
      setPartnerFundPercentage(getSettingValue('partner_fund_percentage', 20).toString());
      setPartnerCutoffDay(getSettingValue('partner_cutoff_day', 10).toString());
      setPartnerPaymentDay(getSettingValue('partner_payment_day', 20).toString());
      
      setIsInitialized(true);
    }
  }, [settings, isInitialized, getSettingValue]);

  const handleSaveSignupBonus = async () => {
    await Promise.all([
      updateSetting('signup_bonus_enabled', signupBonusEnabled.toString()),
      updateSetting('signup_bonus_bids', signupBonusBids)
    ]);
  };

  const handleSaveDisplayHours = async () => {
    setSavingDisplayHours(true);
    try {
      await updateSetting('finished_auctions_display_hours', finishedAuctionsDisplayHours);
      toast({
        title: "Configuração salva!",
        description: finishedAuctionsDisplayHours === '0' 
          ? "Leilões finalizados não serão exibidos na home."
          : `Leilões finalizados serão exibidos por ${finishedAuctionsDisplayHours} horas.`,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar a configuração.",
        variant: "destructive"
      });
    } finally {
      setSavingDisplayHours(false);
    }
  };

  const handleSavePartnerSettings = async () => {
    setSavingPartner(true);
    try {
      await Promise.all([
        updateSetting('partner_system_enabled', partnerSystemEnabled.toString()),
        updateSetting('partner_fund_percentage', partnerFundPercentage),
        updateSetting('partner_cutoff_day', partnerCutoffDay),
        updateSetting('partner_payment_day', partnerPaymentDay)
      ]);
      toast({
        title: "Configurações salvas!",
        description: partnerSystemEnabled ? "Sistema de parceiros ativo." : "Sistema de parceiros desativado.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive"
      });
    } finally {
      setSavingPartner(false);
    }
  };

  const handleSavePromoSettings = async () => {
    setSavingPromo(true);
    try {
      // Convert datetime-local to ISO string
      const expiresAtISO = promoExpiresAt ? new Date(promoExpiresAt).toISOString() : '';
      
      await Promise.all([
        updateSetting('promo_multiplier_enabled', promoEnabled.toString()),
        updateSetting('promo_multiplier_value', promoMultiplier),
        updateSetting('promo_multiplier_mode', promoMode),
        updateSetting('promo_multiplier_label', promoLabel),
        updateSetting('promo_multiplier_expires_at', expiresAtISO)
      ]);
      
      toast({
        title: "Promoção salva!",
        description: promoEnabled ? "A promoção de multiplicador está ativa." : "Promoção desativada.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações da promoção.",
        variant: "destructive"
      });
    } finally {
      setSavingPromo(false);
    }
  };

  // Calculate preview for each mode
  const getPromoPreview = () => {
    const examplePrice = 350;
    const exampleBids = 700;
    const mult = parseFloat(promoMultiplier) || 2;
    
    switch (promoMode) {
      case 'base':
        return { result: Math.floor(examplePrice * mult), desc: `${examplePrice} × ${mult} = ${Math.floor(examplePrice * mult)} lances` };
      case 'total':
        return { result: Math.floor(exampleBids * mult), desc: `${exampleBids} × ${mult} = ${Math.floor(exampleBids * mult)} lances` };
      case 'bonus':
        const bonus = Math.floor(examplePrice * (mult - 1));
        return { result: exampleBids + bonus, desc: `${exampleBids} + ${bonus} bônus = ${exampleBids + bonus} lances` };
      default:
        return { result: Math.floor(examplePrice * mult), desc: '' };
    }
  };

  const handleResetFinancialData = async () => {
    setIsResetting(true);
    try {
      const { error: auctionsError } = await supabase
        .from('auctions')
        .update({
          current_price: 1.00,
          total_bids: 0,
          company_revenue: 0.00,
          winner_id: null,
          winner_name: null,
          last_bid_at: null
        });

      if (auctionsError) throw auctionsError;

      const { error: bidsError } = await supabase
        .from('bids')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (bidsError) throw bidsError;

      const { error: purchasesError } = await supabase
        .from('bid_purchases')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (purchasesError) throw purchasesError;

      toast({
        title: "Dados Resetados!",
        description: "Todos os dados financeiros foram resetados com sucesso.",
      });

    } catch (error) {
      console.error('Erro ao resetar dados financeiros:', error);
      toast({
        title: "Erro!",
        description: "Não foi possível resetar os dados financeiros.",
        variant: "destructive"
      });
    } finally {
      setIsResetting(false);
    }
  };

  // Calculate time remaining for promotion preview
  const getPromoTimeRemaining = () => {
    if (!promoExpiresAt) return null;
    const now = new Date().getTime();
    const expiry = new Date(promoExpiresAt).getTime();
    const diff = expiry - now;
    
    if (diff <= 0) return 'Expirado';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0 || days > 0) result += `${hours}h `;
    result += `${minutes}min`;
    
    return result;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Carregando configurações...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5" />
        <h2 className="text-xl font-semibold">Configurações do Sistema</h2>
      </div>

      {/* Promoção de Multiplicador */}
      <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-yellow-500/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-500" />
            <CardTitle className="text-orange-600">Promoção de Lances</CardTitle>
          </div>
          <CardDescription>
            Configure promoções de multiplicador (ex: lances em dobro, 1.5x, 3x)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="promo-enabled">Ativar promoção de multiplicador</Label>
              <p className="text-sm text-muted-foreground">
                Usuários receberão mais lances ao comprar pacotes
              </p>
            </div>
            <Switch
              id="promo-enabled"
              checked={promoEnabled}
              onCheckedChange={setPromoEnabled}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="promo-multiplier">Multiplicador</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="promo-multiplier"
                  type="number"
                  min="1"
                  max="10"
                  step="0.5"
                  value={promoMultiplier}
                  onChange={(e) => setPromoMultiplier(e.target.value)}
                  className="w-24"
                  disabled={!promoEnabled}
                />
                <span className="text-sm text-muted-foreground">x</span>
              </div>
              <p className="text-xs text-muted-foreground">
                2 = dobro, 1.5 = 50% extra, 3 = triplo
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="promo-label">Texto do Banner</Label>
              <Input
                id="promo-label"
                value={promoLabel}
                onChange={(e) => setPromoLabel(e.target.value)}
                placeholder="LANCES EM DOBRO 🔥"
                disabled={!promoEnabled}
              />
            </div>
          </div>

          {/* Novo seletor de modo de cálculo */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-orange-500" />
              <Label>Modo de Cálculo</Label>
            </div>
            <Select 
              value={promoMode} 
              onValueChange={(value: PromoMode) => setPromoMode(value)}
              disabled={!promoEnabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o modo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="base">
                  <div className="flex flex-col">
                    <span className="font-medium">Multiplicar preço base</span>
                    <span className="text-xs text-muted-foreground">R$ 350 × 2 = 700 lances</span>
                  </div>
                </SelectItem>
                <SelectItem value="total">
                  <div className="flex flex-col">
                    <span className="font-medium">Multiplicar total do pacote</span>
                    <span className="text-xs text-muted-foreground">700 lances × 2 = 1400 lances</span>
                  </div>
                </SelectItem>
                <SelectItem value="bonus">
                  <div className="flex flex-col">
                    <span className="font-medium">Total + bônus adicional</span>
                    <span className="text-xs text-muted-foreground">700 + (350 × 1) = 1050 lances</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Define como o multiplicador é aplicado nos pacotes
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="promo-expires">Validade da Promoção</Label>
            <div className="flex items-center gap-3">
              <Input
                id="promo-expires"
                type="datetime-local"
                value={promoExpiresAt}
                onChange={(e) => setPromoExpiresAt(e.target.value)}
                className="w-auto"
                disabled={!promoEnabled}
              />
              {promoExpiresAt && promoEnabled && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{getPromoTimeRemaining()}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Deixe vazio para promoção sem prazo definido
            </p>
          </div>

          {/* Preview */}
          {promoEnabled && (
            <div className="p-4 rounded-lg bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-red-500/20 border border-orange-500/30">
              <p className="text-sm font-medium mb-2">📣 Preview do Banner:</p>
              <div className="text-center p-3 rounded bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-white mb-3">
                <p className="font-bold">{promoLabel || 'PROMOÇÃO'}</p>
                <p className="text-xs opacity-90">
                  Compre agora e receba {promoMultiplier}x mais lances!
                </p>
                {promoExpiresAt && (
                  <p className="text-xs mt-1 opacity-75">
                    ⏰ Termina em: {getPromoTimeRemaining()}
                  </p>
                )}
              </div>
              
              {/* Preview de cálculo */}
              <div className="bg-background/50 p-3 rounded-lg border border-orange-500/20">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  📊 Exemplo de cálculo (Pacote R$ 350, 700 lances):
                </p>
                <p className="text-sm font-bold text-orange-600">
                  {getPromoPreview().desc}
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button 
              onClick={handleSavePromoSettings}
              disabled={savingPromo || updating}
              className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
            >
              <Save className="h-4 w-4" />
              {savingPromo ? 'Salvando...' : 'Salvar Promoção'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bônus de Cadastro */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            <CardTitle>Bônus de Cadastro</CardTitle>
          </div>
          <CardDescription>
            Configure quantos lances gratuitos novos usuários recebem ao se cadastrar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="signup-bonus-enabled">Ativar bônus de cadastro</Label>
              <p className="text-sm text-muted-foreground">
                Conceder lances gratuitos para novos usuários
              </p>
            </div>
            <Switch
              id="signup-bonus-enabled"
              checked={signupBonusEnabled}
              onCheckedChange={setSignupBonusEnabled}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label htmlFor="signup-bonus-bids">
              Quantidade de lances gratuitos
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="signup-bonus-bids"
                type="number"
                min="0"
                max="50"
                value={signupBonusBids}
                onChange={(e) => setSignupBonusBids(e.target.value)}
                className="w-32"
                disabled={!signupBonusEnabled}
              />
              <span className="text-sm text-muted-foreground">
                lances (máximo 50)
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {signupBonusEnabled 
                ? `Novos usuários receberão ${signupBonusBids} lances gratuitos`
                : 'Bônus desabilitado - usuários não receberão lances gratuitos'
              }
            </p>
          </div>

          <div className="flex justify-end pt-4">
            <Button 
              onClick={handleSaveSignupBonus}
              disabled={updating}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {updating ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Exibição de Leilões Finalizados */}
      <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-cyan-500/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-blue-600">Exibição de Leilões Finalizados</CardTitle>
          </div>
          <CardDescription>
            Configure quanto tempo os leilões finalizados aparecem na home e página de leilões
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="display-hours">Tempo de exibição após finalização</Label>
            <Select 
              value={finishedAuctionsDisplayHours} 
              onValueChange={setFinishedAuctionsDisplayHours}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Selecione o tempo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Não exibir leilões finalizados</SelectItem>
                <SelectItem value="12">12 horas</SelectItem>
                <SelectItem value="24">24 horas</SelectItem>
                <SelectItem value="48">48 horas (padrão)</SelectItem>
                <SelectItem value="72">72 horas (3 dias)</SelectItem>
                <SelectItem value="168">168 horas (1 semana)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {finishedAuctionsDisplayHours === '0' 
                ? 'Leilões finalizados não serão exibidos na home.'
                : `Leilões finalizados serão exibidos por ${finishedAuctionsDisplayHours} horas após o término.`
              }
            </p>
          </div>

          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Dica:</strong> Você também pode ocultar leilões finalizados individualmente na aba "Leilões" do painel administrativo usando o botão "Ocultar".
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button 
              onClick={handleSaveDisplayHours}
              disabled={savingDisplayHours || updating}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
            >
              <Save className="h-4 w-4" />
              {savingDisplayHours ? 'Salvando...' : 'Salvar Configuração'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sistema de Parceiros */}
      <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-indigo-500/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-purple-600">Sistema de Parceiros</CardTitle>
          </div>
          <CardDescription>
            Configure o programa de participação em receita
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="partner-enabled">Ativar sistema de parceiros</Label>
              <p className="text-sm text-muted-foreground">
                Permite que usuários se tornem parceiros e participem da receita
              </p>
            </div>
            <Switch
              id="partner-enabled"
              checked={partnerSystemEnabled}
              onCheckedChange={setPartnerSystemEnabled}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label htmlFor="partner-fund">% do Faturamento para Fundo de Parceiros</Label>
            <div className="flex items-center gap-3">
              <Input
                id="partner-fund"
                type="number"
                min="0"
                max="100"
                value={partnerFundPercentage}
                onChange={(e) => setPartnerFundPercentage(e.target.value)}
                className="w-24"
                disabled={!partnerSystemEnabled}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Porcentagem do faturamento bruto destinada aos repasses de parceiros
            </p>
          </div>

          <Separator />

          {/* Datas de Repasse */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-500" />
              <Label className="text-base font-medium">Datas de Repasse</Label>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="partner-cutoff">Dia de Corte</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="partner-cutoff"
                    type="number"
                    min="1"
                    max="28"
                    value={partnerCutoffDay}
                    onChange={(e) => setPartnerCutoffDay(e.target.value)}
                    className="w-20"
                    disabled={!partnerSystemEnabled}
                  />
                  <span className="text-sm text-muted-foreground">do mês</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cadastros até este dia recebem no mesmo mês
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="partner-payment">Dia de Pagamento</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="partner-payment"
                    type="number"
                    min="1"
                    max="28"
                    value={partnerPaymentDay}
                    onChange={(e) => setPartnerPaymentDay(e.target.value)}
                    className="w-20"
                    disabled={!partnerSystemEnabled}
                  />
                  <span className="text-sm text-muted-foreground">do mês</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Dia do repasse mensal
                </p>
              </div>
            </div>

            {/* Preview da regra */}
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <p className="text-xs text-muted-foreground">
                📅 <strong>Exemplo:</strong> Cadastros até dia {partnerCutoffDay} de Janeiro recebem no dia {partnerPaymentDay} de Janeiro. 
                Cadastros após o dia {partnerCutoffDay} recebem no dia {partnerPaymentDay} de Fevereiro.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Dica:</strong> Acesse "Gerenciamento de Parceiros" para configurar planos, processar repasses e ver relatórios detalhados.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button 
              onClick={handleSavePartnerSettings}
              disabled={savingPartner || updating}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
            >
              <Save className="h-4 w-4" />
              {savingPartner ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Estatísticas do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-medium">Bônus Cadastro</div>
              <div className="text-muted-foreground">
                {signupBonusEnabled ? 'Ativo' : 'Inativo'}
              </div>
            </div>
            <div>
              <div className="font-medium">Lances por cadastro</div>
              <div className="text-muted-foreground">
                {signupBonusEnabled ? `${signupBonusBids} lances` : '0 lances'}
              </div>
            </div>
            <div>
              <div className="font-medium">Promoção Multiplicador</div>
              <div className={promoEnabled ? "text-orange-500 font-medium" : "text-muted-foreground"}>
                {promoEnabled ? `${promoMultiplier}x Ativo` : 'Inativo'}
              </div>
            </div>
            <div>
              <div className="font-medium">Validade Promoção</div>
              <div className="text-muted-foreground">
                {promoEnabled && promoExpiresAt ? getPromoTimeRemaining() : 'N/A'}
              </div>
            </div>
            <div>
              <div className="font-medium">Exibição Finalizados</div>
              <div className="text-muted-foreground">
                {finishedAuctionsDisplayHours === '0' ? 'Desativado' : `${finishedAuctionsDisplayHours}h`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Zona de Perigo */}
      <Card className="border-destructive/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Zona de Perigo</CardTitle>
          </div>
          <CardDescription>
            Ações irreversíveis que afetam todos os dados do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-destructive">Resetar Dados Financeiros</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Remove todos os lances, compras de pacotes e zera receitas dos leilões.
                  Os leilões e usuários serão mantidos, mas todo histórico financeiro será perdido.
                </p>
              </div>
              
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• ❌ Todos os lances serão deletados</p>
                <p>• ❌ Todas as compras de pacotes serão deletadas</p>
                <p>• ❌ Receita dos leilões será zerada</p>
                <p>• ❌ Preços atuais voltarão para R$1,00</p>
                <p>• ✅ Leilões e usuários serão mantidos</p>
                <p>• ✅ Saldo de lances dos usuários será mantido</p>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    disabled={isResetting}
                    className="w-full"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {isResetting ? 'Resetando...' : 'Resetar Dados Financeiros'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-destructive">
                      ⚠️ Confirmar Reset de Dados Financeiros
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>Esta ação é <strong>IRREVERSÍVEL</strong> e irá:</p>
                      
                      <div className="bg-destructive/10 p-3 rounded-md text-sm">
                        <p className="font-medium text-destructive mb-2">Dados que serão DELETADOS:</p>
                        <ul className="space-y-1 text-muted-foreground">
                          <li>• Todos os lances existentes</li>
                          <li>• Todas as compras de pacotes</li>
                          <li>• Todo histórico de receita</li>
                          <li>• Vencedores atuais dos leilões</li>
                        </ul>
                      </div>

                      <p className="text-sm">
                        Apenas os leilões, usuários e configurações serão mantidos.
                        Tem certeza absoluta que deseja continuar?
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleResetFinancialData}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Sim, Resetar Tudo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
