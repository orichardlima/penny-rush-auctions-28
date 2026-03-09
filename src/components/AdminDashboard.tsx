import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger } from
'@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  User,
  Bot,
  Package,
  DollarSign,
  Target,
  Users,
  Edit,
  Trash2,
  Plus,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  Play,
  Pause,
  RefreshCw,
  Settings,
  BarChart3,
  Calendar,
  Eye,
  EyeOff,
  TrendingUp,
  Filter,
  Search,
  Download,
  Shield,
  Brain,
  Pencil } from
'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { FinancialSummaryCards } from '@/components/FinancialAnalytics/FinancialSummaryCards';
import { useFinancialAnalytics } from '@/hooks/useFinancialAnalytics';
import AuctionParticipantsTable from '@/components/AuctionParticipantsTable';
import { AuctionDetailView } from '@/components/AuctionDetailView';
import { AdminFinancialOverview } from '@/components/AdminFinancialOverview';
import UserProfileCard from '@/components/UserProfileCard';
import AdvancedAnalytics from '@/components/AdvancedAnalytics';
import ActivityHeatmap from '@/components/ActivityHeatmap';
import AuditLogTable from '@/components/AuditLogTable';
import { BidPackageFormDialog } from '@/components/BidPackageFormDialog';
import { AdminUserActions } from '@/components/AdminUserManagement';
import { AdminAuditLog } from '@/components/AdminAuditLog';
import { processImageFile, createImagePreview, AUCTION_CARD_OPTIONS } from '@/utils/imageUtils';
import { ImageUploadPreview } from '@/components/ImageUploadPreview';
import { SystemSettings } from '@/components/SystemSettings';
import { AdminOrdersManagement } from '@/components/AdminOrdersManagement';
import { AuctionHistory } from '@/components/AuctionHistory';
import { AdminAffiliateManagement } from '@/components/AdminAffiliateManagement';
import { ProductTemplatesManager } from '@/components/Admin/ProductTemplatesManager';
import AdminPartnerManagement from '@/components/Admin/AdminPartnerManagement';
import { Footer } from '@/components/Footer';
import { Handshake, LayoutTemplate, Wallet, Flame } from 'lucide-react';
import { FuryVaultConfigManager } from '@/components/Admin/FuryVaultConfigManager';

interface Auction {
  id: string;
  title: string;
  description: string;
  image_url: string;
  current_price: number;
  starting_price: number;
  market_value: number;
  revenue_target: number;
  total_bids: number;
  time_left: number;
  status: string;
  winner_name?: string;
  winner_id?: string;
  participants_count: number;
  finished_at?: string;
  ends_at?: string;
  company_revenue: number;
  created_at: string;
  starts_at: string;
  is_hidden?: boolean;
}

interface User {
  user_id: string;
  full_name: string;
  email: string;
  is_admin: boolean;
  is_bot: boolean;
  is_blocked?: boolean;
  block_reason?: string;
  bids_balance: number;
  created_at: string;
}

interface BidPackage {
  id: string;
  name: string;
  bids_count: number;
  price: number;
  original_price?: number;
  icon?: string;
  is_popular: boolean;
  features: string[];
  created_at: string;
}

const AdminDashboard = () => {
  const { signOut, user: currentUser } = useAuth();

  // Financial analytics hook - moved to top to fix hooks order
  const {
    summary,
    auctionDetails,
    revenueTrends,
    loading: analyticsLoading,
    error: analyticsError,
    refreshData: refreshAnalytics
  } = useFinancialAnalytics();

  // Estados para novas funcionalidades
  const [selectedAuctionForDetails, setSelectedAuctionForDetails] = useState<string | null>(null);
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<User | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'real' | 'bot' | 'vip' | 'active'>('all');
  const [auctionStatusFilter, setAuctionStatusFilter] = useState<'all' | 'active' | 'finished'>('all');

  // Estados existentes
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [realUsers, setRealUsers] = useState<User[]>([]);
  const [botUsers, setBotUsers] = useState<User[]>([]);
  const [bidPackages, setBidPackages] = useState<BidPackage[]>([]);
  const [loading, setLoading] = useState(true);

  // Computed: Leilões filtrados para a seção de detalhes
  const filteredAuctionsForDetails = useMemo(() => {
    if (auctionStatusFilter === 'all') return auctions;
    return auctions.filter((auction) => auction.status === auctionStatusFilter);
  }, [auctions, auctionStatusFilter]);

  // Helper function para criar timestamp inicial (local)
  const getInitialStartTime = () => {
    const now = new Date();
    const future = new Date(now.getTime() + 60 * 1000); // 1 minuto no futuro
    return future.toISOString().slice(0, 16);
  };

  const [newAuction, setNewAuction] = useState({
    title: '',
    description: '',
    image_url: '',
    starting_price: 0.01, // Valor padrão em centavos
    market_value: 0.00, // Agora em reais
    revenue_target: 0.00, // Agora em reais
    starts_at: getInitialStartTime()
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingAuction, setEditingAuction] = useState<Auction | null>(null);
  const [editingImage, setEditingImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedAuctions, setSelectedAuctions] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isDeletingUsers, setIsDeletingUsers] = useState(false);

  // Bid Package Management States
  const [isPackageDialogOpen, setIsPackageDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<BidPackage | null>(null);

  // Funções para seleção múltipla de leilões
  const handleSelectAuction = (auctionId: string, checked: boolean) => {
    const newSelected = new Set(selectedAuctions);
    if (checked) {
      newSelected.add(auctionId);
    } else {
      newSelected.delete(auctionId);
    }
    setSelectedAuctions(newSelected);
  };

  const handleSelectAllAuctions = (checked: boolean) => {
    if (checked) {
      setSelectedAuctions(new Set(auctions.map((a) => a.id)));
    } else {
      setSelectedAuctions(new Set());
    }
  };

  const deleteSelectedAuctions = async () => {
    if (selectedAuctions.size === 0) return;

    const confirmed = window.confirm(`Tem certeza que deseja excluir ${selectedAuctions.size} leilão(ões)? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase.
      from('auctions').
      delete().
      in('id', Array.from(selectedAuctions));

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `${selectedAuctions.size} leilão(ões) excluído(s) com sucesso!`
      });

      setSelectedAuctions(new Set());
      fetchAdminData();
    } catch (error) {
      console.error('Error deleting auctions:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir leilões selecionados",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Funções para seleção múltipla de usuários
  const handleSelectUser = (userId: string, checked: boolean) => {
    const newSelected = new Set(selectedUsers);
    if (checked) {
      newSelected.add(userId);
    } else {
      newSelected.delete(userId);
    }
    setSelectedUsers(newSelected);
  };



  useEffect(() => {
    fetchAdminData();
  }, []);

  // Sincronizar selectedUserForProfile com dados atualizados
  useEffect(() => {
    if (selectedUserForProfile && (realUsers.length > 0 || botUsers.length > 0)) {
      // Buscar o usuário atualizado nos dados mais recentes
      const updatedUser = [...realUsers, ...botUsers].find(
        (user) => user.user_id === selectedUserForProfile.user_id
      );

      // Só atualizar se realmente encontrou o usuário e os dados são diferentes
      if (updatedUser && (
      updatedUser.bids_balance !== selectedUserForProfile.bids_balance ||
      updatedUser.is_blocked !== selectedUserForProfile.is_blocked ||
      updatedUser.block_reason !== selectedUserForProfile.block_reason))
      {
        console.log(`🔄 Sincronizando dados do usuário: ${updatedUser.full_name} - Saldo: R$ ${updatedUser.bids_balance}`);
        setSelectedUserForProfile(updatedUser);
      }
    }
  }, [realUsers, botUsers]); // Removida a dependência selectedUserForProfile?.user_id

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // Fetch auctions
      const { data: auctionsData, error: auctionsError } = await supabase.
      from('auctions').
      select('*').
      order('created_at', { ascending: false });


      if (auctionsError) throw auctionsError;

      const cleanAuctions = (auctionsData || []).filter(
        (a) => !(a.status === 'finished' && ((a.total_bids ?? 0) <= 0))
      );
      setAuctions(cleanAuctions);

      // Fetch real users
      const { data: realUsersData, error: realUsersError } = await supabase.
      from('profiles').
      select('user_id, full_name, email, is_admin, is_bot, is_blocked, block_reason, bids_balance, created_at').
      eq('is_bot', false).
      order('created_at', { ascending: false });

      if (realUsersError) throw realUsersError;
      setRealUsers(realUsersData || []);

      // Fetch bot users
      const { data: botUsersData, error: botUsersError } = await supabase.
      from('profiles').
      select('user_id, full_name, email, is_admin, is_bot, is_blocked, block_reason, bids_balance, created_at').
      eq('is_bot', true).
      order('created_at', { ascending: false });

      if (botUsersError) throw botUsersError;
      setBotUsers(botUsersData || []);

      // Fetch bid packages
      const { data: packagesData, error: packagesError } = await supabase.
      from('bid_packages').
      select('*').
      order('created_at', { ascending: false });

      if (packagesError) throw packagesError;
      setBidPackages(packagesData || []);

    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados administrativos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    try {
      // Processar imagem especificamente para cards de leilão
      const optimizedFile = await processImageFile(file, AUCTION_CARD_OPTIONS);

      const fileName = `${Date.now()}-${optimizedFile.name}`;
      const { data, error } = await supabase.storage.
      from('auction-images').
      upload(fileName, optimizedFile);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.
      from('auction-images').
      getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading optimized image:', error);
      // Fallback para upload da imagem original se a otimização falhar
      const fileName = `${Date.now()}-${file.name}`;
      const { data, error: uploadError } = await supabase.storage.
      from('auction-images').
      upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.
      from('auction-images').
      getPublicUrl(fileName);

      return publicUrl;
    }
  };

  // Helper function para formatar preços em reais
  const formatPrice = (priceInReais: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(priceInReais || 0);
  };

  const createAuction = async () => {
    if (!newAuction.title || !newAuction.description) {
      toast({
        title: "Erro",
        description: "Título e descrição são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    // Validar horário de início (tratando como horário brasileiro)
    const brazilTimezone = 'America/Sao_Paulo';
    const inputTime = new Date(newAuction.starts_at); // Input datetime-local como horário brasileiro
    const utcStartTime = fromZonedTime(inputTime, brazilTimezone); // Converter para UTC
    const now = new Date();
    const minimumTime = new Date(now.getTime() + 60 * 1000); // 1 minuto no futuro

    if (utcStartTime <= minimumTime) {
      toast({
        title: "Erro",
        description: "O horário de início deve ser pelo menos 1 minuto no futuro",
        variant: "destructive"
      });
      return;
    }

    console.log(`🕒 [AUCTION-CREATE] Criando leilão:`);
    console.log(`   Input (horário BR): ${newAuction.starts_at}`);
    console.log(`   UTC para salvar: ${utcStartTime.toISOString()}`);

    setUploading(true);
    try {
      let imageUrl = newAuction.image_url;

      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
      }

      // Criar leilão com status "waiting" - será ativado automaticamente pelo timer
      const auctionData = {
        ...newAuction,
        image_url: imageUrl,
        current_price: newAuction.starting_price,
        status: 'waiting',
        starts_at: utcStartTime.toISOString() // Salvar em UTC
      };

      const { error } = await supabase.
      from('auctions').
      insert([auctionData]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Leilão criado com sucesso!"
      });

      // Reset form
      setNewAuction({
        title: '',
        description: '',
        image_url: '',
        starting_price: 0.01,
        market_value: 0.00,
        revenue_target: 0.00,
        starts_at: getInitialStartTime()
      });
      setSelectedImage(null);

      fetchAdminData();
    } catch (error) {
      console.error('Error creating auction:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar leilão",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  // Função para deletar leilão
  const deleteAuction = async (auctionId: string) => {
    try {
      const { error } = await supabase.
      from('auctions').
      delete().
      eq('id', auctionId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Leilão deletado com sucesso!"
      });

      fetchAdminData();
    } catch (error) {
      console.error('Error deleting auction:', error);
      toast({
        title: "Erro",
        description: "Erro ao deletar leilão",
        variant: "destructive"
      });
    }
  };

  // Função para ocultar/mostrar leilão
  const toggleAuctionVisibility = async (auctionId: string, hide: boolean) => {
    try {
      const { error } = await supabase.
      from('auctions').
      update({ is_hidden: hide }).
      eq('id', auctionId);

      if (error) throw error;

      toast({
        title: hide ? "Leilão ocultado" : "Leilão visível",
        description: hide ?
        "O leilão não será mais exibido na home." :
        "O leilão voltou a ser exibido na home."
      });

      fetchAdminData();
    } catch (error) {
      console.error('Error toggling auction visibility:', error);
      toast({
        title: "Erro",
        description: "Erro ao alterar visibilidade do leilão",
        variant: "destructive"
      });
    }
  };

  // Função para processar seleção de nova imagem
  const handleImageSelection = async (file: File | null) => {
    if (!file) {
      setEditingImage(null);
      setImagePreview(null);
      return;
    }

    setImageProcessing(true);
    try {
      // Criar preview da imagem selecionada
      const preview = await createImagePreview(file);
      setImagePreview(preview);
      setEditingImage(file);
    } catch (error) {
      console.error('Error creating image preview:', error);
      toast({
        title: "Erro",
        description: "Erro ao processar imagem selecionada",
        variant: "destructive"
      });
    } finally {
      setImageProcessing(false);
    }
  };

  // Função para atualizar leilão
  const updateAuction = async () => {
    if (!editingAuction) return;

    setUploading(true);
    try {
      let updateData: any = {
        title: editingAuction.title,
        description: editingAuction.description,
        starting_price: editingAuction.starting_price,
        market_value: editingAuction.market_value,
        revenue_target: editingAuction.revenue_target
      };

      // Se uma nova imagem foi selecionada, fazer upload
      if (editingImage) {
        const newImageUrl = await uploadImage(editingImage);
        updateData.image_url = newImageUrl;

        // Opcional: Remover imagem antiga do storage
        if (editingAuction.image_url) {
          try {
            const oldFileName = editingAuction.image_url.split('/').pop();
            if (oldFileName) {
              await supabase.storage.
              from('auction-images').
              remove([oldFileName]);
            }
          } catch (err) {
            console.warn('Erro ao remover imagem antiga:', err);
          }
        }
      }

      const { error } = await supabase.
      from('auctions').
      update(updateData).
      eq('id', editingAuction.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Leilão atualizado com sucesso!"
      });

      // Limpar estados
      setIsEditDialogOpen(false);
      setEditingAuction(null);
      setEditingImage(null);
      setImagePreview(null);
      fetchAdminData();
    } catch (error) {
      console.error('Error updating auction:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao atualizar leilão",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const toggleUserAdmin = async (userId: string, currentIsAdmin: boolean) => {
    try {
      const { error } = await supabase.
      from('profiles').
      update({ is_admin: !currentIsAdmin }).
      eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Status de admin ${!currentIsAdmin ? 'ativado' : 'desativado'} com sucesso!`
      });

      fetchAdminData();
    } catch (error) {
      console.error('Error toggling admin:', error);
      toast({
        title: "Erro",
        description: "Erro ao alterar status de admin",
        variant: "destructive"
      });
    }
  };

  // Bid Package CRUD Functions
  const handleCreatePackage = () => {
    setEditingPackage(null);
    setIsPackageDialogOpen(true);
  };

  const handleEditPackage = (pkg: BidPackage) => {
    setEditingPackage(pkg);
    setIsPackageDialogOpen(true);
  };

  const handleDeletePackage = async (pkg: BidPackage) => {
    if (!confirm(`Tem certeza que deseja deletar o pacote "${pkg.name}"? Isso também removerá todas as compras associadas.`)) {
      return;
    }

    try {
      // Admin tem plenos poderes - deletar compras associadas primeiro
      const { error: purchaseDeleteError } = await supabase.
      from('bid_purchases').
      delete().
      eq('package_id', pkg.id);

      if (purchaseDeleteError) {
        console.warn('Erro ao deletar compras associadas:', purchaseDeleteError);
        // Continuar mesmo se não houver compras para deletar
      }

      // Agora deletar o pacote
      const { error } = await supabase.
      from('bid_packages').
      delete().
      eq('id', pkg.id);

      if (error) throw error;

      toast({
        title: "Pacote deletado!",
        description: `${pkg.name} foi removido com sucesso (incluindo compras associadas).`
      });

      fetchAdminData();
    } catch (error) {
      console.error('Erro ao deletar pacote:', error);
      toast({
        title: "Erro!",
        description: "Não foi possível deletar o pacote.",
        variant: "destructive"
      });
    }
  };

  const handlePackageSuccess = () => {
    // Não precisa chamar fetchAdminData() aqui porque o useFinancialAnalytics
    // já está escutando mudanças via realtime e vai refresh automaticamente
    console.log('[AdminDashboard] Pacote atualizado com sucesso - realtime vai fazer o refresh');
  };

  // Função removida - usando a função formatPrice já definida acima

  // Função para formatar datetime-local (simples)
  const formatDateTimeLocal = (dateTimeString: string) => {
    // Se já está no formato correto, retorna diretamente
    if (dateTimeString && dateTimeString.includes('T') && dateTimeString.length >= 16) {
      return dateTimeString.slice(0, 16);
    }

    // Se for uma data ISO, converte para local
    const date = new Date(dateTimeString);
    return date.toISOString().slice(0, 16);
  };

  const formatDateTime = (dateString: string) => {
    const brazilTimezone = 'America/Sao_Paulo';
    const utcDate = new Date(dateString);
    const brazilDate = toZonedTime(utcDate, brazilTimezone);
    return brazilDate.toLocaleString('pt-BR');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>);

  }

  // Combinar todos os usuários (reais + bots)
  const allUsers = [...realUsers, ...botUsers];

  // Filtrar usuários combinados
  const filteredUsers = allUsers.filter((user) => {
    const matchesSearch = user.full_name?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(userSearchTerm.toLowerCase());

    if (userFilter === 'all') return matchesSearch;
    if (userFilter === 'real') return matchesSearch && !user.is_bot;
    if (userFilter === 'bot') return matchesSearch && user.is_bot;
    if (userFilter === 'vip') {
      // Implementar lógica VIP baseada em critérios específicos
      // Por exemplo: usuários que gastaram mais de R$ 100
      return matchesSearch && !user.is_bot; // Placeholder - pode ser implementado com dados de compras
    }
    if (userFilter === 'active') {
      // Implementar lógica de usuários ativos
      // Por exemplo: usuários que fizeram lances recentemente
      return matchesSearch && !user.is_bot; // Placeholder - pode ser implementado com dados de atividade
    }
    return matchesSearch;
  });

  const selectableUsers = filteredUsers.filter(
    (u) => !u.is_admin && u.user_id !== currentUser?.id
  );

  const handleSelectAllUsers = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(new Set(selectableUsers.map((u) => u.user_id)));
    } else {
      setSelectedUsers(new Set());
    }
  };

  const deleteSelectedUsers = async () => {
    if (selectedUsers.size === 0) return;

    setIsDeletingUsers(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const { data: { session } } = await supabase.auth.getSession();

      for (const userId of Array.from(selectedUsers)) {
        try {
          const { data, error } = await supabase.functions.invoke('admin-delete-user', {
            body: { userId },
            headers: {
              Authorization: `Bearer ${session?.access_token}`
            }
          });

          if (error) throw error;
          if (data?.error) throw new Error(data.error);

          successCount++;
        } catch (err: any) {
          console.error(`Error deleting user ${userId}:`, err);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: "Exclusão concluída",
          description: failCount > 0 ?
          `${successCount} usuário(s) excluído(s) com sucesso. ${failCount} falha(s).` :
          `${successCount} usuário(s) excluído(s) com sucesso!`
        });
      }

      if (failCount > 0 && successCount === 0) {
        toast({
          title: "Erro",
          description: "Nenhum usuário pôde ser excluído.",
          variant: "destructive"
        });
      }

      setSelectedUsers(new Set());
      fetchAdminData();
    } catch (error) {
      console.error('Error in batch delete:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir usuários selecionados",
        variant: "destructive"
      });
    } finally {
      setIsDeletingUsers(false);
    }
  };

  const refreshData = () => {
    fetchAdminData();
    refreshAnalytics();
  };

  const totalRevenue = bidPackages.reduce((sum, pkg) => sum + pkg.price * 10, 0);
  const activeAuctions = auctions.filter((a) => a.status === 'active').length;
  const totalUsers = (realUsers || []).length + (botUsers || []).length;
  const totalBids = auctions.reduce((sum, auction) => sum + auction.total_bids, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Painel Administrativo Profissional
            </h1>
            <p className="text-muted-foreground mt-2">
              Dashboard completo com analytics avançados e controle total
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refreshData} disabled={analyticsLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${analyticsLoading ? 'animate-spin' : ''}`} />
              Atualizar Dados
            </Button>
            <Button variant="destructive" onClick={signOut}>
              Sair
            </Button>
          </div>
        </div>

        {/* Métricas resumo melhoradas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usuários Totais</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{totalUsers}</div>
              

              
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leilões Ativos</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{activeAuctions}</div>
              <p className="text-xs text-muted-foreground">
                Total de leilões: {auctions.length}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Lances</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{totalBids}</div>
              <p className="text-xs text-muted-foreground">
                Atividade total do sistema
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Estimada</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                R$ {summary?.total_revenue?.toFixed(2) || totalRevenue.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                Baseado nos dados atuais
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Nova estrutura de tabs melhorada */}
        <Tabs defaultValue="auction-details" className="space-y-6">
          <TabsList className="flex w-full overflow-x-auto lg:grid lg:grid-cols-13 gap-1 pb-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
            <TabsTrigger value="auction-details" title="Detalhes" className="flex items-center gap-2 shrink-0">
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Detalhes</span>
            </TabsTrigger>
            <TabsTrigger value="financial" title="Financeiro" className="flex items-center gap-2 shrink-0">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Financeiro</span>
            </TabsTrigger>
            <TabsTrigger value="orders" title="Pedidos" className="flex items-center gap-2 shrink-0">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Pedidos</span>
            </TabsTrigger>
            <TabsTrigger value="partners" title="Parceiros" className="flex items-center gap-2 shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Parceiros</span>
            </TabsTrigger>
            <TabsTrigger value="affiliates" title="Afiliados" className="flex items-center gap-2 shrink-0">
              <Handshake className="h-4 w-4" />
              <span className="hidden sm:inline">Afiliados</span>
            </TabsTrigger>
            <TabsTrigger value="auctions" title="Leilões" className="flex items-center gap-2 shrink-0">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Leilões</span>
            </TabsTrigger>
            <TabsTrigger value="users" title="Usuários" className="flex items-center gap-2 shrink-0">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Usuários</span>
            </TabsTrigger>
            <TabsTrigger value="packages" title="Pacotes" className="flex items-center gap-2 shrink-0">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Pacotes</span>
            </TabsTrigger>
            <TabsTrigger value="templates" title="Templates" className="flex items-center gap-2 shrink-0">
              <LayoutTemplate className="h-4 w-4" />
              <span className="hidden sm:inline">Templates</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" title="Analytics" className="flex items-center gap-2 shrink-0">
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="audit" title="Auditoria" className="flex items-center gap-2 shrink-0">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Auditoria</span>
            </TabsTrigger>
            <TabsTrigger value="settings" title="Configurações" className="flex items-center gap-2 shrink-0">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Config</span>
            </TabsTrigger>
            <TabsTrigger value="vault-config" title="Cofre Fúria" className="flex items-center gap-2 shrink-0">
              <Flame className="h-4 w-4" />
              <span className="hidden sm:inline">Cofre</span>
            </TabsTrigger>
            <TabsTrigger value="my-history" title="Histórico" className="flex items-center gap-2 shrink-0">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
            </TabsTrigger>
          </TabsList>


          {/* Aba Unificada: Detalhes Completos do Leilão */}
          <TabsContent value="auction-details" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Detalhes Completos do Leilão</h2>
                <p className="text-muted-foreground">Visão 360° com todas as informações, métricas e participantes</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Sidebar de seleção de leilão */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Selecionar Leilão
                  </CardTitle>
                  <div className="flex gap-1 mt-2">
                    <Button
                      size="sm"
                      variant={auctionStatusFilter === 'all' ? 'default' : 'outline'}
                      onClick={() => setAuctionStatusFilter('all')}
                      className="flex-1 text-xs">
                      
                      Todos
                    </Button>
                    <Button
                      size="sm"
                      variant={auctionStatusFilter === 'active' ? 'default' : 'outline'}
                      onClick={() => setAuctionStatusFilter('active')}
                      className="flex-1 text-xs">
                      
                      Ativos
                    </Button>
                    <Button
                      size="sm"
                      variant={auctionStatusFilter === 'finished' ? 'default' : 'outline'}
                      onClick={() => setAuctionStatusFilter('finished')}
                      className="flex-1 text-xs">
                      
                      Finalizados
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredAuctionsForDetails.length === 0 ?
                  <div className="text-center text-muted-foreground py-4 text-sm">
                      Nenhum leilão {auctionStatusFilter === 'active' ? 'ativo' : auctionStatusFilter === 'finished' ? 'finalizado' : ''} encontrado
                    </div> :

                  filteredAuctionsForDetails.map((auction) =>
                  <Button
                    key={auction.id}
                    variant={selectedAuctionForDetails === auction.id ? "default" : "outline"}
                    className="w-full justify-start"
                    onClick={() => setSelectedAuctionForDetails(auction.id)}>
                    
                        <div className="text-left">
                          <div className="font-medium truncate">{auction.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {auction.total_bids} lances • {auction.status}
                          </div>
                        </div>
                      </Button>
                  )
                  }
                </CardContent>
              </Card>

              {/* View completa do leilão selecionado */}
              <div className="lg:col-span-3">
                {selectedAuctionForDetails && auctions.find((a) => a.id === selectedAuctionForDetails) ?
                <AuctionDetailView
                  auction={auctions.find((a) => a.id === selectedAuctionForDetails)!}
                  financialData={auctionDetails?.find((d) => d.auction_id === selectedAuctionForDetails)} /> :


                <Card>
                    <CardContent className="p-12 text-center">
                      <Eye className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <h3 className="font-semibold mb-2">Selecione um Leilão</h3>
                      <p className="text-muted-foreground">
                        Escolha um leilão na lista ao lado para ver a análise completa com todas as informações, métricas financeiras e participantes
                      </p>
                    </CardContent>
                  </Card>
                }
              </div>
            </div>
          </TabsContent>

          {/* Aba Financeira Administrativa */}
          <TabsContent value="financial" className="space-y-6">
            <AdminFinancialOverview auctions={auctions} users={[...realUsers, ...botUsers]} />
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-6">
            <AdminOrdersManagement />
          </TabsContent>

          {/* Auctions Tab */}
          <TabsContent value="auctions" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Gerenciar Leilões</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Leilão
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Criar Novo Leilão</DialogTitle>
                    <DialogDescription>
                      Preencha os dados do novo leilão
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Título</Label>
                      <Input
                        id="title"
                        value={newAuction.title}
                        onChange={(e) => setNewAuction({ ...newAuction, title: e.target.value })}
                        placeholder="Título do leilão" />
                      
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        value={newAuction.description}
                        onChange={(e) => setNewAuction({ ...newAuction, description: e.target.value })}
                        placeholder="Descrição detalhada" />
                      
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="image">Imagem do Produto</Label>
                      <ImageUploadPreview
                        onImageSelect={setSelectedImage}
                        maxWidth={1200}
                        maxHeight={800}
                        showCardPreview={true}
                        disabled={uploading}
                        compact={true} />
                      
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="starting_price">Preço Inicial (R$)</Label>
                        <Input
                          id="starting_price"
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={newAuction.starting_price}
                          onChange={(e) => setNewAuction({ ...newAuction, starting_price: Number(e.target.value) })}
                          placeholder="0.01" />
                        
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="market_value">Valor de Mercado (R$)</Label>
                        <Input
                          id="market_value"
                          type="number"
                          step="0.01"
                          min="0"
                          value={newAuction.market_value}
                          onChange={(e) => setNewAuction({ ...newAuction, market_value: Number(e.target.value) })}
                          placeholder="0.00" />
                        
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="revenue_target">Meta de Receita (R$)</Label>
                      <Input
                        id="revenue_target"
                        type="number"
                        step="0.01"
                        min="0"
                        value={newAuction.revenue_target}
                        onChange={(e) => setNewAuction({ ...newAuction, revenue_target: Number(e.target.value) })}
                        placeholder="0.00" />
                      
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="starts_at">Data de Início</Label>
                      <Input
                        id="starts_at"
                        type="datetime-local"
                        value={formatDateTimeLocal(newAuction.starts_at)}
                        onChange={(e) => {
                          // Armazenar o valor diretamente como string local
                          setNewAuction({ ...newAuction, starts_at: e.target.value });
                        }} />
                      
                    </div>
                    <Button onClick={createAuction} disabled={uploading} className="w-full">
                      {uploading ?
                      <>
                          <Upload className="h-4 w-4 mr-2 animate-spin" />
                          Criando...
                        </> :

                      'Criar Leilão'
                      }
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Controles de seleção múltipla */}
            {selectedAuctions.size > 0 &&
            <Card className="mb-4 border-orange-200 bg-orange-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-orange-600" />
                      <span className="font-medium text-orange-800">
                        {selectedAuctions.size} leilão(ões) selecionado(s)
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedAuctions(new Set())}>
                      
                        Limpar Seleção
                      </Button>
                      <Button
                      variant="destructive"
                      size="sm"
                      onClick={deleteSelectedAuctions}
                      disabled={isDeleting}>
                      
                        {isDeleting ?
                      <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Excluindo...
                          </> :

                      <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir Selecionados
                          </>
                      }
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            }

            <Card>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={auctions.length > 0 && selectedAuctions.size === auctions.length}
                          onCheckedChange={handleSelectAllAuctions}
                          aria-label="Selecionar todos os leilões" />
                        
                      </TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Preço Atual</TableHead>
                      <TableHead>Total de Lances</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auctions.map((auction) =>
                    <TableRow key={auction.id}>
                        <TableCell>
                          <Checkbox
                          checked={selectedAuctions.has(auction.id)}
                          onCheckedChange={(checked) => handleSelectAuction(auction.id, checked as boolean)}
                          aria-label={`Selecionar leilão ${auction.title}`} />
                        
                        </TableCell>
                        <TableCell className="font-medium">{auction.title}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Badge variant={auction.status === 'active' ? 'default' : 'secondary'}>
                              {auction.status}
                            </Badge>
                            {auction.is_hidden &&
                          <Badge variant="outline" className="text-muted-foreground">
                                <EyeOff className="h-3 w-3 mr-1" />
                                Oculto
                              </Badge>
                          }
                          </div>
                        </TableCell>
                        <TableCell>{formatPrice(auction.current_price)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {auction.total_bids}
                            {auction.status === 'finished' && auction.total_bids === 0 && (
                              <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                Fantasma
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatDateTime(auction.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {auction.status === 'finished' &&
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleAuctionVisibility(auction.id, !auction.is_hidden)}
                            title={auction.is_hidden ? 'Mostrar na home' : 'Ocultar da home'}>
                            
                                {auction.is_hidden ?
                            <Eye className="h-4 w-4" /> :

                            <EyeOff className="h-4 w-4" />
                            }
                              </Button>
                          }
                            <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingAuction(auction);
                              setEditingImage(null);
                              setImagePreview(null);
                              setIsEditDialogOpen(true);
                            }}>
                            
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Deletar Leilão</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja deletar o leilão "{auction.title}"? Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                  onClick={() => deleteAuction(auction.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  
                                    Deletar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba de Templates de Produtos */}
          <TabsContent value="templates" className="space-y-6">
            <ProductTemplatesManager />
          </TabsContent>

          {/* Aba de Usuários melhorada */}
          <TabsContent value="users" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Gestão de Usuários</h2>
                <p className="text-muted-foreground">Controle completo de usuários reais e bots</p>
              </div>
              <div className="flex gap-2 text-sm text-muted-foreground">
                <span>{filteredUsers.length} usuários filtrados</span>
              </div>
            </div>

            {/* Controles de filtro e busca */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex items-center gap-2 flex-1">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="max-w-md" />
                
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={userFilter} onValueChange={(value) => setUserFilter(value as any)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="real">Usuários Reais</SelectItem>
                    <SelectItem value="bot">Bots</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Controles de seleção múltipla de usuários */}
            {selectedUsers.size > 0 &&
            <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-orange-600" />
                      <span className="font-medium text-orange-800">
                        {selectedUsers.size} usuário(s) selecionado(s)
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedUsers(new Set())}>
                      
                        Limpar Seleção
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                          variant="destructive"
                          size="sm"
                          disabled={isDeletingUsers}>
                          
                            {isDeletingUsers ?
                          <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Excluindo...
                              </> :

                          <>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir Selecionados
                              </>
                          }
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar exclusão em lote</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir permanentemente {selectedUsers.size} usuário(s)? 
                              Esta ação não pode ser desfeita. Todos os dados relacionados (lances, compras, pedidos, afiliados, contratos) serão removidos.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                            onClick={deleteSelectedUsers}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            
                              Excluir {selectedUsers.size} usuário(s)
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            }

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Lista de usuários */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Usuários ({filteredUsers.length})
                  </CardTitle>
                  {selectableUsers.length > 0 &&
                  <div className="flex items-center gap-2 pt-2">
                      <Checkbox
                      checked={selectableUsers.length > 0 && selectableUsers.every((u) => selectedUsers.has(u.user_id))}
                      onCheckedChange={handleSelectAllUsers}
                      aria-label="Selecionar todos os usuários" />
                    
                      <span className="text-xs text-muted-foreground">Selecionar todos</span>
                    </div>
                  }
                </CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredUsers.map((user) => {
                    const isSelectable = !user.is_admin && user.user_id !== currentUser?.id;
                    return (
                      <div key={user.user_id} className="flex items-center gap-2">
                        {isSelectable ?
                        <Checkbox
                          checked={selectedUsers.has(user.user_id)}
                          onCheckedChange={(checked) => handleSelectUser(user.user_id, checked as boolean)}
                          aria-label={`Selecionar ${user.full_name || user.email}`}
                          className="shrink-0" /> :


                        <div className="w-4 shrink-0" />
                        }
                        <Button
                          variant={selectedUserForProfile?.user_id === user.user_id ? "default" : "outline"}
                          className="w-full justify-start"
                          onClick={() => setSelectedUserForProfile(user)}>
                          
                          <div className="text-left">
                            <div className="font-medium flex items-center gap-2">
                              {user.full_name || 'Usuário'}
                              {user.is_bot && <Bot className="h-3 w-3 text-orange-500" />}
                              {user.is_admin && <Shield className="h-3 w-3 text-blue-500" />}
                            </div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </Button>
                      </div>);

                  })}
                </CardContent>
              </Card>

              {/* Perfil do usuário selecionado */}
              <div className="lg:col-span-2">
                {selectedUserForProfile ?
                <UserProfileCard
                  userId={selectedUserForProfile.user_id}
                  userName={selectedUserForProfile.full_name || 'Usuário'}
                  userEmail={selectedUserForProfile.email}
                  userBalance={selectedUserForProfile.bids_balance}
                  onUserUpdated={fetchAdminData} /> :


                <Card>
                    <CardContent className="p-12 text-center">
                      <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <h3 className="font-semibold mb-2">Selecione um Usuário</h3>
                      <p className="text-muted-foreground">
                        Escolha um usuário na lista ao lado para ver detalhes e analytics
                      </p>
                    </CardContent>
                  </Card>
                }
              </div>
            </div>
          </TabsContent>

          {/* Packages Tab */}
          <TabsContent value="packages" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Pacotes de Lances</h2>
                <p className="text-muted-foreground">Gerencie os pacotes de lances disponíveis para compra</p>
              </div>
              <Button onClick={handleCreatePackage}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Novo Pacote
              </Button>
            </div>
            
            <Card>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Quantidade de Lances</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Preço Original</TableHead>
                      <TableHead>Popular</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bidPackages.length === 0 ?
                    <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhum pacote encontrado. Crie o primeiro pacote!
                        </TableCell>
                      </TableRow> :

                    bidPackages.map((pkg) =>
                    <TableRow key={pkg.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {pkg.icon && <Package className="h-4 w-4" />}
                              {pkg.name}
                            </div>
                          </TableCell>
                          <TableCell>{pkg.bids_count}</TableCell>
                          <TableCell>{formatPrice(pkg.price)}</TableCell>
                          <TableCell>
                            {pkg.original_price ? formatPrice(pkg.original_price) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={pkg.is_popular ? 'default' : 'secondary'}>
                              {pkg.is_popular ? 'Sim' : 'Não'}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDateTime(pkg.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditPackage(pkg)}>
                            
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePackage(pkg)}
                            className="text-destructive hover:text-destructive">
                            
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                    )
                    }
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Nova aba: Analytics Avançado */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Analytics Avançado</h2>
                <p className="text-muted-foreground">Dashboard executivo com insights e métricas estratégicas</p>
              </div>
              <Button variant="outline" onClick={refreshData} disabled={analyticsLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${analyticsLoading ? 'animate-spin' : ''}`} />
                Atualizar Analytics
              </Button>
            </div>

            <AdvancedAnalytics />

            <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
              <ActivityHeatmap />
            </div>
          </TabsContent>

          {/* Nova aba: Auditoria */}
          <TabsContent value="audit" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Log de Auditoria</h2>
                <p className="text-muted-foreground">Histórico completo de ações administrativas e segurança</p>
              </div>
            </div>

            <AdminAuditLog />
          </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            <AdminOrdersManagement />
          </TabsContent>

          {/* Nova aba: Configurações do Sistema */}
          <TabsContent value="settings" className="space-y-6">
            <SystemSettings />
          </TabsContent>

          {/* Cofre Fúria Config */}
          <TabsContent value="vault-config" className="space-y-6">
            <FuryVaultConfigManager />
          </TabsContent>

          {/* Nova aba: Afiliados */}
          <TabsContent value="affiliates" className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold">Gerenciamento de Afiliados</h2>
                <p className="text-muted-foreground">Controle total sobre o programa de afiliados</p>
              </div>
            </div>
            <AdminAffiliateManagement />
          </TabsContent>

          {/* Nova aba: Histórico de Leilões do Admin */}
          <TabsContent value="my-history" className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold">Meu Histórico de Leilões</h2>
                <p className="text-muted-foreground">Seus lances e participações pessoais</p>
              </div>
            </div>
            <AuctionHistory />
          </TabsContent>

          {/* Nova aba: Parceiros/Investidores */}
          <TabsContent value="partners" className="space-y-6">
            <AdminPartnerManagement />
          </TabsContent>
        </Tabs>

        {/* Dialog de Edição de Leilão */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Leilão</DialogTitle>
              <DialogDescription>
                Modifique os dados do leilão
              </DialogDescription>
            </DialogHeader>
            {editingAuction &&
            <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Título</Label>
                  <Input
                  id="edit-title"
                  value={editingAuction.title}
                  onChange={(e) => setEditingAuction({ ...editingAuction, title: e.target.value })} />
                
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Descrição</Label>
                  <Textarea
                  id="edit-description"
                  value={editingAuction.description}
                  onChange={(e) => setEditingAuction({ ...editingAuction, description: e.target.value })} />
                
                </div>
                
                {/* Seção de Imagem */}
                <div className="space-y-2">
                  <Label>Imagem do Produto</Label>
                  
                  <ImageUploadPreview
                  onImageSelect={handleImageSelection}
                  maxWidth={1200}
                  maxHeight={800}
                  showCardPreview={true}
                  disabled={uploading || imageProcessing}
                  compact={true} />
                
                  
                  {/* Mostrar imagem atual se nenhuma nova for selecionada */}
                  {editingAuction.image_url && !editingImage &&
                <div className="mt-4">
                      <p className="text-sm text-muted-foreground mb-2">Imagem atual do leilão:</p>
                      <div className="relative w-full h-32 border border-border rounded-lg overflow-hidden">
                        <img
                      src={editingAuction.image_url}
                      alt="Imagem atual"
                      className="w-full h-full object-cover" />
                    
                        <div className="absolute top-2 right-2">
                          <Badge variant="secondary" className="text-xs">
                            Atual
                          </Badge>
                        </div>
                      </div>
                    </div>
                }
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-starting-price">Preço Inicial (R$)</Label>
                    <Input
                    id="edit-starting-price"
                    type="number"
                    step="0.01"
                    value={editingAuction.starting_price}
                    onChange={(e) => setEditingAuction({
                      ...editingAuction,
                      starting_price: Number(e.target.value)
                    })} />
                  
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-market-value">Valor de Mercado (R$)</Label>
                    <Input
                    id="edit-market-value"
                    type="number"
                    step="0.01"
                    value={editingAuction.market_value}
                    onChange={(e) => setEditingAuction({
                      ...editingAuction,
                      market_value: Number(e.target.value)
                    })} />
                  
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-revenue-target">Meta de Receita (R$)</Label>
                  <Input
                  id="edit-revenue-target"
                  type="number"
                  step="0.01"
                  value={editingAuction.revenue_target}
                  onChange={(e) => setEditingAuction({
                    ...editingAuction,
                    revenue_target: Number(e.target.value)
                  })} />
                
                </div>
                <div className="flex gap-2 pt-4">
                  <Button onClick={updateAuction} className="flex-1" disabled={uploading}>
                    {uploading ?
                  <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Salvando...
                      </> :

                  'Salvar Alterações'
                  }
                  </Button>
                  <Button variant="outline" onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingAuction(null);
                  setEditingImage(null);
                  setImagePreview(null);
                }} disabled={uploading || imageProcessing}>
                    Cancelar
                  </Button>
                </div>
              </div>
            }
          </DialogContent>
        </Dialog>

        {/* Dialog de Gerenciamento de Pacotes */}
        <BidPackageFormDialog
          open={isPackageDialogOpen}
          onOpenChange={setIsPackageDialogOpen}
          package={editingPackage}
          onSuccess={handlePackageSuccess} />
        
      </div>
      
      <Footer />
    </div>);

};

export default AdminDashboard;