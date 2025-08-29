import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Tag as TagIcon,
  Person as PersonIcon,
  Circle as CircleIcon,
  HelpOutline as HelpOutlineIcon,
} from "@mui/icons-material";
import LogoutButton from "./LogoutButton";
import HelpModal from "./HelpModal";
import { theme } from "../styles/theme";

const Sidebar = ({
  setCurrentChat,
  onlineUsers,
  chatrooms,
  createNewChannel,
  deleteChannel,
  currentChat,
}) => {
  const [user, setUser] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const username = localStorage.getItem("username");
    if (!username) {
      console.log("No username found, redirecting to login.");
      window.location.href = "/login";
      return;
    }
    setUser(username);
  }, []);

  const filteredUsers = onlineUsers
    .filter((username) => username !== user)
    .sort();

  const openDirectMessage = (username) => {
    const dmChannel = [user, username].sort().join("_");
    setCurrentChat(dmChannel);
  };

  const canJoinChannel = (channel) => {
    if (channel.name === "general") {
      return true;
    } else if (channel.users && channel.users.includes(user)) {
      return true;
    } else {
      return false;
    }
  };

  const handleCreateChannel = () => {
    const channelName = prompt("Enter new channel name:");
    if (channelName && channelName.trim()) {
      createNewChannel(channelName.trim());
    }
  };

  const sidebarVariants = {
    hidden: { x: -300, opacity: 0 },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 20,
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { x: -20, opacity: 0 },
    visible: { x: 0, opacity: 1 },
  };

  return (
    <>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={sidebarVariants}
        style={{
          width: "280px",
          height: "100vh",
          backgroundColor: theme.colors.surface,
          borderRight: `1px solid ${theme.colors.border}`,
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          left: 0,
          top: 0,
          zIndex: 100,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <motion.div
          variants={itemVariants}
          style={{
            padding: theme.spacing.lg,
            borderBottom: `1px solid ${theme.colors.border}`,
            background: `linear-gradient(135deg, ${theme.colors.primary}20, ${theme.colors.secondary}20)`,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: theme.spacing.sm,
            }}
          >
            <h2
              style={{
                color: theme.colors.text,
                fontSize: "1.5rem",
                fontWeight: "600",
                margin: 0,
              }}
            >
              RatChat
            </h2>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowHelp(true)}
              style={{
                background: "none",
                border: "none",
                color: theme.colors.textSecondary,
                cursor: "pointer",
                padding: theme.spacing.xs,
                borderRadius: theme.borderRadius.full,
              }}
            >
              <HelpOutlineIcon />
            </motion.button>
          </div>
          <p
            style={{
              color: theme.colors.textSecondary,
              fontSize: "0.9rem",
              margin: 0,
            }}
          >
            Welcome, {user}
          </p>
        </motion.div>

        {/* Scrollable Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: theme.spacing.md,
          }}
        >
          {/* Channels Section */}
          <motion.div variants={itemVariants} style={{ marginBottom: theme.spacing.xl }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: theme.spacing.md,
              }}
            >
              <h3
                style={{
                  color: theme.colors.text,
                  fontSize: "1rem",
                  fontWeight: "600",
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: theme.spacing.sm,
                }}
              >
                <TagIcon sx={{ fontSize: 18 }} />
                Channels
              </h3>
              <motion.button
                whileHover={{ scale: 1.1, backgroundColor: theme.colors.primary }}
                whileTap={{ scale: 0.9 }}
                onClick={handleCreateChannel}
                style={{
                  backgroundColor: theme.colors.primary + "40",
                  border: "none",
                  borderRadius: theme.borderRadius.full,
                  width: "24px",
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: theme.colors.text,
                  transition: theme.transitions.fast,
                }}
              >
                <AddIcon sx={{ fontSize: 16 }} />
              </motion.button>
            </div>

            <AnimatePresence>
              {chatrooms
                .filter((room) => canJoinChannel(room))
                .map((room, index) => (
                  <motion.div
                    key={room.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ x: 4, backgroundColor: theme.colors.surfaceHover }}
                    style={{
                      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                      borderRadius: theme.borderRadius.md,
                      cursor: "pointer",
                      marginBottom: theme.spacing.xs,
                      backgroundColor:
                        currentChat === room.name
                          ? theme.colors.primary + "20"
                          : "transparent",
                      border:
                        currentChat === room.name
                          ? `1px solid ${theme.colors.primary}40`
                          : "1px solid transparent",
                      transition: theme.transitions.fast,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: theme.spacing.sm,
                    }}
                  >
                    <div 
                      onClick={() => setCurrentChat(room.name)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: theme.spacing.sm,
                        flex: 1,
                      }}
                    >
                      <span
                        style={{
                          color:
                            currentChat === room.name
                              ? theme.colors.primary
                              : theme.colors.textSecondary,
                          fontSize: "1.2rem",
                          fontWeight: "500",
                        }}
                      >
                        #
                      </span>
                      <span
                        style={{
                          color:
                            currentChat === room.name
                              ? theme.colors.text
                              : theme.colors.textSecondary,
                          fontSize: "0.9rem",
                          fontWeight: currentChat === room.name ? "500" : "400",
                        }}
                      >
                        {room.name}
                      </span>
                    </div>
                    
                    {/* Delete button - only show for non-general channels */}
                    {room.name !== 'general' && deleteChannel && (
                      <motion.button
                        whileHover={{ scale: 1.1, backgroundColor: theme.colors.error }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChannel(room.name);
                        }}
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderRadius: theme.borderRadius.sm,
                          padding: theme.spacing.xs,
                          cursor: 'pointer',
                          color: theme.colors.textMuted,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: theme.transitions.fast,
                          opacity: 0.7,
                        }}
                      >
                        <DeleteIcon sx={{ fontSize: 14 }} />
                      </motion.button>
                    )}
                  </motion.div>
                ))}
            </AnimatePresence>
          </motion.div>

          {/* Direct Messages Section */}
          <motion.div variants={itemVariants} style={{ marginBottom: theme.spacing.xl }}>
            <h3
              style={{
                color: theme.colors.text,
                fontSize: "1rem",
                fontWeight: "600",
                margin: `0 0 ${theme.spacing.md} 0`,
                display: "flex",
                alignItems: "center",
                gap: theme.spacing.sm,
              }}
            >
              <PersonIcon sx={{ fontSize: 18 }} />
              Direct Messages
            </h3>

            <AnimatePresence>
              {filteredUsers.map((username, index) => (
                <motion.div
                  key={username}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ x: 4, backgroundColor: theme.colors.surfaceHover }}
                  onClick={() => openDirectMessage(username)}
                  style={{
                    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                    borderRadius: theme.borderRadius.md,
                    cursor: "pointer",
                    marginBottom: theme.spacing.xs,
                    backgroundColor:
                      currentChat === [user, username].sort().join("_")
                        ? theme.colors.primary + "20"
                        : "transparent",
                    border:
                      currentChat === [user, username].sort().join("_")
                        ? `1px solid ${theme.colors.primary}40`
                        : "1px solid transparent",
                    transition: theme.transitions.fast,
                    display: "flex",
                    alignItems: "center",
                    gap: theme.spacing.sm,
                  }}
                >
                  <CircleIcon
                    sx={{
                      fontSize: 8,
                      color: theme.colors.online,
                    }}
                  />
                  <span
                    style={{
                      color:
                        currentChat === [user, username].sort().join("_")
                          ? theme.colors.text
                          : theme.colors.textSecondary,
                      fontSize: "0.9rem",
                      fontWeight:
                        currentChat === [user, username].sort().join("_")
                          ? "500"
                          : "400",
                    }}
                  >
                    {username}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          {/* Online Users Section */}
          <motion.div variants={itemVariants}>
            <h3
              style={{
                color: theme.colors.text,
                fontSize: "1rem",
                fontWeight: "600",
                margin: `0 0 ${theme.spacing.md} 0`,
                display: "flex",
                alignItems: "center",
                gap: theme.spacing.sm,
              }}
            >
              <CircleIcon sx={{ fontSize: 18, color: theme.colors.online }} />
              Online ({onlineUsers.length})
            </h3>

            <AnimatePresence>
              {onlineUsers.map((username, index) => (
                <motion.div
                  key={username}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                  style={{
                    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                    display: "flex",
                    alignItems: "center",
                    gap: theme.spacing.sm,
                    marginBottom: theme.spacing.xs,
                  }}
                >
                  <CircleIcon
                    sx={{
                      fontSize: 8,
                      color: theme.colors.online,
                    }}
                  />
                  <span
                    style={{
                      color:
                        username === user
                          ? theme.colors.text
                          : theme.colors.textSecondary,
                      fontSize: "0.85rem",
                      fontWeight: username === user ? "500" : "400",
                    }}
                  >
                    {username} {username === user && "(you)"}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          variants={itemVariants}
          style={{
            padding: theme.spacing.md,
            borderTop: `1px solid ${theme.colors.border}`,
          }}
        >
          <LogoutButton />
        </motion.div>
      </motion.div>

      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </>
  );
};

export default Sidebar;
