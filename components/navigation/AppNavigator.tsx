import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { RootStackParamList } from './types';

import { EventsScreen } from '@/components/screens/EventsScreen';
import { SignInScreen } from '@/components/screens/SignInScreen';
import { useAuth } from '@/lib/auth-context';

const Stack = createNativeStackNavigator<RootStackParamList>();

const LightTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: '#fafafa' },
};

export function AppNavigator() {
  const { status } = useAuth();

  return (
    <NavigationContainer theme={LightTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          animationDuration: 150,
          contentStyle: { backgroundColor: '#fafafa' },
        }}>
        {status === 'signed_in' ? (
          <Stack.Screen name="Events" component={EventsScreen} />
        ) : (
          <Stack.Screen name="SignIn" component={SignInScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
