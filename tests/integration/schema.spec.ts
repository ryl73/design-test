import { randomUUID } from 'node:crypto';
import { afterAll, expect, it } from 'vitest';
import { validateConfig } from '../../apps/api/src/config/config.js';
import { DatabaseService } from '../../apps/api/src/database/database.service.js';
import type { Prisma } from '../../apps/api/src/generated/prisma/client.js';
const db = new DatabaseService(validateConfig({ ...process.env, NODE_ENV: 'test' }));
afterAll(() => db.onModuleDestroy());
type Tx = Prisma.TransactionClient;
const rollback = new Error('rollback schema fixture');
async function fixture(tx: Tx) {
 const ids = Object.fromEntries(['participant','project','page','variant','other','asset','baseline','job','revision','issue','review','comment','event'].map(k => [k, randomUUID()])) as Record<string,string>;
 async function insert(table: string, data: Record<string, unknown>) {
  const keys = Object.keys(data);
  await tx.$executeRawUnsafe(`INSERT INTO "${table}" (${keys.map(k=>`"${k}"`).join(',')}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(',')})`, ...Object.values(data).map(value => typeof value === 'number' && !Number.isFinite(value) ? String(value) : value));
 }
 const now = new Date();
 await insert('Participant',{id:ids.participant,displayName:'Schema fixture',updatedAt:now});
 await insert('Project',{id:ids.project,name:'Schema fixture',authorId:ids.participant,updatedAt:now});
 await insert('Page',{id:ids.page,projectId:ids.project,name:'Page',url:'https://example.com',updatedAt:now});
 for(const id of [ids.variant,ids.other]) await insert('Variant',{id,pageId:ids.page,name:'Desktop',viewportWidth:1280,viewportHeight:720,updatedAt:now});
 await insert('Asset',{id:ids.asset,kind:'BASELINE',objectKey:randomUUID(),sha256:'a'.repeat(64),width:1280,height:720,bytes:1024});
 await insert('BaselineVersion',{id:ids.baseline,variantId:ids.variant,number:1,assetId:ids.asset,sourceMetadata:'{}',authorId:ids.participant,authorNameSnapshot:'Author'});
 await insert('CaptureJob',{id:ids.job,variantId:ids.variant,number:1,state:'RUNNING',inputSnapshot:'{}',requesterId:ids.participant,requesterNameSnapshot:'Author',idempotencyKey:randomUUID(),requestHash:'a'.repeat(64)});
 await insert('ReviewRevision',{id:ids.revision,variantId:ids.variant,number:1,baselineId:ids.baseline,screenshotAssetId:ids.asset,captureJobId:ids.job,captureSnapshot:'{}',finalUrl:'https://example.com',browserVersion:'test',captureEngineVersion:'test',capturedAt:now});
 await tx.$executeRawUnsafe('UPDATE "CaptureJob" SET state=\'SUCCEEDED\', "revisionId"=$1 WHERE id=$2',ids.revision,ids.job);
 await insert('Issue',{id:ids.issue,variantId:ids.variant,originRevisionId:ids.revision,originalX:0,originalY:0,originalWidth:10,originalHeight:10,authorId:ids.participant,authorNameSnapshot:'Author'});
 await insert('IssueReview',{id:ids.review,variantId:ids.variant,issueId:ids.issue,revisionId:ids.revision,state:'OPEN',placement:'CONFIRMED',x:0,y:0,width:10,height:10,updatedAt:now});
 await insert('Comment',{id:ids.comment,issueId:ids.issue,revisionId:ids.revision,participantId:ids.participant,authorNameSnapshot:'Author',body:'First comment'});
 await insert('IssueEvent',{id:ids.event,issueId:ids.issue,revisionId:ids.revision,type:'CREATED',participantId:ids.participant,authorNameSnapshot:'Author',commentId:ids.comment});
 return {ids,insert};
}
async function withFixture(action: (tx: Tx, f: Awaited<ReturnType<typeof fixture>>) => Promise<void>) {
 try { await db.client.$transaction(async tx=> {await action(tx,await fixture(tx)); await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE'); throw rollback;}, {timeout:15000}); }
 catch(error) { if(error!==rollback) throw error; }
}
it('persists the complete domain graph and mutable operational records',async()=>{
 await withFixture(async(tx,{ids,insert})=>{
  await tx.$executeRawUnsafe('UPDATE "Variant" SET "currentBaselineId"=$1, version=version+1 WHERE id=$2',ids.baseline,ids.variant);
  await insert('StorageReservation',{id:randomUUID(),bytes:20971520,expiresAt:new Date(Date.now()+60000)});
  await insert('WorkerHeartbeat',{id:randomUUID(),lastSeenAt:new Date(),captureReady:true,updatedAt:new Date()});
  const rows=await tx.$queryRawUnsafe<{count:bigint}[]>('SELECT count(*) FROM "IssueReview" WHERE id=$1',ids.review);
  expect(rows[0]?.count).toBe(1n);
 });
});
const invalid: [string,(tx:Tx,f:Awaited<ReturnType<typeof fixture>>)=>Promise<unknown>,string][]=[
 ['foreign current baseline',(tx,{ids})=>tx.$executeRawUnsafe('UPDATE "Variant" SET "currentBaselineId"=$1 WHERE id=$2',ids.baseline,ids.other),'23503'],
 ['foreign revision baseline',async(tx,{ids,insert})=>{const job=randomUUID();await insert('CaptureJob',{id:job,variantId:ids.other,number:2,state:'RUNNING',inputSnapshot:'{}',requesterId:ids.participant,requesterNameSnapshot:'A',idempotencyKey:randomUUID(),requestHash:'a'});return insert('ReviewRevision',{id:randomUUID(),variantId:ids.other,number:2,baselineId:ids.baseline,screenshotAssetId:ids.asset,captureJobId:job,captureSnapshot:'{}',finalUrl:'https://example.com',browserVersion:'test',captureEngineVersion:'test',capturedAt:new Date()});},'23503'],
 ['foreign source revision',(tx,{ids})=>tx.$executeRawUnsafe('UPDATE "CaptureJob" SET "variantId"=$1,"sourceRevisionId"=$2 WHERE id=$3',ids.other,ids.revision,ids.job),'23503'],
 ['foreign issue review',(tx,{ids})=>tx.$executeRawUnsafe('UPDATE "IssueReview" SET "variantId"=$1 WHERE id=$2',ids.other,ids.review),'23503'],
 ['duplicate issue review',(tx,{ids,insert})=>insert('IssueReview',{id:randomUUID(),variantId:ids.variant,issueId:ids.issue,revisionId:ids.revision,state:'OPEN',placement:'NEEDS_REANCHOR',updatedAt:new Date()}),'23505'],
 ['two active jobs',async(tx,{ids,insert})=>{await tx.$executeRawUnsafe('UPDATE "CaptureJob" SET state=\'QUEUED\' WHERE id=$1',ids.job);await insert('CaptureJob',{id:randomUUID(),variantId:ids.variant,number:2,state:'RUNNING',inputSnapshot:'{}',requesterId:ids.participant,requesterNameSnapshot:'A',idempotencyKey:randomUUID(),requestHash:'a'});},'23505'],
];
for(const [name,action,code] of invalid) it(`rejects ${name} independently of the API`,async()=>{
 await expect(withFixture(async(tx,f)=>{await action(tx,f);})).rejects.toMatchObject({meta:{driverAdapterError:{cause:{originalCode:code}}}});
});
for(const table of ['BaselineVersion','ReviewRevision','Asset','Comment','IssueEvent','Issue']) for(const operation of ['UPDATE','DELETE']) it(`forbids ${operation} of ${table} history`,async()=>{
 const key=({BaselineVersion:'baseline',ReviewRevision:'revision',Asset:'asset',Comment:'comment',IssueEvent:'event',Issue:'issue'} as const)[table as 'Issue'];
 await expect(withFixture(async(tx,{ids})=>{await tx.$executeRawUnsafe(operation==='UPDATE'?`UPDATE "${table}" SET "createdAt"=now() WHERE id=$1`:`DELETE FROM "${table}" WHERE id=$1`,ids[key]);})).rejects.toMatchObject({meta:{driverAdapterError:{cause:{originalCode:'23514'}}}});
});
for(const column of ['originalX','originalY','originalWidth','originalHeight','authorNameSnapshot','authorId']) it(`freezes Issue ${column}`,async()=>{
 await expect(withFixture(async(tx,{ids})=>{await tx.$executeRawUnsafe(`UPDATE "Issue" SET "${column}"=$1 WHERE id=$2`,column==='authorId'?randomUUID():column==='authorNameSnapshot'?'Changed':3,ids.issue);})).rejects.toMatchObject({meta:{driverAdapterError:{cause:{originalCode:'23514'}}}});
});
for(const [column,value] of [['viewportWidth',319],['viewportWidth',2561],['viewportHeight',319],['viewportHeight',1601],['settleDelayMs',-1],['settleDelayMs',3001],['nextBaselineNumber',0],['nextJobNumber',0],['nextRevisionNumber',0],['version',0]] as const) it(`rejects Variant ${column}=${value}`,async()=>{
 await expect(withFixture(async(tx,{ids})=>{await tx.$executeRawUnsafe(`UPDATE "Variant" SET "${column}"=$1 WHERE id=$2`,value,ids.variant);})).rejects.toMatchObject({meta:{driverAdapterError:{cause:{originalCode:'23514'}}}});
});
for(const column of ['x','y','width','height']) for(const value of [NaN,Infinity,-Infinity,-1]) it(`rejects ${column}=${value}`,async()=>{
 await expect(withFixture(async(tx,{ids})=>{await tx.$executeRawUnsafe(`UPDATE "IssueReview" SET "${column}"=$1 WHERE id=$2`,String(value),ids.review);})).rejects.toMatchObject({meta:{driverAdapterError:{cause:{originalCode:'23514'}}}});
});
for(const set of ['x=NULL',"placement='NEEDS_REANCHOR'",'width=0','height=0']) it(`rejects invalid placement ${set}`,async()=>{
 await expect(withFixture(async(tx,{ids})=>{await tx.$executeRawUnsafe(`UPDATE "IssueReview" SET ${set} WHERE id=$1`,ids.review);})).rejects.toMatchObject({meta:{driverAdapterError:{cause:{originalCode:'23514'}}}});
});
it('allows unplaced carried issues and later confirmed reanchoring with a version increment',async()=>withFixture(async(tx,{ids})=>{
 await tx.$executeRawUnsafe('UPDATE "IssueReview" SET placement=\'NEEDS_REANCHOR\',x=NULL,y=NULL,width=NULL,height=NULL,version=version+1 WHERE id=$1',ids.review);
 await tx.$executeRawUnsafe('UPDATE "IssueReview" SET placement=\'CONFIRMED\',x=1.5,y=2.5,width=10,height=10,version=version+1 WHERE id=$1',ids.review);
 const rows=await tx.$queryRawUnsafe<{version:number}[]>('SELECT version FROM "IssueReview" WHERE id=$1',ids.review);expect(rows[0]?.version).toBe(3);
}));

it('rejects a published revision whose job does not point back to it',async()=>{
 await expect(withFixture(async(tx,{ids})=>{
  await tx.$executeRawUnsafe('UPDATE "CaptureJob" SET "revisionId"=NULL WHERE id=$1',ids.job);
  await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
 })).rejects.toMatchObject({meta:{driverAdapterError:{cause:{originalCode:'23514'}}}});
});
for(const [column,value] of [['width',0],['height',10001],['bytes',0],['mime','image/jpeg']] as const) it(`rejects Asset ${column}=${value}`,async()=>{
 await expect(withFixture(async(_tx,{insert})=>{
  await insert('Asset',{id:randomUUID(),kind:'BASELINE',objectKey:randomUUID(),sha256:'b'.repeat(64),width:1280,height:720,bytes:1024,[column]:value});
 })).rejects.toMatchObject({meta:{driverAdapterError:{cause:{originalCode:'23514'}}}});
});

for(const column of ['originalX','originalY','originalWidth','originalHeight']) for(const value of [NaN,Infinity,-Infinity,-1]) it(`rejects original geometry ${column}=${value}`,async()=>{
 await expect(withFixture(async(_tx,{ids,insert})=>{
  await insert('Issue',{id:randomUUID(),variantId:ids.variant,originRevisionId:ids.revision,originalX:0,originalY:0,originalWidth:10,originalHeight:10,authorId:ids.participant,authorNameSnapshot:'Author',[column]:value});
 })).rejects.toMatchObject({meta:{driverAdapterError:{cause:{originalCode:'23514'}}}});
});
it('rejects a source issue review belonging to a different issue',async()=>{
 await expect(withFixture(async(tx,{ids,insert})=>{
  const issue=randomUUID();
  await insert('Issue',{id:issue,variantId:ids.variant,originRevisionId:ids.revision,originalX:0,originalY:0,originalWidth:10,originalHeight:10,authorId:ids.participant,authorNameSnapshot:'Author'});
  const review=randomUUID();
  await insert('IssueReview',{id:review,variantId:ids.variant,issueId:issue,revisionId:ids.revision,state:'OPEN',placement:'NEEDS_REANCHOR'});
  await tx.$executeRawUnsafe('UPDATE "IssueReview" SET "sourceIssueReviewId"=$1 WHERE id=$2',review,ids.review);
 })).rejects.toMatchObject({meta:{driverAdapterError:{cause:{originalCode:'23503'}}}});
});
