import { db, supabase } from "./db";
import { eq, and, ne, or, inArray, gte, lte, not, like, desc, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { users, profiles, friends, friend_groups, friend_group_members, 
         groups, group_members, emotions, posts, post_audience, post_media, 
         post_reactions, post_comments, shadow_sessions, shadow_session_participants,
         chat_rooms, chat_room_members, messages } from "@shared/schema";
import { z } from "zod";
import connectPg from "connect-pg-simple";
import session from "express-session";
import pg from 'pg';

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
  getPostById(postId: string): Promise<any>;
  createPost(data: any): Promise<any>;
  
  // Comment methods
  getPostComments(postId: string): Promise<any[]>;
  createComment(data: any): Promise<any>;
  
  // Reaction methods
  getUserReactionToPost(postId: string, userId: string): Promise<any>;
  createReaction(data: any): Promise<any>;
  deleteReaction(reactionId: string, userId: string): Promise<void>;
  
  // Friend (Connection) methods
  getUserConnections(userId: string): Promise<any[]>;
  getPendingConnectionRequests(userId: string): Promise<any[]>;
  getConnectionSuggestions(userId: string): Promise<any[]>;
  getOnlineConnections(userId: string): Promise<any[]>;
  sendFriendRequest(userId: string, friendId: string): Promise<void>;
  acceptFriendRequest(userId: string, friendId: string): Promise<void>;
  rejectFriendRequest(userId: string, friendId: string): Promise<void>;
  removeFriend(userId: string, friendId: string): Promise<void>;
  
  // Friend Group (Circle) methods
  getUserFriendGroups(userId: string): Promise<any[]>;
  createFriendGroup(data: any): Promise<any>;
  
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
  
  // Chat methods
  getChatRooms(userId: string): Promise<any[]>;
  getChatRoomMembers(roomId: string): Promise<any[]>;
  createChatMessage(data: any): Promise<any>;
  
  // Online status
  updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void>;
  
  // Session store
  sessionStore: session.Store;
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
    const [user] = await db.select()
      .from(users)
      .leftJoin(profiles, eq(users.user_id, profiles.user_id))
      .where(eq(users.user_id, id));
    
    if (!user) return undefined;
    
    // Merge user and profile into one object
    return {
      ...user.users,
      profile: user.profiles
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
    // Complex query to get posts with authors, reactions count, etc.
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
            'ends_at', ss.ends_at,
            'timezone', ss.timezone,
            'title', ss.title,
            'participants', (
              SELECT json_agg(json_build_object(
                'user_id', u.user_id,
                'profile', json_build_object(
                  'display_name', p.display_name,
                  'avatar_url', p.avatar_url
                )
              ))
              FROM ${shadow_session_participants} ssp
              JOIN ${users} u ON ssp.user_id = u.user_id
              LEFT JOIN ${profiles} p ON u.user_id = p.user_id
              WHERE ssp.post_id = ss.post_id
            )
           )
           FROM ${shadow_sessions} ss
           WHERE ss.post_id = ${posts.post_id})
        `
      })
      .from(posts)
      .innerJoin(users, eq(posts.author_user_id, users.user_id))
      .leftJoin(profiles, eq(users.user_id, profiles.user_id))
      .orderBy(desc(posts.created_at));
    
    // Apply emotion filter if provided
    if (emotionFilter && emotionFilter.length > 0) {
      // Use SQL to check if any of the filter emotions are in the emotion_ids array
      query = query.where(
        sql`${posts.emotion_ids} && ${sql.array(emotionFilter, 'int2')}`
      );
    }
    
    // Get posts 
    const postsData = await query;
    
    // Process the results to structure them correctly
    return postsData.map(post => ({
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
  
  async getPostById(postId: string): Promise<any> {
    const [post] = await db.select()
      .from(posts)
      .where(eq(posts.post_id, postId));
    
    return post;
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
      .orderBy(sql`count(${group_members.user_id})`)
      .desc()
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
    
    // Get shadow sessions starting in the future
    const sessionsData = await db.select({
        session: shadow_sessions,
        post: posts
      })
      .from(shadow_sessions)
      .innerJoin(posts, eq(shadow_sessions.post_id, posts.post_id))
      .where(gte(shadow_sessions.starts_at, now.toISOString()))
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
    
    // Get shadow sessions happening now
    const sessionsData = await db.select({
        session: shadow_sessions,
        post: posts
      })
      .from(shadow_sessions)
      .innerJoin(posts, eq(shadow_sessions.post_id, posts.post_id))
      .where(
        and(
          lte(shadow_sessions.starts_at, now.toISOString()),
          gte(shadow_sessions.ends_at, now.toISOString())
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
          gte(shadow_sessions.starts_at, new Date().toISOString()) // Only upcoming
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
    
    // Get shadow sessions that have ended
    const sessionsData = await db.select({
        session: shadow_sessions,
        post: posts
      })
      .from(shadow_sessions)
      .innerJoin(posts, eq(shadow_sessions.post_id, posts.post_id))
      .where(lte(shadow_sessions.ends_at, now.toISOString()))
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
      await db.update(profiles)
        .set({ last_seen_at: new Date().toISOString() })
        .where(eq(profiles.user_id, userId));
    }
  }
}

export const storage = new DatabaseStorage();
