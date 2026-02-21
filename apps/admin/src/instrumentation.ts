import { validateEnvironment } from "./lib/config/env-validation";

export async function register() {
  // Validate environment configuration on startup
  validateEnvironment();

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge" && process.env.CF_PAGES !== "1") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = async (
  err: { digest: string } & Error,
  request: {
    path: string;
    method: string;
    headers: { [key: string]: string };
  },
  context: {
    routerKind: "Pages Router" | "App Router";
    routePath: string;
    routeType: "render" | "route" | "action" | "middleware";
    renderSource:
      | "react-server-components"
      | "react-server-components-payload"
      | "server-rendering";
    revalidateReason: "on-demand" | "stale" | undefined;
    renderType: "dynamic" | "dynamic-resume";
  }
) => {
  if (process.env.CF_PAGES === "1") return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureException(err, {
    extra: {
      request,
      context,
    },
  });
};
