import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Clock, Shield, Briefcase } from "lucide-react";
import { Link } from "react-router-dom";
export const HeroSection = () => {
  return <section className="py-12 sm:py-16 lg:py-20 bg-gradient-hero text-center relative overflow-hidden min-h-[80vh] flex items-center">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-black/10"></div>
      <div className="absolute top-10 sm:top-20 left-5 sm:left-10 w-16 h-16 sm:w-20 sm:h-20 bg-white/10 rounded-full blur-xl"></div>
      <div className="absolute bottom-10 sm:bottom-20 right-5 sm:right-10 w-24 h-24 sm:w-32 sm:h-32 bg-accent/20 rounded-full blur-xl"></div>
      
      <div className="container mx-auto px-4 sm:px-6 relative z-10 w-full">
        <div className="max-w-4xl mx-auto">
          <Badge className="mb-4 sm:mb-6 bg-background/20 text-foreground border-white/20 text-xs sm:text-sm">
            🔥 Leilões ao vivo agora!
          </Badge>
          
          <h1 className="text-2xl sm:text-4xl lg:text-6xl font-bold mb-4 sm:mb-6 text-white leading-tight">
            Ganhe Produtos Incríveis por
            <span className="block text-accent-glow mt-1 sm:mt-2">Centavos!</span>
          </h1>
          
          <p className="text-base sm:text-xl lg:text-2xl text-white/90 mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed px-2 sm:px-0">Participe dos leilões mais emocionantes do Brasil. Cada lance custa apenas R$ 1 e pode te dar produtos de até R$ 100.000!</p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-8 sm:mb-12 px-4 sm:px-0">
            <Link to="/leiloes" className="w-full sm:w-auto">
              <Button size="xl" variant="accent" className="shadow-glow w-full text-base sm:text-lg">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Ver Leilões Ativos
              </Button>
            </Link>
            <Link to="/investir" className="w-full sm:w-auto">
              <Button size="xl" className="w-full text-base sm:text-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-0">
                <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Seja um Investidor
              </Button>
            </Link>
          </div>

          {/* Stats - Mobile optimized */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mt-8 sm:mt-16 px-2 sm:px-0">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 sm:p-6">
              <div className="text-lg sm:text-2xl font-bold text-white mb-1">500K+</div>
              <div className="text-white/70 text-xs sm:text-sm">Usuários Ativos</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 sm:p-6">
              <div className="text-lg sm:text-2xl font-bold text-white mb-1">R$ 2Mi+</div>
              <div className="text-white/70 text-xs sm:text-sm">Em Prêmios</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 sm:p-6">
              <div className="text-lg sm:text-2xl font-bold text-white mb-1">15s</div>
              <div className="text-white/70 text-xs sm:text-sm">Por Leilão</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 sm:p-6">
              <div className="text-lg sm:text-2xl font-bold text-white mb-1">98%</div>
              <div className="text-white/70 text-xs sm:text-sm">Satisfação</div>
            </div>
          </div>
        </div>
      </div>
    </section>;
};