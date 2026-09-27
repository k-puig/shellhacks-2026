import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AUTH_ENABLED } from '@/auth/config';
import { initials } from '@/auth/profile';
import { useAuth } from '@/auth/useAuth';
import { colors } from '@/theme';

// Static for the MVP — these become real preferences later.
const groups: { title: string; rows: [string, string][] }[] = [
  {
    title: 'Narration',
    rows: [
      ['Voice', 'System default'],
      ['Speed', '1.0×  (say “faster” / “slower”)'],
    ],
  },
  {
    title: 'Voice commands',
    rows: [
      ['Wake word', 'Hey DODO'],
      ['“highlight that”', 'Highlight the last sentence'],
      ['“write a note, …”', 'Save a note here'],
      ['“pause” / “keep reading”', 'Stop or resume'],
      ['“go back” / “skip”', 'Repeat sentence / next paragraph'],
      ['“next chapter”', 'Jump chapters'],
    ],
  },
];

export default function SettingsScreen() {
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/welcome');
  };

  return (
    // Presented as a sheet, so no top safe-area inset is needed.
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Settings</Text>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Account</Text>
          <View style={[styles.card, styles.account]}>
            {user?.picture ? (
              <Image source={user.picture} style={styles.avatar} accessibilityLabel="Profile picture" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                {user ? (
                  <Text style={styles.avatarInitials}>{initials(user.name)}</Text>
                ) : (
                  <SymbolView
                    name={{ ios: 'person.fill', android: 'person', web: 'person' }}
                    tintColor={colors.textSecondary}
                    size={26}
                  />
                )}
              </View>
            )}
            <View style={styles.accountText}>
              <Text style={styles.accountName} numberOfLines={1}>
                {user?.name ?? (AUTH_ENABLED ? 'Signed in' : 'Guest')}
              </Text>
              <Text style={styles.accountEmail} numberOfLines={1}>
                {user?.email ?? (AUTH_ENABLED ? '' : 'Sign-in is turned off for now')}
              </Text>
            </View>
          </View>
          {AUTH_ENABLED && (
            <Pressable style={styles.logoutButton} onPress={handleLogout} accessibilityRole="button">
              <Text style={styles.logoutText}>Log Out</Text>
            </Pressable>
          )}
        </View>

        {groups.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <View style={styles.card}>
              {group.rows.map(([label, value], i) => (
                <View key={label} style={[styles.row, i > 0 && styles.rowDivider]}>
                  <Text style={styles.label}>{label}</Text>
                  <Text style={styles.value}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 28, paddingBottom: 40 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: { color: colors.text, fontSize: 32, fontWeight: '700', letterSpacing: -1 },
  done: { color: colors.accent, fontSize: 17, fontWeight: '600' },
  group: { marginBottom: 28 },
  groupTitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  card: { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 14 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  label: { color: colors.text, fontSize: 15, flexShrink: 1 },
  value: { color: colors.textSecondary, fontSize: 15, flexShrink: 1, textAlign: 'right' },
  account: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: {
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { color: colors.text, fontSize: 18, fontWeight: '600' },
  accountText: { flex: 1, gap: 2 },
  accountName: { color: colors.text, fontSize: 17, fontWeight: '600' },
  accountEmail: { color: colors.textSecondary, fontSize: 14 },
  logoutButton: {
    backgroundColor: '#2A1F24',
    borderWidth: 1,
    borderColor: '#4A2830',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  logoutText: { color: '#FF6B6B', fontSize: 16, fontWeight: '600' },
});
