import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Handshake, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { usePartnerData } from '@/hooks/usePartnerData';
import { Header } from '@/components/Header';
import { PartnerComplianceNotice } from '@/components/Partner/PartnerComplianceNotice';
import { PartnerContractCard } from '@/components/Partner/PartnerContractCard';
import { PartnerPayoutsHistory } from '@/components/Partner/PartnerPayoutsHistory';
import { PartnerReferralSection } from '@/components/Partner/PartnerReferralSection';
import { PartnerPlansGrid } from '@/components/Partner/PartnerPlansGrid';
import { PartnerSimulator } from '@/components/Partner/PartnerSimulator';

const PartnerDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { 
    loading, 
    contract, 
    payouts, 
    plans,
    referralBonuses,
    totalBonusAvailable,
    isPartner,
    progressPercentage
  } = usePartnerData();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Handshake className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Área do Parceiro</h1>
              <p className="text-muted-foreground text-sm">
                Participação em receita e bônus de indicação
              </p>
            </div>
          </div>
        </div>

        {/* Compliance Notice */}
        <div className="mb-8">
          <PartnerComplianceNotice />
        </div>

        {isPartner && contract ? (
          <div className="space-y-8">
            {/* Contract Section */}
            <section>
              <PartnerContractCard 
                contract={contract} 
                progressPercentage={progressPercentage} 
              />
            </section>

            {/* Payouts History */}
            <section>
              <PartnerPayoutsHistory payouts={payouts} />
            </section>

            <Separator className="my-8" />

            {/* Referral Section - Separated */}
            <section>
              <PartnerReferralSection 
                referralBonuses={referralBonuses}
                totalBonusAvailable={totalBonusAvailable}
              />
            </section>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Plans Grid for Non-Partners */}
            <section>
              <PartnerPlansGrid plans={plans} />
            </section>

            {/* Simulator */}
            <section className="max-w-2xl mx-auto">
              <PartnerSimulator plans={plans} />
            </section>

            {/* Contact CTA */}
            <section className="text-center">
              <p className="text-muted-foreground mb-4">
                Interessado em se tornar um parceiro?
              </p>
              <Button size="lg" onClick={() => window.open('mailto:parceiros@seusite.com', '_blank')}>
                <Handshake className="mr-2 h-5 w-5" />
                Entrar em Contato
              </Button>
            </section>
          </div>
        )}

        {/* Footer Compliance */}
        <PartnerComplianceNotice variant="compact" />
      </main>
    </div>
  );
};

export default PartnerDashboard;
