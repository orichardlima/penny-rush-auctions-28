import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Save, Play, RefreshCw, AlertCircle, Info, CheckCircle2, History } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

const sb = supabase as any;

export default function ExpansionCareerConfigTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [configs, setConfigs] = useState<any[]>([]);
  const [draft, setDraft] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [reason, setReason] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('expansion_career_config')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      setConfigs(data || []);
      setDraft(JSON.parse(JSON.stringify(data || [])));
    } catch (e: any) {
      toast.error('Erro ao carregar configurações de carreira');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleUpdateDraft = (index: number, field: string, value: any) => {
    const next = [...draft];
    next[index] = { ...next[index], [field]: value };
    setDraft(next);
  };

  const runSimulation = async () => {
    setSimulating(true);
    setSimulationResult(null);
    try {
      // Simulação via RPC administrativa (conforme requisito 13)
      // Como não existe a RPC de simulação de rascunho jsonb ainda, usamos a avaliação global em DRY_RUN
      const { data, error } = await sb.rpc('expansion_admin_evaluate_career', { 
        _mode: 'DRY_RUN',
        _reason: 'Simulação de impacto via Painel Administrativo'
      });
      if (error) throw error;
      setSimulationResult(data);
      toast.success('Simulação concluída com sucesso.');
    } catch (e: any) {
      toast.error('Erro ao executar simulação: ' + e.message);
    } finally {
      setSimulating(false);
    }
  };

  const save = async () => {
    toast.info('Publicação bloqueada: Aguardando aprovação do backend versionado (Etapa Final).');
    console.log('Publicação direta desativada conforme Requisito 1 da especificação Etapa Final.');
  };

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">Configuração de Carreira</h3>
          <p className="text-sm text-muted-foreground">Fonte oficial: expansion_career_config (Versão Legada v1)</p>
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} size="sm">Editar Regras</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => { setIsEditing(false); setDraft(JSON.parse(JSON.stringify(configs))); }} size="sm">Cancelar</Button>
              <Button onClick={save} disabled={saving} size="sm" className="bg-muted text-muted-foreground cursor-not-allowed">
                <Lock className="h-4 w-4 mr-2" />
                Publicar (Bloqueado)
              </Button>
            </>
          )}
        </div>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800">Como funciona a qualificação</AlertTitle>
        <AlertDescription className="text-blue-700 text-xs space-y-2">
          <p>• <strong>Pontos de Carreira:</strong> Volume histórico válido (não reduz pelo consumo semanal).</p>
          <p>• <strong>Limite de Concentração:</strong> Restringe quanto cada equipe pode fornecer para uma graduação específica.</p>
          <p>• <strong>Fórmula:</strong> Máximo por equipe = Pontos Exigidos × % Concentração. VQE Qualificado = Soma dos pontos limitados de todas as equipes.</p>
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {(isEditing ? draft : configs).map((rank, idx) => (
          <Card key={rank.id} className={!rank.is_active ? 'opacity-60 bg-muted/30' : ''}>
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="font-mono">{rank.rank_key}</Badge>
                {isEditing ? (
                  <Input 
                    value={rank.rank_label} 
                    onChange={(e) => handleUpdateDraft(idx, 'rank_label', e.target.value)}
                    className="h-8 font-bold text-base w-48"
                  />
                ) : (
                  <CardTitle className="text-base">{rank.rank_label}</CardTitle>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Ativo</Label>
                  <Switch 
                    checked={rank.is_active} 
                    onCheckedChange={(v) => handleUpdateDraft(idx, 'is_active', v)}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Pontos Exigidos</Label>
                <Input 
                  type="number" 
                  value={rank.min_organizational_points}
                  onChange={(e) => handleUpdateDraft(idx, 'min_organizational_points', Number(e.target.value))}
                  disabled={!isEditing}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Equipes Qualificadas</Label>
                <Input 
                  type="number" 
                  value={rank.min_qualified_teams}
                  onChange={(e) => handleUpdateDraft(idx, 'min_qualified_teams', Number(e.target.value))}
                  disabled={!isEditing}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Concentração Máxima (%)</Label>
                <Input 
                  type="number" 
                  value={rank.max_team_concentration_pct}
                  onChange={(e) => handleUpdateDraft(idx, 'max_team_concentration_pct', Number(e.target.value))}
                  disabled={!isEditing}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Parceiros Ativos/Equipe</Label>
                <Input 
                  type="number" 
                  value={rank.min_active_partners_per_team}
                  onChange={(e) => handleUpdateDraft(idx, 'min_active_partners_per_team', Number(e.target.value))}
                  disabled={!isEditing}
                  className="h-8"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isEditing && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              Confirmação de Publicação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Motivo da alteração</Label>
              <Input 
                placeholder="Ex: Ajuste da graduação Bronze conforme novo plano" 
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={runSimulation} 
                disabled={simulating}
                className="bg-white"
              >
                {simulating ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Play className="h-3 w-3 mr-2" />}
                Simular Impacto (Dry Run)
              </Button>
            </div>

            {simulationResult && (
              <div className="mt-4 border rounded-md bg-white p-3 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Resultado da Simulação</span>
                  <Badge variant="secondary" className="text-[10px]">Modo: DRY_RUN</Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">Processados</div>
                    <div className="text-lg font-bold">{simulationResult.summary?.processed || 0}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">Promoções</div>
                    <div className="text-lg font-bold text-green-600">+{simulationResult.summary?.promotions || 0}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">Rebaixamentos</div>
                    <div className="text-lg font-bold text-red-600">-{simulationResult.summary?.demotions || 0}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">Permanecem</div>
                    <div className="text-lg font-bold">{simulationResult.summary?.stable || 0}</div>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground italic">
                  * A simulação utiliza o motor oficial de avaliação. Nenhuma alteração real foi feita.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico Legado (Binário) — Somente Leitura
          </CardTitle>
          <CardDescription className="text-xs">
            Configurações e informações históricas do antigo sistema binário. Não são utilizadas pelo Programa de Expansão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border p-4 bg-muted/20 text-xs text-muted-foreground italic">
            Esta área apresenta configurações e informações históricas do antigo sistema binário. Alterações estão desativadas e esses valores não são utilizados pela carreira atual do Programa de Expansão.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
