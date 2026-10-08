// Test process only: never import this module in application code.
// Intercepts the fixed OpenAI endpoint without any external request.
import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';
const original=globalThis.fetch;
globalThis.fetch=async function(url,options){
 if(String(url)!=='https://api.openai.com/v1/chat/completions')return original(url,options);
 const body=JSON.parse(options.body);const cards=JSON.parse(body.messages[1].content).cards;
 assert.equal(body.model,'gpt-4.1-mini');assert.equal(body.response_format.json_schema.strict,true);
 assert.ok(body.max_completion_tokens<=1600);assert.ok(cards.length>=2&&cards.length<=5);
 appendFileSync('/tmp/byeolieum-mock-openai-calls.jsonl',JSON.stringify({model:body.model,cardIds:cards.map(c=>c.id)})+'\n');
 if(cards.some(c=>c.text.includes('mock-rate-limit')))return Response.json({error:{}},{status:429});
 const ideas=Array.from({length:3},(_,i)=>({title:`테스트 아이디어 ${i+1}`,goal:'불편 줄이기',audience:'초보자',feature:'질문 입력',check:'빈 질문은 저장되지 않는다',reason:'선택한 두 카드의 공통점을 연결',sourceIds:cards.map(c=>c.id)}));
 if(cards.some(c=>c.text.includes('mock-invalid-source')))ideas[0].sourceIds=['nonexistent','other'];
 return Response.json({choices:[{message:{content:JSON.stringify({ideas})}}]});
};
