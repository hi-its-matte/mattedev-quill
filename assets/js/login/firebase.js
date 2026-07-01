import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC7Tbqt5FzJK8Z_USkCMWxXiHZp8uRN26A",
  authDomain: "mattedev-account.firebaseapp.com",
  projectId: "mattedev-account",
  storageBucket: "mattedev-account.firebasestorage.app",
  messagingSenderId: "77268069903",
  appId: "1:77268069903:web:040aa6c3981eb3650afd7a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
