import { useEffect, useCallback, useRef } from 'react';

export const useBrowserIdlePrevention = (enabled: boolean = true) => {
  const animationRef = useRef<number>();
  const videoRef = useRef<HTMLVideoElement>();

  const keepActive = useCallback(() => {
    if (!enabled) return;
    
    // Usar requestAnimationFrame para manter o browser ativo
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    console.log('🔄 [IDLE-PREVENTION] Sistema ativo para evitar sleep mode');
  }, [enabled]);

  const stopKeepActive = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    }
    console.log('⏸️ [IDLE-PREVENTION] Sistema pausado');
  }, []);

  const createHiddenVideo = useCallback(() => {
    if (!enabled || videoRef.current) return;

    // Criar vídeo hidden para evitar que browser durma
    const video = document.createElement('video');
    video.style.position = 'fixed';
    video.style.top = '-1000px';
    video.style.left = '-1000px';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0';
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    
    // Criar um canvas pequeno como source do vídeo
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, 1, 1);
    }
    
    // Converter canvas para blob e criar video source
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        video.src = url;
        video.play().catch(() => {
          // Silenciar erros de autoplay
        });
      }
    });

    document.body.appendChild(video);
    videoRef.current = video;
    
    console.log('📹 [IDLE-PREVENTION] Vídeo hidden criado para manter ativo');
  }, [enabled]);

  const removeHiddenVideo = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.remove();
      videoRef.current = undefined;
      console.log('📹 [IDLE-PREVENTION] Vídeo hidden removido');
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      keepActive();
      createHiddenVideo();
      
      // Detectar quando usuário interagiu recentemente
      let lastActivity = Date.now();
      
      const updateActivity = () => {
        lastActivity = Date.now();
      };
      
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
      events.forEach(event => {
        document.addEventListener(event, updateActivity, { passive: true });
      });
      
      // Verificar atividade a cada minuto
      const activityCheck = setInterval(() => {
        const timeSinceActivity = Date.now() - lastActivity;
        const shouldStayActive = timeSinceActivity < 300000; // 5 minutos
        
        if (shouldStayActive) {
          console.log('⚡ [IDLE-PREVENTION] Usuário ativo, mantendo sistema desperto');
        }
      }, 60000);

      return () => {
        stopKeepActive();
        removeHiddenVideo();
        clearInterval(activityCheck);
        events.forEach(event => {
          document.removeEventListener(event, updateActivity);
        });
      };
    } else {
      stopKeepActive();
      removeHiddenVideo();
    }
  }, [enabled, keepActive, stopKeepActive, createHiddenVideo, removeHiddenVideo]);

  return {
    keepActive,
    stopKeepActive
  };
};