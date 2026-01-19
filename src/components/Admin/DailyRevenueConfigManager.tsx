import { useState, useCallback } from 'react';
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
import { BarChart3, Save, Calendar, CheckCircle, Clock, AlertCircle, Gauge, Sparkles, Shuffle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDailyRevenueConfig, getWeeksForDailyConfig } from '@/hooks/useDailyRevenueConfig';

const DailyRevenueConfigManager = () => {
  // Draft state to preserve typed text (e.g., "0," while typing "0,3")
  const [percentageDrafts, setPercentageDrafts] = useState<Record<string, string>>({});
  // Weekly target for quick distribution
  const [weeklyTarget, setWeeklyTarget] = useState<string>('');
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
    partnerPlans,
    monthlyProgress
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

  // Get the display value for the input (draft if exists, otherwise formatted number)
  const getInputValue = useCallback((date: string, percentage: number): string => {
    if (percentageDrafts[date] !== undefined) {
      return percentageDrafts[date];
    }
    // Format number with comma for display
    if (percentage === 0) return '0';
    return String(percentage).replace('.', ',');
  }, [percentageDrafts]);

  // Handle input change with draft support
  const handlePercentageChange = useCallback((date: string, inputValue: string) => {
    // Normalize: replace comma with dot for internal processing
    let sanitized = inputValue.replace(',', '.');
    // Remove non-numeric chars except dot
    sanitized = sanitized.replace(/[^0-9.]/g, '');
    // Ensure only one decimal point
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      sanitized = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Store the draft (with comma for display)
    setPercentageDrafts(prev => ({
      ...prev,
      [date]: sanitized.replace('.', ',')
    }));
    
    // Update the numeric value
    const numValue = parseFloat(sanitized) || 0;
    const clampedValue = Math.min(100, Math.max(0, numValue));
    updateDayPercentage(date, clampedValue);
  }, [updateDayPercentage]);

  // Handle blur to normalize and clear draft
  const handlePercentageBlur = useCallback((date: string, percentage: number) => {
    // Clear draft and let the component use the numeric value
    setPercentageDrafts(prev => {
      const newDrafts = { ...prev };
      delete newDrafts[date];
      return newDrafts;
    });
  }, []);

  // Distribute weekly target across days with natural variation
  const distributeWeeklyTarget = useCallback(() => {
    const target = parseFloat(weeklyTarget.replace(',', '.')) || 0;
    if (target <= 0 || target > maxWeeklyPercentage) return;
    
    // Base weights per day of week (simulates natural revenue patterns)
    // Monday=good, Tuesday=weak, Wednesday=medium, Thursday=medium, 
    // Friday=strong, Saturday=medium, Sunday=weak
    const baseWeights = [1.1, 0.85, 0.95, 0.92, 1.2, 1.0, 0.88];
    
    // Add random variation of ±15% to each weight
    const randomizedWeights = baseWeights.map(weight => {
      const randomFactor = 0.85 + Math.random() * 0.30; // 0.85 to 1.15
      return weight * randomFactor;
    });
    
    // Normalize so that sum equals target
    const totalWeight = randomizedWeights.reduce((a, b) => a + b, 0);
    const dailyValues = randomizedWeights.map(w => (w / totalWeight) * target);
    
    // Round to 2 decimal places, ensuring sum = target
    let roundedValues = dailyValues.map(v => Math.round(v * 100) / 100);
    const currentSum = roundedValues.reduce((a, b) => a + b, 0);
    const diff = Math.round((target - currentSum) * 100) / 100;
    
    // Adjust the largest value to compensate for rounding
    const maxIndex = roundedValues.indexOf(Math.max(...roundedValues));
    roundedValues[maxIndex] = Math.round((roundedValues[maxIndex] + diff) * 100) / 100;
    
    // Apply to week days and clear drafts
    configs.forEach((config, index) => {
      updateDayPercentage(config.date, roundedValues[index]);
    });
    
    // Clear all drafts so values display correctly
    setPercentageDrafts({});
  }, [weeklyTarget, maxWeeklyPercentage, configs, updateDayPercentage]);

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

        {/* Quick Distribution */}
        <div className="space-y-3 p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <Label className="font-medium">Distribuição Rápida</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Informe o total desejado e o sistema distribuirá automaticamente entre os dias 
            com variação natural (simulando faturamento real da plataforma).
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="weekly-target" className="text-xs">Meta Semanal (%)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="weekly-target"
                  type="text"
                  inputMode="decimal"
                  value={weeklyTarget}
                  onChange={(e) => setWeeklyTarget(e.target.value.replace(',', '.'))}
                  placeholder="Ex: 2.5"
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <Button 
              variant="secondary"
              onClick={distributeWeeklyTarget}
              disabled={!weeklyTarget || parseFloat(weeklyTarget.replace(',', '.')) <= 0 || parseFloat(weeklyTarget.replace(',', '.')) > maxWeeklyPercentage}
            >
              <Shuffle className="h-4 w-4 mr-2" />
              Distribuir
            </Button>
            <p className="text-xs text-muted-foreground self-center">
              Máximo: {maxWeeklyPercentage}%
            </p>
          </div>
        </div>

        <Separator />

        {/* Monthly Progress */}
        <div className="space-y-3 p-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-lg border border-emerald-500/20">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <Label className="font-medium">Progresso Mensal (4 semanas)</Label>
          </div>
          
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-2 rounded-lg bg-background/50">
              <p className="text-2xl font-bold text-emerald-600">
                {monthlyProgress.accumulated.toFixed(2)}%
              </p>
              <p className="text-xs text-muted-foreground">Acumulado</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/50">
              <p className="text-2xl font-bold text-amber-600">
                {monthlyProgress.remaining.toFixed(2)}%
              </p>
              <p className="text-xs text-muted-foreground">Restante</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/50">
              <p className="text-2xl font-bold text-slate-600">
                {monthlyProgress.limit.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">Limite Mensal</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <Progress 
              value={Math.min((monthlyProgress.accumulated / monthlyProgress.limit) * 100, 100)}
              className={cn(
                "h-3",
                monthlyProgress.accumulated >= monthlyProgress.limit 
                  ? '[&>div]:bg-destructive' 
                  : monthlyProgress.accumulated >= monthlyProgress.limit * 0.9 
                    ? '[&>div]:bg-yellow-500' 
                    : '[&>div]:bg-emerald-500'
              )}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>{monthlyProgress.limit.toFixed(1)}%</span>
            </div>
          </div>

          {/* Weekly Breakdown */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            {monthlyProgress.weeks.map((week, index) => (
              <div 
                key={week.weekStart}
                className={cn(
                  "p-2 rounded border transition-all",
                  week.isCurrent 
                    ? "bg-primary/10 border-primary/30 font-medium ring-2 ring-primary/20" 
                    : "bg-muted/50 border-muted"
                )}
              >
                <p className="text-muted-foreground mb-0.5">Sem {index + 1}</p>
                <p className={cn(
                  "font-semibold",
                  week.isCurrent ? "text-primary" : ""
                )}>
                  {week.percentage.toFixed(2)}%
                </p>
                {week.isCurrent && (
                  <p className="text-[10px] text-primary mt-0.5">atual</p>
                )}
              </div>
            ))}
          </div>
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
                      type="text"
                      inputMode="decimal"
                      value={getInputValue(config.date, config.percentage)}
                      onChange={(e) => handlePercentageChange(config.date, e.target.value)}
                      onBlur={() => handlePercentageBlur(config.date, config.percentage)}
                      placeholder="0,0"
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
