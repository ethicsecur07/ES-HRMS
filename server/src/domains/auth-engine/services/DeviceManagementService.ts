import crypto from 'crypto';
import { UserDevice, IUserDevice, DeviceStatus } from '../models/UserDevice.js';

/**
 * DeviceManagementService
 * Manages user device fingerprinting, trust, and revocation.
 */
export class DeviceManagementService {
  /**
   * Register or update a device for a user login.
   * Returns the device and whether it's a new/unknown device.
   */
  static async registerDevice(params: {
    userId: string;
    organizationId: string;
    userAgent: string;
    ipAddress: string;
    deviceFingerprint?: string;
  }): Promise<{ device: IUserDevice; isNewDevice: boolean }> {
    const fingerprint = params.deviceFingerprint || this.generateFingerprint(params.userAgent, params.ipAddress);
    const { deviceName, deviceType, browser, os } = this.parseUserAgent(params.userAgent);

    let device = await UserDevice.findOne({
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
      await UserDevice.updateMany(
        { userId: params.userId, _id: { $ne: device._id } },
        { isCurrent: false }
      );

      return { device, isNewDevice: false };
    }

    // New device
    device = await UserDevice.create({
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
    await UserDevice.updateMany(
      { userId: params.userId, _id: { $ne: device._id } },
      { isCurrent: false }
    );

    return { device, isNewDevice: true };
  }

  /**
   * Trust a device (user confirms it).
   */
  static async trustDevice(userId: string, deviceId: string): Promise<IUserDevice | null> {
    return UserDevice.findOneAndUpdate(
      { _id: deviceId, userId },
      { status: 'TRUSTED' },
      { new: true }
    );
  }

  /**
   * Block/revoke a device.
   */
  static async blockDevice(userId: string, deviceId: string): Promise<IUserDevice | null> {
    return UserDevice.findOneAndUpdate(
      { _id: deviceId, userId },
      { status: 'BLOCKED', isCurrent: false },
      { new: true }
    );
  }

  /**
   * Get all devices for a user.
   */
  static async getUserDevices(userId: string): Promise<IUserDevice[]> {
    return UserDevice.find({ userId }).sort({ lastUsedAt: -1 });
  }

  /**
   * Remove a device entry.
   */
  static async removeDevice(userId: string, deviceId: string): Promise<boolean> {
    const result = await UserDevice.deleteOne({ _id: deviceId, userId });
    return result.deletedCount > 0;
  }

  /**
   * Check if a device is blocked.
   */
  static async isDeviceBlocked(userId: string, fingerprint: string): Promise<boolean> {
    const device = await UserDevice.findOne({ userId, fingerprint });
    return device?.status === 'BLOCKED';
  }

  /**
   * Check if a device is trusted.
   */
  static async isDeviceTrusted(userId: string, fingerprint: string): Promise<boolean> {
    const device = await UserDevice.findOne({ userId, fingerprint });
    return device?.status === 'TRUSTED';
  }

  /**
   * Enforce max device limit — revoke oldest untrusted devices.
   */
  static async enforceDeviceLimit(userId: string, maxDevices: number): Promise<void> {
    const devices = await UserDevice.find({ userId }).sort({ lastUsedAt: -1 });
    if (devices.length <= maxDevices) return;

    const devicesToRemove = devices.slice(maxDevices);
    const idsToRemove = devicesToRemove
      .filter((d) => d.status !== 'TRUSTED')
      .map((d) => d._id);

    if (idsToRemove.length > 0) {
      await UserDevice.deleteMany({ _id: { $in: idsToRemove } });
    }
  }

  // ---- Private Helpers ----

  private static generateFingerprint(userAgent: string, ipAddress: string): string {
    const data = `${userAgent}`;
    return crypto.createHash('sha256').update(data).digest('hex').slice(0, 32);
  }

  private static parseUserAgent(ua: string): {
    deviceName: string;
    deviceType: 'DESKTOP' | 'MOBILE' | 'TABLET' | 'UNKNOWN';
    browser: string;
    os: string;
  } {
    // Simplified UA parsing
    let deviceType: 'DESKTOP' | 'MOBILE' | 'TABLET' | 'UNKNOWN' = 'UNKNOWN';
    let browser = 'Unknown';
    let os = 'Unknown';

    if (/iPad|Android.*Tablet/i.test(ua)) deviceType = 'TABLET';
    else if (/Mobile|Android|iPhone/i.test(ua)) deviceType = 'MOBILE';
    else if (/Windows|Macintosh|Linux/i.test(ua)) deviceType = 'DESKTOP';

    if (/Chrome\/(\d+)/i.test(ua)) browser = `Chrome ${ua.match(/Chrome\/(\d+)/i)?.[1]}`;
    else if (/Firefox\/(\d+)/i.test(ua)) browser = `Firefox ${ua.match(/Firefox\/(\d+)/i)?.[1]}`;
    else if (/Safari\/(\d+)/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
    else if (/Edge\/(\d+)/i.test(ua)) browser = `Edge ${ua.match(/Edge\/(\d+)/i)?.[1]}`;

    if (/Windows NT/i.test(ua)) os = 'Windows';
    else if (/Macintosh/i.test(ua)) os = 'macOS';
    else if (/Linux/i.test(ua)) os = 'Linux';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/iPhone|iPad/i.test(ua)) os = 'iOS';

    const deviceName = `${browser} on ${os}`;

    return { deviceName, deviceType, browser, os };
  }
}
