#!/usr/bin/env python3
"""Enrich claims-observations.json with pinned fast-exit and bounded-log evidence.
Read-only. Run after claims-probe.py; uses Foundry cast. No environment/keys saved.
"""
import collections,datetime,json,pathlib,statistics,subprocess
P=pathlib.Path(__file__).with_name('claims-observations.json');x=json.loads(P.read_text());block=x['block']['number'];tag=hex(block)
def rpc(method,params,url='https://ethereum-rpc.publicnode.com'):
 r=subprocess.run(['cast','rpc','--rpc-url',url,method,*[json.dumps(v,separators=(',',':')) for v in params]],capture_output=True,text=True,timeout=45)
 if r.returncode:raise RuntimeError(r.stderr[:250])
 return json.loads(r.stdout)
def words(data):return [int(data[i:i+64],16) for i in range(2,len(data),64)]
def data(sig,*args):return subprocess.check_output(['cast','calldata',sig,*map(str,args)],text=True).strip()
def call(a,sig,*args):return words(rpc('eth_call',[{'to':a,'data':data(sig,*args)},tag]))
def topic(sig):return subprocess.check_output(['cast','keccak',sig],text=True).strip()
def safe(fn):
 try:return fn()
 except Exception as e:return {'error':str(e)}
transfer=topic('Transfer(address,address,uint256)');start=block-10000
startTime=int(rpc('eth_getBlockByNumber',[hex(start),False])['timestamp'],16)
for name in ['lido','etherfi']:
 y=x[name];a=y['address'];prior=y['transferWindow'];logs=rpc('eth_getLogs',[{'address':a,'fromBlock':hex(start),'toBlock':tag}],'https://rpc.flashbots.net')
 # Reconcile explicit10k query with initial50k query; avoid trusting a silently narrowed result as7-dayflow.
 prior['initial50000BlockRequestReturnedSameLogsAsExplicit10000']=logs==prior['allSourceLogs']
 prior['fromBlock']=start;prior['fromTimestamp']=startTime;prior['durationSeconds']=x['block']['timestamp']-startTime;prior['allSourceLogs']=logs
 ids=sorted(int(l['topics'][3],16) for l in logs if l['topics'][0]==transfer and int(l['topics'][1],16)==0)
 prior['mintIdRange']=[ids[0],ids[-1]];prior['contiguousMintIdsThroughPinnedLastRequest']=ids==list(range(ids[0],y['lastRequestId']+1))
 requested=topic('WithdrawalRequested(uint256,address,address,uint256,uint256)') if name=='lido' else topic('WithdrawRequestCreated(uint32,uint256,uint256,address)')
 created=[l for l in logs if l['topics'][0]==requested]
 prior['requestEventCount']=len(created);prior['requestedFaceWei']=str(sum(words(l['data'])[0] for l in created));prior['requestEventCountMatchesMints']=len(created)==len(ids)
 burns={(l['transactionHash'],int(l['topics'][3],16)) for l in logs if l['topics'][0]==transfer and int(l['topics'][2],16)==0}
 prior['nonmintTransfersWithSameTransactionBurn']=sum((m['tx'],m['id']) in burns for m in prior['moves'])
 vals=sorted(int(r['amountWei']) for r in y['pendingRequests']);total=sum(vals)
 for owner in y['pendingOwnerConcentration'][:10]:owner['runtimeCodeBytes']=(len(rpc('eth_getCode',[owner['owner'],tag]))-2)//2
 y['pendingSizeSummary']={'minWei':str(vals[0]),'medianWei':str((vals[(len(vals)-1)//2]+vals[len(vals)//2])//2),'maxWei':str(vals[-1]),'belowOneETHCount':sum(v<10**18 for v in vals),'topOwnerSharePercent':int(y['pendingOwnerConcentration'][0]['faceWei'])/total*100,'topThreeOwnersSharePercent':sum(int(r['faceWei']) for r in y['pendingOwnerConcentration'][:3])/total*100}
 if name=='lido':
  raw=call(a,'getWithdrawalStatus(uint256[])','['+str(y['lastFinalizedRequestId'])+']');r=raw[2:8]
  y['finalizedBoundarySample']={'id':y['lastFinalizedRequestId'],'amountWei':str(r[0]),'shares':str(r[1]),'owner':'0x'+f'{r[2]:040x}','createdAt':r[3],'finalized':bool(r[4]),'claimed':bool(r[5])}
 else:
  y['finalizedBoundarySamples']=[]
  for i in range(y['lastFinalizedRequestId']-9,y['lastFinalizedRequestId']+1):
   r=call(a,'getRequest(uint256)',i);owner=safe(lambda:'0x'+f'{call(a,"ownerOf(uint256)",i)[0]:040x}')
   y['finalizedBoundarySamples'].append({'id':i,'amountWei':str(r[0]),'valid':bool(r[2]),'owner':owner,'claimableWei':safe(lambda:str(call(a,'getClaimableAmount(uint256)',i)[0]))})
manager=x['etherfi']['redemptionManager'];native='0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';r=call(manager,'tokenToRedemptionInfo(address)',native)
x['etherfi']['instantETH']={'manager':manager,'rawRedemptionInfoWords':[str(v) for v in r],'exitFeeSplitToTreasuryBps':r[-3],'exitFeeBps':r[-2],'lowWatermarkBpsOfTVL':r[-1],'totalRedeemableWei':str(call(manager,'totalRedeemableAmount(address)',native)[0]),'canRedeemOneETH':bool(call(manager,'canRedeem(uint256,address)',10**18,native)[0]),'explanation':'Liquid eETH/weETH input only, not existing withdrawalNFT. Preview availability at pinned block is not guaranteed execution.'}
admin='0x0EF8fa4760Db8f5Cd4d993f3e3416f30f942D705'
x['etherfi']['staleOracleFallback']={'admin':admin,'staleOracleReportBlockWindow':call(admin,'staleOracleReportBlockWindow()')[0],'readAtBlock':block,'semantics':'Threshold in blocks, fundable valid requests only; not unconditional payout SLA.'}
x['rpcLimitations']=['Python urllib publicnode HTTP403; Foundry cast succeeded for pinned currenteth_call.','Publicnode historicalstateandlogs denied: archive personal token required.','Flashbots50k logs silently matched explicit10k logs; onlyexplicit10k (~1.39day) window reported.','Flashbots eth_call notwhitelisted; LlamaHTTP525, Blockpi404, dRPC/mevblocker/1rpc logrange caps. No paid/privatekeysused.']
P.write_text(json.dumps(x,indent=2)+'\n')
print(json.dumps({n:{'stock':x[n]['pendingSizeSummary'],'flow':{k:x[n]['transferWindow'][k] for k in ['fromBlock','durationSeconds','mintCount','burnCount','nonMintBurnCount','requestEventCount','requestedFaceWei','contiguousMintIdsThroughPinnedLastRequest','nonmintTransfersWithSameTransactionBurn']}} for n in ['lido','etherfi']},indent=2))
