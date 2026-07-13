import { Close } from "@mui/icons-material";
import { Box, Drawer, IconButton, Typography } from "@mui/material";
import React from "react";
import useSWR from "swr";

import { isErrorRes } from "../../lib/api";
import {
  FileCollection,
  GetFileCollectionRes,
  toFileCollection,
} from "../../lib/file-collections";
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
  const { data, error } = useSWR<GetFileCollectionRes | undefined>(
    fileCollection == null
      ? null
      : `/api/file-collections/${encodeURIComponent(fileCollection.id)}`
  );
  const fetchedFileCollection =
    data != null && !isErrorRes(data) ? toFileCollection(data.data) : undefined;
  const fileCollectionDetails =
    fileCollection == null
      ? undefined
      : fetchedFileCollection == null
      ? fileCollection
      : { ...fileCollection, ...fetchedFileCollection };
  const showOptionalFieldLoading =
    fileCollection != null &&
    fetchedFileCollection == null &&
    error == null &&
    !isErrorRes(data) &&
    (fileCollection.metadata == null || fileCollection.expiresAt == null);

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
      {fileCollectionDetails ? (
        <Box sx={{ px: 2 }}>
          <FileCollectionMetadataTable
            fileCollection={fileCollectionDetails}
            optionalFieldStatus={showOptionalFieldLoading ? "loading" : "ready"}
          />
        </Box>
      ) : (
        <></>
      )}
    </Drawer>
  );
}
