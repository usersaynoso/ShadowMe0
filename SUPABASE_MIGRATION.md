# Migrating Shadow Me to Supabase

This guide provides instructions for migrating the Shadow Me application from a generic PostgreSQL database to Supabase.

## Prerequisites

Before beginning the migration, ensure you have:

1. A Supabase account and project created
2. Supabase API credentials (URL and API key)
3. Node.js 18+ installed

## Setup Supabase Environment Variables

Add the following environment variables to your project:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-service-role-key
DATABASE_URL=postgres://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-ID].supabase.co:6543/postgres
```

You can find these values in your Supabase project dashboard under Settings > API.

## Migration Steps

### 1. Install Required Packages

The project already has the necessary packages installed:
- `@supabase/supabase-js`: Supabase JavaScript client
- `postgres`: PostgreSQL client for JavaScript
- `pg`: PostgreSQL client for Node.js (used by connect-pg-simple for sessions)

### 2. Update Database Connection

The database connection has been updated in `server/db.ts` to use Supabase:

```typescript
import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

// Check if Supabase credentials are available
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_KEY must be set. Did you forget to add these secrets?",
  );
}

// Create Supabase client
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Extract connection string from Supabase
const connectionString = `${process.env.DATABASE_URL}`;

// Use postgres.js with the connection string
const client = postgres(connectionString, { max: 10 });

// Create Drizzle ORM instance with the postgres client
export const db = drizzle(client, { schema });
```

### 3. Update Session Store

The session store configuration has been updated in `server/storage.ts` to use Supabase PostgreSQL:

```typescript
import pg from 'pg';
import connectPg from "connect-pg-simple";
import session from "express-session";

const PostgresSessionStore = connectPg(session);

// In the DatabaseStorage constructor:
const pgPool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL 
});

this.sessionStore = new PostgresSessionStore({
  pool: pgPool,
  createTableIfMissing: true
});
```

### 4. Run Database Migration

To push your database schema to Supabase:

```bash
# Make the migration script executable
chmod +x scripts/migrate-and-seed.sh

# Run the migration script
./scripts/migrate-and-seed.sh
```

This will:
1. Push the database schema using Drizzle Kit
2. Seed the emotions table with the 12 emotions

### 5. Direct Supabase API Access

For certain operations, you may want to use the Supabase client directly. The client is exported from `server/db.ts`:

```typescript
import { supabase } from './db';

// Example: Upload a file to Supabase Storage
const { data, error } = await supabase
  .storage
  .from('avatars')
  .upload('public/avatar1.png', imageFile);
```

## Storage Buckets Setup

If your application uses file uploads, you'll need to create storage buckets in Supabase:

1. Go to Storage in your Supabase dashboard
2. Create the following buckets:
   - `avatars`: For user profile pictures
   - `post-media`: For media attached to posts

For each bucket, set the appropriate access policies:

- For `avatars`:
  - Allow anyone to read (public access)
  - Only allow authenticated users to upload to their own folder

- For `post-media`:
  - Allow anyone to read (public access)
  - Only allow authenticated users to upload

## Using Supabase Auth (Optional Future Enhancement)

Currently, the application uses custom authentication with Passport.js. If you'd like to switch to Supabase Auth in the future:

1. Update client-side authentication to use Supabase Auth methods
2. Replace the server-side authentication in `server/auth.ts`
3. Update protected routes to verify Supabase JWT tokens

## Troubleshooting

### Connection Issues

If you encounter connection issues:

1. Verify your `DATABASE_URL` format is correct
2. Check if your IP is allowlisted in Supabase dashboard
3. Ensure your database password is correctly URL-encoded

### Schema Migration Issues

If schema migration fails:

1. Check Supabase SQL editor for error logs
2. Verify you have the right permissions (service role key should be used)
3. Try running the migration commands manually:

```bash
npx drizzle-kit push:pg
node scripts/seed-emotions.js
```

### Session Store Issues

If sessions are not persisting:

1. Check if the `session` table was created in your database
2. Verify your PostgreSQL connection is working
3. Check for any SSL certificate issues in your connection

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Drizzle Kit Documentation](https://orm.drizzle.team/kit-docs/overview)