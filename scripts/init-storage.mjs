import { Client } from 'minio';
const endpoint=new URL(process.env.MINIO_ENDPOINT);
const client=new Client({endPoint:endpoint.hostname,port:Number(endpoint.port || 9000),useSSL:endpoint.protocol==='https:',accessKey:process.env.MINIO_ACCESS_KEY,secretKey:process.env.MINIO_SECRET_KEY});
const buckets=[process.env.MINIO_BUCKET];
if(process.env.INIT_TEST_BUCKET==='true') buckets.push('design-qa-test');
for(const bucket of buckets){if(!await client.bucketExists(bucket)) await client.makeBucket(bucket);}
