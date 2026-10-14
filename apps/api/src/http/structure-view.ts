import type { Project, Page, Variant } from '../generated/prisma/client.js';
export function projectView(project: Project) { return { ...project, effectiveArchived: project.archivedAt !== null }; }
export function pageView(page: Page & {
    project?: {
        archivedAt: Date | null;
    };
}) { const { project, ...data } = page; return { ...data, effectiveArchived: page.archivedAt !== null || Boolean(project?.archivedAt) }; }
export function variantView(variant: Variant & {
    page?: {
        archivedAt: Date | null;
        project: {
            archivedAt: Date | null;
        };
    };
}) { const { page, nextBaselineNumber, nextJobNumber, nextRevisionNumber, ...data } = variant; void nextBaselineNumber; void nextJobNumber; void nextRevisionNumber; return { ...data, effectiveArchived: variant.archivedAt !== null || Boolean(page?.archivedAt) || Boolean(page?.project.archivedAt) }; }
