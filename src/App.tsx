import { lazy, Suspense, Component, useState, useEffect, useCallback } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuctionRealtimeProvider } from "@/contexts/AuctionRealtimeContext";
import { useReferralTracking } from "@/hooks/useReferralTracking";
import { usePartnerReferralTracking } from "@/hooks/usePartnerReferralTracking";
import { useRealTimeProtection } from "@/hooks/useRealTimeProtection";
import { useProfileCompleteGuard } from "@/hooks/useProfileCompleteGuard";
import { CookieConsent } from "@/components/CookieConsent";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { logChunkError, markReloadAttempted, wasReloadRecent } from "@/utils/chunkErrorTelemetry";
import Index from "./pages/Index";
import { ContractReacceptGuard } from "@/components/ContractReacceptGuard";

// --- lazyWithRetry: retry automático em falha de import ---
function lazyWithRetry(importFn: () => Promise<{ default: React.ComponentType<any> }>) {
  return lazy(() =>
    importFn().catch((error) => {
      logChunkError(error, 'lazyWithRetry');

      if (!wasReloadRecent()) {
        markReloadAttempted();
        window.location.reload();
        // Retorna componente vazio enquanto recarrega
        return { default: () => null } as { default: React.ComponentType<any> };
      }

      // Já tentou reload, propagar erro para o ErrorBoundary
      throw error;
    })
  );
}

// --- ChunkErrorBoundary ---
interface ChunkErrorBoundaryState {
  hasError: boolean;
}

class ChunkErrorBoundary extends Component<{ children: ReactNode }, ChunkErrorBoundaryState> {
  state: ChunkErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ChunkErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logChunkError(error, 'ChunkErrorBoundary');
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="text-center max-w-md">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Página não carregou
            </h2>
            <p className="text-muted-foreground mb-6">
              Isso pode acontecer após uma atualização da plataforma. 
              Recarregue a página para resolver.
            </p>
            <button
              onClick={() => {
                sessionStorage.removeItem('chunk-reload-attempted');
                sessionStorage.removeItem('chunk-reload-time');
                window.location.reload();
              }}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- PageLoader com timeout ---
const PageLoader = () => {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 15000);
    return () => clearTimeout(timer);
  }, []);

  if (timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">⏳</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Carregamento lento
          </h2>
          <p className="text-muted-foreground mb-6">
            A página está demorando mais que o esperado. 
            Tente recarregar.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Recarregar página
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
};

// Helper para envolver rota lazy com ErrorBoundary + Suspense
const LazyRoute = ({ children }: { children: ReactNode }) => (
  <ChunkErrorBoundary>
    <Suspense fallback={<PageLoader />}>
      {children}
    </Suspense>
  </ChunkErrorBoundary>
);

// Lazy loaded pages com retry
const Auctions = lazyWithRetry(() => import("./pages/Auctions"));
const HowItWorksPage = lazyWithRetry(() => import("./pages/HowItWorks"));
const BidPackagesPage = lazyWithRetry(() => import("./pages/BidPackages"));
const Winners = lazyWithRetry(() => import("./pages/Winners"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const AuthCallback = lazyWithRetry(() => import("./pages/AuthCallback"));
const CompleteProfile = lazyWithRetry(() => import("./pages/CompleteProfile"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const AffiliateDashboard = lazyWithRetry(() => import("./pages/AffiliateDashboard"));
const PartnerLanding = lazyWithRetry(() => import("./pages/PartnerLanding"));
const InvestirRedirect = lazyWithRetry(() => import("./pages/InvestirRedirect"));
const MinhaParceria = lazyWithRetry(() => import("./pages/MinhaParceria"));
const MeusContratos = lazyWithRetry(() => import("./pages/MeusContratos"));

const MinhaParceriaEncerramento = lazyWithRetry(() => import("./pages/MinhaParceriaEncerramento"));

const AdminParceiros = lazyWithRetry(() => import("./pages/AdminParceiros"));
const AdminCentralPerformance = lazyWithRetry(() => import("./pages/AdminCentralPerformance"));
const TermosDeUso = lazyWithRetry(() => import("./pages/TermosDeUso"));
const PoliticaPrivacidade = lazyWithRetry(() => import("./pages/PoliticaPrivacidade"));
const FAQ = lazyWithRetry(() => import("./pages/FAQ"));
const Contato = lazyWithRetry(() => import("./pages/Contato"));
const Downloads = lazyWithRetry(() => import("./pages/Downloads"));
const ReferralRedirect = lazyWithRetry(() => import("./pages/ReferralRedirect"));
const PartnerGuide = lazyWithRetry(() => import("./pages/PartnerGuide"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
});

const AppContent = () => {
  useReferralTracking();
  usePartnerReferralTracking();
  useRealTimeProtection();
  useProfileCompleteGuard();
  
  return (
    <ContractReacceptGuard>
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/leiloes" element={<LazyRoute><Auctions /></LazyRoute>} />
      <Route path="/como-funciona" element={<LazyRoute><HowItWorksPage /></LazyRoute>} />
      <Route path="/pacotes" element={<LazyRoute><BidPackagesPage /></LazyRoute>} />
      <Route path="/vencedores" element={<LazyRoute><Winners /></LazyRoute>} />
      <Route path="/auth" element={<LazyRoute><Auth /></LazyRoute>} />
      <Route path="/auth/callback" element={<LazyRoute><AuthCallback /></LazyRoute>} />
      <Route path="/complete-profile" element={<LazyRoute><CompleteProfile /></LazyRoute>} />
      <Route path="/dashboard" element={<LazyRoute><Dashboard /></LazyRoute>} />
      <Route path="/afiliado" element={<LazyRoute><AffiliateDashboard /></LazyRoute>} />
      <Route path="/parceiro" element={<LazyRoute><PartnerLanding /></LazyRoute>} />
      <Route path="/investir" element={<LazyRoute><InvestirRedirect /></LazyRoute>} />
      <Route path="/minha-parceria" element={<LazyRoute><MinhaParceria /></LazyRoute>} />
      <Route path="/minha-parceria/encerramento" element={<LazyRoute><MinhaParceriaEncerramento /></LazyRoute>} />
      <Route path="/meus-contratos" element={<LazyRoute><MeusContratos /></LazyRoute>} />


      <Route path="/admin/parceiros" element={<LazyRoute><AdminParceiros /></LazyRoute>} />
      <Route path="/admin/central-performance" element={<LazyRoute><AdminCentralPerformance /></LazyRoute>} />
      <Route path="/reset-password" element={<LazyRoute><ResetPassword /></LazyRoute>} />
      <Route path="/termos" element={<LazyRoute><TermosDeUso /></LazyRoute>} />
      <Route path="/privacidade" element={<LazyRoute><PoliticaPrivacidade /></LazyRoute>} />
      <Route path="/faq" element={<LazyRoute><FAQ /></LazyRoute>} />
      <Route path="/contato" element={<LazyRoute><Contato /></LazyRoute>} />
      <Route path="/downloads" element={<LazyRoute><Downloads /></LazyRoute>} />
      <Route path="/r/:code" element={<LazyRoute><ReferralRedirect /></LazyRoute>} />
      <Route path="/guia-parceiro" element={<LazyRoute><PartnerGuide /></LazyRoute>} />
      <Route path="*" element={<LazyRoute><NotFound /></LazyRoute>} />
    </Routes>
    </ContractReacceptGuard>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AuctionRealtimeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ImpersonationBanner />
            <AppContent />
            <CookieConsent />
          </BrowserRouter>
        </TooltipProvider>
      </AuctionRealtimeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
