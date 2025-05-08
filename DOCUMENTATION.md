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
- Notifications

### 2. Authentication System
- Session-based authentication with Passport.js
- Secure password hashing using crypto's scrypt function
- Registration, login, and logout functionality
- Protected routes that redirect to auth page when not logged in

### 3. UI Components
- **EmotionSelector**: A component that allows users to select up to 3 emotions to express their current state
- **AvatarWithEmotion**: A component that displays a user's avatar with an emotion ring around it, visually representing selected emotions
- **Auth Forms**: Registration and login forms with validation
- **Profile Page**: User profile page with tabs for posts, shadow sessions, and media

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

### 6. Notification System
- Real-time notifications for user interactions
- Different notification types (friend requests, post likes, comments, etc.)
- Interactive notification bell with unread indicators
- Mark as read functionality (individual or all)
- Clickable notifications that navigate to the relevant content

## What Has Been Achieved

✅ **Database Schema**: Complete schema design with all required tables and relationships
✅ **Authentication System**: Registration, login, logout with secure password hashing
✅ **Core UI Components**: Emotion ring avatars and emotion selector
✅ **API Endpoints**: Comprehensive API design for all core features
✅ **Emotion Data**: Database seeded with 12 distinct emotions and colors
✅ **Protected Routing**: Implementation of route protection based on authentication status
✅ **Home Feed**: Implementation of feed with emotion filtering
✅ **User Profiles**: Basic profile viewing and editing functionality
✅ **Post Engagement**: Reactions and comments UI on posts
✅ **Shadow Sessions**: Implementation of shadow session components including real-time chat functionality
✅ **Connection Management**: Implementation of connection requests, accepting connections, and online status indicators
✅ **Notification System**: Implementation of notifications for social interactions with badge indicators and interactive UI
✅ **Media Support**: Implementation of file uploads for posts and shadow sessions with Supabase Storage integration
✅ **Circles Management**: Implementation of UI for creating and managing circles (friend groups) and adding/removing members
✅ **Spaces Management**: Implementation of UI for discovering, joining, and creating spaces (groups)

## What Remains to be Implemented

1. **User Profiles** (Implemented):
   ✅ Basic profile viewing
   ✅ Profile editing functionality
   ✅ Add avatar upload capability

2. **Shadow Sessions** (Mostly Implemented):
   ✅ Creating UI for scheduling shadow sessions
   ✅ Implementation of joining shadow sessions
   ✅ Real-time shadow session chat with WebSockets
   - Add additional shadow session activities and tools

3. **Connection Management** (Mostly Implemented):
   ✅ Build UI for sending, accepting, and managing friend requests
   ✅ Implement online status indicators
   - Enhance connection suggestions algorithm
   - Add offline/away status indicators

4. **Spaces and Circles** (Implemented):
   ✅ Complete UI for creating and joining spaces (groups)
   ✅ Build UI for creating and managing circles (friend groups)
   ✅ Add member management for circles
   ✅ Enhance post sharing to spaces and circles

5. **Post Engagement** (Mostly Implemented):
   ✅ Add reactions and comments UI to posts
   ✅ Implement notification system for interactions
   - Enhance engagement analytics

6. **Media Support** (Completed):
   ✅ Complete file upload system for post media
   ✅ Add media viewing capabilities
   ✅ Implement storage system with Supabase

7. **Mobile Responsiveness**:
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
- ✅ Add media sharing capabilities to shadow sessions

### Phase 4: Polish and Optimization (1-2 weeks)
- Ensure mobile responsiveness
- Optimize performance
- Add final design touches and animations

## Technical Implementation Details

### Emotion Ring Implementation
See "Emotion Ring — Spec & Implementation Guide.md" file

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

### Date Handling in Database Queries
All date values must be properly formatted before being used in SQL queries:
1. JavaScript Date objects are converted to ISO strings using `toISOString()`
2. When dealing with date ranges (such as for shadow sessions), both start and end dates are properly formatted
3. When creating shadow sessions, dates from form inputs are parsed and formatted correctly

### Shadow Session Implementation
Shadow sessions are implemented using a combination of components:

1. **CreateShadowSession**: A form component that allows users to create a new shadow session with title, description, date/time, and emotions.
2. **CreateShadowSessionDialog**: A dialog that wraps the CreateShadowSession component for use throughout the application.
3. **ShadowSessionCard**: A card component that displays a shadow session with its details and a real-time chat feature for active sessions.
4. **ShadowSessionChat**: A real-time chat component that uses WebSockets to enable participants to communicate during active sessions.
5. **ShadowSessionViewPage**: A dedicated page for viewing a specific shadow session with a full-screen chat interface when the session is active.

The shadow session feature uses React Hook Form with Zod for validation and sends data to the server using a FormData object. The real-time chat functionality is implemented using WebSockets, with the following features:

1. **Real-time messaging**: Participants can send and receive messages in real-time during active sessions
2. **Typing indicators**: Users can see when other participants are typing
3. **Participant management**: The UI displays who is currently in the session
4. **Session state synchronization**: The WebSocket connection keeps the session state synchronized across all participants

The WebSocket implementation includes:

1. **Server-side room management**: Each shadow session has its own virtual room managed by the server
2. **Authentication and authorization**: Only authenticated users who have joined a session can access its chat
3. **Message broadcasting**: Messages are broadcasted to all participants in real-time
4. **Connection management**: The server tracks active connections and handles reconnections gracefully

### Shadow Session Media Sharing

Shadow sessions now include media sharing capabilities, allowing participants to share images during active sessions. The implementation includes:

1. **Media Upload Component**: A dedicated UI component for selecting and uploading images to share with session participants
2. **Media Gallery**: A gallery view showing all media shared during a session
3. **Real-time Updates**: When media is shared, all participants receive real-time notifications via WebSockets
4. **Media Storage**: Images are securely stored in Supabase Storage with appropriate access controls
5. **Session Context**: Media can only be shared during active shadow sessions by participants

The media sharing functionality enhances the shadow session experience by allowing users to:

- Share visual context for discussion topics
- Create a more immersive shared experience
- Document key moments during shadow sessions
- Build a visual record of session activities

The media sharing process follows these steps:

1. User selects an image to share from their device
2. Client validates the file type and size (limiting to 5MB)
3. Image is uploaded to the server via a secure endpoint
4. Server validates the user's participation in the session
5. Image is stored in Supabase Storage with appropriate paths
6. A media message is created in the database
7. Real-time notification is sent to all session participants
8. The media gallery updates to display the new image

This implementation supports the following media formats:
- JPEG/JPG
- PNG
- GIF
- WebP

The component handles various edge cases:
- Session not active (disabled uploading)
- Invalid file types (shows error)
- Files too large (shows error)
- Network errors (provides feedback)
- Upload progress (shows loading state)

### Connection Management Implementation

The connection management system is implemented with a combination of components and API endpoints:

1. **ConnectionRequestButton**: A versatile button component that handles all connection states:
   - No connection: Shows a "Connect" button
   - Pending outgoing request: Shows a disabled "Request Sent" button
   - Pending incoming request: Shows "Accept" and "Decline" buttons
   - Connected: Shows a "Connected" button that can be used to remove the connection

2. **OnlineStatus**: A component that displays online status indicators with optional pulsating effects to show real-time presence. The component supports:
   - Multiple sizes to match different avatar sizes
   - Various status types (online, offline, away, busy)
   - Customizable positioning
   - Accessibility attributes for screen readers

3. **AvatarWithEmotion**: Enhanced to display online status indicators alongside emotion rings.

4. **API Endpoints**: The server provides several endpoints for connection management:
   - GET `/api/user/connections`: List all established connections
   - GET `/api/user/connections/pending`: List pending connection requests
   - GET `/api/user/connections/online`: List online connections
   - GET `/api/user/connection-status/:userId`: Check the connection status with a specific user
   - POST `/api/friends/request`: Send a connection request
   - POST `/api/friends/accept`: Accept a connection request
   - DELETE `/api/friends/request`: Reject a connection request
   - DELETE `/api/friends`: Remove an existing connection

The connection management implementation uses React Query for data fetching and mutations, with optimistic updates to provide a responsive user experience. When a user takes an action (such as sending a request), the UI updates immediately while the server request is processed in the background.

The system also provides clear visual feedback through toast notifications and button states to inform users about the status of their actions.

### Avatar Upload Implementation

The profile avatar upload system allows users to personalize their presence within the platform. The implementation includes:

1. **Avatar Upload UI**: A user-friendly interface for selecting and uploading profile pictures with preview functionality
2. **Client-side Validation**: Validation of file types and size limits before upload
3. **Server-side Storage**: Secure storage of avatar images using Supabase Storage
4. **Bucket Management**: A dedicated 'user-avatars' storage bucket for organizing user profile images
5. **Avatar Integration**: Display of user avatars throughout the application, enhancing user recognition

The avatar upload process follows these steps:

1. User selects an image file using the profile edit dialog
2. Client validates the file type (JPEG, PNG, GIF, WebP) and size (max 2MB)
3. A preview of the image is shown within the dialog before submission
4. On form submission, the image is uploaded to Supabase storage
5. The profile is updated with the new avatar URL
6. The UI is refreshed to display the new avatar

The implementation supports fallback mechanisms, including:
- Alternative storage buckets if the primary bucket is unavailable
- Default initials-based avatars when an image is not available
- Responsive sizing for different UI contexts

This feature enhances the personalization aspect of the platform, allowing users to express their identity visually, which is particularly important in a social platform focused on emotional expression.

## Troubleshooting Common Issues

### Emotions Not Displaying Correctly
If emotions are not displaying correctly in the UI (showing empty circles instead of colored buttons), check:

1. That the emotions data is properly seeded in the database (run `node scripts/check-emotions-table.js` to verify)
2. That the API data structure matches what the client expects:
   - The server returns emotions with properties: `emotion_id`, `emotion_name`, `emotion_color`
   - The client expects properties: `id`, `name`, `color`
   - A mapping in `server/routes.ts` transforms the data to match the expected client format

### Date Handling Errors
When working with dates in database queries, you may encounter errors like:
```TypeError [ERR_INVALID_ARG_TYPE]: The "string" argument must be of type string or an instance of Buffer or ArrayBuffer. Received an instance of Date
```

This occurs because the database driver expects string representations of dates, not JavaScript Date objects. 

#### Solution:
Always convert JavaScript Date objects to ISO strings before passing them to SQL queries:

```typescript
// Incorrect - will cause an error
const now = new Date();
db.select()
  .from(shadow_sessions)
  .where(gte(shadow_sessions.starts_at, sql`${now}`))

// Correct
const now = new Date();
const nowIsoString = now.toISOString();
db.select()
  .from(shadow_sessions)
  .where(gte(shadow_sessions.starts_at, sql`${nowIsoString}`))
```

This pattern should be applied to all methods that involve date comparisons:
- getUpcomingShadowSessions
- getActiveShadowSessions
- getUserJoinedShadowSessions
- getPastShadowSessions
- updateUserOnlineStatus

When creating shadow sessions, ensure the dates are properly parsed and formatted:

```typescript
// When handling date inputs from forms
const startsAtDate = new Date(starts_at);
const endsAtDate = new Date(ends_at);

// Then convert to ISO strings for database storage
formData.append('starts_at', startsAtDate.toISOString());
formData.append('ends_at', endsAtDate.toISOString());
```

### WebSocket Connection Issues
If you encounter WebSocket connection issues, check:
1. That the WebSocket server is running on the correct port
2. That the client is using the correct protocol (ws:// or wss:// depending on HTTP/HTTPS)
3. That user authentication is properly set up for WebSocket connections
4. That the browser supports WebSockets

### Authentication Problems
When dealing with authentication issues:
1. Verify that session cookies are being set correctly
2. Check that the isAuthenticated middleware is applied to protected routes
3. Ensure that the session store is properly configured
4. Validate that login credentials are being correctly verified

### Database Connection Errors
If you encounter database connection issues:
1. Verify the DATABASE_URL environment variable is set correctly
2. Ensure that the database schema is up to date by running migrations
3. Check database credentials and permissions
4. Verify that the connection pool is not exhausted

### Category Selection in Spaces
When implementing Select components with category filtering:
1. Avoid using empty strings (`""`) as values for `<SelectItem>` components when there will be multiple select options.
2. For "All Categories" or similar reset options, use a non-empty string value (e.g., "all") and handle it in your query logic:
   ```tsx
   // In component state
   const [selectedCategory, setSelectedCategory] = useState<string>("all");
   
   // In API request
   queryKey: ['/api/endpoint', { category: selectedCategory === "all" ? "" : selectedCategory }]
   ```
3. This approach prevents the "A <Select.Item /> must have a value prop that is not an empty string" error from Radix UI components.
4. Always filter out any category items with empty string IDs before rendering them as select options.

## Optimization Strategies

### Query Performance
To improve database query performance:
1. Use indexes for frequently queried columns
2. Limit result sets to only what is needed
3. Use pagination for large result sets
4. Consider caching for frequently accessed data

### Optimistic Updates for User Experience
To provide a more responsive user experience, we implement optimistic updates for key user actions:

#### Join Shadow Session Example
When a user joins a shadow session, we immediately update the UI to show them as a participant, even before the server confirms the action. This makes the application feel faster and more responsive.

```typescript
const joinSessionMutation = useMutation({
  mutationFn: async () => {
    return apiRequest('POST', `/api/shadow-sessions/${sessionId}/join`);
  },
  onMutate: async () => {
    // Cancel any outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['/api/shadow-sessions', sessionId, 'participants'] });
    
    // Snapshot the previous value
    const previousParticipants = queryClient.getQueryData(['/api/shadow-sessions', sessionId, 'participants']);
    
    // Optimistically update to the new value
    if (user && !participants.some(p => p.user_id === user.user_id)) {
      queryClient.setQueryData(
        ['/api/shadow-sessions', sessionId, 'participants'],
        [...participants, user]
      );
    }
    
    // Return the snapshot for potential rollback
    return { previousParticipants };
  },
  onError: (err, variables, context) => {
    // If the mutation fails, roll back to the previous state
    if (context?.previousParticipants) {
      queryClient.setQueryData(
        ['/api/shadow-sessions', sessionId, 'participants'],
        context.previousParticipants
      );
    }
  },
  onSuccess: () => {
    // On success, invalidate relevant queries to get the accurate data
    queryClient.invalidateQueries({ queryKey: ['/api/shadow-sessions', sessionId, 'participants'] });
    queryClient.invalidateQueries({ queryKey: ['/api/shadow-sessions/joined'] });
  }
});
```

#### Benefits of Optimistic Updates:
1. **Improved Perceived Performance**: Users don't have to wait for network requests to complete before seeing the results of their actions
2. **Reduced Perceived Latency**: The application feels more responsive, especially on slower networks
3. **Better User Experience**: Immediate feedback keeps users engaged and confident their actions are being processed
4. **Graceful Error Handling**: By tracking the previous state, we can cleanly revert if an error occurs

For critical actions like creating posts, joining sessions, or sending messages, implementing optimistic updates significantly improves the user experience.

### Real-time Updates
For efficient real-time updates:
1. Use targeted WebSocket events instead of broadcasting to all clients
2. Implement debouncing for frequently changing data
3. Consider using Redis for pub/sub functionality
4. Batch updates when possible to reduce connection overhead

### Frontend Performance
To optimize frontend performance:
1. Implement code splitting to reduce initial load times
2. Use React.memo and useMemo to prevent unnecessary re-renders
3. Optimize image loading with proper sizing and formats
4. Implement virtualized lists for large data sets

## Future Development Roadmap

### Short-term Goals (1-2 months)
1. Complete all shadow session functionality
2. Enhance profile customization options
3. Improve mobile responsiveness
4. Add notification system

### Medium-term Goals (3-6 months)
1. Implement advanced privacy controls
2. Add multimedia sharing in shadow sessions
3. Create mobile applications using React Native
4. Develop analytics dashboard for user engagement

### Long-term Vision (6+ months)
1. Implement AI-based emotion recognition from text
2. Create community-driven emotion taxonomy
3. Develop API for third-party integrations
4. Expand to additional platforms