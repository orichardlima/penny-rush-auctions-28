import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ReferralNode {
  id: string;
  userId: string;
  userName: string;
  planName: string;
  referralLevel: number;
  bonusValue: number;
  bonusStatus: string;
  createdAt: string;
  children: ReferralNode[];
}

export interface NetworkStats {
  totalNodes: number;
  totalBonusValue: number;
  nodesByLevel: {
    level1: number;
    level2: number;
    level3: number;
  };
}

export const useReferralNetwork = () => {
  const { profile } = useAuth();
  const [networkTree, setNetworkTree] = useState<ReferralNode[]>([]);
  const [stats, setStats] = useState<NetworkStats>({
    totalNodes: 0,
    totalBonusValue: 0,
    nodesByLevel: { level1: 0, level2: 0, level3: 0 }
  });
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<number | null>(null);

  const fetchNetworkData = useCallback(async () => {
    if (!profile?.user_id) return;

    try {
      setLoading(true);

      // Get user's active contract
      const { data: contractData, error: contractError } = await supabase
        .from('partner_contracts')
        .select('id')
        .eq('user_id', profile.user_id)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      if (contractError) throw contractError;
      if (!contractData) {
        setNetworkTree([]);
        setLoading(false);
        return;
      }

      // Fetch ALL referral bonuses where current user is the referrer
      const { data: allBonuses, error: bonusesError } = await supabase
        .from('partner_referral_bonuses')
        .select('*')
        .eq('referrer_contract_id', contractData.id)
        .order('created_at', { ascending: true });

      if (bonusesError) throw bonusesError;
      if (!allBonuses || allBonuses.length === 0) {
        setNetworkTree([]);
        setLoading(false);
        return;
      }

      // Get all referred user IDs and contract IDs
      const referredUserIds = [...new Set(allBonuses.map(b => b.referred_user_id))];
      const referredContractIds = [...new Set(allBonuses.map(b => b.referred_contract_id))];

      // Fetch profiles and contracts
      const [profilesResult, contractsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', referredUserIds),
        supabase
          .from('partner_contracts')
          .select('id, plan_name, user_id')
          .in('id', referredContractIds)
      ]);

      const profilesMap = new Map(
        profilesResult.data?.map(p => [p.user_id, p.full_name]) || []
      );
      const contractsMap = new Map(
        contractsResult.data?.map(c => [c.id, { planName: c.plan_name, userId: c.user_id }]) || []
      );

      // Group bonuses by level
      const level1Bonuses = allBonuses.filter(b => b.referral_level === 1);
      const level2Bonuses = allBonuses.filter(b => b.referral_level === 2);
      const level3Bonuses = allBonuses.filter(b => b.referral_level === 3);

      // For level 2 and 3, we need to find their parent in level 1 or 2
      // To do this, we need to find the referral chain

      // Build the tree starting from level 1
      const buildTree = (): ReferralNode[] => {
        // Level 1 nodes - direct referrals
        const level1Nodes: ReferralNode[] = level1Bonuses.map(bonus => {
          const contractInfo = contractsMap.get(bonus.referred_contract_id);
          return {
            id: bonus.id,
            userId: bonus.referred_user_id,
            userName: profilesMap.get(bonus.referred_user_id) || 'Usuário',
            planName: contractInfo?.planName || '-',
            referralLevel: 1,
            bonusValue: bonus.bonus_value,
            bonusStatus: bonus.status,
            createdAt: bonus.created_at,
            children: []
          };
        });

        // For level 2 nodes, find bonuses where the referred person is a direct referral's contract
        // We need to check who referred whom
        // Level 2: someone was referred by one of our direct referrals
        
        // To determine parent-child relationship:
        // A level 2 bonus was generated because one of our L1 referrals brought someone new
        // We need to find which L1 referral brought which L2
        
        // For simplicity, fetch referral relationships from partner_contracts
        const buildChildrenForNode = async (parentContractId: string, parentNode: ReferralNode, currentLevel: number) => {
          if (currentLevel >= 3) return;
          
          // Find bonuses at next level where the referred contract's referrer is the parent
          const childBonuses = currentLevel === 1 ? level2Bonuses : level3Bonuses;
          
          // We need to find which contracts were referred by parentContractId
          // This requires checking partner_contracts.referrer_contract_id
        };

        // For now, let's use a simpler approach:
        // Group level 2 and 3 bonuses and attach them to the tree
        // Since we're showing the partner's view, we attach based on time proximity
        
        // Actually, to properly link, we need the referral chain from partner_contracts
        // Let's fetch that data
        
        return level1Nodes;
      };

      // Simplified approach: Fetch all contracts to build proper hierarchy
      // The referral chain is tracked by referred_by_user_id in partner_contracts
      const { data: allContracts } = await supabase
        .from('partner_contracts')
        .select('id, user_id, referred_by_user_id')
        .in('id', referredContractIds);

      // Create a map from contract_id -> referred_by_user_id
      const contractReferredByMap = new Map(
        allContracts?.map(c => [c.id, c.referred_by_user_id]) || []
      );

      // Create a map from user_id -> their contract_id (for linking levels)
      const userToContractMap = new Map(
        allContracts?.map(c => [c.user_id, c.id]) || []
      );

      // Build tree with proper parent-child relationships
      const buildCompleteTree = (): ReferralNode[] => {
        // Helper to create a node
        const createNode = (bonus: typeof allBonuses[0]): ReferralNode => {
          const contractInfo = contractsMap.get(bonus.referred_contract_id);
          return {
            id: bonus.id,
            userId: bonus.referred_user_id,
            userName: profilesMap.get(bonus.referred_user_id) || 'Usuário',
            planName: contractInfo?.planName || '-',
            referralLevel: bonus.referral_level,
            bonusValue: bonus.bonus_value,
            bonusStatus: bonus.status,
            createdAt: bonus.created_at,
            children: []
          };
        };

        // Create all nodes
        const nodesMap = new Map<string, ReferralNode>();
        allBonuses.forEach(bonus => {
          nodesMap.set(bonus.referred_contract_id, createNode(bonus));
        });

        // Build hierarchy - for each level 2 node, find its L1 parent
        // A level 2 bonus means the referred person was referred by one of our L1 referrals
        const rootNodes: ReferralNode[] = [];

        level1Bonuses.forEach(bonus => {
          const node = nodesMap.get(bonus.referred_contract_id);
          if (node) {
            // Find level 2 children - these are people referred by this L1 person
            const l1UserContract = bonus.referred_contract_id;
            const l1UserId = bonus.referred_user_id;
            
            level2Bonuses.forEach(l2Bonus => {
              // Check if the L2 person was referred by the L1 user
              const l2ReferredBy = contractReferredByMap.get(l2Bonus.referred_contract_id);
              if (l2ReferredBy === l1UserId) {
                const l2Node = nodesMap.get(l2Bonus.referred_contract_id);
                if (l2Node) {
                  const l2UserId = l2Bonus.referred_user_id;
                  
                  // Find level 3 children for this L2 node
                  level3Bonuses.forEach(l3Bonus => {
                    const l3ReferredBy = contractReferredByMap.get(l3Bonus.referred_contract_id);
                    if (l3ReferredBy === l2UserId) {
                      const l3Node = nodesMap.get(l3Bonus.referred_contract_id);
                      if (l3Node) {
                        l2Node.children.push(l3Node);
                      }
                    }
                  });
                  node.children.push(l2Node);
                }
              }
            });
            rootNodes.push(node);
          }
        });

        return rootNodes;
      };

      const tree = buildCompleteTree();
      setNetworkTree(tree);

      // Calculate stats
      const totalNodes = allBonuses.length;
      const totalBonusValue = allBonuses.reduce((sum, b) => sum + b.bonus_value, 0);
      const nodesByLevel = {
        level1: level1Bonuses.length,
        level2: level2Bonuses.length,
        level3: level3Bonuses.length
      };

      setStats({ totalNodes, totalBonusValue, nodesByLevel });

    } catch (error) {
      console.error('Error fetching referral network:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.user_id]);

  useEffect(() => {
    if (profile?.user_id) {
      fetchNetworkData();
    }
  }, [profile?.user_id, fetchNetworkData]);

  // Filter tree recursively
  const filterTree = useCallback((
    nodes: ReferralNode[],
    query: string,
    status: string | null,
    level: number | null
  ): ReferralNode[] => {
    return nodes.reduce<ReferralNode[]>((acc, node) => {
      // Filter children recursively
      const filteredChildren = filterTree(node.children, query, status, level);
      
      // Check if current node matches filters
      const matchesSearch = query === '' || 
        node.userName.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = status === null || node.bonusStatus === status;
      const matchesLevel = level === null || node.referralLevel === level;
      
      // Include node if it matches all filters OR if it has matching children
      if ((matchesSearch && matchesStatus && matchesLevel) || filteredChildren.length > 0) {
        acc.push({
          ...node,
          children: filteredChildren
        });
      }
      
      return acc;
    }, []);
  }, []);

  // Memoized filtered tree
  const filteredTree = useMemo(() => {
    return filterTree(networkTree, searchQuery, statusFilter, levelFilter);
  }, [networkTree, searchQuery, statusFilter, levelFilter, filterTree]);

  // Count filtered nodes
  const countNodes = useCallback((nodes: ReferralNode[]): number => {
    return nodes.reduce((count, node) => {
      return count + 1 + countNodes(node.children);
    }, 0);
  }, []);

  const filteredCount = useMemo(() => countNodes(filteredTree), [filteredTree, countNodes]);

  // Check if any filter is active
  const hasActiveFilters = searchQuery !== '' || statusFilter !== null || levelFilter !== null;

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter(null);
    setLevelFilter(null);
  }, []);

  // Get all node IDs for expand/collapse all functionality
  const getAllNodeIds = useCallback((nodes: ReferralNode[]): string[] => {
    return nodes.reduce<string[]>((ids, node) => {
      ids.push(node.id);
      if (node.children.length > 0) {
        ids.push(...getAllNodeIds(node.children));
      }
      return ids;
    }, []);
  }, []);

  return {
    networkTree,
    filteredTree,
    stats,
    loading,
    refreshNetwork: fetchNetworkData,
    // Filter controls
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    levelFilter,
    setLevelFilter,
    hasActiveFilters,
    clearFilters,
    filteredCount,
    getAllNodeIds
  };
};
