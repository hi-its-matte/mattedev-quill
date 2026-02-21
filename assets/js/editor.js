// Config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC7Tbqt5FzJK8Z_USkCMWxXiHZp8uRN26A",
  authDomain: "mattedev-account.firebaseapp.com",
  projectId: "mattedev-account",
  storageBucket: "mattedev-account.firebasestorage.app",
  messagingSenderId: "77268069903",
  appId: "1:77268069903:web:040aa6c3981eb3650afd7a"
};

// Inizializza Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const editor = document.getElementById("editor");
const saveBtn = document.getElementById("save-btn");
const backBtn = document.getElementById("back-btn");

// Torna alla dashboard
backBtn.addEventListener("click", () => {
  window.location.href = "dash.html";
});

// Controllo login
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    loadDocument(user.uid);
  }
});

// Carica documento corrente
function loadDocument(uid) {
  const docId = localStorage.getItem("currentDocId");
  if (!docId) {
    alert("Nessun documento selezionato.");
    window.location.href = "dash.html";
    return;
  }

  db.collection("users").doc(uid).collection("documents").doc(docId)
    .get()
    .then(doc => {
      if (doc.exists) {
        editor.innerHTML = doc.data().content || "";
      } else {
        alert("Documento non trovato.");
        window.location.href = "dash.html";
      }
    });
}

// Salva documento
saveBtn.addEventListener("click", () => {
  const docId = localStorage.getItem("currentDocId");
  const user = auth.currentUser;
  if (!docId || !user) return;

  const content = editor.innerHTML;

  db.collection("users").doc(user.uid).collection("documents").doc(docId)
    .update({ content })
    .then(() => {
      alert("Documento salvato!");
    })
    .catch(err => {
      console.error(err);
      alert("Errore nel salvataggio.");
    });
});

// Auto-save ogni 30 secondi
setInterval(() => {
  const docId = localStorage.getItem("currentDocId");
  const user = auth.currentUser;
  if (!docId || !user) return;

  const content = editor.innerHTML;
  db.collection("users").doc(user.uid).collection("documents").doc(docId)
    .update({ content })
    .catch(err => console.error("Auto-save fallito:", err));
}, 30000);