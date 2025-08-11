import React, { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';

interface UserNameCacheContextType {
  getCachedNames: (userIds: string[]) => Promise<Record<string, string>>;
  clearCache: () => void;
}

const UserNameCacheContext = createContext<UserNameCacheContextType | undefined>(undefined);

export const useUserNameCache = () => {
  const context = useContext(UserNameCacheContext);
  if (!context) {
    throw new Error('useUserNameCache must be used within a UserNameCacheProvider');
  }
  return context;
};

export const UserNameCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [nameCache, setNameCache] = useState<Record<string, string>>({});
  const isMobile = useIsMobile();

  const getCachedNames = useCallback(async (userIds: string[]): Promise<Record<string, string>> => {
    const result: Record<string, string> = {};
    const uncachedIds: string[] = [];

    // Check cache first
    userIds.forEach(id => {
      if (nameCache[id]) {
        result[id] = nameCache[id];
      } else {
        uncachedIds.push(id);
      }
    });

    if (uncachedIds.length === 0) {
      return result;
    }

    if (isMobile) {
      console.log(`📱 Mobile: Buscando ${uncachedIds.length} nomes não cacheados:`, uncachedIds);
    }

    // Fetch uncached names with retry logic
    let retryCount = 0;
    const maxRetries = isMobile ? 3 : 1;
    
    while (retryCount <= maxRetries) {
      try {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', uncachedIds);

        if (error) {
          throw error;
        }

        const fetchedNames: Record<string, string> = {};
        const foundIds = new Set<string>();

        profiles?.forEach(profile => {
          const name = profile.full_name?.trim() || 'Usuário';
          fetchedNames[profile.user_id] = name;
          result[profile.user_id] = name;
          foundIds.add(profile.user_id);
        });

        // Mark missing profiles as "Usuário" but try to refetch them
        const missingIds = uncachedIds.filter(id => !foundIds.has(id));
        if (missingIds.length > 0 && retryCount < maxRetries) {
          if (isMobile) {
            console.log(`📱 Mobile: ${missingIds.length} nomes não encontrados, tentativa ${retryCount + 1}/${maxRetries + 1}`);
          }
          retryCount++;
          // Wait a bit before retry on mobile
          if (isMobile) {
            await new Promise(resolve => setTimeout(resolve, 200 * retryCount));
          }
          continue;
        }

        // Mark remaining missing IDs as "Usuário"
        missingIds.forEach(id => {
          fetchedNames[id] = 'Usuário';
          result[id] = 'Usuário';
        });

        // Update cache
        setNameCache(prev => ({ ...prev, ...fetchedNames }));

        if (isMobile) {
          console.log(`📱 Mobile: Cache atualizado com ${Object.keys(fetchedNames).length} nomes`);
        }

        break;
      } catch (error) {
        console.error(`Erro ao buscar nomes (tentativa ${retryCount + 1}):`, error);
        retryCount++;
        
        if (retryCount > maxRetries) {
          // Mark all uncached as "Usuário" on final failure
          uncachedIds.forEach(id => {
            result[id] = 'Usuário';
          });
        } else if (isMobile) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 300 * retryCount));
        }
      }
    }

    return result;
  }, [nameCache, isMobile]);

  const clearCache = useCallback(() => {
    setNameCache({});
  }, []);

  return (
    <UserNameCacheContext.Provider value={{ getCachedNames, clearCache }}>
      {children}
    </UserNameCacheContext.Provider>
  );
};