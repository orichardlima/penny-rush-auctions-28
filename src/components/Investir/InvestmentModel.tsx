import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Cog, 
  DollarSign, 
  PieChart, 
  AlertCircle,
  ShoppingCart,
  Server,
  Megaphone,
  Truck,
  Wallet,
  Receipt,
  Package
} from "lucide-react";

export const InvestmentModel = () => {
  return (
    <section className="py-16 sm:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
            💎 Transparência Total
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-bold text-foreground mb-4">
            Entenda o Modelo de Parceria
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Saiba exatamente como seu aporte é utilizado e de onde vêm seus repasses
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Card 1: Uso do Aporte */}
          <Card className="relative overflow-hidden border-2 hover:border-primary/30 transition-colors">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary/50" />
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Cog className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  Uso do Aporte
                </h3>
              </div>
              
              <p className="text-muted-foreground mb-4">
                Seu aporte contribui para a <strong className="text-foreground">operação e crescimento</strong> da plataforma:
              </p>
              
              <ul className="space-y-3 mb-4">
                <li className="flex items-center gap-2 text-sm">
                  <Wallet className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Capital de giro</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <ShoppingCart className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Aquisição de produtos para leilões</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Truck className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Logística e infraestrutura</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Megaphone className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Marketing e aquisição de usuários</span>
                </li>
              </ul>

              <div className="bg-muted/50 rounded-lg p-3 border border-border">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    O aporte não fica segregado ou reservado individualmente
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Origem dos Repasses */}
          <Card className="relative overflow-hidden border-2 hover:border-green-500/30 transition-colors">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-green-500/50" />
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-green-500/10 rounded-xl">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  Origem dos Repasses
                </h3>
              </div>
              
              <p className="text-muted-foreground mb-4">
                Os repasses vêm do <strong className="text-foreground">faturamento real</strong> da plataforma:
              </p>
              
              <ul className="space-y-3 mb-4">
                <li className="flex items-center gap-2 text-sm">
                  <Receipt className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>Venda de pacotes de lances</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>Produtos arrematados em leilões</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Server className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>Serviços da plataforma</span>
                </li>
              </ul>

              <div className="bg-green-500/5 rounded-lg p-3 border border-green-500/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-green-700 dark:text-green-400">
                    <strong>Importante:</strong> Não vêm do seu aporte nem de outros parceiros
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Como é Distribuído */}
          <Card className="relative overflow-hidden border-2 hover:border-amber-500/30 transition-colors">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-amber-500/50" />
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-amber-500/10 rounded-xl">
                  <PieChart className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  Como é Distribuído
                </h3>
              </div>
              
              <p className="text-muted-foreground mb-4">
                Uma parcela do <strong className="text-foreground">faturamento semanal</strong> é separada:
              </p>
              
              <ol className="space-y-3 mb-4 list-decimal list-inside">
                <li className="text-sm">
                  <span>Pool proporcional ao faturamento</span>
                </li>
                <li className="text-sm">
                  <span>Distribuído entre parceiros ativos</span>
                </li>
                <li className="text-sm">
                  <span>Respeitando limites semanais e teto</span>
                </li>
              </ol>

              <div className="bg-amber-500/5 rounded-lg p-3 border border-amber-500/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Se o faturamento for menor, o repasse é proporcionalmente menor
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Disclaimer */}
        <div className="max-w-3xl mx-auto mt-8">
          <Alert className="bg-muted/50 border-border">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm leading-relaxed">
              <strong>Resumo:</strong> O aporte do parceiro contribui para a operação e crescimento da plataforma.
              Os repasses são realizados a partir de uma parcela do faturamento real, de forma proporcional, 
              limitada e não garantida, conforme o desempenho da plataforma.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </section>
  );
};
