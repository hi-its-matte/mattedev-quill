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
    Promise.all([
      loadUserProfile(user.uid),
      loadDocuments(user.uid)
    ]).then(() => {
      document.getElementById('loading').classList.add('hidden');
    }).catch(err => {
      console.error("Errore durante il caricamento:", err);
      document.getElementById('loading').classList.add('hidden');
    });
  }
});

function loadUserProfile(uid) {
  return db.collection("users").doc(uid).get().then(doc => {
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

  return db.collection("users").doc(uid).collection("documents")
    .get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        const data = doc.data();
        const card = document.createElement("div");
        card.classList.add("doc-card");

        const h2 = document.createElement("h2");
        h2.textContent = data.title || "Documento senza titolo";

        const p = document.createElement("p");
        p.textContent = "Apri e continua a scrivere nel tuo spazio personale.";

        const btn = document.createElement("button");
        btn.textContent = "Apri";
        btn.onclick = () => openDoc(doc.id, uid);

        card.appendChild(h2);
        card.appendChild(p);
        card.appendChild(btn);

        docList.appendChild(card);
      });
    });
}

function openDoc(docId, ownerId) {
  window.location.href = `editor.html?owner=${ownerId}&id=${docId}`;
}

// Genera un id univoco PRIMA di navigare e lo passa esplicitamente nell'URL.
// Prima si usava editor.html?action=new senza id: l'editor cadeva su un
// fallback a localStorage e riapriva l'ultimo documento invece di crearne
// uno nuovo. Qui inoltre si evita la doppia creazione (niente più .add()
// separato: il documento viene creato una sola volta, dall'editor stesso).
document.getElementById("new-doc-btn").addEventListener("click", (e) => {
  e.preventDefault();

  const user = auth.currentUser;
  if (!user) return;

  const title = prompt("Titolo del nuovo documento:");
  if (!title) return;

  const newDocRef = db.collection("users").doc(user.uid).collection("documents").doc();

  const params = new URLSearchParams({
    owner: user.uid,
    id: newDocRef.id,
    action: "new",
    title: title
  });

  window.location.href = `editor.html?${params.toString()}`;
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

// Il loading screen viene nascosto in onAuthStateChanged


});

window.openDoc = function(docId, ownerId) {
  window.location.href = `editor.html?owner=${ownerId}&id=${docId}`;
};