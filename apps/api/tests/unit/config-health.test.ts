import { describe, expect, it } from 'vitest';
import { validateConfig } from '../../src/config/config.js';
import { HealthController } from '../../src/health/health.controller.js';
const local = {NODE_ENV:'development', APP_ORIGIN:'http://localhost:8080',DATABASE_URL:'postgresql://qa:local@localhost:5432/design_qa_dev',MINIO_ENDPOINT:'http://localhost:9000',MINIO_BUCKET:'design-qa-dev',MINIO_ACCESS_KEY:'local-access',MINIO_SECRET_KEY:'local-secret',SESSION_SIGNING_KEY:'local-only-signing-key-32-characters'};
describe('startup configuration', () => {
 it('requires dependency credentials without echoing secrets', () => {expect(()=>validateConfig({...local,MINIO_SECRET_KEY:''})).toThrow('MINIO_SECRET_KEY');});
 it('rejects HTTP production origin and embedded URL credentials',()=>{expect(()=>validateConfig({...local,NODE_ENV:'production'})).toThrow('APP_ORIGIN');expect(()=>validateConfig({...local,APP_ORIGIN:'https://secret:password@example.com'})).toThrow('APP_ORIGIN');});
 it('requires isolated database and bucket in test mode',()=>{expect(()=>validateConfig({...local,NODE_ENV:'test'})).toThrow('test'); expect(validateConfig({...local,NODE_ENV:'test',DATABASE_URL:'postgresql://qa:local@localhost/design_qa_test',MINIO_BUCKET:'design-qa-test'}).bucket).toBe('design-qa-test');});
 it('rejects malformed endpoints, ports and enabled capture',()=>{expect(()=>validateConfig({...local,MINIO_ENDPOINT:'ftp://localhost'})).toThrow('MINIO_ENDPOINT');expect(()=>validateConfig({...local,PORT:'NaN'})).toThrow('PORT');expect(()=>validateConfig({...local,CAPTURE_ENABLED:'true'})).toThrow('CAPTURE_ENABLED');});
});
describe('health contract',()=>{
 it('reports live even when the database is unavailable', async()=>{const health=new HealthController({check:async()=>{throw new Error('secret database URL');}} as never,{check:async()=>true} as never); expect(health.live()).toEqual({status:'ok'}); await expect(health.ready()).rejects.toMatchObject({status:503,response:{status:'unavailable',checks:{database:false,storage:true}}});});
 it('requires both dependencies for readiness',async()=>{const health=new HealthController({check:async()=>true} as never,{check:async()=>false} as never);await expect(health.ready()).rejects.toMatchObject({status:503});});
 it('reports ready with reachable dependencies',async()=>{const health=new HealthController({check:async()=>true} as never,{check:async()=>true} as never);await expect(health.ready()).resolves.toEqual({status:'ok',checks:{database:true,storage:true}});});
});
it('bounds readiness when a dependency stops responding',async()=>{
 const health=new HealthController({check:()=>new Promise(()=>{})} as never,{check:async()=>true} as never);
 const started=Date.now();
 await expect(health.ready()).rejects.toMatchObject({status:503});
 expect(Date.now()-started).toBeLessThan(3500);
},4000);
