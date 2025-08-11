import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Zap, Crown, Gift } from "lucide-react";

interface BidPackage {
  id: string;
  name: string;
  bids: number;
  price: number;
  originalPrice?: number;
  popular?: boolean;
  icon: React.ReactNode;
  features: string[];
}

interface BidPackagesProps {
  onPurchase: (packageId: string, bids: number) => void;
}

export const BidPackages = ({ onPurchase }: BidPackagesProps) => {
  const packages: BidPackage[] = [
    {
      id: "starter",
      name: "Iniciante",
      bids: 10,
      price: 15,
      originalPrice: 20,
      icon: <Star className="w-6 h-6" />,
      features: ["10 lances", "Válido por 30 dias", "Suporte básico"]
    },
    {
      id: "popular",
      name: "Popular",
      bids: 50,
      price: 60,
      originalPrice: 80,
      popular: true,
      icon: <Zap className="w-6 h-6" />,
      features: ["50 lances", "Válido por 60 dias", "Suporte prioritário", "+5 lances bônus"]
    },
    {
      id: "premium",
      name: "Premium",
      bids: 100,
      price: 110,
      originalPrice: 150,
      icon: <Crown className="w-6 h-6" />,
      features: ["100 lances", "Válido por 90 dias", "Suporte VIP", "+15 lances bônus", "Notificações exclusivas"]
    },
    {
      id: "mega",
      name: "Mega Pack",
      bids: 250,
      price: 250,
      originalPrice: 350,
      icon: <Gift className="w-6 h-6" />,
      features: ["250 lances", "Válido por 120 dias", "Suporte VIP", "+50 lances bônus", "Acesso antecipado", "Consultoria gratuita"]
    }
  ];

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(priceInCents / 100);
  };

  return (
    <section className="py-16 bg-muted/30" id="pacotes">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
            Escolha Seu Pacote de Lances
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Adquira seus lances e participe dos leilões mais emocionantes! 
            Quanto maior o pacote, maior a economia e os benefícios exclusivos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {packages.map((pkg) => (
            <Card 
              key={pkg.id} 
              className={`relative overflow-hidden transition-all duration-300 hover:shadow-elegant hover:-translate-y-1 ${
                pkg.popular ? 'ring-2 ring-primary shadow-glow' : ''
              }`}
            >
              {pkg.popular && (
                <div className="absolute top-0 left-0 right-0 bg-gradient-primary text-primary-foreground text-center py-2 text-sm font-semibold">
                  🔥 MAIS POPULAR
                </div>
              )}
              
              <div className={`p-6 ${pkg.popular ? 'pt-12' : ''}`}>
                <div className="text-center mb-6">
                  <div className={`inline-flex p-3 rounded-lg mb-4 ${
                    pkg.popular ? 'bg-gradient-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                  }`}>
                    {pkg.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-2">{pkg.name}</h3>
                  <div className="mb-2">
                    <span className="text-3xl font-bold text-primary">{formatPrice(pkg.price)}</span>
                    {pkg.originalPrice && (
                      <span className="text-lg text-muted-foreground line-through ml-2">
                        {formatPrice(pkg.originalPrice)}
                      </span>
                    )}
                  </div>
                  <Badge variant={pkg.popular ? "default" : "secondary"} className="text-xs">
                    {pkg.bids} lances inclusos
                  </Badge>
                </div>

                <ul className="space-y-2 mb-6">
                  {pkg.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm">
                      <div className="w-2 h-2 bg-accent rounded-full mr-3"></div>
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button 
                  onClick={() => onPurchase(pkg.id, pkg.bids)}
                  variant={pkg.popular ? "default" : "outline"}
                  size="lg"
                  className="w-full"
                >
                  Comprar Agora
                </Button>

                {pkg.originalPrice && (
                  <p className="text-center text-xs text-success mt-2">
                    Economize {formatPrice(pkg.originalPrice - pkg.price)}!
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};