-- Database backup from lively-flower-18820603
-- Generated on 2025-05-07T20:15:02.620Z

-- Drop existing tables (in reverse dependency order)
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "shadow_sessions" CASCADE;
DROP TABLE IF EXISTS "shadow_session_participants" CASCADE;
DROP TABLE IF EXISTS "session" CASCADE;
DROP TABLE IF EXISTS "profiles" CASCADE;
DROP TABLE IF EXISTS "posts" CASCADE;
DROP TABLE IF EXISTS "post_reactions" CASCADE;
DROP TABLE IF EXISTS "post_media" CASCADE;
DROP TABLE IF EXISTS "post_comments" CASCADE;
DROP TABLE IF EXISTS "post_audience" CASCADE;
DROP TABLE IF EXISTS "messages" CASCADE;
DROP TABLE IF EXISTS "groups" CASCADE;
DROP TABLE IF EXISTS "group_members" CASCADE;
DROP TABLE IF EXISTS "friends" CASCADE;
DROP TABLE IF EXISTS "friend_groups" CASCADE;
DROP TABLE IF EXISTS "friend_group_members" CASCADE;
DROP TABLE IF EXISTS "feed_events" CASCADE;
DROP TABLE IF EXISTS "emotions" CASCADE;
DROP TABLE IF EXISTS "chat_rooms" CASCADE;
DROP TABLE IF EXISTS "chat_room_members" CASCADE;

-- Table structure for chat_room_members
CREATE TABLE "chat_room_members" (
  "chat_room_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "mute_until" timestamp with time zone,
  "joined_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("chat_room_id", "user_id")
);

-- Table structure for chat_rooms
CREATE TABLE "chat_rooms" (
  "chat_room_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "parent_type" USER-DEFINED NOT NULL,
  "parent_id" uuid NOT NULL,
  "title" character varying(80),
  "created_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("chat_room_id")
);

-- Table structure for emotions
CREATE TABLE "emotions" (
  "emotion_id" smallint NOT NULL,
  "emotion_name" character varying(30) NOT NULL,
  "emotion_color" character varying(7) NOT NULL,
  PRIMARY KEY ("emotion_id")
);

-- Data for table emotions
INSERT INTO "emotions" ("emotion_id", "emotion_name", "emotion_color") VALUES (1, 'Happy', '#FFC107');
INSERT INTO "emotions" ("emotion_id", "emotion_name", "emotion_color") VALUES (2, 'Calm', '#4CAF50');
INSERT INTO "emotions" ("emotion_id", "emotion_name", "emotion_color") VALUES (3, 'Sad', '#2196F3');
INSERT INTO "emotions" ("emotion_id", "emotion_name", "emotion_color") VALUES (4, 'Anxious', '#E91E63');
INSERT INTO "emotions" ("emotion_id", "emotion_name", "emotion_color") VALUES (5, 'Excited', '#FF5722');
INSERT INTO "emotions" ("emotion_id", "emotion_name", "emotion_color") VALUES (6, 'Thoughtful', '#9C27B0');
INSERT INTO "emotions" ("emotion_id", "emotion_name", "emotion_color") VALUES (7, 'Tired', '#78909C');
INSERT INTO "emotions" ("emotion_id", "emotion_name", "emotion_color") VALUES (8, 'Grateful', '#8BC34A');
INSERT INTO "emotions" ("emotion_id", "emotion_name", "emotion_color") VALUES (9, 'Frustrated', '#F44336');
INSERT INTO "emotions" ("emotion_id", "emotion_name", "emotion_color") VALUES (10, 'Hopeful', '#3F51B5');
INSERT INTO "emotions" ("emotion_id", "emotion_name", "emotion_color") VALUES (11, 'Peaceful', '#00BCD4');
INSERT INTO "emotions" ("emotion_id", "emotion_name", "emotion_color") VALUES (12, 'Confused', '#FF9800');

-- Table structure for feed_events
CREATE TABLE "feed_events" (
  "event_id" bigint DEFAULT nextval('feed_events_event_id_seq'::regclass) NOT NULL,
  "user_id_actor" uuid,
  "event_type" USER-DEFINED,
  "payload" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("event_id")
);

-- Table structure for friend_group_members
CREATE TABLE "friend_group_members" (
  "friend_group_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" character varying(20) DEFAULT 'member'::character varying,
  "joined_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("friend_group_id", "user_id")
);

-- Table structure for friend_groups
CREATE TABLE "friend_groups" (
  "friend_group_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid,
  "name" character varying(80) NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("friend_group_id")
);

-- Table structure for friends
CREATE TABLE "friends" (
  "user_id" uuid NOT NULL,
  "friend_id" uuid NOT NULL,
  "status" USER-DEFINED DEFAULT 'pending'::friendship_status_enum,
  "created_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("user_id", "friend_id")
);

-- Table structure for group_members
CREATE TABLE "group_members" (
  "group_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" character varying(20) DEFAULT 'member'::character varying,
  "joined_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("group_id", "user_id")
);

-- Table structure for groups
CREATE TABLE "groups" (
  "group_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "creator_user_id" uuid,
  "name" character varying(80) NOT NULL,
  "topic_tag" character varying(50),
  "is_public" boolean DEFAULT true,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("group_id")
);

-- Table structure for messages
CREATE TABLE "messages" (
  "message_id" bigint DEFAULT nextval('messages_message_id_seq'::regclass) NOT NULL,
  "chat_room_id" uuid,
  "sender_id" uuid,
  "recipient_id" uuid,
  "body" text,
  "message_type" USER-DEFINED DEFAULT 'text'::message_type_enum,
  "created_at" timestamp with time zone DEFAULT now(),
  "edited_at" timestamp with time zone,
  PRIMARY KEY ("message_id")
);

-- Table structure for post_audience
CREATE TABLE "post_audience" (
  "post_id" uuid NOT NULL,
  "friend_group_id" uuid NOT NULL,
  PRIMARY KEY ("post_id", "friend_group_id")
);

-- Table structure for post_comments
CREATE TABLE "post_comments" (
  "comment_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "post_id" uuid,
  "author_user_id" uuid,
  "parent_comment_id" uuid,
  "body" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "edited_at" timestamp with time zone,
  PRIMARY KEY ("comment_id")
);

-- Table structure for post_media
CREATE TABLE "post_media" (
  "media_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "post_id" uuid,
  "media_url" text NOT NULL,
  "media_type" character varying(20) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("media_id")
);

-- Table structure for post_reactions
CREATE TABLE "post_reactions" (
  "reaction_id" bigint DEFAULT nextval('post_reactions_reaction_id_seq'::regclass) NOT NULL,
  "post_id" uuid,
  "user_id" uuid,
  "reaction_type" USER-DEFINED DEFAULT 'like'::reaction_type_enum,
  "created_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("reaction_id")
);

-- Table structure for posts
CREATE TABLE "posts" (
  "post_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "author_user_id" uuid,
  "parent_type" USER-DEFINED NOT NULL,
  "parent_id" uuid NOT NULL,
  "audience" USER-DEFINED NOT NULL,
  "content" text,
  "emotion_ids" ARRAY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone,
  PRIMARY KEY ("post_id")
);

-- Table structure for profiles
CREATE TABLE "profiles" (
  "profile_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "display_name" character varying(60),
  "bio" text,
  "avatar_url" text,
  "timezone" text DEFAULT 'UTC'::text,
  "last_seen_at" timestamp with time zone,
  PRIMARY KEY ("profile_id")
);

-- Data for table profiles
INSERT INTO "profiles" ("profile_id", "user_id", "display_name", "bio", "avatar_url", "timezone", "last_seen_at") VALUES ('8c424d66-b116-432e-8a2e-103e5a831588', 'd478dcc3-15d2-4a84-b8df-58c9abe78705', 'chris', NULL, NULL, 'UTC', NULL);

-- Table structure for session
CREATE TABLE "session" (
  "sid" character varying NOT NULL,
  "sess" json NOT NULL,
  "expire" timestamp without time zone NOT NULL,
  PRIMARY KEY ("sid")
);

-- Data for table session
INSERT INTO "session" ("sid", "sess", "expire") VALUES ('No4vCB9puqExmu4nDnn8lUXtTnoVgSLa', '{"cookie":{"originalMaxAge":604800000,"expires":"2025-05-14T18:50:59.278Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"d478dcc3-15d2-4a84-b8df-58c9abe78705"}}', '2025-05-14T18:51:00.000Z');
INSERT INTO "session" ("sid", "sess", "expire") VALUES ('j1y3QwOdeHKC-d6r02X6b267Zat6Zzm7', '{"cookie":{"originalMaxAge":604800000,"expires":"2025-05-14T18:51:13.249Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"d478dcc3-15d2-4a84-b8df-58c9abe78705"}}', '2025-05-14T18:51:14.000Z');
INSERT INTO "session" ("sid", "sess", "expire") VALUES ('AUMzSElAyNnTAu1ROdErzlZWM8sduhJ1', '{"cookie":{"originalMaxAge":604800000,"expires":"2025-05-14T18:51:37.639Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"d478dcc3-15d2-4a84-b8df-58c9abe78705"}}', '2025-05-14T18:51:38.000Z');
INSERT INTO "session" ("sid", "sess", "expire") VALUES ('RTJZfAtVFuQqGqS2xEy13NRvgqHcXbhT', '{"cookie":{"originalMaxAge":604800000,"expires":"2025-05-14T18:51:53.479Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"d478dcc3-15d2-4a84-b8df-58c9abe78705"}}', '2025-05-14T18:51:54.000Z');
INSERT INTO "session" ("sid", "sess", "expire") VALUES ('W4q_Mc62w4vhK8evdisgJW2eIvAFBmh6', '{"cookie":{"originalMaxAge":604800000,"expires":"2025-05-14T18:56:51.186Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"d478dcc3-15d2-4a84-b8df-58c9abe78705"}}', '2025-05-14T18:56:52.000Z');
INSERT INTO "session" ("sid", "sess", "expire") VALUES ('4SRsfvxnrB559pPDyxmRSYZHgD5z1cBR', '{"cookie":{"originalMaxAge":604800000,"expires":"2025-05-14T19:01:06.292Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"d478dcc3-15d2-4a84-b8df-58c9abe78705"}}', '2025-05-14T19:01:07.000Z');
INSERT INTO "session" ("sid", "sess", "expire") VALUES ('CUV5VLuGhsM_hMM4NWOguVtZ-cXzCg7h', '{"cookie":{"originalMaxAge":604800000,"expires":"2025-05-14T19:51:21.631Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"d478dcc3-15d2-4a84-b8df-58c9abe78705"}}', '2025-05-14T19:52:31.000Z');
INSERT INTO "session" ("sid", "sess", "expire") VALUES ('ButOoXCPQS-o7oKRhvz8gb_C0GYDzdMv', '{"cookie":{"originalMaxAge":604800000,"expires":"2025-05-14T19:39:26.522Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":"d478dcc3-15d2-4a84-b8df-58c9abe78705"}}', '2025-05-14T19:39:55.000Z');

-- Table structure for shadow_session_participants
CREATE TABLE "shadow_session_participants" (
  "post_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "joined_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("post_id", "user_id")
);

-- Table structure for shadow_sessions
CREATE TABLE "shadow_sessions" (
  "post_id" uuid NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "timezone" text NOT NULL,
  "title" character varying(100),
  PRIMARY KEY ("post_id")
);

-- Table structure for users
CREATE TABLE "users" (
  "user_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "password" text NOT NULL,
  "user_type" USER-DEFINED DEFAULT 'user'::user_type_enum,
  "user_points" numeric DEFAULT '0'::numeric,
  "user_level" smallint DEFAULT 1,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("user_id")
);

-- Data for table users
INSERT INTO "users" ("user_id", "email", "password", "user_type", "user_points", "user_level", "is_active", "created_at") VALUES ('d478dcc3-15d2-4a84-b8df-58c9abe78705', 'chris@taylor-guest.co.uk', '677ef3a0f0d75a8fdf9f9839e6629be21ce97e394fa83a62336a379a156a4e866603a00645270ba6e02ef0d141b20a203479036f13c8b2ac73d1b4b06a42e9be.67113615db1388fce611698f2ed6bbe8', 'user', '0.00', 1, true, '2025-05-07T18:50:58.562Z');

