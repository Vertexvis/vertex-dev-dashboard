import { Add } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TablePagination,
  TableRow,
  TextField,
} from "@mui/material";
import debounce from "lodash.debounce";
import React from "react";
import useSWR, { SWRResponse } from "swr";

import { isErrorRes } from "../../lib/api";
import { toLocaleString } from "../../lib/dates";
import { buildQuery, SwrProps, useCursorPagingState } from "../../lib/paging";
import {
  DeletePropertyKeyPoliciesRes,
  PartialDeletePropertyKeyPoliciesRes,
  PropertyKeyPolicy,
  toPropertyKeyPolicyPage,
} from "../../lib/property-key-policies";
import { formatCursorPaginationLabel } from "../shared/cursor-pagination";
import { DataLoadError } from "../shared/DataLoadError";
import { DefaultPageSize, DefaultRowHeight } from "../shared/Layout";
import { ResourceLink } from "../shared/ResourceLink";
import { SkeletonBody } from "../shared/SkeletonBody";
import { HeadCell, TableHead } from "../shared/TableHead";
import { TableToolbar } from "../shared/TableToolbar";
import CreatePropertyKeyPolicyDialog from "./CreatePropertyKeyPolicyDialog";
import { PropertyKeyPolicyModeChip } from "./PropertyKeyPolicyModeChip";

export const headCells: readonly HeadCell[] = [
  { id: "name", disablePadding: true, label: "Name" },
  { id: "id", label: "ID" },
  { id: "supplied-id", label: "Supplied ID" },
  { id: "mode", label: "Mode" },
  { id: "created", label: "Created At" },
];

type UsePropertyKeyPoliciesProps = SwrProps;

function usePropertyKeyPolicies({
  cursor,
  pageSize,
  suppliedId,
}: UsePropertyKeyPoliciesProps): SWRResponse {
  return useSWR(
    buildQuery("/api/property-key-policies", {
      cursor,
      pageSize,
      suppliedId,
    })
  );
}

interface Props {
  readonly activePropertyKeyPolicyId?: string;
  readonly onPoliciesDeleted?: (ids: string[]) => void;
  readonly onPropertyKeyPolicySelected?: (
    propertyKeyPolicy: PropertyKeyPolicy
  ) => void;
}

export default function PropertyKeyPolicyTable({
  activePropertyKeyPolicyId,
  onPoliciesDeleted,
  onPropertyKeyPolicySelected,
}: Props): JSX.Element {
  const pageSize = DefaultPageSize;
  const {
    currentPage,
    cursor,
    cursors,
    handlePageChange,
    resetPaging,
    setCursors,
  } = useCursorPagingState();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [suppliedId, setSuppliedId] = React.useState<string | undefined>();
  const [deleteError, setDeleteError] = React.useState<string>();
  const [deleting, setDeleting] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data, error, mutate } = usePropertyKeyPolicies({
    cursor,
    pageSize,
    suppliedId,
  });
  const loadFailed = error != null || isErrorRes(data);
  const page =
    data != null && !isErrorRes(data)
      ? toPropertyKeyPolicyPage(data)
      : undefined;
  const pageLength = page ? page.items.length : 0;
  const emptyRows =
    cursors?.next == null && cursors?.self == null ? 0 : pageSize - pageLength;

  const debouncedSetSuppliedIdFilter = React.useMemo(
    () =>
      debounce((value: string) => {
        resetPaging();
        setSuppliedId(value === "" ? undefined : value);
        setSelected(new Set());
      }, 300),
    [resetPaging]
  );

  React.useEffect(() => {
    if (page == null) return;

    setCursors(page.cursors ?? undefined);
  }, [page, setCursors]);

  function handleSelectAll(e: React.ChangeEvent<HTMLInputElement>): void {
    if (page == null) return;

    const upd = new Set<string>();
    if (e.target.checked) page.items.forEach((n) => upd.add(n.id));
    setSelected(upd);
  }

  function handleCheck(id: string): void {
    const upd = new Set(selected);
    if (selected.has(id)) upd.delete(id);
    else upd.add(id);

    setSelected(upd);
  }

  function handleChangePage(
    _: React.MouseEvent<HTMLButtonElement> | null,
    num: number
  ): void {
    handlePageChange(num);
    setSelected(new Set());
  }

  async function handleDelete(): Promise<void> {
    if (deleting) return;

    setDeleteError(undefined);
    setDeleting(true);
    const ids = [...selected];

    const res = await fetch("/api/property-key-policies", {
      body: JSON.stringify({ ids }),
      method: "DELETE",
    }).catch(() => undefined);
    if (res == null) {
      setDeleting(false);
      setDeleteError("Could not delete the selected property key policies.");
      return;
    }

    const body:
      | DeletePropertyKeyPoliciesRes
      | { message?: string }
      | undefined = await res.json().catch(() => undefined);

    if (!res.ok || isPartialDelete(body)) {
      const deletedIds = isPartialDelete(body) ? body.deletedIds : [];
      const failedIds = isPartialDelete(body) ? body.failedIds : [];
      try {
        onPoliciesDeleted?.(deletedIds);
      } finally {
        setDeleting(false);
        setSelected(new Set(failedIds));
        setDeleteError(
          (isErrorRes(body) ? body.message : undefined) ??
            "Could not delete the selected property key policies."
        );
        mutate();
      }
      return;
    }

    setDeleting(false);
    setSelected(new Set());
    mutate();
    onPoliciesDeleted?.(ids);
  }

  function handleCreated(): void {
    resetPaging();
    mutate();
  }

  const tableRows = loadFailed ? (
    <DataLoadError colSpan={headCells.length + 1} />
  ) : !page ? (
    <SkeletonBody
      includeCheckbox={true}
      numCellsPerRow={headCells.length}
      numRows={pageSize - pageLength}
      rowHeight={DefaultRowHeight}
    />
  ) : (
    page.items.map((row) => {
      const isSel = selected.has(row.id);
      const isActive = activePropertyKeyPolicyId === row.id;

      return (
        <TableRow
          hover
          role="checkbox"
          tabIndex={-1}
          key={row.id}
          selected={isSel || isActive}
          onClick={() => onPropertyKeyPolicySelected?.(row)}
        >
          <TableCell
            padding="checkbox"
            style={{ cursor: "default" }}
            onClick={(e) => {
              e.stopPropagation();
              handleCheck(row.id);
            }}
          >
            <Checkbox
              color="primary"
              checked={isSel}
              inputProps={{
                "aria-label": `Select ${row.name ?? row.id}`,
              }}
            />
          </TableCell>
          <TableCell component="th" scope="row" padding="none">
            <ResourceLink
              href={`/property-key-policies/${encodeURIComponent(row.id)}`}
              primaryActionLabel={`Open ${row.name ?? row.id}`}
            >
              {row.name ?? row.id}
            </ResourceLink>
          </TableCell>
          <TableCell>{row.id}</TableCell>
          <TableCell>{row.suppliedId}</TableCell>
          <TableCell>
            <PropertyKeyPolicyModeChip mode={row.mode} />
          </TableCell>
          <TableCell>{toLocaleString(row.createdAt)}</TableCell>
        </TableRow>
      );
    })
  );

  return (
    <>
      <Paper sx={{ m: 2 }}>
        <TableToolbar
          customActions={
            selected.size === 0 ? (
              <Button
                onClick={() => setCreateOpen(true)}
                startIcon={<Add />}
                variant="contained"
              >
                Create Policy
              </Button>
            ) : undefined
          }
          numSelected={selected.size}
          onDelete={handleDelete}
          title="Property Key Policies"
        />
        <Box
          sx={{
            px: { sm: 2 },
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", flex: 1 }}>
            <TextField
              variant="standard"
              size="small"
              margin="normal"
              id="suppliedIdFilter"
              label="Supplied ID"
              type="text"
              onChange={(e) => {
                debouncedSetSuppliedIdFilter(e.target.value?.trim() ?? "");
              }}
              sx={{ mt: 0, width: "16rem" }}
            />
          </Box>
        </Box>
        <TableContainer>
          <Table>
            <TableHead
              headCells={headCells}
              numSelected={selected.size}
              onSelectAllClick={handleSelectAll}
              rowCount={pageLength}
            />
            <TableBody>
              {tableRows}
              {page?.items.length === 0 && (
                <TableRow style={{ height: DefaultRowHeight }}>
                  <TableCell colSpan={headCells.length + 1}>
                    No property key policies found.
                  </TableCell>
                </TableRow>
              )}
              {emptyRows > 0 && (
                <TableRow style={{ height: DefaultRowHeight * emptyRows }}>
                  <TableCell colSpan={headCells.length + 1} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[]}
          component="div"
          count={-1}
          labelDisplayedRows={(displayedRows) =>
            formatCursorPaginationLabel(
              displayedRows,
              cursors?.next != null,
              pageLength,
              page != null
            )
          }
          rowsPerPage={pageSize}
          page={currentPage}
          onPageChange={handleChangePage}
          slotProps={{
            actions: {
              nextButton: { disabled: cursors?.next == null },
            },
          }}
        />
      </Paper>
      <CreatePropertyKeyPolicyDialog
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
        open={createOpen}
      />
      <Snackbar
        open={deleteError != null}
        autoHideDuration={6000}
        onClose={() => setDeleteError(undefined)}
      >
        <Alert onClose={() => setDeleteError(undefined)} severity="error">
          {deleteError}
        </Alert>
      </Snackbar>
    </>
  );
}

function isPartialDelete(
  body: DeletePropertyKeyPoliciesRes | { message?: string } | undefined
): body is PartialDeletePropertyKeyPoliciesRes {
  const partial = body as Partial<PartialDeletePropertyKeyPoliciesRes>;

  return (
    body != null &&
    "failedIds" in body &&
    "deletedIds" in body &&
    Array.isArray(partial.failedIds) &&
    Array.isArray(partial.deletedIds) &&
    typeof partial.message === "string"
  );
}
