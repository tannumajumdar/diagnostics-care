/**
 * List endpoints send `data` as a bare array, but several screens were written
 * against an older `{ tests: [...] }` / `{ departments: [...] }` shape. Reading
 * the missing key yielded `undefined` and the next `.map()` crashed the page.
 *
 * `asList` accepts either shape and always hands back an array.
 */
export const asList = <T = any>(data: any, key?: string): T[] => {
  if (Array.isArray(data)) return data as T[];
  if (data && key && Array.isArray(data[key])) return data[key] as T[];
  return [];
};
