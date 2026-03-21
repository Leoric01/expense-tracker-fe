import { Typography, TypographyProps } from '@mui/material';
import { FC, ReactNode } from 'react';

type PageHeadingProps = TypographyProps & {
  children: ReactNode;
};

/** Jednotný nadpis stránky — stejná vizuální úroveň jako „Moje peněženky“ (text.secondary, tučné, uppercase). */
export const PageHeading: FC<PageHeadingProps> = ({ children, sx, ...rest }) => (
  <Typography
    variant="h6"
    color="text.secondary"
    fontWeight={600}
    sx={{
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      ...sx,
    }}
    {...rest}
  >
    {children}
  </Typography>
);
