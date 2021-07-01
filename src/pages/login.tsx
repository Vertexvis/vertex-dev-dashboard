import { useRouter } from "next/router";
import React from "react";

export default function Login(): JSX.Element {
  const [id, setId] = React.useState<string | undefined>();
  const [secret, setSecret] = React.useState<string | undefined>();
  const router = useRouter();

  async function handleSubmit() {
    if (!id || !secret) {
      return;
    }

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
    <>
      <p>Enter your key and secret.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <input
          type="text"
          id="client-id"
          placeholder="client id"
          onChange={(e) => setId(e.target.value)}
        />
        <input
          type="text"
          id="client-id"
          placeholder="client secret"
          onChange={(e) => setSecret(e.target.value)}
        />

        <button>Save</button>
      </form>
    </>
  );
}
