/* =========================================================
   JUPITER ASTRO — ACCOUNT FORM VALIDATION
   Local email-format validation only. No remote authorization.
   Firebase sign-in is the access gate for protected features.
   ========================================================= */

(function () {
  'use strict';

  const FORM_CONFIG = {
    login: { form: 'signInForm', email: 'loginEmail', message: 'loginMessage' },
    signup: { form: 'signUpForm', email: 'signupEmail', message: 'signupMessage' },
    forgot: { form: 'forgotPasswordForm', email: 'resetPasswordEmail', message: 'forgotPasswordMessage' }
  };

  function getConfig(type) {
    return Object.prototype.hasOwnProperty.call(FORM_CONFIG, type)
      ? FORM_CONFIG[type]
      : null;
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
    }
  }

  function syncForm(type, showError) {
    const config = getConfig(type);
    if (!config) return false;
    const form = document.getElementById(config.form);
    const email = document.getElementById(config.email);
    const message = document.getElementById(config.message);
    if (!form || !email) return false;

    const valid = email.value.trim() !== '' && email.checkValidity();
    setFormLocked(form, !valid);

    if (valid && message && message.classList.contains('email-format-error')) {
      message.hidden = true;
      message.textContent = '';
      message.className = 'account-message';
    } else if (!valid && showError && email.value.trim() !== '') {
      if (message) {
        message.hidden = false;
        message.className = 'account-message error email-format-error';
        message.textContent = 'Please enter a valid email address.';
      }
    }
    return valid;
  }

  // Compatibility hooks used by Account.js; they now operate locally only.
  window.jaResetEmailVerification = function (type) {
    const config = getConfig(type);
    if (!config) return;
    const message = document.getElementById(config.message);
    if (message && message.classList.contains('email-format-error')) {
      message.hidden = true;
      message.textContent = '';
      message.className = 'account-message';
    }
    syncForm(type, false);
  };

  window.jaLockEmailVerificationForm = function (type) {
    const config = getConfig(type);
    if (config) setFormLocked(document.getElementById(config.form), true);
  };

  Object.keys(FORM_CONFIG).forEach(function (type) {
    const config = FORM_CONFIG[type];
    const form = document.getElementById(config.form);
    const email = document.getElementById(config.email);
    if (!form || !email) {
      console.warn('Account form elements missing for:', type);
      return;
    }

    setFormLocked(form, true);
    email.addEventListener('input', function () { syncForm(type, false); });
    email.addEventListener('blur', function () { syncForm(type, true); });

    form.addEventListener('submit', function (event) {
      if (!syncForm(type, true)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        email.focus();
      }
    }, true);
  });
})();
