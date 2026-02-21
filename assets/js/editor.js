const firebaseConfig = {
  apiKey: "AIzaSyC7Tbqt5FzJK8Z_USkCMWxXiHZp8uRN26A",
  authDomain: "mattedev-account.firebaseapp.com",
  projectId: "mattedev-account",
  storageBucket: "mattedev-account.firebasestorage.app",
  messagingSenderId: "77268069903",
  appId: "1:77268069903:web:040aa6c3981eb3650afd7a"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const editor = document.getElementById("editor");
const saveBtn = document.getElementById("save-btn");
const backBtn = document.getElementById("back-btn");
const settingsBtn = document.getElementById("settings-btn");
const settingsModal = document.getElementById("settings-modal");
const settingsCloseBtn = document.getElementById("settings-close-btn");
const encryptToggle = document.getElementById("encrypt-toggle");
const passwordInput = document.getElementById("password-input");

let encryptionState = {
  isEncrypted: false,
  salt: null,
  iv: null
};

backBtn.addEventListener("click", () => {
  window.location.href = "dash.html";
});

settingsBtn.addEventListener("click", () => {
  settingsModal.classList.remove("hidden");
});

settingsCloseBtn.addEventListener("click", () => {
  settingsModal.classList.add("hidden");
});

auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    loadDocument(user.uid);
  }
});

async function loadDocument(uid) {
  const docId = localStorage.getItem("currentDocId");
  if (!docId) {
    alert("Nessun documento selezionato.");
    window.location.href = "dash.html";
    return;
  }

  const docRef = db.collection("users").doc(uid).collection("documents").doc(docId);
  const doc = await docRef.get();

  if (!doc.exists) {
    alert("Documento non trovato.");
    window.location.href = "dash.html";
    return;
  }

  const data = doc.data();
  encryptionState = {
    isEncrypted: Boolean(data.isEncrypted),
    salt: data.salt || null,
    iv: data.iv || null
  };

  encryptToggle.checked = encryptionState.isEncrypted;

  if (!data.isEncrypted) {
    editor.innerHTML = data.content || "";
    return;
  }

  const password = prompt("Questo documento è cifrato. Inserisci la password per leggerlo:");
  if (!password) {
    editor.innerHTML = "";
    alert("Password non inserita. Contenuto non leggibile.");
    return;
  }

  try {
    const plaintext = await decryptText(data.content, password, data.salt, data.iv);
    editor.innerHTML = plaintext;
    passwordInput.value = password;
  } catch (err) {
    console.error(err);
    editor.innerHTML = "";
    alert("Password errata o dati corrotti. Documento non leggibile.");
  }
}

saveBtn.addEventListener("click", async () => {
  const docId = localStorage.getItem("currentDocId");
  const user = auth.currentUser;
  if (!docId || !user) return;

  try {
    const payload = await buildPayload(editor.innerHTML);

    await db.collection("users").doc(user.uid).collection("documents").doc(docId)
      .update(payload);

    alert("Documento salvato!");
  } catch (err) {
    console.error(err);
    alert(err.message || "Errore nel salvataggio.");
  }
});

setInterval(async () => {
  const docId = localStorage.getItem("currentDocId");
  const user = auth.currentUser;
  if (!docId || !user) return;

  try {
    const payload = await buildPayload(editor.innerHTML, true);
    await db.collection("users").doc(user.uid).collection("documents").doc(docId).update(payload);
  } catch (err) {
    console.error("Auto-save fallito:", err);
  }
}, 30000);

async function buildPayload(content, isAutoSave = false) {
  if (!encryptToggle.checked) {
    encryptionState = { isEncrypted: false, salt: null, iv: null };
    return {
      content,
      isEncrypted: false,
      salt: null,
      iv: null
    };
  }

  const password = passwordInput.value;
  if (!password) {
    if (!isAutoSave) {
      throw new Error("Inserisci una password per salvare il documento cifrato.");
    }
    throw new Error("Auto-save saltato: password mancante per cifratura.");
  }

  const encrypted = await encryptText(content, password);
  encryptionState = { isEncrypted: true, salt: encrypted.salt, iv: encrypted.iv };

  return {
    content: encrypted.cipherText,
    isEncrypted: true,
    salt: encrypted.salt,
    iv: encrypted.iv
  };
}

async function encryptText(text, password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(text)
  );

  return {
    cipherText: arrayBufferToBase64(encrypted),
    salt: arrayBufferToBase64(salt.buffer),
    iv: arrayBufferToBase64(iv.buffer)
  };
}

async function decryptText(cipherText, password, saltB64, ivB64) {
  const dec = new TextDecoder();
  const salt = new Uint8Array(base64ToArrayBuffer(saltB64));
  const iv = new Uint8Array(base64ToArrayBuffer(ivB64));
  const data = base64ToArrayBuffer(cipherText);
  const key = await deriveKey(password, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  return dec.decode(decrypted);
}

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach(b => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
