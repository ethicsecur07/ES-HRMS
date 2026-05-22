"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceManagementService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const UserDevice_js_1 = require("../models/UserDevice.js");
/**
 * DeviceManagementService
 * Manages user device fingerprinting, trust, and revocation.
 */
class DeviceManagementService {
    /**
     * Register or update a device for a user login.
     * Returns the device and whether it's a new/unknown device.
     */
    static async registerDevice(params) {
        const fingerprint = params.deviceFingerprint || this.generateFingerprint(params.userAgent, params.ipAddress);
        const { deviceName, deviceType, browser, os } = this.parseUserAgent(params.userAgent);
        let device = await UserDevice_js_1.UserDevice.findOne({
            userId: params.userId,
            fingerprint,
        });
        if (device) {
            // Existing device — update last seen
            device.lastUsedAt = new Date();
            device.ipAddress = params.ipAddress;
            device.isCurrent = true;
            await device.save();
            // Mark all other devices as not current
            await UserDevice_js_1.UserDevice.updateMany({ userId: params.userId, _id: { $ne: device._id } }, { isCurrent: false });
            return { device, isNewDevice: false };
        }
        // New device
        device = await UserDevice_js_1.UserDevice.create({
            userId: params.userId,
            organizationId: params.organizationId,
            fingerprint,
            deviceName,
            deviceType,
            browser,
            os,
            ipAddress: params.ipAddress,
            status: 'UNTRUSTED',
            isCurrent: true,
            lastUsedAt: new Date(),
            firstSeenAt: new Date(),
        });
        // Mark all other devices as not current
        await UserDevice_js_1.UserDevice.updateMany({ userId: params.userId, _id: { $ne: device._id } }, { isCurrent: false });
        return { device, isNewDevice: true };
    }
    /**
     * Trust a device (user confirms it).
     */
    static async trustDevice(userId, deviceId) {
        return UserDevice_js_1.UserDevice.findOneAndUpdate({ _id: deviceId, userId }, { status: 'TRUSTED' }, { new: true });
    }
    /**
     * Block/revoke a device.
     */
    static async blockDevice(userId, deviceId) {
        return UserDevice_js_1.UserDevice.findOneAndUpdate({ _id: deviceId, userId }, { status: 'BLOCKED', isCurrent: false }, { new: true });
    }
    /**
     * Get all devices for a user.
     */
    static async getUserDevices(userId) {
        return UserDevice_js_1.UserDevice.find({ userId }).sort({ lastUsedAt: -1 });
    }
    /**
     * Remove a device entry.
     */
    static async removeDevice(userId, deviceId) {
        const result = await UserDevice_js_1.UserDevice.deleteOne({ _id: deviceId, userId });
        return result.deletedCount > 0;
    }
    /**
     * Check if a device is blocked.
     */
    static async isDeviceBlocked(userId, fingerprint) {
        const device = await UserDevice_js_1.UserDevice.findOne({ userId, fingerprint });
        return device?.status === 'BLOCKED';
    }
    /**
     * Check if a device is trusted.
     */
    static async isDeviceTrusted(userId, fingerprint) {
        const device = await UserDevice_js_1.UserDevice.findOne({ userId, fingerprint });
        return device?.status === 'TRUSTED';
    }
    /**
     * Enforce max device limit — revoke oldest untrusted devices.
     */
    static async enforceDeviceLimit(userId, maxDevices) {
        const devices = await UserDevice_js_1.UserDevice.find({ userId }).sort({ lastUsedAt: -1 });
        if (devices.length <= maxDevices)
            return;
        const devicesToRemove = devices.slice(maxDevices);
        const idsToRemove = devicesToRemove
            .filter((d) => d.status !== 'TRUSTED')
            .map((d) => d._id);
        if (idsToRemove.length > 0) {
            await UserDevice_js_1.UserDevice.deleteMany({ _id: { $in: idsToRemove } });
        }
    }
    // ---- Private Helpers ----
    static generateFingerprint(userAgent, ipAddress) {
        const data = `${userAgent}`;
        return crypto_1.default.createHash('sha256').update(data).digest('hex').slice(0, 32);
    }
    static parseUserAgent(ua) {
        // Simplified UA parsing
        let deviceType = 'UNKNOWN';
        let browser = 'Unknown';
        let os = 'Unknown';
        if (/iPad|Android.*Tablet/i.test(ua))
            deviceType = 'TABLET';
        else if (/Mobile|Android|iPhone/i.test(ua))
            deviceType = 'MOBILE';
        else if (/Windows|Macintosh|Linux/i.test(ua))
            deviceType = 'DESKTOP';
        if (/Chrome\/(\d+)/i.test(ua))
            browser = `Chrome ${ua.match(/Chrome\/(\d+)/i)?.[1]}`;
        else if (/Firefox\/(\d+)/i.test(ua))
            browser = `Firefox ${ua.match(/Firefox\/(\d+)/i)?.[1]}`;
        else if (/Safari\/(\d+)/i.test(ua) && !/Chrome/i.test(ua))
            browser = 'Safari';
        else if (/Edge\/(\d+)/i.test(ua))
            browser = `Edge ${ua.match(/Edge\/(\d+)/i)?.[1]}`;
        if (/Windows NT/i.test(ua))
            os = 'Windows';
        else if (/Macintosh/i.test(ua))
            os = 'macOS';
        else if (/Linux/i.test(ua))
            os = 'Linux';
        else if (/Android/i.test(ua))
            os = 'Android';
        else if (/iPhone|iPad/i.test(ua))
            os = 'iOS';
        const deviceName = `${browser} on ${os}`;
        return { deviceName, deviceType, browser, os };
    }
}
exports.DeviceManagementService = DeviceManagementService;
