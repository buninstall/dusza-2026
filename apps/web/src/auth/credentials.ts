import { hu } from "../i18n/hu.ts";

export type Credentials = { username: string; password: string };

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
export const PASSWORD_MIN = 8;

const USERNAME_CHARSET = /^[A-Za-z0-9_]+$/;

export function usernameProblem(value: string): string | null {
  if (value.length === 0) {
    return hu.auth.usernameRequired;
  }
  if (value.length < USERNAME_MIN || value.length > USERNAME_MAX) {
    return hu.auth.usernameLength;
  }
  return USERNAME_CHARSET.test(value) ? null : hu.auth.usernameCharset;
}

export function passwordProblem(value: string): string | null {
  if (value.length === 0) {
    return hu.auth.passwordRequired;
  }
  return value.length < PASSWORD_MIN ? hu.auth.passwordShort : null;
}
