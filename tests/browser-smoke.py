"""Production smoke checks. Requires Python playwright + Chromium. See docs/validation.md."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
BASE=os.getenv('BYEOLIEUM_TEST_URL','http://127.0.0.1:3200')
ROOT=Path(__file__).resolve().parents[1]
results=[]
def check(name):
    results.append(name)
    print('PASS:',name,flush=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.getenv('BYEOLIEUM_CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'],env={**os.environ,'NO_PROXY':'localhost,127.0.0.1'})
    ctx=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
    page=ctx.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    assert page.goto(BASE).status==200
    expect(page.get_by_role('button',name='예제로 체험하기')).to_be_enabled()
    check('production homepage responds and restores empty state')
    page.get_by_role('button',name='다음 단계').click()
    expect(page.locator('.error')).to_contain_text('2개 이상')
    check('cannot advance without enough cards')
    page.get_by_label('새로운 생각').fill('   ')
    page.get_by_role('button',name='카드 추가').click()
    expect(page.locator('.error')).to_contain_text('한 줄 이상')
    check('blank cards rejected')
    page.get_by_label('새로운 생각').fill('<img src=x onerror=alert(1)>')
    page.get_by_role('button',name='카드 추가').click()
    assert page.locator('.thought-card img').count()==0
    expect(page.locator('.thought-card')).to_contain_text('<img src=x')
    page.locator('.card-actions').get_by_role('button',name='수정').click()
    page.get_by_label('생각 카드 수정').fill('수정된 생각')
    page.get_by_role('button',name='수정 저장').click()
    expect(page.locator('.thought-card')).to_contain_text('수정된 생각')
    page.get_by_role('button',name='카드 1 삭제',exact=True).click()
    assert page.locator('.thought-card').count()==0
    check('card editing/deletion and safe text rendering')
    page.get_by_role('button',name='예제로 체험하기').click()
    assert page.locator('.thought-card').count()==3
    page.evaluate('scrollTo(0,0)')
    page.screenshot(path=str(ROOT/'docs/screenshots/desktop.png'),full_page=True)
    page.get_by_role('button',name='다음 단계').click()
    expect(page.get_by_role('heading',name='생각 연결하기')).to_be_focused()
    page.get_by_role('button',name='다음 단계').click()
    expect(page.locator('.error')).to_contain_text('2개 이상 선택')
    page.locator('.selectable').nth(0).click()
    page.locator('.selectable').nth(2).click()
    expect(page.locator('.selected')).to_have_count(2)
    page.reload()
    expect(page.locator('.selected')).to_have_count(2)
    check('example, stage focus, selection validation and partial restore')
    page.get_by_role('button',name='다음 단계').click()
    expect(page.get_by_role('heading',name='만들 것 정하기')).to_be_focused()
    expect(page.locator('.idea-bridge li')).to_have_count(2)
    assert page.locator('.idea-bridge').inner_text().find('매번 비슷한 준비를 반복해요.')==-1
    expect(page.get_by_role('group')).to_have_count(3)
    assert page.get_by_label('AI에 전달할 제작 프롬프트').count()==0
    page.screenshot(path=str(ROOT/'docs/screenshots/idea-bridge.png'),full_page=True)
    check('chosen cards bridge into three question groups without skipping to prompt')
    page.get_by_label('첫 버전의 핵심 기능은?').fill('항목 추가와 완료 표시만 구현')
    page.get_by_role('button',name='프롬프트 만들기').click()
    prompt=page.get_by_label('AI에 전달할 제작 프롬프트')
    expect(prompt).to_contain_text('항목 추가와 완료 표시만 구현')
    value=prompt.input_value()
    assert '교육 준비물을 자주 빠뜨려요.' in value
    assert '완료한 항목을 표시하고 싶어요.' in value
    assert '매번 비슷한 준비를 반복해요.' not in value
    check('generated prompt includes chosen sources and edited requirements only')
    prompt.fill(value+'\n내가 추가한 조건')
    page.reload()
    expect(page.get_by_label('AI에 전달할 제작 프롬프트')).to_contain_text('내가 추가한 조건')
    check('completed stage and manually edited prompt restore')
    page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('blocked')}}})")
    page.get_by_role('button',name='프롬프트 복사').click()
    expect(page.locator('.error')).to_contain_text('복사하지 못했어요')
    page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text)=>{window.copied=text}}})")
    page.get_by_role('button',name='프롬프트 복사').click()
    expect(page.get_by_role('status')).to_contain_text('복사했어요')
    assert page.evaluate('window.copied')==page.get_by_label('AI에 전달할 제작 프롬프트').input_value()
    check('clipboard denied/success feedback and correct copied content (mocked)')
    page.get_by_role('button',name='이전 단계').click()
    page.get_by_label('아이디어 이름').fill('새 이름')
    page.get_by_role('button',name='프롬프트 만들기').click()
    assert '새 이름' in page.get_by_label('AI에 전달할 제작 프롬프트').input_value()
    assert '내가 추가한 조건' not in page.get_by_label('AI에 전달할 제작 프롬프트').input_value()
    check('regeneration reflects changed requirements')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    check('desktop no horizontal overflow')
    page.on('dialog',lambda dialog:dialog.accept())
    page.get_by_role('button',name='저장한 작업 초기화').click()
    page.reload()
    expect(page.get_by_role('button',name='예제로 체험하기')).to_be_enabled()
    assert page.locator('.thought-card').count()==0
    check('reset clears data across reload')
    page.evaluate("localStorage.setItem('byeolieum-project-v1','{bad')")
    page.reload()
    expect(page.get_by_role('status')).to_contain_text('초기화')
    assert page.locator('.thought-card').count()==0
    check('corrupt storage handled')
    # Selection cap using existing storage shape.
    page.evaluate("localStorage.setItem('byeolieum-project-v1',JSON.stringify({cards:Array.from({length:6},(_,i)=>({id:String(i),text:'생각 '+i})),selected:[],brief:{title:'',audience:'',goal:'',feature:'',check:''},step:1,prompt:''}))")
    page.reload()
    expect(page.locator('.selectable')).to_have_count(6)
    for i in range(6):page.locator('.selectable').nth(i).click()
    expect(page.locator('.error')).to_contain_text('5개까지')
    expect(page.locator('.selected')).to_have_count(5)
    check('maximum five selected cards')
    mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce')
    m=mobile.new_page();m.goto(BASE)
    m.get_by_role('button',name='예제로 체험하기').click()
    for step in range(4):
        assert m.evaluate('document.documentElement.scrollWidth<=innerWidth')
        if step==0:
            m.evaluate('scrollTo(0,0)')
            m.screenshot(path=str(ROOT/'docs/screenshots/mobile.png'),full_page=True)
        if step<2:
            if step==1:
                m.locator('.selectable').nth(0).click();m.locator('.selectable').nth(1).click()
            m.get_by_role('button',name='다음 단계').click()
        elif step==2:
            expect(m.get_by_role('heading',name='만들 것 정하기')).to_be_focused()
            assert abs(m.locator('.work-panel').bounding_box()['y']-20)<3
            expect(m.locator('.idea-bridge li')).to_have_count(2)
            m.screenshot(path=str(ROOT/'docs/screenshots/mobile-idea.png'),full_page=True)
            m.get_by_role('button',name='프롬프트 만들기').click()
    check('mobile full example flow and no overflow at all four stages')
    blocked=browser.new_context()
    blocked.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw Error('unavailable')}})")
    b=blocked.new_page();b.goto(BASE)
    expect(b.locator('.error').first).to_contain_text('저장')
    b.get_by_role('button',name='예제로 체험하기').click()
    expect(b.locator('.thought-card')).to_have_count(3)
    check('storage unavailable still allows working')
    assert not errors,errors
    check('no page JavaScript errors')
    browser.close()
(ROOT/'docs/screenshots/checks.json').write_text(json.dumps({'target':BASE,'checks':results,'total':len(results)},ensure_ascii=False,indent=2)+'\n')
print('TOTAL',len(results),'checks passed')
