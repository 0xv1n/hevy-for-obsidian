export function convertWeight(weightKg: number | null, unit: 'kg' | 'lbs'): number {
    if (weightKg === null) return 0;
    return unit === 'lbs' ? weightKg * 2.20462262 : weightKg;
}

export function formatWeight(weightKg: number | null, unit: 'kg' | 'lbs'): string {
    const value = convertWeight(weightKg, unit);
    return `${value.toFixed(1)} ${unit}`;
}

export function sanitizeFileName(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, '-');
}

export function calculate1RM(weightKg: number | null, reps: number | null): number {
    if (!weightKg || !reps || reps === 0) return 0;
    return weightKg * (1 + reps / 30);
}

export function getWeekNumber(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo}`;
}