// src/hooks/useWebRTC.ts
import { useEffect, useRef } from 'react';
import { getSocket } from '../api/socket';

interface Participant {
  id: string;
  stream: MediaStream;
}

export function useWebRTC(
  roomCode: string | null,
  localStream: MediaStream | null,
  setParticipant: (id: string, participant: Participant | null) => void
): void {
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});

  useEffect(() => {
    if (!roomCode || !localStream) return;

    const socket = getSocket();

    const makePeer = (peerId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ 
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] 
      });
      
      // Add local tracks
      if (localStream) {
        localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
      }
      
      pc.ontrack = (ev: RTCTrackEvent) => {
        const [stream] = ev.streams;
        setParticipant(peerId, { id: peerId, stream });
      };
      
      pc.onicecandidate = (ev: RTCPeerConnectionIceEvent) => {
        if (ev.candidate) {
          getSocket().emit('signal', { 
            to: peerId, 
            from: getSocket().id, 
            signal: { candidate: ev.candidate } 
          });
        }
      };
      
      return pc;
    };

    const createOffer = async (peerId: string, polite: boolean): Promise<void> => {
      let pc = peersRef.current[peerId];
      if (!pc) {
        pc = makePeer(peerId);
        peersRef.current[peerId] = pc;
      }
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('signal', { 
        to: peerId, 
        from: socket.id, 
        signal: pc.localDescription 
      });
    };

    const cleanupPeer = (peerId: string): void => {
      const pc = peersRef.current[peerId];
      if (pc) {
        pc.close();
        delete peersRef.current[peerId];
        setParticipant(peerId, null);
      }
    };

    // Join room
    socket.emit('webrtc:join', { roomCode });

    // Handle when we successfully joined
    socket.on('joined', ({ socketId }: { socketId: string }) => {
      console.log('✅ Joined room:', socketId);
    });

    // Handle when another user joins
    socket.on('user-joined', async ({ socketId }: { socketId: string }) => {
      console.log('👤 User joined:', socketId);
      await createOffer(socketId, true);
    });

    // Handle WebRTC signaling
    socket.on('signal', async ({ from, signal }: { from: string; signal: any }) => {
      let pc = peersRef.current[from];
      
      if (!pc) {
        pc = makePeer(from);
        peersRef.current[from] = pc;
      }

      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', { to: from, from: socket.id, signal: pc.localDescription });
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (signal.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal));
        } catch (e) {
          console.warn('Failed to add ICE candidate', e);
        }
      }
    });

    socket.on('user-left', ({ socketId }: { socketId: string }) => {
      cleanupPeer(socketId);
    });

    // Cleanup on unmount
    return () => {
      socket.off('joined');
      socket.off('user-joined');
      socket.off('signal');
      socket.off('user-left');
      
      // Close all peer connections
      Object.keys(peersRef.current).forEach((k) => {
        peersRef.current[k].close();
        setParticipant(k, null);
      });
      peersRef.current = {};
    };
  }, [roomCode, localStream, setParticipant]);
}