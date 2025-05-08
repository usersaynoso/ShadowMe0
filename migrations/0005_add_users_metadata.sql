-- Check if table exists first
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users_metadata'
    ) THEN
        -- Create users_metadata table
        CREATE TABLE "users_metadata" (
            "metadata_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            "user_id" UUID UNIQUE REFERENCES "users"("user_id") ON DELETE CASCADE,
            "last_emotions" JSONB,
            "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        RAISE NOTICE 'Created users_metadata table';
    ELSE
        RAISE NOTICE 'Table users_metadata already exists, skipping creation';
    END IF;
END
$$; 