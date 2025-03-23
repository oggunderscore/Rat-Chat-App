import React, { useState, useEffect, useRef } from "react";
import Sidebar from "../components/Sidebar";
import EmojiPicker from "../components/EmojiPicker";
import AttachFileButton from "../components/AttachFileButton";
import Tooltip from "@mui/material/Tooltip";

const Chat = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [user, setUser] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [currentChat, setCurrentChat] = useState("general");
  const socketRef = useRef(null);

  useEffect(() => {
    const username = localStorage.getItem("username");
    const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

    if (!username || !isLoggedIn) {
      console.log("User is not logged in, redirecting to login.");
      window.location.href = "/login";
      return;
    }
    setUser(username);

    socketRef.current = new WebSocket("ws://localhost:8765"); // was 47.154.96.241

    socketRef.current.onopen = () => {
      console.log("WebSocket connection opened");
      socketRef.current.send(
        JSON.stringify({ username, chatroom: currentChat })
      );
      setIsConnected(true);
    };

    socketRef.current.onclose = () => {
      console.log("WebSocket connection closed");
      setIsConnected(false);
    };

    socketRef.current.onmessage = (event) => {
      if (typeof event.data === "string") {
        const receivedMessage = JSON.parse(event.data);
        console.log("Received message:", receivedMessage);
        if (receivedMessage.type === "online_users") {
          setOnlineUsers(receivedMessage.users); // Update online users
        } else if (receivedMessage.chatroom === currentChat) {
          if (receivedMessage.type === "file_uploaded") {
            handleFileDownload(
              receivedMessage.fileData,
              receivedMessage.filename
            );
          } else {
            setMessages((prevMessages) => [...prevMessages, receivedMessage]);
          }
        }
      } else {
        console.log("Received unknown data type");
      }
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [currentChat]);

  const sendMessage = () => {
    if (message.trim() === "" || !socketRef.current || !isConnected) return;
    const messageData = { message: message.trim() };
    console.log("Sending message:", messageData);
    socketRef.current.send(JSON.stringify(messageData));
    setMessage("");
  };

  const handleFileUpload = (file) => {
    if (!isConnected) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const fileData = reader.result.split(",")[1]; // Get base64 part
      const metadata = JSON.stringify({ filename: file.name, fileData });
      console.log("Sending file metadata and data:", metadata);
      socketRef.current.send(metadata);
    };
  };

  const requestFileDownload = (filename) => {
    if (!socketRef.current || !isConnected) return;
    console.log("Requesting file download for:", filename);
    socketRef.current.send(JSON.stringify({ type: "request_file", filename }));
  };

  const handleFileDownload = (base64Data, filename) => {
    const link = document.createElement("a");
    link.href = `data:application/octet-stream;base64,${base64Data}`;
    link.download = filename;
    console.log("Downloading file");
    link.click();
  };

  const formatMessage = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>") // Bold **text**
      .replace(/\*(.*?)\*/g, "<i>$1</i>") // Italic *text*
      .replace(/__(.*?)__/g, "<u>$1</u>") // Underline __text__
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>'); // Links [text](url)
  };

  const handleChatChange = (newChat) => {
    setCurrentChat(newChat);
    setMessages([]); // Clear previous messages
  };

  const getChatHeader = () => {
    if (currentChat.includes("_")) {
      const participants = currentChat
        .split("_")
        .filter((name) => name !== user);
      return `Direct Message with ${participants[0]}`;
    }
    return `#${currentChat}`;
  };

  return (
    <div className="chat-app">
      <Sidebar
        onlineUsers={onlineUsers}
        setCurrentChat={handleChatChange}
        chatrooms={["general"]}
      />
      <div className="chat-container">
        <div className="chat-header">
          <h2>{getChatHeader()}</h2>{" "}
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
                <span
                  dangerouslySetInnerHTML={{
                    __html: formatMessage(msg.message),
                  }}
                ></span>
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
          <EmojiPicker
            onSelect={(emoji) => setMessage((prev) => prev + emoji)}
          />
          <AttachFileButton onFileSelect={handleFileUpload} />
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
