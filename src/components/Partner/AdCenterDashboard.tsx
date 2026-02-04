import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAdCenter } from '@/hooks/useAdCenter';
import { 
  Megaphone, 
  Download, 
  Copy, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Instagram,
  Facebook,
  MessageCircle,
  Share2,
  Image as ImageIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface AdCenterDashboardProps {
  partnerContractId: string;
}

const SOCIAL_NETWORKS = [
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'text-pink-500' },
  { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'text-blue-600' },
  { id: 'whatsapp', name: 'WhatsApp', icon: MessageCircle, color: 'text-green-500' },
  { id: 'tiktok', name: 'TikTok', icon: Share2, color: 'text-foreground' },
  { id: 'outro', name: 'Outro', icon: Share2, color: 'text-muted-foreground' }
];

const AdCenterDashboard: React.FC<AdCenterDashboardProps> = ({ partnerContractId }) => {
  const {
    todayMaterial,
    weekProgress,
    loading,
    confirming,
    confirmCompletion
  } = useAdCenter(partnerContractId);

  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);

  const handleCopyCaption = () => {
    if (!todayMaterial?.description) return;
    navigator.clipboard.writeText(todayMaterial.description);
    toast({
      title: 'Legenda copiada!',
      description: 'Cole no seu post ou story.'
    });
  };

  const handleDownloadImage = () => {
    if (!todayMaterial?.image_url) return;
    window.open(todayMaterial.image_url, '_blank');
  };

  const handleConfirm = async () => {
    if (!selectedNetwork) {
      toast({
        title: 'Selecione a rede social',
        description: 'Por favor, indique onde você fez a divulgação.',
        variant: 'destructive'
      });
      return;
    }

    const success = await confirmCompletion(selectedNetwork, todayMaterial?.id);
    if (success) {
      setSelectedNetwork(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const daysRemaining = weekProgress.requiredDays - weekProgress.completedDays;
  const isGoalReached = weekProgress.completedDays >= weekProgress.requiredDays;

  return (
    <div className="space-y-6">
      {/* Alert explicativo */}
      <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:border-amber-800">
        <Megaphone className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-sm">
          <strong>Central de Anúncios:</strong> Divulgue a plataforma diariamente para desbloquear até 100% 
          do seu repasse semanal. Complete pelo menos {weekProgress.requiredDays} dias para liberar o bônus total!
        </AlertDescription>
      </Alert>

      {/* Card de Progresso */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Megaphone className="h-5 w-5 text-primary" />
            Progresso Semanal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {weekProgress.completedDays} de {weekProgress.requiredDays} dias completos
            </span>
            <Badge 
              variant="outline" 
              className={cn(
                isGoalReached 
                  ? 'bg-green-500/10 text-green-600 border-green-500/20' 
                  : 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
              )}
            >
              {weekProgress.unlockPercentage.toFixed(0)}% desbloqueado
            </Badge>
          </div>
          
          <Progress value={(weekProgress.completedDays / weekProgress.requiredDays) * 100} className="h-3" />
          
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>70% base</span>
            <span>+ {weekProgress.bonusPercentage.toFixed(0)}% bônus</span>
            <span>= {weekProgress.unlockPercentage.toFixed(0)}% total</span>
          </div>

          {!isGoalReached && (
            <p className="text-sm text-center text-muted-foreground">
              Complete mais <strong className="text-primary">{daysRemaining}</strong> dia{daysRemaining > 1 ? 's' : ''} para desbloquear 100%!
            </p>
          )}
          
          {isGoalReached && (
            <p className="text-sm text-center text-green-600 font-medium">
              🎉 Parabéns! Você atingiu a meta semanal!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Material do Dia */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Material de Hoje
          </CardTitle>
          <CardDescription>
            Baixe a imagem e copie a legenda para divulgar nas suas redes sociais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {todayMaterial ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Preview da imagem */}
                <div className="aspect-square bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                  {todayMaterial.image_url ? (
                    <img 
                      src={todayMaterial.image_url} 
                      alt={todayMaterial.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Sem imagem disponível</p>
                    </div>
                  )}
                </div>

                {/* Detalhes e ações */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">{todayMaterial.title}</h3>
                    {todayMaterial.description && (
                      <div className="mt-2 p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {todayMaterial.description}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {todayMaterial.image_url && (
                      <Button variant="outline" onClick={handleDownloadImage} className="flex-1">
                        <Download className="h-4 w-4 mr-2" />
                        Baixar Imagem
                      </Button>
                    )}
                    {todayMaterial.description && (
                      <Button variant="outline" onClick={handleCopyCaption} className="flex-1">
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar Legenda
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Confirmação */}
              {weekProgress.canConfirmToday ? (
                <div className="pt-4 border-t space-y-4">
                  <p className="text-sm font-medium">Onde você divulgou?</p>
                  
                  <div className="flex flex-wrap gap-2">
                    {SOCIAL_NETWORKS.map((network) => {
                      const Icon = network.icon;
                      return (
                        <Button
                          key={network.id}
                          variant={selectedNetwork === network.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedNetwork(network.id)}
                          className="gap-2"
                        >
                          <Icon className={cn('h-4 w-4', selectedNetwork === network.id ? '' : network.color)} />
                          {network.name}
                        </Button>
                      );
                    })}
                  </div>

                  <Button 
                    onClick={handleConfirm} 
                    disabled={confirming || !selectedNetwork}
                    className="w-full"
                    size="lg"
                  >
                    {confirming ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Confirmando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Confirmar Divulgação
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <Alert className="bg-green-50 border-green-200 dark:bg-green-950/50 dark:border-green-800">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-sm text-green-700 dark:text-green-400">
                    <strong>Divulgação do dia confirmada!</strong> Volte amanhã para continuar acumulando pontos.
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum material disponível no momento.</p>
              <p className="text-sm mt-2">Aguarde o admin cadastrar novos materiais.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico da Semana */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico da Semana</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {weekProgress.weekHistory.map((day) => (
              <div 
                key={day.date}
                className={cn(
                  'text-center p-2 rounded-lg border transition-colors',
                  day.completed 
                    ? 'bg-green-500/10 border-green-500/30' 
                    : day.isFuture
                    ? 'bg-muted/50 border-transparent'
                    : day.isToday
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-red-500/10 border-red-500/30'
                )}
              >
                <p className="text-xs text-muted-foreground">{day.dayName}</p>
                <p className="font-semibold text-sm">{day.dayNumber}</p>
                <div className="mt-1">
                  {day.completed ? (
                    <CheckCircle className="h-4 w-4 mx-auto text-green-600" />
                  ) : day.isFuture ? (
                    <Clock className="h-4 w-4 mx-auto text-muted-foreground" />
                  ) : day.isToday ? (
                    <AlertCircle className="h-4 w-4 mx-auto text-primary" />
                  ) : (
                    <AlertCircle className="h-4 w-4 mx-auto text-red-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex justify-center gap-4 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-green-500/30"></span> Confirmado
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-primary/30"></span> Hoje
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-500/30"></span> Não confirmado
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-muted"></span> Futuro
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdCenterDashboard;
