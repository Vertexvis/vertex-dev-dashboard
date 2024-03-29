import { TextField, TextFieldProps } from "@mui/material";
import React from "react";
import {
  Control,
  Controller,
  FieldValues,
  Path,
  PathValue,
  RegisterOptions,
} from "react-hook-form";

interface Custom<T extends FieldValues> {
  readonly control: Control<T>;
  readonly defaultValue?: PathValue<T, Path<T>> | undefined;
  readonly label: string;
  readonly name: Path<T>;
  readonly rules?: Omit<
    RegisterOptions<T, Path<T>>,
    "valueAsNumber" | "valueAsDate" | "setValueAs"
  >;
}

type Props<T extends FieldValues> = Custom<T> & TextFieldProps;

export function Input<T extends FieldValues>({
  control,
  label,
  name,
  rules,
  ...rest
}: Props<T>): JSX.Element {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <TextField
          error={Boolean(error)}
          fullWidth
          helperText={error ? error.message : undefined}
          label={label}
          margin="normal"
          size="small"
          {...field}
          {...rest}
        />
      )}
      rules={rules}
    />
  );
}
