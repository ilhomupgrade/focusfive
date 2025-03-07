/*
  # Fix database schema for FocusFive application

  This migration ensures proper schema setup with checks for existing objects
  to prevent duplicate policies and tables.

  1. Tables
    - `tasks` (checks if exists first)
    - `user_settings` (checks if exists first)
  
  2. Security
    - RLS policies created conditionally to avoid duplication
*/

-- Tasks table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  text text NOT NULL,
  completed boolean DEFAULT false,
  date_key text NOT NULL,
  cell_index integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes for tasks table (only if they don't exist)
CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks(user_id);
CREATE INDEX IF NOT EXISTS tasks_date_key_idx ON tasks(date_key);
CREATE INDEX IF NOT EXISTS tasks_user_id_date_key_idx ON tasks(user_id, date_key);

-- User settings table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL UNIQUE,
  view_mode text DEFAULT 'week' NOT NULL,
  focus_mode boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE IF EXISTS tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_settings ENABLE ROW LEVEL SECURITY;

-- Remove existing policies first if they exist before recreating
DO $$
BEGIN
    -- Drop tasks policies if they exist
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Users can create their own tasks') THEN
        DROP POLICY "Users can create their own tasks" ON tasks;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Users can read their own tasks') THEN
        DROP POLICY "Users can read their own tasks" ON tasks;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Users can update their own tasks') THEN
        DROP POLICY "Users can update their own tasks" ON tasks;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Users can delete their own tasks') THEN
        DROP POLICY "Users can delete their own tasks" ON tasks;
    END IF;
    
    -- Drop user_settings policies if they exist
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'Users can create their own settings') THEN
        DROP POLICY "Users can create their own settings" ON user_settings;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'Users can read their own settings') THEN
        DROP POLICY "Users can read their own settings" ON user_settings;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'Users can update their own settings') THEN
        DROP POLICY "Users can update their own settings" ON user_settings;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'Users can delete their own settings') THEN
        DROP POLICY "Users can delete their own settings" ON user_settings;
    END IF;
END $$;

-- Recreate tasks policies
CREATE POLICY "Users can create their own tasks"
  ON tasks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own tasks"
  ON tasks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
  ON tasks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks"
  ON tasks FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Recreate user_settings policies
CREATE POLICY "Users can create their own settings"
  ON user_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own settings"
  ON user_settings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON user_settings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own settings"
  ON user_settings FOR DELETE TO authenticated
  USING (auth.uid() = user_id);