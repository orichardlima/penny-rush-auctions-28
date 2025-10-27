import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Shield, ShieldOff, DollarSign, Trash2, Edit, KeyRound } from 'lucide-react';

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
  const [newBalance, setNewBalance] = useState(user.bids_balance.toString());
  const [blockReason, setBlockReason] = useState('');
  const [loading, setLoading] = useState(false);

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
      // Soft delete - mark as deleted instead of hard delete
      const { error } = await supabase
        .from('profiles')
        .update({ 
          is_blocked: true,
          block_reason: 'CONTA DELETADA PELO ADMINISTRADOR',
          blocked_at: new Date().toISOString()
        })
        .eq('user_id', user.user_id);

      if (error) throw error;

      await logAdminAction(
        'user_deleted',
        null,
        null,
        `Usuário deletado: ${user.full_name} (${user.email})`
      );

      toast({
        title: "Sucesso",
        description: "Usuário deletado com sucesso"
      });

      onUserUpdated();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Erro",
        description: "Erro ao deletar usuário",
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

  return (
    <div className="flex gap-2">
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

      {/* Reset Password */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm">
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
    </div>
  );
};