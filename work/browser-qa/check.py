import base64, json, time, urllib.request
from pathlib import Path
from websockets.sync.client import connect

out=Path(__file__).parent
pages=json.load(urllib.request.urlopen('http://127.0.0.1:9321/json/list'))
socket=connect(next(p['webSocketDebuggerUrl'] for p in pages if p['type']=='page'), max_size=20_000_000)
seq=0
errors=[]
def cmd(method, **params):
 global seq
 seq+=1
 socket.send(json.dumps(dict(id=seq,method=method,params=params)))
 while True:
  data=json.loads(socket.recv(timeout=20))
  if data.get('method')=='Runtime.exceptionThrown': errors.append(data['params'])
  if data.get('id')==seq:
   if 'error' in data: raise RuntimeError(data)
   return data.get('result',{})
def js(s):
 result=cmd('Runtime.evaluate',expression=s,returnByValue=True)
 if 'exceptionDetails' in result: raise RuntimeError(result['exceptionDetails'])
 return result['result'].get('value')
def wait(s, timeout=25):
 end=time.monotonic()+timeout
 while time.monotonic()<end:
  if js(s):return
  time.sleep(.2)
 raise TimeoutError((s,js('document.body.innerText'),errors))
def click(s):
 js(f'document.querySelector({json.dumps(s)}).click()')
def screenshot(name):
 data=cmd('Page.captureScreenshot',format='png')['data']
 (out/(name+'.png')).write_bytes(base64.b64decode(data))

cmd('Page.enable')
cmd('Runtime.enable')
cmd('Emulation.setDeviceMetricsOverride',width=1120,height=720,deviceScaleFactor=1,mobile=False)
base='http://127.0.0.1:4173/'
cmd('Page.navigate',url=base)
wait("document.querySelector('[data-action=lives]')")
screenshot('home')
click('[data-action=lives]')
wait("document.querySelectorAll('[data-action=person]').length===6")
click('[data-action=ornament]')
wait("document.querySelector('[data-ornament] svg path')")
screenshot('ornament')
click('[data-action=altar]')
wait("document.body.classList.contains('scene-3d') && document.querySelector('[data-action=take]')",45)
screenshot('altar')
for action in ['take','place','offer']:
 click(f'[data-action={action}]')
wait("document.querySelector('.scene-overlay h2')?.textContent==='하강 터널'",45)
assert js("JSON.parse(localStorage.getItem('world-tree:archive:1')).length") == 1
print('Three ordered clicks entered descent and wrote one record',flush=True)
click('[data-action=pause]')
progress=js("document.querySelector('.progress span').style.width")
time.sleep(1)
assert js("document.querySelector('.progress span').style.width")==progress
click('[data-action=look]')
cmd('Input.dispatchKeyEvent',type='keyDown',key='ArrowLeft',code='ArrowLeft',windowsVirtualKeyCode=37)
screenshot('descent')
click('[data-action=pause]')
for name in ['에너지 핵','상승 터널','환생']:
 wait(f"document.querySelector('.scene-overlay h2')?.textContent==={json.dumps(name)}",100)
 print('Reached '+name,flush=True)
 screenshot(name)
wait("document.querySelector('.scene-overlay a[href*=archive]')",80)
click('.scene-overlay a[href*=archive]')
wait("document.querySelector('h1')?.textContent==='봉헌 기록' && document.querySelector('[data-ornament] svg')")
saved=js("document.querySelector('article h2').textContent")
cmd('Page.reload')
wait("document.querySelector('[data-ornament] svg') && document.querySelector('h1')?.textContent==='봉헌 기록'")
assert js("document.querySelector('article h2').textContent")==saved
screenshot('archive')
assert not errors, errors
print('Archive survives refresh, no uncaught browser exceptions',flush=True)
