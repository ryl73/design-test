import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { StorageService } from '../storage/storage.service.js';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(StorageService) private readonly storage: StorageService,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    const bounded = async (check: Promise<boolean>) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          check,
          new Promise<boolean>((resolve) => {
            timer = setTimeout(() => resolve(false), 2500);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    };
    const results = await Promise.allSettled([
      bounded(this.database.check()),
      bounded(this.storage.check()),
    ]);
    const checks = {
      database: results[0]?.status === 'fulfilled' && results[0].value === true,
      storage: results[1]?.status === 'fulfilled' && results[1].value === true,
    };
    if (!checks.database || !checks.storage) {
      throw new ServiceUnavailableException({ status: 'unavailable', checks });
    }
    return { status: 'ok', checks };
  }
}
