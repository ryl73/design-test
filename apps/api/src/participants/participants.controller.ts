import { Body, Controller, Get, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import { ParticipantsService, type ApiRequest } from './participants.service.js';
import { object, text } from '../http/validation.js';
@Controller('participants')
export class ParticipantsController {
    constructor(
    @Inject(ParticipantsService)
    private readonly participants: ParticipantsService) { }
    @Post()
    async create(
    @Req()
    request: ApiRequest,
    @Body()
    body: unknown,
    @Res({ passthrough: true })
    response: {
        setHeader: (name: string, value: string) => void;
    }) { this.participants.origin(request); const data = object(body, ['displayName']); const participant = await this.participants.create(text(data.displayName, 'displayName', 120)); response.setHeader('Set-Cookie', this.participants.cookie(participant.id)); return participant; }
    @Get('me')
    me(
    @Req()
    request: ApiRequest) { return this.participants.me(request); }
    @Patch('me')
    rename(
    @Req()
    request: ApiRequest,
    @Body()
    body: unknown) { this.participants.origin(request); const data = object(body, ['displayName']); return this.participants.rename(request, text(data.displayName, 'displayName', 120)); }
}
