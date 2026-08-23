import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { RootStackParamList } from './types';

import { CollectPaymentScreen } from '@/components/screens/CollectPaymentScreen';
import { EventTicketQuantitiesScreen } from '@/components/screens/EventTicketQuantitiesScreen';
import { HomeScreen } from '@/components/screens/HomeScreen';
import { MemberSearchScreen } from '@/components/screens/MemberSearchScreen';
import { MembershipDetailsScreen } from '@/components/screens/MembershipDetailsScreen';
import { MembershipPlansScreen } from '@/components/screens/MembershipPlansScreen';
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
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="MemberSearch" component={MemberSearchScreen} />
            <Stack.Screen name="MembershipDetails" component={MembershipDetailsScreen} />
            <Stack.Screen name="MembershipPlans" component={MembershipPlansScreen} />
            <Stack.Screen name="EventTicketQuantities" component={EventTicketQuantitiesScreen} />
            <Stack.Screen name="CollectPayment" component={CollectPaymentScreen} />
          </>
        ) : (
          <Stack.Screen name="SignIn" component={SignInScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
