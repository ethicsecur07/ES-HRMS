"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTOTPSecret = generateTOTPSecret;
exports.verifyTOTP = verifyTOTP;
const crypto_1 = __importDefault(require("crypto"));
function base32Decode(base32) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = base32.toUpperCase().replace(/=+$/, '');
    let bits = '';
    for (let i = 0; i < clean.length; i++) {
        const val = alphabet.indexOf(clean[i]);
        if (val === -1)
            throw new Error('Invalid base32 character');
        bits += val.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.substring(i, i + 8), 2));
    }
    return Buffer.from(bytes);
}
function generateHOTP(secretBuffer, counter) {
    const buffer = Buffer.alloc(8);
    const high = Math.floor(counter / 0x100000000);
    const low = counter % 0x100000000;
    buffer.writeUInt32BE(high, 0);
    buffer.writeUInt32BE(low, 4);
    const hmac = crypto_1.default.createHmac('sha1', secretBuffer);
    hmac.update(buffer);
    const hmacResult = hmac.digest();
    const offset = hmacResult[hmacResult.length - 1] & 0xf;
    const binary = ((hmacResult[offset] & 0x7f) << 24) |
        ((hmacResult[offset + 1] & 0xff) << 16) |
        ((hmacResult[offset + 2] & 0xff) << 8) |
        (hmacResult[offset + 3] & 0xff);
    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
}
function generateTOTPSecret(email, issuer = 'Antigravity ERP') {
    const bytes = crypto_1.default.randomBytes(10); // 80 bits is standard for TOTP secrets
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
function verifyTOTP(secret, code) {
    try {
        const secretBuffer = base32Decode(secret);
        const counter = Math.floor(Date.now() / 1000 / 30);
        // Allow window of 1 step before/after (30s)
        for (let step = -1; step <= 1; step++) {
            if (generateHOTP(secretBuffer, counter + step) === code) {
                return true;
            }
        }
    }
    catch (error) {
        console.error('TOTP verification error:', error);
    }
    return false;
}
