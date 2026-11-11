/* =========================================================
   JUPITER ASTRO — EMAIL VERIFICATION
   Checks email authorisation before allowing login/signup.
   Loaded as an ES module after Firebase.js.
   ========================================================= */

// ============ SHARED EMAIL VERIFICATION ============

(function () {

  const AUTH_CHECK_URL =
    'https://script.google.com/macros/s/AKfycbx02wG3xKMKegEYNYMI-pQbmXhnPiielVJbYtPIXs0waU7150qys4Y1psaulXX1U4qx/exec';

  // Shared cooldown across both forms
  const lastRequestAt = {};

  // Keep track of verified emails separately
  const verifiedEmails = {
    login: '',
    signup: ''
  };

  // Prevent overlapping verification requests
  let requestInProgress = false;

  // Currently active verification request
  let activeRequest = null;

// ============ LOCK / UNLOCK FORM FIELDS ============





function setFormLocked(form, locked) {

  if (!form) return;

  // Lock / unlock password fields
  form.querySelectorAll('input[type="password"]')
    .forEach(function(field) {
      field.disabled = locked;
    });

  // Lock / unlock the submit button
  const submitButton = form.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.disabled = locked;

    // Remove old inline styling; CSS handles disabled appearance
    submitButton.style.removeProperty('opacity');
    submitButton.style.removeProperty('cursor');
  }

}



	
  // ============ MESSAGE DISPLAY ============

  function showMessage(box, message, type) {

    box.hidden = false;
    box.className = 'account-message ' + (type || '');
    box.textContent = message;

  }


  // ============ EMAIL VERIFICATION ============

  function verifyEmail(input, messageBox, formType) {

    const email = input.value.trim().toLowerCase();

    // Empty email
    if (!email) {
      messageBox.hidden = true;
      verifiedEmails[formType] = '';
      return;
    }

    // Validate email format
    if (!input.checkValidity()) {

      verifiedEmails[formType] = '';

      showMessage(
        messageBox,
        'Please enter a valid email address.',
        'error'
      );

      return;
    }

    // Already verified for this form
    if (verifiedEmails[formType] === email) {
      return;
    }

    // Prevent simultaneous requests
    if (requestInProgress) {
      return;
    }

    // Five-second frontend cooldown
    const now = Date.now();
    const previousRequest = lastRequestAt[email] || 0;
    const elapsed = now - previousRequest;

    if (elapsed < 5000) {

      const remaining = Math.ceil((5000 - elapsed) / 1000);

      showMessage(
        messageBox,
        'Please wait ' + remaining +
        ' second(s) before checking this email again.',
        'error'
      );

      return;
    }

    // Record request time
    lastRequestAt[email] = now;

    requestInProgress = true;

    showMessage(
      messageBox,
      '⏳ Verifying email...',
      ''
    );

    // Unique JSONP callback
    const callbackName =
      'emailVerificationCallback_' +
      Date.now() + '_' +
      Math.floor(Math.random() * 100000);

    const script = document.createElement('script');

    const params = new URLSearchParams({
      action: 'verifyEmail',
      email: email,
      callback: callbackName
    });

    script.src = AUTH_CHECK_URL + '?' + params.toString();

    let completed = false;

    function cleanup() {

      if (completed) return;

      completed = true;

      clearTimeout(timeout);

      requestInProgress = false;
      activeRequest = null;

      script.remove();

      delete window[callbackName];

    }

    activeRequest = {
      email: email,
      input: input,
      messageBox: messageBox,
      formType: formType
    };

    // Timeout protection
    const timeout = setTimeout(function () {

      cleanup();

      showMessage(
        messageBox,
        'Verification timed out. Please try again later.',
        'error'
      );

    }, 15000);


    // ============ RECEIVE GOOGLE SCRIPT RESPONSE ============

    window[callbackName] = function (result) {

      cleanup();

      // Ignore result if email was changed
      if (input.value.trim().toLowerCase() !== email) {
        return;
      }

      // Backend cooldown
      if (result.status === 'rate_limited') {

        showMessage(
          messageBox,
          'Please wait ' + result.retryAfter +
          ' second(s) before trying again.',
          'error'
        );

        return;
      }

      // Authorized
if (result.success && result.authorized === true) {

    verifiedEmails[formType] = email;

    // Enable password fields and submit button
    const currentForm = document.getElementById(
      formType === 'login' ? 'signInForm' : 'signUpForm'
    );

    setFormLocked(currentForm, false);

    showMessage(
      messageBox,
      '✓ Email authorized successfully.',
      'success'
    );

    return;
}

      // Unauthorized
if (result.success && result.authorized === false) {

  verifiedEmails[formType] = '';

  // Lock password fields and submit button
  setFormLocked(
    document.getElementById(
      formType === 'login' ? 'signInForm' : 'signUpForm'
    ),
    true
  );

  showMessage(
    messageBox,
    'This email ID ' + email +
    ' is not authorized. Please contact consult@jupiterastrology108.com for authorization.',
    'error'
  );

  return;
}

      // Server error
verifiedEmails[formType] = '';

// Lock password fields and submit button
setFormLocked(
  document.getElementById(
    formType === 'login' ? 'signInForm' : 'signUpForm'
  ),
  true
);

showMessage(
  messageBox,
  'Unable to verify email. Please try again later.',
  'error'
);

    };


    // Network / script loading error
    script.onerror = function () {

      cleanup();

      showMessage(
        messageBox,
        'Verification request failed. Please try again later.',
        'error'
      );

    };

    document.body.appendChild(script);

  }


  // ============ CONNECT BOTH FORMS ============

  const forms = [

    {
      type: 'login',
      input: document.getElementById('loginEmail'),
      message: document.getElementById('loginMessage'),
      form: document.getElementById('signInForm')
    },

    {
      type: 'signup',
      input: document.getElementById('signupEmail'),
      message: document.getElementById('signupMessage'),
      form: document.getElementById('signUpForm')
    }

  ];


  forms.forEach(function (item) {

    if (!item.input || !item.message || !item.form) {
      console.error(
        'Email verification elements missing for:',
        item.type
      );
      return;
    }

    // Initially disable password fields and submit button
    setFormLocked(item.form, true);
	  
    // Verify when user leaves email field
    // Works with mouse click and Tab
    item.input.addEventListener('blur', function () {

      verifyEmail(
        item.input,
        item.message,
        item.type
      );

    });


    // Invalidate verification when email is edited
    item.input.addEventListener('input', function () {

    // Invalidate previous verification
    verifiedEmails[item.type] = '';

    // Lock password fields again
    setFormLocked(item.form, true);

    item.message.hidden = true;

});


    // Block form submission until email is verified
    item.form.addEventListener('submit', function (e) {

      const currentEmail =
        item.input.value.trim().toLowerCase();

      if (
        !currentEmail ||
        currentEmail !== verifiedEmails[item.type]
      ) {

        e.preventDefault();
        e.stopImmediatePropagation();

        showMessage(
          item.message,
          'Please verify your email address before proceeding.',
          'error'
        );

      }

    }, true);

  });

})();
