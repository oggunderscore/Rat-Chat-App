import React, { useEffect, useState } from "react";
import "./Chat.css";
import "./Sidebar.css";
import LogoutButton from "./LogoutButton";

const Sidebar = ({ setCurrentChat, onlineUsers, chatrooms }) => {
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

  const filteredUsers = onlineUsers
    .filter((username) => username !== user)
    .sort();

  const openDirectMessage = (username) => {
    const dmChannel = [user, username].sort().join("_");
    setCurrentChat(dmChannel);
  };

  return (
    <div className="sidebar">
      <h2>Welcome, {user}</h2>
      <h2>Chatrooms</h2>
      {chatrooms.map((room) => (
        <div
          key={room}
          className="channel"
          onClick={() => setCurrentChat(room)}
        >
          # {room}
        </div>
      ))}
      <h3>Direct Messages</h3>
      {filteredUsers.map((username) => (
        <div
          key={username}
          className="dm"
          onClick={() => openDirectMessage(username)}
        >
          {username}
        </div>
      ))}
      <h3>Online Users</h3>
      {onlineUsers.map((username) => (
        <div key={username} className="online-user">
          {username}
        </div>
      ))}
      <LogoutButton />
    </div>
  );
};

export default Sidebar;
