import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  collection,
  where,
  getDocs,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from "@mui/icons-material";
import CryptoJS from "crypto-js";
import { db, auth } from "../firebase";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { theme } from "../styles/theme";
import "./Auth.css";

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

    try {
      // Check if username already exists
      const usernameQuery = query(
        collection(db, "users"),
        where("username", "==", username)
      );
      const usernameSnapshot = await getDocs(usernameQuery);
      if (!usernameSnapshot.empty) {
        toast.error("Username is already taken");
        setLoading(false);
        return;
      }

      const hashedPassword = hashPassword(password);
      const encryptionKey = generateEncryptionKey(password); // Generate encryption key
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
        encryptionKey, // Store encryption key in Firebase
        createdAt: new Date().toISOString(),
        lastLoggedIn: new Date().toISOString(),
        loginAttempts: 0,
      });
      localStorage.setItem("encryptionKey", encryptionKey);
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
          localStorage.setItem("encryptionKey", userData.encryptionKey); // Get encryption key from Firebase
          toast.success("User signed in successfully");
          setLoading(false);
          setTimeout(() => {
            window.location.href = "/chat";
          }, 1000);
        } else {
          const attempts = (userData.loginAttempts || 0) + 1;
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
      const userQuery = doc(db, "users", email); // Use email to fetch the user document
      const userDoc = await getDoc(userQuery);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const attempts = (userData.loginAttempts || 0) + 1;
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

  const containerVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.lg,
        background: `linear-gradient(135deg, ${theme.colors.background} 0%, ${theme.colors.surface} 100%)`,
      }}
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.xl,
          padding: theme.spacing.xxl,
          border: `1px solid ${theme.colors.border}`,
          boxShadow: theme.shadows.xl,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Animated background gradient */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(45deg, ${theme.colors.primary}10, ${theme.colors.secondary}10)`,
            opacity: 0.5,
            zIndex: -1,
          }}
        />

        <motion.div variants={itemVariants} style={{ textAlign: 'center', marginBottom: theme.spacing.xl }}>
          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: '700',
              background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              margin: 0,
              marginBottom: theme.spacing.sm,
            }}
          >
            RatChat
          </h1>
          <p
            style={{
              color: theme.colors.textSecondary,
              fontSize: '1rem',
              margin: 0,
              marginBottom: theme.spacing.lg,
            }}
          >
            Secure, encrypted messaging
          </p>
          <h2
            style={{
              color: theme.colors.text,
              fontSize: '1.5rem',
              fontWeight: '600',
              margin: 0,
            }}
          >
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h2>
        </motion.div>

        <form onSubmit={isSignUp ? handleSignUp : handleSignIn}>
          {isSignUp && (
            <motion.div variants={itemVariants} style={{ marginBottom: theme.spacing.lg }}>
              <label
                style={{
                  display: 'block',
                  color: theme.colors.text,
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  marginBottom: theme.spacing.sm,
                }}
              >
                Username
              </label>
              <div style={{ position: 'relative' }}>
                <PersonIcon
                  style={{
                    position: 'absolute',
                    left: theme.spacing.md,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: theme.colors.textMuted,
                    fontSize: '1.2rem',
                  }}
                />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  style={{
                    width: '100%',
                    padding: `${theme.spacing.md} ${theme.spacing.md} ${theme.spacing.md} 3rem`,
                    backgroundColor: theme.colors.background,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.borderRadius.md,
                    color: theme.colors.text,
                    fontSize: '1rem',
                    transition: theme.transitions.fast,
                  }}
                />
              </div>
            </motion.div>
          )}

          <motion.div variants={itemVariants} style={{ marginBottom: theme.spacing.lg }}>
            <label
              style={{
                display: 'block',
                color: theme.colors.text,
                fontSize: '0.9rem',
                fontWeight: '500',
                marginBottom: theme.spacing.sm,
              }}
            >
              Email
            </label>
            <div style={{ position: 'relative' }}>
              <EmailIcon
                style={{
                  position: 'absolute',
                  left: theme.spacing.md,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: theme.colors.textMuted,
                  fontSize: '1.2rem',
                }}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                style={{
                  width: '100%',
                  padding: `${theme.spacing.md} ${theme.spacing.md} ${theme.spacing.md} 3rem`,
                  backgroundColor: theme.colors.background,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  color: theme.colors.text,
                  fontSize: '1rem',
                  transition: theme.transitions.fast,
                }}
              />
            </div>
          </motion.div>

          <motion.div variants={itemVariants} style={{ marginBottom: theme.spacing.xl }}>
            <label
              style={{
                display: 'block',
                color: theme.colors.text,
                fontSize: '0.9rem',
                fontWeight: '500',
                marginBottom: theme.spacing.sm,
              }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <LockIcon
                style={{
                  position: 'absolute',
                  left: theme.spacing.md,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: theme.colors.textMuted,
                  fontSize: '1.2rem',
                }}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  padding: `${theme.spacing.md} 3rem ${theme.spacing.md} 3rem`,
                  backgroundColor: theme.colors.background,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  color: theme.colors.text,
                  fontSize: '1rem',
                  transition: theme.transitions.fast,
                }}
              />
              <motion.button
                type="button"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: theme.spacing.md,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: theme.colors.textMuted,
                  cursor: 'pointer',
                  padding: theme.spacing.xs,
                }}
              >
                {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </motion.button>
            </div>
          </motion.div>

          <motion.button
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: theme.spacing.lg,
              backgroundColor: loading ? theme.colors.border : theme.colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: theme.borderRadius.md,
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: theme.transitions.fast,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.sm,
              marginBottom: theme.spacing.lg,
            }}
          >
            {loading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                }}
              />
            ) : (
              isSignUp ? 'Create Account' : 'Sign In'
            )}
          </motion.button>

          <motion.p
            variants={itemVariants}
            style={{
              textAlign: 'center',
              color: theme.colors.textSecondary,
              fontSize: '0.9rem',
              margin: 0,
            }}
          >
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <motion.span
              whileHover={{ scale: 1.05 }}
              onClick={() => setIsSignUp(!isSignUp)}
              style={{
                color: theme.colors.primary,
                cursor: 'pointer',
                fontWeight: '600',
                textDecoration: 'underline',
              }}
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </motion.span>
          </motion.p>
        </form>
      </motion.div>

      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </div>
  );
};

export default Auth;
