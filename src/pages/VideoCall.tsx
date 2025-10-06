import { useState } from "react";

export default function VideoCall() {
  const [connected, setConnected] = useState(false);

  const handleConnect = () => setConnected(true);

  return (
    <div style={{ textAlign: "center" }}>
      <h2>Video Call</h2>
      <p>This is a placeholder video call page.</p>

      {!connected ? (
        <button className="btn btn-primary" onClick={handleConnect}>
          Connect
        </button>
      ) : (
        <div style={{ marginTop: "20px" }}>
          <div style={{ width: "640px", height: "480px", backgroundColor: "#000", margin: "0 auto", borderRadius: "8px" }}>
            <p style={{ color: "#fff", paddingTop: "200px" }}>Video Stream Here</p>
          </div>
        </div>
      )}
    </div>
  );
}
