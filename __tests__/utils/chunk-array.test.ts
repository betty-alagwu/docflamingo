import { chunkArray } from '../../app/utils/chunk-array';

describe('chunkArray', () => {
  it('should split an array into chunks of the specified size', () => {
    // Arrange
    const array = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const chunkSize = 3;
    const expected = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];

    // Act
    const result = chunkArray(array, chunkSize);

    // Assert
    expect(result).toEqual(expected);
    expect(result.length).toBe(3);
    expect(result[0].length).toBe(chunkSize);
  });

  it('should handle arrays that do not divide evenly into chunks', () => {
    // Arrange
    const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const chunkSize = 3;
    const expected = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]];

    // Act
    const result = chunkArray(array, chunkSize);

    // Assert
    expect(result).toEqual(expected);
    expect(result.length).toBe(4);
    expect(result[3].length).toBe(1); // Last chunk should have only one element
  });

  it('should use default chunk size of 3 if not specified', () => {
    // Arrange
    const array = [1, 2, 3, 4, 5, 6, 7];
    const expected = [[1, 2, 3], [4, 5, 6], [7]];

    // Act
    const result = chunkArray(array); // No chunk size provided

    // Assert
    expect(result).toEqual(expected);
    expect(result.length).toBe(3);
    expect(result[0].length).toBe(3); // Default chunk size
  });

  it('should return an empty array when given an empty array', () => {
    // Arrange
    const emptyArray: number[] = [];
    const chunkSize = 3;

    // Act
    const result = chunkArray(emptyArray, chunkSize);

    // Assert
    expect(result).toEqual([]);
    expect(result.length).toBe(0);
  });

  it('should handle chunk size larger than array length', () => {
    // Arrange
    const array = [1, 2, 3];
    const largeChunkSize = 5;
    const expected = [[1, 2, 3]];

    // Act
    const result = chunkArray(array, largeChunkSize);

    // Assert
    expect(result).toEqual(expected);
    expect(result.length).toBe(1);
    expect(result[0].length).toBe(array.length);
  });

  it('should work with arrays of objects', () => {
    // Arrange
    const array = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    const chunkSize = 2;
    const expected = [[{ id: 1 }, { id: 2 }], [{ id: 3 }, { id: 4 }]];

    // Act
    const result = chunkArray(array, chunkSize);

    // Assert
    expect(result).toEqual(expected);
    expect(result.length).toBe(2);
    expect(result[0][0].id).toBe(1);
    expect(result[1][1].id).toBe(4);
  });

  it('should handle chunk size of 1', () => {
    // Arrange
    const array = [1, 2, 3];
    const chunkSize = 1;
    const expected = [[1], [2], [3]];

    // Act
    const result = chunkArray(array, chunkSize);

    // Assert
    expect(result).toEqual(expected);
    expect(result.length).toBe(array.length);
    expect(result.every(chunk => chunk.length === 1)).toBe(true);
  });
});
