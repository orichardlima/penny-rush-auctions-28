import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, RefreshCw, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

interface OrphanRow {
  partner_contract_id: string;
  partner_name: string;
  plan_name: string;
  leg: 'left' | 'right';
  orphan_points: number;
}

export const OrphanBinaryPointsPanel: React.FC = () => {
  const [rows, setRows] = useState<OrphanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<OrphanRow | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('find_orphan_binary_points');
    if (error) {
      toast.error('Erro ao carregar órfãos: ' + error.message);
    } else {
      setRows((data || []) as OrphanRow[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleReverse = async () => {
    if (!target) return;
    if (note.trim().length < 10) {
      toast.error('Informe um motivo com pelo menos 10 caracteres.');
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc('reverse_orphan_binary_points', {
      p_contract_id: target.partner_contract_id,
      p_leg: target.leg,
      p_reason_note: note.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast.error('Falha no estorno: ' + error.message);
      return;
    }
    const result = data as { reversed_amount?: number } | null;
    toast.success(`Estorno realizado: ${result?.reversed_amount ?? 0} pts.`);
    setTarget(null);
    setNote('');
    load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Pontos Binários Órfãos
              </CardTitle>
              <CardDescription>
                Lados sem filho cadastrado mas com pontos acumulados (resíduo histórico de remanejamentos).
                O estorno preserva o histórico — insere lançamento negativo em <code>binary_points_log</code> e registra em <code>admin_audit_log</code>.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-2" />Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum ponto órfão detectado na rede.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parceiro</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead className="text-center">Lado</TableHead>
                    <TableHead className="text-right">Pontos órfãos</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={`${r.partner_contract_id}-${r.leg}`}>
                      <TableCell className="font-medium">{r.partner_name}</TableCell>
                      <TableCell><Badge variant="outline">{r.plan_name}</Badge></TableCell>
                      <TableCell className="text-center">
                        <Badge variant={r.leg === 'left' ? 'secondary' : 'default'}>
                          {r.leg === 'left' ? 'Lado A (esq.)' : 'Lado B (dir.)'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{r.orphan_points.toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="destructive" onClick={() => { setTarget(r); setNote(''); }}>
                          <Undo2 className="w-4 h-4 mr-1" />Estornar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!target} onOpenChange={(o) => { if (!o) { setTarget(null); setNote(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirmar estorno de pontos órfãos
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Parceiro: <b>{target?.partner_name}</b> ({target?.plan_name})
                </p>
                <p>
                  Lado: <b>{target?.leg === 'left' ? 'A (esquerda)' : 'B (direita)'}</b> — Pontos a estornar:{' '}
                  <b className="font-mono">{target?.orphan_points?.toLocaleString('pt-BR')}</b>
                </p>
                <p className="text-xs text-muted-foreground">
                  Esta ação insere um lançamento negativo (preserva o histórico) e registra em log de auditoria com o motivo abaixo.
                  Só é aplicável a lados sem filho cadastrado.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-2">
            <Label htmlFor="orphan-reason">Motivo (mínimo 10 caracteres) *</Label>
            <Textarea
              id="orphan-reason"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: Estorno de pontos órfãos remanescentes após remanejamento do contrato XYZ para o subtree direito em DD/MM/AAAA."
              rows={4}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReverse} disabled={submitting || note.trim().length < 10}>
              {submitting ? 'Estornando...' : 'Confirmar estorno'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrphanBinaryPointsPanel;
