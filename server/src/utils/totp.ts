import crypto from 'crypto';

function base32Decode(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = base32.toUpperCase().replace(/=+$/, '');
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) throw new Error('Invalid base32 character');
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateHOTP(secretBuffer: Buffer, counter: number): string {
  const buffer = Buffer.alloc(8);
  const high = Math.floor(counter / 0x100000000);
  const low = counter % 0x100000000;
  buffer.writeUInt32BE(high, 0);
  buffer.writeUInt32BE(low, 4);

  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(buffer);
  const hmacResult = hmac.digest();

  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const binary =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

export function generateTOTPSecret(email: string, issuer: string = 'Antigravity ERP'): { secret: string; otpauthUrl: string } {
  const bytes = crypto.randomBytes(10); // 80 bits is standard for TOTP secrets
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < bytes.length; i++) {
    secret += alphabet[bytes[i] % 32];
  }
  const encodedEmail = encodeURIComponent(email);
  const encodedIssuer = encodeURIComponent(issuer);
  return {
    secret,
    otpauthUrl: `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}`,
  };
}

export function verifyTOTP(secret: string, code: string): boolean {
  try {
    const secretBuffer = base32Decode(secret);
    const counter = Math.floor(Date.now() / 1000 / 30);
    // Allow window of 1 step before/after (30s)
    for (let step = -1; step <= 1; step++) {
      if (generateHOTP(secretBuffer, counter + step) === code) {
        return true;
      }
    }
  } catch (error) {
    console.error('TOTP verification error:', error);
  }
  return false;
}
