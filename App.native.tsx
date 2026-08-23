import { StripeTerminalProvider } from '@stripe/stripe-terminal-react-native';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SWRConfig } from 'swr';

import { api } from '@/api';
import { AppNavigator } from '@/components/navigation/AppNavigator';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { swrConfig } from '@/lib/swr';

import './global.css';

async function fetchConnectionToken(): Promise<string> {
  const { secret } = await api.createTerminalConnectionToken();
  return secret;
}

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
      <StripeTerminalProvider tokenProvider={fetchConnectionToken}>
        <SafeAreaProvider>
          <SWRConfig value={swrConfig}>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </SWRConfig>
        </SafeAreaProvider>
      </StripeTerminalProvider>
    </GestureHandlerRootView>
  );
}
