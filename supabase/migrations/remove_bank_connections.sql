-- Migration: Remove GoCardless/Bank Connections
-- This migration removes the bank_connections table and simplifies the accounts table

-- Step 1: Drop the foreign key constraint from accounts
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_bank_connection_id_fkey;

-- Step 2: Drop the bank_connection_id column from accounts
ALTER TABLE accounts DROP COLUMN IF EXISTS bank_connection_id;

-- Step 3: Make external_id nullable (only needed for imported transactions)
ALTER TABLE accounts ALTER COLUMN external_id DROP NOT NULL;

-- Step 4: Drop the unique constraint that includes external_id (if exists)
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_id_external_id_key;

-- Step 5: Drop RLS policies for bank_connections
DROP POLICY IF EXISTS "Users can view own bank connections" ON bank_connections;
DROP POLICY IF EXISTS "Users can insert own bank connections" ON bank_connections;
DROP POLICY IF EXISTS "Users can update own bank connections" ON bank_connections;
DROP POLICY IF EXISTS "Users can delete own bank connections" ON bank_connections;

-- Step 6: Drop the trigger for bank_connections
DROP TRIGGER IF EXISTS update_bank_connections_updated_at ON bank_connections;

-- Step 7: Drop index on bank_connections
DROP INDEX IF EXISTS idx_bank_connections_user_id;
DROP INDEX IF EXISTS idx_accounts_bank_connection_id;

-- Step 8: Drop the bank_connections table
DROP TABLE IF EXISTS bank_connections;

-- Step 9: Drop the connection_status enum type
DROP TYPE IF EXISTS connection_status;
