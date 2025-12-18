import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-drive',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Drive not connected');
  }
  return accessToken;
}

async function getUncachableGoogleDriveClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

async function uploadFileToDrive(filePath: string, fileName?: string): Promise<{ fileId: string; webViewLink: string }> {
  const drive = await getUncachableGoogleDriveClient();
  
  const actualFileName = fileName || path.basename(filePath);
  
  const fileMetadata = {
    name: actualFileName,
  };
  
  const media = {
    mimeType: 'application/zip',
    body: fs.createReadStream(filePath),
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, webViewLink',
  });

  return {
    fileId: response.data.id || '',
    webViewLink: response.data.webViewLink || '',
  };
}

async function main() {
  try {
    const zipPath = './smash-brothers-app.zip';
    
    if (!fs.existsSync(zipPath)) {
      console.error('Zip file not found at:', zipPath);
      process.exit(1);
    }
    
    console.log('Uploading smash-brothers-app.zip to Google Drive...');
    const result = await uploadFileToDrive(zipPath, 'smash-brothers-app-backup-2025-12-18.zip');
    console.log('✅ Upload successful!');
    console.log('File ID:', result.fileId);
    console.log('View Link:', result.webViewLink);
  } catch (error) {
    console.error('Upload failed:', error);
    process.exit(1);
  }
}

main();
