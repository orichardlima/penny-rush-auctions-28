import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { useReferralTracking } from "@/hooks/useReferralTracking";
import { usePartnerReferralTracking } from "@/hooks/usePartnerReferralTracking";
import { CookieConsent } from "@/components/CookieConsent";
import Index from "./pages/Index";
import Auctions from "./pages/Auctions";
import HowItWorksPage from "./pages/HowItWorks";
import BidPackagesPage from "./pages/BidPackages";
import Winners from "./pages/Winners";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

// Lazy loaded pages for better performance
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AffiliateDashboard = lazy(() => import("./pages/AffiliateDashboard"));
const PartnerLanding = lazy(() => import("./pages/PartnerLanding"));
const MinhaParceria = lazy(() => import("./pages/MinhaParceria"));
const AdminParceiros = lazy(() => import("./pages/AdminParceiros"));
const TermosDeUso = lazy(() => import("./pages/TermosDeUso"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Contato = lazy(() => import("./pages/Contato"));

const queryClient = new QueryClient();

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-muted-foreground">Carregando...</p>
    </div>
  </div>
);

const AppContent = () => {
  useReferralTracking();
  // Tracking global de referral de parceiro (captura ?ref=... em qualquer rota)
  usePartnerReferralTracking();
  
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/leiloes" element={<Auctions />} />
      <Route path="/como-funciona" element={<HowItWorksPage />} />
      <Route path="/pacotes" element={<BidPackagesPage />} />
      <Route path="/vencedores" element={<Winners />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/afiliado" element={<Suspense fallback={<PageLoader />}><AffiliateDashboard /></Suspense>} />
      <Route path="/parceiro" element={<Suspense fallback={<PageLoader />}><PartnerLanding /></Suspense>} />
      <Route path="/investir" element={<Navigate to="/parceiro" replace />} />
      <Route path="/minha-parceria" element={<Suspense fallback={<PageLoader />}><MinhaParceria /></Suspense>} />
      <Route path="/admin/parceiros" element={<Suspense fallback={<PageLoader />}><AdminParceiros /></Suspense>} />
      <Route path="/reset-password" element={<Suspense fallback={<PageLoader />}><ResetPassword /></Suspense>} />
      <Route path="/termos" element={<Suspense fallback={<PageLoader />}><TermosDeUso /></Suspense>} />
      <Route path="/privacidade" element={<Suspense fallback={<PageLoader />}><PoliticaPrivacidade /></Suspense>} />
      <Route path="/faq" element={<Suspense fallback={<PageLoader />}><FAQ /></Suspense>} />
      <Route path="/contato" element={<Suspense fallback={<PageLoader />}><Contato /></Suspense>} />
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
          <CookieConsent />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
