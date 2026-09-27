// The signed-in user's profile for Settings, from Auth0's /userinfo endpoint.

export type UserProfile = { name: string; email?: string; picture?: string };

export class UserInfoError extends Error {
  constructor(public readonly status: number) {
    super(`userinfo ${status}`);
    this.name = 'UserInfoError';
  }
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

// Auth0 sets `name` to the email address for email/password sign-ups, so a
// nickname reads better when there's no real name.
export function parseProfile(raw: Record<string, unknown>): UserProfile {
  const email = text(raw.email);
  const name = text(raw.name);
  const realName = name && name !== email ? name : undefined;
  return {
    name: realName ?? text(raw.nickname) ?? email ?? 'Reader',
    email,
    picture: text(raw.picture),
  };
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export async function fetchProfile(domain: string, accessToken: string): Promise<UserProfile> {
  const res = await fetch(`https://${domain}/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new UserInfoError(res.status);
  return parseProfile(await res.json());
}
