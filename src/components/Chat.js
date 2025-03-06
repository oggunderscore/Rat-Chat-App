import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import forge from "node-forge";
import { db } from "../firebase";
import Sidebar from "../components/Sidebar";

const Chat = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [user, setUser] = useState(null); // ✅ Fix: Set `user` as `null`, not `[]`
  const auth = getAuth();

  const generateKeyPair = () => {
    const keypair = forge.pki.rsa.generateKeyPair(4096);
    return {
      publicKey: forge.pki.publicKeyToPem(keypair.publicKey),
      privateKey: forge.pki.privateKeyToPem(keypair.privateKey),
    };
  };

  const encryptMessage = (message, publicKey) => {
    const key = forge.random.getBytesSync(32);
    const iv = forge.random.getBytesSync(16);
    const cipher = forge.cipher.createCipher("AES-CBC", key);
    cipher.start({ iv });
    cipher.update(forge.util.createBuffer(message));
    cipher.finish();
    const encryptedMessage = forge.util.encode64(cipher.output.getBytes());

    const encryptedKey = forge.util.encode64(publicKey.encrypt(key));

    return { encryptedMessage, encryptedKey, iv: forge.util.encode64(iv) };
  };

  // TODO: To be used soon
  // const decryptMessage = (encryptedMessage, encryptedKey, iv, privateKey) => {
  //   const key = privateKey.decrypt(forge.util.decode64(encryptedKey));
  //   const decipher = forge.cipher.createDecipher("AES-CBC", key);
  //   decipher.start({ iv: forge.util.decode64(iv) });
  //   decipher.update(
  //     forge.util.createBuffer(forge.util.decode64(encryptedMessage))
  //   );
  //   decipher.finish();
  //   return decipher.output.toString();
  // };

  useEffect(() => {
    const messagesRef = collection(db, "messages");
    const q = query(messagesRef, orderBy("timestamp"));

    // Listen for new messages in Firestore
    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const messagesList = snapshot.docs.map((doc) => doc.data());
      setMessages(messagesList);
    });

    // Listen for auth state changes
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        console.log("No user signed in.");
        setUser(null);
      }
    });

    return () => {
      unsubscribeMessages();
      unsubscribeAuth();
    };
  }, [auth]);

  const sendMessage = async () => {
    if (!user) {
      alert("You must be logged in to send a message");
      return;
    }

    const { publicKey } = generateKeyPair();
    const { encryptedMessage, encryptedKey, iv } = encryptMessage(
      message,
      forge.pki.publicKeyFromPem(publicKey)
    );

    try {
      await addDoc(collection(db, "messages"), {
        user: user.email,
        encryptedMessage,
        encryptedKey,
        iv,
        timestamp: new Date().toISOString(),
      });
      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  return (
    <div className="chat-app">
      <Sidebar />
      <div className="chat-container">
        <div className="chat-header">
          <h2>#general</h2>
          {user ? <p>Logged in as: {user.email}</p> : <p>Not logged in</p>}
        </div>
        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div key={index} className="message">
              <span className="username">{msg.user}</span>:{" "}
              {msg.encryptedMessage}
            </div>
          ))}
        </div>
        <div className="chat-input">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
          />
          <button onClick={sendMessage} disabled={!user}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
