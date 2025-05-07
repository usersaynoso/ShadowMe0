# Supabase Migration Guide for Shadow Me

This guide explains how to migrate the Shadow Me application database from a local PostgreSQL database to Supabase.

## Prerequisites

1. A Supabase account and project
2. Supabase project URL and service role key
3. Node.js and NPM installed

## Required Environment Variables

Create a `.env` file in the project root with the following variables:

```
# Supabase configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-service-role-key

# Database connection string (Supabase PostgreSQL)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[HOST]:[PORT]/postgres?sslmode=require
```

## Migration Process

### Automatic Migration

The easiest way to migrate is to use the provided migration script:

```bash
# Make the script executable
chmod +x scripts/migrate-and-seed.sh

# Run the migration script
./scripts/migrate-and-seed.sh
```

This script will:
1. Check for required environment variables
2. Generate SQL migration scripts from the Drizzle schema
3. Execute the SQL against your Supabase PostgreSQL database
4. Seed the emotions data (if needed)

### Manual Migration (Step by Step)

If you prefer to run the migration steps manually:

1. **Generate the SQL migration script**:
   ```bash
   node scripts/generate-schema-sql.js
   ```
   This will create SQL files in the `migrations` folder.

2. **Execute the SQL migration**:
   ```bash
   node scripts/execute-schema-sql.js
   ```
   This will execute the SQL against your Supabase PostgreSQL database.

3. **Seed the emotions data**:
   ```bash
   node scripts/seed-emotions.js
   ```
   This will add the default emotions to your database.

4. **Check the emotions table**:
   ```bash
   node scripts/check-emotions-table.js
   ```
   This will verify that the emotions table exists and has data.

## Troubleshooting

### Connection Issues

If you encounter connection issues, check:

1. Make sure your Supabase project is active
2. Verify your DATABASE_URL is correct
3. Ensure your network allows connections to Supabase
4. Check if the database is in a sleep state (free tier limitation)

### Schema Conflicts

If you see errors about existing tables or relations:

1. The tables already exist in your Supabase project
2. You can safely ignore "relation already exists" errors during migration
3. If you need a fresh start, you can drop the existing tables via the Supabase dashboard

### Authentication Issues

If authentication fails after migration:

1. Check that your `SUPABASE_URL` and `SUPABASE_KEY` are correct
2. Verify the database has the correct users table
3. Ensure the application can connect to Supabase

## Post-Migration

After migration, update your application configuration:

1. Make sure your production environment has the correct environment variables
2. Update any deployment configurations to use Supabase
3. Test all authentication and database features

## Reverting the Migration

If you need to revert to a local database:

1. Update your DATABASE_URL to point to your local PostgreSQL instance
2. Run the migration scripts against your local database
3. Remove or comment out the Supabase-specific environment variables