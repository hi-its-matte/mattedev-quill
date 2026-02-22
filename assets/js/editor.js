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
const cryptoWarning = document.getElementById("crypto-support-warning");
const autosaveBadge = document.getElementById("autosave-badge");
const linkBtn = document.getElementById("insert-link-btn");
const formatButtons = document.querySelectorAll(".format-btn[data-cmd]");
const downloadBtn = document.getElementById("download-btn");

const hasCryptoSupport = Boolean(globalThis.crypto && globalThis.crypto.subtle && globalThis.TextEncoder && globalThis.TextDecoder);

let autosaveTimer = null;
let saveInProgress = false;
let pendingAutosave = false;
let hasUnsavedChanges = false;
let currentDocTitle = "documento";

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
    cryptoWarning.textContent = "Cifratura non disponibile in questo browser/contesto. Usa HTTPS o un browser aggiornato.";
    alert("Cifratura non supportata in questo ambiente.");
  }
});

if (!hasCryptoSupport) {
  cryptoWarning.textContent = "Questo ambiente non espone Web Crypto: cifratura disabilitata.";
}

formatButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const cmd = btn.dataset.cmd;

    if (cmd === "unorderedList") {
      document.execCommand("insertUnorderedList");
      return;
    }

    if (cmd === "h1" || cmd === "h2" || cmd === "h3") {
      document.execCommand("formatBlock", false, cmd.toUpperCase());
      return;
    }

    if (cmd === "bold" || cmd === "italic") {
      document.execCommand(cmd);
    }
  });
});

linkBtn.addEventListener("click", () => {
  const url = prompt("Inserisci URL completo (https://...):");
  if (!url) return;
  document.execCommand("createLink", false, url);
});

editor.addEventListener("input", () => {
  hasUnsavedChanges = true;
  autosaveBadge.textContent = "Modifiche non salvate";
  if (autosaveTimer) clearTimeout(autosaveTimer);

  autosaveTimer = setTimeout(() => {
    saveDocument(true);
  }, 6000);
});

downloadBtn.addEventListener("click", () => {
  const choice = prompt("Scegli formato download: txt, md, pdf", "txt");
  if (!choice) return;

  const format = choice.toLowerCase().trim();
  if (format === "txt") {
    downloadFile(`${safeFileName(currentDocTitle)}.txt`, htmlToPlainText(editor.innerHTML), "text/plain");
    return;
  }

  if (format === "md") {
    downloadFile(`${safeFileName(currentDocTitle)}.md`, htmlToMarkdown(editor.innerHTML), "text/markdown");
    return;
  }

  if (format === "pdf") {
    downloadPdfFromHtml(editor.innerHTML, currentDocTitle);
    return;
  }

  alert("Formato non valido. Usa: txt, md o pdf.");
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
  currentDocTitle = data.title || "documento";

  const isEncrypted = Boolean(data.isEncrypted);
  encryptToggle.checked = isEncrypted;
  passwordInput.disabled = !isEncrypted;

  if (!isEncrypted) {
    editor.innerHTML = data.content || "";
    hasUnsavedChanges = false;
    return;
  }

  if (!hasCryptoSupport) {
    editor.innerHTML = "";
    alert("Questo documento è cifrato ma Web Crypto non è disponibile qui.");
    return;
  }

  const password = prompt("Documento cifrato: inserisci la password:");
  if (!password) {
    editor.innerHTML = "";
    alert("Password non inserita. Documento non leggibile.");
    return;
  }

  try {
    const plaintext = await decryptText(data.content, password, data.salt, data.iv);
    editor.innerHTML = plaintext;
    passwordInput.value = password;
    hasUnsavedChanges = false;
  } catch (err) {
    console.error(err);
    editor.innerHTML = "";
    alert("Password errata o dati corrotti.");
  }
}

saveBtn.addEventListener("click", () => {
  saveDocument(false);
});

setInterval(() => {
  if (hasUnsavedChanges) {
    saveDocument(true);
  }
}, 30000);

async function saveDocument(isAutoSave) {
  if (saveInProgress) {
    pendingAutosave = pendingAutosave || isAutoSave;
    return;
  }

  const docId = localStorage.getItem("currentDocId");
  const user = auth.currentUser;
  if (!docId || !user) return;

  saveInProgress = true;

  try {
    const payload = await buildPayload(editor.innerHTML, isAutoSave);
    await db.collection("users").doc(user.uid).collection("documents").doc(docId).update(payload);

    hasUnsavedChanges = false;
    autosaveBadge.textContent = isAutoSave
      ? `Auto-save completato (${new Date().toLocaleTimeString()})`
      : "Documento salvato manualmente";

    if (!isAutoSave) alert("Documento salvato!");
  } catch (err) {
    console.error(isAutoSave ? "Auto-save fallito:" : "Save fallito:", err);
    autosaveBadge.textContent = "Salvataggio fallito";
    if (!isAutoSave) alert(err.message || "Errore nel salvataggio.");
  } finally {
    saveInProgress = false;

    if (pendingAutosave) {
      pendingAutosave = false;
      saveDocument(true);
    }
  }
}

async function buildPayload(content, isAutoSave = false) {
  if (!encryptToggle.checked) {
    return { content, isEncrypted: false, salt: null, iv: null };
  }

  if (!hasCryptoSupport) {
    throw new Error("Web Crypto non disponibile: impossibile cifrare.");
  }

  const password = passwordInput.value;
  if (!password) {
    throw new Error(isAutoSave
      ? "Auto-save saltato: password cifratura mancante."
      : "Inserisci una password per salvare il documento cifrato.");
  }

  const encrypted = await encryptText(content, password);
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
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text));

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
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
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
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
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
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function htmlToPlainText(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.innerText;
}

function htmlToMarkdown(html) {
  const root = document.createElement("div");
  root.innerHTML = html;

  const convertNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const content = Array.from(node.childNodes).map(convertNode).join("").trim();
    const tag = node.tagName.toLowerCase();

    if (tag === "strong" || tag === "b") return `**${content}**`;
    if (tag === "em" || tag === "i") return `*${content}*`;
    if (tag === "h1") return `# ${content}\n\n`;
    if (tag === "h2") return `## ${content}\n\n`;
    if (tag === "h3") return `### ${content}\n\n`;
    if (tag === "a") return `[${content}](${node.getAttribute("href") || ""})`;
    if (tag === "li") return `- ${content}\n`;
    if (tag === "ul") return `${Array.from(node.children).map(convertNode).join("")}\n`;
    if (tag === "div" || tag === "p") return `${Array.from(node.childNodes).map(convertNode).join("")}\n\n`;
    if (tag === "br") return "\n";

    return Array.from(node.childNodes).map(convertNode).join("");
  };

  return Array.from(root.childNodes).map(convertNode).join("").replace(/\n{3,}/g, "\n\n").trim();
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

function downloadPdfFromHtml(html, title) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("Generatore PDF non disponibile.");
    return;
  }

  const text = htmlToPlainText(html);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  const lines = doc.splitTextToSize(text, 180);
  doc.text(lines, 15, 20);
  doc.save(`${safeFileName(title)}.pdf`);
}

function safeFileName(name) {
  return String(name || "documento").trim().replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "") || "documento";
}
