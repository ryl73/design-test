import { afterAll, expect, it } from 'vitest';
import { validateConfig } from '../../apps/api/src/config/config.js';
import { DatabaseService } from '../../apps/api/src/database/database.service.js';
import { StorageService } from '../../apps/api/src/storage/storage.service.js';
const config=validateConfig({...process.env,NODE_ENV:'test'});
const database=new DatabaseService(config);
const storage=new StorageService(config);
afterAll(async()=>{await database.onModuleDestroy();});
it('reaches the explicitly isolated test database and private bucket',async()=>{
 expect(await database.check()).toBe(true);
 expect(await storage.check()).toBe(true);
 const rows=await database.client.$queryRaw<{current_database:string}[]>`SELECT current_database()`;
 expect(rows[0]?.current_database).toBe('design_qa_test');
 // A public policy would make test fixture storage externally readable.
 await expect(storage.client.getBucketPolicy(config.bucket)).rejects.toMatchObject({code:'NoSuchBucketPolicy'});
});
