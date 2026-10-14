import type { Prisma } from '../generated/prisma/client.js';
import { missing } from '../http/errors.js';
export type StructureTransaction = Prisma.TransactionClient;
// All structure writers share this ancestor-first order. IDs/parent links are immutable.
export async function lockProject(tx: StructureTransaction, id: string) { await tx.$queryRaw `SELECT id FROM "Project" WHERE id=${id}::uuid FOR UPDATE`; return missing(await tx.project.findUnique({ where: { id } })); }
export async function lockPage(tx: StructureTransaction, id: string) { const link = missing(await tx.page.findUnique({ where: { id }, select: { projectId: true } })); const project = await lockProject(tx, link.projectId); await tx.$queryRaw `SELECT id FROM "Page" WHERE id=${id}::uuid FOR UPDATE`; return { project, page: missing(await tx.page.findUnique({ where: { id } })) }; }
export async function lockVariant(tx: StructureTransaction, id: string) { const link = missing(await tx.variant.findUnique({ where: { id }, select: { pageId: true } })); const parents = await lockPage(tx, link.pageId); await tx.$queryRaw `SELECT id FROM "Variant" WHERE id=${id}::uuid FOR UPDATE`; return { ...parents, variant: missing(await tx.variant.findUnique({ where: { id } })) }; }
