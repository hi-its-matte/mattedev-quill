import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "XXX",
  authDomain: "mattedev.firebaseapp.com",
  projectId: "mattedev",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
