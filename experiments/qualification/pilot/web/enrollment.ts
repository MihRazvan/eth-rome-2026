import { createHolderInBrowser } from '../holder-enrollment';
import { parseEnrollmentRequest } from '../enrollment-request';
import { generateChannelKeys, sealEnrollment, openEnrollment, parseApproval, enrollmentAuthorization, type ChannelKeys } from '../enrollment-channel';
import { loadCredentialVault, saveCredentialVault, type CredentialVaultScope, type CredentialVaultEntry } from '../credential-vault';
import { validateProofPair } from '../proof-files';
import { bytesToHex, sha256 } from 'viem';
export function mountEnrollment(config:any, hooks:{ scope():Promise<CredentialVaultScope|undefined>; connect():Promise<void>; sign(message:string):Promise<string>; changed():Promise<void>; state(message:string):void }) {
 const $=(id:string)=>document.getElementById(id)!;
 let epoch=0,working=false,controller:AbortController|undefined;
 let operation:Promise<void>|undefined,progress:((text:string)=>void)|undefined;
 const resumed=new Set<string>();
 const message=(text:string)=>{$('enrollment-status').textContent=text;progress?.(text);};
 async function currentScope(){const s=await hooks.scope();if(!s)throw Error('Connect your reviewer wallet first.');return s;}
 const current=(mine:number)=>{if(mine!==epoch||controller?.signal.aborted)throw Error('Setup paused. Your progress is saved; reconnect to continue.');};
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
   message(!scope?'Connect your reviewer wallet to get started.':valid?'Ready to accept work. Your private access is saved in this browser.':pending?'Finishing your private access. Your progress is saved.':config.enrollment?'Choose a task to get started. Private access is set up automatically when you accept work.':'Reviewer setup is temporarily unavailable. An existing saved pass can still be used.');
   hooks.state(valid?'Ready to review':pending?'Finishing setup':'Set up when you accept');
  }
  const ticket=(entry?.pending as any)?.context?.ticket;
  // Resume collection after reload without opening an unsolicited signature prompt.
  if(scope&&ticket&&!valid&&!working&&!resumed.has(ticket)){
   resumed.add(ticket);
   queueMicrotask(()=>void ensure({allowSign:false}).catch(()=>{}));
  }
 }
 async function run(fn:(mine:number)=>Promise<void>){if(working)return;working=true;const mine=epoch;try{await refresh();await fn(mine);}catch(e){if(mine===epoch)message((e as Error).message);}finally{if(mine===epoch){working=false;const text=$('enrollment-status').textContent;try{await refresh();}catch{message('Private browser storage is unavailable. Reconnect to retry.');}if(text)message(text);}}}
 async function submit(scope:CredentialVaultScope,entry:CredentialVaultEntry,mine:number){
  const pending=entry.pending as any;
  const expires=Math.floor(Date.now()/1000)+240;
  const digest=sha256(bytesToHex(new TextEncoder().encode(JSON.stringify(pending.envelope))));
  message('Confirm one message to set up your private reviewer access. No payment is requested.');
  const signature=await hooks.sign(enrollmentAuthorization(pending.context,digest,expires));current(mine);
  const response=await fetch('/api/enrollment',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({applicant:scope.wallet,envelope:pending.envelope,expires,signature}),signal:AbortSignal.any([controller!.signal,AbortSignal.timeout(25000)])});
  const result=await response.json();current(mine);
  if(!response.ok)throw Error(result.error||'Setup was not confirmed. Continue setup to retry safely.');
  pending.submittedAt=Math.floor(Date.now()/1000);
  await saveCredentialVault(scope,entry,{replace:true});current(mine);
  message('Creating your private reviewer access… This usually takes a few seconds.');
  hooks.state('Finishing setup');
 }
 async function setup(mine:number,allowSign:boolean){
  const scope=await currentScope();current(mine);
  let entry=await loadCredentialVault(scope);current(mine);
  if(entry?.credential&&entry.credential.expiry>Math.floor(Date.now()/1000))return;
  if(!config.enrollment)throw Error('Reviewer setup is temporarily unavailable. Please try again shortly.');
  if(entry?.pending&&Math.floor(Date.now()/1000)-Number((entry.pending as any).createdAt||0)>172800){
   entry={holder:entry.holder};await saveCredentialVault(scope,entry,{replace:true});current(mine);
  }
  if(!entry?.pending){
   if(!allowSign)throw Error('Select Continue setup to finish connecting your reviewer access.');
   const holder=entry?.holder??await createHolderInBrowser({signal:controller!.signal,onProgress:message});current(mine);
   const reply=await generateChannelKeys();current(mine);
   const context={chainId:config.chainId,escrow:config.escrow,issuer:config.issuer,ticket:bytesToHex(crypto.getRandomValues(new Uint8Array(32))).slice(2)};
   const request=parseEnrollmentRequest({format:'cutout-enrollment-request',version:1,testOnly:true,chainId:config.chainId,escrow:config.escrow,issuer:config.issuer,qualificationClass:'7',holderCommitment:holder.holderCommitment,createdAt:Math.floor(Date.now()/1000)});
   const envelope=await sealEnrollment({request,replyKey:reply.publicKey,applicant:scope.wallet},config.enrollment.publicKey,context,'application');current(mine);
   const next={holder,pending:{reply,context,envelope,createdAt:Math.floor(Date.now()/1000)}} as unknown as CredentialVaultEntry;
   await saveCredentialVault(scope,next,{replace:!!entry});current(mine);entry=next;
   await submit(scope,entry,mine);
  }
  const pending=entry.pending as any;resumed.add(pending.context.ticket);
  const until=Date.now()+110000;let resent=false;
  const pause=()=>new Promise<void>((resolve,reject)=>{
   const signal=controller!.signal;
   if(signal.aborted){reject(Error('Setup paused. Your progress is saved.'));return;}
   const abort=()=>{clearTimeout(timer);reject(Error('Setup paused. Your progress is saved.'));};
   const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},Math.max(0,Math.min(2500,until-Date.now())));
   signal.addEventListener('abort',abort,{once:true});
  });
  while(Date.now()<until){
   current(mine);
   message('Finishing your private reviewer access… You can keep this page open.');
   let response:Response,result:any;
   try{
    response=await fetch(`/api/enrollment?ticket=${encodeURIComponent(pending.context.ticket)}`,{cache:'no-store',redirect:'error',signal:AbortSignal.any([controller!.signal,AbortSignal.timeout(Math.max(1,Math.min(40000,until-Date.now())))])});
    // Gateways may answer a temporary failure with HTML rather than JSON.
    result=await response.json().catch(()=>({}));current(mine);
   }catch{
    current(mine);
    message('Reconnecting to finish your private access… No need to sign again.');
    await pause();continue;
   }
   if(response.status===408||response.status===429||response.status>=500){
    message('Finishing setup… The service is busy; retrying automatically.');
    await pause();continue;
   }
   if(response.status===404&&!pending.submittedAt&&!resent){
    if(!allowSign)throw Error('One wallet confirmation is still needed. Select Continue setup.');
    resent=true;await submit(scope,entry,mine);continue;
   }
   if(response.status!==404&&!response.ok)throw Error(result.error||'Setup is taking longer than expected. Continue setup to retry.');
   if(response.ok&&result.status==='approved'){
    const credential=parseApproval(await openEnrollment(result.approval,pending.reply as ChannelKeys,pending.context,'approval'));current(mine);
    if(Number(credential.expiry)<=Math.floor(Date.now()/1000)){
     await saveCredentialVault(scope,{holder:entry.holder},{replace:true});current(mine);
     throw Error('Your access needs renewing. Select Get started to continue.');
    }
    validateProofPair(credential,entry.holder,7,Math.floor(Date.now()/1000));current(mine);
    await saveCredentialVault(scope,{holder:entry.holder,credential} as CredentialVaultEntry,{replace:!!entry.credential});current(mine);
    await hooks.changed();current(mine);message('Private access ready. You can accept a task.');return;
   }
   await pause();
  }
  throw Error('Setup is taking longer than expected. Your progress is saved. Select Continue setup to try again.');
 }
 async function ensure(options:{signal?:AbortSignal;onProgress?:(text:string)=>void;allowSign?:boolean}={}){
  if(operation){
   const existing=operation;
   let removeAbort=()=>{};
   const cancelled=new Promise<never>((_,reject)=>{
    const abort=()=>reject(Error('Setup paused. Your progress is saved.'));
    if(options.signal?.aborted){abort();return;}
    options.signal?.addEventListener('abort',abort,{once:true});
    removeAbort=()=>options.signal?.removeEventListener('abort',abort);
   });
   try{await Promise.race([existing,cancelled]);}
   catch(e){if(options.allowSign===false||options.signal?.aborted)throw e;}
   finally{removeAbort();}
   if(options.signal?.aborted)throw Error('Setup paused. Your progress is saved.');
   return ensure(options);
  }
  if(working)throw Error('Finish the current private access action first.');
  working=true;controller=new AbortController();const activeController=controller,mine=epoch;
  const abort=()=>activeController.abort();
  if(options.signal?.aborted)controller.abort();
  options.signal?.addEventListener('abort',abort,{once:true});progress=options.onProgress;
  const active=(async()=>{
   try{await refresh();await setup(mine,options.allowSign!==false);}
   catch(e){if(mine===epoch)message((e as Error).message);throw e;}
   finally{
    options.signal?.removeEventListener('abort',abort);
    if(mine===epoch){working=false;progress=undefined;controller=undefined;const text=$('enrollment-status').textContent;await refresh();if(text)message(text);}
   }
  })();operation=active;
  try{await active;}finally{if(operation===active)operation=undefined;}
 }
 $('prepare-enrollment').onclick=()=>{void ensure().catch(()=>{});};
 $('check-enrollment').onclick=()=>{void ensure().catch(()=>{});};
 $('enrollment-connect').onclick=()=>run(async()=>{await hooks.connect();working=false;await refresh();});
 $('save-private-pass').onclick=()=>run(async(mine)=>{
  const scope=await currentScope(),entry=await loadCredentialVault(scope);current(mine);if(!entry)throw Error('No pass is saved in this browser yet.');
  const url=URL.createObjectURL(new Blob([JSON.stringify({format:'cutout-private-backup',version:1,scope,entry})],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='deaddrop-private-pass.deaddrop';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Private backup saved. Keep it private; normal task acceptance does not need this file.');
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
 function clear(){epoch++;controller?.abort();controller=undefined;working=false;progress=undefined;operation=undefined;resumed.clear();for(const id of ['restore-private-pass','restore-credential','restore-holder'])($(id) as HTMLInputElement).value='';void refresh().catch(()=>message('Reconnect to load your private pass.'));}
 window.addEventListener('pagehide',clear,{once:true});
 return {refresh,clear,ensure};
}
