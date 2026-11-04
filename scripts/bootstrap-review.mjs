import { createClient } from '@supabase/supabase-js';
// One-time operator build task; never exposed as a route or shipped to clients.
if (process.env.SITEAI_REVIEW_BOOTSTRAP !== '1') process.exit(0);
const email=process.env.SITEAI_REVIEW_EMAIL,password=process.env.SITEAI_REVIEW_PASSWORD;
if(!email?.endsWith('@nomappsllc.com') || !password || password.length<24) throw Error('Review credentials missing or invalid');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('Account admin configuration missing');
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{app_review_account:true}});
if(created.error && !['email_exists','user_already_exists'].includes(created.error.code))throw Error('Review account creation failed');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const login=await client.auth.signInWithPassword({email,password});
if(login.error||!login.data.session)throw Error('Review account login verification failed');
await client.auth.signOut();
console.log('Site AI review account prepared; password login verified. No credits or purchases were granted.');
