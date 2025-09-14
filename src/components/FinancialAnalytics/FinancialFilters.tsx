import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Filter, X, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { FinancialFilters } from '@/hooks/useFinancialAnalytics';

interface FinancialFiltersProps {
  filters: FinancialFilters;
  onFiltersChange: (filters: FinancialFilters) => void;
}

export const FinancialFiltersComponent: React.FC<FinancialFiltersProps> = ({
  filters,
  onFiltersChange
}) => {
  const handlePeriodChange = (period: FinancialFilters['period']) => {
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    
    const today = new Date();
    
    switch (period) {
      case 'today':
        startDate = today;
        endDate = today;
        break;
      case '7d':
        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = today;
        break;
      case '30d':
        startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate = today;
        break;
      case '90d':
        startDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
        endDate = today;
        break;
      case 'year':
        startDate = new Date(today.getFullYear(), 0, 1);
        endDate = today;
        break;
      case 'custom':
        // Keep current dates
        startDate = filters.startDate;
        endDate = filters.endDate;
        break;
    }
    
    onFiltersChange({
      ...filters,
      period,
      startDate,
      endDate
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      startDate: null,
      endDate: null,
      realOnly: false,
      revenueType: 'all',
      period: '30d'
    });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.startDate || filters.endDate) count++;
    if (filters.realOnly) count++;
    if (filters.revenueType !== 'all') count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros Financeiros
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFiltersCount}
              </Badge>
            )}
          </CardTitle>
          {activeFiltersCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Limpar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Period Selection */}
          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={filters.period} onValueChange={handlePeriodChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="year">Este ano</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Range */}
          {filters.period === 'custom' && (
            <>
              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.startDate ? (
                        format(filters.startDate, "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        <span>Selecionar data</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.startDate || undefined}
                      onSelect={(date) => onFiltersChange({
                        ...filters,
                        startDate: date || null
                      })}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Data Final</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.endDate ? (
                        format(filters.endDate, "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        <span>Selecionar data</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.endDate || undefined}
                      onSelect={(date) => onFiltersChange({
                        ...filters,
                        endDate: date || null
                      })}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}

          {/* Revenue Type Filter */}
          <div className="space-y-2">
            <Label>Tipo de Receita</Label>
            <Select
              value={filters.revenueType}
              onValueChange={(value) => onFiltersChange({
                ...filters,
                revenueType: value as FinancialFilters['revenueType']
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="auctions">Só Leilões</SelectItem>
                <SelectItem value="packages">Só Pacotes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Real Data Only Toggle */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Só Dados Reais</Label>
            <p className="text-xs text-muted-foreground">
              Excluir dados de teste e desenvolvimento
            </p>
          </div>
          <Switch
            checked={filters.realOnly}
            onCheckedChange={(checked) => onFiltersChange({
              ...filters,
              realOnly: checked
            })}
          />
        </div>

        {/* Active Filters Display */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {(filters.startDate || filters.endDate) && (
              <Badge variant="outline" className="flex items-center gap-1">
                Período: {
                  filters.startDate && filters.endDate ? (
                    `${format(filters.startDate, "dd/MM/yy", { locale: ptBR })} - ${format(filters.endDate, "dd/MM/yy", { locale: ptBR })}`
                  ) : filters.startDate ? (
                    `A partir de ${format(filters.startDate, "dd/MM/yy", { locale: ptBR })}`
                  ) : filters.endDate ? (
                    `Até ${format(filters.endDate, "dd/MM/yy", { locale: ptBR })}`
                  ) : ''
                }
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => onFiltersChange({
                    ...filters,
                    startDate: null,
                    endDate: null,
                    period: '30d'
                  })}
                />
              </Badge>
            )}
            
            {filters.realOnly && (
              <Badge variant="outline" className="flex items-center gap-1">
                Só dados reais
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => onFiltersChange({
                    ...filters,
                    realOnly: false
                  })}
                />
              </Badge>
            )}
            
            {filters.revenueType !== 'all' && (
              <Badge variant="outline" className="flex items-center gap-1">
                {filters.revenueType === 'auctions' ? 'Só leilões' : 'Só pacotes'}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => onFiltersChange({
                    ...filters,
                    revenueType: 'all'
                  })}
                />
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
