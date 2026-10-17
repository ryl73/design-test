import { createTheme } from "@mui/material/styles";
export const theme = createTheme({
  palette: {
    primary: { main: "#4856c7" },
    background: { default: "#f3f5f9", paper: "#ffffff" },
    text: { primary: "#172337", secondary: "#53627a" },
    divider: "#dde3ee",
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontSize: "2rem", fontWeight: 700 },
    h2: { fontSize: "1.25rem", fontWeight: 650 },
    h3: { fontSize: "1rem", fontWeight: 650 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { minHeight: 44 } },
    },
    MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiCssBaseline: {
      styleOverrides: {
        a: { color: "#4856c7" },
        ":focus-visible": { outline: "3px solid #4856c7", outlineOffset: 3 },
        body: { fontVariantNumeric: "tabular-nums" },
        ".skip-link": {
          position: "absolute",
          top: -100,
          left: 16,
          zIndex: 1500,
          background: "white",
          padding: 12,
        },
        ".skip-link:focus": { top: 8 },
      },
    },
  },
});
