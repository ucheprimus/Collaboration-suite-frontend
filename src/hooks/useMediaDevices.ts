import { useEffect, useState } from 'react';

export function useMediaDevices() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<Error | null>(null);

  async function start(constraints: MediaStreamConstraints = { video: true, audio: true }) {
    try {
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(s);
      setError(null);
      return s;
    } catch (err: any) {
      setError(err);
      throw err;
    }
  }

  function stop() {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
  }

  useEffect(() => {
    return () => stop();
  }, []);

  return { stream, start, stop, error };
}

// ADD THIS EXPORT - it's an alias that some files are using
export const useMediaStream = useMediaDevices;