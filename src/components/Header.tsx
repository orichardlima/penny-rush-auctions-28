import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Coins, ShoppingCart, User, Menu, Gavel, LogIn, LogOut, Settings } from "lucide-react";
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
  let profile = null;
  let signOut = null;
  
  try {
    const authContext = useAuth();
    user = authContext.user;
    profile = authContext.profile;
    signOut = authContext.signOut;
    displayBids = (profile?.bids_balance ?? (userBids ?? 0));
  } catch (error) {
    // If useAuth fails (not within AuthProvider), use userBids from props
    console.log('Auth context not available in Header, using props');
  }

  const getUserInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleSignOut = async () => {
    if (signOut) {
      await signOut();
    }
  };

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

                {/* User Profile - Desktop Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="hidden sm:flex items-center space-x-2 px-2 py-1 h-auto">
                      <Avatar className="w-7 h-7">
                        <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || 'Usuário'} />
                        <AvatarFallback className="text-xs font-medium bg-gradient-primary text-primary-foreground">
                          {getUserInitials(profile?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium text-foreground leading-none">
                          {profile?.full_name || 'Usuário'}
                        </span>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{profile?.full_name || 'Usuário'}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user?.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard" className="w-full cursor-pointer">
                        <Settings className="w-4 h-4 mr-2" />
                        Meu Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
                  {user && profile && (
                    <>
                      {/* User Info in Mobile Menu */}
                      <div className="flex items-center space-x-3 pb-4 border-b border-border">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || 'Usuário'} />
                          <AvatarFallback className="text-sm font-medium bg-gradient-primary text-primary-foreground">
                            {getUserInitials(profile?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">
                            {profile?.full_name || 'Usuário'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {user?.email}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                  
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
                    <>
                      <Link to="/dashboard" className="text-foreground hover:text-primary transition-colors text-lg font-medium">
                        <Settings className="w-5 h-5 mr-2 inline" />
                        Meu Dashboard
                      </Link>
                      <Button 
                        onClick={handleSignOut} 
                        variant="ghost" 
                        className="justify-start text-destructive hover:text-destructive hover:bg-destructive/10 text-lg font-medium p-0"
                      >
                        <LogOut className="w-5 h-5 mr-2" />
                        Sair
                      </Button>
                    </>
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