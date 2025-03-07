/*
  # FocusFive Database Schema - Idempotent Migration
  
  This migration safely applies schema changes using conditional checks
  to prevent errors with existing database objects.
  
  1. Tables
    - `tasks` table for storing user tasks
    - `user_settings` table for storing user preferences
    
  2. Security
    - RLS policies for both tables
    - Uses conditional logic to prevent policy conflicts
*/

-- Tasks table (safe creation)
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  text text NOT NULL,
  completed boolean DEFAULT false,
  date_key text NOT NULL,
  cell_index integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes for tasks table (safe creation)
CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks(user_id);
CREATE INDEX IF NOT EXISTS tasks_date_key_idx ON tasks(date_key);
CREATE INDEX IF NOT EXISTS tasks_user_id_date_key_idx ON tasks(user_id, date_key);

-- User settings table (safe creation)
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL UNIQUE,
  view_mode text DEFAULT 'week' NOT NULL,
  focus_mode boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security (safe operation)
ALTER TABLE IF EXISTS tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_settings ENABLE ROW LEVEL SECURITY;

-- Handle existing policies - safely drop them before recreating
DO $$
BEGIN
    -- Remove tasks policies if they exist
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
    
    -- Remove user_settings policies if they exist
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

-- Create tasks policies
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

-- Create user_settings policies
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