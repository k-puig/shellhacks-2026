const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const SCENE_DELEGATE = 'EXExpoAppSceneDelegate';

module.exports = function withIosSceneLifecycle(config) {
  config = withInfoPlist(config, (config) => {
    const plist = config.modResults;
    const manifest = plist.UIApplicationSceneManifest ?? {};
    const configurations = manifest.UISceneConfigurations ?? {};
    const appScenes = configurations.UIWindowSceneSessionRoleApplication ?? [];
    const defaultScene = {
      UISceneConfigurationName: 'Expo Default Configuration',
      UISceneDelegateClassName: SCENE_DELEGATE,
    };

    if (!appScenes.some((scene) => scene.UISceneDelegateClassName === SCENE_DELEGATE)) {
      appScenes.push(defaultScene);
    }

    plist.UIApplicationSceneManifest = {
      ...manifest,
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        ...configurations,
        UIWindowSceneSessionRoleApplication: appScenes,
      },
    };

    return config;
  });

  config = withAppDelegate(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes('ExpoReactNativeFactoryProvider')) {
      const appDelegateDeclaration = 'class AppDelegate: ExpoAppDelegate {';
      if (!contents.includes(appDelegateDeclaration)) {
        throw new Error('Unable to locate the Expo AppDelegate declaration for scene lifecycle setup.');
      }
      contents = contents.replace(
        appDelegateDeclaration,
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {'
      );
    }

    const legacyStartup = /#if os\(iOS\) \|\| os\(tvOS\)\r?\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\r?\n\s*factory\.startReactNative\([\s\S]*?\r?\n\s*#endif/;
    if (legacyStartup.test(contents)) {
      contents = contents.replace(legacyStartup, '').replace(/\n{3,}/g, '\n\n');
    } else if (contents.includes('factory.startReactNative(')) {
      throw new Error('Unable to safely replace the existing AppDelegate React Native startup block.');
    }

    config.modResults.contents = contents;
    return config;
  });

  return config;
};
