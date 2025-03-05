import React from "react";
import { getAuth, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./LogoutButton.css"; // Import the CSS file

const LogoutButton = () => {
  const auth = getAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.setItem("isLoggedIn", "false");

      // Show success toast
      toast.success("Logged out successfully!");

      // Redirect after 1.5s to allow the toast to display
      setTimeout(() => navigate("/login"), 1500);
    } catch (error) {
      console.error("Error signing out:", error);

      // Show error toast
      toast.error("Error signing out. Please try again.");
    }
  };

  return (
    <button onClick={handleLogout} className="logout-button">
      Logout
    </button>
  );
};

export default LogoutButton;
