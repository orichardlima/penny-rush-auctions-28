import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Zap, Crown, Diamond, AlertCircle, Sparkles, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { calculateBidBreakdown, generateCompleteFeatures } from "@/utils/bidCalculations";
import { usePromotion } from "@/hooks/usePromotion";

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
  onPurchase: (packageId: string, bids: number, price: number, packageName: string) => void;
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
  const { promoData } = usePromotion();

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

  const formatPrice = (priceInReais: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(priceInReais || 0);
  };

  // Calculate promoted bids based on promo mode
  const getPromotedBids = (packagePrice: number, bidsCount: number) => {
    if (!promoData?.isValid) return bidsCount;
    
    const baseBids = Math.floor(packagePrice);
    const multiplier = promoData.multiplier;
    const mode = promoData.mode || 'base';
    
    switch (mode) {
      case 'base':
        // Multiplica apenas o preço base
        return Math.floor(baseBids * multiplier);
      
      case 'total':
        // Multiplica o total do pacote
        return Math.floor(bidsCount * multiplier);
      
      case 'bonus':
        // Total + (base × (multiplicador - 1))
        const bonusBids = Math.floor(baseBids * (multiplier - 1));
        return bidsCount + bonusBids;
      
      default:
        return Math.floor(baseBids * multiplier);
    }
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
        {/* Promotional Banner */}
        {promoData?.isValid && (
          <div className="mb-8 p-6 rounded-xl bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-white text-center shadow-lg animate-pulse-slow relative overflow-hidden">
            {/* Background sparkles effect */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-2 left-10 w-2 h-2 bg-white rounded-full animate-ping"></div>
              <div className="absolute top-4 right-20 w-1 h-1 bg-white rounded-full animate-ping delay-100"></div>
              <div className="absolute bottom-3 left-1/4 w-1.5 h-1.5 bg-white rounded-full animate-ping delay-200"></div>
              <div className="absolute bottom-2 right-1/3 w-2 h-2 bg-white rounded-full animate-ping delay-300"></div>
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-3 mb-2">
                <Sparkles className="h-8 w-8 animate-bounce" />
                <h3 className="text-2xl md:text-3xl font-black tracking-wide">
                  {promoData.label}
                </h3>
                <Sparkles className="h-8 w-8 animate-bounce" />
              </div>
              <p className="text-sm md:text-base opacity-90 mb-3">
                Compre agora e receba <span className="font-bold text-lg">{promoData.multiplier}x</span> mais lances!
              </p>
              {promoData.timeRemaining && (
                <div className="inline-flex items-center gap-2 bg-black/20 px-4 py-2 rounded-full text-sm font-medium">
                  <Clock className="h-4 w-4" />
                  <span>Termina em: {promoData.timeRemaining.formatted}</span>
                </div>
              )}
            </div>
          </div>
        )}

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
          {packages.map((pkg) => {
            const promotedBids = getPromotedBids(pkg.price, pkg.bids_count);
            const hasPromo = promoData?.isValid && promotedBids > pkg.bids_count;
            
            return (
              <Card 
                key={pkg.id} 
                className={`relative overflow-hidden transition-all duration-300 hover:shadow-elegant hover:-translate-y-1 ${
                  pkg.is_popular ? 'ring-2 ring-primary shadow-glow' : ''
                } ${hasPromo ? 'ring-2 ring-orange-500' : ''}`}
              >
                {/* Promo multiplier badge */}
                {hasPromo && (
                  <div className="absolute -top-1 -right-1 z-20">
                    <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-bl-lg rounded-tr-md shadow-lg animate-bounce">
                      {promoData?.multiplier}X
                    </div>
                  </div>
                )}

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
                    
                    {/* Bids display with promotion */}
                    {hasPromo ? (
                      <div className="space-y-1">
                        <Badge className="text-xs bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0">
                          🔥 {pkg.bids_count} → {promotedBids} lances!
                        </Badge>
                        <p className="text-xs text-orange-600 font-medium">
                          +{promotedBids - pkg.bids_count} lances GRÁTIS!
                        </p>
                      </div>
                    ) : (
                      <Badge variant={pkg.is_popular ? "default" : "secondary"} className="text-xs">
                        {(() => {
                          const calc = calculateBidBreakdown(pkg.price, pkg.bids_count);
                          return `${calc.totalBids} lances (${calc.baseBids} base + ${calc.bonusBids} bônus)`;
                        })()}
                      </Badge>
                    )}
                  </div>

                  <ul className="space-y-2 mb-6">
                    {generateCompleteFeatures(pkg.price, pkg.bids_count, pkg.features).map((feature, index) => (
                      <li key={index} className="flex items-center text-sm">
                        <div className="w-2 h-2 bg-accent rounded-full mr-3"></div>
                        {feature}
                      </li>
                    ))}
                    {hasPromo && (
                      <li className="flex items-center text-sm text-orange-600 font-medium">
                        <Sparkles className="w-4 h-4 mr-2" />
                        {promoData?.multiplier}x mais lances na promoção!
                      </li>
                    )}
                  </ul>

                  <Button 
                    onClick={() => onPurchase(pkg.id, promotedBids, pkg.price, pkg.name)}
                    variant={pkg.is_popular ? "default" : "outline"}
                    size="lg"
                    className={`w-full ${hasPromo ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white border-0' : ''}`}
                  >
                    {hasPromo ? '🔥 Comprar com Bônus!' : 'Comprar Agora'}
                  </Button>

                  {pkg.original_price && !hasPromo && (
                    <p className="text-center text-xs text-success mt-2">
                      Economize {formatPrice(pkg.original_price - pkg.price)}!
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
