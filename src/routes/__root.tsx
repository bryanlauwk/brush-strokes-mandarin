import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";

const appTitle = "乱画俱乐部 · AFTERHOURS DRAW CLUB";
const appDescription =
  "画到离谱，猜到上头。给马来西亚朋友的华语画猜派对，2–12 人，免注册，手机即玩。";

function NotFoundComponent() {
  return (
    <div className="arcade-status-page">
      <div className="arcade-status-card">
        <h1>404</h1>
        <h2>这条巷子，没有派对。</h2>
        <p>链接可能打错了。回到入口，重新找朋友集合。</p>
        <div className="mt-6">
          <Link to="/" className="arcade-button">
            回到俱乐部
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="arcade-status-page">
      <div className="arcade-status-card">
        <h2>信号掉了一拍。</h2>
        <p>页面暂时没载入。再试一次，或回入口重新入场。</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="arcade-button"
          >
            再试一次
          </button>
          <a href="/" className="arcade-button arcade-button--secondary">
            回到俱乐部
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
      },
      { name: "theme-color", content: "#101014" },
      { title: appTitle },
      { name: "description", content: appDescription },
      { name: "author", content: "乱画俱乐部" },
      { property: "og:title", content: appTitle },
      { property: "og:description", content: appDescription },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: appTitle },
      { name: "twitter:description", content: appDescription },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700;900&family=Noto+Serif+SC:wght@600;700;900&family=Space+Grotesk:wght@400;500;600;700&family=Zhi+Mang+Xing&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-MY">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
