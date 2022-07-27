import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import Image from "next/image";
import { useRouter } from "next/router";
import React from "react";
import { isValidHttpUrl, isValidHttpUrlNullable } from "../lib/config";

const IdLength = 64;
const SecretLength = 26;

interface NetworkConfigInput {
  apiHost?: string;
  renderingHost?: string;
  sceneTreeHost?: string;
  sceneViewHost?: string;
}

export default function Login(): JSX.Element {
  const [id, setId] = React.useState<string | undefined>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("vertexvis.client.id") || undefined;
    }
    return undefined;
  });
  const [secret, setSecret] = React.useState<string | undefined>();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [env, setEnv] = React.useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("vertexvis.env") || "platprod";
    }

    return "platprod";
  });
  const [networkConfig, setNetworkConfig] = React.useState<NetworkConfigInput>(
    () => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("vertexvis.network.config");
        try {
          return saved != null ? (JSON.parse(saved) as NetworkConfigInput) : {};
        } catch (e) {
          console.error("failed to get network config from local storage", e);
        }
      }

      return {};
    }
  );
  const router = useRouter();

  const invalidId = id?.length !== IdLength;
  const invalidSecret = secret?.length !== SecretLength;
  const invalidApiHost = !isValidHttpUrl(networkConfig.apiHost);
  const invalidRenderingHost = !isValidHttpUrl(networkConfig.renderingHost);
  const invalidSceneTreeHost = !isValidHttpUrlNullable(
    networkConfig.sceneTreeHost
  );
  const invalidSceneViewHost = !isValidHttpUrlNullable(
    networkConfig.sceneViewHost
  );
  const customConfigurationValidated =
    !invalidApiHost &&
    !invalidRenderingHost &&
    !invalidSceneTreeHost &&
    !invalidSceneViewHost;

  function setLocalStorageItems() {
    if (networkConfig != null) {
      localStorage.setItem(
        "vertexvis.network.config",
        JSON.stringify(networkConfig)
      );
    }
    localStorage.setItem("vertexvis.env", env);
    if (id != null) {
      localStorage.setItem("vertexvis.client.id", id);
    }
  }
  async function handleSubmit() {
    if (!id || !secret) return;
    setLoading(true);
    setLocalStorageItems();
    const res = await (
      await fetch("/api/login", {
        body: JSON.stringify({ id, secret, env, networkConfig }),
        method: "POST",
      })
    ).json();

    if (res.status === 401) {
      setError("Invalid credentials.");
      setLoading(false);
    } else if (res.status === 200) router.push("/");
  }

  return (
    <Box sx={{ display: "flex", height: "100vh", justifyContent: "center" }}>
      <Paper
        sx={{
          alignItems: "center",
          display: "flex",
          justifyContent: "center",
          flexDirection: "column",
          maxHeight: env === "custom" ? "800px" : "500px",
          minWidth: "30%",
          mx: 2,
          my: 4,
          p: 4,
        }}
      >
        <Typography variant="h6">Vertex Dev Dashboard</Typography>
        <Box sx={{ my: 2 }}>
          <Image src="/vertex-logo.svg" alt="Vertex" width="50" height="50" />
        </Box>

        <FormLabel component="legend">Enter your API credentials</FormLabel>
        <TextField
          error={invalidId}
          fullWidth
          helperText={
            invalidId ? `${IdLength}-character client ID required.` : undefined
          }
          value={id}
          label="Client ID"
          margin="normal"
          onChange={(e) => setId(e.target.value)}
          size="small"
          type="text"
        />
        <TextField
          error={invalidSecret}
          fullWidth
          helperText={
            invalidSecret
              ? `${SecretLength}-character client secret required.`
              : undefined
          }
          label="Client Secret"
          margin="normal"
          onChange={(e) => setSecret(e.target.value)}
          size="small"
          type="password"
        />

        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel id="environment">Environment</InputLabel>
          <Select
            id="environment"
            labelId="environment"
            label="Environment"
            onChange={(e) => setEnv(e.target.value)}
            size="small"
            value={env}
          >
            <MenuItem value="platprod">platprod</MenuItem>
            <MenuItem value="platdev">platdev</MenuItem>
            <MenuItem value="custom">custom</MenuItem>
          </Select>
        </FormControl>
        {env === "custom" && (
          <>
            <TextField
              error={invalidApiHost}
              fullWidth
              value={networkConfig.apiHost}
              helperText={
                invalidApiHost
                  ? `URL required and must be formatted as a url ('http://...' or 'https://...')`
                  : undefined
              }
              label="Api Host"
              margin="normal"
              onChange={(e) =>
                setNetworkConfig({
                  ...networkConfig,
                  apiHost: e.target.value,
                })
              }
              size="small"
              type="text"
            />
            <TextField
              error={invalidRenderingHost}
              fullWidth
              value={networkConfig.renderingHost}
              helperText={
                invalidRenderingHost
                  ? `URL required and must be formatted as a url ('ws://...' or 'wss://...')`
                  : undefined
              }
              label="Rendering Host"
              margin="normal"
              onChange={(e) =>
                setNetworkConfig({
                  ...networkConfig,
                  renderingHost: e.target.value,
                })
              }
              size="small"
              type="text"
            />

            <TextField
              error={invalidSceneTreeHost}
              fullWidth
              value={networkConfig.sceneTreeHost}
              helperText={
                invalidSceneTreeHost
                  ? `URL must be formatted as a url ('http://...' or 'https://...')`
                  : undefined
              }
              label="Scene Tree Host"
              margin="normal"
              onChange={(e) =>
                setNetworkConfig({
                  ...networkConfig,
                  sceneTreeHost: e.target.value,
                })
              }
              size="small"
              type="text"
            />
            <TextField
              error={invalidSceneViewHost}
              fullWidth
              value={networkConfig.sceneViewHost}
              helperText={
                invalidSceneViewHost
                  ? `URL must be formatted as a url ('http://...' or 'https://...')`
                  : undefined
              }
              label="Scene View Host"
              margin="normal"
              onChange={(e) =>
                setNetworkConfig({
                  ...networkConfig,
                  sceneViewHost: e.target.value,
                })
              }
              size="small"
              type="text"
            />
          </>
        )}

        <Button
          sx={{ mt: 2 }}
          variant="outlined"
          onClick={handleSubmit}
          disabled={
            loading || (env === "custom" && !customConfigurationValidated)
          }
        >
          {loading && <CircularProgress sx={{ mr: 1 }} size={16} />}
          <Box>Sign In</Box>
        </Button>

        <Typography sx={{ my: 2 }} variant="body2">
          {error}
        </Typography>
      </Paper>
    </Box>
  );
}
