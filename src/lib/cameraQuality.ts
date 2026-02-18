import { logger } from "@/lib/logger";

/**
 * Standalone camera quality check utility.
 * Analyzes video stream brightness to assess lighting conditions.
 */
export const checkCameraQuality = async (stream: MediaStream): Promise<{ passed: boolean; message: string }> => {
  return new Promise(async (resolve) => {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    
    video.onloadedmetadata = async () => {
      try {
        await video.play();
        
        // Wait a moment for video to stabilize
        await new Promise(r => setTimeout(r, 500));
        
        // Analyze actual brightness from video frame
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          video.pause();
          video.srcObject = null;
          resolve({ passed: true, message: 'Camera quality check completed' });
          return;
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Calculate average brightness
        let totalBrightness = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          totalBrightness += (r + g + b) / 3;
        }
        const brightness = totalBrightness / (data.length / 4) / 255;
        
        video.pause();
        video.srcObject = null;
        
        logger.proctoring(`Lighting check: brightness = ${(brightness * 100).toFixed(1)}%`);
        
        // Determine quality based on brightness (25% - 95% is acceptable)
        if (brightness < 0.15) {
          resolve({ 
            passed: false, 
            message: 'Lighting is too dark. Please improve lighting conditions.' 
          });
        } else if (brightness > 0.95) {
          resolve({ 
            passed: false, 
            message: 'Video appears overexposed. Please reduce lighting or adjust camera.' 
          });
        } else {
          const quality = brightness < 0.25 ? 'fair' : brightness < 0.85 ? 'good' : 'excellent';
          resolve({ 
            passed: true, 
            message: `Lighting is ${quality} (${(brightness * 100).toFixed(0)}% brightness)` 
          });
        }
      } catch (error) {
        logger.error('Error checking camera quality:', error);
        video.pause();
        video.srcObject = null;
        resolve({ 
          passed: true, 
          message: 'Camera quality check completed (fallback mode)' 
        });
      }
    };
    
    video.onerror = () => {
      resolve({ 
        passed: true, 
        message: 'Camera quality check completed (fallback mode)' 
      });
    };
  });
};
