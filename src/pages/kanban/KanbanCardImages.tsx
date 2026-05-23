import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { FC, useRef, useState } from 'react';
import { deleteKanbanCardImage, uploadKanbanCardImageWithFile } from './kanbanCardImageApi';

type KanbanCardImagesProps = {
  imageUrl?: string;
  trackerId: string;
  boardId: string;
  cardId: string;
  onInvalidate: () => void;
};

export const KanbanCardImages: FC<KanbanCardImagesProps> = ({
  imageUrl,
  trackerId,
  boardId,
  cardId,
  onInvalidate,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  const images = imageUrl ? [imageUrl] : [];

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      uploadKanbanCardImageWithFile(trackerId, boardId, cardId, file),
    onSuccess: () => {
      setError('');
      onInvalidate();
    },
    onError: () => setError('Nahrání obrázku se nepodařilo.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteKanbanCardImage(trackerId, boardId, cardId),
    onSuccess: () => {
      setError('');
      setPreviewUrl(null);
      onInvalidate();
    },
    onError: () => setError('Smazání obrázku se nepodařilo.'),
  });

  const busy = uploadMutation.isPending || deleteMutation.isPending;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    uploadMutation.mutate(file);
    e.target.value = '';
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
        <Typography variant="subtitle2">Obrázky</Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={
            uploadMutation.isPending ? (
              <CircularProgress size={14} />
            ) : (
              <FileUploadOutlinedIcon fontSize="small" />
            )
          }
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
        >
          {images.length > 0 ? 'Nahradit' : 'Nahrát obrázek'}
        </Button>
      </Stack>

      {images.length > 0 ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 1.5,
          }}
        >
          {images.map((url) => (
            <Box
              key={url}
              sx={{
                position: 'relative',
                aspectRatio: '1',
                borderRadius: 1,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'action.hover',
                '&:hover .image-delete': { opacity: 1 },
              }}
            >
              <Box
                component="img"
                src={url}
                alt="Náhled obrázku karty"
                onClick={() => setPreviewUrl(url)}
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  cursor: 'zoom-in',
                  display: 'block',
                  '&:hover': { opacity: 0.92 },
                }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
              <Tooltip title="Smazat obrázek">
                <IconButton
                  size="small"
                  color="error"
                  className="image-delete"
                  onClick={() => deleteMutation.mutate()}
                  disabled={busy}
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    bgcolor: 'background.paper',
                    opacity: 0,
                    transition: 'opacity 0.15s',
                    '&:hover': { bgcolor: 'background.paper' },
                  }}
                >
                  {deleteMutation.isPending ? (
                    <CircularProgress size={14} color="error" />
                  ) : (
                    <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                  )}
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
      ) : (
        <Box
          onClick={() => !busy && fileInputRef.current?.click()}
          sx={{
            py: 4,
            px: 2,
            textAlign: 'center',
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 1,
            cursor: busy ? 'default' : 'pointer',
            bgcolor: 'action.hover',
            '&:hover': busy ? undefined : { borderColor: 'primary.main', bgcolor: 'action.selected' },
          }}
        >
          <ImageOutlinedIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            Zatím žádné obrázky
          </Typography>
          <Typography variant="caption" color="text.disabled" display="block" mt={0.5}>
            Klikněte pro nahrání nebo použijte tlačítko nahoře
          </Typography>
        </Box>
      )}

      <Box
        component="input"
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        sx={{ display: 'none' }}
      />

      {error && (
        <Typography color="error" variant="caption" sx={{ display: 'block', mt: 1 }}>
          {error}
        </Typography>
      )}

      {previewUrl && (
        <Dialog open onClose={() => setPreviewUrl(null)} maxWidth="lg">
          <DialogContent sx={{ p: 1 }}>
            <Box
              component="img"
              src={previewUrl}
              alt="Obrázek karty"
              sx={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: '85vh',
                borderRadius: 1,
                mx: 'auto',
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </Paper>
  );
};
