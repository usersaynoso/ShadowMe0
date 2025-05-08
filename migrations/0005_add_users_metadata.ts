import { sql } from 'drizzle-orm';
import { db } from '../server/db';

async function main() {
  console.log('Running migration: Add users_metadata table');
  
  try {
    // Check if table already exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users_metadata'
      );
    `);
    
    // Handle the result depending on the db driver
    const exists = tableExists[0]?.exists || 
                tableExists.rows?.[0]?.exists || 
                Object.values(tableExists[0] || {})[0];
    
    if (exists) {
      console.log('Table users_metadata already exists, skipping creation');
    } else {
      // Create users_metadata table
      await db.execute(sql`
        CREATE TABLE "users_metadata" (
          "metadata_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "user_id" UUID UNIQUE REFERENCES "users"("user_id") ON DELETE CASCADE,
          "last_emotions" JSONB,
          "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      
      console.log('Successfully created users_metadata table');
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main().then(() => process.exit(0)); 