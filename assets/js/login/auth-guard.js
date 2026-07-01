import { auth } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href =
      "https://auth.mattedev.com/login?redirect=" +
      encodeURIComponent(window.location.href);
    return;
  }

  if (!user.emailVerified) {
    window.location.href = "https://auth.mattedev.com/verify.html";
  }
});
