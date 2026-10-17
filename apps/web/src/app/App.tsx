import { CssBaseline, ThemeProvider } from "@mui/material";
import { ComparePage } from "../pages/compare";
import { theme } from "./theme";

export function App() {
  return <ThemeProvider theme={theme}><CssBaseline /><ComparePage /></ThemeProvider>;
}
