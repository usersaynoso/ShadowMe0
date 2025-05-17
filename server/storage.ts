import { db, supabase } from "./db";
import { eq, and, ne, or, inArray, gte, lte, not, like, desc, sql, count } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { users, profiles, friends, friend_groups, friend_group_members, 
         groups, group_members, emotions, posts, post_audience, post_media, 
         post_reactions, post_comments, shadow_sessions, shadow_session_participants,
         chat_rooms, chat_room_members, messages, session_messages,
         notifications, InsertNotification, Notification, users_metadata } from "@shared/schema";
import { z } from "zod";
import connectPg from "connect-pg-simple";
import session from "express-session";
import pg from 'pg';
import dotenv from "dotenv";
import express from "express";
import pgSession from "connect-pg-simple";
import { drizzle } from "drizzle-orm/neon-serverless";
import { neon, neonConfig } from "@neondatabase/serverless";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  getUser(id: string): Promise<any>;
  getUserByEmail(email: string): Promise<any>;
  createUser(data: any): Promise<any>;
  
  // Profile methods
  getProfile(userId: string): Promise<any>;
  updateProfile(userId: string, data: any): Promise<any>;
  
  // Emotion methods
  getEmotions(): Promise<any[]>;
  
  // Post methods
  getPosts(userId?: string, emotionFilter?: number[]): Promise<any[]>;
  getPostById(postId: string, requesterId?: string): Promise<any>;
  createPost(data: any): Promise<any>;
  getPostsByUser(userId: string, requesterId?: string): Promise<any[]>;
  getPostReactionsCount(postId: string): Promise<number>;
  deletePost(postId: string, userId: string): Promise<void>;
  
  // Comment methods
  getPostComments(postId: string): Promise<any[]>;
  createComment(data: any): Promise<any>;
  getCommentById(commentId: string): Promise<any>;
  
  // Reaction methods
  getUserReactionToPost(postId: string, userId: string): Promise<any>;
  createReaction(data: any): Promise<any>;
  deleteReaction(reactionId: string, userId: string): Promise<void>;
  
  // Friend (Connection) methods
  getUserConnections(userId: string): Promise<any[]>;
  getPendingConnectionRequests(userId: string): Promise<any[]>;
  getConnectionSuggestions(userId: string): Promise<any[]>;
  getOnlineConnections(userId: string): Promise<any[]>;
  getConnectionStatus(userId: string, targetUserId: string): Promise<string>;
  sendFriendRequest(userId: string, friendId: string): Promise<void>;
  acceptFriendRequest(userId: string, friendId: string): Promise<void>;
  rejectFriendRequest(userId: string, friendId: string): Promise<void>;
  removeFriend(userId: string, friendId: string): Promise<void>;
  
  // Friend Group (Circle) methods
  getUserFriendGroups(userId: string): Promise<any[]>;
  createFriendGroup(data: any): Promise<any>;
  canAccessFriendGroup(groupId: string, userId: string): Promise<boolean>;
  isFriendGroupOwner(groupId: string, userId: string): Promise<boolean>;
  getFriendGroupMembers(groupId: string): Promise<any[]>;
  areUsersConnected(userId1: string, userId2: string): Promise<boolean>;
  addFriendGroupMember(groupId: string, userId: string): Promise<void>;
  removeFriendGroupMember(groupId: string, userId: string): Promise<void>;
  deleteFriendGroup(groupId: string): Promise<void>;
  
  // Group (Space) methods
  getGroups(options?: any): Promise<any[]>;
  getPopularGroups(): Promise<any[]>;
  getUserGroups(userId: string): Promise<any[]>;
  createGroup(data: any): Promise<any>;
  joinGroup(groupId: string, userId: string, role?: string): Promise<void>;
  leaveGroup(groupId: string, userId: string): Promise<void>;
  
  // Shadow Session methods
  getUpcomingShadowSessions(): Promise<any[]>;
  getActiveShadowSessions(): Promise<any[]>;
  getUserJoinedShadowSessions(userId: string): Promise<any[]>;
  getPastShadowSessions(): Promise<any[]>;
  createShadowSession(data: any): Promise<any>;
  joinShadowSession(sessionId: string, userId: string): Promise<void>;
  getShadowSessionParticipants(sessionId: string): Promise<any[]>;
  getShadowSession(postId: string): Promise<any>;
  
  // Chat methods
  getChatRooms(userId: string): Promise<any[]>;
  getChatRoomMembers(roomId: string): Promise<any[]>;
  createChatMessage(data: any): Promise<any>;
  
  // Online status
  updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void>;
  
  // Notification methods
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: string, limit?: number, offset?: number): Promise<Notification[]>;
  markNotificationAsRead(notificationId: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  deleteNotification(notificationId: string): Promise<void>;
  
  // Media methods
  uploadPostMedia(filePath: string, fileName: string, postId: string): Promise<string>;
  getPostMedia(postId: string): Promise<any[]>;
  deleteMedia(mediaId: string): Promise<void>;
  
  // Session store
  sessionStore: session.Store;

  updatePost(postId: string, userId: string, data: any): Promise<any>;

  // Add new method
  updateUserLastEmotions(userId: string, emotionIds: number[]): Promise<void>;

  // NEW: Get a user by their ID
  getUserById(userId: string): Promise<any | null>;

  // Add to the interface definition in the proper location
  getGroupById(groupId: string): Promise<any>;
  getGroupCategories(): Promise<any[]>;

  // Add to the interface definition
  getGroupMembers(groupId: string): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    // Set up session store
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required");
    }
    
    // Create a PostgreSQL pool for the session store
    const pgPool = new pg.Pool({ 
      connectionString: process.env.DATABASE_URL 
    });
    
    this.sessionStore = new PostgresSessionStore({
      pool: pgPool,
      createTableIfMissing: true
    });
    
    console.log('Session store connected to Supabase PostgreSQL database');
  }
  
  // User methods
  async getUser(id: string): Promise<any> {
    // Get user and profile
    const [user] = await db.select()
      .from(users)
      .leftJoin(profiles, eq(users.user_id, profiles.user_id))
      .leftJoin(users_metadata, eq(users.user_id, users_metadata.user_id))
      .where(eq(users.user_id, id));
    
    if (!user) return undefined;
    
    // Merge user, profile, and metadata into one object
    return {
      ...user.users,
      profile: user.profiles,
      lastEmotions: user.users_metadata?.last_emotions || []
    };
  }
  
  async getUserByEmail(email: string): Promise<any> {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.email, email));
    
    return user;
  }
  
  async createUser(data: any): Promise<any> {
    // Insert user first
    const [newUser] = await db.insert(users)
      .values({
        email: data.email,
        password: data.password,
      })
      .returning();
    
    // Then create profile if display name is provided
    if (data.display_name) {
      await db.insert(profiles)
        .values({
          user_id: newUser.user_id,
          display_name: data.display_name
        });
    }
    
    // Return user with profile
    return this.getUser(newUser.user_id);
  }
  
  // Profile methods
  async getProfile(userId: string): Promise<any> {
    const [profile] = await db.select()
      .from(profiles)
      .where(eq(profiles.user_id, userId));
    
    return profile;
  }
  
  async updateProfile(userId: string, data: any): Promise<any> {
    // Check if profile exists
    const existingProfile = await this.getProfile(userId);
    
    if (existingProfile) {
      // Update existing profile
      const [updatedProfile] = await db.update(profiles)
        .set(data)
        .where(eq(profiles.user_id, userId))
        .returning();
      
      return updatedProfile;
    } else {
      // Create new profile
      const [newProfile] = await db.insert(profiles)
        .values({
          user_id: userId,
          ...data
        })
        .returning();
      
      return newProfile;
    }
  }
  
  // Emotion methods
  async getEmotions(): Promise<any[]> {
    return db.select().from(emotions);
  }
  
  // Post methods
  async getPosts(userId?: string, emotionFilter?: number[]): Promise<any[]> {
    // Get friend IDs if userId is provided
    let friendIds: string[] = [];
    if (userId) {
      const friendsData = await db.select({ friend_id: friends.friend_id })
        .from(friends)
        .where(and(eq(friends.user_id, userId), eq(friends.status, 'accepted')));
      friendIds = friendsData.map((f: { friend_id: string | null }) => f.friend_id).filter((id: string | null): id is string => !!id);
    }

    // Build privacy filter
    let privacyCondition;
    if (userId) {
      // EXISTS subquery for friend_group audience (use sql.raw for Drizzle compatibility)
      const friendGroupExists = sql.raw(`EXISTS (
        SELECT 1 FROM post_audience
        INNER JOIN friend_group_members ON post_audience.friend_group_id = friend_group_members.friend_group_id
        WHERE post_audience.post_id = posts.post_id
          AND friend_group_members.user_id = '${userId}'
      )`);
      privacyCondition = or(
        eq(posts.audience, 'everyone'),
        and(eq(posts.audience, 'friends'), inArray(posts.author_user_id, [userId, ...friendIds])),
        eq(posts.author_user_id, userId),
        and(eq(posts.audience, 'friend_group'), friendGroupExists)
      );
    } else {
      privacyCondition = eq(posts.audience, 'everyone');
    }

    // Build emotion filter
    let emotionCondition = undefined;
    if (emotionFilter && emotionFilter.length > 0) {
      emotionCondition = sql`${posts.emotion_ids} && ARRAY[${emotionFilter.join(',')}]::int2[]`;
    }

    // Combine conditions
    let whereCondition = privacyCondition;
    if (emotionCondition) {
      whereCondition = and(privacyCondition, emotionCondition);
    }

    // Build query with a single .where()
    let query = db.select({
        post: posts,
        author: {
          ...users,
          profile: profiles
        },
        media: sql<any[]>`
          (SELECT json_agg(pm.*) 
           FROM ${post_media} pm 
           WHERE pm.post_id = ${posts.post_id})
        `,
        reactions_count: sql<number>`
          (SELECT COUNT(*) 
           FROM ${post_reactions} pr 
           WHERE pr.post_id = ${posts.post_id})
        `,
        shadow_session: sql<any>`
          (SELECT json_build_object(
            'post_id', ss.post_id,
            'starts_at', ss.starts_at,
            'ends_at', ss.ends_at
          )
          FROM ${shadow_sessions} ss
          WHERE ss.post_id = ${posts.post_id})
        `
      })
      .from(posts)
      .innerJoin(users, eq(posts.author_user_id, users.user_id))
      .leftJoin(profiles, eq(users.user_id, profiles.user_id))
      .leftJoin(post_media, eq(posts.post_id, post_media.post_id))
      .where(whereCondition)
      .orderBy(desc(posts.created_at));

    const postsData = await query;

    // Process the results to structure them correctly
    return postsData.map((post: any) => ({
      ...post.post,
      author: {
        ...post.author,
        profile: post.author.profile
      },
      media: post.media || [],
      reactions_count: Number(post.reactions_count),
      shadow_session: post.shadow_session
    }));
  }
  
  async getPostById(postId: string, requesterId?: string): Promise<any> {
    try {
      // First get the post
      const [post] = await db.select()
        .from(posts)
        .where(eq(posts.post_id, postId));
      
      // If no post found, return null
      if (!post) {
        console.log(`Post ${postId} not found`);
        return null;
      }
      
      // Privacy check: If the post is "just_me" and requester is not the author, return null
      if (post.audience === 'just_me' && (!requesterId || requesterId !== post.author_user_id)) {
        console.log(`Privacy denied: Post ${postId} is private (just_me) and user ${requesterId} is not the author ${post.author_user_id}`);
        return null;
      }
      
      console.log(`Returning post ${postId} to user ${requesterId || 'unknown'}`);
      return post;
    } catch (error) {
      console.error(`Error in getPostById for post ${postId}:`, error);
      throw error;
    }
  }
  
  async createPost(data: any): Promise<any> {
    const { friend_group_ids, media, ...postData } = data;
    
    // Insert post first
    const [newPost] = await db.insert(posts)
      .values(postData)
      .returning();
    
    // If audience is friend_group, add entries to post_audience table
    if (data.audience === 'friend_group' && friend_group_ids && friend_group_ids.length > 0) {
      const audienceValues = friend_group_ids.map(id => ({
        post_id: newPost.post_id,
        friend_group_id: id
      }));
      
      await db.insert(post_audience)
        .values(audienceValues);
    }
    
    // If media is provided, add to post_media table
    if (media && media.length > 0) {
      const mediaValues = media.map(m => ({
        post_id: newPost.post_id,
        media_url: m.media_url,
        media_type: m.media_type
      }));
      
      await db.insert(post_media)
        .values(mediaValues);
    }
    
    // Return post with author info
    return this.getPostById(newPost.post_id);
  }
  
  // Comment methods
  async getPostComments(postId: string): Promise<any[]> {
    const commentsData = await db.select({
        comment: post_comments,
        author: {
          ...users,
          profile: profiles
        }
      })
      .from(post_comments)
      .innerJoin(users, eq(post_comments.author_user_id, users.user_id))
      .leftJoin(profiles, eq(users.user_id, profiles.user_id))
      .where(eq(post_comments.post_id, postId))
      .orderBy(post_comments.created_at);
    
    // Process the results to structure them correctly
    return commentsData.map(comment => ({
      ...comment.comment,
      author: {
        ...comment.author,
        profile: comment.author.profile
      }
    }));
  }
  
  async createComment(data: any): Promise<any> {
    const [newComment] = await db.insert(post_comments)
      .values(data)
      .returning();
    
    // Get comment with author info
    const [commentWithAuthor] = await db.select({
        comment: post_comments,
        author: {
          ...users,
          profile: profiles
        }
      })
      .from(post_comments)
      .innerJoin(users, eq(post_comments.author_user_id, users.user_id))
      .leftJoin(profiles, eq(users.user_id, profiles.user_id))
      .where(eq(post_comments.comment_id, newComment.comment_id));
    
    // Return structured comment
    return {
      ...commentWithAuthor.comment,
      author: {
        ...commentWithAuthor.author,
        profile: commentWithAuthor.author.profile
      }
    };
  }
  
  async getCommentById(commentId: string): Promise<any> {
    const [commentWithAuthor] = await db.select({
        comment: post_comments,
        author: {
          ...users,
          profile: profiles
        }
      })
      .from(post_comments)
      .innerJoin(users, eq(post_comments.author_user_id, users.user_id))
      .leftJoin(profiles, eq(users.user_id, profiles.user_id))
      .where(eq(post_comments.comment_id, commentId));
    
    if (!commentWithAuthor) return null;
    
    // Return structured comment
    return {
      ...commentWithAuthor.comment,
      author: {
        ...commentWithAuthor.author,
        profile: commentWithAuthor.author.profile
      }
    };
  }
  
  // Reaction methods
  async getUserReactionToPost(postId: string, userId: string): Promise<any> {
    const [reaction] = await db.select()
      .from(post_reactions)
      .where(
        and(
          eq(post_reactions.post_id, postId),
          eq(post_reactions.user_id, userId)
        )
      );
    
    return reaction;
  }
  
  async createReaction(data: any): Promise<any> {
    // Check if reaction already exists
    const existingReaction = await this.getUserReactionToPost(data.post_id, data.user_id);
    
    if (existingReaction) {
      // Update existing reaction
      const [updatedReaction] = await db.update(post_reactions)
        .set({ reaction_type: data.reaction_type })
        .where(eq(post_reactions.reaction_id, existingReaction.reaction_id))
        .returning();
      
      return updatedReaction;
    } else {
      // Create new reaction
      const [newReaction] = await db.insert(post_reactions)
        .values(data)
        .returning();
      
      return newReaction;
    }
  }
  
  async deleteReaction(reactionId: string, userId: string): Promise<void> {
    await db.delete(post_reactions)
      .where(
        and(
          eq(post_reactions.reaction_id, reactionId),
          eq(post_reactions.user_id, userId)
        )
      );
  }
  
  // Friend (Connection) methods
  async getUserConnections(userId: string): Promise<any[]> {
    // First get all accepted friends
    const friendsData = await db.select({
        friend: users,
        profile: profiles
      })
      .from(friends)
      .innerJoin(users, eq(friends.friend_id, users.user_id))
      .leftJoin(profiles, eq(users.user_id, profiles.user_id))
      .where(
        and(
          eq(friends.user_id, userId),
          eq(friends.status, 'accepted')
        )
      );
    
    // Process the results to structure them correctly
    return friendsData.map(friend => ({
      ...friend.friend,
      profile: friend.profile
    }));
  }
  
  async getPendingConnectionRequests(userId: string): Promise<any[]> {
    // Get all pending friend requests sent to this user
    const requestsData = await db.select({
        requester: users,
        profile: profiles
      })
      .from(friends)
      .innerJoin(users, eq(friends.user_id, users.user_id))
      .leftJoin(profiles, eq(users.user_id, profiles.user_id))
      .where(
        and(
          eq(friends.friend_id, userId),
          eq(friends.status, 'pending')
        )
      );
    
    // Process the results to structure them correctly
    return requestsData.map(request => ({
      ...request.requester,
      profile: request.profile
    }));
  }
  
  async getConnectionSuggestions(userId: string): Promise<any[]> {
    // For simplicity, suggest users that are not already friends or have pending requests
    // In a real app, this would use more sophisticated criteria
    
    // Get existing connections and requests
    const existingConnections = await db.select({ friendId: friends.friend_id })
      .from(friends)
      .where(eq(friends.user_id, userId));
    
    const pendingRequests = await db.select({ userId: friends.user_id })
      .from(friends)
      .where(
        and(
          eq(friends.friend_id, userId),
          eq(friends.status, 'pending')
        )
      );
    
    // Get IDs to exclude
    const excludeIds = [
      userId, 
      ...existingConnections.map(c => c.friendId),
      ...pendingRequests.map(p => p.userId)
    ];
    
    // Get suggestions
    const suggestionsData = await db.select({
        user: users,
        profile: profiles
      })
      .from(users)
      .leftJoin(profiles, eq(users.user_id, profiles.user_id))
      .where(not(inArray(users.user_id, excludeIds)))
      .limit(10);
    
    // Process the results to structure them correctly
    return suggestionsData.map(suggestion => ({
      ...suggestion.user,
      profile: suggestion.profile,
      mutualFriendCount: Math.floor(Math.random() * 10) // Mock data for now, in real app would calculate this
    }));
  }
  
  async getOnlineConnections(userId: string): Promise<any[]> {
    // Get all accepted friends that are marked as online
    const onlineConnectionsData = await db.select({
        friend: users,
        profile: profiles
      })
      .from(friends)
      .innerJoin(users, eq(friends.friend_id, users.user_id))
      .leftJoin(profiles, eq(users.user_id, profiles.user_id))
      .where(
        and(
          eq(friends.user_id, userId),
          eq(friends.status, 'accepted'),
          eq(users.is_active, true)
        )
      );
    
    // Process the results to structure them correctly
    return onlineConnectionsData.map(conn => ({
      ...conn.friend,
      profile: conn.profile,
      isOnline: true
    }));
  }
  
  async sendFriendRequest(userId: string, friendId: string): Promise<void> {
    // Check if a request already exists
    const [existingRequest] = await db.select()
      .from(friends)
      .where(
        or(
          and(
            eq(friends.user_id, userId),
            eq(friends.friend_id, friendId)
          ),
          and(
            eq(friends.user_id, friendId),
            eq(friends.friend_id, userId)
          )
        )
      );
    
    if (!existingRequest) {
      // Create new friend request
      await db.insert(friends)
        .values({
          user_id: userId,
          friend_id: friendId,
          status: 'pending'
        });
    }
  }
  
  async acceptFriendRequest(userId: string, friendId: string): Promise<void> {
    // Update the existing request to accepted
    await db.update(friends)
      .set({ status: 'accepted' })
      .where(
        and(
          eq(friends.user_id, friendId),
          eq(friends.friend_id, userId),
          eq(friends.status, 'pending')
        )
      );
    
    // Create reciprocal entry
    await db.insert(friends)
      .values({
        user_id: userId,
        friend_id: friendId,
        status: 'accepted'
      })
      .onConflictDoUpdate({
        target: [friends.user_id, friends.friend_id],
        set: { status: 'accepted' }
      });
  }
  
  async rejectFriendRequest(userId: string, friendId: string): Promise<void> {
    // Delete the request
    await db.delete(friends)
      .where(
        and(
          eq(friends.user_id, friendId),
          eq(friends.friend_id, userId),
          eq(friends.status, 'pending')
        )
      );
  }
  
  async removeFriend(userId: string, friendId: string): Promise<void> {
    // Delete both directions of the friendship
    await db.delete(friends)
      .where(
        or(
          and(
            eq(friends.user_id, userId),
            eq(friends.friend_id, friendId)
          ),
          and(
            eq(friends.user_id, friendId),
            eq(friends.friend_id, userId)
          )
        )
      );
  }
  
  // Friend Group (Circle) methods
  async getUserFriendGroups(userId: string): Promise<any[]> {
    // Get user's friend groups
    const groups = await db.select()
      .from(friend_groups)
      .where(eq(friend_groups.owner_user_id, userId));
    
    // For each group, get member count
    const groupsWithCounts = await Promise.all(groups.map(async (group) => {
      const [countResult] = await db.select({
          count: sql<number>`count(*)`
        })
        .from(friend_group_members)
        .where(eq(friend_group_members.friend_group_id, group.friend_group_id));
      
      return {
        ...group,
        memberCount: Number(countResult.count)
      };
    }));
    
    return groupsWithCounts;
  }
  
  async createFriendGroup(data: any): Promise<any> {
    const [newGroup] = await db.insert(friend_groups)
      .values(data)
      .returning();
    
    // Add owner as a member
    await db.insert(friend_group_members)
      .values({
        friend_group_id: newGroup.friend_group_id,
        user_id: data.owner_user_id,
        role: 'owner'
      });
    
    return {
      ...newGroup,
      memberCount: 1
    };
  }
  
  // NEW: Check if user can access a friend group
  async canAccessFriendGroup(groupId: string, userId: string): Promise<boolean> {
    // Check if user is a member of the friend group
    const membership = await db.select()
      .from(friend_group_members)
      .where(and(
        eq(friend_group_members.friend_group_id, groupId),
        eq(friend_group_members.user_id, userId)
      ))
      .limit(1);
    
    return membership.length > 0;
  }

  // NEW: Check if user is the owner of a friend group
  async isFriendGroupOwner(groupId: string, userId: string): Promise<boolean> {
    const group = await db.select()
      .from(friend_groups)
      .where(and(
        eq(friend_groups.friend_group_id, groupId),
        eq(friend_groups.owner_user_id, userId)
      ))
      .limit(1);
    
    return group.length > 0;
  }

  // NEW: Get all members of a friend group
  async getFriendGroupMembers(groupId: string): Promise<any[]> {
    console.log(`[DEBUG] Getting members for friend group ${groupId}`);
    
    try {
      const members = await db.select({
          user: users,
          profile: profiles,
          role: friend_group_members.role
        })
        .from(friend_group_members)
        .innerJoin(users, eq(friend_group_members.user_id, users.user_id))
        .leftJoin(profiles, eq(users.user_id, profiles.user_id))
        .where(eq(friend_group_members.friend_group_id, groupId));
      
      console.log(`[DEBUG] Found ${members.length} raw members for friend group ${groupId}`);
      
      // Log raw members data
      if (members.length > 0) {
        console.log(`[DEBUG] First raw member:`, JSON.stringify(members[0], null, 2));
      }
      
      // Transform the data structure to what the frontend expects:
      // Each user should have user_id at the top level, not nested in user property
      const validMembers = members
        .filter(member => !!member && !!member.user && typeof member.user.user_id === 'string')
        .map(member => ({
          user_id: member.user.user_id, // Add user_id at top level for frontend
          email: member.user.email,
          created_at: member.user.created_at,
          updated_at: member.user.updated_at,
          profile: member.profile,
          role: member.role
        }));
      
      console.log(`[DEBUG] Returning ${validMembers.length} valid members after filtering`);
      if (validMembers.length > 0) {
        console.log(`[DEBUG] First processed member:`, JSON.stringify(validMembers[0], null, 2));
      }
      
      return validMembers;
    } catch (error) {
      console.error(`[ERROR] Failed to get members for friend group ${groupId}:`, error);
      return [];
    }
  }

  // NEW: Check if two users are connected
  async areUsersConnected(userId1: string, userId2: string): Promise<boolean> {
    const connection = await db.select()
      .from(friends)
      .where(
        or(
          and(
            eq(friends.user_id, userId1),
            eq(friends.friend_id, userId2),
            eq(friends.status, 'accepted')
          ),
          and(
            eq(friends.user_id, userId2),
            eq(friends.friend_id, userId1),
            eq(friends.status, 'accepted')
          )
        )
      )
      .limit(1);
    
    return connection.length > 0;
  }

  // NEW: Add a member to a friend group
  async addFriendGroupMember(groupId: string, userId: string): Promise<void> {
    console.log(`[DEBUG] Adding member ${userId} to friend group ${groupId}`);
    
    // Check if already a member
    const existingMember = await db.select()
      .from(friend_group_members)
      .where(and(
        eq(friend_group_members.friend_group_id, groupId),
        eq(friend_group_members.user_id, userId)
      ))
      .limit(1);
    
    console.log(`[DEBUG] Existing member check result: ${existingMember.length > 0 ? 'Already a member' : 'Not a member yet'}`);
    
    if (existingMember.length === 0) {
      try {
        console.log(`[DEBUG] Inserting new member ${userId} into group ${groupId}`);
        
        const result = await db.insert(friend_group_members)
          .values({
            friend_group_id: groupId,
            user_id: userId,
            role: 'member'
          })
          .returning();
        
        console.log(`[DEBUG] Insert result:`, result);
      } catch (error) {
        console.error(`[ERROR] Failed to add member ${userId} to group ${groupId}:`, error);
        throw error;
      }
    }
    
    // Verify the member was added successfully
    const verificationCheck = await db.select()
      .from(friend_group_members)
      .where(and(
        eq(friend_group_members.friend_group_id, groupId),
        eq(friend_group_members.user_id, userId)
      ))
      .limit(1);
    
    console.log(`[DEBUG] Verification check: Member ${userId} is ${verificationCheck.length > 0 ? 'now in' : 'still not in'} group ${groupId}`);
  }

  // NEW: Remove a member from a friend group
  async removeFriendGroupMember(groupId: string, userId: string): Promise<void> {
    await db.delete(friend_group_members)
      .where(and(
        eq(friend_group_members.friend_group_id, groupId),
        eq(friend_group_members.user_id, userId)
      ));
  }

  // NEW: Delete a friend group
  async deleteFriendGroup(groupId: string): Promise<void> {
    // Delete all member relationships first
    await db.delete(friend_group_members)
      .where(eq(friend_group_members.friend_group_id, groupId));
    
    // Then delete the group itself
    await db.delete(friend_groups)
      .where(eq(friend_groups.friend_group_id, groupId));
  }
  
  // Group (Space) methods
  async getGroups(options: any = {}): Promise<any[]> {
    let query = db.select()
      .from(groups);
    
    // Apply search filter if provided
    if (options.search) {
      query = query.where(
        or(
          like(groups.name, `%${options.search}%`),
          like(groups.description, `%${options.search}%`)
        )
      );
    }
    
    // Apply category filter if provided
    if (options.category) {
      query = query.where(eq(groups.topic_tag, options.category));
    }
    
    const groupsData = await query.orderBy(desc(groups.created_at));
    
    // For each group, get member count and preview members
    const groupsWithDetails = await Promise.all(groupsData.map(async (group) => {
      // Get member count
      const [countResult] = await db.select({
          count: sql<number>`count(*)`
        })
        .from(group_members)
        .where(eq(group_members.group_id, group.group_id));
      
      // Get preview members
      const previewMembersData = await db.select({
          member: users,
          profile: profiles
        })
        .from(group_members)
        .innerJoin(users, eq(group_members.user_id, users.user_id))
        .leftJoin(profiles, eq(users.user_id, profiles.user_id))
        .where(eq(group_members.group_id, group.group_id))
        .limit(3);
      
      const previewMembers = previewMembersData.map(m => ({
        ...m.member,
        profile: m.profile
      }));
      
      return {
        ...group,
        memberCount: Number(countResult.count),
        previewMembers
      };
    }));
    
    return groupsWithDetails;
  }
  
  async getPopularGroups(): Promise<any[]> {
    // Get groups by member count
    const groupsData = await db.select({
        group: groups,
        memberCount: sql<number>`count(${group_members.user_id})`
      })
      .from(groups)
      .leftJoin(group_members, eq(groups.group_id, group_members.group_id))
      .groupBy(groups.group_id)
      .orderBy((expr) => desc(sql`count(${group_members.user_id})`))
      .limit(5);
    
    // For each group, get preview members
    const groupsWithDetails = await Promise.all(groupsData.map(async (group) => {
      // Get preview members
      const previewMembersData = await db.select({
          member: users,
          profile: profiles
        })
        .from(group_members)
        .innerJoin(users, eq(group_members.user_id, users.user_id))
        .leftJoin(profiles, eq(users.user_id, profiles.user_id))
        .where(eq(group_members.group_id, group.group.group_id))
        .limit(3);
      
      const previewMembers = previewMembersData.map(m => ({
        ...m.member,
        profile: m.profile
      }));
      
      return {
        ...group.group,
        memberCount: Number(group.memberCount),
        previewMembers
      };
    }));
    
    return groupsWithDetails;
  }
  
  async getUserGroups(userId: string): Promise<any[]> {
    // Get groups the user is a member of
    const userGroupIds = await db.select({ groupId: group_members.group_id })
      .from(group_members)
      .where(eq(group_members.user_id, userId));
    
    if (userGroupIds.length === 0) {
      return [];
    }
    
    // Get the group details
    const groupsData = await db.select()
      .from(groups)
      .where(inArray(groups.group_id, userGroupIds.map(g => g.groupId)));
    
    // For each group, get member count and preview members
    const groupsWithDetails = await Promise.all(groupsData.map(async (group) => {
      // Get member count
      const [countResult] = await db.select({
          count: sql<number>`count(*)`
        })
        .from(group_members)
        .where(eq(group_members.group_id, group.group_id));
      
      // Get preview members
      const previewMembersData = await db.select({
          member: users,
          profile: profiles
        })
        .from(group_members)
        .innerJoin(users, eq(group_members.user_id, users.user_id))
        .leftJoin(profiles, eq(users.user_id, profiles.user_id))
        .where(eq(group_members.group_id, group.group_id))
        .limit(3);
      
      const previewMembers = previewMembersData.map(m => ({
        ...m.member,
        profile: m.profile
      }));
      
      return {
        ...group,
        memberCount: Number(countResult.count),
        previewMembers
      };
    }));
    
    return groupsWithDetails;
  }
  
  async createGroup(data: any): Promise<any> {
    const [newGroup] = await db.insert(groups)
      .values(data)
      .returning();
    
    return newGroup;
  }
  
  async joinGroup(groupId: string, userId: string, role: string = 'member'): Promise<void> {
    // Check if already a member
    const [existingMembership] = await db.select()
      .from(group_members)
      .where(
        and(
          eq(group_members.group_id, groupId),
          eq(group_members.user_id, userId)
        )
      );
    
    if (!existingMembership) {
      await db.insert(group_members)
        .values({
          group_id: groupId,
          user_id: userId,
          role
        });
    }
  }
  
  async leaveGroup(groupId: string, userId: string): Promise<void> {
    await db.delete(group_members)
      .where(
        and(
          eq(group_members.group_id, groupId),
          eq(group_members.user_id, userId)
        )
      );
  }
  
  // Shadow Session methods
  async getUpcomingShadowSessions(): Promise<any[]> {
    const now = new Date();
    const nowIsoString = now.toISOString();
    
    // Get shadow sessions starting in the future
    const sessionsData = await db.select({
        session: shadow_sessions,
        post: posts
      })
      .from(shadow_sessions)
      .innerJoin(posts, eq(shadow_sessions.post_id, posts.post_id))
      .where(gte(shadow_sessions.starts_at, sql`${nowIsoString}`))
      .orderBy(shadow_sessions.starts_at);
    
    // Get additional details for each session
    const sessionsWithDetails = await Promise.all(sessionsData.map(async (session) => {
      // Get creator
      const [creatorData] = await db.select({
          creator: users,
          profile: profiles
        })
        .from(users)
        .leftJoin(profiles, eq(users.user_id, profiles.user_id))
        .where(eq(users.user_id, session.post.author_user_id));
      
      // Get participants
      const participantsData = await db.select({
          participant: users,
          profile: profiles
        })
        .from(shadow_session_participants)
        .innerJoin(users, eq(shadow_session_participants.user_id, users.user_id))
        .leftJoin(profiles, eq(users.user_id, profiles.user_id))
        .where(eq(shadow_session_participants.post_id, session.session.post_id));
      
      const participants = participantsData.map(p => ({
        ...p.participant,
        profile: p.profile
      }));
      
      return {
        ...session.session,
        title: session.session.title || "Untitled Session", // Default title if not set
        post: session.post,
        creator: creatorData ? {
          ...creatorData.creator,
          profile: creatorData.profile
        } : undefined,
        participants
      };
    }));
    
    return sessionsWithDetails;
  }
  
  async getActiveShadowSessions(): Promise<any[]> {
    const now = new Date();
    const nowIsoString = now.toISOString();
    
    // Get shadow sessions happening now
    const sessionsData = await db.select({
        session: shadow_sessions,
        post: posts
      })
      .from(shadow_sessions)
      .innerJoin(posts, eq(shadow_sessions.post_id, posts.post_id))
      .where(
        and(
          lte(shadow_sessions.starts_at, sql`${nowIsoString}`),
          gte(shadow_sessions.ends_at, sql`${nowIsoString}`)
        )
      )
      .orderBy(shadow_sessions.starts_at);
    
    // Get additional details for each session
    const sessionsWithDetails = await Promise.all(sessionsData.map(async (session) => {
      // Get creator
      const [creatorData] = await db.select({
          creator: users,
          profile: profiles
        })
        .from(users)
        .leftJoin(profiles, eq(users.user_id, profiles.user_id))
        .where(eq(users.user_id, session.post.author_user_id));
      
      // Get participants
      const participantsData = await db.select({
          participant: users,
          profile: profiles
        })
        .from(shadow_session_participants)
        .innerJoin(users, eq(shadow_session_participants.user_id, users.user_id))
        .leftJoin(profiles, eq(users.user_id, profiles.user_id))
        .where(eq(shadow_session_participants.post_id, session.session.post_id));
      
      const participants = participantsData.map(p => ({
        ...p.participant,
        profile: p.profile
      }));
      
      return {
        ...session.session,
        title: session.session.title || "Untitled Session", // Default title if not set
        post: session.post,
        creator: creatorData ? {
          ...creatorData.creator,
          profile: creatorData.profile
        } : undefined,
        participants
      };
    }));
    
    return sessionsWithDetails;
  }
  
  async getUserJoinedShadowSessions(userId: string): Promise<any[]> {
    const now = new Date();
    const nowIsoString = now.toISOString();
    
    // Get shadow sessions that the user has joined
    const joinedSessionsData = await db.select({
        session: shadow_sessions,
        post: posts
      })
      .from(shadow_session_participants)
      .innerJoin(shadow_sessions, eq(shadow_session_participants.post_id, shadow_sessions.post_id))
      .innerJoin(posts, eq(shadow_sessions.post_id, posts.post_id))
      .where(
        and(
          eq(shadow_session_participants.user_id, userId),
          gte(shadow_sessions.starts_at, sql`${nowIsoString}`) // Only upcoming
        )
      )
      .orderBy(shadow_sessions.starts_at);
    
    // Get additional details for each session
    const sessionsWithDetails = await Promise.all(joinedSessionsData.map(async (session) => {
      // Get creator
      const [creatorData] = await db.select({
          creator: users,
          profile: profiles
        })
        .from(users)
        .leftJoin(profiles, eq(users.user_id, profiles.user_id))
        .where(eq(users.user_id, session.post.author_user_id));
      
      // Get participants
      const participantsData = await db.select({
          participant: users,
          profile: profiles
        })
        .from(shadow_session_participants)
        .innerJoin(users, eq(shadow_session_participants.user_id, users.user_id))
        .leftJoin(profiles, eq(users.user_id, profiles.user_id))
        .where(eq(shadow_session_participants.post_id, session.session.post_id));
      
      const participants = participantsData.map(p => ({
        ...p.participant,
        profile: p.profile
      }));
      
      return {
        ...session.session,
        title: session.session.title || "Untitled Session", // Default title if not set
        post: session.post,
        creator: creatorData ? {
          ...creatorData.creator,
          profile: creatorData.profile
        } : undefined,
        participants
      };
    }));
    
    return sessionsWithDetails;
  }
  
  async getPastShadowSessions(): Promise<any[]> {
    const now = new Date();
    const nowIsoString = now.toISOString();
    
    // Get shadow sessions that have ended
    const sessionsData = await db.select({
        session: shadow_sessions,
        post: posts
      })
      .from(shadow_sessions)
      .innerJoin(posts, eq(shadow_sessions.post_id, posts.post_id))
      .where(lte(shadow_sessions.ends_at, sql`${nowIsoString}`))
      .orderBy(desc(shadow_sessions.ends_at))
      .limit(10);
    
    // Get additional details for each session
    const sessionsWithDetails = await Promise.all(sessionsData.map(async (session) => {
      // Get creator
      const [creatorData] = await db.select({
          creator: users,
          profile: profiles
        })
        .from(users)
        .leftJoin(profiles, eq(users.user_id, profiles.user_id))
        .where(eq(users.user_id, session.post.author_user_id));
      
      // Get participant count
      const [countResult] = await db.select({
          count: sql<number>`count(*)`
        })
        .from(shadow_session_participants)
        .where(eq(shadow_session_participants.post_id, session.session.post_id));
      
      return {
        ...session.session,
        title: session.session.title || "Untitled Session", // Default title if not set
        post: session.post,
        creator: creatorData ? {
          ...creatorData.creator,
          profile: creatorData.profile
        } : undefined,
        participantCount: Number(countResult.count)
      };
    }));
    
    return sessionsWithDetails;
  }
  
  async createShadowSession(data: any): Promise<any> {
    const [newSession] = await db.insert(shadow_sessions)
      .values(data)
      .returning();
    
    // Auto-join the creator to the session
    await this.joinShadowSession(newSession.post_id, data.creator_id || data.author_user_id);
    
    return newSession;
  }
  
  async joinShadowSession(sessionId: string, userId: string): Promise<void> {
    // Check if already a participant
    const [existingParticipation] = await db.select()
      .from(shadow_session_participants)
      .where(
        and(
          eq(shadow_session_participants.post_id, sessionId),
          eq(shadow_session_participants.user_id, userId)
        )
      );
    
    if (!existingParticipation) {
      await db.insert(shadow_session_participants)
        .values({
          post_id: sessionId,
          user_id: userId
        });
    }
  }
  
  async getShadowSessionParticipants(sessionId: string): Promise<any[]> {
    const participantsData = await db.select({
        participant: users,
        profile: profiles
      })
      .from(shadow_session_participants)
      .innerJoin(users, eq(shadow_session_participants.user_id, users.user_id))
      .leftJoin(profiles, eq(users.user_id, profiles.user_id))
      .where(eq(shadow_session_participants.post_id, sessionId));
    
    return participantsData.map(p => ({
      ...p.participant,
      profile: p.profile
    }));
  }
  
  // Chat methods
  async getChatRooms(userId: string): Promise<any[]> {
    const rooms = await db.select()
      .from(chat_rooms)
      .innerJoin(chat_room_members, eq(chat_rooms.chat_room_id, chat_room_members.chat_room_id))
      .where(eq(chat_room_members.user_id, userId));
    
    return rooms.map(r => r.chat_rooms);
  }
  
  async getChatRoomMembers(roomId: string): Promise<any[]> {
    const membersData = await db.select({
        member: users,
        profile: profiles
      })
      .from(chat_room_members)
      .innerJoin(users, eq(chat_room_members.user_id, users.user_id))
      .leftJoin(profiles, eq(users.user_id, profiles.user_id))
      .where(eq(chat_room_members.chat_room_id, roomId));
    
    return membersData.map(m => ({
      ...m.member,
      profile: m.profile
    }));
  }
  
  async createChatMessage(data: any): Promise<any> {
    const [newMessage] = await db.insert(messages)
      .values(data)
      .returning();
    
    // Get message with sender info
    const [messageWithSender] = await db.select({
        message: messages,
        sender: {
          ...users,
          profile: profiles
        }
      })
      .from(messages)
      .innerJoin(users, eq(messages.sender_id, users.user_id))
      .leftJoin(profiles, eq(users.user_id, profiles.user_id))
      .where(eq(messages.message_id, newMessage.message_id));
    
    // Return structured message
    return {
      ...messageWithSender.message,
      sender: {
        ...messageWithSender.sender,
        profile: messageWithSender.sender.profile
      }
    };
  }
  
  // Online status
  async updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    await db.update(users)
      .set({ is_active: isOnline })
      .where(eq(users.user_id, userId));
    
    if (isOnline) {
      // Update last seen time
      const now = new Date();
      const nowIsoString = now.toISOString();
      await db.update(profiles)
        .set({ last_seen_at: sql`${nowIsoString}` })
        .where(eq(profiles.user_id, userId));
    }
  }

  // Get posts by a specific user
  async getPostsByUser(userId: string, requesterId?: string): Promise<any[]> {
    try {
      let friendIds: string[] = [];
      if (requesterId) {
        const friendsData = await db.select({ friend_id: friends.friend_id })
          .from(friends)
          .where(and(eq(friends.user_id, requesterId), eq(friends.status, 'accepted')));
        friendIds = friendsData.map((f: { friend_id: string | null }) => f.friend_id).filter((id: string | null): id is string => !!id);
      }
      // Privacy: Only show posts if:
      // - audience is 'everyone'
      // - audience is 'friends' and requester is a friend
      // - requester is the author
      // - audience is 'friend_group' and requester is in at least one group
      let whereCondition = eq(posts.author_user_id, userId);
      if (requesterId && requesterId === userId) {
        // Author viewing their own posts: show all
      } else if (requesterId) {
        const friendGroupExists = sql.raw(`EXISTS (
          SELECT 1 FROM post_audience
          INNER JOIN friend_group_members ON post_audience.friend_group_id = friend_group_members.friend_group_id
          WHERE post_audience.post_id = posts.post_id
            AND friend_group_members.user_id = '${requesterId}'
        )`);
        whereCondition = and(
          eq(posts.author_user_id, userId),
          or(
            eq(posts.audience, 'everyone'),
            and(eq(posts.audience, 'friends'), inArray(posts.author_user_id, friendIds)),
            and(eq(posts.audience, 'friend_group'), friendGroupExists)
          )
        );
      } else {
        // Not logged in: only show 'everyone' posts
        whereCondition = and(eq(posts.author_user_id, userId), eq(posts.audience, 'everyone'));
      }
      const result = await db.select()
        .from(posts)
        .where(whereCondition)
        .orderBy(desc(posts.created_at));
      return result;
    } catch (error) {
      console.error('Error getting posts by user:', error);
      throw error;
    }
  }

  // Get shadow session data for a specific post
  async getShadowSession(postId: string): Promise<any> {
    try {
      console.log(`Getting shadow session for post ${postId}`);
      
      const [session] = await db
        .select()
        .from(shadow_sessions)
        .where(eq(shadow_sessions.post_id, postId));
      
      if (!session) {
        return null;
      }
      
      // Get participants
      const participants = await this.getShadowSessionParticipants(postId);
      
      return {
        ...session,
        participants
      };
    } catch (error) {
      console.error('Error getting shadow session:', error);
      throw error;
    }
  }

  // Get reaction count for a post
  async getPostReactionsCount(postId: string): Promise<number> {
    try {
      const [result] = await db
        .select({
          count: sql<number>`count(*)`
        })
        .from(post_reactions)
        .where(eq(post_reactions.post_id, postId));
      
      return Number(result.count);
    } catch (error) {
      console.error('Error getting post reactions count:', error);
      return 0;
    }
  }

  // NEW: Get a user by their ID
  async getUserById(userId: string): Promise<any | null> {
    console.log(`[DEBUG] Getting user by ID: ${userId}`);
    
    if (!userId) {
      console.log(`[DEBUG] Invalid user ID: ${userId}`);
      return null;
    }
    
    try {
      const user = await db.select()
        .from(users)
        .where(eq(users.user_id, userId))
        .limit(1);
      
      console.log(`[DEBUG] User lookup result: ${user.length ? 'Found' : 'Not found'}`);
      
      if (user.length === 0) {
        return null;
      }
      
      return user[0];
    } catch (error) {
      console.error(`[ERROR] Failed to get user by ID ${userId}:`, error);
      return null;
    }
  }

  // Check if a user is a participant in a shadow session
  async isUserSessionParticipant(sessionId: string, userId: string): Promise<boolean> {
    try {
      // First check if the user is the creator of the session
      const session = await this.getShadowSession(sessionId);
      if (session?.creator?.user_id === userId) {
        return true;
      }

      // Then check if the user is a participant
      const participants = await db
        .select()
        .from(shadow_session_participants)
        .where(and(
          eq(shadow_session_participants.session_id, sessionId),
          eq(shadow_session_participants.user_id, userId)
        ));

      return participants.length > 0;
    } catch (error) {
      console.error("Error checking session participation:", error);
      return false;
    }
  }

  // Generic file upload method to handle all file uploads
  private async uploadFileToSupabase(
    filePath: string, 
    fileName: string, 
    bucketName: string, 
    uniqueFileName: string, 
    contentType: string | null = null,
    upsert: boolean = false
  ): Promise<string> {
    try {
      const fs = await import('fs');
      const fileData = fs.readFileSync(filePath);
      const fileExt = fileName.split('.').pop();
      
      // Upload to Supabase Storage
      const { data, error } = await supabase
        .storage
        .from(bucketName)
        .upload(uniqueFileName, fileData, {
          contentType: contentType || this.getMimeType(fileExt || ''),
          upsert: upsert
        });
      
      if (error) {
        console.error(`Error uploading to ${bucketName}:`, error);
        throw error;
      }

      // Generate a public URL for the uploaded file
      const { data: { publicUrl } } = supabase
        .storage
        .from(bucketName)
        .getPublicUrl(uniqueFileName);

      // Clean up the temporary file
      fs.unlinkSync(filePath);
      
      return publicUrl;
    } catch (error) {
      console.error(`Error in uploadFileToSupabase (${bucketName}):`, error);
      throw error;
    }
  }

  // Upload session media to Supabase Storage
  async uploadSessionMedia(filePath: string, fileName: string, sessionId: string): Promise<string> {
    try {
      const fileExt = fileName.split('.').pop();
      const timestamp = Date.now();
      const uniqueFileName = `session_${sessionId}_${timestamp}.${fileExt}`;
      
      return await this.uploadFileToSupabase(
        filePath,
        fileName,
        'shadow-session-media',
        uniqueFileName
      );
    } catch (error) {
      console.error("Error uploading session media:", error);
      throw error;
    }
  }

  // Create a session media message
  async createSessionMediaMessage(message: any): Promise<void> {
    try {
      // Insert the message into the database
      await db
        .insert(session_messages)
        .values({
          session_id: message.sessionId,
          user_id: message.userId,
          message_type: 'media',
          content: JSON.stringify({
            mediaUrl: message.mediaUrl,
            mediaType: message.mediaType
          })
        });
      
    } catch (error) {
      console.error("Error creating session media message:", error);
      throw error;
    }
  }

  // Upload post media to Supabase Storage
  async uploadPostMedia(filePath: string, fileName: string, postId: string): Promise<string> {
    try {
      const fileExt = fileName.split('.').pop();
      const timestamp = Date.now();
      const uniqueFileName = `post_${postId}_${timestamp}.${fileExt}`;
      
      const publicUrl = await this.uploadFileToSupabase(
        filePath,
        fileName,
        'post-media',
        uniqueFileName
      );
      
      // Add entry to post_media table
      await db.insert(post_media).values({
        post_id: postId,
        media_url: publicUrl,
        media_type: this.getMimeType(fileExt || '')
      });
      
      return publicUrl;
    } catch (error) {
      console.error("Error uploading post media:", error);
      throw error;
    }
  }

  // Upload user avatar to Supabase Storage
  async uploadUserAvatar(filePath: string, fileName: string, userId: string): Promise<string> {
    try {
      const fileExt = fileName.split('.').pop();
      const timestamp = Date.now();
      const uniqueFileName = `avatar_${userId}_${timestamp}.${fileExt}`;
      
      return await this.uploadFileToSupabase(
        filePath,
        fileName,
        'user-avatars',
        uniqueFileName,
        null,
        true // Override previous avatar if it exists
      );
    } catch (error) {
      console.error("Error uploading user avatar:", error);
      throw error;
    }
  }

  // Get media for a post
  async getPostMedia(postId: string): Promise<any[]> {
    try {
      return db.select()
        .from(post_media)
        .where(eq(post_media.post_id, postId))
        .orderBy(post_media.created_at);
    } catch (error) {
      console.error("Error getting post media:", error);
      return [];
    }
  }

  // Delete media
  async deleteMedia(mediaId: string): Promise<void> {
    try {
      // Get media details first
      const [media] = await db.select()
        .from(post_media)
        .where(eq(post_media.media_id, mediaId));
      
      if (!media) return;
      
      // Extract filename from URL
      const urlParts = media.media_url.split('/');
      const filename = urlParts[urlParts.length - 1];
      
      // Delete from Supabase storage
      const { error } = await supabase
        .storage
        .from('post-media')
        .remove([filename]);
      
      if (error) {
        console.error("Error deleting from storage:", error);
      } else {
        console.log(`Storage: Successfully deleted file ${filename} from storage`);
      }
      
      // Delete from database
      await db.delete(post_media)
        .where(eq(post_media.media_id, mediaId));
        
    } catch (error) {
      console.error("Error deleting media:", error);
      throw error;
    }
  }

  // Get media messages for a shadow session
  async getSessionMediaMessages(sessionId: string): Promise<any[]> {
    try {
      // Get media type messages from the session_messages table
      const mediaMessages = await db
        .select()
        .from(session_messages)
        .where(and(
          eq(session_messages.session_id, sessionId),
          eq(session_messages.message_type, 'media')
        ))
        .orderBy(desc(session_messages.created_at));
      
      // Transform the data for the frontend
      return mediaMessages.map(message => {
        // Parse the content JSON
        const content = JSON.parse(message.content);
        
        return {
          id: message.id.toString(),
          mediaUrl: content.mediaUrl,
          mediaType: content.mediaType,
          userId: message.user_id,
          createdAt: message.created_at
        };
      });
    } catch (error) {
      console.error("Error getting session media messages:", error);
      return [];
    }
  }

  // Get connection status between users
  async getConnectionStatus(userId: string, targetUserId: string): Promise<string> {
    // Check if there's an accepted connection (friendship)
    const [acceptedConnection] = await db.select()
      .from(friends)
      .where(
        and(
          eq(friends.user_id, userId),
          eq(friends.friend_id, targetUserId),
          eq(friends.status, 'accepted')
        )
      );
    
    if (acceptedConnection) {
      return 'connected';
    }
    
    // Check if there's a pending request from the target user to the current user
    const [incomingRequest] = await db.select()
      .from(friends)
      .where(
        and(
          eq(friends.user_id, targetUserId),
          eq(friends.friend_id, userId),
          eq(friends.status, 'pending')
        )
      );
    
    if (incomingRequest) {
      return 'pending_incoming';
    }
    
    // Check if there's a pending request from the current user to the target user
    const [outgoingRequest] = await db.select()
      .from(friends)
      .where(
        and(
          eq(friends.user_id, userId),
          eq(friends.friend_id, targetUserId),
          eq(friends.status, 'pending')
        )
      );
    
    if (outgoingRequest) {
      return 'pending_outgoing';
    }
    
    // No connection found
    return 'none';
  }

  // Helper to get MIME type from file extension
  private getMimeType(extension: string): string {
    const mimeTypes: {[key: string]: string} = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'pdf': 'application/pdf',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg'
    };
    
    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  // Notification methods
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(notifications)
      .values(notification)
      .returning();
    
    return newNotification;
  }

  async getUserNotifications(userId: string, limit: number = 20, offset: number = 0): Promise<Notification[]> {
    const userNotifications = await db.select({
      notification: notifications,
      sender: {
        ...users,
        profile: profiles
      }
    })
    .from(notifications)
    .leftJoin(users, eq(notifications.sender_user_id, users.user_id))
    .leftJoin(profiles, eq(users.user_id, profiles.user_id))
    .where(eq(notifications.recipient_user_id, userId))
    .orderBy(desc(notifications.created_at))
    .limit(limit)
    .offset(offset);
    
    return userNotifications.map(item => ({
      ...item.notification,
      sender: item.sender ? {
        ...item.sender,
        profile: item.sender.profile
      } : null
    }));
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await db.update(notifications)
      .set({ is_read: true })
      .where(eq(notifications.notification_id, notificationId));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ is_read: true })
      .where(eq(notifications.recipient_user_id, userId));
  }

  async deleteNotification(notificationId: string): Promise<void> {
    await db.delete(notifications)
      .where(eq(notifications.notification_id, notificationId));
  }

  // Implement the deletePost method
  async deletePost(postId: string, userId: string): Promise<void> {
    try {
      console.log(`Storage: Attempting to delete post ${postId} by user ${userId}`);
      
      // Validate postId
      if (!postId || typeof postId !== 'string') {
        console.error(`Storage: Invalid post ID: ${postId}`);
        throw new Error("Invalid post ID");
      }
      
      // First, verify the user is the author of the post
      const post = await this.getPostById(postId, userId);
      
      if (!post) {
        console.log(`Storage: Post ${postId} not found`);
        throw new Error("Post not found");
      }
      
      console.log(`Storage: Retrieved post author_user_id=${post.author_user_id}, comparing with requester ${userId}`);
      
      if (post.author_user_id !== userId) {
        console.log(`Storage: Permission denied - user ${userId} is not the author of post ${postId}`);
        throw new Error("You can only delete your own posts");
      }
      
      // Delete associated media files from storage
      console.log(`Storage: Getting media files for post ${postId}`);
      const mediaFiles = await this.getPostMedia(postId);
      console.log(`Storage: Found ${mediaFiles.length} media files to delete`);
      
      if (mediaFiles && mediaFiles.length > 0) {
        for (const media of mediaFiles) {
          // Extract filename from URL
          const urlParts = media.media_url.split('/');
          const filename = urlParts[urlParts.length - 1];
          
          console.log(`Storage: Attempting to delete file ${filename} from Supabase storage`);
          // Delete from Supabase storage
          const { error } = await supabase
            .storage
            .from('post-media')
            .remove([filename]);
          
          if (error) {
            console.error("Error deleting media from storage:", error);
          } else {
            console.log(`Storage: Successfully deleted file ${filename} from storage`);
          }
        }
      }
      
      // Delete the post from the database
      console.log(`Storage: Executing database DELETE for post ${postId}`);
      try {
        const deleteResult = await db.delete(posts)
          .where(eq(posts.post_id, postId))
          .returning();
        
        console.log(`Storage: Post deletion result:`, deleteResult);
        
        if (!deleteResult || deleteResult.length === 0) {
          console.log(`Storage: No rows affected when deleting post ${postId}`);
        } else {
          console.log(`Storage: Successfully deleted post ${postId}`);
        }
      } catch (dbError: any) {
        console.error(`Storage: Database error when deleting post:`, dbError);
        throw new Error(`Database error: ${dbError.message}`);
      }
    } catch (error) {
      console.error("Error in deletePost method:", error);
      throw error;
    }
  }

  async updatePost(postId: string, userId: string, data: any): Promise<any> {
    console.log(`[STORAGE] updatePost called with:`, { postId, userId, data });
    
    // Use the userId as requesterId for privacy checks
    const post = await this.getPostById(postId, userId);
    console.log(`[STORAGE] Found post:`, post);
    
    if (!post) {
      console.log(`[STORAGE] Post not found: ${postId}`);
      throw new Error('Post not found');
    }
    
    if (post.author_user_id !== userId) {
      console.log(`[STORAGE] Unauthorized: ${userId} trying to update post by ${post.author_user_id}`);
      throw new Error('Unauthorized');
    }

    const { content, emotion_ids, audience, friend_group_ids } = data;
    
    // Create a proper Date object and then convert to ISO string
    const now = new Date();
    
    const updateData: any = {
      updated_at: now,
    };
    
    if (typeof content !== 'undefined') updateData.content = content;
    if (typeof emotion_ids !== 'undefined' && Array.isArray(emotion_ids)) updateData.emotion_ids = emotion_ids;
    if (typeof audience !== 'undefined') updateData.audience = audience;

    console.log(`[STORAGE] Updating post ${postId} with data:`, updateData);

    // Update the post
    try {
      await db.update(posts)
        .set(updateData)
        .where(eq(posts.post_id, postId));
      
      console.log(`[STORAGE] Database update successful for post ${postId}`);
      
      // Update lastEmotions if emotion_ids were changed and audience is public or friends
      if (emotion_ids && Array.isArray(emotion_ids) && 
          (audience === 'everyone' || audience === 'friends' || 
          (post.audience === 'everyone' || post.audience === 'friends'))) {
        console.log(`[STORAGE] Updating lastEmotions for user ${userId} to:`, emotion_ids);
        await this.updateUserLastEmotions(userId, emotion_ids);
      }
      
      // If the audience is friend_group, update post_audience table
      if (audience === 'friend_group' && friend_group_ids && Array.isArray(friend_group_ids)) {
        console.log(`[STORAGE] Updating post_audience for friend_group audience`);
        
        try {
          // First delete existing audience entries using a safer approach
          await db.delete(post_audience)
            .where(eq(post_audience.post_id, postId));
          
          // Then insert new ones if there are any
          if (friend_group_ids.length > 0) {
            // Create array of objects for insertion
            const audienceValues = friend_group_ids.map((id: string) => ({
              post_id: postId,
              audience_type: 'friend_group',
              audience_id: id
            }));
            
            // Insert all audience values at once
            await db.insert(post_audience)
              .values(audienceValues);
          }
        } catch (audienceError) {
          console.error(`[STORAGE] Error updating post audience:`, audienceError);
          // Continue despite audience error - the post itself has been updated
        }
      }
      
      // Get the updated post with current user as requester to respect privacy
      const updatedPost = await this.getPostById(postId, userId);
      console.log(`[STORAGE] Retrieved updated post:`, updatedPost);
      return updatedPost;
    } catch (error) {
      console.error(`[STORAGE] Error updating post:`, error);
      throw error;
    }
  }

  async updateUserLastEmotions(userId: string, emotionIds: number[]): Promise<void> {
    if (!userId || !emotionIds || !Array.isArray(emotionIds)) {
      console.error('Invalid parameters for updateUserLastEmotions:', { userId, emotionIds });
      return;
    }
    
    try {
      // Store the emotion IDs as a JSONB array in the users_metadata table
      // First check if there's an existing entry
      const [existingMetadata] = await db.select()
        .from(users_metadata)
        .where(eq(users_metadata.user_id, userId));
      
      if (existingMetadata) {
        // Update existing metadata
        await db.update(users_metadata)
          .set({ 
            last_emotions: emotionIds,
            updated_at: new Date()
          })
          .where(eq(users_metadata.user_id, userId));
      } else {
        // Create new metadata
        await db.insert(users_metadata)
          .values({
            user_id: userId,
            last_emotions: emotionIds,
            created_at: new Date(),
            updated_at: new Date()
          });
      }
      
      console.log(`Updated last emotions for user ${userId} to:`, emotionIds);
    } catch (error) {
      console.error('Error updating user last emotions:', error);
    }
  }

  // Add the actual method implementations at the end of the class
  async getGroupById(groupId: string): Promise<any> {
    try {
      const result = await db.select()
        .from(groups)
        .where(eq(groups.group_id, groupId))
        .limit(1);
        
      if (result.length === 0) {
        return null;
      }
      
      // Get member count
      const memberCountResult = await db.select({ count: count() })
        .from(group_members)
        .where(eq(group_members.group_id, groupId));
        
      const memberCount = memberCountResult[0]?.count || 0;
      
      // Get preview members (limited number of members for display)
      const previewMembers = await db.select({
        user_id: group_members.user_id
      })
      .from(group_members)
      .where(eq(group_members.group_id, groupId))
      .limit(5);
      
      // Get full user objects for preview members
      const previewMemberDetails = await Promise.all(
        previewMembers.map(async (member) => {
          const user = await this.getUserById(member.user_id);
          return user;
        })
      );
      
      return {
        ...result[0],
        memberCount,
        previewMembers: previewMemberDetails
      };
    } catch (error) {
      console.error("Error fetching group by ID:", error);
      throw error;
    }
  }

  async getGroupCategories(): Promise<any[]> {
    try {
      // In a real implementation, this would fetch from the database
      // For now, we'll return hardcoded categories
      return [
        { id: "mindfulness", name: "Mindfulness & Meditation" },
        { id: "creativity", name: "Creativity & Art" },
        { id: "wellness", name: "Mental Wellness" },
        { id: "nature", name: "Nature & Outdoors" },
        { id: "reading", name: "Reading & Literature" },
        { id: "music", name: "Music & Sound" },
        { id: "selfcare", name: "Self-Care" },
        { id: "community", name: "Community Support" }
      ];
    } catch (error) {
      console.error("Error fetching group categories:", error);
      throw error;
    }
  }

  // Add the implementation
  async getGroupMembers(groupId: string): Promise<any[]> {
    try {
      // First get all member user IDs
      const memberRows = await db.select({
        user_id: group_members.user_id
      })
      .from(group_members)
      .where(eq(group_members.group_id, groupId));
      
      // Then get the full user details for each member
      const members = await Promise.all(
        memberRows.map(async (row) => {
          return this.getUserById(row.user_id);
        })
      );
      
      return members.filter(Boolean); // Filter out any null values
    } catch (error) {
      console.error("Error fetching group members:", error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();
