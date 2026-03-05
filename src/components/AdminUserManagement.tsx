import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Shield, ShieldOff, DollarSign, Trash2, Edit, KeyRound, Lock, History, ShoppingCart, Award } from 'lucide-react';
import { UserBidHistoryModal } from '@/components/Admin/UserBidHistoryModal';
import { UserPurchaseHistoryModal } from '@/components/Admin/UserPurchaseHistoryModal';
import { AdminEditProfileDialog } from '@/components/Admin/AdminEditProfileDialog';

interface AdminUserActionsProps {
  user: {
    user_id: string;
    full_name: string;
    email: string;
    bids_balance: number;
    is_blocked?: boolean;
    block_reason?: string;
  };
  onUserUpdated: () => void;
}

export const AdminUserActions: React.FC<AdminUserActionsProps> = ({ user, onUserUpdated }) => {
  const [isBalanceDialogOpen, setIsBalanceDialogOpen] = useState(false);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isChangePasswordDialogOpen, setIsChangePasswordDialogOpen] = useState(false);
  const [isBidHistoryOpen, setIsBidHistoryOpen] = useState(false);
  const [isPurchaseHistoryOpen, setIsPurchaseHistoryOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [newBalance, setNewBalance] = useState(user.bids_balance.toString());
  const [blockReason, setBlockReason] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Estados para atribuição de plano
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [adminReferralCode, setAdminReferralCode] = useState('');
  const [existingContract, setExistingContract] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  const logAdminAction = async (actionType: string, oldValues: any = null, newValues: any = null, description: string) => {
    try {
      await supabase.rpc('log_admin_action', {
        p_action_type: actionType,
        p_target_type: 'user',
        p_target_id: user.user_id,
        p_old_values: oldValues,
        p_new_values: newValues,
        p_description: description
      });
    } catch (error) {
      console.error('Error logging admin action:', error);
    }
  };

  const updateUserBalance = async () => {
    const balance = parseFloat(newBalance);
    if (isNaN(balance) || balance < 0) {
      toast({
        title: "Erro",
        description: "Saldo deve ser um número válido não negativo",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const oldBalance = user.bids_balance;
      
      const { error } = await supabase
        .from('profiles')
        .update({ bids_balance: balance })
        .eq('user_id', user.user_id);

      if (error) throw error;

      await logAdminAction(
        'balance_updated',
        { bids_balance: oldBalance },
        { bids_balance: balance },
        `Saldo alterado de ${oldBalance} para ${balance} lances`
      );

      toast({
        title: "Sucesso",
        description: "Saldo atualizado com sucesso"
      });

      setIsBalanceDialogOpen(false);
      onUserUpdated();
    } catch (error) {
      console.error('Error updating balance:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar saldo do usuário",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleUserBlock = async () => {
    const isBlocking = !user.is_blocked;
    
    setLoading(true);
    try {
      const updateData: any = {
        is_blocked: isBlocking,
        blocked_at: isBlocking ? new Date().toISOString() : null,
        blocked_by: isBlocking ? (await supabase.auth.getUser()).data.user?.id : null,
        block_reason: isBlocking ? blockReason : null
      };

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', user.user_id);

      if (error) throw error;

      await logAdminAction(
        isBlocking ? 'user_blocked' : 'user_unblocked',
        { is_blocked: user.is_blocked },
        { is_blocked: isBlocking },
        isBlocking ? `Usuário bloqueado. Motivo: ${blockReason}` : 'Usuário desbloqueado'
      );

      toast({
        title: "Sucesso",
        description: `Usuário ${isBlocking ? 'bloqueado' : 'desbloqueado'} com sucesso`
      });

      setIsBlockDialogOpen(false);
      setBlockReason('');
      onUserUpdated();
    } catch (error) {
      console.error('Error toggling user block:', error);
      toast({
        title: "Erro",
        description: `Erro ao ${isBlocking ? 'bloquear' : 'desbloquear'} usuário`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: user.user_id },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (error) throw error;
      if (data?.error) {
        throw new Error(data.error);
      }
      if (data?.warning) {
        console.warn('Delete warning:', data.warning);
      }

      toast({
        title: "Sucesso",
        description: "Usuário deletado permanentemente com sucesso"
      });

      onUserUpdated();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao deletar usuário",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetUserPassword = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      await logAdminAction(
        'password_reset_requested',
        null,
        { email: user.email },
        `Solicitação de reset de senha enviada para ${user.email}`
      );

      toast({
        title: "Sucesso",
        description: `Email de recuperação enviado para ${user.email}`
      });

      onUserUpdated();
    } catch (error) {
      console.error('Error resetting password:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar email de recuperação",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const changeUserPassword = async () => {
    // Validation
    if (!newPassword || newPassword.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter no mínimo 6 caracteres",
        variant: "destructive"
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Call edge function to update password
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('admin-update-user-password', {
        body: {
          userId: user.user_id,
          newPassword: newPassword
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao alterar senha');
      }

      toast({
        title: "Sucesso",
        description: "Senha alterada com sucesso"
      });

      setIsChangePasswordDialogOpen(false);
      setNewPassword('');
      setConfirmPassword('');
      onUserUpdated();
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao alterar senha do usuário",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const checkUserPartnerStatus = async () => {
    setLoadingPlans(true);
    setSelectedPlanId(null);
    setAdminReferralCode('');
    try {
      // Buscar planos ativos
      const { data: plansData } = await supabase
        .from('partner_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      
      setPlans(plansData || []);
      
      // Verificar se usuário já tem contrato ativo
      const { data: contractData } = await supabase
        .from('partner_contracts')
        .select('*')
        .eq('user_id', user.user_id)
        .eq('status', 'ACTIVE')
        .maybeSingle();
      
      setExistingContract(contractData);
    } catch (error) {
      console.error('Error checking partner status:', error);
    } finally {
      setLoadingPlans(false);
    }
  };

  const assignPlanToUser = async () => {
    if (!selectedPlanId) return;
    
    const plan = plans.find(p => p.id === selectedPlanId);
    if (!plan) return;
    
    setLoading(true);
    try {
      // Verificar se já existe contrato ativo
      if (existingContract) {
        toast({
          title: "Erro",
          description: "Usuário já possui um contrato ativo. Encerre-o primeiro.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }
      
      // Buscar sponsor se código informado
      let referredByUserId: string | null = null;
      if (adminReferralCode.trim()) {
        const { data: sponsorContract } = await supabase
          .from('partner_contracts')
          .select('user_id')
          .eq('referral_code', adminReferralCode.trim().toUpperCase())
          .eq('status', 'ACTIVE')
          .maybeSingle();
        
        if (sponsorContract && sponsorContract.user_id !== user.user_id) {
          referredByUserId = sponsorContract.user_id;
        } else if (adminReferralCode.trim() && !sponsorContract) {
          toast({
            title: "Aviso",
            description: "Código de indicação não encontrado ou inativo. Prosseguindo sem sponsor.",
            variant: "default"
          });
        }
      }
      
      // Gerar código de referral único
      const newReferralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      
      // Criar contrato
      const { data: newContract, error: contractError } = await supabase
        .from('partner_contracts')
        .insert({
          user_id: user.user_id,
          plan_name: plan.name,
          aporte_value: plan.aporte_value,
          weekly_cap: plan.weekly_cap,
          total_cap: plan.total_cap,
          status: 'ACTIVE',
          referred_by_user_id: referredByUserId,
          referral_code: newReferralCode
        })
        .select()
        .single();
      
      if (contractError) throw contractError;
      
      // Creditar bônus de lances se existir
      if (plan.bonus_bids && plan.bonus_bids > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('bids_balance')
          .eq('user_id', user.user_id)
          .single();
        
        const newBalance = (profileData?.bids_balance || 0) + plan.bonus_bids;
        
        await supabase
          .from('profiles')
          .update({ bids_balance: newBalance })
          .eq('user_id', user.user_id);
        
        await supabase
          .from('partner_contracts')
          .update({ bonus_bids_received: plan.bonus_bids })
          .eq('id', newContract.id);
      }
      
      // Registrar no audit log
      await logAdminAction(
        'partner_plan_assigned',
        null,
        { 
          plan_name: plan.name, 
          aporte_value: plan.aporte_value,
          referral_code: newReferralCode,
          sponsor: referredByUserId || 'none'
        },
        `Plano ${plan.display_name} atribuído pelo administrador. Valor: R$ ${plan.aporte_value}`
      );
      
      toast({
        title: "Plano ativado!",
        description: `${plan.display_name} foi ativado para ${user.full_name || user.email}`
      });
      
      setIsPlanDialogOpen(false);
      setSelectedPlanId(null);
      setAdminReferralCode('');
      onUserUpdated();
    } catch (error: any) {
      console.error('Error assigning plan:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao ativar plano",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      {/* Bid History */}
      <Button 
        variant="outline" 
        size="sm" 
        title="Ver histórico de lances"
        onClick={() => setIsBidHistoryOpen(true)}
      >
        <History className="h-4 w-4" />
      </Button>
      
      <UserBidHistoryModal
        userId={user.user_id}
        userName={user.full_name || user.email}
        isOpen={isBidHistoryOpen}
        onClose={() => setIsBidHistoryOpen(false)}
      />

      {/* Purchase History */}
      <Button 
        variant="outline" 
        size="sm" 
        title="Ver histórico de compras"
        onClick={() => setIsPurchaseHistoryOpen(true)}
      >
        <ShoppingCart className="h-4 w-4" />
      </Button>
      
      <UserPurchaseHistoryModal
        userId={user.user_id}
        userName={user.full_name || user.email}
        isOpen={isPurchaseHistoryOpen}
        onClose={() => setIsPurchaseHistoryOpen(false)}
      />

      {/* Edit Profile */}
      <Button 
        variant="outline" 
        size="sm" 
        title="Editar dados cadastrais"
        onClick={() => setIsEditProfileOpen(true)}
      >
        <Edit className="h-4 w-4" />
      </Button>

      <AdminEditProfileDialog
        userId={user.user_id}
        userName={user.full_name || 'Usuário'}
        userEmail={user.email}
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        onUpdated={onUserUpdated}
        logAdminAction={logAdminAction}
      />

      {/* Edit Balance */}
      <Dialog open={isBalanceDialogOpen} onOpenChange={setIsBalanceDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <DollarSign className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Saldo de Lances</DialogTitle>
            <DialogDescription>
              Usuário: {user.full_name} ({user.email})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="balance">Novo Saldo</Label>
              <Input
                id="balance"
                type="number"
                min="0"
                step="1"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
                placeholder="Digite o novo saldo"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsBalanceDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={updateUserBalance} disabled={loading}>
                {loading ? 'Atualizando...' : 'Atualizar Saldo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Block/Unblock User */}
      <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <DialogTrigger asChild>
          <Button variant={user.is_blocked ? "default" : "destructive"} size="sm">
            {user.is_blocked ? <Shield className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {user.is_blocked ? 'Desbloquear Usuário' : 'Bloquear Usuário'}
            </DialogTitle>
            <DialogDescription>
              Usuário: {user.full_name} ({user.email})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!user.is_blocked && (
              <div>
                <Label htmlFor="reason">Motivo do Bloqueio</Label>
                <Textarea
                  id="reason"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Digite o motivo do bloqueio"
                  required
                />
              </div>
            )}
            {user.is_blocked && user.block_reason && (
              <div>
                <Label>Motivo do Bloqueio Atual:</Label>
                <p className="text-sm text-muted-foreground p-2 bg-muted rounded">
                  {user.block_reason}
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsBlockDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                variant={user.is_blocked ? "default" : "destructive"}
                onClick={toggleUserBlock} 
                disabled={loading || (!user.is_blocked && !blockReason.trim())}
              >
                {loading ? 'Processando...' : user.is_blocked ? 'Desbloquear' : 'Bloquear'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Directly */}
      <Dialog open={isChangePasswordDialogOpen} onOpenChange={setIsChangePasswordDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" title="Alterar senha diretamente">
            <Lock className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha do Usuário</DialogTitle>
            <DialogDescription>
              Usuário: {user.full_name} ({user.email})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-password">Nova Senha</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
              />
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirmar Senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Digite a senha novamente"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              ⚠️ A senha será alterada imediatamente e o usuário poderá fazer login com a nova senha.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setIsChangePasswordDialogOpen(false);
                setNewPassword('');
                setConfirmPassword('');
              }}>
                Cancelar
              </Button>
              <Button onClick={changeUserPassword} disabled={loading}>
                {loading ? 'Alterando...' : 'Alterar Senha'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password via Email */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" title="Enviar email de recuperação">
            <KeyRound className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar Senha do Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Enviar email de recuperação de senha para <strong>{user.email}</strong>?
              O usuário receberá um link para redefinir a senha que expira em 24 horas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={resetUserPassword}>
              Enviar Email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm">
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar o usuário <strong>{user.full_name}</strong>? 
              Esta ação não pode ser desfeita e o usuário não poderá mais acessar o sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={deleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deletar Usuário
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Partner Plan */}
      <Dialog open={isPlanDialogOpen} onOpenChange={(open) => {
        setIsPlanDialogOpen(open);
        if (open) checkUserPartnerStatus();
      }}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" title="Atribuir plano de parceiro">
            <Award className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Atribuir Plano de Parceiro
            </DialogTitle>
            <DialogDescription>
              {user.full_name} ({user.email})
            </DialogDescription>
          </DialogHeader>
          
          {loadingPlans ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : existingContract ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950 dark:border-green-800">
                <p className="text-sm text-green-700 dark:text-green-300">
                  ✅ <strong>Plano atual:</strong> {existingContract.plan_name}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Aporte: R$ {existingContract.aporte_value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | 
                  Recebido: R$ {existingContract.total_received?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Para atribuir um novo plano, encerre o contrato atual primeiro na 
                área de Gerenciamento de Parceiros.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-950 dark:border-yellow-800">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  ⚠️ Usuário não possui plano de parceria ativo
                </p>
              </div>
              
              <div>
                <Label>Selecione o Plano</Label>
                <RadioGroup value={selectedPlanId || ''} onValueChange={setSelectedPlanId} className="mt-2 space-y-2">
                  {plans.map(plan => (
                    <div key={plan.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                      <RadioGroupItem value={plan.id} id={plan.id} />
                      <Label htmlFor={plan.id} className="flex-1 cursor-pointer">
                        <span className="font-medium">{plan.display_name}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          R$ {plan.aporte_value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (Teto: R$ {plan.total_cap?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                        </span>
                        {plan.bonus_bids > 0 && (
                          <span className="text-xs text-green-600 ml-2">
                            +{plan.bonus_bids} lances
                          </span>
                        )}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              
              <div>
                <Label htmlFor="referral-code">Código de Indicação (opcional)</Label>
                <Input
                  id="referral-code"
                  value={adminReferralCode}
                  onChange={(e) => setAdminReferralCode(e.target.value.toUpperCase())}
                  placeholder="Ex: ABC123XY"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Se informado, o usuário será vinculado ao sponsor correspondente
                </p>
              </div>
              
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-950 dark:border-amber-800">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  ⚠️ Esta ação criará um contrato sem necessidade de pagamento.
                  Será registrado no log de auditoria.
                </p>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsPlanDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={assignPlanToUser} disabled={loading || !selectedPlanId}>
                  {loading ? 'Ativando...' : 'Ativar Plano'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};