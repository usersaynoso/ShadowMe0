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
  // Set up authentication routes
  setupAuth(app);

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Set up WebSockets
  setupWebSockets(httpServer);

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
      
      const posts = await storage.getPosts(req.user?.user_id, emotionFilter);
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

  app.get("/api/posts/:postId/comments", isAuthenticated, async (req, res) => {
    try {
      const comments = await storage.getPostComments(req.params.postId);
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
      
      // Get the post to check author and notify them
      const post = await storage.getPostById(postId);
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
      const reaction = await storage.getUserReactionToPost(req.params.postId, req.params.userId);
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
      
      // Get the post to check author and notify them
      const post = await storage.getPostById(postId);
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
      // Verify user has access to this friend group
      const canAccess = await storage.canAccessFriendGroup(req.params.groupId, req.user!.user_id);
      if (!canAccess) {
        return res.status(403).json({ message: "You do not have permission to access this circle" });
      }
      
      const members = await storage.getFriendGroupMembers(req.params.groupId);
      res.json(members);
    } catch (err) {
      console.error("Failed to get circle members:", err);
      res.status(500).json({ message: "Failed to get circle members" });
    }
  });

  // NEW: Add member to a friend group
  app.post("/api/friend-groups/:groupId/members", isAuthenticated, async (req, res) => {
    try {
      // Verify user is the owner of this friend group
      const isOwner = await storage.isFriendGroupOwner(req.params.groupId, req.user!.user_id);
      if (!isOwner) {
        return res.status(403).json({ message: "Only the circle owner can add members" });
      }
      
      // Verify the user to be added is a connection
      const isConnection = await storage.areUsersConnected(req.user!.user_id, req.body.user_id);
      if (!isConnection) {
        return res.status(400).json({ message: "You can only add connections to your circles" });
      }
      
      await storage.addFriendGroupMember(req.params.groupId, req.body.user_id);
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
      const groups = await storage.getUserGroups(req.user.user_id);
      res.json(groups);
    } catch (err) {
      console.error("Failed to get user groups:", err);
      res.status(500).json({ message: "Failed to get user groups" });
    }
  });

  app.get("/api/groups/categories", isAuthenticated, async (req, res) => {
    try {
      // This would typically come from a database
      const categories = [
        { id: "mindfulness", name: "Mindfulness & Meditation" },
        { id: "creativity", name: "Creativity & Art" },
        { id: "wellness", name: "Mental Wellness" },
        { id: "nature", name: "Nature & Outdoors" },
        { id: "reading", name: "Reading & Literature" },
        { id: "music", name: "Music & Sound" },
        { id: "selfcare", name: "Self-Care" },
        { id: "community", name: "Community Support" }
      ];
      res.json(categories);
    } catch (err) {
      console.error("Failed to get group categories:", err);
      res.status(500).json({ message: "Failed to get group categories" });
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
      
      const posts = await storage.getPostsByUser(targetUserId);
      
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
  app.get("/api/posts/:postId/media", async (req, res) => {
    try {
      const { postId } = req.params;
      const media = await storage.getPostMedia(postId);
      res.json(media);
    } catch (err) {
      console.error("Failed to get post media:", err);
      res.status(500).json({ message: "Failed to get post media" });
    }
  });

  // Delete media
  app.delete("/api/media/:mediaId", isAuthenticated, async (req, res) => {
    try {
      const { mediaId } = req.params;
      await storage.deleteMedia(mediaId);
      res.status(204).send();
    } catch (err) {
      console.error("Failed to delete media:", err);
      res.status(500).json({ message: "Failed to delete media" });
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
      
      // Get the post first to check if it exists and if user is the author
      const post = await storage.getPostById(postId);
      
      if (!post) {
        console.log(`Post ${postId} not found during deletion attempt`);
        return res.status(404).json({ message: "Post not found" });
      }
      
      if (post.author_user_id !== userId) {
        console.log(`Permission denied: User ${userId} tried to delete post ${postId} owned by ${post.author_user_id}`);
        return res.status(403).json({ message: "You can only delete your own posts" });
      }
      
      // If validation passes, delete the post
      await db.delete(posts)
        .where(eq(posts.post_id, postId));
      
      console.log(`Successfully deleted post ${postId}`);
      return res.status(204).send();
    } catch (err) {
      console.error(`Error deleting post ${postId}:`, err);
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
      
      // Get the post to verify ownership
      const post = await storage.getPostById(postId);
      
      if (!post) {
        console.log(`Post ${postId} not found during deletion attempt`);
        return res.status(404).json({ message: "Post not found" });
      }
      
      if (post.author_user_id !== userId) {
        console.log(`Permission denied: User ${userId} tried to delete post ${postId} owned by ${post.author_user_id}`);
        return res.status(403).json({ message: "You can only delete your own posts" });
      }
      
      // Delete directly from the database
      await db.delete(posts)
        .where(eq(posts.post_id, postId));
      
      console.log(`Successfully deleted post ${postId} via POST endpoint`);
      
      // Return success JSON response
      return res.status(200).json({
        success: true,
        message: "Post deleted successfully"
      });
    } catch (err) {
      console.error(`Error deleting post ${postId}:`, err);
      return res.status(500).json({ message: "Failed to delete post", error: String(err) });
    }
  });

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  return httpServer;
}
