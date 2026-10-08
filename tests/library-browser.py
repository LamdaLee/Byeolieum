"""Idea archive and experiment journeys. No live AI calls or credentials."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.getenv('BYEOLIEUM_TEST_URL', 'http://127.0.0.1:3215')
ROOT = Path(__file__).resolve().parents[1]
KEY = 'byeolieum-project-v1'
LIBRARY = 'byeolieum-library-v1'
legacy = {
 'cards': [{'id':'a','text':'준비물을 빠뜨려요'},{'id':'b','text':'매번 같은 준비를 반복해요'},{'id':'c','text':'질문하기 어려워요'}],
 'selected':['a','b'], 'brief': {'title':'교육 체크리스트','goal':'빠뜨리지 않기','audience':'교육 담당자','feature':'항목 추가와 완료 표시','check':'새로고침해도 추가한 항목이 남는다'},
 'step':3,'prompt':'사용자가 편집한 제작 프롬프트'
}
def seed(context, archive=None):
 context.add_init_script(f"if(!localStorage.getItem({json.dumps(KEY)}))localStorage.setItem({json.dumps(KEY)},{json.dumps(json.dumps(legacy,ensure_ascii=False))})")
 if archive is not None:
  context.add_init_script(f"if(!localStorage.getItem({json.dumps(LIBRARY)}))localStorage.setItem({json.dumps(LIBRARY)},{json.dumps(archive)})")
def stored(page):
 return json.loads(page.evaluate(f'localStorage.getItem({json.dumps(LIBRARY)})'))
def no_overflow(page):
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'horizontal overflow'
def finish(page,title):
 for key,value in [('title',title),('goal','불편 줄이기'),('audience','교육생'),('feature','익명 질문 입력'),('check','빈 질문은 저장되지 않는다')]:
  page.locator('#'+key).fill(value)
  page.get_by_role('button',name='다음 질문' if key!='check' else '프롬프트 만들기').click()

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'],env={**os.environ,'NO_PROXY':'localhost,127.0.0.1'})
 for width in [320,390,1280]:
  ctx=browser.new_context(viewport={'width':width,'height':900},has_touch=True,reduced_motion='reduce',accept_downloads=True)
  seed(ctx);page=ctx.new_page();errors=[];posts=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('request',lambda r:posts.append(r.url) if r.method=='POST' else None)
  page.add_init_script("Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copiedText=text}},configurable:true})")
  page.goto(BASE)
  expect(page.get_by_label('AI에 전달할 제작 프롬프트')).to_have_value(legacy['prompt'])
  no_overflow(page)
  page.get_by_role('button',name='저장하고 첫 실험 만들기').click()
  expect(page.get_by_role('heading',name='교육 체크리스트',exact=True)).to_be_visible()
  expect(page.get_by_label('첫 실험 과제')).to_contain_text(legacy['brief']['feature'])
  page.get_by_label('실험 상태',exact=True).select_option('verified')
  expect(page.locator('.experiment-panel .error')).to_contain_text('모든 확인 기준')
  expect(page.get_by_label('실험 상태',exact=True)).to_have_value('planned')
  page.get_by_label('확인 기준 추가',exact=True).fill('빈 항목은 추가되지 않는다')
  page.locator('.check-form').get_by_role('button',name='추가',exact=True).click()
  expect(page.get_by_role('checkbox')).to_have_count(2)
  for i in range(2):page.get_by_role('checkbox').nth(i).check()
  for field,text in [('실제 결과','직접 추가하고 새로고침했더니 항목이 남았어요.'),('막힌 점','저장 위치가 헷갈렸어요.'),('배운 점','브라우저 저장 개념을 이해했어요.'),('다음에 바꿀 점','완료 표시를 더 크게 만들기')]:
   page.get_by_label(field,exact=True).fill(text)
  page.get_by_label('실험 상태',exact=True).select_option('verified')
  page.get_by_role('button',name='실험 도움 프롬프트 복사').click()
  assert '직접 추가하고 새로고침' in page.evaluate('window.copiedText')
  page.wait_for_timeout(350);page.reload()
  page.get_by_role('button',name='보관함 1',exact=True).click()
  expect(page.get_by_label('실제 결과',exact=True)).to_have_value('직접 추가하고 새로고침했더니 항목이 남았어요.')
  expect(page.get_by_label('실험 상태',exact=True)).to_have_value('verified')
  expect(page.get_by_role('checkbox').first).to_be_checked()
  page.get_by_role('checkbox').first.uncheck()
  expect(page.get_by_label('실험 상태',exact=True)).to_have_value('trying')
  page.get_by_role('checkbox').first.check();page.get_by_label('실험 상태',exact=True).select_option('verified')
  old_task=page.get_by_label('첫 실험 과제').input_value()
  page.get_by_label('첫 실험 과제').fill('새 범위를 작은 예제로 다시 실행해 보기')
  expect(page.get_by_label('실험 상태',exact=True)).to_have_value('planned')
  for i in range(2):expect(page.get_by_role('checkbox').nth(i)).not_to_be_checked()
  expect(page.get_by_label('실제 결과',exact=True)).to_have_value('직접 추가하고 새로고침했더니 항목이 남았어요.')
  page.get_by_label('첫 실험 과제').fill(old_task)
  for i in range(2):page.get_by_role('checkbox').nth(i).check()
  page.get_by_label('실험 상태',exact=True).select_option('verified')
  no_overflow(page)
  page.get_by_role('button',name='새 아이디어 ＋',exact=True).click()
  expect(page.locator('.canvas-card')).to_have_count(3)
  expect(page.locator('.canvas-card.selected')).to_have_count(0)
  page.locator('.card-select').nth(1).click();page.locator('.card-select').nth(2).click()
  page.get_by_role('button',name='직접 아이디어 정하기').click();finish(page,'익명 질문함')
  page.get_by_role('button',name='저장하고 첫 실험 만들기').click()
  expect(page.get_by_role('button',name='보관함 2',exact=True)).to_be_visible()
  expect(page.get_by_label('실제 결과',exact=True)).to_have_value('')
  page.get_by_role('navigation',name='저장한 아이디어').get_by_role('button').filter(has_text='교육 체크리스트').click()
  expect(page.get_by_label('실험 상태',exact=True)).to_have_value('verified')
  page.get_by_role('button',name='제작 프롬프트 복사',exact=True).click()
  assert page.evaluate('window.copiedText')==legacy['prompt']
  page.get_by_role('button',name='아이디어 이어서 다듬기').click()
  expect(page.get_by_label('AI에 전달할 제작 프롬프트')).to_have_value(legacy['prompt'])
  page.get_by_role('button',name='아이디어 다듬기',exact=False).click()
  page.locator('#title').fill('교육 체크리스트 수정본')
  page.get_by_role('button',name='수정본 저장',exact=True).click()
  expect(page.get_by_role('button',name='보관함 2',exact=True)).to_be_visible()
  page.get_by_role('button',name='다른 아이디어로 저장',exact=True).click()
  page.get_by_role('button',name='보관함 3',exact=True).click()
  page.once('dialog',lambda d:d.dismiss());page.get_by_role('button',name='이 아이디어 보관함에서 삭제').click()
  expect(page.locator('.library-list button')).to_have_count(3)
  page.once('dialog',lambda d:d.accept());page.get_by_role('button',name='이 아이디어 보관함에서 삭제').click()
  expect(page.locator('.library-list button')).to_have_count(2)
  with page.expect_download() as downloaded:page.get_by_role('button',name='보관함 파일 내려받기').click()
  payload=json.loads(Path(downloaded.value.path()).read_text())
  assert len(payload['items'])==2
  original=next(i for i in payload['items'] if i['project']['brief']['title']=='교육 체크리스트 수정본')
  assert original['experiment']['status']=='verified' and original['experiment']['learned']=='브라우저 저장 개념을 이해했어요.'
  no_overflow(page)
  page.wait_for_timeout(350);page.reload();page.get_by_role('button',name='보관함 2',exact=True).click()
  assert len(stored(page)['items'])==2
  assert not errors,errors
  assert not posts,posts
  if width==390:page.screenshot(path=str(ROOT/'docs/screenshots/library-mobile.png'),full_page=True)
  if width==1280:page.screenshot(path=str(ROOT/'docs/screenshots/library-desktop.png'),full_page=True)
  print(f'PASS {width}px: legacy migration, archive snapshots, upsert/copy, verified guards, records restore, reopen, deletion, export, no AI posts/overflow/errors',flush=True)
  ctx.close()
 # Broken archive must not be overwritten or erase the independent current project.
 ctx=browser.new_context();seed(ctx,'{broken');page=ctx.new_page();page.goto(BASE)
 expect(page.get_by_label('AI에 전달할 제작 프롬프트')).to_have_value(legacy['prompt'])
 expect(page.get_by_role('button',name='아이디어 저장',exact=True)).to_be_disabled()
 page.wait_for_timeout(350);assert page.evaluate(f'localStorage.getItem({json.dumps(LIBRARY)})')=='{broken'
 print('PASS corrupt archive preserved; existing current project usable',flush=True)
 ctx.close()
 # Storage unavailable still allows the existing local-only card workflow.
 ctx=browser.new_context();ctx.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw Error('blocked')}})")
 page=ctx.new_page();page.goto(BASE);page.get_by_role('button',name='예제로 체험하기').click()
 expect(page.locator('.canvas-card')).to_have_count(3)
 expect(page.get_by_role('button',name='아이디어 저장',exact=True)).to_be_disabled()
 print('PASS blocked storage does not block local card work',flush=True)
 ctx.close()
 # Quota failure must not report an idea as successfully archived or switch screens.
 ctx=browser.new_context();seed(ctx);page=ctx.new_page();page.goto(BASE)
 expect(page.get_by_role('button',name='아이디어 저장',exact=True)).to_be_enabled()
 page.evaluate("()=>{Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError')}}")
 page.get_by_role('button',name='저장하고 첫 실험 만들기').click()
 expect(page.get_by_label('AI에 전달할 제작 프롬프트')).to_have_value(legacy['prompt'])
 expect(page.get_by_role('button',name='보관함 0',exact=True)).to_be_visible()
 expect(page.locator('.error').filter(has_text='아이디어를 저장하지 못했어요')).to_be_visible()
 print('PASS quota failure keeps current work and never reports successful archive',flush=True)
 ctx.close()
 # Draft cards cannot be mistaken for the saved project when switching ideas.
 ctx=browser.new_context();seed(ctx);page=ctx.new_page();page.goto(BASE)
 page.get_by_role('button',name='아이디어 저장',exact=True).click()
 page.get_by_role('button',name='모으기',exact=False).click()
 page.get_by_role('button',name='카드 1 수정',exact=True).click()
 page.get_by_label('생각 카드 수정').fill('아직 저장하지 않은 생각')
 expect(page.get_by_role('button',name='수정본 저장',exact=True)).to_be_disabled()
 page.once('dialog',lambda d:d.dismiss());page.get_by_role('button',name='새 아이디어 시작',exact=True).click()
 expect(page.get_by_label('생각 카드 수정')).to_have_value('아직 저장하지 않은 생각')
 assert len(stored(page)['items'])==1
 print('PASS unsaved card editor protected from archive save and draft switching',flush=True)
 ctx.close()
 # A full library may update an existing record but never silently evicts one.
 items=[{'id':f'idea-{i}','createdAt':'2026-10-08T00:00:00Z','updatedAt':'2026-10-08T00:00:00Z','project':legacy,'experiment':{'task':'작은 예제로 구현하기','checks':[{'id':'check','text':legacy['brief']['check'],'done':False}],'status':'planned','observed':'','blocker':'','learned':'','next':'','basis':{'feature':legacy['brief']['feature'],'check':legacy['brief']['check']}}} for i in range(30)]
 ctx=browser.new_context();seed(ctx,json.dumps({'version':1,'activeId':'idea-0','items':items},ensure_ascii=False));page=ctx.new_page();page.goto(BASE)
 page.get_by_role('button',name='다른 아이디어로 저장',exact=True).click()
 expect(page.locator('.error').filter(has_text='30개까지')).to_be_visible()
 expect(page.get_by_role('button',name='보관함 30',exact=True)).to_be_visible()
 page.get_by_role('button',name='수정본 저장',exact=True).click()
 assert len(stored(page)['items'])==30
 print('PASS archive capacity keeps all 30 records and permits existing updates',flush=True)
 browser.close()
