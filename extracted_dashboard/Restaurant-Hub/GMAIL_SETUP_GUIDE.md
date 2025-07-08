# Gmail API Setup Guide

## Step 1: Get Your OAuth Credentials

Go to [Google Cloud Console](https://console.cloud.google.com/):
1. Select your project
2. Navigate to **APIs & Services** > **Credentials**
3. Find your OAuth 2.0 Client ID (or create one if needed)
4. Copy the **Client ID** and **Client Secret**

## Step 2: Generate Refresh Token

### Option A: Using OAuth Playground (Recommended)
1. Go to [Google OAuth Playground](https://developers.google.com/oauthplayground/)
2. Click the gear icon (⚙️) in the top right
3. Check "Use your own OAuth credentials"
4. Enter your **Client ID** and **Client Secret**
5. In the left panel, find "Gmail API v1" and select:
   - `https://www.googleapis.com/auth/gmail.send`
6. Click "Authorize APIs"
7. Sign in with your Google account
8. Click "Exchange authorization code for tokens"
9. Copy the **Refresh Token** from the response

### Option B: Using the Helper Script
1. Update `oauth-helper.js` with your credentials:
   ```javascript
   const CLIENT_ID = 'your-client-id-here';
   const CLIENT_SECRET = 'your-client-secret-here';
   ```
2. Run: `node oauth-helper.js`
3. Visit the printed URL and authorize
4. Copy the authorization code back to the terminal
5. Copy the generated refresh token

## Step 3: Add to Environment Variables

Add these three variables to your system:
```
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REFRESH_TOKEN=your-refresh-token-here
```

## Step 4: Test the System

Once configured, the restaurant management system will:
- ✅ Use Gmail API as the primary email service
- ✅ Send professional HTML emails with receipt attachments
- ✅ Fall back to SendGrid if Gmail API fails
- ✅ Fall back to Gmail SMTP if both above fail

## Email Delivery Priority:
1. **Gmail API** (most reliable, recommended)
2. **SendGrid** (professional service, requires API key)
3. **Gmail SMTP** (basic fallback, current authentication issues)

Your daily stock and sales reports will be sent automatically with proper formatting and receipt attachments.