import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePartnerContract } from '@/hooks/usePartnerContract';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';
import PartnerDashboard from '@/components/Partner/PartnerDashboard';

const MinhaParceria = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { contract, loading: contractLoading } = usePartnerContract();

  useEffect(() => {
    // Redirecionar para login se não autenticado
    if (!authLoading && !user) {
      navigate('/auth?redirect=/minha-parceria');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    // Redirecionar para landing se não tem contrato
    if (!authLoading && !contractLoading && user && !contract) {
      navigate('/parceiro');
    }
  }, [user, authLoading, contract, contractLoading, navigate]);

  // Loading state
  if (authLoading || contractLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/50">
        <Header userBids={profile?.bids_balance || 0} onBuyBids={() => {}} />
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando sua parceria...</p>
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return null;
  }

  // No contract
  if (!contract) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/50 flex flex-col">
      <SEOHead 
        title="Minha Parceria" 
        description="Acompanhe seu investimento, rendimentos semanais e gerencie sua parceria no Show de Lances."
      />
      <Header userBids={profile?.bids_balance || 0} onBuyBids={() => {}} />
      
      <div className="container mx-auto px-4 py-8 flex-1">
        <PartnerDashboard />
      </div>
      
      <Footer />
    </div>
  );
};

export default MinhaParceria;
