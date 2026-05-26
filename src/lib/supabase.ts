import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL or Anon Key is missing from environment variables.');
}

// Keep the real client reference
const realClient = createClient(supabaseUrl, supabaseAnonKey);

// --- LocalStorage Fallback DB implementation ---

type ChangeCallback = (payload: any) => void;
const localCallbacks = new Map<string, Set<ChangeCallback>>();

export function registerLocalChangeCallback(table: string, callback: ChangeCallback) {
  if (!localCallbacks.has(table)) {
    localCallbacks.set(table, new Set());
  }
  localCallbacks.get(table)!.add(callback);
}

export function unregisterLocalChangeCallback(table: string, callback: ChangeCallback) {
  const set = localCallbacks.get(table);
  if (set) {
    set.delete(callback);
  }
}

function notifyLocalChange(table: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE', newVal: any, oldVal?: any) {
  const set = localCallbacks.get(table);
  if (set) {
    const payload = {
      eventType,
      new: newVal,
      old: oldVal || { id: newVal?.id || newVal?.uid }
    };
    set.forEach(cb => {
      try {
        cb(payload);
      } catch (err) {
        console.error('Error in local change listener:', err);
      }
    });
  }
}

// --- Local Auth Implementation ---

const localAuth = {
  async getSession() {
    const sessionStr = localStorage.getItem('tradeflow_local_session');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        return { data: { session }, error: null };
      } catch (e) {
        return { data: { session: null }, error: null };
      }
    }
    return { data: { session: null }, error: null };
  },

  onAuthStateChange(callback: any) {
    authCallbacks.add(callback);
    this.getSession().then(({ data: { session } }) => {
      callback('SIGNED_IN', session);
    });

    return {
      data: {
        subscription: {
          unsubscribe() {
            authCallbacks.delete(callback);
          }
        }
      }
    };
  },

  async signInWithPassword({ email, password }: any) {
    const users = JSON.parse(localStorage.getItem('tradeflow_local_users') || '[]');
    const user = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) {
      return { data: { session: null, user: null }, error: new Error('E-mail ou senha incorretos.') };
    }
    const session = {
      user: {
        id: user.id,
        email: user.email,
        user_metadata: { name: user.name }
      },
      access_token: 'local_token',
      expires_at: Date.now() + 3600000
    };
    localStorage.setItem('tradeflow_local_session', JSON.stringify(session));
    notifyAuthStateChange('SIGNED_IN', session);
    return { data: { session, user: session.user }, error: null };
  },

  async signUp({ email, password, options }: any) {
    const users = JSON.parse(localStorage.getItem('tradeflow_local_users') || '[]');
    if (users.some((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
      return { data: { user: null }, error: new Error('Este e-mail já está em uso.') };
    }
    const newUser = {
      id: crypto.randomUUID(),
      email,
      password,
      name: options?.data?.name || email.split('@')[0],
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    localStorage.setItem('tradeflow_local_users', JSON.stringify(users));

    // Automatically create local user profile settings
    const initialBalance = Number(options?.data?.initialBalance || 1000);
    const localUsersProfiles = JSON.parse(localStorage.getItem('tradeflow_db_users') || '[]');
    localUsersProfiles.push({
      uid: newUser.id,
      name: newUser.name,
      initialBalance: initialBalance,
      createdAt: new Date().toISOString()
    });
    localStorage.setItem('tradeflow_db_users', JSON.stringify(localUsersProfiles));

    // Sign in automatically
    const session = {
      user: {
        id: newUser.id,
        email: newUser.email,
        user_metadata: { name: newUser.name }
      },
      access_token: 'local_token',
      expires_at: Date.now() + 3600000
    };
    localStorage.setItem('tradeflow_local_session', JSON.stringify(session));
    notifyAuthStateChange('SIGNED_IN', session);

    return { data: { user: session.user, session }, error: null };
  },

  async signOut() {
    localStorage.removeItem('tradeflow_local_session');
    notifyAuthStateChange('SIGNED_OUT', null);
    return { error: null };
  }
};

const authCallbacks = new Set<any>();
function notifyAuthStateChange(event: string, session: any) {
  authCallbacks.forEach(cb => {
    try {
      cb(event, session);
    } catch (e) {
      console.error(e);
    }
  });
}

// --- Active Connection Heartbeat & Checking ---

let isOnline = false;
let checkFinished = false;
let onStatusChangeCallbacks = new Set<(online: boolean) => void>();

export function subscribeToStatusChange(callback: (online: boolean) => void) {
  onStatusChangeCallbacks.add(callback);
  if (checkFinished) callback(isOnline);
  return () => {
    onStatusChangeCallbacks.delete(callback);
  };
}

async function checkConnection(): Promise<boolean> {
  if (checkFinished) return isOnline;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    isOnline = response.status === 200 || response.status === 401 || response.status === 404 || response.status === 400;
  } catch (err) {
    console.warn("Supabase connection check failed. Falling back to offline mode.", err);
    isOnline = false;
  }
  checkFinished = true;
  onStatusChangeCallbacks.forEach(cb => cb(isOnline));
  return isOnline;
}

const connectionPromise = checkConnection();

export function isSupabaseOnline() {
  return isOnline;
}

// --- Smart Proxy Query Builder ---

class SmartQueryBuilder {
  table: string;
  filters: Array<{ field: string; value: any }> = [];
  orderField: string | null = null;
  orderAsc: boolean = true;
  isDelete: boolean = false;
  isInsert: boolean = false;
  isUpsert: boolean = false;
  dataToSave: any = null;
  isSingle: boolean = false;

  constructor(table: string) {
    this.table = table;
  }

  select(fields?: string) {
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  insert(data: any) {
    this.isInsert = true;
    this.dataToSave = data;
    return this;
  }

  upsert(data: any) {
    this.isUpsert = true;
    this.dataToSave = data;
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push({ field, value });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderAsc = options?.ascending ?? true;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  private executeLocal() {
    if (this.isDelete) {
      const items = JSON.parse(localStorage.getItem(`tradeflow_db_${this.table}`) || '[]');
      const toKeep = items.filter((item: any) => {
        return !this.filters.every(f => item[f.field] === f.value);
      });
      const toDelete = items.filter((item: any) => {
        return this.filters.every(f => item[f.field] === f.value);
      });

      localStorage.setItem(`tradeflow_db_${this.table}`, JSON.stringify(toKeep));
      toDelete.forEach(item => {
        notifyLocalChange(this.table, 'DELETE', null, item);
      });
      return { error: null };
    }

    if (this.isInsert) {
      const items = JSON.parse(localStorage.getItem(`tradeflow_db_${this.table}`) || '[]');
      const newItems = Array.isArray(this.dataToSave) ? this.dataToSave : [this.dataToSave];
      const updated = [...newItems, ...items];
      localStorage.setItem(`tradeflow_db_${this.table}`, JSON.stringify(updated));
      newItems.forEach(item => {
        notifyLocalChange(this.table, 'INSERT', item);
      });
      return { data: this.dataToSave, error: null };
    }

    if (this.isUpsert) {
      const items = JSON.parse(localStorage.getItem(`tradeflow_db_${this.table}`) || '[]');
      const key = this.dataToSave.uid ? 'uid' : 'id';
      const index = items.findIndex((item: any) => item[key] === this.dataToSave[key]);
      if (index >= 0) {
        const oldItem = items[index];
        items[index] = { ...oldItem, ...this.dataToSave };
        notifyLocalChange(this.table, 'UPDATE', items[index], oldItem);
      } else {
        items.push(this.dataToSave);
        notifyLocalChange(this.table, 'INSERT', this.dataToSave);
      }
      localStorage.setItem(`tradeflow_db_${this.table}`, JSON.stringify(items));
      return { data: this.dataToSave, error: null };
    }

    // Default SELECT
    let items = JSON.parse(localStorage.getItem(`tradeflow_db_${this.table}`) || '[]');
    this.filters.forEach(f => {
      items = items.filter((item: any) => item[f.field] === f.value);
    });

    if (this.orderField) {
      items.sort((a: any, b: any) => {
        const valA = a[this.orderField!];
        const valB = b[this.orderField!];
        if (valA < valB) return this.orderAsc ? -1 : 1;
        if (valA > valB) return this.orderAsc ? 1 : -1;
        return 0;
      });
    }

    if (this.isSingle) {
      if (items.length === 0) {
        return { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
      }
      return { data: items[0], error: null };
    }

    return { data: items, error: null };
  }

  private async executeReal() {
    let builder: any;
    if (this.isDelete) {
      builder = realClient.from(this.table).delete();
    } else if (this.isInsert) {
      builder = realClient.from(this.table).insert(this.dataToSave);
    } else if (this.isUpsert) {
      builder = realClient.from(this.table).upsert(this.dataToSave);
    } else {
      builder = realClient.from(this.table).select();
    }

    this.filters.forEach(f => {
      builder = builder.eq(f.field, f.value);
    });

    if (this.orderField) {
      builder = builder.order(this.orderField, { ascending: this.orderAsc });
    }

    if (this.isSingle) {
      builder = builder.single();
    }

    return await builder;
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    const promise = connectionPromise.then(async (online) => {
      if (online) {
        try {
          return await this.executeReal();
        } catch (err) {
          console.error("Real Supabase error, falling back to local:", err);
          return this.executeLocal();
        }
      } else {
        return this.executeLocal();
      }
    });
    return promise.then(onfulfilled, onrejected);
  }
}

const smartAuth = {
  async getSession() {
    const online = await connectionPromise;
    if (online) {
      try {
        return await realClient.auth.getSession();
      } catch (err) {
        console.error("Real Auth getSession error:", err);
        return await localAuth.getSession();
      }
    }
    return await localAuth.getSession();
  },

  onAuthStateChange(callback: any) {
    const realSub = realClient.auth.onAuthStateChange((event, session) => {
      connectionPromise.then(online => {
        if (online) {
          callback(event, session);
        }
      });
    });

    const localSub = localAuth.onAuthStateChange((event, session) => {
      connectionPromise.then(online => {
        if (!online) {
          callback(event, session);
        }
      });
    });

    return {
      data: {
        subscription: {
          unsubscribe() {
            try {
              realSub.data.subscription.unsubscribe();
            } catch (e) {}
            try {
              localSub.data.subscription.unsubscribe();
            } catch (e) {}
          }
        }
      }
    };
  },

  async signInWithPassword(credentials: any) {
    const online = await connectionPromise;
    if (online) {
      try {
        const res = await realClient.auth.signInWithPassword(credentials);
        if (res.error) throw res.error;
        return res;
      } catch (err: any) {
        console.error("Real Auth signInWithPassword error, falling back:", err);
        return await localAuth.signInWithPassword(credentials);
      }
    }
    return await localAuth.signInWithPassword(credentials);
  },

  async signUp(credentials: any) {
    const online = await connectionPromise;
    if (online) {
      try {
        const res = await realClient.auth.signUp(credentials);
        if (res.error) throw res.error;
        return res;
      } catch (err: any) {
        console.error("Real Auth signUp error, falling back:", err);
        return await localAuth.signUp(credentials);
      }
    }
    return await localAuth.signUp(credentials);
  },

  async signOut() {
    const online = await connectionPromise;
    if (online) {
      try {
        await realClient.auth.signOut();
      } catch (err) {
        console.error("Real Auth signOut error:", err);
      }
    }
    return await localAuth.signOut();
  }
};

export const supabase = {
  auth: smartAuth,
  from(table: string) {
    return new SmartQueryBuilder(table);
  },
  channel(name: string) {
    const realChannel = realClient.channel(name);
    return {
      on(event: string, config: any, callback: (payload: any) => void) {
        try {
          realChannel.on(event, config, callback);
        } catch (e) {}
        if (config.table) {
          const table = config.table;
          registerLocalChangeCallback(table, callback);
          this.localTable = table;
          this.localCallback = callback;
        }
        return this;
      },
      subscribe() {
        try {
          realChannel.subscribe();
        } catch (e) {}
        return this;
      },
      localTable: '',
      localCallback: null as any
    };
  },
  removeChannel(channel: any) {
    if (channel && channel.localTable && channel.localCallback) {
      unregisterLocalChangeCallback(channel.localTable, channel.localCallback);
    }
    try {
      realClient.removeChannel(channel);
    } catch (e) {}
  }
};
