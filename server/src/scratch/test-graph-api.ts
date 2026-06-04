import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { getOneDriveAccessToken } from '../utils/onedrive.js';

dotenv.config();

const testGraph = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    const orgId = '6a1ed6b76cd721e1f9d4e96c'; // ethicsecur organization ID
    
    console.log('Retrieving Microsoft Graph Access Token...');
    const accessToken = await getOneDriveAccessToken(orgId);
    console.log('Access token obtained.');

    const usersToTest = ['official@ethicsecur.co.in', 'abiramip@ethicsecur.co.in'];

    for (const email of usersToTest) {
      console.log(`\n--------------------------------------------`);
      console.log(`Testing drive access for user: ${email}...`);
      
      const driveUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/drive`;
      const res = await fetch(driveUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      });

      console.log(`GET /users/${email}/drive status: ${res.status} (${res.statusText})`);
      const body = await res.json();
      
      if (!res.ok) {
        console.error(`Error details for ${email}:`, JSON.stringify(body, null, 2));
      } else {
        console.log(`Success! Drive ID: ${body.id}`);
        console.log(`Drive Type: ${body.driveType}`);
        console.log(`Owner: ${JSON.stringify(body.owner)}`);

        // Test writing a dummy file
        console.log(`Testing file upload for ${email}...`);
        const uploadUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/drive/root:/uploads/test_test.txt:/content`;
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'text/plain',
          },
          body: 'Hello from HRMS diagnostics!',
        });

        console.log(`PUT upload status: ${uploadRes.status} (${uploadRes.statusText})`);
        const uploadBody = await uploadRes.json();
        if (!uploadRes.ok) {
          console.error(`Upload error details:`, JSON.stringify(uploadBody, null, 2));
        } else {
          console.log(`Upload success! File ID: ${uploadBody.id}, Web URL: ${uploadBody.webUrl}`);
          
          // Test sharing link creation
          console.log(`Testing link generation for file ID ${uploadBody.id}...`);
          const shareUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/drive/items/${uploadBody.id}/createLink`;
          const shareRes = await fetch(shareUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'view',
              scope: 'anonymous',
            }),
          });

          console.log(`POST createLink status: ${shareRes.status} (${shareRes.statusText})`);
          const shareBody = await shareRes.json();
          if (!shareRes.ok) {
            console.error(`Link creation error details:`, JSON.stringify(shareBody, null, 2));
          } else {
            console.log(`Link creation success! Share URL: ${shareBody.link.webUrl}`);
          }
        }
      }
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Diagnostic run failed:', error);
  }
};

testGraph();
