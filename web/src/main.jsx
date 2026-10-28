import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import App from "./App.jsx";
import "./styles.css";

const theme = createTheme({
  primaryColor: "indigo",
  defaultRadius: "md",
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  headings: { fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="bottom-center" limit={3} />
      <App />
    </MantineProvider>
  </React.StrictMode>
);
