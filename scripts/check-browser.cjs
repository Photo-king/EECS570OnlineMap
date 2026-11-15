const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{const url=process.env.MAP_URL||'http://localhost:5700/';const b=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || undefined,headless:true});const c=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,permissions:['geolocation'],geolocation:{latitude:42.2792,longitude:-83.7362,accuracy:10}});const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(url,{waitUntil:'networkidle',timeout:60000});const cdp=await c.newCDPSession(p);
async function touch(type,points){await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y,id])=>({x,y,id,radiusX:4,radiusY:4,force:1}))});}
for(const name of ['Overview','Ground floor','First floor','Second floor']){
await p.getByRole('button',{name:new RegExp(name)}).click();await p.waitForTimeout(100);const selector=name==='Overview'?'#overview-scene':'#scene';const before=await p.locator(selector).evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).a);const v=await p.locator('#viewport').boundingBox(),x=v.x+v.width/2,y=v.y+v.height*.63;
await touch('touchStart',[[x-30,y,1],[x+30,y,2]]);
for(let k=1;k<=6;k++){await touch('touchMove',[[x-30-k*10,y,1],[x+30+k*10,y,2]]);await p.waitForTimeout(20);}
await touch('touchEnd',[]);const after=await p.locator(selector).evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).a);if(after<before*2.5)throw Error('Pinch failed '+name+' '+before+' -> '+after);
// After zooming, a one-finger drag must move the figure without changing scale.
const tx=await p.locator(selector).evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).e);await touch('touchStart',[[x,y,3]]);await touch('touchMove',[[x+25,y+15,3]]);await touch('touchEnd',[]);const moved=await p.locator(selector).evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).e);if(Math.abs(moved-tx)<15)throw Error('Drag failed '+name);
// Pinch inward past the lower limit restores full-fit, never shrinks smaller.
await touch('touchStart',[[x-90,y,4],[x+90,y,5]]);await touch('touchMove',[[x-5,y,4],[x+5,y,5]]);await touch('touchEnd',[]);const restored=await p.locator(selector).evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).a);if(Math.abs(restored-before)>1e-4)throw Error('Minimum fit failed '+name);
console.log('PASS mobile pinch / drag / minimum fit:',name);}
if(await p.locator('#coordinate-body').isVisible()||await p.locator('#locate').count())throw Error('Public UI regression');
await p.waitForFunction(()=>!document.querySelector('#user-position').hidden);
await p.evaluate(()=>document.querySelector('#test-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
if(await p.locator('#user-position').evaluate(e=>e.classList.contains('test-position')))throw Error('Test mode enabled');
const old=await p.locator('#user-position').evaluate(e=>e.style.left);await c.setGeolocation({latitude:42.2793,longitude:-83.7361,accuracy:20});await p.waitForFunction(x=>document.querySelector('#user-position').style.left!==x,old);
await p.getByRole('button',{name:/Overview/}).click();if(process.env.BROWSER_SCREENSHOT)await p.screenshot({path:process.env.BROWSER_SCREENSHOT});await p.setViewportSize({width:1440,height:1000});await p.getByRole('button',{name:/First floor/}).click();await p.locator('#plus').click();if(await p.locator('#zoom-value').textContent()==='100%')throw Error('Desktop controls failed');if(errors.length)throw Error(errors.join('\n'));console.log('PASS overview homepage, public UI, desktop controls, no JS errors');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
