import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { CONFIG, type AppConfig } from './config/config.js';
const app = await NestFactory.create(AppModule);
const config=app.get<AppConfig>(CONFIG);
app.setGlobalPrefix('api/v1');
app.enableShutdownHooks();
await app.listen(config.port,config.host);
