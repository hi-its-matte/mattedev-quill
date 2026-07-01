import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

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
