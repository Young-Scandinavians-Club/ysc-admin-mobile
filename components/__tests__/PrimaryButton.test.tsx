import { fireEvent, render } from '@testing-library/react-native';

import { PrimaryButton } from '@/components/PrimaryButton';

describe('PrimaryButton', () => {
  it('fires onPress and onLongPress', () => {
    const onPress = jest.fn();
    const onLongPress = jest.fn();
    const { getByText } = render(
      <PrimaryButton label="Continue" onPress={onPress} onLongPress={onLongPress} />
    );

    fireEvent.press(getByText('Continue'));
    fireEvent(getByText('Continue'), 'longPress');

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onLongPress while disabled', () => {
    const onLongPress = jest.fn();
    const { getByText } = render(
      <PrimaryButton label="Continue" onPress={jest.fn()} onLongPress={onLongPress} disabled />
    );

    fireEvent(getByText('Continue'), 'longPress');

    expect(onLongPress).not.toHaveBeenCalled();
  });
});
