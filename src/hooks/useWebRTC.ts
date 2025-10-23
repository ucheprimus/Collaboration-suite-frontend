import { useEffect, useRef } from 'react';
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


socket.on('user-left', ({ socketId }) => {
cleanupPeer(socketId);
});


function makePeer(peerId: string) {
const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
// add local tracks
if (localStream) {
localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
}
pc.ontrack = (ev) => {
const [stream] = ev.streams;
setParticipant(peerId, { id: peerId, stream });
};
pc.onicecandidate = (ev) => {
if (ev.candidate) {
getSocket().emit('signal', { to: peerId, from: getSocket().id, signal: { candidate: ev.candidate } });
}
};
return pc;
}


async function createOffer(peerId: string, polite: boolean) {
let pc = peersRef.current[peerId];
if (!pc) {
pc = makePeer(peerId);
peersRef.current[peerId] = pc;
}
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
socket.emit('signal', { to: peerId, from: socket.id, signal: pc.localDescription });
}


return () => {
socket.off('joined');
socket.off('user-joined');
socket.off('signal');
socket.off('user-left');
// close peers
Object.keys(peersRef.current).forEach(k => {
peersRef.current[k].close();
setParticipant(k, null);
});
peersRef.current = {};
};
}, [roomCode, localStream]);
}