/**
 * Mengubah string durasi (mis. "1d", "3h", "10m") menjadi milidetik.
 * @param {string} durationString - String durasi.
 * @returns {number|null} - Durasi dalam milidetik, atau null jika invalid.
 */
export function parseDuration(durationString) {
    if (typeof durationString !== 'string' || !durationString) return null;

    const regex = /(\d+)(ms|s|m|h|d|w)/g;
    let totalMilliseconds = 0;
    let match;

    while ((match = regex.exec(durationString)) !== null) {
        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 'ms': totalMilliseconds += value; break;
            case 's': totalMilliseconds += value * 1000; break;
            case 'm': totalMilliseconds += value * 60 * 1000; break;
            case 'h': totalMilliseconds += value * 60 * 60 * 1000; break;
            case 'd': totalMilliseconds += value * 24 * 60 * 60 * 1000; break;
            case 'w': totalMilliseconds += value * 7 * 24 * 60 * 60 * 1000; break;
        }
    }

    // Discord timeout max 28 days
    const maxDuration = 28 * 24 * 60 * 60 * 1000;
    if (totalMilliseconds > maxDuration) {
        return maxDuration;
    }

    return totalMilliseconds > 0 ? totalMilliseconds : null;
}