import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";

interface TopAffiliate {
  id: string;
  name: string;
  code: string;
  conversions: number;
  totalEarned: number;
  conversionRate: number;
}

interface AffiliateTopRankingProps {
  topAffiliates: TopAffiliate[];
}

export function AffiliateTopRanking({ topAffiliates }: AffiliateTopRankingProps) {
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-600" />
          Top 10 Afiliados do Mês
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {topAffiliates.slice(0, 10).map((affiliate, index) => (
            <div key={affiliate.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="text-2xl">{index < 3 ? medals[index] : `#${index + 1}`}</div>
              
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {affiliate.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{affiliate.name}</p>
                <p className="text-sm text-muted-foreground">{affiliate.code}</p>
              </div>

              <div className="text-right space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {affiliate.conversions} conversões
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-primary">
                  R$ {affiliate.totalEarned.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {affiliate.conversionRate.toFixed(1)}% taxa
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
