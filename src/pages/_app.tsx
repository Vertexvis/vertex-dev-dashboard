import "@vertexvis/viewer/dist/viewer/viewer.css";

import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import CssBaseline from "@mui/material/CssBaseline";
import Fade from "@mui/material/Fade";
import LinearProgress from "@mui/material/LinearProgress";
import { ThemeProvider } from "@mui/material/styles";
import { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import React from "react";
import { SWRConfig } from "swr";

import theme from "../lib/theme";

const cache = createCache({ key: "css", prepend: true });
cache.compat = true;

const RouteProgressDelayMs = 150;
const RouteProgressFadeInMs = 200;
const RouteProgressFadeOutMs = 300;

export default function App({ Component, pageProps }: AppProps): JSX.Element {
  const { events } = useRouter();
  const [showRouteProgress, setShowRouteProgress] = React.useState(false);
  const routeProgressTimer = React.useRef<number>();

  React.useEffect(() => {
    function handleChange(url: string) {
      /* eslint-disable @typescript-eslint/ban-ts-comment */
      // @ts-ignore
      if (window.gtag) {
        // @ts-ignore
        window.gtag("config", process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS, {
          cookie_flags: "SameSite=None;Secure",
          page_path: url,
        });
      }
      /* eslint-enable @typescript-eslint/ban-ts-comment */
    }

    events.on("routeChangeComplete", handleChange);
    return () => {
      events.off("routeChangeComplete", handleChange);
    };
  }, [events]);

  React.useEffect(() => {
    function handleRouteChangeStart() {
      routeProgressTimer.current = window.setTimeout(() => {
        setShowRouteProgress(true);
      }, RouteProgressDelayMs);
    }

    function handleRouteChangeEnd() {
      if (routeProgressTimer.current != null) {
        window.clearTimeout(routeProgressTimer.current);
        routeProgressTimer.current = undefined;
      }

      setShowRouteProgress(false);
    }

    events.on("routeChangeStart", handleRouteChangeStart);
    events.on("routeChangeComplete", handleRouteChangeEnd);
    events.on("routeChangeError", handleRouteChangeEnd);

    return () => {
      if (routeProgressTimer.current != null) {
        window.clearTimeout(routeProgressTimer.current);
      }

      events.off("routeChangeStart", handleRouteChangeStart);
      events.off("routeChangeComplete", handleRouteChangeEnd);
      events.off("routeChangeError", handleRouteChangeEnd);
    };
  }, [events]);

  return (
    <React.StrictMode>
      <CacheProvider value={cache}>
        <Head>
          <title>Vertex Dev Dashboard</title>
          <link rel="icon" href="/favicon-512x512.png" />
          <meta
            name="viewport"
            content="minimum-scale=1, initial-scale=1, width=device-width"
          />
          <meta
            name="description"
            content="Use the Vertex Dev Dashboard to explore your Vertex platform account."
          />
        </Head>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Fade
            in={showRouteProgress}
            timeout={{
              enter: RouteProgressFadeInMs,
              exit: RouteProgressFadeOutMs,
            }}
          >
            <LinearProgress
              sx={{
                left: 0,
                position: "fixed",
                right: 0,
                top: 0,
                zIndex: (theme) => theme.zIndex.tooltip,
              }}
            />
          </Fade>
          <SWRConfig
            value={{ fetcher: (url) => fetch(url).then((res) => res.json()) }}
          >
            <Component {...pageProps} />
          </SWRConfig>
        </ThemeProvider>
      </CacheProvider>
    </React.StrictMode>
  );
}
