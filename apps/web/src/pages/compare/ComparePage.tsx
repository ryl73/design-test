import { Container, Typography } from "@mui/material";

// Temporary integration boundary; the comparison workspace is implemented in Task 3.
export function ComparePage() {
  return <Container component="main" sx={{ py: 5 }}>
    <Typography variant="h1">Design QA</Typography>
    <Typography>Локальное сравнение изображений — рабочая область готовится.</Typography>
    <Typography>Сессия хранится только в памяти вкладки и очищается при перезагрузке.</Typography>
  </Container>;
}
