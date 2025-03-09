import React, { useState, useEffect, useRef } from "react";
import Sidebar from "../components/Sidebar";
import "emoji-picker-element";
import Tooltip from "@mui/material/Tooltip";

const Chat = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [user, setUser] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);

  useEffect(() => {
    const username = localStorage.getItem("username");
    if (!username) {
      console.log("No username found, redirecting to login.");
      window.location.href = "/login";
      return;
    }
    setUser(username);

    socketRef.current = new WebSocket("ws://localhost:8765"); // was 47.154.96.241

    socketRef.current.onopen = () => {
      socketRef.current.send(JSON.stringify({ username }));
      setIsConnected(true);
    };

    socketRef.current.onclose = () => {
      setIsConnected(false);
    };

    socketRef.current.onmessage = (event) => {
      if (typeof event.data === "string") {
        const receivedMessage = JSON.parse(event.data);
        setMessages((prevMessages) => [...prevMessages, receivedMessage]);
      } else {
        handleFileDownload(event.data);
      }
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const sendMessage = () => {
    if (message.trim() === "" || !socketRef.current || !isConnected) return;
    const messageData = { message: message.trim() };
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

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file || !isConnected) return;

    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = () => {
      socketRef.current.send(reader.result);
      console.log("File uploaded:", file.name);
    };
  };

  const requestFileDownload = (filename) => {
    if (!socketRef.current || !isConnected) return;
    socketRef.current.send(JSON.stringify({ type: "request_file", filename }));
  };

  const handleFileDownload = (binaryData) => {
    const blob = new Blob([binaryData], { type: "application/octet-stream" });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = `downloaded_file_${Date.now()}.bin`;
    link.click();
  };

  return (
    <div className="chat-app">
      <Sidebar />
      <div className="chat-container">
        <div className="chat-header">
          <h2>#general</h2>
        </div>
        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div key={index} className="message">
              <span className="username">{msg.sender}</span>:{" "}
              {msg.type === "file_uploaded" ? (
                <button onClick={() => requestFileDownload(msg.filename)}>
                  Download {msg.filename}
                </button>
              ) : (
                <span>{msg.message}</span>
              )}
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
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />
          <button onClick={() => fileInputRef.current.click()}>
            📎 Upload File
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
