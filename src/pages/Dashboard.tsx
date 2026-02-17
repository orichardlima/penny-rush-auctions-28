import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { SEOHead } from '@/components/SEOHead';
import UserDashboard from '@/components/UserDashboard';
import AdminDashboard from '@/components/AdminDashboard';

const Dashboard = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [checkingPartner, setCheckingPartner] = useState(false);

  console.log('Dashboard render:', { user: !!user, profile: !!profile, loading });

  useEffect(() => {
    if (!loading && !user) {
      console.log('Redirecionando para /auth - usuário não logado');
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Redirecionar parceiros ativos para /minha-parceria
  useEffect(() => {
    if (!profile || !user || profile.is_admin) return;

    const checkPartnerContract = async () => {
      setCheckingPartner(true);
      const { data } = await supabase
        .from('partner_contracts')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .limit(1)
        .maybeSingle();

      if (data) {
        console.log('Parceiro ativo detectado, redirecionando para /minha-parceria');
        navigate('/minha-parceria');
      } else {
        setCheckingPartner(false);
      }
    };

    checkPartnerContract();
  }, [profile, user, navigate]);

  // Loading state
  if (loading || checkingPartner) {
    console.log('Dashboard: Loading...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando painel...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    console.log('Dashboard: Usuário não autenticado');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">Redirecionando...</p>
        </div>
      </div>
    );
  }

  // No profile yet
  if (!profile) {
    console.log('Dashboard: Profile não carregado');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  console.log('Dashboard: Renderizando dashboard para:', profile.is_admin ? 'Admin' : 'User');
  
  return (
    <>
      <SEOHead 
        title={profile.is_admin ? "Painel Administrativo" : "Meu Painel"} 
        description={profile.is_admin ? "Gerencie leilões, usuários e configurações da plataforma." : "Gerencie sua conta, veja seu histórico de lances e acompanhe seus leilões."}
      />
      {profile.is_admin ? <AdminDashboard /> : <UserDashboard />}
    </>
  );
};

export default Dashboard;