import { FC } from 'react';
import { TransactionsV2TransferForms } from './TransactionsV2TransferForms';

type Props = {
  trackerId: string;
};

/** Převody V2 na stránce `/transactions/prevody` — sdílený obsah je v {@link TransactionsV2TransferForms}. */
export const TransactionsV2Panel: FC<Props> = ({ trackerId }) => (
  <TransactionsV2TransferForms trackerId={trackerId} variant="page" />
);
