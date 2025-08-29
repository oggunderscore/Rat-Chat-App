import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EmojiEmotions as EmojiEmotionsIcon } from "@mui/icons-material";
import { theme } from "../styles/theme";
import "emoji-picker-element";
import "./EmojiPicker.css";

const EmojiPicker = ({ onEmojiSelect }) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);

  const handleEmojiClick = useCallback(
    (event) => {
      onEmojiSelect(event.detail.unicode);
      setShowEmojiPicker(false);
    },
    [onEmojiSelect]
  );

  const handleClickOutside = useCallback((event) => {
    if (
      emojiPickerRef.current &&
      !emojiPickerRef.current.contains(event.target)
    ) {
      setShowEmojiPicker(false);
    }
  }, []);

  useEffect(() => {
    const picker = emojiPickerRef.current?.querySelector('emoji-picker');
    if (showEmojiPicker && picker) {
      document.addEventListener("mousedown", handleClickOutside);
      picker.addEventListener("emoji-click", handleEmojiClick);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (picker) {
        picker.removeEventListener("emoji-click", handleEmojiClick);
      }
    };
  }, [showEmojiPicker, handleClickOutside, handleEmojiClick]);

  return (
    <div style={{ position: 'relative' }}>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowEmojiPicker((prev) => !prev)}
        style={{
          backgroundColor: showEmojiPicker ? theme.colors.primary : theme.colors.surface,
          color: showEmojiPicker ? 'white' : theme.colors.textSecondary,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.borderRadius.md,
          padding: theme.spacing.md,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '48px',
          height: '48px',
          transition: theme.transitions.fast,
        }}
      >
        <EmojiEmotionsIcon />
      </motion.button>
      
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            ref={emojiPickerRef}
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              right: 0,
              marginBottom: theme.spacing.sm,
              zIndex: 1000,
              borderRadius: theme.borderRadius.lg,
              overflow: 'hidden',
              boxShadow: theme.shadows.xl,
            }}
          >
            <emoji-picker></emoji-picker>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EmojiPicker;
