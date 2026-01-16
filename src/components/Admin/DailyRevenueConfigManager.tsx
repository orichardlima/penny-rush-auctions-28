import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarChart3, Save, Calendar, CheckCircle, Clock, AlertCircle, Gauge } from 'lucide-react';
import { useDailyRevenueConfig, getWeeksForDailyConfig } from '@/hooks/useDailyRevenueConfig';

const DailyRevenueConfigManager = () => {
  const {
    configs,
    weekTotal,
    totalAportes,
    totalWeeklyCaps,
    loading,
    saving,
    calculationBase,
    setCalculationBase,
    description,
    setDescription,
    updateDayPercentage,
    saveAllConfigs,
    setSelectedWeek,
    selectedWeek,
    maxWeeklyPercentage,
    isOverLimit,
    remainingPercentage,
    partnerPlans
  } = useDailyRevenueConfig();

  const weeks = getWeeksForDailyConfig(12);

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (config: typeof configs[0]) => {
    if (config.isToday) {
      return (
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
          <Clock className="h-3 w-3 mr-1" />
          Hoje
        </Badge>
      );
    }
    
    if (config.isConfigured && config.percentage > 0) {
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle className="h-3 w-3 mr-1" />
          Configurado
        </Badge>
      );
    }
    
    if (config.isPast) {
      return (
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
          <AlertCircle className="h-3 w-3 mr-1" />
          Pendente
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground">
        Futuro
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Configurar Faturamento Diário
        </CardTitle>
        <CardDescription>
          Configure a porcentagem de cada dia para cálculo dos repasses dos parceiros
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Max Weekly Limit Info */}
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Limite Máximo Semanal:</span>
            <span className="font-medium">{maxWeeklyPercentage}%</span>
          </div>
          <Badge variant="outline" className="text-xs">
            Configurável em Sistema
          </Badge>
        </div>

        {/* Week Selector */}
        <div className="space-y-2">
          <Label className="font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Semana
          </Label>
          <Select value={selectedWeek} onValueChange={setSelectedWeek}>
            <SelectTrigger className="w-full sm:w-[280px]">
              <SelectValue placeholder="Selecione a semana" />
            </SelectTrigger>
            <SelectContent>
              {weeks.map((week, index) => (
                <SelectItem key={week.value} value={week.value}>
                  {week.label} {index === 0 && '(Atual)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Calculation Base */}
        <div className="space-y-3">
          <Label className="font-medium">Base de Cálculo</Label>
          <RadioGroup 
            value={calculationBase} 
            onValueChange={(value) => setCalculationBase(value as 'aporte' | 'weekly_cap')}
            className="flex flex-wrap gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="aporte" id="base-aporte" />
              <Label htmlFor="base-aporte" className="flex flex-col cursor-pointer">
                <span className="font-medium">Valor Investido</span>
                <span className="text-xs text-muted-foreground">
                  % sobre o aporte de cada parceiro
                </span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="weekly_cap" id="base-weekly-cap" />
              <Label htmlFor="base-weekly-cap" className="flex flex-col cursor-pointer">
                <span className="font-medium">Limite Semanal</span>
                <span className="text-xs text-muted-foreground">
                  % limitado ao cap semanal de cada parceiro
                </span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <Separator />

        {/* Days Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Dia</TableHead>
                <TableHead className="w-[140px]">Porcentagem (%)</TableHead>
                <TableHead>Exemplos por Plano</TableHead>
                <TableHead className="w-[130px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((config) => (
                <TableRow 
                  key={config.date}
                  className={config.isToday ? 'bg-primary/5' : ''}
                >
                  <TableCell>
                    <div className={`font-medium ${config.isToday ? 'text-primary' : ''}`}>
                      {config.dayName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {config.dayNumber}/{config.monthShort}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={config.percentage || ''}
                      onChange={(e) => updateDayPercentage(config.date, parseFloat(e.target.value) || 0)}
                      placeholder="0.0"
                      className={`w-24 ${isOverLimit ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                    />
                  </TableCell>
                  <TableCell>
                    {config.percentage > 0 && partnerPlans.length > 0 ? (
                      <div className="flex flex-col gap-0.5 text-xs">
                        {partnerPlans.map(plan => (
                          <span key={plan.name} className="text-muted-foreground">
                            <span className="font-medium text-foreground">{plan.display_name}:</span>{' '}
                            {formatPrice(plan.aporte_value * (config.percentage / 100))}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(config)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Footnote */}
        <p className="text-xs text-muted-foreground">
          * Cada parceiro recebe proporcional ao seu aporte individual
          {calculationBase === 'weekly_cap' && ' (limitado ao cap semanal)'}
        </p>

        <Separator />

        {/* Summary with Progress Bar */}
        <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="font-medium text-lg">
                Porcentagem Total: {weekTotal.percentage.toFixed(1)}%
              </p>
              <p className="text-sm text-muted-foreground">
                Valor Estimado Total: ~{formatPrice(weekTotal.estimatedValue)}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              Limite: {maxWeeklyPercentage}% | Restante: {remainingPercentage.toFixed(1)}%
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress 
              value={Math.min((weekTotal.percentage / maxWeeklyPercentage) * 100, 100)}
              className={`h-3 ${isOverLimit ? '[&>div]:bg-destructive' : weekTotal.percentage >= maxWeeklyPercentage * 0.9 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'}`}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>{maxWeeklyPercentage}%</span>
            </div>
          </div>

          {/* Over Limit Alert */}
          {isOverLimit && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Limite excedido em {(weekTotal.percentage - maxWeeklyPercentage).toFixed(1)}%! 
                Reduza as porcentagens para poder salvar.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Descrição (opcional)</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Configuração janeiro 2026"
          />
        </div>

        {/* Save Button */}
        <Button 
          onClick={saveAllConfigs} 
          disabled={saving || isOverLimit}
          className="w-full sm:w-auto"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Salvando...' : isOverLimit ? 'Limite Excedido' : 'Salvar Configurações'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default DailyRevenueConfigManager;
