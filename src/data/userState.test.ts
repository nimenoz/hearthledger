import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: async () => null, setItem: async () => undefined },
}));

import { parseIdList } from './userState';

describe('parseIdList', () => {
  it('returns null when nothing is stored, so first run can be told apart from empty', () => {
    expect(parseIdList(null)).toBeNull();
  });

  it('parses a stored array of ids', () => {
    expect(parseIdList(JSON.stringify(['a', 'b']))).toEqual(['a', 'b']);
  });

  it('drops non-string entries', () => {
    expect(parseIdList(JSON.stringify(['a', 3, null, 'b']))).toEqual(['a', 'b']);
  });

  it('treats corrupt JSON and non-array values as empty', () => {
    expect(parseIdList('{not json')).toEqual([]);
    expect(parseIdList(JSON.stringify({ a: 1 }))).toEqual([]);
  });
});
