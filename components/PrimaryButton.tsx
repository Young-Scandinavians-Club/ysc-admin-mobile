import { ActivityIndicator, Pressable, Text } from 'react-native';

/**
 * The app's one primary call-to-action button. Taller than the 44px minimum
 * touch target on purpose — these are the "charge the card / next customer"
 * actions a volunteer hits repeatedly, one-handed, with a queue in front of
 * them, so they get a full-width 56px hit area and larger label.
 *
 * Styling matches the web `<.button>` component per the README's design
 * system notes: `rounded`, `bg-blue-700`, `disabled:opacity-80`, and the
 * `transition-transform … active:scale-[0.98]` press state.
 */
export function PrimaryButton({
  label,
  onPress,
  onLongPress,
  delayLongPress = 500,
  disabled = false,
  loading = false,
  className = '',
}: {
  label: string;
  onPress: () => void;
  /** Optional press-and-hold action (e.g. the cash / check door-sale path). */
  onLongPress?: () => void;
  delayLongPress?: number;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const inactive = disabled || loading;

  return (
    <Pressable
      className={`min-h-[56px] items-center justify-center rounded bg-blue-700 px-8 py-4 transition-transform duration-150 ease-in-out active:scale-[0.98] ${className}`}
      style={{ opacity: inactive ? 0.8 : 1 }}
      disabled={inactive}
      onPress={onPress}
      onLongPress={inactive ? undefined : onLongPress}
      delayLongPress={delayLongPress}>
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text className="text-lg font-semibold text-zinc-100">{label}</Text>
      )}
    </Pressable>
  );
}
