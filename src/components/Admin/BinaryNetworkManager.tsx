import React, { useState, useEffect } from 'react';
import { useAdminBinaryCycle, BinaryCyclePreviewPartner } from '@/hooks/useAdminBinaryCycle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { GitBranch, Settings, History, Play, Users, TrendingUp, DollarSign, RefreshCw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatPrice = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (dateString: string) => format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });

export const BinaryNetworkManager: React.FC = () => {
  const { cycles, preview, settings, loading, closingCycle, loadingPreview, refresh, fetchPreview, closeCycle, updateSetting } = useAdminBinaryCycle();
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [cycleNotes, setCycleNotes] = useState('');
  const [localSettings, setLocalSettings] = useState({ bonusPercentage: 10, pointValue: 1, enabled: true });

  useEffect(() => {
    if (settings) {
      setLocalSettings({
        bonusPercentage: settings.binary_bonus_percentage,
        pointValue: settings.binary_point_value,
        enabled: settings.binary_system_enabled
      });
    }
  }, [settings]);

  const handleCloseCycle = async () => {
    const result = await closeCycle(cycleNotes || undefined);
    if (result.success) {
      setCloseDialogOpen(false);
      setCycleNotes('');
    }
  };

  const handleSaveSettings = async () => {
    await updateSetting('binary_bonus_percentage', localSettings.bonusPercentage);
    await updateSetting('binary_point_value', localSettings.pointValue);
    await updateSetting('binary_system_enabled', localSettings.enabled);
  };

  if (loading) {
    return <Card><CardContent className="py-8"><div className="flex justify-center"><Skeleton className="h-32 w-full" /></div></CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><GitBranch className="w-5 h-5" />Sistema Binário MLM</CardTitle>
              <CardDescription>Gerencie o sistema de compensação binária</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="w-4 h-4 mr-2" />Atualizar</Button>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="cycle">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="cycle"><Play className="w-4 h-4 mr-2" />Fechar Ciclo</TabsTrigger>
          <TabsTrigger value="history"><History className="w-4 h-4 mr-2" />Histórico</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-2" />Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="cycle" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fechamento de Ciclo</CardTitle>
              <CardDescription>Processe os bônus binários para todos os parceiros com pontos pareados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={fetchPreview} disabled={loadingPreview}>{loadingPreview ? 'Carregando...' : 'Gerar Preview do Ciclo'}</Button>
              
              {preview && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-muted rounded-lg p-3 text-center"><Users className="w-5 h-5 mx-auto mb-1" /><p className="text-2xl font-bold">{preview.partners_count}</p><p className="text-xs text-muted-foreground">Parceiros</p></div>
                    <div className="bg-muted rounded-lg p-3 text-center"><TrendingUp className="w-5 h-5 mx-auto mb-1" /><p className="text-2xl font-bold">{preview.total_points_matched}</p><p className="text-xs text-muted-foreground">Pontos Pareados</p></div>
                    <div className="bg-muted rounded-lg p-3 text-center"><DollarSign className="w-5 h-5 mx-auto mb-1" /><p className="text-2xl font-bold text-primary">{formatPrice(preview.total_bonus_to_distribute)}</p><p className="text-xs text-muted-foreground">Total a Distribuir</p></div>
                    <div className="bg-muted rounded-lg p-3 text-center"><Badge>{preview.bonus_percentage}%</Badge><p className="text-xs text-muted-foreground mt-2">Taxa do Bônus</p></div>
                  </div>

                  {preview.partners.length > 0 && (
                    <div className="max-h-64 overflow-y-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead>Parceiro</TableHead><TableHead>Plano</TableHead><TableHead className="text-center">Esq.</TableHead><TableHead className="text-center">Dir.</TableHead><TableHead className="text-center">Pareados</TableHead><TableHead className="text-right">Bônus</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {preview.partners.map((p: BinaryCyclePreviewPartner) => (
                            <TableRow key={p.partner_contract_id}>
                              <TableCell className="font-medium">{p.partner_name}</TableCell>
                              <TableCell><Badge variant="outline">{p.plan_name}</Badge></TableCell>
                              <TableCell className="text-center">{p.left_points}→{p.left_remaining}</TableCell>
                              <TableCell className="text-center">{p.right_points}→{p.right_remaining}</TableCell>
                              <TableCell className="text-center">{p.matched_points}</TableCell>
                              <TableCell className="text-right text-primary font-medium">{formatPrice(p.bonus_value)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <Button className="w-full" size="lg" onClick={() => setCloseDialogOpen(true)} disabled={preview.partners_count === 0}>
                    <Play className="w-4 h-4 mr-2" />Executar Fechamento de Ciclo
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader><CardTitle>Histórico de Ciclos</CardTitle></CardHeader>
            <CardContent>
              {cycles.length === 0 ? <p className="text-center text-muted-foreground py-8">Nenhum ciclo fechado ainda.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Ciclo</TableHead><TableHead>Data</TableHead><TableHead>Admin</TableHead><TableHead className="text-center">Parceiros</TableHead><TableHead className="text-center">Pontos</TableHead><TableHead className="text-right">Total Distribuído</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {cycles.map(c => (
                      <TableRow key={c.id}>
                        <TableCell><Badge>#{c.cycle_number}</Badge></TableCell>
                        <TableCell>{formatDate(c.created_at)}</TableCell>
                        <TableCell>{c.admin_name}</TableCell>
                        <TableCell className="text-center">{c.partners_count}</TableCell>
                        <TableCell className="text-center">{c.total_points_matched}</TableCell>
                        <TableCell className="text-right font-medium text-primary">{formatPrice(c.total_bonus_distributed)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader><CardTitle>Configurações do Binário</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div><Label>Sistema Habilitado</Label><p className="text-sm text-muted-foreground">Ativar/desativar o sistema binário</p></div>
                <Switch checked={localSettings.enabled} onCheckedChange={(v) => setLocalSettings(p => ({ ...p, enabled: v }))} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>% do Bônus</Label><Input type="number" value={localSettings.bonusPercentage} onChange={(e) => setLocalSettings(p => ({ ...p, bonusPercentage: Number(e.target.value) }))} /></div>
                <div><Label>Valor por Ponto (R$)</Label><Input type="number" step="0.01" value={localSettings.pointValue} onChange={(e) => setLocalSettings(p => ({ ...p, pointValue: Number(e.target.value) }))} /></div>
              </div>
              <Button onClick={handleSaveSettings}>Salvar Configurações</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" />Confirmar Fechamento de Ciclo</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá processar {preview?.partners_count || 0} parceiros e distribuir {formatPrice(preview?.total_bonus_to_distribute || 0)} em bônus. Os pontos pareados serão consumidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4"><Label>Notas (opcional)</Label><Textarea value={cycleNotes} onChange={(e) => setCycleNotes(e.target.value)} placeholder="Observações sobre este fechamento..." /></div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closingCycle}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseCycle} disabled={closingCycle}>{closingCycle ? 'Processando...' : 'Confirmar Fechamento'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BinaryNetworkManager;
