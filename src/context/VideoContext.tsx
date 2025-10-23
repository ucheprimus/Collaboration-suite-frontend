import React, { createContext, useContext, useState } from 'react';


type Participant = { id: string; userId?: string; stream?: MediaStream };


type VideoContextType = {
roomCode: string | null;
setRoomCode: (c: string | null) => void;
participants: Record<string, Participant>;
setParticipant: (id: string, p: Participant | null) => void;
};


const VideoContext = createContext<VideoContextType | undefined>(undefined);


export const VideoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
const [roomCode, setRoomCode] = useState<string | null>(null);
const [participants, setParticipants] = useState<Record<string, Participant>>({});


function setParticipant(id: string, p: Participant | null) {
setParticipants(prev => {
const copy = { ...prev };
if (p === null) delete copy[id]; else copy[id] = p;
return copy;
});
}


return (
<VideoContext.Provider value={{ roomCode, setRoomCode, participants, setParticipant }}>
{children}
</VideoContext.Provider>
);
};


export const useVideo = () => {
const ctx = useContext(VideoContext);
if (!ctx) throw new Error('useVideo must be used inside VideoProvider');
return ctx;
};