// Lets each developer sign iOS builds with their own Apple account without
// editing app.json: set DODO_IOS_BUNDLE_ID and DODO_APPLE_TEAM_ID in your
// (git-ignored) .env.local. Unset, the app.json values are used.
module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    bundleIdentifier: process.env.DODO_IOS_BUNDLE_ID || config.ios.bundleIdentifier,
    appleTeamId: process.env.DODO_APPLE_TEAM_ID || config.ios.appleTeamId,
  },
});
