import {
  Box,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TablePagination,
  TableRow,
  TextField,
} from "@mui/material";
import { Cursors, SceneData } from "@vertexvis/api-client-node";
import debounce from "lodash.debounce";
import React from "react";
import useSWR from "swr";

import { ErrorRes, GetRes } from "../../lib/api";
import { toLocaleString } from "../../lib/dates";
import { SwrProps } from "../../lib/paging";
import { Scene, toScenePage } from "../../lib/scenes";
import { formatCursorPaginationLabel } from "../shared/cursor-pagination";
import { DataLoadError } from "../shared/DataLoadError";
import { DefaultPageSize, DefaultRowHeight } from "../shared/Layout";
import { ResourceLink } from "../shared/ResourceLink";
import { SkeletonBody } from "../shared/SkeletonBody";
import { HeadCell, TableHead } from "../shared/TableHead";
import { TableToolbar } from "../shared/TableToolbar";

const headCells: readonly HeadCell[] = [
  { id: "name", disablePadding: true, label: "Name" },
  { id: "supplied-id", label: "Supplied ID" },
  { id: "state", label: "State" },
  { id: "id", label: "ID" },
  { id: "created", label: "Created" },
];

interface Props {
  readonly onClick: (scene: Scene) => void;
  readonly scene?: Scene;
}

function useScenes({ cursor, pageSize, suppliedId, name }: SwrProps) {
  return useSWR<GetRes<SceneData>, ErrorRes>(
    `/api/scenes?pageSize=${pageSize}${cursor ? `&cursor=${cursor}` : ""}${
      suppliedId ? `&suppliedId=${encodeURIComponent(suppliedId)}` : ""
    }${name ? `&name=${encodeURIComponent(name)}` : ""}`
  );
}

function stateColor(
  state?: string
): "default" | "success" | "warning" | "error" {
  switch (state) {
    case "commit":
    case "committed":
    case "ready":
      return "success";
    case "draft":
      return "warning";
    case "error":
    case "failed":
      return "error";
    default:
      return "default";
  }
}

/**
 * Read-only alternate scene entry point. The established SceneTable remains
 * the owner of the primary Scene/Viewer and mutation workflow.
 */
export function ScenePreviewTable({ onClick, scene }: Props): JSX.Element {
  const pageSize = DefaultPageSize;
  const [curPage, setCurPage] = React.useState(0);
  const [cursor, setCursor] = React.useState<string>();
  const [cursors, setCursors] = React.useState<Cursors>();
  const [prev, setPrev] = React.useState<Record<number, string | undefined>>(
    {}
  );
  const [suppliedId, setSuppliedId] = React.useState<string>();
  const [name, setName] = React.useState<string>();
  const { data, error } = useScenes({ cursor, name, pageSize, suppliedId });
  const page = data ? toScenePage(data) : undefined;
  const pageLength = page?.items.length ?? 0;
  const emptyRows =
    cursors?.next == null && cursors?.self == null ? 0 : pageSize - pageLength;

  const setNameFilter = React.useMemo(() => debounce(setName, 300), []);
  const setSuppliedIdFilter = React.useMemo(
    () => debounce(setSuppliedId, 300),
    []
  );

  React.useEffect(() => {
    if (page != null) setCursors(page.cursors ?? undefined);
  }, [page]);

  React.useEffect(() => {
    return () => {
      setNameFilter.cancel();
      setSuppliedIdFilter.cancel();
    };
  }, [setNameFilter, setSuppliedIdFilter]);

  function handleChangePage(
    _: React.MouseEvent<HTMLButtonElement> | null,
    nextPage: number
  ) {
    if (curPage < nextPage) {
      setPrev({ ...prev, [nextPage - 1]: cursors?.self });
      setCursor(cursors?.next);
    }
    if (curPage > nextPage) setCursor(prev[nextPage]);
    setCurPage(nextPage);
  }

  return (
    <Paper sx={{ m: 2 }}>
      <TableToolbar numSelected={0} title="Scenes (Preview)" />
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          gap: "1rem",
          justifyContent: "flex-start",
          px: { sm: 2 },
        }}
      >
        <TextField
          id="scenePreviewNameFilter"
          label="Name Filter"
          margin="normal"
          onChange={(event) => setNameFilter(event.target.value.trim())}
          size="small"
          sx={{ mt: 0, width: "20rem" }}
          type="text"
          variant="standard"
        />
        <TextField
          id="scenePreviewSuppliedIdFilter"
          label="Supplied ID Filter"
          margin="normal"
          onChange={(event) => setSuppliedIdFilter(event.target.value.trim())}
          size="small"
          sx={{ mt: 0, width: "20rem" }}
          type="text"
          variant="standard"
        />
      </Box>
      <TableContainer>
        <Table>
          <TableHead
            headCells={headCells}
            numSelected={0}
            onSelectAllClick={() => undefined}
            rowCount={pageLength}
          />
          <TableBody>
            {error ? (
              <DataLoadError colSpan={headCells.length + 1} />
            ) : !page ? (
              <SkeletonBody
                includeCheckbox={false}
                numCellsPerRow={headCells.length}
                numRows={pageSize - pageLength}
                rowHeight={DefaultRowHeight}
              />
            ) : (
              page.items.map((row) => (
                <TableRow
                  hover
                  key={row.id}
                  onClick={() => onClick(row)}
                  selected={scene?.id === row.id}
                  sx={{ cursor: "pointer" }}
                  tabIndex={-1}
                >
                  <TableCell padding="checkbox" />
                  <TableCell component="th" padding="none" scope="row">
                    <ResourceLink
                      href={`/scene-workspace/${encodeURIComponent(row.id)}`}
                      primaryActionLabel={`Open workspace for ${row.name}`}
                    >
                      {row.name}
                    </ResourceLink>
                  </TableCell>
                  <TableCell>{row.suppliedId}</TableCell>
                  <TableCell>
                    <Chip
                      color={stateColor(row.state)}
                      label={row.state ?? "N/A"}
                      size="small"
                      sx={{ fontWeight: 600, textTransform: "uppercase" }}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{toLocaleString(row.created)}</TableCell>
                </TableRow>
              ))
            )}
            {emptyRows > 0 && (
              <TableRow sx={{ height: DefaultRowHeight * emptyRows }}>
                <TableCell colSpan={headCells.length + 1} />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
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
        onPageChange={handleChangePage}
        page={curPage}
        rowsPerPage={pageSize}
        rowsPerPageOptions={[]}
        slotProps={{
          actions: { nextButton: { disabled: cursors?.next == null } },
        }}
      />
    </Paper>
  );
}
