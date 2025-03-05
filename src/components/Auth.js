import React, { useState } from "react";
import { getAuth, signOut } from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import CryptoJS from "crypto-js";
import { db } from "../firebase";
import "./Auth.css";

const Auth = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const auth = getAuth();
  const MAX_ATTEMPTS = 5;
  const LOCK_TIME = 30 * 60 * 1000; // 30 minutes

  const hashPassword = (password) => {
    return CryptoJS.SHA256(password).toString();
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    console.log("Sign Up button clicked");
    const hashedPassword = hashPassword(password);
    try {
      await setDoc(doc(db, "users", username), {
        username,
        password: hashedPassword,
        createdAt: new Date().toISOString(),
        lastLoggedIn: new Date().toISOString(),
        loginAttempts: 0,
      });
      alert("User registered successfully");
      setError("");
    } catch (error) {
      console.error("Error signing up:", error);
      setError("Error signing up. Please try again.");
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    console.log("Sign In button clicked");
    const hashedPassword = hashPassword(password);
    try {
      const userDoc = await getDoc(doc(db, "users", username));
      console.log(userDoc.exists());
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log(userData);
        if (userData.lockUntil && userData.lockUntil > Date.now()) {
          setError("Account is locked. Try again later.");
          return;
        }
        console.log(userData.password, hashedPassword);
        if (userData.password === hashedPassword) {
          console.log("User signed in successfully");
          await updateDoc(doc(db, "users", username), {
            loginAttempts: 0,
            lastLoggedIn: new Date().toISOString(), // Update lastLoggedIn field
          });
          console.log("User login attempts reset and lastLoggedIn updated");
          localStorage.setItem("isLoggedIn", "true");
          alert("User signed in successfully");
          setError("");
          window.location.href = "/chat";
        } else {
          const attempts = (userData.loginAttempts || 0) + 1;
          if (attempts >= MAX_ATTEMPTS) {
            await updateDoc(doc(db, "users", username), {
              loginAttempts: attempts,
              lockUntil: Date.now() + LOCK_TIME,
            });
            setError(
              "Account locked due to too many failed attempts. Try again later."
            );
          } else {
            await updateDoc(doc(db, "users", username), {
              loginAttempts: attempts,
            });
            setError("Invalid username or password");
          }
        }
      } else {
        setError("Invalid username or password");
      }
    } catch (error) {
      console.error("Error signing in:", error);
      setError("Error signing in. Please try again.");
    }
  };

  const handleSignOut = async () => {
    console.log("Sign Out button clicked");
    try {
      await signOut(auth);
      localStorage.setItem("isLoggedIn", "false");
      alert("User signed out successfully");
      window.location.href = "/login";
    } catch (error) {
      console.error("Error signing out:", error);
      setError("Error signing out. Please try again.");
    }
  };

  return (
    <div className="auth-container">
      <h2>Authentication</h2>
      {error && <p className="error">{error}</p>}
      <form>
        <div className="form-group">
          <label>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
        </div>
        <button onClick={handleSignUp}>Sign Up</button>
        <button onClick={handleSignIn}>Sign In</button>
        <button onClick={handleSignOut}>Sign Out</button>
      </form>
    </div>
  );
};

export default Auth;
