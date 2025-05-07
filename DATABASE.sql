-- Shadow Me Database Schema Backup
-- Generated on: 2025-05-07T20:11:39.697Z
-- Generated from: shared/schema.ts
-- 
-- This file contains the database schema derived from the application's schema.ts file.
-- Note: This is a simplified schema backup and may not include all database objects.

BEGIN;

-- Enum Types
CREATE TYPE "user_type_enum" AS ENUM ('user', 'moderator', 'manager', 'admin');

CREATE TYPE "friendship_status_enum" AS ENUM ('pending', 'accepted', 'blocked');

CREATE TYPE "parent_type_enum" AS ENUM ('friend_group', 'group', 'profile');

CREATE TYPE "session_privacy_enum" AS ENUM ('one_to_one', 'friend_group', 'group', 'public');

CREATE TYPE "post_parent_enum" AS ENUM ('profile', 'friend_group', 'group');

CREATE TYPE "audience_enum" AS ENUM ('everyone', 'friends', 'just_me', 'friend_group', 'group');

CREATE TYPE "message_type_enum" AS ENUM ('text', 'emoji', 'file');

CREATE TYPE "reaction_type_enum" AS ENUM ('like', 'love', 'laugh', 'care', 'wow', 'sad', 'angry', 'emoji');

CREATE TYPE "event_type_enum" AS ENUM ('friendship_accepted', 'message_sent', 'shadow_session_created', 'post_created', 'post_liked', 'post_commented');

-- Tables


-- Note: Indexes, constraints, and data are not included in this simplified backup.

COMMIT;
