import type { CategoryResponseDto } from '@api/model';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Box, CircularProgress, Collapse, IconButton, Paper, Stack, Typography } from '@mui/material';
import { FC, useState } from 'react';
import { asCategoryChildren } from '../categories/categoryTreeUtils';

type RowProps = {
  node: CategoryResponseDto;
  depth: number;
  selectedId: string;
  onSelect: (id: string) => void;
};

const CategoryTreePickRow: FC<RowProps> = ({ node, depth, selectedId, onSelect }) => {
  const [expanded, setExpanded] = useState(false);
  const id = node.id ?? '';
  const children = asCategoryChildren(node.children);
  const hasChildren = children.length > 0;
  const selected = Boolean(id && id === selectedId);

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        sx={{
          pl: depth * 2.5,
          py: 0.75,
          pr: 1,
          borderBottom: 1,
          borderColor: 'divider',
          cursor: id ? 'pointer' : 'default',
          bgcolor: selected ? 'action.selected' : 'transparent',
          '&:hover': {
            bgcolor: selected ? 'action.selected' : 'action.hover',
          },
        }}
        onClick={() => id && onSelect(id)}
      >
        <Box
          sx={{
            width: 36,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {hasChildren ? (
            <IconButton
              size="small"
              aria-expanded={expanded}
              aria-label={expanded ? 'Sbalit' : 'Rozbalit'}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
            >
              <ChevronRightIcon
                fontSize="small"
                sx={{
                  transition: (t) => t.transitions.create('transform', { duration: t.transitions.duration.shorter }),
                  transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              />
            </IconButton>
          ) : null}
        </Box>
        <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap title={node.name}>
          {node.name ?? '—'}
        </Typography>
      </Stack>
      {hasChildren && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box>
            {children.map((ch) => (
              <CategoryTreePickRow
                key={ch.id ?? ch.name}
                node={ch}
                depth={depth + 1}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            ))}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

export type CategoryTreePickerProps = {
  tree: CategoryResponseDto[];
  selectedId: string;
  onSelect: (id: string) => void;
  emptyMessage: string;
  loading?: boolean;
};

export const CategoryTreePicker: FC<CategoryTreePickerProps> = ({
  tree,
  selectedId,
  onSelect,
  emptyMessage,
  loading,
}) => {
  if (loading) {
    return (
      <Paper variant="outlined" sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={28} />
      </Paper>
    );
  }

  if (tree.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyMessage}
      </Typography>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        maxHeight: 360,
        overflow: 'auto',
        p: 0,
      }}
    >
      {tree.map((node) => (
        <CategoryTreePickRow
          key={node.id ?? node.name}
          node={node}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </Paper>
  );
};
