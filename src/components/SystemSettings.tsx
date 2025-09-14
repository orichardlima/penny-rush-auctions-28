import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Gift, Settings, Save, Trash2, AlertTriangle } from "lucide-react";
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const SystemSettings: React.FC = () => {
  const { settings, loading, updating, updateSetting, getSettingValue } = useSystemSettings();
  const { toast } = useToast();
  
  const [signupBonusEnabled, setSignupBonusEnabled] = useState<boolean>(false);
  const [signupBonusBids, setSignupBonusBids] = useState<string>('5');
  const [isResetting, setIsResetting] = useState(false);

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

  const handleResetFinancialData = async () => {
    setIsResetting(true);
    try {
      // 1. Resetar dados dos leilões (manter leilões, mas zerar dados financeiros)
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

      // 2. Deletar todos os lances
      const { error: bidsError } = await supabase
        .from('bids')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Deletar todos

      if (bidsError) throw bidsError;

      // 3. Deletar todas as compras de pacotes
      const { error: purchasesError } = await supabase
        .from('bid_purchases')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Deletar todos

      if (purchasesError) throw purchasesError;

      // 4. Resetar saldo de lances dos usuários (opcional - manter comentado se não quiser resetar)
      // const { error: profilesError } = await supabase
      //   .from('profiles')
      //   .update({ bids_balance: 0 })
      //   .neq('user_id', '00000000-0000-0000-0000-000000000000');

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
                          <li>• Todos os {loading ? '...' : 'X'} lances existentes</li>
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