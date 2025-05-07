#!/bin/bash

# Run Drizzle Kit to push schema changes to Supabase
echo "🚀 Migrating database schema to Supabase..."
npx drizzle-kit push:pg

# Check if migration was successful
if [ $? -ne 0 ]; then
  echo "❌ Schema migration failed. Please check the error message above."
  exit 1
fi

echo "✅ Database schema migrated successfully!"

# Run the seed script for emotions
echo "🌱 Seeding emotions data..."
node scripts/seed-emotions.js

echo "✅ Migration and seeding completed!"
echo ""
echo "Next steps:"
echo "1. Verify database connection in your application"
echo "2. Update your environment variables to use Supabase in production"