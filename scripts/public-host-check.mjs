import assert from 'node:assert/strict';
assert.equal(process.env.SITEAI_PUBLIC_HOST_QA,'1');
const base='https://site-ai-nomapps.vercel.app';
for(const path of ['/api/config','/privacy','/terms']){
 const response=await fetch(base+path,{signal:AbortSignal.timeout(20000),redirect:'error'});
 assert.equal(response.status,200,`Canonical route unavailable: ${path}`);
 if(path==='/api/config'){
  const data=await response.json();assert.equal(data.billingEnabled,true);assert.ok(data.supabaseUrl?.includes('fewhurddrzmnqabeelyi'));
 }else assert.ok((await response.text()).includes('Site AI'));
 console.log('siteai_public_host_check',{path,status:200});
}
