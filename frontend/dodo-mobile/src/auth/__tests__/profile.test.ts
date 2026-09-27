import { initials, parseProfile } from '../profile';

describe('parseProfile', () => {
  it('reads name, email and picture from Auth0 userinfo', () => {
    expect(
      parseProfile({
        sub: 'auth0|1',
        name: 'Michael Duran',
        email: 'michael@example.com',
        picture: 'https://example.com/me.png',
      }),
    ).toEqual({
      sub: 'auth0|1',
      name: 'Michael Duran',
      email: 'michael@example.com',
      picture: 'https://example.com/me.png',
    });
  });

  it('falls back to the nickname, then the email, when there is no name', () => {
    expect(parseProfile({ nickname: 'mike', email: 'm@example.com' }).name).toBe('mike');
    expect(parseProfile({ email: 'm@example.com' }).name).toBe('m@example.com');
  });

  it('uses the email-shaped name Auth0 gives email sign-ups only if nothing better exists', () => {
    expect(parseProfile({ name: 'm@example.com', nickname: 'mike', email: 'm@example.com' }).name).toBe(
      'mike',
    );
  });

  it('leaves out what is missing', () => {
    expect(parseProfile({})).toEqual({ sub: undefined, name: 'Reader', email: undefined, picture: undefined });
  });
});

describe('initials', () => {
  it('uses the first letters of the first two words', () => {
    expect(initials('Michael Duran')).toBe('MD');
  });

  it('works for one word', () => {
    expect(initials('mike')).toBe('M');
  });
});
