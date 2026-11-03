import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
const require=createRequire(import.meta.url)
const {build}=createRequire(require.resolve('tsx/package.json'))('esbuild')
await build({entryPoints:['auth.config.ts'],bundle:true,platform:'node',format:'cjs',outfile:'tmp/account-auth.cjs',packages:'external',plugins:[{name:'synthetic-db',setup(b){b.onResolve({filter:/^@\/lib\/db$/},()=>({path:'db',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const prisma={user:{findUnique:async()=>globalThis.fixtureUser}}',loader:'js'}))}}]})
const {jwt}=require('../tmp/account-auth.cjs').authConfig.callbacks
globalThis.fixtureUser=null
assert.equal(await jwt({token:{id:'removed',wgId:'wg'}}),null)
globalThis.fixtureUser={wgId:'wg',role:'MEMBER'}
assert.deepEqual(await jwt({token:{id:'retained',wgId:'wg'}}),{id:'retained',wgId:'wg',role:'MEMBER'})
console.log('Deleted accounts lose existing JWT access; retained account session stays valid.')
