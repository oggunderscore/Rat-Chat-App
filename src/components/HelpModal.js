import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Close as CloseIcon,
  Chat as ChatIcon,
  Group as GroupIcon,
  PersonAdd as PersonAddIcon,
  AttachFile as AttachFileIcon,
  EmojiEmotions as EmojiEmotionsIcon,
  FormatBold as FormatBoldIcon,
} from '@mui/icons-material';
import { theme } from '../styles/theme';

const HelpModal = ({ isOpen, onClose }) => {
  const helpSections = [
    {
      title: 'Getting Started',
      icon: ChatIcon,
      items: [
        'Welcome to RatChat! This is a secure, encrypted chat application.',
        'Your messages are encrypted end-to-end for privacy.',
        'Use the sidebar to navigate between channels and direct messages.',
      ]
    },
    {
      title: 'Channels',
      icon: GroupIcon,
      items: [
        'Click the + icon next to "Chatrooms" to create a new channel.',
        'Click on any channel name to join the conversation.',
        'The general channel is available to everyone by default.',
      ]
    },
    {
      title: 'Managing Users',
      icon: PersonAddIcon,
      items: [
        'Click the "Manage Users" button to add or remove users from a channel.',
        'Search for online users and click to add them to the current channel.',
        'Remove users by clicking the remove button next to their name.',
      ]
    },
    {
      title: 'File Sharing',
      icon: AttachFileIcon,
      items: [
        'Click the attachment icon to upload files to the chat.',
        'Files are encrypted and can be downloaded by clicking on them.',
        'Supported file types include images, documents, and more.',
      ]
    },
    {
      title: 'Formatting Messages',
      icon: FormatBoldIcon,
      items: [
        'Use the markdown toolbar to format your messages.',
        'Select text and click formatting buttons for bold, italic, etc.',
        'You can also type markdown directly: **bold**, *italic*, `code`.',
      ]
    },
    {
      title: 'Emojis & Reactions',
      icon: EmojiEmotionsIcon,
      items: [
        'Click the emoji button to open the emoji picker.',
        'Add emojis to express yourself in conversations.',
        'Emojis work in all channels and direct messages.',
      ]
    },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.borderRadius.lg,
            padding: theme.spacing.xl,
            width: '90%',
            maxWidth: '700px',
            maxHeight: '80vh',
            overflow: 'auto',
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing.xl,
          }}>
            <h2 style={{
              color: theme.colors.text,
              margin: 0,
              fontSize: '1.8rem',
              fontWeight: '600',
            }}>
              How to Use RatChat
            </h2>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
                padding: theme.spacing.sm,
                borderRadius: theme.borderRadius.full,
              }}
            >
              <CloseIcon />
            </motion.button>
          </div>

          <div style={{
            display: 'grid',
            gap: theme.spacing.lg,
          }}>
            {helpSections.map((section, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                style={{
                  backgroundColor: theme.colors.background,
                  padding: theme.spacing.lg,
                  borderRadius: theme.borderRadius.md,
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  marginBottom: theme.spacing.md,
                }}>
                  <section.icon style={{
                    color: theme.colors.primary,
                    fontSize: '1.5rem',
                  }} />
                  <h3 style={{
                    color: theme.colors.text,
                    margin: 0,
                    fontSize: '1.2rem',
                    fontWeight: '600',
                  }}>
                    {section.title}
                  </h3>
                </div>
                
                <ul style={{
                  margin: 0,
                  paddingLeft: theme.spacing.lg,
                  color: theme.colors.textSecondary,
                  lineHeight: '1.6',
                }}>
                  {section.items.map((item, itemIndex) => (
                    <li key={itemIndex} style={{ marginBottom: theme.spacing.sm }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{
              marginTop: theme.spacing.xl,
              padding: theme.spacing.lg,
              backgroundColor: theme.colors.primary + '20',
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.primary}40`,
              textAlign: 'center',
            }}
          >
            <p style={{
              color: theme.colors.text,
              margin: 0,
              fontSize: '1rem',
              fontWeight: '500',
            }}>
              Need more help? Look for the help (?) button in the top navigation bar!
            </p>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default HelpModal;