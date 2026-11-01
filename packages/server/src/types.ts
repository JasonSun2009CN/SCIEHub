import type { Env } from './runtime.js';

export interface AuthUser {
  id: string;
  username: string;
  /** token_version embedded at sign time, used to invalidate all sessions. */
  v?: number;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    authUser: AuthUser | null;
  };
};
