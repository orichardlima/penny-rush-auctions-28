import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Coins, ShoppingCart, User, Menu, Gavel, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface HeaderProps {
  userBids?: number;
  onBuyBids?: () => void;
}

export const Header = ({ userBids, onBuyBids }: HeaderProps) => {
  // Try to get auth context, fallback to props if not available
  let displayBids = userBids ?? 0;
  let user = null;
  try {
    const authContext = useAuth();
    user = authContext.user;
    displayBids = (authContext.profile?.bids_balance ?? (userBids ?? 0));
  } catch (error) {
    // If useAuth fails (not within AuthProvider), use userBids from props
    console.log('Auth context not available in Header, using props');
  }

  return (
    <header className="bg-background/95 backdrop-blur-sm border-b border-border shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 sm:space-x-3">
            <div className="p-1.5 sm:p-2 bg-gradient-primary rounded-lg shadow-elegant">
              <Gavel className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
            </div>
            <div className="hidden xs:block">
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                LeilãoCentavos
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Leilões que valem ouro!</p>
            </div>
          </Link>

          {/* Navigation - Desktop */}
          <nav className="hidden lg:flex items-center space-x-6">
            <Link to="/leiloes" className="text-foreground hover:text-primary transition-colors">
              Leilões Ativos
            </Link>
            <Link to="/como-funciona" className="text-foreground hover:text-primary transition-colors">
              Como Funciona
            </Link>
            <Link to="/vencedores" className="text-foreground hover:text-primary transition-colors">
              Vencedores
            </Link>
          </nav>

          {/* User Actions */}
          <div className="flex items-center space-x-1 sm:space-x-3">
            {user ? (
              <>
                {/* User Bids Display - Mobile optimized */}
                <div className="flex items-center bg-secondary border border-border rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 shadow-sm">
                  <Coins className="w-3 h-3 sm:w-4 sm:h-4 text-accent mr-1 sm:mr-2" />
                  <span className="font-semibold text-secondary-foreground text-sm sm:text-base">{displayBids}</span>
                  <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">lances</span>
                </div>

                {/* Buy Bids Button - Mobile optimized */}
                <Button onClick={onBuyBids} variant="accent" size="sm" className="px-2 sm:px-4">
                  <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Comprar</span>
                </Button>

                {/* User Profile */}
                <Link to="/dashboard" className="hidden sm:block">
                  <Button variant="ghost" size="icon">
                    <User className="w-4 h-4" />
                  </Button>
                </Link>
              </>
            ) : (
              <Link to="/auth">
                <Button variant="default" size="sm" className="px-2 sm:px-4">
                  <LogIn className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                  <span className="text-xs sm:text-sm">Entrar</span>
                </Button>
              </Link>
            )}

            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px]">
                <div className="flex flex-col space-y-4 mt-8">
                  <Link to="/leiloes" className="text-foreground hover:text-primary transition-colors text-lg font-medium">
                    Leilões Ativos
                  </Link>
                  <Link to="/como-funciona" className="text-foreground hover:text-primary transition-colors text-lg font-medium">
                    Como Funciona
                  </Link>
                  <Link to="/vencedores" className="text-foreground hover:text-primary transition-colors text-lg font-medium">
                    Vencedores
                  </Link>
                  {user && (
                    <Link to="/dashboard" className="text-foreground hover:text-primary transition-colors text-lg font-medium sm:hidden">
                      Meu Perfil
                    </Link>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};