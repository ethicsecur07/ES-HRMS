import { LoginEvent, ILoginEvent, RiskLevel } from '../models/LoginEvent.js';

/**
 * LoginRiskService
 * Evaluates login risk based on multiple signals: IP, device, geography,
 * velocity, and historical patterns.
 */
export class LoginRiskService {
  // Thresholds
  private static readonly MAX_FAILED_ATTEMPTS_1H = 5;
  private static readonly MAX_FAILED_ATTEMPTS_24H = 15;
  private static readonly VELOCITY_WINDOW_MS = 60 * 1000; // 1 minute
  private static readonly MAX_LOGINS_PER_MINUTE = 3;

  // Haversine formula to calculate distance in km
  static getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }

  /**
   * Resolve country and coordinates using ip-api.com, falling back to IP-subnet-based hash
   */
  static async resolveGeo(ipAddress: string): Promise<{ country: string; lat: number; lon: number }> {
    if (
      !ipAddress ||
      ipAddress === '127.0.0.1' ||
      ipAddress === '::1' ||
      ipAddress.startsWith('192.168.') ||
      ipAddress.startsWith('10.') ||
      ipAddress.startsWith('172.16.')
    ) {
      return { country: 'Localhost', lat: 0, lon: 0 };
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`http://ip-api.com/json/${ipAddress}?fields=status,country,lat,lon`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data: any = await response.json();
        if (data && data.status === 'success') {
          return {
            country: data.country || 'Unknown',
            lat: typeof data.lat === 'number' ? data.lat : 0,
            lon: typeof data.lon === 'number' ? data.lon : 0,
          };
        }
      }
    } catch (err) {
      console.warn('Geolocation API lookup failed, using fallback subnets:', err);
    }

    // Fallback region mapping based on IP subnets (stable hash-based lookup)
    let hash = 0;
    for (let i = 0; i < ipAddress.length; i++) {
      hash = ipAddress.charCodeAt(i) + ((hash << 5) - hash);
    }
    const countryIndex = Math.abs(hash) % 5;
    const countries = ['United States', 'India', 'Germany', 'United Kingdom', 'Singapore'];
    const lats = [37.0902, 20.5937, 51.1657, 55.3781, 1.3521];
    const lons = [-95.7129, 78.9629, 10.4515, -3.4360, 103.8198];

    return {
      country: countries[countryIndex],
      lat: lats[countryIndex],
      lon: lons[countryIndex],
    };
  }

  /**
   * Evaluate the risk level of a login attempt.
   */
  static async evaluateRisk(params: {
    email: string;
    ipAddress: string;
    userAgent: string;
    deviceFingerprint?: string;
    organizationId?: string;
  }): Promise<{ riskLevel: RiskLevel; factors: string[]; shouldBlock: boolean; country: string }> {
    const factors: string[] = [];
    let riskScore = 0;

    // Resolve Geo Location
    const geoCurrent = await this.resolveGeo(params.ipAddress);

    // 1. Check failed login velocity (brute force detection)
    const failedRecent = await this.getRecentFailedAttempts(params.email, 60); // last 60 min
    if (failedRecent >= this.MAX_FAILED_ATTEMPTS_1H) {
      factors.push(`${failedRecent} failed attempts in last hour`);
      riskScore += 40;
    } else if (failedRecent >= 3) {
      factors.push(`${failedRecent} recent failed attempts`);
      riskScore += 15;
    }

    // 2. Check 24h failure count
    const failed24h = await this.getRecentFailedAttempts(params.email, 1440);
    if (failed24h >= this.MAX_FAILED_ATTEMPTS_24H) {
      factors.push(`${failed24h} failed attempts in 24 hours`);
      riskScore += 30;
    }

    // 3. Check login velocity (too many logins in a short window)
    const recentLogins = await this.getRecentLoginCount(params.email, 1);
    if (recentLogins >= this.MAX_LOGINS_PER_MINUTE) {
      factors.push('Excessive login velocity');
      riskScore += 25;
    }

    // 4. Check for new/unknown IP
    const isKnownIP = await this.isKnownIP(params.email, params.ipAddress);
    if (!isKnownIP) {
      factors.push('Login from new IP address');
      riskScore += 10;
    }

    // 5. Check for new device
    if (params.deviceFingerprint) {
      const isKnownDevice = await this.isKnownDevice(params.email, params.deviceFingerprint);
      if (!isKnownDevice) {
        factors.push('Login from unrecognized device');
        riskScore += 10;
      }
    }

    // 6. Check for IP-based attacks (same IP, multiple accounts)
    const ipAccountCount = await this.getIPAccountCount(params.ipAddress, 60);
    if (ipAccountCount > 5) {
      factors.push(`IP ${params.ipAddress} used by ${ipAccountCount} accounts`);
      riskScore += 20;
    }

    // 7. Check for impossible travel
    const lastSuccessfulLogin = await LoginEvent.findOne({
      email: params.email,
      status: 'SUCCESS',
    }).sort({ createdAt: -1 });

    if (lastSuccessfulLogin) {
      const timeDiffMs = Date.now() - new Date(lastSuccessfulLogin.createdAt).getTime();
      const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

      const geoLast = await this.resolveGeo(lastSuccessfulLogin.ipAddress);
      const distance = this.getDistance(geoCurrent.lat, geoCurrent.lon, geoLast.lat, geoLast.lon);

      if (distance > 100 && timeDiffHours > 0) {
        const requiredSpeed = distance / timeDiffHours;
        if (requiredSpeed > 900) {
          factors.push(
            `Impossible travel detected: ${Math.round(distance)} km in ${timeDiffHours.toFixed(
              2
            )} hours (requires speed of ${Math.round(requiredSpeed)} km/h)`
          );
          riskScore += 50;
        }
      }
    }

    // Determine risk level
    let riskLevel: RiskLevel;
    if (riskScore >= 60) riskLevel = 'CRITICAL';
    else if (riskScore >= 40) riskLevel = 'HIGH';
    else if (riskScore >= 20) riskLevel = 'MEDIUM';
    else riskLevel = 'LOW';

    const shouldBlock = riskLevel === 'CRITICAL';

    return { riskLevel, factors, shouldBlock, country: geoCurrent.country };
  }

  /**
   * Record a login event.
   */
  static async recordEvent(event: Partial<ILoginEvent>): Promise<ILoginEvent> {
    return LoginEvent.create(event);
  }

  /**
   * Get login history for a user.
   */
  static async getLoginHistory(
    email: string,
    limit: number = 20,
    organizationId?: string
  ): Promise<ILoginEvent[]> {
    const query: any = { email };
    if (organizationId) query.organizationId = organizationId;
    return LoginEvent.find(query).sort({ createdAt: -1 }).limit(limit);
  }

  /**
   * Get login events for admin dashboard.
   */
  static async getOrgLoginEvents(
    organizationId: string,
    options: { limit?: number; riskLevel?: RiskLevel; status?: string } = {}
  ): Promise<ILoginEvent[]> {
    const query: any = { organizationId };
    if (options.riskLevel) query.riskLevel = options.riskLevel;
    if (options.status) query.status = options.status;
    return LoginEvent.find(query)
      .sort({ createdAt: -1 })
      .limit(options.limit || 50);
  }

  // ---- Private Analysis Methods ----

  private static async getRecentFailedAttempts(email: string, windowMinutes: number): Promise<number> {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    return LoginEvent.countDocuments({
      email,
      status: 'FAILED',
      createdAt: { $gte: since },
    });
  }

  private static async getRecentLoginCount(email: string, windowMinutes: number): Promise<number> {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    return LoginEvent.countDocuments({
      email,
      createdAt: { $gte: since },
    });
  }

  private static async isKnownIP(email: string, ipAddress: string): Promise<boolean> {
    const count = await LoginEvent.countDocuments({
      email,
      ipAddress,
      status: 'SUCCESS',
    });
    return count > 0;
  }

  private static async isKnownDevice(email: string, fingerprint: string): Promise<boolean> {
    const count = await LoginEvent.countDocuments({
      email,
      deviceFingerprint: fingerprint,
      status: 'SUCCESS',
    });
    return count > 0;
  }

  private static async getIPAccountCount(ipAddress: string, windowMinutes: number): Promise<number> {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    const distinct = await LoginEvent.distinct('email', {
      ipAddress,
      createdAt: { $gte: since },
    });
    return distinct.length;
  }
}
