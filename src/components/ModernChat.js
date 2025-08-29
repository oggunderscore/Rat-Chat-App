import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "./Sidebar";
import EmojiPicker from "./EmojiPicker";
import AttachFileButton from "./AttachFileButton";
import ConnectionStatus from "./ConnectionStatus";
import MarkdownToolbar from "./MarkdownToolbar";
import UserManagementPanel from "./UserManagementPanel";
import {
  Send as SendIcon,
  Group as GroupIcon,
} from "@mui/icons-material";
import CryptoJS from "crypto-js";
import sha256 from "crypto-js/sha256";
import { ToastContainer, toast } from "react-toastify";
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
import { theme } from "../styles/theme";

const encryptMessage = (message, key) => {
  return CryptoJS.AES.encrypt(message, key).toString();
};

const decryptMessage = (encryptedMessage, key) => {
  const bytes = CryptoJS.AES.decrypt(encryptedMessage, key);
  return bytes.toString(CryptoJS.enc.Utf8);
};

const MAX_CHUNK_SIZE = 16384; // 16KB chunks

const ModernChat = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [user, setUser] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [currentChat, setCurrentChat] = useState("general");
  const [showUserManagement, setShowUserManagement] = useState(false);
  const currentChatRef = useRef("general");
  const retryCountRef = useRef(0);
  const socketRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const heartbeatFunctionRef = useRef(null);
  const pingTimeoutRef = useRef(null);
  const [typingUsers, setTypingUsers] = useState(new Set());

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

  const [chatrooms, setChatrooms] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Update currentChatRef when currentChat changes
  useEffect(() => {
    console.log(`🔄 [STATE UPDATE] currentChat changed from "${currentChatRef.current}" to "${currentChat}"`);
    currentChatRef.current = currentChat;
  }, [currentChat]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auth state listener
  useEffect(() => {
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
        const binaryData = Uint8Array.from(atob(fileData), (c) =>
          c.charCodeAt(0)
        );

        const checksum = sha256(
          CryptoJS.lib.WordArray.create(binaryData)
        ).toString();

        if (checksum !== expectedChecksum) {
          throw new Error("Checksum mismatch. File may be corrupted.");
        }

        const blob = new Blob([binaryData], {
          type: "application/octet-stream",
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
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

      pendingKeyFetches.current.add(username);

      if (keyFetchTimeout.current) {
        clearTimeout(keyFetchTimeout.current);
      }

      keyFetchTimeout.current = setTimeout(async () => {
        if (pendingKeyFetches.current.size === 0) return;

        try {
          const usersRef = collection(db, "users");
          const usernames = [...pendingKeyFetches.current];

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

          setUserKeys((prev) => ({ ...prev, ...newKeys }));
          pendingKeyFetches.current.clear();

          setMessages((messages) =>
            messages.map((msg) => {
              if (msg.sender && newKeys[msg.sender] && msg.message) {
                if (msg.isEncrypted) {
                  try {
                    msg.message = decryptMessage(
                      msg.message,
                      newKeys[msg.sender]
                    );
                    msg.isEncrypted = false;
                  } catch (error) {
                    console.error("Failed to decrypt message:", error);
                  }
                }
              }
              return msg;
            })
          );
        } catch (error) {
          console.error("Error batch fetching keys:", error);
        }
      }, 100);
    },
    [userKeys]
  );

  // Create heartbeat function
  useEffect(() => {
    heartbeatFunctionRef.current = () => {
      if (pingTimeoutRef.current) {
        clearTimeout(pingTimeoutRef.current);
      }

      const username = localStorage.getItem("username");
      pingTimeoutRef.current = setTimeout(() => {
        console.log(`💓 [HEARTBEAT] Ping timeout - no pong received for user ${username}`);
        if (socketRef.current) {
          socketRef.current.close();
          socketRef.current = null;
        }
        connectWebSocket();
      }, 5000);

      try {
        const pingMessage = { type: "ping", username: username };
        console.log("📤 [WEBSOCKET SEND] ping:", pingMessage);
        socketRef.current.send(JSON.stringify(pingMessage));

        const onlineUsersMessage = { type: "get_online_users" };
        console.log("📤 [WEBSOCKET SEND] get_online_users:", onlineUsersMessage);
        socketRef.current.send(JSON.stringify(onlineUsersMessage));

        const channelsMessage = { type: "get_channels" };
        console.log("📤 [WEBSOCKET SEND] get_channels:", channelsMessage);
        socketRef.current.send(JSON.stringify(channelsMessage));
      } catch (error) {
        console.error("❌ [HEARTBEAT] Error sending ping:", error);
        clearTimeout(pingTimeoutRef.current);
        connectWebSocket();
      }
    };
  });

  const fetchAndDecryptHistory = useCallback(
    async (history) => {
      const uniqueSenders = new Set(
        history.map((msg) => {
          const parsedMessage = JSON.parse(msg);
          return parsedMessage.sender;
        })
      );

      const missingKeys = [...uniqueSenders].filter(
        (sender) => !userKeys[sender]
      );

      if (missingKeys.length > 0) {
        await Promise.all(missingKeys.map(fetchUserKey));
      }

      const decryptedHistory = history.map((msg) => {
        const parsedMessage = JSON.parse(msg);
        if (parsedMessage.message && parsedMessage.sender) {
          try {
            const senderKey = userKeys[parsedMessage.sender];
            if (parsedMessage.isEncrypted && senderKey) {
              parsedMessage.message = decryptMessage(
                parsedMessage.message,
                senderKey
              );
              parsedMessage.isEncrypted = false;
            }
          } catch (error) {
            console.error("Decryption error:", error);
            parsedMessage.message = "[Encrypted Message]";
          }
        }
        return parsedMessage;
      });

      setMessages(decryptedHistory);
    },
    [userKeys, fetchUserKey]
  );

  const handleIncomingMessage = useCallback(
    async (receivedMessage) => {
      if (!receivedMessage.sender || !receivedMessage.message) return;

      try {
        let senderKey = userKeys[receivedMessage.sender];

        if (!senderKey) {
          await fetchUserKey(receivedMessage.sender);
          senderKey = userKeys[receivedMessage.sender];
        }

        if (receivedMessage.isEncrypted && senderKey) {
          receivedMessage.message = decryptMessage(
            receivedMessage.message,
            senderKey
          );
          receivedMessage.isEncrypted = false;
        }

        setMessages((prev) => [...prev, receivedMessage]);
      } catch (error) {
        console.error("Decryption error:", error);
        receivedMessage.message = "[Encrypted Message]";
        setMessages((prev) => [...prev, receivedMessage]);
      }
    },
    [userKeys, fetchUserKey]
  );

  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    heartbeatIntervalRef.current = setInterval(() => {
      heartbeatFunctionRef.current?.();
    }, 30000);
  }, []);

  const fetchChatrooms = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "get_channels" }));
    }
  }, []);

  useEffect(() => {
    fetchChatrooms();
  }, [fetchChatrooms]);

  const connectWebSocket = useCallback(() => {
    if (isInitializing) {
      return;
    }

    if (socketRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    if (
      socketRef.current &&
      socketRef.current.readyState !== WebSocket.CLOSED
    ) {
      return;
    }

    setIsConnecting(true);
    console.log("🔌 [WEBSOCKET] Connecting to WebSocket server...");

    socketRef.current = new WebSocket(
      "wss://rat-chat-server-production.up.railway.app"
    );
    
    console.log("🔌 [WEBSOCKET] WebSocket instance created, waiting for connection...");

    socketRef.current.onopen = () => {
      console.log("✅ [WEBSOCKET] Connection established successfully!");
      setIsInitializing(true);
      setIsConnecting(false);
      expectedMessagesRef.current = 2;
      receivedMessagesRef.current = 0;

      initTimeoutRef.current = setTimeout(() => {
        if (isInitializing) {
          console.log("⏰ [WEBSOCKET] Initialization timeout reached");
          setIsInitializing(false);
          socketRef.current?.close(4000, "Initialization timeout");
        }
      }, 5000);

      const username = localStorage.getItem("username");
      console.log(`👤 [WEBSOCKET] Initializing for user: ${username}, channel: ${currentChatRef.current}`);
      
      setIsConnected(true);
      retryCountRef.current = 0;
      startHeartbeat();

      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      // Send initial join message
      const joinMessage = { username, chatroom: currentChatRef.current };
      console.log("📤 [WEBSOCKET SEND] join_chatroom:", joinMessage);
      socketRef.current.send(JSON.stringify(joinMessage));
      
      // Fetch history for current channel
      const historyMessage = { type: "fetch_history", chatroom: currentChatRef.current };
      console.log("📤 [WEBSOCKET SEND] fetch_history:", historyMessage);
      socketRef.current.send(JSON.stringify(historyMessage));
      
      // Get online users
      const onlineUsersMessage = { type: "get_online_users", username: localStorage.getItem("username") };
      console.log("📤 [WEBSOCKET SEND] get_online_users:", onlineUsersMessage);
      socketRef.current.send(JSON.stringify(onlineUsersMessage));
      
      // Get available channels
      const channelsMessage = { type: "get_channels" };
      console.log("📤 [WEBSOCKET SEND] get_channels:", channelsMessage);
      socketRef.current.send(JSON.stringify(channelsMessage));
      
      toast.success("Connected to server!");
    };

    socketRef.current.onerror = (error) => {
      console.error("❌ [WEBSOCKET ERROR]:", error);
      setIsConnecting(false);
    };

    socketRef.current.onclose = (event) => {
      clearTimeout(initTimeoutRef.current);
      setIsInitializing(false);
      setIsConnecting(false);
      receivedMessagesRef.current = 0;

      console.log(`🔌 [WEBSOCKET CLOSE] Connection closed. Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}`);

      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        console.log("💓 [HEARTBEAT] Stopped heartbeat interval");
      }

      if (event.code !== 1000 && event.code !== 1001 && !isInitializing) {
        if (retryCountRef.current < 5) {
          console.log(`🔄 [WEBSOCKET] Attempting reconnection ${retryCountRef.current + 1}/5 in 5 seconds...`);
          toast.info("Attempting to reconnect...");
          setIsConnected(false);
          retryCountRef.current += 1;
          retryTimeoutRef.current = setTimeout(connectWebSocket, 5000);
        } else {
          console.log("❌ [WEBSOCKET] Max reconnection attempts reached");
          toast.error("Connection failed after 5 attempts");
        }
      }
    };

    socketRef.current.onmessage = async (event) => {
      if (typeof event.data === "string") {
        const receivedMessage = JSON.parse(event.data);
        console.log("📥 [WEBSOCKET RECEIVE]:", receivedMessage);

        if (receivedMessage.type === "file_download") {
          console.log("📁 [FILE] Processing file download:", receivedMessage.filename);
          handleFileDownload(
            receivedMessage.file_data,
            receivedMessage.filename,
            receivedMessage.checksum
          );
        } else if (receivedMessage.type === "chatroom_history") {
          console.log(`📜 [HISTORY] Received ${receivedMessage.history?.length || 0} messages for channel`);
          await fetchAndDecryptHistory(receivedMessage.history);
        } else if (receivedMessage.type === "online_users") {
          console.log(`👥 [USERS] Updated online users list: ${receivedMessage.users?.length || 0} users`);
          setOnlineUsers(receivedMessage.users);
        } else if (receivedMessage.type === "pong") {
          console.log("💓 [HEARTBEAT] Pong received");
          if (pingTimeoutRef.current) {
            clearTimeout(pingTimeoutRef.current);
            pingTimeoutRef.current = null;
          }
          return;
        } else if (receivedMessage.type === "typing_status") {
          console.log(`⌨️ [TYPING] ${receivedMessage.username} is ${receivedMessage.is_typing ? 'typing' : 'not typing'}`);
          setTypingUsers((prev) => {
            const newSet = new Set(prev);
            if (receivedMessage.is_typing) {
              newSet.add(receivedMessage.username);
            } else {
              newSet.delete(receivedMessage.username);
            }
            return newSet;
          });
        } else if (receivedMessage.type === "channel_list") {
          console.log(`🏷️ [CHANNELS] Updated channels list: ${receivedMessage.channels?.length || 0} channels`);
          const updatedChannels = receivedMessage.channels.map((channel) => ({
            ...channel,
            users: channel.users || [],
          }));
          setChatrooms(updatedChannels);
        } else if (receivedMessage.type === "switch_chatroom_success") {
          console.log(`✅ [CHANNEL SWITCH] Successfully switched to channel: ${receivedMessage.chatroom}`);
          toast.success(`Joined #${receivedMessage.chatroom}`);
        } else if (receivedMessage.type === "switch_chatroom_error") {
          console.error(`❌ [CHANNEL SWITCH] Failed to switch channel: ${receivedMessage.message}`);
          toast.error(`Failed to join channel: ${receivedMessage.message}`);
        } else if (receivedMessage.chatroom === currentChatRef.current) {
          console.log(`💬 [MESSAGE] New message in current channel (${currentChatRef.current}):`, receivedMessage);
          handleIncomingMessage(receivedMessage);
        } else if (receivedMessage.chatroom && receivedMessage.chatroom !== currentChatRef.current) {
          console.log(`💬 [MESSAGE] Message for different channel (${receivedMessage.chatroom}), current: ${currentChatRef.current} - ignoring`);
        } else if (receivedMessage.status === "error") {
          console.error("❌ [SERVER ERROR]:", receivedMessage.message);
          toast.error(receivedMessage.message);
        } else if (receivedMessage.status === "success") {
          console.log("✅ [SERVER SUCCESS]:", receivedMessage.message);
          toast.success(receivedMessage.message);
        } else {
          console.log("❓ [UNKNOWN MESSAGE TYPE]:", receivedMessage);
        }

        if (receivedMessage.type === "file_upload_status") {
          if (receivedMessage.status === "success") {
            console.log("✅ [FILE UPLOAD] File uploaded successfully");
            toast.success("File uploaded successfully!");
          } else if (receivedMessage.status === "error") {
            console.error("❌ [FILE UPLOAD] Upload failed:", receivedMessage.message);
            toast.error(receivedMessage.message || "File upload failed");
          }
        }
      } else {
        console.log("📥 [WEBSOCKET] Received non-string data:", typeof event.data);
      }
    };
  }, [
    startHeartbeat,
    handleFileDownload,
    isInitializing,
    handleIncomingMessage,
    fetchAndDecryptHistory,
  ]);

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
      const userData = userDoc.data();

      if (userDoc.exists() && userData.encryptionKey) {
        const key = userData.encryptionKey;
        const username = localStorage.getItem("username");

        await Promise.all([
          new Promise((resolve) => {
            setUserKeys((prev) => ({ ...prev, [username]: key }));
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
        return;
      }

      const username = localStorage.getItem("username");
      const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

      if (!username || !isLoggedIn || !isAuthReady) {
        return;
      }

      try {
        setIsInitializationPending(true);

        if (!globalEncryptionKey) {
          const key = await fetchGlobalEncryptionKey();
          if (!key) {
            throw new Error("Failed to fetch encryption key");
          }
          return;
        }

        if (
          !socketRef.current ||
          socketRef.current.readyState === WebSocket.CLOSED
        ) {
          setUser(username);
          connectWebSocket();
        }
      } catch (error) {
        console.error("Failed to initialize chat:", error);
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
    if (!channelName.trim() || !socketRef.current || !isConnected) {
      console.log("❌ [CREATE CHANNEL] Cannot create channel - missing data or not connected");
      return;
    }

    const createMessage = {
      type: "create_channel",
      channelName: channelName.trim(),
      creator: localStorage.getItem("username"),
    };
    
    console.log("📤 [WEBSOCKET SEND] create_channel:", createMessage);
    socketRef.current.send(JSON.stringify(createMessage));
  };

  const deleteChannel = (channelName) => {
    console.log(`🗑️ [DELETE CHANNEL] Attempting to delete channel: ${channelName}`);
    
    if (!channelName || channelName === 'general' || !socketRef.current || !isConnected) {
      if (channelName === 'general') {
        console.log("❌ [DELETE CHANNEL] Cannot delete general channel");
        toast.error("Cannot delete the general channel");
      } else {
        console.log("❌ [DELETE CHANNEL] Cannot delete - missing data or not connected");
      }
      return;
    }

    const confirmDelete = window.confirm(`Are you sure you want to delete the channel #${channelName}?`);
    if (confirmDelete) {
      const deleteMessage = {
        type: "delete_channel",
        channelName: channelName,
        requester: localStorage.getItem("username"),
      };
      
      console.log("📤 [WEBSOCKET SEND] delete_channel:", deleteMessage);
      socketRef.current.send(JSON.stringify(deleteMessage));
      
      // If we're currently in the channel being deleted, switch to general
      if (currentChat === channelName) {
        console.log(`🔄 [DELETE CHANNEL] Currently in deleted channel, switching to general`);
        handleChannelSwitch('general');
      }
    } else {
      console.log("❌ [DELETE CHANNEL] User cancelled deletion");
    }
  };

  const handleChannelSwitch = (newChannel) => {
    console.log(`🔄 [CHANNEL SWITCH] Attempting to switch from "${currentChat}" to "${newChannel}"`);
    
    if (newChannel === currentChat) {
      console.log(`⚠️ [CHANNEL SWITCH] Already in channel "${newChannel}", skipping switch`);
      return;
    }
    
    // Clear current messages
    console.log(`🧹 [CHANNEL SWITCH] Clearing messages for channel switch`);
    setMessages([]);
    
    // Update current chat
    console.log(`📝 [CHANNEL SWITCH] Updating currentChat state to "${newChannel}"`);
    setCurrentChat(newChannel);
    currentChatRef.current = newChannel;
    
    // Send switch_chatroom message to WebSocket server
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const switchMessage = {
        type: "switch_chatroom",
        username: localStorage.getItem("username"),
        old_chatroom: currentChat,
        new_chatroom: newChannel
      };
      
      console.log(`📤 [WEBSOCKET SEND] switch_chatroom:`, switchMessage);
      socketRef.current.send(JSON.stringify(switchMessage));
      
      // Also send fetch_history for the new channel
      const historyMessage = {
        type: "fetch_history",
        chatroom: newChannel,
      };
      
      console.log(`📤 [WEBSOCKET SEND] fetch_history:`, historyMessage);
      socketRef.current.send(JSON.stringify(historyMessage));
      
      toast.info(`Switched to #${newChannel}`);
    } else {
      console.error(`❌ [CHANNEL SWITCH] WebSocket not connected, cannot switch to "${newChannel}"`);
      toast.error("Cannot switch channels - not connected to server");
    }
  };

  const handleAddUser = (username) => {
    if (!username || !socketRef.current || !isConnected) {
      console.log("❌ [ADD USER] Cannot add user - missing data or not connected");
      return;
    }

    const addUserMessage = {
      type: "add_user_to_channel",
      username,
      chatroom: currentChat,
    };
    
    console.log("📤 [WEBSOCKET SEND] add_user_to_channel:", addUserMessage);
    socketRef.current.send(JSON.stringify(addUserMessage));
    toast.success(`${username} added to #${currentChat}`);
  };

  const handleRemoveUser = (username) => {
    if (!username || !socketRef.current || !isConnected) {
      console.log("❌ [REMOVE USER] Cannot remove user - missing data or not connected");
      return;
    }

    const removeUserMessage = {
      type: "remove_user_from_channel",
      username,
      chatroom: currentChat,
    };
    
    console.log("📤 [WEBSOCKET SEND] remove_user_from_channel:", removeUserMessage);
    socketRef.current.send(JSON.stringify(removeUserMessage));
    toast.success(`${username} removed from #${currentChat}`);
  };

  const sendMessage = () => {
    if (
      message.trim() === "" ||
      !socketRef.current ||
      !isConnected ||
      !globalEncryptionKey
    ) {
      console.log("❌ [SEND MESSAGE] Cannot send - missing data or not connected");
      return;
    }

    const timestamp = new Date().toISOString();
    const encryptedMessage = encryptMessage(
      message.trim(),
      globalEncryptionKey
    );
    const messageData = {
      message: encryptedMessage,
      timestamp,
      chatroom: currentChat,
      isEncrypted: true,
    };

    console.log("📤 [WEBSOCKET SEND] message:", {
      ...messageData,
      message: `[ENCRYPTED: ${message.trim()}]` // Show original message in logs for debugging
    });
    socketRef.current.send(JSON.stringify(messageData));
    setMessage("");
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const handleRetryConnection = () => {
    retryCountRef.current = 0;
    connectWebSocket();
  };

  const handleMarkdownInsert = (newText) => {
    setMessage(newText);
  };

  const handleFileUpload = (file) => {
    if (!isConnected) return;

    const reader = new FileReader();
    const fileId = Math.random().toString(36).substring(7);

    reader.onload = (e) => {
      const fileDataArray = new Uint8Array(e.target.result);
      const checksum = sha256(
        CryptoJS.lib.WordArray.create(fileDataArray)
      ).toString();

      const totalChunks = Math.ceil(fileDataArray.length / MAX_CHUNK_SIZE);
      setUploadProgress(0);

      for (let i = 0; i < totalChunks; i++) {
        const chunk = fileDataArray.slice(
          i * MAX_CHUNK_SIZE,
          (i + 1) * MAX_CHUNK_SIZE
        );
        const offset = i * MAX_CHUNK_SIZE;
        const isLastChunk = i === totalChunks - 1;

        setTimeout(() => {
          sendChunk(chunk, offset, isLastChunk, checksum);
          if (isLastChunk) setUploadProgress(null);
        }, i * 100);
      }
    };

    const sendChunk = (chunk, offset, isLastChunk, checksum) => {
      try {
        const metadata = JSON.stringify({
          type: "upload_file_chunk",
          fileId: fileId,
          fileName: file.name,
          chunk: Array.from(chunk),
          offset: offset,
          isLastChunk: isLastChunk,
          totalSize: file.size,
          checksum: checksum,
          chatroom: currentChat,
          timestamp: new Date().toISOString(),
        });

        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(metadata);
          setUploadProgress(
            Math.min(((offset + chunk.length) / file.size) * 100, 100)
          );
        } else {
          toast.error("Connection lost during upload. Please try again.");
          setUploadProgress(null);
        }
      } catch (error) {
        console.error("Error sending chunk:", error);
        toast.error("File upload failed. Please try again.");
        setUploadProgress(null);
      }
    };

    reader.onerror = () => {
      toast.error("Error reading file. Please try again.");
      setUploadProgress(null);
    };

    reader.readAsArrayBuffer(file);
  };

  const getCurrentChannelUsers = () => {
    const currentChannel = chatrooms.find(room => room.name === currentChat);
    return currentChannel ? currentChannel.users || [] : [];
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = (msg, index) => {
    const isOwnMessage = msg.sender === user;
    const isFileMessage = msg.message && (msg.message.startsWith('[File:') || msg.type === 'file');
    
    return (
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        style={{
          display: 'flex',
          flexDirection: isOwnMessage ? 'row-reverse' : 'row',
          marginBottom: theme.spacing.md,
          alignItems: 'flex-start',
          gap: theme.spacing.sm,
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: theme.borderRadius.full,
            backgroundColor: isOwnMessage ? theme.colors.primary : theme.colors.secondary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '0.9rem',
            fontWeight: '600',
            flexShrink: 0,
          }}
        >
          {msg.sender ? msg.sender.charAt(0).toUpperCase() : '?'}
        </div>
        
        <div
          style={{
            maxWidth: '70%',
            backgroundColor: isOwnMessage ? theme.colors.primary : theme.colors.surface,
            padding: theme.spacing.md,
            borderRadius: theme.borderRadius.lg,
            border: `1px solid ${isOwnMessage ? theme.colors.primary : theme.colors.border}`,
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: theme.spacing.xs,
            }}
          >
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: '600',
                color: isOwnMessage ? 'rgba(255,255,255,0.9)' : theme.colors.text,
              }}
            >
              {msg.sender}
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                color: isOwnMessage ? 'rgba(255,255,255,0.7)' : theme.colors.textMuted,
              }}
            >
              {formatTimestamp(msg.timestamp)}
            </span>
          </div>
          
          <div
            style={{
              color: isOwnMessage ? 'white' : theme.colors.text,
              fontSize: '0.9rem',
              lineHeight: '1.4',
              wordBreak: 'break-word',
            }}
          >
            {isFileMessage ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (msg.fileId && socketRef.current) {
                    socketRef.current.send(JSON.stringify({
                      type: "download_file",
                      fileId: msg.fileId,
                      chatroom: currentChat
                    }));
                  }
                }}
                style={{
                  background: isOwnMessage ? 'rgba(255,255,255,0.2)' : theme.colors.accent + '20',
                  border: `1px solid ${isOwnMessage ? 'rgba(255,255,255,0.3)' : theme.colors.accent}`,
                  borderRadius: theme.borderRadius.md,
                  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                  color: isOwnMessage ? 'white' : theme.colors.accent,
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  transition: theme.transitions.fast,
                }}
              >
                📎 {msg.fileName || msg.message.replace('[File: ', '').replace(']', '')}
              </motion.button>
            ) : (
              msg.message
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: theme.colors.background }}>
      <Sidebar
        setCurrentChat={handleChannelSwitch}
        onlineUsers={onlineUsers}
        chatrooms={chatrooms}
        createNewChannel={createNewChannel}
        deleteChannel={deleteChannel}
        currentChat={currentChat}
      />
      
      <div style={{ marginLeft: '280px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: theme.spacing.lg,
            borderBottom: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.surface,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            minHeight: '80px',
          }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: theme.spacing.md,
            height: '48px',
          }}>
            <h1 style={{
              color: theme.colors.text,
              fontSize: '1.5rem',
              fontWeight: '600',
              margin: 0,
              lineHeight: '1',
            }}>
              #{currentChat}
            </h1>
            
            {currentChat !== 'general' && !currentChat.includes('_') && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowUserManagement(true)}
                style={{
                  backgroundColor: theme.colors.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: theme.borderRadius.md,
                  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  height: '40px',
                }}
              >
                <GroupIcon sx={{ fontSize: 18 }} />
                Manage Users
              </motion.button>
            )}
            
            {/* Debug button - remove in production */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                console.log("🐛 [DEBUG STATE]", {
                  currentChat,
                  currentChatRef: currentChatRef.current,
                  isConnected,
                  socketState: socketRef.current?.readyState,
                  messagesCount: messages.length,
                  chatroomsCount: chatrooms.length,
                  onlineUsersCount: onlineUsers.length
                });
              }}
              style={{
                backgroundColor: theme.colors.secondary + '40',
                color: theme.colors.text,
                border: `1px solid ${theme.colors.secondary}`,
                borderRadius: theme.borderRadius.md,
                padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                cursor: 'pointer',
                fontSize: '0.8rem',
                height: '32px',
              }}
            >
              🐛 Debug
            </motion.button>
          </div>
          
          <div style={{ height: '48px', display: 'flex', alignItems: 'center' }}>
            <ConnectionStatus
              isConnected={isConnected}
              isConnecting={isConnecting}
              onRetry={handleRetryConnection}
            />
          </div>
        </motion.div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: theme.spacing.lg,
            backgroundColor: theme.colors.background,
          }}
        >
          <AnimatePresence>
            {messages.map((msg, index) => renderMessage(msg, index))}
          </AnimatePresence>
          
          {/* Typing Indicator */}
          {typingUsers.size > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                padding: theme.spacing.sm,
                color: theme.colors.textMuted,
                fontSize: '0.8rem',
                fontStyle: 'italic',
              }}
            >
              {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
            </motion.div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: theme.spacing.lg,
            borderTop: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.surface,
          }}
        >
          <MarkdownToolbar
            onMarkdownInsert={handleMarkdownInsert}
            textareaRef={textareaRef}
          />
          
          <div style={{ 
            display: 'flex', 
            gap: theme.spacing.sm, 
            alignItems: 'center',
            minHeight: '60px',
          }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`Message #${currentChat}`}
                style={{
                  width: '100%',
                  minHeight: '48px',
                  maxHeight: '120px',
                  padding: theme.spacing.md,
                  backgroundColor: theme.colors.background,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  color: theme.colors.text,
                  fontSize: '1rem',
                  resize: 'none',
                  fontFamily: 'inherit',
                  lineHeight: '1.4',
                }}
              />
              
              {/* Upload Progress Indicator */}
              {uploadProgress !== null && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '8px',
                    right: '8px',
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.borderRadius.sm,
                    padding: theme.spacing.xs,
                    fontSize: '0.8rem',
                    color: theme.colors.textSecondary,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Uploading file...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: '4px',
                      backgroundColor: theme.colors.border,
                      borderRadius: '2px',
                      overflow: 'hidden',
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      style={{
                        height: '100%',
                        backgroundColor: theme.colors.primary,
                        borderRadius: '2px',
                      }}
                    />
                  </div>
                </motion.div>
              )}
            </div>
            
            <div style={{ 
              display: 'flex', 
              gap: theme.spacing.sm,
              alignItems: 'center',
              height: '48px',
            }}>
              <EmojiPicker onEmojiSelect={(emoji) => setMessage(prev => prev + emoji)} />
              <AttachFileButton onFileSelect={handleFileUpload} />
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={sendMessage}
                disabled={!message.trim() || !isConnected}
                style={{
                  backgroundColor: message.trim() && isConnected ? theme.colors.primary : theme.colors.border,
                  color: 'white',
                  border: 'none',
                  borderRadius: theme.borderRadius.md,
                  padding: theme.spacing.md,
                  cursor: message.trim() && isConnected ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '48px',
                  height: '48px',
                  transition: theme.transitions.fast,
                }}
              >
                <SendIcon />
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>

      <UserManagementPanel
        isOpen={showUserManagement}
        onClose={() => setShowUserManagement(false)}
        onAddUser={handleAddUser}
        onRemoveUser={handleRemoveUser}
        currentChannel={currentChat}
        onlineUsers={onlineUsers}
        channelUsers={getCurrentChannelUsers()}
      />

      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </div>
  );
};

export default ModernChat;