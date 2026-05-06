/* =========================
   FIREBASE INIT
========================= */

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

/* =========================
   DOM ELEMENTS
========================= */

const editor = document.getElementById("editor");
const saveBtn = document.getElementById("save-btn");
const backBtn = document.getElementById("back-btn");
const deleteBtn = document.getElementById("delete-btn");

const settingsBtn = document.getElementById("settings-btn");
const settingsModal = document.getElementById("settings-modal");
const settingsCloseBtn = document.getElementById("settings-close-btn");

const encryptToggle = document.getElementById("encrypt-toggle");
const passwordInput = document.getElementById("password-input");
const cryptoWarning = document.getElementById("crypto-support-warning");

const autosaveBadge = document.getElementById("autosave-badge");

const linkBtn = document.getElementById("insert-link-btn");
const formatButtons = document.querySelectorAll(".format-btn[data-cmd]");

const downloadBtn = document.getElementById("download-btn");
const downloadFormat = document.getElementById("download-format");

/* =========================
   GLOBAL STATE
========================= */

const hasCryptoSupport = Boolean(
  globalThis.crypto &&
  globalThis.crypto.subtle &&
  globalThis.TextEncoder &&
  globalThis.TextDecoder
);

let autosaveTimer = null;
let currentDocTitle = "documento";
let encryptionValidated = false;

/* =========================
   AUTH STATE
========================= */

auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    loadDocument(user.uid);
  }
});

/* =========================
   EVENT LISTENERS
========================= */

backBtn.addEventListener("click", () => {
  window.location.href = "dash.html";
});

settingsBtn.addEventListener("click", () => {
  settingsModal.classList.remove("hidden");
});

settingsCloseBtn.addEventListener("click", () => {
  settingsModal.classList.add("hidden");
});

encryptToggle.addEventListener("change", () => {
  const enabled = encryptToggle.checked;
  passwordInput.disabled = !enabled;

  if (enabled && !hasCryptoSupport) {
    encryptToggle.checked = false;
    passwordInput.disabled = true;
    cryptoWarning.textContent =
      "Cifratura non disponibile. Usa HTTPS o browser aggiornato.";
    alert("Web Crypto non supportato.");
  }
});

if (!hasCryptoSupport) {
  cryptoWarning.textContent =
    "Questo ambiente non supporta Web Crypto. Cifratura disabilitata.";
}

formatButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const cmd = btn.dataset.cmd;

    if (cmd === "unorderedList") {
      document.execCommand("insertUnorderedList");
      return;
    }

    if (["h1", "h2", "h3"].includes(cmd)) {
      document.execCommand("formatBlock", false, cmd.toUpperCase());
      return;
    }

    if (cmd === "bold") {
      document.execCommand("bold");
    }
  });
});

linkBtn.addEventListener("click", () => {
  const url = prompt("Inserisci URL completo (https://...)");
  if (!url) return;
  document.execCommand("createLink", false, url);
});

editor.addEventListener("input", () => {
  autosaveBadge.textContent = "Modifiche non salvate";
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => saveDocument(true), 1000);
});

saveBtn.addEventListener("click", () => saveDocument(false));

setInterval(() => saveDocument(true), 3000);

deleteBtn.addEventListener("click", async () => {
  const confirmDelete = confirm("Eliminare definitivamente il documento?");
  if (!confirmDelete) return;

  const docId = localStorage.getItem("currentDocId");
  const user = auth.currentUser;
  if (!docId || !user) return;

  try {
    await db.collection("users")
      .doc(user.uid)
      .collection("documents")
      .doc(docId)
      .delete();

    localStorage.removeItem("currentDocId");
    alert("Documento eliminato.");
    window.location.href = "dash.html";
  } catch (err) {
    console.error(err);
    alert("Errore durante eliminazione.");
  }
});

/* =========================
   FIRESTORE LOGIC
========================= */

async function loadDocument(uid) {
  const docId = localStorage.getItem("currentDocId");
  if (!docId) {
    window.location.href = "dash.html";
    return;
  }

  const docRef = db.collection("users")
    .doc(uid)
    .collection("documents")
    .doc(docId);

  const snap = await docRef.get();

  if (!snap.exists) {
    window.location.href = "dash.html";
    return;
  }

  const data = snap.data();
  currentDocTitle = data.title || "documento";

  encryptionValidated = false;

  if (!data.isEncrypted) {
    editor.innerHTML = data.content || "";
    encryptionValidated = true; // non cifrato, autosave OK
    return;
  }

  if (!hasCryptoSupport) {
    alert("Documento cifrato ma Web Crypto non disponibile.");
    return;
  }

  const password = prompt("Documento cifrato. Inserisci password:");
  if (!password) return;

  try {
    const text = await decryptText(
      data.content,
      password,
      data.salt,
      data.iv
    );
    editor.innerHTML = text;
    passwordInput.value = password;
    encryptToggle.checked = true;
    passwordInput.disabled = false;
    encryptionValidated = true; // password confermata
  } catch {
    alert("Password errata o dati corrotti.");
  }
}

async function saveDocument(isAutoSave) {
  const docId = localStorage.getItem("currentDocId");
  const user = auth.currentUser;
  if (!docId || !user) return;

  try {
    const payload = await buildPayload(editor.innerHTML);
    await db.collection("users")
      .doc(user.uid)
      .collection("documents")
      .doc(docId)
      .update(payload);

    autosaveBadge.textContent = isAutoSave
      ? `Auto-save ${new Date().toLocaleTimeString()}`
      : "Documento salvato";

    if (!isAutoSave) alert("Documento salvato.");
  } catch (err) {
    console.error(err);
    autosaveBadge.textContent = "Salvataggio fallito";
    if (!isAutoSave) return; // blocca l’autosave se errore
    // alert solo per salvataggio manuale
  }
}

async function buildPayload(content) {
  if (!encryptToggle.checked) {
    return { content, isEncrypted: false, salt: null, iv: null };
  }

  if (!hasCryptoSupport)
    throw new Error("Web Crypto non disponibile.");

  const password = passwordInput.value;
  if (!password)
    throw new Error("Inserisci password per cifrare.");

  if (!encryptionValidated)
    throw new Error("Password non confermata, autosave bloccato.");

  const encrypted = await encryptText(content, password);

  return {
    content: encrypted.cipherText,
    isEncrypted: true,
    salt: encrypted.salt,
    iv: encrypted.iv
  };
}

/* =========================
   CRYPTO MODULE
========================= */

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

/* =========================
   UTILITIES
========================= */

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++)
    bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/* =========================
   DOWNLOAD SYSTEM
========================= */

downloadBtn.addEventListener("click", () => {
  const format = downloadFormat.value;


    downloadFile(
      `${safeFileName(currentDocTitle)}.md`,
      htmlToMarkdown(editor.innerHTML),
      "text/markdown"
    );
});


function htmlToMarkdown(html) {
  const root = document.createElement("div");
  root.innerHTML = html;

  const convert = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const content = Array.from(node.childNodes).map(convert).join("");
    const tag = node.tagName.toLowerCase();

    if (tag === "strong" || tag === "b") return `**${content}**`;
    if (tag === "h1") return `# ${content}\n\n`;
    if (tag === "h2") return `## ${content}\n\n`;
    if (tag === "h3") return `### ${content}\n\n`;
    if (tag === "a") return `[${content}](${node.getAttribute("href") || ""})`;
    if (tag === "li") return `- ${content}\n`;
    if (tag === "ul") return Array.from(node.children).map(convert).join("") + "\n";
    if (tag === "p" || tag === "div") return content + "\n\n";
    if (tag === "br") return "\n";

    return content;
  };

  return Array.from(root.childNodes).map(convert).join("").trim();
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();

  URL.revokeObjectURL(url);
}



function safeFileName(name) {
  return String(name || "documento")
    .trim()
    .replace(/[^a-z0-9-_]+/gi, "_")
    .replace(/^_+|_+$/g, "") || "documento";
}
/* =========================
   FIRESTORE LOGIC
========================= */

// Carica o crea un documento
async function loadDocument(uid) {
    const urlParams = new URLSearchParams(window.location.search);
    let docId = urlParams.get('docId');

    // SE l'URL chiede un nuovo documento (?action=new)
    if (urlParams.get('action') === 'new') {
        const newDoc = await db.collection("users").doc(uid).collection("documents").add({
            title: "Nuovo Documento Quill",
            content: "",
            isEncrypted: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        // Ricarica la pagina con il nuovo ID per pulire l'URL
        window.location.href = `editor.html?docId=${newDoc.id}`;
        return;
    }

    if (!docId) {
        docId = localStorage.getItem("currentDocId");
    }

    if (!docId) {
        window.location.href = "dash.html";
        return;
    }

    localStorage.setItem("currentDocId", docId);

    const docRef = db.collection("users").doc(uid).collection("documents").doc(docId);
    const snap = await docRef.get();

    if (!snap.exists) {
        alert("Documento non trovato.");
        window.location.href = "dash.html";
        return;
    }

    const data = snap.data();
    currentDocTitle = data.title || "documento";
    document.title = `Quill - ${currentDocTitle}`;

    if (!data.isEncrypted) {
        editor.innerHTML = data.content || "";
        encryptionValidated = true;
    } else {
        handleEncryptedLoad(data);
    }
}

/* =========================
   DOWNLOAD .QUILL (Puntatore locale)
========================= */

// Funzione da collegare a un pulsante "Scarica collegamento locale"
function downloadQuillPointer() {
    const docId = localStorage.getItem("currentDocId");
    if (!docId) return;

    const pointer = JSON.stringify({ docId: docId });
    const blob = new Blob([pointer], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFileName(currentDocTitle)}.quill`;
    a.click();
    URL.revokeObjectURL(url);
}

// Aggiungiamo l'evento al downloadBtn esistente o creane uno nuovo
downloadBtn.addEventListener("click", () => {
    const format = downloadFormat.value;
    if(format === "quill") {
        downloadQuillPointer();
    } else {
        downloadFile(
            `${safeFileName(currentDocTitle)}.md`,
            htmlToMarkdown(editor.innerHTML),
            "text/markdown"
        );
    }
});
async function handleNewDocumentFromDesktop(uid, docId) {
    const docRef = db.collection("users").doc(uid).collection("documents").doc(docId);
    const snap = await docRef.get();

    if (!snap.exists) {
        // Il documento è stato 'prenotato' da Python, ora lo inizializziamo per l'utente
        await docRef.set({
            title: "Nuovo Documento da Desktop",
            content: "",
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            isEncrypted: false
        });
    }
}