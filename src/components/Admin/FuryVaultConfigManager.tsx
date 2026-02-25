import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Flame, Save, RefreshCw, Lock, Gift, Trophy, Clock, Wallet } from 'lucide-react';

interface VaultConfig {
  id: string;
  is_active: boolean;
  accumulation_type: string;
  accumulation_value: number;
  accumulation_interval: number;
  default_initial_value: number;
  max_cap_type: string;
  max_cap_value: number;
  max_cap_absolute: number;
  min_bids_to_qualify: number;
  recency_seconds: number;
  distribution_mode: string;
  hybrid_top_percentage: number;
  hybrid_raffle_percentage: number;
  fury_mode_enabled: boolean;
  fury_mode_seconds: number;
  fury_mode_multiplier: number;
  min_withdrawal_amount: number;
  max_monthly_withdrawal_pct: number;
  withdrawal_cooldown_days: number;
  processing_days: number;
  require_verified_account: boolean;
}

const defaultConfig: VaultConfig = {
  id: '',
  is_active: true,
  accumulation_type: 'fixed_per_x_bids',
  accumulation_value: 0.20,
  accumulation_interval: 20,
  default_initial_value: 0,
  max_cap_type: 'absolute',
  max_cap_value: 500,
  max_cap_absolute: 50,
  min_bids_to_qualify: 15,
  recency_seconds: 60,
  distribution_mode: 'hybrid',
  hybrid_top_percentage: 50,
  hybrid_raffle_percentage: 50,
  fury_mode_enabled: false,
  fury_mode_seconds: 120,
  fury_mode_multiplier: 2,
  min_withdrawal_amount: 100,
  max_monthly_withdrawal_pct: 50,
  withdrawal_cooldown_days: 30,
  processing_days: 3,
  require_verified_account: true,
};

export const FuryVaultConfigManager: React.FC = () => {
  const [config, setConfig] = useState<VaultConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fury_vault_config')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setConfig(data as unknown as VaultConfig);
      }
    } catch (error) {
      console.error('Error fetching vault config:', error);
      toast({ title: 'Erro', description: 'Erro ao carregar configurações do cofre.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validate hybrid percentages
      if (config.distribution_mode === 'hybrid') {
        const total = config.hybrid_top_percentage + config.hybrid_raffle_percentage;
        if (Math.abs(total - 100) > 0.01) {
          toast({ title: 'Erro', description: 'Os percentuais híbridos devem somar 100%.', variant: 'destructive' });
          setSaving(false);
          return;
        }
      }

      // Check for active auctions
      const { count: activeCount } = await supabase
        .from('fury_vault_instances')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'accumulating');

      if (activeCount && activeCount > 0) {
        const confirmed = window.confirm(
          `Existem ${activeCount} leilão(ões) com cofre ativo. Alterações só afetam leilões futuros. Deseja continuar?`
        );
        if (!confirmed) {
          setSaving(false);
          return;
        }
      }

      const { id, ...updateData } = config;
      const { error } = await supabase
        .from('fury_vault_config')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Salvo!', description: 'Configurações do Cofre Fúria atualizadas com sucesso.' });
    } catch (error) {
      console.error('Error saving vault config:', error);
      toast({ title: 'Erro', description: 'Erro ao salvar configurações.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof VaultConfig>(key: K, value: VaultConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
        <span className="text-muted-foreground">Carregando configurações do cofre...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-destructive" />
          <h2 className="text-xl font-semibold">Cofre Fúria</h2>
          <Badge variant={config.is_active ? 'default' : 'secondary'}>
            {config.is_active ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
      </div>

      {/* Toggle Global */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Cofre Fúria ativo globalmente</Label>
              <p className="text-sm text-muted-foreground">Quando desativado, novos leilões não terão cofre.</p>
            </div>
            <Switch checked={config.is_active} onCheckedChange={(v) => updateField('is_active', v)} />
          </div>
        </CardContent>
      </Card>

      {/* Acúmulo */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-accent" />
            <CardTitle className="text-base">Regras de Acúmulo</CardTitle>
          </div>
          <CardDescription>Como o cofre cresce a cada lance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de acúmulo</Label>
              <Select value={config.accumulation_type} onValueChange={(v) => updateField('accumulation_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed_per_x_bids">Valor fixo a cada X lances</SelectItem>
                  <SelectItem value="percentage">Percentual do custo do lance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{config.accumulation_type === 'percentage' ? 'Percentual (%)' : 'Valor por incremento (R$)'}</Label>
              <Input
                type="number"
                step="0.01"
                value={config.accumulation_value}
                onChange={(e) => updateField('accumulation_value', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Intervalo de lances</Label>
              <Input
                type="number"
                value={config.accumulation_interval}
                onChange={(e) => updateField('accumulation_interval', Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">A cada X lances o cofre incrementa</p>
            </div>
            <div className="space-y-2">
              <Label>Valor inicial padrão (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={config.default_initial_value}
                onChange={(e) => updateField('default_initial_value', Number(e.target.value))}
              />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de teto</Label>
              <Select value={config.max_cap_type} onValueChange={(v) => updateField('max_cap_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="absolute">Valor absoluto (R$)</SelectItem>
                  <SelectItem value="percentage_of_volume">% do volume de lances</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{config.max_cap_type === 'absolute' ? 'Teto máximo (R$)' : 'Teto máximo (%)'}</Label>
              <Input
                type="number"
                step="0.01"
                value={config.max_cap_value}
                onChange={(e) => updateField('max_cap_value', Number(e.target.value))}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Teto absoluto de segurança (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={config.max_cap_absolute}
              onChange={(e) => updateField('max_cap_absolute', Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              O sistema sempre aplica o menor entre o teto configurado e o teto absoluto. Alterações só afetam leilões futuros.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Qualificação */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <CardTitle className="text-base">Qualificação</CardTitle>
          </div>
          <CardDescription>Requisitos para o usuário concorrer ao prêmio</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mínimo de lances</Label>
              <Input
                type="number"
                value={config.min_bids_to_qualify}
                onChange={(e) => updateField('min_bids_to_qualify', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Recência (segundos)</Label>
              <Input
                type="number"
                value={config.recency_seconds}
                onChange={(e) => updateField('recency_seconds', Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Lance nos últimos X segundos antes do fim</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Distribuição */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Distribuição</CardTitle>
          </div>
          <CardDescription>Como o prêmio é dividido entre os vencedores</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Modo de distribuição</Label>
            <Select value={config.distribution_mode} onValueChange={(v) => updateField('distribution_mode', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="100_top">100% para o maior participante</SelectItem>
                <SelectItem value="100_raffle">100% por sorteio</SelectItem>
                <SelectItem value="hybrid">Híbrido (top + sorteio)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.distribution_mode === 'hybrid' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>% Top participante</Label>
                <Input
                  type="number"
                  value={config.hybrid_top_percentage}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    updateField('hybrid_top_percentage', val);
                    updateField('hybrid_raffle_percentage', 100 - val);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>% Sorteio</Label>
                <Input
                  type="number"
                  value={config.hybrid_raffle_percentage}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    updateField('hybrid_raffle_percentage', val);
                    updateField('hybrid_top_percentage', 100 - val);
                  }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modo Fúria */}
      <Card className={config.fury_mode_enabled ? 'border-destructive/30 bg-destructive/5' : ''}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-destructive" />
            <CardTitle className="text-base">Modo Fúria</CardTitle>
          </div>
          <CardDescription>Multiplicador de acúmulo nos segundos finais</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Ativar Modo Fúria</Label>
            <Switch checked={config.fury_mode_enabled} onCheckedChange={(v) => updateField('fury_mode_enabled', v)} />
          </div>
          {config.fury_mode_enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Últimos segundos</Label>
                <Input
                  type="number"
                  value={config.fury_mode_seconds}
                  onChange={(e) => updateField('fury_mode_seconds', Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Multiplicador</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={config.fury_mode_multiplier}
                  onChange={(e) => updateField('fury_mode_multiplier', Number(e.target.value))}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saque */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Regras de Saque</CardTitle>
          </div>
          <CardDescription>Limites e prazos para saque de prêmios do cofre</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Saque mínimo (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={config.min_withdrawal_amount}
                onChange={(e) => updateField('min_withdrawal_amount', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Máximo mensal (%)</Label>
              <Input
                type="number"
                value={config.max_monthly_withdrawal_pct}
                onChange={(e) => updateField('max_monthly_withdrawal_pct', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Cooldown entre saques (dias)</Label>
              <Input
                type="number"
                value={config.withdrawal_cooldown_days}
                onChange={(e) => updateField('withdrawal_cooldown_days', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Prazo de processamento (dias)</Label>
              <Input
                type="number"
                value={config.processing_days}
                onChange={(e) => updateField('processing_days', Number(e.target.value))}
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <div>
              <Label>Exigir conta verificada</Label>
              <p className="text-xs text-muted-foreground">Usuário precisa ter e-mail verificado para sacar</p>
            </div>
            <Switch checked={config.require_verified_account} onCheckedChange={(v) => updateField('require_verified_account', v)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
