import { useState, useEffect } from 'react';

export const usePageVisibility = () => {
  const [isVisible, setIsVisible] = useState(!document.hidden);
  const [visibilityState, setVisibilityState] = useState(document.visibilityState);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const newIsVisible = !document.hidden;
      const newVisibilityState = document.visibilityState;
      
      console.log('👁️ [PAGE-VISIBILITY] Status mudou:', {
        isVisible: newIsVisible,
        visibilityState: newVisibilityState,
        timestamp: new Date().toISOString()
      });
      
      setIsVisible(newIsVisible);
      setVisibilityState(newVisibilityState);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    window.addEventListener('blur', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      window.removeEventListener('blur', handleVisibilityChange);
    };
  }, []);

  return { isVisible, visibilityState };
};