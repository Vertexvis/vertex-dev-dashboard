import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TablePagination,
  TableRow,
  TextField,
} from "@material-ui/core";
import { Add } from "@material-ui/icons";
import debounce from "lodash.debounce";
import { useRouter } from "next/router";
import React from "react";
import useSWR from "swr";

import { fetcher } from "../../lib/api";
import { dateDiffInDays } from "../../lib/dates";
import { SwrProps } from "../../lib/paging";
import { toPartPage } from "../../lib/parts";
import { DataLoadError } from "../shared/DataLoadError";
import { DefaultPageSize } from "../shared/Layout";
import { SkeletonBody } from "../shared/SkeletonBody";
import { HeadCell, TableHead } from "../shared/TableHead";
import { TableToolbar } from "../shared/TableToolbar";
import CreatePartDialog from "./CreatePartDialog";
import PartRow from "./PartRow";
import { QueuedTranslationsTable } from "./QueuedTranslationsTable";

const headCells: readonly HeadCell[] = [
  { id: "expand", disablePadding: true, label: "" },
  { id: "name", disablePadding: true, label: "Name" },
  { id: "supplied-id", label: "Supplied ID" },
  { id: "id", label: "ID" },
  { id: "created", label: "Created" },
];

function useParts({ cursor, pageSize, suppliedId }: SwrProps) {
  return useSWR(
    `/api/parts?pageSize=${pageSize}${cursor ? `&cursor=${cursor}` : ""}${
      suppliedId ? `&suppliedId=${suppliedId}` : ""
    }`,
    fetcher,
    { refreshInterval: 30000 }
  );
}

const maybeQueryParam = (
  target: string | string[] | undefined
): string | undefined => (Array.isArray(target) ? target[0] : target);

export function PartTable(): JSX.Element {
  const pageSize = DefaultPageSize;
  const rowHeight = 53;
  const [selected, setSelected] = React.useState<readonly string[]>([]);
  const [curPage, setCurPage] = React.useState(0);
  const [suppliedId, setSuppliedIdFilter] = React.useState<
    string | undefined
  >();
  const [privateCursor, setPrivateCursor] = React.useState<
    string | undefined
  >();
  const [cursor, setCursor] = React.useState<string | undefined>();
  const router = useRouter();

  const [showDialog, setShowDialog] = React.useState(!!router.query.create);

  const { data, error } = useParts({ cursor, pageSize, suppliedId });

  const page = data ? toPartPage(data) : undefined;
  const pageLength = page ? page.items.length : 0;
  const emptyRows = privateCursor ? 0 : pageSize - pageLength;

  const debouncedSetSuppliedIdFilter = React.useMemo(
    () => debounce(setSuppliedIdFilter, 300),
    []
  );

  React.useEffect(() => {
    if (page == null) return;

    setPrivateCursor(page.cursor ?? undefined);
  }, [page]);

  function handleSelectAll(e: React.ChangeEvent<HTMLInputElement>) {
    if (page == null) return;

    setSelected(e.target.checked ? page.items.map((n) => n.id) : []);
  }

  function handleCheck(id: string) {
    const selectedIndex = selected.indexOf(id);
    let upd: readonly string[] = [];

    if (selectedIndex === -1) {
      upd = upd.concat(selected, id);
    } else if (selectedIndex === 0) {
      upd = upd.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      upd = upd.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      upd = upd.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1)
      );
    }

    setSelected(upd);
  }

  function handleChangePage(_e: unknown, n: number) {
    setCursor(privateCursor);
    setCurPage(n);
  }

  async function handleDelete() {
    await fetch("/api/parts", {
      body: JSON.stringify({ ids: selected }),
      method: "DELETE",
    });
  }

  const isSelected = (name: string) => selected.indexOf(name) !== -1;

  return (
    <>
      <Box sx={{ display: "flex" }}>
        <QueuedTranslationsTable
          title="Running Translations"
          refreshInterval={10000}
          status="running"
        />
        <QueuedTranslationsTable
          title="Recently Failed Translations"
          refreshInterval={30000}
          status="error"
          filter={(row) => dateDiffInDays(new Date(row.created)) <= 7}
        />
      </Box>
      <Paper sx={{ m: 2 }}>
        <TableToolbar
          numSelected={selected.length}
          onDelete={handleDelete}
          title="Parts"
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
            label="Supplied ID Filter"
            type="text"
            onChange={(e) => {
              debouncedSetSuppliedIdFilter(e.target.value);
            }}
            sx={{ mt: 0 }}
          />
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setShowDialog(true)}
          >
            New
          </Button>
        </Box>
        <TableContainer>
          <Table>
            <TableHead
              headCells={headCells}
              numSelected={selected.length}
              onSelectAllClick={handleSelectAll}
              rowCount={pageLength}
            />
            <TableBody>
              {error ? (
                <DataLoadError colSpan={headCells.length + 1} />
              ) : !page ? (
                <SkeletonBody
                  numCellsPerRow={6}
                  numRows={emptyRows}
                  includeCheckbox={true}
                />
              ) : (
                page.items.map((row) => {
                  return (
                    <PartRow
                      key={row.id}
                      isSelected={isSelected(row.id)}
                      onSelected={handleCheck}
                      part={row}
                    />
                  );
                })
              )}
              {emptyRows > 0 && (
                <TableRow style={{ height: rowHeight * emptyRows }}>
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
          page={curPage}
          onPageChange={handleChangePage}
          nextIconButtonProps={{ disabled: privateCursor == null }}
        />
      </Paper>
      <CreatePartDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        onPartCreated={(id) => {
          console.log("Queued translation initiated: " + id);
          setShowDialog(false);
        }}
        targetFileId={maybeQueryParam(router.query.create)}
        targetFileName={maybeQueryParam(router.query.n)}
      />
    </>
  );
}
