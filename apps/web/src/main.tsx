import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import LiveApp from "./LiveApp";
import { previewData, previewActions } from "./preview";
const preview = new URLSearchParams(location.search).get("preview") === "1";
const check = new URLSearchParams(location.search).get("check") === "1";
const ExitCheck = lazy(() => import("./ExitCheck"));
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {check ? (
      <Suspense fallback={<p role="status">Loading withdrawal inspection…</p>}>
        <ExitCheck />
      </Suspense>
    ) : preview ? (
      <App
        data={{
          ...previewData,
          ...(new URLSearchParams(location.search).get("role") === "seller"
            ? { wallet: "0x71C7000000000000000000000000000000002f8A" }
            : {}),
        }}
        actions={previewActions}
      />
    ) : (
      <LiveApp />
    )}
  </React.StrictMode>,
);
