import React from "react";
import { useNavigate } from "react-router-dom";
import "./Chat.css";

function Chat() {
  const navigate = useNavigate();

  const handleLogout = () => {
    console.log("Logout button clicked");
    localStorage.removeItem("isLoggedIn");
    navigate("/login");
  };

  return (
    <div className="chat-container">
      <h2>Chat Room</h2>
      {/* Chat UI components go here */}
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}

export default Chat;
