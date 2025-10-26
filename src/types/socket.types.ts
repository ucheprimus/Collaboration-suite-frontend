import type { Socket as SocketIOSocket } from '../lib/socketIO';

export type Socket = SocketIOSocket;

export interface ServerToClientEvents {
  message: (data: any) => void;
  user_joined: (data: any) => void;
  user_left: (data: any) => void;
  typing: (data: any) => void;
  stop_typing: (data: any) => void;
  canvas_update: (data: any) => void;
  video_signal: (data: any) => void;
}

export interface ClientToServerEvents {
  join_room: (data: any) => void;
  leave_room: (data: any) => void;
  send_message: (data: any) => void;
  typing: (data: any) => void;
  stop_typing: (data: any) => void;
  canvas_update: (data: any) => void;
  video_signal: (data: any) => void;
}