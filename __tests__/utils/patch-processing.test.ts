import { decodeBase64, extendPatch, processPatchLines } from '../../app/utils/patch-processing';

describe('decodeBase64', () => {
  it('should decode a base64 string correctly', () => {
    // Arrange
    // "Hello, world!" in base64
    const base64 = 'SGVsbG8sIHdvcmxkIQ==';
    const expected = 'Hello, world!';

    // Act
    const result = decodeBase64(base64);

    // Assert
    expect(result).toBe(expected);
  });

  it('should handle whitespace in the input by removing it', () => {
    // Arrange
    // "Hello, world!" in base64 with whitespace
    const base64WithWhitespace = 'SGVs bG8s\nIHdv cmxk IQ==';
    const expected = 'Hello, world!';

    // Act
    const result = decodeBase64(base64WithWhitespace);

    // Assert
    expect(result).toBe(expected);
  });

  it('should return an empty string for empty input', () => {
    // Arrange
    const emptyInput = '';

    // Act
    const result = decodeBase64(emptyInput);

    // Assert
    expect(result).toBe('');
  });
});

describe('processPatchLines', () => {
  // Test constants
  const SAMPLE_FILE = 'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8';
  const SINGLE_HUNK_PATCH = '@@ -3,2 +3,3 @@\n line3\n-line4\n+modified line4\n+new line';
  const MULTI_HUNK_PATCH =
    '@@ -2,2 +2,3 @@\n line2\n-line3\n+modified line3\n+new line\n@@ -6,2 +7,2 @@\n line6\n-line7\n+modified line7';

  it('should extend a patch with requested context lines', () => {
    // Arrange
    const originalFile = SAMPLE_FILE;
    const patch = SINGLE_HUNK_PATCH;
    const linesBefore = 1;
    const linesAfter = 1;

    // Act
    const result = processPatchLines(patch, originalFile, linesBefore, linesAfter);

    // Assert
    // Should include the specified number of context lines
    expect(result).toContain('line2');
    expect(result).toContain('line5');

    // Should preserve the original patch content
    expect(result).toContain('line3');
    expect(result).toContain('-line4');
    expect(result).toContain('+modified line4');
    expect(result).toContain('+new line');

    // Verify the structure of the extended patch
    const lines = result.split('\n');
    expect(lines.some((line) => line.includes('line2') && line.startsWith(' '))).toBe(true);
    expect(lines.some((line) => line.includes('line5') && line.startsWith(' '))).toBe(true);
  });

  it('should respect MAX_EXTRA_LINES limit for safety', () => {
    // Arrange
    const originalFile = SAMPLE_FILE;
    const patch = SINGLE_HUNK_PATCH;
    const excessiveLinesBefore = 20;
    const excessiveLinesAfter = 20;

    // Act
    const result = processPatchLines(
      patch,
      originalFile,
      excessiveLinesBefore,
      excessiveLinesAfter
    );

    // Assert
    // Count the number of context lines added
    const lines = result.split('\n');
    const contextLinesBefore = lines.filter(
      (line) => line.startsWith(' ') && /line[12]/.test(line)
    ).length;

    const contextLinesAfter = lines.filter(
      (line) => line.startsWith(' ') && /line[5678]/.test(line)
    ).length;

    // Should be limited to MAX_EXTRA_LINES (10)
    expect(contextLinesBefore).toBeLessThanOrEqual(10);
    expect(contextLinesAfter).toBeLessThanOrEqual(10);

    // The total number of context lines should not exceed 2*MAX_EXTRA_LINES
    expect(contextLinesBefore + contextLinesAfter).toBeLessThanOrEqual(20);
  });

  it('should handle multiple hunks correctly', () => {
    // Arrange
    const originalFile = SAMPLE_FILE;
    const patch = MULTI_HUNK_PATCH;
    const linesBefore = 1;
    const linesAfter = 1;

    // Act
    const result = processPatchLines(patch, originalFile, linesBefore, linesAfter);

    // Assert
    // Should include context for the first hunk
    expect(result).toContain('line1');
    expect(result).toContain('line4');

    // Should include context for the second hunk
    expect(result).toContain('line5');
    expect(result).toContain('line8');

    // Should preserve both hunks' content
    expect(result).toContain('modified line3');
    expect(result).toContain('new line');
    expect(result).toContain('modified line7');

    // Verify the structure with multiple hunks
    const lines = result.split('\n');
    const hunkHeaders = lines.filter((line) => line.startsWith('@@'));
    expect(hunkHeaders.length).toBe(2);
  });

  it('should handle edge cases with no context lines requested', () => {
    // Arrange
    const originalFile = SAMPLE_FILE;
    const patch = SINGLE_HUNK_PATCH;

    // Act
    const result = processPatchLines(patch, originalFile, 0, 0);

    // Assert
    // Should not include any additional context lines
    const lines = result.split('\n');
    expect(lines.filter((line) => line.includes('line2')).length).toBe(0);
    expect(lines.filter((line) => line.includes('line5')).length).toBe(0);

    // Should still include the original patch content
    expect(result).toContain('line3');
    expect(result).toContain('-line4');
    expect(result).toContain('+modified line4');
  });
});

describe('extendPatch', () => {
  // Test constants
  const SAMPLE_CONTENT = 'line1\nline2\nline3\nline4\nline5';
  const SAMPLE_PATCH = '@@ -2,2 +2,3 @@\n line2\n-line3\n+modified line3';

  it('should return the original patch when extension is not needed', () => {
    // Arrange
    const originalFileBase64 = Buffer.from('original content').toString('base64');
    const patch = 'patch content';

    // Act & Assert - Test different scenarios where extension is not needed

    // Scenario 1: No extra lines requested
    expect(extendPatch(originalFileBase64, patch, 0, 0)).toBe(patch);

    // Scenario 2: Empty patch
    expect(extendPatch(originalFileBase64, '', 1, 1)).toBe('');

    // Scenario 3: Empty original file
    expect(extendPatch('', patch, 1, 1)).toBe(patch);
  });

  it('should decode base64 and extend the patch with context lines', () => {
    // Arrange
    const originalFileBase64 = Buffer.from(SAMPLE_CONTENT).toString('base64');
    const patch = SAMPLE_PATCH;
    const linesBefore = 1;
    const linesAfter = 1;

    // Act
    const result = extendPatch(originalFileBase64, patch, linesBefore, linesAfter);

    // Assert
    // Should include context lines from the original file
    expect(result).toContain('line1'); // Context line before
    expect(result).toContain('line4'); // Context line after

    // Should preserve the original patch content
    expect(result).toContain('line2');
    expect(result).toContain('-line3');
    expect(result).toContain('+modified line3');

    // Verify the structure of the extended patch
    const lines = result.split('\n');
    expect(lines.some((line) => line.includes('line1') && line.startsWith(' '))).toBe(true);
    expect(lines.some((line) => line.includes('line4') && line.startsWith(' '))).toBe(true);
  });

  it('should handle invalid base64 gracefully by returning the original patch', () => {
    // Arrange
    const invalidBase64 = 'not-valid-base64';
    const patch = SAMPLE_PATCH;
    const filename = 'test.ts';

    // Act
    const result = extendPatch(invalidBase64, patch, 1, 1, filename);

    // Assert
    // Should return the original patch content without modification
    expect(result).toContain('line2');
    expect(result).toContain('-line3');
    expect(result).toContain('+modified line3');

    // Should not throw an exception
    expect(() => extendPatch(invalidBase64, patch, 1, 1, filename)).not.toThrow();
  });

  it('should handle different numbers of context lines', () => {
    // Arrange
    const originalFileBase64 = Buffer.from(SAMPLE_CONTENT).toString('base64');
    const patch = SAMPLE_PATCH;

    // Act & Assert
    // Test with different numbers of context lines

    // No context lines
    const resultNoContext = extendPatch(originalFileBase64, patch, 0, 0);
    expect(resultNoContext).not.toContain('line1');
    expect(resultNoContext).not.toContain('line4');

    // More context lines
    const resultMoreContext = extendPatch(originalFileBase64, patch, 2, 2);
    expect(resultMoreContext).toContain('line1');
    expect(resultMoreContext).toContain('line4');
    expect(resultMoreContext).toContain('line5');
  });
});
