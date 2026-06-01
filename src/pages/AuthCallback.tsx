import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getPartnerReferralCode, clearPartnerReferralTracking } from '@/hooks/usePartnerReferralTracking';
import { getReferralCode, clearReferralTracking } from '@/hooks/useReferralTracking';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const finish = async (userId: string) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('profile_complete, referred_by_partner_code')
        .eq('user_id', userId)
        .maybeSingle();

      if (cancelled) return;

      const partnerRef = getPartnerReferralCode();
      const affiliateRef = getReferralCode();

      // Se ainda não está completo, redireciona para tela de complemento
      if (!profile || profile.profile_complete === false) {
        const params = new URLSearchParams();
        if (partnerRef) params.set('ref', partnerRef);
        navigate(`/complete-profile${params.toString() ? `?${params}` : ''}`, { replace: true });
        return;
      }

      // Perfil já está completo — limpa códigos pendentes (já foram aplicados antes)
      if (partnerRef) clearPartnerReferralTracking();
      if (affiliateRef) clearReferralTracking();
      navigate('/dashboard', { replace: true });
    };

    // Aguarda a sessão via listener (tokens vêm no hash)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        finish(session.user.id);
      }
    });

    // Tenta imediatamente também (caso a sessão já esteja resolvida)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) finish(session.user.id);
    });

    // Timeout de segurança
    const timeout = setTimeout(() => {
      if (!cancelled) navigate('/auth', { replace: true });
    }, 10000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Concluindo seu login...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
