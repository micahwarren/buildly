import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
if(process.env.SITEAI_MAIL_DELIVERY_CHECK!=='1')throw Error('Explicit company-inbox delivery check required');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const client=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(u,o)=>fetch(u,{...o,signal:AbortSignal.timeout(30000)})}});
const email=`support+siteai-mail-check-${randomUUID().slice(0,8)}@nomappsllc.com`,password=randomBytes(28).toString('base64url');
let user;
const checked=(result,label)=>{if(result.error)throw Error(`${label}: ${result.error.code||'auth_error'} (HTTP ${result.error.status||'unknown'})`);};
try {
 const signup=await client.auth.signUp({email,password,options:{data:{siteai_delivery_check:true},emailRedirectTo:'https://sightsaw-diy.vercel.app'}});
 checked(signup,'Signup email rejected');user=signup.data.user?.id;assert.ok(user);assert.equal(signup.data.session,null);assert.ok(!signup.data.user.email_confirmed_at);
 console.log('Site AI mail check: confirmation accepted by Auth/SMTP. Test messages require no action.');
 await new Promise(r=>setTimeout(r,35000));
 console.log('Site AI mail check: respecting the resend cooldown.');
 await new Promise(r=>setTimeout(r,30000));
 checked(await client.auth.resend({type:'signup',email,options:{emailRedirectTo:'https://sightsaw-diy.vercel.app'}}),'Resend email rejected');
 console.log('Site AI mail check: resend accepted by Auth/SMTP.');
 checked(await admin.auth.admin.updateUserById(user,{email_confirm:true}),'Owned fixture confirmation failed');
 checked(await client.auth.resetPasswordForEmail(email,{redirectTo:'https://sightsaw-diy.vercel.app'}),'Reset email rejected');
 console.log('Site AI mail check: password reset accepted by Auth/SMTP.');
} finally {
 if(user){const result=await admin.auth.admin.deleteUser(user);checked(result,'Owned fixture cleanup failed');console.log('Site AI mail check: isolated delivery account removed; no credits or purchases created.');}
}
