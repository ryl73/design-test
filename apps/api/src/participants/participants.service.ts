import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { CONFIG, type AppConfig } from '../config/config.js';
import { ApiError } from '../http/errors.js';
export interface ApiRequest {
    headers: Record<string, string | string[] | undefined>;
}
export const PARTICIPANT_COOKIE = 'design_qa_participant';
@Injectable()
export class ParticipantsService {
    constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
    @Inject(CONFIG)
    private readonly config: AppConfig) { }
    origin(request: ApiRequest) {
        if (request.headers.origin !== this.config.origin)
            throw new ApiError(403, 'ORIGIN_FORBIDDEN', 'Request origin is not allowed');
    }
    private sign(payload: string) { return createHmac('sha256', this.config.signingKey).update(payload).digest('base64url'); }
    cookie(id: string) { const payload = Buffer.from(JSON.stringify({ participantId: id, expiresAt: Date.now() + 2592000000 })).toString('base64url'); return `${PARTICIPANT_COOKIE}=${payload}.${this.sign(payload)}; Path=/api/v1; HttpOnly; SameSite=Strict; Max-Age=2592000${this.config.mode === 'production' ? '; Secure' : ''}`; }
    async me(request: ApiRequest) {
        const header = request.headers.cookie;
        const raw = typeof header === 'string' ? header.split(';').map(v => v.trim()).find(v => v.startsWith(PARTICIPANT_COOKIE + '='))?.slice(PARTICIPANT_COOKIE.length + 1) : undefined;
        try {
            if (!raw || raw.length > 1024)
                throw new Error();
            const [payload, signature, ...extra] = raw.split('.');
            if (!payload || !signature || extra.length)
                throw new Error();
            const actual = Buffer.from(signature);
            const expected = Buffer.from(this.sign(payload));
            if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
                throw new Error();
            const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
            if (typeof data.participantId !== 'string' || typeof data.expiresAt !== 'number' || data.expiresAt <= Date.now())
                throw new Error();
            const participant = await this.db.client.participant.findUnique({ where: { id: data.participantId } });
            if (!participant)
                throw new Error();
            return participant;
        }
        catch {
            throw new ApiError(401, 'PARTICIPANT_REQUIRED', 'Create a participant to make changes');
        }
    }
    async writer(request: ApiRequest) { this.origin(request); return this.me(request); }
    create(displayName: string) { return this.db.client.participant.create({ data: { displayName } }); }
    async rename(request: ApiRequest, displayName: string) { const me = await this.writer(request); return this.db.client.participant.update({ where: { id: me.id }, data: { displayName, version: { increment: 1 } } }); }
}
