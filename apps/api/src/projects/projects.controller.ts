import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ProjectsService } from './projects.service.js';
import type { ApiRequest } from '../participants/participants.service.js';
@Controller('projects')
export class ProjectsController {
    constructor(
    @Inject(ProjectsService)
    private readonly projects: ProjectsService) { }
    @Get()
    list(
    @Query()
    query: unknown) { return this.projects.list(query); }
    @Post()
    create(
    @Req()
    request: ApiRequest,
    @Body()
    body: unknown) { return this.projects.create(request, body); }
    @Get(':id')
    get(
    @Param('id')
    id: string) { return this.projects.get(id); }
    @Patch(':id')
    patch(
    @Param('id')
    id: string,
    @Req()
    request: ApiRequest,
    @Body()
    body: unknown) { return this.projects.patch(id, request, body); }
}
