import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import {
  PropertyEntryData,
  PropertyKeyPolicyData,
  SearchSessionData,
} from "@vertexvis/api-client-node";
import { useRouter } from "next/router";
import React from "react";
import useSWR from "swr";

import { ErrorRes, GetRes, isErrorRes } from "../../lib/api";

type TabValue = "entries" | "policies" | "sessions";
const tabs = new Set<TabValue>(["entries", "policies", "sessions"]);
const propertyTargetTypes = [
  "scene-item",
  "part-revision",
  "part-instance",
  "property-set",
] as const;

function responseMessage(value: unknown): string | undefined {
  return isErrorRes(value as ErrorRes)
    ? (value as ErrorRes).message
    : undefined;
}

function DisplayError({
  value,
}: {
  readonly value: unknown;
}): JSX.Element | null {
  const message = responseMessage(value);
  return message ? <Alert severity="error">{message}</Alert> : null;
}

export function PropertiesSearchPage(): JSX.Element {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabValue>("entries");
  const [resourceId, setResourceId] = React.useState("");
  const [resourceType, setResourceType] =
    React.useState<(typeof propertyTargetTypes)[number]>("scene-item");
  const [entriesTarget, setEntriesTarget] = React.useState<{
    readonly id: string;
    readonly type: (typeof propertyTargetTypes)[number];
  }>();
  const [entriesCursor, setEntriesCursor] = React.useState<string>();
  const [policiesCursor, setPoliciesCursor] = React.useState<string>();
  const [sessionInput, setSessionInput] = React.useState("");
  const [sessionId, setSessionId] = React.useState<string>();

  const entries = useSWR<GetRes<PropertyEntryData> | ErrorRes>(
    entriesTarget
      ? `/api/property-entries?resourceId=${encodeURIComponent(
          entriesTarget.id
        )}&resourceType=${encodeURIComponent(entriesTarget.type)}&pageSize=25${
          entriesCursor ? `&cursor=${encodeURIComponent(entriesCursor)}` : ""
        }`
      : null
  );
  const policies = useSWR<GetRes<PropertyKeyPolicyData> | ErrorRes>(
    tab === "policies"
      ? `/api/property-key-policies?pageSize=25${
          policiesCursor ? `&cursor=${encodeURIComponent(policiesCursor)}` : ""
        }`
      : null
  );
  const session = useSWR<SearchSessionData | ErrorRes>(
    sessionId ? `/api/search-sessions/${encodeURIComponent(sessionId)}` : null
  );
  const sessionData =
    session.data && !isErrorRes(session.data as ErrorRes)
      ? (session.data as SearchSessionData)
      : undefined;
  const entriesPage =
    entries.data && !isErrorRes(entries.data as ErrorRes)
      ? (entries.data as GetRes<PropertyEntryData>)
      : undefined;
  const policiesPage =
    policies.data && !isErrorRes(policies.data as ErrorRes)
      ? (policies.data as GetRes<PropertyKeyPolicyData>)
      : undefined;

  React.useEffect(() => {
    const requested = router.query.tab;
    if (typeof requested === "string" && tabs.has(requested as TabValue)) {
      setTab(requested as TabValue);
    }
  }, [router.query.tab]);

  function loadEntries(): void {
    const id = resourceId.trim();
    if (id) {
      setEntriesCursor(undefined);
      setEntriesTarget({ id, type: resourceType });
    }
  }

  function changeTab(next: TabValue): void {
    setTab(next);
    void router.replace(
      {
        pathname: router.pathname,
        query: { ...router.query, tab: next },
      },
      undefined,
      { shallow: true }
    );
  }

  return (
    <Box sx={{ mx: "auto", maxWidth: 1200, p: 3 }}>
      <Typography component="h1" variant="h5">
        Properties &amp; Search
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }} variant="body2">
        Developer workbench for resource-scoped property inspection, property
        key policies, and direct search-session status. Existing Viewer metadata
        stays unchanged.
      </Typography>
      <Paper>
        <Tabs
          aria-label="Properties and Search sections"
          onChange={(_, next: TabValue) => changeTab(next)}
          value={tab}
          variant="scrollable"
        >
          <Tab label="Entries" value="entries" />
          <Tab label="Key policies" value="policies" />
          <Tab label="Search sessions" value="sessions" />
        </Tabs>
        <Box sx={{ p: 3 }}>
          {tab === "entries" && (
            <section aria-label="Property inspector">
              <Typography component="h2" variant="h6">
                Property inspector
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
                Choose one explicit target. This page never performs an
                account-wide property-entry request.
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 3 }}>
                <TextField
                  label="Resource ID"
                  onChange={(event) => setResourceId(event.target.value)}
                  value={resourceId}
                />
                <TextField
                  label="Relationship type"
                  onChange={(event) =>
                    setResourceType(
                      event.target.value as (typeof propertyTargetTypes)[number]
                    )
                  }
                  select
                  value={resourceType}
                >
                  {propertyTargetTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  disabled={!resourceId.trim()}
                  onClick={loadEntries}
                  variant="contained"
                >
                  Load entries
                </Button>
              </Box>
              {entries.error ? (
                <Alert severity="error">
                  Unable to load property entries: {entries.error.message}
                </Alert>
              ) : (
                <DisplayError value={entries.data} />
              )}
              {entriesTarget && !entries.data && !entries.error ? (
                <CircularProgress
                  aria-label="Loading property entries"
                  size={24}
                />
              ) : null}
              {entriesPage ? (
                entriesPage.data.length === 0 ? (
                  <Typography color="text.secondary">
                    No property entries found for this target.
                  </Typography>
                ) : (
                  <Table aria-label="Property entries">
                    <TableHead>
                      <TableRow>
                        <TableCell>Key</TableCell>
                        <TableCell>Value</TableCell>
                        <TableCell>Entry ID</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {entriesPage.data.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>{entry.attributes.key.name}</TableCell>
                          <TableCell>
                            {JSON.stringify(entry.attributes.value)}
                          </TableCell>
                          <TableCell>{entry.id}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              ) : null}
              {entriesPage ? (
                <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                  {entriesCursor && (
                    <Button onClick={() => setEntriesCursor(undefined)}>
                      First page
                    </Button>
                  )}
                  {entriesPage.cursors.next && (
                    <Button
                      onClick={() => setEntriesCursor(entriesPage.cursors.next)}
                    >
                      Next page
                    </Button>
                  )}
                </Box>
              ) : null}
              <Alert severity="info" sx={{ mt: 3 }}>
                Typed entry upsert/removal is deferred until a non-production
                contract verifies value and null-removal semantics.
              </Alert>
            </section>
          )}

          {tab === "policies" && (
            <section aria-label="Property key policy manager">
              <Typography component="h2" variant="h6">
                Property key policies
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
                Read existing account policies. The installed SDK cannot safely
                serialize its documented supplied-ID expression, so filtering is
                intentionally deferred.
              </Typography>
              {policies.error ? (
                <Alert severity="error">
                  Unable to load policies: {policies.error.message}
                </Alert>
              ) : (
                <DisplayError value={policies.data} />
              )}
              {!policies.data && !policies.error ? (
                <CircularProgress
                  aria-label="Loading property key policies"
                  size={24}
                />
              ) : null}
              {policiesPage ? (
                policiesPage.data.length === 0 ? (
                  <Typography color="text.secondary">
                    No property key policies found.
                  </Typography>
                ) : (
                  <Table aria-label="Property key policies">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Mode</TableCell>
                        <TableCell>Supplied ID</TableCell>
                        <TableCell>ID</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {policiesPage.data.map((policy) => (
                        <TableRow key={policy.id}>
                          <TableCell>{policy.attributes.name ?? "—"}</TableCell>
                          <TableCell>{policy.attributes.mode}</TableCell>
                          <TableCell>
                            {policy.attributes.suppliedId ?? "—"}
                          </TableCell>
                          <TableCell>{policy.id}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              ) : null}
              {policiesPage ? (
                <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                  {policiesCursor && (
                    <Button onClick={() => setPoliciesCursor(undefined)}>
                      First page
                    </Button>
                  )}
                  {policiesPage.cursors.next && (
                    <Button
                      onClick={() =>
                        setPoliciesCursor(policiesPage.cursors.next)
                      }
                    >
                      Next page
                    </Button>
                  )}
                </Box>
              ) : null}
              <Alert severity="info" sx={{ mt: 3 }}>
                Policy changes and key-entry mutations are deferred until their
                confirmation and relationship workflows are independently
                validated.
              </Alert>
            </section>
          )}

          {tab === "sessions" && (
            <section aria-label="Search session monitor">
              <Typography component="h2" variant="h6">
                Search session monitor
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
                Load a known session by ID. No query-result API is available in
                this SDK snapshot, so this view does not imply local search.
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 3 }}>
                <TextField
                  label="Search session ID"
                  onChange={(event) => setSessionInput(event.target.value)}
                  value={sessionInput}
                />
                <Button
                  disabled={!sessionInput.trim()}
                  onClick={() => setSessionId(sessionInput.trim())}
                  variant="contained"
                >
                  Load status
                </Button>
              </Box>
              {session.error ? (
                <Alert severity="error">
                  Unable to load session: {session.error.message}
                </Alert>
              ) : (
                <DisplayError value={session.data} />
              )}
              {sessionId && !session.data && !session.error ? (
                <CircularProgress
                  aria-label="Loading search session"
                  size={24}
                />
              ) : null}
              {sessionData ? (
                <Paper sx={{ p: 2 }} variant="outlined">
                  <Typography>
                    <strong>Session ID:</strong> {sessionData.id}
                  </Typography>
                  <Typography>
                    <strong>Status:</strong> {sessionData.attributes.status}
                  </Typography>
                </Paper>
              ) : null}
              <Alert severity="info" sx={{ mt: 3 }}>
                Session creation and polling are deferred pending verified
                expiry limits and terminal status semantics.
              </Alert>
            </section>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
