-- Complete Migration Script
-- This script ensures all data is properly migrated from old columns to new ones

DO $$
BEGIN
    -- First check if both old and new columns exist
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'user_id'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'recipient_user_id'
    ) THEN
        -- Ensure all data is migrated from user_id to recipient_user_id
        UPDATE notifications 
        SET recipient_user_id = user_id
        WHERE recipient_user_id IS NULL AND user_id IS NOT NULL;
        
        RAISE NOTICE 'Migrated remaining user_id data to recipient_user_id';
    END IF;
    
    -- Check if both type and event_type exist
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'type'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'event_type'
    ) THEN
        -- Ensure all data is migrated from type to event_type
        UPDATE notifications 
        SET event_type = type
        WHERE event_type IS NULL AND type IS NOT NULL;
        
        RAISE NOTICE 'Migrated remaining type data to event_type';
    END IF;
    
    -- Set entity_type for chat messages
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'type'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'entity_type'
    ) THEN
        UPDATE notifications 
        SET entity_type = 'chat_message'
        WHERE type = 'message_sent' AND entity_type IS NULL;
        
        RAISE NOTICE 'Set entity_type for message_sent notifications';
    END IF;
    
    -- Now verify if all data has been migrated
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'user_id'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'recipient_user_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM notifications 
        WHERE recipient_user_id IS NULL AND user_id IS NOT NULL
    ) THEN
        -- Safe to drop user_id column
        ALTER TABLE notifications DROP COLUMN IF EXISTS user_id;
        RAISE NOTICE 'Dropped user_id column';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'type'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'event_type'
    ) AND NOT EXISTS (
        SELECT 1 FROM notifications 
        WHERE event_type IS NULL AND type IS NOT NULL
    ) THEN
        -- Safe to drop type column
        ALTER TABLE notifications DROP COLUMN IF EXISTS type;
        RAISE NOTICE 'Dropped type column';
    END IF;
    
    -- Set NOT NULL constraints
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'recipient_user_id' 
        AND is_nullable = 'YES'
    ) THEN
        -- Only set NOT NULL if there are no NULL values
        IF NOT EXISTS (
            SELECT 1 FROM notifications WHERE recipient_user_id IS NULL
        ) THEN
            ALTER TABLE notifications ALTER COLUMN recipient_user_id SET NOT NULL;
            RAISE NOTICE 'Set NOT NULL constraint on recipient_user_id';
        END IF;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'event_type' 
        AND is_nullable = 'YES'
    ) THEN
        -- Only set NOT NULL if there are no NULL values
        IF NOT EXISTS (
            SELECT 1 FROM notifications WHERE event_type IS NULL
        ) THEN
            ALTER TABLE notifications ALTER COLUMN event_type SET NOT NULL;
            RAISE NOTICE 'Set NOT NULL constraint on event_type';
        END IF;
    END IF;
    
    RAISE NOTICE 'Complete migration finished successfully';
END $$; 