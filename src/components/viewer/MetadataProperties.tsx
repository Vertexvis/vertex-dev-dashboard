import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import {
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import React from 'react';

import { Metadata } from '../../lib/metadata';
import { Title } from '../shared/Title';

interface Props {
  readonly metadata?: Metadata;
}

export function MetadataProperties({ metadata }: Props): JSX.Element {
  if (metadata == null) return <NoData />;

  // PLAT-9087 will split identifiers into their own table; until then render the
  // intrinsic identifiers and policy-governed properties as one combined list.
  const properties = { ...metadata.identifiers, ...metadata.properties };
  const propKeys = Object.keys(properties).sort((a, b) => a.localeCompare(b));
  if (propKeys.length === 0) return <NoData />;

  return (
    <>
      <DrawerTitle />
      <TableContainer sx={{ flexGrow: 1 }}>
        <Table sx={{ whiteSpace: 'nowrap', tableLayout: 'fixed' }} size="small">
          <TableBody>
            {propKeys.map((k) => (
              <TableRow key={k}>
                <TableCell>
                  <Typography variant="subtitle2">{k}</Typography>
                  <Tooltip title={properties[k]} placement="left" enterDelay={500}>
                    <Typography
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      variant="body2"
                    >
                      {properties[k]}
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
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
      component="div"
      sx={{
        borderBottom: '1px solid #ccc',
        alignItems: 'center',
        display: 'flex',
        justifyContent: 'space-between',
      }}
    >
      <span>Properties</span>
      <Tooltip title="Properties are loaded with your developer-session credentials and remain unrestricted. The selected property key policy restricts only metadata available in the viewer stream.">
        <IconButton aria-label="About developer properties" size="small">
          <HelpOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Title>
  );
}
