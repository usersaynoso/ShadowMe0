import { z } from "zod";

// User Types
export interface User {
  user_id: string;
  email: string;
  user_type: string;
  user_points: number;
  user_level: number;
  is_active: boolean;
  created_at: string;
  profile?: Profile;
  isOnline?: boolean;
  lastEmotions?: number[];
  mutualFriendCount?: number;
}

export interface Profile {
  profile_id?: string;
  user_id?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  timezone?: string;
  last_seen_at?: string;
}

export interface InsertUser {
  email: string;
  password: string;
  display_name?: string;
}

// Friend/Connection Types
export interface Friend {
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted" | "blocked";
  created_at: string;
}

export interface FriendGroup {
  friend_group_id: string;
  owner_user_id: string;
  name: string;
  description?: string;
  created_at: string;
  memberCount?: number;
  members?: User[];
}

// Group (Space) Types
export interface Group {
  group_id: string;
  creator_user_id: string;
  name: string;
  topic_tag?: string;
  is_public: boolean;
  description?: string;
  created_at: string;
  memberCount?: number;
  previewMembers?: User[];
}

// Emotion Types
export interface Emotion {
  id: number;
  name: string;
  color: string;
}

// Post Types
export interface Post {
  post_id: string;
  author_user_id: string;
  parent_type: "profile" | "friend_group" | "group";
  parent_id: string;
  audience: "everyone" | "friends" | "just_me" | "friend_group" | "group";
  content?: string;
  emotion_ids: number[];
  created_at: string;
  updated_at?: string;
  author: User;
  reactions_count?: number;
  comments_count?: number;
  media?: Media[];
  audienceDetails?: {
    name: string;
    [key: string]: any;
  };
  shadow_session?: ShadowSession;
}

export interface Media {
  media_id: string;
  post_id: string;
  media_url: string;
  media_type: string;
  created_at: string;
}

// Comment Types
export interface Comment {
  comment_id: string;
  post_id: string;
  author_user_id: string;
  parent_comment_id?: string;
  body: string;
  created_at: string;
  edited_at?: string;
  author: User;
}

// Shadow Session Types
export interface ShadowSession {
  post_id: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  title: string;
  participants?: User[];
  creator?: User;
  post?: Post;
}

// Chat Types
export interface ChatRoom {
  chat_room_id: string;
  parent_type: "profile" | "friend_group" | "group";
  parent_id: string;
  title?: string;
  created_at: string;
  members?: User[];
}

export interface Message {
  message_id: string;
  chat_room_id: string;
  sender_id: string;
  recipient_id?: string;
  body: string;
  message_type: "text" | "emoji" | "file";
  created_at: string;
  edited_at?: string;
  sender?: User;
}

// Schema definitions
export const insertUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  display_name: z.string().min(2).max(60).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const updateProfileSchema = z.object({
  display_name: z.string().min(2).max(60).optional(),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().url().optional(),
  timezone: z.string().optional(),
});

export const createPostSchema = z.object({
  content: z.string().optional(),
  emotion_ids: z.array(z.number()).min(0),
  audience: z.enum(["everyone", "friends", "just_me", "friend_group", "group"]),
  friend_group_ids: z.array(z.string()).optional(),
  media: z.any().optional(),
  is_shadow_session: z.boolean().optional(),
  session_title: z.string().optional(),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  timezone: z.string().optional(),
});

export const createCommentSchema = z.object({
  body: z.string().min(1),
  parent_comment_id: z.string().optional(),
});

export const createFriendGroupSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
});

export const createGroupSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  topic_tag: z.string().max(50).optional(),
  is_public: z.boolean().default(true),
});
