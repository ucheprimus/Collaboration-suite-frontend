import { useEffect } from 'react';
import { connectSocket, getSocket } from '../api/socket';
import { supabase } from '../api/supabaseClient';


export function useVideoSocket(serverUrl: string) {
useEffect(() => {
let socket = connectSocket(serverUrl);
// optionally attach supabase access token if you want server-side checks
supabase.auth.getSession().then(r => {
const token = r.data.session?.access_token;
if (token && socket) socket.auth = { token };
});
return () => {
try { getSocket().disconnect(); } catch (e) {}
};
}, [serverUrl]);
}