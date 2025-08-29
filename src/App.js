import React, { useEffect } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import Auth from "./components/Auth";
import ModernChat from "./components/ModernChat";

import "react-toastify/dist/ReactToastify.css";
import "./App.css";

function App() {
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

  useEffect(() => {
    console.log("isLoggedIn:", isLoggedIn);
  }, [isLoggedIn]);

  return (
    <div className="app-container">
      <Routes>
        <Route
          path="/login"
          element={isLoggedIn ? <Navigate to="/chat" /> : <Auth />}
        />
        <Route
          path="/chat"
          element={isLoggedIn ? <ModernChat /> : <Navigate to="/login" />}
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
