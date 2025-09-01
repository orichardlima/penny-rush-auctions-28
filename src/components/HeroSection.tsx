import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Clock, Shield } from "lucide-react";
import { Link } from "react-router-dom";

export const HeroSection = () => {
  return (
    <section className="py-20 bg-gradient-hero text-center relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-black/10"></div>
      <div className="absolute top-20 left-10 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
      <div className="absolute bottom-20 right-10 w-32 h-32 bg-accent/20 rounded-full blur-xl"></div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          <Badge className="mb-6 bg-background/20 text-foreground border-white/20">
            🔥 Leilões ao vivo agora!
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white">
            Ganhe Produtos Incríveis por
            <span className="block text-accent-glow">Centavos!</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-2xl mx-auto">
            Participe dos leilões mais emocionantes do Brasil. 
            Cada lance custa apenas R$ 1 e pode te dar produtos de até R$ 10.000!
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link to="/leiloes">
              <Button size="xl" variant="accent" className="shadow-glow w-full sm:w-auto">
                <TrendingUp className="w-5 h-5 mr-2" />
                Ver Leilões Ativos
              </Button>
            </Link>
            <Link to="/como-funciona">
              <Button size="xl" variant="outline-hero" className="w-full sm:w-auto">
                Como Funciona
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <div className="text-2xl font-bold text-white mb-1">500K+</div>
              <div className="text-white/70 text-sm">Usuários Ativos</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <div className="text-2xl font-bold text-white mb-1">R$ 2Mi+</div>
              <div className="text-white/70 text-sm">Em Prêmios</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <div className="text-2xl font-bold text-white mb-1">15s</div>
              <div className="text-white/70 text-sm">Por Leilão</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
              <div className="text-2xl font-bold text-white mb-1">98%</div>
              <div className="text-white/70 text-sm">Satisfação</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};