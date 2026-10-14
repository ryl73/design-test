import { pageView } from '../http/structure-view.js';
import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { lockPage, lockProject } from '../database/structure-locks.js';
import { active, checkVersion, missing } from '../http/errors.js';
import { effectiveProfile, fields, listed, pagination, savedUrl, uuid } from '../http/validation.js';
import { CONFIG, type AppConfig } from '../config/config.js';
import { ParticipantsService, type ApiRequest } from '../participants/participants.service.js';
import type { Prisma } from '../generated/prisma/client.js';
@Injectable()
export class PagesService {
    constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
    @Inject(CONFIG)
    private readonly config: AppConfig,
    @Inject(ParticipantsService)
    private readonly participants: ParticipantsService) { }
    async list(projectId: string, query: unknown) { uuid(projectId); missing(await this.db.client.project.findUnique({ where: { id: projectId } })); const p = pagination(query); const rows = await this.db.client.page.findMany({ where: { ...p.where, projectId }, take: p.limit + 1, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], include: { project: { select: { archivedAt: true } } } }); return listed(rows.map(pageView), p.limit); }
    async get(id: string) { return pageView(missing(await this.db.client.page.findUnique({ where: { id: uuid(id) }, include: { project: { select: { archivedAt: true } } } }))); }
    async create(projectId: string, request: ApiRequest, body: unknown) { await this.participants.writer(request); uuid(projectId); const data = fields(body, 'page', false, this.config); return this.db.client.$transaction(async (tx) => { const project = await lockProject(tx, projectId); active(project.archivedAt); return pageView(await tx.page.create({ data: { ...data, projectId } as Prisma.PageUncheckedCreateInput })); }); }
    async patch(id: string, request: ApiRequest, body: unknown) {
        await this.participants.writer(request);
        uuid(id);
        const { version, ...data } = fields(body, 'page', true, this.config);
        return this.db.client.$transaction(async (tx) => {
            const { project, page } = await lockPage(tx, id);
            active(project.archivedAt);
            checkVersion(page.version, version as number);
            if (data.archivedAt !== null)
                active(page.archivedAt);
            if (data.url !== undefined) {
                // Only inherited URLs change; explicit variant overrides retain their saved settings.
                const variants = await tx.variant.findMany({ where: { pageId: id, urlOverride: null }, orderBy: { id: 'asc' } });
                for (const variant of variants) {
                    await tx.$queryRaw `SELECT id FROM "Variant" WHERE id=${variant.id}::uuid FOR UPDATE`;
                    const effective = savedUrl(variant.urlOverride ?? data.url, this.config);
                    effectiveProfile(effective, variant.authProfileRef, this.config);
                }
            }
            await tx.page.updateMany({ where: { id, version: version as number }, data: { ...data, version: { increment: 1 } } as Prisma.PageUpdateManyMutationInput });
            return pageView(missing(await tx.page.findUnique({ where: { id } })));
        });
    }
}
