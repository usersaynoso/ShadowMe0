import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { setupWebSockets } from "./websocket";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { posts, User } from "../shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      // Create uploads directory if it doesn't exist
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
      cb(null, uniqueFilename);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Only accept images
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.') as any);
    }
  }
});

// Helper function to create notifications
async function createUserNotification(
  recipientId: string,
  senderId: string | null,
  type: string,
  content: string,
  relatedItemId?: string
) {
  try {
    await storage.createNotification({
      recipient_user_id: recipientId,
      sender_user_id: senderId,
      type: type as any,
      content,
      related_item_id: relatedItemId
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Set up WebSockets
  setupWebSockets(httpServer);

  // Debug middleware to log request details
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      console.log(`[DEBUG] ${req.method} ${req.path}`);
      console.log(`[DEBUG] Headers:`, req.headers);
      
      // Capture the original res.send to log responses
      const originalSend = res.send;
      res.send = function(body) {
        console.log(`[DEBUG] Response status: ${res.statusCode}`);
        console.log(`[DEBUG] Response headers:`, res.getHeaders());
        console.log(`[DEBUG] Response body:`, typeof body === 'string' ? body.substring(0, 100) + '...' : '[Object]');
        return originalSend.apply(res, arguments);
      };
    }
    next();
  });

  // Set up CORS for API requests - using explicit CORS middleware
  app.use('/api', cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
  }));
  
  // Middleware to set JSON content type for API responses
  app.use('/api', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
  });
  
  // Set up authentication routes
  setupAuth(app);

  // API Routes
  // ----------

  // Emotions
  app.get("/api/emotions", isAuthenticated, async (req, res) => {
    try {
      const emotions = await storage.getEmotions();
      // Map the database fields to the format expected by the client
      const mappedEmotions = emotions.map(emotion => ({
        id: emotion.emotion_id,
        name: emotion.emotion_name,
        color: emotion.emotion_color
      }));
      res.json(mappedEmotions);
    } catch (err) {
      console.error("Failed to get emotions:", err);
      res.status(500).json({ message: "Failed to get emotions" });
    }
  });

  // Posts
  app.get("/api/posts", isAuthenticated, async (req, res) => {
    try {
      const emotionFilter = req.query.emotions ? 
        Array.isArray(req.query.emotions) 
          ? req.query.emotions.map(Number) 
          : [Number(req.query.emotions)]
        : undefined;
      
      // Always pass the user ID when authenticated to respect privacy settings
      const userId = req.user?.user_id;
      console.log(`GET /api/posts request from user ${userId || 'unknown'}`);
      
      const posts = await storage.getPosts(userId, emotionFilter);
      res.json(posts);
    } catch (err) {
      console.error("Failed to get posts:", err);
      res.status(500).json({ message: "Failed to get posts" });
    }
  });

  app.post("/api/posts", isAuthenticated, upload.single('media'), async (req, res) => {
    try {
      const { content, emotion_ids, audience, friend_group_ids, 
              is_shadow_session, session_title, starts_at, ends_at, timezone } = req.body;
      
      // Parse emotion_ids from JSON string if it's a string
      const parsedEmotionIds = typeof emotion_ids === 'string' 
        ? JSON.parse(emotion_ids) 
        : emotion_ids;
      
      // Parse friend_group_ids from JSON string if it's a string and present
      const parsedFriendGroupIds = friend_group_ids && typeof friend_group_ids === 'string' 
        ? JSON.parse(friend_group_ids) 
        : friend_group_ids;
      
      // Validate at least one emotion is selected
      if (!parsedEmotionIds || !Array.isArray(parsedEmotionIds) || parsedEmotionIds.length === 0) {
        return res.status(400).json({ message: "At least one emotion is required" });
      }
      
      // Create the post first so we have a post_id for media
      const post = await storage.createPost({
        author_user_id: req.user!.user_id,
        parent_type: 'profile',
        parent_id: req.user!.user_id,
        audience,
        content: content || null,
        emotion_ids: parsedEmotionIds,
        friend_group_ids: parsedFriendGroupIds
      });
      
      // Update the user's lastEmotions if the post is visible to everyone or friends
      // This ensures that lastEmotions respects post privacy settings
      if (audience === 'everyone' || audience === 'friends') {
        await storage.updateUserLastEmotions(req.user!.user_id, parsedEmotionIds);
      }
      
      // Handle file upload if present using Supabase storage
      if (req.file) {
        try {
          // Upload to Supabase and get URL
          const mediaUrl = await storage.uploadPostMedia(
            req.file.path, 
            req.file.originalname, 
            post.post_id
          );
          
          console.log(`Media uploaded successfully to ${mediaUrl}`);
        } catch (uploadError) {
          console.error("Error uploading media to Supabase:", uploadError);
          // Continue with post creation even if media upload fails
        }
      }
      
      // If this is a shadow session, create the session
      if (is_shadow_session === 'true' && starts_at && ends_at) {
        await storage.createShadowSession({
          post_id: post.post_id,
          starts_at,
          ends_at,
          timezone: timezone || 'UTC',
          title: session_title,
          creator_id: req.user!.user_id
        });
      }
      
      res.status(201).json(post);
    } catch (err) {
      console.error("Failed to create post:", err);
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  // Special case for the PUT /api/posts/:postId endpoint
  app.put("/api/posts/:postId", isAuthenticated, async (req, res) => {
    try {
      console.log(`[EDIT POST] Request to edit post ${req.params.postId}`);
      console.log(`[EDIT POST] Request body:`, req.body);
      
      if (!req.user) {
        console.log(`[EDIT POST] User not authenticated`);
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const { postId } = req.params;
      const userId = req.user.user_id;
      
      // Ensure the postId is a valid string
      if (!postId || typeof postId !== 'string') {
        console.log(`[EDIT POST] Invalid post ID: ${postId}`);
        return res.status(400).json({ message: 'Invalid post ID' });
      }
      
      // Validate required fields
      const { content, emotion_ids, audience, friend_group_ids } = req.body;
      
      if (!emotion_ids || !Array.isArray(emotion_ids) || emotion_ids.length === 0) {
        console.log(`[EDIT POST] Missing or invalid emotion_ids:`, emotion_ids);
        return res.status(400).json({ message: 'At least one emotion is required' });
      }
      
      if (!audience || typeof audience !== 'string') {
        console.log(`[EDIT POST] Invalid audience:`, audience);
        return res.status(400).json({ message: 'Valid audience is required' });
      }
      
      // Verify that if audience is friend_group, then friend_group_ids is provided
      if (audience === 'friend_group') {
        if (!friend_group_ids || !Array.isArray(friend_group_ids) || friend_group_ids.length === 0) {
          console.log(`[EDIT POST] Missing friend_group_ids for friend_group audience`);
          return res.status(400).json({ message: 'Friend group IDs must be provided for friend_group audience' });
        }
      }
      
      try {
        // Call storage to update the post
        const updateData = {
          content,
          emotion_ids,
          audience,
          friend_group_ids
        };
        
        console.log(`[EDIT POST] Calling storage.updatePost with:`, { postId, userId, updateData });
        const updatedPost = await storage.updatePost(postId, userId, updateData);
        console.log(`[EDIT POST] Post updated successfully:`, updatedPost);
        
        // Force application/json content type
        res.setHeader('Content-Type', 'application/json');
        
        // Return the updated post
        return res.json(updatedPost || { success: true, post_id: postId });
      } catch (storageError: any) {
        // Handle specific error types from storage
        console.error(`[EDIT POST] Storage error:`, storageError);
        
        if (storageError.message === 'Unauthorized') {
          return res.status(403).json({ message: 'You do not have permission to edit this post' });
        }
        
        if (storageError.message === 'Post not found') {
          return res.status(404).json({ message: 'Post not found' });
        }
        
        // Generic database error
        return res.status(500).json({ 
          message: 'Failed to update post', 
          error: storageError.message || 'Database error'
        });
      }
    } catch (err: any) {
      console.error(`[EDIT POST] Unexpected error:`, err);
      // Force application/json content type even for errors
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ 
        message: 'An unexpected error occurred', 
        error: err.message || 'Unknown error'
      });
    }
  });

  app.get("/api/posts/:postId/comments", isAuthenticated, async (req, res) => {
    try {
      const { postId } = req.params;
      const user = req.user as User;
      
      // Get the post to check audience, passing the current user ID
      const post = await storage.getPostById(postId, user.user_id);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      const comments = await storage.getPostComments(postId);
      res.json(comments);
    } catch (err) {
      console.error("Failed to get comments:", err);
      res.status(500).json({ message: "Failed to get comments" });
    }
  });

  app.post("/api/posts/:postId/comments", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { postId } = req.params;
      const { body, parent_comment_id } = req.body;
      
      if (!body) {
        return res.status(400).json({ error: 'Comment body is required' });
      }
      
      // Get the post to check author and notify them, passing the current user ID
      const post = await storage.getPostById(postId, user.user_id);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      const newComment = await storage.createComment({
        post_id: postId,
        author_user_id: user.user_id,
        parent_comment_id: parent_comment_id || null,
        body
      });
      
      // Notify the post author (if not the same as commenter)
      if (post.author_user_id !== user.user_id) {
        await createUserNotification(
          post.author_user_id,
          user.user_id,
          'post_commented',
          `commented on your post`,
          postId
        );
      }
      
      // If replying to a comment, also notify the comment author
      if (parent_comment_id) {
        const parentComment = await storage.getCommentById(parent_comment_id);
        if (parentComment && parentComment.author_user_id !== user.user_id) {
          await createUserNotification(
            parentComment.author_user_id,
            user.user_id,
            'post_commented',
            `replied to your comment`,
            postId
          );
        }
      }
      
      res.json(newComment);
    } catch (error) {
      console.error('Error creating comment:', error);
      res.status(500).json({ error: 'Failed to create comment' });
    }
  });

  app.get("/api/posts/:postId/reaction/:userId", isAuthenticated, async (req, res) => {
    try {
      const { postId, userId } = req.params;
      const requestingUser = req.user as User;
      
      // Get the post to check audience, passing the current user ID
      const post = await storage.getPostById(postId, requestingUser.user_id);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      const reaction = await storage.getUserReactionToPost(postId, userId);
      res.json(reaction);
    } catch (err) {
      console.error("Failed to get reaction:", err);
      res.status(500).json({ message: "Failed to get reaction" });
    }
  });

  app.post("/api/posts/:postId/reactions", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { postId } = req.params;
      const { reaction_type } = req.body;
      
      if (!reaction_type) {
        return res.status(400).json({ error: 'Reaction type is required' });
      }
      
      // Get the post to check author and notify them, passing the current user ID
      const post = await storage.getPostById(postId, user.user_id);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      const newReaction = await storage.createReaction({
        post_id: postId,
        user_id: user.user_id,
        reaction_type
      });
      
      // Notify the post author (if not the same as reactor)
      if (post.author_user_id !== user.user_id) {
        await createUserNotification(
          post.author_user_id,
          user.user_id,
          'post_liked',
          `reacted to your post with ${reaction_type}`,
          postId
        );
      }
      
      res.json(newReaction);
    } catch (error) {
      console.error('Error creating reaction:', error);
      res.status(500).json({ error: 'Failed to create reaction' });
    }
  });

  app.delete("/api/posts/:postId/reactions/:reactionId", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteReaction(req.params.reactionId, req.user.user_id);
      res.status(204).send();
    } catch (err) {
      console.error("Failed to delete reaction:", err);
      res.status(500).json({ message: "Failed to delete reaction" });
    }
  });

  // Shadow Sessions
  app.get("/api/shadow-sessions/upcoming", isAuthenticated, async (req, res) => {
    try {
      const sessions = await storage.getUpcomingShadowSessions();
      res.json(sessions);
    } catch (err) {
      console.error("Failed to get upcoming sessions:", err);
      res.status(500).json({ message: "Failed to get upcoming sessions" });
    }
  });

  app.get("/api/shadow-sessions/active", isAuthenticated, async (req, res) => {
    try {
      const sessions = await storage.getActiveShadowSessions();
      res.json(sessions);
    } catch (err) {
      console.error("Failed to get active sessions:", err);
      res.status(500).json({ message: "Failed to get active sessions" });
    }
  });

  app.get("/api/shadow-sessions/joined", isAuthenticated, async (req, res) => {
    try {
      const sessions = await storage.getUserJoinedShadowSessions(req.user.user_id);
      res.json(sessions);
    } catch (err) {
      console.error("Failed to get joined sessions:", err);
      res.status(500).json({ message: "Failed to get joined sessions" });
    }
  });

  app.get("/api/shadow-sessions/past", isAuthenticated, async (req, res) => {
    try {
      const sessions = await storage.getPastShadowSessions();
      res.json(sessions);
    } catch (err) {
      console.error("Failed to get past sessions:", err);
      res.status(500).json({ message: "Failed to get past sessions" });
    }
  });

  app.post("/api/shadow-sessions/:sessionId/join", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { sessionId } = req.params;
      
      // Check if session exists
      const session = await storage.getShadowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Shadow session not found' });
      }
      
      await storage.joinShadowSession(sessionId, user.user_id);
      
      // Notify the creator that someone joined their session
      if (session.author_user_id !== user.user_id) {
        await createUserNotification(
          session.author_user_id,
          user.user_id,
          'shadow_session_created',
          `joined your shadow session "${session.title}"`,
          sessionId
        );
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error joining shadow session:', error);
      res.status(500).json({ error: 'Failed to join shadow session' });
    }
  });

  app.get("/api/shadow-sessions/:sessionId/participants", isAuthenticated, async (req, res) => {
    try {
      const participants = await storage.getShadowSessionParticipants(req.params.sessionId);
      res.json(participants);
    } catch (err) {
      console.error("Failed to get session participants:", err);
      res.status(500).json({ message: "Failed to get session participants" });
    }
  });

  // Shadow Session Media Upload
  app.post('/shadow-sessions/:sessionId/media', isAuthenticated, upload.single('media'), async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user!.user_id;

      // Check if session exists
      const session = await storage.getShadowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Shadow session not found' });
      }

      // Check if user is a participant in the session
      const isParticipant = await storage.isUserSessionParticipant(sessionId, userId);
      if (!isParticipant) {
        return res.status(403).json({ error: 'You must be a participant to share media in this session' });
      }

      // Check if session is active
      const now = new Date();
      const startsAt = new Date(session.starts_at);
      const endsAt = new Date(session.ends_at);
      const isActive = now >= startsAt && now <= endsAt;
      
      if (!isActive) {
        return res.status(403).json({ error: 'Media can only be shared during active sessions' });
      }

      // Check if a file was uploaded
      if (!req.file) {
        return res.status(400).json({ error: 'No media file provided' });
      }

      // Save the media to storage (Supabase)
      const mediaPath = req.file.path;
      const mediaType = req.file.mimetype;
      const mediaSize = req.file.size;
      
      // Upload the file to storage and get the URL
      const mediaUrl = await storage.uploadSessionMedia(mediaPath, req.file.originalname, sessionId);
      
      // Create a message about the media being shared
      const mediaMessage = {
        type: 'media_share',
        sessionId,
        userId,
        mediaUrl,
        mediaType,
        createdAt: new Date().toISOString()
      };
      
      // Save the media message
      await storage.createSessionMediaMessage(mediaMessage);
      
      // Broadcast to all session participants via WebSocket
      // This will be handled by the WebSocket server
      
      return res.status(200).json({ 
        success: true, 
        message: 'Media shared successfully',
        mediaUrl
      });
    } catch (error) {
      console.error("Error sharing media:", error);
      return res.status(500).json({ error: 'Failed to share media' });
    }
  });

  // Get Shadow Session Media
  app.get('/shadow-sessions/:sessionId/media', isAuthenticated, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user!.user_id;
      
      // Check if session exists
      const session = await storage.getShadowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Shadow session not found' });
      }
      
      // Check if user is a participant in the session
      const isParticipant = await storage.isUserSessionParticipant(sessionId, userId);
      if (!isParticipant) {
        return res.status(403).json({ error: 'You must be a participant to view session media' });
      }
      
      // Get session media messages
      const mediaMessages = await storage.getSessionMediaMessages(sessionId);
      
      return res.status(200).json(mediaMessages);
    } catch (error) {
      console.error("Error fetching session media:", error);
      return res.status(500).json({ error: 'Failed to fetch session media' });
    }
  });

  // Friend Groups (Circles)
  app.get("/api/friend-groups", isAuthenticated, async (req, res) => {
    try {
      const groups = await storage.getUserFriendGroups(req.user!.user_id);
      res.json(groups);
    } catch (err) {
      console.error("Failed to get friend groups:", err);
      res.status(500).json({ message: "Failed to get friend groups" });
    }
  });

  app.post("/api/friend-groups", isAuthenticated, async (req, res) => {
    try {
      const group = await storage.createFriendGroup({
        owner_user_id: req.user!.user_id,
        name: req.body.name,
        description: req.body.description
      });
      res.status(201).json(group);
    } catch (err) {
      console.error("Failed to create friend group:", err);
      res.status(500).json({ message: "Failed to create friend group" });
    }
  });

  // NEW: Get members of a friend group
  app.get("/api/friend-groups/:groupId/members", isAuthenticated, async (req, res) => {
    try {
      console.log(`[API] Getting members for circle: ${req.params.groupId}, User: ${req.user!.user_id}`);
      
      // Verify user has access to this friend group
      const canAccess = await storage.canAccessFriendGroup(req.params.groupId, req.user!.user_id);
      if (!canAccess) {
        console.log(`[API] Access denied - user ${req.user!.user_id} does not have access to circle ${req.params.groupId}`);
        return res.status(403).json({ message: "You do not have permission to access this circle" });
      }
      
      const members = await storage.getFriendGroupMembers(req.params.groupId);
      console.log(`[API] Found ${members.length} members for circle ${req.params.groupId}:`);
      console.log(JSON.stringify(members, null, 2).substring(0, 1000)); // Log up to 1000 chars to avoid huge logs
      
      return res.json(members);
    } catch (error) {
      console.error("[API Error] Error getting circle members:", error);
      res.status(500).json({ message: "Failed to get circle members" });
    }
  });

  // NEW: Add member to a friend group
  app.post("/api/friend-groups/:groupId/members", isAuthenticated, async (req, res) => {
    try {
      console.log(`[API] Adding member to circle. GroupId: ${req.params.groupId}, UserId: ${req.user!.user_id}, MemberId: ${req.body.user_id}`);
      
      // Validate inputs
      const groupId = req.params.groupId;
      const memberUserId = req.body.user_id;
      
      if (!groupId || typeof groupId !== 'string') {
        console.log(`[API] Invalid group ID: ${groupId}`);
        return res.status(400).json({ message: "Invalid circle ID" });
      }
      
      if (!memberUserId || typeof memberUserId !== 'string') {
        console.log(`[API] Invalid member user ID: ${memberUserId}`);
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Check if the user being added exists
      const userToAdd = await storage.getUserById(memberUserId);
      if (!userToAdd) {
        console.log(`[API] User to add not found: ${memberUserId}`);
        return res.status(404).json({ message: "User not found" });
      }
      
      // Verify user is the owner of this friend group
      const isOwner = await storage.isFriendGroupOwner(groupId, req.user!.user_id);
      console.log(`[API] Is user the circle owner? ${isOwner}`);
      
      if (!isOwner) {
        console.log(`[API] Permission denied - user ${req.user!.user_id} is not the owner of circle ${groupId}`);
        return res.status(403).json({ message: "Only the circle owner can add members" });
      }
      
      // Verify the user to be added is a connection
      const isConnection = await storage.areUsersConnected(req.user!.user_id, memberUserId);
      console.log(`[API] Are users connected? ${isConnection}`);
      
      if (!isConnection) {
        console.log(`[API] Cannot add user - ${req.user!.user_id} and ${memberUserId} are not connected`);
        return res.status(400).json({ message: "You can only add connections to your circles" });
      }
      
      await storage.addFriendGroupMember(groupId, memberUserId);
      console.log(`[API] Successfully added member ${memberUserId} to circle ${groupId}`);
      
      res.status(200).json({ success: true });
    } catch (err) {
      console.error("Failed to add circle member:", err);
      res.status(500).json({ message: "Failed to add circle member" });
    }
  });

  // NEW: Remove member from a friend group
  app.delete("/api/friend-groups/:groupId/members/:userId", isAuthenticated, async (req, res) => {
    try {
      // Verify user is the owner of this friend group
      const isOwner = await storage.isFriendGroupOwner(req.params.groupId, req.user!.user_id);
      if (!isOwner) {
        return res.status(403).json({ message: "Only the circle owner can remove members" });
      }
      
      await storage.removeFriendGroupMember(req.params.groupId, req.params.userId);
      res.status(200).json({ success: true });
    } catch (err) {
      console.error("Failed to remove circle member:", err);
      res.status(500).json({ message: "Failed to remove circle member" });
    }
  });

  // NEW: Delete a friend group
  app.delete("/api/friend-groups/:groupId", isAuthenticated, async (req, res) => {
    try {
      // Verify user is the owner of this friend group
      const isOwner = await storage.isFriendGroupOwner(req.params.groupId, req.user!.user_id);
      if (!isOwner) {
        return res.status(403).json({ message: "Only the circle owner can delete it" });
      }
      
      await storage.deleteFriendGroup(req.params.groupId);
      res.status(200).json({ success: true });
    } catch (err) {
      console.error("Failed to delete circle:", err);
      res.status(500).json({ message: "Failed to delete circle" });
    }
  });

  // Groups (Spaces)
  app.get("/api/groups", isAuthenticated, async (req, res) => {
    try {
      const { search, category } = req.query;
      const groups = await storage.getGroups({
        search: search as string,
        category: category as string
      });
      res.json(groups);
    } catch (err) {
      console.error("Failed to get groups:", err);
      res.status(500).json({ message: "Failed to get groups" });
    }
  });

  app.get("/api/groups/popular", isAuthenticated, async (req, res) => {
    try {
      const groups = await storage.getPopularGroups();
      res.json(groups);
    } catch (err) {
      console.error("Failed to get popular groups:", err);
      res.status(500).json({ message: "Failed to get popular groups" });
    }
  });

  app.get("/api/groups/member", isAuthenticated, async (req, res) => {
    try {
      const groups = await storage.getUserGroups(req.user!.user_id);
      res.json(groups);
    } catch (err) {
      console.error("Failed to get user groups:", err);
      res.status(500).json({ message: "Failed to get user groups" });
    }
  });

  app.get("/api/groups/categories", isAuthenticated, async (req, res) => {
    try {
      const categories = await storage.getGroupCategories();
      res.json(categories);
    } catch (err) {
      console.error("Failed to get group categories:", err);
      res.status(500).json({ message: "Failed to get group categories" });
    }
  });

  app.get("/api/groups/:groupId", isAuthenticated, async (req, res) => {
    try {
      const groupId = req.params.groupId;
      const group = await storage.getGroupById(groupId);
      
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      res.json(group);
    } catch (err) {
      console.error("Failed to get group:", err);
      res.status(500).json({ message: "Failed to get group" });
    }
  });

  app.post("/api/groups", isAuthenticated, async (req, res) => {
    try {
      const group = await storage.createGroup({
        creator_user_id: req.user.user_id,
        name: req.body.name,
        description: req.body.description,
        topic_tag: req.body.topic_tag,
        is_public: req.body.is_public
      });
      
      // Auto-join the creator to the group
      await storage.joinGroup(group.group_id, req.user.user_id, 'creator');
      
      res.status(201).json(group);
    } catch (err) {
      console.error("Failed to create group:", err);
      res.status(500).json({ message: "Failed to create group" });
    }
  });

  app.post("/api/groups/:groupId/join", isAuthenticated, async (req, res) => {
    try {
      await storage.joinGroup(req.params.groupId, req.user.user_id);
      res.status(200).json({ message: "Joined group successfully" });
    } catch (err) {
      console.error("Failed to join group:", err);
      res.status(500).json({ message: "Failed to join group" });
    }
  });

  app.delete("/api/groups/:groupId/member", isAuthenticated, async (req, res) => {
    try {
      await storage.leaveGroup(req.params.groupId, req.user.user_id);
      res.status(204).send();
    } catch (err) {
      console.error("Failed to leave group:", err);
      res.status(500).json({ message: "Failed to leave group" });
    }
  });

  // Friends (Connections)
  app.get("/api/user/connections", isAuthenticated, async (req, res) => {
    try {
      const connections = await storage.getUserConnections(req.user.user_id);
      res.json(connections);
    } catch (err) {
      console.error("Failed to get connections:", err);
      res.status(500).json({ message: "Failed to get connections" });
    }
  });

  app.get("/api/user/connection-status/:userId", isAuthenticated, async (req, res) => {
    try {
      const targetUserId = req.params.userId;
      const status = await storage.getConnectionStatus(req.user.user_id, targetUserId);
      res.json({ status });
    } catch (err) {
      console.error("Failed to get connection status:", err);
      res.status(500).json({ message: "Failed to get connection status" });
    }
  });

  app.get("/api/user/connections/pending", isAuthenticated, async (req, res) => {
    try {
      const pendingRequests = await storage.getPendingConnectionRequests(req.user.user_id);
      res.json(pendingRequests);
    } catch (err) {
      console.error("Failed to get pending requests:", err);
      res.status(500).json({ message: "Failed to get pending requests" });
    }
  });

  app.get("/api/user/connections/online", isAuthenticated, async (req, res) => {
    try {
      const onlineConnections = await storage.getOnlineConnections(req.user.user_id);
      res.json(onlineConnections);
    } catch (err) {
      console.error("Failed to get online connections:", err);
      res.status(500).json({ message: "Failed to get online connections" });
    }
  });

  app.get("/api/user/connection-suggestions", isAuthenticated, async (req, res) => {
    try {
      const suggestions = await storage.getConnectionSuggestions(req.user.user_id);
      res.json(suggestions);
    } catch (err) {
      console.error("Failed to get connection suggestions:", err);
      res.status(500).json({ message: "Failed to get connection suggestions" });
    }
  });

  app.post("/api/friends/request", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as User).user_id;
      const { friend_id } = req.body;
      
      if (!friend_id) {
        return res.status(400).json({ error: 'Friend ID is required' });
      }
      
      await storage.sendFriendRequest(userId, friend_id);
      
      // Create notification for the recipient
      await createUserNotification(
        friend_id, 
        userId, 
        'friendship_request', 
        `sent you a connection request`,
        userId
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error sending friend request:', error);
      res.status(500).json({ error: 'Failed to send request' });
    }
  });

  app.post("/api/friends/accept", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as User).user_id;
      const { friend_id } = req.body;
      
      if (!friend_id) {
        return res.status(400).json({ error: 'Friend ID is required' });
      }
      
      await storage.acceptFriendRequest(userId, friend_id);
      
      // Create notification for the other user
      await createUserNotification(
        friend_id, 
        userId, 
        'friendship_accepted', 
        `accepted your connection request`,
        userId
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error accepting friend request:', error);
      res.status(500).json({ error: 'Failed to accept request' });
    }
  });

  app.delete("/api/friends/request", isAuthenticated, async (req, res) => {
    try {
      await storage.rejectFriendRequest(req.user.user_id, req.body.friend_id);
      res.status(204).send();
    } catch (err) {
      console.error("Failed to reject friend request:", err);
      res.status(500).json({ message: "Failed to reject friend request" });
    }
  });

  app.delete("/api/friends", isAuthenticated, async (req, res) => {
    try {
      await storage.removeFriend(req.user.user_id, req.body.friend_id);
      res.status(204).send();
    } catch (err) {
      console.error("Failed to remove friend:", err);
      res.status(500).json({ message: "Failed to remove friend" });
    }
  });

  // Get a specific user by ID
  app.get("/api/users/:userId", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.params.userId;
      
      // If querying self, use the authenticated user
      if (userId === "me" || userId === req.user?.user_id) {
        const { password, ...userWithoutPassword } = req.user!;
        return res.status(200).json(userWithoutPassword);
      }
      
      // Otherwise, fetch the requested user
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't expose password
      const { password, ...userWithoutPassword } = user;
      
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      next(error);
    }
  });
  
  // Get posts by a specific user
  app.get("/api/users/:userId/posts", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.params.userId;
      const targetUserId = userId === "me" ? req.user!.user_id : userId;
      const currentUserId = req.user!.user_id;
      
      // Pass the current user's ID to respect privacy settings
      const posts = await storage.getPostsByUser(targetUserId, currentUserId);
      
      // Enhance posts with author data
      const enhancedPosts = await Promise.all(posts.map(async (post) => {
        const author = await storage.getUser(post.author_user_id);
        
        // Get shadow session data if this is a shadow session post
        let shadowSession = null;
        if (post.is_shadow_session) {
          shadowSession = await storage.getShadowSession(post.post_id);
        }
        
        // Don't expose password in author data
        const { password, ...authorWithoutPassword } = author;
        
        return {
          ...post,
          author: authorWithoutPassword,
          shadow_session: shadowSession,
          reactions_count: await storage.getPostReactionsCount(post.post_id)
        };
      }));
      
      res.status(200).json(enhancedPosts);
    } catch (error) {
      next(error);
    }
  });

  // Update user profile
  app.put("/api/users/:userId/profile", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.params.userId;
      
      // Only allow users to update their own profile
      if (userId !== req.user?.user_id) {
        return res.status(403).json({ message: "You can only update your own profile" });
      }
      
      const { display_name, bio } = req.body;
      
      // Update the profile
      const updatedProfile = await storage.updateProfile(userId, {
        display_name, 
        bio
      });
      
      res.status(200).json(updatedProfile);
    } catch (error) {
      next(error);
    }
  });

  // Upload avatar photo
  app.post("/api/users/:userId/avatar", isAuthenticated, upload.single('avatar'), async (req, res, next) => {
    try {
      const userId = req.params.userId;
      
      // Only allow users to update their own avatar
      if (userId !== req.user?.user_id) {
        return res.status(403).json({ message: "You can only update your own avatar" });
      }
      
      // Check if a file was uploaded
      if (!req.file) {
        return res.status(400).json({ message: "No avatar file provided" });
      }
      
      // Upload the avatar to Supabase
      const avatarUrl = await storage.uploadUserAvatar(
        req.file.path,
        req.file.originalname,
        userId
      );
      
      // Update the profile with the new avatar URL
      const updatedProfile = await storage.updateProfile(userId, {
        avatar_url: avatarUrl
      });
      
      res.status(200).json(updatedProfile);
    } catch (error) {
      next(error);
    }
  });

  // Notification routes
  app.get('/api/notifications', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      
      const notifications = await storage.getUserNotifications(user.user_id, limit, offset);
      
      // Get unread count for the badge
      const unreadCount = notifications.filter(n => !n.is_read).length;
      
      res.json({
        notifications,
        unreadCount
      });
    } catch (error) {
      console.error('Error getting notifications:', error);
      res.status(500).json({ error: 'Failed to get notifications' });
    }
  });

  app.post('/api/notifications/:notificationId/read', isAuthenticated, async (req, res) => {
    try {
      const { notificationId } = req.params;
      
      await storage.markNotificationAsRead(notificationId);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  app.post('/api/notifications/read-all', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      await storage.markAllNotificationsAsRead(user.user_id);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
  });

  app.delete('/api/notifications/:notificationId', isAuthenticated, async (req, res) => {
    try {
      const { notificationId } = req.params;
      
      await storage.deleteNotification(notificationId);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({ error: 'Failed to delete notification' });
    }
  });

  // Get post media
  app.get("/api/posts/:postId/media", isAuthenticated, async (req, res) => {
    try {
      const { postId } = req.params;
      const userId = req.user!.user_id;
      
      // First check if the user can access this post
      const post = await storage.getPostById(postId, userId);
      if (!post) {
        return res.status(404).json({ error: 'Post not found or you do not have permission to access it' });
      }
      
      const media = await storage.getPostMedia(postId);
      res.json(media);
    } catch (err) {
      console.error("Failed to get post media:", err);
      res.status(500).json({ message: "Failed to get post media" });
    }
  });

  // Delete a post
  app.delete("/api/posts/:postId", isAuthenticated, async (req, res) => {
    const { postId } = req.params;
    console.log(`Received DELETE request for post ${postId}`);
    
    // Check for authenticated user
    if (!req.user) {
      console.error(`Authentication failed for deleting post ${postId}`);
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const userId = req.user.user_id;
      console.log(`User ${userId} attempting to delete post ${postId}`);
      
      // Use storage.deletePost which has proper privacy checks
      await storage.deletePost(postId, userId);
      
      console.log(`Successfully deleted post ${postId}`);
      return res.status(204).send();
    } catch (err) {
      console.error(`Error deleting post ${postId}:`, err);
      
      // Handle specific errors
      if (err instanceof Error) {
        if (err.message === "Post not found") {
          return res.status(404).json({ message: "Post not found" });
        } else if (err.message === "You can only delete your own posts") {
          return res.status(403).json({ message: "You can only delete your own posts" });
        }
      }
      
      return res.status(500).json({ message: "Failed to delete post", error: String(err) });
    }
  });

  // Add a POST endpoint for deletion as a workaround for browsers that don't handle DELETE well
  app.post("/api/posts/:postId/delete", isAuthenticated, async (req, res) => {
    const { postId } = req.params;
    console.log(`Received POST delete request for post ${postId}`);
    
    // Check authentication
    if (!req.user) {
      console.error(`Authentication failed for deleting post ${postId}`);
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const userId = req.user.user_id;
      console.log(`User ${userId} attempting to delete post ${postId} via POST`);
      
      // Use storage.deletePost which has proper privacy checks
      await storage.deletePost(postId, userId);
      
      console.log(`Successfully deleted post ${postId} via POST endpoint`);
      
      // Return success JSON response
      return res.status(200).json({
        success: true,
        message: "Post deleted successfully"
      });
    } catch (err) {
      console.error(`Error deleting post ${postId}:`, err);
      
      // Handle specific errors
      if (err instanceof Error) {
        if (err.message === "Post not found") {
          return res.status(404).json({ message: "Post not found" });
        } else if (err.message === "You can only delete your own posts") {
          return res.status(403).json({ message: "You can only delete your own posts" });
        }
      }
      
      return res.status(500).json({ message: "Failed to delete post", error: String(err) });
    }
  });

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Get members of a specific group
  app.get("/api/groups/:groupId/members", isAuthenticated, async (req, res) => {
    try {
      const groupId = req.params.groupId;
      
      // First check if the group exists
      const group = await storage.getGroupById(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      // Then get the members
      const members = await storage.getGroupMembers(groupId);
      res.json(members);
    } catch (err) {
      console.error("Failed to get group members:", err);
      res.status(500).json({ message: "Failed to get group members" });
    }
  });

  return httpServer;
}
