import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, User, Calendar } from "lucide-react";

export const RecentWinners = () => {
  const winners = [
    {
      id: 1,
      name: "Maria S. - Campinas, SP",
      product: "iPhone 15 Pro Max",
      originalPrice: 8999,
      finalPrice: 23.45,
      savings: 8975.55,
      date: "Há 2 horas",
      avatar: "MS"
    },
    {
      id: 2,
      name: "João P. - Ribeirão Preto, SP",
      product: "MacBook Air M2",
      originalPrice: 12999,
      finalPrice: 156.78,
      savings: 12842.22,
      date: "Há 5 horas",
      avatar: "JP"
    },
    {
      id: 3,
      name: "Ana L. - Caxias do Sul, RS",
      product: "Samsung Galaxy S24",
      originalPrice: 5499,
      finalPrice: 89.23,
      savings: 5409.77,
      date: "Há 8 horas",
      avatar: "AL"
    },
    {
      id: 4,
      name: "Carlos M. - Feira de Santana, BA",
      product: "PlayStation 5",
      originalPrice: 4199,
      finalPrice: 67.89,
      savings: 4131.11,
      date: "Há 12 horas",
      avatar: "CM"
    },
    {
      id: 5,
      name: "Fernanda R. - Londrina, PR",
      product: "Smart TV 55'' 4K",
      originalPrice: 3299,
      finalPrice: 45.67,
      savings: 3253.33,
      date: "Há 1 dia",
      avatar: "FR"
    },
    {
      id: 6,
      name: "Ricardo T. - Joinville, SC",
      product: "Apple Watch Ultra",
      originalPrice: 7999,
      finalPrice: 123.45,
      savings: 7875.55,
      date: "Há 1 dia",
      avatar: "RT"
    }
  ];

  const formatPrice = (priceInReais: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(priceInReais || 0);
  };

  return (
    <section className="py-16 bg-muted/30" id="vencedores">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
            Vencedores Recentes
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Veja quem está ganhando produtos incríveis por preços surreais! 
            Você pode ser o próximo da lista.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {winners.map((winner) => (
            <Card key={winner.id} className="p-6 hover:shadow-elegant transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm">
                    {winner.avatar}
                  </div>
                  <div>
                    <h3 className="font-semibold">{winner.name}</h3>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3 mr-1" />
                      {winner.date}
                    </div>
                  </div>
                </div>
                <Trophy className="w-5 h-5 text-accent" />
              </div>

              <div className="mb-4">
                <h4 className="font-medium text-foreground mb-2">{winner.product}</h4>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Preço original:</span>
                  <span className="line-through text-muted-foreground">{formatPrice(winner.originalPrice)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Preço final:</span>
                  <span className="text-primary font-semibold">{formatPrice(winner.finalPrice)}</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Economia:</span>
                  <Badge variant="default" className="bg-success text-success-foreground">
                    {formatPrice(winner.savings)}
                  </Badge>
                </div>
                <div className="mt-2 bg-gradient-accent h-2 rounded-full">
                  <div 
                    className="bg-success h-full rounded-full transition-all duration-1000"
                    style={{ 
                      width: `${Math.min((winner.savings / winner.originalPrice) * 100, 100)}%` 
                    }}
                  ></div>
                </div>
                <p className="text-xs text-center text-muted-foreground mt-1">
                  {((winner.savings / winner.originalPrice) * 100).toFixed(1)}% de economia!
                </p>
              </div>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <div className="bg-gradient-primary text-primary-foreground rounded-lg p-6 max-w-md mx-auto">
            <Trophy className="w-8 h-8 mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-2">Seja Você o Próximo!</h3>
            <p className="text-sm opacity-90">
              Milhares de pessoas já economizaram mais de R$ 2 milhões em produtos. 
              Sua vez chegou!
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};