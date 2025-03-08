import React, { useState, useEffect, useRef } from "react";
import Sidebar from "../components/Sidebar";
import "emoji-picker-element";
import Tooltip from "@mui/material/Tooltip";

const Chat = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [user, setUser] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const emojiPickerRef = useRef(null);

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
      setIsConnected(true);
    };

    socketRef.current.onclose = () => {
      setIsConnected(false);
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
    if (message.trim() === "" || !socketRef.current || !isConnected) return;

    const messageData = {
      message: message.trim(),
    };

    socketRef.current.send(JSON.stringify(messageData));
    setMessage("");
  };

  const handleEmojiClick = (event) => {
    setMessage((prevMessage) => prevMessage + event.detail.unicode);
  };

  const handleClickOutside = (event) => {
    if (
      emojiPickerRef.current &&
      !emojiPickerRef.current.contains(event.target)
    ) {
      setShowEmojiPicker(false);
    }
  };

  useEffect(() => {
    const picker = emojiPickerRef.current;
    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      if (picker) {
        picker.addEventListener("emoji-click", handleEmojiClick);
      }
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (picker) {
        picker.removeEventListener("emoji-click", handleEmojiClick);
      }
    };
  }, [showEmojiPicker]);

  const formatMessage = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>") // Bold **text**
      .replace(/\*(.*?)\*/g, "<i>$1</i>") // Italic *text*
      .replace(/__(.*?)__/g, "<u>$1</u>") // Underline __text__
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>'); // Links [text](url)
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
              <span className="username">{msg.sender}</span>:{" "}
              <span
                dangerouslySetInnerHTML={{ __html: formatMessage(msg.message) }}
              ></span>
            </div>
          ))}
        </div>
        <div className="chat-input">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message... (Use *italic*, **bold**, __underline__, or [link](https://example.com))"
          />
          <div
            className="emoji-container"
            style={{ position: "relative", display: "inline-block" }}
          >
            <button onClick={() => setShowEmojiPicker((prev) => !prev)}>
              😀
            </button>
            {showEmojiPicker && (
              <div ref={emojiPickerRef} className="emoji-picker-overlay">
                <emoji-picker></emoji-picker>
              </div>
            )}
          </div>
          <Tooltip
            title={!isConnected ? "Not connected to WebSocket Server" : ""}
            arrow
            placement="top"
          >
            <span>
              <button onClick={sendMessage} disabled={!user || !isConnected}>
                Send
              </button>
            </span>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default Chat;
