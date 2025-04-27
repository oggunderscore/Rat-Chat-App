import React, { useState } from "react";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import CryptoJS from "crypto-js";
import { db, auth } from "../firebase";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./Auth.css";

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(""); // New state for email
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const MAX_ATTEMPTS = 5;
  const LOCK_TIME = 30 * 60 * 1000;

  const hashPassword = (password) => {
    return CryptoJS.SHA256(password).toString();
  };

  const generateEncryptionKey = (password) => {
    return CryptoJS.PBKDF2(password, "unique-salt", {
      keySize: 256 / 32,
      iterations: 1000,
    }).toString();
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!username || !email || !password) {
      toast.error("All fields are required");
      return;
    }
    setLoading(true);
    const hashedPassword = hashPassword(password);
    const encryptionKey = generateEncryptionKey(password); // Generate encryption key
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;
      await setDoc(doc(db, "users", user.uid), {
        username,
        email,
        password: hashedPassword,
        createdAt: new Date().toISOString(),
        lastLoggedIn: new Date().toISOString(),
        loginAttempts: 0,
      });
      localStorage.setItem("encryptionKey", encryptionKey); // Store encryption key
      toast.success("User registered successfully");
      setLoading(false);
      setIsSignUp(false);
    } catch (error) {
      toast.error("Error signing up. Please try again. " + error.message);
      setLoading(false);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    const hashedPassword = hashPassword(password);
    const encryptionKey = generateEncryptionKey(password); // Generate encryption key
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log("GOOD userData:", userData);
        if (userData.lockUntil && userData.lockUntil > Date.now()) {
          toast.error("Account is locked. Try again later.");
          setLoading(false);
          return;
        }
        if (userData.password === hashedPassword) {
          await updateDoc(doc(db, "users", user.uid), {
            loginAttempts: 0,
            lastLoggedIn: new Date().toISOString(),
          });
          localStorage.setItem("isLoggedIn", "true");
          localStorage.setItem("username", userData.username);
          localStorage.setItem("encryptionKey", encryptionKey); // Store encryption key
          toast.success("User signed in successfully");
          setLoading(false);
          setTimeout(() => {
            window.location.href = "/chat";
          }, 1000);
        } else {
          const attempts = (userData.loginAttempts || 0) + 1;
          console.log("attempts:", attempts);
          if (attempts >= MAX_ATTEMPTS) {
            await updateDoc(doc(db, "users", user.uid), {
              loginAttempts: attempts,
              lockUntil: Date.now() + LOCK_TIME,
            });
            toast.error("Account locked due to too many failed attempts.");
          } else {
            await updateDoc(doc(db, "users", user.uid), {
              loginAttempts: attempts,
            });
            toast.error("Invalid email or password");
          }
          setLoading(false);
        }
      } else {
        toast.error("Invalid email or password");
        setLoading(false);
      }
    } catch (error) {
      console.log("Attempting to fetch user document", email);
      const userQuery = doc(db, "users", email); // Use email to fetch the user document
      console.log("userQuery:", userQuery);
      const userDoc = await getDoc(userQuery);
      console.log("userDoc:", userDoc);
      if (userDoc.exists()) {
        console.log("User exists");
        const userData = userDoc.data();
        const attempts = (userData.loginAttempts || 0) + 1;
        console.log("attempts:", attempts);
        if (attempts >= MAX_ATTEMPTS) {
          await updateDoc(userQuery, {
            loginAttempts: attempts,
            lockUntil: Date.now() + LOCK_TIME,
          });
          toast.error("Account locked due to too many failed attempts.");
        } else {
          await updateDoc(userQuery, {
            loginAttempts: attempts,
          });
          toast.error("Invalid email or password");
        }
      } else {
        toast.error("Error signing in. Please try again.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <ToastContainer position="top-right" autoClose={5000} />
      <header className="app-header">
        <h1>Rat Chat</h1>
        <p>by ogg_</p>
      </header>
      <h2>{isSignUp ? "Sign Up" : "Sign In"}</h2>
      <form>
        {isSignUp && (
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
            />
          </div>
        )}
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
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
        <button
          onClick={isSignUp ? handleSignUp : handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <span className="spinner"></span>
          ) : isSignUp ? (
            "Sign Up"
          ) : (
            "Login"
          )}
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
