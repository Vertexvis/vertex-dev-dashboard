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
} from "@material-ui/core";
import Image from "next/image";
import { useRouter } from "next/router";
import React from "react";

const IdLength = 64;
const SecretLength = 26;

export default function Login(): JSX.Element {
  const [id, setId] = React.useState<string | undefined>();
  const [secret, setSecret] = React.useState<string | undefined>();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [env, setEnv] = React.useState("platdev");
  const router = useRouter();

  const invalidId = id != null && id.length !== IdLength;
  // In platdev, secrets can be 36-charaters
  const invalidSecret =
    secret != null && (secret.length < SecretLength || secret.length > 36);

  async function handleSubmit() {
    if (!id || !secret) return;

    setLoading(true);

    const res = await (
      await fetch("/api/login", {
        body: JSON.stringify({ id, secret, env }),
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          height: "430px",
          width: "430px",
          m: 4,
          p: 6,
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
            labelId="environment"
            id="environment"
            value={env}
            label="Environment"
            onChange={(e) => setEnv(e.target.value)}
          >
            <MenuItem value="platdev">platdev</MenuItem>
            <MenuItem value="platstaing">platstaging</MenuItem>
          </Select>
        </FormControl>

        <Button
          sx={{ mt: 2 }}
          variant="outlined"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading && <CircularProgress sx={{ mr: 1 }} size={16} />}
          <Box>Sign In</Box>
        </Button>
        {error && (
          <Typography sx={{ my: 2 }} variant="body2">
            {error}
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
