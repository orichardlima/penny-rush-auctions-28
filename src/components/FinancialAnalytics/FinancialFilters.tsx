import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, FilterIcon, X, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface FinancialFilters {
  startDate: Date | null;
  endDate: Date | null;
  realDataOnly: boolean;
  revenueType: 'all' | 'auctions' | 'packages';
  period: 'custom' | 'today' | '7days' | '30days' | '90days' | 'year';
}

interface FinancialFiltersProps {
  filters: FinancialFilters;
  onFiltersChange: (filters: FinancialFilters) => void;
  loading?: boolean;
}

export const FinancialFiltersComponent: React.FC<FinancialFiltersProps> = ({
  filters,
  onFiltersChange,
  loading = false
}) => {
  const handlePeriodChange = (period: FinancialFilters['period']) => {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    switch (period) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        break;
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = new Date();
        break;
      case '30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate = new Date();
        break;
      case '90days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        endDate = new Date();
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date();
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

  const handleDateRangeChange = (startDate: Date | null, endDate: Date | null) => {
    onFiltersChange({
      ...filters,
      period: 'custom',
      startDate,
      endDate
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      startDate: null,
      endDate: null,
      realDataOnly: false,
      revenueType: 'all',
      period: '30days'
    });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.startDate || filters.endDate) count++;
    if (filters.realDataOnly) count++;
    if (filters.revenueType !== 'all') count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FilterIcon className="h-4 w-4" />
            Filtros Financeiros
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFiltersCount}
              </Badge>
            )}
          </CardTitle>
          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 px-2"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Limpar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Period Selector */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">PERÍODO</Label>
          <Select
            value={filters.period}
            onValueChange={handlePeriodChange}
            disabled={loading}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7days">Últimos 7 dias</SelectItem>
              <SelectItem value="30days">Últimos 30 dias</SelectItem>
              <SelectItem value="90days">Últimos 90 dias</SelectItem>
              <SelectItem value="year">Este ano</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Custom Date Range */}
        {filters.period === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">De</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-8 justify-start text-left font-normal",
                      !filters.startDate && "text-muted-foreground"
                    )}
                    disabled={loading}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {filters.startDate ? format(filters.startDate, "dd/MM") : "Início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.startDate}
                    onSelect={(date) => handleDateRangeChange(date || null, filters.endDate)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Até</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-8 justify-start text-left font-normal",
                      !filters.endDate && "text-muted-foreground"
                    )}
                    disabled={loading}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {filters.endDate ? format(filters.endDate, "dd/MM") : "Fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.endDate}
                    onSelect={(date) => handleDateRangeChange(filters.startDate, date || null)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        {/* Real Data Only Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-xs font-medium text-muted-foreground">DADOS REAIS</Label>
            <p className="text-xs text-muted-foreground">Excluir dados de teste/desenvolvimento</p>
          </div>
          <Switch
            checked={filters.realDataOnly}
            onCheckedChange={(checked) =>
              onFiltersChange({ ...filters, realDataOnly: checked })
            }
            disabled={loading}
          />
        </div>

        {/* Revenue Type Filter */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">TIPO DE RECEITA</Label>
          <Select
            value={filters.revenueType}
            onValueChange={(value: FinancialFilters['revenueType']) =>
              onFiltersChange({ ...filters, revenueType: value })
            }
            disabled={loading}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="auctions">Apenas Leilões</SelectItem>
              <SelectItem value="packages">Apenas Pacotes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active Filters Display */}
        {activeFiltersCount > 0 && (
          <div className="pt-2 border-t">
            <div className="flex flex-wrap gap-1">
              {filters.realDataOnly && (
                <Badge variant="secondary" className="text-xs">
                  Dados Reais
                  <button
                    onClick={() => onFiltersChange({ ...filters, realDataOnly: false })}
                    className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full"
                    disabled={loading}
                  >
                    <X className="h-2 w-2" />
                  </button>
                </Badge>
              )}
              {filters.revenueType !== 'all' && (
                <Badge variant="secondary" className="text-xs">
                  {filters.revenueType === 'auctions' ? 'Leilões' : 'Pacotes'}
                  <button
                    onClick={() => onFiltersChange({ ...filters, revenueType: 'all' })}
                    className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full"
                    disabled={loading}
                  >
                    <X className="h-2 w-2" />
                  </button>
                </Badge>
              )}
              {(filters.startDate || filters.endDate) && (
                <Badge variant="secondary" className="text-xs">
                  {filters.period === 'custom' ? 'Personalizado' : 
                   filters.period === 'today' ? 'Hoje' :
                   filters.period === '7days' ? '7 dias' :
                   filters.period === '30days' ? '30 dias' :
                   filters.period === '90days' ? '90 dias' : 'Este ano'}
                  <button
                    onClick={() => handlePeriodChange('30days')}
                    className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full"
                    disabled={loading}
                  >
                    <X className="h-2 w-2" />
                  </button>
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
