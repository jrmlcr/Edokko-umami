import { expect, test } from 'vitest';
import { truncateIp } from './ip';

test('drops the last byte of an IPv4 address', () => {
  expect(truncateIp('203.0.113.42')).toBe('203.0.113.0');
  expect(truncateIp('203.0.113.42:8080')).toBe('203.0.113.0');
  expect(truncateIp('::ffff:203.0.113.42')).toBe('203.0.113.0');
});

test('keeps only the first 48 bits of an IPv6 address', () => {
  expect(truncateIp('2001:db8:85a3:8d3:1319:8a2e:370:7348')).toBe('2001:db8:85a3::');
});

test('gives nothing for a missing or invalid address', () => {
  expect(truncateIp(undefined)).toBe('');
  expect(truncateIp('nonsense')).toBe('');
});
