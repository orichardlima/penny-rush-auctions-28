import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Gift, Settings, Save } from "lucide-react";
import { useSystemSettings } from '@/hooks/useSystemSettings';

export const SystemSettings: React.FC = () => {
  const { settings, loading, updating, updateSetting, getSettingValue } = useSystemSettings();
  
  const [signupBonusEnabled, setSignupBonusEnabled] = useState<boolean>(false);
  const [signupBonusBids, setSignupBonusBids] = useState<string>('5');

  React.useEffect(() => {
    if (settings.length > 0) {
      setSignupBonusEnabled(getSettingValue('signup_bonus_enabled', false));
      setSignupBonusBids(getSettingValue('signup_bonus_bids', 5).toString());
    }
  }, [settings, getSettingValue]);

  const handleSaveSignupBonus = async () => {
    await Promise.all([
      updateSetting('signup_bonus_enabled', signupBonusEnabled.toString()),
      updateSetting('signup_bonus_bids', signupBonusBids)
    ]);
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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Estatísticas do Bônus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium">Status atual</div>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
};