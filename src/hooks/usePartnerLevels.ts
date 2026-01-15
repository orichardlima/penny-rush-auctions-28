import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PartnerLevel {
  id: string;
  name: string;
  display_name: string;
  icon: string;
  min_points: number;
  color: string;
  bonus_percentage_increase: number;
  sort_order: number;
  is_active: boolean;
  reward_type: string | null;
  reward_description: string | null;
  reward_value: number | null;
  reward_icon: string;
}

export interface PartnerLevelPoints {
  id: string;
  plan_name: string;
  points: number;
}

export interface PartnerLevelProgress {
  currentLevel: PartnerLevel | null;
  nextLevel: PartnerLevel | null;
  currentPoints: number;
  pointsToNextLevel: number;
  progressPercentage: number;
}

export const usePartnerLevels = (totalPoints: number = 0) => {
  const [levels, setLevels] = useState<PartnerLevel[]>([]);
  const [levelPoints, setLevelPoints] = useState<PartnerLevelPoints[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLevels = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('partner_levels')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setLevels(data || []);
    } catch (error) {
      console.error('Error fetching partner levels:', error);
    }
  }, []);

  const fetchLevelPoints = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('partner_level_points')
        .select('*')
        .order('points', { ascending: true });

      if (error) throw error;
      setLevelPoints(data || []);
    } catch (error) {
      console.error('Error fetching level points:', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchLevels(), fetchLevelPoints()]);
      setLoading(false);
    };
    loadData();
  }, [fetchLevels, fetchLevelPoints]);

  const getCurrentLevel = useCallback((): PartnerLevel | null => {
    if (levels.length === 0) return null;
    
    // Find the highest level the user has reached
    let currentLevel = levels[0];
    for (const level of levels) {
      if (totalPoints >= level.min_points) {
        currentLevel = level;
      }
    }
    return currentLevel;
  }, [levels, totalPoints]);

  const getNextLevel = useCallback((): PartnerLevel | null => {
    if (levels.length === 0) return null;
    
    for (const level of levels) {
      if (totalPoints < level.min_points) {
        return level;
      }
    }
    return null; // Already at max level
  }, [levels, totalPoints]);

  const getProgress = useCallback((): PartnerLevelProgress => {
    const currentLevel = getCurrentLevel();
    const nextLevel = getNextLevel();

    if (!currentLevel) {
      return {
        currentLevel: null,
        nextLevel: null,
        currentPoints: totalPoints,
        pointsToNextLevel: 0,
        progressPercentage: 0
      };
    }

    if (!nextLevel) {
      // At max level
      return {
        currentLevel,
        nextLevel: null,
        currentPoints: totalPoints,
        pointsToNextLevel: 0,
        progressPercentage: 100
      };
    }

    const pointsInCurrentLevel = totalPoints - currentLevel.min_points;
    const pointsNeededForNextLevel = nextLevel.min_points - currentLevel.min_points;
    const progressPercentage = Math.min(
      (pointsInCurrentLevel / pointsNeededForNextLevel) * 100,
      100
    );

    return {
      currentLevel,
      nextLevel,
      currentPoints: totalPoints,
      pointsToNextLevel: nextLevel.min_points - totalPoints,
      progressPercentage
    };
  }, [getCurrentLevel, getNextLevel, totalPoints]);

  const getPointsForPlan = useCallback((planName: string): number => {
    const pointConfig = levelPoints.find(
      lp => lp.plan_name.toUpperCase() === planName.toUpperCase()
    );
    return pointConfig?.points || 0;
  }, [levelPoints]);

  const getLevelColor = useCallback((color: string): string => {
    const colorMap: Record<string, string> = {
      'gray-500': 'text-gray-500 bg-gray-500/10 border-gray-500/20',
      'orange-600': 'text-orange-600 bg-orange-500/10 border-orange-500/20',
      'slate-400': 'text-slate-400 bg-slate-400/10 border-slate-400/20',
      'yellow-500': 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
      'purple-500': 'text-purple-500 bg-purple-500/10 border-purple-500/20',
      'cyan-400': 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20'
    };
    return colorMap[color] || 'text-gray-500 bg-gray-500/10 border-gray-500/20';
  }, []);

  return {
    levels,
    levelPoints,
    loading,
    getCurrentLevel,
    getNextLevel,
    getProgress,
    getPointsForPlan,
    getLevelColor,
    refreshData: () => Promise.all([fetchLevels(), fetchLevelPoints()])
  };
};
