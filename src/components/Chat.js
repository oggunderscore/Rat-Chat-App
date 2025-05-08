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
  const pendingKeyFetches = useRef(new Set());
  const keyFetchTimeout = useRef(null);

  const [isInitializing, setIsInitializing] = useState(false);
  const initTimeoutRef = useRef(null);
  const expectedMessagesRef = useRef(0);
  const receivedMessagesRef = useRef(0);

  const [isInitializationPending, setIsInitializationPending] = useState(false);

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

  const fetchUserKey = useCallback(
    async (username) => {
      if (
        !username ||
        userKeys[username] ||
        pendingKeyFetches.current.has(username)
      ) {
        return null;
      }

      console.log(`[KeyFetch] Queueing fetch for: ${username}`);
      pendingKeyFetches.current.add(username);

      // Clear existing timeout
      if (keyFetchTimeout.current) {
        clearTimeout(keyFetchTimeout.current);
      }

      // Debounce key fetching
      keyFetchTimeout.current = setTimeout(async () => {
        if (pendingKeyFetches.current.size === 0) return;

        try {
          const usersRef = collection(db, "users");
          const usernames = [...pendingKeyFetches.current];

          console.log(usernames);

          // Batch fetch keys
          const snapshots = await Promise.all(
            usernames.map(async (name) => {
              const q = query(usersRef, where("username", "==", name));
              return getDocs(q);
            })
          );

          const newKeys = {};
          snapshots.forEach((snapshot, index) => {
            if (!snapshot.empty) {
              const userData = snapshot.docs[0].data();
              newKeys[usernames[index]] = userData.encryptionKey;
            }
          });

          // Batch update keys
          setUserKeys((prev) => ({ ...prev, ...newKeys }));
          pendingKeyFetches.current.clear();
          console.log("[KeyFetch] Keys updated:", newKeys);
        } catch (error) {
          console.error("[KeyFetch] Error batch fetching keys:", error);
        }
      }, 100); // Debounce 100ms
    },
    [userKeys]
  );

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
      // if (socketRef.current?.readyState !== WebSocket.OPEN) {
      //   console.log("Connection not open, attempting reconnect...");
      //   connectWebSocket();
      //   return;
      // }

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

  const handleIncomingMessage = useCallback(
    (receivedMessage) => {
      if (!receivedMessage.sender || !receivedMessage.message) return;

      const decryptAndAppend = async () => {
        try {
          const senderKey = userKeys[receivedMessage.sender];
          if (!senderKey) {
            await fetchUserKey(receivedMessage.sender);
            return; // Will be handled in next render when keys are updated
          }

          receivedMessage.message = decryptMessage(
            receivedMessage.message,
            senderKey
          );
          setMessages((prev) => [...prev, receivedMessage]);
        } catch (error) {
          console.error("Decryption error:", error);
          receivedMessage.message = "[Encrypted Message]";
          setMessages((prev) => [...prev, receivedMessage]);
        }
      };

      decryptAndAppend();
    },
    [userKeys, fetchUserKey]
  );

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
    console.log("[Debug] connectWebSocket called with deps:", {
      userKeys: Object.keys(userKeys),
      isInitializing,
      globalEncryptionKey: !!globalEncryptionKey,
    });

    if (isInitializing) {
      console.log("[Debug] Connection in progress, skipping reconnect");
      return;
    }

    // Add additional state check
    if (socketRef.current?.readyState === WebSocket.CONNECTING) {
      console.log("[Debug] Socket is currently connecting");
      return;
    }

    if (
      socketRef.current &&
      socketRef.current.readyState !== WebSocket.CLOSED
    ) {
      console.log(
        "[Debug] Socket already exists in state:",
        socketRef.current.readyState
      );
      return;
    }

    console.log("Connecting to WebSocket server...");

    socketRef.current = new WebSocket("ws://localhost:8765");
    // socketRef.current = new WebSocket(
    //   "wss://rat-chat-server-production.up.railway.app"
    // );

    socketRef.current.onopen = () => {
      console.log("[Debug] WebSocket connection established");
      setIsInitializing(true);
      expectedMessagesRef.current = 2; // Expect history and online users
      receivedMessagesRef.current = 0;

      // Set initialization timeout
      initTimeoutRef.current = setTimeout(() => {
        if (isInitializing) {
          console.log("[Debug] Initialization timed out");
          setIsInitializing(false);
          socketRef.current?.close(4000, "Initialization timeout");
        }
      }, 5000);

      const username = localStorage.getItem("username");
      setIsConnected(true);
      retryCountRef.current = 0; // Reset retry count
      startHeartbeat();

      // Clear any pending retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      console.log("User: ", username, "Chatroom: ", currentChatRef.current);

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
      toast.success("Connected to Websocket server!");
    };

    socketRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socketRef.current.onclose = (event) => {
      // Clear initialization state
      clearTimeout(initTimeoutRef.current);
      setIsInitializing(false);
      receivedMessagesRef.current = 0;

      console.log(
        `WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`
      );

      // Handle specific close scenarios
      const closeMessages = {
        1000: "Normal closure",
        1001: "Server is going down or browser navigated away",
        1002: "Protocol error",
        1003: "Invalid data received",
        1005: "No status code present",
        1006: "Connection lost abnormally",
        1007: "Invalid frame payload data",
        1008: "Policy violation",
        1009: "Message too big",
        1010: "Extension negotiation failed",
        1011: "Server error",
        1015: "TLS handshake failed",
      };

      const closeMessage = closeMessages[event.code] || "Unknown reason";
      console.log(`Close reason: ${closeMessage}`);

      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      // Only attempt reconnect if not a clean closure and not initializing
      if (event.code !== 1000 && event.code !== 1001 && !isInitializing) {
        if (retryCountRef.current < 5) {
          toast.info(`Attempting to connect to server...`);
          setIsConnected(false);
          retryCountRef.current += 1;
          retryTimeoutRef.current = setTimeout(connectWebSocket, 5000);
        } else {
          toast.error(`Server connection failed after 5 attempts`);
        }
      }
    };

    socketRef.current.onmessage = async (event) => {
      if (typeof event.data === "string") {
        const receivedMessage = JSON.parse(event.data);
        console.log("Received message:", receivedMessage);

        // Track initialization messages
        if (
          isInitializing &&
          (receivedMessage.type === "chatroom_history" ||
            receivedMessage.type === "online_users")
        ) {
          receivedMessagesRef.current++;
          console.log(
            `[Debug] Init message received: ${receivedMessagesRef.current}/${expectedMessagesRef.current}`
          );

          if (receivedMessagesRef.current >= expectedMessagesRef.current) {
            console.log("[Debug] Initialization complete");
            clearTimeout(initTimeoutRef.current);
            setIsInitializing(false);
          }
        }

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
          // Wait for all keys to be fetched before processing messages
          await fetchMissingKeys(receivedMessage.history);

          const decryptedHistory = await Promise.all(
            receivedMessage.history.map(async (msg) => {
              const parsedMessage = JSON.parse(msg);
              if (parsedMessage.message && parsedMessage.sender) {
                try {
                  // Wait for the key to be available
                  if (!userKeys[parsedMessage.sender]) {
                    console.log(
                      `[Debug] Waiting for key for ${parsedMessage.sender}...`
                    );
                    await new Promise((resolve) => setTimeout(resolve, 500)); // Small delay
                    if (!userKeys[parsedMessage.sender]) {
                      console.log(
                        `[Debug] Key fetch timeout for ${parsedMessage.sender}`
                      );
                      return parsedMessage;
                    }
                  }

                  parsedMessage.message = decryptMessage(
                    parsedMessage.message,
                    userKeys[parsedMessage.sender]
                  );
                  console.log(
                    `[Debug] Successfully decrypted message from ${parsedMessage.sender}: ${parsedMessage.message}`
                  );
                } catch (error) {
                  console.error(
                    `[Debug] Decryption error for ${parsedMessage.sender}:`,
                    error
                  );
                  parsedMessage.message = "[Encrypted Message]";
                }
              }
              return parsedMessage;
            })
          );

          console.log(
            `[History] Processed ${decryptedHistory.length} messages`
          );
          setMessages(decryptedHistory);
        } else if (receivedMessage.chatroom === currentChatRef.current) {
          handleIncomingMessage(receivedMessage);
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
    isInitializing,
    handleIncomingMessage,
    globalEncryptionKey,
  ]);

  const fetchGlobalEncryptionKey = useCallback(async () => {
    try {
      if (!isAuthReady) {
        console.log("[Debug] Auth not ready, retrying...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return fetchGlobalEncryptionKey();
      }

      const user = auth.currentUser;
      if (!user) {
        throw new Error("No authenticated user");
      }

      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();
      console.log("[Debug] User Document updated:", userData);

      if (userDoc.exists() && userData.encryptionKey) {
        const key = userData.encryptionKey;
        const username = localStorage.getItem("username");
        console.log("[Debug] Setting encryption key for", username);

        // Update states sequentially to ensure proper order
        await Promise.all([
          new Promise((resolve) => {
            setUserKeys((prev) => {
              console.log("[Debug] Updating userKeys");
              return { ...prev, [username]: key };
            });
            resolve();
          }),
          new Promise((resolve) => {
            setGlobalEncryptionKey(key);
            resolve();
          }),
        ]);

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
      if (isInitializationPending) {
        console.log("[Debug] Initialization already in progress");
        return;
      }

      const username = localStorage.getItem("username");
      const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

      if (!username || !isLoggedIn || !isAuthReady) {
        console.log("[Debug] Not ready to initialize chat:", {
          username,
          isLoggedIn,
          isAuthReady,
        });
        return;
      }

      try {
        setIsInitializationPending(true);

        if (!globalEncryptionKey) {
          console.log("[Debug] Fetching global encryption key");
          const key = await fetchGlobalEncryptionKey();
          if (!key) {
            throw new Error("Failed to fetch encryption key");
          }
          // Wait for the next render when globalEncryptionKey is set
          return;
        }

        if (
          !socketRef.current ||
          socketRef.current.readyState === WebSocket.CLOSED
        ) {
          setUser(username);
          console.log(
            "[Debug] Starting WebSocket connection with encryption key:",
            !!globalEncryptionKey
          );
          connectWebSocket();
        }
      } catch (error) {
        console.error("[Debug] Failed to initialize chat:", error);
        toast.error("Failed to initialize chat. Please refresh the page.");
      } finally {
        setIsInitializationPending(false);
      }
    };

    if (isAuthReady) {
      initializeChat();
    }
  }, [
    isAuthReady,
    globalEncryptionKey,
    connectWebSocket,
    fetchGlobalEncryptionKey,
    isInitializationPending,
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
    const username = localStorage.getItem("username");

    const sendChunk = (chunk, isLastChunk) => {
      const encryptedChunk = encryptMessage(chunk, globalEncryptionKey);
      const uploadMessage = encryptMessage(
        `${username} uploaded ${file.name}`,
        globalEncryptionKey
      );

      const metadata = JSON.stringify({
        type: "upload_file_chunk",
        fileId: fileId,
        fileName: file.name,
        chunk: encryptedChunk,
        offset: offset,
        isLastChunk: isLastChunk,
        totalSize: file.size,
        chatroom: currentChat,
        uploadMessage: uploadMessage,
        timestamp: new Date().toISOString(),
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

  useEffect(() => {
    return () => {
      if (keyFetchTimeout.current) {
        clearTimeout(keyFetchTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      setIsInitializing(false);
      clearTimeout(initTimeoutRef.current);
      clearTimeout(retryTimeoutRef.current);
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
