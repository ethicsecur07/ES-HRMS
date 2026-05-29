import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (e) {
  console.error('Could not find .env file at:', envPath);
  process.exit(1);
}

const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
    env[key] = val;
  }
});

const { TENANT_ID, CLIENT_ID, CLIENT_SECRET, SMTP_USER } = env;

console.log('--- DIAGNOSTICS CONFIG ---');
console.log('TENANT_ID:', TENANT_ID);
console.log('CLIENT_ID:', CLIENT_ID);
console.log('SMTP_USER:', SMTP_USER);
console.log('--------------------------\n');

async function run() {
  try {
    console.log('Fetching Microsoft Graph Token...');
    const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);
    params.append('scope', 'https://graph.microsoft.com/.default');

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Token Fetch Failed:', res.status, text);
      return;
    }

    const data = await res.json();
    const token = data.access_token;
    console.log('Token successfully fetched!\n');

    // Decode JWT payload to see the roles (permissions) in the token!
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      console.log('--- TOKEN CLAIMS ---');
      console.log('App Display Name (app_displayname):', payload.app_displayname);
      console.log('Roles (Permissions):', payload.roles || 'NO ROLES FOUND! (No Application permissions are active in this token)');
      console.log('---------------------------------\n');
    }

    console.log(`Attempting Microsoft Graph API sendMail as ${SMTP_USER}...`);
    const sendMailPayload = {
      message: {
        subject: 'EthicSecur Mail Diagnostics Test',
        body: {
          contentType: 'Text',
          content: 'This is a test email sent during diagnostics verification.'
        },
        toRecipients: [
          {
            emailAddress: {
              address: SMTP_USER
            }
          }
        ]
      },
      saveToSentItems: 'false'
    };

    const graphUrl = `https://graph.microsoft.com/v1.0/users/${SMTP_USER}/sendMail`;
    const graphRes = await fetch(graphUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sendMailPayload)
    });

    if (graphRes.ok) {
      console.log('SUCCESS! Microsoft Graph API sent the email successfully!');
    } else {
      const text = await graphRes.text();
      console.error('FAILED! Microsoft Graph sendMail returned error:', graphRes.status, text);
    }
  } catch (err) {
    console.error('Diagnostic error:', err);
  }
}

run();
