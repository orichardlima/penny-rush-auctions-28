export interface Auction {
  id: string;
  title: string;
  description: string;
  image_url: string;
  current_price: number;
  starting_price: number;
  market_value: number;
  revenue_target: number;
  total_bids: number;
  time_left: number;
  status: string;
  winner_name?: string;
  winner_id?: string;
  participants_count: number;
  finished_at?: string;
  ends_at?: string;
  company_revenue: number;
  created_at: string;
  starts_at: string;
  is_hidden?: boolean;
}

export interface User {
  user_id: string;
  full_name: string;
  email: string;
  is_admin: boolean;
  is_bot: boolean;
  is_blocked?: boolean;
  block_reason?: string;
  bids_balance: number;
  created_at: string;
}

export interface BidPackage {
  id: string;
  name: string;
  bids_count: number;
  price: number;
  original_price?: number;
  icon?: string;
  is_popular: boolean;
  features: string[];
  created_at: string;
}
