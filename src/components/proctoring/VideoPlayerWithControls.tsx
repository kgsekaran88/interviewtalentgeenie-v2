import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { 
  Play, Pause, FastForward, Rewind, Volume2, VolumeX, 
  Maximize, SkipForward, SkipBack, Loader2 
} from 'lucide-react';
import { logger } from '@/lib/logger';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VideoPlayerWithControlsProps {
  src: string;
  posterSrc?: string;
  onTimeUpdate?: (currentTime: number) => void;
  initialTime?: number;
  className?: string;
  errorHelpText?: string;
  errorActions?: React.ReactNode;
}

const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const VideoPlayerWithControls: React.FC<VideoPlayerWithControlsProps> = ({ 
  src,
  posterSrc,
  onTimeUpdate, 
  initialTime = 0,
  className = '',
  errorHelpText,
  errorActions,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekableEnd, setSeekableEnd] = useState(0);
  const [isCalculatingDuration, setIsCalculatingDuration] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Reset player state when the source changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setSeekableEnd(0);
    setIsCalculatingDuration(true);
    setLoadError(null);
  }, [src]);

  // Handle metadata loaded
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateSeekable = () => {
      try {
        if (video.seekable && video.seekable.length > 0) {
          const end = video.seekable.end(video.seekable.length - 1);
          if (isFinite(end)) {
            setSeekableEnd((prev) => (end > prev ? end : prev));
          }
        }
      } catch {
        // ignore
      }
    };

    const handleLoadedMetadata = () => {
      setLoadError(null);

      if (video.duration && isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      } else {
        // Some WebM files don't report duration until playback progresses.
        // Avoid forcing a "seek to end" because that can stall large recordings.
        setDuration(0);
      }

      updateSeekable();
      setIsCalculatingDuration(false);

      // Set initial time if provided
      if (initialTime > 0) {
        try {
          video.currentTime = initialTime;
        } catch {
          // ignore
        }
      }
    };

    const handleDurationChange = () => {
      if (video.duration && isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
      updateSeekable();
      setIsCalculatingDuration(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime);
      updateSeekable();

      // If duration is unknown, grow a "known" duration as playback advances.
      setDuration((prev) => {
        if (video.currentTime > prev && isFinite(video.currentTime)) return video.currentTime;
        return prev;
      });
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    const handleError = () => {
      const errorCode = video.error?.code;
      const message =
        errorCode === 4
          ? 'This recording format may not be supported in your browser. Try Chrome.'
          : 'Failed to load the recording.';

      setLoadError(message);
      setIsCalculatingDuration(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    video.addEventListener('progress', updateSeekable);

    // If video already has data, initialize without triggering heavy seeks
    if (video.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.removeEventListener('progress', updateSeekable);
    };
  }, [src, initialTime, onTimeUpdate]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    setLoadError(null);

    if (isPlaying) {
      video.pause();
    } else {
      const p = video.play();
      if (p && typeof (p as Promise<void>).catch === 'function') {
        (p as Promise<void>).catch((err) => {
          logger.error('Video play() failed:', err);
          setLoadError('Playback failed. Your browser may be blocking playback or not support this format.');
        });
      }
    }
  };

  const seekTo = (time: number) => {
    const video = videoRef.current;
    if (!video) return;

    const maxKnown = Math.max(duration, seekableEnd);
    const clampMax = maxKnown > 0 ? maxKnown : Math.max(currentTime, 100);

    video.currentTime = Math.max(0, Math.min(time, clampMax));
  };

  const skip = (seconds: number) => {
    seekTo(currentTime + seconds);
  };

  const handleVolumeChange = (value: number[]) => {
    const vol = value[0];
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
      setIsMuted(vol === 0);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isMuted) {
      video.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      video.volume = 0;
      setIsMuted(true);
    }
  };

  const handlePlaybackRateChange = (rate: string) => {
    const rateNum = parseFloat(rate);
    setPlaybackRate(rateNum);
    if (videoRef.current) {
      videoRef.current.playbackRate = rateNum;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleSeek = (value: number[]) => {
    seekTo(value[0]);
  };

  return (
    <div 
      ref={containerRef} 
      className={`relative bg-black rounded-lg overflow-hidden ${className}`}
    >
      <video
        ref={videoRef}
        src={src}
        poster={posterSrc}
        preload="metadata"
        playsInline
        className="w-full aspect-video"
        onClick={togglePlay}
      />

      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center">
          <div className="max-w-md text-white">
            <p className="text-sm font-medium">{loadError}</p>
            {errorHelpText ? (
              <p className="mt-2 text-xs text-white/70">{errorHelpText}</p>
            ) : null}
            {errorActions ? (
              <div className="mt-3 flex justify-center">{errorActions}</div>
            ) : null}
          </div>
        </div>
      )}

      {/* Duration calculation indicator */}
      {isCalculatingDuration && (
        <div className="absolute top-2 right-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Calculating duration...
          </Badge>
        </div>
      )}
      
      {/* Controls overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
        {/* Progress bar */}
        <div className="mb-3">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-white/80 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        
        {/* Control buttons */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {/* Skip backward */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => skip(-10)}
              className="text-white hover:bg-white/20 h-8 w-8"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            
            {/* Rewind */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => skip(-5)}
              className="text-white hover:bg-white/20 h-8 w-8"
            >
              <Rewind className="h-4 w-4" />
            </Button>
            
            {/* Play/Pause */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={togglePlay}
              className="text-white hover:bg-white/20 h-10 w-10"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
            
            {/* Fast forward */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => skip(5)}
              className="text-white hover:bg-white/20 h-8 w-8"
            >
              <FastForward className="h-4 w-4" />
            </Button>
            
            {/* Skip forward */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => skip(10)}
              className="text-white hover:bg-white/20 h-8 w-8"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Volume */}
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleMute}
                className="text-white hover:bg-white/20 h-8 w-8"
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.1}
                onValueChange={handleVolumeChange}
                className="w-20"
              />
            </div>
            
            {/* Playback speed */}
            <Select value={playbackRate.toString()} onValueChange={handlePlaybackRateChange}>
              <SelectTrigger className="w-16 h-8 bg-transparent text-white border-white/30 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">0.5x</SelectItem>
                <SelectItem value="0.75">0.75x</SelectItem>
                <SelectItem value="1">1x</SelectItem>
                <SelectItem value="1.25">1.25x</SelectItem>
                <SelectItem value="1.5">1.5x</SelectItem>
                <SelectItem value="2">2x</SelectItem>
                <SelectItem value="3">3x</SelectItem>
                <SelectItem value="4">4x</SelectItem>
                <SelectItem value="5">5x</SelectItem>
                <SelectItem value="6">6x</SelectItem>
                <SelectItem value="8">8x</SelectItem>
                <SelectItem value="10">10x</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Fullscreen */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleFullscreen}
              className="text-white hover:bg-white/20 h-8 w-8"
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayerWithControls;
