/**
 * WebRTC utilities for live video streaming between candidates and proctors.
 * Uses Supabase Realtime for signaling.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { RealtimeChannel } from '@supabase/supabase-js';

// Free public STUN servers for NAT traversal
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export interface LiveStreamCallbacks {
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onError?: (error: Error) => void;
  onDisconnect?: () => void;
}

/**
 * Candidate-side: Broadcasts video stream to a requesting proctor
 */
export class CandidateBroadcaster {
  private peerConnection: RTCPeerConnection | null = null;
  private channel: RealtimeChannel | null = null;
  private sessionId: string;
  private localStream: MediaStream | null = null;
  private proctorId: string | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Start listening for proctor connection requests
   */
  async startListening(videoStream: MediaStream) {
    this.localStream = videoStream;
    
    // Subscribe to signaling channel
    this.channel = supabase
      .channel(`live-stream-${this.sessionId}`)
      .on('broadcast', { event: 'signal' }, async (payload) => {
        await this.handleSignal(payload.payload);
      })
      .subscribe((status) => {
        logger.proctoring(`[CandidateBroadcaster] Channel status: ${status}`);
      });

    // Also listen for database signals as fallback
    supabase
      .channel(`live-stream-db-${this.sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_stream_signals',
          filter: `proctoring_session_id=eq.${this.sessionId}`,
        },
        async (payload) => {
          const signal = payload.new as any;
          if (signal.sender_type === 'proctor' && !signal.processed_at) {
            await this.handleSignal(signal);
          }
        }
      )
      .subscribe();

    // Mark session as available for live streaming
    await supabase
      .from('proctoring_sessions')
      .update({ live_stream_active: true })
      .eq('id', this.sessionId);

    logger.proctoring(`[CandidateBroadcaster] Started listening for session ${this.sessionId}`);
  }

  private async handleSignal(signal: any) {
    const { signal_type, signal_data, sender_id } = signal;
    
    logger.proctoring(`[CandidateBroadcaster] Received signal: ${signal_type}`);

    switch (signal_type) {
      case 'request-stream':
        this.proctorId = sender_id;
        await this.createOffer();
        break;

      case 'answer':
        if (this.peerConnection) {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal_data));
          logger.proctoring('[CandidateBroadcaster] Set remote answer');
        }
        break;

      case 'ice-candidate':
        if (this.peerConnection && signal_data) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal_data));
        }
        break;

      case 'disconnect':
        this.closePeerConnection();
        break;
    }

    // Mark signal as processed
    if (signal.id) {
      await supabase
        .from('live_stream_signals')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', signal.id);
    }
  }

  private async createOffer() {
    // Close any existing connection
    this.closePeerConnection();

    this.peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    // Handle ICE candidates
    this.peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        await this.sendSignal('ice-candidate', event.candidate.toJSON());
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      logger.proctoring(`[CandidateBroadcaster] Connection state: ${this.peerConnection?.connectionState}`);
      if (this.peerConnection?.connectionState === 'disconnected' || 
          this.peerConnection?.connectionState === 'failed') {
        this.closePeerConnection();
      }
    };

    // Create and send offer
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    await this.sendSignal('offer', offer);
    logger.proctoring('[CandidateBroadcaster] Sent offer to proctor');
  }

  private async sendSignal(type: string, data: any) {
    // Send via broadcast channel (faster)
    this.channel?.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        signal_type: type,
        signal_data: data,
        sender_type: 'candidate',
        sender_id: this.sessionId,
      },
    });

    // Also persist to database for reliability
    await supabase.from('live_stream_signals').insert({
      proctoring_session_id: this.sessionId,
      sender_type: 'candidate',
      sender_id: this.sessionId,
      signal_type: type,
      signal_data: data,
    });
  }

  private closePeerConnection() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.proctorId = null;
  }

  async stop() {
    await this.sendSignal('disconnect', {});
    this.closePeerConnection();
    
    // Unsubscribe from channels
    if (this.channel) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }

    // Mark session as not streaming
    await supabase
      .from('proctoring_sessions')
      .update({ live_stream_active: false })
      .eq('id', this.sessionId);

    logger.proctoring('[CandidateBroadcaster] Stopped');
  }
}

/**
 * Proctor-side: Connects to a candidate's live stream
 */
export class ProctorViewer {
  private peerConnection: RTCPeerConnection | null = null;
  private channel: RealtimeChannel | null = null;
  private sessionId: string;
  private proctorId: string;
  private callbacks: LiveStreamCallbacks;

  constructor(sessionId: string, proctorId: string, callbacks: LiveStreamCallbacks = {}) {
    this.sessionId = sessionId;
    this.proctorId = proctorId;
    this.callbacks = callbacks;
  }

  /**
   * Request to view a candidate's stream
   */
  async connect() {
    logger.proctoring(`[ProctorViewer] Connecting to session ${this.sessionId}`);

    // Subscribe to signaling channel
    this.channel = supabase
      .channel(`live-stream-${this.sessionId}`)
      .on('broadcast', { event: 'signal' }, async (payload) => {
        await this.handleSignal(payload.payload);
      })
      .subscribe();

    // Also listen for database signals
    supabase
      .channel(`live-stream-db-proctor-${this.sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_stream_signals',
          filter: `proctoring_session_id=eq.${this.sessionId}`,
        },
        async (payload) => {
          const signal = payload.new as any;
          if (signal.sender_type === 'candidate' && !signal.processed_at) {
            await this.handleSignal(signal);
          }
        }
      )
      .subscribe();

    // Create peer connection
    this.peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Handle incoming stream
    this.peerConnection.ontrack = (event) => {
      logger.proctoring('[ProctorViewer] Received remote track');
      if (event.streams[0] && this.callbacks.onRemoteStream) {
        this.callbacks.onRemoteStream(event.streams[0]);
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        await this.sendSignal('ice-candidate', event.candidate.toJSON());
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      logger.proctoring(`[ProctorViewer] Connection state: ${state}`);
      
      if (this.callbacks.onConnectionStateChange) {
        this.callbacks.onConnectionStateChange(state!);
      }

      if (state === 'disconnected' || state === 'failed') {
        this.callbacks.onDisconnect?.();
      }
    };

    // Request the stream from candidate
    await this.sendSignal('request-stream', { proctorId: this.proctorId });
    logger.proctoring('[ProctorViewer] Requested stream from candidate');
  }

  private async handleSignal(signal: any) {
    const { signal_type, signal_data } = signal;
    
    logger.proctoring(`[ProctorViewer] Received signal: ${signal_type}`);

    try {
      switch (signal_type) {
        case 'offer':
          if (this.peerConnection) {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal_data));
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            await this.sendSignal('answer', answer);
            logger.proctoring('[ProctorViewer] Sent answer to candidate');
          }
          break;

        case 'ice-candidate':
          if (this.peerConnection && signal_data) {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal_data));
          }
          break;

        case 'disconnect':
          this.disconnect();
          break;
      }
    } catch (error) {
      logger.error('[ProctorViewer] Error handling signal:', error);
      this.callbacks.onError?.(error as Error);
    }

    // Mark signal as processed
    if (signal.id) {
      await supabase
        .from('live_stream_signals')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', signal.id);
    }
  }

  private async sendSignal(type: string, data: any) {
    // Send via broadcast channel
    this.channel?.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        signal_type: type,
        signal_data: data,
        sender_type: 'proctor',
        sender_id: this.proctorId,
      },
    });

    // Also persist to database
    await supabase.from('live_stream_signals').insert({
      proctoring_session_id: this.sessionId,
      sender_type: 'proctor',
      sender_id: this.proctorId,
      signal_type: type,
      signal_data: data,
    });
  }

  disconnect() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }

    this.callbacks.onDisconnect?.();
    logger.proctoring('[ProctorViewer] Disconnected');
  }
}
