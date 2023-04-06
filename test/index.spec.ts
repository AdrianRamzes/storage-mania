import { Greeter } from '../src';

test('My Greeter', () => {
  expect(Greeter('World')).toBe('Hello World');
});