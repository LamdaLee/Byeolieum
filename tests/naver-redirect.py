"""Run against a production test server configured with fixture Naver keys only."""
import os,urllib.request,urllib.error
from urllib.parse import urlparse,parse_qs
BASE=os.getenv('BYEOLIEUM_TEST_URL','http://127.0.0.1:3222')
ORIGIN=os.getenv('BYEOLIEUM_TEST_AUTH_ORIGIN','https://byeolieum.com')
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args):return None
client=urllib.request.build_opener(NoRedirect)
states=set()
for host in ['byeolieum.com','internal-vercel.example','www.byeolieum.com']:
 try:r=client.open(urllib.request.Request(BASE+'/api/auth/naver/start',headers={'Host':host}))
 except urllib.error.HTTPError as e:r=e
 assert r.status==307
 target=urlparse(r.headers['Location']);query=parse_qs(target.query)
 assert target.hostname=='nid.naver.com', 'Must go directly to Naver, never redirect back to start'
 assert query['redirect_uri']==[ORIGIN+'/api/auth/naver/callback']
 assert query['client_id']==['fixture-client']
 state=query['state'][0];assert state not in states;states.add(state)
 cookie=r.headers['Set-Cookie'];assert state in cookie and 'HttpOnly' in cookie and 'SameSite=lax' in cookie
 assert r.headers['Cache-Control']=='no-store'
print('PASS rewritten Host cannot cause a self-redirect loop; callback fixed, per-request state and private cookie preserved')
