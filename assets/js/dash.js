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

// Logout
document.getElementById("logout-btn").addEventListener("click", () => {
  auth.signOut().then(() => {
    window.location.href = "login.html";
  });
});

// Controllo login
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    loadDocuments(user.uid);
  }
});

// Carica documenti
function loadDocuments(uid) {
  const docList = document.getElementById("document-list");
  docList.innerHTML = "";

  db.collection("users").doc(uid).collection("documents")
    .get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        const data = doc.data();
        const card = document.createElement("div");
        card.classList.add("doc-card");
        card.innerHTML = `
          <h2>${data.title}</h2>
          <button onclick="openDoc('${doc.id}')">Apri</button>
        `;
        docList.appendChild(card);
      });
    });
}

// Apri documento
function openDoc(docId) {
  localStorage.setItem("currentDocId", docId);
  window.location.href = "editor.html";
}

// Nuovo documento
document.getElementById("new-doc-btn").addEventListener("click", () => {
  const title = prompt("Titolo del nuovo documento:");
  const user = auth.currentUser;
  if (!title || !user) return;

  db.collection("users").doc(user.uid).collection("documents")
    .add({ title, content: "" })
    .then(() => loadDocuments(user.uid));
});