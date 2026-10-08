"""Production checks. Requires Python playwright and Chromium; no live AI calls."""
import json, os, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
BASE=os.getenv('BYEOLIEUM_TEST_URL','http://127.0.0.1:3204')
ROOT=Path(__file__).resolve().parents[1]
results=[];metrics={}
def check(name):results.append(name);print('PASS:',name,flush=True)
def mock_ideas(cards):
 return [{'title':f'가능성 {i+1}','goal':'질문을 편하게 남기기','audience':'처음 참여한 교육생','feature':'익명 질문 입력','check':'빈 질문은 저장되지 않는다','reason':'질문하기 어려움과 기록의 필요를 연결했어요.','sourceIds':[c['id'] for c in cards[:2]]} for i in range(3)]
def finish_questions(page):
 for key,text in [('title','나의 체크리스트'),('goal','빠뜨리지 않기'),('audience','교육 담당자'),('feature','항목 추가'),('check','추가하면 목록에 표시된다')]:
  page.locator('#'+key).fill(text)
  page.get_by_role('button',name='다음 질문' if key!='check' else '프롬프트 만들기').click()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.getenv('BYEOLIEUM_CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'],env={**os.environ,'NO_PROXY':'localhost,127.0.0.1'})
 ctx=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
 page=ctx.new_page();errors=[];posts=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:posts.append(r.url) if r.method=='POST' and '/api/ideas' in r.url else None)
 assert page.goto(BASE).status==200
 expect(page.get_by_role('button',name='예제로 체험하기')).to_be_enabled()
 check('production homepage and new canvas render')
 page.get_by_role('button',name='카드 추가',exact=False).click()
 expect(page.locator('.error')).to_contain_text('한 줄 이상')
 page.get_by_label('새로운 생각').fill('<img src=x onerror=alert(1)>')
 page.get_by_role('button',name='카드 추가').click()
 assert page.locator('.canvas-card img').count()==0
 page.get_by_role('button',name='카드 1 수정',exact=True).click()
 page.get_by_label('생각 카드 수정').fill('수정한 생각')
 page.get_by_role('button',name='수정 저장').click()
 expect(page.locator('.canvas-card')).to_contain_text('수정한 생각')
 page.get_by_role('button',name='카드 1 수정',exact=True).click()
 page.get_by_role('button',name='이 카드 삭제',exact=True).click()
 assert page.locator('.canvas-card').count()==0
 check('blank validation, safe text, edit and delete')
 page.get_by_role('button',name='예제로 체험하기').click()
 expect(page.locator('.canvas-card')).to_have_count(3)
 page.locator('.card-select').nth(0).click();page.locator('.card-select').nth(2).click()
 expect(page.locator('.canvas-card.selected')).to_have_count(2)
 expect(page.locator('.connection')).to_have_count(2)
 assert not posts
 check('instant local selection, connectors and zero automatic AI posts')
 page.screenshot(path=str(ROOT/'docs/screenshots/desktop.png'),full_page=True)
 grip=page.get_by_role('button',name='카드 1 이동',exact=True)
 rect=grip.bounding_box();before=page.locator('.canvas-card').nth(0).bounding_box()
 # Sample frame gaps during an actual drag; use DOM directly to avoid test-call latency.
 page.evaluate("""window.frameGaps=[];window.measureFrames=true;let last=performance.now();function tick(t){if(!window.measureFrames)return;window.frameGaps.push(t-last);last=t;requestAnimationFrame(tick)}requestAnimationFrame(tick)""")
 page.mouse.move(rect['x']+rect['width']/2,rect['y']+rect['height']/2);page.mouse.down()
 page.mouse.move(rect['x']+60,rect['y']+40,steps=20)
 during=page.locator('.canvas-card').nth(0).bounding_box()
 assert during['x']>before['x']+20
 page.mouse.up();page.evaluate('window.measureFrames=false')
 gaps=page.evaluate('window.frameGaps');metrics['drag_frame_gap_p95_ms']=round(sorted(gaps)[int((len(gaps)-1)*.95)],2)
 assert metrics['drag_frame_gap_p95_ms']<50,metrics
 expect(page.locator('.canvas-card.dragging')).to_have_count(0)
 page.reload();expect(page.locator('.canvas-card.selected')).to_have_count(2)
 after=page.locator('.canvas-card').nth(0).bounding_box()
 assert abs(after['x']-during['x'])<3
 check('drag updates during movement, persists on release and frame p95 below 50ms in this environment')
 old=page.locator('.canvas-card').nth(0).bounding_box()['x']
 page.get_by_role('button',name='카드 1 이동',exact=True).focus();page.keyboard.press('ArrowRight')
 assert page.locator('.canvas-card').nth(0).bounding_box()['x']>old
 check('keyboard alternative for moving cards')
 page.get_by_role('button',name='AI 아이디어 3개 제안받기').click()
 expect(page.locator('.ai-message')).to_contain_text('아직 연결')
 page.get_by_role('button',name='다른 AI에서 아이디어 찾기').click()
 expect(page.get_by_label('아이디어 연결 프롬프트')).to_contain_text('교육 준비물을 자주 빠뜨려요.')
 assert '매번 비슷한 준비를 반복해요.' not in page.get_by_label('아이디어 연결 프롬프트').input_value()
 check('real unconfigured API fails honestly and external prompt preserves selected notes only')
 def ai_mock(route):
  if route.request.method=='GET':route.fulfill(json={'enabled':True,'provider':'OpenAI'});return
  cards=route.request.post_data_json['cards'];route.fulfill(json={'ideas':mock_ideas(cards)})
 page.route('**/api/ideas',ai_mock)
 page.get_by_role('button',name='AI 아이디어 3개 제안받기').click()
 expect(page.locator('.idea-candidate')).to_have_count(3)
 page.locator('.idea-candidate').first.get_by_text('연결 근거 확인',exact=True).click()
 expect(page.locator('.idea-candidate').first.locator('details li')).to_have_count(2)
 page.screenshot(path=str(ROOT/'docs/screenshots/ai-candidates.png'),full_page=True)
 page.locator('.idea-candidate').first.get_by_role('button',name='이 아이디어 선택').click()
 expect(page.locator('.idea-node strong')).to_contain_text('가능성 1')
 page.get_by_role('button',name='이 아이디어 구체화').click()
 expect(page.locator('#title')).to_have_value('가능성 1')
 expect(page.locator('.question-form textarea')).to_have_count(1)
 check('AI candidates, evidence, adoption and single-question drawer (mocked AI)')
 page.locator('#title').fill(' ');page.get_by_role('button',name='다음 질문').click()
 expect(page.locator('.error')).to_contain_text('답을 한 줄')
 page.locator('#title').fill('나의 체크리스트');page.get_by_role('button',name='다음 질문').click()
 page.reload();expect(page.locator('#goal')).to_be_visible()
 page.get_by_role('button',name='이전',exact=False).click();expect(page.locator('#title')).to_have_value('나의 체크리스트')
 check('single-question validation, back navigation and progress restore')
 finish_questions(page)
 expect(page.get_by_label('AI에 전달할 제작 프롬프트')).to_contain_text('추가하면 목록에 표시된다')
 prompt=page.get_by_label('AI에 전달할 제작 프롬프트');prompt.fill(prompt.input_value()+'\n내가 추가한 조건')
 page.reload();expect(page.get_by_label('AI에 전달할 제작 프롬프트')).to_contain_text('내가 추가한 조건')
 check('full prompt generation and edited result restore')
 page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('blocked')}}})")
 page.get_by_role('button',name='프롬프트 복사',exact=False).click();expect(page.locator('.error')).to_contain_text('복사하지 못했어요')
 page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text)=>{window.copied=text}}})")
 page.get_by_role('button',name='프롬프트 복사',exact=False).click();expect(page.locator('.notice')).to_contain_text('복사했어요')
 assert page.evaluate('window.copied')==page.get_by_label('AI에 전달할 제작 프롬프트').input_value()
 check('truthful clipboard success/failure and exact copied result')
 page.get_by_role('button',name='카드 1 수정',exact=True).click()
 page.get_by_role('button',name='이 카드 삭제',exact=True).click()
 expect(page.get_by_role('button',name='AI 아이디어 3개 제안받기')).to_be_disabled()
 page.reload();expect(page.get_by_role('button',name='AI 아이디어 3개 제안받기')).to_be_disabled()
 check('deleting a required source returns to selection safely')
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 check('desktop no horizontal overflow')
 page.on('dialog',lambda dialog:dialog.accept());page.get_by_role('button',name='초기화',exact=True).click();page.reload()
 expect(page.get_by_role('button',name='예제로 체험하기')).to_be_enabled();assert page.locator('.canvas-card').count()==0
 check('reset remains empty across reload')
 page.add_init_script("if(location.search.includes('test-corrupt=1')){localStorage.setItem('byeolieum-project-v1','{bad');history.replaceState(null,'',location.pathname)}")
 page.goto(BASE+'?test-corrupt=1')
 expect(page.locator('.notice')).to_contain_text('초기화')
 check('corrupt storage recovery')
 page.add_init_script("if(location.search.includes('test-seed=1')){localStorage.setItem('byeolieum-project-v1',JSON.stringify({cards:Array.from({length:50},(_,i)=>({id:String(i),text:'생각 '+i})),selected:[],brief:{title:'',audience:'',goal:'',feature:'',check:''},step:1,prompt:''}));history.replaceState(null,'',location.pathname)}")
 page.goto(BASE+'?test-seed=1');expect(page.locator('.canvas-card')).to_have_count(6)
 for i in range(6):page.locator('.card-select').nth(i).click()
 expect(page.locator('.error')).to_contain_text('5개까지');expect(page.locator('.canvas-card.selected')).to_have_count(5)
 page.get_by_role('button',name='뒤 카드').click();expect(page.locator('.canvas-card').first).to_contain_text('생각 6')
 check('50 cards paginate and selection capped at five')
 # Slow API must not block local interactions; stale response must not replace current choice.
 page.get_by_role('button',name='초기화',exact=True).click();page.get_by_role('button',name='예제로 체험하기').click()
 page.locator('.card-select').nth(0).click();page.locator('.card-select').nth(1).click()
 page.unroute('**/api/ideas');pending=[]
 def slow(route):
  if route.request.method=='GET':route.fulfill(json={'enabled':True})
  else:pending.append(route)
 page.route('**/api/ideas',slow)
 page.get_by_role('button',name='AI 아이디어 3개 제안받기').click()
 expect(page.get_by_role('button',name='가능성을 찾고 있어요')).to_be_disabled()
 page.locator('.card-select').nth(2).click();expect(page.locator('.canvas-card.selected')).to_have_count(3)
 expect(page.get_by_role('button',name='AI 아이디어 3개 제안받기')).to_be_enabled()
 assert pending
 try:pending[0].fulfill(json={'ideas':mock_ideas([{'id':'sample-1'},{'id':'sample-2'}])})
 except Exception:pass
 expect(page.locator('.idea-candidate')).to_have_count(0)
 check('slow AI never blocks card selection and stale responses ignored')
 cdp=ctx.new_cdp_session(page);cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
 measured=page.evaluate("""()=>new Promise(resolve=>{const button=document.querySelector('.card-select');const before=button.getAttribute('aria-pressed');const start=performance.now();button.click();requestAnimationFrame(()=>resolve({elapsed:performance.now()-start,changed:button.getAttribute('aria-pressed')!==before}))})""")
 metrics['selection_frame_ms_4x_cpu']=round(measured['elapsed'],2)
 assert measured['changed'] and measured['elapsed']<100,measured
 cdp.send('Emulation.setCPUThrottlingRate',{'rate':1})
 check('local selection paints within 100ms at simulated 4x CPU slowdown')
 mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce')
 m=mobile.new_page();m.goto(BASE);m.get_by_role('button',name='예제로 체험하기').click()
 assert m.locator('.card-grip').first.is_hidden()
 m.locator('.card-select').nth(0).click();m.locator('.card-select').nth(1).click()
 assert m.evaluate('document.documentElement.scrollWidth<=innerWidth')
 m.screenshot(path=str(ROOT/'docs/screenshots/mobile.png'),full_page=True)
 m.get_by_role('button',name='직접 아이디어 정하기').click()
 for key,text in [('title','나의 모바일 앱'),('goal','정리하기'),('audience','나'),('feature','목록'),('check','추가하면 보인다')]:
  m.locator('#'+key).fill(text);assert m.evaluate('document.documentElement.scrollWidth<=innerWidth')
  m.get_by_role('button',name='다음 질문' if key!='check' else '프롬프트 만들기').click()
 expect(m.get_by_label('AI에 전달할 제작 프롬프트')).to_be_visible()
 assert m.evaluate('document.documentElement.scrollWidth<=innerWidth')
 check('mobile selection without dragging, all five questions and prompt without overflow')
 blocked=browser.new_context();blocked.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw Error('unavailable')}})")
 b=blocked.new_page();b.goto(BASE);expect(b.locator('.error').first).to_contain_text('저장');b.get_by_role('button',name='예제로 체험하기').click();expect(b.locator('.canvas-card')).to_have_count(3)
 check('storage unavailable still allows local work')
 # Actual HTTP endpoint guard checks: no provider requests are made without a key.
 request=ctx.request
 assert request.get(BASE+'/api/ideas').json()['enabled']==False
 check('AI readiness endpoint reports actual missing key')
 assert request.post(BASE+'/api/ideas',data={'cards':[{'id':'a','text':'a'},{'id':'b','text':'b'}]},headers={'Origin':'https://evil.example'}).status==403
 check('API rejects cross-origin requests')
 assert request.post(BASE+'/api/ideas',data={'cards':[{'id':'a','text':'a'}]},headers={'Origin':BASE}).status==400
 check('API validates selected card count before provider access')
 assert request.post(BASE+'/api/ideas',data={'cards':[{'id':'a','text':'a'},{'id':'b','text':'b'}]},headers={'Origin':BASE}).status==503
 check('missing API credential yields explicit 503')
 assert request.post(BASE+'/api/ideas',data='x'*9000,headers={'Origin':BASE,'Content-Type':'application/json'}).status==413
 check('API enforces real request body byte limit')
 assert not errors,errors;check('no page JavaScript errors')
 browser.close()
(ROOT/'docs/screenshots/checks.json').write_text(json.dumps({'target':BASE,'checks':results,'total':len(results),'performance':metrics},ensure_ascii=False,indent=2)+'\n')
print('TOTAL',len(results),'checks passed',metrics)
