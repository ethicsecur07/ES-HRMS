"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MFAService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const MFAConfig_js_1 = require("../models/MFAConfig.js");
/**
 * MFAService
 * Handles multi-factor authentication setup, verification, and recovery.
 */
class MFAService {
    /**
     * Set up MFA for a user. Generates TOTP secret and recovery codes.
     */
    static async setupMFA(userId, organizationId, method = 'TOTP') {
        const config = await MFAConfig_js_1.MFAConfig.findOne({ userId, organizationId });
        const recoveryCodes = this.generateRecoveryCodes(8);
        const totpSecret = method === 'TOTP' ? this.generateTOTPSecret() : undefined;
        if (config) {
            config.methods = Array.from(new Set([...config.methods, method]));
            config.primaryMethod = method;
            if (totpSecret)
                config.totpSecret = totpSecret;
            config.recoveryCodes = recoveryCodes;
            config.recoveryCodesUsed = [];
            await config.save();
        }
        else {
            await MFAConfig_js_1.MFAConfig.create({
                userId,
                organizationId,
                isEnabled: false, // not enabled until verified
                methods: [method],
                primaryMethod: method,
                totpSecret,
                recoveryCodes,
                recoveryCodesUsed: [],
            });
        }
        return {
            secret: totpSecret,
            recoveryCodes,
            qrData: totpSecret
                ? `otpauth://totp/HRMS:user?secret=${totpSecret}&issuer=ES-HRMS&algorithm=SHA1&digits=6&period=30`
                : undefined,
        };
    }
    /**
     * Verify a TOTP code and enable MFA if first-time verification.
     */
    static async verifyTOTP(userId, organizationId, code) {
        const config = await MFAConfig_js_1.MFAConfig.findOne({ userId, organizationId }).select('+totpSecret');
        if (!config || !config.totpSecret) {
            return false;
        }
        const isValid = this.validateTOTPCode(config.totpSecret, code);
        if (isValid) {
            config.totpVerified = true;
            config.isEnabled = true;
            config.lastVerifiedAt = new Date();
            await config.save();
        }
        return isValid;
    }
    /**
     * Verify an MFA code (dispatches to correct method).
     */
    static async verify(userId, organizationId, code, method) {
        const config = await MFAConfig_js_1.MFAConfig.findOne({ userId, organizationId });
        if (!config || !config.isEnabled) {
            return true; // MFA not enabled, pass through
        }
        const activeMethod = method || config.primaryMethod;
        switch (activeMethod) {
            case 'TOTP':
                return this.verifyTOTP(userId, organizationId, code);
            case 'EMAIL':
                // Email OTP verification would be handled by a separate email OTP store
                return this.verifyEmailOTP(userId, code);
            case 'SMS':
                // SMS OTP verification would be handled by SMS service
                return this.verifySMSOTP(userId, code);
            default:
                return false;
        }
    }
    /**
     * Verify a recovery code (one-time use).
     */
    static async verifyRecoveryCode(userId, organizationId, code) {
        const config = await MFAConfig_js_1.MFAConfig.findOne({ userId, organizationId }).select('+recoveryCodes');
        if (!config)
            return false;
        const normalizedCode = code.trim().toUpperCase();
        const codeIndex = config.recoveryCodes.indexOf(normalizedCode);
        if (codeIndex === -1)
            return false;
        if (config.recoveryCodesUsed.includes(normalizedCode))
            return false;
        // Mark code as used
        config.recoveryCodesUsed.push(normalizedCode);
        config.recoveryCodes.splice(codeIndex, 1);
        config.lastVerifiedAt = new Date();
        await config.save();
        return true;
    }
    /**
     * Check if MFA is required for a user.
     */
    static async isRequired(userId, organizationId) {
        const config = await MFAConfig_js_1.MFAConfig.findOne({ userId, organizationId });
        return config?.isEnabled === true;
    }
    /**
     * Disable MFA for a user (admin action).
     */
    static async disableMFA(userId, organizationId) {
        await MFAConfig_js_1.MFAConfig.findOneAndUpdate({ userId, organizationId }, { isEnabled: false, totpVerified: false });
    }
    /**
     * Get MFA status for a user.
     */
    static async getStatus(userId, organizationId) {
        const config = await MFAConfig_js_1.MFAConfig.findOne({ userId, organizationId });
        if (!config)
            return null;
        return {
            isEnabled: config.isEnabled,
            methods: config.methods,
            primaryMethod: config.primaryMethod,
            totpVerified: config.totpVerified,
            recoveryCodesRemaining: config.recoveryCodes.length,
        };
    }
    // ---- Private Helpers ----
    static generateTOTPSecret() {
        // Generate a base32-encoded secret
        const buffer = crypto_1.default.randomBytes(20);
        return this.base32Encode(buffer);
    }
    static generateRecoveryCodes(count) {
        const codes = [];
        for (let i = 0; i < count; i++) {
            const code = crypto_1.default.randomBytes(4).toString('hex').toUpperCase();
            codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
        }
        return codes;
    }
    static validateTOTPCode(secret, code) {
        // TOTP validation using HMAC-SHA1
        const time = Math.floor(Date.now() / 30000); // 30-second window
        const buffer = Buffer.alloc(8);
        buffer.writeBigUInt64BE(BigInt(time));
        const decodedSecret = this.base32Decode(secret);
        const hmac = crypto_1.default.createHmac('sha1', decodedSecret);
        hmac.update(buffer);
        const hash = hmac.digest();
        const offset = hash[hash.length - 1] & 0x0f;
        const otp = (((hash[offset] & 0x7f) << 24) |
            ((hash[offset + 1] & 0xff) << 16) |
            ((hash[offset + 2] & 0xff) << 8) |
            (hash[offset + 3] & 0xff)) %
            1000000;
        const generatedCode = otp.toString().padStart(6, '0');
        // Check current and adjacent time windows for clock skew tolerance
        if (code === generatedCode)
            return true;
        // Check previous window
        const prevBuffer = Buffer.alloc(8);
        prevBuffer.writeBigUInt64BE(BigInt(time - 1));
        const prevHmac = crypto_1.default.createHmac('sha1', decodedSecret);
        prevHmac.update(prevBuffer);
        const prevHash = prevHmac.digest();
        const prevOffset = prevHash[prevHash.length - 1] & 0x0f;
        const prevOtp = (((prevHash[prevOffset] & 0x7f) << 24) |
            ((prevHash[prevOffset + 1] & 0xff) << 16) |
            ((prevHash[prevOffset + 2] & 0xff) << 8) |
            (prevHash[prevOffset + 3] & 0xff)) %
            1000000;
        if (code === prevOtp.toString().padStart(6, '0'))
            return true;
        return false;
    }
    static base32Encode(buffer) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let result = '';
        let bits = 0;
        let value = 0;
        for (const byte of buffer) {
            value = (value << 8) | byte;
            bits += 8;
            while (bits >= 5) {
                result += alphabet[(value >> (bits - 5)) & 0x1f];
                bits -= 5;
            }
        }
        if (bits > 0) {
            result += alphabet[(value << (5 - bits)) & 0x1f];
        }
        return result;
    }
    static base32Decode(encoded) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let bits = 0;
        let value = 0;
        const output = [];
        for (const char of encoded.toUpperCase()) {
            const index = alphabet.indexOf(char);
            if (index === -1)
                continue;
            value = (value << 5) | index;
            bits += 5;
            if (bits >= 8) {
                output.push((value >> (bits - 8)) & 0xff);
                bits -= 8;
            }
        }
        return Buffer.from(output);
    }
    // Stub methods for Email/SMS OTP (would integrate with notification system)
    static async verifyEmailOTP(userId, code) {
        // In production: check against stored OTP in Redis/DB
        console.log(`[MFA] Email OTP verification for user ${userId} — stub`);
        return true;
    }
    static async verifySMSOTP(userId, code) {
        // In production: check against stored OTP from SMS provider
        console.log(`[MFA] SMS OTP verification for user ${userId} — stub`);
        return true;
    }
}
exports.MFAService = MFAService;
