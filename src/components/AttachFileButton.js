import React, { useRef } from "react";
import { motion } from "framer-motion";
import { AttachFile as AttachFileIcon } from "@mui/icons-material";
import { theme } from "../styles/theme";

const AttachFileButton = ({ onFileSelect }) => {
  const fileInputRef = useRef(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      onFileSelect(file);
    }
    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        style={{ display: "none" }}
        accept="*/*"
      />
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => fileInputRef.current?.click()}
        style={{
          backgroundColor: theme.colors.surface,
          color: theme.colors.textSecondary,
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
        <AttachFileIcon />
      </motion.button>
    </>
  );
};

export default AttachFileButton;
