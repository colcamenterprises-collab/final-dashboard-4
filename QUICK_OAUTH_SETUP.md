# Quick Gmail API Setup

## Fix the OAuth Error First

**Step 1: Add Redirect URI to Google Cloud Console**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **Credentials** 
3. Click on your OAuth Client ID: `780286917028-oob46sbv8tpta9jcd5dr7i7gaj1f6qgl.apps.googleusercontent.com`
4. In **Authorized redirect URIs**, add: `https://developers.google.com/oauthplayground`
5. Click **Save**

## Get Your Refresh Token

**Step 2: Use OAuth Playground**
1. Go to: https://developers.google.com/oauthplayground/
2. Click the gear icon (⚙️) in the top right
3. Check "Use your own OAuth credentials"
4. Enter:
   - **OAuth Client ID:** `780286917028-oob46sbv8tpta9jcd5dr7i7gaj1f6qgl.apps.googleusercontent.com`
   - **OAuth Client Secret:** `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`
5. In the left panel, find "Gmail API v1" and select:
   - `https://www.googleapis.com/auth/gmail.send`
6. Click "Authorize APIs"
7. Sign in with colcamenterprises@gmail.com
8. Click "Allow" 
9. Click "Exchange authorization code for tokens"
10. **Copy the Refresh Token** (starts with `1//`)

## Alternative: Manual Authorization URL

If the OAuth Playground doesn't work, use this direct URL:

**Authorization URL:**
```
https://accounts.google.com/o/oauth2/auth?response_type=code&client_id=780286917028-oob46sbv8tpta9jcd5dr7i7gaj1f6qgl.apps.googleusercontent.com&redirect_uri=https://developers.google.com/oauthplayground&scope=https://www.googleapis.com/auth/gmail.send&access_type=offline&prompt=consent
```

1. Visit the URL above
2. Sign in and authorize
3. You'll get an authorization code
4. I'll help you exchange it for the refresh token

Once you have the refresh token, provide it and the email system will work immediately!