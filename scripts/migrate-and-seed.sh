#!/bin/bash

# Set strict mode
set -e

# Load environment variables
source .env

# Color definitions
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Print header
echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}     Shadow Me - Database Migration Script    ${NC}"
echo -e "${BLUE}==============================================${NC}"
echo ""

# Check for required environment variables
if [[ -z "${SUPABASE_URL}" || -z "${SUPABASE_KEY}" ]]; then
  echo -e "${RED}Error: SUPABASE_URL and SUPABASE_KEY environment variables must be set.${NC}"
  echo -e "${YELLOW}Please create a .env file with these variables or set them in your environment.${NC}"
  exit 1
fi

# Confirm with the user
echo -e "${YELLOW}WARNING: This script will migrate your database to Supabase.${NC}"
echo -e "${YELLOW}Make sure you have a backup of your data before proceeding.${NC}"
echo -e "${YELLOW}Do you want to continue? (y/n)${NC}"

read -r confirmation
if [[ "$confirmation" != "y" && "$confirmation" != "Y" ]]; then
  echo -e "${BLUE}Migration cancelled by user.${NC}"
  exit 0
fi

echo -e "${PURPLE}Step 1: Testing Supabase connection...${NC}"
node scripts/check-supabase-connection.js
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to connect to Supabase. Please check your credentials.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Supabase connection successful.${NC}"
echo ""

# Execute the migration script
echo -e "${PURPLE}Step 2: Executing migration script...${NC}"
node scripts/execute-migration.js
if [ $? -ne 0 ]; then
  echo -e "${RED}Migration failed. See error message above.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Migration completed successfully.${NC}"
echo ""

# Check if emotions table was created and seeded
echo -e "${PURPLE}Step 3: Verifying emotions table...${NC}"
node scripts/check-emotions-table.js
if [ $? -ne 0 ]; then
  echo -e "${YELLOW}⚠ Emotions table verification failed. Attempting to seed emotions data...${NC}"
  
  # Seed emotions data if needed
  node scripts/seed-emotions.js
  if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to seed emotions data.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Emotions data seeded successfully.${NC}"
else
  echo -e "${GREEN}✓ Emotions table verified successfully.${NC}"
fi
echo ""

# Verify all tables
echo -e "${PURPLE}Step 4: Verifying all tables...${NC}"
node scripts/check-supabase-tables.js
if [ $? -ne 0 ]; then
  echo -e "${RED}Table verification failed. Some tables may not have been created properly.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ All tables created successfully.${NC}"
echo ""

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}     Migration to Supabase completed!        ${NC}"
echo -e "${GREEN}==============================================${NC}"
echo ""
echo -e "${BLUE}Your application is now connected to Supabase.${NC}"
echo -e "${YELLOW}Remember to update your .env file to use Supabase credentials for production.${NC}"
echo ""

exit 0