import { APP_FILTER } from '@nestjs/core';
import { ApiExceptionFilter } from './http/errors.js';
import { ParticipantsController } from './participants/participants.controller.js';
import { ParticipantsService } from './participants/participants.service.js';
import { ProjectsController } from './projects/projects.controller.js';
import { ProjectsService } from './projects/projects.service.js';
import { PagesController } from './pages/pages.controller.js';
import { PagesService } from './pages/pages.service.js';
import { VariantsController } from './variants/variants.controller.js';
import { VariantsService } from './variants/variants.service.js';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { CONFIG, validateConfig } from './config/config.js';
import { DatabaseService } from './database/database.service.js';
import { StorageService } from './storage/storage.service.js';
import { HealthController } from './health/health.controller.js';
@Module({ controllers: [AppController, HealthController, ParticipantsController, ProjectsController, PagesController, VariantsController], providers: [{ provide: CONFIG, useFactory: () => validateConfig(process.env) }, DatabaseService, StorageService, ParticipantsService, ProjectsService, PagesService, VariantsService, { provide: APP_FILTER, useClass: ApiExceptionFilter }] })
export class AppModule {
}
