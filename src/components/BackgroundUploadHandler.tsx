/**
 * BackgroundUploadHandler
 * 
 * This component initializes the background upload system and processes
 * any pending uploads that may have been queued from previous sessions.
 * Also handles detecting and marking stuck uploads as failed.
 * 
 * Place this component near the root of your app to ensure uploads
 * from previous sessions are processed on app load.
 * 
 * RACE CONDITION HANDLING:
 * - Uses ref to prevent duplicate initialization
 * - Waits for service worker before processing
 * - Uses proper async/await sequencing
 */

import { useEffect, useRef } from 'react';
import { 
  registerUploadServiceWorker, 
  triggerBackgroundUpload, 
  getPendingUploadCount 
} from '@/lib/backgroundUploader';
import { fixAllStuckUploads } from '@/lib/uploadTimeoutHandler';
import { isUploadProcessingLocked } from '@/lib/uploadLock';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

export const BackgroundUploadHandler: React.FC = () => {
  const hasProcessed = useRef(false);
  const isProcessing = useRef(false);

  useEffect(() => {
    // Double-check with refs to prevent race conditions from StrictMode
    if (hasProcessed.current || isProcessing.current) return;
    isProcessing.current = true;

    const initBackgroundUploads = async () => {
      try {
        // Mark as processed early to prevent duplicate calls
        hasProcessed.current = true;
        
        // Step 1: Register service worker first (required for background sync)
        logger.proctoring('[BackgroundUploadHandler] Step 1: Registering service worker...');
        await registerUploadServiceWorker();
        
        // Step 2: Fix any stuck uploads (those that have been uploading for too long)
        logger.proctoring('[BackgroundUploadHandler] Step 2: Checking for stuck uploads...');
        const fixedCount = await fixAllStuckUploads();
        if (fixedCount > 0) {
          logger.proctoring(`[BackgroundUploadHandler] Fixed ${fixedCount} stuck uploads`);
        }
        
        // Step 3: Check if another upload process is already running
        if (isUploadProcessingLocked()) {
          logger.proctoring('[BackgroundUploadHandler] Upload processing already in progress, skipping');
          return;
        }
        
        // Step 4: Check for pending uploads
        const pendingCount = await getPendingUploadCount();
        
        if (pendingCount > 0) {
          logger.proctoring(`[BackgroundUploadHandler] Found ${pendingCount} pending uploads from previous session`);
          
          // Show toast to inform user
          toast({
            title: "Processing Previous Uploads",
            description: `Uploading ${pendingCount} recording(s) from your previous session...`,
          });
          
          // Step 5: Trigger processing (will skip if already locked)
          await triggerBackgroundUpload();
          
          // Step 6: Check again after a delay to see if uploads completed
          setTimeout(async () => {
            try {
              const remaining = await getPendingUploadCount();
              if (remaining === 0) {
                toast({
                  title: "Uploads Complete",
                  description: "All previous recordings have been uploaded successfully.",
                });
              } else if (remaining < pendingCount) {
                toast({
                  title: "Uploads In Progress",
                  description: `${pendingCount - remaining} of ${pendingCount} uploads completed. The rest will continue in background.`,
                });
              }
            } catch (e) {
              logger.error('[BackgroundUploadHandler] Error checking remaining uploads:', e);
            }
          }, 10000); // Check after 10 seconds
        } else {
          logger.proctoring('[BackgroundUploadHandler] No pending uploads found');
        }
      } catch (error) {
        logger.error('[BackgroundUploadHandler] Error initializing:', error);
      } finally {
        isProcessing.current = false;
      }
    };

    initBackgroundUploads();
  }, []);

  // This component renders nothing
  return null;
};

export default BackgroundUploadHandler;
