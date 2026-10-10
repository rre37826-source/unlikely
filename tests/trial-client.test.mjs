import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrialClient, chooseProvider, trialMessage } from '../public/trial-client.mjs';
const session='12345678-1234-4123-8123-123456789abc';
const request='87654321-4321-4123-8123-123456789abc';
const response=(data,status=200)=>new Response(JSON.stringify(data),{status});

test('public trial is default; explicit own-model connection takes precedence',()=>{
 assert.equal(chooseProvider(null,{configured:false},{available:true}).mode,'trial');
 assert.equal(chooseProvider(null,{configured:false},{available:false}).configured,false);
 assert.equal(chooseProvider({model:'mine'},{configured:true},{available:true}).mode,'browser');
 assert.equal(chooseProvider(null,{configured:true,model:'local'},{available:true}).mode,'local');
});
test('status and request use anonymous identity, omit credentials, and retain quota',async()=>{
 const calls=[];
 const client=createTrialClient('https://trial.example',{storage:{getItem:()=>session},randomUUID:()=>request,fetchImpl:async(url,options)=>{calls.push({url,options});return url.endsWith('status')?response({available:true,dailyLimit:3,remaining:3}):response({graph:{},trial:{dailyLimit:3,remaining:2}});}});
 await client.status();await client.request('generate',{task:'a film'});
 assert.equal(calls[0].options.headers['X-Trial-Session'],session);
 assert.equal(calls[1].options.credentials,'omit');
 assert.deepEqual(JSON.parse(calls[1].options.body),{action:'generate',payload:{task:'a film'},sessionId:session,requestId:request});
 assert.equal(client.state.remaining,2);
});
test('uncertain network retry preserves request ID and never retries automatically',async()=>{
 const ids=[];let serial=0;
 const client=createTrialClient('https://trial.example',{storage:{getItem:()=>session},randomUUID:()=>`${++serial}`,fetchImpl:async(url,options)=>{ids.push(JSON.parse(options.body).requestId);if(ids.length===1)throw new TypeError('offline');return response({code:'TRIAL_DUPLICATE'},409);}});
 await assert.rejects(client.request('generate',{task:'a film'}));assert.equal(ids.length,1);
 await assert.rejects(client.request('generate',{task:'a film'}),{code:'TRIAL_DUPLICATE'});
 assert.equal(ids[0],ids[1]);
});
test('exhausted trial is unavailable; server error text is not displayed',async()=>{
 const client=createTrialClient('https://trial.example',{storage:{getItem:()=>session},randomUUID:()=>request,fetchImpl:async()=>response({code:'TRIAL_QUOTA',error:'private provider payload'},429)});
 await assert.rejects(client.request('generate',{task:'a film'}),{code:'TRIAL_QUOTA'});
 assert.equal(client.state.available,false);assert.equal(client.state.reason,'TRIAL_QUOTA');
 assert.match(trialMessage(client.state,'zh'),/已有网络/);
});
test('unconfigured or failed status keeps examples available and makes no paid call',async()=>{
 let calls=0;const client=createTrialClient('',{storage:{getItem:()=>session},fetchImpl:async()=>{calls++;}});
 assert.equal((await client.status()).reason,'unconfigured');
 await assert.rejects(client.request('generate',{}),{code:'TRIAL_DISABLED'});assert.equal(calls,0);
 assert.match(trialMessage(client.state,'zh'),/准备中/);
});

test('late status checks never overwrite newer request quota or newer status',async()=>{
 const statuses=[];
 const client=createTrialClient('https://trial.example',{storage:{getItem:()=>session},randomUUID:()=>request,fetchImpl:async(url)=>url.endsWith('status')?new Promise(resolve=>statuses.push(resolve)):response({graph:{},trial:{dailyLimit:3,remaining:2}})});
 const old=client.status();const fresh=client.status();
 statuses[1](response({available:true,dailyLimit:3,remaining:3}));await fresh;
 await client.request('generate',{task:'a film'});
 statuses[0](response({available:false,reason:'TRIAL_BUSY',dailyLimit:3,remaining:3}));await old;
 assert.equal(client.state.available,true);assert.equal(client.state.remaining,2);
});
