DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_type_enum') THEN
        CREATE TYPE "public"."user_type_enum" AS ENUM('user', 'moderator', 'manager', 'admin');
    END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'friendship_status_enum') THEN
        CREATE TYPE "public"."friendship_status_enum" AS ENUM('pending', 'accepted', 'blocked');
    END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'parent_type_enum') THEN
        CREATE TYPE "public"."parent_type_enum" AS ENUM('friend_group', 'group', 'profile');
    END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_privacy_enum') THEN
        CREATE TYPE "public"."session_privacy_enum" AS ENUM('one_to_one', 'friend_group', 'group', 'public');
    END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_parent_enum') THEN
        CREATE TYPE "public"."post_parent_enum" AS ENUM('profile', 'friend_group', 'group');
    END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audience_enum') THEN
        CREATE TYPE "public"."audience_enum" AS ENUM('everyone', 'friends', 'just_me', 'friend_group', 'group');
    END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type_enum') THEN
        CREATE TYPE "public"."message_type_enum" AS ENUM('text', 'emoji', 'file');
    END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reaction_type_enum') THEN
        CREATE TYPE "public"."reaction_type_enum" AS ENUM('sending_love', 'thank_you', 'take_care', 'here_for_you', 'made_my_day');
    END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type_enum') THEN
        CREATE TYPE "public"."event_type_enum" AS ENUM('friendship_accepted', 'message_sent', 'shadow_session_created', 'post_created', 'post_liked', 'post_commented', 'friendship_request', 'shadow_session_reminder', 'group_invite', 'friend_group_invite');
    END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'smtp_encryption_enum') THEN
        CREATE TYPE "public"."smtp_encryption_enum" AS ENUM('none', 'ssl', 'tls');
    END IF;
END $$;
--> statement-breakpoint

-- Create/recreate all tables with their structure first, no foreign keys yet
DO $$
BEGIN
    -- Drop existing notifications table if it exists to recreate it with new structure
    DROP TABLE IF EXISTS "notifications" CASCADE;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "users" (
    "user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "email" text NOT NULL,
    "password" text NOT NULL,
    "user_type" "user_type_enum" DEFAULT 'user',
    "user_points" numeric(12, 2) DEFAULT '0',
    "user_level" smallint DEFAULT 1,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "profiles" (
    "profile_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid,
    "display_name" varchar(60),
    "bio" text,
    "avatar_url" text,
    "timezone" text DEFAULT 'UTC',
    "last_seen_at" timestamp with time zone,
    "preferences_blob" jsonb,
    "notification_settings_blob" jsonb
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "friends" (
    "user_id" uuid,
    "friend_id" uuid,
    "status" "friendship_status_enum" DEFAULT 'pending',
    "created_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "friends_user_id_friend_id_pk" PRIMARY KEY("user_id", "friend_id"),
    CONSTRAINT "friends_user_id_friend_id_unique" UNIQUE("user_id", "friend_id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "friend_groups" (
    "friend_group_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "owner_user_id" uuid,
    "name" varchar(80) NOT NULL,
    "description" text,
    "created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "friend_group_members" (
    "friend_group_id" uuid,
    "user_id" uuid,
    "role" varchar(20) DEFAULT 'member',
    "joined_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "friend_group_members_friend_group_id_user_id_pk" PRIMARY KEY("friend_group_id", "user_id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "groups" (
    "group_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "creator_user_id" uuid,
    "name" varchar(80) NOT NULL,
    "topic_tag" varchar(50),
    "is_public" boolean DEFAULT true,
    "description" text,
    "created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "group_members" (
    "group_id" uuid,
    "user_id" uuid,
    "role" varchar(20) DEFAULT 'member',
    "joined_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "group_members_group_id_user_id_pk" PRIMARY KEY("group_id", "user_id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "chat_rooms" (
    "chat_room_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "parent_type" "parent_type_enum" NOT NULL,
    "parent_id" uuid NOT NULL,
    "title" varchar(80),
    "created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "chat_room_members" (
    "chat_room_id" uuid,
    "user_id" uuid,
    "mute_until" timestamp with time zone,
    "joined_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "chat_room_members_chat_room_id_user_id_pk" PRIMARY KEY("chat_room_id", "user_id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "messages" (
    "message_id" bigserial PRIMARY KEY NOT NULL,
    "chat_room_id" uuid,
    "sender_id" uuid,
    "recipient_id" uuid,
    "body" text,
    "message_type" "message_type_enum" DEFAULT 'text',
    "created_at" timestamp with time zone DEFAULT now(),
    "edited_at" timestamp with time zone
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "emotions" (
    "emotion_id" smallint PRIMARY KEY NOT NULL,
    "emotion_name" varchar(30) NOT NULL,
    "emotion_color" varchar(7) NOT NULL,
    CONSTRAINT "emotions_emotion_name_unique" UNIQUE("emotion_name")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "posts" (
    "post_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "author_user_id" uuid,
    "parent_type" "post_parent_enum" NOT NULL,
    "parent_id" uuid NOT NULL,
    "audience" "audience_enum" NOT NULL,
    "content" text,
    "emotion_ids" smallint[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "post_audience" (
    "post_id" uuid,
    "friend_group_id" uuid,
    CONSTRAINT "post_audience_post_id_friend_group_id_pk" PRIMARY KEY("post_id", "friend_group_id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "post_media" (
    "media_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "post_id" uuid,
    "media_url" text NOT NULL,
    "media_type" varchar(20) NOT NULL,
    "created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "post_reactions" (
    "reaction_id" bigserial PRIMARY KEY NOT NULL,
    "post_id" uuid,
    "user_id" uuid,
    "reaction_type" "reaction_type_enum" NOT NULL,
    "created_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "post_reactions_post_id_user_id_unique" UNIQUE("post_id", "user_id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "post_comments" (
    "comment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "post_id" uuid,
    "author_user_id" uuid,
    "parent_comment_id" uuid,
    "body" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "edited_at" timestamp with time zone
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "shadow_sessions" (
    "post_id" uuid PRIMARY KEY NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "timezone" text NOT NULL,
    "title" varchar(100)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "shadow_session_participants" (
    "post_id" uuid,
    "user_id" uuid,
    "joined_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "shadow_session_participants_post_id_user_id_pk" PRIMARY KEY("post_id", "user_id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "session_messages" (
    "id" bigserial PRIMARY KEY NOT NULL,
    "session_id" uuid,
    "user_id" uuid,
    "message_type" varchar(20) DEFAULT 'text' NOT NULL,
    "content" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "feed_events" (
    "event_id" bigserial PRIMARY KEY NOT NULL,
    "user_id_actor" uuid,
    "event_type" "event_type_enum",
    "payload" jsonb,
    "created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

-- Create the notifications table with the new schema
CREATE TABLE IF NOT EXISTS "notifications" (
    "notification_id" bigserial PRIMARY KEY NOT NULL,
    "recipient_user_id" uuid,
    "actor_user_id" uuid,
    "event_type" "event_type_enum" NOT NULL,
    "entity_id" uuid,
    "entity_type" text,
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "users_metadata" (
    "metadata_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid,
    "last_emotions" jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "users_metadata_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "system_settings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "key" varchar(50) NOT NULL,
    "settings_blob" jsonb NOT NULL,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint

-- Now add all the foreign key constraints
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_users_user_id_fk') THEN
        ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'friends_user_id_users_user_id_fk') THEN
        ALTER TABLE "friends" ADD CONSTRAINT "friends_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'friends_friend_id_users_user_id_fk') THEN
        ALTER TABLE "friends" ADD CONSTRAINT "friends_friend_id_users_user_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'friend_groups_owner_user_id_users_user_id_fk') THEN
        ALTER TABLE "friend_groups" ADD CONSTRAINT "friend_groups_owner_user_id_users_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'friend_group_members_friend_group_id_friend_groups_friend_group_id_fk') THEN
        ALTER TABLE "friend_group_members" ADD CONSTRAINT "friend_group_members_friend_group_id_friend_groups_friend_group_id_fk" FOREIGN KEY ("friend_group_id") REFERENCES "public"."friend_groups"("friend_group_id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'friend_group_members_user_id_users_user_id_fk') THEN
        ALTER TABLE "friend_group_members" ADD CONSTRAINT "friend_group_members_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'groups_creator_user_id_users_user_id_fk') THEN
        ALTER TABLE "groups" ADD CONSTRAINT "groups_creator_user_id_users_user_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_members_group_id_groups_group_id_fk') THEN
        ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("group_id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_members_user_id_users_user_id_fk') THEN
        ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_room_members_chat_room_id_chat_rooms_chat_room_id_fk') THEN
        ALTER TABLE "chat_room_members" ADD CONSTRAINT "chat_room_members_chat_room_id_chat_rooms_chat_room_id_fk" FOREIGN KEY ("chat_room_id") REFERENCES "public"."chat_rooms"("chat_room_id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_room_members_user_id_users_user_id_fk') THEN
        ALTER TABLE "chat_room_members" ADD CONSTRAINT "chat_room_members_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_chat_room_id_chat_rooms_chat_room_id_fk') THEN
        ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_room_id_chat_rooms_chat_room_id_fk" FOREIGN KEY ("chat_room_id") REFERENCES "public"."chat_rooms"("chat_room_id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_sender_id_users_user_id_fk') THEN
        ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_recipient_id_users_user_id_fk') THEN
        ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_id_users_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_author_user_id_users_user_id_fk') THEN
        ALTER TABLE "posts" ADD CONSTRAINT "posts_author_user_id_users_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_audience_post_id_posts_post_id_fk') THEN
        ALTER TABLE "post_audience" ADD CONSTRAINT "post_audience_post_id_posts_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("post_id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_audience_friend_group_id_friend_groups_friend_group_id_fk') THEN
        ALTER TABLE "post_audience" ADD CONSTRAINT "post_audience_friend_group_id_friend_groups_friend_group_id_fk" FOREIGN KEY ("friend_group_id") REFERENCES "public"."friend_groups"("friend_group_id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_media_post_id_posts_post_id_fk') THEN
        ALTER TABLE "post_media" ADD CONSTRAINT "post_media_post_id_posts_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("post_id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_reactions_post_id_posts_post_id_fk') THEN
        ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_post_id_posts_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("post_id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_reactions_user_id_users_user_id_fk') THEN
        ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_comments_post_id_posts_post_id_fk') THEN
        ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_posts_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("post_id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_comments_author_user_id_users_user_id_fk') THEN
        ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_author_user_id_users_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_comments_parent_comment_id_post_comments_comment_id_fk') THEN
        ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_parent_comment_id_post_comments_comment_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."post_comments"("comment_id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shadow_sessions_post_id_posts_post_id_fk') THEN
        ALTER TABLE "shadow_sessions" ADD CONSTRAINT "shadow_sessions_post_id_posts_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("post_id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shadow_session_participants_post_id_shadow_sessions_post_id_fk') THEN
        ALTER TABLE "shadow_session_participants" ADD CONSTRAINT "shadow_session_participants_post_id_shadow_sessions_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."shadow_sessions"("post_id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shadow_session_participants_user_id_users_user_id_fk') THEN
        ALTER TABLE "shadow_session_participants" ADD CONSTRAINT "shadow_session_participants_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_messages_session_id_shadow_sessions_post_id_fk') THEN
        ALTER TABLE "session_messages" ADD CONSTRAINT "session_messages_session_id_shadow_sessions_post_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."shadow_sessions"("post_id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_messages_user_id_users_user_id_fk') THEN
        ALTER TABLE "session_messages" ADD CONSTRAINT "session_messages_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feed_events_user_id_actor_users_user_id_fk') THEN
        ALTER TABLE "feed_events" ADD CONSTRAINT "feed_events_user_id_actor_users_user_id_fk" FOREIGN KEY ("user_id_actor") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_recipient_user_id_users_user_id_fk') THEN
        ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_actor_user_id_users_user_id_fk') THEN
        ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_user_id_users_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_metadata_user_id_users_user_id_fk') THEN
        ALTER TABLE "users_metadata" ADD CONSTRAINT "users_metadata_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint

-- Create indexes
CREATE INDEX IF NOT EXISTS "messages_chat_room_id_created_at_idx" ON "messages" USING btree ("chat_room_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_recipient_user_id_created_at_idx" ON "notifications" USING btree ("recipient_user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_author_user_id_created_at_idx" ON "posts" USING btree ("author_user_id","created_at"); 