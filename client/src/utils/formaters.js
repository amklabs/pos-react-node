/**
 * Format a number/string as currency.
 * @param {number|string|null|undefined} value
 * @param {object} opts
 * @param {string} [opts.currency='PKR']   - ISO currency code
 * @param {string} [opts.locale='en-PK']   - BCP 47 locale
 * @param {boolean} [opts.showSymbol=true] - hide symbol to show plain number
 * @param {number} [opts.minimumFractionDigits=2]
 * @param {number} [opts.maximumFractionDigits=2]
 * @returns {string}
 */
export function formatCurrency(value, {
    currency = 'PKR',
    locale = 'en-PK',
    showSymbol = true,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
} = {}) {
    const num = toNumber(value);
    if (num === null) return '—';

    return new Intl.NumberFormat(locale, {
        style: showSymbol ? 'currency' : 'decimal',
        currency,
        minimumFractionDigits,
        maximumFractionDigits,
    }).format(num);
}

/**
 * Format as plain number with thousand separators (no symbol).
 * e.g. 1234.5 -> "1,234.50"
 */
export function formatNumber(value, {
    locale = 'en-PK',
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
} = {}) {
    const num = toNumber(value);
    if (num === null) return '—';

    return new Intl.NumberFormat(locale, {
        minimumFractionDigits,
        maximumFractionDigits,
    }).format(num);
}

/**
 * Compact currency for dashboards: 1250000 -> "₨1.25M"
 */
export function formatCurrencyCompact(value, {
    currency = 'PKR',
    locale = 'en-PK',
} = {}) {
    const num = toNumber(value);
    if (num === null) return '—';

    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(num);
}

/**
 * Safe number coercion. Returns null for invalid/empty.
 * Handles strings like "1,234.56" and Prisma Decimal objects.
 */
export function toNumber(value) {
    if (value === null || value === undefined || value === '') return null;

    // Prisma Decimal / decimal.js
    if (typeof value === 'object' && typeof value.toNumber === 'function') {
        const n = value.toNumber();
        return Number.isFinite(n) ? n : null;
    }

    const n = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
}

/**
 * Round to 2 decimals (banker-safe-ish for display).
 * Returns number.
 */
export function roundCurrency(value, decimals = 2) {
    const num = toNumber(value);
    if (num === null) return 0;
    const factor = 10 ** decimals;
    return Math.round((num + Number.EPSILON) * factor) / factor;
}

/**
 * Format a date. Default: "09 Nov 2026".
 * @param {Date|string|number|null|undefined} value
 * @param {object} opts
 * @param {string} [opts.locale='en-PK']
 * @param {Intl.DateTimeFormatOptions} [opts.format] - override format
 * @returns {string}
 */
export function formatDate(value, {
    locale = 'en-PK',
    format,
} = {}) {
    const date = toDate(value);
    if (!date) return '—';

    return new Intl.DateTimeFormat(locale, format ?? {
        timeZone: 'Asia/Karachi',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(date);
}

/** "09 Nov 2026, 14:30" */
export function formatDateTime(value, { locale = 'en-PK' } = {}) {
    const date = toDate(value);
    if (!date) return '—';

    return new Intl.DateTimeFormat(locale, {
        timeZone: 'Asia/Karachi',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    }).format(date);
}

/** "14:30" */
export function formatTime(value, { locale = 'en-GB' } = {}) {
    const date = toDate(value);
    if (!date) return '—';

    return new Intl.DateTimeFormat(locale, {
        timeZone: 'Asia/Karachi',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    }).format(date);
}

/** "2026-11-09" (for <input type="date">) */
export function toInputDate(value) {
    const date = toDate(value);
    if (!date) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/** "2026-11-09T14:30" (for <input type="datetime-local">) */
export function toInputDateTime(value) {
    const date = toDate(value);
    if (!date) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
        `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
}

/** "2 hours ago", "3 days ago" */
export function formatRelative(value) {
    const date = toDate(value);
    if (!date) return '—';

    const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

    const units = [
        ['year', 60 * 60 * 24 * 365],
        ['month', 60 * 60 * 24 * 30],
        ['week', 60 * 60 * 24 * 7],
        ['day', 60 * 60 * 24],
        ['hour', 60 * 60],
        ['minute', 60],
        ['second', 1],
    ];

    for (const [unit, sec] of units) {
        if (Math.abs(diffSec) >= sec || unit === 'second') {
            return rtf.format(Math.round(diffSec / sec), unit);
        }
    }
    return 'just now';
}

/** Safe date coercion. Returns Date | null. */
export function toDate(value) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** Is same day (local)? */
export function isSameDay(a, b) {
    const d1 = toDate(a);
    const d2 = toDate(b);
    if (!d1 || !d2) return false;
    return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
    );
}