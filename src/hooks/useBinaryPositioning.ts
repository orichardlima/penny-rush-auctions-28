import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PendingPosition {
  contract_id: string;
  user_name: string;
  plan_name: string;
  plan_points: number;
  expires_at: string | null;
  user_id: string;
}

export interface PositionPreview {
  left: {
    available: boolean;
    spillover: boolean;
    finalParentName?: string;
    currentPoints: number;
    pointsAfter: number;
  };
  right: {
    available: boolean;
    spillover: boolean;
    finalParentName?: string;
    currentPoints: number;
    pointsAfter: number;
  };
  newPartnerPoints: number;
}

export const useBinaryPositioning = (sponsorContractId: string | null) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pendingPositions, setPendingPositions] = useState<PendingPosition[]>([]);
  const [positionPreview, setPositionPreview] = useState<PositionPreview | null>(null);

  const fetchPendingPositions = useCallback(async () => {
    if (!sponsorContractId) return;

    setLoading(true);
    try {
      // Find contracts that were referred by this sponsor but not yet positioned
      const { data: referredContracts, error: refError } = await supabase
        .from('partner_contracts')
        .select('id, plan_name, user_id, created_at')
        .eq('referred_by_user_id', (await supabase.from('partner_contracts').select('user_id').eq('id', sponsorContractId).single()).data?.user_id)
        .eq('status', 'ACTIVE');

      if (refError) throw refError;

      if (!referredContracts || referredContracts.length === 0) {
        setPendingPositions([]);
        return;
      }

      // Check which ones are not positioned yet
      const { data: positionedContracts, error: posError } = await supabase
        .from('partner_binary_positions')
        .select('partner_contract_id')
        .in('partner_contract_id', referredContracts.map(c => c.id));

      if (posError) throw posError;

      const positionedIds = new Set((positionedContracts || []).map(p => p.partner_contract_id));
      const notPositioned = referredContracts.filter(c => !positionedIds.has(c.id));

      if (notPositioned.length === 0) {
        setPendingPositions([]);
        return;
      }

      // Get user names
      const userIds = notPositioned.map(c => c.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      const profilesMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

      // Get plan points
      const planNames = [...new Set(notPositioned.map(c => c.plan_name))];
      const { data: planPoints } = await supabase
        .from('partner_level_points')
        .select('plan_name, points')
        .in('plan_name', planNames);

      const pointsMap = new Map((planPoints || []).map(p => [p.plan_name.toUpperCase(), p.points]));

      const pending: PendingPosition[] = notPositioned.map(c => ({
        contract_id: c.id,
        user_name: profilesMap.get(c.user_id) || 'Desconhecido',
        plan_name: c.plan_name,
        plan_points: pointsMap.get(c.plan_name.toUpperCase()) || 0,
        expires_at: null, // Could add timeout logic here
        user_id: c.user_id
      }));

      setPendingPositions(pending);
    } catch (error) {
      console.error('Error fetching pending positions:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar parceiros pendentes.'
      });
    } finally {
      setLoading(false);
    }
  }, [sponsorContractId, toast]);

  const getPositionPreview = useCallback(async (newContractId: string): Promise<PositionPreview | null> => {
    if (!sponsorContractId) return null;

    try {
      // Get sponsor's current position
      const { data: sponsorPos, error: sponsorError } = await supabase
        .from('partner_binary_positions')
        .select('*')
        .eq('partner_contract_id', sponsorContractId)
        .maybeSingle();

      if (sponsorError) throw sponsorError;

      // Get new partner's plan points
      const { data: newContract } = await supabase
        .from('partner_contracts')
        .select('plan_name')
        .eq('id', newContractId)
        .single();

      const { data: planPoints } = await supabase
        .from('partner_level_points')
        .select('points')
        .ilike('plan_name', newContract?.plan_name || '')
        .maybeSingle();

      const newPartnerPoints = planPoints?.points || 0;

      // Determine availability and spillover
      const preview: PositionPreview = {
        left: {
          available: !sponsorPos?.left_child_id,
          spillover: !!sponsorPos?.left_child_id,
          currentPoints: sponsorPos?.left_points || 0,
          pointsAfter: (sponsorPos?.left_points || 0) + newPartnerPoints
        },
        right: {
          available: !sponsorPos?.right_child_id,
          spillover: !!sponsorPos?.right_child_id,
          currentPoints: sponsorPos?.right_points || 0,
          pointsAfter: (sponsorPos?.right_points || 0) + newPartnerPoints
        },
        newPartnerPoints
      };

      // If spillover, find where they would actually go
      if (preview.left.spillover && sponsorPos?.left_child_id) {
        const finalPos = await findFinalPosition(sponsorPos.left_child_id);
        preview.left.finalParentName = finalPos?.parentName;
      }

      if (preview.right.spillover && sponsorPos?.right_child_id) {
        const finalPos = await findFinalPosition(sponsorPos.right_child_id);
        preview.right.finalParentName = finalPos?.parentName;
      }

      setPositionPreview(preview);
      return preview;
    } catch (error) {
      console.error('Error getting position preview:', error);
      return null;
    }
  }, [sponsorContractId]);

  const findFinalPosition = async (startingContractId: string): Promise<{ parentId: string; position: string; parentName: string } | null> => {
    let currentId = startingContractId;

    while (true) {
      const { data: pos } = await supabase
        .from('partner_binary_positions')
        .select('partner_contract_id, left_child_id, right_child_id')
        .eq('partner_contract_id', currentId)
        .maybeSingle();

      if (!pos) return null;

      // Check left first
      if (!pos.left_child_id) {
        const { data: contract } = await supabase
          .from('partner_contracts')
          .select('user_id')
          .eq('id', pos.partner_contract_id)
          .single();

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', contract?.user_id || '')
          .single();

        return {
          parentId: pos.partner_contract_id,
          position: 'left',
          parentName: profile?.full_name || 'Desconhecido'
        };
      }

      // Check right
      if (!pos.right_child_id) {
        const { data: contract } = await supabase
          .from('partner_contracts')
          .select('user_id')
          .eq('id', pos.partner_contract_id)
          .single();

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', contract?.user_id || '')
          .single();

        return {
          parentId: pos.partner_contract_id,
          position: 'right',
          parentName: profile?.full_name || 'Desconhecido'
        };
      }

      // Both occupied, go left
      currentId = pos.left_child_id;
    }
  };

  const positionPartner = async (newContractId: string, position: 'left' | 'right') => {
    if (!sponsorContractId) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Sponsor não identificado.'
      });
      return { success: false };
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('position_partner_binary', {
          p_contract_id: newContractId,
          p_sponsor_contract_id: sponsorContractId,
          p_position: position
        });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };

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
        description: `Posicionado com sucesso na perna ${position === 'left' ? 'esquerda' : 'direita'}.`
      });

      // Remove from pending
      setPendingPositions(prev => prev.filter(p => p.contract_id !== newContractId));

      return { success: true };
    } catch (error) {
      console.error('Error positioning partner:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível posicionar o parceiro.'
      });
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    pendingPositions,
    positionPreview,
    fetchPendingPositions,
    getPositionPreview,
    positionPartner
  };
};
