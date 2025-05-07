import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { storage } from './storage';

interface Client {
  ws: WebSocket;
  userId: string;
  isAlive: boolean;
}

interface Message {
  type: string;
  payload: any;
}

export function setupWebSockets(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  const clients = new Map<string, Client>();
  
  // Set up heartbeat interval to detect stale connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const client = Array.from(clients.values()).find(c => c.ws === ws);
      
      if (client && !client.isAlive) {
        // User is offline now
        updateUserOnlineStatus(client.userId, false);
        clients.delete(client.userId);
        return ws.terminate();
      }
      
      // Mark as inactive for next ping
      if (client) {
        client.isAlive = false;
      }
      
      ws.send(JSON.stringify({ type: 'ping' }));
    });
  }, 30000);
  
  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });
  
  wss.on('connection', (ws, req) => {
    let userId: string | null = null;
    
    ws.on('message', async (data) => {
      try {
        const message: Message = JSON.parse(data.toString());
        
        // Handle different message types
        switch (message.type) {
          case 'auth':
            // Authenticate the user
            userId = message.payload.userId;
            if (!userId) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { message: 'Authentication required' } 
              }));
              return;
            }
            
            // Store client connection
            clients.set(userId, { ws, userId, isAlive: true });
            
            // Update user's online status
            updateUserOnlineStatus(userId, true);
            
            // Send successful auth response
            ws.send(JSON.stringify({ 
              type: 'auth_success', 
              payload: { userId } 
            }));
            break;
            
          case 'pong':
            // Update the client's alive status
            if (userId && clients.has(userId)) {
              const client = clients.get(userId)!;
              client.isAlive = true;
            }
            break;
            
          case 'chat_message':
            // Handle new chat message
            if (!userId) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { message: 'Authentication required' } 
              }));
              return;
            }
            
            const { roomId, text } = message.payload;
            
            if (!roomId || !text) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { message: 'Room ID and message text are required' } 
              }));
              return;
            }
            
            // Save message to database
            const newMessage = await storage.createChatMessage({
              chat_room_id: roomId,
              sender_id: userId,
              body: text,
              message_type: 'text'
            });
            
            // Get room members
            const roomMembers = await storage.getChatRoomMembers(roomId);
            
            // Broadcast message to all connected room members
            roomMembers.forEach(member => {
              if (clients.has(member.user_id)) {
                const client = clients.get(member.user_id)!;
                client.ws.send(JSON.stringify({
                  type: 'new_message',
                  payload: {
                    message: newMessage
                  }
                }));
              }
            });
            break;
            
          case 'typing':
            // Broadcast typing indicator
            if (!userId) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { message: 'Authentication required' } 
              }));
              return;
            }
            
            const { roomId: typingRoomId, isTyping } = message.payload;
            
            if (!typingRoomId) {
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { message: 'Room ID is required' } 
              }));
              return;
            }
            
            // Get room members
            const typingRoomMembers = await storage.getChatRoomMembers(typingRoomId);
            
            // Broadcast typing status to other room members
            typingRoomMembers
              .filter(member => member.user_id !== userId)
              .forEach(member => {
                if (clients.has(member.user_id)) {
                  const client = clients.get(member.user_id)!;
                  client.ws.send(JSON.stringify({
                    type: 'user_typing',
                    payload: {
                      roomId: typingRoomId,
                      userId,
                      isTyping
                    }
                  }));
                }
              });
            break;
            
          default:
            ws.send(JSON.stringify({ 
              type: 'error', 
              payload: { message: 'Unknown message type' } 
            }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          payload: { message: 'Invalid message format' } 
        }));
      }
    });
    
    ws.on('close', () => {
      if (userId && clients.has(userId)) {
        // Update user's online status
        updateUserOnlineStatus(userId, false);
        
        // Remove client
        clients.delete(userId);
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      if (userId && clients.has(userId)) {
        // Update user's online status
        updateUserOnlineStatus(userId, false);
        
        // Remove client
        clients.delete(userId);
      }
    });
  });
  
  // Helper to update user's online status
  async function updateUserOnlineStatus(userId: string, isOnline: boolean) {
    try {
      await storage.updateUserOnlineStatus(userId, isOnline);
      
      // Get user's friends to notify them about status change
      const userFriends = await storage.getUserConnections(userId);
      
      // Broadcast status change to connected friends
      userFriends.forEach(friend => {
        if (clients.has(friend.user_id)) {
          const client = clients.get(friend.user_id)!;
          client.ws.send(JSON.stringify({
            type: 'friend_status_change',
            payload: {
              userId,
              isOnline
            }
          }));
        }
      });
    } catch (error) {
      console.error('Failed to update user online status:', error);
    }
  }
  
  return wss;
}
