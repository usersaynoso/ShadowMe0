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
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with local strategy
- **Real-time**: WebSockets for live updates
- **Styling**: Tailwind CSS with shadcn/ui components

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
   DATABASE_URL=postgres://user:password@localhost:5432/shadow_me
   SESSION_SECRET=your_session_secret
   ```
4. Push the database schema:
   ```bash
   npm run db:push
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```

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

The `EmotionSelector` component allows users to select up to three emotions to represent their current state. These emotions are displayed as a gradient around their avatar.

### AvatarWithEmotion

The `AvatarWithEmotion` component displays user avatars with a color-coded emotion ring, visualizing the user's selected emotions.

### Shadow Sessions

Shadow sessions allow users to connect in a more meaningful way by scheduling time for shared activities, whether that's reading together, meditating, or simply keeping each other company while working on separate tasks.

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