import {
  Alert,
  Box,
  Button,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TablePagination,
  TableRow,
  TextField,
} from "@material-ui/core";
import { Add } from "@material-ui/icons";
import { Cursors } from "@vertexvis/api-client-node";
import debounce from "lodash.debounce";
import { useRouter } from "next/router";
import React from "react";
import useSWR from "swr";

import { fetcher } from "../../lib/api";
import { dateDiffInDays } from "../../lib/dates";
import { SwrProps } from "../../lib/paging";
import { toPartPage } from "../../lib/parts";
import { DataLoadError } from "../shared/DataLoadError";
import { DefaultPageSize, DefaultRowHeight } from "../shared/Layout";
import { SkeletonBody } from "../shared/SkeletonBody";
import { HeadCell, TableHead } from "../shared/TableHead";
import { TableToolbar } from "../shared/TableToolbar";
import CreatePartDialog from "./CreatePartDialog";
import CreateSceneDialog from "./CreateSceneDialog";
import PartRow from "./PartRow";
import { QueuedTranslationsTable } from "./QueuedTranslationsTable";

const headCells: readonly HeadCell[] = [
  { id: "expand", label: "", beforeCheckbox: true },
  { id: "name", label: "Name" },
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

export default function PartTable(): JSX.Element {
  const router = useRouter();
  const pageSize = DefaultPageSize;
  const [curPage, setCurPage] = React.useState(0);
  const [cursor, setCursor] = React.useState<string | undefined>();
  const [cursors, setCursors] = React.useState<Cursors | undefined>();
  const [toastMsg, setToastMsg] = React.useState<string | undefined>();
  const [prev, setPrev] = React.useState<Record<number, string | undefined>>(
    {}
  );
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [showCreatePartDialog, setShowCreatePartDialog] = React.useState(
    !!router.query.create
  );
  const [targetRevisionId, setTargetRevisionId] = React.useState<
    string | undefined
  >();

  const [suppliedId, setSuppliedIdFilter] = React.useState<
    string | undefined
  >();

  const { data, error } = useParts({ cursor, pageSize, suppliedId });
  const page = data ? toPartPage(data) : undefined;
  const pageLength = page ? page.items.length : 0;
  const emptyRows =
    cursors?.next == null && cursors?.self == null ? 0 : pageSize - pageLength;

  const debouncedSetSuppliedIdFilter = React.useMemo(
    () => debounce(setSuppliedIdFilter, 300),
    []
  );

  React.useEffect(() => {
    if (page == null) return;

    setCursors(page.cursors ?? undefined);
  }, [page]);

  function handleSelectAll(e: React.ChangeEvent<HTMLInputElement>) {
    if (page == null) return;

    const upd = new Set<string>();
    if (e.target.checked) page.items.map((n) => upd.add(n.id));
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
    if (curPage < num) {
      setPrev({ ...prev, [num - 1]: cursors?.self });
      setCursor(cursors?.next);
    }
    if (curPage > num) setCursor(prev[num]);
    setCurPage(num);
  }

  async function handleDelete() {
    setSelected(new Set());
    await fetch("/api/parts", {
      body: JSON.stringify({ ids: [...selected] }),
      method: "DELETE",
    });
  }

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
          numSelected={selected.size}
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
            onClick={() => setShowCreatePartDialog(true)}
          >
            New
          </Button>
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
              {error ? (
                <DataLoadError colSpan={headCells.length + 1} />
              ) : !page ? (
                <SkeletonBody
                  includeCheckbox={true}
                  numCellsPerRow={6}
                  numRows={pageSize - pageLength}
                  rowHeight={DefaultRowHeight}
                />
              ) : (
                page.items.map((row) => {
                  return (
                    <PartRow
                      key={row.id}
                      isSelected={selected.has(row.id)}
                      onSelected={handleCheck}
                      part={row}
                      onCreteSceneFromRevision={setTargetRevisionId}
                    />
                  );
                })
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
          page={curPage}
          onPageChange={handleChangePage}
          nextIconButtonProps={{ disabled: cursors?.next == null }}
        />
      </Paper>
      <CreatePartDialog
        open={showCreatePartDialog}
        onClose={() => setShowCreatePartDialog(false)}
        onPartCreated={(id) => {
          setToastMsg(`Translation initiated. Job ID: ${id}`);          
          setShowCreatePartDialog(false);
        }}
        targetFileId={maybeQueryParam(router.query.create)}
        targetFileName={maybeQueryParam(router.query.n)}
      />

      <CreateSceneDialog
        open={!!targetRevisionId}
        onClose={() => setTargetRevisionId(undefined)}
        onSceneQueued={(id) => {
          setToastMsg(`Scene created. Root item job ID: ${id}`);
          setTargetRevisionId(undefined);
        }}
        targetRevisionId={targetRevisionId}
      />
      <Snackbar
        open={!!toastMsg}
        autoHideDuration={6000}
        onClose={() => setToastMsg(undefined)}
      >
        <Alert onClose={() => setToastMsg(undefined)} severity="success">
          {toastMsg}
        </Alert>
      </Snackbar>
    </>
  );
}
