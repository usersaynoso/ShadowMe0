#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}    Shadow Me - Supabase Migration Tool    ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Ensure we're in the project root
cd "$(dirname "$0")/.."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ DATABASE_URL environment variable is required${NC}"
  echo -e "${YELLOW}💡 Create a .env file based on .env.example or set this variable in your environment${NC}"
  exit 1
fi

# Check if SUPABASE_URL and SUPABASE_KEY are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo -e "${YELLOW}⚠️ SUPABASE_URL and/or SUPABASE_KEY not found. These are needed for some Supabase features.${NC}"
  echo -e "${YELLOW}  The database migration might still work with just DATABASE_URL, but some features might be limited.${NC}"
fi

# Generate SQL migration scripts
echo -e "${BLUE}📝 Generating SQL migration scripts...${NC}"

if ! node scripts/generate-schema-sql.js; then
  echo -e "${RED}❌ Failed to generate SQL migration scripts. Please check the error message above.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ SQL migration scripts generated!${NC}"

# Run the SQL migration
echo -e "${BLUE}🚀 Executing SQL migration against Supabase database...${NC}"

if ! node scripts/execute-schema-sql.js; then
  echo -e "${RED}❌ Failed to execute SQL migration. Please check the error message above.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Database schema migrated successfully!${NC}"

# Run the seed script for emotions
echo -e "${BLUE}🌱 Seeding emotions data...${NC}"

if ! node scripts/seed-emotions.js; then
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