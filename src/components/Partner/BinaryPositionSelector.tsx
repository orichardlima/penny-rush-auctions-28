import React, { useEffect, useState } from 'react';
import { useBinaryPositioning, PendingPosition, PositionPreview } from '@/hooks/useBinaryPositioning';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  ArrowLeft, 
  ArrowRight, 
  UserPlus, 
  AlertTriangle,
  CheckCircle,
  Clock,
  GitBranch
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BinaryPositionSelectorProps {
  sponsorContractId: string | null;
  onPositionComplete?: () => void;
}

export const BinaryPositionSelector: React.FC<BinaryPositionSelectorProps> = ({ 
  sponsorContractId,
  onPositionComplete 
}) => {
  const { 
    loading, 
    pendingPositions, 
    positionPreview,
    fetchPendingPositions, 
    getPositionPreview,
    positionPartner 
  } = useBinaryPositioning(sponsorContractId);

  const [selectedPartner, setSelectedPartner] = useState<PendingPosition | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<'left' | 'right' | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [positioning, setPositioning] = useState(false);

  useEffect(() => {
    if (sponsorContractId) {
      fetchPendingPositions();
    }
  }, [sponsorContractId, fetchPendingPositions]);

  useEffect(() => {
    if (selectedPartner) {
      getPositionPreview(selectedPartner.contract_id);
    }
  }, [selectedPartner, getPositionPreview]);

  const handleSelectPartner = (partner: PendingPosition) => {
    setSelectedPartner(partner);
    setSelectedPosition(null);
  };

  const handleSelectPosition = (position: 'left' | 'right') => {
    setSelectedPosition(position);
  };

  const handleConfirmPosition = () => {
    setConfirmOpen(true);
  };

  const handlePositionPartner = async () => {
    if (!selectedPartner || !selectedPosition) return;

    setPositioning(true);
    const result = await positionPartner(selectedPartner.contract_id, selectedPosition);
    setPositioning(false);
    
    if (result.success) {
      setSelectedPartner(null);
      setSelectedPosition(null);
      setConfirmOpen(false);
      onPositionComplete?.();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (pendingPositions.length === 0) {
    return null; // No pending positions, don't show anything
  }

  return (
    <>
      <Card className="border-amber-500/50 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-600">
            <UserPlus className="w-5 h-5" />
            Parceiros Aguardando Posicionamento
          </CardTitle>
          <CardDescription>
            Escolha em qual perna da sua rede binária cada parceiro será posicionado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pending Partners List */}
          {!selectedPartner && (
            <div className="space-y-2">
              {pendingPositions.map(partner => (
                <div 
                  key={partner.contract_id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleSelectPartner(partner)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserPlus className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{partner.user_name}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{partner.plan_name}</Badge>
                        <span className="text-xs text-muted-foreground">
                          +{partner.plan_points} pontos
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {partner.expires_at && (
                      <div className="flex items-center gap-1 text-xs text-amber-600">
                        <Clock className="w-3 h-3" />
                        <span>Expira em breve</span>
                      </div>
                    )}
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Position Selector */}
          {selectedPartner && (
            <div className="space-y-4">
              {/* Selected Partner Info */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                <div>
                  <p className="font-medium">{selectedPartner.user_name}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{selectedPartner.plan_name}</Badge>
                    <span className="text-xs text-muted-foreground">
                      +{selectedPartner.plan_points} pontos
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPartner(null)}>
                  Voltar
                </Button>
              </div>

              {/* Position Options */}
              <div className="grid grid-cols-2 gap-4">
                {/* Left Position */}
                <div 
                  className={cn(
                    "p-4 rounded-lg border-2 cursor-pointer transition-all",
                    selectedPosition === 'left' 
                      ? 'border-blue-500 bg-blue-500/10' 
                      : 'border-muted hover:border-blue-500/50'
                  )}
                  onClick={() => handleSelectPosition('left')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ArrowLeft className="w-5 h-5 text-blue-500" />
                      <span className="font-medium">Esquerda</span>
                    </div>
                    {selectedPosition === 'left' && (
                      <CheckCircle className="w-5 h-5 text-blue-500" />
                    )}
                  </div>

                  {positionPreview && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant={positionPreview.left.available ? 'default' : 'secondary'}>
                          {positionPreview.left.available ? 'Disponível' : 'Spillover'}
                        </Badge>
                      </div>
                      {positionPreview.left.spillover && positionPreview.left.finalParentName && (
                        <div className="flex items-center gap-1 text-xs text-amber-600">
                          <GitBranch className="w-3 h-3" />
                          <span>Será colocado sob {positionPreview.left.finalParentName}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Pontos Atuais:</span>
                        <span>{positionPreview.left.currentPoints}</span>
                      </div>
                      <div className="flex items-center justify-between text-primary font-medium">
                        <span>Após:</span>
                        <span>{positionPreview.left.pointsAfter}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Position */}
                <div 
                  className={cn(
                    "p-4 rounded-lg border-2 cursor-pointer transition-all",
                    selectedPosition === 'right' 
                      ? 'border-amber-500 bg-amber-500/10' 
                      : 'border-muted hover:border-amber-500/50'
                  )}
                  onClick={() => handleSelectPosition('right')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="w-5 h-5 text-amber-500" />
                      <span className="font-medium">Direita</span>
                    </div>
                    {selectedPosition === 'right' && (
                      <CheckCircle className="w-5 h-5 text-amber-500" />
                    )}
                  </div>

                  {positionPreview && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant={positionPreview.right.available ? 'default' : 'secondary'}>
                          {positionPreview.right.available ? 'Disponível' : 'Spillover'}
                        </Badge>
                      </div>
                      {positionPreview.right.spillover && positionPreview.right.finalParentName && (
                        <div className="flex items-center gap-1 text-xs text-amber-600">
                          <GitBranch className="w-3 h-3" />
                          <span>Será colocado sob {positionPreview.right.finalParentName}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Pontos Atuais:</span>
                        <span>{positionPreview.right.currentPoints}</span>
                      </div>
                      <div className="flex items-center justify-between text-primary font-medium">
                        <span>Após:</span>
                        <span>{positionPreview.right.pointsAfter}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Recommendation */}
              {positionPreview && (
                <div className={cn(
                  "flex items-center gap-2 p-3 rounded-lg text-sm",
                  positionPreview.left.currentPoints <= positionPreview.right.currentPoints
                    ? 'bg-blue-500/10 text-blue-700'
                    : 'bg-amber-500/10 text-amber-700'
                )}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Recomendado: <strong>
                      {positionPreview.left.currentPoints <= positionPreview.right.currentPoints 
                        ? 'Esquerda' 
                        : 'Direita'}
                    </strong> — sua menor perna precisa de mais pontos para maximizar o bônus.
                  </span>
                </div>
              )}

              {/* Confirm Button */}
              <Button 
                className="w-full" 
                size="lg"
                disabled={!selectedPosition}
                onClick={handleConfirmPosition}
              >
                Confirmar Posicionamento
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Posicionamento</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a posicionar <strong>{selectedPartner?.user_name}</strong> na 
              perna <strong>{selectedPosition === 'left' ? 'esquerda' : 'direita'}</strong>.
              <br /><br />
              <span className="text-destructive font-medium">
                Esta ação não pode ser desfeita!
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={positioning}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handlePositionPartner}
              disabled={positioning}
            >
              {positioning ? 'Posicionando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BinaryPositionSelector;
