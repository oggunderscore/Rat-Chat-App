import React, { useState, useEffect, useRef, useCallback } from "react";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import IconButton from "@mui/material/IconButton";
import "emoji-picker-element";
import "./EmojiPicker.css";

const EmojiPicker = ({ onSelect }) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);

  // Memoize the function so it doesn't change on every render
  const handleEmojiClick = useCallback(
    (event) => {
      onSelect(event.detail.unicode);
    },
    [onSelect]
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
    const picker = emojiPickerRef.current;
    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      picker?.addEventListener("emoji-click", handleEmojiClick);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      picker?.removeEventListener("emoji-click", handleEmojiClick);
    };
  }, [showEmojiPicker, handleClickOutside, handleEmojiClick]);

  return (
    <div className="emoji-container">
      <IconButton onClick={() => setShowEmojiPicker((prev) => !prev)}>
        <EmojiEmotionsIcon />
      </IconButton>
      {showEmojiPicker && (
        <div ref={emojiPickerRef} className="emoji-picker-overlay">
          <emoji-picker></emoji-picker>
        </div>
      )}
    </div>
  );
};

export default EmojiPicker;
