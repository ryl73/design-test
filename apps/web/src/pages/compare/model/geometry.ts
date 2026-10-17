export type Size = { width: number; height: number };
export type Point = { x: number; y: number };
export type Rect = Point & Size;
export type Camera = { center: Point; zoom: number };
export type ComparisonMode = 'overlay' | 'slider' | 'side-by-side';

export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Масштаб должен быть конечным числом.');
  return Math.min(4, Math.max(.01, value));
}
export function imageToScreen(point: Point, camera: Camera, viewport: Size): Point {
  return { x: (point.x - camera.center.x) * camera.zoom + viewport.width / 2, y: (point.y - camera.center.y) * camera.zoom + viewport.height / 2 };
}
export function screenToImage(point: Point, camera: Camera, viewport: Size): Point {
  return { x: (point.x - viewport.width / 2) / camera.zoom + camera.center.x, y: (point.y - viewport.height / 2) / camera.zoom + camera.center.y };
}
export function zoomAt(camera: Camera, nextZoom: number, anchor: Point, viewport: Size): Camera {
  const world = screenToImage(anchor, camera, viewport);
  const zoom = clampZoom(nextZoom);
  return { zoom, center: { x: world.x - (anchor.x - viewport.width / 2) / zoom, y: world.y - (anchor.y - viewport.height / 2) / zoom } };
}
export function fitCamera(world: Size, viewport: Size): Camera {
  if (![world.width, world.height, viewport.width, viewport.height].every(n => Number.isFinite(n) && n > 0)) throw new Error('Размеры холста должны быть положительными.');
  return { center: { x: world.width / 2, y: world.height / 2 }, zoom: clampZoom(Math.min(viewport.width / world.width, viewport.height / world.height)) };
}
export function clampRect(start: Point, end: Point, site: Size): Rect | null {
  if (![start.x, start.y, end.x, end.y, site.width, site.height].every(Number.isFinite) || site.width < 1 || site.height < 1) return null;
  const x = Math.max(0, Math.min(site.width, Math.min(start.x, end.x)));
  const y = Math.max(0, Math.min(site.height, Math.min(start.y, end.y)));
  const right = Math.max(0, Math.min(site.width, Math.max(start.x, end.x)));
  const bottom = Math.max(0, Math.min(site.height, Math.max(start.y, end.y)));
  return right - x >= 1 && bottom - y >= 1 ? { x, y, width: right - x, height: bottom - y } : null;
}
