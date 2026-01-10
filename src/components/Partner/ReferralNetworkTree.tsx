import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useReferralNetwork, ReferralNode } from '@/hooks/useReferralNetwork';
import { 
  Users, 
  ChevronDown, 
  ChevronRight,
  DollarSign,
  GitBranch,
  User
} from 'lucide-react';

const formatPrice = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  });
};

const getLevelColor = (level: number) => {
  switch (level) {
    case 1: return 'border-l-primary bg-primary/5';
    case 2: return 'border-l-blue-500 bg-blue-500/5';
    case 3: return 'border-l-purple-500 bg-purple-500/5';
    default: return 'border-l-muted bg-muted/5';
  }
};

const getLevelBadgeColor = (level: number) => {
  switch (level) {
    case 1: return 'bg-primary/10 text-primary border-primary/20';
    case 2: return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 3: return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    default: return 'bg-muted text-muted-foreground';
  }
};

const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case 'PENDING': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    case 'AVAILABLE': return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'PAID': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    default: return 'bg-muted text-muted-foreground';
  }
};

interface TreeNodeProps {
  node: ReferralNode;
  isLast?: boolean;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, isLast = false }) => {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const initials = node.userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="relative">
      {/* Connector line */}
      <div 
        className={`
          absolute left-5 top-0 w-0.5 
          ${isLast ? 'h-6' : 'h-full'} 
          ${node.referralLevel === 1 ? 'bg-primary/30' : node.referralLevel === 2 ? 'bg-blue-500/30' : 'bg-purple-500/30'}
        `}
      />
      
      <div className="relative flex items-start gap-3 pb-4">
        {/* Horizontal connector */}
        <div 
          className={`
            absolute left-5 top-5 w-4 h-0.5
            ${node.referralLevel === 1 ? 'bg-primary/30' : node.referralLevel === 2 ? 'bg-blue-500/30' : 'bg-purple-500/30'}
          `}
        />
        
        {/* Toggle button or spacer */}
        <div className="z-10 flex-shrink-0">
          {hasChildren ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <div className="h-10 w-10 flex items-center justify-center">
              <div className={`
                h-3 w-3 rounded-full
                ${node.referralLevel === 1 ? 'bg-primary' : node.referralLevel === 2 ? 'bg-blue-500' : 'bg-purple-500'}
              `} />
            </div>
          )}
        </div>

        {/* Node content */}
        <div className={`flex-1 p-3 rounded-lg border-l-4 ${getLevelColor(node.referralLevel)}`}>
          <div className="flex flex-wrap items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-sm truncate">{node.userName}</span>
                <Badge variant="outline" className="text-xs">
                  {node.planName}
                </Badge>
                <Badge className={`text-xs ${getLevelBadgeColor(node.referralLevel)}`}>
                  {node.referralLevel === 1 ? 'Direto' : `${node.referralLevel}º Nível`}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>{formatDate(node.createdAt)}</span>
                <Badge className={`text-xs ${getStatusBadgeColor(node.bonusStatus)}`}>
                  {node.bonusStatus === 'PENDING' ? 'Pendente' : node.bonusStatus === 'AVAILABLE' ? 'Disponível' : node.bonusStatus === 'PAID' ? 'Pago' : node.bonusStatus}
                </Badge>
              </div>
            </div>

            <div className="text-right">
              <span className="font-semibold text-green-600 text-sm">
                +{formatPrice(node.bonusValue)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isOpen && (
        <div className="ml-10">
          {node.children.map((child, index) => (
            <TreeNode 
              key={child.id} 
              node={child} 
              isLast={index === node.children.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ReferralNetworkTree: React.FC = () => {
  const { networkTree, stats, loading } = useReferralNetwork();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (networkTree.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Você ainda não possui indicações.</p>
        <p className="text-sm">Compartilhe seu link para começar sua rede!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Network Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-lg font-bold">{stats.totalNodes}</p>
          <p className="text-xs text-muted-foreground">Total na rede</p>
        </div>
        <div className="text-center p-3 bg-primary/5 rounded-lg border border-primary/20">
          <User className="h-4 w-4 mx-auto mb-1 text-primary" />
          <p className="text-lg font-bold text-primary">{stats.nodesByLevel.level1}</p>
          <p className="text-xs text-muted-foreground">Diretos</p>
        </div>
        <div className="text-center p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
          <User className="h-4 w-4 mx-auto mb-1 text-blue-600" />
          <p className="text-lg font-bold text-blue-600">{stats.nodesByLevel.level2}</p>
          <p className="text-xs text-muted-foreground">2º Nível</p>
        </div>
        <div className="text-center p-3 bg-purple-500/5 rounded-lg border border-purple-500/20">
          <User className="h-4 w-4 mx-auto mb-1 text-purple-600" />
          <p className="text-lg font-bold text-purple-600">{stats.nodesByLevel.level3}</p>
          <p className="text-xs text-muted-foreground">3º Nível</p>
        </div>
      </div>

      {/* Total Bonus */}
      <div className="flex items-center justify-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
        <DollarSign className="h-5 w-5 text-green-600" />
        <span className="text-sm text-muted-foreground">Total em bônus da rede:</span>
        <span className="font-bold text-green-600">{formatPrice(stats.totalBonusValue)}</span>
      </div>

      {/* Tree View */}
      <div className="border rounded-lg p-4 bg-card">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b">
          <GitBranch className="h-5 w-5 text-primary" />
          <span className="font-medium">Sua Rede de Indicações</span>
        </div>
        
        <div className="space-y-2">
          {networkTree.map((node, index) => (
            <TreeNode 
              key={node.id} 
              node={node} 
              isLast={index === networkTree.length - 1}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-primary" />
          <span>Direto (Nível 1)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-blue-500" />
          <span>2º Nível</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-purple-500" />
          <span>3º Nível</span>
        </div>
      </div>
    </div>
  );
};

export default ReferralNetworkTree;
