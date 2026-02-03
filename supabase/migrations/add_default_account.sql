-- Add is_default column to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Create an index for faster default account lookup
CREATE INDEX IF NOT EXISTS idx_accounts_is_default ON accounts(user_id, is_default) WHERE is_default = true;

-- Add a function to ensure only one default account per user
CREATE OR REPLACE FUNCTION ensure_single_default_account()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        -- Set all other accounts for this user to non-default
        UPDATE accounts 
        SET is_default = false 
        WHERE user_id = NEW.user_id 
        AND id != NEW.id 
        AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to ensure only one default account
DROP TRIGGER IF EXISTS trigger_ensure_single_default_account ON accounts;
CREATE TRIGGER trigger_ensure_single_default_account
    BEFORE INSERT OR UPDATE OF is_default ON accounts
    FOR EACH ROW
    WHEN (NEW.is_default = true)
    EXECUTE FUNCTION ensure_single_default_account();
