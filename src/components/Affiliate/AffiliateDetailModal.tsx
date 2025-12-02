import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Mail, Calendar, CheckCircle, TrendingUp, DollarSign, Users, Target, Edit, Ban, Link as LinkIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface AffiliateDetails {
  id: string;
  name: string;
  email: string;
  code: string;
  status: string;
  commissionRate: number;
  pixKey: string;
  createdAt: string;
  approvedAt?: string;
  totalReferrals: number;
  totalConversions: number;
  totalEarned: number;
  totalPaid: number;
  balance: number;
  conversionRate: number;
  referrals: Array<{ id: string; name: string; converted: boolean; createdAt: string }>;
  commissions: Array<{ id: string; amount: number; status: string; createdAt: string; referredUser: string }>;
  withdrawals: Array<{ id: string; amount: number; status: string; createdAt: string; processedAt?: string }>;
}

interface AffiliateDetailModalProps {
  affiliate: AffiliateDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditRate: (affiliateId: string) => void;
  onSuspend: (affiliateId: string) => void;
}

export function AffiliateDetailModal({ affiliate, open, onOpenChange, onEditRate, onSuspend }: AffiliateDetailModalProps) {
  if (!affiliate) return null;

  const copyReferralLink = () => {
    const link = `${window.location.origin}/?ref=${affiliate.code}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado para a área de transferência!");
  };

  const copyCode = () => {
    navigator.clipboard.writeText(affiliate.code);
    toast.success("Código copiado!");
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span>👤 {affiliate.name}</span>
            <span className="text-muted-foreground text-sm">- {affiliate.code}</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="referrals">Indicados</TabsTrigger>
            <TabsTrigger value="commissions">Comissões</TabsTrigger>
            <TabsTrigger value="withdrawals">Saques</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <p className="text-2xl font-bold">{affiliate.totalReferrals}</p>
                  <p className="text-sm text-muted-foreground">Indicações</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <p className="text-2xl font-bold">{affiliate.totalConversions}</p>
                  <p className="text-sm text-muted-foreground">Conversões</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Target className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                  <p className="text-2xl font-bold">{affiliate.conversionRate.toFixed(1)}%</p>
                  <p className="text-sm text-muted-foreground">Taxa Conv.</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{affiliate.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">PIX: {affiliate.pixKey || "Não informado"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Afiliado desde: {formatDate(affiliate.createdAt)}</span>
                </div>
                {affiliate.approvedAt && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Aprovado em: {formatDate(affiliate.approvedAt)}</span>
                  </div>
                )}
                <div className="pt-2 border-t">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Ganho:</span>
                    <span className="font-semibold text-green-600">{formatPrice(affiliate.totalEarned)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Pago:</span>
                    <span className="font-semibold">{formatPrice(affiliate.totalPaid)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Saldo:</span>
                    <span className="font-semibold text-primary">{formatPrice(affiliate.balance)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button onClick={() => onEditRate(affiliate.id)} className="flex-1">
                <Edit className="h-4 w-4 mr-2" />
                Editar Taxa
              </Button>
              <Button onClick={() => onSuspend(affiliate.id)} variant="destructive" className="flex-1">
                <Ban className="h-4 w-4 mr-2" />
                Suspender
              </Button>
              <Button onClick={copyReferralLink} variant="outline" className="flex-1">
                <LinkIcon className="h-4 w-4 mr-2" />
                Ver Link
              </Button>
              <Button onClick={copyCode} variant="outline">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="referrals">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {affiliate.referrals.map((referral) => (
                  <TableRow key={referral.id}>
                    <TableCell>{referral.name}</TableCell>
                    <TableCell>
                      <Badge variant={referral.converted ? "default" : "secondary"}>
                        {referral.converted ? "Convertido" : "Clique"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(referral.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="commissions">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicado</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {affiliate.commissions.map((commission) => (
                  <TableRow key={commission.id}>
                    <TableCell>{commission.referredUser}</TableCell>
                    <TableCell className="font-semibold">{formatPrice(commission.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={commission.status === "approved" ? "default" : "secondary"}>
                        {commission.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(commission.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="withdrawals">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Solicitado</TableHead>
                  <TableHead>Processado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {affiliate.withdrawals.map((withdrawal) => (
                  <TableRow key={withdrawal.id}>
                    <TableCell className="font-semibold">{formatPrice(withdrawal.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={withdrawal.status === "completed" ? "default" : "secondary"}>
                        {withdrawal.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(withdrawal.createdAt)}</TableCell>
                    <TableCell>{withdrawal.processedAt ? formatDate(withdrawal.processedAt) : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="history">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Timeline de atividades em desenvolvimento...</p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
