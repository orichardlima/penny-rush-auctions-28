import { Header } from "@/components/Header";
import { RecentWinners } from "@/components/RecentWinners";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const Winners = () => {
  const navigate = useNavigate();
  
  const handleBuyBids = () => {
    navigate("/pacotes");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header userBids={25} onBuyBids={handleBuyBids} />
      
      <main className="py-8">
        <div className="container mx-auto px-4">
          <Link to="/">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Início
            </Button>
          </Link>
        </div>
        
        <RecentWinners />
        
        <div className="text-center py-12">
          <Link to="/leiloes">
            <Button size="xl" variant="accent">
              Participar dos Leilões
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Winners;