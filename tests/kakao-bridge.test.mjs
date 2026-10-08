// Contract fixture for external providers. No live keys, accounts or network calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
test('Kakao broker verifies signup then magiclink, reuses identity and consumes encrypted handoff once',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'byeolieum-kakao-'));
 const keys=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY','KAKAO_CLIENT_ID','KAKAO_CLIENT_SECRET'];
 const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const originalFetch=globalThis.fetch;
 let mapped=null,registered=false,lastType=null;const handoffs=new Map();const calls=[];
 const uid='11111111-1111-4111-8111-111111111111';
 const tokens={access_token:'fixture-access',refresh_token:'fixture-refresh'};
 let accountEmail;
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 try {
  keys.forEach((k,i)=>process.env[k]=['https://fixture.supabase.test','fixture-public','fixture-service','fixture-client','fixture-secret'][i]);
  globalThis.fetch=async(input,init={})=>{
   const url=new URL(typeof input==='string'?input:input.url??input.toString());const method=init.method??'GET';
   const headers=new Headers(init.headers);const body=init.body?JSON.parse(url.hostname==='kauth.kakao.com'?'{}':init.body):null;
   calls.push(url.hostname+url.pathname);
   if(url.hostname==='kauth.kakao.com'){assert.equal(method,'POST');const tokenParams=new URLSearchParams(init.body);assert.equal(tokenParams.get('redirect_uri'),'https://byeolieum.com/api/auth/kakao/callback');assert.ok(!tokenParams.has('scope'));return json({access_token:'kakao-fixture'})}
   if(url.hostname==='kapi.kakao.com'){assert.equal(headers.get('Authorization'),'Bearer kakao-fixture');assert.equal(url.searchParams.get('property_keys'),'[]');return json({id:123456789})}
   assert.equal(url.hostname,'fixture.supabase.test');
   if(url.pathname==='/auth/v1/verify'){
    assert.equal(headers.get('apikey'),'fixture-public');assert.equal(body.type,lastType);
    assert.equal(body.token_hash,'hashed-fixture');registered=true;
    return json({...tokens,token_type:'bearer',expires_in:3600,user:{id:uid,email:accountEmail}});
   }
   assert.equal(headers.get('Authorization'),'Bearer fixture-service');
   if(url.pathname==='/auth/v1/admin/generate_link'){
    assert.equal(body.type,'magiclink');assert.notEqual(body.email,'untrusted@example.test');accountEmail=body.email;
    lastType=registered?'magiclink':'signup';
    return json({id:uid,email:accountEmail,hashed_token:'hashed-fixture',verification_type:lastType,action_link:'https://fixture.supabase.test/verify',email_otp:'123456',redirect_to:'https://byeolieum.com'});
   }
   if(url.pathname.startsWith('/auth/v1/admin/users/'))return json({id:uid,email:accountEmail});
   if(url.pathname==='/rest/v1/kakao_identities'){
    if(method==='POST'){mapped=body;return new Response(null,{status:201})}
    return json(mapped?{user_id:uid}:null);
   }
   if(url.pathname==='/rest/v1/kakao_login_handoffs'){
    if(method==='DELETE')return new Response(null,{status:204});
    assert.equal(method,'POST');assert.ok(!body.sealed_session.includes(tokens.access_token));handoffs.set(body.nonce_hash,body.sealed_session);return new Response(null,{status:201});
   }
   if(url.pathname==='/rest/v1/rpc/consume_kakao_handoff'){
    const sealed=handoffs.get(body.p_nonce_hash);handoffs.delete(body.p_nonce_hash);return json(sealed?[{sealed_session:sealed}]:[]);
   }
   throw new Error('Unexpected fixture request');
  };
  const crypto=await readFile(new URL('../src/lib/naver-crypto.ts',import.meta.url),'utf8');
  await writeFile(join(dir,'crypto.mjs'),ts.transpileModule(crypto,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
  const server=(await readFile(new URL('../src/lib/kakao-server.ts',import.meta.url),'utf8')).replace('import "server-only";','').replace('"./naver-crypto"',JSON.stringify(pathToFileURL(join(dir,'crypto.mjs')).href)).replace('"@supabase/supabase-js"',JSON.stringify(pathToFileURL(join(process.cwd(),'node_modules/@supabase/supabase-js/dist/index.mjs')).href));
  await writeFile(join(dir,'server.mjs'),ts.transpileModule(server,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
  const {completeKakao,consumeKakao}=await import(pathToFileURL(join(dir,'server.mjs')));
  const first=await completeKakao('fixture-code');assert.equal(lastType,'signup');assert.deepEqual(await consumeKakao(first),tokens);await assert.rejects(()=>consumeKakao(first));
  const second=await completeKakao('second-code');assert.equal(lastType,'magiclink');assert.deepEqual(await consumeKakao(second),tokens);assert.ok(calls.includes('fixture.supabase.test/auth/v1/admin/users/'+uid));
 } finally {
  globalThis.fetch=originalFetch;for(const [k,v] of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v}await rm(dir,{recursive:true,force:true});
 }
});
