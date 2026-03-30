import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, Settings, Save, Trash2, AlertTriangle, Sparkles, Clock, Calculator, Eye, Users, PartyPopper, Rocket, X, RefreshCw, FileText, CreditCard } from "lucide-react";
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
  const [weeklyPaymentDay, setWeeklyPaymentDay] = useState<string>('5');
  const [dailyClosingTime, setDailyClosingTime] = useState<string>('18');
  const [maxWeeklyPercentage, setMaxWeeklyPercentage] = useState<string>('10');
  const [maxMonthlyPercentage, setMaxMonthlyPercentage] = useState<string>('20');
  const [savingPartner, setSavingPartner] = useState(false);

  // Launch Banner State
  const [bannerEnabled, setBannerEnabled] = useState<boolean>(true);
  const [bannerTitle, setBannerTitle] = useState<string>('🎉 LANÇAMENTO OFICIAL!');
  const [bannerSubtitle, setBannerSubtitle] = useState<string>('A plataforma Show de Lances está no ar!');
  const [bannerHighlight, setBannerHighlight] = useState<string>('Cada lance custa apenas R$ 1!');
  const [bannerCta1Text, setBannerCta1Text] = useState<string>('Ver Leilões');
  const [bannerCta1Link, setBannerCta1Link] = useState<string>('/#leiloes');
  const [bannerCta2Text, setBannerCta2Text] = useState<string>('Comprar Lances');
  const [bannerCta2Link, setBannerCta2Link] = useState<string>('/pacotes');
  const [bannerMobileCtaText, setBannerMobileCtaText] = useState<string>('Participar');
  const [bannerExpiresAt, setBannerExpiresAt] = useState<string>('');
  const [savingBanner, setSavingBanner] = useState(false);

  // Contract Texts State
  const [contractBettorText, setContractBettorText] = useState<string>('');
  const [contractPartnerText, setContractPartnerText] = useState<string>('');
  const [savingContract, setSavingContract] = useState(false);

  // Payment Gateway State
  const [activeGateway, setActiveGateway] = useState<string>('veopag');
  const [savingGateway, setSavingGateway] = useState(false);

  // Auto-Replenish State
  const [autoReplenishEnabled, setAutoReplenishEnabled] = useState<boolean>(true);
  const [autoReplenishMinActive, setAutoReplenishMinActive] = useState<string>('3');
  const [autoReplenishBatchSize, setAutoReplenishBatchSize] = useState<string>('3');
  const [autoReplenishInterval, setAutoReplenishInterval] = useState<string>('30');
  const [autoReplenishDurationMin, setAutoReplenishDurationMin] = useState<string>('1');
  const [autoReplenishDurationMax, setAutoReplenishDurationMax] = useState<string>('5');
  const [savingAutoReplenish, setSavingAutoReplenish] = useState(false);

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
      setWeeklyPaymentDay(getSettingValue('partner_weekly_payment_day', 5).toString());
      setDailyClosingTime(getSettingValue('partner_daily_closing_time', 18).toString());
      setMaxWeeklyPercentage(getSettingValue('partner_max_weekly_percentage', 10).toString());
      setMaxMonthlyPercentage(getSettingValue('partner_max_monthly_percentage', 20).toString());
      
      // Launch Banner
      setBannerEnabled(getSettingValue('launch_banner_enabled', true));
      setBannerTitle(getSettingValue('launch_banner_title', '🎉 LANÇAMENTO OFICIAL!'));
      setBannerSubtitle(getSettingValue('launch_banner_subtitle', 'A plataforma Show de Lances está no ar!'));
      setBannerHighlight(getSettingValue('launch_banner_highlight', 'Cada lance custa apenas R$ 1!'));
      setBannerCta1Text(getSettingValue('launch_banner_cta1_text', 'Ver Leilões'));
      setBannerCta1Link(getSettingValue('launch_banner_cta1_link', '/#leiloes'));
      setBannerCta2Text(getSettingValue('launch_banner_cta2_text', 'Comprar Lances'));
      setBannerCta2Link(getSettingValue('launch_banner_cta2_link', '/pacotes'));
      setBannerMobileCtaText(getSettingValue('launch_banner_mobile_cta_text', 'Participar'));
      const bannerExpires = getSettingValue('launch_banner_expires_at', '');
      if (bannerExpires) {
        const date = new Date(bannerExpires);
        if (!isNaN(date.getTime())) {
          setBannerExpiresAt(date.toISOString().slice(0, 16));
        }
      }
      
      // Contract Texts
      setContractBettorText(getSettingValue('contract_bettor_text', ''));
      setContractPartnerText(getSettingValue('contract_partner_text', ''));

      // Payment Gateway
      setActiveGateway(getSettingValue('active_payment_gateway', 'veopag'));

      // Auto-Replenish
      setAutoReplenishEnabled(getSettingValue('auto_replenish_enabled', true));
      setAutoReplenishMinActive(getSettingValue('auto_replenish_min_active', 3).toString());
      setAutoReplenishBatchSize(getSettingValue('auto_replenish_batch_size', 3).toString());
      setAutoReplenishInterval(getSettingValue('auto_replenish_interval_minutes', 30).toString());
      setAutoReplenishDurationMin(getSettingValue('auto_replenish_duration_min_hours', 1).toString());
      setAutoReplenishDurationMax(getSettingValue('auto_replenish_duration_max_hours', 5).toString());
      
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
        updateSetting('partner_weekly_payment_day', weeklyPaymentDay),
        updateSetting('partner_daily_closing_time', dailyClosingTime),
        updateSetting('partner_max_weekly_percentage', maxWeeklyPercentage),
        updateSetting('partner_max_monthly_percentage', maxMonthlyPercentage)
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

  const handleSaveBannerSettings = async () => {
    setSavingBanner(true);
    try {
      // Convert datetime-local to ISO string
      const expiresAtISO = bannerExpiresAt ? new Date(bannerExpiresAt).toISOString() : '';
      
      await Promise.all([
        updateSetting('launch_banner_enabled', bannerEnabled.toString()),
        updateSetting('launch_banner_title', bannerTitle),
        updateSetting('launch_banner_subtitle', bannerSubtitle),
        updateSetting('launch_banner_highlight', bannerHighlight),
        updateSetting('launch_banner_cta1_text', bannerCta1Text),
        updateSetting('launch_banner_cta1_link', bannerCta1Link),
        updateSetting('launch_banner_cta2_text', bannerCta2Text),
        updateSetting('launch_banner_cta2_link', bannerCta2Link),
        updateSetting('launch_banner_mobile_cta_text', bannerMobileCtaText),
        updateSetting('launch_banner_expires_at', expiresAtISO)
      ]);
      
      toast({
        title: "Banner salvo!",
        description: bannerEnabled ? "O banner de lançamento está ativo." : "Banner desativado.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações do banner.",
        variant: "destructive"
      });
    } finally {
      setSavingBanner(false);
    }
  };

  const handleSaveAutoReplenish = async () => {
    setSavingAutoReplenish(true);
    try {
      await Promise.all([
        updateSetting('auto_replenish_enabled', autoReplenishEnabled.toString()),
        updateSetting('auto_replenish_min_active', autoReplenishMinActive),
        updateSetting('auto_replenish_batch_size', autoReplenishBatchSize),
        updateSetting('auto_replenish_interval_minutes', autoReplenishInterval),
        updateSetting('auto_replenish_duration_min_hours', autoReplenishDurationMin),
        updateSetting('auto_replenish_duration_max_hours', autoReplenishDurationMax)
      ]);
      toast({
        title: "Configurações salvas!",
        description: autoReplenishEnabled ? "Reposição automática de leilões ativa." : "Reposição automática desativada.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive"
      });
    } finally {
      setSavingAutoReplenish(false);
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

  // Calculate time remaining for banner expiration
  const getBannerTimeRemaining = () => {
    if (!bannerExpiresAt) return null;
    const now = new Date().getTime();
    const expiry = new Date(bannerExpiresAt).getTime();
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

      {/* Gateway de Pagamento PIX */}
      <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-green-500/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-500" />
            <CardTitle className="text-emerald-600">Gateway de Pagamento PIX</CardTitle>
          </div>
          <CardDescription>
            Escolha qual provedor de pagamento PIX será usado para recebimentos. A troca é instantânea e afeta apenas novos pagamentos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Gateway Ativo</Label>
            <Select value={activeGateway} onValueChange={setActiveGateway}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o gateway" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="veopag">VeoPag</SelectItem>
                <SelectItem value="magenpay">MagenPay</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className={`p-3 rounded-lg text-sm ${activeGateway === 'veopag' ? 'bg-blue-500/10 text-blue-700 border border-blue-500/20' : 'bg-purple-500/10 text-purple-700 border border-purple-500/20'}`}>
            <strong>Ativo:</strong> {activeGateway === 'veopag' ? '🔵 VeoPag' : '🟣 MagenPay'} — Todos os novos pagamentos PIX serão processados por este provedor.
          </div>

          <Button
            onClick={async () => {
              setSavingGateway(true);
              try {
                await updateSetting('active_payment_gateway', activeGateway);
                toast({
                  title: "Gateway atualizado!",
                  description: `Pagamentos PIX agora usam ${activeGateway === 'veopag' ? 'VeoPag' : 'MagenPay'}.`,
                });
              } catch (error) {
                toast({
                  title: "Erro",
                  description: "Não foi possível salvar o gateway.",
                  variant: "destructive"
                });
              } finally {
                setSavingGateway(false);
              }
            }}
            disabled={savingGateway}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {savingGateway ? 'Salvando...' : 'Salvar Gateway'}
          </Button>
        </CardContent>
      </Card>

      {/* Contratos Legais */}
      <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-indigo-500/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-blue-600">Contratos Legais</CardTitle>
          </div>
          <CardDescription>
            Edite os textos dos contratos exibidos para apostadores e parceiros. Use quebras de linha para formatar o texto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="bettor" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="bettor">Apostador</TabsTrigger>
              <TabsTrigger value="partner">Parceiro</TabsTrigger>
            </TabsList>
            <TabsContent value="bettor" className="space-y-4">
              <div className="space-y-2">
                <Label>Texto do Contrato do Apostador</Label>
                <Textarea
                  value={contractBettorText}
                  onChange={(e) => setContractBettorText(e.target.value)}
                  className="min-h-[300px] font-mono text-xs"
                  placeholder="Digite o texto completo do contrato do apostador..."
                />
              </div>
            </TabsContent>
            <TabsContent value="partner" className="space-y-4">
              <div className="space-y-2">
                <Label>Texto do Contrato do Parceiro</Label>
                <Textarea
                  value={contractPartnerText}
                  onChange={(e) => setContractPartnerText(e.target.value)}
                  className="min-h-[300px] font-mono text-xs"
                  placeholder="Digite o texto completo do contrato do parceiro..."
                />
              </div>
            </TabsContent>
          </Tabs>
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-muted-foreground">
              💡 O texto será exibido exatamente como digitado, incluindo quebras de linha.
            </p>
            <Button
              onClick={async () => {
                setSavingContract(true);
                try {
                  await Promise.all([
                    updateSetting('contract_bettor_text', contractBettorText),
                    updateSetting('contract_partner_text', contractPartnerText),
                  ]);
                  toast({ title: "Contratos salvos!", description: "Os textos dos contratos foram atualizados." });
                } catch {
                  toast({ title: "Erro", description: "Não foi possível salvar os contratos.", variant: "destructive" });
                } finally {
                  setSavingContract(false);
                }
              }}
              disabled={savingContract}
              size="sm"
            >
              <Save className="h-4 w-4 mr-2" />
              {savingContract ? 'Salvando...' : 'Salvar Contratos'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Banner de Lançamento */}
      <Card className="border-pink-500/20 bg-gradient-to-br from-pink-500/5 to-purple-500/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-pink-500" />
            <CardTitle className="text-pink-600">Banner de Lançamento</CardTitle>
          </div>
          <CardDescription>
            Configure o banner promocional exibido no topo da página inicial
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="banner-enabled">Ativar banner de lançamento</Label>
              <p className="text-sm text-muted-foreground">
                O banner será exibido no topo da página inicial
              </p>
            </div>
            <Switch
              id="banner-enabled"
              checked={bannerEnabled}
              onCheckedChange={setBannerEnabled}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="banner-title">Título Principal</Label>
              <Input
                id="banner-title"
                value={bannerTitle}
                onChange={(e) => setBannerTitle(e.target.value)}
                placeholder="🎉 LANÇAMENTO OFICIAL!"
                disabled={!bannerEnabled}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="banner-subtitle">Subtítulo</Label>
              <Input
                id="banner-subtitle"
                value={bannerSubtitle}
                onChange={(e) => setBannerSubtitle(e.target.value)}
                placeholder="A plataforma Show de Lances está no ar!"
                disabled={!bannerEnabled}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="banner-highlight">Texto de Destaque (Desktop)</Label>
            <Input
              id="banner-highlight"
              value={bannerHighlight}
              onChange={(e) => setBannerHighlight(e.target.value)}
              placeholder="Cada lance custa apenas R$ 1!"
              disabled={!bannerEnabled}
            />
            <p className="text-xs text-muted-foreground">
              Exibido apenas em telas grandes
            </p>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
              <p className="text-sm font-medium">Botão Primário</p>
              <div className="space-y-2">
                <Label htmlFor="banner-cta1-text">Texto</Label>
                <Input
                  id="banner-cta1-text"
                  value={bannerCta1Text}
                  onChange={(e) => setBannerCta1Text(e.target.value)}
                  placeholder="Ver Leilões"
                  disabled={!bannerEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="banner-cta1-link">Link</Label>
                <Input
                  id="banner-cta1-link"
                  value={bannerCta1Link}
                  onChange={(e) => setBannerCta1Link(e.target.value)}
                  placeholder="/#leiloes"
                  disabled={!bannerEnabled}
                />
              </div>
            </div>

            <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
              <p className="text-sm font-medium">Botão Secundário</p>
              <div className="space-y-2">
                <Label htmlFor="banner-cta2-text">Texto</Label>
                <Input
                  id="banner-cta2-text"
                  value={bannerCta2Text}
                  onChange={(e) => setBannerCta2Text(e.target.value)}
                  placeholder="Comprar Lances"
                  disabled={!bannerEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="banner-cta2-link">Link</Label>
                <Input
                  id="banner-cta2-link"
                  value={bannerCta2Link}
                  onChange={(e) => setBannerCta2Link(e.target.value)}
                  placeholder="/pacotes"
                  disabled={!bannerEnabled}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="banner-mobile-cta">Texto do Botão Mobile</Label>
            <Input
              id="banner-mobile-cta"
              value={bannerMobileCtaText}
              onChange={(e) => setBannerMobileCtaText(e.target.value)}
              placeholder="Participar"
              className="max-w-xs"
              disabled={!bannerEnabled}
            />
            <p className="text-xs text-muted-foreground">
              Usa o mesmo link do botão primário
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="banner-expires">Expiração Automática</Label>
            <div className="flex items-center gap-3">
              <Input
                id="banner-expires"
                type="datetime-local"
                value={bannerExpiresAt}
                onChange={(e) => setBannerExpiresAt(e.target.value)}
                className="w-auto"
                disabled={!bannerEnabled}
              />
              {bannerExpiresAt && bannerEnabled && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{getBannerTimeRemaining()}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Deixe vazio para banner sem prazo definido
            </p>
          </div>

          {/* Preview */}
          {bannerEnabled && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">📣 Preview do Banner:</p>
                <div className="relative rounded-lg overflow-hidden shadow-md">
                  <div className="bg-gradient-to-r from-primary via-primary/80 to-accent p-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-xl flex-shrink-0">🎉</span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-bold text-sm whitespace-nowrap">
                            {bannerTitle || 'Título'}
                          </span>
                          <span className="text-white/90 text-sm">
                            {bannerSubtitle || 'Subtítulo'}
                          </span>
                          {bannerHighlight && (
                            <span className="hidden lg:flex items-center gap-1 text-white/80 text-xs">
                              <Sparkles className="h-3 w-3" />
                              {bannerHighlight}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {bannerCta1Text && (
                          <Button size="sm" variant="outline-hero" className="text-xs h-7 pointer-events-none">
                            <Rocket className="h-3 w-3 mr-1" />
                            {bannerCta1Text}
                          </Button>
                        )}
                        {bannerCta2Text && (
                          <Button size="sm" className="bg-white text-primary text-xs h-7 pointer-events-none">
                            {bannerCta2Text}
                          </Button>
                        )}
                        <div className="p-1 rounded-full bg-white/20">
                          <X className="h-3 w-3 text-white/80" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end pt-4">
            <Button 
              onClick={handleSaveBannerSettings}
              disabled={savingBanner || updating}
              className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
            >
              <Save className="h-4 w-4" />
              {savingBanner ? 'Salvando...' : 'Salvar Banner'}
            </Button>
          </div>
        </CardContent>
      </Card>

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

          <div className="space-y-3">
            <Label htmlFor="max-weekly-percentage">Limite Máximo Semanal (%)</Label>
            <div className="flex items-center gap-3">
              <Input
                id="max-weekly-percentage"
                type="number"
                min="1"
                max="100"
                value={maxWeeklyPercentage}
                onChange={(e) => setMaxWeeklyPercentage(e.target.value)}
                className="w-24"
                disabled={!partnerSystemEnabled}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Limite máximo de porcentagem que pode ser distribuída por semana na configuração de receita diária.
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label htmlFor="max-monthly-percentage">Limite Máximo Mensal (4 semanas) (%)</Label>
            <div className="flex items-center gap-3">
              <Input
                id="max-monthly-percentage"
                type="number"
                min="1"
                max="100"
                value={maxMonthlyPercentage}
                onChange={(e) => setMaxMonthlyPercentage(e.target.value)}
                className="w-24"
                disabled={!partnerSystemEnabled}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Limite máximo acumulado de porcentagem que pode ser distribuída em 4 semanas consecutivas.
            </p>
            <p className="text-xs text-amber-600">
              Nota: Este valor é independente do limite semanal ({maxWeeklyPercentage}% × 4 = {Number(maxWeeklyPercentage) * 4}%)
            </p>
          </div>

          <Separator />

          {/* Regras de Repasse Semanal */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-500" />
              <Label className="text-base font-medium">Regras de Repasse Semanal</Label>
            </div>
            
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20 space-y-3">
              <div className="space-y-2">
                <p className="text-sm font-medium text-purple-600">📅 Período da Semana</p>
                <p className="text-xs text-muted-foreground">
                  Cada semana é calculada de <strong>segunda-feira (00:00)</strong> até <strong>domingo (23:59)</strong>.
                </p>
              </div>
              
              <Separator className="bg-purple-500/20" />
              
              <div className="space-y-2">
                <p className="text-sm font-medium text-purple-600">📊 Pro Rata (Pagamento Proporcional)</p>
                <p className="text-xs text-muted-foreground">
                  Parceiros que se cadastrarem <strong>durante a semana</strong> recebem pagamento proporcional aos dias em que estiveram ativos.
                  Por exemplo: cadastro na quinta-feira = recebe quinta + sexta + sábado + domingo (4 de 7 dias).
                </p>
              </div>
              
              <Separator className="bg-purple-500/20" />
              
              <div className="space-y-2">
                <p className="text-sm font-medium text-purple-600">💰 Processamento</p>
                <p className="text-xs text-muted-foreground">
                  Os repasses são processados manualmente pelo administrador após o fim de cada semana.
                  Acesse a aba <strong>"Processar Semana"</strong> no Gerenciamento de Parceiros para processar.
                </p>
              </div>
              
              <Separator className="bg-purple-500/20" />
              
              <div className="space-y-2">
                <p className="text-sm font-medium text-purple-600">📆 Dia de Pagamento</p>
                <div className="flex items-center gap-3">
                  <Select 
                    value={weeklyPaymentDay} 
                    onValueChange={setWeeklyPaymentDay}
                    disabled={!partnerSystemEnabled}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Selecione o dia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Domingo</SelectItem>
                      <SelectItem value="1">Segunda-feira</SelectItem>
                      <SelectItem value="2">Terça-feira</SelectItem>
                      <SelectItem value="3">Quarta-feira</SelectItem>
                      <SelectItem value="4">Quinta-feira</SelectItem>
                      <SelectItem value="5">Sexta-feira</SelectItem>
                      <SelectItem value="6">Sábado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Define o dia da semana em que os pagamentos semanais devem ser processados.
                </p>
              </div>
              
              <Separator className="bg-purple-500/20" />
              
              <div className="space-y-2">
                <p className="text-sm font-medium text-purple-600">⏰ Horário de Fechamento do Dia</p>
                <div className="flex items-center gap-3">
                  <Select 
                    value={dailyClosingTime} 
                    onValueChange={setDailyClosingTime}
                    disabled={!partnerSystemEnabled}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {i.toString().padStart(2, '0')}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Os valores configurados do dia só ficam visíveis para o parceiro após este horário.
                  <br />
                  <span className="text-purple-600">Ex:</span> Se definido 18h, o valor de sábado só aparece após 18:00 de sábado.
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Dica:</strong> Acesse "Gerenciamento de Parceiros" para configurar planos, processar repasses semanais e ver relatórios detalhados.
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
            <div>
              <div className="font-medium">Banner Lançamento</div>
              <div className={bannerEnabled ? "text-pink-500 font-medium" : "text-muted-foreground"}>
                {bannerEnabled ? 'Ativo' : 'Inativo'}
              </div>
            </div>
            <div>
              <div className="font-medium">Auto-Reposição</div>
              <div className={autoReplenishEnabled ? "text-emerald-500 font-medium" : "text-muted-foreground"}>
                {autoReplenishEnabled ? 'Ativo' : 'Inativo'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reposição Automática de Leilões */}
      <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-teal-500/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-emerald-500" />
            <CardTitle className="text-emerald-600">Reposição Automática de Leilões</CardTitle>
          </div>
          <CardDescription>
            Cria leilões automaticamente a partir dos templates quando a quantidade de leilões ativos ficar abaixo do mínimo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="auto-replenish-enabled">Ativar reposição automática</Label>
              <p className="text-sm text-muted-foreground">
                A cada 5 minutos, o sistema verifica e cria leilões se necessário
              </p>
            </div>
            <Switch
              id="auto-replenish-enabled"
              checked={autoReplenishEnabled}
              onCheckedChange={setAutoReplenishEnabled}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="auto-replenish-min">Mínimo de leilões ativos</Label>
              <Input
                id="auto-replenish-min"
                type="number"
                min="1"
                max="20"
                value={autoReplenishMinActive}
                onChange={(e) => setAutoReplenishMinActive(e.target.value)}
                disabled={!autoReplenishEnabled}
              />
              <p className="text-xs text-muted-foreground">
                Novos leilões serão criados quando houver menos que este número
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="auto-replenish-batch">Tamanho do lote</Label>
              <Input
                id="auto-replenish-batch"
                type="number"
                min="1"
                max="10"
                value={autoReplenishBatchSize}
                onChange={(e) => setAutoReplenishBatchSize(e.target.value)}
                disabled={!autoReplenishEnabled}
              />
              <p className="text-xs text-muted-foreground">
                Máximo de leilões criados por execução
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="auto-replenish-interval">Intervalo entre leilões</Label>
              <Select
                value={autoReplenishInterval}
                onValueChange={setAutoReplenishInterval}
                disabled={!autoReplenishEnabled}
              >
                <SelectTrigger id="auto-replenish-interval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 minutos</SelectItem>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="120">2 horas</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Tempo entre o início de cada leilão criado
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="auto-replenish-duration-min">Duração mínima (horas)</Label>
              <Select
                value={autoReplenishDurationMin}
                onValueChange={setAutoReplenishDurationMin}
                disabled={!autoReplenishEnabled}
              >
                <SelectTrigger id="auto-replenish-duration-min">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hora</SelectItem>
                  <SelectItem value="2">2 horas</SelectItem>
                  <SelectItem value="3">3 horas</SelectItem>
                  <SelectItem value="4">4 horas</SelectItem>
                  <SelectItem value="6">6 horas</SelectItem>
                  <SelectItem value="12">12 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="auto-replenish-duration-max">Duração máxima (horas)</Label>
              <Select
                value={autoReplenishDurationMax}
                onValueChange={setAutoReplenishDurationMax}
                disabled={!autoReplenishEnabled}
              >
                <SelectTrigger id="auto-replenish-duration-max">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 horas</SelectItem>
                  <SelectItem value="3">3 horas</SelectItem>
                  <SelectItem value="4">4 horas</SelectItem>
                  <SelectItem value="5">5 horas</SelectItem>
                  <SelectItem value="6">6 horas</SelectItem>
                  <SelectItem value="8">8 horas</SelectItem>
                  <SelectItem value="12">12 horas</SelectItem>
                  <SelectItem value="24">24 horas</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Cada leilão terá uma duração aleatória entre o mínimo e o máximo
              </p>
              {Number(autoReplenishDurationMin) >= Number(autoReplenishDurationMax) && (
                <p className="text-xs text-destructive font-medium">
                  ⚠️ A duração mínima deve ser menor que a máxima
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveAutoReplenish} disabled={savingAutoReplenish || updating}>
              <Save className="h-4 w-4 mr-2" />
              {savingAutoReplenish ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
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
