import bcrypt from 'bcryptjs';
import argon2 from 'argon2';

const SALT_ROUNDS = 12;

export class PasswordService {
  /**
   * Hashes a raw password securely using argon2.
   */
  static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
  }

  /**
   * Verifies a raw password against a hashed password (supporting both bcrypt and argon2).
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    const result = await this.verifyAndCheckNeedsUpgrade(password, hash);
    return result.isValid;
  }

  /**
   * Verifies password and checks if password was hashed using legacy bcrypt, meaning it needs upgrade.
   */
  static async verifyAndCheckNeedsUpgrade(password: string, hash: string): Promise<{ isValid: boolean; needsUpgrade: boolean }> {
    if (!password || !hash) return { isValid: false, needsUpgrade: false };
    if (hash.startsWith('$argon2')) {
      try {
        const isValid = await argon2.verify(hash, password);
        return { isValid, needsUpgrade: false };
      } catch (error) {
        return { isValid: false, needsUpgrade: false };
      }
    } else {
      try {
        const isValid = await bcrypt.compare(password, hash);
        return { isValid, needsUpgrade: isValid };
      } catch (error) {
        return { isValid: false, needsUpgrade: false };
      }
    }
  }

  /**
   * Evaluates password strength.
   * Basic example: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char.
   */
  static validateStrength(password: string): { isValid: boolean; message?: string } {
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
