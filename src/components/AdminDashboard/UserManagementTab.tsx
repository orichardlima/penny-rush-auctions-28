import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { User as UserIcon, Bot, Users, CheckCircle, Trash2, RefreshCw, Shield, Search, Filter } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import UserProfileCard from '@/components/UserProfileCard';
import { User } from './types';

interface UserManagementTabProps {
  realUsers: User[];
  botUsers: User[];
  onRefresh: () => void;
}

const UserManagementTab: React.FC<UserManagementTabProps> = ({ realUsers, botUsers, onRefresh }) => {
  const { user: currentUser } = useAuth();
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<User | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'real' | 'bot' | 'vip' | 'active'>('all');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isDeletingUsers, setIsDeletingUsers] = useState(false);

  // Sync selected user with updated data
  useEffect(() => {
    if (selectedUserForProfile && (realUsers.length > 0 || botUsers.length > 0)) {
      const updatedUser = [...realUsers, ...botUsers].find(
        (user) => user.user_id === selectedUserForProfile.user_id
      );
      if (updatedUser && (
        updatedUser.bids_balance !== selectedUserForProfile.bids_balance ||
        updatedUser.is_blocked !== selectedUserForProfile.is_blocked ||
        updatedUser.block_reason !== selectedUserForProfile.block_reason
      )) {
        setSelectedUserForProfile(updatedUser);
      }
    }
  }, [realUsers, botUsers]);

  const allUsers = [...realUsers, ...botUsers];

  const filteredUsers = allUsers.filter((user) => {
    const matchesSearch = user.full_name?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(userSearchTerm.toLowerCase());
    if (userFilter === 'all') return matchesSearch;
    if (userFilter === 'real') return matchesSearch && !user.is_bot;
    if (userFilter === 'bot') return matchesSearch && user.is_bot;
    if (userFilter === 'vip') return matchesSearch && !user.is_bot;
    if (userFilter === 'active') return matchesSearch && !user.is_bot;
    return matchesSearch;
  });

  const selectableUsers = filteredUsers.filter(
    (u) => !u.is_admin && u.user_id !== currentUser?.id
  );

  const handleSelectUser = (userId: string, checked: boolean) => {
    const newSelected = new Set(selectedUsers);
    if (checked) newSelected.add(userId); else newSelected.delete(userId);
    setSelectedUsers(newSelected);
  };

  const handleSelectAllUsers = (checked: boolean) => {
    setSelectedUsers(checked ? new Set(selectableUsers.map((u) => u.user_id)) : new Set());
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
            headers: { Authorization: `Bearer ${session?.access_token}` }
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          successCount++;
        } catch (err) {
          failCount++;
        }
      }
      if (successCount > 0) {
        toast({
          title: "Exclusão concluída",
          description: failCount > 0
            ? `${successCount} usuário(s) excluído(s). ${failCount} falha(s).`
            : `${successCount} usuário(s) excluído(s) com sucesso!`
        });
      }
      if (failCount > 0 && successCount === 0) {
        toast({ title: "Erro", description: "Nenhum usuário pôde ser excluído.", variant: "destructive" });
      }
      setSelectedUsers(new Set());
      onRefresh();
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao excluir usuários selecionados", variant: "destructive" });
    } finally {
      setIsDeletingUsers(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestão de Usuários</h2>
          <p className="text-muted-foreground">Controle completo de usuários reais e bots</p>
        </div>
        <div className="flex gap-2 text-sm text-muted-foreground">
          <span>{filteredUsers.length} usuários filtrados</span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex items-center gap-2 flex-1">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou email..." value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} className="max-w-md" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={userFilter} onValueChange={(value) => setUserFilter(value as any)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
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

      {selectedUsers.size > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-orange-600" />
                <span className="font-medium text-orange-800">{selectedUsers.size} usuário(s) selecionado(s)</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedUsers(new Set())}>Limpar Seleção</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={isDeletingUsers}>
                      {isDeletingUsers ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Excluindo...</> : <><Trash2 className="h-4 w-4 mr-2" />Excluir Selecionados</>}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar exclusão em lote</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir permanentemente {selectedUsers.size} usuário(s)?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={deleteSelectedUsers} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Excluir {selectedUsers.size} usuário(s)
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuários ({filteredUsers.length})
            </CardTitle>
            {selectableUsers.length > 0 && (
              <div className="flex items-center gap-2 pt-2">
                <Checkbox
                  checked={selectableUsers.length > 0 && selectableUsers.every((u) => selectedUsers.has(u.user_id))}
                  onCheckedChange={handleSelectAllUsers}
                  aria-label="Selecionar todos" />
                <span className="text-xs text-muted-foreground">Selecionar todos</span>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {filteredUsers.map((user) => {
              const isSelectable = !user.is_admin && user.user_id !== currentUser?.id;
              return (
                <div key={user.user_id} className="flex items-center gap-2">
                  {isSelectable ? (
                    <Checkbox
                      checked={selectedUsers.has(user.user_id)}
                      onCheckedChange={(checked) => handleSelectUser(user.user_id, checked as boolean)}
                      className="shrink-0" />
                  ) : (
                    <div className="w-4 shrink-0" />
                  )}
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
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          {selectedUserForProfile ? (
            <UserProfileCard
              userId={selectedUserForProfile.user_id}
              userName={selectedUserForProfile.full_name || 'Usuário'}
              userEmail={selectedUserForProfile.email}
              userBalance={selectedUserForProfile.bids_balance}
              onUserUpdated={onRefresh} />
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <UserIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="font-semibold mb-2">Selecione um Usuário</h3>
                <p className="text-muted-foreground">Escolha um usuário na lista ao lado para ver detalhes e analytics</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserManagementTab;
