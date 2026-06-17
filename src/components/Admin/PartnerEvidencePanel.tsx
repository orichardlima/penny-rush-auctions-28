import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ShieldCheck, AlertTriangle, FileText, Download, Copy, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  partnerContractId: string;
}

interface ReportData {
  gerado_em: string;
  parceiro: any;
  contrato: any;
  aceite_eletronico: any;
  pagamento_intent: any;
  financeiro: any;
  cancelamento_calculo: any;
}

const fmtBRL = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v ?? 0));
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }) : '—';

export const PartnerEvidencePanel: React.FC<Props> = ({ partnerContractId }) => {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ReportData | null>(null);
  const [contractOpen, setContractOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('generate_partner_evidence_report', {
      p_partner_contract_id: partnerContractId,
    });
    if (error) {
      toast.error('Erro ao carregar evidências: ' + error.message);
      setLoading(false);
      return;
    }
    setReport(data as unknown as ReportData);
    setLoading(false);
    await supabase.rpc('log_evidence_access', {
      p_acceptance_id: (data as any)?.aceite_eletronico?.id ?? null,
      p_partner_contract_id: partnerContractId,
      p_action: 'view',
      p_ip: null,
      p_user_agent: navigator.userAgent,
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerContractId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando evidências...
        </CardContent>
      </Card>
    );
  }
  if (!report) return null;

  const ae = report.aceite_eletronico;
  const c = report.contrato;
  const p = report.parceiro;
  const calc = report.cancelamento_calculo;
  const registrado = ae?.registrado === true;

  const copyLegal = async () => {
    const txt =
      `O parceiro ${p.nome ?? '—'}, CPF ${p.cpf ?? '—'}, aderiu eletronicamente ao Programa de Parceiros da Show de Lances ` +
      `em ${fmtDate(registrado ? ae.server_timestamp : c.data_adesao)}, mediante cadastro na plataforma e ` +
      `aceite eletrônico da versão ${registrado ? ae.versao : 'anterior ao módulo de evidências'} do Contrato ` +
      `de Adesão ao Programa de Parceiros. O aceite foi registrado pelo sistema com IP ${registrado ? ae.ip ?? '—' : '—'}, ` +
      `user agent ${registrado ? ae.user_agent ?? '—' : '—'}, plano contratado ${c.plano}, valor ${fmtBRL(c.aporte)}, ` +
      `ficando vinculado às regras contratuais vigentes na data da adesão.`;
    await navigator.clipboard.writeText(txt);
    toast.success('Resumo jurídico copiado.');
    await supabase.rpc('log_evidence_access', {
      p_acceptance_id: ae?.id ?? null, p_partner_contract_id: partnerContractId,
      p_action: 'copy_legal', p_ip: null, p_user_agent: navigator.userAgent,
    });
  };

  const exportFinancialCsv = async () => {
    const lines: string[] = [];
    lines.push('Categoria,Descricao,Valor,Status,Data');
    (report.financeiro.repasses ?? []).forEach((r: any) =>
      lines.push(`Repasse,Período ${r.period_start ?? ''} a ${r.period_end ?? ''},${r.amount},${r.status},${r.paid_at ?? r.created_at ?? ''}`));
    (report.financeiro.saques ?? []).forEach((r: any) =>
      lines.push(`Saque,Saque PIX,${r.amount},${r.status},${r.paid_at ?? r.requested_at ?? ''}`));
    (report.financeiro.bonus_indicacao ?? []).forEach((r: any) =>
      lines.push(`Bonus Indicacao,Nivel ${r.level ?? ''},${r.bonus_value},${r.status},${r.created_at}`));
    (report.financeiro.compras_lances ?? []).forEach((r: any) =>
      lines.push(`Compra Lances,${r.bids_purchased} lances,${r.amount_paid},${r.payment_status},${r.created_at}`));
    lines.push(`Lances Utilizados,Total,${report.financeiro.lances_utilizados?.total_lances ?? 0},,`);

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historico-financeiro-${p.nome ?? 'parceiro'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    await supabase.rpc('log_evidence_access', {
      p_acceptance_id: ae?.id ?? null, p_partner_contract_id: partnerContractId,
      p_action: 'export_financial', p_ip: null, p_user_agent: navigator.userAgent,
    });
  };

  const exportPdf = async () => {
    // PDF simples via window.print() em janela nova com HTML estruturado
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) {
      toast.error('Bloqueador de pop-ups impediu a exportação.');
      return;
    }
    const html = buildReportHtml(report);
    w.document.write(html);
    w.document.close();
    setTimeout(() => {
      try { w.focus(); w.print(); } catch {}
    }, 300);
    await supabase.rpc('log_evidence_access', {
      p_acceptance_id: ae?.id ?? null, p_partner_contract_id: partnerContractId,
      p_action: 'export_pdf', p_ip: null, p_user_agent: navigator.userAgent,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {registrado ? <ShieldCheck className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
          Evidências do Aceite Eletrônico
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!registrado && (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-200">
            <strong>Aceite eletrônico digital não registrado</strong> (contrato anterior ao módulo de evidências).
            Evidências indiretas disponíveis: cadastro confirmado, pagamento PIX confirmado, dados cadastrais
            autodeclarados.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Info label="Status" value={
            <Badge variant={registrado ? 'default' : 'secondary'} className={registrado ? 'bg-emerald-600' : ''}>
              {registrado ? 'Assinado eletronicamente' : 'Sem aceite digital'}
            </Badge>
          } />
          <Info label="Data/hora do aceite" value={fmtDate(registrado ? ae.server_timestamp : c.data_adesao)} />
          <Info label="Versão do contrato" value={registrado ? ae.versao : '—'} />
          <Info label="Hash do conteúdo" value={<code className="text-xs break-all">{registrado ? ae.hash : '—'}</code>} />
          <Info label="IP" value={registrado ? ae.ip ?? '—' : '—'} />
          <Info label="User agent" value={<span className="text-xs break-all">{registrado ? ae.user_agent ?? '—' : '—'}</span>} />
          <Info label="Navegador / SO / Dispositivo" value={registrado ? `${ae.browser ?? '—'} / ${ae.os ?? '—'} / ${ae.device ?? '—'}` : '—'} />
          <Info label="Rota" value={registrado ? ae.route ?? '—' : '—'} />
          <Info label="Nome" value={p.nome ?? '—'} />
          <Info label="CPF" value={p.cpf ?? '—'} />
          <Info label="E-mail" value={p.email ?? '—'} />
          <Info label="Telefone" value={p.telefone ?? '—'} />
          <Info label="Plano" value={c.plano} />
          <Info label="Valor contratado" value={fmtBRL(c.aporte)} />
          <Info label="Data da adesão" value={fmtDate(c.data_adesao)} />
          <Info label="Pagamento" value={`${c.payment_status ?? '—'} (${c.payment_id ?? 'sem id'})`} />
        </div>

        {registrado && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium mb-1">Declaração aceita pelo usuário:</p>
            <p className="text-muted-foreground italic">"{ae.declaracao}"</p>
          </div>
        )}

        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p className="font-medium mb-2">Cálculo de cancelamento antecipado</p>
          <div className="grid grid-cols-2 gap-2">
            <Info label="Dias desde adesão" value={String(calc.dias_decorridos)} />
            <Info label="Dentro garantia 7d?" value={calc.dentro_garantia_7d ? 'Sim' : 'Não'} />
            <Info label="Repasses recebidos" value={fmtBRL(calc.total_repasses)} />
            <Info label="Saques realizados" value={fmtBRL(calc.total_saques)} />
            <Info label="Bônus indicação" value={fmtBRL(calc.bonus_indicacao)} />
            <Info label="Bônus binário" value={fmtBRL(calc.bonus_binario)} />
            <Info label="Lances recebidos" value={String(calc.lances_recebidos)} />
            <Info label="Lances utilizados" value={String(calc.lances_utilizados)} />
            <Info label="Multa 30%" value={fmtBRL(calc.multa_30_pct)} />
            <Info label="Descontos" value={fmtBRL(calc.descontos)} />
            <Info label="Saldo a devolver" value={<strong>{fmtBRL(calc.saldo_final_a_devolver)}</strong>} />
            <Info label="Prazo (dias)" value={String(calc.prazo_pagamento_dias)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setContractOpen(true)} disabled={!registrado}>
            <FileText className="h-4 w-4 mr-2" /> Ver contrato aceito
          </Button>
          <Button onClick={exportPdf}>
            <Download className="h-4 w-4 mr-2" /> Exportar relatório em PDF
          </Button>
          <Button variant="outline" onClick={exportFinancialCsv}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Exportar histórico financeiro
          </Button>
          <Button variant="outline" onClick={copyLegal}>
            <Copy className="h-4 w-4 mr-2" /> Copiar resumo jurídico
          </Button>
        </div>

        <Dialog open={contractOpen} onOpenChange={setContractOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Contrato aceito — versão {ae?.versao ?? '—'}</DialogTitle>
            </DialogHeader>
            <div className="text-xs text-muted-foreground mb-2">
              Hash SHA-256: <code className="break-all">{ae?.hash}</code>
            </div>
            <ScrollArea className="h-[60vh] pr-4">
              <pre className="whitespace-pre-wrap text-sm">{ae?.conteudo_contrato ?? '—'}</pre>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

const Info: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="font-medium break-words">{value}</div>
  </div>
);

function buildReportHtml(r: ReportData): string {
  const p = r.parceiro;
  const c = r.contrato;
  const ae = r.aceite_eletronico;
  const calc = r.cancelamento_calculo;
  const esc = (s: any) => String(s ?? '—').replace(/[<>&]/g, (ch) => ({ '<':'&lt;','>':'&gt;','&':'&amp;' }[ch] as string));
  const row = (k: string, v: any) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`;
  return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<title>Relatório de Aceite Eletrônico</title>
<style>
 body{font-family:system-ui,sans-serif;max-width:900px;margin:24px auto;padding:0 16px;color:#111;line-height:1.5}
 h1{font-size:18px;text-align:center;margin-bottom:24px}
 h2{font-size:14px;border-bottom:1px solid #999;padding-bottom:4px;margin-top:24px}
 table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
 th,td{border:1px solid #ddd;padding:6px;text-align:left;vertical-align:top}
 th{background:#f4f4f4;width:35%}
 pre{white-space:pre-wrap;font-family:inherit;font-size:11px;border:1px solid #ddd;padding:8px;background:#fafafa}
 .small{font-size:10px;color:#666}
</style></head><body>
<h1>RELATÓRIO DE ACEITE ELETRÔNICO E HISTÓRICO CONTRATUAL DO PARCEIRO</h1>
<p class="small">Gerado em ${esc(new Date(r.gerado_em).toLocaleString('pt-BR'))}</p>
<h2>Dados do parceiro</h2>
<table>
${row('Nome', p.nome)}${row('CPF', p.cpf)}${row('E-mail', p.email)}${row('Telefone', p.telefone)}
${row('Data do cadastro', p.data_cadastro ? new Date(p.data_cadastro).toLocaleString('pt-BR') : '—')}
${row('Endereço', `${p.endereco?.rua ?? ''}, ${p.endereco?.numero ?? ''} ${p.endereco?.complemento ?? ''} - ${p.endereco?.bairro ?? ''}, ${p.endereco?.cidade ?? ''}/${p.endereco?.estado ?? ''} - CEP ${p.endereco?.cep ?? ''}`)}
</table>
<h2>Contrato</h2>
<table>
${row('Plano', c.plano)}${row('Aporte', fmtBRL(c.aporte))}${row('Teto semanal', fmtBRL(c.teto_semanal))}
${row('Teto total', fmtBRL(c.teto_total))}${row('Cotas', c.cotas)}
${row('Data da adesão', c.data_adesao ? new Date(c.data_adesao).toLocaleString('pt-BR') : '—')}
${row('Status', c.status)}${row('Status do pagamento', c.payment_status)}${row('ID do pagamento', c.payment_id)}
${row('Total recebido', fmtBRL(c.total_recebido))}
${c.closed_at ? row('Encerrado em', new Date(c.closed_at).toLocaleString('pt-BR')) : ''}
${c.closed_reason ? row('Motivo de encerramento', c.closed_reason) : ''}
</table>
<h2>Aceite eletrônico</h2>
${ae.registrado ? `<table>
${row('Status', 'Assinado eletronicamente')}
${row('Versão', ae.versao)}${row('Hash SHA-256', ae.hash)}
${row('Origem', ae.origem)}
${row('Carimbo de tempo do servidor', new Date(ae.server_timestamp).toLocaleString('pt-BR'))}
${row('Carimbo de tempo do cliente', ae.accepted_at_client ? new Date(ae.accepted_at_client).toLocaleString('pt-BR') : '—')}
${row('IP', ae.ip)}${row('User agent', ae.user_agent)}
${row('Navegador / SO / Dispositivo', `${ae.browser ?? '—'} / ${ae.os ?? '—'} / ${ae.device ?? '—'}`)}
${row('Rota', ae.route)}
${row('Declaração aceita', ae.declaracao)}
</table>
<h2>Texto integral do contrato aceito</h2>
<pre>${esc(ae.conteudo_contrato)}</pre>` : `<p><strong>${esc(ae.aviso)}</strong></p>`}
<h2>Histórico financeiro</h2>
<table>
${row('Total de repasses', fmtBRL(calc.total_repasses))}
${row('Total de saques', fmtBRL(calc.total_saques))}
${row('Bônus de indicação', fmtBRL(calc.bonus_indicacao))}
${row('Bônus binário', fmtBRL(calc.bonus_binario))}
${row('Lances recebidos', calc.lances_recebidos)}
${row('Lances utilizados', calc.lances_utilizados)}
</table>
<h2>Cálculo de cancelamento antecipado</h2>
<table>
${row('Dias desde a adesão', calc.dias_decorridos)}
${row('Dentro da garantia de 7 dias?', calc.dentro_garantia_7d ? 'Sim' : 'Não')}
${row('Multa de 30%', fmtBRL(calc.multa_30_pct))}
${row('Descontos', fmtBRL(calc.descontos))}
${row('Saldo final a devolver', fmtBRL(calc.saldo_final_a_devolver))}
${row('Prazo de pagamento (dias)', calc.prazo_pagamento_dias)}
${row('Regra aplicada', calc.devolucao_integral ? 'Devolução integral em até 10 dias (garantia de 7 dias).' : 'Multa de 30% + descontos. Pagamento em até 30 dias se houver saldo.')}
</table>
<p class="small">Documento gerado automaticamente pela plataforma Show de Lances. Os dados de aceite eletrônico são imutáveis no banco de dados e auditáveis.</p>
</body></html>`;
}
