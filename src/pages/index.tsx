import {
  Checkbox,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead as MuiTableHead,
  TablePagination,
  TableRow,
  Toolbar,
  Tooltip,
  Typography,
} from "@material-ui/core";
import { alpha } from "@material-ui/core/styles";
import { Delete } from "@material-ui/icons";
import { GetServerSidePropsContext } from "next";
import React from "react";

import { Header } from "../components/Header";
import { Layout } from "../components/Layout";
import { LeftDrawer } from "../components/LeftDrawer";
import { Paged, Scene, toSceneData } from "../lib/scenes";
import { isErrorRes } from "./api/scenes";

interface Props {
  readonly baseUrl: string;
  readonly page: Paged<Scene>;
}

export default function Home({ baseUrl, page }: Props): JSX.Element {
  return (
    <Layout
      header={<Header />}
      leftDrawer={<LeftDrawer />}
      main={<Scenes baseUrl={baseUrl} page={page} />}
    />
  );
}

export async function getServerSideProps(
  context: GetServerSidePropsContext
): Promise<{ props: Props }> {
  const empty = { props: { baseUrl: "", page: { cursor: null, items: [] } } };
  const host = context.req.headers.host;
  if (!host) return empty;

  const baseUrl = `http${host.startsWith("localhost") ? "" : "s"}://${host}`;
  const res = await fetch(`${baseUrl}/api/scenes`);
  const json = await res.json();
  return isErrorRes(json)
    ? empty
    : { props: { baseUrl, page: toSceneData(json) } };
}

interface TableProps {
  numSelected: number;
  onSelectAllClick: (event: React.ChangeEvent<HTMLInputElement>) => void;
  rowCount: number;
}

interface HeadCell {
  disablePadding: boolean;
  id: string;
  label: string;
  numeric: boolean;
}

interface TableToolbarProps {
  numSelected: number;
  onDelete: () => void;
}

function TableHead({ onSelectAllClick, numSelected, rowCount }: TableProps) {
  const headCells: readonly HeadCell[] = [
    {
      id: "name",
      numeric: false,
      disablePadding: true,
      label: "Name",
    },
    {
      id: "supplied-id",
      numeric: false,
      disablePadding: false,
      label: "Supplied ID",
    },
    {
      id: "id",
      numeric: false,
      disablePadding: false,
      label: "ID",
    },
    {
      id: "created",
      numeric: false,
      disablePadding: false,
      label: "Created",
    },
  ];

  return (
    <MuiTableHead>
      <TableRow>
        <TableCell padding="checkbox">
          <Checkbox
            color="primary"
            indeterminate={numSelected > 0 && numSelected < rowCount}
            checked={rowCount > 0 && numSelected === rowCount}
            onChange={onSelectAllClick}
          />
        </TableCell>
        {headCells.map((headCell) => (
          <TableCell
            key={headCell.id}
            align={headCell.numeric ? "right" : "left"}
            padding={headCell.disablePadding ? "none" : "normal"}
          >
            {headCell.label}
          </TableCell>
        ))}
      </TableRow>
    </MuiTableHead>
  );
}

const TableToolbar = ({ numSelected, onDelete }: TableToolbarProps) => {
  return (
    <Toolbar
      sx={{
        pl: { sm: 2 },
        pr: { xs: 1, sm: 1 },
        ...(numSelected > 0 && {
          bgcolor: (theme) =>
            alpha(
              theme.palette.primary.main,
              theme.palette.action.activatedOpacity
            ),
        }),
      }}
    >
      {numSelected > 0 ? (
        <Typography
          sx={{ flex: "1 1 100%" }}
          color="inherit"
          variant="subtitle1"
          component="div"
        >
          {numSelected} selected
        </Typography>
      ) : (
        <Typography sx={{ flex: "1 1 100%" }} variant="h6" component="div">
          Scenes
        </Typography>
      )}
      {numSelected > 0 && (
        <Tooltip title="Delete">
          <IconButton onClick={() => onDelete()}>
            <Delete />
          </IconButton>
        </Tooltip>
      )}
    </Toolbar>
  );
};

function Scenes({ baseUrl, page }: Props): JSX.Element {
  const [selected, setSelected] = React.useState<readonly string[]>([]);
  const [curPage, setCurPage] = React.useState(0);
  const rowsPerPage = 2;

  function handleSelectAllClick(e: React.ChangeEvent<HTMLInputElement>) {
    setSelected(e.target.checked ? page.items.map((n) => n.id) : []);
  }

  function handleClick(_e: React.MouseEvent<unknown>, id: string) {
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
    setCurPage(n);
  }

  async function handleDelete() {
    await fetch(`${baseUrl}/api/scenes`, {
      body: JSON.stringify({ ids: selected }),
      method: "DELETE",
    });
  }

  const isSelected = (name: string) => selected.indexOf(name) !== -1;

  const emptyRows =
    curPage > 0
      ? Math.max(0, (1 + curPage) * rowsPerPage - page.items.length)
      : 0;

  return (
    <Paper sx={{ m: 2 }}>
      <TableToolbar numSelected={selected.length} onDelete={handleDelete} />
      <TableContainer>
        <Table>
          <TableHead
            numSelected={selected.length}
            onSelectAllClick={handleSelectAllClick}
            rowCount={page.items.length}
          />
          <TableBody>
            {page.items
              .slice(curPage * rowsPerPage, curPage * rowsPerPage + rowsPerPage)
              .map((row, index) => {
                const isSel = isSelected(row.id);
                const labelId = `table-checkbox-${index}`;

                return (
                  <TableRow
                    hover
                    role="checkbox"
                    tabIndex={-1}
                    key={row.id}
                    selected={isSel}
                  >
                    <TableCell
                      padding="checkbox"
                      onClick={(e) => handleClick(e, row.id)}
                    >
                      <Checkbox color="primary" checked={isSel} />
                    </TableCell>
                    <TableCell
                      component="th"
                      id={labelId}
                      scope="row"
                      padding="none"
                    >
                      {row.name}
                    </TableCell>
                    <TableCell>{row.suppliedId}</TableCell>
                    <TableCell>{row.id}</TableCell>
                    <TableCell>
                      {row.created
                        ? new Date(row.created).toLocaleString()
                        : undefined}
                    </TableCell>
                  </TableRow>
                );
              })}
            {emptyRows > 0 && (
              <TableRow style={{ height: 53 * emptyRows }}>
                <TableCell colSpan={5} />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[]}
        component="div"
        count={page.items.length}
        rowsPerPage={rowsPerPage}
        page={curPage}
        onPageChange={handleChangePage}
      />
    </Paper>
  );
}
