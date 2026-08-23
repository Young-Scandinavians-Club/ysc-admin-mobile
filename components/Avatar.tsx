import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, View } from 'react-native';

/**
 * Circular user avatar. The backend always returns a usable URL (falls back
 * to a default image when no photo is uploaded), but this still degrades to
 * a generic person icon if the image itself fails to load (bad network,
 * broken URL) rather than showing a blank/broken image.
 */
export function Avatar({ uri, size = 44 }: { uri: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const dimensions = { width: size, height: size, borderRadius: size / 2 };

  if (failed || !uri) {
    return (
      <View className="items-center justify-center bg-blue-50" style={dimensions}>
        <Ionicons name="person-outline" size={size * 0.5} color="#144993" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={dimensions}
      accessibilityIgnoresInvertColors
      onError={() => setFailed(true)}
    />
  );
}
