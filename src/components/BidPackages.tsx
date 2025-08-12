import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Zap, Crown, Diamond, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BidPackage {
  id: string;
  name: string;
  bids_count: number;
  price: number;
  original_price?: number;
  is_popular?: boolean;
  icon: string;
  features: string[];
}

interface BidPackagesProps {
  onPurchase: (packageId: string, bids: number, price: number) => void;
}

const getIcon = (iconName: string) => {
  const icons = {
    Star: <Star className="w-6 h-6" />,
    Zap: <Zap className="w-6 h-6" />,
    Crown: <Crown className="w-6 h-6" />,
    Diamond: <Diamond className="w-6 h-6" />
  };
  return icons[iconName as keyof typeof icons] || <Star className="w-6 h-6" />;
};

export const BidPackages = ({ onPurchase }: BidPackagesProps) => {
  const [packages, setPackages] = useState<BidPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('bid_packages')
        .select('*')
        .order('price', { ascending: true });

      if (error) throw error;
      setPackages(data || []);
    } catch (err) {
      console.error('Error fetching packages:', err);
      setError('Erro ao carregar pacotes');
      toast({
        title: "Erro",
        description: "Não foi possível carregar os pacotes de lances.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(priceInCents / 100);
  };

  if (loading) {
    return (
      <section className="py-16 bg-muted/30" id="pacotes">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando pacotes...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-16 bg-muted/30" id="pacotes">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive">Erro ao carregar pacotes de lances</p>
            <Button 
              variant="outline" 
              onClick={fetchPackages}
              className="mt-4"
            >
              Tentar Novamente
            </Button>
          </div>
        </div>
      </section>
    );
  }

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
                pkg.is_popular ? 'ring-2 ring-primary shadow-glow' : ''
              }`}
            >
              {pkg.is_popular && (
                <div className="absolute top-0 left-0 right-0 bg-gradient-primary text-primary-foreground text-center py-2 text-sm font-semibold">
                  🔥 MAIS POPULAR
                </div>
              )}
              
              <div className={`p-6 ${pkg.is_popular ? 'pt-12' : ''}`}>
                <div className="text-center mb-6">
                  <div className={`inline-flex p-3 rounded-lg mb-4 ${
                    pkg.is_popular ? 'bg-gradient-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                  }`}>
                    {getIcon(pkg.icon)}
                  </div>
                  <h3 className="text-xl font-bold mb-2">{pkg.name}</h3>
                  <div className="mb-2">
                    <span className="text-3xl font-bold text-primary">{formatPrice(pkg.price)}</span>
                    {pkg.original_price && (
                      <span className="text-lg text-muted-foreground line-through ml-2">
                        {formatPrice(pkg.original_price)}
                      </span>
                    )}
                  </div>
                  <Badge variant={pkg.is_popular ? "default" : "secondary"} className="text-xs">
                    {pkg.bids_count} lances inclusos
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
                  onClick={() => onPurchase(pkg.id, pkg.bids_count, pkg.price)}
                  variant={pkg.is_popular ? "default" : "outline"}
                  size="lg"
                  className="w-full"
                >
                  Comprar Agora
                </Button>

                {pkg.original_price && (
                  <p className="text-center text-xs text-success mt-2">
                    Economize {formatPrice(pkg.original_price - pkg.price)}!
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