import { Card } from "@/components/ui/card";
import { Users, UserCheck, Clock, DollarSign, TrendingUp, Wallet, Target, Award } from "lucide-react";

interface AffiliateMetricsCardsProps {
  totalAffiliates: number;
  activeAffiliates: number;
  pendingAffiliates: number;
  pendingCommissionsValue: number;
  monthlyConversions: number;
  totalPaidCommissions: number;
  conversionRate: number;
  topAffiliateOfMonth: string;
}

export function AffiliateMetricsCards({
  totalAffiliates,
  activeAffiliates,
  pendingAffiliates,
  pendingCommissionsValue,
  monthlyConversions,
  totalPaidCommissions,
  conversionRate,
  topAffiliateOfMonth,
}: AffiliateMetricsCardsProps) {
  const metrics = [
    {
      icon: Users,
      label: "Total de Afiliados",
      value: totalAffiliates,
      subtitle: `${Math.round((activeAffiliates / Math.max(totalAffiliates, 1)) * 100)}% ativos`,
      color: "text-primary",
    },
    {
      icon: UserCheck,
      label: "Afiliados Ativos",
      value: activeAffiliates,
      subtitle: "Aprovados",
      color: "text-green-600",
    },
    {
      icon: Clock,
      label: "Pendentes de Aprovação",
      value: pendingAffiliates,
      subtitle: "Aguardando",
      color: "text-yellow-600",
    },
    {
      icon: DollarSign,
      label: "Comissões Pendentes",
      value: `R$ ${pendingCommissionsValue.toFixed(2)}`,
      subtitle: "A pagar",
      color: "text-orange-600",
    },
    {
      icon: TrendingUp,
      label: "Conversões do Mês",
      value: monthlyConversions,
      subtitle: "Este mês",
      color: "text-blue-600",
    },
    {
      icon: Wallet,
      label: "Total Pago",
      value: `R$ ${totalPaidCommissions.toFixed(2)}`,
      subtitle: "Em comissões",
      color: "text-purple-600",
    },
    {
      icon: Target,
      label: "Taxa de Conversão",
      value: `${conversionRate.toFixed(1)}%`,
      subtitle: "Geral",
      color: "text-cyan-600",
    },
    {
      icon: Award,
      label: "Top Afiliado",
      value: topAffiliateOfMonth || "N/A",
      subtitle: "Deste mês",
      color: "text-amber-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <Card key={index} className="p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <p className="text-2xl font-bold">{metric.value}</p>
                <p className="text-xs text-muted-foreground">{metric.subtitle}</p>
              </div>
              <Icon className={`h-8 w-8 ${metric.color}`} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
