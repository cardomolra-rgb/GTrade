import React, { useState } from 'react';
import { supabase } from './lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, Mail, Lock, User, Wallet, Loader2, Sun, Moon } from 'lucide-react';
import { cn } from './lib/utils';

export function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [initialBalance, setInitialBalance] = useState('1000');

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('tradeflow_dark') === 'true';
  });

  const toggleDarkMode = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    localStorage.setItem('tradeflow_dark', nextDark.toString());
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              initialBalance: Number(initialBalance)
            }
          }
        });
        
        if (error) throw error;
        
        const user = data.user;
        const session = data.session;
        
        if (user && !session) {
          // Email confirmation is required by Supabase
          setError("Cadastro realizado! Verifique seu e-mail para confirmar a conta e depois faça o login.");
          setIsLogin(true); // Redirect to login tab
          setPassword('');
        }
      }
    } catch (err: any) {
      console.error(err);
      let errorMessage = err.message || 'Ocorreu um erro ao processar sua solicitação.';
      if (err.message?.includes('already registered') || err.message?.includes('User already registered')) {
        errorMessage = 'Este e-mail já está em uso. Por favor, clique em "Já tem uma conta? Entre" abaixo.';
      } else if (err.message?.includes('Invalid login credentials')) {
        errorMessage = 'E-mail ou senha incorretos.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-6 relative transition-colors duration-300">
      <button 
        type="button"
        onClick={toggleDarkMode}
        className="absolute top-6 right-6 p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-all shadow-sm cursor-pointer"
        title={darkMode ? 'Modo Claro' : 'Modo Escuro'}
      >
        {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-zinc-900 dark:bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <TrendingUp className="w-8 h-8 text-white dark:text-black" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">TradeFlow</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
            {isLogin ? 'Bem-vindo de volta ao seu diário.' : 'Comece sua jornada no trading hoje.'}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-2xl transition-colors duration-300">
          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div 
                  key="signup-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Nome Completo</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input 
                        type="text" 
                        required={!isLogin}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Seu nome"
                        className="w-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 border-none rounded-xl pl-11 pr-4 py-3 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all font-medium"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Saldo Inicial (R$)</label>
                    <div className="relative">
                      <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input 
                        type="number" 
                        required={!isLogin}
                        value={initialBalance}
                        onChange={(e) => setInitialBalance(e.target.value)}
                        placeholder="1000"
                        className="w-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 border-none rounded-xl pl-11 pr-4 py-3 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all font-medium"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                  className="w-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 border-none rounded-xl pl-11 pr-4 py-3 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 border-none rounded-xl pl-11 pr-4 py-3 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all font-medium"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-xl border border-rose-100 dark:border-rose-900/30">
                {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-zinc-900 dark:bg-white text-white dark:text-black font-bold py-4 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-md"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                isLogin ? 'Entrar' : 'Criar Conta'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
            >
              {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Entre'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
