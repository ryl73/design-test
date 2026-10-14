import { Inject, Injectable } from '@nestjs/common';
import { Client } from 'minio';
import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
import { CONFIG, type AppConfig } from '../config/config.js';

@Injectable()
export class StorageService {
  readonly client: Client;

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {
    const ssl = config.endpoint.protocol === 'https:';
    this.client = new Client({
      endPoint: config.endpoint.hostname,
      port: Number(config.endpoint.port || (ssl ? 443 : 80)),
      useSSL: ssl,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      transportAgent: ssl ? new HttpsAgent({ timeout: 2000 }) : new HttpAgent({ timeout: 2000 }),
    });
  }

  async check() {
    return this.client.bucketExists(this.config.bucket);
  }
}
