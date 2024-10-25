import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import React from "react";

import { Metadata } from "../../lib/metadata";
import { Title } from "../shared/Title";

interface Props {
  readonly metadata?: Metadata;
}

export function MetadataProperties({ metadata }: Props): JSX.Element {
  if (metadata == null) return <NoData />;

  const propKeys = Object.keys(metadata.properties);
  if (propKeys.length === 0) return <NoData />;

  return (
    <>
      <DrawerTitle />
      <TableContainer sx={{ flexGrow: 1 }}>
        <Table sx={{ whiteSpace: "nowrap", tableLayout: "fixed" }} size="small">
          <TableBody>
            {propKeys.map((k) => (
              <TableRow key={k}>
                <TableCell>
                  <Typography variant="subtitle2">{k}</Typography>
                  <Tooltip
                    title={metadata.properties[k]}
                    placement="left"
                    enterDelay={500}
                  >
                    <Typography
                      sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      variant="body2"
                    >
                      {metadata.properties[k]}
                    </Typography>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

function NoData(): JSX.Element {
  return (
    <>
      <DrawerTitle />
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexGrow: 1,
        }}
      >
        <Typography sx={{ mx: 2, mb: 2 }} variant="body2">
          No data
        </Typography>
      </Box>
    </>
  );
}

function DrawerTitle(): JSX.Element {
  return (
    <Title
      sx={{
        borderBottom: "1px solid #ccc",
      }}
    >
      Properties
    </Title>
  );
}
