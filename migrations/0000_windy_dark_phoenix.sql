CREATE TYPE "public"."audience_enum" AS ENUM('everyone', 'friends', 'just_me', 'friend_group', 'group');--> statement-breakpoint
CREATE TYPE "public"."event_type_enum" AS ENUM('friendship_accepted', 'message_sent', 'shadow_session_created', 'post_created', 'post_liked', 'post_commented', 'friendship_request', 'shadow_session_reminder', 'group_invite', 'friend_group_invite');--> statement-breakpoint
CREATE TYPE "public"."friendship_status_enum" AS ENUM('pending', 'accepted', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."message_type_enum" AS ENUM('text', 'emoji', 'file');--> statement-breakpoint
CREATE TYPE "public"."parent_type_enum" AS ENUM('friend_group', 'group', 'profile');--> statement-breakpoint
CREATE TYPE "public"."post_parent_enum" AS ENUM('profile', 'friend_group', 'group');--> statement-breakpoint
CREATE TYPE "public"."reaction_type_enum" AS ENUM('like', 'love', 'laugh', 'care', 'wow', 'sad', 'angry', 'emoji');--> statement-breakpoint
CREATE TYPE "public"."session_privacy_enum" AS ENUM('one_to_one', 'friend_group', 'group', 'public');--> statement-breakpoint
CREATE TYPE "public"."user_type_enum" AS ENUM('user', 'moderator', 'manager', 'admin');--> statement-breakpoint
CREATE TABLE "chat_room_members" (
	"chat_room_id" uuid,
	"user_id" uuid,
	"mute_until" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "chat_room_members_chat_room_id_user_id_pk" PRIMARY KEY("chat_room_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "chat_rooms" (
	"chat_room_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_type" "parent_type_enum" NOT NULL,
	"parent_id" uuid NOT NULL,
	"title" varchar(80),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "emotions" (
	"emotion_id" smallint PRIMARY KEY NOT NULL,
	"emotion_name" varchar(30) NOT NULL,
	"emotion_color" varchar(7) NOT NULL,
	CONSTRAINT "emotions_emotion_name_unique" UNIQUE("emotion_name")
);
--> statement-breakpoint
CREATE TABLE "feed_events" (
	"event_id" bigserial PRIMARY KEY NOT NULL,
	"user_id_actor" uuid,
	"event_type" "event_type_enum",
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "friend_group_members" (
	"friend_group_id" uuid,
	"user_id" uuid,
	"role" varchar(20) DEFAULT 'member',
	"joined_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "friend_group_members_friend_group_id_user_id_pk" PRIMARY KEY("friend_group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "friend_groups" (
	"friend_group_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid,
	"name" varchar(80) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "friends" (
	"user_id" uuid,
	"friend_id" uuid,
	"status" "friendship_status_enum" DEFAULT 'pending',
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "friends_user_id_friend_id_pk" PRIMARY KEY("user_id","friend_id"),
	CONSTRAINT "friends_user_id_friend_id_unique" UNIQUE("user_id","friend_id")
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"group_id" uuid,
	"user_id" uuid,
	"role" varchar(20) DEFAULT 'member',
	"joined_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "group_members_group_id_user_id_pk" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"group_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_user_id" uuid,
	"name" varchar(80) NOT NULL,
	"topic_tag" varchar(50),
	"is_public" boolean DEFAULT true,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
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
CREATE TABLE "notifications" (
	"notification_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"sender_user_id" uuid,
	"type" "event_type_enum" NOT NULL,
	"content" text NOT NULL,
	"related_item_id" text,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "post_audience" (
	"post_id" uuid,
	"friend_group_id" uuid,
	CONSTRAINT "post_audience_post_id_friend_group_id_pk" PRIMARY KEY("post_id","friend_group_id")
);
--> statement-breakpoint
CREATE TABLE "post_comments" (
	"comment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid,
	"author_user_id" uuid,
	"parent_comment_id" uuid,
	"body" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"edited_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "post_media" (
	"media_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid,
	"media_url" text NOT NULL,
	"media_type" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "post_reactions" (
	"reaction_id" bigserial PRIMARY KEY NOT NULL,
	"post_id" uuid,
	"user_id" uuid,
	"reaction_type" "reaction_type_enum" DEFAULT 'like',
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "post_reactions_post_id_user_id_unique" UNIQUE("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "posts" (
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
CREATE TABLE "profiles" (
	"profile_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"display_name" varchar(60),
	"bio" text,
	"avatar_url" text,
	"timezone" text DEFAULT 'UTC',
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "session_messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"session_id" uuid,
	"user_id" uuid,
	"message_type" varchar(20) DEFAULT 'text' NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shadow_session_participants" (
	"post_id" uuid,
	"user_id" uuid,
	"joined_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "shadow_session_participants_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "shadow_sessions" (
	"post_id" uuid PRIMARY KEY NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" text NOT NULL,
	"title" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "users" (
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
CREATE TABLE "users_metadata" (
	"metadata_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"last_emotions" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_metadata_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "chat_room_members" ADD CONSTRAINT "chat_room_members_chat_room_id_chat_rooms_chat_room_id_fk" FOREIGN KEY ("chat_room_id") REFERENCES "public"."chat_rooms"("chat_room_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_room_members" ADD CONSTRAINT "chat_room_members_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_events" ADD CONSTRAINT "feed_events_user_id_actor_users_user_id_fk" FOREIGN KEY ("user_id_actor") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_group_members" ADD CONSTRAINT "friend_group_members_friend_group_id_friend_groups_friend_group_id_fk" FOREIGN KEY ("friend_group_id") REFERENCES "public"."friend_groups"("friend_group_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_group_members" ADD CONSTRAINT "friend_group_members_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_groups" ADD CONSTRAINT "friend_groups_owner_user_id_users_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friends" ADD CONSTRAINT "friends_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friends" ADD CONSTRAINT "friends_friend_id_users_user_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("group_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_creator_user_id_users_user_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_room_id_chat_rooms_chat_room_id_fk" FOREIGN KEY ("chat_room_id") REFERENCES "public"."chat_rooms"("chat_room_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_id_users_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_sender_user_id_users_user_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_audience" ADD CONSTRAINT "post_audience_post_id_posts_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("post_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_audience" ADD CONSTRAINT "post_audience_friend_group_id_friend_groups_friend_group_id_fk" FOREIGN KEY ("friend_group_id") REFERENCES "public"."friend_groups"("friend_group_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_posts_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("post_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_author_user_id_users_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_parent_comment_id_post_comments_comment_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."post_comments"("comment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_post_id_posts_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("post_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_post_id_posts_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("post_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_user_id_users_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_messages" ADD CONSTRAINT "session_messages_session_id_shadow_sessions_post_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."shadow_sessions"("post_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_messages" ADD CONSTRAINT "session_messages_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shadow_session_participants" ADD CONSTRAINT "shadow_session_participants_post_id_shadow_sessions_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."shadow_sessions"("post_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shadow_session_participants" ADD CONSTRAINT "shadow_session_participants_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shadow_sessions" ADD CONSTRAINT "shadow_sessions_post_id_posts_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("post_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_metadata" ADD CONSTRAINT "users_metadata_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_chat_room_id_created_at_idx" ON "messages" USING btree ("chat_room_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "posts_author_user_id_created_at_idx" ON "posts" USING btree ("author_user_id","created_at");