import type {
  ApiErrorEnvelope,
  ParticipantDto,
  ParticipantInput,
  ProjectDto,
  ProjectInput,
  ProjectPatch,
  PageDto,
  PageInput,
  PagePatch,
  VariantDto,
  VariantInput,
  VariantPatch,
  CursorList,
  CaptureProfileDto,
} from "@design-qa/contracts";
export class ApiError extends Error {
  constructor(
    public status: number,
    public envelope: ApiErrorEnvelope,
  ) {
    super(envelope.error.message);
  }
}
export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api/v1" + path, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    let envelope: ApiErrorEnvelope;
    try {
      envelope = await response.json();
    } catch {
      envelope = {
        error: {
          code: "HTTP_ERROR",
          message: "Сервер недоступен",
          details: {},
          requestId: "",
        },
      };
    }
    throw new ApiError(response.status, envelope);
  }
  return response.json() as Promise<T>;
}
export type Kind = "project" | "page" | "variant";
export type RecordDto = ProjectDto | PageDto | VariantDto;
export type RecordInput = ProjectInput | PageInput | VariantInput;
export const collection = (kind: Kind, parentId?: string) =>
  kind === "project"
    ? "/projects"
    : kind === "page"
      ? `/projects/${parentId}/pages`
      : `/pages/${parentId}/variants`;
export const itemPath = (kind: Kind, id: string) =>
  `/${kind === "project" ? "projects" : kind === "page" ? "pages" : "variants"}/${id}`;
export const api = {
  me: () => request<ParticipantDto>("/participants/me"),
  participant: (data: ParticipantInput, rename: boolean) =>
    request<ParticipantDto>(
      rename ? "/participants/me" : "/participants",
      rename ? "PATCH" : "POST",
      data,
    ),
  project: (id: string) => request<ProjectDto>(itemPath("project", id)),
  page: (id: string) => request<PageDto>(itemPath("page", id)),
  list: (kind: Kind, parentId?: string, cursor?: string, archived = "all") =>
    request<CursorList<RecordDto>>(
      collection(kind, parentId) +
        `?archived=${archived}&limit=30` +
        (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""),
    ),
  create: (kind: Kind, parentId: string | undefined, data: RecordInput) =>
    request<RecordDto>(collection(kind, parentId), "POST", data),
  patch: (
    kind: Kind,
    id: string,
    data: ProjectPatch | PagePatch | VariantPatch,
  ) => request<RecordDto>(itemPath(kind, id), "PATCH", data),
  profiles: () => request<{ items: CaptureProfileDto[] }>("/capture-profiles"),
};
export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409)
      return "Данные изменены другим участником. Черновик сохранён.";
    if (error.status === 401) return "Укажите имя участника перед сохранением.";
    if (error.envelope.error.code === "URL_POLICY")
      return "Этот адрес не разрешён настройками проекта. Проверьте URL.";
    if (error.status === 403)
      return "Изменение запрещено. Проверьте архив родителя и настройки адреса.";
    if (error.status === 400)
      return "Проверьте поля формы: сервер отклонил данные.";
    if (error.status === 404) return "Запись не найдена.";
  }
  return "Не удалось получить ответ сервера. Повторите попытку.";
}
