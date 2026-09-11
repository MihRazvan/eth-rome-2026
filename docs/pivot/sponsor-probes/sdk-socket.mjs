/** No funded wallet; passive public SDK subscription. Run from repository root. */
import {createRequire} from 'node:module';
const require=createRequire(`${process.cwd()}/package.json`);
const {createPublicClient}=require('@arkiv-network/sdk');
const {tiramisu}=require('@arkiv-network/sdk/chains');
const {webSocket}=require('viem');
const client=createPublicClient({chain:tiramisu,transport:webSocket('wss://rpc.tiramisu.db-chain.testnet.arkiv.network',{timeout:10000,reconnect:false})});
const result={observedAt:new Date().toISOString(),transportType:client.transport.type,fromBlockOmitted:true,pollingOverrideOmitted:true,events:0,eventTypes:[],errors:0};
const unwatch=client.watchEntityEvents({onEvent(e){result.events++;if(!result.eventTypes.includes(e.type))result.eventTypes.push(e.type)},onError(){result.errors++}});
await new Promise(r=>setTimeout(r,10000));unwatch();console.log(JSON.stringify(result,null,2));process.exit(0);
