import { projectView } from '../http/structure-view.js';
import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { lockProject } from '../database/structure-locks.js';
import { active, checkVersion, missing } from '../http/errors.js';
import { fields, listed, pagination, uuid } from '../http/validation.js';
import { CONFIG, type AppConfig } from '../config/config.js';
import { ParticipantsService, type ApiRequest } from '../participants/participants.service.js';
import type { Prisma } from '../generated/prisma/client.js';
@Injectable()
export class ProjectsService {
    constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
    @Inject(CONFIG)
    private readonly config: AppConfig,
    @Inject(ParticipantsService)
    private readonly participants: ParticipantsService) { }
    async list(query: unknown) { const p = pagination(query); const rows = await this.db.client.project.findMany({ where: p.where, take: p.limit + 1, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }); return listed(rows.map(projectView), p.limit); }
    async get(id: string) { return projectView(missing(await this.db.client.project.findUnique({ where: { id: uuid(id) } }))); }
    async create(request: ApiRequest, body: unknown) { const author = await this.participants.writer(request); const data = fields(body, 'project', false, this.config); return projectView(await this.db.client.project.create({ data: { ...data, authorId: author.id } as Prisma.ProjectUncheckedCreateInput })); }
    async patch(id: string, request: ApiRequest, body: unknown) {
        await this.participants.writer(request);
        uuid(id);
        const { version, ...data } = fields(body, 'project', true, this.config);
        return this.db.client.$transaction(async (tx) => {
            const project = await lockProject(tx, id);
            checkVersion(project.version, version as number);
            if (data.archivedAt !== null)
                active(project.archivedAt);
            await tx.project.updateMany({ where: { id, version: version as number }, data: { ...data, version: { increment: 1 } } as Prisma.ProjectUpdateManyMutationInput });
            return projectView(missing(await tx.project.findUnique({ where: { id } })));
        });
    }
}
