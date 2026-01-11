import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Coins, ShoppingCart, User, Menu, Gavel, LogIn, LogOut, Settings, Home, Trophy, HelpCircle, Bell, Briefcase, Users2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

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
  
  const location = useLocation();
  const [hasPartnerContract, setHasPartnerContract] = useState(false);
  
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

  // Check if user has active partner contract
  useEffect(() => {
    const checkPartnerContract = async () => {
      if (!profile?.user_id) {
        setHasPartnerContract(false);
        return;
      }
      
      const { data } = await supabase
        .from('partner_contracts')
        .select('id')
        .eq('user_id', profile.user_id)
        .in('status', ['active', 'pending'])
        .maybeSingle();
      
      setHasPartnerContract(!!data);
    };
    
    checkPartnerContract();
  }, [profile?.user_id]);

  // Get current page context
  const getPageContext = () => {
    switch (location.pathname) {
      case '/':
        return { title: 'Início', icon: Home };
      case '/leiloes':
        return { title: 'Leilões', icon: Gavel };
      case '/vencedores':
        return { title: 'Vencedores', icon: Trophy };
      case '/como-funciona':
        return { title: 'Como Funciona', icon: HelpCircle };
      case '/dashboard':
        return { title: 'Dashboard', icon: Settings };
      case '/minha-parceria':
        return { title: 'Minha Parceria', icon: Briefcase };
      default:
        return { title: 'Show de Lances', icon: Gavel };
    }
  };

  const currentPage = getPageContext();

  const getUserInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleSignOut = async () => {
    if (signOut) {
      await signOut();
    }
  };

  // Partner link config based on user status
  const partnerLink = hasPartnerContract ? '/minha-parceria' : '/parceiro';
  const partnerLabel = hasPartnerContract ? 'Minha Parceria' : 'Seja Parceiro';

  return (
    <header className="bg-background/95 backdrop-blur-sm border-b border-border shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Logo & Context - Mobile Enhanced */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Link to="/" className="flex items-center space-x-2">
              <div className="p-1.5 sm:p-2 bg-gradient-primary rounded-lg shadow-elegant">
                <Gavel className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
              </div>
              <div className="hidden xs:block">
                <h1 className="text-lg sm:text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  Show de Lances
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Leilões que valem ouro!</p>
              </div>
            </Link>
            
            {/* Current Page Context - Mobile Only */}
            <div className="flex items-center space-x-1 sm:hidden">
              <div className="w-px h-6 bg-border"></div>
              <div className="flex items-center space-x-1 text-muted-foreground">
                <currentPage.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{currentPage.title}</span>
              </div>
            </div>
          </div>

          {/* Navigation - Desktop */}
          <nav className="hidden lg:flex items-center space-x-6">
            <Link to="/leiloes" className="text-foreground hover:text-primary transition-colors">
              Leilões Ativos
            </Link>
            <Link to="/como-funciona" className="text-foreground hover:text-primary transition-colors">
              Como Funciona
            </Link>
            <Link to="/afiliado" className="text-foreground hover:text-primary transition-colors">
              Afiliados
            </Link>
            <Link to={partnerLink} className="text-foreground hover:text-amber-500 transition-colors relative">
              <span className="flex items-center gap-1.5">
                <span className="relative">
                  {partnerLabel}
                  {!hasPartnerContract && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  )}
                </span>
                {!hasPartnerContract && (
                  <Badge className="bg-gradient-to-r from-amber-500 to-amber-400 text-amber-950 text-[10px] px-1.5 py-0 font-bold">
                    NOVO
                  </Badge>
                )}
              </span>
            </Link>
            <Link to="/vencedores" className="text-foreground hover:text-primary transition-colors">
              Vencedores
            </Link>
            {profile?.is_admin && (
              <Link to="/admin/parceiros" className="text-foreground hover:text-primary transition-colors flex items-center gap-1.5">
                <Users2 className="w-4 h-4" />
                Gestão Parceiros
              </Link>
            )}
          </nav>

          {/* User Actions */}
          <div className="flex items-center space-x-1 sm:space-x-3">
            {user ? (
              <>
                {/* Mobile User Info - Always Visible */}
                <div className="flex items-center space-x-2 sm:hidden">
                  <Avatar className="w-7 h-7 border-2 border-primary/20">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || 'Usuário'} />
                    <AvatarFallback className="text-xs font-bold bg-gradient-primary text-primary-foreground">
                      {getUserInitials(profile?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-foreground leading-tight">
                      {profile?.full_name?.split(' ')[0] || 'Usuário'}
                    </span>
                    <div className="flex items-center space-x-1 bg-secondary/80 border border-border/50 rounded-md px-2 py-1">
                      <Coins className="w-3 h-3 text-foreground" />
                      <span className="text-xs font-semibold text-foreground">{displayBids}</span>
                    </div>
                  </div>
                </div>

                {/* User Bids Display - Desktop */}
                <div className="hidden sm:flex items-center bg-secondary border border-border rounded-lg px-3 py-2 shadow-sm">
                  <Coins className="w-4 h-4 text-accent mr-2" />
                  <span className="font-semibold text-secondary-foreground text-base">{displayBids}</span>
                  <span className="text-xs text-muted-foreground ml-1">lances</span>
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
              <SheetContent side="right" className="w-[300px]">
                <div className="flex flex-col space-y-4 mt-6">
                  {user && profile && (
                    <>
                      {/* Enhanced User Info in Mobile Menu */}
                      <div className="flex items-center space-x-3 pb-4 border-b border-border">
                        <Avatar className="w-12 h-12 border-2 border-primary/20">
                          <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || 'Usuário'} />
                          <AvatarFallback className="text-sm font-bold bg-gradient-primary text-primary-foreground">
                            {getUserInitials(profile?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col flex-1">
                          <span className="text-sm font-semibold text-foreground">
                            {profile?.full_name || 'Usuário'}
                          </span>
                          <span className="text-xs text-muted-foreground mb-1">
                            {user?.email}
                          </span>
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary" className="text-xs px-2 py-0.5">
                              <Coins className="w-3 h-3 mr-1" />
                              {displayBids} lances
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground px-1">Ações Rápidas</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <Button onClick={onBuyBids} variant="outline" size="sm" className="justify-start">
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            Comprar Lances
                          </Button>
                          <Link to="/dashboard">
                            <Button variant="outline" size="sm" className="w-full justify-start">
                              <Settings className="w-4 h-4 mr-2" />
                              Dashboard
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Navigation */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground px-1">Navegação</h4>
                    <div className="space-y-1">
                      <Link to="/" className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-base font-medium ${location.pathname === '/' ? 'bg-primary/10 text-primary' : 'text-foreground hover:text-primary hover:bg-accent'}`}>
                        <Home className="w-5 h-5" />
                        <span>Início</span>
                      </Link>
                      <Link to="/leiloes" className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-base font-medium ${location.pathname === '/leiloes' ? 'bg-primary/10 text-primary' : 'text-foreground hover:text-primary hover:bg-accent'}`}>
                        <Gavel className="w-5 h-5" />
                        <span>Leilões Ativos</span>
                      </Link>
                      <Link to="/como-funciona" className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-base font-medium ${location.pathname === '/como-funciona' ? 'bg-primary/10 text-primary' : 'text-foreground hover:text-primary hover:bg-accent'}`}>
                        <HelpCircle className="w-5 h-5" />
                        <span>Como Funciona</span>
                      </Link>
                      <Link to="/afiliado" className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-base font-medium ${location.pathname === '/afiliado' ? 'bg-primary/10 text-primary' : 'text-foreground hover:text-primary hover:bg-accent'}`}>
                        <User className="w-5 h-5" />
                        <span>Afiliados</span>
                      </Link>
                      <Link to={partnerLink} className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-base font-medium ${location.pathname === '/minha-parceria' || location.pathname === '/parceiro' || location.pathname === '/investir' ? 'bg-amber-500/10 text-amber-600' : 'text-foreground hover:text-amber-600 hover:bg-amber-500/5'}`}>
                        <Briefcase className="w-5 h-5" />
                        <span>{partnerLabel}</span>
                        {!hasPartnerContract && (
                          <Badge className="ml-auto bg-gradient-to-r from-amber-500 to-amber-400 text-amber-950 text-[10px] px-1.5 py-0 font-bold">NOVO</Badge>
                        )}
                      </Link>
                      <Link to="/vencedores" className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-base font-medium ${location.pathname === '/vencedores' ? 'bg-primary/10 text-primary' : 'text-foreground hover:text-primary hover:bg-accent'}`}>
                        <Trophy className="w-5 h-5" />
                        <span>Vencedores</span>
                      </Link>
                      {profile?.is_admin && (
                        <Link to="/admin/parceiros" className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-base font-medium ${location.pathname === '/admin/parceiros' ? 'bg-primary/10 text-primary' : 'text-foreground hover:text-primary hover:bg-accent'}`}>
                          <Users2 className="w-5 h-5" />
                          <span>Gestão Parceiros</span>
                        </Link>
                      )}
                    </div>
                  </div>
                  
                  {user && (
                    <div className="space-y-2 pt-4 border-t border-border">
                      <Button 
                        onClick={handleSignOut} 
                        variant="ghost" 
                        className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 text-base font-medium"
                      >
                        <LogOut className="w-5 h-5 mr-3" />
                        Sair da Conta
                      </Button>
                    </div>
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