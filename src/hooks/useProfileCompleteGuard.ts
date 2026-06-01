import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Redireciona usuários autenticados com perfil incompleto (login Google sem CPF/endereço)
 * para /complete-profile, bloqueando o acesso ao restante do app.
 */
const ALLOWED_PATHS = ['/complete-profile', '/auth', '/auth/callback', '/reset-password'];

export const useProfileCompleteGuard = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !user || !profile) return;
    if (profile.profile_complete === false && !ALLOWED_PATHS.some((p) => location.pathname.startsWith(p))) {
      navigate('/complete-profile', { replace: true });
    }
  }, [user, profile, loading, location.pathname, navigate]);
};
