import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Gavel, Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Ícone temático */}
        <div className="mb-8">
          <Gavel className="w-20 h-20 text-primary mx-auto mb-4 opacity-60" />
          <h1 className="text-7xl font-bold text-primary">404</h1>
        </div>
        
        {/* Mensagem em português */}
        <h2 className="text-2xl font-semibold mb-3">
          Página não encontrada
        </h2>
        <p className="text-muted-foreground mb-8">
          Ops! Parece que este leilão já acabou ou a página que você procura não existe.
        </p>
        
        {/* CTAs úteis */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button 
            variant="outline" 
            onClick={() => navigate(-1)}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          <Button asChild className="gap-2">
            <Link to="/">
              <Home className="w-4 h-4" />
              Ir para Home
            </Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/leiloes">
              Ver Leilões Ativos
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
