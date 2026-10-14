import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { VariantsService } from './variants.service.js';
import type { ApiRequest } from '../participants/participants.service.js';
@Controller()
export class VariantsController {
    constructor(
    @Inject(VariantsService)
    private readonly variants: VariantsService) { }
    @Get('pages/:id/variants')
    list(
    @Param('id')
    id: string,
    @Query()
    query: unknown) { return this.variants.list(id, query); }
    @Post('pages/:id/variants')
    create(
    @Param('id')
    id: string,
    @Req()
    request: ApiRequest,
    @Body()
    body: unknown) { return this.variants.create(id, request, body); }
    @Get('variants/:id')
    get(
    @Param('id')
    id: string) { return this.variants.get(id); }
    @Patch('variants/:id')
    patch(
    @Param('id')
    id: string,
    @Req()
    request: ApiRequest,
    @Body()
    body: unknown) { return this.variants.patch(id, request, body); }
    @Get('capture-profiles')
    profiles() { return this.variants.profiles(); }
}
