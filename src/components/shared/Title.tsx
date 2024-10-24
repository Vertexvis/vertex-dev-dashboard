import { Typography, TypographyProps } from "@mui/material";
import { styled } from "@mui/material/styles";
import React from "react";

export interface Props extends TypographyProps {
  readonly children: React.ReactNode;
}

export const Title = styled((props: Props) => (
  <Typography
    sx={{
      padding: "1rem",
      ...props.sx,
    }}
    variant="body2"
    {...props}
  />
))(() => ({ textTransform: "uppercase" }));
