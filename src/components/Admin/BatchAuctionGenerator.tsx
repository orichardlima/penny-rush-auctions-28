import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ProductTemplate, TEMPLATE_CATEGORIES } from '@/hooks/useProductTemplates';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Rocket, Clock, Shuffle, Calendar, Package, CheckCircle } from 'lucide-react';
import { format, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BatchAuctionGeneratorProps {
  templates: ProductTemplate[];
  onClose: () => void;
}

const INTERVAL_OPTIONS = [
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 45, label: '45 minutos' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1h 30min' },
  { value: 120, label: '2 horas' },
  { value: 180, label: '3 horas' },
];

export const BatchAuctionGenerator = ({ templates, onClose }: BatchAuctionGeneratorProps) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [startDateTime, setStartDateTime] = useState(() => {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
    return format(now, "yyyy-MM-dd'T'HH:mm");
  });
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [shuffleOrder, setShuffleOrder] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isGenerating, setIsGenerating] = useState(false);

  const filteredTemplates = categoryFilter === 'all'
    ? templates
    : templates.filter(t => t.category === categoryFilter);

  const selectedTemplates = useMemo(() => {
    let selected = templates.filter(t => selectedIds.includes(t.id));
    if (shuffleOrder) {
      selected = [...selected].sort(() => Math.random() - 0.5);
    }
    return selected;
  }, [selectedIds, templates, shuffleOrder]);

  const scheduledAuctions = useMemo(() => {
    const baseDate = new Date(startDateTime);
    return selectedTemplates.map((template, index) => ({
      template,
      startsAt: addMinutes(baseDate, index * intervalMinutes)
    }));
  }, [selectedTemplates, startDateTime, intervalMinutes]);

  const toggleTemplate = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedIds(filteredTemplates.map(t => t.id));
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  const handleGenerate = async () => {
    if (selectedIds.length === 0) {
      toast.error('Selecione pelo menos um produto');
      return;
    }

    setIsGenerating(true);

    try {
      const auctions = scheduledAuctions.map(({ template, startsAt }) => ({
        title: template.title,
        description: template.description,
        image_url: template.image_url,
        market_value: template.market_value,
        revenue_target: template.revenue_target,
        starting_price: template.starting_price,
        current_price: template.starting_price,
        bid_increment: template.bid_increment,
        bid_cost: template.bid_cost,
        starts_at: startsAt.toISOString(),
        status: 'waiting',
        time_left: 15,
        total_bids: 0,
        company_revenue: 0
      }));

      const { data, error } = await supabase
        .from('auctions')
        .insert(auctions)
        .select();

      if (error) throw error;

      // Increment times_used for each template
      for (const id of selectedIds) {
        const template = templates.find(t => t.id === id);
        if (template) {
          await supabase
            .from('product_templates')
            .update({ times_used: template.times_used + 1 })
            .eq('id', id);
        }
      }

      toast.success(`${auctions.length} leilões criados com sucesso!`);
      onClose();
    } catch (error: any) {
      console.error('Error generating auctions:', error);
      toast.error('Erro ao gerar leilões: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const totalDuration = selectedIds.length > 0 
    ? (selectedIds.length - 1) * intervalMinutes 
    : 0;

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xl font-semibold">
        <Rocket className="h-6 w-6 text-primary" />
        Gerar Leilões em Lote
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left column - Template selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Selecione os Produtos
            </Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {TEMPLATE_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Selecionar Todos
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAll}>
              Limpar Seleção
            </Button>
          </div>

          <ScrollArea className="h-[300px] border rounded-md p-2">
            {filteredTemplates.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum template ativo encontrado
              </p>
            ) : (
              <div className="space-y-2">
                {filteredTemplates.map(template => (
                  <div
                    key={template.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedIds.includes(template.id) 
                        ? 'bg-primary/10 border-primary' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => toggleTemplate(template.id)}
                  >
                    <Checkbox 
                      checked={selectedIds.includes(template.id)}
                      onCheckedChange={() => toggleTemplate(template.id)}
                    />
                    {template.image_url ? (
                      <img 
                        src={template.image_url} 
                        alt={template.title}
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{template.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(template.market_value)}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {TEMPLATE_CATEGORIES.find(c => c.value === template.category)?.label}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right column - Configuration & Preview */}
        <div className="space-y-4">
          <Label className="text-base font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Configurações de Tempo
          </Label>

          <div className="space-y-4 p-4 border rounded-lg">
            <div className="grid gap-2">
              <Label htmlFor="startDateTime" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Início do Primeiro Leilão
              </Label>
              <Input
                id="startDateTime"
                type="datetime-local"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label>Intervalo entre Leilões</Label>
              <Select 
                value={intervalMinutes.toString()} 
                onValueChange={(v) => setIntervalMinutes(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox 
                id="shuffle"
                checked={shuffleOrder}
                onCheckedChange={(checked) => setShuffleOrder(checked === true)}
              />
              <Label htmlFor="shuffle" className="flex items-center gap-2 cursor-pointer">
                <Shuffle className="h-4 w-4" />
                Embaralhar ordem dos produtos
              </Label>
            </div>
          </div>

          {selectedIds.length > 0 && (
            <>
              <Separator />
              
              <div>
                <Label className="text-base font-medium flex items-center gap-2 mb-3">
                  <CheckCircle className="h-4 w-4" />
                  Prévia dos Leilões ({selectedIds.length})
                </Label>
                
                <ScrollArea className="h-[180px] border rounded-md p-2">
                  <div className="space-y-2">
                    {scheduledAuctions.map(({ template, startsAt }, index) => (
                      <div key={template.id} className="flex items-center gap-3 p-2 rounded bg-muted/30">
                        <Badge variant="outline" className="shrink-0 w-16 justify-center">
                          {format(startsAt, 'HH:mm')}
                        </Badge>
                        <span className="text-sm truncate">{template.title}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="mt-3 p-3 bg-muted/50 rounded-lg text-sm">
                  <p><strong>Total:</strong> {selectedIds.length} leilões</p>
                  <p><strong>Duração estimada:</strong> {formatDuration(totalDuration)}</p>
                  <p><strong>Último leilão:</strong> {scheduledAuctions.length > 0 
                    ? format(scheduledAuctions[scheduledAuctions.length - 1].startsAt, "dd/MM 'às' HH:mm", { locale: ptBR })
                    : '-'
                  }</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Separator />

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button 
          onClick={handleGenerate} 
          disabled={selectedIds.length === 0 || isGenerating}
          className="gap-2"
        >
          <Rocket className="h-4 w-4" />
          {isGenerating ? 'Gerando...' : `Gerar ${selectedIds.length} Leilões`}
        </Button>
      </div>
    </div>
  );
};
