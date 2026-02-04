import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { X, PartyPopper, Rocket, Sparkles } from "lucide-react";

const STORAGE_KEY = "launch_banner_dismissed";
const EXPIRY_DAYS = 7;

export const LaunchBanner = () => {
  const [dismissed, setDismissed] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const { timestamp } = JSON.parse(stored);
      const daysPassed = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
      if (daysPassed >= EXPIRY_DAYS) {
        localStorage.removeItem(STORAGE_KEY);
        setDismissed(false);
      }
    } else {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    setIsClosing(true);
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ timestamp: Date.now() }));
      setDismissed(true);
    }, 300);
  };

  if (dismissed) return null;

  return (
    <div 
      className={`relative z-[60] w-full bg-gradient-to-r from-primary via-primary-glow to-accent overflow-hidden shadow-lg transition-all duration-300 ${
        isClosing ? "opacity-0 -translate-y-full" : "opacity-100 translate-y-0"
      }`}
    >
      {/* Shimmer overlay */}
      <div className="absolute inset-0 animate-shimmer pointer-events-none" />
      
      <div className="container mx-auto px-4 py-3 sm:py-2">
        <div className="flex items-center justify-between gap-4">
          {/* Content */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <PartyPopper className="h-5 w-5 sm:h-6 sm:w-6 text-white flex-shrink-0 animate-bounce" />
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
              {/* Desktop text */}
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-white font-bold text-sm lg:text-base whitespace-nowrap">
                  🎉 LANÇAMENTO OFICIAL!
                </span>
                <span className="text-white/90 text-sm lg:text-base">
                  A plataforma Show de Lances está no ar!
                </span>
              </div>
              
              {/* Mobile text */}
              <div className="sm:hidden">
                <span className="text-white font-bold text-sm">
                  🎉 Lançamento Oficial!
                </span>
              </div>
              
              <div className="hidden lg:flex items-center gap-1 text-white/80 text-sm">
                <Sparkles className="h-4 w-4" />
                <span>Cada lance custa apenas R$ 1!</span>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Desktop buttons */}
            <div className="hidden sm:flex items-center gap-2">
              <Link to="/#leiloes">
                <Button 
                  size="sm" 
                  variant="outline-hero"
                  className="text-xs lg:text-sm"
                >
                  <Rocket className="h-3.5 w-3.5 mr-1" />
                  Ver Leilões
                </Button>
              </Link>
              <Link to="/pacotes">
                <Button 
                  size="sm" 
                  className="bg-white text-primary hover:bg-white/90 text-xs lg:text-sm font-semibold"
                >
                  Comprar Lances
                </Button>
              </Link>
            </div>
            
            {/* Mobile button */}
            <Link to="/#leiloes" className="sm:hidden">
              <Button 
                size="sm" 
                className="bg-white text-primary hover:bg-white/90 text-xs font-semibold"
              >
                Participar
              </Button>
            </Link>

            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white"
              aria-label="Fechar banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
