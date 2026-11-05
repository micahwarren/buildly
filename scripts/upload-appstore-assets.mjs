import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
if(process.env.SITEAI_APPSTORE_ASSET_UPLOAD!=='1')throw Error('Explicit Apple asset upload opt-in required');
const assets=JSON.parse(process.env.SITEAI_APPSTORE_UPLOAD_OPERATIONS||'null');
if(!Array.isArray(assets)||assets.length!==16)throw Error('Eight owned iPhone and eight owned iPad listing assets required');
for(const asset of assets){
 const match=/^site-ai-v[0-9]{1,4}-(ipad-)?(0[1-8]-[a-z]+\.jpg)$/.exec(asset.fileName);
 if(!match)throw Error('Unexpected listing filename');
 const bytes=await readFile('public/appstore/listing/'+(match[1]?'ipad/':'')+match[2]);
 if(bytes.length!==asset.fileSize||createHash('md5').update(bytes).digest('hex')!==asset.checksum)throw Error('Listing bytes changed after Apple reservation');
 let total=0;
 for(const op of asset.operations){
  const url=new URL(op.url);
  if(url.protocol!=='https:'||!/(^|\.)(apple\.com|icloud\.com)$/.test(url.hostname)||op.method!=='PUT')throw Error('Expected Apple-owned upload destination');
  const data=bytes.subarray(op.offset,op.offset+op.length);
  if(data.length!==op.length)throw Error('Invalid upload range');
  const r=await fetch(url,{method:op.method,headers:Object.fromEntries(op.requestHeaders.map(h=>[h.name,h.value])),body:data,signal:AbortSignal.timeout(90000)});
  if(!r.ok)throw Error(`Apple asset upload failed: HTTP ${r.status}`);
  total+=data.length;
 }
 if(total!==bytes.length)throw Error('Incomplete Apple upload');
 console.log('Apple listing bytes uploaded:',asset.fileName,bytes.length);
}
console.log('Apple listing byte upload complete. Asset commit/processing must be confirmed through App Store Connect.');
