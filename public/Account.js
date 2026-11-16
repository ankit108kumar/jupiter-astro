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
  const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
  const forgotPasswordPanel = document.getElementById('forgotPasswordPanel');
  const forgotPasswordForm = document.getElementById('forgotPasswordForm');
  const resetPasswordEmail = document.getElementById('resetPasswordEmail');
  const forgotPasswordMessage = document.getElementById('forgotPasswordMessage');
  const backToLoginBtn = document.getElementById('backToLoginBtn');

  if (!overlay || !openBtn || !closeBtn) {
    console.warn('Account dialogue elements not found.');
    return;
  }

  // Clear credentials and transient status whenever the signed-out form is
  // shown again. Passwords and old success/error messages must not persist.
  function resetSignInForm() {
    if (signInForm) signInForm.reset();

    // Reset the authorization check as well as the visible values. Without
    // this, a reopened form could retain enabled password/submit controls.
    if (typeof window.jaResetEmailVerification === 'function') {
      window.jaResetEmailVerification('login');
    } else {
      const passwordField = document.getElementById('loginPassword');
      const submitButton = signInForm &&
        signInForm.querySelector('button[type="submit"]');
      if (passwordField) passwordField.disabled = true;
      if (submitButton) submitButton.disabled = true;
    }

    const loginMessage = document.getElementById('loginMessage');
    if (loginMessage) {
      loginMessage.textContent = '';
      loginMessage.className = 'account-message';
      loginMessage.hidden = true;
    }
  }

  function showAuthToast(message, kind) {
    const toast = document.getElementById(kind === 'login' ? 'loginToast' : 'logoutToast');
    if (!toast) {
      console.warn(kind + ' succeeded, but its confirmation toast was not found.');
      return;
    }

    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(toast._jaToastTimer);
    toast._jaToastTimer = window.setTimeout(function () {
      toast.classList.remove('show');
    }, 3500);
  }

  // Keep every account view mutually exclusive. All navigation paths use
  // this single renderer so rapid tab/panel clicks cannot leave stale views.
  function setAccountView(view) {
    const tabs = document.querySelector('.account-tabs');
    const loggedInPanel = document.getElementById('loggedInPanel');

    signInForm.classList.toggle('account-hidden', view !== 'signin');
    signUpForm.classList.toggle('account-hidden', view !== 'signup');
    if (forgotPasswordPanel) {
      forgotPasswordPanel.classList.toggle('account-hidden', view !== 'forgot');
    }
    if (loggedInPanel) {
      loggedInPanel.classList.toggle('account-hidden', view !== 'loggedIn');
    }
    if (tabs) tabs.style.display = view === 'loggedIn' ? 'none' : '';

    if (signInTab && signUpTab) {
      signInTab.classList.toggle('active', view === 'signin');
      signUpTab.classList.toggle('active', view === 'signup');
      signInTab.setAttribute('aria-selected', String(view === 'signin'));
      signUpTab.setAttribute('aria-selected', String(view === 'signup'));
    }
  }

  // OPEN ACCOUNT DIALOGUE
  function openAccount() {
    const user = window.jaAuthUser || null;

    if (user) {
      setAccountView('loggedIn');
      const emailNode = document.getElementById('loggedInEmail');
      if (emailNode) emailNode.textContent = user.email || 'Signed-in user';
    } else {
      resetSignInForm();
      setAccountView('signin');
    }

    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (!user) {
      setTimeout(() => {
        const email = document.getElementById('loginEmail');
        if (email) email.focus();
      }, 100);
    } else {
      const logout = document.getElementById('logoutBtn');
      if (logout) logout.focus();
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

  // SWITCH BETWEEN ACCOUNT VIEWS
  function showSignIn() {
    setAccountView('signin');
  }

  function showSignUp() {
    setAccountView('signup');
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

      // Clear any previously entered credentials and show confirmation.
      resetSignInForm();
      showAuthToast('You have been logged out successfully.', 'logout');

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

if (typeof window.jaLockEmailVerificationForm === 'function') {
  window.jaLockEmailVerificationForm('signup');
} else {
  passwordField.disabled = true;
  confirmField.disabled = true;
  signupSubmitButton.disabled = true;
  [passwordField, confirmField, signupSubmitButton].forEach(function (element) {
    const surface = element.closest('.account-disabled-hover');
    if (surface) surface.classList.add('is-locked');
  });
}


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

  let signInSucceeded = false;

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

    // Firebase onAuthStateChanged updates the account button.
    // Close the dialogue, clear credentials, and confirm success consistently
    // with the logout toast.
    signInSucceeded = true;
    closeAccount();
    resetSignInForm();
    showAuthToast('You have been logged in successfully.', 'login');

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

    // resetSignInForm() deliberately locks the fields after a successful
    // sign-in. Do not re-enable the button from this finally block.
    if (signInSucceeded) {
      submitButton.disabled = true;
      submitButton.textContent = 'Sign In';
    } else {
      submitButton.disabled = false;
      submitButton.textContent = 'Sign In';
    }

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

  // FORGOT PASSWORD DIALOGUE
  if (forgotPasswordBtn && forgotPasswordPanel) {
    forgotPasswordBtn.addEventListener('click', function (e) {
      e.preventDefault();

      setAccountView('forgot');

      const loginEmail = document.getElementById('loginEmail');
      if (loginEmail && loginEmail.value.trim()) {
        resetPasswordEmail.value = loginEmail.value.trim();
      }

      // Require a fresh authorization check each time the recovery panel opens.
      if (typeof window.jaResetEmailVerification === 'function') {
        window.jaResetEmailVerification('forgot');
      }

      if (forgotPasswordMessage) {
        forgotPasswordMessage.hidden = true;
        forgotPasswordMessage.textContent = '';
        forgotPasswordMessage.className = 'account-message';
      }

      setTimeout(function () {
        if (resetPasswordEmail) resetPasswordEmail.focus();
      }, 50);
    });
  }

  if (backToLoginBtn) {
    backToLoginBtn.addEventListener('click', function (e) {
      e.preventDefault();
      setAccountView('signin');
      setTimeout(function () {
        const loginEmail = document.getElementById('loginEmail');
        if (loginEmail) loginEmail.focus();
      }, 50);
    });
  }

  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const email = resetPasswordEmail.value.trim().toLowerCase();
      const api = window.firebaseAuthAPI;
      const auth = window.firebaseAuth;
      const submitButton = document.getElementById('sendResetEmailBtn');

      if (!api || !auth || typeof api.sendPasswordResetEmail !== 'function') {
        forgotPasswordMessage.hidden = false;
        forgotPasswordMessage.textContent = 'Password reset is temporarily unavailable. Please try again later.';
        forgotPasswordMessage.className = 'account-message error';
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = 'Sending...';
      forgotPasswordMessage.hidden = false;
      forgotPasswordMessage.textContent = 'Sending password reset instructions...';
      forgotPasswordMessage.className = 'account-message';

      try {
        await api.sendPasswordResetEmail(auth, email);
        forgotPasswordMessage.textContent =
          'If an account exists for this email address, a password reset link has been sent. Please check your inbox and spam folder.';
        forgotPasswordMessage.className = 'account-message success';
        // Keep the authorized email in place; clearing it here would leave
        // the verification state stale while the submit button stayed enabled.
      } catch (error) {
        console.error('Password reset email error:', error);

        let message = 'Unable to send the reset email. Please try again later.';
        if (error.code === 'auth/invalid-email') {
          message = 'Please enter a valid email address.';
        } else if (error.code === 'auth/too-many-requests') {
          message = 'Too many reset attempts. Please wait before trying again.';
        } else if (error.code === 'auth/network-request-failed') {
          message = 'Network error. Please check your internet connection.';
        }

        // Use a generic response for unknown email addresses to avoid
        // revealing whether an account exists.
        forgotPasswordMessage.textContent = message;
        forgotPasswordMessage.className = 'account-message error';
        forgotPasswordMessage.hidden = false;
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Send Reset Link';
      }
    });
  }

})();
