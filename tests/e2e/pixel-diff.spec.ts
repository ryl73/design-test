import { test, expect, type Page } from '@playwright/test';
async function image(page:Page,height:number,color='white',width=20){
 const data=await page.evaluate(({height,color,width})=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d')!;context.fillStyle=color;context.fillRect(0,0,width,height);return canvas.toDataURL('image/png').split(',')[1]!;},{height,color,width});
 return {name:'screenshot.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')};
}
async function upload(page:Page,siteHeight:number,figmaHeight:number){
 await page.goto('/');
 await page.getByLabel('Скриншот сайта',{exact:true}).setInputFiles(await image(page,siteHeight));
 await page.getByLabel('Макет из Figma',{exact:true}).setInputFiles(await image(page,figmaHeight));
 await page.getByRole('button',{name:'Отличия',exact:true}).click();
}
for(const [siteHeight,figmaHeight] of [[10,20],[20,10]])test(`diff highlights missing rows: ${siteHeight}/${figmaHeight}`,async({page})=>{
 await upload(page,siteHeight!,figmaHeight!);
 await expect(page.getByRole('status',{name:'Результат сравнения'})).toHaveText('Отличается 200 пикселей (50%)');
 const mask=page.getByAltText('Подсветка отличий');await expect(mask).toBeVisible();
 await expect.poll(()=>mask.evaluate((img:HTMLImageElement)=>img.naturalHeight)).toBe(20);
 await page.screenshot({path:test.info().outputPath('pixel-diff.png'),fullPage:true});
 const pixel=await mask.evaluate((img:HTMLImageElement)=>{const canvas=document.createElement('canvas');canvas.width=20;canvas.height=20;const ctx=canvas.getContext('2d')!;ctx.drawImage(img,0,0);return Array.from(ctx.getImageData(0,15,1,1).data);});expect(pixel).toEqual([255,0,80,255]);
 await page.getByRole('button',{name:'Наложение',exact:true}).click();await expect(mask).toHaveCount(0);
 await page.getByRole('button',{name:'Отличия',exact:true}).click();await expect(page.getByRole('status',{name:'Результат сравнения'})).toHaveText('Отличается 200 пикселей (50%)');await expect.poll(()=>mask.evaluate((img:HTMLImageElement)=>img.naturalHeight)).toBe(20);
});
test('diff sensitivity, replacement, width mismatch and reset',async({page})=>{
 await upload(page,20,20);await expect(page.getByRole('status',{name:'Результат сравнения'})).toHaveText('Отличается 0 пикселей (0%)');
 await page.getByLabel('Макет из Figma',{exact:true}).setInputFiles(await image(page,20,'rgb(240,240,240)'));
 await expect(page.getByRole('status',{name:'Результат сравнения'})).toHaveText('Отличается 0 пикселей (0%)');
 await page.getByLabel('Чувствительность',{exact:true}).fill('100');await expect(page.getByRole('status',{name:'Результат сравнения'})).toHaveText('Отличается 400 пикселей (100%)');
 await page.getByLabel('Учитывать сглаживание').check();await expect(page.getByRole('status',{name:'Результат сравнения'})).toHaveText('Отличается 400 пикселей (100%)');
 await page.getByLabel('Макет из Figma',{exact:true}).setInputFiles(await image(page,20,'white',21));await expect(page.getByRole('status',{name:'Результат сравнения'})).toContainText('ширины изображений должны совпадать');await expect(page.getByAltText('Подсветка отличий')).toHaveCount(0);
 await page.getByRole('button',{name:'Новая пара'}).click();await expect(page.getByAltText('Подсветка отличий')).toHaveCount(0);await expect(page.getByRole('button',{name:'Отличия',exact:true})).toBeDisabled();
});

test('groups, filters noise, focuses regions and resets selection on a new result',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('/');
 await page.getByLabel('Скриншот сайта',{exact:true}).setInputFiles(await image(page,400,'white',400));
 const changed=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=400;c.height=400;const ctx=c.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,400,400);ctx.fillStyle='black';ctx.fillRect(30,30,8,8);ctx.fillRect(250,270,16,12);ctx.fillRect(180,120,1,1);return c.toDataURL('image/png').split(',')[1]!;});
 await page.getByLabel('Макет из Figma',{exact:true}).setInputFiles({name:'changed.png',mimeType:'image/png',buffer:Buffer.from(changed,'base64')});
 await page.getByRole('button',{name:'Отличия',exact:true}).click();
 const status=page.getByRole('status',{name:'Области отличий'}),result=page.getByRole('status',{name:'Результат сравнения'});
 const next=page.getByRole('button',{name:'Следующее отличие'}),previous=page.getByRole('button',{name:'Предыдущее отличие'});
 await expect(status).toHaveText('Областей: 2');await expect(result).toHaveText('Отличается 256 пикселей (0,16%)');await expect(page.getByText('Скрыто фильтром: 1 px')).toBeVisible();
 const bounds=page.locator('.active-diff-region');
 await previous.click();await expect(status).toHaveText('Область 2 из 2');await expect(bounds).toHaveAttribute('x','250');
 await next.click();await expect(status).toHaveText('Область 1 из 2');await expect(bounds).toHaveAttribute('x','30');await expect(bounds).toHaveAttribute('width','8');
 await expect(page.getByLabel('Масштаб, %')).toHaveValue('400');
 const center=await page.getByTestId('site-pane').evaluate(pane=>{const img=pane.querySelector('img[alt="Скриншот сайта на холсте"]')!;const a=pane.getBoundingClientRect(),b=img.getBoundingClientRect();return {x:(a.left+a.width/2-b.left)/4,y:(a.top+a.height/2-b.top)/4};});expect(center.x).toBeCloseTo(34);expect(center.y).toBeCloseTo(34);
 await next.focus();await page.keyboard.press('Space');await expect(status).toHaveText('Область 2 из 2');await expect(bounds).toHaveAttribute('y','270');
 await next.click();await expect(status).toHaveText('Область 1 из 2');
 await page.getByLabel('Фильтр шума',{exact:true}).selectOption('1');await expect(status).toHaveText('Областей: 3');await expect(result).toHaveText('Отличается 257 пикселей (0,16%)');await expect(bounds).toHaveCount(0);
 await page.getByLabel('Фильтр шума',{exact:true}).selectOption('500');await expect(status).toHaveText('Все отличия скрыты фильтром');await expect(result).toHaveText('Отличается 0 пикселей (0%)');await expect(next).toBeDisabled();await expect(previous).toBeDisabled();
 await page.getByLabel('Фильтр шума',{exact:true}).selectOption('12');await expect(status).toHaveText('Областей: 2');await next.click();
 await page.getByRole('button',{name:'Наложение',exact:true}).click();await expect(page.getByLabel('Автоматически найденные области')).toHaveCount(0);
 await page.getByRole('button',{name:'Отличия',exact:true}).click();await expect(status).toHaveText('Областей: 2');await expect(bounds).toHaveCount(0);
 await page.setViewportSize({width:375,height:900});await next.click();await expect(status).toHaveText('Область 1 из 2');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:test.info().outputPath('regions-mobile.png'),fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Вписать',exact:true}).click();await page.screenshot({path:test.info().outputPath('regions-desktop.png'),fullPage:true});
 await page.getByLabel('Макет из Figma',{exact:true}).setInputFiles(await image(page,400,'white',400));await expect(status).toHaveText('Отличий не найдено');await expect(bounds).toHaveCount(0);await expect(next).toBeDisabled();
});

async function drawExclusion(page:Page,rect:{x:number;y:number;width:number;height:number},zoom=100){
 await page.getByLabel('Масштаб, %').fill(String(zoom));
 await page.getByRole('button',{name:'Исключить область',exact:true}).click();
 await page.getByTestId('site-pane').scrollIntoViewIfNeeded();
 const img=(await page.getByAltText('Скриншот сайта на холсте',{exact:true}).boundingBox())!;
 const scale=zoom/100;
 await page.mouse.move(img.x+rect.x*scale,img.y+rect.y*scale);await page.mouse.down();
 await page.mouse.move(img.x+(rect.x+rect.width)*scale,img.y+(rect.y+rect.height)*scale);await page.mouse.up();
}
test('draws overlapping exclusion zones at different zooms, deletes them and resets with the pair',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('/');
 await page.getByLabel('Скриншот сайта',{exact:true}).setInputFiles(await image(page,100,'white',100));
 await page.getByLabel('Макет из Figma',{exact:true}).setInputFiles(await image(page,100,'black',100));
 await page.getByRole('button',{name:'Отличия',exact:true}).click();
 const result=page.getByRole('status',{name:'Результат сравнения'}),zones=page.getByRole('status',{name:'Количество исключаемых зон'});
 await expect(result).toContainText(/10\s000 пикселей \(100%\)/);
 await drawExclusion(page,{x:10,y:10,width:20,height:20},200);await expect(zones).toHaveText('Зон: 1');await expect(result).toContainText(/9\s600 пикселей \(100%\)/);
 const first=page.locator('.excluded-zones rect').first();await expect(first).toHaveAttribute('x','10');await expect(first).toHaveAttribute('width','20');await expect(page.getByRole('button',{name:'Перемещение',exact:true})).toHaveAttribute('aria-pressed','true');
 await drawExclusion(page,{x:20,y:20,width:20,height:20},50);await expect(zones).toHaveText('Зон: 2');await expect(result).toContainText(/9\s300 пикселей \(100%\)/);await expect(page.getByText('Исключено из сравнения: 700 px')).toBeVisible();
 const mask=page.getByAltText('Подсветка отличий');await expect.poll(()=>mask.evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(100);
 const alphas=await mask.evaluate((img:HTMLImageElement)=>{const c=document.createElement('canvas');c.width=100;c.height=100;const ctx=c.getContext('2d')!;ctx.drawImage(img,0,0);return [ctx.getImageData(15,15,1,1).data[3],ctx.getImageData(90,90,1,1).data[3]];});expect(alphas).toEqual([0,255]);
 await page.getByRole('button',{name:'Показать зону 1',exact:true}).click();await expect(page.getByLabel('Масштаб, %')).toHaveValue('400');
 await page.getByRole('button',{name:'Наложение',exact:true}).click();await expect(page.locator('.excluded-zones')).toHaveCount(0);
 await page.getByRole('button',{name:'Отличия',exact:true}).click();await expect(zones).toHaveText('Зон: 2');await expect(result).toContainText(/9\s300 пикселей/);
 await page.getByLabel('Фильтр шума',{exact:true}).selectOption('1');await expect(result).toContainText(/9\s300 пикселей/);await expect(zones).toHaveText('Зон: 2');
 await page.getByRole('button',{name:'Исключить область',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Исключить область',exact:true})).toHaveAttribute('aria-pressed','false');await expect(zones).toHaveText('Зон: 2');
 await page.getByRole('button',{name:'Удалить зону 1',exact:true}).click();await expect(zones).toHaveText('Зон: 1');await expect(result).toContainText(/9\s600 пикселей/);
 await page.getByRole('button',{name:'Удалить все исключения',exact:true}).click();await expect(zones).toHaveText('Зон: 0');await expect(result).toContainText(/10\s000 пикселей/);
 await drawExclusion(page,{x:10,y:10,width:20,height:20});await expect(zones).toHaveText('Зон: 1');
 await page.getByLabel('Макет из Figma',{exact:true}).setInputFiles(await image(page,100,'white',100));await expect(zones).toHaveText('Зон: 0');await expect(result).toHaveText('Отличается 0 пикселей (0%)');await expect(page.locator('.excluded-zones')).toHaveCount(0);
});
test('keyboard exclusion of a whole detected region handles an entirely masked image',async({page})=>{
 await upload(page,20,20);await page.getByLabel('Макет из Figma',{exact:true}).setInputFiles(await image(page,20,'black'));
 const result=page.getByRole('status',{name:'Результат сравнения'});
 await expect(result).toHaveText('Отличается 400 пикселей (100%)');
 await page.getByRole('button',{name:'Следующее отличие'}).click();
 const exclude=page.getByRole('button',{name:'Исключить выбранное отличие',exact:true});await exclude.focus();await page.keyboard.press('Space');
 await expect(result).toHaveText('Вся область исключена из сравнения');await expect(page.getByRole('status',{name:'Области отличий'})).toHaveText('Нет области для сравнения');await expect(page.getByRole('button',{name:'Следующее отличие'})).toBeDisabled();
 await page.setViewportSize({width:375,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:test.info().outputPath('exclusions-mobile.png'),fullPage:true});
 await page.getByRole('button',{name:'Удалить зону 1',exact:true}).click();await expect(result).toHaveText('Отличается 400 пикселей (100%)');
});
test('an exclusion can be drawn beyond the shorter site image',async({page})=>{
 await upload(page,10,20);const result=page.getByRole('status',{name:'Результат сравнения'});await expect(result).toHaveText('Отличается 200 пикселей (50%)');
 await drawExclusion(page,{x:0,y:10,width:20,height:10});await expect(page.getByRole('status',{name:'Количество исключаемых зон'})).toHaveText('Зон: 1');await expect(result).toHaveText('Отличается 0 пикселей (0%)');await expect(page.getByText('Исключено из сравнения: 200 px')).toBeVisible();
});
