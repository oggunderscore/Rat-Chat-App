import React, { useState, useEffect, useRef, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import EmojiPicker from "../components/EmojiPicker";
import AttachFileButton from "../components/AttachFileButton";
import Tooltip from "@mui/material/Tooltip";
import CryptoJS from "crypto-js";
import { ToastContainer, toast } from "react-toastify"; // Add toast notifications
import "react-toastify/dist/ReactToastify.css";

const encryptMessage = (message, key) => {
  return CryptoJS.AES.encrypt(message, key).toString();
};

const decryptMessage = (encryptedMessage, key) => {
  const bytes = CryptoJS.AES.decrypt(encryptedMessage, key);
  return bytes.toString(CryptoJS.enc.Utf8);
};

const Chat = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [user, setUser] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [currentChat, setCurrentChat] = useState("general");
  const currentChatRef = useRef("general"); // Ref to track the current chatroom
  const retryCountRef = useRef(0); // Use a ref to track retry attempts
  const socketRef = useRef(null);
  const retryTimeoutRef = useRef(null); // Track the retry timeout

  const connectWebSocket = useCallback(() => {
    if (
      socketRef.current &&
      socketRef.current.readyState !== WebSocket.CLOSED
    ) {
      console.log("WebSocket is already connected or connecting");
      return;
    }

    if (retryCountRef.current >= 5) {
      toast.error(
        "Failed to reconnect after 5 attempts. Please refresh to try again."
      );
      return;
    }

    console.log("Connecting to WebSocket server...");

    socketRef.current = new WebSocket(
      "wss://rat-chat-server-production.up.railway.app"
    );

    socketRef.current.onopen = () => {
      console.log("WebSocket connection opened");
      toast.success("Connected to WebSocket server!");
      const username = localStorage.getItem("username");
      setIsConnected(true);
      retryCountRef.current = 0; // Reset retry count

      // Clear any pending retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      console.log("User: ", username);
      socketRef.current.send(
        JSON.stringify({ username, chatroom: currentChatRef.current }) // Use currentChatRef
      );
      socketRef.current.send(
        JSON.stringify({
          type: "fetch_history",
          chatroom: currentChatRef.current,
        }) // Use currentChatRef
      );
    };

    socketRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socketRef.current.onclose = () => {
      console.log("WebSocket connection closed");
      if (retryCountRef.current < 5) {
        toast.error("Connection lost. Retrying in 5 seconds...");
        setIsConnected(false);
        retryCountRef.current += 1; // Increment retry count
        retryTimeoutRef.current = setTimeout(connectWebSocket, 5000); // Retry after 5 seconds
      }
    };

    socketRef.current.onmessage = (event) => {
      if (typeof event.data === "string") {
        const receivedMessage = JSON.parse(event.data);
        console.log("Received message:", receivedMessage);

        if (receivedMessage.type === "chatroom_history") {
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
            return parsedMessage;
          });
          setMessages(decryptedHistory); // Load decrypted chatroom history
        } else if (receivedMessage.chatroom === currentChatRef.current) {
          // Append live messages for the current chatroom
          if (receivedMessage.message) {
            const encryptionKey = localStorage.getItem("encryptionKey"); // Retrieve encryption key
            const decryptedMessage = decryptMessage(
              receivedMessage.message,
              encryptionKey
            );
            receivedMessage.message = decryptedMessage; // Replace encrypted message with decrypted one
            setMessages((prevMessages) => [...prevMessages, receivedMessage]);
          }
        } else {
          console.log(
            `Message received for chatroom ${receivedMessage.chatroom}, but currentChat is ${currentChatRef.current}`
          );
        }

        if (receivedMessage.type === "online_users") {
          setOnlineUsers(receivedMessage.users); // Update online users
        } else if (receivedMessage.type === "file_download") {
          console.log("Downloading file");
          handleFileDownload(
            receivedMessage.file_data,
            receivedMessage.filename
          );
        }
      } else {
        console.log("Received unknown data type");
      }
    };
  }, []); // No dependency on currentChat

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
    console.log("Pre-User: ", username);

    connectWebSocket(); // Initialize WebSocket connection

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connectWebSocket]); // Add connectWebSocket as a dependency

  const sendMessage = () => {
    if (message.trim() === "" || !socketRef.current || !isConnected) return;
    const timestamp = new Date().toISOString();
    const encryptionKey = localStorage.getItem("encryptionKey"); // Retrieve encryption key

    const encryptedMessage = encryptMessage(message.trim(), encryptionKey);
    const messageData = {
      message: encryptedMessage,
      timestamp,
      chatroom: currentChat, // Include the current chatroom in the payload
    };
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
      const encryptionKey = localStorage.getItem("encryptionKey"); // Retrieve encryption key
      const fileData = reader.result.split(",")[1]; // Get base64 part
      const encryptedFileData = encryptMessage(fileData, encryptionKey); // Encrypt file data

      const metadata = JSON.stringify({
        type: "upload_file",
        fileName: file.name,
        fileData: encryptedFileData, // Send encrypted file data
      });

      console.log("Sending encrypted file metadata and data:", metadata);
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
    const encryptionKey = localStorage.getItem("encryptionKey"); // Retrieve encryption key
    const decryptedFileData = decryptMessage(base64Data, encryptionKey); // Decrypt file data

    const blob = new Blob(
      [Uint8Array.from(atob(decryptedFileData), (c) => c.charCodeAt(0))],
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
    if (currentChat !== newChat) {
      setCurrentChat(newChat);
      currentChatRef.current = newChat; // Update the ref immediately
      setMessages([]); // Clear previous messages
    }

    // Always send a request to fetch history, even if already in the same chatroom
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log(`Switching to chatroom: ${newChat}`);
      socketRef.current.send(
        JSON.stringify({ type: "switch_chatroom", chatroom: newChat })
      );
      socketRef.current.send(
        JSON.stringify({ type: "fetch_history", chatroom: newChat })
      );
    } else {
      console.error("WebSocket is not open. Unable to switch chatrooms.");
      toast.error("Unable to switch chatrooms. WebSocket is not connected.");
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

    if (isNaN(date.getTime())) {
      console.error("Invalid timestamp format:", isoString);
      return "Invalid Date";
    }

    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleReconnect = () => {
    retryCountRef.current = 0; // Reset retry count
    connectWebSocket(); // Attempt to reconnect
  };

  return (
    <div className="chat-app">
      <ToastContainer position="top-right" autoClose={4000} />
      <Sidebar
        onlineUsers={onlineUsers}
        setCurrentChat={handleChatChange}
        chatrooms={["general"]}
      />
      <div className="chat-container">
        <div className="chat-header">
          <h2>{getChatHeader()}</h2>
          {!isConnected && retryCountRef.current >= 5 && (
            <button onClick={handleReconnect}>Reconnect</button>
          )}
        </div>
        <div className="chat-messages">
          {messages
            // .filter((msg) => msg.chatroom === currentChat) // Filter messages by current chatroom
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
