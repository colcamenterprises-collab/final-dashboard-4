const { google } = require('googleapis');
const readline = require('readline');

// You'll need to replace these with your actual credentials
const CLIENT_ID = 'YOUR_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = 'http://localhost:3000/oauth/callback';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Generate the auth URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/gmail.send'],
});

console.log('=== Google OAuth Setup for Gmail API ===');
console.log('');
console.log('1. Replace CLIENT_ID and CLIENT_SECRET in this file with your actual credentials');
console.log('2. Run this script: node oauth-helper.js');
console.log('3. Visit the authorization URL printed below');
console.log('4. Copy the authorization code and paste it when prompted');
console.log('5. The script will generate your REFRESH_TOKEN');
console.log('');
console.log('Authorization URL:');
console.log(authUrl);
console.log('');

if (CLIENT_ID === 'YOUR_CLIENT_ID') {
  console.log('❌ Please update CLIENT_ID and CLIENT_SECRET first!');
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter the authorization code from Google: ', async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('');
    console.log('✅ Success! Your credentials:');
    console.log('');
    console.log('GOOGLE_CLIENT_ID=' + CLIENT_ID);
    console.log('GOOGLE_CLIENT_SECRET=' + CLIENT_SECRET);
    console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token);
    console.log('');
    console.log('Add these to your .env file or provide them as secrets.');
    
  } catch (error) {
    console.error('❌ Error getting tokens:', error);
  }
  
  rl.close();
});