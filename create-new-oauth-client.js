// Simple script to generate the correct OAuth URL with your credentials
const CLIENT_ID = '780286917028-oob46sbv8tpta9jcd5dr7i7gaj1f6qgl.apps.googleusercontent.com';

console.log('=== Gmail API Setup - Alternative Method ===');
console.log('');
console.log('Since your current OAuth client might not have redirect URIs configured,');
console.log('try this direct authorization URL:');
console.log('');
console.log('STEP 1: Copy this URL and paste it in your browser:');
console.log('');
console.log(`https://accounts.google.com/o/oauth2/auth?response_type=code&client_id=${CLIENT_ID}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=https://www.googleapis.com/auth/gmail.send&access_type=offline&prompt=consent`);
console.log('');
console.log('STEP 2: Sign in with colcamenterprises@gmail.com');
console.log('STEP 3: Click "Allow" to grant Gmail send permissions');
console.log('STEP 4: Copy the authorization code that appears');
console.log('STEP 5: Provide the authorization code to exchange for refresh token');
console.log('');
console.log('This method uses "urn:ietf:wg:oauth:2.0:oob" which should work without');
console.log('configuring redirect URIs in your Google Cloud Console.');