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

// Abilita persistenza offline dove supportato
db.enablePersistence().catch(err => {
  console.warn("Persistence could not be enabled:", err);
});

/* =========================
   DOM ELEMENTS
========================= */

const editor          = document.getElementById("editor");
const saveBtn         = document.getElementById("save-btn");
const backBtn         = document.getElementById("back-btn");
const deleteBtn       = document.getElementById("delete-btn");

const settingsBtn     = document.getElementById("settings-btn");
const settingsModal   = document.getElementById("settings-modal");
const settingsCloseBtn= document.getElementById("settings-close-btn");


const autosaveBadge   = document.getElementById("autosave-badge");

const linkBtn         = document.getElementById("insert-link-btn");
const formatButtons   = document.querySelectorAll(".format-btn[data-cmd]");

const downloadBtn     = document.getElementById("download-btn");
const downloadFormat  = document.getElementById("download-format");
const docTitleInput   = document.getElementById("doc-title-input");

const themeToggle     = document.getElementById("theme-toggle");
const toolbar         = document.getElementById("toolbar");

// Condivisione Pubblica
const shareBtn        = document.getElementById("share-btn");
const shareModal      = document.getElementById("share-modal");
const shareCloseBtn   = document.getElementById("share-close-btn");
const publicShareToggle = document.getElementById("public-share-toggle");
const copyLinkBtn     = document.getElementById("copy-link-btn");
const shareLinkInput  = document.getElementById("share-link-input");

/* =========================
   GLOBAL STATE
========================= */

let autosaveTimer       = null;
let currentDocTitle     = "documento";
let isReadOnly          = false;
let docSnapshotUnsubscribe = null;

// Identità del documento aperto in questa pagina.
// Risolta UNA sola volta dall'URL in auth.onAuthStateChanged e mai più
// letta da localStorage: usare localStorage come fallback qui causava
// l'apertura del vecchio documento ogni volta che l'URL non conteneva
// un id esplicito (es. link "Nuovo documento" senza ?id=...).
let currentDocId    = null;
let currentOwnerId  = null;

/* =========================
   AUTH STATE & INITIALIZATION
========================= */

document.addEventListener("DOMContentLoaded", () => {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Gestione Tema
  if (themeToggle) {
    const currentTheme = localStorage.getItem("theme") || "dark";
    if (currentTheme === "light") document.body.classList.add("light-mode");

    themeToggle.addEventListener("click", () => {
      document.body.classList.toggle("light-mode");
      const newTheme = document.body.classList.contains("light-mode") ? "light" : "dark";
      localStorage.setItem("theme", newTheme);
    });
  }
});

auth.onAuthStateChanged(async user => {
  const urlParams = new URLSearchParams(window.location.search);
  const docId     = urlParams.get("id") || urlParams.get("docId");
  const ownerId   = urlParams.get("owner") || (user ? user.uid : null);
  const isNew     = urlParams.get("action") === "new";

  if (!docId || !ownerId) {
    if (!user) window.location.href = "login.html";
    else window.location.href = "dash.html";
    return;
  }

  currentDocId   = docId;
  currentOwnerId = ownerId;

  // Nuovo documento (da Dashboard web o da Desktop/Python launcher).
  // L'id arriva sempre esplicito nell'URL: qui viene solo creato se non esiste già.
  if (isNew && user && user.uid === ownerId) {
    autosaveBadge.textContent = "Inizializzazione...";
    const initialTitle = urlParams.get("title");
    await handleNewDocumentFromDesktop(user.uid, docId, initialTitle);

    // Pulisci l'URL
    const cleanUrl = `${window.location.pathname}?owner=${user.uid}&id=${docId}`;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  loadDocument(ownerId, docId, user);
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

function updateToolbarState() {
  if (isReadOnly) return;
  formatButtons.forEach(btn => {
    const cmd = btn.dataset.cmd;
    if (cmd && document.queryCommandState(cmd)) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

editor.addEventListener("keyup", updateToolbarState);
editor.addEventListener("mouseup", updateToolbarState);

formatButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (isReadOnly) return;
    const cmd = btn.dataset.cmd;

    if (cmd === "unorderedList") {
      document.execCommand("insertUnorderedList");
      updateToolbarState();
      return;
    }

    if (["h1", "h2", "h3"].includes(cmd)) {
      document.execCommand("formatBlock", false, cmd.toUpperCase());
      updateToolbarState();
      return;
    }

    if (cmd === "bold" || cmd === "italic" || cmd === "underline") {
      document.execCommand(cmd);
      updateToolbarState();
      return;
    }
  });
});

linkBtn.addEventListener("click", () => {
  if (isReadOnly) return;
  const url = prompt("Inserisci URL completo (https://...)");
  if (!url) return;
  document.execCommand("createLink", false, url);
});

editor.addEventListener("keydown", (e) => {
  if (isReadOnly) return;
  if (e.ctrlKey || e.metaKey) {
    const key = e.key.toLowerCase();
    if (key === "b") { e.preventDefault(); document.execCommand("bold"); updateToolbarState(); }
    if (key === "i") { e.preventDefault(); document.execCommand("italic"); updateToolbarState(); }
    if (key === "u") { e.preventDefault(); document.execCommand("underline"); updateToolbarState(); }
    if (key === "s") { e.preventDefault(); saveDocument(false); }
    if (key === "k") {
      e.preventDefault();
      const url = prompt("Inserisci URL completo (https://...)");
      if (url) document.execCommand("createLink", false, url);
    }
  }
});

if (docTitleInput) {
  docTitleInput.addEventListener("input", () => {
    if (isReadOnly) return;
    autosaveBadge.textContent = "Modifiche non salvate";
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => saveDocument(true), 1500);
  });
}

editor.addEventListener("input", () => {
  if (isReadOnly) return;
  autosaveBadge.textContent = "Modifiche non salvate";
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => saveDocument(true), 1500);
});

saveBtn.addEventListener("click", () => saveDocument(false));

deleteBtn.addEventListener("click", async () => {
  if (isReadOnly) return;
  const confirmDelete = confirm("Eliminare definitivamente il documento?");
  if (!confirmDelete) return;

  const user = auth.currentUser;
  if (!currentDocId || !user || user.uid !== currentOwnerId) return;

  try {
    await db.collection("users")
      .doc(currentOwnerId)
      .collection("documents")
      .doc(currentDocId)
      .delete();

    alert("Documento eliminato.");
    window.location.href = "dash.html";
  } catch (err) {
    console.error("Errore eliminazione:", err);
    alert("Errore durante eliminazione.");
  }
});

downloadBtn.addEventListener("click", () => {
  const format = downloadFormat ? downloadFormat.value : "md";
  const title = safeFileName(docTitleInput ? docTitleInput.value : currentDocTitle);

  if (format === "quill") {
    downloadQuillPointer();
  } else if (format === "md") {
    downloadFile(`${title}.md`, htmlToMarkdown(editor.innerHTML), "text/markdown");
  } else if (format === "txt") {
    downloadFile(`${title}.txt`, editor.innerText, "text/plain");
  } else if (format === "docx") {
    if (typeof htmlDocx !== 'undefined') {
      const converted = htmlDocx.asBlob(editor.innerHTML);
      const url = URL.createObjectURL(converted);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      alert("Libreria DOCX non caricata.");
    }
  } else if (format === "pdf") {
    if (window.jspdf) {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      doc.html(editor, {
         callback: function (doc) {
           doc.save(`${title}.pdf`);
         },
         x: 20,
         y: 20,
         width: 550,
         windowWidth: 800
      });
    } else {
      alert("Libreria PDF non caricata.");
    }
  }
});

// Gestione Condivisione Pubblica
if (shareBtn) {
  shareBtn.addEventListener("click", () => {
    shareModal.classList.remove("hidden");
    shareLinkInput.value = `${window.location.origin}${window.location.pathname}?owner=${currentOwnerId}&id=${currentDocId}`;
  });
}
if (shareCloseBtn) {
  shareCloseBtn.addEventListener("click", () => {
    shareModal.classList.add("hidden");
  });
}
if (copyLinkBtn) {
  copyLinkBtn.addEventListener("click", () => {
    shareLinkInput.select();
    document.execCommand("copy");
    const oldText = copyLinkBtn.textContent;
    copyLinkBtn.textContent = "Copiato!";
    setTimeout(() => copyLinkBtn.textContent = oldText, 2000);
  });
}
if (publicShareToggle) {
  publicShareToggle.addEventListener("change", async () => {
    const user = auth.currentUser;
    if (!currentDocId || !user || user.uid !== currentOwnerId) return;
    try {
      await db.collection("users").doc(currentOwnerId).collection("documents").doc(currentDocId).update({
        publicShare: publicShareToggle.checked
      });
    } catch(err) {
      alert("Errore aggiornamento condivisione.");
      publicShareToggle.checked = !publicShareToggle.checked;
    }
  });
}

/* =========================
   FIRESTORE LOGIC
========================= */

async function handleNewDocumentFromDesktop(uid, docId, title) {
  const docRef = db.collection("users").doc(uid).collection("documents").doc(docId);
  const snap   = await docRef.get();

  if (!snap.exists) {
    await docRef.set({
      title      : (title && title.trim()) ? title.trim() : "Nuovo Documento",
      content    : "",
      publicShare: false,
      createdAt  : firebase.firestore.FieldValue.serverTimestamp()
    });
    console.log("[Quill] Documento creato con docId:", docId);
  }
}

// Carica (e resta in ascolto de) il documento richiesto.
// Determina se l'utente corrente è proprietario (editing) o solo
// visitatore di un link pubblico (sola lettura), e reagisce in tempo
// reale a eventuali modifiche del documento su Firestore.
function loadDocument(ownerId, docId, user) {
  if (docSnapshotUnsubscribe) {
    docSnapshotUnsubscribe();
    docSnapshotUnsubscribe = null;
  }

  isReadOnly = !user || user.uid !== ownerId;

  const docRef = db.collection("users").doc(ownerId).collection("documents").doc(docId);

  docSnapshotUnsubscribe = docRef.onSnapshot(snap => {
    if (!snap.exists) {
      editor.innerHTML = "<h2>Documento non disponibile</h2>";
      autosaveBadge.textContent = "Documento non trovato";
      return;
    }

    const data = snap.data();

    // Se non è il proprietario e il documento non è condiviso pubblicamente, nega l'accesso
    if (isReadOnly && !data.publicShare) {
      editor.innerHTML = "<h2>Documento non disponibile</h2>";
      autosaveBadge.textContent = "Accesso negato";
      return;
    }

    applyReadonlyState(isReadOnly);
    renderDocument(data);

    if (publicShareToggle && !isReadOnly) {
      publicShareToggle.checked = !!data.publicShare;
    }
  }, err => {
    console.error("Errore caricamento documento:", err);
    autosaveBadge.textContent = "Errore caricamento";
  });
}

function applyReadonlyState(readonly) {
  if (readonly) {
    editor.setAttribute("contenteditable", "false");
    if (docTitleInput) {
      docTitleInput.readOnly = true;
      docTitleInput.style.pointerEvents = "none";
    }
    if (toolbar) toolbar.style.display = "none";
    autosaveBadge.innerHTML = 'Sola lettura &mdash; link pubblico <i data-lucide="lock" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-left:4px;"></i>';
    if(typeof lucide !== 'undefined') lucide.createIcons();
    if (settingsBtn) settingsBtn.style.display = "none";
    if (shareBtn) shareBtn.style.display = "none";
    if (saveBtn) saveBtn.style.display = "none";
  } else {
    editor.setAttribute("contenteditable", "true");
    if (docTitleInput) {
      docTitleInput.readOnly = false;
      docTitleInput.style.pointerEvents = "auto";
    }
    if (toolbar) toolbar.style.display = "flex";
    if (settingsBtn) settingsBtn.style.display = "inline-flex";
    if (shareBtn) shareBtn.style.display = "inline-flex";
    if (saveBtn) saveBtn.style.display = "inline-flex";
  }
}

function renderDocument(data) {
    currentDocTitle = data.title || "Documento senza titolo";

    if (docTitleInput) {
        docTitleInput.value = currentDocTitle;
    }

    document.title = `Quill - ${currentDocTitle}`;
    editor.innerHTML = data.content || "";

    if (!isReadOnly) {
        autosaveBadge.textContent = "Documento caricato";
    }
}

async function saveDocument(isAutoSave) {
  if (isReadOnly) return;
  const user = auth.currentUser;
  if (!currentDocId || !user || user.uid !== currentOwnerId) return;

  try {
    const payload = buildPayload(editor.innerHTML);

    await db.collection("users")
      .doc(currentOwnerId)
      .collection("documents")
      .doc(currentDocId)
      .update(payload);

    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    autosaveBadge.textContent = isAutoSave
      ? `Auto-save ${time}`
      : "Documento salvato";

    if (!isAutoSave) alert("Documento salvato.");
  } catch (err) {
    console.error("Errore salvataggio:", err);
    autosaveBadge.textContent = "Salvataggio fallito";
    if (!isAutoSave) alert(`Errore salvataggio: ${err.message}`);
  }
}

function buildPayload(content) {
    const title = docTitleInput
        ? docTitleInput.value.trim() || "Documento senza titolo"
        : currentDocTitle;

    return {
        title,
        content
    };
}

/* =========================
   UTILITIES
========================= */

function safeFileName(name) {
  return String(name || "documento")
    .trim()
    .replace(/[^a-z0-9\-_]+/gi, "_")
    .replace(/^_+|_+$/g, "") || "documento";
}

/* =========================
   DOWNLOAD SYSTEM
========================= */

function downloadQuillPointer() {
  if (!currentDocId) {
    alert("Nessun documento aperto.");
    return;
  }

  const pointer = JSON.stringify({ docId: currentDocId, owner: currentOwnerId });
  downloadFile(`${safeFileName(currentDocTitle)}.quill`, pointer, "application/json");
}

function htmlToMarkdown(html) {
  const root = document.createElement("div");
  root.innerHTML = html;

  const convert = node => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const content = Array.from(node.childNodes).map(convert).join("");
    const tag     = node.tagName.toLowerCase();

    switch (tag) {
      case "strong":
      case "b":    return `**${content}**`;
      case "em":
      case "i":    return `_${content}_`;
      case "h1":   return `# ${content}\n\n`;
      case "h2":   return `## ${content}\n\n`;
      case "h3":   return `### ${content}\n\n`;
      case "a":    return `[${content}](${node.getAttribute("href") || ""})`;
      case "li":   return `- ${content}\n`;
      case "ul":   return Array.from(node.children).map(convert).join("") + "\n";
      case "ol":   return Array.from(node.children).map((child, i) =>
                     `${i + 1}. ${convert(child)}\n`).join("") + "\n";
      case "p":
      case "div":  return content + "\n\n";
      case "br":   return "\n";
      default:     return content;
    }
  };

  return Array.from(root.childNodes).map(convert).join("").trim();
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");

  a.href     = url;
  a.download = name;
  a.click();

  URL.revokeObjectURL(url);
}