import { test, expect } from '@playwright/test';
import path from 'node:path';
const fixture = (name: string) => path.resolve('tests/fixtures/images', name);
test('local pair, modes, note and export', async ({ page }) => {
 await page.goto('/');
 await page.getByLabel('Скриншот сайта', {exact:true}).setInputFiles(fixture('site-320x240.png'));
 await page.getByLabel('Макет из Figma', {exact:true}).setInputFiles(fixture('figma-300x200.png'));
 await expect(page.getByText('320 × 240 px')).toBeVisible();
 await page.getByRole('button',{name:'Разделитель',exact:true}).click();
 await page.getByRole('button',{name:'Рядом',exact:true}).click();
 await page.getByRole('button',{name:'Наложение',exact:true}).click();
 await page.getByRole('button',{name:'1:1',exact:true}).click();
 await page.getByRole('button',{name:'Область',exact:true}).click();
 const box = await page.getByTestId('site-pane').boundingBox();
 if (!box) throw Error('missing pane');
 await page.mouse.move(box.x+box.width/2-100,box.y+box.height/2-70); await page.mouse.down(); await page.mouse.move(box.x+box.width/2-50,box.y+box.height/2-30); await page.mouse.up();
 await page.getByLabel('Текст замечания').fill(' Проверить отступ ');
 await page.getByRole('button',{name:'Сохранить',exact:true}).click();
 const download = page.waitForEvent('download'); await page.getByRole('button',{name:'Скачать замечания'}).click();
 expect((await download).suggestedFilename()).toBe('design-qa-notes.json');
});

test('@integration real file guards, orientation and previous image retention',async({page})=>{
 await page.goto('/');const site=page.getByLabel('Скриншот сайта',{exact:true});
 for(const [file,dimensions] of [['site-320x240.png','320 × 240 px'],['site-320x240.jpg','320 × 240 px'],['oriented-240x320.jpg','240 × 320 px']]){await site.setInputFiles(fixture(file!));await expect(page.getByText(dimensions!,{exact:true})).toBeVisible();}
 for(const file of ['corrupt.png','decode-corrupt.png','animated.png','unsupported.gif','width-limit.png','height-limit.png','pixels-limit.png']){await site.setInputFiles(fixture(file));await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByText('240 × 320 px')).toBeVisible();}
 await site.setInputFiles({name:'large.png',mimeType:'image/png',buffer:Buffer.alloc(15*1024*1024+1)});await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByText('240 × 320 px')).toBeVisible();
});

async function pair(page: import('@playwright/test').Page){await page.goto('/');await page.getByLabel('Скриншот сайта',{exact:true}).setInputFiles(fixture('site-320x240.png'));await page.getByLabel('Макет из Figma',{exact:true}).setInputFiles(fixture('figma-300x200.png'));await expect(page.getByText('320 × 240 px')).toBeVisible();await expect(page.getByTestId('site-pane')).toBeVisible();}
async function draw(page: import('@playwright/test').Page,zoom:number){await page.getByLabel('Масштаб, %').fill(String(zoom));await page.getByRole('button',{name:'Область',exact:true}).click();await page.getByTestId('site-pane').scrollIntoViewIfNeeded();const box=(await page.getByTestId('site-pane').boundingBox())!;await page.mouse.move(box.x+box.width/2-60*zoom/100,box.y+box.height/2-40*zoom/100);await page.mouse.down();await page.mouse.move(box.x+box.width/2-10*zoom/100,box.y+box.height/2);await page.mouse.up();}
async function report(page:import('@playwright/test').Page){const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать замечания'}).click();const file=await(await waiting).path();const fs=await import('node:fs/promises');return JSON.parse(await fs.readFile(file!,'utf8'));}

test('source coordinates at 50/100/200%, editing, safe text and exact report',async({page})=>{
 await pair(page);
 for(const zoom of [50,100,200]){await draw(page,zoom);await page.getByLabel('Текст замечания').fill(' <img src=x onerror=alert(1)> ');await page.getByRole('button',{name:'Сохранить',exact:true}).click();}
 const data=await report(page);expect(Object.keys(data).sort()).toEqual(['exportedAt','figma','notes','schemaVersion','site']);expect(data.schemaVersion).toBe(1);expect(data.site).toEqual({name:'site-320x240.png',width:320,height:240});
 for(const note of data.notes){expect(note.rect.x).toBeCloseTo(100);expect(note.rect.y).toBeCloseTo(80);expect(note.rect.width).toBeCloseTo(50);expect(note.rect.height).toBeCloseTo(40);expect(Object.keys(note).sort()).toEqual(['body','id','rect','state']);}
 await expect(page.locator('.note-body img')).toHaveCount(0);await page.locator('.note-select').first().click();await expect(page.locator('.notes li').first()).toHaveClass(/active/);await expect(page.locator('.annotations rect.selected')).toHaveCount(1);await page.getByRole('button',{name:'Изменить',exact:true}).first().click();await page.getByLabel('Текст замечания').fill(' Исправить ');await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.getByRole('button',{name:'Решено',exact:true}).first().click();expect((await report(page)).notes[0]).toMatchObject({body:'Исправить',state:'RESOLVED'});await page.getByRole('button',{name:'Удалить',exact:true}).first().click();expect((await report(page)).notes).toHaveLength(2);
});

test('replacement validates before confirmation, cancel retains, confirm resets; offline mobile',async({page,context})=>{
 await page.setViewportSize({width:375,height:900});await pair(page);const requests:string[]=[];page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});await context.setOffline(true);await draw(page,100);await page.getByLabel('Текст замечания').fill('Сохранить');await page.getByRole('button',{name:'Сохранить',exact:true}).click();
 await page.getByLabel('Скриншот сайта',{exact:true}).setInputFiles(fixture('corrupt.png'));await expect(page.getByRole('alert')).toBeVisible();expect((await report(page)).notes).toHaveLength(1);
 page.once('dialog',dialog=>dialog.dismiss());await page.getByLabel('Скриншот сайта',{exact:true}).setInputFiles(fixture('oriented-240x320.jpg'));await expect(page.getByText('320 × 240 px')).toBeVisible();expect((await report(page)).notes).toHaveLength(1);
 page.once('dialog',dialog=>dialog.accept());await page.getByLabel('Скриншот сайта',{exact:true}).setInputFiles(fixture('oriented-240x320.jpg'));await expect(page.getByText('240 × 320 px')).toBeVisible();await expect(page.getByRole('button',{name:'Скачать замечания'})).toBeDisabled();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(requests).toEqual([]);
});

test('slider endpoints, side-by-side drawing only on site, keyboard and populated screenshots',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await pair(page);await page.getByRole('button',{name:'Разделитель',exact:true}).click();const slider=page.getByRole('slider',{name:'Граница сравнения'});await slider.focus();for(const [key,value] of [['Home','0'],['End','100'],['Home','0']]){await page.keyboard.press(key!);await expect(slider).toHaveAttribute('aria-valuenow',value!);}await page.getByLabel('Положение разделителя').fill('50');
 await page.screenshot({path:'../../.superpowers/sdd/LOCAL_COMPARISON/desktop-slider.png',fullPage:true});await page.getByRole('button',{name:'Наложение',exact:true}).click();for(const value of ['0','50','100']){await page.getByLabel('Прозрачность Figma').fill(value);await expect(page.locator('.image-clip').nth(1)).toHaveCSS('opacity',String(Number(value)/100));}await page.getByLabel('Прозрачность Figma').fill('50');await page.screenshot({path:'../../.superpowers/sdd/LOCAL_COMPARISON/desktop-overlay.png',fullPage:true});
 await page.getByRole('button',{name:'Рядом',exact:true}).click();await page.getByRole('button',{name:'1:1',exact:true}).click();await page.getByRole('button',{name:'Область',exact:true}).click();const left=(await page.getByTestId('figma-pane').boundingBox())!;await page.mouse.move(left.x+left.width/2,left.y+left.height/2);await page.mouse.down();await page.mouse.move(left.x+left.width/2+30,left.y+left.height/2+30);await page.mouse.up();await expect(page.getByLabel('Текст замечания')).toHaveCount(0);await draw(page,100);await expect(page.getByLabel('Текст замечания')).toBeFocused();await page.keyboard.press('Escape');await expect(page.getByLabel('Текст замечания')).toHaveCount(0);await page.setViewportSize({width:375,height:900});await page.getByRole('button',{name:'Наложение',exact:true}).click();await page.screenshot({path:'../../.superpowers/sdd/LOCAL_COMPARISON/mobile-overlay.png',fullPage:true});
});

test('@integration last selection wins, stale/previous URLs revoked and clear cleanup',async({page})=>{
 await page.addInitScript(()=>{const state={created:[] as string[],revoked:[] as string[]};Object.assign(window,{urlAudit:state});const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=create(blob);state.created.push(url);return url;};URL.revokeObjectURL=url=>{state.revoked.push(url);revoke(url);};const decode=window.createImageBitmap.bind(window);window.createImageBitmap=(async(...args:Parameters<typeof createImageBitmap>)=>{const file=args[0];if(file instanceof File&&file.name==='site-320x240.jpg')await new Promise(resolve=>setTimeout(resolve,150));return decode(...args);}) as typeof createImageBitmap;});
 await page.goto('/');const site=page.getByLabel('Скриншот сайта',{exact:true});await site.setInputFiles(fixture('site-320x240.jpg'));await site.setInputFiles(fixture('oriented-240x320.jpg'));await expect(page.getByText('240 × 320 px')).toBeVisible();await page.waitForTimeout(250);await expect(page.getByText('240 × 320 px')).toBeVisible();await site.setInputFiles(fixture('site-320x240.png'));await expect(page.getByText('320 × 240 px')).toBeVisible();await page.getByRole('button',{name:'Новая пара',exact:true}).click();await expect.poll(()=>page.evaluate(()=>{const audit=(window as unknown as {urlAudit:{created:string[];revoked:string[]}}).urlAudit;return audit.created.filter(url=>!audit.revoked.includes(url)).length;})).toBe(0);
});

test('new pair asks before deleting notes, cancel retains and confirm clears',async({page})=>{
 await pair(page);await draw(page,100);await page.getByLabel('Текст замечания').fill('Проверить кнопку');await page.getByRole('button',{name:'Сохранить',exact:true}).click();
 page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Новая пара',exact:true}).click();await expect(page.getByText('320 × 240 px')).toBeVisible();expect((await report(page)).notes).toHaveLength(1);
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Новая пара',exact:true}).click();await expect(page.getByText('Начните с двух изображений')).toBeVisible();await expect(page.getByRole('button',{name:'Скачать замечания'})).toBeDisabled();
});

test('drawing a new area while editing creates a new note and retains the old one',async({page})=>{
 await pair(page);await draw(page,100);await page.getByLabel('Текст замечания').fill('Первое замечание');await page.getByRole('button',{name:'Сохранить',exact:true}).click();
 await page.getByRole('button',{name:'Изменить',exact:true}).click();await expect(page.getByLabel('Текст замечания')).toHaveValue('Первое замечание');
 await draw(page,100);await expect(page.getByLabel('Текст замечания')).toHaveValue('');await page.getByLabel('Текст замечания').fill('Второе замечание');await page.getByRole('button',{name:'Сохранить',exact:true}).click();
 expect((await report(page)).notes.map((note:{body:string})=>note.body)).toEqual(['Первое замечание','Второе замечание']);
});

test('Space activates a focused toolbar button',async({page})=>{
 await pair(page);const button=page.getByRole('button',{name:'Рядом',exact:true});await button.focus();await page.keyboard.press('Space');await expect(button).toHaveAttribute('aria-pressed','true');
});

test('@integration clearing one slot preserves the other slot pending load',async({page})=>{
 await page.addInitScript(()=>{const decode=window.createImageBitmap.bind(window);window.createImageBitmap=(async(...args:Parameters<typeof createImageBitmap>)=>{if(args[0] instanceof File&&args[0].name==='figma-300x200.png')await new Promise(resolve=>setTimeout(resolve,400));return decode(...args);}) as typeof createImageBitmap;});
 await page.goto('/');await page.getByLabel('Скриншот сайта',{exact:true}).setInputFiles(fixture('site-320x240.png'));await expect(page.getByText('320 × 240 px')).toBeVisible();
 await page.getByLabel('Макет из Figma',{exact:true}).setInputFiles(fixture('figma-300x200.png'));await expect(page.getByText('Чтение изображения…')).toBeVisible();await page.getByRole('button',{name:'Очистить скриншот сайта'}).click();await expect(page.getByText('Чтение изображения…')).toBeVisible();await expect(page.getByText('300 × 200 px')).toBeVisible();
});

test('@integration clear, replace and reset revoke every image URL without a page error',async({page})=>{
 await page.addInitScript(()=>{const audit={created:[] as string[],revoked:[] as string[]};Object.assign(window,{urlAudit:audit});const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=create(blob);audit.created.push(url);return url;};URL.revokeObjectURL=url=>{audit.revoked.push(url);revoke(url);};});
 const errors:Error[]=[];page.on('pageerror',error=>errors.push(error));await pair(page);
 await page.getByRole('button',{name:'Очистить скриншот сайта'}).click();await page.getByLabel('Скриншот сайта',{exact:true}).setInputFiles(fixture('site-320x240.jpg'));await expect(page.getByText('site-320x240.jpg')).toBeVisible();await page.getByRole('button',{name:'Новая пара',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>{const audit=(window as unknown as {urlAudit:{created:string[];revoked:string[]}}).urlAudit;return audit.created.filter(url=>!audit.revoked.includes(url)).length;})).toBe(0);expect(errors).toEqual([]);
});

test('divider pointer drag and camera center survive mode and viewport changes',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await pair(page);await page.getByRole('button',{name:'1:1',exact:true}).click();
 const worldCenter=async()=>page.getByTestId('site-pane').evaluate(pane=>{const image=pane.querySelector('img[alt="Скриншот сайта на холсте"]')!;const paneRect=pane.getBoundingClientRect(),imageRect=image.getBoundingClientRect();return {x:(paneRect.width/2+paneRect.left-imageRect.left),y:(paneRect.height/2+paneRect.top-imageRect.top)};});
 const before=await worldCenter();expect(before.x).toBeCloseTo(160,0);expect(before.y).toBeCloseTo(120,0);
 await page.getByRole('button',{name:'Разделитель',exact:true}).click();const slider=page.getByRole('slider',{name:'Граница сравнения'});const pane=(await page.getByTestId('site-pane').boundingBox())!;const handle=(await slider.boundingBox())!;await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(pane.x+pane.width*.75,handle.y+handle.height/2);await page.mouse.up();await expect(slider).toHaveAttribute('aria-valuenow',/7[4-6]/);
 await page.getByRole('button',{name:'Рядом',exact:true}).click();await page.setViewportSize({width:1050,height:900});await expect.poll(worldCenter).toEqual({x:160,y:120});await expect(page.getByLabel('Масштаб, %')).toHaveValue('100');
 await page.getByRole('button',{name:'Перемещение',exact:true}).click();const box=(await page.getByTestId('site-pane').boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+25,box.y+box.height/2+15);await page.mouse.up();const panned=await worldCenter();expect(panned.x).toBeCloseTo(135,0);expect(panned.y).toBeCloseTo(105,0);
});
