import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { PagesService } from './pages.service.js';
import type { ApiRequest } from '../participants/participants.service.js';
@Controller()
export class PagesController {
    constructor(
    @Inject(PagesService)
    private readonly pages: PagesService) { }
    @Get('projects/:id/pages')
    list(
    @Param('id')
    id: string,
    @Query()
    query: unknown) { return this.pages.list(id, query); }
    @Post('projects/:id/pages')
    create(
    @Param('id')
    id: string,
    @Req()
    request: ApiRequest,
    @Body()
    body: unknown) { return this.pages.create(id, request, body); }
    @Get('pages/:id')
    get(
    @Param('id')
    id: string) { return this.pages.get(id); }
    @Patch('pages/:id')
    patch(
    @Param('id')
    id: string,
    @Req()
    request: ApiRequest,
    @Body()
    body: unknown) { return this.pages.patch(id, request, body); }
}
