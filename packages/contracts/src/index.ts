/** Browser-safe shared contracts. Domain DTOs are introduced in task 03. */
export interface BootstrapStatus {
    service: 'api';
    stage: 'bootstrap';
}
export interface ApiErrorEnvelope {
    error: {
        code: string;
        message: string;
        details: Record<string, unknown>;
        requestId: string;
    };
}
export interface CursorList<T> {
    items: T[];
    nextCursor: string | null;
}
export interface ListQuery {
    archived?: 'false' | 'true' | 'all';
    limit?: number;
    cursor?: string;
}
export interface ParticipantDto {
    id: string;
    displayName: string;
    version: number;
    createdAt: string;
    updatedAt: string;
}
export interface ParticipantInput {
    displayName: string;
}
export interface StructureDto {
    id: string;
    name: string;
    version: number;
    archivedAt: string | null;
    effectiveArchived: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface ProjectDto extends StructureDto {
    description: string;
    authorId: string;
}
export interface PageDto extends StructureDto {
    projectId: string;
    url: string;
}
export interface AuthProfileRef {
    profileId: string;
    version: number;
}
export interface CaptureProfileDto {
    id: string;
    version: number;
    label: string;
    origin: string;
}
export interface VariantDto extends StructureDto {
    pageId: string;
    viewportWidth: number;
    viewportHeight: number;
    urlOverride: string | null;
    readySelector: string | null;
    settleDelayMs: number;
    authProfileRef: AuthProfileRef | null;
    authReadySelector: string | null;
    currentBaselineId: string | null;
}
export interface ProjectInput {
    name: string;
    description?: string;
}
export interface PageInput {
    name: string;
    url: string;
}
export interface VariantInput {
    name: string;
    viewportWidth: number;
    viewportHeight: number;
    urlOverride?: string | null;
    readySelector?: string | null;
    settleDelayMs?: number;
    authProfileRef?: AuthProfileRef | null;
    authReadySelector?: string | null;
}
export type ProjectPatch = Partial<ProjectInput> & {
    version: number;
    archived?: boolean;
};
export type PagePatch = Partial<PageInput> & {
    version: number;
    archived?: boolean;
};
export type VariantPatch = Partial<VariantInput> & {
    version: number;
    archived?: boolean;
};
