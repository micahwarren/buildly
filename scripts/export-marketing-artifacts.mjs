import {mkdir,writeFile} from 'node:fs/promises';
if(process.env.SITEAI_MARKETING_ARTIFACT_IMPORT!=='1')throw Error('Explicit owned-asset export opt-in required');
const source=new URL(process.env.SITEAI_MARKETING_IMPORT_URL);
if(source.protocol!=='https:'||!source.hostname.endsWith('-nom-apps-llc.vercel.app'))throw Error('Expected owned deployment');
const headers={'x-vercel-protection-bypass':process.env.SITEAI_ASSET_EXPORT_BYPASS};
const request=async path=>{
 if(!/^\/appstore\/[a-z0-9.-]+$/.test(path))throw Error('Invalid owned artifact path');
 const r=await fetch(new URL(path,source),{headers,signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error(`Owned asset fetch failed: HTTP ${r.status}`);
 return Buffer.from(await r.arrayBuffer());
};
const raw=await request('/appstore/projects.json'),projects=JSON.parse(raw);
if(!Array.isArray(projects)||!projects.length)throw Error('Owned example missing');
await mkdir('public/appstore',{recursive:true});
const files=[['projects.json',raw]];
for(const p of projects)files.push([p.generatedImage.split('/').pop(),await request(p.generatedImage)]);
for(const [file,bytes]of files){
 await writeFile('public/appstore/'+file,bytes);const data=bytes.toString('base64');
 for(let offset=0;offset<data.length;offset+=2500)console.log(`SITEAI_PUBLIC_ARTIFACT ${file} ${offset} ${data.slice(offset,offset+2500)}`);
}
console.log('Owned artifact export complete; no new AI generation or customer data.');
