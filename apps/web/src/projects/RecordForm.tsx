import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  MenuItem,
  Typography,
} from "@mui/material";
import {
  api,
  ApiError,
  errorText,
  itemPath,
  request,
  type Kind,
  type RecordDto,
  type RecordInput,
} from "../api/client";
import type { VariantDto, PageDto, ProjectDto } from "@design-qa/contracts";
const titles = { project: "проект", page: "страницу", variant: "вариант" };
function draft(record?: RecordDto) {
  const v = record as VariantDto | undefined;
  return {
    name: record?.name ?? "",
    description: (record as ProjectDto | undefined)?.description ?? "",
    url: (record as PageDto | undefined)?.url ?? "",
    viewportWidth: String(v?.viewportWidth ?? 1440),
    viewportHeight: String(v?.viewportHeight ?? 900),
    urlOverride: v?.urlOverride ?? "",
    readySelector: v?.readySelector ?? "",
    settleDelayMs: String(v?.settleDelayMs ?? 0),
    authReadySelector: v?.authReadySelector ?? "",
    profile: v?.authProfileRef
      ? `${v.authProfileRef.profileId}@${v.authProfileRef.version}`
      : "",
  };
}
export function RecordForm({
  kind,
  parentId,
  record,
  onClose,
  onCreated,
}: {
  kind: Kind;
  parentId?: string | undefined;
  record?: RecordDto | undefined;
  onClose: () => void;
  onCreated?: (record: RecordDto) => void;
}) {
  const [values, setValues] = useState(() => draft(record));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [baseline, setBaseline] = useState(record);
  const [version, setVersion] = useState(record?.version);
  const [conflict, setConflict] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const first = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const qc = useQueryClient();
  const profiles = useQuery({
    queryKey: ["profiles"],
    queryFn: api.profiles,
    enabled: kind === "variant",
  });
  const mutation = useMutation({
    mutationFn: async (data: RecordInput) => {
      if (!record) return api.create(kind, parentId, data);
      // Only explicitly changed fields are sent. Unchanged retired URL/profile
      // settings must not be revalidated or silently cleared during a rename.
      const original = baseline as unknown as Record<string, unknown>;
      const changed = Object.fromEntries(
        Object.entries(data).filter(
          ([key, value]) =>
            JSON.stringify(value) !== JSON.stringify(original[key]),
        ),
      );
      if (Object.keys(changed).length === 0) return baseline!;
      return api.patch(kind, record.id, { ...changed, version: version! });
    },
    onSuccess: async (saved) => {
      await qc.invalidateQueries({ queryKey: ["structure"] });
      onClose();
      if (!record) onCreated?.(saved);
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setConflict(true);
        await qc.invalidateQueries({ queryKey: ["structure"] });
      }
    },
  });
  function validate() {
    const e: Record<string, string> = {};
    if (!values.name.trim()) e.name = "Введите название";
    else if (values.name.length > 120) e.name = "Не более 120 символов";
    if (kind === "project" && values.description.length > 2000)
      e.description = "Не более 2000 символов";
    const url = (key: "url" | "urlOverride", required: boolean) => {
      if (!required && !values[key]) return;
      try {
        const u = new URL(values[key]);
        if (!["http:", "https:"].includes(u.protocol)) throw Error();
      } catch {
        e[key] = "Введите полный URL с http:// или https://";
      }
    };
    if (kind === "page") url("url", true);
    if (kind === "variant") {
      url("urlOverride", false);
      for (const [key, min, max] of [
        ["viewportWidth", 320, 2560],
        ["viewportHeight", 320, 1600],
        ["settleDelayMs", 0, 3000],
      ] as const) {
        const n = Number(values[key]);
        if (!values[key] || !Number.isInteger(n) || n < min || n > max)
          e[key] = `Целое число от ${min} до ${max}`;
      }
      for (const key of ["readySelector", "authReadySelector"] as const)
        if (values[key].length > 300) e[key] = "Не более 300 символов";
    }
    setErrors(e);
    if (Object.keys(e).length) {
      const key = Object.keys(e)[0];
      form.current?.querySelector<HTMLInputElement>(`[name="${key}"]`)?.focus();
      return false;
    }
    return true;
  }
  async function refresh() {
    try {
      const current = await request<RecordDto>(itemPath(kind, record!.id));
      setValues(draft(current));
      setVersion(current.version);
      setBaseline(current);
      setConflict(false);
      mutation.reset();
      setRefreshError("");
      first.current?.focus();
    } catch (e) {
      setRefreshError(errorText(e));
    }
  }
  function submit() {
    if (!validate()) return;
    let data: RecordInput = { name: values.name.trim() };
    if (kind === "project") data = { ...data, description: values.description };
    if (kind === "page") data = { ...data, url: values.url };
    if (kind === "variant") {
      const p = profiles.data?.items.find(
        (p) => `${p.id}@${p.version}` === values.profile,
      );
      data = {
        ...data,
        viewportWidth: Number(values.viewportWidth),
        viewportHeight: Number(values.viewportHeight),
        settleDelayMs: Number(values.settleDelayMs),
        urlOverride: values.urlOverride || null,
        readySelector: values.readySelector || null,
        authReadySelector: values.authReadySelector || null,
        authProfileRef: p
          ? { profileId: p.id, version: p.version }
          : values.profile && values.profile === draft(baseline).profile
            ? (baseline as VariantDto).authProfileRef
            : null,
      };
    }
    mutation.mutate(data);
  }
  const field = (
    key: keyof typeof values,
    label: string,
    type = "text",
    helper?: string,
  ) => (
    <TextField
      key={key}
      name={key}
      label={label}
      type={type}
      value={values[key]}
      onChange={(e) => setValues({ ...values, [key]: e.target.value })}
      error={!!errors[key]}
      helperText={errors[key] ?? helper}
      inputRef={key === "name" ? first : undefined}
      autoFocus={key === "name"}
      slotProps={{
        htmlInput: {
          maxLength:
            type === "text"
              ? key === "description"
                ? 2000
                : key === "name"
                  ? 120
                  : key === "url" || key === "urlOverride"
                    ? 2048
                    : 300
              : undefined,
        },
      }}
    />
  );
  return (
    <Dialog
      open
      fullWidth
      maxWidth="sm"
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      aria-labelledby="record-title"
    >
      <form
        ref={form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <DialogTitle id="record-title">
          {record ? "Изменить" : "Создать"} {titles[kind]}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {mutation.isError && (
              <Alert severity="error">{errorText(mutation.error)}</Alert>
            )}
            {conflict && (
              <>
                <Typography>
                  Обновите данные и сравните изменения. Загрузка заменит поля
                  формы актуальными значениями.
                </Typography>
                <Button onClick={() => void refresh()}>
                  Загрузить актуальные данные
                </Button>
              </>
            )}
            {refreshError && <Alert severity="error">{refreshError}</Alert>}
            {field("name", "Название")}
            {kind === "project" && field("description", "Описание")}
            {kind === "page" &&
              field(
                "url",
                "URL страницы",
                "url",
                "Полный адрес страницы, разрешённый настройками проекта",
              )}
            {kind === "variant" && (
              <>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  {field("viewportWidth", "Ширина", "number", "320–2560 px")}
                  {field("viewportHeight", "Высота", "number", "320–1600 px")}
                </Stack>
                <Accordion disableGutters>
                  <AccordionSummary>Дополнительные настройки</AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2}>
                      {field(
                        "urlOverride",
                        "URL варианта",
                        "url",
                        "Пустое поле — использовать URL страницы",
                      )}
                      {field("readySelector", "Селектор готовности")}
                      {field(
                        "settleDelayMs",
                        "Задержка после готовности",
                        "number",
                        "0–3000 мс",
                      )}
                      {profiles.isPending ? (
                        <Typography role="status">
                          Загрузка профилей…
                        </Typography>
                      ) : profiles.isError ? (
                        <Alert
                          severity="error"
                          action={
                            <Button onClick={() => void profiles.refetch()}>
                              Повторить
                            </Button>
                          }
                        >
                          Не удалось загрузить профили
                        </Alert>
                      ) : (
                        <TextField
                          select
                          label="Профиль доступа"
                          value={values.profile}
                          onChange={(e) =>
                            setValues({ ...values, profile: e.target.value })
                          }
                          helperText="Только метаданные; выполнение снимков пока недоступно"
                        >
                          <MenuItem value="">Без профиля</MenuItem>
                          {values.profile &&
                            !profiles.data?.items.some(
                              (p) => `${p.id}@${p.version}` === values.profile,
                            ) && (
                              <MenuItem value={values.profile}>
                                Сохранённый профиль {values.profile}{" "}
                                (недоступен)
                              </MenuItem>
                            )}
                          {profiles.data?.items.map((p) => (
                            <MenuItem
                              key={`${p.id}@${p.version}`}
                              value={`${p.id}@${p.version}`}
                            >
                              {p.label} · v{p.version} · {p.origin}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                      {field(
                        "authReadySelector",
                        "Селектор готовности авторизации",
                      )}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={mutation.isPending || conflict}
          >
            {mutation.isPending ? "Сохранение…" : "Сохранить"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
