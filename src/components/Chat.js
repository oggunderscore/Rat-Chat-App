import React, { useState, useEffect, useRef } from "react";
import Sidebar from "../components/Sidebar";
import EmojiPicker from "../components/EmojiPicker";
import AttachFileButton from "../components/AttachFileButton";
import Tooltip from "@mui/material/Tooltip";
import CryptoJS from "crypto-js";

const encryptMessage = (message, key) => {
  return CryptoJS.AES.encrypt(message, key).toString();
};

const decryptMessage = (encryptedMessage, key) => {
  const bytes = CryptoJS.AES.decrypt(encryptedMessage, key);
  return bytes.toString(CryptoJS.enc.Utf8);
};

const deriveKey = (password) => {
  return CryptoJS.PBKDF2(password, "unique-salt", {
    keySize: 256 / 32,
    iterations: 1000,
  }).toString();
};

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
    const encryptionKey = localStorage.getItem("encryptionKey"); // Retrieve encryption key
    const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

    if (!username || !isLoggedIn || !encryptionKey) {
      console.log("User is not logged in, redirecting to login.");
      window.location.href = "/login";
      return;
    }
    setUser(username);

    socketRef.current = new WebSocket("ws://localhost:8765");

    socketRef.current.onopen = () => {
      console.log("WebSocket connection opened");
      socketRef.current.send(
        JSON.stringify({ username, chatroom: currentChat })
      );
      setIsConnected(true);

      // Fetch chat history for the current chatroom
      socketRef.current.send(
        JSON.stringify({ type: "fetch_history", chatroom: currentChat })
      );
    };

    socketRef.current.onclose = () => {
      console.log("WebSocket connection closed");
      setIsConnected(false);
    };

    socketRef.current.onmessage = (event) => {
      if (typeof event.data === "string") {
        const receivedMessage = JSON.parse(event.data);
        console.log("Received message:", receivedMessage);
        // console.log("Received message type:", receivedMessage.type);

        if (receivedMessage.type === "chatroom_history") {
          // console.log("Received chatroom history");
          const encryptionKey = localStorage.getItem("encryptionKey"); // Retrieve encryption key
          console.log("History: ", receivedMessage.history);
          const decryptedHistory = receivedMessage.history.map((msg) => {
            const parsedMessage = JSON.parse(msg);
            if (parsedMessage.message) {
              parsedMessage.message = decryptMessage(
                parsedMessage.message,
                encryptionKey
              );
            }
            // console.log("Parsed message: ", parsedMessage);
            return parsedMessage;
          });
          setMessages(decryptedHistory); // Load decrypted chatroom history
        } else if (
          receivedMessage.chatroom === currentChat &&
          receivedMessage.message
        ) {
          console.log("Encrypted Message: ", receivedMessage.message);
          const encryptionKey = localStorage.getItem("encryptionKey"); // Retrieve encryption key
          const decryptedMessage = decryptMessage(
            receivedMessage.message,
            encryptionKey
          );
          receivedMessage.message = decryptedMessage; // Replace encrypted message with decrypted one
        }

        if (receivedMessage.type === "online_users") {
          setOnlineUsers(receivedMessage.users); // Update online users
        } else if (receivedMessage.type === "file_download") {
          console.log("Downloading file");
          handleFileDownload(
            receivedMessage.file_data,
            receivedMessage.filename
          );
        } else if (receivedMessage.chatroom === currentChat) {
          // console.log("Received message for current chat");
          if (receivedMessage.type === "file_uploaded") {
            console.log("Received file upload message");
            setMessages((prevMessages) => [
              ...prevMessages,
              {
                sender: receivedMessage.sender,
                type: "file_uploaded",
                filename: receivedMessage.filename,
              },
            ]);
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
    const timestamp = new Date().toISOString();
    const encryptionKey = localStorage.getItem("encryptionKey"); // Retrieve encryption key

    const encryptedMessage = encryptMessage(message.trim(), encryptionKey);
    const messageData = { message: encryptedMessage, timestamp };
    console.log("Sending encrypted message:", messageData);
    socketRef.current.send(JSON.stringify(messageData));
    setMessage("");
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault(); // Prevent newline in the textarea
      sendMessage();
    }
  };

  const handleFileUpload = (file) => {
    if (!isConnected) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const fileData = reader.result.split(",")[1]; // Get base64 part
      const metadata = JSON.stringify({
        type: "upload_file",
        fileName: file.name,
        fileData: fileData,
      });
      console.log("Sending file metadata and data:", metadata);
      socketRef.current.send(metadata);
    };
  };

  const requestFileDownload = (filename) => {
    if (!socketRef.current || !isConnected) return;
    console.log("Requesting file download for:", filename);
    socketRef.current.send(
      JSON.stringify({ type: "request_file", fileName: filename })
    );
  };

  const handleFileDownload = (base64Data, filename) => {
    const blob = new Blob(
      [Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))],
      {
        type: "application/octet-stream",
      }
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    console.log("Opening save dialog for file:", filename);
    link.click();
    URL.revokeObjectURL(link.href); // Clean up the object URL
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

    // Request chat history for the new chatroom
    if (socketRef.current && isConnected) {
      socketRef.current.send(
        JSON.stringify({ type: "fetch_history", chatroom: newChat })
      );
    }
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

  const formatTimestamp = (isoString) => {
    if (!isoString) {
      console.error("Timestamp is undefined or null:", isoString);
      return "Invalid Date";
    }

    const date = new Date(isoString);
    // console.log("Parsed date:", date);

    if (isNaN(date.getTime())) {
      console.error("Invalid timestamp format:", isoString);
      return "Invalid Date";
    }

    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
          {messages
            .filter((msg) => msg.message && msg.timestamp) // Filter out invalid messages
            .map((msg, index) => (
              <div key={index} className="message">
                <span className="timestamp">
                  [{formatTimestamp(msg.timestamp)}]
                </span>
                <span className="username">{msg.sender}: </span>
                {msg.type === "file_uploaded" ? (
                  <button
                    className="file-link"
                    onClick={(e) => {
                      e.preventDefault();
                      requestFileDownload(msg.filename);
                    }}
                  >
                    {msg.filename}
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
            onKeyPress={handleKeyPress} // deprecated but works
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
