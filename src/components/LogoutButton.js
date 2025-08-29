import React from "react";
import { motion } from "framer-motion";
import { getAuth, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Logout as LogoutIcon } from "@mui/icons-material";
import { theme } from "../styles/theme";
import "react-toastify/dist/ReactToastify.css";

const LogoutButton = () => {
  const auth = getAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("username");
      localStorage.removeItem("encryptionKey");

      toast.success("Logged out successfully!");
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error("Error signing out. Please try again.");
    }
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02, backgroundColor: theme.colors.error }}
      whileTap={{ scale: 0.98 }}
      onClick={handleLogout}
      style={{
        width: '100%',
        padding: theme.spacing.md,
        backgroundColor: theme.colors.error + '80',
        color: 'white',
        border: `1px solid ${theme.colors.error}`,
        borderRadius: theme.borderRadius.md,
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        transition: theme.transitions.fast,
      }}
    >
      <LogoutIcon sx={{ fontSize: 18 }} />
      Logout
    </motion.button>
  );
};

export default LogoutButton;
