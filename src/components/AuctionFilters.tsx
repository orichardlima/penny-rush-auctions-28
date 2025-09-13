import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';

export interface FilterState {
  search: string;
  status: 'all' | 'active' | 'waiting' | 'finished';
  priceRange: [number, number];
  sortBy: 'newest' | 'oldest' | 'price_low' | 'price_high' | 'ending_soon';
}

interface AuctionFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  totalResults: number;
}

export const AuctionFilters = ({ filters, onFiltersChange, totalResults }: AuctionFiltersProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = (key: keyof FilterState, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      status: 'all',
      priceRange: [0, 10000],
      sortBy: 'newest',
    });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status !== 'all') count++;
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 10000) count++;
    if (filters.sortBy !== 'newest') count++;
    return count;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  return (
    <div className="bg-background border-b border-border/50 sticky top-16 z-40">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          {/* Barra de busca */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar leilões..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filtros rápidos */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="waiting">Aguardando</SelectItem>
                <SelectItem value="finished">Finalizados</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.sortBy} onValueChange={(value) => updateFilter('sortBy', value)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Mais recentes</SelectItem>
                <SelectItem value="oldest">Mais antigos</SelectItem>
                <SelectItem value="price_low">Menor preço</SelectItem>
                <SelectItem value="price_high">Maior preço</SelectItem>
                <SelectItem value="ending_soon">Terminando logo</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtros avançados */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="relative">
                  <Filter className="w-4 h-4 mr-2" />
                  Filtros
                  {getActiveFiltersCount() > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                    >
                      {getActiveFiltersCount()}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filtros Avançados</SheetTitle>
                  <SheetDescription>
                    Refine sua busca por leilões
                  </SheetDescription>
                </SheetHeader>
                
                <div className="space-y-6 mt-6">
                  <div className="space-y-3">
                    <Label>Faixa de Preço</Label>
                    <div className="px-3">
                      <Slider
                        value={filters.priceRange}
                        onValueChange={(value) => updateFilter('priceRange', value)}
                        max={10000}
                        min={0}
                        step={100}
                        className="w-full"
                      />
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{formatPrice(filters.priceRange[0])}</span>
                      <span>{formatPrice(filters.priceRange[1])}</span>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4 border-t">
                    <Button variant="outline" onClick={clearFilters}>
                      <X className="w-4 h-4 mr-2" />
                      Limpar
                    </Button>
                    <Button onClick={() => setIsOpen(false)}>
                      Aplicar Filtros
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Resume dos resultados e filtros ativos */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
          <div className="text-sm text-muted-foreground">
            {totalResults} leilão{totalResults !== 1 ? 'es' : ''} encontrado{totalResults !== 1 ? 's' : ''}
          </div>
          
          {getActiveFiltersCount() > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Filtros ativos:</span>
              {filters.status !== 'all' && (
                <Badge variant="secondary" className="text-xs">
                  Status: {filters.status === 'active' ? 'Ativo' : filters.status === 'waiting' ? 'Aguardando' : 'Finalizado'}
                </Badge>
              )}
              {filters.search && (
                <Badge variant="secondary" className="text-xs">
                  Busca: "{filters.search}"
                </Badge>
              )}
              {(filters.priceRange[0] > 0 || filters.priceRange[1] < 10000) && (
                <Badge variant="secondary" className="text-xs">
                  Preço: {formatPrice(filters.priceRange[0])} - {formatPrice(filters.priceRange[1])}
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-xs">
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};