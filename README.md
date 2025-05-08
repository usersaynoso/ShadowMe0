# Shadow Me

Shadow Me is a gentle, emotionally supportive social platform where users connect through mood-based updates, color-coded emotion rings, and shadow sessions.

## Overview

Shadow Me is designed to be a more intentional and emotionally aware social platform. Key features include:

- **Emotion Rings**: Users can express their current emotional state through color-coded rings around their avatars
- **Shadow Sessions**: Scheduled sessions where users can connect in a deeper way through shared activities
- **Audience Controls**: Flexible privacy settings for posts (everyone, friends, just me, friend groups, or specific groups)
- **Real-time Presence**: See which friends are online and available for connection

## Technology Stack

- **Frontend**: React with TypeScript and Vite
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM (migrated to Supabase)
- **Authentication**: Passport.js with local strategy
- **Real-time**: WebSockets for live updates
- **Styling**: Tailwind CSS with shadcn/ui components
- **Cloud Services**: Supabase for database and storage

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up the environment variables:
   ```
   DATABASE_URL=postgres://postgres:[PASSWORD]@db.[YOUR-PROJECT-ID].supabase.co:6543/postgres
   SESSION_SECRET=your_session_secret
   SUPABASE_URL=https://[YOUR-PROJECT-ID].supabase.co
   SUPABASE_KEY=your_supabase_service_role_key
   ```
4. Push the database schema:
   ```bash
   npm run db:push
   ```
5. Seed the emotions data:
   ```bash
   node scripts/seed-emotions.js
   ```
6. Start the server:
   ```bash
   npm run server
   ```

For detailed migration instructions, see [SUPABASE_MIGRATION.md](./SUPABASE_MIGRATION.md).

## Project Structure

```
├── client/               # Frontend React application
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utility functions
│   │   ├── pages/        # Page components
│   │   └── types/        # TypeScript type definitions
├── server/               # Backend Express server
│   ├── auth.ts           # Authentication setup
│   ├── db.ts             # Database connection
│   ├── index.ts          # Entry point
│   ├── routes.ts         # API routes
│   ├── storage.ts        # Database storage interface
│   ├── vite.ts           # Vite integration
│   └── websocket.ts      # WebSocket setup
├── shared/               # Shared code between client and server
│   └── schema.ts         # Database schema definitions
└── uploads/              # Media uploads directory
```

## Key Components

### EmotionSelector

The `EmotionSelector` component allows users to select unlimited emotions to represent their current state. These emotions are displayed as a gradient around their avatar.

### AvatarWithEmotion

The `AvatarWithEmotion` component displays user avatars with a color-coded emotion ring, visualizing the user's selected emotions. It now also shows online status indicators to display the user's presence status.

### ProfileEditDialog

The `ProfileEditDialog` component provides a comprehensive interface for users to edit their profile information. It includes fields for display name and bio, as well as functionality to upload and preview avatar images. The component supports various image formats and includes validation for file types and sizes.

### ConnectionRequestButton

The `ConnectionRequestButton` component provides a unified interface for managing user connections. It automatically adapts to different connection states (none, pending, connected) and provides appropriate actions for each state.

### OnlineStatus

The `OnlineStatus` component displays a color-coded indicator to show user presence status (online, offline, away, busy) with optional pulsating animation for real-time presence indication.

### Circles

The `Circles` feature allows users to organize their connections into groups for more targeted sharing and interaction. Key capabilities include:

- Create custom circles with descriptive names and optional descriptions
- Add and remove connections from circles
- Manage circle membership with intuitive user interfaces
- Filter circles by name
- Share posts with specific circles using the audience selector
- Visualize circles with appropriate icons based on their names

### Profile Page

The `ProfilePage` component displays user information, posts, and shadow sessions with a tabbed interface. It shows different options based on whether the viewer is looking at their own profile or another user's profile. Users can edit their own profiles by updating their display name and bio, and now can also upload and manage profile avatars.

### Shadow Sessions

Shadow sessions allow users to connect in a more meaningful way by scheduling time for shared activities, whether that's reading together, meditating, or simply keeping each other company while working on separate tasks.

#### Real-time Shadow Session Chat

The platform includes a real-time chat system for shadow sessions, allowing participants to communicate during active sessions. The chat features typing indicators, participant presence, and message history. The WebSocket-based implementation ensures that messages are delivered instantly to all participants in the session.

#### Media Sharing in Shadow Sessions

Shadow sessions now include media sharing capabilities, allowing participants to share images with each other during active sessions. This feature enhances the shadow session experience by enabling users to share visual context, document key moments, and create a more immersive shared environment. The media gallery provides a collection of all shared media accessible to session participants.

#### Shadow Session View

Each shadow session has its own dedicated page where users can see session details, join the session, and chat with other participants in real-time when the session is active. The view shows the host, participants, session time, and other relevant information.

### MediaGallery

The `MediaGallery` component provides a flexible way to display post media attachments. It supports both single and multiple images in a responsive grid layout, with a lightbox feature for expanded viewing. The gallery handles different media types (images, videos) and provides intuitive navigation controls for browsing through multiple media items. For optimal performance, it implements lazy loading and proper image sizing based on the viewport.

### NotificationBell

The `NotificationBell` component provides a centralized notification center for users. It displays a bell icon with a badge showing the number of unread notifications. When clicked, it opens a dropdown displaying recent notifications with information about who triggered them and when. Notifications are interactive and clicking them navigates the user to the relevant content. The component supports marking individual notifications as read or clearing all notifications at once.

## API Endpoints

See [DOCUMENTATION.md](./DOCUMENTATION.md) for a complete list of API endpoints and their descriptions.

## Implementation Guide

For detailed implementation examples of key features, see [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md).

## Authentication

Shadow Me uses session-based authentication with Passport.js. Passwords are securely hashed using the scrypt algorithm with unique salts.

## Database Schema

The database schema is defined in `shared/schema.ts` using Drizzle ORM. This creates a single source of truth for both the backend database and frontend TypeScript types.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.