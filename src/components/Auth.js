import React, { useState } from "react";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import CryptoJS from "crypto-js";
import { db } from "../firebase";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./Auth.css";

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const MAX_ATTEMPTS = 5;
  const LOCK_TIME = 30 * 60 * 1000;

  const hashPassword = (password) => {
    return CryptoJS.SHA256(password).toString();
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("All fields are required");
      return;
    }
    const hashedPassword = hashPassword(password);
    try {
      await setDoc(doc(db, "users", username), {
        username,
        password: hashedPassword,
        createdAt: new Date().toISOString(),
        lastLoggedIn: new Date().toISOString(),
        loginAttempts: 0,
      });
      toast.success("User registered successfully");
      setIsSignUp(false);
    } catch (error) {
      toast.error("Error signing up. Please try again.");
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    const hashedPassword = hashPassword(password);
    try {
      const userDoc = await getDoc(doc(db, "users", username));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.lockUntil && userData.lockUntil > Date.now()) {
          toast.error("Account is locked. Try again later.");
          return;
        }
        if (userData.password === hashedPassword) {
          await updateDoc(doc(db, "users", username), {
            loginAttempts: 0,
            lastLoggedIn: new Date().toISOString(),
          });
          localStorage.setItem("isLoggedIn", "true");
          toast.success("User signed in successfully");
          setTimeout(() => {
            window.location.href = "/chat";
          }, 1000);
        } else {
          const attempts = (userData.loginAttempts || 0) + 1;
          if (attempts >= MAX_ATTEMPTS) {
            await updateDoc(doc(db, "users", username), {
              loginAttempts: attempts,
              lockUntil: Date.now() + LOCK_TIME,
            });
            toast.error("Account locked due to too many failed attempts.");
          } else {
            await updateDoc(doc(db, "users", username), {
              loginAttempts: attempts,
            });
            toast.error("Invalid username or password");
          }
        }
      } else {
        toast.error("Invalid username or password");
      }
    } catch (error) {
      toast.error("Error signing in. Please try again.");
    }
  };

  return (
    <div className="auth-container">
      <ToastContainer position="top-right" autoClose={5000} />
      <h2>{isSignUp ? "Sign Up" : "Sign In"}</h2>
      <form>
        <div className="form-group">
          <label>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
        </div>
        <button onClick={isSignUp ? handleSignUp : handleSignIn}>
          {isSignUp ? "Sign Up" : "Login"}
        </button>
        <p>
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <span className="toggle-link" onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? "Sign In" : "Sign Up"}
          </span>
        </p>
      </form>
    </div>
  );
};

export default Auth;
