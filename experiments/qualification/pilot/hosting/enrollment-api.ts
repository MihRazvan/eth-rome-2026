import { createHmac } from 'node:crypto';
import { createPublicClient, http, verifyMessage, sha256, bytesToHex, type Hex } from 'viem';
import { enrollmentAuthorization, parseSealedEnrollment, MAX_ENROLLMENT_BYTES } from '../enrollment-channel';
import { enrollmentInbox } from '../enrollment-inbox';
export type EnrollmentServiceConfig = { chainId:number; escrow:Hex; issuer:Hex; rpcUrl:string; enrollment?: { publicKey:Hex;relayAddress:Hex;issuerX:string;issuerY:string } };
export function createEnrollmentAPI(config:EnrollmentServiceConfig, deps:any={}) {
 const now=deps.now??(()=>Math.floor(Date.now()/1000));
 let writes=Promise.resolve(); // Avoid nonce collisions within this function instance. Cross-instance retries are deduplicated by ticket.
 return async function handle(req:any,res:any) {
  const respond=(status:number,body:unknown)=>{res.statusCode=status;res.end(JSON.stringify(body));};
  const url=new URL(req.url,'https://cutout.invalid');
  if(!url.pathname.startsWith('/api/enrollment'))return false;
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
  let release:(()=>void)|undefined;
  if(req.method==='POST'){const before=writes;writes=new Promise<void>(resolve=>{release=resolve;});await before;}
  try {
   const service=config.enrollment;
   const key=deps.key??process.env.CUTOUT_ENROLLMENT_RELAY_KEY;
   if(!service || !key) {respond(503,{error:'Applications are temporarily unavailable. Your saved pass is safe.'});return true;}
   const inbox=deps.inbox??enrollmentInbox({relayAddress:service.relayAddress,escrow:config.escrow},key);
   if(req.method==='GET' && url.pathname==='/api/enrollment') {
    const ticket=url.searchParams.get('ticket');
    if(!ticket || !/^[0-9a-f]{64}$/.test(ticket)){respond(400,{error:'Invalid application reference'});return true;}
    const rows=await inbox.query({ticket});
    const row=rows.find((r:any)=>r.record.ticket===ticket && r.record.approval)??rows.find((r:any)=>r.record.ticket===ticket);
    if(!row){respond(404,{status:'missing'});return true;}
    respond(200,{status:row.record.approval?'approved':'pending',approval:row.record.approval??null});return true;
   }
   if(req.method!=='POST'||url.pathname!=='/api/enrollment'){respond(405,{error:'Method not allowed'});return true;}
   const origin=req.headers.origin;
   if(!origin || !['https://cutout-ethrome-2026.vercel.app','https://review-pass-ethrome-2026.vercel.app'].includes(origin)){respond(403,{error:'Open applications inside Deaddrop'});return true;}
   if(!String(req.headers['content-type']??'').startsWith('application/json')){respond(415,{error:'JSON required'});return true;}
   let raw='';
   if(req.body!==undefined) raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);
   else for await(const chunk of req){raw+=Buffer.from(chunk).toString('utf8');if(Buffer.byteLength(raw)>20000)throw Error('Application exceeds size limit');}
   if(Buffer.byteLength(raw)>20000)throw Error('Application exceeds size limit');
   const body=JSON.parse(raw);
   if(!body || Object.keys(body).sort().join(',')!=='applicant,envelope,expires,signature')throw Error('Invalid application');
   const envelope=parseSealedEnrollment(body.envelope),c=envelope.context;
   if(envelope.kind!=='application'||c.chainId!==config.chainId||c.escrow!==config.escrow.toLowerCase()||c.issuer!==config.issuer.toLowerCase())throw Error('Wrong application destination');
   if(!Number.isSafeInteger(body.expires)||body.expires<=now()||body.expires>now()+300||!/^0x[0-9a-f]{40}$/i.test(body.applicant)||!/^0x[0-9a-f]{130}$/i.test(body.signature))throw Error('Application signature expired or invalid');
   const digest=sha256(bytesToHex(new TextEncoder().encode(JSON.stringify(envelope))));
   if(!(await verifyMessage({address:body.applicant,message:enrollmentAuthorization(c,digest,body.expires),signature:body.signature})))throw Error('Application signature does not match');
   const existing=await inbox.query({ticket:c.ticket});
   if(existing.length){if(existing[0].record.digest!==digest)throw Error('Application reference already used');respond(200,{status:existing[0].record.approval?'approved':'pending'});return true;}
   const bucket=createHmac('sha256',key).update(body.applicant.toLowerCase()).digest('hex');
   const prior=await inbox.query({bucket});
   if(prior.length>=3){respond(429,{error:'You already have applications in progress. Check your saved pass.'});return true;}
   const all=await inbox.query({});
   if(all.length>=100){respond(429,{error:'The test issuer inbox is full. Please try later.'});return true;}
   const balance=deps.balance??((address:Hex)=>createPublicClient({transport:http(config.rpcUrl,{timeout:10000,retryCount:0})}).getBalance({address}));
   if(await balance(body.applicant)<1000000000000000n){respond(400,{error:'Add Fuji test AVAX to your reviewer wallet before applying. You will need it to accept work.'});return true;}
   const record={version:1,ticket:c.ticket,applicant:body.applicant.toLowerCase(),expires:body.expires,signature:body.signature,digest,envelope,createdAt:now()};
   await inbox.create(record,bucket);
   respond(201,{status:'pending'});return true;
  } catch {respond(503,{error:'Application was not confirmed. Check status before retrying; your private pass remains in this browser.'});return true;} finally {release?.();}
 };
}
