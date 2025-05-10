import React, { useEffect, useState } from "react";
import "./Chat.css";
import "./Sidebar.css";
import LogoutButton from "./LogoutButton";
import AddIcon from "@mui/icons-material/Add"; // Import Material UI Add icon

const Sidebar = ({
  setCurrentChat,
  onlineUsers,
  chatrooms,
  createNewChannel,
}) => {
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

  const canJoinChannel = (channel) => {
    if (channel.name === "general") {
      return true; // Everyone can join the general channel
    } else if (channel.users.includes(user)) {
      return true; // User is already a member of the channel
    } else {
      return false;
    }
  };

  return (
    <div className="sidebar">
      <h2>Welcome, {user}</h2>
      <div className="chatrooms-header">
        <h2>Chatrooms</h2>
        <AddIcon
          className="add-channel-icon"
          onClick={() => {
            const channelName = prompt("Enter new channel name:");
            if (channelName) createNewChannel(channelName);
          }}
          style={{ cursor: "pointer" }}
        />
      </div>
      {chatrooms
        .filter((room) => canJoinChannel(room)) // Only show channels the user can join
        .map((room) => (
          <div key={room.name} className="channel">
            <div onClick={() => setCurrentChat(room.name)}># {room.name}</div>
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
