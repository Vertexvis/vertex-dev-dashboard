import {
  Alert,
  Box,
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
import { useRouter } from "next/router";
import React from "react";
import useSWR from "swr";

import { toLocaleString } from "../../lib/dates";
import { FileCollection, toFileCollectionPage } from "../../lib/file-collections";
import { buildQuery, SwrProps, useCursorPagingState } from "../../lib/paging";
import { DataLoadError } from "../shared/DataLoadError";
import { DefaultPageSize, DefaultRowHeight } from "../shared/Layout";
import { ResourceLink } from "../shared/ResourceLink";
import { SkeletonBody } from "../shared/SkeletonBody";
import { HeadCell, TableHead } from "../shared/TableHead";
import { TableToolbar } from "../shared/TableToolbar";

export const headCells: readonly HeadCell[] = [
  { id: "name", disablePadding: true, label: "Name" },
  { id: "id", label: "ID" },
  { id: "supplied-id", label: "Supplied ID" },
  { id: "created", label: "Created At" },
];

function useFileCollections({ cursor, pageSize, suppliedId }: SwrProps) {
  return useSWR(
    buildQuery("/api/file-collections", {
      cursor,
      pageSize,
      suppliedId,
    })
  );
}

interface Props {
  readonly activeFileCollectionId?: string;
  readonly onFileCollectionSelected?: (fileCollection: FileCollection) => void;
}

export default function FileCollectionTable({
  activeFileCollectionId,
  onFileCollectionSelected,
}: Props): JSX.Element {
  const router = useRouter();
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

  const { data, error, mutate } = useFileCollections({
    cursor,
    pageSize,
    suppliedId,
  });
  const page = data ? toFileCollectionPage(data) : undefined;
  const pageLength = page ? page.items.length : 0;
  const emptyRows =
    cursors?.next == null && cursors?.self == null ? 0 : pageSize - pageLength;

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

  async function handleDelete() {
    setDeleteError(undefined);
    const ids = [...selected];
    setSelected(new Set());

    const res = await fetch("/api/file-collections", {
      body: JSON.stringify({ ids }),
      method: "DELETE",
    });

    if (!res.ok) {
      const body = await res.json();
      setDeleteError(
        body.message ?? "Could not delete the selected file collections."
      );
      setSelected(new Set(ids));
      return;
    }

    mutate();
  }

  function handleOpenFileCollection(fileCollectionId: string) {
    router.push(`/file-collections/${encodeURIComponent(fileCollectionId)}`);
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
      const isActive = activeFileCollectionId === row.id;

      return (
        <TableRow
          hover
          role="checkbox"
          tabIndex={-1}
          key={row.id}
          selected={isSel || isActive}
          onClick={() => onFileCollectionSelected?.(row)}
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
              onPrimaryAction={() => handleOpenFileCollection(row.id)}
              primaryActionLabel={`Open ${row.name}`}
            >
              {row.name}
            </ResourceLink>
          </TableCell>
          <TableCell>{row.id}</TableCell>
          <TableCell>{row.suppliedId}</TableCell>
          <TableCell>{toLocaleString(row.created)}</TableCell>
        </TableRow>
      );
    });
  }

  return (
    <>
      <Paper sx={{ m: 2 }}>
        <TableToolbar
          numSelected={selected.size}
          onDelete={handleDelete}
          title="File Collections"
        />
        <Box
          sx={{
            px: { sm: 2 },
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <TextField
            variant="standard"
            size="small"
            margin="normal"
            id="suppliedIdFilter"
            label="Supplied ID Filter (exact)"
            type="text"
            onChange={(e) => {
              debouncedSetSuppliedIdFilter(e.target.value?.trim() ?? "");
            }}
            sx={{ mt: 0, width: "20rem" }}
          />
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
                    No file collections found.
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
