export function chunkArray<T>(arr: T[], size = 3): T[][] {
  const chunkedArray: T[][] = [];

  for (let i = 0; i < arr.length; i += size) {
    chunkedArray.push(arr.slice(i, i + size));
  }

  return chunkedArray;
}
