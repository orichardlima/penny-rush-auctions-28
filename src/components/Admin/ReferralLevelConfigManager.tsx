import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useReferralLevelConfig } from '@/hooks/useReferralLevelConfig';
import { 
  GitBranch,
  Save,
  Info,
  AlertTriangle
} from 'lucide-react';

const ReferralLevelConfigManager: React.FC = () => {
  const { 
    levels, 
    loading, 
    updating,
    updatePercentage,
    toggleLevel,
    getLevelLabel,
    getLevelDescription
  } = useReferralLevelConfig();

  const [editingPercentages, setEditingPercentages] = useState<Record<string, string>>({});

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleSavePercentage = async (levelId: string) => {
    const newPercentage = parseFloat(editingPercentages[levelId]);
    if (isNaN(newPercentage)) return;
    
    const result = await updatePercentage(levelId, newPercentage);
    if (result.success) {
      setEditingPercentages(prev => {
        const copy = { ...prev };
        delete copy[levelId];
        return copy;
      });
    }
  };

  const handleToggle = async (levelId: string, currentActive: boolean) => {
    await toggleLevel(levelId, !currentActive);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Configuração de Níveis de Indicação
          </CardTitle>
          <CardDescription>
            Configure as porcentagens de bônus para cada nível da rede de indicação
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Explicação do sistema */}
          <div className="bg-muted/50 p-4 rounded-lg mb-6">
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-2">Como funciona o sistema multinível?</p>
                <p className="text-muted-foreground">
                  Quando um novo parceiro entra através de um código de indicação, os bônus são distribuídos 
                  automaticamente para até 3 níveis acima:
                </p>
                <ul className="list-disc list-inside mt-2 text-muted-foreground space-y-1">
                  <li><strong>Nível 1 (Direto):</strong> Usa a porcentagem definida no plano do indicador</li>
                  <li><strong>Nível 2:</strong> Quem indicou o indicador direto</li>
                  <li><strong>Nível 3:</strong> Quem indicou o nível 2</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Tabela de configuração */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nível</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Porcentagem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {levels.map((level) => {
                const isEditing = editingPercentages[level.id] !== undefined;
                const isLevel1 = level.level === 1;

                return (
                  <TableRow key={level.id}>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={
                          level.level === 1 
                            ? 'border-primary text-primary' 
                            : level.level === 2 
                              ? 'border-blue-500 text-blue-600'
                              : 'border-purple-500 text-purple-600'
                        }
                      >
                        {getLevelLabel(level.level)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs">
                      {getLevelDescription(level.level)}
                    </TableCell>
                    <TableCell>
                      {isLevel1 ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">% do Plano</Badge>
                          <span className="text-xs text-muted-foreground">(Configurado no plano)</span>
                        </div>
                      ) : isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={editingPercentages[level.id]}
                            onChange={(e) => setEditingPercentages(prev => ({
                              ...prev,
                              [level.id]: e.target.value
                            }))}
                            className="w-20"
                          />
                          <span>%</span>
                        </div>
                      ) : (
                        <div 
                          className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded"
                          onClick={() => setEditingPercentages(prev => ({
                            ...prev,
                            [level.id]: level.percentage.toString()
                          }))}
                        >
                          <span className="font-bold text-lg">{level.percentage}%</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {isLevel1 ? (
                        <Badge variant="secondary">Sempre ativo</Badge>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={level.is_active}
                            onCheckedChange={() => handleToggle(level.id, level.is_active)}
                            disabled={updating}
                          />
                          <Label className="text-sm">
                            {level.is_active ? 'Ativo' : 'Inativo'}
                          </Label>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {!isLevel1 && isEditing && (
                        <Button
                          size="sm"
                          onClick={() => handleSavePercentage(level.id)}
                          disabled={updating}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Salvar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Exemplo Visual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Exemplo de Distribuição</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gradient-to-r from-primary/5 to-purple-500/5 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-4">
              Se um novo parceiro entra com um plano de <strong>R$ 5.000</strong>:
            </p>
            <div className="space-y-3">
              {levels.map((level) => {
                const baseValue = 5000;
                const percentage = level.level === 1 ? 10 : level.percentage; // Assume 10% para nível 1
                const bonusValue = baseValue * (percentage / 100);
                
                if (!level.is_active && level.level !== 1) return null;

                return (
                  <div 
                    key={level.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      level.level === 1 
                        ? 'bg-primary/10 border-primary/20' 
                        : level.level === 2 
                          ? 'bg-blue-500/10 border-blue-500/20'
                          : 'bg-purple-500/10 border-purple-500/20'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge 
                        className={
                          level.level === 1 
                            ? 'bg-primary text-primary-foreground' 
                            : level.level === 2 
                              ? 'bg-blue-500 text-white'
                              : 'bg-purple-500 text-white'
                        }
                      >
                        Nível {level.level}
                      </Badge>
                      <span className="text-sm">
                        {level.level === 1 ? 'Indicador direto' : level.level === 2 ? '"Avô" do indicado' : '"Bisavô" do indicado'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-muted-foreground">{percentage}% → </span>
                      <span className="font-bold">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(bonusValue)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aviso importante */}
      <div className="flex items-start gap-2 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
        <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-yellow-700">Importante</p>
          <p className="text-muted-foreground">
            Alterações nas porcentagens afetam apenas novos bônus. Bônus já criados mantêm suas porcentagens originais.
            Se desativar um nível, novos bônus não serão criados para ele.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReferralLevelConfigManager;
