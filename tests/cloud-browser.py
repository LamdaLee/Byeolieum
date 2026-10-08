"""OAuth/client journeys with fake Supabase HTTP. No real users or cloud writes."""
import os,json,time,base64,copy
from playwright.sync_api import sync_playwright,expect
BASE=os.getenv('BYEOLIEUM_TEST_URL','http://127.0.0.1:3218')
SUPABASE='https://fixture.supabase.test'
USER='11111111-1111-4111-8111-111111111111'
project={'cards':[{'id':'a','text':'모바일에서 기록하기'},{'id':'b','text':'PC에서 이어 가기'}],'selected':['a','b'],'brief':{'title':'기기 간 기록','goal':'이어가기','audience':'나','feature':'기록 추가','check':'다른 기기에서도 기록이 보인다'},'step':3,'prompt':'편집한 제작 프롬프트','question':0,'positions':{}}
remote={'row':None,'calls':[],'fail':False,'conflict':False}
def b64(value):return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
token=b64({'alg':'HS256','typ':'JWT'})+'.'+b64({'sub':USER,'exp':int(time.time())+3600,'iat':int(time.time()),'aud':'authenticated','role':'authenticated','iss':SUPABASE+'/auth/v1'})+'.'+b64({'signature':'fixture'})
user={'id':USER,'aud':'authenticated','role':'authenticated','email':'fixture@example.test','app_metadata':{'provider':'google','providers':['google']},'user_metadata':{},'created_at':'2026-10-08T00:00:00Z'}
session={'access_token':token,'refresh_token':'fixture-refresh','expires_in':3600,'expires_at':int(time.time())+3600,'token_type':'bearer','user':user}
def seed(ctx,authenticated=True):
 values={'byeolieum-project-v1':json.dumps(project,ensure_ascii=False)}
 if authenticated:values['sb-fixture-auth-token']=json.dumps(session)
 ctx.add_init_script('(()=>{const values='+json.dumps(values)+';for(const [key,value] of Object.entries(values)){if(!localStorage.getItem(key))localStorage.setItem(key,value)}})()')
def handle(route):
 request=route.request;url=request.url
 headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Content-Type':'application/json'}
 def reply(data,status=200):route.fulfill(status=status,headers=headers,body=json.dumps(data))
 if request.method=='OPTIONS':return reply({})
 if '/auth/v1/settings' in url:return reply({'external':{'google':True,'kakao':True}})
 if '/auth/v1/logout' in url:return reply({})
 if '/auth/v1/user' in url:return reply(user)
 if '/rest/v1/idea_spaces' in url:
  assert USER in url
  return reply(remote['row'])
 if '/rest/v1/rpc/save_idea_space' in url:
  payload=request.post_data_json;remote['calls'].append(payload)
  if remote['fail']:return reply({'code':'503','message':'fixture unavailable'},503)
  expected=remote['row']['revision'] if remote['row'] else 0
  if remote['conflict'] or payload['p_expected_revision']!=expected:return reply({'code':'40001','message':'conflict'},409)
  remote['row']={'document':copy.deepcopy(payload['p_document']),'revision':expected+1,'user_id':USER}
  return reply([remote['row']])
 return reply({'error':'unexpected fixture endpoint'},400)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'],env={**os.environ,'NO_PROXY':'localhost,127.0.0.1'})
 ctx=browser.new_context(viewport={'width':390,'height':844},has_touch=True,reduced_motion='reduce');seed(ctx);ctx.route(SUPABASE+'/**',handle)
 page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE)
 expect(page.get_by_label('AI에 전달할 제작 프롬프트')).to_have_value(project['prompt'])
 page.get_by_role('button',name='로그인 · 계정',exact=True).click()
 expect(page.get_by_role('button',name='이 브라우저 기록을 계정에 저장')).to_be_enabled()
 before=page.evaluate("localStorage.getItem('byeolieum-project-v1')")
 page.get_by_role('button',name='이 브라우저 기록을 계정에 저장').click()
 expect(page.get_by_role('button',name='내 계정',exact=True)).to_be_visible()
 assert remote['row']['revision']==1
 page.get_by_label('AI에 전달할 제작 프롬프트').fill('클라우드에서 수정한 프롬프트')
 page.wait_for_timeout(1600)
 assert remote['row']['document']['project']['prompt']=='클라우드에서 수정한 프롬프트'
 assert page.evaluate("localStorage.getItem('byeolieum-project-v1')")==before
 print('PASS guest migration, cloud autosave and browser original preserved',flush=True)
 # A second independent browser reads the first device's saved data.
 ctx2=browser.new_context();seed(ctx2);ctx2.route(SUPABASE+'/**',handle);second=ctx2.new_page();second.goto(BASE)
 second.get_by_role('button',name='로그인 · 계정',exact=True).click()
 second.get_by_role('button',name='계정 기록 이어 하기').click()
 expect(second.get_by_label('AI에 전달할 제작 프롬프트')).to_have_value('클라우드에서 수정한 프롬프트')
 second.get_by_label('AI에 전달할 제작 프롬프트').fill('두 번째 기기에서 수정')
 second.wait_for_timeout(1600)
 page.get_by_label('AI에 전달할 제작 프롬프트').fill('오래된 첫 번째 기기의 수정')
 expect(page.locator('.account-panel .error')).to_contain_text('다른 기기')
 assert remote['row']['document']['project']['prompt']=='두 번째 기기에서 수정'
 count=len(remote['calls']);page.wait_for_timeout(1600);assert len(remote['calls'])==count
 print('PASS two-device restore, revision conflict and no automatic overwrite/retry',flush=True)
 page.once('dialog',lambda d:d.dismiss());page.get_by_role('button',name='최신 계정 기록 확인').click()
 expect(page.get_by_label('AI에 전달할 제작 프롬프트')).to_have_value('오래된 첫 번째 기기의 수정')
 page.once('dialog',lambda d:d.accept());page.get_by_role('button',name='최신 계정 기록 확인').click()
 page.get_by_role('button',name='계정 기록 이어 하기').click()
 expect(page.get_by_label('AI에 전달할 제작 프롬프트')).to_have_value('두 번째 기기에서 수정')
 remote['fail']=True
 page.get_by_label('AI에 전달할 제작 프롬프트').fill('네트워크 실패 때 남는 기록')
 expect(page.locator('.account-panel .error')).to_contain_text('저장하지 못했어요')
 count=len(remote['calls']);page.wait_for_timeout(1600);assert len(remote['calls'])==count
 remote['fail']=False;page.get_by_role('button',name='지금 계정에 저장').click()
 expect(page.locator('.account-sync')).to_have_text('클라우드 저장 완료')
 assert remote['row']['document']['project']['prompt']=='네트워크 실패 때 남는 기록'
 page.get_by_role('button',name='로그아웃',exact=True).click()
 expect(page.get_by_role('button',name='로그인 · 계정',exact=True)).to_be_visible()
 expect(page.get_by_label('AI에 전달할 제작 프롬프트')).to_have_value(project['prompt'])
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 print('PASS explicit conflict reload, network failure pause/retry and logout guest restoration',flush=True)
 ctx.close();ctx2.close()
 # OAuth request is redirected to the expected provider with PKCE; provider pages are fixtures.
 for provider,label in [('google','Google로 계속하기'),('kakao','카카오로 계속하기')]:
  ctx=browser.new_context();seed(ctx,False);ctx.route(SUPABASE+'/**',handle)
  def oauth(route,request,provider=provider):
   from urllib.parse import urlparse,parse_qs
   params=parse_qs(urlparse(route.request.url).query)
   assert params['provider']==[provider] and params['redirect_to']==[BASE]
   assert params['code_challenge_method']==['s256'] and params['code_challenge'][0]
   route.fulfill(content_type='text/html',body='<h1>Fixture provider consent</h1>')
  ctx.route(SUPABASE+'/auth/v1/authorize**',oauth)
  page=ctx.new_page();page.goto(BASE);page.get_by_role('button',name='로그인 · 계정',exact=True).click()
  page.get_by_role('button',name=label,exact=True).click()
  expect(page.get_by_role('heading',name='Fixture provider consent')).to_be_visible()
  print(f'PASS {provider} OAuth provider, redirect and PKCE request (fixture)',flush=True)
  ctx.close()
 # Provider controls reflect server settings, and a damaged guest archive stays untouched.
 ctx=browser.new_context();seed(ctx,False);ctx.route(SUPABASE+'/**',handle)
 ctx.route(SUPABASE+'/auth/v1/settings',lambda r:r.fulfill(content_type='application/json',body=json.dumps({'external':{'google':False,'kakao':True}})))
 page=ctx.new_page();page.goto(BASE);page.get_by_role('button',name='로그인 · 계정',exact=True).click()
 expect(page.get_by_role('button',name='Google로 계속하기 · 연결 준비 중',exact=True)).to_be_disabled()
 expect(page.get_by_role('button',name='카카오로 계속하기',exact=True)).to_be_enabled()
 ctx.close()
 ctx=browser.new_context();seed(ctx);ctx.add_init_script("localStorage.setItem('byeolieum-library-v1','{broken')");ctx.route(SUPABASE+'/**',handle)
 page=ctx.new_page();page.goto(BASE);page.get_by_role('button',name='로그인 · 계정',exact=True).click()
 expect(page.get_by_role('button',name='브라우저 아이디어를 계정에 합치기')).to_be_disabled()
 page.get_by_role('button',name='계정 기록 이어 하기').click()
 expect(page.get_by_role('button',name='내 계정',exact=True)).to_be_visible()
 page.get_by_role('button',name='로그아웃',exact=True).click();page.wait_for_timeout(350)
 assert page.evaluate("localStorage.getItem('byeolieum-library-v1')")=='{broken'
 print('PASS disabled providers and damaged guest archive preserved across cloud login/logout',flush=True)
 # Naver server handoff becomes a native Supabase session, without displaying internal email.
 ctx=browser.new_context();seed(ctx,False);ctx.route(SUPABASE+'/**',handle)
 ctx.route(BASE+'/api/auth/naver/status',lambda r:r.fulfill(content_type='application/json',body='{"enabled":true}'))
 ctx.route(BASE+'/api/auth/naver/start',lambda r:r.fulfill(content_type='text/html',body='<h1>Fixture Naver consent</h1>'))
 page=ctx.new_page();page.goto(BASE);page.get_by_role('button',name='로그인 · 계정',exact=True).click()
 page.get_by_role('button',name='네이버로 계속하기',exact=True).click();expect(page.get_by_role('heading',name='Fixture Naver consent')).to_be_visible()
 ctx.close()
 ctx=browser.new_context();seed(ctx,False)
 naver_user={**user,'email':'naver-internal@accounts.byeolieum.com','user_metadata':{'login_provider':'naver','display_name':'별이음 테스트'}}
 def naver_handle(r):
  if '/auth/v1/user' in r.request.url:r.fulfill(content_type='application/json',body=json.dumps(naver_user))
  else:handle(r)
 ctx.route(SUPABASE+'/**',naver_handle)
 ctx.route(BASE+'/api/auth/naver/session',lambda r:r.fulfill(content_type='application/json',body=json.dumps({'access_token':token,'refresh_token':'fixture-refresh'})))
 page=ctx.new_page();page.goto(BASE+'/?naver_login=ready')
 expect(page.locator('.account-email')).to_have_text('별이음 테스트')
 assert 'naver_login' not in page.url
 assert 'naver-internal@' not in page.locator('body').inner_text()
 expect(page.get_by_role('button',name='계정 기록 이어 하기')).to_be_visible()
 ctx.close()
 ctx=browser.new_context();seed(ctx,False);ctx.route(SUPABASE+'/**',handle)
 ctx.route(BASE+'/api/auth/naver/session',lambda r:r.fulfill(status=401,content_type='application/json',body='{"error":"expired"}'))
 page=ctx.new_page();page.goto(BASE+'/?naver_login=ready');expect(page.locator('.account-panel .error')).to_contain_text('만료')
 assert not page.evaluate("localStorage.getItem('sb-fixture-auth-token')")
 print('PASS Naver consent redirect, native session handoff, private email hidden and expired handoff (fixture)',flush=True)
 ctx.close();browser.close()
