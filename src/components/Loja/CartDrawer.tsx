import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useStoreCart } from "@/hooks/useStoreCart";

const fmt = (n: number) => Number(n || 0).toLocaleString("pt-BR");

export function CartDrawer({
  open,
  onOpenChange,
  availablePoints,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  availablePoints: number;
}) {
  const navigate = useNavigate();
  const { items, setQuantity, removeItem, totalPoints } = useStoreCart();
  const insufficient = totalPoints > availablePoints;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-serif-display text-2xl">Meu carrinho</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 py-4 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Seu carrinho está vazio</p>
              <p className="text-xs mt-1">Adicione prêmios da Loja Show</p>
            </div>
          ) : (
            items.map(i => (
              <div key={i.item_id} className="flex gap-3 border-b border-primary/10 pb-4">
                <div className="w-20 h-20 flex-shrink-0 bg-muted/40 overflow-hidden">
                  {i.main_image_url ? (
                    <img src={i.main_image_url} alt={i.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Sem foto</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-2">
                    <h4 className="text-sm font-medium truncate">{i.name}</h4>
                    <button
                      aria-label="Remover"
                      onClick={() => removeItem(i.item_id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="text-primary font-bold text-sm mt-1">
                    {fmt(i.cost_points)} <span className="text-[10px] uppercase tracking-widest text-muted-foreground">pts</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQuantity(i.item_id, i.quantity - 1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-sm w-6 text-center">{i.quantity}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" disabled={i.quantity >= Math.min(i.stock_available, i.per_user_limit ?? Infinity)} onClick={() => setQuantity(i.item_id, i.quantity + 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {fmt(i.cost_points * i.quantity)} pts
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <SheetFooter className="border-t border-primary/10 pt-4 flex-col gap-3 sm:flex-col">
            <div className="w-full space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold text-primary text-lg">{fmt(totalPoints)} pts</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Seu saldo</span>
                <span>{fmt(availablePoints)} pts</span>
              </div>
              {insufficient && (
                <p className="text-xs text-destructive pt-1">
                  Faltam {fmt(totalPoints - availablePoints)} pts para concluir este resgate.
                </p>
              )}
            </div>
            <Button
              className="w-full uppercase tracking-widest text-xs h-12"
              disabled={insufficient}
              onClick={() => { onOpenChange(false); navigate("/loja-show/checkout"); }}
            >
              Finalizar resgate
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
