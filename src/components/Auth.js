import React, { useState } from "react";
import { getAuth, signOut } from "firebase/auth";
import { getDatabase, ref, set, get, child } from "firebase/database";
import CryptoJS from "crypto-js";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const auth = getAuth();
  const database = getDatabase();
  const MAX_ATTEMPTS = 5;
  const LOCK_TIME = 30 * 60 * 1000; // 30 minutes

  const hashPassword = (password) => {
    return CryptoJS.SHA256(password).toString();
  };

  const handleSignUp = async () => {
    const hashedPassword = hashPassword(password);
    try {
      await set(ref(database, "users/" + email.replace(".", "_")), {
        email,
        password: hashedPassword,
      });
      alert("User registered successfully");
    } catch (error) {
      console.error("Error signing up:", error);
    }
  };

  const handleSignIn = async () => {
    const hashedPassword = hashPassword(password);
    try {
      const dbRef = ref(database);
      const snapshot = await get(
        child(dbRef, `users/${email.replace(".", "_")}`)
      );
      if (snapshot.exists()) {
        const userData = snapshot.val();
        if (userData.lockUntil && userData.lockUntil > Date.now()) {
          alert("Account is locked. Try again later.");
          return;
        }

        if (userData.password === hashedPassword) {
          await set(
            ref(database, `users/${email.replace(".", "_")}/loginAttempts`),
            0
          );
          alert("User signed in successfully");
        } else {
          const attempts = (userData.loginAttempts || 0) + 1;
          if (attempts >= MAX_ATTEMPTS) {
            await set(ref(database, `users/${email.replace(".", "_")}`), {
              ...userData,
              loginAttempts: attempts,
              lockUntil: Date.now() + LOCK_TIME,
            });
            alert(
              "Account locked due to too many failed attempts. Try again later."
            );
          } else {
            await set(
              ref(database, `users/${email.replace(".", "_")}/loginAttempts`),
              attempts
            );
            alert("Invalid email or password");
          }
        }
      } else {
        alert("Invalid email or password");
      }
    } catch (error) {
      console.error("Error signing in:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      alert("User signed out successfully");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button onClick={handleSignUp}>Sign Up</button>
      <button onClick={handleSignIn}>Sign In</button>
      <button onClick={handleSignOut}>Sign Out</button>
    </div>
  );
};

export default Auth;
