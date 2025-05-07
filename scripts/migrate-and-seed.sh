#!/bin/bash

# Constants for colored output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ -f .env ]; then
  echo -e "${BLUE}📂 Loading environment variables from .env file${NC}"
  source .env
else
  echo -e "${YELLOW}⚠️ No .env file found, using system environment variables${NC}"
fi

# Check for required environment variables
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ DATABASE_URL environment variable is required${NC}"
  echo -e "${YELLOW}💡 Create a .env file based on .env.example or set this variable in your environment${NC}"
  exit 1
fi

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo -e "${YELLOW}⚠️ SUPABASE_URL and/or SUPABASE_KEY not found. These are needed for some Supabase features.${NC}"
  echo -e "${YELLOW}  The database migration might still work with just DATABASE_URL, but some features might be limited.${NC}"
fi

# Run the migration script
echo -e "${BLUE}🚀 Running database migration to Supabase...${NC}"

# Use npx directly to avoid issues with the node script
echo -e "${BLUE}📝 Pushing schema to database...${NC}"
npx drizzle-kit push

# Check if migration was successful
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Migration script failed. Please check the error message above.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Database schema migrated successfully!${NC}"

# Run the seed script for emotions
echo -e "${BLUE}🌱 Seeding emotions data...${NC}"
node scripts/seed-emotions.js

# Check if seeding was successful
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Emotion seeding failed. Please check the error message above.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Migration and seeding completed!${NC}"
echo ""
echo -e "${BLUE}🎉 Your Shadow Me application is now configured to use Supabase!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "1. Start your application: ${YELLOW}npm run dev${NC}"
echo -e "2. Test user authentication and other features"
echo -e "3. Set up environment variables in production"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo ""
  echo -e "${RED}⚠️ Remember to set SUPABASE_URL and SUPABASE_KEY for full Supabase functionality${NC}"
fi