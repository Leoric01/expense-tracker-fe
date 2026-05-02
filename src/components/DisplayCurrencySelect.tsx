import type { AssetResponseDto } from '@api/model';
import { AssetResponseDtoMarketDataSource } from '@api/model';
import { DISPLAY_CURRENCY_POPULAR_CODES } from '@utils/displayCurrencyPopularCodes';
import { Autocomplete, TextField, type SxProps, type Theme } from '@mui/material';
import { FC, useMemo } from 'react';

type DisplayCurrencySelectProps = {
  value: string;
  assets: AssetResponseDto[];
  onChange: (assetId: string) => void;
  disabled?: boolean;
  label?: string;
  labelId?: string;
  sx?: SxProps<Theme>;
};

export const DisplayCurrencySelect: FC<DisplayCurrencySelectProps> = ({
  value,
  assets,
  onChange,
  disabled = false,
  label = 'Display měna',
  labelId = 'display-currency-select-label',
  sx,
}) => {
  type DisplayCurrencyOption = { id: string; label: string };
  const displayCurrencyOptions = useMemo(() => {
    return [...assets]
      .filter(
        (a) =>
          a.active !== false &&
          a.id &&
          a.marketDataSource !== AssetResponseDtoMarketDataSource.NONE &&
          a.marketDataSource !== AssetResponseDtoMarketDataSource.MANUAL,
      )
      .sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '', undefined, { sensitivity: 'base' }));
  }, [assets]);

  const popularDisplayCurrencyOptions = useMemo(() => {
    const byCode = new Map(displayCurrencyOptions.map((a) => [(a.code ?? '').toUpperCase(), a]));
    return DISPLAY_CURRENCY_POPULAR_CODES.map((code) => byCode.get(code)).filter((a): a is AssetResponseDto =>
      Boolean(a?.id),
    );
  }, [displayCurrencyOptions]);

  const otherDisplayCurrencyOptions = useMemo(() => {
    const popularIds = new Set(popularDisplayCurrencyOptions.map((a) => a.id));
    return displayCurrencyOptions.filter((a) => !popularIds.has(a.id));
  }, [displayCurrencyOptions, popularDisplayCurrencyOptions]);

  const options = useMemo((): DisplayCurrencyOption[] => {
    const none: DisplayCurrencyOption = { id: '', label: 'Bez konverze' };
    const popular = popularDisplayCurrencyOptions.map((asset) => ({
      id: asset.id as string,
      label: `${asset.code} - ${asset.name}`,
    }));
    const other = otherDisplayCurrencyOptions.map((asset) => ({
      id: asset.id as string,
      label: `${asset.code} - ${asset.name}`,
    }));
    return [none, ...popular, ...other];
  }, [otherDisplayCurrencyOptions, popularDisplayCurrencyOptions]);

  const selectedOption = useMemo((): DisplayCurrencyOption | undefined => {
    const found = options.find((o) => o.id === value);
    return found ?? options[0];
  }, [options, value]);

  const optionsDisabled = displayCurrencyOptions.length === 0;
  const finalDisabled = disabled || optionsDisabled;

  const optionEquality = (a: DisplayCurrencyOption, b: DisplayCurrencyOption) => a.id === b.id;
  const optionLabel = (option: DisplayCurrencyOption) => option.label;

  const handleChange = (_: unknown, next: DisplayCurrencyOption | null) => {
    onChange(next?.id ?? '');
    window.setTimeout(() => {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }, 0);
  };

  return (
    <Autocomplete
      options={options}
      value={selectedOption}
      disabled={finalDisabled}
      onChange={handleChange}
      isOptionEqualToValue={optionEquality}
      getOptionLabel={optionLabel}
      disableClearable
      size="small"
      sx={sx}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          slotProps={{ inputLabel: { id: labelId } }}
        />
      )}
    />
  );
};
