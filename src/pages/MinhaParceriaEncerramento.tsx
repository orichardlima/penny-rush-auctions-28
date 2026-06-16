import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import EncerramentoDashboard from '@/components/Partner/EncerramentoDashboard';

const MinhaParceriaEncerramento = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth?redirect=/minha-parceria/encerramento');
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/50 flex flex-col">
      <SEOHead
        title="Acompanhamento do Encerramento"
        description="Acompanhe o status do seu pedido de encerramento antecipado, prazos de estorno e detalhamento financeiro completo."
      />
      <Header userBids={profile?.bids_balance || 0} onBuyBids={() => {}} />
      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="flex justify-end mb-4">
          <Link to="/meus-contratos">
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Meus Contratos
            </Button>
          </Link>
        </div>
        <EncerramentoDashboard />
      </div>
      <Footer />
    </div>
  );
};

export default MinhaParceriaEncerramento;
