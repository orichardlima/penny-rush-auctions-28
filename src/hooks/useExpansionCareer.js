import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
export function useExpansionCareer() {
    const { data: career, isLoading: loading, error, refetch: refresh } = useQuery({
        queryKey: ['expansion-career-my'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('expansion_partner_get_my_career');
            if (error)
                throw error;
            return data;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
    return {
        career,
        loading,
        error,
        refresh
    };
}
