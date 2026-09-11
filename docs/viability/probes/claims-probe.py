#!/usr/bin/env python3
"""Read-only Ethereum claim-source probe. Requires Python 3 + Foundry cast, no keys.
Usage: python3 claims-probe.py [block-number] > claims-observations.json
RPC_URL may replace the public endpoint (never persisted). No transactions sent.
"""
import concurrent.futures, datetime, json, os, subprocess, sys, urllib.request
RPC=os.environ.get('RPC_URL','https://ethereum-rpc.publicnode.com')
LIDO='0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1'
LP='0x308861A430be4cce5502d0A12724771Fc6DaF216'
SUSDE='0x9D39A5DE30e57443BfF2A8307A4256c8797A3497'
def rpc(method,params,url=RPC):
 result=subprocess.run(['cast','rpc','--rpc-url',url,method,*[json.dumps(p,separators=(',',':')) for p in params]],capture_output=True,text=True,timeout=45)
 if result.returncode:raise RuntimeError(result.stderr.replace(RPC,'<RPC>')[:250])
 return json.loads(result.stdout)

def calldata(sig,*args):return subprocess.check_output(['cast','calldata',sig,*map(str,args)],text=True).strip()
def words(data):return [int(data[i:i+64],16) for i in range(2,len(data),64)]
def call(address,sig,*args):return words(rpc('eth_call',[{'to':address,'data':calldata(sig,*args)},tag]))
def addr(word):return '0x'+f'{word:040x}'
def attempt(fn):
 try:return fn()
 except Exception as e:return {'error':str(e)[:250]}
block=rpc('eth_getBlockByNumber',[hex(int(sys.argv[1])) if len(sys.argv)>1 else 'latest',False]);tag=block['number'];number=int(tag,16);timestamp=int(block['timestamp'],16)
out={'observedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rpc':'public Ethereum RPC (RPC_URL override not disclosed)','chainId':int(rpc('eth_chainId',[]),16),'block':{'number':number,'hash':block['hash'],'timestamp':timestamp,'utc':datetime.datetime.fromtimestamp(timestamp,datetime.timezone.utc).isoformat()},'notes':['Read-only eth_call/logs; no simulation or chain mutation.','Pending request count is unfinalized IDs, not unique sellers or market demand.','Nonmint/nonburn transfers are not necessarily sales.']}
slot='0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'
def identity(a):
 code=rpc('eth_getCode',[a,tag]);impl=rpc('eth_getStorageAt',[a,slot,tag])
 return {'address':a,'implementation':addr(int(impl,16)),'runtimeCodeBytes':(len(code)-2)//2}
last=call(LIDO,'getLastRequestId()')[0];final=call(LIDO,'getLastFinalizedRequestId()')[0]
ids=list(range(final+1,last+1));sample=sorted(set(ids[:10]+ids[-10:]+list(range(max(1,last-19),last+1))))
def lido_status(ids):
 data=call(LIDO,'getWithdrawalStatus(uint256[])','['+','.join(map(str,ids))+']');rows=[]
 for i,k in enumerate(ids):
  a,s,o,t,f,c=data[2+i*6:8+i*6];rows.append({'id':k,'amountWei':str(a),'shares':str(s),'owner':addr(o),'createdAt':t,'ageSeconds':timestamp-t,'finalized':bool(f),'claimed':bool(c)})
 return rows
out['lido']={**identity(LIDO),'lastRequestId':last,'lastFinalizedRequestId':final,'unfinalizedIdCount':last-final,'unfinalizedStETHWei':str(call(LIDO,'unfinalizedStETH()')[0]),'samples':lido_status(sample),'lockedEtherWei':str(call(LIDO,'getLockedEtherAmount()')[0])}
# Enumerate all pending Lido requests when bounded; avoids estimating unique owners from a tail sample.
if len(ids)<=5000:
 allrows=[]
 for start in range(0,len(ids),200):allrows+=lido_status(ids[start:start+200])
 out['lido']['pendingRequests']=allrows
 out['lido']['pendingSummary']={'count':len(allrows),'uniqueOwners':len(set(r['owner'] for r in allrows)),'minAgeSeconds':min((r['ageSeconds'] for r in allrows),default=None),'maxAgeSeconds':max((r['ageSeconds'] for r in allrows),default=None),'totalWei':str(sum(int(r['amountWei']) for r in allrows))}
nft=addr(call(LP,'withdrawRequestNFT()')[0]);last=call(nft,'nextRequestId()')[0]-1;final=call(nft,'lastFinalizedRequestId()')[0]
def etherfi_status(i):
 a,s,v,f=call(nft,'getRequest(uint256)',i)
 return {'id':i,'amountWei':str(a),'shares':str(s),'valid':bool(v),'feeGwei':f,'finalized':i<=final,'owner':attempt(lambda:addr(call(nft,'ownerOf(uint256)',i)[0])),'claimableWei':attempt(lambda:str(call(nft,'getClaimableAmount(uint256)',i)[0]))}
ids=list(range(final+1,last+1));samples=sorted(set(ids[:10]+ids[-10:]+list(range(max(1,last-19),last+1))))
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:rows=list(pool.map(etherfi_status,samples))
out['etherfi']={**identity(nft),'liquidityPool':LP,'lastRequestId':last,'lastFinalizedRequestId':final,'unfinalizedIdCount':last-final,'lockedEtherWei':str(call(nft,'ethAmountLockedForWithdrawal()')[0]),'samples':rows}
out['etherfi']['redemptionManager']=addr(call(LP,'etherFiRedemptionManager()')[0])
out['etherfi']['legacyInstantGetters']={sig:attempt(lambda sig=sig:call(out['etherfi']['redemptionManager'],sig)) for sig in ['exitFeeInBps()','lowWatermarkInBpsOfTvl()']}

if len(ids)<=500:
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:allrows=list(pool.map(etherfi_status,ids))
 out['etherfi']['pendingRequests']=allrows
 out['etherfi']['pendingSummary']={'count':len(allrows),'validCount':sum(r['valid'] for r in allrows),'uniqueOwners':len(set(r['owner'] for r in allrows if isinstance(r['owner'],str))),'totalFaceWei':str(sum(int(r['amountWei']) for r in allrows))}
out['ethena']={**identity(SUSDE),'cooldownDurationSeconds':call(SUSDE,'cooldownDuration()')[0],'silo':addr(call(SUSDE,'silo()')[0])}
# One pinned ~7-day window. Preserve complete source logs needed to reproduce counts and transaction checks.
transfer=calldata('Transfer(address,address,uint256)')[:10] if False else subprocess.check_output(['cast','keccak','Transfer(address,address,uint256)'],text=True).strip()
start=max(0,number-50000)
for name,a in [('lido',LIDO),('etherfi',nft)]:
 logs=attempt(lambda:rpc('eth_getLogs',[{'address':a,'fromBlock':hex(start),'toBlock':tag}],url='https://rpc.flashbots.net'))
 if isinstance(logs,dict):out[name]['transferWindow']=logs;continue
 minted=[];burned=[];moved=[]
 for log in logs:
  if log['topics'][0]!=transfer:continue
  r={'block':int(log['blockNumber'],16),'tx':log['transactionHash'],'id':int(log['topics'][3],16),'from':addr(int(log['topics'][1],16)),'to':addr(int(log['topics'][2],16))}
  (minted if int(log['topics'][1],16)==0 else burned if int(log['topics'][2],16)==0 else moved).append(r)
 out[name]['transferWindow']={'fromBlock':start,'toBlock':number,'mintCount':len(minted),'burnCount':len(burned),'nonMintBurnCount':len(moved),'moves':moved,'mintSamples':minted[-10:],'burnSamples':burned[-10:],'logRpc':'https://rpc.flashbots.net','allSourceLogs':logs}
# Pending stock concentration. IDs split at source caps; owners need not be distinct people.
for name in ['lido','etherfi']:
 byowner={}
 for r in out[name].get('pendingRequests',[]):byowner[r['owner']]=byowner.get(r['owner'],0)+int(r['amountWei'])
 out[name]['pendingOwnerConcentration']=[{'owner':a,'faceWei':str(v)} for a,v in sorted(byowner.items(),key=lambda t:-t[1])]
# Timestamp origin for ether.fi requires logs; no timestamp is stored in its request struct.
mints={int(log['topics'][3],16):int(log['blockNumber'],16) for log in out['etherfi']['transferWindow'].get('allSourceLogs',[]) if log['topics'][0]==transfer and int(log['topics'][1],16)==0}
blockTimes={}
for row in out['etherfi'].get('pendingRequests',[]):
 b=mints.get(row['id'])
 if b:
  if b not in blockTimes:blockTimes[b]=int(rpc('eth_getBlockByNumber',[hex(b),False])['timestamp'],16)
  row.update(createdBlock=b,createdAt=blockTimes[b],ageSeconds=timestamp-blockTimes[b])
 else:row['creationTimestampUnavailableInWindow']=True
print(json.dumps(out,indent=2))
