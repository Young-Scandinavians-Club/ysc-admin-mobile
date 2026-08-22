jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('react-native-screens', () => {
  const actual = jest.requireActual('react-native-screens');
  return {
    ...actual,
    enableScreens: jest.fn(),
  };
});
