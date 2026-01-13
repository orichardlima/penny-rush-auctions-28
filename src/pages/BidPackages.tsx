import { useState } from "react";
import { Header } from "@/components/Header";
import { BidPackages as BidPackagesComponent } from "@/components/BidPackages";
import { PixPaymentModal } from "@/components/PixPaymentModal";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { usePurchaseProcessor } from "@/hooks/usePurchaseProcessor";
import { useAuth } from "@/contexts/AuthContext";

const BidPackagesPage = () => {
  const { processPurchase } = usePurchaseProcessor();
  const { refreshProfile } = useAuth();
  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    paymentData?: any;
    packageInfo?: any;
    purchaseId?: string;
  }>({ open: false });

  const handleBuyBids = () => {
    // Already on this page, scroll to packages
    document.getElementById('pacotes')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handlePurchasePackage = async (packageId: string, bids: number, price: number, packageName: string) => {
    const result = await processPurchase(packageId, bids, price);
    if (result.success && result.paymentData) {
      setPaymentModal({
        open: true,
        paymentData: result.paymentData,
        packageInfo: {
          name: packageName,
          price,
          bidsCount: bids
        },
        purchaseId: result.purchaseId
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header onBuyBids={handleBuyBids} />
      
      <main className="py-8 flex-1">
        <div className="container mx-auto px-4">
          <Link to="/">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Início
            </Button>
          </Link>
        </div>
        
        <BidPackagesComponent onPurchase={handlePurchasePackage} />
        
        {paymentModal.open && paymentModal.paymentData && paymentModal.packageInfo && paymentModal.purchaseId && (
          <PixPaymentModal
            open={paymentModal.open}
            onClose={() => setPaymentModal({ open: false })}
            paymentData={paymentModal.paymentData}
            packageInfo={paymentModal.packageInfo}
            purchaseId={paymentModal.purchaseId}
            onSuccess={refreshProfile}
          />
        )}
        
        <div className="text-center py-12">
          <Link to="/leiloes">
            <Button size="xl" variant="accent">
              Ir para Leilões
            </Button>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default BidPackagesPage;
