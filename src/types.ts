export type TradeResult = 'Win' | 'Loss' | 'Breakeven';
export type TradeType = 'Buy' | 'Sell';

export interface Trade {
  id: string;
  pair: string;
  type: TradeType;
  result: TradeResult;
  value: number; // Profit or loss in currency
  timestamp: number;
}

export interface AccountSettings {
  name: string;
  initialBalance: number;
}

export interface DashboardStats {
  currentBalance: number;
  totalGrowth: number;
  growthPercentage: number;
  winRate: number;
  wins: number;
  losses: number;
  breakeven: number;
  totalTrades: number;
}
