import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { DELETE } from '../app/api/account/route';
async function main() {
if(process.env.SITEAI_DELETION_QA!=='1')throw Error('Explicit deletion QA opt-in required');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL!, key=process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const email=`support+siteai-deletion-${randomUUID()}@nomappsllc.com`,password=randomBytes(28).toString('base64url');
const created=await db.auth.admin.createUser({email,password,email_confirm:true});
assert.ok(created.data.user&&!created.error,'Isolated account could not be created');
const id=created.data.user.id,base=`https://api.revenuecat.com/v2/projects/${process.env.REVENUECAT_PROJECT_ID}/customers/${id}`;
const headers={Authorization:`Bearer ${process.env.REVENUECAT_SECRET_API_KEY}`,'Content-Type':'application/json'};
try {
 const rc=await fetch(base.slice(0,base.lastIndexOf('/')),{method:'POST',headers,body:JSON.stringify({id})});if (!rc.ok) { const body=await rc.json().catch(()=>({})); throw Error(`Provider fixture creation failed: HTTP ${rc.status}, ${String(body.type||'unknown')}`); }
 const file=await db.storage.from('project-images').upload(`${id}/profile/deletion-check.png`,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64'),{contentType:'image/png'});assert.equal(file.error,null);
 const signed=await db.auth.signInWithPassword({email,password});assert.ok(signed.data.session&&!signed.error);
 const result=await DELETE(new Request('https://siteai.test/api/account',{method:'DELETE',headers:{Authorization:`Bearer ${signed.data.session.access_token}`}}));
 assert.equal(result.status,200,'End-to-end account deletion did not complete');
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 assert.equal((await admin.auth.admin.getUserById(id)).data.user,null);
 assert.equal((await fetch(base,{headers})).status,404,'Provider customer still exists');
 const files=await admin.storage.from('project-images').list(id);assert.equal(files.error,null);assert.equal(files.data?.length,0,'Private files remain');
 console.log('Site AI live deletion verified: isolated account, private photo and RevenueCat customer removed; no purchases/credits created.');
} finally {
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 await admin.storage.from('project-images').remove([`${id}/profile/deletion-check.png`]);
 await admin.auth.admin.deleteUser(id);
 await fetch(base,{method:'DELETE',headers});
}

}
main().catch(error => { console.error(error); process.exitCode=1; });
