import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { posts, User, reactionTypeEnum, eventTypeEnum, type InsertNotification } from "../shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import adminRoutes from "./adminRoutes"; // Added import for admin routes
import { getIO } from "./websocket"; // Import getIO function

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
    fileSize: 25 * 1024 * 1024, // 25MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept images and videos
    const allowedTypes = [
      'image/jpeg', 
      'image/png', 
      'image/gif', 
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/webm'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WEBP images and MP4, MOV, WEBM videos are allowed.') as any);
    }
  }
});

// Helper function to create notifications
async function createUserNotification(
  recipient_user_id: string,
  actor_user_id: string | null,
  event_type: InsertNotification['event_type'],
  entity_id?: string,
  entity_type?: string
) {
  try {
    const notificationPayload: InsertNotification = {
      recipient_user_id,
      actor_user_id,
      event_type,
    };
    if (entity_id) notificationPayload.entity_id = entity_id;
    if (entity_type) notificationPayload.entity_type = entity_type;

    await storage.createNotification(notificationPayload);
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

// Testing routes - only enabled in development mode
const setupTestRoutes = (app: Express) => {
  if (process.env.NODE_ENV !== 'production') {
    // Test endpoint to send a fake message to the current user
    app.post('/api/test/send-message', isAuthenticated, async (req: Request, res: Response) => {
      try {
        const { content = 'Test message for unread count', targetUserId } = req.body;
        const currentUser = req.user as unknown as User;
        
        if (!currentUser || !currentUser.user_id) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        
        // Find a sender - either specified or any other user
        let senderId = targetUserId;
        if (!senderId) {
          // Find any other user that's not the current user
          const otherUser = await db.query.users.findFirst({
            where: (users, { ne }) => ne(users.user_id, currentUser.user_id)
          });
          
          if (!otherUser) {
            return res.status(404).json({ error: 'No other user found to send a test message' });
          }
          
          senderId = otherUser.user_id;
        }
        
        // Find existing direct message room or create one
        let chatRoomId = null;
        
        // Get all chat rooms for the current user
        const userChatRooms = await storage.getChatRooms(currentUser.user_id);
        
        // Look for a direct message room with the target user
        const existingRoom = userChatRooms.find(room => 
          room.type === 'direct' && 
          room.otherParticipant && 
          room.otherParticipant.user_id === senderId
        );
        
        if (existingRoom) {
          chatRoomId = existingRoom.chat_room_id;
          console.log(`Found existing chat room: ${chatRoomId}`);
        } else {
          // Create a new direct message room using getOrCreateDirectChatRoom method
          const newRoom = await storage.getOrCreateDirectChatRoom(currentUser.user_id, senderId);
          chatRoomId = newRoom.chat_room_id;
          console.log(`Created new chat room: ${chatRoomId}`);
        }
        
        if (!chatRoomId) {
          return res.status(500).json({ error: 'Failed to find or create chat room' });
        }
        
        // Insert the test message
        const message = await storage.createChatMessage({
          chat_room_id: chatRoomId,
          sender_id: senderId,
          recipient_id: currentUser.user_id,
          body: content,
          message_type: 'text'
        });
        
        // Create notification for the message (which marks it as unread)
        // Note: Adjust properties based on the actual InsertNotification type
        await storage.createNotification({
          recipient_user_id: currentUser.user_id,
          actor_user_id: senderId,
          event_type: 'message_sent',
          entity_id: chatRoomId,
          entity_type: 'chat_room',
          is_read: false
        });
        
        // Emit socket event
        const io = getIO();
        io.to(currentUser.user_id).emit('newNotification', {
          senderId,
          roomId: chatRoomId,
          message: {
            id: message.message_id,
            content: message.content,
            timestamp: message.created_at
          }
        });
        
        return res.json({
          success: true,
          message: 'Test message sent',
          chatRoomId,
          messageId: message.message_id
        });
      } catch (error) {
        console.error('Error creating test message:', error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    });
    
    console.log('Test routes enabled in development mode');
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Setup test routes (only in development)
  setupTestRoutes(app);
  
  // Set up WebSockets - This is now done in server/index.ts
  // setupWebSockets(httpServer);

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
        return originalSend.call(res, body);
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

  // Register admin routes
  app.use("/api/ark", adminRoutes);

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
      const user_id = req.user!.user_id;
      
      const post = await storage.getPostById(postId, user_id);
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
      const { postId } = req.params;
      const { author_user_id, body, parent_comment_id } = req.body;

      if (!body) {
        return res.status(400).json({ message: "Comment body is required" });
      }

      const post = await storage.getPostById(postId, author_user_id || req.user!.user_id);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      const comment = await storage.createComment({
        post_id: postId,
        author_user_id: author_user_id || req.user!.user_id,
        body,
        parent_comment_id: parent_comment_id || null,
      });

      // Notify post author if they are not the commenter
      if (post.author_user_id !== (author_user_id || req.user!.user_id)) {
        await createUserNotification(
          post.author_user_id, // Recipient
          author_user_id || req.user!.user_id,   // Actor
          'post_commented',
          comment.comment_id,  // Entity: the new comment
          'comment'
        );
      }

      // If it's a reply, notify the parent comment author
      if (comment.parent_comment_id) {
        const parentComment = await storage.getCommentById(comment.parent_comment_id); // Fetch parentComment
        if (parentComment && parentComment.author_user_id !== (author_user_id || req.user!.user_id) && 
            parentComment.author_user_id !== post.author_user_id) { // Ensure not notifying self or post author again
          await createUserNotification(
            parentComment.author_user_id, // Recipient
            author_user_id || req.user!.user_id, // Actor
            'post_commented', // Corrected event type from 'comment_replied'
            comment.comment_id,           // Entity: the new reply comment
            'comment'
          );
        }
      }
      
      res.status(201).json(comment);
    } catch (error) {
      console.error('Error creating comment:', error);
      res.status(500).json({ error: 'Failed to create comment' });
    }
  });

  // POST /api/comments/:commentId/replies - Create a reply to a comment
  app.post("/api/comments/:commentId/replies", isAuthenticated, async (req, res) => {
    try {
      const { commentId: parent_comment_id } = req.params;
      const { body } = req.body;
      const author_user_id = req.user!.user_id;

      if (!body || typeof body !== 'string' || body.trim() === '') {
        return res.status(400).json({ message: "Reply body cannot be empty" });
      }

      const parentComment = await storage.getCommentById(parent_comment_id);
      if (!parentComment) {
        return res.status(404).json({ message: "Parent comment not found" });
      }
      const post_id = parentComment.post_id;

      if (!post_id) { 
        console.error(`Parent comment ${parent_comment_id} is missing post_id`);
        return res.status(500).json({ message: "Failed to create reply due to missing post association on parent comment." });
      }

      const reply = await storage.createComment({
        post_id, 
        author_user_id,
        parent_comment_id,
        body,
      });
      
      const newReplyWithAuthor = await storage.getCommentById(reply.comment_id);

      if (parentComment.author_user_id !== author_user_id) {
        await createUserNotification(
          parentComment.author_user_id,
          author_user_id,
          'post_commented',
          `replied to your comment: "${body.substring(0, 30)}${body.length > 30 ? '...' : ''}"`,
          `/post/${post_id}?comment=${reply.comment_id}`
        );
      }
      
      const post = await storage.getPostById(post_id, author_user_id);
      if (post && post.author_user_id !== author_user_id && post.author_user_id !== parentComment.author_user_id) {
         await createUserNotification(
          post.author_user_id,
          author_user_id,
          'post_commented', 
          `replied to a comment on your post: "${body.substring(0, 30)}${body.length > 30 ? '...' : ''}"`,
          `/post/${post_id}?comment=${reply.comment_id}`
        );
      }

      res.status(201).json(newReplyWithAuthor);
    } catch (err) {
      console.error("Failed to create reply:", err);
      // Ensure JSON response for errors too
      if (err instanceof Error && (err as any).status) {
        return res.status((err as any).status).json({ message: err.message });
      }
      res.status(500).json({ message: "Failed to create reply" });
    }
  });

  app.get("/api/posts/:postId/reaction/:userId", isAuthenticated, async (req, res) => {
    try {
      const { postId, userId } = req.params;
      const requestingUser_id = req.user!.user_id;
      
      const post = await storage.getPostById(postId, requestingUser_id);
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
      const { postId } = req.params;
      const { reaction_type } = req.body;
      const user_id = req.user!.user_id;

      if (!reactionTypeEnum.enumValues.includes(reaction_type)) {
        return res.status(400).json({ 
          message: 'Invalid reaction type',
          details: `Allowed types are: ${reactionTypeEnum.enumValues.join(', ')}` 
        });
      }

      const post = await storage.getPostById(postId, user_id);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      const newReaction = await storage.createReaction({
        post_id: postId, 
        user_id,
        reaction_type,
      });

      // Notify post author if they are not the one reacting
      if (post.author_user_id !== user_id) {
        await createUserNotification(
          post.author_user_id,   
          user_id,               
          'post_liked',          
          newReaction.reaction_id.toString(), 
          'reaction'             
        );
      }

      res.status(201).json(newReaction);
    } catch (error) {
      console.error('Error creating reaction:', error);
      res.status(500).json({ message: "Failed to create reaction" });
    }
  });

  app.delete("/api/posts/:postId/reactions/:reactionId", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteReaction(req.params.reactionId, req.user!.user_id);
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
      const sessions = await storage.getUserJoinedShadowSessions(req.user!.user_id);
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
      const user_id = req.user!.user_id;
      const { sessionId } = req.params;
      
      const session = await storage.getShadowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Shadow session not found' });
      }
      
      await storage.joinShadowSession(sessionId, user_id);
      
      // Notify invited friends
      if (session.friend_ids && Array.isArray(session.friend_ids)) {
        for (const friendId of session.friend_ids) {
          // Make sure friendId is a string
          if (typeof friendId === 'string') {
            await storage.createNotification({ // Direct call updated
              recipient_user_id: friendId,
              actor_user_id: req.user!.user_id,
              event_type: 'shadow_session_created', // Placeholder, ideally 'shadow_session_invite'
              entity_id: session.post_id,
              entity_type: 'shadow_session'
            });
          }
        }
      }
      // Notify invited friend groups - members of these groups
      if (session.friend_group_ids && Array.isArray(session.friend_group_ids)) {
        for (const fgId of session.friend_group_ids) {
          if (typeof fgId === 'string') {
            const members = await storage.getFriendGroupMembers(fgId);
            for (const member of members) {
              if (member.user_id !== req.user!.user_id) { // Don't notify self
                await storage.createNotification({ // Direct call updated
                  recipient_user_id: member.user_id,
                  actor_user_id: req.user!.user_id,
                  event_type: 'shadow_session_created', // Placeholder
                  entity_id: session.post_id,
                  entity_type: 'shadow_session'
                });
              }
            }
          }
        }
      }
      
      if (session.author_user_id !== user_id) {
        await createUserNotification(
          session.author_user_id,
          user_id,
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

      const session = await storage.getShadowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Shadow session not found' });
      }

      const isParticipant = await storage.isUserSessionParticipant(sessionId, userId);
      if (!isParticipant) {
        return res.status(403).json({ error: 'You must be a participant to share media in this session' });
      }

      const now = new Date();
      const startsAt = new Date(session.starts_at);
      const endsAt = new Date(session.ends_at);
      const isActive = now >= startsAt && now <= endsAt;
      
      if (!isActive) {
        return res.status(403).json({ error: 'Media can only be shared during active sessions' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No media file provided' });
      }

      const mediaPath = req.file.path;
      const mediaType = req.file.mimetype;
      const mediaSize = req.file.size;
      
      const mediaUrl = await storage.uploadSessionMedia(mediaPath, req.file.originalname, sessionId);
      
      const mediaMessage = {
        type: 'media_share',
        sessionId,
        userId,
        mediaUrl,
        mediaType,
        createdAt: new Date().toISOString()
      };
      
      await storage.createSessionMediaMessage(mediaMessage);
      
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
      
      const session = await storage.getShadowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Shadow session not found' });
      }
      
      const isParticipant = await storage.isUserSessionParticipant(sessionId, userId);
      if (!isParticipant) {
        return res.status(403).json({ error: 'You must be a participant to view session media' });
      }
      
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
      
      const canAccess = await storage.canAccessFriendGroup(req.params.groupId, req.user!.user_id);
      if (!canAccess) {
        console.log(`[API] Access denied - user ${req.user!.user_id} does not have access to circle ${req.params.groupId}`);
        return res.status(403).json({ message: "You do not have permission to access this circle" });
      }
      
      const members = await storage.getFriendGroupMembers(req.params.groupId);
      console.log(`[API] Found ${members.length} members for circle ${req.params.groupId}:`);
      console.log(JSON.stringify(members, null, 2).substring(0, 1000));
      
      return res.json(members);
    } catch (error) {
      console.error("[API Error] Error getting circle members:", error);
      res.status(500).json({ message: "Failed to get circle members" });
    }
  });

  // Add a member to a friend group (circle)
  app.post("/api/friend-groups/:groupId/members", isAuthenticated, async (req, res) => {
    try {
      const { groupId } = req.params;
      const { userId } = req.body; // User ID of the member to add
      const requesterId = req.user!.user_id;

      if (!userId) {
        return res.status(400).json({ message: "User ID of member to add is required." });
      }

      // Check if requester is the owner of the friend group
      const isOwner = await storage.isFriendGroupOwner(groupId, requesterId);
      if (!isOwner) {
        return res.status(403).json({ message: "Only the owner can add members to this friend group." });
      }
      
      // No need to fetch the full group object if groupId from params is the friend_group_id
      // and we only need this ID for the notification.
      // Existence is somewhat implied by isOwner check, or addFriendGroupMember should handle invalid groupId.

      await storage.addFriendGroupMember(groupId, userId);

      // Notify the added user
      if (userId !== requesterId) { // Don't notify if owner adds themselves
        await createUserNotification(
          userId,             // Recipient (the user being added)
          requesterId,        // Actor (the owner adding the member)
          'friend_group_invite',
          groupId,            // Entity: the friend group ID from params
          'friend_group'
        );
      }

      res.json({ message: "Member added to friend group successfully." });
    } catch (error) {
      console.error("Failed to add member to friend group:", error);
      if (error instanceof Error && error.message.includes("already a member")) {
        return res.status(409).json({ message: error.message });
      }
      if (error instanceof Error && error.message.includes("User not found")) { // Assuming storage might throw this
        return res.status(404).json({ message: "User to add not found." });
      }
      res.status(500).json({ message: "Failed to add member to friend group" });
    }
  });

  // NEW: Remove member from a friend group
  app.delete("/api/friend-groups/:groupId/members/:userId", isAuthenticated, async (req, res) => {
    try {
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
        creator_user_id: req.user!.user_id,
        name: req.body.name,
        description: req.body.description,
        topic_tag: req.body.topic_tag,
        is_public: req.body.is_public
      });
      
      await storage.joinGroup(group.group_id, req.user!.user_id, 'creator');
      
      res.status(201).json(group);
    } catch (err) {
      console.error("Failed to create group:", err);
      res.status(500).json({ message: "Failed to create group" });
    }
  });

  app.post("/api/groups/:groupId/join", isAuthenticated, async (req, res) => {
    try {
      const { groupId } = req.params;
      const userId = req.user!.user_id;

      const group = await storage.getGroupById(groupId); // Fetch group details
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      await storage.joinGroup(groupId, userId);

      // Notify group creator (if they exist and are not the one joining)
      if (group.creator_user_id && group.creator_user_id !== userId) {
        await createUserNotification(
          group.creator_user_id,    // Recipient
          userId,                   // Actor
          'group_invite',           // Event type (placeholder for actual join notification type)
          group.group_id,           // Entity: the group
          'group'
        );
      }

      res.json({ message: "Successfully joined group." });
    } catch (error) {
      console.error("Failed to join group:", error);
      // Handle specific errors, e.g., if user is already a member
      if (error instanceof Error && error.message.includes("already a member")) {
        return res.status(409).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to join group" });
    }
  });

  app.delete("/api/groups/:groupId/member", isAuthenticated, async (req, res) => {
    try {
      await storage.leaveGroup(req.params.groupId, req.user!.user_id);
      res.status(204).send();
    } catch (err) {
      console.error("Failed to leave group:", err);
      res.status(500).json({ message: "Failed to leave group" });
    }
  });

  // Friends (Connections)
  app.get("/api/user/connections", isAuthenticated, async (req, res) => {
    try {
      const connections = await storage.getUserConnections(req.user!.user_id);
      res.json(connections);
    } catch (err) {
      console.error("Failed to get connections:", err);
      res.status(500).json({ message: "Failed to get connections" });
    }
  });

  app.get("/api/user/connection-status/:userId", isAuthenticated, async (req, res) => {
    try {
      const targetUserId = req.params.userId;
      const status = await storage.getConnectionStatus(req.user!.user_id, targetUserId);
      res.json({ status });
    } catch (err) {
      console.error("Failed to get connection status:", err);
      res.status(500).json({ message: "Failed to get connection status" });
    }
  });

  app.get("/api/user/connections/pending", isAuthenticated, async (req, res) => {
    try {
      const pendingRequests = await storage.getPendingConnectionRequests(req.user!.user_id);
      res.json(pendingRequests);
    } catch (err) {
      console.error("Failed to get pending requests:", err);
      res.status(500).json({ message: "Failed to get pending requests" });
    }
  });

  app.get("/api/user/connections/online", isAuthenticated, async (req, res) => {
    try {
      const onlineConnections = await storage.getOnlineConnections(req.user!.user_id);
      res.json(onlineConnections);
    } catch (err) {
      console.error("Failed to get online connections:", err);
      res.status(500).json({ message: "Failed to get online connections" });
    }
  });

  app.get("/api/user/connection-suggestions", isAuthenticated, async (req, res) => {
    try {
      const suggestions = await storage.getConnectionSuggestions(req.user!.user_id);
      res.json(suggestions);
    } catch (err) {
      console.error("Failed to get connection suggestions:", err);
      res.status(500).json({ message: "Failed to get connection suggestions" });
    }
  });

  // Accept a friend request
  app.post("/api/friends/accept/:friendId", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.user_id;
      const { friendId } = req.params;

      await storage.acceptFriendRequest(userId, friendId);

      // Notify the user who made the original request that it was accepted
      await createUserNotification(
        friendId,          // Recipient: user who initially sent the request
        userId,            // Actor: user who accepted the request
        'friendship_accepted',
        userId,            // Entity: the user who accepted (links to their profile)
        'user'
      );
      // Notify the user who accepted the request that they have a new friend
      await createUserNotification(
        userId,            // Recipient: user who accepted
        friendId,          // Actor: user who made the original request
        'friendship_accepted',
        friendId,          // Entity: the user who made the request (links to their profile)
        'user'
      );

      res.json({ message: "Friend request accepted." });
    } catch (err) {
      console.error("Failed to accept friend request:", err);
      const typedError = err as Error;
      if (typedError.message === 'Friendship not found or not pending') {
        return res.status(404).json({ message: typedError.message });
      }
      res.status(500).json({ message: "Failed to accept friend request" });
    }
  });

  // Send a friend request
  app.post("/api/friends/request/:friendId", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.user_id;
      const { friendId } = req.params;

      if (userId === friendId) {
        return res.status(400).json({ message: "Cannot send friend request to yourself." });
      }

      await storage.sendFriendRequest(userId, friendId);

      // Notify the recipient of the friend request
      await createUserNotification(
        friendId,          // Recipient
        userId,            // Actor
        'friendship_request',
        userId,            // Entity: the user who sent the request
        'user'
      );

      res.json({ message: "Friend request sent." });
    } catch (err) {
      console.error("Failed to send friend request:", err);
      const typedError = err as Error;
      if (typedError.message === 'Friend request already sent or users already friends') {
        return res.status(400).json({ message: typedError.message });
      }
      res.status(500).json({ message: "Failed to send friend request" });
    }
  });

  app.delete("/api/friends", isAuthenticated, async (req, res) => {
    try {
      await storage.removeFriend(req.user!.user_id, req.body.friend_id);
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
      
      if (userId === "me" || userId === req.user?.user_id) {
        const { password, ...userWithoutPassword } = req.user!;
        return res.status(200).json(userWithoutPassword);
      }
      
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
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
      
      const posts = await storage.getPostsByUser(targetUserId, currentUserId);
      
      const enhancedPosts = await Promise.all(posts.map(async (post) => {
        const author = await storage.getUser(post.author_user_id);
        
        let shadowSession = null;
        if (post.is_shadow_session) {
          shadowSession = await storage.getShadowSession(post.post_id);
        }
        
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
      
      if (userId !== req.user?.user_id) {
        return res.status(403).json({ message: "You can only update your own profile" });
      }
      
      const { display_name, bio } = req.body;
      
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
      
      if (userId !== req.user?.user_id) {
        return res.status(403).json({ message: "You can only update your own avatar" });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "No avatar file provided" });
      }
      
      const avatarUrl = await storage.uploadUserAvatar(
        req.file.path,
        req.file.originalname,
        userId
      );
      
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
      const user_id = req.user?.user_id;
      if (!user_id) {
        console.error('[GET /api/notifications] User not authenticated or user ID missing after isAuthenticated guard. Path: ', req.path);
        return res.status(401).json({ error: 'User not authenticated or user ID missing.' });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      
      const notifications = await storage.getUserNotifications(user_id, limit, offset);

      // Ensure notifications is an array before trying to filter it
      if (!Array.isArray(notifications)) {
        console.error('[GET /api/notifications] storage.getUserNotifications did not return an array for user_id:', user_id, 'Received:', notifications, 'Path: ', req.path);
        // It's better to return an empty array or a defined structure if notifications might legitimately be non-existent or null
        // Forcing a 500 here might be too aggressive if storage.getUserNotifications can return null for valid reasons (e.g. no notifications)
        // However, if it *should* always be an array, then a 500 for unexpected type is okay.
        // For now, let's assume it should be an array and error if not for debugging.
        return res.status(500).json({ error: 'Internal server error: Invalid data from storage while fetching notifications.' });
      }
      
      const unreadCount = notifications.filter(n => !n.is_read).length;
      
      res.json({
        notifications,
        unreadCount
      });
    } catch (error) {
      console.error('Error in GET /api/notifications handler for path ', req.path, ':', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get notifications due to an unexpected error.';
      res.status(500).json({ error: errorMessage }); 
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
      const user_id = req.user!.user_id;
      
      await storage.markAllNotificationsAsRead(user_id);
      
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

  // User Settings Endpoints
  app.get("/api/user/settings", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.user_id;
      const profile = await storage.getProfile(userId);

      if (!profile) {
        // This case should ideally not happen for an authenticated user if profile is created on registration
        return res.status(404).json({ message: "Profile not found for user." });
      }

      // Define default settings structures
      const defaultPreferences = {
        theme: "system",
        theme_auto_sunrise_sunset: false,
        show_online_status: true,
        default_post_audience: "everyone",
        allow_friend_requests_from: "everyone",
        allow_space_circle_invites_from: "everyone",
      };
      const defaultNotificationSettings = { /* Define default structure for all notification types and their toggles */ };

      res.json({
        preferences: profile.preferences_blob || defaultPreferences,
        notificationSettings: profile.notification_settings_blob || defaultNotificationSettings,
      });
    } catch (error) {
      console.error("Failed to get user settings:", error);
      res.status(500).json({ message: "Failed to retrieve user settings" });
    }
  });

  app.put("/api/user/settings", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.user_id;
      const { preferences, notificationSettings } = req.body;

      const currentProfile = await storage.getProfile(userId);
      if (!currentProfile) {
        return res.status(404).json({ message: "Profile not found for user." });
      }

      const updatePayload: { preferences_blob?: any, notification_settings_blob?: any } = {};

      if (preferences) {
        // Merge with existing preferences to allow partial updates
        updatePayload.preferences_blob = { ...(currentProfile.preferences_blob || {}), ...preferences };
      }
      if (notificationSettings) {
        // Merge with existing notification settings
        updatePayload.notification_settings_blob = { ...(currentProfile.notification_settings_blob || {}), ...notificationSettings };
      }

      if (Object.keys(updatePayload).length === 0) {
        return res.status(400).json({ message: "No settings provided to update." });
      }
      
      const updatedProfile = await storage.updateProfile(userId, updatePayload);

      res.json({
        message: "Settings updated successfully.",
        preferences: updatedProfile.preferences_blob,
        notificationSettings: updatedProfile.notification_settings_blob
      });
    } catch (error) {
      console.error("Failed to update user settings:", error);
      res.status(500).json({ message: "Failed to update user settings" });
    }
  });

  // Get post media
  app.get("/api/posts/:postId/media", isAuthenticated, async (req, res) => {
    try {
      const { postId } = req.params;
      const userId = req.user!.user_id;
      
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
    
    if (!req.user) {
      console.error(`Authentication failed for deleting post ${postId}`);
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const userId = req.user.user_id;
      console.log(`User ${userId} attempting to delete post ${postId}`);
      
      await storage.deletePost(postId, userId);
      
      console.log(`Successfully deleted post ${postId}`);
      return res.status(204).send();
    } catch (err) {
      console.error(`Error deleting post ${postId}:`, err);
      
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
      
      const group = await storage.getGroupById(groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      
      const members = await storage.getGroupMembers(groupId);
      res.json(members);
    } catch (err) {
      console.error("Failed to get group members:", err);
      res.status(500).json({ message: "Failed to get group members" });
    }
  });

  // New endpoint to get IDs of users who sent unread messages
  app.get("/api/notifications/unread-message-senders", isAuthenticated, async (req, res) => {
    if (!req.user || !req.user.user_id) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    try {
      const unreadSenders = await storage.getUnreadMessageSenders(req.user.user_id);
      res.json(unreadSenders);
    } catch (error) {
      console.error("Failed to get unread message senders:", error);
      res.status(500).json({ message: "Failed to retrieve unread message senders" });
    }
  });

  // New endpoint to mark notifications from a specific sender as read
  app.post("/api/notifications/mark-read/sender/:senderId", isAuthenticated, async (req, res) => {
    if (!req.user || !req.user.user_id) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    try {
      const recipientUserId = req.user.user_id;
      const { senderId } = req.params;
      const { roomId } = req.body; // Optional: pass roomId if you want to be more specific

      await storage.markNotificationsFromSenderAsRead(recipientUserId, senderId, roomId);
      res.json({ success: true, message: `Notifications from sender ${senderId} marked as read.` });
    } catch (error) {
      console.error("Failed to mark notifications from sender as read:", error);
      res.status(500).json({ message: "Failed to mark notifications from sender as read" });
    }
  });

  // Chat API Endpoints
  // ------------------

  // Get/Create Direct Chat Room
  app.post("/api/chat/dm/:otherUserId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const currentUser = req.user as unknown as User;
      const otherUserId = req.params.otherUserId;

      if (!otherUserId) {
        return res.status(400).json({ message: "Other user ID is required" });
      }

      if (currentUser.user_id === otherUserId) {
        return res.status(400).json({ message: "Cannot create a chat room with yourself" });
      }

      const chatRoom = await storage.getOrCreateDirectChatRoom(currentUser.user_id, otherUserId);
      res.status(200).json(chatRoom);
    } catch (error) {
      console.error("Failed to get or create direct chat room:", error);
      res.status(500).json({ message: "Failed to get or create direct chat room" });
    }
  });

  // Fetch Chat Room Messages
  app.get("/api/chat/rooms/:roomId/messages", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const currentUser = req.user as unknown as User;
      const roomId = req.params.roomId;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      if (!roomId) {
        console.error("Missing roomId in get messages request");
        return res.status(400).json({ message: "Room ID is required" });
      }
      
      if (!currentUser || !currentUser.user_id) {
        console.error("User not authenticated in get messages request");
        return res.status(401).json({ message: "Authentication required" });
      }

      console.log(`Fetching messages for room ${roomId}, user ${currentUser.user_id}, limit ${limit}, offset ${offset}`);
      
      try {
        const messages = await storage.getChatRoomMessages(roomId, currentUser.user_id, limit, offset);
        console.log(`Successfully fetched ${messages.length} messages for room ${roomId}`);
        return res.status(200).json(messages);
      } catch (storageError: any) {
        console.error(`Storage error fetching messages: ${storageError.message}`);
        // Return empty array instead of error to prevent client from breaking
        return res.status(200).json([]);
      }
    } catch (error: any) {
      console.error(`Failed to fetch chat room messages for room ${req.params.roomId}:`, error);
      // Return empty array instead of error to prevent client from breaking
      return res.status(200).json([]);
    }
  });

  // Get User's Chat Rooms (Conversation List)
  app.get("/api/chat/rooms", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const currentUser = req.user as unknown as User;
      
      if (!currentUser || !currentUser.user_id) {
        console.error("User not authenticated in get chat rooms request");
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      console.log(`Fetching chat rooms for user ${currentUser.user_id}`);
      const chatRooms = await storage.getChatRooms(currentUser.user_id);
      
      if (!chatRooms) {
        console.error(`Failed to get chat rooms - null response for user ${currentUser.user_id}`);
        return res.status(500).json({ message: "Failed to get user chat rooms - null response" });
      }
      
      console.log(`Retrieved ${chatRooms.length} chat rooms for user ${currentUser.user_id}`);
      return res.status(200).json(chatRooms);
      
    } catch (error: any) {
      console.error(`Failed to get user chat rooms: ${error.message}`, error);
      return res.status(500).json({ message: "Failed to get user chat rooms" });
    }
  });

  // Mark messages as read in a chat room
  app.post('/api/chat/rooms/:roomId/mark-read', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const roomId = req.params.roomId;
      const currentUser = req.user as unknown as User;
      
      if (!currentUser || !currentUser.user_id) {
        console.log('Unauthorized attempt to mark messages as read');
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      console.log(`Marking messages as read in room ${roomId} for user ${currentUser.user_id}`);
      
      try {
        await storage.markRoomMessagesAsRead(roomId, currentUser.user_id);
        console.log(`Successfully marked messages as read in room ${roomId} for user ${currentUser.user_id}`);
        return res.status(200).json({ success: true, message: `Messages in room ${roomId} marked as read.` });
      } catch (storageError: any) {
        console.error(`Storage error marking messages as read for room ${roomId}:`, storageError);
        const errorMessage = String(storageError.message || 'Unknown storage error');
        console.log(`[MARK-READ ERROR HANDLER] Sending storage error response: ${errorMessage}`); 
        return res.status(500).json({ 
          message: "Server error while marking messages as read. Please try again.", 
          error: errorMessage 
        });
      }
    } catch (error: any) {
      console.error(`Failed to mark messages as read:`, error);
      const errorMessage = String(error.message || 'Unknown error');
      console.log(`[MARK-READ ERROR HANDLER] Sending general error response: ${errorMessage}`);
      return res.status(500).json({ 
        message: "An unexpected error occurred. Please try again.", 
        error: errorMessage
      });
    }
  });

  // Chat message with media upload
  app.post('/api/chat/messages/media', isAuthenticated, upload.array('media', 5), async (req, res) => {
    try {
      const { roomId, content } = req.body;
      const userId = req.user!.user_id;
      
      if (!roomId) {
        return res.status(400).json({ error: 'Room ID is required' });
      }
      
      // Check if user is a member of the chat room
      const isMember = await storage.isUserChatRoomMember(roomId, userId);
      if (!isMember) {
        return res.status(403).json({ error: 'You are not a member of this chat room' });
      }
      
      // Handle media files
      const mediaItems = [];
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        for (const file of req.files) {
          try {
            // Determine media type based on mimetype
            const mediaType = file.mimetype.startsWith('image/') ? 'image' : 'video';
            
            // Upload to storage
            const mediaUrl = await storage.uploadChatMedia(
              file.path,
              file.originalname,
              roomId,
              userId
            );
            
            mediaItems.push({
              url: mediaUrl,
              type: mediaType
            });
          } catch (error) {
            console.error('Error uploading chat media file:', error);
            // Continue with other files even if one fails
          }
        }
      }
      
      // Create the message with media
      const message = await storage.createChatMessage({
        chat_room_id: roomId,
        sender_id: userId,
        body: content || '',
        message_type: mediaItems.length > 0 ? 'media' : 'text',
        media: mediaItems.length > 0 ? mediaItems : undefined
      });
      
      // Get the WebSocket server instance from httpServer
      const io = getIO();
      
      // Broadcast to all in the room
      io.to(roomId).emit('newMessage', message);
      
      // Notify other room members
      const roomMembers = await storage.getChatRoomMembers(roomId);
      if (roomMembers) {
        for (const member of roomMembers) {
          if (member.user_id !== userId) { // Don't notify the sender
            // Emit notification to the user
            io.to(member.user_id).emit('newNotification', { 
              senderId: userId, 
              roomId: roomId,
              message: message
            });
            
            // Persist notification in database
            await storage.createNotification({
              recipient_user_id: member.user_id,
              actor_user_id: userId,
              event_type: 'message_sent',
              entity_id: roomId,
              entity_type: 'chat_message',
            });
          }
        }
      }
      
      res.status(201).json(message);
    } catch (error) {
      console.error('Error sending message with media:', error);
      res.status(500).json({ error: 'Failed to send message with media' });
    }
  });

  return httpServer;
}
