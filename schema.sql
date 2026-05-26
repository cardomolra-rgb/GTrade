-- Database schema for TradeFlow application
-- You can run this script directly in the Supabase SQL Editor to set up the tables and RLS policies.

-- 1. Create the Users profile table
CREATE TABLE IF NOT EXISTS public.users (
    uid UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    "initialBalance" NUMERIC DEFAULT 1000,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE
);

-- 2. Create the Trades table
CREATE TABLE IF NOT EXISTS public.trades (
    id UUID PRIMARY KEY,
    "userId" UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    pair TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Buy', 'Sell')),
    result TEXT NOT NULL CHECK (result IN ('Win', 'Loss', 'Breakeven')),
    value NUMERIC NOT NULL,
    timestamp BIGINT NOT NULL
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- 4. Set up security policies for Users table
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.users;
CREATE POLICY "Users can manage their own profile"
    ON public.users
    FOR ALL
    USING (auth.uid() = uid)
    WITH CHECK (auth.uid() = uid);

-- 5. Set up security policies for Trades table
DROP POLICY IF EXISTS "Users can manage their own trades" ON public.trades;
CREATE POLICY "Users can manage their own trades"
    ON public.trades
    FOR ALL
    USING (auth.uid() = "userId")
    WITH CHECK (auth.uid() = "userId");

-- 6. Trigger to automatically create profile on sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (uid, name, "initialBalance")
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
        COALESCE((new.raw_user_meta_data->>'initialBalance')::numeric, 1000)
    )
    ON CONFLICT (uid) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
