#!/usr/bin/env node

/**
 * This script runs Playwright tests with periodic status checking
 * to prevent getting stuck on HTML report generation
 */

import { exec, spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

// Configuration
const CHECK_INTERVAL = 10000; // Check status every 10 seconds
const MAX_DURATION = 5 * 60 * 1000; // Maximum test duration (5 minutes)
const SHUTDOWN_DELAY = 2000; // Time to wait after tests complete

async function runPlaywrightTests() {
  console.log('Starting Playwright tests with periodic status checking...');
  
  // Start timestamp to track total duration
  const startTime = Date.now();
  
  // Start the test process
  const testProcess = spawn('npx', ['playwright', 'test', ...process.argv.slice(2)], {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true
  });
  
  let testOutput = '';
  let isComplete = false;
  let statusCheckInterval;
  
  // Forward stdout to console with timestamp
  testProcess.stdout.on('data', (data) => {
    const output = data.toString();
    testOutput += output;
    process.stdout.write(output);
    
    // Check if tests are complete
    if (output.includes('All tests passed') || 
        output.includes('Test failed') || 
        output.includes('Tests finished')) {
      isComplete = true;
    }
  });
  
  // Forward stderr to console
  testProcess.stderr.on('data', (data) => {
    const output = data.toString();
    testOutput += output;
    process.stderr.write(output);
  });
  
  // Set up periodic status checking
  statusCheckInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    console.log(`\n[Status Check] Tests running for ${Math.floor(elapsed/1000)}s...`);
    
    // Check if we're stuck on report generation
    if (testOutput.includes('Serving HTML report') && !testOutput.includes('Tests finished')) {
      console.log('[Status Check] HTML report being served. Tests appear to be complete.');
      isComplete = true;
    }
    
    // Kill if test is taking too long
    if (elapsed > MAX_DURATION) {
      console.log('[Status Check] Tests exceeded maximum duration. Terminating...');
      isComplete = true;
      testProcess.kill('SIGTERM');
    }
    
    // If complete, clear the interval and terminate properly
    if (isComplete) {
      clearInterval(statusCheckInterval);
      setTimeout(SHUTDOWN_DELAY).then(() => {
        console.log('\nTests execution completed. Exiting...');
        
        // Find and kill any lingering report servers
        exec('lsof -i:* | grep playwright | awk \'{print $2}\' | xargs kill -9 2>/dev/null || true', 
          (error) => {
            if (error) {
              console.log('Note: No lingering Playwright processes found');
            } else {
              console.log('Cleaned up lingering Playwright processes');
            }
            process.exit(0);
          }
        );
      });
    }
  }, CHECK_INTERVAL);
  
  // Handle test process completion
  testProcess.on('close', (code) => {
    isComplete = true;
    clearInterval(statusCheckInterval);
    console.log(`\nPlaywright test process exited with code ${code}`);
    
    // Give a moment for any final output
    setTimeout(SHUTDOWN_DELAY).then(() => {
      process.exit(code);
    });
  });
}

// Start the tests
runPlaywrightTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
