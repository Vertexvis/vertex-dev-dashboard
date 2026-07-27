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
import useSWR from "swr";

import { isErrorRes } from "../../lib/api";
import { toLocaleString } from "../../lib/dates";
import { buildQuery, SwrProps, useCursorPagingState } from "../../lib/paging";
import {
  PropertyKeyPolicy,
  toPropertyKeyPolicyPage,
} from "../../lib/property-key-policies";
import { SortState, toggleSort, toSortParam } from "../../lib/sorting";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import {
  CreatedAtDateRange,
  CreatedAtDateRangeFilter,
} from "../shared/CreatedAtDateRangeFilter";
import { formatCursorPaginationLabel } from "../shared/cursor-pagination";
import { DataLoadError } from "../shared/DataLoadError";
import { DefaultPageSize, DefaultRowHeight } from "../shared/Layout";
import { ResourceLink } from "../shared/ResourceLink";
import { SkeletonBody } from "../shared/SkeletonBody";
import { HeadCell, TableHead } from "../shared/TableHead";
import { TableToolbar } from "../shared/TableToolbar";
import CreatePropertyKeyPolicyDialog from "./CreatePropertyKeyPolicyDialog";
import { toModeLabel } from "./mode";

export const headCells: readonly HeadCell[] = [
  { id: "name", disablePadding: true, label: "Name", sortable: true },
  { id: "id", label: "ID" },
  { id: "supplied-id", label: "Supplied ID" },
  { id: "mode", label: "Mode" },
  { id: "created", label: "Created At", sortable: true },
];

interface UsePropertyKeyPoliciesProps extends SwrProps {
  readonly createdAtEnd?: string;
  readonly createdAtStart?: string;
  readonly sort?: SortState<PropertyKeyPolicySortField>;
}

type PropertyKeyPolicySortField = "created" | "name";

function usePropertyKeyPolicies({
  createdAtEnd,
  createdAtStart,
  cursor,
  name,
  pageSize,
  sort,
  suppliedId,
}: UsePropertyKeyPoliciesProps) {
  return useSWR(
    buildQuery("/api/property-key-policies", {
      createdAtEnd,
      createdAtStart,
      cursor,
      name,
      pageSize,
      sort: sort != null ? toSortParam(sort) : undefined,
      suppliedId,
    })
  );
}

interface Props {
  readonly activePropertyKeyPolicyId?: string;
  readonly onPropertyKeyPolicySelected?: (
    propertyKeyPolicy: PropertyKeyPolicy
  ) => void;
}

export default function PropertyKeyPolicyTable({
  activePropertyKeyPolicyId,
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
  const [name, setName] = React.useState<string | undefined>();
  const [sort, setSort] = React.useState<
    SortState<PropertyKeyPolicySortField> | undefined
  >();
  const [suppliedId, setSuppliedId] = React.useState<string | undefined>();
  const [createdAtFilters, setCreatedAtFilters] =
    React.useState<CreatedAtDateRange>({});
  const [deleteError, setDeleteError] = React.useState<string>();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data, error, mutate } = usePropertyKeyPolicies({
    createdAtEnd: createdAtFilters.createdAtEnd,
    createdAtStart: createdAtFilters.createdAtStart,
    cursor,
    name,
    pageSize,
    sort,
    suppliedId,
  });
  const page = data ? toPropertyKeyPolicyPage(data) : undefined;
  const pageLength = page ? page.items.length : 0;
  const emptyRows =
    cursors?.next == null && cursors?.self == null ? 0 : pageSize - pageLength;

  const debouncedSetNameFilter = React.useMemo(
    () =>
      debounce((value: string) => {
        resetPaging();
        setName(value === "" ? undefined : value);
      }, 300),
    [resetPaging]
  );

  const debouncedSetSuppliedIdFilter = React.useMemo(
    () =>
      debounce((value: string) => {
        resetPaging();
        setSuppliedId(value === "" ? undefined : value);
      }, 300),
    [resetPaging]
  );

  React.useEffect(() => {
    if (page == null) return;

    setCursors(page.cursors ?? undefined);
  }, [page, setCursors]);

  function handleCreatedAtChange(filters: CreatedAtDateRange) {
    resetPaging();
    setCreatedAtFilters(filters);
  }

  function handleSortChange(field: string) {
    if (field !== "created" && field !== "name") return;

    setSort((current) =>
      current == null ? { field, order: "asc" } : toggleSort(current, field)
    );
    resetPaging();
  }

  function handleSelectAll(e: React.ChangeEvent<HTMLInputElement>) {
    if (page == null) return;

    const upd = new Set<string>();
    if (e.target.checked) page.items.forEach((n) => upd.add(n.id));
    setSelected(upd);
  }

  function handleCheck(id: string) {
    const upd = new Set(selected);
    if (selected.has(id)) upd.delete(id);
    else upd.add(id);

    setSelected(upd);
  }

  function handleChangePage(
    _: React.MouseEvent<HTMLButtonElement> | null,
    num: number
  ) {
    handlePageChange(num);
  }

  async function handleConfirmDelete() {
    setDeleteError(undefined);
    setDeleting(true);
    const ids = [...selected];

    let res: Response;
    try {
      res = await fetch("/api/property-key-policies", {
        body: JSON.stringify({ ids }),
        method: "DELETE",
      });
    } catch {
      setDeleting(false);
      setDeleteError("Could not delete the selected property key policies.");
      return;
    }

    if (!res.ok) {
      const body = await res.json();
      setDeleting(false);
      setDeleteError(
        (isErrorRes(body) ? body.message : undefined) ??
          "Could not delete the selected property key policies."
      );
      return;
    }

    setDeleting(false);
    setConfirmOpen(false);
    setSelected(new Set());
    mutate();
  }

  function handleCreated() {
    resetPaging();
    mutate();
  }

  let tableRows: React.ReactNode;
  if (error) {
    tableRows = <DataLoadError colSpan={headCells.length + 1} />;
  } else if (!page) {
    tableRows = (
      <SkeletonBody
        includeCheckbox={true}
        numCellsPerRow={headCells.length}
        numRows={pageSize - pageLength}
        rowHeight={DefaultRowHeight}
      />
    );
  } else {
    tableRows = page.items.map((row) => {
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
          <TableCell>{toModeLabel(row.mode)}</TableCell>
          <TableCell>{toLocaleString(row.createdAt)}</TableCell>
        </TableRow>
      );
    });
  }

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
          onDelete={() => {
            setDeleteError(undefined);
            setConfirmOpen(true);
          }}
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
              id="nameFilter"
              label="Name"
              type="text"
              onChange={(e) => {
                debouncedSetNameFilter(e.target.value?.trim() ?? "");
              }}
              sx={{ mt: 0, width: "16rem" }}
            />
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
        <CreatedAtDateRangeFilter onChange={handleCreatedAtChange} />
        <TableContainer>
          <Table>
            <TableHead
              headCells={headCells}
              numSelected={selected.size}
              onSelectAllClick={handleSelectAll}
              onSortChange={handleSortChange}
              rowCount={pageLength}
              sort={sort}
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
      <ConfirmDialog
        confirmLabel="Delete"
        confirming={deleting}
        message={`Delete ${selected.size} selected property key ${
          selected.size === 1 ? "policy" : "policies"
        }? This cannot be undone.`}
        onClose={() => {
          if (deleting) return;
          setConfirmOpen(false);
        }}
        onConfirm={handleConfirmDelete}
        open={confirmOpen}
        title="Delete Property Key Policies"
      />
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
