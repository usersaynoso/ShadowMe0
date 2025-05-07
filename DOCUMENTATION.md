# Shadow Me Documentation

## Project Overview
Shadow Me is a gentle, emotionally supportive social platform where users connect through mood-based interactions, color-coded emotion rings, and shadow sessions. The platform allows users to express their emotional states in a visually intuitive way, curate their audience through different privacy settings, and participate in shadow sessions for deeper emotional connections.

## Architecture
The application is built using a modern full-stack JavaScript architecture:

- **Frontend**: React with TypeScript, using Vite for development
- **Backend**: Express.js server with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with local strategy and session-based authentication
- **Real-time Communication**: WebSockets for real-time features

## Implemented Features

### 1. Database Schema
All data models have been created in `shared/schema.ts`, including:
- User accounts and profiles
- Emotions system (12 different emotions with color-coding)
- Posts with different audience types
- Friend connections
- Groups (Spaces)
- Friend groups (Circles)
- Shadow sessions

### 2. Authentication System
- Session-based authentication with Passport.js
- Secure password hashing using crypto's scrypt function
- Registration, login, and logout functionality
- Protected routes that redirect to auth page when not logged in

### 3. UI Components
- **EmotionSelector**: A component that allows users to select up to 3 emotions to express their current state
- **AvatarWithEmotion**: A component that displays a user's avatar with an emotion ring around it, visually representing selected emotions
- **Auth Forms**: Registration and login forms with validation

### 4. API Endpoints

#### Authentication Endpoints
- `POST /api/register`: Create a new user account
- `POST /api/login`: Authenticate user and create a session
- `POST /api/logout`: End user session
- `GET /api/user`: Get current authenticated user

#### Post Endpoints
- `GET /api/posts`: Get posts visible to the current user (with optional emotion filtering)
- `POST /api/posts`: Create a new post with emotions, audience settings, and optional media
- `GET /api/posts/:postId/comments`: Get comments for a specific post
- `POST /api/posts/:postId/comments`: Add a comment to a post
- `GET /api/posts/:postId/reaction/:userId`: Get a user's reaction to a post
- `POST /api/posts/:postId/reactions`: Add a reaction to a post
- `DELETE /api/posts/:postId/reactions/:reactionId`: Remove a reaction from a post

#### Emotion Endpoints
- `GET /api/emotions`: Get all available emotions

#### Shadow Session Endpoints
- `GET /api/shadow-sessions/upcoming`: Get upcoming shadow sessions
- `GET /api/shadow-sessions/active`: Get currently active shadow sessions
- `GET /api/shadow-sessions/joined`: Get shadow sessions the user has joined
- `GET /api/shadow-sessions/past`: Get past shadow sessions
- `POST /api/shadow-sessions/:sessionId/join`: Join a shadow session
- `GET /api/shadow-sessions/:sessionId/participants`: Get participants of a shadow session

#### Friend Group (Circle) Endpoints
- `GET /api/friend-groups`: Get user's friend groups
- `POST /api/friend-groups`: Create a new friend group

#### Group (Space) Endpoints
- `GET /api/groups`: Get groups matching search or category criteria
- `GET /api/groups/popular`: Get popular groups
- `GET /api/groups/member`: Get groups the user is a member of
- `GET /api/groups/categories`: Get available group categories
- `POST /api/groups`: Create a new group
- `POST /api/groups/:groupId/join`: Join a group
- `DELETE /api/groups/:groupId/member`: Leave a group

#### Connection (Friend) Endpoints
- `GET /api/user/connections`: Get user's connections
- `GET /api/user/connections/pending`: Get pending connection requests
- `GET /api/user/connections/online`: Get online connections
- `GET /api/user/connection-suggestions`: Get connection suggestions
- `POST /api/friends/request`: Send a friend request
- `POST /api/friends/accept`: Accept a friend request
- `DELETE /api/friends/request`: Reject a friend request
- `DELETE /api/friends`: Remove a friend

### 5. Real-time Features
- WebSocket setup for real-time communications
- Online status tracking for users

## What Has Been Achieved

✅ **Database Schema**: Complete schema design with all required tables and relationships
✅ **Authentication System**: Registration, login, logout with secure password hashing
✅ **Core UI Components**: Emotion ring avatars and emotion selector
✅ **API Endpoints**: Comprehensive API design for all core features
✅ **Emotion Data**: Database seeded with 12 distinct emotions and colors
✅ **Protected Routing**: Implementation of route protection based on authentication status

## What Remains to be Implemented

1. **Home Feed**:
   - Implement a feed of posts from friends and joined groups
   - Add post filtering by emotions
   - Create post composition UI with emotion selection

2. **User Profiles**:
   - Complete profile editing functionality
   - Add avatar upload capability
   - Implement profile viewing

3. **Shadow Sessions**:
   - Create UI for scheduling and joining shadow sessions
   - Implement the real-time shadow session experience
   - Add support for shadow session chat

4. **Connection Management**:
   - Build UI for sending, accepting, and managing friend requests
   - Implement connection suggestions algorithm
   - Add online status indicators

5. **Spaces and Circles**:
   - Complete UI for creating and joining spaces (groups)
   - Build UI for creating and managing circles (friend groups)
   - Implement post sharing to spaces and circles

6. **Post Engagement**:
   - Add reactions and comments UI to posts
   - Implement notification system for interactions

7. **Media Support**:
   - Complete file upload system for post media
   - Add media viewing capabilities

8. **Mobile Responsiveness**:
   - Ensure all UI components work well on mobile devices
   - Optimize layout for different screen sizes

## Implementation Plan

### Phase 1: Core User Experience (1-2 weeks)
- Complete home feed implementation with post creation
- Implement profile viewing and editing
- Add post engagement features (reactions, comments)

### Phase 2: Social Features (2-3 weeks)
- Build connection management UI
- Implement spaces and circles functionality
- Add notifications for social interactions

### Phase 3: Shadow Sessions (2-3 weeks)
- Create shadow session scheduling and joining UI
- Implement real-time shadow session experience
- Add shadow session chat functionality

### Phase 4: Polish and Optimization (1-2 weeks)
- Ensure mobile responsiveness
- Optimize performance
- Add final design touches and animations

## Technical Implementation Details

### Emotion Ring Implementation
The emotion ring is implemented as a component that surrounds the user's avatar with a gradient border. The gradient colors represent the user's selected emotions (up to 3). The implementation uses CSS gradients:

- For one emotion: Solid color
- For two emotions: Linear gradient (left to right)
- For three emotions: Conic gradient (divided into three equal parts)

### Authentication Flow
1. User registers or logs in through the auth forms
2. Passport.js authenticates the credentials
3. A session is created and stored in the database
4. The session ID is stored in a cookie
5. Subsequent requests include this cookie, which is used to identify the user
6. Protected routes check if the user is authenticated before rendering

### Post Privacy System
Posts can have different audience settings:
- Everyone: Visible to all users
- Friends: Only visible to connected users
- Just Me: Only visible to the post creator
- Friend Group: Only visible to members of specified friend groups
- Group: Only visible to members of specified groups

### Shadow Session System
Shadow sessions are a unique feature that allows users to connect in a deeper way:
1. A user creates a shadow session with a scheduled time
2. Other users can join the session
3. During the session time, participants can engage in shared activities
4. The session can be private (one-to-one), limited to a friend group, limited to a group, or public
5. Real-time updates are sent via WebSockets

## Database Schema Highlights

### Users and Profiles
- User accounts store authentication info (email, password)
- Profiles store display info (name, bio, avatar)

### Emotions
- 12 distinct emotions with names and color codes
- Posts can have up to 3 associated emotions

### Posts
- Support for text content and media
- Flexible audience settings
- Associated emotions

### Shadow Sessions
- Linked to a post
- Scheduled with start and end times
- Participants tracking

## WebSocket Events
- User online status updates
- New message notifications
- Shadow session status changes
- Post reactions and comments notifications

## Best Practices Implemented
- Secure password handling with salt and hashing
- Input validation using Zod schemas
- Session security with HTTP-only cookies
- Error handling with appropriate status codes
- Real-time updates with WebSockets
- Component-based UI architecture