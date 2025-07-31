# Quick OAuth Setup Steps

## Current Issue
Your Gmail App Password authentication is failing. Let's try OAuth instead.

## Step 1: Add Test User to Google Cloud
1. Go to https://console.cloud.google.com/
2. Select your project: **SmashBrothersDashboard**
3. Navigate to **APIs & Services** > **OAuth consent screen**
4. Scroll down to **"Test users"** section
5. Click **"+ ADD USERS"**
6. Enter: `colcamenterprises@gmail.com`
7. Click **"Save"**

## Step 2: Try Authorization Again
After adding the test user, try this URL:
```
https://accounts.google.com/o/oauth2/auth?response_type=code&client_id=780286917028-oob46sbv8tpta9jcd5dr7i7gaj1f6qgl.apps.googleusercontent.com&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=https://www.googleapis.com/auth/gmail.send&access_type=offline&prompt=consent
```

## Alternative: Check App Password
Your app password might have expired or have issues. You can:
1. Go to Google Account settings
2. Security > App passwords
3. Delete the old "Restaurant Dashboard" app password
4. Create a new one with the same name
5. Update the password in your system

## Why OAuth is Better
- More secure than app passwords
- No password expiration issues
- Better for automated systems
- Proper authentication flow