import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-primary rounded-lg shadow-elegant">
              <Gavel className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                LeilãoCentavos
              </h1>
              <p className="text-xs text-muted-foreground">Leilões que valem ouro!</p>
            </div>
          </Link>

          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-center space-x-6">
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
          <div className="flex items-center space-x-3">
            {user ? (
              <>
                {/* User Bids Display */}
                <div className="flex items-center bg-secondary border border-border rounded-lg px-3 py-2 shadow-sm">
                  <Coins className="w-4 h-4 text-accent mr-2" />
                  <span className="font-semibold text-secondary-foreground">{displayBids}</span>
                  <span className="text-xs text-muted-foreground ml-1">lances</span>
                </div>

                {/* Buy Bids Button */}
                <Button onClick={onBuyBids} variant="accent" size="sm">
                  <ShoppingCart className="w-4 h-4 mr-1" />
                  Comprar
                </Button>

                {/* User Profile */}
                <Link to="/dashboard">
                  <Button variant="ghost" size="icon">
                    <User className="w-4 h-4" />
                  </Button>
                </Link>
              </>
            ) : (
              <Link to="/auth">
                <Button variant="default" size="sm">
                  <LogIn className="w-4 h-4 mr-2" />
                  Entrar
                </Button>
              </Link>
            )}

            {/* Mobile Menu */}
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};