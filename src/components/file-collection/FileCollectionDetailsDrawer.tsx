import { Close } from "@mui/icons-material";
import { Box, Drawer, IconButton, Typography } from "@mui/material";
import React from "react";

import { FileCollection } from "../../lib/file-collections";
import { RightDrawerWidth } from "../shared/Layout";
import { FileCollectionMetadataTable } from "./FileCollectionMetadataTable";

interface Props {
  readonly fileCollection?: FileCollection;
  readonly onClose: () => void;
  readonly open: boolean;
}

export function FileCollectionDetailsDrawer({
  fileCollection,
  onClose,
  open,
}: Props): JSX.Element {
  return (
    <Drawer
      anchor="right"
      open={open}
      sx={{
        flexShrink: 0,
        width: RightDrawerWidth,
        "& .MuiDrawer-paper": { width: RightDrawerWidth },
      }}
      variant="persistent"
    >
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography sx={{ my: 2, mx: 2 }} variant="h5">
          File Collection Details
        </Typography>
        <IconButton onClick={onClose} sx={{ mr: 2 }}>
          <Close />
        </IconButton>
      </Box>
      {fileCollection ? (
        <FileCollectionMetadataTable fileCollection={fileCollection} />
      ) : (
        <></>
      )}
    </Drawer>
  );
}
