import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "XXX",
  authDomain: "mattedev.firebaseapp.com",
  projectId: "mattedev",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
