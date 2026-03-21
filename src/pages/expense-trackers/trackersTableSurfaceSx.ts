import type { Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

const BG = '#1e293b';

/**
 * Společný vzhled tabulek na stránce Trackery — sladění s tmavým pozadím layoutu (#114b3f),
 * výplň #1e293b. Zachovává jemné zvýraznění vybraného řádku (MUI selected).
 */
export function trackersTablePaperSx(theme: Theme) {
  return {
    overflow: 'auto' as const,
    bgcolor: BG,
    color: alpha(theme.palette.common.white, 0.92),
    border: `1px solid ${alpha(theme.palette.common.white, 0.1)}`,

    /* Celá tabulka + řádky v těle — MUI jinak nechává paper/bílé pozadí buněk. */
    '& .MuiTable-root': {
      backgroundColor: BG,
    },
    '& .MuiTableBody-root .MuiTableRow-root': {
      backgroundColor: BG,
    },
    '& .MuiTableBody-root .MuiTableCell-root': {
      backgroundColor: BG,
      borderColor: alpha(theme.palette.common.white, 0.08),
    },

    '& .MuiTableCell-root': {
      borderColor: alpha(theme.palette.common.white, 0.08),
    },
    '& .MuiTableHead-root .MuiTableCell-root': {
      backgroundColor: alpha('#000', 0.2),
      fontWeight: 600,
    },
    '& .MuiTableSortLabel-root': {
      color: 'inherit',
      '&.Mui-active': {
        color: theme.palette.primary.light,
      },
    },

    '& .MuiTableBody-root .MuiTableRow-root:hover .MuiTableCell-root': {
      backgroundColor: alpha(theme.palette.common.white, 0.06),
    },
    '& .MuiTableBody-root .MuiTableRow-root.Mui-selected .MuiTableCell-root': {
      backgroundColor: alpha(theme.palette.primary.main, 0.28),
    },
    '& .MuiTableBody-root .MuiTableRow-root.Mui-selected:hover .MuiTableCell-root': {
      backgroundColor: alpha(theme.palette.primary.main, 0.36),
    },

    /* Lišta stránkování pod tabulkou */
    '& .MuiTablePagination-root': {
      color: alpha(theme.palette.common.white, 0.88),
      backgroundColor: BG,
      borderTop: `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
    },
    '& .MuiTablePagination-toolbar': {
      backgroundColor: BG,
      minHeight: 52,
    },
    '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
      color: alpha(theme.palette.common.white, 0.85),
    },
    '& .MuiTablePagination-select': {
      color: alpha(theme.palette.common.white, 0.92),
    },
    '& .MuiTablePagination-selectIcon': {
      color: alpha(theme.palette.common.white, 0.75),
    },
    '& .MuiTablePagination-actions .MuiIconButton-root': {
      color: alpha(theme.palette.common.white, 0.85),
    },
    '& .MuiTablePagination-root .MuiInputBase-root': {
      color: alpha(theme.palette.common.white, 0.92),
    },

    '& .MuiIconButton-root': {
      color: alpha(theme.palette.common.white, 0.88),
    },
    '& .MuiButton-outlined': {
      borderColor: alpha(theme.palette.common.white, 0.35),
      color: alpha(theme.palette.common.white, 0.92),
      '&:hover': {
        borderColor: alpha(theme.palette.common.white, 0.5),
        backgroundColor: alpha(theme.palette.common.white, 0.06),
      },
    },
    '& .MuiChip-root': {
      borderColor: alpha(theme.palette.common.white, 0.35),
      color: alpha(theme.palette.common.white, 0.9),
    },
    '& .MuiTypography-colorTextSecondary': {
      color: `${alpha(theme.palette.common.white, 0.65)} !important`,
    },
  };
}
