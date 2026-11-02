import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('tsx/package.json'))('esbuild')
await build({ entryPoints:['proxy.ts'],bundle:true,platform:'node',format:'cjs',outfile:'tmp/proxy-cutover.cjs',packages:'external',plugins:[{name:'isolated-auth',setup(b){b.onResolve({filter:/^next-auth$/},()=>({path:'auth',namespace:'fixture'}));b.onResolve({filter:/^@\/auth.config$/},()=>({path:'config',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='auth'?'export default ()=>({auth:f=>f})':'export const authConfig={}',loader:'js'}));}}] })
const proxy=require('../tmp/proxy-cutover.cjs').default
const req=(path,token)=>({auth:null,nextUrl:new URL('https://example.invalid'+path),headers:new Headers(token?{authorization:'Bearer '+token}:{})})
process.env.CRON_SECRET='synthetic-secret'
assert.equal(proxy(req('/api/duties/cron')).status,401)
assert.equal(proxy(req('/api/duties/cron','bad')).status,401)
assert.equal(proxy(req('/api/duties/cron','synthetic-secret')).headers.get('x-middleware-next'),'1')
assert.equal(proxy(req('/dashboard')).status,307)
assert.equal(proxy(req('/api/duties/cron/other','synthetic-secret')).status,307)
delete process.env.CRON_SECRET
assert.equal(proxy(req('/api/duties/cron','undefined')).status,401)
process.env.NEXT_PUBLIC_APP_URL='https://new.example.invalid'
await build({entryPoints:['lib/push.ts'],bundle:true,platform:'node',format:'cjs',outfile:'tmp/push-cutover.cjs',packages:'external',plugins:[{name:'no-real-push',setup(b){b.onResolve({filter:/^\.\/db$/},()=>({path:'db',namespace:'fixture'}));b.onResolve({filter:/^web-push$/},()=>({path:'push',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='db'?'export const prisma={pushSubscription:{findMany:async q=>{globalThis.capture.push(q);return []}}}':'export default {setVapidDetails(){},sendNotification(){throw new Error("No real push allowed")}}',loader:'js'}));}}]})
globalThis.capture=[]
const push=require('../tmp/push-cutover.cjs')
await push.sendPushToUser('person-a',{title:'test',body:'test'})
await push.sendPushToWG('wg-a',{title:'test',body:'test'})
assert.equal(globalThis.capture[0].where.applicationOrigin,'https://new.example.invalid')
assert.equal(globalThis.capture[1].where.applicationOrigin,'https://new.example.invalid')
assert.deepEqual(globalThis.capture[1].where.user,{wgId:'wg-a'})
console.log('PASS: actual cron proxy requires configured bearer; private routes stay protected; actual push helpers select only the configured website origin; no real network/push.')
