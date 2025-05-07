# Supabase Migration Guide

This document outlines the process for migrating the Shadow Me application from a standard PostgreSQL database to Supabase.

## Prerequisites

Before migrating, ensure you have:

1. A Supabase account and project created
2. The following environment variables set:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_KEY`: Your Supabase service role API key (not the anon key)
   - `DATABASE_URL`: The PostgreSQL connection string to your Supabase database

## Migration Process

The migration process has been automated with a set of scripts to ensure a smooth transition to Supabase:

1. **Check Prerequisites**: Verifies all required environment variables are set
2. **Test Connection**: Confirms connectivity to your Supabase project
3. **Check Existing Tables**: Determines if migration is needed by checking if tables already exist
4. **Run Migration**: Creates tables and relationships in correct dependency order
5. **Check Data**: Verifies the emotions table contains required data
6. **Seed Emotions**: Seeds default emotions if necessary

You can run the entire process with a single command:

```bash
node scripts/migrate-and-verify.js
```

## Key Files

- `migrations/complete-migration.sql`: Contains the entire database schema
- `scripts/migrate-and-verify.js`: Main orchestration script for migration
- `scripts/check-supabase-connection.js`: Tests connectivity to Supabase
- `scripts/check-supabase-tables.js`: Verifies tables exist in Supabase
- `scripts/execute-migration.js`: Executes the SQL migration script
- `scripts/check-emotions-table.js`: Verifies emotions data exists
- `scripts/seed-emotions.js`: Seeds the emotions table with default values

## Important Technical Considerations

### Timestamp Handling

When working with Supabase and timestamps in Drizzle ORM, use the SQL template literal syntax for proper date handling:

```javascript
// ❌ Incorrect: This may cause type errors
.where(lte(table.timestamp_column, new Date().toISOString()))

// ✅ Correct: Use SQL template literals for dates
.where(lte(table.timestamp_column, sql`${new Date()}`))
```

This approach ensures proper type conversion between JavaScript dates and PostgreSQL timestamp types.

### Custom Primary Keys

Supabase works best with UUID primary keys. Our migration ensures all tables use UUID primary keys with proper indexing.

### Session Management

The migration includes setup for an express-session compatible session table in Supabase for persistent sessions.

## Troubleshooting

If you encounter issues during migration:

1. **Connection Problems**: Verify your SUPABASE_URL and SUPABASE_KEY environment variables
2. **Permission Errors**: Ensure you're using the service role key (not the anon key)
3. **Query Errors**: Check the migration SQL for syntax issues
4. **Timestamp Errors**: Verify date handling uses sql template literals

For specific errors, check the console output from the migration scripts for detailed error messages.

## Post-Migration Verification

After migration, you can verify the database is properly set up:

```bash
node scripts/check-supabase-tables.js
```

This will list all tables and their row counts, confirming the migration was successful.