import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SWRConfig } from 'swr';

import { AppNavigator } from '@/components/navigation/AppNavigator';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { swrConfig } from '@/lib/swr';

import './global.css';

/**
 * The Stripe Terminal SDK has no web implementation (native-only module) and
 * even importing it breaks Metro's web bundle, so this web build (used only
 * for previewing everything else during development) never references it —
 * see App.native.tsx for the real, Terminal-enabled app.
 */
function AppContent() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#144993" />
      </View>
    );
  }

  return (
    <>
      <AppNavigator />
      <StatusBar style="auto" />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#fff' }}>
      <SafeAreaProvider>
        <SWRConfig value={swrConfig}>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </SWRConfig>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
