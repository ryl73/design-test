import { createHmac } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { DatabaseService } from '../../apps/api/src/database/database.service.js';
import { validateConfig } from '../../apps/api/src/config/config.js';
import { beforeAll, afterAll, expect, it } from 'vitest';
let server: ChildProcess;
const origin = 'http://localhost:58080';
const base = 'http://127.0.0.1:55304/api/v1';
let cookie = '';
const db = new DatabaseService(validateConfig({ ...process.env, NODE_ENV: 'test' }));
async function request(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json(), headers: response.headers };
}
beforeAll(async () => {
    server = spawn(process.execPath, ['dist/main.js'], { cwd: new URL('../../apps/api/', import.meta.url), env: { ...process.env, NODE_ENV: 'test', PORT: '55304' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    server.stderr?.on('data', v => output += String(v));
    for (let i = 0; i < 100; i++) {
        if (server.exitCode !== null)
            throw new Error(output);
        try {
            const r = await fetch(base + '/health/live');
            if (r.ok)
                return;
        }
        catch { /* API has not bound its loopback socket yet. */ }
        await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('API startup timeout ' + output);
}, 15000);
afterAll(async () => { await db.onModuleDestroy(); if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await once(server, 'exit');
} });
it('creates a signed participant cookie only for exact Origin and rejects anonymous structure writes', async () => {
    expect((await request('/participants', 'POST', { displayName: 'QA' }, { Origin: 'http://evil.example' })).status).toBe(403);
    expect((await request('/projects', 'POST', { name: 'No session' })).status).toBe(401);
    const result = await request('/participants', 'POST', { displayName: 'QA participant' });
    expect(result.status).toBe(201);
    expect(result.body.displayName).toBe('QA participant');
    cookie = result.headers.get('set-cookie')?.split(';')[0] ?? '';
    expect(result.headers.get('set-cookie')).toMatch(/HttpOnly/i);
    expect(result.headers.get('set-cookie')).toMatch(/SameSite=Strict/i);
    expect(result.headers.get('set-cookie')).toMatch(/Max-Age=2592000/);
    expect(cookie).not.toBe('');
    expect((await request('/participants/me')).body.id).toBe(result.body.id);
    expect((await request('/participants/me', 'PATCH', { displayName: 'Renamed' })).body.displayName).toBe('Renamed');
    expect((await request('/participants/me', 'GET', undefined, { Cookie: cookie + 'tampered' })).status).toBe(401);
    expect((await request('/participants', 'POST', {displayName:'QA'}, {Origin:'http://127.0.0.1:58080'})).status).toBe(403);
    expect((await request('/participants', 'POST', {displayName:'QA'}, {Origin:''})).status).toBe(403);
    const expiredPayload=Buffer.from(JSON.stringify({participantId:result.body.id,expiresAt:Date.now()-1})).toString('base64url');
    const expiredSignature=createHmac('sha256',process.env.SESSION_SIGNING_KEY!).update(expiredPayload).digest('base64url');
    expect((await request('/participants/me','GET',undefined,{Cookie:'design_qa_participant='+expiredPayload+'.'+expiredSignature})).status).toBe(401);
    const absent=await request('/missing');expect(absent.status).toBe(404);expect(absent.body.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
});
it('persists structure, rejects invalid input, and serializes conflicting PATCHes', async () => {
    const project = await request('/projects', 'POST', { name: 'Structure ' + Date.now(), description: 'QA' });
    expect(project.status).toBe(201);
    const page = await request(`/projects/${project.body.id}/pages`, 'POST', { name: 'Page', url: 'https://example.com/path' });
    expect(page.status).toBe(201);
    const variant = await request(`/pages/${page.body.id}/variants`, 'POST', { name: 'Desktop', viewportWidth: 1280, viewportHeight: 720 });
    expect(variant.status).toBe(201);
    for (const body of [{ name: 'Bad', viewportWidth: 319, viewportHeight: 720 }, { name: 'Bad', viewportWidth: 2561, viewportHeight: 720 }, { name: ' ', viewportWidth: 1280, viewportHeight: 720 }, { name: 'Bad', viewportWidth: 1280, viewportHeight: 720, unknown: true }])
        expect((await request(`/pages/${page.body.id}/variants`, 'POST', body)).status).toBe(400);
    for (const url of ['javascript:alert(1)', 'https://user:pass@example.com', 'https://example.com/#secret', 'https://example.com/?access_token=x', 'https://not-allowed.example/'])
        expect([400, 403]).toContain((await request(`/projects/${project.body.id}/pages`, 'POST', { name: 'Bad', url })).status);
    const writes = await Promise.all(['One', 'Two'].map(name => request(`/variants/${variant.body.id}`, 'PATCH', { version: 1, name })));
    expect(writes.map(r => r.status).sort()).toEqual([200, 409]);
    expect(writes.find(r => r.status === 409)?.body.error.code).toBe('VERSION_CONFLICT');
    expect((await request(`/variants/${variant.body.id}`)).body.version).toBe(2);
    expect((await request(`/variants/${variant.body.id}`, 'PATCH', { version: 2, name: 'Bad' }, { Origin: 'null' })).status).toBe(403);
    const archiveChild = await request(`/variants/${variant.body.id}`, 'PATCH', { version: 2, archived: true });
    expect(archiveChild.status).toBe(200);
    expect((await request(`/projects/${project.body.id}`, 'PATCH', { version: 1, archived: true })).status).toBe(200);
    expect((await request(`/pages/${page.body.id}`)).body.effectiveArchived).toBe(true);
    expect((await request(`/variants/${variant.body.id}`)).body.effectiveArchived).toBe(true);
    expect((await request(`/pages/${page.body.id}`, 'PATCH', { version: 1, name: 'Blocked' })).status).toBe(409);
    expect((await request(`/variants/${variant.body.id}`, 'PATCH', { version: 3, archived: false })).status).toBe(409);
    expect((await request(`/projects/${project.body.id}`, 'PATCH', { version: 2, archived: false })).status).toBe(200);
    expect((await request(`/variants/${variant.body.id}`)).body.archivedAt).not.toBeNull();
    expect((await request(`/variants/${variant.body.id}`, 'PATCH', { version: 3, archived: false })).status).toBe(200);
    expect((await request(`/pages/${page.body.id}/variants`)).body.items).toHaveLength(1);
    for (const query of ['limit=0', 'limit=101', 'limit=1.5', 'archived=invalid', 'extra=1', 'cursor=broken'])
        expect((await request('/projects?' + query)).status).toBe(400);
    const list = await request('/projects?limit=1&archived=all');
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    if (list.body.nextCursor) {
        const next = await request('/projects?limit=1&archived=all&cursor=' + encodeURIComponent(list.body.nextCursor));
        expect(next.status).toBe(200);
        expect(next.body.items[0]?.id).not.toBe(list.body.items[0].id);
    }
    expect((await request('/projects?archived=all', 'GET', undefined, { Cookie: '' })).status).toBe(200);
    expect((await request('/capture-profiles')).body).toEqual({ items: [] });
});
it('clears a current baseline only when width becomes incompatible, and preserves history', async () => {
    const project = (await request('/projects', 'POST', { name: 'Baseline width' })).body;
    const page = (await request(`/projects/${project.id}/pages`, 'POST', { name: 'Page', url: 'https://example.com' })).body;
    const variant = (await request(`/pages/${page.id}/variants`, 'POST', { name: 'Desktop', viewportWidth: 1280, viewportHeight: 720 })).body;
    const participant = (await request('/participants/me')).body;
    const asset = await db.client.asset.create({ data: { kind: 'BASELINE', objectKey: crypto.randomUUID(), sha256: 'b'.repeat(64), width: 1280, height: 900, bytes: 1024n } });
    const baseline = await db.client.baselineVersion.create({ data: { variantId: variant.id, number: 1, assetId: asset.id, sourceMetadata: {}, authorId: participant.id, authorNameSnapshot: participant.displayName } });
    await db.client.variant.update({ where: { id: variant.id }, data: { currentBaselineId: baseline.id } });
    expect((await request(`/variants/${variant.id}`, 'PATCH', { version: 1, viewportHeight: 900 })).body.currentBaselineId).toBe(baseline.id);
    expect((await request(`/variants/${variant.id}`, 'PATCH', { version: 2, viewportWidth: 1440 })).body.currentBaselineId).toBeNull();
    expect(await db.client.baselineVersion.findUnique({ where: { id: baseline.id } })).not.toBeNull();
});
it('allows archive, restore and metadata edits after an operator retires a URL origin or profile', async () => {
    const participant=(await request('/participants/me')).body;
    const project=await db.client.project.create({data:{name:'Retired policy',authorId:participant.id}});
    const page=await db.client.page.create({data:{projectId:project.id,name:'Retired page',url:'https://retired.example/page'}});
    // Persisted settings represent saves made under an earlier operator configuration.
    const variants=await Promise.all([
        db.client.variant.create({data:{pageId:page.id,name:'Removed origin',viewportWidth:1280,viewportHeight:720}}),
        db.client.variant.create({data:{pageId:page.id,name:'Removed profile',viewportWidth:1280,viewportHeight:720,urlOverride:'https://example.com/',authProfileRef:{profileId:'retired-profile',version:1}}}),
    ]);
    for(const variant of variants){
        expect((await request(`/variants/${variant.id}`,'PATCH',{version:1,archived:true})).status).toBe(200);
        expect((await request(`/variants/${variant.id}`,'PATCH',{version:2,archived:false})).status).toBe(200);
        expect((await request(`/variants/${variant.id}`,'PATCH',{version:3,name:'Renamed after retirement'})).status).toBe(200);
        expect((await request(`/variants/${variant.id}`)).body.version).toBe(4);
    }
    expect((await request(`/pages/${page.id}`,'PATCH',{version:1,archived:true})).status).toBe(200);
    expect((await request(`/pages/${page.id}`,'PATCH',{version:2,archived:false})).status).toBe(200);
    expect((await request(`/variants/${variants[0]!.id}`,'PATCH',{version:4,urlOverride:'https://retired.example/new'})).status).toBe(403);
    expect((await request(`/variants/${variants[1]!.id}`,'PATCH',{version:4,urlOverride:'https://example.com/new'})).status).toBe(400);
});
it('does not revalidate unchanged variant URL overrides when changing a page URL',async()=>{
    const participant=(await request('/participants/me')).body;
    const project=await db.client.project.create({data:{name:'Override retirement',authorId:participant.id}});
    const page=await db.client.page.create({data:{projectId:project.id,name:'Page',url:'https://example.com/'}});
    await db.client.variant.create({data:{pageId:page.id,name:'Retired override',viewportWidth:1280,viewportHeight:720,urlOverride:'https://retired.example/',authProfileRef:{profileId:'retired-profile',version:1}}});
    const result=await request(`/pages/${page.id}`,'PATCH',{version:1,url:'https://example.com/new'});
    expect(result.status).toBe(200);
    expect(result.body.url).toBe('https://example.com/new');
});
