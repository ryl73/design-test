import { test,expect,type Page,type Download } from '@playwright/test';
import { readFile } from 'node:fs/promises';
async function screenshot(page:Page,name:string,width=400,height=400,blocks:{x:number;y:number;width:number;height:number}[]=[]){
 const base64=await page.evaluate(({width,height,blocks})=>{const c=document.createElement('canvas');c.width=width;c.height=height;const x=c.getContext('2d')!;x.fillStyle='white';x.fillRect(0,0,width,height);x.fillStyle='black';for(const r of blocks)x.fillRect(r.x,r.y,r.width,r.height);return c.toDataURL('image/png').split(',')[1]!;},{width,height,blocks});
 return {name,mimeType:'image/png',buffer:Buffer.from(base64,'base64')};
}
const blocks=[{x:30,y:30,width:8,height:8},{x:250,y:270,width:16,height:12}];
async function pair(page:Page){
 await page.goto('/');await page.getByLabel('Скриншот сайта',{exact:true}).setInputFiles(await screenshot(page,'site.png'));
 await page.getByLabel('Макет из Figma',{exact:true}).setInputFiles(await screenshot(page,'figma.png',400,400,blocks));
 await page.getByRole('button',{name:'Отличия',exact:true}).click();await expect(page.getByRole('status',{name:'Области отличий'})).toHaveText('Областей: 2');
}
async function downloaded(page:Page,button:string):Promise<Download>{const pending=page.waitForEvent('download');await page.getByRole('button',{name:button,exact:true}).click();return pending;}
async function textOf(download:Download){return readFile((await download.path())!,'utf8');}
test('automatic drafts include evidence, deduplicate, export HTML and highlighted PNG',async({page,context})=>{
 await page.setViewportSize({width:1440,height:1000});await pair(page);
 await page.getByRole('button',{name:'Создать черновики замечаний'}).click();await expect(page.locator('.notes li')).toHaveCount(2);await expect(page.getByAltText('Фрагмент сайта к замечанию')).toHaveCount(2);
 await page.getByRole('button',{name:'Создать черновики замечаний'}).click();await expect(page.getByRole('status',{name:'Действия автоматизации'})).toContainText('уже есть');await expect(page.locator('.notes li')).toHaveCount(2);
 const json=JSON.parse(await textOf(await downloaded(page,'Скачать замечания')));expect(json.schemaVersion).toBe(2);expect(json.notes[0].origin).toBe('AUTO');expect(json.notes[0].evidence).toBeUndefined();
 const html=await textOf(await downloaded(page,'Скачать HTML-отчёт'));expect(html).toContain('data:image/png;base64,');expect(html).toContain('Замечания (2)');expect(html).not.toContain('blob:');
 const report=await context.newPage();await report.setContent(html);await expect(report.getByRole('heading',{name:'Отчёт Design QA',exact:true})).toBeVisible();await expect.poll(()=>report.locator('img').evaluateAll((images:HTMLImageElement[])=>images.every(image=>image.complete&&image.naturalWidth>0))).toBe(true);await report.close();
 const png=await downloaded(page,'Скачать подсветку PNG');expect(png.suggestedFilename()).toBe('design-qa-highlight.png');const bytes=await readFile((await png.path())!);expect(bytes.readUInt32BE(16)).toBe(400);expect(bytes.readUInt32BE(20)).toBe(400);
 await page.screenshot({path:test.info().outputPath('automation-desktop.png'),fullPage:true});
});
test('repeat check preserves notes/reference and identifies cleared and remaining areas',async({page})=>{
 await pair(page);await page.getByRole('button',{name:'Создать черновики замечаний'}).click();await expect(page.locator('.notes li')).toHaveCount(2);
 await page.getByLabel('Новая версия сайта для повторной проверки').setInputFiles(await screenshot(page,'site-fixed.png',400,400,[blocks[0]!]));
 await expect(page.locator('.verification-badge').filter({hasText:'В области совпадение'})).toHaveCount(1);await expect(page.locator('.verification-badge').filter({hasText:'Остались отличия'})).toHaveCount(1);await expect(page.locator('.notes li')).toHaveCount(2);await expect(page.getByText('figma.png',{exact:true})).toBeVisible();
 await page.getByText('История повторных проверок (1)',{exact:true}).click();await expect(page.locator('.check-history')).toContainText('Совпало: 1');await expect(page.locator('.check-history')).toContainText('Остались отличия: 1');
 const json=JSON.parse(await textOf(await downloaded(page,'Скачать замечания')));expect(json.notes.every((note:{state:string})=>note.state==='OPEN')).toBe(true);
 await page.getByLabel('Новая версия сайта для повторной проверки').setInputFiles(await screenshot(page,'wrong-width.png',200,400));await expect(page.getByRole('alert')).toContainText('ширины');await expect(page.locator('.pickers .file-info').getByText('site-fixed.png',{exact:true})).toBeVisible();await expect(page.locator('.notes li')).toHaveCount(2);
 await page.getByLabel('Фильтр шума',{exact:true}).selectOption('1');await expect(page.locator('.verification-badge').filter({hasText:'Не проверено'})).toHaveCount(2);
 await page.setViewportSize({width:375,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:test.info().outputPath('automation-mobile.png'),fullPage:true});
});
test('batch matches names, continues after errors, exports and opens a successful pair',async({page})=>{
 await page.goto('/');await page.getByText('Пакетная проверка страниц',{exact:true}).click();
 await page.getByLabel('Скриншоты сайта для пакета').setInputFiles([await screenshot(page,'home-400.png',20,20),await screenshot(page,'about-400.png',20,20),await screenshot(page,'bad.png',20,20),await screenshot(page,'missing.png',20,20)]);
 await page.getByLabel('Макеты Figma для пакета').setInputFiles([await screenshot(page,'HOME-400.png',20,20,[{x:0,y:0,width:20,height:20}]),await screenshot(page,'about-400.png',20,20),await screenshot(page,'bad.png',21,20)]);
 await expect(page.locator('.batch-matching')).toContainText('нет макета Figma');await page.getByRole('button',{name:'Проверить пакет',exact:true}).click();await expect(page.locator('.batch-progress')).toContainText('Проверка завершена');await expect(page.locator('.batch-results li[data-status=success]')).toHaveCount(2);await expect(page.locator('.batch-results li[data-status=error]')).toHaveCount(1);
 const html=await textOf(await downloaded(page,'Скачать отчёт пакета'));expect(html).toContain('Пар изображений: 2');expect(html).toContain('home-400');
 await page.getByRole('button',{name:'Открыть пару home-400',exact:true}).click();await expect(page.getByRole('status',{name:'Результат сравнения'})).toHaveText('Отличается 400 пикселей (100%)');await expect(page.getByText('home-400.png',{exact:true})).toBeVisible();
});
test('batch cancellation leaves pending rows cancelled and allows clearing',async({page})=>{
 await page.goto('/');await page.getByText('Пакетная проверка страниц',{exact:true}).click();
 const files=[];for(let i=0;i<6;i++)files.push(await screenshot(page,`page-${i}.png`,500,500));
 await page.getByLabel('Скриншоты сайта для пакета').setInputFiles(files);await page.getByLabel('Макеты Figma для пакета').setInputFiles(files);
 await page.getByRole('button',{name:'Проверить пакет',exact:true}).click();await page.getByRole('button',{name:'Отменить пакет',exact:true}).click();await expect(page.locator('.batch-progress')).toContainText('Проверка отменена');await expect(page.locator('.batch-results li[data-status=cancelled]').first()).toBeVisible();await page.getByRole('button',{name:'Очистить результаты',exact:true}).click();await expect(page.locator('.batch-results')).toHaveCount(0);
});
test('extra-height automatic note can be exported and remains unchecked when entirely excluded',async({page})=>{
 await page.goto('/');await page.getByLabel('Скриншот сайта',{exact:true}).setInputFiles(await screenshot(page,'short.png',100,20));await page.getByLabel('Макет из Figma',{exact:true}).setInputFiles(await screenshot(page,'tall.png',100,40));await page.getByRole('button',{name:'Отличия',exact:true}).click();await expect(page.getByRole('status',{name:'Области отличий'})).toHaveText('Областей: 1');
 await page.getByRole('button',{name:'Создать черновики замечаний'}).click();await expect(page.locator('.notes li')).toHaveCount(1);const json=JSON.parse(await textOf(await downloaded(page,'Скачать замечания')));expect(json.notes[0].rect).toEqual({x:0,y:20,width:100,height:20});
 await page.getByRole('button',{name:'Следующее отличие'}).click();await page.getByRole('button',{name:'Исключить выбранное отличие',exact:true}).click();await expect(page.getByRole('status',{name:'Количество исключаемых зон'})).toHaveText('Зон: 1');
 await page.getByLabel('Новая версия сайта для повторной проверки').setInputFiles(await screenshot(page,'short-new.png',100,20));await expect(page.locator('.verification-badge')).toHaveText('Не проверено');await expect(page.getByRole('status',{name:'Количество исключаемых зон'})).toHaveText('Зон: 1');
});

test('repeat check locks settings and retains exportable historical notes below a shortened page',async({page})=>{
 await page.addInitScript(()=>{const decode=window.createImageBitmap.bind(window);window.createImageBitmap=(async(...args:Parameters<typeof createImageBitmap>)=>{if(args[0] instanceof File&&args[0].name==='short-fixed.png')await new Promise(resolve=>setTimeout(resolve,350));return decode(...args);}) as typeof createImageBitmap;});
 await page.goto('/');await page.getByLabel('Скриншот сайта',{exact:true}).setInputFiles(await screenshot(page,'long-site.png',100,100));await page.getByLabel('Макет из Figma',{exact:true}).setInputFiles(await screenshot(page,'short-reference.png',100,50));await page.getByRole('button',{name:'Отличия',exact:true}).click();await expect(page.getByRole('status',{name:'Области отличий'})).toHaveText('Областей: 1');await page.getByRole('button',{name:'Создать черновики замечаний'}).click();await expect(page.locator('.notes li')).toHaveCount(1);
 await page.getByLabel('Новая версия сайта для повторной проверки').setInputFiles(await screenshot(page,'short-fixed.png',100,50));await expect(page.getByLabel('Фильтр шума',{exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Исключить область',exact:true})).toBeDisabled();
 await expect(page.locator('.verification-badge')).toHaveText('Не проверено');await expect(page.getByLabel('Фильтр шума',{exact:true})).toBeEnabled();
 const json=JSON.parse(await textOf(await downloaded(page,'Скачать замечания')));expect(json.notes[0].rect.y).toBe(50);expect(json.notes[0].creationBounds.height).toBe(100);expect(json.site.height).toBe(50);
});
