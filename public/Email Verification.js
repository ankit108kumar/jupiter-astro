/* =========================================================
   JUPITER ASTRO — EMAIL AUTHORIZATION
   Checks Google Sheets allowlist authorization before allowing
   login, Set Password, or password-reset actions.
   Loaded after Account.js and Firebase.js.
   ========================================================= */

(function () {
  'use strict';

  const AUTH_CHECK_URL =
    'https://script.google.com/macros/s/AKfycbx02wG3xKMKegEYNYMI-pQbmXhnPiielVJbYtPIXs0waU7150qys4Y1psaulXX1U4qx/exec';

  const COOLDOWN_MS = 5000;
  const REQUEST_TIMEOUT_MS = 15000;
  const lastRequestAt = Object.create(null);
  const verifiedEmails = { login: '', signup: '', forgot: '' };
  const activeRequests = new Map();

  // Best-effort activity logging. The Apps Script endpoint writes events to
  // the private .logs worksheet. Never send passwords, tokens or reset links.
  let jaLogSessionId = '';
  try {
    jaLogSessionId = sessionStorage.getItem('ja_auth_log_session') || '';
    if (!jaLogSessionId) {
      jaLogSessionId = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'ja-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      sessionStorage.setItem('ja_auth_log_session', jaLogSessionId);
    }
  } catch (_) {
    jaLogSessionId = 'ja-' + Date.now();
  }

  window.jaLogAuthEvent = function (eventName, status, email, reason, metadata) {
    const payload = {
      action: 'logEvent',
      event: String(eventName || '').slice(0, 64),
      status: String(status || '').slice(0, 24),
      email: String(email || '').trim().toLowerCase().slice(0, 254),
      reason: String(reason || '').slice(0, 200),
      sessionId: jaLogSessionId,
      source: 'JupiterAstro website',
      userAgent: navigator.userAgent.slice(0, 300),
      metadata: metadata && typeof metadata === 'object' ? metadata : {}
    };

    try {
      fetch(AUTH_CHECK_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(function (error) {
        console.warn('Activity log could not be sent:', error);
      });
    } catch (error) {
      console.warn('Activity log could not be sent:', error);
    }
  };

  const FORM_CONFIG = {
    login: { form: 'signInForm', message: 'loginMessage' },
    signup: { form: 'signUpForm', message: 'signupMessage' },
    forgot: { form: 'forgotPasswordForm', message: 'forgotPasswordMessage' }
  };

  function getForm(formType) {
    const config = FORM_CONFIG[formType];
    return config ? document.getElementById(config.form) : null;
  }

  function setFormLocked(form, locked) {
    if (!form) return;

    form.querySelectorAll('input[type="password"]').forEach(function (field) {
      field.disabled = locked;
      const surface = field.closest('.account-disabled-hover');
      if (surface) surface.classList.toggle('is-locked', locked);
    });

    const submit = form.querySelector('button[type="submit"]');
    if (submit) {
      submit.disabled = locked;
      const surface = submit.closest('.account-disabled-hover');
      if (surface) surface.classList.toggle('is-locked', locked);
      submit.style.removeProperty('opacity');
      submit.style.removeProperty('cursor');
    }
  }

  function showMessage(box, message, type) {
    if (!box) return;
    box.hidden = false;
    box.className = 'account-message' + (type ? ' ' + type : '');
    box.textContent = message;
  }

  function cancelRequest(formType) {
    const request = activeRequests.get(formType);
    if (request) request.cancel();
  }

  window.jaResetEmailVerification = function (formType) {
    if (!Object.prototype.hasOwnProperty.call(verifiedEmails, formType)) return;
    cancelRequest(formType);
    verifiedEmails[formType] = '';
    setFormLocked(getForm(formType), true);
    const box = document.getElementById(FORM_CONFIG[formType].message);
    if (box) {
      box.textContent = '';
      box.hidden = true;
      box.className = 'account-message';
    }
  };

  // Used after account creation to clear credentials and lock their controls
  // while also updating the hover surface's prohibited cursor state.
  window.jaLockEmailVerificationForm = function (formType) {
    if (!Object.prototype.hasOwnProperty.call(verifiedEmails, formType)) return;
    cancelRequest(formType);
    verifiedEmails[formType] = '';
    setFormLocked(getForm(formType), true);
  };

  function verifyEmail(input, messageBox, formType) {
    const email = input.value.trim().toLowerCase();

    if (!email) {
      verifiedEmails[formType] = '';
      setFormLocked(getForm(formType), true);
      if (messageBox) messageBox.hidden = true;
      return;
    }

    if (!input.checkValidity()) {
      verifiedEmails[formType] = '';
      setFormLocked(getForm(formType), true);
      showMessage(messageBox, 'Please enter a valid email address.', 'error');
      return;
    }

    if (verifiedEmails[formType] === email) return;

    // One request per form; different forms may verify independently.
    if (activeRequests.has(formType)) return;

    const now = Date.now();
    const previous = lastRequestAt[email] || 0;
    const elapsed = now - previous;
    if (elapsed < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      showMessage(messageBox,
        'Please wait ' + remaining + ' second(s) before checking this email again.',
        'error');
      return;
    }

    lastRequestAt[email] = now;
    verifiedEmails[formType] = '';
    setFormLocked(getForm(formType), true);
    showMessage(messageBox, 'Verifying email…', '');

    const callbackName = 'jaEmailAuthorization_' + Date.now() + '_' +
      Math.floor(Math.random() * 1000000);
    const script = document.createElement('script');
    const params = new URLSearchParams({
      action: 'verifyEmail',
      email: email,
      callback: callbackName
    });

    let completed = false;
    let timeoutId = null;

    function cleanup() {
      if (completed) return;
      completed = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
      script.remove();
      delete window[callbackName];
      if (activeRequests.get(formType) === request) {
        activeRequests.delete(formType);
      }
    }

    const request = {
      cancel: function () {
        cleanup();
      }
    };

    activeRequests.set(formType, request);

    function isCurrentEmail() {
      return input.value.trim().toLowerCase() === email;
    }

    timeoutId = setTimeout(function () {
      cleanup();
      if (isCurrentEmail()) {
        window.jaLogAuthEvent('EMAIL_AUTHORIZATION_CHECK', 'FAILED', email, 'Verification timed out');
        setFormLocked(getForm(formType), true);
        showMessage(messageBox, 'Verification timed out. Please try again later.', 'error');
      }
    }, REQUEST_TIMEOUT_MS);

    window[callbackName] = function (result) {
      cleanup();
      if (!isCurrentEmail()) return;

      if (result && result.status === 'rate_limited') {
        window.jaLogAuthEvent('EMAIL_AUTHORIZATION_CHECK', 'BLOCKED', email, 'Rate limited');
        setFormLocked(getForm(formType), true);
        showMessage(messageBox,
          'Please wait ' + Number(result.retryAfter || 0) +
          ' second(s) before trying again.', 'error');
        return;
      }

      if (result && result.success === true && result.authorized === true) {
        window.jaLogAuthEvent('EMAIL_AUTHORIZATION_CHECK', 'SUCCESS', email, 'Email is authorized for ' + formType);
        verifiedEmails[formType] = email;
        setFormLocked(getForm(formType), false);
        showMessage(messageBox, 'Email authorized successfully.', 'success');
        return;
      }

      verifiedEmails[formType] = '';
      setFormLocked(getForm(formType), true);

      if (result && result.success === true && result.authorized === false) {
        window.jaLogAuthEvent(formType === 'signup' ? 'SET_PASSWORD' : 'AUTHORIZATION', 'BLOCKED', email, 'Email is not on the authorized allowlist');
        showMessage(messageBox,
          'This email ID ' + email +
          ' is not authorized. Please contact consult@jupiterastrology108.com for authorization.',
          'error');
      } else {
        showMessage(messageBox, 'Unable to verify email. Please try again later.', 'error');
      }
    };

    script.onerror = function () {
      cleanup();
      if (!isCurrentEmail()) return;
      window.jaLogAuthEvent('EMAIL_AUTHORIZATION_CHECK', 'FAILED', email, 'Verification request failed');
      setFormLocked(getForm(formType), true);
      showMessage(messageBox,
        'Verification request failed. Please try again later.', 'error');
    };

    script.src = AUTH_CHECK_URL + '?' + params.toString();
    document.body.appendChild(script);
  }

  const forms = [
    { type: 'login', input: 'loginEmail' },
    { type: 'signup', input: 'signupEmail' },
    { type: 'forgot', input: 'resetPasswordEmail' }
  ];

  forms.forEach(function (item) {
    const input = document.getElementById(item.input);
    const form = getForm(item.type);
    const message = document.getElementById(FORM_CONFIG[item.type].message);
    if (!input || !form || !message) {
      console.error('Email authorization elements missing for:', item.type);
      return;
    }

    setFormLocked(form, true);

    input.addEventListener('blur', function () {
      verifyEmail(input, message, item.type);
    });

    input.addEventListener('input', function () {
      cancelRequest(item.type);
      verifiedEmails[item.type] = '';
      setFormLocked(form, true);
      message.hidden = true;
      message.textContent = '';
      message.className = 'account-message';
    });

    // Capture phase prevents any downstream submit handler from running
    // unless the currently entered email matches a successful allowlist check.
    form.addEventListener('submit', function (event) {
      const currentEmail = input.value.trim().toLowerCase();
      if (!currentEmail || currentEmail !== verifiedEmails[item.type]) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showMessage(message,
          'Please verify your email address before proceeding.', 'error');
      }
    }, true);
  });
})();
