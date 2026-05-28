export function formatBytes(bytes: number, precision = 1): string {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return '--';
    }

    const base = 1024;
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const unitIndex = Math.min(
        Math.floor(Math.log(bytes) / Math.log(base)),
        units.length - 1,
    );

    return `${parseFloat((bytes / Math.pow(base, unitIndex)).toFixed(precision))} ${units[unitIndex]}`;
}
