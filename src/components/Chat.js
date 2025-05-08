import React, { useState, useEffect, useRef, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import EmojiPicker from "../components/EmojiPicker";
import AttachFileButton from "../components/AttachFileButton";
import Tooltip from "@mui/material/Tooltip";
import CryptoJS from "crypto-js";
import { ToastContainer, toast } from "react-toastify"; // Add toast notifications
import "react-toastify/dist/ReactToastify.css";
import { db, auth } from "../firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const encryptMessage = (message, key) => {
  return CryptoJS.AES.encrypt(message, key).toString();
};

const decryptMessage = (encryptedMessage, key) => {
  const bytes = CryptoJS.AES.decrypt(encryptedMessage, key);
  return bytes.toString(CryptoJS.enc.Utf8);
};

const MAX_CHUNK_SIZE = 16384; // 16KB chunks

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
  const heartbeatIntervalRef = useRef(null);
  const heartbeatFunctionRef = useRef(null);
  const pingTimeoutRef = useRef(null);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const typingTimeoutRef = useRef(null);
  const [globalEncryptionKey, setGlobalEncryptionKey] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userKeys, setUserKeys] = useState({});

  useEffect(() => {
    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "/login";
        return;
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const handleFileDownload = useCallback(
    (base64Data, filename) => {
      if (!globalEncryptionKey) return;
      const decryptedFileData = decryptMessage(base64Data, globalEncryptionKey);

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
      URL.revokeObjectURL(link.href);
    },
    [globalEncryptionKey]
  );

  const fetchUserKey = useCallback(async (username) => {
    console.log(`[KeyFetch] Attempting to fetch key for user: ${username}`);
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", username));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        console.log(`[KeyFetch] Found key for ${username}`);
        setUserKeys((prev) => {
          console.log(`[KeyStore] Storing key for ${username}`);
          return { ...prev, [username]: userData.encryptionKey };
        });
        return userData.encryptionKey;
      }
      console.log(`[KeyFetch] No key found for ${username}`);
    } catch (error) {
      console.error(`[KeyFetch] Error fetching key for ${username}:`, error);
    }
  }, []);

  const fetchMissingKeys = useCallback(
    async (messages) => {
      const uniqueSenders = new Set(
        messages.map((msg) => {
          const parsed = typeof msg === "string" ? JSON.parse(msg) : msg;
          return parsed.sender;
        })
      );

      const missingKeys = [...uniqueSenders].filter(
        (sender) => !userKeys[sender]
      );

      await Promise.all(missingKeys.map(fetchUserKey));
    },
    [userKeys, fetchUserKey]
  );

  // Create the heartbeat function once and store it in a ref
  useEffect(() => {
    heartbeatFunctionRef.current = () => {
      if (socketRef.current?.readyState !== WebSocket.OPEN) {
        console.log("Connection not open, attempting reconnect...");
        connectWebSocket();
        return;
      }

      // Clear any existing ping timeout
      if (pingTimeoutRef.current) {
        clearTimeout(pingTimeoutRef.current);
      }

      const username = localStorage.getItem("username");
      // Set timeout before sending ping
      pingTimeoutRef.current = setTimeout(() => {
        console.log(`Ping timeout - no pong received for user ${username}`);
        if (socketRef.current) {
          socketRef.current.close();
          socketRef.current = null;
        }
        connectWebSocket();
      }, 5000);

      // Send ping with username
      try {
        socketRef.current.send(
          JSON.stringify({
            type: "ping",
            username: username,
          })
        );
        console.log(`Ping sent for user ${username}`);
      } catch (error) {
        console.error("Error sending ping:", error);
        clearTimeout(pingTimeoutRef.current);
        connectWebSocket();
      }
    };
  });

  useEffect(() => {
    return () => {
      if (pingTimeoutRef.current) {
        clearTimeout(pingTimeoutRef.current);
      }
    };
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    heartbeatIntervalRef.current = setInterval(() => {
      heartbeatFunctionRef.current?.();
    }, 30000); // Hearbeat every 30 seconds
  }, []);

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

    // socketRef.current = new WebSocket("ws://localhost:8765");
    socketRef.current = new WebSocket(
      "wss://rat-chat-server-production.up.railway.app"
    );

    socketRef.current.onopen = () => {
      console.log("WebSocket connection opened");
      toast.success("Connected to WebSocket server!");
      const username = localStorage.getItem("username");
      setIsConnected(true);
      retryCountRef.current = 0; // Reset retry count
      startHeartbeat();

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
      socketRef.current.send(
        JSON.stringify({
          type: "get_online_users",
          username: localStorage.getItem("username"),
        })
      );
    };

    socketRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socketRef.current.onclose = () => {
      console.log("WebSocket connection closed");
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (retryCountRef.current < 5) {
        toast.info("Attempting to connect to server...");
        setIsConnected(false);
        retryCountRef.current += 1; // Increment retry count
        retryTimeoutRef.current = setTimeout(connectWebSocket, 5000); // Retry after 5 seconds
      }
    };

    socketRef.current.onmessage = (event) => {
      if (typeof event.data === "string") {
        const receivedMessage = JSON.parse(event.data);
        console.log("Received message:", receivedMessage);

        // Handle ping response
        if (receivedMessage.type === "pong") {
          console.log("Heartbeat received");
          if (pingTimeoutRef.current) {
            clearTimeout(pingTimeoutRef.current);
            pingTimeoutRef.current = null;
          }
          return;
        }

        if (receivedMessage.type === "typing_status") {
          setTypingUsers((prev) => {
            const newSet = new Set(prev);
            if (receivedMessage.is_typing) {
              newSet.add(receivedMessage.username);
            } else {
              newSet.delete(receivedMessage.username);
            }
            return newSet;
          });
          return;
        }

        if (receivedMessage.type === "online_users") {
          setOnlineUsers(receivedMessage.users); // Update online users
          receivedMessage.users.forEach((username) => {
            if (!userKeys[username]) {
              fetchUserKey(username);
            }
          });
          return;
        }

        if (receivedMessage.type === "chatroom_history") {
          console.log(
            `[History] Processing ${receivedMessage.history.length} messages`
          );
          fetchMissingKeys(receivedMessage.history).then(() => {
            const decryptedHistory = receivedMessage.history.map((msg) => {
              const parsedMessage = JSON.parse(msg);
              if (parsedMessage.message && parsedMessage.sender) {
                try {
                  if (!userKeys[parsedMessage.sender]) {
                    // console.log(
                    //   `[Decrypt] No key for ${parsedMessage.sender}, fetching...`
                    // );
                    fetchUserKey(parsedMessage.sender);
                    return parsedMessage;
                  }
                  // console.log(
                  //   `[Decrypt] Decrypting message from ${parsedMessage.sender}`
                  // );
                  parsedMessage.message = decryptMessage(
                    parsedMessage.message,
                    userKeys[parsedMessage.sender]
                  );
                  // console.log(
                  //   `[Decrypt] Successfully decrypted message from ${parsedMessage.sender}`
                  // );
                } catch (error) {
                  // console.error(
                  //   `[Decrypt] Error decrypting message from ${parsedMessage.sender}:`,
                  //   error
                  // );
                  parsedMessage.message = "[Encrypted Message]";
                }
              }
              return parsedMessage;
            });
            console.log(
              `[History] Processed ${decryptedHistory.length} messages`
            );
            setMessages(decryptedHistory);
          });
        } else if (receivedMessage.chatroom === currentChatRef.current) {
          if (receivedMessage.message && receivedMessage.sender) {
            // Fetch key for new sender if needed
            if (!userKeys[receivedMessage.sender]) {
              fetchUserKey(receivedMessage.sender).then(() => {
                try {
                  if (userKeys[receivedMessage.sender]) {
                    receivedMessage.message = decryptMessage(
                      receivedMessage.message,
                      userKeys[receivedMessage.sender]
                    );
                  }
                  setMessages((prevMessages) => [
                    ...prevMessages,
                    receivedMessage,
                  ]);
                } catch (error) {
                  console.error("Decryption error:", error);
                  receivedMessage.message = "[Encrypted Message]";
                  setMessages((prevMessages) => [
                    ...prevMessages,
                    receivedMessage,
                  ]);
                }
              });
              return;
            }
            try {
              receivedMessage.message = decryptMessage(
                receivedMessage.message,
                userKeys[receivedMessage.sender]
              );
              setMessages((prevMessages) => [...prevMessages, receivedMessage]);
            } catch (error) {
              console.error("Decryption error:", error);
              receivedMessage.message = "[Encrypted Message]";
              setMessages((prevMessages) => [...prevMessages, receivedMessage]);
            }
          }
        } else {
          if (receivedMessage.chatroom) {
            console.log(
              `Message received for chatroom ${receivedMessage.chatroom}, but currentChat is ${currentChatRef.current}`
            );
          }
        }

        if (receivedMessage.type === "file_download") {
          console.log("Downloading file");
          handleFileDownload(
            receivedMessage.file_data,
            receivedMessage.filename
          );
        }

        // Add file upload status handling
        if (receivedMessage.type === "file_upload_status") {
          if (receivedMessage.status === "success") {
            toast.success("File uploaded successfully!");
          } else if (receivedMessage.status === "error") {
            toast.error(receivedMessage.message || "File upload failed");
          }
          return;
        }
      } else {
        console.log("Received unknown data type");
      }
    };
  }, [
    startHeartbeat,
    handleFileDownload,
    userKeys,
    fetchUserKey,
    fetchMissingKeys,
  ]); // Add startHeartbeat and connectWebSocket to dependencies

  const fetchGlobalEncryptionKey = useCallback(async () => {
    try {
      if (!isAuthReady) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return fetchGlobalEncryptionKey();
      }

      const user = auth.currentUser;
      if (!user) {
        throw new Error("No authenticated user");
      }

      const userDoc = await getDoc(doc(db, "users", user.uid));
      console.log("User Document: ", userDoc.data());
      if (userDoc.exists() && userDoc.data().encryptionKey) {
        const key = userDoc.data().encryptionKey;
        console.log("Fetched encryption key:", key);
        await new Promise((resolve) => {
          setGlobalEncryptionKey(key);
          // Wait for state to update
          setTimeout(resolve, 100);
        });
        return key;
      } else {
        throw new Error("Encryption key not found for user");
      }
    } catch (error) {
      console.error("Error fetching encryption key:", error);
      toast.error("Error loading encryption key. Retrying...");
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return fetchGlobalEncryptionKey();
    }
  }, [isAuthReady]);

  useEffect(() => {
    const initializeChat = async () => {
      const username = localStorage.getItem("username");
      const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

      if (!username || !isLoggedIn || !isAuthReady) {
        console.log("Not ready to initialize chat");
        return;
      }

      try {
        if (
          !socketRef.current ||
          socketRef.current.readyState === WebSocket.CLOSED
        ) {
          const key = await fetchGlobalEncryptionKey();
          if (!key) {
            throw new Error("Failed to fetch encryption key");
          }
          // Ensure encryption key is set in state before connecting
          if (!globalEncryptionKey) {
            console.log("Waiting for encryption key to be set in state");
            return;
          }
          setUser(username);
          console.log("Pre-User: ", username);
          connectWebSocket();
        }
      } catch (error) {
        console.error("Failed to initialize chat:", error);
        toast.error("Failed to initialize chat. Please refresh the page.");
      }
    };

    if (isAuthReady) {
      initializeChat();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [
    connectWebSocket,
    fetchGlobalEncryptionKey,
    isAuthReady,
    globalEncryptionKey,
    userKeys,
  ]);

  const sendMessage = () => {
    if (
      message.trim() === "" ||
      !socketRef.current ||
      !isConnected ||
      !globalEncryptionKey
    )
      return;
    const timestamp = new Date().toISOString();

    const encryptedMessage = encryptMessage(
      message.trim(),
      globalEncryptionKey
    );
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
    if (!isConnected || !globalEncryptionKey) return;

    const reader = new FileReader();
    let offset = 0;
    const fileId = Math.random().toString(36).substring(7);

    const sendChunk = (chunk, isLastChunk) => {
      const encryptedChunk = encryptMessage(chunk, globalEncryptionKey);
      const metadata = JSON.stringify({
        type: "upload_file_chunk",
        fileId: fileId,
        fileName: file.name,
        chunk: encryptedChunk,
        offset: offset,
        isLastChunk: isLastChunk,
        totalSize: file.size,
      });

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        try {
          socketRef.current.send(metadata);
          console.log(`[Upload] Sent chunk ${offset}/${file.size}`);
        } catch (error) {
          console.error("Error sending chunk:", error);
          toast.error("File upload failed. Please try again.");
        }
      } else {
        toast.error("Connection lost during upload. Please try again.");
      }
    };

    reader.onload = (e) => {
      const fileData = e.target.result.split(",")[1];
      const fileDataArray = new Uint8Array(
        atob(fileData)
          .split("")
          .map((c) => c.charCodeAt(0))
      );
      const totalChunks = Math.ceil(fileDataArray.length / MAX_CHUNK_SIZE);

      console.log(
        `[Upload] Starting file upload of ${file.name} in ${totalChunks} chunks`
      );

      for (let i = 0; i < totalChunks; i++) {
        const chunk = fileDataArray.slice(
          i * MAX_CHUNK_SIZE,
          (i + 1) * MAX_CHUNK_SIZE
        );
        const base64Chunk = btoa(String.fromCharCode.apply(null, chunk));
        offset = i * MAX_CHUNK_SIZE;
        const isLastChunk = i === totalChunks - 1;

        // Add delay between chunks to prevent connection issues
        setTimeout(() => {
          sendChunk(base64Chunk, isLastChunk);
        }, i * 100);
      }
    };

    reader.onerror = () => {
      toast.error("Error reading file. Please try again.");
    };

    reader.readAsDataURL(file);
  };

  const requestFileDownload = (filename) => {
    if (!socketRef.current || !isConnected) return;
    console.log("Requesting file download for:", filename);
    socketRef.current.send(
      JSON.stringify({ type: "request_file", fileName: filename })
    );
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

  const handleTyping = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "typing_status",
          chatroom: currentChat,
          is_typing: true,
        })
      );

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set new timeout to stop typing indicator
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current?.send(
          JSON.stringify({
            type: "typing_status",
            chatroom: currentChat,
            is_typing: false,
          })
        );
      }, 2000);
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

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
        <div className="typing-indicator">
          {typingUsers.size > 0 && (
            <span className="typing-text">
              {Array.from(typingUsers).join(", ")}{" "}
              {typingUsers.size === 1 ? "is" : "are"} typing...
            </span>
          )}
        </div>
        <div className="chat-input">
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping();
            }}
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
