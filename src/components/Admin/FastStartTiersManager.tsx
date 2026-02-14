import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useFastStartTiers } from '@/hooks/useFastStartTiers';
import { Rocket, Plus, Trash2, Zap, Flame, Target } from 'lucide-react';

const tierIcons: Record<string, React.ReactNode> = {
  'Acelerador': <Zap className="h-4 w-4 text-yellow-500" />,
  'Turbo': <Flame className="h-4 w-4 text-orange-500" />,
  'Foguete': <Rocket className="h-4 w-4 text-red-500" />,
};

const FastStartTiersManager: React.FC = () => {
  const { tiers, loading, processing, updateTier, createTier, deleteTier } = useFastStartTiers();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTier, setNewTier] = useState({
    name: '',
    required_referrals: 3,
    extra_percentage: 2,
    is_active: true,
    sort_order: 0,
  });

  const handleCreate = async () => {
    if (!newTier.name) return;
    await createTier({ ...newTier, sort_order: tiers.length + 1 });
    setIsCreateOpen(false);
    setNewTier({ name: '', required_referrals: 3, extra_percentage: 2, is_active: true, sort_order: 0 });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Bônus de Início Rápido
            </CardTitle>
            <CardDescription>
              Faixas que aumentam o bônus de indicação nos primeiros 30 dias do contrato
            </CardDescription>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nova Faixa
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {tiers.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma faixa configurada</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Faixa</TableHead>
                <TableHead>Indicações Necessárias</TableHead>
                <TableHead>% Extra</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.map((tier) => (
                <TableRow key={tier.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      {tierIcons[tier.name] || <Target className="h-4 w-4" />}
                      {tier.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={tier.required_referrals}
                      onChange={(e) => updateTier(tier.id, { required_referrals: parseInt(e.target.value) || 0 })}
                      className="w-20"
                      min={1}
                      disabled={processing}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span>+</span>
                      <Input
                        type="number"
                        value={tier.extra_percentage}
                        onChange={(e) => updateTier(tier.id, { extra_percentage: parseFloat(e.target.value) || 0 })}
                        className="w-20"
                        min={0}
                        step={0.5}
                        disabled={processing}
                      />
                      <span>%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={tier.is_active}
                      onCheckedChange={(checked) => updateTier(tier.id, { is_active: checked })}
                      disabled={processing}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteTier(tier.id)}
                      disabled={processing}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <p><strong>Como funciona:</strong> Quando um parceiro atinge a quantidade de indicações diretas dentro dos primeiros 30 dias do contrato, todos os bônus de indicação de Nível 1 do período são recalculados retroativamente com o percentual extra.</p>
        </div>
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Faixa de Início Rápido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Faixa</Label>
              <Input
                value={newTier.name}
                onChange={(e) => setNewTier(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Acelerador"
              />
            </div>
            <div>
              <Label>Indicações Necessárias</Label>
              <Input
                type="number"
                value={newTier.required_referrals}
                onChange={(e) => setNewTier(prev => ({ ...prev, required_referrals: parseInt(e.target.value) || 0 }))}
                min={1}
              />
            </div>
            <div>
              <Label>Porcentagem Extra (%)</Label>
              <Input
                type="number"
                value={newTier.extra_percentage}
                onChange={(e) => setNewTier(prev => ({ ...prev, extra_percentage: parseFloat(e.target.value) || 0 }))}
                min={0}
                step={0.5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={processing || !newTier.name}>Criar Faixa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default FastStartTiersManager;
