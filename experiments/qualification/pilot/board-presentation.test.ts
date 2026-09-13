import test from 'node:test';
import assert from 'node:assert/strict';
import {orderedListings,opportunityMarkup} from './board-presentation';
import type {ListingEntity} from './listings';
const item=(id:string,reward:string,acceptBefore:number,title='Check permissions')=>({key:`0x${id.padStart(64,'0')}`,listing:{jobId:id,reward,acceptBefore,title}} as ListingEntity);
test('reward order compares full precision base units; deadlines break ties without mutating the board',()=>{
 const entries=[item('1','9007199254740992',300),item('2','9007199254740993',400),item('3','9007199254740993',200)];
 assert.deepEqual(orderedListings(entries,'reward').map(x=>x.listing.jobId),['3','2','1']);
 assert.deepEqual(orderedListings(entries,'deadline').map(x=>x.listing.jobId),['3','1','2']);
 assert.deepEqual(entries.map(x=>x.listing.jobId),['1','2','3']);
});
test('task titles and token labels remain text; stale board never offers enabled scope actions',()=>{
 const html=opportunityMarkup([item('1','500000',1800000000,'<img src=x onerror=alert(1)>')],'deadline',false,'<USDC>');
 assert.ok(!html.includes('<img'));assert.match(html,/&lt;img/);assert.match(html,/&lt;USDC&gt;/);assert.match(html,/data-view-job="1" disabled/);assert.match(html,/>0.5<\/strong>/);
});
test('unusually distant valid contract deadlines do not crash the entire board',()=>{
 const html=opportunityMarkup([item('1','100000',Number.MAX_SAFE_INTEGER)],'deadline',true,'test USDC');
 assert.match(html,/Unix time 9007199254740991/);assert.ok(!html.includes('disabled'));
});
