import { TokenHandler } from '../../app/services/token-handler.service';

jest.mock('gpt-tokenizer', () => {
  return {
    encode: jest.fn((text: string) => {
      return Array.from({ length: Math.ceil(text.length / 4) });
    }),
  };
});

describe('TokenHandler.clipPatch', () => {
  const DEFAULT_SYSTEM_PROMPT = 'System prompt';
  let handler: TokenHandler;

  /**
   * Helper function to access private methods for testing
   */
  const getPrivateMethod = (instance: any, methodName: string): any => {
    return instance[methodName].bind(instance);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new TokenHandler(DEFAULT_SYSTEM_PROMPT);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return a severely truncated patch when token limit is very low', async () => {
    // Arrange
    const clipPatchMethod = getPrivateMethod(handler, 'clipPatch');
    const patch = '@@ -1,5 +1,5 @@\n line1\n-line2\n+modified line2\n line3\n line4\n line5';
    const veryLowTokenLimit = 10;

    // Act
    const result = await clipPatchMethod(patch, veryLowTokenLimit);

    // Assert
    expect(result).toContain('@@ -1,5 +1,5 @@');
    expect(result).toContain('[Patch severely truncated due to token limit]');

    // Verify that only the header is included, not the content
    expect(result).not.toContain('line1');
    expect(result).not.toContain('modified line2');
  });

  it('should handle complex patches with multiple changes when token limit is very low', async () => {
    // Arrange
    const clipPatchMethod = getPrivateMethod(handler, 'clipPatch');
    const complexPatch =
      '@@ -1,5 +1,7 @@\n line1\n-line2\n+modified line2\n+new line\n line3\n-line4\n+modified line4\n line5';
    const veryLowTokenLimit = 10;

    // Act
    const result = await clipPatchMethod(complexPatch, veryLowTokenLimit);

    // Assert
    expect(result).toContain('@@ -1,5 +1,7 @@');
    expect(result).toContain('[Patch severely truncated due to token limit]');

    // Verify that only the header is included, not the content
    expect(result).not.toContain('modified line2');
    expect(result).not.toContain('new line');
  });

  it('should prioritize added lines when token limit allows some content', async () => {
    // Arrange
    const clipPatchMethod = getPrivateMethod(handler, 'clipPatch');
    const patch =
      '@@ -1,5 +1,6 @@\n line1\n-line2\n+modified line2\n line3\n line4\n+new line\n line5';
    const moderateTokenLimit = 100;

    // Act
    const result = await clipPatchMethod(patch, moderateTokenLimit);

    // Assert
    // Should include the header
    expect(result).toContain('@@ -1,5 +1,6 @@');

    // Should prioritize added lines (those starting with '+')
    expect(result).toContain('+modified line2');
    expect(result).toContain('+new line');

    // Should include truncation message
    expect(result).toContain('[Patch truncated due to token limit]');

    // Verify prioritization by checking if added lines are included
    // even if some context lines might be missing
    const addedLinesCount = (result.match(/\+[^+]/g) || []).length;
    expect(addedLinesCount).toBeGreaterThan(0);
  });

  it('should handle patches without headers gracefully', async () => {
    // Arrange
    const clipPatchMethod = getPrivateMethod(handler, 'clipPatch');
    const patchWithoutHeader = 'line1\nline2\nline3';
    const lowTokenLimit = 10;

    // Act
    const result = await clipPatchMethod(patchWithoutHeader, lowTokenLimit);

    // Assert
    expect(result).toBe('[Patch could not be included due to token limit]');
  });

  it('should handle empty patches gracefully', async () => {
    // Arrange
    const clipPatchMethod = getPrivateMethod(handler, 'clipPatch');
    const emptyPatch = '';
    const anyTokenLimit = 10;

    // Act
    const result = await clipPatchMethod(emptyPatch, anyTokenLimit);

    // Assert
    expect(result).toBe('[Patch could not be included due to token limit]');
  });

  it('should handle different token limits appropriately', async () => {
    // Arrange
    const clipPatchMethod = getPrivateMethod(handler, 'clipPatch');
    const patch =
      '@@ -1,5 +1,6 @@\n line1\n-line2\n+modified line2\n line3\n line4\n+new line\n line5';

    // Act & Assert
    // With very low limit, should only include header
    const resultWithVeryLowLimit = await clipPatchMethod(patch, 10);
    expect(resultWithVeryLowLimit).toContain('@@ -1,5 +1,6 @@');
    expect(resultWithVeryLowLimit).toContain('[Patch severely truncated due to token limit]');

    // With higher limit, should include more content
    const resultWithHigherLimit = await clipPatchMethod(patch, 200);
    expect(resultWithHigherLimit).toContain('@@ -1,5 +1,6 @@');
    expect(resultWithHigherLimit.length).toBeGreaterThan(resultWithVeryLowLimit.length);
  });
});
