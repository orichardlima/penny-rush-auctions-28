import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface BinaryPosition {
  id: string;
  partner_contract_id: string;
  sponsor_contract_id: string | null;
  parent_contract_id: string | null;
  position: 'left' | 'right' | null;
  left_points: number;
  right_points: number;
  total_left_points: number;
  total_right_points: number;
  left_child_id: string | null;
  right_child_id: string | null;
  pending_position_for: string | null;
  pending_position_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BinaryTreeNode {
  contract_id: string;
  parent_contract_id: string | null;
  position: 'left' | 'right' | null;
  left_points: number;
  right_points: number;
  left_child_id: string | null;
  right_child_id: string | null;
  partner_name: string;
  plan_name: string;
  depth: number;
}

export interface BinaryBonus {
  id: string;
  cycle_closure_id: string;
  partner_contract_id: string;
  left_points_before: number;
  right_points_before: number;
  matched_points: number;
  bonus_percentage: number;
  point_value: number;
  bonus_value: number;
  left_points_remaining: number;
  right_points_remaining: number;
  status: 'PENDING' | 'AVAILABLE' | 'PAID' | 'CANCELLED';
  available_at: string | null;
  paid_at: string | null;
  created_at: string;
  cycle_number?: number;
}

export interface BinaryStats {
  leftPoints: number;
  rightPoints: number;
  totalLeftPoints: number;
  totalRightPoints: number;
  weakerLeg: 'left' | 'right' | 'balanced';
  potentialBonus: number;
  totalBonusReceived: number;
}

export const useBinaryNetwork = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [position, setPosition] = useState<BinaryPosition | null>(null);
  const [tree, setTree] = useState<BinaryTreeNode[]>([]);
  const [bonuses, setBonuses] = useState<BinaryBonus[]>([]);
  const [stats, setStats] = useState<BinaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [contractId, setContractId] = useState<string | null>(null);
  const [viewRootContractId, setViewRootContractId] = useState<string | null>(null);
  const [navigationStack, setNavigationStack] = useState<Array<{ contractId: string; name: string }>>([]);

  const fetchContractId = useCallback(async () => {
    if (!profile?.user_id) return null;

    const { data, error } = await supabase
      .from('partner_contracts')
      .select('id')
      .eq('user_id', profile.user_id)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (error) {
      console.error('Error fetching contract:', error);
      return null;
    }

    return data?.id || null;
  }, [profile?.user_id]);

  const fetchBinaryPosition = useCallback(async (contractId: string) => {
    const { data, error } = await supabase
      .from('partner_binary_positions')
      .select('*')
      .eq('partner_contract_id', contractId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching binary position:', error);
      return null;
    }

    return data as BinaryPosition | null;
  }, []);

  const fetchBinaryTree = useCallback(async (contractId: string, depth: number = 3) => {
    const { data, error } = await supabase
      .rpc('get_binary_tree', {
        p_contract_id: contractId,
        p_depth: depth
      });

    if (error) {
      console.error('Error fetching binary tree:', error);
      return [];
    }

    return (data as unknown as BinaryTreeNode[]) || [];
  }, []);

  const fetchBinaryBonuses = useCallback(async (contractId: string) => {
    const { data: bonusesData, error: bonusesError } = await supabase
      .from('binary_bonuses')
      .select(`
        *,
        binary_cycle_closures (
          cycle_number
        )
      `)
      .eq('partner_contract_id', contractId)
      .order('created_at', { ascending: false });

    if (bonusesError) {
      console.error('Error fetching binary bonuses:', bonusesError);
      return [];
    }

    return (bonusesData || []).map((b: any) => ({
      ...b,
      cycle_number: b.binary_cycle_closures?.cycle_number
    })) as BinaryBonus[];
  }, []);

  const calculateStats = useCallback(async (position: BinaryPosition, bonuses: BinaryBonus[]) => {
    // Get bonus percentage and point value from settings
    const { data: settingsData } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['binary_bonus_percentage', 'binary_point_value']);

    const settings = (settingsData || []).reduce((acc, s) => {
      acc[s.setting_key] = parseFloat(s.setting_value) || 0;
      return acc;
    }, {} as Record<string, number>);

    const bonusPercentage = settings['binary_bonus_percentage'] || 10;
    const pointValue = settings['binary_point_value'] || 1;

    const matchedPoints = Math.min(position.left_points, position.right_points);
    const potentialBonus = matchedPoints * pointValue * (bonusPercentage / 100);

    const totalBonusReceived = bonuses
      .filter(b => b.status === 'AVAILABLE' || b.status === 'PAID')
      .reduce((sum, b) => sum + b.bonus_value, 0);

    let weakerLeg: 'left' | 'right' | 'balanced' = 'balanced';
    if (position.left_points < position.right_points) {
      weakerLeg = 'left';
    } else if (position.right_points < position.left_points) {
      weakerLeg = 'right';
    }

    return {
      leftPoints: position.left_points,
      rightPoints: position.right_points,
      totalLeftPoints: position.total_left_points,
      totalRightPoints: position.total_right_points,
      weakerLeg,
      potentialBonus,
      totalBonusReceived
    };
  }, []);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const id = await fetchContractId();
      if (!id) {
        setLoading(false);
        return;
      }

      setContractId(id);
      if (!viewRootContractId) {
        setViewRootContractId(id);
      }

      const currentRoot = viewRootContractId || id;

      const [positionData, treeData, bonusesData] = await Promise.all([
        fetchBinaryPosition(id),
        fetchBinaryTree(currentRoot),
        fetchBinaryBonuses(id)
      ]);

      setPosition(positionData);
      setTree(treeData);
      setBonuses(bonusesData);

      if (positionData) {
        const statsData = await calculateStats(positionData, bonusesData);
        setStats(statsData);
      }
    } catch (error) {
      console.error('Error fetching binary network data:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os dados do binário.'
      });
    } finally {
      setLoading(false);
    }
  }, [fetchContractId, fetchBinaryPosition, fetchBinaryTree, fetchBinaryBonuses, calculateStats, toast]);

  useEffect(() => {
    if (profile?.user_id) {
      fetchAllData();
    }
  }, [profile?.user_id, fetchAllData]);

  const positionPartner = async (newContractId: string, positionSide: 'left' | 'right') => {
    if (!contractId) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Você não possui um contrato ativo.'
      });
      return { success: false };
    }

    try {
      const { data, error } = await supabase
        .rpc('position_partner_binary', {
          p_contract_id: newContractId,
          p_sponsor_contract_id: contractId,
          p_position: positionSide
        });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; parent_contract_id?: string; position?: string; points_propagated?: number };

      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Erro ao posicionar',
          description: result.error || 'Não foi possível posicionar o parceiro.'
        });
        return { success: false };
      }

      toast({
        title: 'Parceiro posicionado!',
        description: `Posicionado na perna ${positionSide === 'left' ? 'esquerda' : 'direita'} com ${result.points_propagated} pontos propagados.`
      });

      // Refresh data
      await fetchAllData();

      return { success: true, ...result };
    } catch (error) {
      console.error('Error positioning partner:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível posicionar o parceiro.'
      });
      return { success: false };
    }
  };

  const getPendingPositioning = useCallback(async () => {
    if (!contractId) return [];

    const { data, error } = await supabase
      .from('partner_binary_positions')
      .select(`
        pending_position_for,
        pending_position_expires_at,
        partner_contracts!pending_position_for (
          id,
          plan_name,
          user_id
        )
      `)
      .eq('partner_contract_id', contractId)
      .not('pending_position_for', 'is', null);

    if (error) {
      console.error('Error fetching pending positioning:', error);
      return [];
    }

    return data || [];
  }, [contractId]);

  const navigateToNode = useCallback(async (targetContractId: string, nodeName: string, depth: number = 5) => {
    setLoading(true);
    try {
      setNavigationStack(prev => [...prev, { contractId: targetContractId, name: nodeName }]);
      setViewRootContractId(targetContractId);
      const treeData = await fetchBinaryTree(targetContractId, depth);
      setTree(treeData);
    } catch (error) {
      console.error('Error navigating to node:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchBinaryTree]);

  const navigateBack = useCallback(async (depth: number = 5) => {
    if (navigationStack.length <= 1) return resetToRoot(depth);
    setLoading(true);
    try {
      const newStack = [...navigationStack];
      newStack.pop();
      const target = newStack[newStack.length - 1];
      setNavigationStack(newStack);
      setViewRootContractId(target.contractId);
      const treeData = await fetchBinaryTree(target.contractId, depth);
      setTree(treeData);
    } catch (error) {
      console.error('Error navigating back:', error);
    } finally {
      setLoading(false);
    }
  }, [navigationStack, fetchBinaryTree]);

  const resetToRoot = useCallback(async (depth: number = 5) => {
    if (!contractId) return;
    setLoading(true);
    try {
      setNavigationStack([]);
      setViewRootContractId(contractId);
      const treeData = await fetchBinaryTree(contractId, depth);
      setTree(treeData);
    } catch (error) {
      console.error('Error resetting to root:', error);
    } finally {
      setLoading(false);
    }
  }, [contractId, fetchBinaryTree]);

  const refreshTree = useCallback(async (depth: number = 5) => {
    const currentRoot = viewRootContractId || contractId;
    if (!currentRoot) return;
    setLoading(true);
    try {
      const treeData = await fetchBinaryTree(currentRoot, depth);
      setTree(treeData);
    } catch (error) {
      console.error('Error refreshing tree:', error);
    } finally {
      setLoading(false);
    }
  }, [viewRootContractId, contractId, fetchBinaryTree]);

  return {
    position,
    tree,
    bonuses,
    stats,
    loading,
    contractId,
    viewRootContractId,
    navigationStack,
    refresh: fetchAllData,
    refreshTree,
    positionPartner,
    getPendingPositioning,
    navigateToNode,
    navigateBack,
    resetToRoot
  };
};
