import React, { useState, useEffect } from "react";
import { getDatabase, ref, push, onValue } from "firebase/database";
import { getAuth } from "firebase/auth";
import forge from "node-forge";

const Chat = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const auth = getAuth();
  const database = getDatabase();

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

  const decryptMessage = (encryptedMessage, encryptedKey, iv, privateKey) => {
    const key = privateKey.decrypt(forge.util.decode64(encryptedKey));
    const decipher = forge.cipher.createDecipher("AES-CBC", key);
    decipher.start({ iv: forge.util.decode64(iv) });
    decipher.update(
      forge.util.createBuffer(forge.util.decode64(encryptedMessage))
    );
    decipher.finish();
    return decipher.output.toString();
  };

  useEffect(() => {
    const messagesRef = ref(database, "messages");
    onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      const messagesList = data ? Object.values(data) : [];
      setMessages(messagesList);
    });
  }, [database]);

  const sendMessage = async () => {
    const user = auth.currentUser;
    if (!user) {
      alert("You must be logged in to send a message");
      return;
    }

    const { publicKey, privateKey } = generateKeyPair();
    const { encryptedMessage, encryptedKey, iv } = encryptMessage(
      message,
      forge.pki.publicKeyFromPem(publicKey)
    );

    const messagesRef = ref(database, "messages");
    await push(messagesRef, {
      user: user.email,
      encryptedMessage,
      encryptedKey,
      iv,
      timestamp: new Date().toISOString(),
    });

    setMessage("");
  };

  return (
    <div>
      <h1>Chat App</h1>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} />
      <button onClick={sendMessage}>Send</button>
      <div>
        {messages.map((msg, index) => (
          <div key={index}>
            <strong>{msg.user}</strong>: {msg.encryptedMessage}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Chat;
