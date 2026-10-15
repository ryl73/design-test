import { useState, useRef } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ThemeProvider,
  CssBaseline,
  Box,
  Container,
  Typography,
  Button,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from "@mui/material";
import { theme } from "./theme";
import { api, ApiError, errorText } from "../api/client";
import { Structure } from "../projects/Structure";
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});
function Workspace() {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api.me();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
  });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [validation, setValidation] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const mutation = useMutation({
    mutationFn: () => api.participant({ displayName: name.trim() }, !!me.data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      setOpen(false);
    },
  });
  const editName = () => {
    setName(me.data?.displayName ?? "");
    setValidation("");
    mutation.reset();
    setOpen(true);
  };
  return (
    <>
      <a className="skip-link" href="#content">
        Перейти к содержимому
      </a>
      <Box
        component="header"
        sx={{
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Container maxWidth="lg">
          <Stack
            direction="row"
            sx={{
              justifyContent: "space-between",
              alignItems: "center",
              minHeight: 76,
              gap: 2,
            }}
          >
            <Typography sx={{ fontWeight: 750, fontSize: 20 }}>
              Design QA
            </Typography>
            <Button onClick={editName} disabled={me.isPending}>
              {me.data ? me.data.displayName : "Указать имя"}
            </Button>
          </Stack>
        </Container>
      </Box>
      <Container
        component="main"
        id="content"
        maxWidth="lg"
        sx={{ py: { xs: 3, sm: 5 } }}
      >
        {!me.data && !me.isPending && (
          <Alert
            severity={me.isError ? "error" : "info"}
            sx={{ mb: 3 }}
            action={
              <Button onClick={me.isError ? () => void me.refetch() : editName}>
                {me.isError ? "Повторить" : "Ввести имя"}
              </Button>
            }
          >
            {me.isError
              ? "Не удалось проверить имя участника."
              : "Для создания и изменения записей укажите имя участника."}
          </Alert>
        )}
        <Routes>
          <Route path="/" element={<Structure participant={!!me.data} />} />
          <Route
            path="/projects/:projectId"
            element={<Structure participant={!!me.data} />}
          />
          <Route
            path="/projects/:projectId/pages/:pageId"
            element={<Structure participant={!!me.data} />}
          />
          <Route
            path="*"
            element={
              <Alert severity="warning">
                Страница не найдена. <a href="/">Вернуться к проектам</a>
              </Alert>
            }
          />
        </Routes>
      </Container>
      <Dialog
        open={open}
        onClose={() => {
          if (!mutation.isPending) setOpen(false);
        }}
        fullWidth
        maxWidth="xs"
        aria-labelledby="participant-title"
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || name.length > 120) {
              setValidation("Введите имя от 1 до 120 символов");
              input.current?.focus();
              return;
            }
            setValidation("");
            mutation.mutate();
          }}
        >
          <DialogTitle id="participant-title">Как к вам обращаться</DialogTitle>
          <DialogContent>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Это имя будет указано рядом с вашими изменениями.
            </Typography>
            {mutation.isError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errorText(mutation.error)}
              </Alert>
            )}
            <TextField
              autoFocus
              inputRef={input}
              label="Имя участника"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={!!validation}
              helperText={validation}
              slotProps={{ htmlInput: { maxLength: 120 } }}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
export function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={client}>
        <BrowserRouter>
          <Workspace />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
