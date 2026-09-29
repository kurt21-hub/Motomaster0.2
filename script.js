function loadMotoMasterSecurityGuard() {
  if (window.MotoMasterSecurityGuard) {
    window.MotoMasterSecurityGuard.init();
    return;
  }

  if (document.querySelector('script[data-motomaster-security="true"]')) {
    return;
  }

  const guardScript = document.createElement('script');
  guardScript.src = 'js/security-guard.js';
  guardScript.defer = true;
  guardScript.dataset.motomasterSecurity = 'true';
  guardScript.onload = () => window.MotoMasterSecurityGuard && window.MotoMasterSecurityGuard.init();
  document.head.appendChild(guardScript);
}

loadMotoMasterSecurityGuard();

// Toggles the visibility of the password input field
function togglePwd() {
  const pwdInput = document.getElementById('password');

  if (pwdInput.type === 'password') {
    pwdInput.type = 'text';
  } else {
    pwdInput.type = 'password';
  }
}

// Handles the Sign In button click
function handleSignIn() {
  const usernameValue = document.getElementById('username').value;
  const passwordValue = document.getElementById('password').value;

  if (usernameValue.trim() !== '' && passwordValue.trim() !== '') {
    alert(`Welcome back to MotoMaster, ${usernameValue}!`);
    // Add your real authentication logic here later
  } else {
    alert('Please enter both a username and a password.');
  }
}
document.addEventListener('DOMContentLoaded', () => {
  // Select elements
  const showPwdCheckbox = document.getElementById('showPwd');
  const pwdInput = document.getElementById('regPassword');
  const confirmInput = document.getElementById('confirmPassword');
  const signupBtn = document.getElementById('signupBtn');
  const googleBtn = document.getElementById('googleBtn');

  // Toggle Password Visibility
  showPwdCheckbox.addEventListener('change', () => {
    const type = showPwdCheckbox.checked ? 'text' : 'password';
    pwdInput.type = type;
    confirmInput.type = type;
  });

  // Handle Sign Up Logic
  const handleSignUp = () => {
    const username = document.getElementById('regUsername').value;
    const password = pwdInput.value;
    const confirm = confirmInput.value;

    if (!username || !password) {
      alert('Please fill in all fields.');
      return;
    }

    if (password !== confirm) {
      alert('Passwords do not match!');
      return;
    }

    console.log('Signing up user:', username);
    // Add your API call here
  };

  // Handle Google Auth
  const handleGoogle = () => {
    console.log('Redirecting to Google auth...');
    // Add your Google OAuth logic here
  };

  // Attach Listeners
  signupBtn.addEventListener('click', handleSignUp);
  googleBtn.addEventListener('click', handleGoogle);
});