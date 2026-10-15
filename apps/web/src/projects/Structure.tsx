import { useState } from "react";
import { Link as RouterLink, useParams, useNavigate } from "react-router";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Divider,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { PageDto, ProjectDto, VariantDto } from "@design-qa/contracts";
import { api, errorText, type Kind, type RecordDto } from "../api/client";
import { RecordForm } from "./RecordForm";
function RecordRow({
  record,
  kind,
  ancestorArchived = false,
  participant,
  onEdit,
  href,
}: {
  record: RecordDto;
  kind: Kind;
  ancestorArchived?: boolean;
  participant: boolean;
  onEdit: () => void;
  href?: string | undefined;
}) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      api.patch(kind, record.id, {
        version: record.version,
        archived: !record.archivedAt,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["structure"] }),
    onError: () => qc.invalidateQueries({ queryKey: ["structure"] }),
  });
  const variant = record as VariantDto;
  const page = record as PageDto;
  const project = record as ProjectDto;
  return (
    <Box
      component="article"
      sx={{ p: { xs: 2, sm: 2.5 }, borderBottom: 1, borderColor: "divider" }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="h3"
            variant="h3"
            sx={{ overflowWrap: "anywhere" }}
          >
            {href ? (
              <Link component={RouterLink} to={href} underline="hover">
                {record.name}
              </Link>
            ) : (
              record.name
            )}
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ mt: 0.5, overflowWrap: "anywhere" }}
          >
            {kind === "variant"
              ? `${variant.viewportWidth} × ${variant.viewportHeight} px`
              : kind === "page"
                ? page.url
                : project.description || "Без описания"}
          </Typography>
          {kind === "variant" && variant.urlOverride && (
            <Typography
              color="text.secondary"
              variant="body2"
              sx={{ overflowWrap: "anywhere" }}
            >
              URL: {variant.urlOverride}
            </Typography>
          )}
          <Stack direction="row" sx={{ gap: 1, mt: 1, flexWrap: "wrap" }}>
            {record.archivedAt && (
              <Chip size="small" label="В собственном архиве" />
            )}
            {ancestorArchived && (
              <Chip size="small" label="Родитель в архиве" />
            )}
          </Stack>
        </Box>
        <Stack
          direction="row"
          spacing={1}
          sx={{ flexWrap: "wrap", flexShrink: 0 }}
        >
          <Button
            aria-label={`Изменить ${record.name}`}
            disabled={
              !participant || record.effectiveArchived || mutation.isPending
            }
            onClick={onEdit}
          >
            Изменить
          </Button>
          {!ancestorArchived && (
            <Button
              aria-label={`${record.archivedAt ? "Восстановить" : "Архивировать"} ${record.name}`}
              disabled={!participant || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {record.archivedAt ? "Восстановить" : "В архив"}
            </Button>
          )}
        </Stack>
      </Stack>
      {mutation.isError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {errorText(mutation.error)} Обновите данные перед повторной попыткой.
        </Alert>
      )}
    </Box>
  );
}
function List({
  kind,
  parentId,
  ancestorArchived = false,
  participant,
}: {
  kind: Kind;
  parentId?: string | undefined;
  ancestorArchived?: boolean;
  participant: boolean;
}) {
  const navigate = useNavigate();
  const [archived, setArchived] = useState("all");
  const [form, setForm] = useState<{ record?: RecordDto } | null>(null);
  const query = useInfiniteQuery({
    queryKey: ["structure", "list", kind, parentId, archived],
    queryFn: ({ pageParam }) => api.list(kind, parentId, pageParam, archived),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const names = { project: "Проекты", page: "Страницы", variant: "Варианты" };
  const create = {
    project: "Новый проект",
    page: "Новая страница",
    variant: "Новый вариант",
  };
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", mb: 2, mt: 3 }}
      >
        <Typography component="h2" variant="h2">
          {names[kind]}
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1 }}>
          <TextField
            select
            slotProps={{ select: { native: true } }}
            label="Показать"
            value={archived}
            onChange={(e) => setArchived(e.target.value)}
            sx={{ minWidth: 155, width: { xs: "100%", sm: 190 } }}
          >
            <option value="all">Все записи</option>
            <option value="false">Активные</option>
            <option value="true">Архив</option>
          </TextField>
          <Button
            variant="contained"
            disabled={!participant || ancestorArchived}
            onClick={() => setForm({})}
            sx={{ whiteSpace: "nowrap", flexShrink: 0, px: 2.5 }}
          >
            {create[kind]}
          </Button>
        </Stack>
      </Stack>
      {ancestorArchived && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Родитель в архиве. Записи доступны для просмотра; изменения станут
          доступны после восстановления родителя.
        </Alert>
      )}
      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        {query.isPending && (
          <Typography role="status" sx={{ p: 3 }}>
            Загрузка…
          </Typography>
        )}
        {query.isError && (
          <Alert
            severity="error"
            action={
              <Button onClick={() => void query.refetch()}>Повторить</Button>
            }
          >
            {errorText(query.error)}
          </Alert>
        )}
        {!query.isPending && !query.isError && items.length === 0 && (
          <Box sx={{ p: 4 }}>
            <Typography component="h3" variant="h3">
              {archived === "all"
                ? "Пока нет записей"
                : "Нет записей с выбранным фильтром"}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {kind === "project"
                ? "Создайте проект, затем добавьте страницы и размеры экранов."
                : kind === "page"
                  ? "Добавьте страницу с адресом, который хотите проверять."
                  : "Добавьте вариант для каждого размера экрана."}
            </Typography>
          </Box>
        )}
        {items.map((record) => (
          <RecordRow
            key={record.id}
            record={record}
            kind={kind}
            participant={participant}
            ancestorArchived={ancestorArchived}
            onEdit={() => setForm({ record })}
            href={
              kind === "project"
                ? `/projects/${record.id}`
                : kind === "page"
                  ? `/projects/${parentId}/pages/${record.id}`
                  : undefined
            }
          />
        ))}
        {query.hasNextPage && (
          <Button
            fullWidth
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? "Загрузка…" : "Загрузить ещё"}
          </Button>
        )}
      </Paper>
      {form && (
        <RecordForm
          kind={kind}
          parentId={parentId}
          record={form.record}
          onClose={() => setForm(null)}
          onCreated={(created) => {
            if (kind === "project") navigate(`/projects/${created.id}`);
          }}
        />
      )}
    </>
  );
}
export function Structure({ participant }: { participant: boolean }) {
  const { projectId, pageId } = useParams();
  const [edit, setEdit] = useState<{ kind: Kind; record: RecordDto } | null>(
    null,
  );
  const project = useQuery({
    queryKey: ["structure", "project", projectId],
    queryFn: () => api.project(projectId!),
    enabled: !!projectId,
  });
  const page = useQuery({
    queryKey: ["structure", "page", pageId],
    queryFn: () => api.page(pageId!),
    enabled: !!pageId,
  });
  if (projectId && (project.isPending || (pageId && page.isPending)))
    return <Typography role="status">Загрузка структуры…</Typography>;
  if (projectId && (project.isError || (pageId && page.isError)))
    return (
      <Alert
        severity="error"
        action={
          <Button
            onClick={() => {
              void project.refetch();
              if (pageId) void page.refetch();
            }}
          >
            Повторить
          </Button>
        }
      >
        {errorText(project.error ?? page.error)}
      </Alert>
    );
  if (page.data && page.data.projectId !== projectId)
    return (
      <Alert severity="error">Страница не принадлежит этому проекту.</Alert>
    );
  return (
    <>
      <Breadcrumbs aria-label="Навигация" sx={{ mb: 3 }}>
        <Link component={RouterLink} to="/">
          Проекты
        </Link>
        {project.data && (
          <Link component={RouterLink} to={`/projects/${projectId}`}>
            {project.data.name}
          </Link>
        )}
        {page.data && <Typography>{page.data.name}</Typography>}
      </Breadcrumbs>
      <Typography
        component="h1"
        variant="h1"
        sx={{ mb: 1, overflowWrap: "anywhere" }}
      >
        {page.data?.name ?? project.data?.name ?? "Структура проектов"}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {page.data
          ? "Размеры экранов и настройки страницы"
          : project.data
            ? "Страницы и варианты проекта"
            : "Рабочее пространство для проверки дизайна"}
      </Typography>
      {project.data && (
        <Paper variant="outlined">
          <RecordRow
            record={project.data}
            kind="project"
            participant={participant}
            onEdit={() => setEdit({ kind: "project", record: project.data! })}
          />
          {page.data && (
            <>
              <Divider />
              <RecordRow
                record={page.data}
                kind="page"
                ancestorArchived={project.data.effectiveArchived}
                participant={participant}
                onEdit={() => setEdit({ kind: "page", record: page.data! })}
              />
            </>
          )}
        </Paper>
      )}
      <List
        key={pageId ?? projectId ?? "root"}
        kind={pageId ? "variant" : projectId ? "page" : "project"}
        parentId={pageId ?? projectId}
        ancestorArchived={
          page.data?.effectiveArchived ??
          project.data?.effectiveArchived ??
          false
        }
        participant={participant}
      />
      {edit && (
        <RecordForm
          kind={edit.kind}
          record={edit.record}
          onClose={() => setEdit(null)}
        />
      )}
    </>
  );
}
