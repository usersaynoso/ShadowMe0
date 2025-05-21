import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check for command line arguments
const args = process.argv.slice(2);
const checkOnly = args.includes('--check-only');

// Validate environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_KEY must be set in your .env file');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Define buckets to create
const bucketsToCreate = [
  {
    id: 'post-media',
    public: true,
    allowedMimeTypes: [
      'image/jpeg', 
      'image/png', 
      'image/gif', 
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/webm'
    ],
    maxFileSize: 25 * 1024 * 1024 // Increased to 25MB for videos
  },
  {
    id: 'shadow-session-media',
    public: true,
    allowedMimeTypes: [
      'image/jpeg', 
      'image/png', 
      'image/gif', 
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/webm'
    ],
    maxFileSize: 25 * 1024 * 1024 // Increased to 25MB for videos
  },
  {
    id: 'user-avatars',
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxFileSize: 2 * 1024 * 1024 // 2MB
  }
];

// Test Supabase connection only
async function testConnection() {
  console.log('Testing Supabase connection...');
  
  try {
    // Simple API call to check connection
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      throw new Error(`Connection error: ${error.message}`);
    }
    
    console.log('Supabase connection successful!');
    return true;
  } catch (error) {
    console.error('Connection failed:', error);
    return false;
  }
}

// Create buckets if they don't exist
async function createBuckets() {
  console.log('Checking and creating Supabase storage buckets...');
  
  try {
    // Get existing buckets
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      throw new Error(`Error listing buckets: ${listError.message}`);
    }
    
    const existingBucketIds = existingBuckets?.map(bucket => bucket.id) || [];
    
    // Create buckets that don't exist
    for (const bucket of bucketsToCreate) {
      if (!existingBucketIds.includes(bucket.id)) {
        console.log(`Creating bucket: ${bucket.id}`);
        
        const { error } = await supabase.storage.createBucket(bucket.id, {
          public: bucket.public
        });
        
        if (error) {
          console.error(`Error creating bucket ${bucket.id}:`, error.message);
        } else {
          console.log(`Bucket ${bucket.id} created successfully`);
          
          // Update bucket configuration
          const { error: updateError } = await supabase.storage.updateBucket(bucket.id, {
            public: bucket.public,
            fileSizeLimit: bucket.maxFileSize
          });
          
          if (updateError) {
            console.error(`Error updating bucket ${bucket.id} configuration:`, updateError.message);
          }
        }
      } else {
        console.log(`Bucket ${bucket.id} already exists`);
      }
    }
    
    console.log('Storage bucket setup complete');
    return true;
  } catch (error) {
    console.error('Error during bucket creation:', error);
    return false;
  }
}

// Main function
async function main() {
  try {
    if (checkOnly) {
      // Only test the connection
      const success = await testConnection();
      process.exit(success ? 0 : 1);
    } else {
      // Test connection and create buckets
      const connectionSuccess = await testConnection();
      if (!connectionSuccess) {
        process.exit(1);
      }
      
      const bucketsSuccess = await createBuckets();
      process.exit(bucketsSuccess ? 0 : 1);
    }
  } catch (error) {
    console.error('Script error:', error);
    process.exit(1);
  }
}

// Run the script
main(); 