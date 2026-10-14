import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { CONFIG, validateConfig } from './config/config.js';
import { DatabaseService } from './database/database.service.js';
import { StorageService } from './storage/storage.service.js';
import { HealthController } from './health/health.controller.js';
@Module({ controllers: [AppController,HealthController],providers:[{provide:CONFIG,useFactory:()=>validateConfig(process.env)},DatabaseService,StorageService] })
export class AppModule {}
