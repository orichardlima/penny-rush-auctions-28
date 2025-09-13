// Bid package calculation utilities

export interface BidCalculation {
  baseBids: number;
  bonusBids: number;
  totalBids: number;
  baseDescription: string;
  fullDescription: string;
}

/**
 * Calculate base and bonus bids for a package
 * Formula: Base = price (each bid = R$ 1.00), Bonus = total - base
 */
export function calculateBidBreakdown(price: number, totalBids: number): BidCalculation {
  const baseBids = Math.floor(price); // Each bid costs R$ 1.00
  const bonusBids = Math.max(0, totalBids - baseBids);
  
  const baseDescription = bonusBids > 0 
    ? `${baseBids} lances base + ${bonusBids} bônus`
    : `${baseBids} lances`;
    
  const fullDescription = `${totalBids} lances (${baseBids} base + ${bonusBids} bônus)`;
  
  return {
    baseBids,
    bonusBids,
    totalBids,
    baseDescription,
    fullDescription
  };
}

/**
 * Generate features array with correct bid calculation
 */
export function generatePackageFeatures(price: number, totalBids: number, additionalFeatures: string[] = []): string[] {
  const { baseDescription } = calculateBidBreakdown(price, totalBids);
  return [baseDescription, ...additionalFeatures];
}

/**
 * Filter out features that mention bids/lances to avoid duplicates
 * This prevents manual bid features from overriding automatic calculations
 */
export function filterBidFeatures(features: string[]): string[] {
  return features.filter(feature => {
    const lowerFeature = feature.toLowerCase();
    return !lowerFeature.includes('lance') && 
           !lowerFeature.includes('bônus') && 
           !lowerFeature.includes('bonus');
  });
}

/**
 * Generate complete features array with calculated bid info first
 */
export function generateCompleteFeatures(price: number, totalBids: number, additionalFeatures: string[] = []): string[] {
  const { baseDescription } = calculateBidBreakdown(price, totalBids);
  const filteredAdditional = filterBidFeatures(additionalFeatures);
  return [baseDescription, ...filteredAdditional];
}

/**
 * Validate that package configuration makes sense
 */
export function validatePackageConfig(price: number, totalBids: number): { isValid: boolean; error?: string } {
  const baseBids = Math.floor(price);
  
  if (totalBids < baseBids) {
    return {
      isValid: false,
      error: `Total de lances (${totalBids}) não pode ser menor que o valor base (${baseBids})`
    };
  }
  
  if (price <= 0) {
    return {
      isValid: false,
      error: 'Preço deve ser maior que zero'
    };
  }
  
  return { isValid: true };
}