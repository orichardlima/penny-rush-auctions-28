import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmergencyWithdrawalDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  type: "partner" | "affiliate";
  defaultPixKey?: string;
  defaultPixKeyType?: string;
  defaultHolderName?: string;
  onSuccess?: () => void;
}

const formatPrice = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export const EmergencyWithdrawalDialog: React.FC<EmergencyWithdrawalDialogProps> = ({
  open,
  onClose,
  userId,
  userName,
  type,
  defaultPixKey,
  defaultPixKeyType,
  defaultHolderName,
  onSuccess,
}) => {
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState<string>("cpf");
  const [holderName, setHolderName] = useState("");
  const [reason, setReason] = useState("");
  const [releasePendingBonuses, setReleasePendingBonuses] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [availableBalance, setAvailableBalance] = useState(0);
  const [pendingBonuses, setPendingBonuses] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setReason("");
    setReleasePendingBonuses(false);
    setPixKey(defaultPixKey || "");
    setPixKeyType(defaultPixKeyType || "cpf");
    setHolderName(defaultHolderName || userName || "");

    const loadBalance = async () => {
      setLoadingBalance(true);
      try {
        if (type === "partner") {
          const { data: contract } = await supabase
            .from("partner_contracts")
            .select("id, available_balance")
            .eq("user_id", userId)
            .eq("status", "ACTIVE")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          setAvailableBalance(Number(contract?.available_balance || 0));

          if (contract?.id) {
            const { data: pending } = await supabase
              .from("partner_referral_bonuses")
              .select("bonus_value")
              .eq("referrer_contract_id", contract.id)
              .eq("status", "PENDING");
            const total = (pending || []).reduce((s: number, b: any) => s + Number(b.bonus_value), 0);
            setPendingBonuses(total);
          } else {
            setPendingBonuses(0);
          }
        } else {
          const { data: affiliate } = await supabase
            .from("affiliates")
            .select("commission_balance")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          setAvailableBalance(Number(affiliate?.commission_balance || 0));
          setPendingBonuses(0);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingBalance(false);
      }
    };
    loadBalance();
  }, [open, userId, type, defaultPixKey, defaultPixKeyType, defaultHolderName, userName]);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (reason.trim().length < 20) {
      toast.error("Justificativa precisa ter no mínimo 20 caracteres");
      return;
    }
    if (!pixKey.trim() || !holderName.trim()) {
      toast.error("Preencha a chave PIX e o nome do titular");
      return;
    }

    const totalAvailable = availableBalance + (releasePendingBonuses ? pendingBonuses : 0);
    if (amt > totalAvailable + 0.01) {
      toast.error(
        `Valor excede o saldo total disponível (${formatPrice(totalAvailable)})`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "admin-emergency-withdrawal",
        {
          body: {
            userId,
            type,
            amount: amt,
            pixKey: pixKey.trim(),
            pixKeyType,
            holderName: holderName.trim(),
            reason: reason.trim(),
            releasePendingBonuses,
          },
        },
      );
      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Erro");

      toast.success(
        `Saque emergencial criado! ${data?.releasedBonusesCount ? `${data.releasedBonusesCount} bônus antecipados.` : ""}`,
      );
      onSuccess?.();
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao criar saque emergencial");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !submitting && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Saque Emergencial
          </DialogTitle>
          <DialogDescription>
            {userName} · Ignora janela de horário, valor mínimo e carência de bônus.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertDescription className="text-xs space-y-1">
            <div className="flex justify-between">
              <span>Saldo disponível:</span>
              <span className="font-semibold">
                {loadingBalance ? "..." : formatPrice(availableBalance)}
              </span>
            </div>
            {type === "partner" && (
              <div className="flex justify-between">
                <span>Bônus em carência (PENDING):</span>
                <span className="font-semibold text-amber-600">
                  {loadingBalance ? "..." : formatPrice(pendingBonuses)}
                </span>
              </div>
            )}
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <div>
            <Label htmlFor="ew-amount">Valor (R$) *</Label>
            <Input
              id="ew-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
          </div>

          {type === "partner" && pendingBonuses > 0 && (
            <div className="flex items-start gap-2 p-2 rounded border bg-amber-500/5">
              <Checkbox
                id="ew-release"
                checked={releasePendingBonuses}
                onCheckedChange={(c) => setReleasePendingBonuses(!!c)}
              />
              <Label htmlFor="ew-release" className="text-xs leading-tight cursor-pointer">
                Antecipar bônus de indicação em carência (PENDING → AVAILABLE) até cobrir o valor solicitado.
              </Label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="ew-pix-type">Tipo da chave</Label>
              <Select value={pixKeyType} onValueChange={setPixKeyType}>
                <SelectTrigger id="ew-pix-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="phone">Telefone</SelectItem>
                  <SelectItem value="random">Aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ew-pix-key">Chave PIX *</Label>
              <Input
                id="ew-pix-key"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="ew-holder">Nome do titular *</Label>
            <Input
              id="ew-holder"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="ew-reason">
              Justificativa * (mín. 20 caracteres) — {reason.trim().length}/20
            </Label>
            <Textarea
              id="ew-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Ex: Usuário com urgência médica, autorizado por gerência..."
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || loadingBalance}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</>
            ) : (
              "Criar Saque Emergencial"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmergencyWithdrawalDialog;
