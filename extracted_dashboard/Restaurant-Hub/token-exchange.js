import { google } from 'googleapis';
import readline from 'readline';

const CLIENT_ID = '780286917028-oob46sbv8tpta9jcd5dr7i7gaj1f6qgl.apps.googleusercontent.com';
const CLIENT_SECRET = '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';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('Enter the authorization code you received:');

rl.question('Authorization code: ', async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('');
    console.log('✅ Success! Your Gmail API credentials:');
    console.log('');
    console.log('GOOGLE_CLIENT_ID=' + CLIENT_ID);
    console.log('GOOGLE_CLIENT_SECRET=' + CLIENT_SECRET);
    console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token);
    console.log('');
    console.log('Provide these three values as secrets to enable email notifications.');
    
  } catch (error) {
    console.error('❌ Error exchanging code for tokens:', error.message);
  }
  
  rl.close();
});