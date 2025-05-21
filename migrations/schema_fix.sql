-- Schema Fix Migration Script
-- This script updates the notifications table structure to match the schema definition in shared/schema.ts

-- First, we check if we need to alter the table
DO $$
DECLARE
    recipient_column_exists BOOLEAN;
    actor_column_exists BOOLEAN;
    event_type_column_exists BOOLEAN;
    entity_id_column_exists BOOLEAN;
    entity_type_column_exists BOOLEAN;
    user_id_column_exists BOOLEAN;
    sender_user_id_column_exists BOOLEAN;
    type_column_exists BOOLEAN;
    related_item_id_column_exists BOOLEAN;
    content_column_exists BOOLEAN;
BEGIN
    -- Check which columns exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'recipient_user_id'
    ) INTO recipient_column_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'actor_user_id'
    ) INTO actor_column_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'event_type'
    ) INTO event_type_column_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'entity_id'
    ) INTO entity_id_column_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'entity_type'
    ) INTO entity_type_column_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'user_id'
    ) INTO user_id_column_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'sender_user_id'
    ) INTO sender_user_id_column_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'type'
    ) INTO type_column_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'related_item_id'
    ) INTO related_item_id_column_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'content'
    ) INTO content_column_exists;

    RAISE NOTICE 'Current schema: recipient_user_id=%, actor_user_id=%, event_type=%, entity_id=%, entity_type=%, user_id=%, sender_user_id=%, type=%, related_item_id=%, content=%', 
        recipient_column_exists, actor_column_exists, event_type_column_exists, entity_id_column_exists, entity_type_column_exists,
        user_id_column_exists, sender_user_id_column_exists, type_column_exists, related_item_id_column_exists, content_column_exists;

    -- If new schema columns don't all exist, we need to create them
    IF NOT recipient_column_exists OR NOT actor_column_exists OR NOT event_type_column_exists OR NOT entity_id_column_exists OR NOT entity_type_column_exists THEN
        -- First, we'll backup existing data to a temp table in case something goes wrong
        CREATE TABLE IF NOT EXISTS notifications_backup AS SELECT * FROM notifications;
        RAISE NOTICE 'Created backup table: notifications_backup';
        
        -- Add new columns if they don't exist
        IF NOT recipient_column_exists THEN
            ALTER TABLE notifications ADD COLUMN recipient_user_id UUID REFERENCES users(user_id) ON DELETE CASCADE;
            RAISE NOTICE 'Added column: recipient_user_id';
        END IF;
        
        IF NOT actor_column_exists THEN
            ALTER TABLE notifications ADD COLUMN actor_user_id UUID REFERENCES users(user_id) ON DELETE CASCADE;
            RAISE NOTICE 'Added column: actor_user_id';
        END IF;
        
        IF NOT event_type_column_exists THEN
            ALTER TABLE notifications ADD COLUMN event_type TEXT;
            RAISE NOTICE 'Added column: event_type';
        END IF;
        
        IF NOT entity_id_column_exists THEN
            ALTER TABLE notifications ADD COLUMN entity_id UUID;
            RAISE NOTICE 'Added column: entity_id';
        END IF;
        
        IF NOT entity_type_column_exists THEN
            ALTER TABLE notifications ADD COLUMN entity_type TEXT;
            RAISE NOTICE 'Added column: entity_type';
        END IF;
        
        -- Migrate data if the old schema columns exist
        IF user_id_column_exists AND recipient_column_exists THEN
            UPDATE notifications SET recipient_user_id = user_id WHERE recipient_user_id IS NULL AND user_id IS NOT NULL;
            RAISE NOTICE 'Migrated data: user_id -> recipient_user_id';
        END IF;
        
        IF sender_user_id_column_exists AND actor_column_exists THEN
            UPDATE notifications SET actor_user_id = sender_user_id WHERE actor_user_id IS NULL AND sender_user_id IS NOT NULL;
            RAISE NOTICE 'Migrated data: sender_user_id -> actor_user_id';
        END IF;
        
        IF type_column_exists AND event_type_column_exists THEN
            UPDATE notifications SET event_type = type WHERE event_type IS NULL AND type IS NOT NULL;
            RAISE NOTICE 'Migrated data: type -> event_type';
        END IF;
        
        IF related_item_id_column_exists AND type_column_exists AND entity_id_column_exists AND entity_type_column_exists THEN
            -- UUID conversion with safety check
            EXECUTE '
                UPDATE notifications 
                SET 
                    entity_id = CASE WHEN related_item_id ~ ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'' 
                                THEN related_item_id::UUID ELSE NULL END,
                    entity_type = CASE WHEN type = ''message_sent'' THEN ''chat_message'' ELSE NULL END
                WHERE entity_id IS NULL AND related_item_id IS NOT NULL
            ';
            RAISE NOTICE 'Migrated data: related_item_id -> entity_id and set entity_type';
        END IF;
        
        -- Only drop old columns if they exist and all data was successfully migrated
        IF user_id_column_exists AND recipient_column_exists THEN
            -- Check if all data was successfully migrated
            IF NOT EXISTS (
                SELECT 1 
                FROM notifications 
                WHERE recipient_user_id IS NULL AND user_id IS NOT NULL
            ) THEN
                ALTER TABLE notifications DROP COLUMN IF EXISTS user_id;
                RAISE NOTICE 'Dropped column: user_id';
            ELSE
                RAISE NOTICE 'Some data not migrated from user_id, keeping column';
            END IF;
        END IF;
        
        IF sender_user_id_column_exists AND actor_column_exists THEN
            -- Check if all data was successfully migrated
            IF NOT EXISTS (
                SELECT 1 
                FROM notifications 
                WHERE actor_user_id IS NULL AND sender_user_id IS NOT NULL
            ) THEN
                ALTER TABLE notifications DROP COLUMN IF EXISTS sender_user_id;
                RAISE NOTICE 'Dropped column: sender_user_id';
            ELSE
                RAISE NOTICE 'Some data not migrated from sender_user_id, keeping column';
            END IF;
        END IF;
        
        IF type_column_exists AND event_type_column_exists THEN
            -- Check if all data was successfully migrated
            IF NOT EXISTS (
                SELECT 1 
                FROM notifications 
                WHERE event_type IS NULL AND type IS NOT NULL
            ) THEN
                ALTER TABLE notifications DROP COLUMN IF EXISTS type;
                RAISE NOTICE 'Dropped column: type';
            ELSE
                RAISE NOTICE 'Some data not migrated from type, keeping column';
            END IF;
        END IF;
        
        IF related_item_id_column_exists AND entity_id_column_exists THEN
            ALTER TABLE notifications DROP COLUMN IF EXISTS related_item_id;
            RAISE NOTICE 'Dropped column: related_item_id';
        END IF;
        
        IF content_column_exists THEN
            ALTER TABLE notifications DROP COLUMN IF EXISTS content;
            RAISE NOTICE 'Dropped column: content';
        END IF;
        
        -- Set NOT NULL constraint for event_type if all migrations complete
        IF event_type_column_exists AND 
           NOT EXISTS (SELECT 1 FROM notifications WHERE event_type IS NULL) THEN
            ALTER TABLE notifications ALTER COLUMN event_type SET NOT NULL;
            RAISE NOTICE 'Set NOT NULL constraint on: event_type';
        END IF;
        
        RAISE NOTICE 'Migration completed successfully';
    ELSE
        RAISE NOTICE 'Schema already updated - no changes needed';
    END IF;
END $$; 