import React, { useState, useEffect, useMemo, Component } from 'react';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Settings, 
  Plus, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Minus,
  RefreshCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Moon,
  Sun,
  LogOut,
  Loader2
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency, formatPercentage } from './lib/utils';
import { Trade, AccountSettings, DashboardStats, TradeResult, TradeType } from './types';
import { AuthProvider, useAuth } from './AuthContext';
import { AuthScreen } from './Auth';
import { supabase } from './lib/supabase';

// --- Components ---

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm", className)}>
    {children}
  </div>
);

const StatCard = ({ title, value, subValue, icon: Icon, trend }: { 
  title: string; 
  value: string; 
  subValue?: string; 
  icon: any;
  trend?: 'up' | 'down' | 'neutral';
}) => (
  <Card className="flex flex-col gap-2">
    <div className="flex justify-between items-start">
      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</span>
      <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
        <Icon className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
      </div>
    </div>
    <div className="flex flex-col">
      <span className="text-2xl font-bold tracking-tight">{value}</span>
      {subValue && (
        <span className={cn(
          "text-xs font-medium mt-1 flex items-center gap-1",
          trend === 'up' ? "text-emerald-500" : trend === 'down' ? "text-rose-500" : "text-zinc-500"
        )}>
          {trend === 'up' && <ArrowUpRight className="w-3 h-3" />}
          {trend === 'down' && <ArrowDownRight className="w-3 h-3" />}
          {subValue}
        </span>
      )}
    </div>
  </Card>
);

// --- Main App ---

function TradeFlowApp() {
  const { user, loading: authLoading, accountSettings, setAccountSettings, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'operations' | 'settings'>('dashboard');
  
  // State
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(true);

  const [filter, setFilter] = useState<TradeResult | 'All'>('All');
  const [dateRange, setDateRange] = useState<'All' | 'Today' | 'Week' | 'Month'>('All');
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('tradeflow_dark');
    return saved === 'true';
  });

  // Supabase Sync
  useEffect(() => {
    if (!user) {
      setTrades([]);
      setTradesLoading(false);
      return;
    }

    const fetchTrades = async () => {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('userId', user.id)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error("Supabase Error: ", error);
      } else {
        setTrades(data as Trade[]);
      }
      setTradesLoading(false);
    };

    fetchTrades();

    const channel = supabase
      .channel(`trades-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trades',
          filter: `userId=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTrades(prev => {
              if (prev.some(t => t.id === payload.new.id)) return prev;
              return [payload.new as Trade, ...prev].sort((a,b) => b.timestamp - a.timestamp);
            });
          } else if (payload.eventType === 'DELETE') {
            setTrades(prev => prev.filter(t => t.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            setTrades(prev => prev.map(t => t.id === payload.new.id ? payload.new as Trade : t).sort((a,b) => b.timestamp - a.timestamp));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    localStorage.setItem('tradeflow_dark', darkMode.toString());
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Calculations
  const filteredByDate = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return trades.filter(t => {
      if (dateRange === 'All') return true;
      if (dateRange === 'Today') return t.timestamp >= startOfToday;
      if (dateRange === 'Week') return t.timestamp >= startOfWeek;
      if (dateRange === 'Month') return t.timestamp >= startOfMonth;
      return true;
    });
  }, [trades, dateRange]);

  const filteredTrades = useMemo(() => {
    if (filter === 'All') return filteredByDate;
    return filteredByDate.filter(t => t.result === filter);
  }, [filteredByDate, filter]);

  const stats = useMemo((): DashboardStats => {
    const initialBalance = accountSettings?.initialBalance || 1000;
    const wins = filteredByDate.filter(t => t.result === 'Win').length;
    const losses = filteredByDate.filter(t => t.result === 'Loss').length;
    const breakeven = filteredByDate.filter(t => t.result === 'Breakeven').length;
    const totalTrades = filteredByDate.length;
    
    const totalProfitLoss = filteredByDate.reduce((acc, t) => acc + t.value, 0);
    const currentBalance = initialBalance + totalProfitLoss;
    const totalGrowth = currentBalance - initialBalance;
    const growthPercentage = (totalGrowth / initialBalance) * 100;
    
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

    return {
      currentBalance,
      totalGrowth,
      growthPercentage,
      winRate,
      wins,
      losses,
      breakeven,
      totalTrades
    };
  }, [filteredByDate, accountSettings]);

  const chartData = useMemo(() => {
    const initialBalance = accountSettings?.initialBalance || 1000;
    let current = initialBalance;
    const data = [{ name: 'Início', balance: current }];
    
    const sortedTrades = [...filteredByDate].sort((a, b) => a.timestamp - b.timestamp);
    
    sortedTrades.forEach((trade, index) => {
      current += trade.value;
      data.push({
        name: `T${index + 1}`,
        balance: current
      });
    });
    
    return data;
  }, [filteredByDate, accountSettings]);

  // Handlers
  const addTrade = async (trade: Omit<Trade, 'id' | 'timestamp'>) => {
    if (!user) return;
    
    const newId = crypto.randomUUID();
    const newTrade: Trade = {
      ...trade,
      id: newId,
      timestamp: Date.now()
    };
    
    // Otimista
    setTrades(prev => [newTrade, ...prev].sort((a,b) => b.timestamp - a.timestamp));

    try {
      const { error } = await supabase.from('trades').insert({
        ...newTrade,
        userId: user.id
      });
      if (error) throw error;
    } catch (err) {
      console.error("Error adding trade: ", err);
      // Se falhar, atualiza a lista vindo da API seria o ideal, mas aqui só avisamos
    }
  };

  const deleteTrade = async (id: string) => {
    if (!user) return;
    
    // Otimista
    setTrades(prev => prev.filter(t => t.id !== id));

    try {
      const { error } = await supabase.from('trades').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error("Error deleting trade: ", err);
    }
  };

  const resetData = async () => {
    if (!user) return;
    if (confirm('Tem certeza que deseja resetar todos os dados? Esta ação não pode ser desfeita.')) {
      setTrades([]); // Otimista
      
      try {
        const { error } = await supabase
          .from('trades')
          .delete()
          .eq('userId', user.id);
        
        if (error) throw error;
      } catch (err) {
        console.error("Error resetting data: ", err);
      }
    }
  };

  if (authLoading || (user && tradesLoading)) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-900 dark:text-white" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans selection:bg-zinc-200 dark:selection:bg-zinc-800">
      {/* Sidebar / Navigation */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-2xl shadow-2xl z-50 flex gap-2">
        <NavButton 
          active={activeTab === 'dashboard'} 
          onClick={() => setActiveTab('dashboard')}
          icon={LayoutDashboard}
          label="Dashboard"
        />
        <NavButton 
          active={activeTab === 'operations'} 
          onClick={() => setActiveTab('operations')}
          icon={TrendingUp}
          label="Operações"
        />
        <NavButton 
          active={activeTab === 'settings'} 
          onClick={() => setActiveTab('settings')}
          icon={Settings}
          label="Ajustes"
        />
      </nav>

      <main className="max-w-5xl mx-auto px-6 pt-12 pb-32">
        <header className="mb-12 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{accountSettings?.name || user.user_metadata?.name || 'Minha Conta'}</h1>
              <div className="flex gap-2">
                <button 
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                >
                  {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => signOut()}
                  className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-zinc-500 hover:text-rose-500 transition-all"
                  title="Sair"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">Bem-vindo ao seu diário de trading.</p>
          </div>
          <div className="text-right">
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 block uppercase tracking-wider">Saldo Atual</span>
            <span className="text-4xl font-black tracking-tighter">{formatCurrency(stats.currentBalance)}</span>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Date Filter */}
              <div className="flex justify-end">
                <div className="flex bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1 rounded-xl shadow-sm">
                  {(['All', 'Today', 'Week', 'Month'] as const).map((range) => (
                    <button 
                      key={range}
                      onClick={() => setDateRange(range)}
                      className={cn(
                        "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                        dateRange === range 
                          ? "bg-zinc-900 dark:bg-white text-white dark:text-black shadow-md" 
                          : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      )}
                    >
                      {range === 'All' ? 'Tudo' : range === 'Today' ? 'Hoje' : range === 'Week' ? 'Semana' : 'Mês'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                  title="Crescimento" 
                  value={formatCurrency(stats.totalGrowth)}
                  subValue={formatPercentage(stats.growthPercentage)}
                  icon={TrendingUp}
                  trend={stats.totalGrowth >= 0 ? 'up' : 'down'}
                />
                <StatCard 
                  title="Taxa de Acerto" 
                  value={`${stats.winRate.toFixed(1)}%`}
                  subValue={`${stats.wins} Wins de ${stats.totalTrades}`}
                  icon={CheckCircle2}
                  trend={stats.winRate >= 50 ? 'up' : 'down'}
                />
                <StatCard 
                  title="Losses" 
                  value={stats.losses.toString()}
                  subValue="Total de prejuízos"
                  icon={XCircle}
                  trend="down"
                />
                <StatCard 
                  title="Breakeven" 
                  value={stats.breakeven.toString()}
                  subValue="Operações neutras"
                  icon={AlertCircle}
                  trend="neutral"
                />
              </div>

              {/* Chart Section */}
              <Card className="h-[400px] flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-lg">Evolução do Saldo</h3>
                  <div className="flex gap-4 text-xs font-medium text-zinc-500">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-zinc-900 dark:bg-white" />
                      Saldo
                    </div>
                  </div>
                </div>
                <div className="flex-1 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#18181b" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#18181b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: '#71717a' }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: '#71717a' }}
                        tickFormatter={(val) => `R$${val}`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          borderRadius: '12px', 
                          border: '1px solid #e4e4e7',
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                        }}
                        formatter={(value: number) => [formatCurrency(value), 'Saldo']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="balance" 
                        stroke="#18181b" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorBalance)" 
                        animationDuration={1500}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'operations' && (
            <motion.div 
              key="operations"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* Form Column */}
              <div className="lg:col-span-1">
                <Card className="sticky top-12">
                  <h3 className="font-bold text-lg mb-6">Novo Trade</h3>
                  <TradeForm onSubmit={addTrade} />
                </Card>
              </div>

              {/* List Column */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <h3 className="font-bold text-lg">Histórico de Operações</h3>
                  <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                    {(['All', 'Win', 'Loss', 'Breakeven'] as const).map((f) => (
                      <button 
                        key={f}
                        onClick={() => setFilter(f)}
                        className={cn(
                          "px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all",
                          filter === f ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-500"
                        )}
                      >
                        {f === 'All' ? 'Todos' : f}
                      </button>
                    ))}
                  </div>
                </div>
                
                {filteredTrades.length === 0 ? (
                  <div className="text-center py-20 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
                    <TrendingUp className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                    <p className="text-zinc-500">Nenhuma operação encontrada com este filtro.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredTrades.map((trade) => (
                      <TradeItem key={trade.id} trade={trade} onDelete={() => deleteTrade(trade.id)} />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-xl mx-auto"
            >
              <Card>
                <h3 className="font-bold text-lg mb-6">Configurações da Conta</h3>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-500">Nome da Conta</label>
                    <input 
                      type="text" 
                      value={accountSettings?.name || ''}
                      onChange={(e) => setAccountSettings({ ...accountSettings!, name: e.target.value })}
                      className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-zinc-900 transition-all"
                      placeholder="Ex: Minha Conta Principal"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-500">Saldo Inicial (R$)</label>
                    <input 
                      type="number" 
                      value={accountSettings?.initialBalance || 0}
                      onChange={(e) => setAccountSettings({ ...accountSettings!, initialBalance: Number(e.target.value) })}
                      className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-zinc-900 transition-all"
                      placeholder="1000"
                    />
                  </div>
                  
                  <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-3">
                    <button 
                      onClick={() => alert('Configurações salvas automaticamente!')}
                      className="w-full bg-zinc-900 dark:bg-white text-white dark:text-black font-bold py-3 rounded-xl hover:opacity-90 transition-opacity"
                    >
                      Salvar Alterações
                    </button>
                    <button 
                      onClick={resetData}
                      className="w-full bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-bold py-3 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-all flex items-center justify-center gap-2"
                    >
                      <RefreshCcw className="w-4 h-4" />
                      Resetar Todos os Dados
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TradeFlowApp />
    </AuthProvider>
  );
}

// --- Sub-components ---

function NavButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300",
        active 
          ? "bg-zinc-900 dark:bg-white text-white dark:text-black shadow-lg" 
          : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      )}
    >
      <Icon className="w-4 h-4" />
      <span className="text-sm font-bold">{label}</span>
    </button>
  );
}

function TradeForm({ onSubmit }: { onSubmit: (trade: Omit<Trade, 'id' | 'timestamp'>) => void }) {
  const [pair, setPair] = useState('');
  const [type, setType] = useState<TradeType>('Buy');
  const [result, setResult] = useState<TradeResult>('Win');
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pair || !value) return;

    onSubmit({
      pair: pair.toUpperCase(),
      type,
      result,
      value: Number(value) * (result === 'Loss' ? -1 : result === 'Breakeven' ? 0 : 1)
    });

    setPair('');
    setValue('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Par de Moedas</label>
        <input 
          type="text" 
          required
          value={pair}
          onChange={(e) => setPair(e.target.value)}
          placeholder="EURUSD"
          className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-zinc-900 transition-all"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Tipo</label>
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
            <button 
              type="button"
              onClick={() => setType('Buy')}
              className={cn(
                "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                type === 'Buy' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-500"
              )}
            >
              Buy
            </button>
            <button 
              type="button"
              onClick={() => setType('Sell')}
              className={cn(
                "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                type === 'Sell' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-500"
              )}
            >
              Sell
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Resultado</label>
          <select 
            value={result}
            onChange={(e) => setResult(e.target.value as TradeResult)}
            className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-zinc-900 transition-all text-sm font-medium"
          >
            <option value="Win">Win</option>
            <option value="Loss">Loss</option>
            <option value="Breakeven">Breakeven</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Valor (Lucro/Prejuízo)</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-medium">R$</span>
          <input 
            type="number" 
            required
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0.00"
            className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-zinc-900 transition-all"
          />
        </div>
      </div>

      <button 
        type="submit"
        className="w-full bg-zinc-900 dark:bg-white text-white dark:text-black font-bold py-4 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 mt-4"
      >
        <Plus className="w-5 h-5" />
        Registrar Trade
      </button>
    </form>
  );
}

function TradeItem({ trade, onDelete }: { trade: Trade; onDelete: () => void; key?: string }) {
  const isWin = trade.result === 'Win';
  const isLoss = trade.result === 'Loss';
  
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl flex items-center justify-between hover:shadow-md transition-all"
    >
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center",
          isWin ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400" :
          isLoss ? "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400" :
          "bg-zinc-50 dark:bg-zinc-800 text-zinc-500"
        )}>
          {isWin ? <ArrowUpRight className="w-5 h-5" /> :
           isLoss ? <ArrowDownRight className="w-5 h-5" /> :
           <Minus className="w-5 h-5" />}
        </div>
        
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight">{trade.pair}</span>
            <span className={cn(
              "text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md",
              trade.type === 'Buy' ? "bg-indigo-50 text-indigo-600" : "bg-orange-50 text-orange-600"
            )}>
              {trade.type}
            </span>
          </div>
          <span className="text-xs text-zinc-400 font-medium">
            {new Date(trade.timestamp).toLocaleDateString()} • {new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="text-right">
          <span className={cn(
            "text-lg font-bold block",
            isWin ? "text-emerald-500" : isLoss ? "text-rose-500" : "text-zinc-500"
          )}>
            {trade.value > 0 ? '+' : ''}{formatCurrency(trade.value)}
          </span>
          <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-widest">{trade.result}</span>
        </div>

        <button 
          onClick={onDelete}
          className="p-2 text-zinc-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
