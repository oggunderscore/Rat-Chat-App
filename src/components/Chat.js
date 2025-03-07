import React, { useState, useEffect, useRef } from "react";
import Sidebar from "../components/Sidebar";
import EmojiPicker from "emoji-picker-react";

const Chat = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [user, setUser] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const username = localStorage.getItem("username");
    if (!username) {
      console.log("No username found, redirecting to login.");
      window.location.href = "/login";
      return;
    }
    setUser(username);

    socketRef.current = new WebSocket("ws://47.154.96.241:8765");

    socketRef.current.onopen = () => {
      socketRef.current.send(JSON.stringify({ username }));
    };

    socketRef.current.onmessage = (event) => {
      const receivedMessage = JSON.parse(event.data);
      setMessages((prevMessages) => [...prevMessages, receivedMessage]);
    };

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

  const handleEmojiClick = (emojiObject) => {
    setMessage((prevMessage) => prevMessage + emojiObject.emoji);
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
          <button onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
            😀
          </button>
          {showEmojiPicker && (
            <div className="emoji-picker">
              <EmojiPicker onEmojiClick={handleEmojiClick} />
            </div>
          )}
          <button onClick={sendMessage} disabled={!user}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
