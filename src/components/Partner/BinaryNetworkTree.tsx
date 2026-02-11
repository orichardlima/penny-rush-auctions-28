import React, { useState, useMemo } from 'react';
import { useBinaryNetwork, BinaryTreeNode } from '@/hooks/useBinaryNetwork';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { 
  GitBranch, 
  User, 
  ChevronDown, 
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  Trophy,
  RefreshCw,
  Search,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TreeNodeProps {
  node: BinaryTreeNode | null;
  position?: 'left' | 'right' | 'root';
  allNodes: BinaryTreeNode[];
  depth: number;
  maxDepth: number;
  searchQuery: string;
  matchingNodeIds: Set<string>;
}

const hasMatchingDescendant = (nodeId: string, allNodes: BinaryTreeNode[], matchingIds: Set<string>): boolean => {
  const node = allNodes.find(n => n.contract_id === nodeId);
  if (!node) return false;
  if (matchingIds.has(node.contract_id)) return true;
  const left = node.left_child_id ? hasMatchingDescendant(node.left_child_id, allNodes, matchingIds) : false;
  const right = node.right_child_id ? hasMatchingDescendant(node.right_child_id, allNodes, matchingIds) : false;
  return left || right;
};

const TreeNode: React.FC<TreeNodeProps> = ({ node, position = 'root', allNodes, depth, maxDepth, searchQuery, matchingNodeIds }) => {
  const shouldAutoExpand = node && searchQuery && hasMatchingDescendant(node.contract_id, allNodes, matchingNodeIds);
  const [expanded, setExpanded] = useState(depth < 2);
  const isExpanded = expanded || !!shouldAutoExpand;
  const isMatch = node ? matchingNodeIds.has(node.contract_id) : false;

  if (!node) {
    return (
      <div className="flex flex-col items-center">
        <div className="w-24 h-16 border-2 border-dashed border-muted rounded-lg flex items-center justify-center bg-muted/20">
          <span className="text-xs text-muted-foreground">Vazio</span>
        </div>
      </div>
    );
  }

  const leftChild = node.left_child_id 
    ? allNodes.find(n => n.contract_id === node.left_child_id) 
    : null;
  const rightChild = node.right_child_id 
    ? allNodes.find(n => n.contract_id === node.right_child_id) 
    : null;

  const hasChildren = leftChild || rightChild;
  const weakerLeg = node.left_points < node.right_points ? 'left' : node.right_points < node.left_points ? 'right' : 'balanced';

  const getPositionColor = () => {
    if (position === 'root') return 'border-primary bg-primary/10';
    if (position === 'left') return 'border-blue-500 bg-blue-500/10';
    return 'border-amber-500 bg-amber-500/10';
  };

  return (
    <div className="flex flex-col items-center">
      {/* Node */}
      <div 
        className={cn(
          "relative w-32 rounded-lg border-2 p-2 transition-all cursor-pointer hover:shadow-md",
          getPositionColor(),
          isMatch && "ring-2 ring-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.4)]"
        )}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {/* Position indicator */}
        {position !== 'root' && (
          <div className={cn(
            "absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[10px] font-medium",
            position === 'left' ? 'bg-blue-500 text-white' : 'bg-amber-500 text-white'
          )}>
            {position === 'left' ? 'E' : 'D'}
          </div>
        )}

        {/* Partner info */}
        <div className="flex items-center gap-1 mb-1">
          <User className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs font-medium truncate flex-1">{node.partner_name?.split(' ').slice(0, 2).join(' ') || 'N/A'}</span>
          {hasChildren && (
            expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
          )}
        </div>

        {/* Plan */}
        <Badge variant="outline" className="text-[9px] h-4 mb-1 w-full justify-center">
          {node.plan_name}
        </Badge>

        {/* Points */}
        <div className="flex justify-between text-[10px] gap-1">
          <div className={cn(
            "flex items-center gap-0.5 px-1 rounded",
            weakerLeg === 'left' ? 'bg-destructive/20 text-destructive' : 'bg-muted'
          )}>
            <ArrowLeft className="w-2.5 h-2.5" />
            <span>{node.left_points}</span>
          </div>
          <div className={cn(
            "flex items-center gap-0.5 px-1 rounded",
            weakerLeg === 'right' ? 'bg-destructive/20 text-destructive' : 'bg-muted'
          )}>
            <span>{node.right_points}</span>
            <ArrowRight className="w-2.5 h-2.5" />
          </div>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && depth < maxDepth && (
        <div className="flex flex-col items-center mt-2">
          {/* Connector lines */}
          <div className="w-px h-4 bg-border" />
          <div className="flex items-start">
            <div className="w-16 h-px bg-border" />
            <div className="w-px h-4 bg-border" />
            <div className="w-16 h-px bg-border" />
          </div>
          
          {/* Child nodes */}
          <div className="flex gap-4 mt-2">
            <TreeNode 
              node={leftChild} 
              position="left" 
              allNodes={allNodes} 
              depth={depth + 1}
              maxDepth={maxDepth}
              searchQuery={searchQuery}
              matchingNodeIds={matchingNodeIds}
            />
            <TreeNode 
              node={rightChild} 
              position="right" 
              allNodes={allNodes} 
              depth={depth + 1}
              maxDepth={maxDepth}
              searchQuery={searchQuery}
              matchingNodeIds={matchingNodeIds}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export const BinaryNetworkTree: React.FC = () => {
  const { position, tree, stats, loading, refresh } = useBinaryNetwork();
  const [maxDepth, setMaxDepth] = useState(3);
  const [searchQuery, setSearchQuery] = useState('');

  const rootNode = useMemo(() => {
    return tree.find(n => n.depth === 0) || null;
  }, [tree]);

  const matchingNodeIds = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const query = searchQuery.toLowerCase().trim();
    return new Set(
      tree.filter(n => n.partner_name?.toLowerCase().includes(query)).map(n => n.contract_id)
    );
  }, [tree, searchQuery]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <Skeleton className="h-32 w-32 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!position) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            Rede Binária
          </CardTitle>
          <CardDescription>
            Você ainda não está posicionado na rede binária.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <GitBranch className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Sua posição será criada automaticamente quando você indicar alguém.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              Rede Binária
            </CardTitle>
            <CardDescription>
              Visualize sua árvore de indicações e pontos acumulados
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-500/10 rounded-lg p-3 text-center">
              <ArrowLeft className="w-5 h-5 mx-auto mb-1 text-blue-500" />
              <p className="text-2xl font-bold text-blue-600">{stats.leftPoints}</p>
              <p className="text-xs text-muted-foreground">Perna Esquerda</p>
            </div>
            <div className="bg-amber-500/10 rounded-lg p-3 text-center">
              <ArrowRight className="w-5 h-5 mx-auto mb-1 text-amber-500" />
              <p className="text-2xl font-bold text-amber-600">{stats.rightPoints}</p>
              <p className="text-xs text-muted-foreground">Perna Direita</p>
            </div>
            <div className="bg-primary/10 rounded-lg p-3 text-center">
              <TrendingUp className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold text-primary">
                {stats.potentialBonus.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <p className="text-xs text-muted-foreground">Bônus Potencial</p>
            </div>
            <div className="bg-green-500/10 rounded-lg p-3 text-center">
              <Trophy className="w-5 h-5 mx-auto mb-1 text-green-500" />
              <p className="text-2xl font-bold text-green-600">
                {stats.totalBonusReceived.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <p className="text-xs text-muted-foreground">Total Recebido</p>
            </div>
          </div>
        )}

        {/* Weaker Leg Indicator */}
        {stats && stats.weakerLeg !== 'balanced' && (
          <div className={cn(
            "rounded-lg p-3 mb-6 text-center border",
            stats.weakerLeg === 'left'
              ? "bg-blue-500/10 border-blue-500/20"
              : "bg-amber-500/10 border-amber-500/20"
          )}>
            <p className={cn("text-sm", stats.weakerLeg === 'left' ? "text-blue-700" : "text-amber-700")}>
              <strong>Perna Menor:</strong> {stats.weakerLeg === 'left' ? 'Esquerda' : 'Direita'} — 
              Novos indicados são posicionados automaticamente neste lado.
            </p>
          </div>
        )}

        {/* Depth Selector */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="text-sm text-muted-foreground">Profundidade:</span>
          {[2, 3, 4, 5].map(d => (
            <Button
              key={d}
              variant={maxDepth === d ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMaxDepth(d)}
            >
              {d}
            </Button>
          ))}
        </div>

        {/* Search Field */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar downline por nome..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {searchQuery && (
            <p className="text-xs text-muted-foreground mt-1">
              {matchingNodeIds.size} resultado(s) encontrado(s)
            </p>
          )}
        </div>

        {/* Tree Visualization */}
        <div className="overflow-x-auto pb-4">
          <div className="min-w-[400px] flex justify-center">
            <TreeNode 
              node={rootNode} 
              position="root"
              allNodes={tree}
              depth={0}
              maxDepth={maxDepth}
              searchQuery={searchQuery}
              matchingNodeIds={matchingNodeIds}
            />
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-6 pt-4 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-primary/30 border border-primary" />
            <span>Você</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-500/30 border border-blue-500" />
            <span>Esquerda</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-500/30 border border-amber-500" />
            <span>Direita</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded border-2 border-dashed border-muted" />
            <span>Vazio</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-destructive/30" />
            <span>Menor Perna</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BinaryNetworkTree;
