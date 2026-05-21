// Script to create a Firebase test user via REST API
const API_KEY = 'AIzaSyAL9VnbMHttdC6lA-X3hWOQIp5KzTmc_Rw';
const email = 'playwright.test@familytree.dev';
const password = 'PlaywrightTest123!';

async function createOrGetUser() {
  // Try sign-up first
  let res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  let data = await res.json();

  if (data.error?.message === 'EMAIL_EXISTS') {
    // Already exists — sign in instead
    res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );
    data = await res.json();
  }

  if (data.error) {
    console.error('Firebase error:', JSON.stringify(data.error));
    process.exit(1);
  }

  console.log('UID:', data.localId);
  console.log('TOKEN:', data.idToken.slice(0, 40) + '...');
  console.log('EMAIL:', data.email);
}

createOrGetUser();
