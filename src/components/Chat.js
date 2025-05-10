import React, { useState, useEffect, useRef, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import EmojiPicker from "../components/EmojiPicker";
import AttachFileButton from "../components/AttachFileButton";
import Tooltip from "@mui/material/Tooltip";
import CryptoJS from "crypto-js";
import sha256 from "crypto-js/sha256"; // Import SHA-256 for checksum calculation
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
import Modal from "@mui/material/Modal";
import CircularProgress from "@mui/material/CircularProgress";

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
  const [uploadProgress, setUploadProgress] = useState(null); // Track upload progress
  const [chatrooms, setChatrooms] = useState([]); // Track available chatrooms with user permissions

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
    (fileData, filename, expectedChecksum) => {
      try {
        // Decode the Base64-encoded file data
        const binaryData = Uint8Array.from(atob(fileData), (c) =>
          c.charCodeAt(0)
        );

        // Calculate checksum of the downloaded file
        const checksum = sha256(
          CryptoJS.lib.WordArray.create(binaryData)
        ).toString();

        console.log(`[Debug] Downloaded File Checksum: ${checksum}`);
        console.log(`[Debug] Expected File Checksum: ${expectedChecksum}`);

        if (checksum !== expectedChecksum) {
          throw new Error("Checksum mismatch. File may be corrupted.");
        }

        // Create a Blob and trigger the download
        const blob = new Blob([binaryData], {
          type: "application/octet-stream",
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        console.log("Opening save dialog for file:", filename);
        link.click();
        URL.revokeObjectURL(link.href);
      } catch (error) {
        console.error("Error downloading file:", error);
        toast.error("Failed to download file. Checksum validation error.");
      }
    },
    []
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

          // Revisit message history and decrypt messages
          setMessages((messages) =>
            messages.map((msg) => {
              if (msg.sender && newKeys[msg.sender] && msg.message) {
                if (msg.isEncrypted) {
                  console.log(
                    `[KeyFetch] Attempting to decrypt message from ${msg.sender} | ${msg.message}`
                  );
                  try {
                    msg.message = decryptMessage(
                      msg.message,
                      newKeys[msg.sender]
                    );
                    msg.isEncrypted = false; // Mark as decrypted
                    console.log(
                      `[KeyFetch] Successfully decrypted message from ${msg.sender}: ${msg.message}`
                    );
                  } catch (error) {
                    console.error(
                      `[KeyFetch] Failed to decrypt message from ${msg.sender}:`,
                      error
                    );
                    // msg.message = "[Encrypted Message]";
                  }
                } else {
                  console.log(
                    `[KeyFetch] Skipping decryption for plaintext message from ${msg.sender}: ${msg.message}`
                  );
                }
              }
              return msg;
            })
          );
        } catch (error) {
          console.error("[KeyFetch] Error batch fetching keys:", error);
        }
      }, 100); // Debounce 100ms
    },
    [userKeys]
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

      // Send ping with username and fetch online users and channels
      try {
        socketRef.current.send(
          JSON.stringify({
            type: "ping",
            username: username,
          })
        );
        console.log(`Ping sent for user ${username}`);

        // Fetch online users
        socketRef.current.send(
          JSON.stringify({
            type: "get_online_users",
          })
        );

        // Fetch available channels
        socketRef.current.send(
          JSON.stringify({
            type: "get_channels",
          })
        );
      } catch (error) {
        console.error("Error sending ping:", error);
        clearTimeout(pingTimeoutRef.current);
        connectWebSocket();
      }
    };
  });

  const fetchAndDecryptHistory = useCallback(
    async (history) => {
      console.log(`[History] Processing ${history.length} messages`);

      // Identify unique senders from the history
      const uniqueSenders = new Set(
        history.map((msg) => {
          const parsedMessage = JSON.parse(msg);
          return parsedMessage.sender;
        })
      );

      // Determine which keys are missing
      const missingKeys = [...uniqueSenders].filter(
        (sender) => !userKeys[sender]
      );

      // Fetch missing keys
      if (missingKeys.length > 0) {
        console.log(`[History] Fetching keys for: ${missingKeys}`);
        await Promise.all(missingKeys.map(fetchUserKey));
      }

      console.log("[History] User keys after fetch:", userKeys);

      // Decrypt the history
      const decryptedHistory = history.map((msg) => {
        const parsedMessage = JSON.parse(msg);
        if (parsedMessage.message && parsedMessage.sender) {
          try {
            const senderKey = userKeys[parsedMessage.sender];
            console.log("ParsedMessage:", parsedMessage);
            // Decrypt only if the message is marked as encrypted
            if (parsedMessage.isEncrypted && senderKey) {
              parsedMessage.message = decryptMessage(
                parsedMessage.message,
                senderKey
              );
              parsedMessage.isEncrypted = false; // Mark as decrypted
              console.log(
                `[Debug] Successfully decrypted message from ${parsedMessage.sender}: ${parsedMessage.message}`
              );
            } else {
              console.log(
                `[Debug] Skipping decryption for plaintext message from ${parsedMessage.sender}: ${parsedMessage.message}`
              );
            }
          } catch (error) {
            console.error(
              `[Debug] Decryption error for ${parsedMessage.sender}:`,
              error
            );
            // Optionally, mark the message as "[Encrypted Message]" if decryption fails
            parsedMessage.message = "[Encrypted Message]";
          }
        }
        return parsedMessage;
      });

      console.log(`[History] Processed ${decryptedHistory.length} messages`);
      setMessages(decryptedHistory);
    },
    [userKeys, fetchUserKey]
  );

  const handleIncomingMessage = useCallback(
    async (receivedMessage) => {
      if (!receivedMessage.sender || !receivedMessage.message) return;

      try {
        let senderKey = userKeys[receivedMessage.sender];

        // Fetch the sender's key if it is undefined
        if (!senderKey) {
          console.log(
            `[Debug] Fetching key for sender: ${receivedMessage.sender}`
          );
          await fetchUserKey(receivedMessage.sender);
          senderKey = userKeys[receivedMessage.sender]; // Recheck after fetching
        }

        console.log("isEncrypted:", receivedMessage.isEncrypted);
        console.log("SenderKey:", senderKey);

        // Decrypt only if the message is marked as encrypted
        if (receivedMessage.isEncrypted && senderKey) {
          receivedMessage.message = decryptMessage(
            receivedMessage.message,
            senderKey
          );
          receivedMessage.isEncrypted = false; // Mark as decrypted
          console.log(
            `[Debug] Decrypted message from ${receivedMessage.sender}: ${receivedMessage.message}`
          );
        } else {
          console.log(
            `[Debug] Skipping decryption for plaintext message from ${receivedMessage.sender}: ${receivedMessage.message}`
          );
        }

        setMessages((prev) => [...prev, receivedMessage]);
      } catch (error) {
        console.error("[Debug] Decryption error:", error);
        // Optionally, mark the message as "[Encrypted Message]" if decryption fails
        receivedMessage.message = "[Encrypted Message]";
        setMessages((prev) => [...prev, receivedMessage]);
      }
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

  const fetchChatrooms = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "get_channels" }));
    }
  }, []);

  useEffect(() => {
    fetchChatrooms(); // Fetch chatrooms on component mount
  }, [fetchChatrooms]);

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

    // socketRef.current = new WebSocket("ws://localhost:8765");
    socketRef.current = new WebSocket(
      "wss://rat-chat-server-production.up.railway.app"
    );

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
      // Fetch available channels
      socketRef.current.send(
        JSON.stringify({
          type: "get_channels",
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

        if (receivedMessage.type === "file_download") {
          console.log("Downloading file");
          handleFileDownload(
            receivedMessage.file_data,
            receivedMessage.filename,
            receivedMessage.checksum // Pass checksum for validation
          );
        }

        if (receivedMessage.type === "chatroom_history") {
          await fetchAndDecryptHistory(receivedMessage.history);
        } else if (receivedMessage.type === "online_users") {
          setOnlineUsers(receivedMessage.users); // Revert functionality
        } else if (receivedMessage.type === "pong") {
          console.log("Heartbeat received");
          if (pingTimeoutRef.current) {
            clearTimeout(pingTimeoutRef.current);
            pingTimeoutRef.current = null;
          }
          return;
        } else if (receivedMessage.type === "typing_status") {
          setTypingUsers((prev) => {
            const newSet = new Set(prev);
            if (receivedMessage.is_typing) {
              newSet.add(receivedMessage.username);
            } else {
              newSet.delete(receivedMessage.username);
            }
            return newSet;
          }); // Revert functionality
        } else if (receivedMessage.type === "channel_list") {
          // Ensure users property is always defined
          const updatedChannels = receivedMessage.channels.map((channel) => ({
            ...channel,
            users: channel.users || [], // Default to an empty array if users is undefined
          }));
          setChatrooms(updatedChannels); // Update chatrooms list with user permissions
        } else if (receivedMessage.chatroom === currentChatRef.current) {
          handleIncomingMessage(receivedMessage);
        } else if (receivedMessage.status === "error") {
          console.error("Error from server:", receivedMessage.message);
          toast.error(receivedMessage.message);
        } else if (receivedMessage.status === "success") {
          toast.success(receivedMessage.message);
        } else {
          console.log(
            `Message received for chatroom ${receivedMessage.chatroom}, but currentChat is ${currentChatRef.current}`
          );
        }

        if (receivedMessage.type === "file_upload_status") {
          if (receivedMessage.status === "success") {
            toast.success("File uploaded successfully!");
          } else if (receivedMessage.status === "error") {
            toast.error(receivedMessage.message || "File upload failed");
          }
        }
      } else {
        console.log("Received unknown data type");
      }
    };
  }, [
    startHeartbeat,
    handleFileDownload,
    userKeys,
    isInitializing,
    handleIncomingMessage,
    globalEncryptionKey,
    fetchAndDecryptHistory,
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

  const createNewChannel = (channelName) => {
    if (!channelName.trim() || !socketRef.current || !isConnected) return;

    socketRef.current.send(
      JSON.stringify({
        type: "create_channel",
        channelName: channelName.trim(),
        creator: localStorage.getItem("username"),
      })
    );
  };

  const handleCommand = (command) => {
    const [action, username] = command.split(" ");
    if (!username || !socketRef.current || !isConnected) return;

    if (action === "/add") {
      socketRef.current.send(
        JSON.stringify({
          type: "add_user_to_channel",
          username,
          chatroom: currentChat,
        })
      );
      toast.success(`${username} added to #${currentChat}`);
    } else if (action === "/remove") {
      socketRef.current.send(
        JSON.stringify({
          type: "remove_user_from_channel",
          username,
          chatroom: currentChat,
        })
      );
      toast.success(`${username} removed from #${currentChat}`);
    } else {
      toast.error(
        "Invalid command. Use /add <username> or /remove <username>."
      );
    }
  };

  const sendMessage = () => {
    if (message.trim().startsWith("/")) {
      handleCommand(message.trim());
      setMessage("");
      return;
    }
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
      isEncrypted: true,
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
    if (!isConnected) return; // Remove encryption dependency

    const reader = new FileReader();
    // const username = localStorage.getItem("username");
    const fileId = Math.random().toString(36).substring(7);

    reader.onload = (e) => {
      const fileDataArray = new Uint8Array(e.target.result); // Read file as binary data
      console.log("[Debug] Raw File Data (Uint8Array):", fileDataArray);

      // Calculate checksum without encryption
      const checksum = sha256(
        CryptoJS.lib.WordArray.create(fileDataArray)
      ).toString();
      console.log(`[Debug] File Checksum (before upload): ${checksum}`);

      const totalChunks = Math.ceil(fileDataArray.length / MAX_CHUNK_SIZE);
      console.log(
        `[Upload] Starting file upload of ${file.name} in ${totalChunks} chunks`
      );

      setUploadProgress(0); // Initialize progress

      for (let i = 0; i < totalChunks; i++) {
        const chunk = fileDataArray.slice(
          i * MAX_CHUNK_SIZE,
          (i + 1) * MAX_CHUNK_SIZE
        );
        const offset = i * MAX_CHUNK_SIZE;
        const isLastChunk = i === totalChunks - 1;

        setTimeout(() => {
          sendChunk(chunk, offset, isLastChunk, checksum);
          if (isLastChunk) setUploadProgress(null); // Reset progress on completion
        }, i * 100);
      }
    };

    const sendChunk = (chunk, offset, isLastChunk, checksum) => {
      try {
        // Send raw chunk without encryption
        console.log(`[Debug] Raw Chunk at offset ${offset}:`, chunk);

        const metadata = JSON.stringify({
          type: "upload_file_chunk",
          fileId: fileId,
          fileName: file.name,
          chunk: Array.from(chunk), // Convert Uint8Array to Array for JSON serialization
          offset: offset,
          isLastChunk: isLastChunk,
          totalSize: file.size,
          checksum: checksum, // Include file checksum
          chatroom: currentChat,
          timestamp: new Date().toISOString(),
        });

        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(metadata);
          console.log(`[Upload] Sent chunk at offset ${offset}`);
          setUploadProgress(
            Math.min(((offset + chunk.length) / file.size) * 100, 100)
          ); // Update progress
        } else {
          toast.error("Connection lost during upload. Please try again.");
          setUploadProgress(null); // Reset progress on error
        }
      } catch (error) {
        console.error("Error sending chunk:", error);
        toast.error("File upload failed. Please try again.");
        setUploadProgress(null); // Reset progress on error
      }
    };

    reader.onerror = () => {
      toast.error("Error reading file. Please try again.");
      setUploadProgress(null); // Reset progress on error
    };

    reader.readAsArrayBuffer(file); // Read file as binary data
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
        chatrooms={chatrooms}
        createNewChannel={createNewChannel} // Pass the createNewChannel function
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
            .filter((msg) => msg.message && msg.timestamp && !msg.isEncrypted) // Filter out invalid or encrypted messages
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
      <Modal open={uploadProgress !== null}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
          }}
        >
          <CircularProgress />
          <p style={{ marginTop: "10px" }}>
            Uploading... {Math.round(uploadProgress)}%
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default Chat;
