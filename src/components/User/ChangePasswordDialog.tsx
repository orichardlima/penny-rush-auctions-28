import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
}

export const ChangePasswordDialog: React.FC<Props> = ({ open, onOpenChange, userEmail }) => {
  const { toast } = useToast();
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCurrentPwd('');
    setNewPwd('');
    setConfirmPwd('');
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (newPwd.length < 8) {
      toast({ title: 'Senha curta', description: 'A nova senha precisa ter ao menos 8 caracteres.', variant: 'destructive' });
      return;
    }
    if (newPwd !== confirmPwd) {
      toast({ title: 'Senhas diferentes', description: 'A confirmação não confere.', variant: 'destructive' });
      return;
    }
    if (!userEmail) {
      toast({ title: 'Erro', description: 'E-mail do usuário indisponível.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Reautentica com a senha atual
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPwd,
      });
      if (signInError) {
        toast({ title: 'Senha atual incorreta', description: 'Verifique e tente novamente.', variant: 'destructive' });
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      toast({ title: 'Senha alterada', description: 'Sua senha foi atualizada com sucesso.' });
      reset();
      onOpenChange(false);
    } catch (err: any) {
      console.error('[ChangePasswordDialog] error', err);
      toast({ title: 'Erro', description: err?.message || 'Não foi possível alterar a senha.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar senha</DialogTitle>
          <DialogDescription>Informe sua senha atual e a nova senha desejada.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="cp-current">Senha atual</Label>
            <Input id="cp-current" type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cp-new">Nova senha</Label>
            <Input id="cp-new" type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Mínimo de 8 caracteres.</p>
          </div>
          <div>
            <Label htmlFor="cp-confirm">Confirmar nova senha</Label>
            <Input id="cp-confirm" type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !currentPwd || !newPwd || !confirmPwd}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : 'Salvar nova senha'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordDialog;
