import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { useReferralTracking } from "@/hooks/useReferralTracking";
import Index from "./pages/Index";
import Auctions from "./pages/Auctions";
import HowItWorksPage from "./pages/HowItWorks";
import BidPackagesPage from "./pages/BidPackages";
import Winners from "./pages/Winners";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ResetPassword from "./pages/ResetPassword";
import AffiliateDashboard from "./pages/AffiliateDashboard";
import PartnerLanding from "./pages/PartnerLanding";
import MinhaParceria from "./pages/MinhaParceria";
import AdminParceiros from "./pages/AdminParceiros";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  useReferralTracking();
  
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/leiloes" element={<Auctions />} />
      <Route path="/como-funciona" element={<HowItWorksPage />} />
      <Route path="/pacotes" element={<BidPackagesPage />} />
      <Route path="/vencedores" element={<Winners />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/afiliado" element={<AffiliateDashboard />} />
      <Route path="/parceiro" element={<PartnerLanding />} />
      <Route path="/investir" element={<Navigate to="/parceiro" replace />} />
      <Route path="/minha-parceria" element={<MinhaParceria />} />
      <Route path="/admin/parceiros" element={<AdminParceiros />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
