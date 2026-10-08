"""Against the production server started with tests/mock-openai.mjs only."""
import json,os
from urllib.request import Request,build_opener,ProxyHandler
from urllib.error import HTTPError
from pathlib import Path
BASE=os.getenv('BYEOLIEUM_API_TEST_URL','http://127.0.0.1:3210')
client=build_opener(ProxyHandler({}))
def post(second):
 data=json.dumps({'cards':[{'id':'a','text':'질문하기 어려워요'},{'id':'b','text':second}]}).encode()
 req=Request(BASE+'/api/ideas',data=data,headers={'Origin':BASE,'Content-Type':'application/json','X-Forwarded-For':'provider-test'},method='POST')
 try:
  r=client.open(req);return r.status,json.loads(r.read())
 except HTTPError as e:return e.code,json.loads(e.read())
status,data=post('익명 공간이 있으면 좋겠어요');assert status==200,(status,data)
assert len(data['ideas'])==3 and data['ideas'][0]['sourceIds']==['a','b']
print('PASS: server calls provider and validates structured grounded result')
status,data=post('mock-invalid-source');assert status==502,(status,data)
print('PASS: server refuses provider output with invented sources')
status,data=post('mock-rate-limit');assert status==502 and '한도' in data['message'],(status,data)
print('PASS: provider quota error is actionable')
status,data=post('다시 요청');assert status==429,(status,data)
print('PASS: local rate limit prevents fourth provider request')
log=Path('/tmp/byeolieum-mock-openai-calls.jsonl').read_text().splitlines();assert len(log)==3,len(log)
print('PASS: exactly three outbound calls, no automatic retries')
print('TOTAL 5 provider integration checks passed (mock upstream, no live OpenAI)')
