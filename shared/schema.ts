import { pgTable, text, varchar, timestamp, boolean, integer, smallint, pgEnum, uuid, unique, foreignKey, numeric, jsonb, bigserial, bigint, primaryKey, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define ENUMs
export const userTypeEnum = pgEnum('user_type_enum', ['user', 'moderator', 'manager', 'admin']);
export const friendshipStatusEnum = pgEnum('friendship_status_enum', ['pending', 'accepted', 'blocked']);
export const parentTypeEnum = pgEnum('parent_type_enum', ['friend_group', 'group', 'profile']);
export const sessionPrivacyEnum = pgEnum('session_privacy_enum', ['one_to_one', 'friend_group', 'group', 'public']);
export const postParentEnum = pgEnum('post_parent_enum', ['profile', 'friend_group', 'group']);
export const audienceEnum = pgEnum('audience_enum', ['everyone', 'friends', 'just_me', 'friend_group', 'group']);
export const messageTypeEnum = pgEnum('message_type_enum', ['text', 'emoji', 'file']);
export const reactionTypeEnum = pgEnum('reaction_type_enum', [
  'sending_love',
  'thank_you',
  'take_care',
  'here_for_you',
  'made_my_day'
]);
export const eventTypeEnum = pgEnum('event_type_enum', ['friendship_accepted', 'message_sent', 'shadow_session_created', 'post_created', 'post_liked', 'post_commented', 'friendship_request', 'shadow_session_reminder', 'group_invite', 'friend_group_invite']);

// Define Tables

// Users
export const users = pgTable('users', {
  user_id: uuid('user_id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  user_type: userTypeEnum('user_type').default('user'),
  user_points: numeric('user_points', { precision: 12, scale: 2 }).default('0'),
  user_level: smallint('user_level').default(1),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow()
});

// Profiles
export const profiles = pgTable('profiles', {
  profile_id: uuid('profile_id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.user_id, { onDelete: 'cascade' }).unique(),
  display_name: varchar('display_name', { length: 60 }),
  bio: text('bio'),
  avatar_url: text('avatar_url'),
  timezone: text('timezone').default('UTC'),
  last_seen_at: timestamp('last_seen_at', { withTimezone: true })
});

// Friends (mutual friend connections)
export const friends = pgTable('friends', {
  user_id: uuid('user_id').references(() => users.user_id, { onDelete: 'cascade' }),
  friend_id: uuid('friend_id').references(() => users.user_id, { onDelete: 'cascade' }),
  status: friendshipStatusEnum('status').default('pending'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.user_id, table.friend_id] }),
    selfCheck: unique().on(table.user_id, table.friend_id)
  };
});

// Friend Groups (Circles)
export const friend_groups = pgTable('friend_groups', {
  friend_group_id: uuid('friend_group_id').primaryKey().defaultRandom(),
  owner_user_id: uuid('owner_user_id').references(() => users.user_id, { onDelete: 'set null' }),
  name: varchar('name', { length: 80 }).notNull(),
  description: text('description'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow()
});

// Friend Group Members
export const friend_group_members = pgTable('friend_group_members', {
  friend_group_id: uuid('friend_group_id').references(() => friend_groups.friend_group_id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').references(() => users.user_id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).default('member'),
  joined_at: timestamp('joined_at', { withTimezone: true }).defaultNow()
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.friend_group_id, table.user_id] })
  };
});

// Groups (larger communities / Spaces)
export const groups = pgTable('groups', {
  group_id: uuid('group_id').primaryKey().defaultRandom(),
  creator_user_id: uuid('creator_user_id').references(() => users.user_id, { onDelete: 'set null' }),
  name: varchar('name', { length: 80 }).notNull(),
  topic_tag: varchar('topic_tag', { length: 50 }),
  is_public: boolean('is_public').default(true),
  description: text('description'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow()
});

// Group Members
export const group_members = pgTable('group_members', {
  group_id: uuid('group_id').references(() => groups.group_id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').references(() => users.user_id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).default('member'),
  joined_at: timestamp('joined_at', { withTimezone: true }).defaultNow()
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.group_id, table.user_id] })
  };
});

// Chat Rooms
export const chat_rooms = pgTable('chat_rooms', {
  chat_room_id: uuid('chat_room_id').primaryKey().defaultRandom(),
  parent_type: parentTypeEnum('parent_type').notNull(),
  parent_id: uuid('parent_id').notNull(),
  title: varchar('title', { length: 80 }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow()
});

// Chat Room Members
export const chat_room_members = pgTable('chat_room_members', {
  chat_room_id: uuid('chat_room_id').references(() => chat_rooms.chat_room_id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').references(() => users.user_id, { onDelete: 'cascade' }),
  mute_until: timestamp('mute_until', { withTimezone: true }),
  joined_at: timestamp('joined_at', { withTimezone: true }).defaultNow()
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.chat_room_id, table.user_id] })
  };
});

// Messages
export const messages = pgTable('messages', {
  message_id: bigserial('message_id', { mode: 'number' }).primaryKey(),
  chat_room_id: uuid('chat_room_id').references(() => chat_rooms.chat_room_id),
  sender_id: uuid('sender_id').references(() => users.user_id),
  recipient_id: uuid('recipient_id').references(() => users.user_id), // for 1-on-1 DMs
  body: text('body'),
  message_type: messageTypeEnum('message_type').default('text'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  edited_at: timestamp('edited_at', { withTimezone: true })
}, (table) => {
  return {
    chatRoomCreatedAtIdx: index('messages_chat_room_id_created_at_idx').on(table.chat_room_id, table.created_at),
    // Consider adding indexes for sender_id and recipient_id if DMs are frequent
    // senderIdCreatedAtIdx: index('messages_sender_id_created_at_idx').on(table.sender_id, table.created_at),
    // recipientIdCreatedAtIdx: index('messages_recipient_id_created_at_idx').on(table.recipient_id, table.created_at),
  };
});

// Emotions (emotion palette)
export const emotions = pgTable('emotions', {
  emotion_id: smallint('emotion_id').primaryKey(),
  emotion_name: varchar('emotion_name', { length: 30 }).notNull().unique(),
  emotion_color: varchar('emotion_color', { length: 7 }).notNull()
});

// Posts
export const posts = pgTable('posts', {
  post_id: uuid('post_id').primaryKey().defaultRandom(),
  author_user_id: uuid('author_user_id').references(() => users.user_id),
  parent_type: postParentEnum('parent_type').notNull(),
  parent_id: uuid('parent_id').notNull(),
  audience: audienceEnum('audience').notNull(),
  content: text('content'),
  emotion_ids: smallint('emotion_ids').array().notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true })
}, (table) => {
  return {
    authorCreatedAtIdx: index('posts_author_user_id_created_at_idx').on(table.author_user_id, table.created_at),
  };
});

// Post Audience (for friend_group targeting)
export const post_audience = pgTable('post_audience', {
  post_id: uuid('post_id').references(() => posts.post_id, { onDelete: 'cascade' }),
  friend_group_id: uuid('friend_group_id').references(() => friend_groups.friend_group_id, { onDelete: 'cascade' })
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.post_id, table.friend_group_id] })
  };
});

// Post Media
export const post_media = pgTable('post_media', {
  media_id: uuid('media_id').primaryKey().defaultRandom(),
  post_id: uuid('post_id').references(() => posts.post_id, { onDelete: 'cascade' }),
  media_url: text('media_url').notNull(),
  media_type: varchar('media_type', { length: 20 }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow()
});

// Post Reactions
export const post_reactions = pgTable('post_reactions', {
  reaction_id: bigserial('reaction_id', { mode: 'number' }).primaryKey(),
  post_id: uuid('post_id').references(() => posts.post_id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').references(() => users.user_id),
  reaction_type: reactionTypeEnum('reaction_type').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => {
  return {
    unq: unique().on(table.post_id, table.user_id)
  };
});

// Post Comments
export const post_comments = pgTable('post_comments', {
  comment_id: uuid('comment_id').primaryKey().defaultRandom(),
  post_id: uuid('post_id').references(() => posts.post_id, { onDelete: 'cascade' }),
  author_user_id: uuid('author_user_id').references(() => users.user_id),
  parent_comment_id: uuid('parent_comment_id').references((): any => post_comments.comment_id),
  body: text('body'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  edited_at: timestamp('edited_at', { withTimezone: true })
});

// Shadow Sessions (scheduled posts)
export const shadow_sessions = pgTable('shadow_sessions', {
  post_id: uuid('post_id').primaryKey().references(() => posts.post_id, { onDelete: 'cascade' }),
  starts_at: timestamp('starts_at', { withTimezone: true }).notNull(),
  ends_at: timestamp('ends_at', { withTimezone: true }).notNull(),
  timezone: text('timezone').notNull(),
  title: varchar('title', { length: 100 })
});

// Shadow Session Participants
export const shadow_session_participants = pgTable('shadow_session_participants', {
  post_id: uuid('post_id').references(() => shadow_sessions.post_id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').references(() => users.user_id),
  joined_at: timestamp('joined_at', { withTimezone: true }).defaultNow()
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.post_id, table.user_id] })
  };
});

// Shadow Session Messages
export const session_messages = pgTable('session_messages', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  session_id: uuid('session_id').references(() => shadow_sessions.post_id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').references(() => users.user_id, { onDelete: 'cascade' }),
  message_type: varchar('message_type', { length: 20 }).default('text').notNull(),
  content: text('content').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow()
});

// Feed Events
export const feed_events = pgTable('feed_events', {
  event_id: bigserial('event_id', { mode: 'number' }).primaryKey(),
  user_id_actor: uuid('user_id_actor').references(() => users.user_id),
  event_type: eventTypeEnum('event_type'),
  payload: jsonb('payload'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow()
});

// Notifications
export const notifications = pgTable('notifications', {
  notification_id: uuid('notification_id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.user_id, { onDelete: 'cascade' }),
  sender_user_id: uuid('sender_user_id').references(() => users.user_id, { onDelete: 'set null' }),
  type: eventTypeEnum('type').notNull(),
  content: text('content').notNull(),
  related_item_id: text('related_item_id'),
  is_read: boolean('is_read').default(false),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => {
  return {
    userCreatedAtIdx: index('notifications_user_id_created_at_idx').on(table.user_id, table.created_at),
  };
});

// Users Metadata (for additional user data storage)
export const users_metadata = pgTable('users_metadata', {
  metadata_id: uuid('metadata_id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.user_id, { onDelete: 'cascade' }).unique(),
  last_emotions: jsonb('last_emotions').$type<number[]>(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow()
});

// Schema Validation with Zod
export const insertUserSchema = createInsertSchema(users).omit({
  user_id: true,
  created_at: true,
  user_points: true,
  user_level: true,
  is_active: true,
  user_type: true
});

export const insertProfileSchema = createInsertSchema(profiles).omit({
  profile_id: true,
  last_seen_at: true
});

export const insertFriendGroupSchema = createInsertSchema(friend_groups).omit({
  friend_group_id: true,
  created_at: true
});

export const insertGroupSchema = createInsertSchema(groups).omit({
  group_id: true,
  created_at: true
});

export const insertPostSchema = createInsertSchema(posts).omit({
  post_id: true,
  created_at: true,
  updated_at: true
});

export const insertCommentSchema = createInsertSchema(post_comments).omit({
  comment_id: true,
  created_at: true,
  edited_at: true
});

export const insertShadowSessionSchema = createInsertSchema(shadow_sessions);

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  notification_id: true,
  created_at: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;

export type FriendGroup = typeof friend_groups.$inferSelect;
export type InsertFriendGroup = z.infer<typeof insertFriendGroupSchema>;

export type Group = typeof groups.$inferSelect;
export type InsertGroup = z.infer<typeof insertGroupSchema>;

export type Post = typeof posts.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;

export type Comment = typeof post_comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;

export type ShadowSession = typeof shadow_sessions.$inferSelect;
export type InsertShadowSession = z.infer<typeof insertShadowSessionSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
