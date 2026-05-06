document.addEventListener("DOMContentLoaded", () => {

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

const logoutBtn = document.getElementById("logout-btn");
const titleEl = document.getElementById("dashboard-title");
const profileIsland = document.getElementById("profile-island");
const profileName = document.getElementById("profile-name");
const profileAvatar = document.getElementById("profile-avatar");

logoutBtn.addEventListener("click", () => {
  auth.signOut().then(() => {
    window.location.href = "login.html";
  });
});

auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    loadUserProfile(user.uid);
    loadDocuments(user.uid);
  }
});

function loadUserProfile(uid) {
  db.collection("users").doc(uid).get().then(doc => {
    const data = doc.exists ? doc.data() : {};
    const username = data.username || "Utente";
    const pfp = data.pfp || "https://via.placeholder.com/40";

    const greetings = [
      `Ciao, ${username}`,
      `Salve, ${username}`,
      `Ecco i tuoi documenti, ${username}`
    ];

    titleEl.textContent = greetings[Math.floor(Math.random() * greetings.length)];
    profileName.textContent = username;
    profileAvatar.src = pfp;
  });
}

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
          <h2>${data.title || "Documento senza titolo"}</h2>
          <p>Apri e continua a scrivere nel tuo spazio personale.</p>
          <button onclick="openDoc('${doc.id}')">Apri</button>
        `;
        docList.appendChild(card);
      });
    });
}

function openDoc(docId) {
  localStorage.setItem("currentDocId", docId);
  window.location.href = "editor.html";
}

document.getElementById("new-doc-btn").addEventListener("click", () => {
  const title = prompt("Titolo del nuovo documento:");
  const user = auth.currentUser;
  if (!title || !user) return;

  db.collection("users").doc(user.uid).collection("documents")
    .add({ title, content: "", isEncrypted: false })
    .then(() => loadDocuments(user.uid));
});

profileIsland.addEventListener("click", () => {
  profileIsland.classList.toggle("open");
});

profileIsland.addEventListener("keydown", event => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    profileIsland.classList.toggle("open");
  }
});

document.addEventListener("click", event => {
  if (!profileIsland.contains(event.target)) {
    profileIsland.classList.remove("open");
  }
});

// Mostra il loading screen all'avvio
  const loading = document.getElementById('loading');

  // Dopo 3 secondi, nasconde il loading screen
  setTimeout(() => {
    loading.classList.add('hidden');
  }, 1000); // 3000ms = 3 secondi

});
// Opzione B: Rendila globale
window.openDoc = function(docId) {
  localStorage.setItem("currentDocId", docId);
  window.location.href = "editor.html";
};