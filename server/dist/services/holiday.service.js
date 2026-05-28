"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMergedHolidays = exports.getGoogleHolidays = void 0;
const HolidayCalendar_js_1 = require("../models/HolidayCalendar.js");
let googleHolidaysCache = [];
let cacheTime = 0;
/**
 * Fetches Indian holidays from Google Calendar API.
 * Uses a 1-hour in-memory cache to prevent rate limiting.
 */
const getGoogleHolidays = async () => {
    const now = Date.now();
    // Cache for 1 hour (60 minutes * 60 seconds * 1000 milliseconds)
    if (googleHolidaysCache.length > 0 && (now - cacheTime < 60 * 60 * 1000)) {
        return googleHolidaysCache;
    }
    try {
        const url = 'https://www.googleapis.com/calendar/v3/calendars/en.indian%23holiday@group.v.calendar.google.com/events?key=AIzaSyCY87FQ_qeyvH822Rocc6PI2CDDqG3jFxM';
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch Google Calendar holidays: ${response.statusText}`);
        }
        const data = await response.json();
        if (data && Array.isArray(data.items)) {
            googleHolidaysCache = data.items.map((item) => {
                // Observances or events without description with 'public holiday' are marked restricted
                const isRestricted = !item.description || !item.description.toLowerCase().includes('public holiday');
                return {
                    _id: `google-${item.id}`,
                    name: item.summary,
                    date: item.start?.date || item.start?.dateTime?.split('T')[0],
                    isRestricted,
                    isGoogleHoliday: true,
                };
            });
            cacheTime = now;
        }
    }
    catch (error) {
        console.error('Error fetching Google holidays:', error.message);
    }
    return googleHolidaysCache;
};
exports.getGoogleHolidays = getGoogleHolidays;
/**
 * Retrieves both custom database holidays and Google Calendar holidays,
 * merges them, deduplicates by date (custom overrides Google), and sorts by date.
 */
const getMergedHolidays = async (organizationId, startDate, endDate) => {
    const query = { organizationId };
    if (startDate || endDate) {
        query.date = {};
        if (startDate)
            query.date.$gte = startDate;
        if (endDate)
            query.date.$lte = endDate;
    }
    const localHolidays = await HolidayCalendar_js_1.HolidayCalendar.find(query).sort({ date: 1 });
    let googleHolidays = await (0, exports.getGoogleHolidays)();
    if (startDate) {
        googleHolidays = googleHolidays.filter((h) => h.date >= startDate);
    }
    if (endDate) {
        googleHolidays = googleHolidays.filter((h) => h.date <= endDate);
    }
    const combined = [
        ...localHolidays.map((h) => h.toObject()),
        ...googleHolidays,
    ];
    // Deduplicate by date (local/custom holidays override Google holidays if dates match)
    const seenDates = new Set();
    const deduped = [];
    // Sort so local holidays come first and override Google ones in the map
    const sortedByOrigin = combined.sort((a, b) => {
        if (a.isGoogleHoliday && !b.isGoogleHoliday)
            return 1;
        if (!a.isGoogleHoliday && b.isGoogleHoliday)
            return -1;
        return 0;
    });
    for (const h of sortedByOrigin) {
        if (!seenDates.has(h.date)) {
            seenDates.add(h.date);
            deduped.push(h);
        }
    }
    // Final sort by date chronologically
    return deduped.sort((a, b) => a.date.localeCompare(b.date));
};
exports.getMergedHolidays = getMergedHolidays;
