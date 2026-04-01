import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { AccountSettings } from './types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  accountSettings: AccountSettings | null;
  setAccountSettings: (settings: AccountSettings) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountSettings, setAccountSettingsState] = useState<AccountSettings | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (!session?.user) setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setAccountSettingsState(null);
      return;
    }

    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('uid', user.id)
        .single();
        
      if (!error && data) {
        setAccountSettingsState(data as unknown as AccountSettings);
      }
      setLoading(false);
    };
    
    fetchSettings();

    const channel = supabase
      .channel(`users-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `uid=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new) {
             setAccountSettingsState(payload.new as unknown as AccountSettings);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const setAccountSettings = async (settings: AccountSettings) => {
    if (!user) return;
    
    // Atualiza a tela instantaneamente (Optimistic Update)
    setAccountSettingsState(settings);

    const { error } = await supabase.from('users').upsert({
      uid: user.id,
      ...settings,
      updatedAt: new Date().toISOString()
    });
    if (error) console.error("Error setting account:", error);
  };

  const signOut = async () => {
     await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, accountSettings, setAccountSettings, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
