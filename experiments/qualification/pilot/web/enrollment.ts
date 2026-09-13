import { createHolderInBrowser } from '../holder-enrollment';
import { parseEnrollmentRequest } from '../enrollment-request';
import { generateChannelKeys, sealEnrollment, openEnrollment, parseApproval, enrollmentAuthorization, type ChannelKeys } from '../enrollment-channel';
import { loadCredentialVault, saveCredentialVault, type CredentialVaultScope, type CredentialVaultEntry } from '../credential-vault';
import { validateProofPair } from '../proof-files';
import { bytesToHex, sha256 } from 'viem';
export function mountEnrollment(config:any, hooks:{ scope():Promise<CredentialVaultScope|undefined>; connect():Promise<void>; sign(message:string):Promise<string>; changed():Promise<void>; state(message:string):void }) {
 const $=(id:string)=>document.getElementById(id)!;
 let epoch=0,working=false,controller:AbortController|undefined;
 const message=(text:string)=>{$('enrollment-status').textContent=text;};
 async function currentScope(){const s=await hooks.scope();if(!s)throw Error('Connect your reviewer wallet first.');return s;}
 async function refresh(){
  const mine=epoch,scope=await hooks.scope();if(mine!==epoch)return;
  const entry=scope?await loadCredentialVault(scope):undefined;if(mine!==epoch)return;
  const valid=entry?.credential && entry.credential.expiry>Math.floor(Date.now()/1000);
  const pending=!!entry?.pending;
  ($('prepare-enrollment') as HTMLButtonElement).disabled=working||!scope||!config.enrollment;
  $('prepare-enrollment').hidden=!!valid||pending;
  $('check-enrollment').hidden=!pending;
  ($('check-enrollment') as HTMLButtonElement).disabled=working;
  $('enrollment-connect').hidden=!!scope;
  ($('save-private-pass') as HTMLButtonElement).disabled=!entry||working;
  if(!working){
   const text=!scope?'Connect your reviewer wallet to apply or use a saved pass.':valid?`Reviewer pass ready · valid until ${new Date(entry!.credential!.expiry*1000).toLocaleString()}. You can accept eligible tasks.`:pending?'Application sent or prepared · awaiting issuer approval. Check approval to collect your pass.':entry?.credential?'Your test pass has expired. Apply again to renew it.':config.enrollment?'Apply for a temporary reviewer pass. Sign one message; no payment is requested.':'Online applications are unavailable on this deployment. You can restore an existing pass.';
   message(text);hooks.state(valid?'Reviewer pass ready':pending?'Awaiting issuer approval':'Reviewer pass needed');
  }
 }
 async function run(fn:(mine:number)=>Promise<void>){if(working)return;working=true;const mine=epoch;try{await refresh();await fn(mine);}catch(e){if(mine===epoch)message((e as Error).message);}finally{if(mine===epoch){working=false;const text=$('enrollment-status').textContent;try{await refresh();}catch{message('Private pass storage is unavailable. Reconnect to retry.');}if(text)message(text);}}}
 const current=(mine:number)=>{if(mine!==epoch)throw Error('Wallet changed. Reconnect to continue.');};
 async function submit(scope:CredentialVaultScope,entry:CredentialVaultEntry,mine:number){
  const pending=entry.pending as any;
  const expires=Math.floor(Date.now()/1000)+240;
  const digest=sha256(bytesToHex(new TextEncoder().encode(JSON.stringify(pending.envelope))));
  message('Confirm the application message in your wallet. No payment is requested.');
  const signature=await hooks.sign(enrollmentAuthorization(pending.context,digest,expires));current(mine);
  const response=await fetch('/api/enrollment',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({applicant:scope.wallet,envelope:pending.envelope,expires,signature}),signal:controller?.signal});
  const result=await response.json();current(mine);
  if(!response.ok)throw Error(result.error||'Application was not confirmed. Check approval before retrying.');
  message('Application received. The Cutout team will review it. Your pass will arrive here after approval.');
  $('prepare-enrollment').hidden=true;$('check-enrollment').hidden=false;hooks.state('Awaiting issuer approval');
 }
 $('prepare-enrollment').onclick=()=>run(async(mine)=>{
  const scope=await currentScope();current(mine);controller=new AbortController();
  const existing=await loadCredentialVault(scope);current(mine);
  if(existing?.credential && existing.credential.expiry>Math.floor(Date.now()/1000)){await refresh();return;}
  if(!config.enrollment)throw Error('Online applications are unavailable.');
  const holder=existing?.holder??await createHolderInBrowser({signal:controller.signal,onProgress:message});current(mine);
  const reply=await generateChannelKeys();current(mine);
  const context={chainId:config.chainId,escrow:config.escrow,issuer:config.issuer,ticket:bytesToHex(crypto.getRandomValues(new Uint8Array(32))).slice(2)};
  const request=parseEnrollmentRequest({format:'cutout-enrollment-request',version:1,testOnly:true,chainId:config.chainId,escrow:config.escrow,issuer:config.issuer,qualificationClass:'7',holderCommitment:holder.holderCommitment,createdAt:Math.floor(Date.now()/1000)});
  const envelope=await sealEnrollment({request,replyKey:reply.publicKey,applicant:scope.wallet},config.enrollment.publicKey,context,'application');current(mine);
  const entry={holder,pending:{reply,context,envelope,createdAt:Math.floor(Date.now()/1000)}} as unknown as CredentialVaultEntry;
  await saveCredentialVault(scope,entry,{replace:!!existing});current(mine);
  await hooks.changed();current(mine);await submit(scope,entry,mine);
 });
 $('check-enrollment').onclick=()=>run(async(mine)=>{
  const scope=await currentScope(),entry=await loadCredentialVault(scope);current(mine);
  if(!entry?.pending)throw Error('No application is saved for this wallet.');
  const pending=entry.pending as any;
  message('Checking your application…');
  const response=await fetch(`/api/enrollment?ticket=${encodeURIComponent(pending.context.ticket)}`,{cache:'no-store',redirect:'error'});
  const result=await response.json();current(mine);
  if(response.status===404){
    if(!pending.createdAt || Math.floor(Date.now()/1000)-pending.createdAt>172800){
      await saveCredentialVault(scope,{holder:entry.holder},{replace:true});current(mine);await hooks.changed();message('This application has expired. Apply again; your private holder stays the same.');return;
    }
    await submit(scope,entry,mine);return;
  }
  if(!response.ok)throw Error(result.error||'Approval check unavailable. Try again.');
  if(result.status!=='approved'){message('Your application is waiting for the Cutout team. Check back after approval.');return;}
  const credential=parseApproval(await openEnrollment(result.approval,pending.reply as ChannelKeys,pending.context,'approval'));
  if(Number(credential.expiry)<=Math.floor(Date.now()/1000)){
    await saveCredentialVault(scope,{holder:entry.holder},{replace:true});current(mine);await hooks.changed();message('The issued test pass expired before collection. Apply again to renew it.');return;
  }
  validateProofPair(credential,entry.holder,7,Math.floor(Date.now()/1000));current(mine);
  await saveCredentialVault(scope,{holder:entry.holder,credential} as CredentialVaultEntry,{replace:!!entry.credential});current(mine);
  await hooks.changed();working=false;await refresh();
 });
 $('enrollment-connect').onclick=()=>run(async()=>{await hooks.connect();working=false;await refresh();});
 $('save-private-pass').onclick=()=>run(async(mine)=>{
  const scope=await currentScope(),entry=await loadCredentialVault(scope);current(mine);if(!entry)throw Error('No pass is saved in this browser yet.');
  const url=URL.createObjectURL(new Blob([JSON.stringify({format:'cutout-private-backup',version:1,scope,entry})],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='cutout-private-pass.cutout';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Private backup saved. Keep it private; normal task acceptance does not need this file.');
 });
 async function readFile(id:string){const input=$(id) as HTMLInputElement,f=input.files?.[0];if(!f||f.size>65536)throw Error('Choose a supported private backup below 64 KB.');try{return JSON.parse(await f.text());}finally{input.value='';}}
 $('restore-private-pass').onchange=()=>run(async(mine)=>{
  const scope=await currentScope(),backup=await readFile('restore-private-pass');current(mine);
  if(backup.format!=='cutout-private-backup'||backup.version!==1||JSON.stringify(backup.scope)!==JSON.stringify(scope))throw Error('This backup belongs to another wallet or deployment.');
  await saveCredentialVault(scope,backup.entry);current(mine);await hooks.changed();working=false;await refresh();
 });
 $('restore-legacy-pass').onclick=()=>run(async(mine)=>{
  const scope=await currentScope(),credential=await readFile('restore-credential'),holder=await readFile('restore-holder');current(mine);
  validateProofPair(credential,holder,7,Math.floor(Date.now()/1000));await saveCredentialVault(scope,{holder,credential});current(mine);await hooks.changed();working=false;await refresh();
 });
 function clear(){epoch++;controller?.abort();controller=undefined;working=false;for(const id of ['restore-private-pass','restore-credential','restore-holder'])($(id) as HTMLInputElement).value='';void refresh().catch(()=>message('Reconnect to load your private pass.'));}
 window.addEventListener('pagehide',clear,{once:true});
 return {refresh,clear};
}
