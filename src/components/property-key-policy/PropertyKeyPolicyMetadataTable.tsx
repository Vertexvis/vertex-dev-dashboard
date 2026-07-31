import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from "@mui/material";
import { ReactNode } from "react";

import { toLocaleString } from "../../lib/dates";
import { toDisplayValue } from "../../lib/formatting";
import { PropertyKeyPolicy } from "../../lib/property-key-policies";
import { PropertyKeyPolicyModeChip } from "./PropertyKeyPolicyModeChip";

interface Props {
  readonly propertyKeyPolicy: PropertyKeyPolicy;
}

export function PropertyKeyPolicyMetadataTable({
  propertyKeyPolicy,
}: Props): JSX.Element {
  return (
    <TableContainer>
      <Table size="small" sx={{ whiteSpace: "nowrap" }}>
        <TableBody>
          <DetailsRow label="Name" value={propertyKeyPolicy.name} />
          <DetailsRow label="ID" value={propertyKeyPolicy.id} />
          <DetailsRow
            label="Supplied ID"
            value={propertyKeyPolicy.suppliedId}
          />
          <DetailsRow
            label="Mode"
            value={<PropertyKeyPolicyModeChip mode={propertyKeyPolicy.mode} />}
          />
          <DetailsRow
            label="Created"
            value={toLocaleString(propertyKeyPolicy.createdAt)}
          />
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function DetailsRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value?: ReactNode;
}): JSX.Element {
  return (
    <TableRow>
      <TableCell>
        <Typography variant="subtitle2">{label}</Typography>
        {typeof value === "string" || value == null ? (
          <Typography
            sx={{ overflowWrap: "anywhere", whiteSpace: "normal" }}
            variant="body2"
          >
            {toDisplayValue(value ?? undefined)}
          </Typography>
        ) : (
          <Box sx={{ mt: 0.5 }}>{value}</Box>
        )}
      </TableCell>
    </TableRow>
  );
}
