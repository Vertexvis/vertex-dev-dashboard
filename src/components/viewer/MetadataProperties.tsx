import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
      <Title
        sx={{
          borderBottom: "1px solid #ccc",
        }}
      >
        Properties
      </Title>
      <TableContainer>
        <Table size="small" style={{ whiteSpace: "nowrap" }}>
          <TableHead>
            <TableRow>
              <TableCell>
                <Typography variant="subtitle1">{metadata.partName}</Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {propKeys.map((k) => (
              <TableRow key={k}>
                <TableCell>
                  <Typography variant="subtitle2">{k}</Typography>
                  <Typography variant="body2">
                    {metadata.properties[k]}
                  </Typography>
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
    <Typography sx={{ mx: 2, mb: 2 }} variant="body2">
      No data
    </Typography>
  );
}
