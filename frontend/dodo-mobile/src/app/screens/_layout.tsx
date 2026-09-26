import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { colors } from '@/theme';

export default function TabsLayout() {
  return (
    <NativeTabs
      // Shrinks the tab bar to a small pill while scrolling down through a book
      // (iOS 26+); scrolling back up brings it back.
      minimizeBehavior="onScrollDown"
      // No backgroundColor: leaves the native glass see-through so the page shows behind it.
      tintColor={colors.accent}
      iconColor={{ default: colors.textSecondary, selected: colors.accent }}
      labelStyle={{ default: { color: colors.textSecondary }, selected: { color: colors.accent } }}>
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reader">
        <NativeTabs.Trigger.Label>Reader</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'book', selected: 'book.fill' }} md="menu_book" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notes">
        <NativeTabs.Trigger.Label>Notes</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'bookmark', selected: 'bookmark.fill' }} md="bookmark" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
