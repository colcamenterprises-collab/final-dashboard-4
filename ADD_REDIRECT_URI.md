# Add Redirect URI - You're Almost There!

## You're in the Right Place!

I can see you're in the OAuth client configuration page. Now you need to scroll down to find the redirect URI section.

## Next Steps:

1. **Scroll Down** on the page you're currently viewing
2. Look for a section called **"Authorized redirect URIs"**
3. You should see either:
   - An **"+ ADD URI"** button, OR
   - An input field with a **"+"** button next to it
4. Click the **"+ ADD URI"** button or **"+"** button
5. In the new input field, enter: `https://developers.google.com/oauthplayground`
6. Click **"Save"** at the bottom of the page

## What You're Looking For:

The section should look something like:
```
Authorized redirect URIs
+ ADD URI
[input field] https://developers.google.com/oauthplayground [+ button]
```

## If You Can't Find It:

If you don't see "Authorized redirect URIs" section, try:
1. Refresh the page
2. Or click the **"Edit"** button if you see one
3. The redirect URI section should be near the bottom of the form

Once you add the redirect URI and save, we can proceed with getting your refresh token!