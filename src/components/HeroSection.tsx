import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Briefcase, Shield, Clock, Award } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const HeroSection = () => {
  const { profile } = useAuth();
  const [hasPartnerContract, setHasPartnerContract] = useState(false);

  useEffect(() => {
    const checkPartnerContract = async () => {
      if (!profile?.user_id) {
        setHasPartnerContract(false);
        return;
      }

      const { data } = await supabase
        .from('partner_contracts')
        .select('id')
        .eq('user_id', profile.user_id)
        .in('status', ['ACTIVE', 'PENDING'])
        .maybeSingle();
      
      setHasPartnerContract(!!data);
    };

    checkPartnerContract();
  }, [profile?.user_id]);

  return (
    <section 
      className="py-10 sm:py-16 lg:py-20 bg-gradient-hero text-center relative overflow-hidden min-h-[70vh] sm:min-h-[80vh] flex items-center"
      aria-labelledby="hero-title"
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-black/10" aria-hidden="true"></div>
      <div className="absolute top-10 sm:top-20 left-5 sm:left-10 w-16 h-16 sm:w-20 sm:h-20 bg-primary/15 rounded-full blur-2xl" aria-hidden="true"></div>
      <div className="absolute bottom-10 sm:bottom-20 right-5 sm:right-10 w-24 h-24 sm:w-32 sm:h-32 bg-primary/20 rounded-full blur-2xl" aria-hidden="true"></div>
      {/* Transição suave para a seção clara abaixo */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-background" aria-hidden="true"></div>
      <div className="pointer-events-none absolute inset-x-0 bottom-16 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" aria-hidden="true"></div>
      
      <div className="container mx-auto px-4 sm:px-6 relative z-10 w-full">
        <div className="max-w-4xl mx-auto">
          <Badge className="mb-4 sm:mb-6 bg-background/10 text-white border border-primary/60 backdrop-blur-sm text-xs sm:text-sm shadow-[0_0_20px_hsl(var(--primary)/0.25)]">
            🔥 Leilões ao vivo agora!
          </Badge>
          
          <h1 
            id="hero-title"
            className="text-3xl sm:text-4xl lg:text-6xl font-bold mb-4 sm:mb-6 text-white leading-tight"
          >
            Ganhe Produtos Incríveis por
            <span
              className="block mt-1 sm:mt-2 bg-gradient-primary bg-clip-text text-transparent drop-shadow-[0_2px_18px_hsl(var(--primary-glow)/0.55)]"
            >
              Centavos!
            </span>
          </h1>
          
          <p className="text-base sm:text-xl lg:text-2xl text-white/90 mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed">
            Participe dos leilões mais emocionantes do Brasil. 
            Cada lance custa apenas R$ 1 e pode te dar produtos de até R$ 100.000!
          </p>

          {/* CTAs - Mobile optimized with full width */}
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 justify-center mb-8 sm:mb-12">
            <Link to="/leiloes" className="w-full sm:w-auto">
              <Button 
                size="xl" 
                className="w-full text-base sm:text-lg py-4 sm:py-3 bg-gradient-primary text-primary-foreground hover:opacity-95 shadow-glow font-semibold"
                aria-label="Ver todos os leilões ativos"
              >
                <TrendingUp className="w-5 h-5 sm:w-5 sm:h-5 mr-2" aria-hidden="true" />
                Ver Leilões Ativos
              </Button>
            </Link>
            <Link to={hasPartnerContract ? "/minha-parceria" : "/investir"} className="w-full sm:w-auto">
              <Button 
                size="xl" 
                variant="outline"
                className="w-full text-base sm:text-lg py-4 sm:py-3 bg-transparent border-2 border-white/40 text-white hover:bg-white/10 hover:text-white hover:border-primary"
                aria-label={hasPartnerContract ? "Acessar minha parceria" : "Conheça o programa de parceiros"}
              >
                <Briefcase className="w-5 h-5 sm:w-5 sm:h-5 mr-2" aria-hidden="true" />
                {hasPartnerContract ? "Minha Parceria" : "Seja um Parceiro"}
              </Button>
            </Link>
          </div>

          {/* Trust badges - Mobile horizontal scroll */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-6 sm:mb-10 px-2">
            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 text-white/90 text-xs sm:text-sm">
              <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
              <span>100% Seguro</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 text-white/90 text-xs sm:text-sm">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
              <span>Entrega Garantida</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 text-white/90 text-xs sm:text-sm">
              <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
              <span>Produtos Originais</span>
            </div>
          </div>

          {/* Stats - Mobile optimized 2x2 grid */}
          <div 
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mt-6 sm:mt-12"
            role="list"
            aria-label="Estatísticas da plataforma"
          >
            <div 
              className="bg-white/10 backdrop-blur-sm rounded-lg p-4 sm:p-6"
              role="listitem"
            >
              <div className="text-xl sm:text-2xl font-bold text-white mb-1">500K+</div>
              <div className="text-white/70 text-xs sm:text-sm">Usuários Ativos</div>
            </div>
            <div 
              className="bg-white/10 backdrop-blur-sm rounded-lg p-4 sm:p-6"
              role="listitem"
            >
              <div className="text-xl sm:text-2xl font-bold text-white mb-1">R$ 2Mi+</div>
              <div className="text-white/70 text-xs sm:text-sm">Em Prêmios</div>
            </div>
            <div 
              className="bg-white/10 backdrop-blur-sm rounded-lg p-4 sm:p-6"
              role="listitem"
            >
              <div className="text-xl sm:text-2xl font-bold text-white mb-1">15s</div>
              <div className="text-white/70 text-xs sm:text-sm">Por Leilão</div>
            </div>
            <div 
              className="bg-white/10 backdrop-blur-sm rounded-lg p-4 sm:p-6"
              role="listitem"
            >
              <div className="text-xl sm:text-2xl font-bold text-white mb-1">98%</div>
              <div className="text-white/70 text-xs sm:text-sm">Satisfação</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
