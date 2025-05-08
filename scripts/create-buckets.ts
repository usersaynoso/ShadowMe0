import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxFileSize: 5 * 1024 * 1024 // 5MB
  },
  {
    id: 'shadow-session-media',
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxFileSize: 10 * 1024 * 1024 // 10MB
  },
  {
    id: 'user-avatars',
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxFileSize: 2 * 1024 * 1024 // 2MB
  }
];

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
  } catch (error) {
    console.error('Error during bucket creation:', error);
  }
}

// Run the script
createBuckets()
  .catch(console.error)
  .finally(() => {
    console.log('Script completed');
    process.exit(0);
  }); 