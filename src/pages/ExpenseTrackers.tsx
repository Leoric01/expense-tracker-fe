import { Box, Tab, Tabs, Typography } from '@mui/material';
import { FC, SyntheticEvent, useState } from 'react';
import { AccessRequestsTab } from './expense-trackers/AccessRequestsTab';
import { BrowseTrackersTab } from './expense-trackers/BrowseTrackersTab';
import { MineTrackersTab } from './expense-trackers/MineTrackersTab';

export const ExpenseTrackers: FC = () => {
  const [tab, setTab] = useState(0);

  const handleTab = (_: SyntheticEvent, v: number) => setTab(v);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Expense trackery
        </Typography>
        <Typography color="text.secondary">
          Spravuj vlastní trackery, vyhledej cizí a vyřiď žádosti o přístup nebo pozvánky.
        </Typography>
      </Box>

      <Tabs value={tab} onChange={handleTab} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tab label="Moje trackery" />
        <Tab label="Prohlížet / požádat o přístup" />
        <Tab label="Žádosti a pozvánky" />
      </Tabs>

      {tab === 0 && <MineTrackersTab />}
      {tab === 1 && <BrowseTrackersTab />}
      {tab === 2 && <AccessRequestsTab />}
    </Box>
  );
};
