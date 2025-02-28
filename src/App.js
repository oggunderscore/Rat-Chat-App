import React, { useState, useEffect, useRef } from "react";

const serverIP = "ws://192.168.68.146:8765";

function App() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [deviceName, setDeviceName] = useState(
    localStorage.getItem("deviceName") || ""
  );
  const chatboxRef = useRef(null);

  useEffect(() => {
    if (!deviceName) {
      const name = prompt("Enter your device name:");
      setDeviceName(name);
      localStorage.setItem("deviceName", name);
    }

    const ws = new WebSocket(serverIP);

    ws.onopen = () => {
      console.log("Connected to WebSocket server");
      ws.send(deviceName);
      setMessages((prev) => [
        ...prev,
        { sender: "System", message: `Connected as ${deviceName}` },
      ]);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages((prev) => [...prev, data]);
    };

    ws.onclose = () => {
      console.log("Disconnected from server");
      setMessages((prev) => [
        ...prev,
        { sender: "System", message: "Disconnected" },
      ]);
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, [deviceName]);

  useEffect(() => {
    if (chatboxRef.current) {
      chatboxRef.current.scrollTop = chatboxRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (message.trim() && socket) {
      const data = { sender: deviceName, message };
      socket.send(JSON.stringify(data));
      setMessage("");
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h2>WebSocket Chat</h2>
      <div
        id="chatbox"
        ref={chatboxRef}
        style={{
          width: "100%",
          height: "300px",
          overflowY: "auto",
          border: "1px solid #ccc",
          padding: "10px",
        }}
      >
        {messages.map((msg, index) => (
          <p
            key={index}
            style={{
              padding: "5px",
              margin: "5px 0",
              borderRadius: "5px",
              background:
                msg.sender === deviceName
                  ? "#d1e7fd"
                  : msg.sender === "System"
                  ? "#f0f0f0"
                  : "#e1ffe1",
              textAlign: "left",
            }}
          >
            <b>{msg.sender === deviceName ? "You" : msg.sender}:</b>{" "}
            {msg.message}
          </p>
        ))}
      </div>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
        style={{ width: "80%", padding: "10px", marginTop: "10px" }}
      />
      <button onClick={sendMessage} style={{ padding: "10px" }}>
        Send
      </button>
    </div>
  );
}

export default App;
