import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { AUTH_ENABLED } from '../auth/config';
import { useAuth } from '../auth/useAuth';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  if (!AUTH_ENABLED) return <Redirect href="/screens/home" />;

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#15131C', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#E3A548" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/welcome" />;
  }

  return <Redirect href="/screens/home" />;
}
