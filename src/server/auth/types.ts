export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

export type SessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: number;
  lastSeenAt: number;
};
