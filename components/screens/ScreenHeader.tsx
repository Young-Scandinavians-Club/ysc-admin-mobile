import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity, View } from 'react-native';

export function ScreenHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  return (
    <View className="flex-row items-center border-b border-zinc-100 bg-white px-2 py-3">
      <TouchableOpacity
        className="h-11 w-11 items-center justify-center"
        onPress={onBack}
        accessibilityLabel="Go back">
        <Ionicons name="chevron-back" size={24} color="#144993" />
      </TouchableOpacity>
      <View className="flex-1 pr-11">
        <Text className="text-center text-lg font-semibold text-blue-900" numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text className="text-center text-xs text-zinc-500" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
}
