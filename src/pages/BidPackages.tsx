import { useState } from "react";
import { Header } from "@/components/Header";
import { BidPackages as BidPackagesComponent } from "@/components/BidPackages";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { usePurchaseProcessor } from "@/hooks/usePurchaseProcessor";
import { useAuth } from "@/contexts/AuthContext";

const BidPackagesPage = () => {
  const { toast } = useToast();
  const { processPurchase, processing } = usePurchaseProcessor();
  const { refreshProfile } = useAuth();

  const handleBuyBids = () => {
    // Already on this page, scroll to packages
    document.getElementById('pacotes')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handlePurchasePackage = async (packageId: string, bids: number, price: number) => {
    const result = await processPurchase(packageId, bids, price);
    if (result.success) {
      await refreshProfile();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onBuyBids={handleBuyBids} />
      
      <main className="py-8">
        <div className="container mx-auto px-4">
          <Link to="/">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Início
            </Button>
          </Link>
        </div>
        
        <BidPackagesComponent onPurchase={handlePurchasePackage} />
        
        <div className="text-center py-12">
          <Link to="/leiloes">
            <Button size="xl" variant="accent">
              Ir para Leilões
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default BidPackagesPage;