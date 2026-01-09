import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Shield, ArrowRight } from "lucide-react";
import { InvestmentHero } from "@/components/Investir/InvestmentHero";
import { InvestmentSimulator } from "@/components/Investir/InvestmentSimulator";
import { InvestmentBenefits } from "@/components/Investir/InvestmentBenefits";
import { InvestmentTimeline } from "@/components/Investir/InvestmentTimeline";
import { TestimonialCarousel } from "@/components/Investir/TestimonialCarousel";
import { PlanComparison } from "@/components/Investir/PlanComparison";
import { InvestmentFAQ } from "@/components/Investir/InvestmentFAQ";
import { useAuth } from "@/contexts/AuthContext";
import { usePartnerContract } from "@/hooks/usePartnerContract";

const Investir = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { contract } = usePartnerContract();
  const simulatorRef = useRef<HTMLDivElement>(null);
  const plansRef = useRef<HTMLDivElement>(null);

  // If user already has a contract, redirect to dashboard
  if (contract) {
    navigate('/dashboard');
    return null;
  }

  const scrollToSimulator = () => {
    simulatorRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToPlans = () => {
    plansRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleBuyBids = () => {
    navigate('/pacotes');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onBuyBids={handleBuyBids} />

      {/* Hero */}
      <InvestmentHero 
        onScrollToSimulator={scrollToSimulator}
        onScrollToPlans={scrollToPlans}
      />

      {/* Simulator */}
      <div ref={simulatorRef}>
        <InvestmentSimulator />
      </div>

      {/* Benefits */}
      <InvestmentBenefits />

      {/* Timeline */}
      <InvestmentTimeline />

      {/* Testimonials */}
      <TestimonialCarousel />

      {/* Plan Comparison */}
      <div ref={plansRef}>
        <PlanComparison />
      </div>

      {/* FAQ */}
      <InvestmentFAQ />

      {/* Final CTA */}
      <section className="py-16 sm:py-24 bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-800">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4">
              Pronto para se Tornar um Parceiro?
            </h2>
            <p className="text-purple-100/80 text-lg mb-8">
              Junte-se a mais de 150 parceiros que já estão participando do crescimento da plataforma
            </p>
            <Button 
              size="xl" 
              onClick={scrollToPlans}
              className="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-amber-950 font-bold shadow-lg shadow-amber-500/25"
            >
              Escolher Meu Plano
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Legal Disclaimer */}
      <section className="py-8 bg-muted/50">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Aviso Legal Importante
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              O programa de parceiros da Show de Lances não constitui investimento financeiro, aplicação financeira, 
              oferta de valores mobiliários ou qualquer outra forma de captação de recursos regulamentada. 
              Os repasses são proporcionais ao desempenho da plataforma e não há garantia de rentabilidade ou retorno. 
              Ao participar do programa, você declara estar ciente dos termos e condições e assume os riscos envolvidos.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 border-t border-border">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Show de Lances. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Investir;
