/* =========================================================
   JUPITER ASTRO — FIREBASE
   Firebase SDK initialisation and auth-session synchronisation.
   Load this module before Account.js and Email Verification.js.
   ========================================================= */

// ================= FIREBASE SDK IMPORTS =================

  import { initializeApp } from
    "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";

  import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    signOut,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    reload
  } from
    "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";


  // ================= FIREBASE CONFIGURATION =================

  const firebaseConfig = {
    apiKey: "AIzaSyDwXS689Y4gdyuD9-3ThCwsDiSHkyuNFpU",
    authDomain: "jupiter-astro.firebaseapp.com",
    projectId: "jupiter-astro",
    storageBucket: "jupiter-astro.firebasestorage.app",
    messagingSenderId: "867320173550",
    appId: "1:867320173550:web:fead03b3b96c8fd01034ff"
  };

  // Public client configuration for browser-side integrations.
  // Restrict this API key by HTTP referrer and enabled APIs in Google Cloud.
  window.jaFirebaseConfig = {
    apiKey: firebaseConfig.apiKey,
    // Defaults to the Firebase key. You may replace this with a dedicated
    // Google Drive API key restricted to your website's HTTP referrers.
    driveApiKey: "AIzaSyB5sipi-7bK2k-VWblZ9g4Lf1_uPSx1NXY",
    projectId: firebaseConfig.projectId
  };


  // ================= INITIALIZE FIREBASE =================

  const app = initializeApp(firebaseConfig);

  const auth = getAuth(app);


  // ================= EXPOSE AUTHENTICATION FUNCTIONS =================

  window.firebaseAuth = auth;

  window.firebaseAuthAPI = {

    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    signOut,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    reload

  };

	// ================= ACCOUNT SESSION SYNCHRONIZATION =================

window.jaAuthUser = null;

const accountButton =
  document.getElementById('accountOpenBtn');

onAuthStateChanged(auth, function(user) {

  // Maintain current login state globally
  window.jaAuthUser = user || null;

  // Update Account button appearance
  if (accountButton) {

    if (user) {

      accountButton.classList.add('is-logged-in');
      accountButton.title = 'Logged in: ' + user.email;
      accountButton.setAttribute(
        'aria-label',
        'Account - Logged in'
      );

    } else {

      accountButton.classList.remove('is-logged-in');
      accountButton.title = 'Account';
      accountButton.setAttribute(
        'aria-label',
        'Open account'
      );

    }

  }

});

  console.log("Jupiter Astro: Firebase initialized successfully.");
