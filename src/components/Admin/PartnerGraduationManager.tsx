import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAdminPartnerLevels, PartnerLevel, NewPartnerLevel } from '@/hooks/useAdminPartnerLevels';
import { 
  Trophy, 
  Plus, 
  Edit, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Save, 
  RefreshCw,
  Star,
  Calculator,
  Target,
  Award,
  Sparkles
} from 'lucide-react';

const AVAILABLE_COLORS = [
  { value: 'gray-500', label: 'Cinza', class: 'bg-gray-500' },
  { value: 'orange-600', label: 'Laranja', class: 'bg-orange-600' },
  { value: 'slate-400', label: 'Prata', class: 'bg-slate-400' },
  { value: 'yellow-500', label: 'Dourado', class: 'bg-yellow-500' },
  { value: 'purple-500', label: 'Roxo', class: 'bg-purple-500' },
  { value: 'cyan-400', label: 'Ciano', class: 'bg-cyan-400' },
  { value: 'green-500', label: 'Verde', class: 'bg-green-500' },
  { value: 'red-500', label: 'Vermelho', class: 'bg-red-500' },
  { value: 'blue-500', label: 'Azul', class: 'bg-blue-500' },
  { value: 'pink-500', label: 'Rosa', class: 'bg-pink-500' },
];

const AVAILABLE_ICONS = ['🌱', '🥉', '🥈', '🥇', '💫', '💎', '👑', '🏆', '⭐', '🔥', '💰', '🚀'];

const PartnerGraduationManager = () => {
  const {
    levels,
    planPoints,
    loading,
    saving,
    stats,
    createLevel,
    updateLevel,
    deleteLevel,
    toggleLevel,
    reorderLevels,
    updatePlanPoints,
    refreshData
  } = useAdminPartnerLevels();

  const [isCreating, setIsCreating] = useState(false);
  const [editingLevel, setEditingLevel] = useState<PartnerLevel | null>(null);
  const [editingPoints, setEditingPoints] = useState<Record<string, number>>({});

  // Simulator state
  const [simStart, setSimStart] = useState(0);
  const [simPro, setSimPro] = useState(0);
  const [simElite, setSimElite] = useState(0);

  // New level form
  const [newLevel, setNewLevel] = useState<NewPartnerLevel>({
    name: '',
    display_name: '',
    icon: '🌱',
    min_points: 0,
    color: 'gray-500',
    bonus_percentage_increase: 0,
    sort_order: 0,
    is_active: true
  });

  // Get points for each plan
  const getPointsForPlan = (planName: string): number => {
    const config = planPoints.find(p => p.plan_name.toUpperCase() === planName.toUpperCase());
    return config?.points || 0;
  };

  // Simulator calculation
  const simulatorResult = useMemo(() => {
    const startPoints = getPointsForPlan('START');
    const proPoints = getPointsForPlan('PRO');
    const elitePoints = getPointsForPlan('ELITE');

    const totalPoints = (simStart * startPoints) + (simPro * proPoints) + (simElite * elitePoints);

    // Find current level
    let currentLevel: PartnerLevel | null = null;
    let nextLevel: PartnerLevel | null = null;

    const activeLevels = levels.filter(l => l.is_active).sort((a, b) => a.min_points - b.min_points);

    for (const level of activeLevels) {
      if (totalPoints >= level.min_points) {
        currentLevel = level;
      } else if (!nextLevel) {
        nextLevel = level;
      }
    }

    const pointsToNext = nextLevel ? nextLevel.min_points - totalPoints : 0;
    const progressToNext = nextLevel && currentLevel 
      ? ((totalPoints - currentLevel.min_points) / (nextLevel.min_points - currentLevel.min_points)) * 100
      : 100;

    return {
      totalPoints,
      currentLevel,
      nextLevel,
      pointsToNext,
      progressToNext: Math.min(progressToNext, 100),
      startPoints,
      proPoints,
      elitePoints
    };
  }, [simStart, simPro, simElite, levels, planPoints]);

  const handleCreateLevel = async () => {
    const success = await createLevel({
      ...newLevel,
      sort_order: levels.length
    });
    if (success) {
      setIsCreating(false);
      setNewLevel({
        name: '',
        display_name: '',
        icon: '🌱',
        min_points: 0,
        color: 'gray-500',
        bonus_percentage_increase: 0,
        sort_order: 0,
        is_active: true
      });
    }
  };

  const handleUpdateLevel = async () => {
    if (!editingLevel) return;
    const success = await updateLevel(editingLevel.id, editingLevel);
    if (success) {
      setEditingLevel(null);
    }
  };

  const handleMoveLevel = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= levels.length) return;

    const reordered = [...levels];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    await reorderLevels(reordered);
  };

  const handleSavePlanPoints = async (id: string) => {
    const points = editingPoints[id];
    if (points !== undefined) {
      await updatePlanPoints(id, points);
      setEditingPoints(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
    }
  };

  const getLevelColorClass = (color: string) => {
    const colorConfig = AVAILABLE_COLORS.find(c => c.value === color);
    return colorConfig?.class || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Gerenciamento de Graduações
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure os níveis de parceiro e pontos necessários para cada graduação
          </p>
        </div>
        <Button variant="outline" onClick={refreshData} disabled={saving}>
          <RefreshCw className={`h-4 w-4 mr-2 ${saving ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Níveis Ativos</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeLevels}</div>
            <p className="text-xs text-muted-foreground">de {stats.totalLevels} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planos Configurados</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPlansConfigured}</div>
            <p className="text-xs text-muted-foreground">com pontos definidos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faixa de Pontos</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0 - {stats.maxPoints}</div>
            <p className="text-xs text-muted-foreground">pontos necessários</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bônus Máximo</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{stats.maxBonus}%</div>
            <p className="text-xs text-muted-foreground">no maior nível</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="levels" className="space-y-4">
        <TabsList>
          <TabsTrigger value="levels">
            <Trophy className="h-4 w-4 mr-2" />
            Graduações
          </TabsTrigger>
          <TabsTrigger value="points">
            <Target className="h-4 w-4 mr-2" />
            Pontos por Plano
          </TabsTrigger>
          <TabsTrigger value="simulator">
            <Calculator className="h-4 w-4 mr-2" />
            Simulador
          </TabsTrigger>
        </TabsList>

        {/* Graduações Tab */}
        <TabsContent value="levels" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Níveis de Graduação</CardTitle>
                <CardDescription>
                  Gerencie os níveis que os parceiros podem alcançar com base em pontos
                </CardDescription>
              </div>
              <Dialog open={isCreating} onOpenChange={setIsCreating}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Graduação
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Nova Graduação</DialogTitle>
                    <DialogDescription>
                      Defina os parâmetros para o novo nível de parceiro
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Ícone</Label>
                        <Select
                          value={newLevel.icon}
                          onValueChange={(value) => setNewLevel(prev => ({ ...prev, icon: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_ICONS.map(icon => (
                              <SelectItem key={icon} value={icon}>
                                <span className="text-lg">{icon}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Cor</Label>
                        <Select
                          value={newLevel.color}
                          onValueChange={(value) => setNewLevel(prev => ({ ...prev, color: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_COLORS.map(color => (
                              <SelectItem key={color.value} value={color.value}>
                                <div className="flex items-center gap-2">
                                  <div className={`w-4 h-4 rounded ${color.class}`} />
                                  {color.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Nome Interno (sem espaços)</Label>
                      <Input
                        value={newLevel.name}
                        onChange={(e) => setNewLevel(prev => ({ 
                          ...prev, 
                          name: e.target.value.toUpperCase().replace(/\s/g, '_')
                        }))}
                        placeholder="Ex: BRONZE"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nome de Exibição</Label>
                      <Input
                        value={newLevel.display_name}
                        onChange={(e) => setNewLevel(prev => ({ ...prev, display_name: e.target.value }))}
                        placeholder="Ex: Bronze"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Pontos Mínimos</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newLevel.min_points}
                        onChange={(e) => setNewLevel(prev => ({ ...prev, min_points: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Bônus Extra (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={newLevel.bonus_percentage_increase}
                        onChange={(e) => setNewLevel(prev => ({ ...prev, bonus_percentage_increase: parseFloat(e.target.value) || 0 }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Porcentagem adicional na comissão de indicação
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreating(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateLevel} disabled={saving || !newLevel.name || !newLevel.display_name}>
                      {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                      Criar Graduação
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Ordem</TableHead>
                    <TableHead className="w-16">Ícone</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Pontos Mín.</TableHead>
                    <TableHead>Bônus Extra</TableHead>
                    <TableHead>Cor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {levels.map((level, index) => (
                    <TableRow key={level.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleMoveLevel(index, 'up')}
                            disabled={index === 0 || saving}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleMoveLevel(index, 'down')}
                            disabled={index === levels.length - 1 || saving}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-2xl">{level.icon}</span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{level.display_name}</p>
                          <p className="text-xs text-muted-foreground">{level.name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{level.min_points} pts</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                          +{level.bonus_percentage_increase}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className={`w-6 h-6 rounded ${getLevelColorClass(level.color)}`} />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={level.is_active}
                          onCheckedChange={(checked) => toggleLevel(level.id, checked)}
                          disabled={saving}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="icon"
                                onClick={() => setEditingLevel({ ...level })}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Editar Graduação</DialogTitle>
                                <DialogDescription>
                                  Modifique os parâmetros do nível
                                </DialogDescription>
                              </DialogHeader>
                              {editingLevel && (
                                <div className="space-y-4 py-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label>Ícone</Label>
                                      <Select
                                        value={editingLevel.icon}
                                        onValueChange={(value) => setEditingLevel(prev => prev ? { ...prev, icon: value } : null)}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {AVAILABLE_ICONS.map(icon => (
                                            <SelectItem key={icon} value={icon}>
                                              <span className="text-lg">{icon}</span>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Cor</Label>
                                      <Select
                                        value={editingLevel.color}
                                        onValueChange={(value) => setEditingLevel(prev => prev ? { ...prev, color: value } : null)}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {AVAILABLE_COLORS.map(color => (
                                            <SelectItem key={color.value} value={color.value}>
                                              <div className="flex items-center gap-2">
                                                <div className={`w-4 h-4 rounded ${color.class}`} />
                                                {color.label}
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Nome Interno</Label>
                                    <Input
                                      value={editingLevel.name}
                                      onChange={(e) => setEditingLevel(prev => prev ? { 
                                        ...prev, 
                                        name: e.target.value.toUpperCase().replace(/\s/g, '_')
                                      } : null)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Nome de Exibição</Label>
                                    <Input
                                      value={editingLevel.display_name}
                                      onChange={(e) => setEditingLevel(prev => prev ? { ...prev, display_name: e.target.value } : null)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Pontos Mínimos</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={editingLevel.min_points}
                                      onChange={(e) => setEditingLevel(prev => prev ? { ...prev, min_points: parseInt(e.target.value) || 0 } : null)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Bônus Extra (%)</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.5"
                                      value={editingLevel.bonus_percentage_increase}
                                      onChange={(e) => setEditingLevel(prev => prev ? { ...prev, bonus_percentage_increase: parseFloat(e.target.value) || 0 } : null)}
                                    />
                                  </div>
                                </div>
                              )}
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setEditingLevel(null)}>
                                  Cancelar
                                </Button>
                                <Button onClick={handleUpdateLevel} disabled={saving}>
                                  {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                  Salvar
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>

                          {level.min_points !== 0 && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir Graduação</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir o nível "{level.display_name}"? Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteLevel(level.id)}>
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pontos por Plano Tab */}
        <TabsContent value="points" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pontos por Plano</CardTitle>
              <CardDescription>
                Configure quantos pontos cada plano gera para quem indica
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Como funciona:</strong> Quando um novo parceiro entra usando um código de indicação, 
                    o indicador recebe os pontos correspondentes ao plano escolhido. Esses pontos acumulam 
                    e determinam a graduação do parceiro.
                  </p>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plano</TableHead>
                      <TableHead>Pontos Gerados</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {planPoints.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell>
                          <Badge variant="outline" className="text-base">
                            {plan.plan_name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              className="w-24"
                              value={editingPoints[plan.id] !== undefined ? editingPoints[plan.id] : plan.points}
                              onChange={(e) => setEditingPoints(prev => ({
                                ...prev,
                                [plan.id]: parseInt(e.target.value) || 0
                              }))}
                            />
                            <span className="text-muted-foreground">pts</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {editingPoints[plan.id] !== undefined && editingPoints[plan.id] !== plan.points && (
                            <Button 
                              size="sm" 
                              onClick={() => handleSavePlanPoints(plan.id)}
                              disabled={saving}
                            >
                              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                              Salvar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Simulador Tab */}
        <TabsContent value="simulator" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Simulador de Progressão</CardTitle>
              <CardDescription>
                Simule quantos pontos um parceiro acumularia com diferentes quantidades de indicações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <Label className="flex items-center justify-between">
                    <span>Indicações START</span>
                    <Badge variant="outline">{simulatorResult.startPoints} pts cada</Badge>
                  </Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[simStart]}
                      onValueChange={([value]) => setSimStart(value)}
                      max={50}
                      step={1}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min="0"
                      max="50"
                      value={simStart}
                      onChange={(e) => setSimStart(Math.min(50, parseInt(e.target.value) || 0))}
                      className="w-16"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    = {simStart * simulatorResult.startPoints} pts
                  </p>
                </div>

                <div className="space-y-3">
                  <Label className="flex items-center justify-between">
                    <span>Indicações PRO</span>
                    <Badge variant="outline">{simulatorResult.proPoints} pts cada</Badge>
                  </Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[simPro]}
                      onValueChange={([value]) => setSimPro(value)}
                      max={50}
                      step={1}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min="0"
                      max="50"
                      value={simPro}
                      onChange={(e) => setSimPro(Math.min(50, parseInt(e.target.value) || 0))}
                      className="w-16"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    = {simPro * simulatorResult.proPoints} pts
                  </p>
                </div>

                <div className="space-y-3">
                  <Label className="flex items-center justify-between">
                    <span>Indicações ELITE</span>
                    <Badge variant="outline">{simulatorResult.elitePoints} pts cada</Badge>
                  </Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[simElite]}
                      onValueChange={([value]) => setSimElite(value)}
                      max={50}
                      step={1}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min="0"
                      max="50"
                      value={simElite}
                      onChange={(e) => setSimElite(Math.min(50, parseInt(e.target.value) || 0))}
                      className="w-16"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    = {simElite * simulatorResult.elitePoints} pts
                  </p>
                </div>
              </div>

              <div className="border-t pt-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Total de Pontos</p>
                    <p className="text-4xl font-bold">{simulatorResult.totalPoints} pts</p>
                  </div>

                  {simulatorResult.currentLevel && (
                    <div className="flex items-center gap-3 bg-muted/50 px-6 py-4 rounded-lg">
                      <span className="text-4xl">{simulatorResult.currentLevel.icon}</span>
                      <div>
                        <p className="font-semibold text-lg">{simulatorResult.currentLevel.display_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Bônus extra: +{simulatorResult.currentLevel.bonus_percentage_increase}%
                        </p>
                      </div>
                    </div>
                  )}

                  {simulatorResult.nextLevel && (
                    <div className="w-full max-w-md space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progresso para {simulatorResult.nextLevel.icon} {simulatorResult.nextLevel.display_name}</span>
                        <span>{simulatorResult.progressToNext.toFixed(0)}%</span>
                      </div>
                      <Progress value={simulatorResult.progressToNext} />
                      <p className="text-center text-sm text-muted-foreground">
                        Faltam <strong>{simulatorResult.pointsToNext} pts</strong> para o próximo nível
                      </p>
                    </div>
                  )}

                  {!simulatorResult.nextLevel && simulatorResult.currentLevel && (
                    <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                      🏆 Nível máximo atingido!
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PartnerGraduationManager;
