import { Controller, Get } from '@nestjs/common';
import type { BootstrapStatus } from '@design-qa/contracts';

@Controller()
export class AppController {
  @Get()
  status(): BootstrapStatus {
    return { service: 'api', stage: 'bootstrap' };
  }
}
