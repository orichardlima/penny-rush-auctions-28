import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Shield, Users, Wallet, Lock } from "lucide-react";

interface InvestmentHeroProps {
  onScrollToSimulator: () => void;
  onScrollToPlans: () => void;
}

export const InvestmentHero = ({ onScrollToSimulator, onScrollToPlans }: InvestmentHeroProps) => {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background with premium gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-800" />
      
      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-purple-500/5 to-transparent rounded-full" />
      
      {/* Content */}
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          <Badge className="mb-6 bg-amber-500/20 text-amber-300 border-amber-500/30 text-sm px-4 py-1.5">
            💎 Programa Exclusivo de Parceiros
          </Badge>
          
          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-bold mb-6 text-white leading-tight">
            Participe do Crescimento da
            <span className="block bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent mt-2">
              Plataforma Líder em Leilões
            </span>
          </h1>
          
          <p className="text-lg sm:text-xl lg:text-2xl text-purple-100/90 mb-10 max-w-3xl mx-auto leading-relaxed">
            Seu aporte contribui para o crescimento da plataforma. 
            Receba repasses semanais proporcionais ao faturamento real, com transparência total e regras claras.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button 
              size="xl" 
              onClick={onScrollToSimulator}
              className="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-amber-950 font-bold shadow-lg shadow-amber-500/25"
            >
              <TrendingUp className="w-5 h-5 mr-2" />
              Simular Participação
            </Button>
            <Button 
              size="xl" 
              variant="outline"
              onClick={onScrollToPlans}
              className="border-2 border-white/30 bg-white/5 text-white hover:bg-white/10 hover:border-white/50 backdrop-blur-sm"
            >
              Ver Planos de Parceria
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 sm:p-6 border border-white/10">
              <div className="flex items-center justify-center mb-2">
                <Users className="w-5 h-5 text-amber-400 mr-2" />
                <span className="text-2xl sm:text-3xl font-bold text-white">150+</span>
              </div>
              <div className="text-purple-200/80 text-sm">Parceiros Ativos</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 sm:p-6 border border-white/10">
              <div className="flex items-center justify-center mb-2">
                <Wallet className="w-5 h-5 text-amber-400 mr-2" />
                <span className="text-2xl sm:text-3xl font-bold text-white">R$ 500K+</span>
              </div>
              <div className="text-purple-200/80 text-sm">Distribuído</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 sm:p-6 border border-white/10">
              <div className="flex items-center justify-center mb-2">
                <Lock className="w-5 h-5 text-amber-400 mr-2" />
                <span className="text-2xl sm:text-3xl font-bold text-white">Teto</span>
              </div>
              <div className="text-purple-200/80 text-sm">Definido em Contrato</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 sm:p-6 border border-white/10">
              <div className="flex items-center justify-center mb-2">
                <Shield className="w-5 h-5 text-amber-400 mr-2" />
                <span className="text-2xl sm:text-3xl font-bold text-white">100%</span>
              </div>
              <div className="text-purple-200/80 text-sm">Transparente</div>
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-4 mt-10">
            <div className="flex items-center gap-2 text-purple-200/70 text-sm">
              <Shield className="w-4 h-4" />
              <span>Contrato Claro</span>
            </div>
            <div className="w-px h-4 bg-purple-200/30" />
            <div className="flex items-center gap-2 text-purple-200/70 text-sm">
              <TrendingUp className="w-4 h-4" />
              <span>Apuração Semanal</span>
            </div>
            <div className="w-px h-4 bg-purple-200/30" />
            <div className="flex items-center gap-2 text-purple-200/70 text-sm">
              <Users className="w-4 h-4" />
              <span>Dashboard Exclusivo</span>
            </div>
          </div>

          {/* Legal text below hero */}
          <div className="mt-10 p-4 bg-black/20 rounded-lg border border-white/10">
            <p className="text-xs text-purple-200/60 leading-relaxed">
              Este programa não representa investimento financeiro.
              Os valores recebidos dependem do desempenho da plataforma.
              Não há garantia de repasse mínimo, valor fixo ou prazo.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
