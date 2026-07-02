import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Format an ISO timestamp as a short relative time string (e.g. "2 mins ago").
 * Falls back to a formatted date once the timestamp is more than a week old.
 */
export function formatRelativeTime(value: string | null | undefined): string {
    if (!value) {
        return '';
    }

    const date = new Date(value);
    const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
    const diffAbs = Math.abs(diffSeconds);

    const units: [Intl.RelativeTimeFormatUnit, number][] = [
        ['year', 60 * 60 * 24 * 365],
        ['month', 60 * 60 * 24 * 30],
        ['week', 60 * 60 * 24 * 7],
        ['day', 60 * 60 * 24],
        ['hour', 60 * 60],
        ['minute', 60],
    ];

    for (const [unit, secondsInUnit] of units) {
        if (diffAbs >= secondsInUnit) {
            const value = Math.round(diffSeconds / secondsInUnit);

            return new Intl.RelativeTimeFormat('en', {
                numeric: 'auto',
            }).format(value, unit);
        }
    }

    return 'just now';
}
