import React, { useEffect } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import Auth from "./components/Auth";
import Chat from "./pages/Chat";
import "./App.css";

function App() {
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

  useEffect(() => {
    console.log("isLoggedIn:", isLoggedIn);
  }, [isLoggedIn]);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Rat Chat</h1>
        <p>by ogg_</p>
      </header>
      <Routes>
        <Route
          path="/login"
          element={isLoggedIn ? <Navigate to="/chat" /> : <Auth />}
        />
        <Route
          path="/chat"
          element={isLoggedIn ? <Chat /> : <Navigate to="/login" />}
        />
        <Route
          path="*"
          element={<Navigate to={isLoggedIn ? "/chat" : "/login"} />}
        />
      </Routes>
    </div>
  );
}

export default App;
