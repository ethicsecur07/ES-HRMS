"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const argon2_1 = __importDefault(require("argon2"));
const SALT_ROUNDS = 12;
class PasswordService {
    /**
     * Hashes a raw password securely using argon2.
     */
    static async hashPassword(password) {
        return argon2_1.default.hash(password);
    }
    /**
     * Verifies a raw password against a hashed password (supporting both bcrypt and argon2).
     */
    static async verifyPassword(password, hash) {
        const result = await this.verifyAndCheckNeedsUpgrade(password, hash);
        return result.isValid;
    }
    /**
     * Verifies password and checks if password was hashed using legacy bcrypt, meaning it needs upgrade.
     */
    static async verifyAndCheckNeedsUpgrade(password, hash) {
        if (!password || !hash)
            return { isValid: false, needsUpgrade: false };
        if (hash.startsWith('$argon2')) {
            try {
                const isValid = await argon2_1.default.verify(hash, password);
                return { isValid, needsUpgrade: false };
            }
            catch (error) {
                return { isValid: false, needsUpgrade: false };
            }
        }
        else {
            try {
                const isValid = await bcryptjs_1.default.compare(password, hash);
                return { isValid, needsUpgrade: isValid };
            }
            catch (error) {
                return { isValid: false, needsUpgrade: false };
            }
        }
    }
    /**
     * Evaluates password strength.
     * Basic example: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char.
     */
    static validateStrength(password) {
        if (password.length < 8) {
            return { isValid: false, message: 'Password must be at least 8 characters long.' };
        }
        if (!/[A-Z]/.test(password)) {
            return { isValid: false, message: 'Password must contain at least one uppercase letter.' };
        }
        if (!/[a-z]/.test(password)) {
            return { isValid: false, message: 'Password must contain at least one lowercase letter.' };
        }
        if (!/[0-9]/.test(password)) {
            return { isValid: false, message: 'Password must contain at least one number.' };
        }
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            return { isValid: false, message: 'Password must contain at least one special character.' };
        }
        return { isValid: true };
    }
}
exports.PasswordService = PasswordService;
