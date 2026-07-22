import {
  Alert,
  Box,
  Button,
  CircularProgress,
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
import React from "react";
import useSWR from "swr";

import { ErrorRes, GetRes, isErrorRes } from "../../lib/api";
import { IdentityAdminRecord } from "../../lib/resources/identity-admin/identity-admin.hooks";

type Section = "directory" | "applications" | "access" | "webhooks" | "oauth";

const sections: readonly Section[] = [
  "directory",
  "applications",
  "access",
  "webhooks",
  "oauth",
];

function attrs(record: IdentityAdminRecord): Record<string, unknown> {
  return record.attributes;
}

function display(value: unknown): string {
  if (value == null || value === "") return "—";
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function ErrorState({
  value,
}: {
  readonly value: unknown;
}): JSX.Element | null {
  return value && isErrorRes(value as ErrorRes) ? (
    <Alert severity="error">{(value as ErrorRes).message}</Alert>
  ) : null;
}

function PagedList({
  empty,
  label,
  onNext,
  records,
  renderRow,
}: {
  readonly empty: string;
  readonly label: string;
  readonly onNext: () => void;
  readonly records: GetRes<IdentityAdminRecord> | ErrorRes | undefined;
  readonly renderRow: (record: IdentityAdminRecord) => JSX.Element;
}): JSX.Element | null {
  if (!records || isErrorRes(records)) return null;
  if (records.data.length === 0) {
    return <Typography color="text.secondary">{empty}</Typography>;
  }
  return (
    <>
      <Table aria-label={label}>
        <TableBody>{records.data.map(renderRow)}</TableBody>
      </Table>
      {records.cursors.next ? (
        <Button onClick={onNext}>Next page</Button>
      ) : null}
    </>
  );
}

export function IdentityAdminPage(): JSX.Element {
  const [section, setSection] = React.useState<Section>("directory");
  const [idpId, setIdpId] = React.useState("");
  const [usersCursor, setUsersCursor] = React.useState<string>();
  const [applicationsCursor, setApplicationsCursor] = React.useState<string>();
  const [grantsCursor, setGrantsCursor] = React.useState<string>();
  const [webhooksCursor, setWebhooksCursor] = React.useState<string>();
  const [selectedUser, setSelectedUser] = React.useState<string>();
  const [accountInput, setAccountInput] = React.useState("");
  const [accountId, setAccountId] = React.useState<string>();

  const users = useSWR<GetRes<IdentityAdminRecord> | ErrorRes>(
    section === "directory"
      ? `/api/identity-admin/users?pageSize=25${
          idpId.trim() ? `&filterIdpId=${encodeURIComponent(idpId.trim())}` : ""
        }${usersCursor ? `&cursor=${encodeURIComponent(usersCursor)}` : ""}`
      : null
  );
  const groups = useSWR<GetRes<IdentityAdminRecord> | ErrorRes>(
    selectedUser
      ? `/api/identity-admin/users/${encodeURIComponent(
          selectedUser
        )}/groups?pageSize=25`
      : null
  );
  const applications = useSWR<GetRes<IdentityAdminRecord> | ErrorRes>(
    section === "applications"
      ? `/api/identity-admin/applications?pageSize=25${
          applicationsCursor
            ? `&cursor=${encodeURIComponent(applicationsCursor)}`
            : ""
        }`
      : null
  );
  const grants = useSWR<GetRes<IdentityAdminRecord> | ErrorRes>(
    section === "access"
      ? `/api/identity-admin/permission-grants?pageSize=25${
          grantsCursor ? `&cursor=${encodeURIComponent(grantsCursor)}` : ""
        }`
      : null
  );
  const account = useSWR<(IdentityAdminRecord & { status: number }) | ErrorRes>(
    accountId
      ? `/api/identity-admin/accounts/${encodeURIComponent(accountId)}`
      : null
  );
  const webhooks = useSWR<GetRes<IdentityAdminRecord> | ErrorRes>(
    section === "webhooks"
      ? `/api/identity-admin/webhook-subscriptions?pageSize=25${
          webhooksCursor ? `&cursor=${encodeURIComponent(webhooksCursor)}` : ""
        }`
      : null
  );

  function chooseSection(next: Section): void {
    if (sections.includes(next)) setSection(next);
  }

  return (
    <Box sx={{ mx: "auto", maxWidth: 1200, p: 3 }}>
      <Typography component="h1" variant="h5">
        Identity &amp; Administration
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }} variant="body2">
        Read-only developer workspace for directory, access, application, and
        integration inspection. Mutations and secret-bearing operations stay
        disabled pending dedicated security review.
      </Typography>
      <Paper>
        <Tabs
          aria-label="Identity and administration sections"
          onChange={(_, next: Section) => chooseSection(next)}
          value={section}
          variant="scrollable"
        >
          <Tab label="Directory" value="directory" />
          <Tab label="Applications" value="applications" />
          <Tab label="Access" value="access" />
          <Tab label="Webhooks" value="webhooks" />
          <Tab label="OAuth2" value="oauth" />
        </Tabs>
        <Box sx={{ p: 3 }}>
          {section === "directory" && (
            <section aria-label="User directory">
              <Typography component="h2" variant="h6">
                User directory
              </Typography>
              <Box sx={{ display: "flex", gap: 2, mb: 2, mt: 2 }}>
                <TextField
                  label="IDP ID filter"
                  onChange={(event) => {
                    setUsersCursor(undefined);
                    setIdpId(event.target.value);
                  }}
                  value={idpId}
                />
              </Box>
              {users.error ? (
                <Alert severity="error">{users.error.message}</Alert>
              ) : null}
              <ErrorState value={users.data} />
              {!users.data && !users.error ? (
                <CircularProgress aria-label="Loading users" size={24} />
              ) : null}
              {users.data && !isErrorRes(users.data) ? (
                <Table aria-label="Users">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>IDP ID</TableCell>
                      <TableCell>User ID</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.data.data.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{display(attrs(user).fullName)}</TableCell>
                        <TableCell>{display(attrs(user).email)}</TableCell>
                        <TableCell>{display(attrs(user).idpId)}</TableCell>
                        <TableCell>{user.id}</TableCell>
                        <TableCell>
                          <Button
                            onClick={() => setSelectedUser(user.id)}
                            size="small"
                          >
                            Group memberships
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
              {users.data &&
              !isErrorRes(users.data) &&
              users.data.cursors.next ? (
                <Button
                  onClick={() => {
                    if (users.data && !isErrorRes(users.data)) {
                      setUsersCursor(users.data.cursors.next);
                    }
                  }}
                >
                  Next page
                </Button>
              ) : null}
              {selectedUser ? (
                <Box sx={{ mt: 3 }}>
                  <Typography component="h3" variant="subtitle1">
                    Group memberships for {selectedUser}
                  </Typography>
                  <ErrorState value={groups.data} />
                  {groups.data && !isErrorRes(groups.data) ? (
                    groups.data.data.length ? (
                      groups.data.data.map((group) => (
                        <Typography key={group.id} variant="body2">
                          {display(attrs(group).name)} ({group.id})
                        </Typography>
                      ))
                    ) : (
                      <Typography color="text.secondary">
                        No group memberships found.
                      </Typography>
                    )
                  ) : null}
                </Box>
              ) : null}
              <Alert severity="info" sx={{ mt: 3 }}>
                User group detail and group mutation are deferred because the
                pinned SDK declares group detail as void.
              </Alert>
            </section>
          )}

          {section === "applications" && (
            <section aria-label="OAuth applications">
              <Typography component="h2" variant="h6">
                OAuth applications
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
                Application secrets are never returned by this workspace.
              </Typography>
              <ErrorState value={applications.data} />
              {!applications.data && !applications.error ? (
                <CircularProgress aria-label="Loading applications" size={24} />
              ) : null}
              <PagedList
                empty="No applications found."
                label="Applications"
                onNext={() =>
                  setApplicationsCursor(
                    applications.data && !isErrorRes(applications.data)
                      ? applications.data.cursors.next
                      : undefined
                  )
                }
                records={applications.data}
                renderRow={(application) => (
                  <TableRow key={application.id}>
                    <TableCell>{display(attrs(application).name)}</TableCell>
                    <TableCell>
                      {display(attrs(application).clientId)}
                    </TableCell>
                    <TableCell>{application.id}</TableCell>
                  </TableRow>
                )}
              />
            </section>
          )}

          {section === "access" && (
            <section aria-label="Access control">
              <Typography component="h2" variant="h6">
                Permission grants
              </Typography>
              <ErrorState value={grants.data} />
              <PagedList
                empty="No permission grants found."
                label="Permission grants"
                onNext={() =>
                  setGrantsCursor(
                    grants.data && !isErrorRes(grants.data)
                      ? grants.data.cursors.next
                      : undefined
                  )
                }
                records={grants.data}
                renderRow={(grant) => (
                  <TableRow key={grant.id}>
                    <TableCell>{grant.id}</TableCell>
                    <TableCell>{JSON.stringify(attrs(grant))}</TableCell>
                  </TableRow>
                )}
              />
              <Typography component="h3" sx={{ mt: 3 }} variant="subtitle1">
                Account lookup
              </Typography>
              <Box sx={{ display: "flex", gap: 2, mt: 1 }}>
                <TextField
                  label="Account ID"
                  onChange={(event) => setAccountInput(event.target.value)}
                  value={accountInput}
                />
                <Button
                  disabled={!accountInput.trim()}
                  onClick={() => setAccountId(accountInput.trim())}
                  variant="outlined"
                >
                  Load account
                </Button>
              </Box>
              <ErrorState value={account.data} />
              {account.data && !isErrorRes(account.data) ? (
                <Typography sx={{ mt: 1 }} variant="body2">
                  {display(attrs(account.data).name)} —{" "}
                  {display(attrs(account.data).status)} ({account.data.id})
                </Typography>
              ) : null}
              <Alert severity="warning" sx={{ mt: 3 }}>
                Grant and account mutations require a dedicated confirmation and
                security review.
              </Alert>
            </section>
          )}

          {section === "webhooks" && (
            <section aria-label="Webhook subscriptions">
              <Typography component="h2" variant="h6">
                Webhook subscriptions
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
                Endpoints are masked and signing secrets are redacted. This page
                never contacts subscriber URLs.
              </Typography>
              <ErrorState value={webhooks.data} />
              <PagedList
                empty="No webhook subscriptions found."
                label="Webhook subscriptions"
                onNext={() =>
                  setWebhooksCursor(
                    webhooks.data && !isErrorRes(webhooks.data)
                      ? webhooks.data.cursors.next
                      : undefined
                  )
                }
                records={webhooks.data}
                renderRow={(webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell>{display(attrs(webhook).url)}</TableCell>
                    <TableCell>{display(attrs(webhook).status)}</TableCell>
                    <TableCell>{display(attrs(webhook).topics)}</TableCell>
                    <TableCell>{webhook.id}</TableCell>
                  </TableRow>
                )}
              />
              <Alert severity="warning" sx={{ mt: 3 }}>
                Webhook changes, deletion, and creation are deferred until
                endpoint validation and one-shot-secret review are complete.
              </Alert>
            </section>
          )}

          {section === "oauth" && (
            <section aria-label="OAuth2 safety boundary">
              <Typography component="h2" variant="h6">
                OAuth2 diagnostics
              </Typography>
              <Alert severity="info" sx={{ mt: 2 }}>
                Token minting, revocation, consent, and login acceptance are
                intentionally not browser features. They consume or return
                credentials/challenges and require an approved server-only audit
                flow.
              </Alert>
            </section>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
