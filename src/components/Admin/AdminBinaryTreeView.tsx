import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Users, GitBranch, AlertTriangle, ChevronRight, ChevronDown, TreePine, Link2, Calculator, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

interface BinaryPositionRecord {
  id: string;
  partner_contract_id: string;
  parent_contract_id: string | null;
  sponsor_contract_id: string | null;
  position: string | null;
  left_child_id: string | null;
  right_child_id: string | null;
  left_points: number;
  right_points: number;
  total_left_points: number;
  total_right_points: number;
  created_at: string;
}

interface EnrichedPosition extends BinaryPositionRecord {
  partnerName: string;
  partnerEmail: string;
  planName: string;
  contractStatus: string;
}

interface TreeNode extends EnrichedPosition {
  children: { left: TreeNode | null; right: TreeNode | null };
}

const formatPoints = (v: number) => v.toLocaleString('pt-BR');

export const AdminBinaryTreeView: React.FC = () => {
  const [positions, setPositions] = useState<EnrichedPosition[]>([]);
  const [loading, setLoading] = useState(true);

  // Link dialog state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedIsolated, setSelectedIsolated] = useState<EnrichedPosition | null>(null);
  const [selectedSponsorId, setSelectedSponsorId] = useState('');
  const [linking, setLinking] = useState(false);
  const [spilloverResult, setSpilloverResult] = useState<{ parentContractId: string; position: 'left' | 'right' } | null>(null);

  // Recalculate dialog state
  const [recalcDialogOpen, setRecalcDialogOpen] = useState(false);
  const [recalcTarget, setRecalcTarget] = useState<EnrichedPosition | null>(null);
  const [recalcPoints, setRecalcPoints] = useState<number>(0);
  const [recalculating, setRecalculating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: posData, error: posError } = await supabase
        .from('partner_binary_positions')
        .select('id, partner_contract_id, parent_contract_id, sponsor_contract_id, position, left_child_id, right_child_id, left_points, right_points, total_left_points, total_right_points, created_at');

      if (posError || !posData) {
        console.error('Error fetching positions:', posError);
        setPositions([]);
        setLoading(false);
        return;
      }

      const contractIds = posData.map(p => p.partner_contract_id);
      const { data: contracts } = await supabase
        .from('partner_contracts')
        .select('id, plan_name, user_id, status')
        .in('id', contractIds);

      const userIds = (contracts || []).map(c => c.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const contractMap = new Map((contracts || []).map(c => [c.id, c]));
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      const enriched: EnrichedPosition[] = posData.map(pos => {
        const contract = contractMap.get(pos.partner_contract_id);
        const profile = contract ? profileMap.get(contract.user_id) : null;
        return {
          ...pos,
          partnerName: profile?.full_name || 'Sem nome',
          partnerEmail: profile?.email || '',
          planName: contract?.plan_name || 'N/A',
          contractStatus: contract?.status || 'N/A',
        };
      });

      setPositions(enriched);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const posMap = new Map(positions.map(p => [p.partner_contract_id, p]));

  const connected: EnrichedPosition[] = [];
  const isolated: EnrichedPosition[] = [];

  positions.forEach(p => {
    const hasParent = !!p.parent_contract_id;
    const hasChildren = !!p.left_child_id || !!p.right_child_id;
    const hasSponsor = !!p.sponsor_contract_id;
    if (hasParent || hasChildren || hasSponsor) {
      connected.push(p);
    } else {
      isolated.push(p);
    }
  });

  const roots = positions.filter(p => !p.parent_contract_id && (!!p.left_child_id || !!p.right_child_id));

  const buildTree = (pos: EnrichedPosition): TreeNode => {
    const leftChild = pos.left_child_id ? posMap.get(pos.left_child_id) || null : null;
    const rightChild = pos.right_child_id ? posMap.get(pos.right_child_id) || null : null;
    return {
      ...pos,
      children: {
        left: leftChild ? buildTree(leftChild) : null,
        right: rightChild ? buildTree(rightChild) : null,
      },
    };
  };

  const trees = roots.map(r => buildTree(r));

  const totalLeftPts = positions.reduce((s, p) => s + p.left_points, 0);
  const totalRightPts = positions.reduce((s, p) => s + p.right_points, 0);

  // BFS spillover: find next available slot in sponsor's subtree
  const findNextAvailableSlot = useCallback((sponsorContractId: string): { parentContractId: string; position: 'left' | 'right' } | null => {
    const queue = [sponsorContractId];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const node = posMap.get(currentId);
      if (!node) continue;
      if (!node.left_child_id) return { parentContractId: currentId, position: 'left' };
      if (!node.right_child_id) return { parentContractId: currentId, position: 'right' };
      queue.push(node.left_child_id);
      queue.push(node.right_child_id);
    }
    return null;
  }, [posMap]);

  // When sponsor changes, compute spillover preview
  useEffect(() => {
    if (selectedSponsorId) {
      const result = findNextAvailableSlot(selectedSponsorId);
      setSpilloverResult(result);
    } else {
      setSpilloverResult(null);
    }
  }, [selectedSponsorId, findNextAvailableSlot]);

  const openLinkDialog = (pos: EnrichedPosition) => {
    setSelectedIsolated(pos);
    setSelectedSponsorId('');
    setSpilloverResult(null);
    setLinkDialogOpen(true);
  };

  const openRecalcDialog = async (pos: EnrichedPosition) => {
    setRecalcTarget(pos);
    setRecalcPoints(0);
    setRecalcDialogOpen(true);
    try {
      const { data: levelPoints } = await supabase
        .from('partner_level_points')
        .select('points')
        .eq('plan_name', pos.planName)
        .single();
      if (levelPoints) setRecalcPoints(levelPoints.points);
    } catch (err) {
      console.error('Error fetching points:', err);
    }
  };

  const handleRecalculate = async () => {
    if (!recalcTarget || recalcPoints <= 0) return;
    setRecalculating(true);
    try {
      const { error: rpcError } = await supabase.rpc('propagate_binary_points', {
        p_source_contract_id: recalcTarget.partner_contract_id,
        p_points: recalcPoints,
        p_reason: 'manual_recalc',
      });
      if (rpcError) throw rpcError;
      toast({ title: 'Pontos recalculados', description: `${recalcPoints} pontos de ${recalcTarget.partnerName} propagados com sucesso.` });
      setRecalcDialogOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('Recalc error:', err);
      toast({ title: 'Erro ao recalcular', description: err.message || 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setRecalculating(false);
    }
  };

  const handleLink = async () => {
    if (!selectedIsolated || !selectedSponsorId || !spilloverResult) return;
    setLinking(true);
    try {
      const childContractId = selectedIsolated.partner_contract_id;

      // 1. Update isolated partner
      const { error: err1 } = await supabase
        .from('partner_binary_positions')
        .update({
          parent_contract_id: spilloverResult.parentContractId,
          sponsor_contract_id: selectedSponsorId,
          position: spilloverResult.position,
        })
        .eq('partner_contract_id', childContractId);

      if (err1) throw err1;

      // 2. Update parent slot
      const updateField = spilloverResult.position === 'left' ? 'left_child_id' : 'right_child_id';
      const { error: err2 } = await supabase
        .from('partner_binary_positions')
        .update({ [updateField]: childContractId })
        .eq('partner_contract_id', spilloverResult.parentContractId);

      if (err2) throw err2;

      // 3. Propagar pontos para uplines
      let pointsPropagated = 0;
      try {
        const { data: contract } = await supabase
          .from('partner_contracts')
          .select('plan_name')
          .eq('id', childContractId)
          .single();

        if (contract?.plan_name) {
          const { data: levelPoints } = await supabase
            .from('partner_level_points')
            .select('points')
            .eq('plan_name', contract.plan_name)
            .single();

          if (levelPoints && levelPoints.points > 0) {
            const { data: propagated, error: rpcError } = await supabase.rpc('propagate_binary_points', {
              p_source_contract_id: childContractId,
              p_points: levelPoints.points,
              p_reason: 'admin_link',
            });
            if (rpcError) console.error('Propagation error:', rpcError);
            else pointsPropagated = levelPoints.points;
          }
        }
      } catch (propErr) {
        console.error('Point propagation error:', propErr);
      }

      const pointsMsg = pointsPropagated > 0 ? ` ${pointsPropagated} pontos propagados.` : ' (sem pontos configurados para propagar)';
      toast({ title: 'Vinculado com sucesso', description: `${selectedIsolated.partnerName} foi vinculado à árvore binária sob ${posMap.get(selectedSponsorId)?.partnerName || 'sponsor'}.${pointsMsg}` });
      setLinkDialogOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('Link error:', err);
      toast({ title: 'Erro ao vincular', description: err.message || 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setLinking(false);
    }
  };

  if (loading) {
    return <Card><CardContent className="py-8"><Skeleton className="h-48 w-full" /></CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={<Users className="w-5 h-5" />} value={positions.length} label="Total Posições" />
        <SummaryCard icon={<GitBranch className="w-5 h-5" />} value={connected.length} label="Conectados" />
        <SummaryCard icon={<AlertTriangle className="w-5 h-5 text-amber-500" />} value={isolated.length} label="Isolados" variant="warning" />
        <SummaryCard icon={<TreePine className="w-5 h-5" />} value={`${formatPoints(totalLeftPts)} / ${formatPoints(totalRightPts)}`} label="Pts Esq / Dir" />
      </div>

      {/* Tree visualization */}
      {trees.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Árvore Hierárquica</CardTitle>
              <CardDescription>Visualização a partir dos nós raiz</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="w-4 h-4 mr-2" />Atualizar</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {trees.map(tree => (
                <TreeNodeView key={tree.id} node={tree} depth={0} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Isolated nodes */}
      {isolated.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />Parceiros Isolados ({isolated.length})
            </CardTitle>
            <CardDescription>Sem parent, sponsor ou filhos na rede binária</CardDescription>
          </CardHeader>
          <CardContent>
            <IsolatedTable positions={isolated} posMap={posMap} onLink={openLinkDialog} />
          </CardContent>
        </Card>
      )}

      {/* Full table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Todos os Registros ({positions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <PositionsTable positions={positions} posMap={posMap} onRecalculate={openRecalcDialog} />
        </CardContent>
      </Card>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular Parceiro à Árvore</DialogTitle>
            <DialogDescription>
              Vincular <strong>{selectedIsolated?.partnerName}</strong> ({selectedIsolated?.planName}) a um sponsor. O posicionamento será automático (spillover).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Sponsor selection */}
            <div className="space-y-2">
              <Label>Sponsor (quem indicou)</Label>
              <Select value={selectedSponsorId} onValueChange={setSelectedSponsorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o sponsor..." />
                </SelectTrigger>
                <SelectContent>
                  {positions
                    .filter(p => p.partner_contract_id !== selectedIsolated?.partner_contract_id)
                    .map(p => (
                      <SelectItem key={p.partner_contract_id} value={p.partner_contract_id}>
                        {p.partnerName} ({p.planName})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Spillover preview */}
            {selectedSponsorId && spilloverResult && (
              <div className="rounded-md border p-3 bg-muted text-sm space-y-1">
                <p className="font-medium">Posicionamento automático:</p>
                <p>Será filho <strong>{spilloverResult.position === 'left' ? 'esquerdo' : 'direito'}</strong> de <strong>{posMap.get(spilloverResult.parentContractId)?.partnerName || 'N/A'}</strong></p>
              </div>
            )}

            {selectedSponsorId && !spilloverResult && (
              <p className="text-sm text-destructive">Nenhuma vaga disponível na subárvore deste sponsor.</p>
            )}

            <Button
              className="w-full"
              onClick={handleLink}
              disabled={!selectedSponsorId || !spilloverResult || linking}
            >
              {linking ? 'Vinculando...' : 'Confirmar Vinculação'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recalculate Dialog */}
      <Dialog open={recalcDialogOpen} onOpenChange={setRecalcDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recalcular Pontos</DialogTitle>
            <DialogDescription>
              Propagar pontos de <strong>{recalcTarget?.partnerName}</strong> ({recalcTarget?.planName}) para todos os uplines na árvore binária.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {recalcPoints > 0 ? (
              <div className="rounded-md border p-3 bg-muted text-sm space-y-1">
                <p><strong>{recalcPoints}</strong> pontos serão propagados para os uplines.</p>
                <p className="text-muted-foreground">Reason: manual_recalc</p>
              </div>
            ) : (
              <p className="text-sm text-destructive">Nenhum ponto configurado para o plano "{recalcTarget?.planName}" em partner_level_points.</p>
            )}
            <Button
              className="w-full"
              onClick={handleRecalculate}
              disabled={recalcPoints <= 0 || recalculating}
            >
              {recalculating ? 'Recalculando...' : 'Confirmar Recálculo'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ---- Sub-components ---- */

const SummaryCard: React.FC<{ icon: React.ReactNode; value: string | number; label: string; variant?: 'warning' }> = ({ icon, value, label, variant }) => (
  <div className={`bg-muted rounded-lg p-3 text-center ${variant === 'warning' ? 'border border-amber-500/50' : ''}`}>
    <div className="flex justify-center mb-1">{icon}</div>
    <p className="text-xl font-bold">{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);

const TreeNodeView: React.FC<{ node: TreeNode; depth: number }> = ({ node, depth }) => {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.left || node.children.right;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 24}px` }}>
        {hasChildren ? (
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
        ) : (
          <span className="inline-block w-6" />
        )}
        <Badge variant={node.contractStatus === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">
          {node.position?.toUpperCase() || 'RAIZ'}
        </Badge>
        <span className="font-medium text-sm">{node.partnerName}</span>
        <Badge variant="outline" className="text-xs ml-1">{node.planName}</Badge>
        <span className="text-xs text-muted-foreground ml-auto">E:{formatPoints(node.left_points)} D:{formatPoints(node.right_points)}</span>
      </div>
      {hasChildren && (
        <CollapsibleContent>
          {node.children.left && <TreeNodeView node={node.children.left} depth={depth + 1} />}
          {node.children.right && <TreeNodeView node={node.children.right} depth={depth + 1} />}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
};

const IsolatedTable: React.FC<{ positions: EnrichedPosition[]; posMap: Map<string, EnrichedPosition>; onLink: (pos: EnrichedPosition) => void }> = ({ positions, posMap, onLink }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const filtered = positions.filter(p => p.partnerName.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar parceiro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
      </div>
      <div className="max-h-96 overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Parceiro</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead className="text-center">Pts Esq</TableHead>
            <TableHead className="text-center">Pts Dir</TableHead>
            <TableHead className="text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map(p => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.partnerName}</TableCell>
              <TableCell><Badge variant="outline">{p.planName}</Badge></TableCell>
              <TableCell className="text-center">{formatPoints(p.left_points)}</TableCell>
              <TableCell className="text-center">{formatPoints(p.right_points)}</TableCell>
              <TableCell className="text-center">
                <Button variant="outline" size="sm" onClick={() => onLink(p)}>
                  <Link2 className="w-4 h-4 mr-1" />Vincular
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    </div>
  );
};

const PositionsTable: React.FC<{ positions: EnrichedPosition[]; posMap: Map<string, EnrichedPosition>; onRecalculate: (pos: EnrichedPosition) => void }> = ({ positions, posMap, onRecalculate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const getName = (contractId: string | null) => {
    if (!contractId) return '—';
    return posMap.get(contractId)?.partnerName || contractId.slice(0, 8);
  };
  const filtered = positions.filter(p => p.partnerName.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar parceiro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
      </div>
      <div className="max-h-96 overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Parceiro</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead>Posição</TableHead>
            <TableHead>Pai</TableHead>
            <TableHead>Sponsor</TableHead>
            <TableHead className="text-center">Pts Esq</TableHead>
            <TableHead className="text-center">Pts Dir</TableHead>
            <TableHead className="text-center">Filhos</TableHead>
            <TableHead className="text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map(p => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.partnerName}</TableCell>
              <TableCell><Badge variant="outline">{p.planName}</Badge></TableCell>
              <TableCell>{p.position?.toUpperCase() || '—'}</TableCell>
              <TableCell className="text-xs">{getName(p.parent_contract_id)}</TableCell>
              <TableCell className="text-xs">{getName(p.sponsor_contract_id)}</TableCell>
              <TableCell className="text-center">{formatPoints(p.left_points)}</TableCell>
              <TableCell className="text-center">{formatPoints(p.right_points)}</TableCell>
              <TableCell className="text-center">{(p.left_child_id ? 1 : 0) + (p.right_child_id ? 1 : 0)}</TableCell>
              <TableCell className="text-center">
                <Button variant="outline" size="sm" onClick={() => onRecalculate(p)}>
                  <Calculator className="w-4 h-4 mr-1" />Recalcular
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    </div>
  );
};

export default AdminBinaryTreeView;
