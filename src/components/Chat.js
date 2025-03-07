import React, { useState, useEffect, useRef } from "react";
import Sidebar from "../components/Sidebar";

const Chat = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [user, setUser] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // Retrieve username from local storage (or auth system)
    const username = localStorage.getItem("username");
    if (!username) {
      console.log("No username found, redirecting to login.");
      window.location.href = "/login";
      return;
    }
    setUser(username);

    // Connect to the WebSocket server running on the Raspberry Pi
    socketRef.current = new WebSocket("wss://47.154.96.241:8765");

    // Send username to the server upon connection
    socketRef.current.onopen = () => {
      socketRef.current.send(JSON.stringify({ username }));
    };

    // Listen for incoming messages
    socketRef.current.onmessage = (event) => {
      const receivedMessage = JSON.parse(event.data);
      setMessages((prevMessages) => [...prevMessages, receivedMessage]);
    };

    // Clean up on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const sendMessage = () => {
    if (message.trim() === "" || !socketRef.current) return;

    const messageData = {
      message: message.trim(),
    };

    socketRef.current.send(JSON.stringify(messageData));
    setMessage("");
  };

  return (
    <div className="chat-app">
      <Sidebar />
      <div className="chat-container">
        <div className="chat-header">
          <h2>#general</h2>
          <p>Logged in as: {user}</p>
        </div>
        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div key={index} className="message">
              <span className="username">{msg.sender}</span>: {msg.message}
            </div>
          ))}
        </div>
        <div className="chat-input">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
          />
          <button onClick={sendMessage} disabled={!user}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
