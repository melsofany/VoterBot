import { google } from 'googleapis';
import vision from '@google-cloud/vision';

let sheetsClient: any = null;
let driveClient: any = null;
let visionClient: any = null;
let authClient: any = null;

export async function getGoogleAuth() {
  if (authClient) {
    return authClient;
  }

  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  
  if (!credentialsJson) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable is not set');
  }

  const credentials = JSON.parse(credentialsJson);

  authClient = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/cloud-vision'
    ],
  });

  return authClient;
}

export async function getSheetsClient() {
  if (sheetsClient) {
    return sheetsClient;
  }

  const auth = await getGoogleAuth();
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

export async function getDriveClient() {
  if (driveClient) {
    return driveClient;
  }

  const auth = await getGoogleAuth();
  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

export async function getVisionClient() {
  if (visionClient) {
    return visionClient;
  }

  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  
  if (!credentialsJson) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable is not set');
  }

  const credentials = JSON.parse(credentialsJson);

  visionClient = new vision.ImageAnnotatorClient({
    credentials,
  });

  return visionClient;
}
