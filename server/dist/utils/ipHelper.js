"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ipMatchesRange = ipMatchesRange;
/**
 * Helper to match an IP address against a list of allowed IP patterns or CIDR blocks.
 * Supports exact matches, wildcard prefix (* or trailing dot), CIDR notation, and hyphenated ranges.
 */
function ipMatchesRange(ip, allowedRanges) {
    if (!ip)
        return false;
    // Normalize IPv6 mapped IPv4 address (e.g. ::ffff:192.168.29.8 -> 192.168.29.8)
    let normalizedIp = ip.trim();
    if (normalizedIp.startsWith('::ffff:')) {
        normalizedIp = normalizedIp.substring(7);
    }
    if (normalizedIp === '::1') {
        normalizedIp = '127.0.0.1';
    }
    const ipToLong = (ipStr) => {
        const parts = ipStr.split('.').map(Number);
        if (parts.length !== 4 || parts.some(isNaN))
            return -1;
        return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
    };
    const clientLong = ipToLong(normalizedIp);
    for (const range of allowedRanges) {
        const trimmedRange = range.trim();
        if (!trimmedRange)
            continue;
        // 1. Exact match (normalize ::1 to 127.0.0.1 for exact check)
        let normalizedRange = trimmedRange;
        if (normalizedRange.startsWith('::ffff:')) {
            normalizedRange = normalizedRange.substring(7);
        }
        if (normalizedRange === '::1') {
            normalizedRange = '127.0.0.1';
        }
        if (normalizedIp === normalizedRange) {
            return true;
        }
        // 2. Wildcard match (e.g. 192.168.29.* or 192.168.29.)
        if (trimmedRange.includes('*')) {
            const regexStr = '^' + trimmedRange.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
            const regex = new RegExp(regexStr);
            if (regex.test(normalizedIp)) {
                return true;
            }
        }
        if (trimmedRange.endsWith('.')) {
            if (normalizedIp.startsWith(trimmedRange)) {
                return true;
            }
        }
        // 3. CIDR match (e.g. 192.168.29.0/24)
        if (trimmedRange.includes('/')) {
            const [subnet, maskStr] = trimmedRange.split('/');
            const mask = parseInt(maskStr, 10);
            if (!isNaN(mask) && mask >= 0 && mask <= 32) {
                const subnetLong = ipToLong(subnet);
                if (subnetLong !== -1 && clientLong !== -1) {
                    const maskBits = mask === 0 ? 0 : ((0xFFFFFFFF << (32 - mask)) >>> 0);
                    if ((clientLong & maskBits) === (subnetLong & maskBits)) {
                        return true;
                    }
                }
            }
        }
        // 4. Range with hyphen (e.g. 192.168.29.1-192.168.29.254)
        if (trimmedRange.includes('-')) {
            const [startIp, endIp] = trimmedRange.split('-');
            const startLong = ipToLong(startIp.trim());
            const endLong = ipToLong(endIp.trim());
            if (startLong !== -1 && endLong !== -1 && clientLong !== -1) {
                if (clientLong >= startLong && clientLong <= endLong) {
                    return true;
                }
            }
        }
    }
    return false;
}
