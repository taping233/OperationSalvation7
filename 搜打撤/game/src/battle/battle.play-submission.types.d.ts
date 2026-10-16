export type CardPlayUid = string | number;
export type CardPlayReason = Readonly<{ code: string; message: string }>;
export type CardPlayIdentity = Readonly<{ uid: CardPlayUid; battleToken: number }>;
export type CardPlayReceipt = Readonly<{ uid: CardPlayUid; battleToken: number; actionSeq: number }>;
export type CardPlayRejected = CardPlayIdentity & Readonly<{ status: 'rejected'; reason: CardPlayReason }>;
export type CardPlayAvailability = CardPlayRejected | (CardPlayIdentity & Readonly<{ status: 'ready' }>);
export type CardPlayFinal = CardPlayIdentity & Readonly<{ receipt: CardPlayReceipt }> & (
  Readonly<{ status: 'committed' }> | Readonly<{ status: 'rejected' | 'cancelled'; reason: CardPlayReason }>
);
export type CardPlaySubmission = CardPlayRejected
  | (CardPlayIdentity & Readonly<{ status: 'needs-input'; kind: 'target' | 'infusion' | 'payment' }>)
  | (CardPlayIdentity & Readonly<{ status: 'queued'; receipt: CardPlayReceipt; settled: Promise<CardPlayFinal> }>);
