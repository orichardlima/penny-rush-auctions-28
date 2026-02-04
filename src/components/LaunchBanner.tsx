import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { X, Rocket, Sparkles } from "lucide-react";
import { useLaunchBanner, dismissLaunchBanner } from "@/hooks/useLaunchBanner";

export const LaunchBanner = () => {
  const [isClosing, setIsClosing] = useState(false);
  const [localDismissed, setLocalDismissed] = useState(false);
  const { isVisible, isLoading, title, subtitle, highlight, cta1, cta2, mobileCta } = useLaunchBanner();

  const handleDismiss = () => {
    setIsClosing(true);
    setTimeout(() => {
      dismissLaunchBanner();
      setLocalDismissed(true);
    }, 300);
  };

  // Don't render while loading, if not visible, or if locally dismissed
  if (isLoading || !isVisible || localDismissed) return null;

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
            <span className="text-xl sm:text-2xl flex-shrink-0 animate-bounce">🎉</span>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
              {/* Desktop text */}
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-white font-bold text-sm lg:text-base whitespace-nowrap">
                  {title}
                </span>
                <span className="text-white/90 text-sm lg:text-base">
                  {subtitle}
                </span>
              </div>
              
              {/* Mobile text */}
              <div className="sm:hidden">
                <span className="text-white font-bold text-sm">
                  {title}
                </span>
              </div>
              
              {highlight && (
                <div className="hidden lg:flex items-center gap-1 text-white/80 text-sm">
                  <Sparkles className="h-4 w-4" />
                  <span>{highlight}</span>
                </div>
              )}
            </div>
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Desktop buttons */}
            <div className="hidden sm:flex items-center gap-2">
              {cta1.text && cta1.link && (
                <Link to={cta1.link}>
                  <Button 
                    size="sm" 
                    variant="outline-hero"
                    className="text-xs lg:text-sm"
                  >
                    <Rocket className="h-3.5 w-3.5 mr-1" />
                    {cta1.text}
                  </Button>
                </Link>
              )}
              {cta2.text && cta2.link && (
                <Link to={cta2.link}>
                  <Button 
                    size="sm" 
                    className="bg-white text-primary hover:bg-white/90 text-xs lg:text-sm font-semibold"
                  >
                    {cta2.text}
                  </Button>
                </Link>
              )}
            </div>
            
            {/* Mobile button */}
            {mobileCta.text && mobileCta.link && (
              <Link to={mobileCta.link} className="sm:hidden">
                <Button 
                  size="sm" 
                  className="bg-white text-primary hover:bg-white/90 text-xs font-semibold"
                >
                  {mobileCta.text}
                </Button>
              </Link>
            )}

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
