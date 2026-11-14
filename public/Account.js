/* =========================================================
   JUPITER ASTRO — ACCOUNT
   Account dialog, signup, sign-in and logout.
   Loaded as an ES module after Firebase.js.
   ========================================================= */

(function () {

  const overlay = document.getElementById('accountOverlay');
  const openBtn = document.getElementById('accountOpenBtn');
  const closeBtn = document.getElementById('accountCloseBtn');

  const signInTab = document.getElementById('signInTab');
  const signUpTab = document.getElementById('signUpTab');

  const signInForm = document.getElementById('signInForm');
  const signUpForm = document.getElementById('signUpForm');

  const switchToSignup = document.getElementById('switchToSignup');
  const switchToSignin = document.getElementById('switchToSignin');

  if (!overlay || !openBtn || !closeBtn) {
    console.warn('Account dialogue elements not found.');
    return;
  }

 // OPEN ACCOUNT DIALOGUE
function openAccount() {

  const user = window.jaAuthUser || null;

  const tabs = document.querySelector('.account-tabs');
  const loggedInPanel = document.getElementById('loggedInPanel');

  if (user) {

    // Show logged-in view
    tabs.style.display = 'none';

    signInForm.classList.add('account-hidden');
    signUpForm.classList.add('account-hidden');

    loggedInPanel.classList.remove('account-hidden');

    document.getElementById('loggedInEmail').textContent =
      user.email || 'Signed-in user';

  } else {

    // Show normal authentication interface
    tabs.style.display = '';

    loggedInPanel.classList.add('account-hidden');

    showSignIn();

  }

  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');

  document.body.style.overflow = 'hidden';

  if (!user) {
    setTimeout(() => {
      document.getElementById('loginEmail').focus();
    }, 100);
  } else {
    document.getElementById('logoutBtn').focus();
  }

}

  // CLOSE DIALOGUE
  function closeAccount() {

    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');

    // Restore page scrolling
    document.body.style.overflow = '';

    // Return focus to Account icon
    openBtn.focus();

  }

  // SWITCH TO SIGN IN
  function showSignIn() {

    signInForm.classList.remove('account-hidden');
    signUpForm.classList.add('account-hidden');

    signInTab.classList.add('active');
    signUpTab.classList.remove('active');

    signInTab.setAttribute('aria-selected', 'true');
    signUpTab.setAttribute('aria-selected', 'false');

  }

  // SWITCH TO Set Password
  function showSignUp() {

    signUpForm.classList.remove('account-hidden');
    signInForm.classList.add('account-hidden');

    signUpTab.classList.add('active');
    signInTab.classList.remove('active');

    signUpTab.setAttribute('aria-selected', 'true');
    signInTab.setAttribute('aria-selected', 'false');

  }

  // BUTTON EVENTS
  openBtn.addEventListener('click', openAccount);
  closeBtn.addEventListener('click', closeAccount);

// FIREBASE LOGOUT
const logoutBtn = document.getElementById('logoutBtn');

if (logoutBtn) {
  logoutBtn.addEventListener('click', async function () {

    const logoutButton = this;
    const api = window.firebaseAuthAPI;
    const auth = window.firebaseAuth;

    if (!api || !auth) {
      alert('Authentication is not ready. Please try again.');
      return;
    }

    logoutButton.disabled = true;
    logoutButton.textContent = 'Logging out...';

    try {

      await api.signOut(auth);

      // Close account popup
      closeAccount();

      // Show logout confirmation
      const toast = document.getElementById('logoutToast');

      toast.classList.add('show');

      setTimeout(function () {
        toast.classList.remove('show');
      }, 3500);

    } catch (error) {

      console.error('Logout error:', error);

      alert('Unable to log out. Please try again.');

           } finally {
      logoutButton.disabled = false;
      logoutButton.textContent = 'Logout';
    }

  });

} // Closes if (logoutBtn)
	
  signInTab.addEventListener('click', showSignIn);
  signUpTab.addEventListener('click', showSignUp);

  switchToSignup.addEventListener('click', function (e) {
    e.preventDefault();
    showSignUp();
  });

  switchToSignin.addEventListener('click', function (e) {
    e.preventDefault();
    showSignIn();
  });

  // CLICK OUTSIDE THE DIALOGUE TO CLOSE
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) {
      closeAccount();
    }
  });

  // CLOSE USING ESCAPE KEY
  document.addEventListener('keydown', function (e) {
    if (
      e.key === 'Escape' &&
      overlay.classList.contains('is-open')
    ) {
      closeAccount();
    }
  });

  
// FIREBASE ACCOUNT CREATION
signUpForm.addEventListener('submit', async function (e) {

  e.preventDefault();

  const email =
    document.getElementById('signupEmail').value.trim();

  const password =
    document.getElementById('signupPassword').value;

  const confirmPassword =
    document.getElementById('confirmPassword').value;

  const messageBox =
    document.getElementById('signupMessage');

  const submitButton =
  document.getElementById('signupSubmitBtn');

  // Check password confirmation
  if (password !== confirmPassword) {
    messageBox.textContent = 'Passwords do not match.';
    messageBox.className = 'account-message error';
    return;
  }

  // Check Firebase password policy
  const validPassword =
    password.length >= 8 &&
    password.length <= 32 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password);

  if (!validPassword) {
    messageBox.textContent =
      'Password must be 8–32 characters and include uppercase, lowercase, number and special character.';

    messageBox.className = 'account-message error';
    return;
  }

  // Check Firebase initialization
  if (!window.firebaseAuth || !window.firebaseAuthAPI) {
    messageBox.textContent =
      'Authentication is not ready. Please refresh the page and try again.';

    messageBox.className = 'account-message error';
    return;
  }

  const api = window.firebaseAuthAPI;
  const auth = window.firebaseAuth;

  messageBox.textContent = 'Creating your account...';
  messageBox.className = 'account-message';

  try {

    // Keep the login active only for this browser session
    await api.setPersistence(
      auth,
      api.browserSessionPersistence
    );

    // Create Firebase account
    const credential =
      await api.createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    // Firebase automatically signs in the newly created user
    const user = credential.user;

    // Send email verification link
    try {

      await api.sendEmailVerification(user);

      messageBox.textContent =
        'Your account has been created successfully. A verification link has been sent to ' +
        email +
        '. You are signed in for this browser session.';

      messageBox.className = 'account-message success';

    } catch (verificationError) {

      messageBox.textContent =
        'Your account was created and you are signed in, but the verification email could not be sent. Please try again later.';

      messageBox.className = 'account-message error';

      console.error(
        'Email verification error:',
        verificationError
      );

    }

    
// Clear and disable password fields after account creation
const passwordField = document.getElementById('signupPassword');
const confirmField = document.getElementById('confirmPassword');
const signupSubmitButton = document.getElementById('signupSubmitBtn');

passwordField.value = '';
confirmField.value = '';

passwordField.disabled = true;
confirmField.disabled = true;
signupSubmitButton.disabled = true;

// Remove any previous inline button styling
signupSubmitButton.style.removeProperty('opacity');
signupSubmitButton.style.removeProperty('cursor');


  } catch (error) {

    let errorMessage = 'Unable to create your account. Please try again.';

    switch (error.code) {

      case 'auth/email-already-in-use':
        errorMessage =
          'An account already exists with this email. Please use Sign In.';
        break;

      case 'auth/invalid-email':
        errorMessage = 'Please enter a valid email address.';
        break;

      case 'auth/weak-password':
        errorMessage =
          'Your password does not meet the required password policy.';
        break;

      case 'auth/operation-not-allowed':
        errorMessage =
          'Email/password authentication is not enabled.';
        break;

      case 'auth/network-request-failed':
        errorMessage =
          'Network error. Please check your internet connection.';
        break;

      case 'auth/too-many-requests':
        errorMessage =
          'Too many attempts. Please try again later.';
        break;

      default:
        console.error('Firebase account creation error:', error);
    }

    messageBox.textContent = errorMessage;
    messageBox.className = 'account-message error';

    } finally {

    }

});


  
// FIREBASE SIGN IN
signInForm.addEventListener('submit', async function (e) {

  e.preventDefault();

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const rememberMe = document.getElementById('rememberMe').checked;
  const messageBox = document.getElementById('loginMessage');

  const submitButton = signInForm.querySelector(
    'button[type="submit"]'
  );

  const api = window.firebaseAuthAPI;
  const auth = window.firebaseAuth;

  if (!api || !auth) {
    messageBox.textContent =
      'Authentication is not ready. Please refresh the page.';
    messageBox.className = 'account-message error';
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Signing in...';

  messageBox.hidden = false;
  messageBox.textContent = 'Authenticating your account...';
  messageBox.className = 'account-message';

  try {

    // Set session persistence according to checkbox
    await api.setPersistence(
      auth,
      rememberMe
        ? api.browserLocalPersistence
        : api.browserSessionPersistence
    );

    // Authenticate using Firebase
    const credential = await api.signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    console.log(
      'Jupiter Astro: User signed in successfully.',
      credential.user.email
    );

    messageBox.textContent = 'Login successful!';
    messageBox.className = 'account-message success';

    // Firebase onAuthStateChanged will update the Account button
    // Close popup after successful authentication
    closeAccount();

  } catch (error) {

    console.error('Firebase Sign In Error:', error);

    let errorMessage = 'Unable to sign in. Please try again.';

    switch (error.code) {

      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        errorMessage = 'Incorrect email address or password.';
        break;

      case 'auth/invalid-email':
        errorMessage = 'Please enter a valid email address.';
        break;

      case 'auth/user-disabled':
        errorMessage = 'This account has been disabled.';
        break;

      case 'auth/too-many-requests':
        errorMessage = 'Too many attempts. Please try again later.';
        break;

      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your connection.';
        break;

    }

    messageBox.hidden = false;
    messageBox.textContent = errorMessage;
    messageBox.className = 'account-message error';

  } finally {

    submitButton.disabled = false;
    submitButton.textContent = 'Sign In';

  }

});


  // Open the existing Account dialogue when returning from the standalone Library prompt.
  if (window.location.hash === '#account') {
    const openFromLibraryPrompt = function () {
      openAccount();
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search
      );
    };

    if (window.jaAuthReady && typeof window.jaAuthReady.then === 'function') {
      window.jaAuthReady.then(openFromLibraryPrompt, openFromLibraryPrompt);
    } else {
      openFromLibraryPrompt();
    }
  }

  // FORGOT PASSWORD PLACEHOLDER
  document.getElementById('forgotPasswordBtn')
    .addEventListener('click', function (e) {

      e.preventDefault();

      alert('Password reset functionality has not been connected yet.');

    });

})();
