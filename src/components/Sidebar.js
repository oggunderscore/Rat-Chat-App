import React, { useEffect, useState } from "react";
import "./Chat.css";
import "./Sidebar.css";
import LogoutButton from "./LogoutButton";

const Sidebar = ({ setCurrentChat }) => {
  // Dummy user list for direct messages (to be replaced with real data)
  const users = ["Alice", "Bob", "Charlie"];
  const [user, setUser] = useState(null);

  useEffect(() => {
    const username = localStorage.getItem("username");
    if (!username) {
      console.log("No username found, redirecting to login.");
      window.location.href = "/login";
      return;
    }
    setUser(username);
  }, []);

  return (
    <div className="sidebar">
      <h2>Welcome, {user}</h2>
      <h2>Chats</h2>
      <div className="channel" onClick={() => setCurrentChat("general")}>
        # general
      </div>
      <h3>Direct Messages</h3>
      {users.map((username) => (
        <div
          key={username}
          className="dm"
          onClick={() => setCurrentChat(username)}
        >
          {username}
        </div>
      ))}
      <LogoutButton />
    </div>
  );
};

export default Sidebar;
