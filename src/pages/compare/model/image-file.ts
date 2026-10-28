import type { Size } from './geometry';
export type ImageHeader = Size & { format: 'png' | 'jpeg'; mime: 'image/png' | 'image/jpeg' };
export type ComparisonImage = ImageHeader & { id: string; name: string; url: string; bytes: number };
export type ImageFileErrorCode = 'FORMAT' | 'CORRUPT' | 'ANIMATED' | 'SIZE' | 'DECODE' | 'READ';
export class ImageFileError extends Error {
  constructor(public readonly code: ImageFileErrorCode, message: string) { super(message); this.name = 'ImageFileError'; }
}
const MAX_BYTES = 15 * 1024 * 1024;
const corrupt = (): never => { throw new ImageFileError('CORRUPT', 'Файл повреждён или имеет неполный заголовок. Выберите другой PNG или JPEG.'); };
export function validateImageSize(header: Size, byteLength: number): void {
  if (!Number.isSafeInteger(byteLength) || byteLength < 0 || byteLength > MAX_BYTES) throw new ImageFileError('SIZE', 'Размер файла не должен превышать 15 МиБ.');
  if (![header.width, header.height].every(n => Number.isSafeInteger(n) && n >= 1) || header.width > 4096 || header.height > 10000 || header.width * header.height > 25_600_000) throw new ImageFileError('SIZE', 'Допустимы изображения шириной до 4096 px, высотой до 10000 px и площадью до 25 600 000 пикселей.');
}
export function parseImageHeader(bytes: Uint8Array): ImageHeader {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (pngSignature.every((value, i) => bytes[i] === value)) {
    let offset = 8;
    let size: Size | undefined;
    while (offset < bytes.length) {
      if (bytes.length - offset < 12) return corrupt();
      const length = view.getUint32(offset);
      if (length > bytes.length - offset - 12) return corrupt();
      const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      if (!size && type !== 'IHDR') return corrupt();
      if (type === 'IHDR') {
        if (size || length !== 13) return corrupt();
        size = { width: view.getUint32(offset + 8), height: view.getUint32(offset + 12) };
      }
      if (type === 'acTL') throw new ImageFileError('ANIMATED', 'Анимированный PNG не поддерживается. Экспортируйте статический PNG.');
      offset += length + 12;
      if (type === 'IEND') {
        if (length !== 0 || offset !== bytes.length || !size) return corrupt();
        return { ...size, format: 'png', mime: 'image/png' };
      }
    }
    return corrupt();
  }
  if (bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset < bytes.length) {
      if (bytes[offset++] !== 255) return corrupt();
      while (bytes[offset] === 255) offset++;
      if (offset >= bytes.length) return corrupt();
      const marker = view.getUint8(offset++);
      if (marker === 0 || marker === 216 || marker === 217 || marker === 218) return corrupt();
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (bytes.length - offset < 2) return corrupt();
      const length = view.getUint16(offset);
      if (length < 2 || length > bytes.length - offset) return corrupt();
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
        if (length < 8) return corrupt();
        const components = view.getUint8(offset + 7);
        if (components < 1 || length !== 8 + 3 * components) return corrupt();
        return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3), format: 'jpeg', mime: 'image/jpeg' };
      }
      offset += length;
    }
    return corrupt();
  }
  throw new ImageFileError('FORMAT', 'Поддерживаются только статические PNG и JPEG. Проверьте формат файла.');
}
export async function loadImageFile(file: File): Promise<ComparisonImage> {
  if (file.size > MAX_BYTES) throw new ImageFileError('SIZE', 'Размер файла не должен превышать 15 МиБ.');
  let bytes: Uint8Array;
  try { bytes = new Uint8Array(await file.arrayBuffer()); }
  catch { throw new ImageFileError('READ', 'Не удалось прочитать файл. Попробуйте выбрать его снова.'); }
  const header = parseImageHeader(bytes);
  validateImageSize(header, file.size);
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new ImageFileError('DECODE', 'Не удалось декодировать изображение. Файл может быть повреждён. Выберите другой PNG или JPEG.'); }
  let width: number;
  let height: number;
  try { width = bitmap.width; height = bitmap.height; validateImageSize({ width, height }, file.size); }
  finally { bitmap.close(); }
  return { ...header, width, height, id: crypto.randomUUID(), name: file.name.split(/[\\/]/).pop() || 'image', bytes: file.size, url: URL.createObjectURL(file) };
}
export function releaseImage(image: ComparisonImage): void { URL.revokeObjectURL(image.url); }
