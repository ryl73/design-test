import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { CONFIG, type AppConfig } from '../config/config.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(@Inject(CONFIG) config: AppConfig) {
    this.client = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: config.databaseUrl,
        connectionTimeoutMillis: 2000,
        statement_timeout: 2000,
      }),
    });
  }

  async check() {
    await this.client.$queryRaw`SELECT 1`;
    return true;
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
