import {
  Box,
  Button,
  CircularProgress,
  FormLabel,
  Paper,
  TextField,
  Typography,
} from "@material-ui/core";
import Image from "next/image";
import { useRouter } from "next/router";
import React from "react";

export default function Login(): JSX.Element {
  const [id, setId] = React.useState<string | undefined>();
  const [secret, setSecret] = React.useState<string | undefined>();
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  async function handleSubmit() {
    if (!id || !secret) {
      return;
    }

    setLoading(true);

    const res = await fetch("/api/login", {
      body: JSON.stringify({ id, secret }),
      method: "POST",
    });

    const ok = (await res.json()).status === 200;
    if (ok) {
      router.push("/");
    }
  }

  return (
    <Box sx={{ display: "flex", height: "100vh", justifyContent: "center" }}>
      <Paper
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          height: "375px",
          width: "430px",
          m: 4,
          p: 6,
        }}
      >
        <Typography variant="h6">Vertex Dev Dashboard</Typography>
        <Box sx={{ my: 2 }}>
          <Image src="/vertex-logo.svg" alt="Vertex" width="50" height="50" />
        </Box>

        <FormLabel component="legend">Enter your API key and secret</FormLabel>
        <TextField
          fullWidth
          label="Client ID"
          margin="normal"
          onChange={(e) => setId(e.target.value)}
          size="small"
          type="text"
        />
        <TextField
          fullWidth
          label="Client Secret"
          margin="normal"
          onChange={(e) => setSecret(e.target.value)}
          size="small"
          type="text"
        />

        <Button
          sx={{ mt: 2 }}
          variant="outlined"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading && <CircularProgress sx={{ mr: 1 }} size={16} />}
          <Box>Sign In</Box>
        </Button>
      </Paper>
    </Box>
  );
}
