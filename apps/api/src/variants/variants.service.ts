import { variantView } from '../http/structure-view.js';
import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { lockPage, lockVariant } from '../database/structure-locks.js';
import { active, checkVersion, missing } from '../http/errors.js';
import { effectiveProfile, fields, listed, pagination, savedUrl, uuid } from '../http/validation.js';
import { CONFIG, type AppConfig } from '../config/config.js';
import { ParticipantsService, type ApiRequest } from '../participants/participants.service.js';
import { Prisma } from '../generated/prisma/client.js';
@Injectable()
export class VariantsService {
    constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
    @Inject(CONFIG)
    private readonly config: AppConfig,
    @Inject(ParticipantsService)
    private readonly participants: ParticipantsService) { }
    async list(pageId: string, query: unknown) { uuid(pageId); missing(await this.db.client.page.findUnique({ where: { id: pageId } })); const p = pagination(query); const rows = await this.db.client.variant.findMany({ where: { ...p.where, pageId }, take: p.limit + 1, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], include: { page: { select: { archivedAt: true, project: { select: { archivedAt: true } } } } } }); return listed(rows.map(variantView), p.limit); }
    async get(id: string) { return variantView(missing(await this.db.client.variant.findUnique({ where: { id: uuid(id) }, include: { page: { select: { archivedAt: true, project: { select: { archivedAt: true } } } } } }))); }
    async create(pageId: string, request: ApiRequest, body: unknown) { await this.participants.writer(request); uuid(pageId); const data = fields(body, 'variant', false, this.config); return this.db.client.$transaction(async (tx) => { const { project, page } = await lockPage(tx, pageId); active(project.archivedAt); active(page.archivedAt); effectiveProfile(savedUrl(data.urlOverride ?? page.url, this.config), data.authProfileRef, this.config); return variantView(await tx.variant.create({ data: { ...data, pageId, ...(data.authProfileRef === null ? { authProfileRef: Prisma.DbNull } : {}) } as Prisma.VariantUncheckedCreateInput })); }); }
    async patch(id: string, request: ApiRequest, body: unknown) {
        await this.participants.writer(request);
        uuid(id);
        const { version, ...data } = fields(body, 'variant', true, this.config);
        return this.db.client.$transaction(async (tx) => {
            const { project, page, variant } = await lockVariant(tx, id);
            active(project.archivedAt);
            active(page.archivedAt);
            checkVersion(variant.version, version as number);
            if (data.archivedAt !== null)
                active(variant.archivedAt);
            const effective = savedUrl((data.urlOverride === undefined ? variant.urlOverride : data.urlOverride) ?? page.url, this.config);
            effectiveProfile(effective, data.authProfileRef === undefined ? variant.authProfileRef : data.authProfileRef, this.config);
            if (data.viewportWidth !== undefined && data.viewportWidth !== variant.viewportWidth && variant.currentBaselineId) {
                const baseline = missing(await tx.baselineVersion.findUnique({ where: { id: variant.currentBaselineId }, include: { asset: true } }));
                if (baseline.asset.width !== data.viewportWidth)
                    data.currentBaselineId = null;
            }
            await tx.variant.updateMany({ where: { id, version: version as number }, data: { ...data, version: { increment: 1 }, ...(data.authProfileRef === null ? { authProfileRef: Prisma.DbNull } : {}) } as Prisma.VariantUpdateManyMutationInput });
            return variantView(missing(await tx.variant.findUnique({ where: { id } })));
        });
    }
    profiles() { return { items: this.config.captureProfiles }; }
}
