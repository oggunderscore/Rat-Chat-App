import React, { useRef } from "react";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import IconButton from "@mui/material/IconButton";

const AttachFileButton = ({ onFileSelect }) => {
  const fileInputRef = useRef(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        style={{ display: "none" }}
      />
      <IconButton onClick={() => fileInputRef.current.click()}>
        <FileUploadIcon />
      </IconButton>
    </>
  );
};

export default AttachFileButton;
