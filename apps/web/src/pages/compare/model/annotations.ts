import type { Rect, Size } from './geometry';
import type { ComparisonImage } from './image-file';
export type ComparisonNote = { id: string; rect: Rect; body: string; state: 'OPEN' | 'RESOLVED' };
export function validateNoteBody(value: string): string {
  const body = value.trim();
  if (!body.length || body.length > 5000) throw new Error('Введите текст замечания от 1 до 5000 символов.');
  return body;
}
export function validateNoteRect(rect: Rect, site: Size): void {
  if (![rect.x, rect.y, rect.width, rect.height, site.width, site.height].every(Number.isFinite) || site.width < 1 || site.height < 1 || rect.x < 0 || rect.y < 0 || rect.width < 1 || rect.height < 1 || rect.x + rect.width > site.width || rect.y + rect.height > site.height) throw new Error('Область замечания должна находиться в пределах скриншота сайта и быть не меньше 1 × 1 px.');
}
export function createReport(site: ComparisonImage, figma: ComparisonImage, notes: ComparisonNote[], exportedAt: string) {
  if (!notes.length || notes.length > 500) throw new Error('Для экспорта нужно от 1 до 500 замечаний.');
  const describe = (image: ComparisonImage) => ({ name: image.name.split(/[\\/]/).pop() || 'image', width: image.width, height: image.height });
  return { schemaVersion: 1, exportedAt, site: describe(site), figma: describe(figma), notes: notes.map(note => {
    validateNoteRect(note.rect, site);
    if (note.state !== 'OPEN' && note.state !== 'RESOLVED') throw new Error('Неизвестный статус замечания.');
    return { id: note.id, rect: { x: note.rect.x, y: note.rect.y, width: note.rect.width, height: note.rect.height }, body: validateNoteBody(note.body), state: note.state };
  }) };
}
