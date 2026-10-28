import { describe, expect, it } from 'vitest';
import { matchBatchPairs, BATCH_PAIR_LIMIT } from './batch-pairs';
const file = (name:string) => ({name}) as File;
describe('matchBatchPairs',()=>{
 it('matches basenames without extension and ignores case, never selection order',()=>{
  const home=file('Home-1440.PNG'), account=file('Account-390.jpeg');
  const result=matchBatchPairs([home,account],[file('account-390.png'),file('home-1440.jpg')]);
  expect(result.pairs.map(pair=>[pair.key,pair.site.name,pair.figma.name])).toEqual([['home-1440','Home-1440.PNG','home-1440.jpg'],['account-390','Account-390.jpeg','account-390.png']]);
  expect(result.issues).toEqual([]);
 });
 it('reports missing opposite files instead of pairing by index',()=>{
  const result=matchBatchPairs([file('home.png')],[file('account.png')]);
  expect(result.pairs).toEqual([]);
  expect(result.issues).toEqual([{key:'home',kind:'missing-figma',names:['home.png']},{key:'account',kind:'missing-site',names:['account.png']}]);
 });
 it('does not arbitrarily pair duplicate basenames on either side',()=>{
  const result=matchBatchPairs([file('Home.png'),file('home.jpg'),file('about.png')],[file('home.png'),file('about.jpg'),file('ABOUT.png')]);
  expect(result.pairs).toEqual([]);
  expect(result.issues.map(issue=>[issue.key,issue.kind])).toEqual([['home','ambiguous'],['about','ambiguous']]);
 });
 it('preserves dots in a page name and exposes overflow explicitly',()=>{
  const names=Array.from({length:BATCH_PAIR_LIMIT+1},(_,i)=>`page.${i}.png`);
  const result=matchBatchPairs(names.map(file),names.map(file));
  expect(result.pairs).toHaveLength(BATCH_PAIR_LIMIT);
  expect(result.overflow).toBe(1);
  expect(result.pairs[0]!.key).toBe('page.0');
 });
});
