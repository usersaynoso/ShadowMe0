import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { setupWebSockets } from "./websocket";
import { db } from "./db";
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
    fileSize: 5 * 1024 * 1024, // 5MB max file size
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
      res.json(emotions);
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
      
      // Handle file upload if present
      let mediaUrl = null;
      if (req.file) {
        mediaUrl = `/uploads/${req.file.filename}`;
      }
      
      // Create the post
      const post = await storage.createPost({
        author_user_id: req.user.user_id,
        parent_type: 'profile',
        parent_id: req.user.user_id,
        audience,
        content: content || null,
        emotion_ids: parsedEmotionIds,
        media: mediaUrl ? [{
          media_url: mediaUrl,
          media_type: req.file?.mimetype || 'image/jpeg'
        }] : undefined,
        friend_group_ids: parsedFriendGroupIds
      });
      
      // If it's a shadow session, create the session as well
      if (is_shadow_session === 'true' && session_title && starts_at && ends_at && timezone) {
        await storage.createShadowSession({
          post_id: post.post_id,
          title: session_title,
          starts_at,
          ends_at,
          timezone
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
      const comment = await storage.createComment({
        post_id: req.params.postId,
        author_user_id: req.user.user_id,
        body: req.body.body,
        parent_comment_id: req.body.parent_comment_id
      });
      res.status(201).json(comment);
    } catch (err) {
      console.error("Failed to create comment:", err);
      res.status(500).json({ message: "Failed to create comment" });
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
      const reaction = await storage.createReaction({
        post_id: req.params.postId,
        user_id: req.user.user_id,
        reaction_type: req.body.reaction_type || 'like'
      });
      res.status(201).json(reaction);
    } catch (err) {
      console.error("Failed to create reaction:", err);
      res.status(500).json({ message: "Failed to create reaction" });
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
      await storage.joinShadowSession(req.params.sessionId, req.user.user_id);
      res.status(200).json({ message: "Joined session successfully" });
    } catch (err) {
      console.error("Failed to join session:", err);
      res.status(500).json({ message: "Failed to join session" });
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

  // Friend Groups (Circles)
  app.get("/api/friend-groups", isAuthenticated, async (req, res) => {
    try {
      const groups = await storage.getUserFriendGroups(req.user.user_id);
      res.json(groups);
    } catch (err) {
      console.error("Failed to get friend groups:", err);
      res.status(500).json({ message: "Failed to get friend groups" });
    }
  });

  app.post("/api/friend-groups", isAuthenticated, async (req, res) => {
    try {
      const group = await storage.createFriendGroup({
        owner_user_id: req.user.user_id,
        name: req.body.name,
        description: req.body.description
      });
      res.status(201).json(group);
    } catch (err) {
      console.error("Failed to create friend group:", err);
      res.status(500).json({ message: "Failed to create friend group" });
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
      await storage.sendFriendRequest(req.user.user_id, req.body.friend_id);
      res.status(200).json({ message: "Friend request sent" });
    } catch (err) {
      console.error("Failed to send friend request:", err);
      res.status(500).json({ message: "Failed to send friend request" });
    }
  });

  app.post("/api/friends/accept", isAuthenticated, async (req, res) => {
    try {
      await storage.acceptFriendRequest(req.user.user_id, req.body.friend_id);
      res.status(200).json({ message: "Friend request accepted" });
    } catch (err) {
      console.error("Failed to accept friend request:", err);
      res.status(500).json({ message: "Failed to accept friend request" });
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

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  return httpServer;
}
