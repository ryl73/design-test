import { ApiError } from './errors.js';
import type { AppConfig } from '../config/config.js';
function invalid(field: string): never { throw new ApiError(400, 'INVALID_INPUT', 'Invalid ' + field); }
export function object(value: unknown, allowed: string[]): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return invalid('body');
    const data = value as Record<string, unknown>;
    if (Object.keys(data).some(k => !allowed.includes(k)))
        return invalid('unknown field');
    return data;
}
export function text(value: unknown, field: string, max: number, min = 1): string {
    if (typeof value !== 'string' || value.trim().length < min || value.length > max)
        return invalid(field);
    return value.trim();
}
export function integer(value: unknown, field: string, min: number, max: number): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max)
        return invalid(field);
    return value;
}
export function uuid(value: unknown): string {
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
        return invalid('id');
    return value;
}
export function savedUrl(value: unknown, config: AppConfig): string {
    if (typeof value !== 'string' || Array.from(value).some(character => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127 || character === '\\'))
        return invalid('URL');
    const source = text(value, 'URL', 2048);
    const authority=/^https?:\/\/([^/?#]+)/i.exec(source)?.[1];
    if(!authority||authority.includes('@')||source.includes('#'))return invalid('URL');
    let url: URL;
    try {
        url = new URL(source);
    }
    catch {
        return invalid('URL');
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash)
        return invalid('URL');
    for (const key of url.searchParams.keys())
        if (/token|secret|password|passwd|credential|authorization|api[-_]?key|signature|session|jwt/i.test(key))
            return invalid('URL query');
    if (url.hostname.endsWith('.'))
        url.hostname = url.hostname.slice(0, -1);
    if (!config.captureAllowedOrigins.includes(url.origin))
        throw new ApiError(403, 'URL_POLICY', 'URL origin is not allowed');
    if (url.href.length > 2048)
        return invalid('URL');
    return url.href;
}
export const variantFields = ['name', 'viewportWidth', 'viewportHeight', 'urlOverride', 'readySelector', 'settleDelayMs', 'authProfileRef', 'authReadySelector'];
export function fields(body: unknown, kind: 'project' | 'page' | 'variant', patch: boolean, config: AppConfig) {
    const allowed = kind === 'project' ? ['name', 'description'] : kind === 'page' ? ['name', 'url'] : variantFields;
    const input = object(body, [...allowed, ...(patch ? ['version', 'archived'] : [])]);
    const result: Record<string, unknown> = {};
    if (patch) {
        result.version = integer(input.version, 'version', 1, 2147483647);
        if (Object.keys(input).length === 1)
            return invalid('empty patch');
        if (input.archived !== undefined) {
            if (typeof input.archived !== 'boolean')
                return invalid('archived');
            result.archivedAt = input.archived ? new Date() : null;
        }
    }
    if (!patch || input.name !== undefined)
        result.name = text(input.name, 'name', 120);
    if (kind === 'project' && input.description !== undefined)
        result.description = text(input.description, 'description', 2000, 0);
    if (kind === 'page' && (!patch || input.url !== undefined))
        result.url = savedUrl(input.url, config);
    if (kind === 'variant') {
        if (!patch || input.viewportWidth !== undefined)
            result.viewportWidth = integer(input.viewportWidth, 'viewportWidth', 320, 2560);
        if (!patch || input.viewportHeight !== undefined)
            result.viewportHeight = integer(input.viewportHeight, 'viewportHeight', 320, 1600);
        if (input.settleDelayMs !== undefined)
            result.settleDelayMs = integer(input.settleDelayMs, 'settleDelayMs', 0, 3000);
        for (const key of ['readySelector', 'authReadySelector'])
            if (input[key] !== undefined)
                result[key] = input[key] === null ? null : text(input[key], key, 300);
        if (input.urlOverride !== undefined)
            result.urlOverride = input.urlOverride === null ? null : savedUrl(input.urlOverride, config);
        if (input.authProfileRef !== undefined) {
            if (input.authProfileRef === null)
                result.authProfileRef = null;
            else {
                const profile = object(input.authProfileRef, ['profileId', 'version']);
                const profileId = text(profile.profileId, 'profileId', 120);
                const version = integer(profile.version, 'profile version', 1, 2147483647);
                if (!config.captureProfiles.some(p => p.id === profileId && p.version === version))
                    return invalid('authProfileRef');
                result.authProfileRef = { profileId, version };
            }
        }
    }
    return result;
}
export function effectiveProfile(url: string, ref: unknown, config: AppConfig) {
    if (ref === null || ref === undefined)
        return;
    const data = ref as {
        profileId: string;
        version: number;
    };
    const profile = config.captureProfiles.find(p => p.id === data.profileId && p.version === data.version);
    if (!profile || profile.origin !== new URL(url).origin)
        throw new ApiError(400, 'INVALID_INPUT', 'Profile must match the effective URL origin');
}
export function pagination(query: unknown) {
    const input = object(query, ['limit', 'archived', 'cursor']);
    const limit = input.limit === undefined ? 30 : typeof input.limit === 'string' && /^\d+$/.test(input.limit) ? Number(input.limit) : NaN;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
        return invalid('limit');
    const archived = input.archived ?? 'false';
    if (!['false', 'true', 'all'].includes(String(archived)) || typeof archived !== 'string')
        return invalid('archived');
    let cursor: {
        createdAt: Date;
        id: string;
    } | undefined;
    if (input.cursor !== undefined) {
        if (typeof input.cursor !== 'string' || input.cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(input.cursor))
            return invalid('cursor');
        try {
            const raw = JSON.parse(Buffer.from(input.cursor, 'base64url').toString());
            const data = object(raw, ['createdAt', 'id']);
            const createdAt = new Date(text(data.createdAt, 'cursor timestamp', 30));
            if (!Number.isFinite(createdAt.getTime()) || createdAt.toISOString() !== data.createdAt)
                return invalid('cursor');
            cursor = { createdAt, id: uuid(data.id) };
        }
        catch {
            return invalid('cursor');
        }
    }
    return { limit, where: { ...(archived === 'all' ? {} : { archivedAt: archived === 'true' ? { not: null } : null }), ...(cursor ? { OR: [{ createdAt: { gt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { gt: cursor.id } }] } : {}) } };
}
export function listed<T extends {
    id: string;
    createdAt: Date;
}>(rows: T[], limit: number) { const items = rows.slice(0, limit); const last = items.at(-1); return { items, nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id })).toString('base64url') : null }; }
