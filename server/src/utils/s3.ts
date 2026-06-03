import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { logger } from './logger.js';
import dotenv from 'dotenv';

dotenv.config();

const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  AWS_S3_BUCKET
} = process.env;

let s3Client: S3Client | null = null;

if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && AWS_REGION) {
  s3Client = new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY
    }
  });
  logger.info('AWS S3 Client Initialized successfully');
} else {
  logger.warn('AWS credentials not fully configured in environment. File uploads will fall back to SharePoint (ES-HRMS).');
}

// Memory cache for SharePoint Site and Drive IDs
let cachedSiteId: string | null = null;
let cachedDriveId: string | null = null;

const getSharePointDriveId = async (token: string): Promise<string> => {
  if (cachedDriveId) return cachedDriveId;

  // 1. Search for the SharePoint Site named "ES-HRMS"
  const searchUrl = `https://graph.microsoft.com/v1.0/sites?search=ES-HRMS`;
  const searchRes = await fetch(searchUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!searchRes.ok) {
    const searchErr = await searchRes.text();
    throw new Error(`SharePoint site search failed: ${searchRes.statusText} - ${searchErr}`);
  }

  const searchData = await searchRes.json() as { value: { id: string; name: string }[] };
  // Find the exact match or first match for ES-HRMS
  const site = searchData.value.find(s => s.name === 'ES-HRMS') || searchData.value[0];
  if (!site) {
    throw new Error('SharePoint site "ES-HRMS" not found. Please create the site first.');
  }

  cachedSiteId = site.id;

  // 2. Fetch the default drive of this site
  const driveUrl = `https://graph.microsoft.com/v1.0/sites/${cachedSiteId}/drive`;
  const driveRes = await fetch(driveUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!driveRes.ok) {
    const driveErr = await driveRes.text();
    throw new Error(`SharePoint drive retrieval failed: ${driveRes.statusText} - ${driveErr}`);
  }

  const driveData = await driveRes.json() as { id: string };
  cachedDriveId = driveData.id;

  return cachedDriveId;
};

/**
 * Uploads a file buffer to S3, falling back to SharePoint ES-HRMS drive (via Graph API) if S3 credentials are not set.
 */
export const uploadFileToS3 = async (
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  orgId?: string,
  userEmail?: string
): Promise<string> => {
  if (s3Client && AWS_S3_BUCKET && AWS_REGION) {
    try {
      const uniqueFileName = `${Date.now()}-${fileName.replace(/\s+/g, '_')}`;
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: AWS_S3_BUCKET,
          Key: `documents/${uniqueFileName}`,
          Body: fileBuffer,
          ContentType: mimeType,
        }
      });
      await upload.done();
      return `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/documents/${uniqueFileName}`;
    } catch (error) {
      logger.error('S3 upload error, falling back to SharePoint:', error);
    }
  }

  // Fallback to Microsoft SharePoint via Graph API
  try {
    const { getMicrosoftAccessToken } = await import('../services/tokenService.js');
    const { OrganizationAuthConfig } = await import('../models/OrganizationAuthConfig.js');
    const { Organization } = await import('../models/Organization.js');

    let tenantId = process.env.TENANT_ID;
    let clientId = process.env.CLIENT_ID;
    let clientSecret = process.env.CLIENT_SECRET;

    if (orgId) {
      const msConfig = await OrganizationAuthConfig.findOne({
        organizationId: orgId,
        provider: 'MICROSOFT',
        isEnabled: true,
      });
      if (msConfig) {
        tenantId = msConfig.tenantId || tenantId;
        clientId = msConfig.clientId || clientId;
        clientSecret = msConfig.clientSecret || clientSecret;
      }
    }

    const token = await getMicrosoftAccessToken('https://graph.microsoft.com/.default', {
      tenantId: tenantId!,
      clientId: clientId!,
      clientSecret: clientSecret!,
    });

    const driveId = await getSharePointDriveId(token);

    // Determine target SharePoint folder based on naming/type
    let folder = 'Documents';
    const nameLower = fileName.toLowerCase();
    
    if (mimeType.startsWith('image/')) {
      folder = 'Employees';
    } else if (nameLower.includes('resume')) {
      folder = 'Resumes';
    } else if (nameLower.includes('offerletter') || nameLower.includes('offer_letter') || nameLower.includes('offer')) {
      folder = 'OfferLetters';
    } else if (nameLower.includes('payslip')) {
      folder = 'Payslips';
    } else if (nameLower.includes('attendance')) {
      folder = 'AttendanceReports';
    } else if (nameLower.includes('policy')) {
      folder = 'CompanyPolicies';
    }

    const uniqueFileName = `${Date.now()}-${fileName.replace(/\s+/g, '_')}`;
    const uploadUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${folder}/${uniqueFileName}:/content`;
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': mimeType,
      },
      body: fileBuffer as any,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`SharePoint upload PUT request failed: ${uploadResponse.statusText} - ${errorText}`);
    }

    const fileItem = await uploadResponse.json() as { id: string; name: string; webUrl: string; '@microsoft.graph.downloadUrl'?: string };
    const itemId = fileItem.id;

    // Create sharing link
    let webUrl = '';
    try {
      const createLinkUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/createLink`;
      let linkResponse = await fetch(createLinkUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'view',
          scope: 'anonymous',
        }),
      });

      // Fallback to organization scope if anonymous scope sharing is disabled by site policy
      if (!linkResponse.ok) {
        logger.warn('[SharePoint Upload] Anonymous links disabled. Falling back to organization view link.');
        linkResponse = await fetch(createLinkUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'view',
            scope: 'organization',
          }),
        });
      }

      if (linkResponse.ok) {
        const linkResult = await linkResponse.json() as { link: { webUrl: string } };
        webUrl = linkResult.link.webUrl;
      }
    } catch (linkErr: any) {
      logger.error('[SharePoint Upload] Failed to create sharing link:', linkErr.message);
    }

    if (webUrl) {
      // Convert sharing link to direct download link
      const base64Url = Buffer.from(webUrl).toString('base64');
      const shareId = base64Url.replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-');
      const directUrl = `https://api.microsoft.com/v1.0/shares/u!${shareId}/root/content`;
      logger.info(`[SharePoint Upload] Successfully uploaded and created direct link: ${directUrl}`);
      return directUrl;
    } else {
      // Hard fallback if all sharing is blocked
      const fallbackUrl = fileItem['@microsoft.graph.downloadUrl'] || fileItem.webUrl;
      logger.info(`[SharePoint Upload] Fallback direct link used: ${fallbackUrl}`);
      return fallbackUrl;
    }
  } catch (spError: any) {
    logger.error('SharePoint fallback upload failed:', spError);
    throw new Error(`Upload failed: ${spError.message || spError}`, { cause: spError });
  }
};

/**
 * Fetches a file buffer from a URL, automatically handling authenticated private S3 downloads
 * or fallback HTTP fetch (with User-Agent headers) for SharePoint/OneDrive public URLs.
 */
export const fetchFileBuffer = async (fileUrl: string): Promise<Buffer> => {
  if (s3Client && AWS_S3_BUCKET && fileUrl.includes('amazonaws.com')) {
    try {
      const url = new URL(fileUrl);
      const key = decodeURIComponent(url.pathname.substring(1));
      
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: key
      }));

      const streamToBuffer = async (stream: any): Promise<Buffer> => {
        return new Promise((resolve, reject) => {
          const chunks: any[] = [];
          stream.on('data', (chunk: any) => chunks.push(chunk));
          stream.on('error', reject);
          stream.on('end', () => resolve(Buffer.concat(chunks)));
        });
      };

      if (response.Body) {
        logger.info(`[S3 Fetch] Successfully fetched private S3 file buffer for key: ${key}`);
        return await streamToBuffer(response.Body);
      }
    } catch (s3Error: any) {
      logger.error('[S3 Fetch] Failed to download securely from S3, falling back to HTTP fetch', { error: s3Error.message });
    }
  }

  // HTTP Fetch fallback
  logger.info(`[HTTP Fetch] Downloading file via standard GET request: ${fileUrl}`);
  const response = await fetch(fileUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`Status ${response.status} (${response.statusText || 'Unauthorized'})`);
  }
  
  return Buffer.from(await response.arrayBuffer());
};
