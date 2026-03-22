import { TextField, type TextFieldProps } from '@mui/material';
import { canonicalAmountFromUserInput, formatAmountDisplayCs } from './transactionFormUtils';

const DEFAULT_HELPER = 'Číslice a desetinná čárka; tisíce se oddělí mezerou';

type Props = Omit<TextFieldProps, 'value' | 'onChange' | 'inputMode'> & {
  /** Kanonická hodnota (číslice, jedna `.` pro desetinnou část). */
  canonical: string;
  setCanonical: (next: string) => void;
};

/** Jednotné částkové pole: formát CZ (mezery po tisících, desetinná čárka), vstup filtrovaný. */
export function AmountTextFieldCs({ canonical, setCanonical, helperText, ...rest }: Props) {
  return (
    <TextField
      {...rest}
      value={formatAmountDisplayCs(canonical)}
      onChange={(e) => setCanonical(canonicalAmountFromUserInput(e.target.value))}
      inputMode="decimal"
      autoComplete="off"
      helperText={helperText ?? DEFAULT_HELPER}
    />
  );
}
