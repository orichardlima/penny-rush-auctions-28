import { useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle } from "lucide-react";
import { InvestmentHero } from "@/components/Investir/InvestmentHero";
import { InvestmentSimulator } from "@/components/Investir/InvestmentSimulator";
import { InvestmentBenefits } from "@/components/Investir/InvestmentBenefits";
import { InvestmentModel } from "@/components/Investir/InvestmentModel";
import { InvestmentTimeline } from "@/components/Investir/InvestmentTimeline";
import { TestimonialCarousel } from "@/components/Investir/TestimonialCarousel";
import { PlanComparison } from "@/components/Investir/PlanComparison";
import { InvestmentFAQ } from "@/components/Investir/InvestmentFAQ";
import { PartnershipDisclaimer } from "@/components/Partner/PartnershipDisclaimer";
import { useAuth } from "@/contexts/AuthContext";
import { usePartnerContract } from "@/hooks/usePartnerContract";
// Tracking de referral agora é feito globalmente no App.tsx
import { Footer } from "@/components/Footer";

const PartnerLanding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { contract } = usePartnerContract();
  const simulatorRef = useRef<HTMLDivElement>(null);
  const plansRef = useRef<HTMLDivElement>(null);

  // Auto-redirect para cadastro se tiver código de referral e usuário não logado
  useEffect(() => {
    const refCode = searchParams.get('ref');
    
    // Se tem código de referral e usuário NÃO está logado, redirecionar para cadastro
    if (refCode && !user) {
      navigate(`/auth?tab=signup&ref=${refCode}&redirect=/minha-parceria`, { replace: true });
    }
  }, [searchParams, user, navigate]);

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
      <SEOHead 
        title="Seja um Parceiro de Expansão"
        description="Participe do crescimento do Show de Lances. Programa de parceria com repasses semanais, teto definido em contrato e transparência total."
      />
      <Header onBuyBids={handleBuyBids} />

      {/* Banner for existing partners */}
      {contract && (
        <div className="bg-primary/10 border-b border-primary/20">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              <span className="text-sm">
                Você já é parceiro <strong>{contract.plan_name}</strong>!
              </span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/minha-parceria')}
            >
              Ir para o Dashboard
            </Button>
          </div>
        </div>
      )}

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

      {/* Model Explanation */}
      <InvestmentModel />

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
              Pronto para ser um Parceiro de Expansão?
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

      {/* Legal Disclaimer (canonical) */}
      <section className="py-8 bg-muted/50">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <PartnershipDisclaimer variant="card" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default PartnerLanding;