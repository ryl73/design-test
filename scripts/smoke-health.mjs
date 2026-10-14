// Read-only smoke; pause/resume only this Compose project's PostgreSQL separately.
import assert from 'node:assert/strict';
const origin=process.env.SMOKE_ORIGIN ?? 'http://localhost:58080';
const degraded=process.argv.includes('--database-unavailable');
for(const [path,expected] of [['live',200],['ready',degraded?503:200]]){
 const response=await fetch(`${origin}/api/v1/health/${path}`,{signal:AbortSignal.timeout(5000)});
 assert.equal(response.status,expected);
 const body=await response.json();
 if(path==='ready') assert.deepEqual(body.checks,{database:!degraded,storage:true});
 console.log(`${path}: ${response.status}`);
}
