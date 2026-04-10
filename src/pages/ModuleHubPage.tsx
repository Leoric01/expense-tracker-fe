import { PageHeading } from '@components/PageHeading';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import RestaurantOutlinedIcon from '@mui/icons-material/RestaurantOutlined';
import SelfImprovementOutlinedIcon from '@mui/icons-material/SelfImprovementOutlined';
import { alpha, Box, Card, CardActionArea, CardContent, Stack, Typography } from '@mui/material';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import type { Theme } from '@mui/material/styles';
import { FC } from 'react';
import { Link } from 'react-router-dom';

type ModuleCardConfig = {
  to: string;
  title: string;
  description: string;
  Icon: (props: SvgIconProps) => React.ReactNode;
  accent: (theme: Theme) => { bg: string; fg: string };
};

const MODULES: ModuleCardConfig[] = [
  {
    to: '/domu',
    title: 'Finance',
    description: 'Rozpočet, účty, přehledy a trackery.',
    Icon: AccountBalanceOutlinedIcon,
    accent: (t) => ({ bg: alpha(t.palette.primary.main, 0.12), fg: t.palette.primary.main }),
  },
  {
    to: '/habits',
    title: 'Návyky',
    description: 'Denní agenda, týdenní přehled a správa návyků.',
    Icon: SelfImprovementOutlinedIcon,
    accent: (t) => ({ bg: alpha(t.palette.secondary.main, 0.14), fg: t.palette.secondary.main }),
  },
  {
    to: '/nutrition/dashboard',
    title: 'Výživa',
    description: 'Dashboard, check-iny, plány a profil.',
    Icon: RestaurantOutlinedIcon,
    accent: (t) => ({ bg: alpha(t.palette.success.main, 0.12), fg: t.palette.success.main }),
  },
];

/** Výběr modulu — stejné cíle jako položky v postranním menu. */
export const ModuleHubPage: FC = () => {
  return (
    <Box>
      <PageHeading component="h1" gutterBottom>
        Moduly
      </PageHeading>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(3, minmax(0, 1fr))',
          },
          maxWidth: 960,
          mt: 1,
        }}
      >
        {MODULES.map(({ to, title, description, Icon, accent }) => (
          <Card
            key={to}
            variant="outlined"
            sx={{
              height: '100%',
              transition: (t) =>
                t.transitions.create(['box-shadow', 'border-color'], { duration: t.transitions.duration.shortest }),
              '&:hover': {
                borderColor: 'action.active',
                boxShadow: 2,
              },
            }}
          >
            <CardActionArea
              component={Link}
              to={to}
              sx={{
                height: '100%',
                alignItems: 'stretch',
                justifyContent: 'flex-start',
                py: 0,
              }}
            >
              <CardContent sx={{ width: '100%', p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Box
                    sx={(t) => {
                      const { bg, fg } = accent(t);
                      return {
                        flexShrink: 0,
                        width: 52,
                        height: 52,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: bg,
                        color: fg,
                      };
                    }}
                  >
                    <Icon sx={{ fontSize: 28 }} />
                  </Box>
                  <Stack spacing={0.75} alignItems="flex-start" sx={{ minWidth: 0, textAlign: 'left' }}>
                    <Typography variant="h6" component="span" fontWeight={700} color="text.primary">
                      {title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.45 }}>
                      {description}
                    </Typography>
                    <Typography variant="caption" color="primary" fontWeight={600} sx={{ pt: 0.25 }}>
                      Otevřít →
                    </Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Box>
  );
};
