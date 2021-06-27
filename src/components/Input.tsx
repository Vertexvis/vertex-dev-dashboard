import { TextField, TextFieldProps } from "@material-ui/core";
import React from "react";
import {
  Control,
  Controller,
  Path,
  PathValue,
  RegisterOptions,
  UseFormReturn,
} from "react-hook-form";

interface Custom<T> {
  readonly control: Control<T>;
  readonly defaultValue?: PathValue<T, Path<T>> | undefined;
  readonly label: string;
  readonly name: Path<T>;
  readonly rules?: Omit<
    RegisterOptions<T, Path<T>>,
    "valueAsNumber" | "valueAsDate" | "setValueAs"
  >;
}

type Props<T> = Custom<T> & TextFieldProps;

interface SelectProps extends Partial<Pick<UseFormReturn, "register">> {
  readonly options: string[];
  readonly name: string;
}

export function Input<T>({
  control,
  defaultValue,
  label,
  name,
  rules,
  ...rest
}: Props<T>): JSX.Element {
  console.log("defaultValue", defaultValue);
  return (
    <Controller
      control={control}
      defaultValue={defaultValue}
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
          // {...rest}
        />
      )}
      rules={rules}
    />
  );
}

export function Select({
  register,
  options,
  name,
  ...rest
}: SelectProps): JSX.Element {
  if (!register) return <></>;

  return (
    <select {...register(name)} {...rest}>
      {options.map((value) => (
        <option key={value} value={value}>
          {value}
        </option>
      ))}
    </select>
  );
}
