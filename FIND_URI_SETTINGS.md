# How to Find OAuth URI Settings in Google Cloud Console

## Step-by-Step Navigation

### 1. Go to Google Cloud Console
- Visit: https://console.cloud.google.com/
- Make sure you're in the correct project

### 2. Navigate to APIs & Services
- In the left sidebar, click **"APIs & Services"**
- Then click **"Credentials"**

### 3. Find Your OAuth Client ID
- Look for a section called **"OAuth 2.0 Client IDs"**
- You should see an entry with your Client ID: `780286917028-oob46sbv8tpta9jcd5dr7i7gaj1f6qgl.apps.googleusercontent.com`
- Click on the **name** of this OAuth client (it might be called something like "Web client 1" or similar)

### 4. Edit the OAuth Client
- Once you click on it, you'll see a page with OAuth client details
- Look for a section called **"Authorized redirect URIs"**
- There should be an **"+ ADD URI"** button or an input field

### 5. Add the OAuth Playground URI
- Click **"+ ADD URI"** (or in the input field)
- Add: `https://developers.google.com/oauthplayground`
- Click **"Save"** at the bottom of the page

## If You Can't Find It

**Alternative Method - Create New OAuth Client:**
1. In the Credentials page, click **"+ CREATE CREDENTIALS"**
2. Select **"OAuth client ID"**
3. Choose **"Web application"**
4. In **"Authorized redirect URIs"**, add: `https://developers.google.com/oauthplayground`
5. Click **"Create"**
6. Use the new Client ID and Secret

## What You're Looking For

The page should have sections like:
- Client ID
- Client Secret
- **Authorized JavaScript origins** (optional)
- **Authorized redirect URIs** ← This is what you need to find

If you still can't find it, try searching for "OAuth" in the Google Cloud Console search bar at the top.