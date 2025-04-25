import { TokenHandler, FileInfo, TokenConfig } from '../../app/services/token-handler.service';

jest.mock('gpt-tokenizer', () => {
  return {
    encode: jest.fn((text: string) => {
      return Array.from({ length: Math.ceil(text.length / 4) });
    })
  };
});

describe('TokenHandler', () => {
  const DEFAULT_SYSTEM_PROMPT = 'System prompt';
  const DEFAULT_MAX_TOKENS = 1000;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('countTokens', () => {
    it('should count tokens correctly for various inputs', () => {
      // Arrange
      const handler = new TokenHandler(DEFAULT_SYSTEM_PROMPT);
      const testCases = [
        { input: 'Hello', expected: 2, description: '5 chars / 4 = 1.25, ceil to 2' },
        { input: 'Hello world', expected: 3, description: '11 chars / 4 = 2.75, ceil to 3' },
        { input: '', expected: 0, description: 'Empty string should be 0 tokens' },
        { input: 'a'.repeat(100), expected: 25, description: '100 chars / 4 = 25' }
      ];

      // Act & Assert
      testCases.forEach(({ input, expected }) => {
        expect(handler.countTokens(input)).toBe(expected);
      });
    });

    it('should use the gpt-tokenizer encode function', () => {
      // Arrange
      const handler = new TokenHandler(DEFAULT_SYSTEM_PROMPT);
      const testText = 'Test text';
      const encodeSpy = jest.requireMock('gpt-tokenizer').encode;

      // Act
      handler.countTokens(testText);

      // Assert
      expect(encodeSpy).toHaveBeenCalledWith(testText);
    });
  });

  describe('processFiles', () => {
    it('should process files within token limits', async () => {
      // Arrange
      const handler = new TokenHandler(DEFAULT_SYSTEM_PROMPT, DEFAULT_MAX_TOKENS);

      const files: FileInfo[] = [
        { filename: 'file1.ts', patch: 'patch content 1' },
        { filename: 'file2.ts', patch: 'patch content 2' }
      ];

      // Act
      const result = await handler.processFiles(files);

      // Assert
      expect(result).toContain('file1.ts');
      expect(result).toContain('File:');
    });

    it('should handle files that exceed soft threshold', async () => {
      // Arrange
      const smallMaxTokens = 100;
      const customConfig = {
        OUTPUT_BUFFER_TOKENS_SOFT_THRESHOLD: 30, // Higher value (more lenient)
        OUTPUT_BUFFER_TOKENS_HARD_THRESHOLD: 20  // Lower value (more restrictive)
      };
      const handler = new TokenHandler(DEFAULT_SYSTEM_PROMPT, smallMaxTokens, customConfig);

      // Create a file that will exceed the soft threshold
      const files: FileInfo[] = [
        { filename: 'large.ts', patch: 'a'.repeat(400) } // ~100 tokens
      ];

      // Act
      const result = await handler.processFiles(files);

      // Assert
      expect(result).toContain('large.ts');
      expect(result).toContain('File:');
    });

    it('should skip files that exceed hard threshold (except first file)', async () => {
      // Arrange
      const smallMaxTokens = 100;
      const customConfig = {
        OUTPUT_BUFFER_TOKENS_SOFT_THRESHOLD: 30,
        OUTPUT_BUFFER_TOKENS_HARD_THRESHOLD: 20 
      };

      // Create files where the second will exceed the hard threshold
      const files: FileInfo[] = [
        { filename: 'first.ts', patch: 'a'.repeat(40) },  // ~10 tokens
        { filename: 'second.ts', patch: 'a'.repeat(400) } // ~100 tokens
      ];

      // Set the promptTokens to a high value to trigger the hard threshold
      // We do this by making the system prompt large
      const largeSystemPrompt = 'a'.repeat(280); // This will create ~70 tokens
      const handlerWithLargePrompt = new TokenHandler(largeSystemPrompt, smallMaxTokens, customConfig);

      // Act
      const result = await handlerWithLargePrompt.processFiles(files);

      // Assert
      expect(result).toContain('first.ts');

      // Should skip the second file and list it as remaining
      expect(result).toContain('Additional modified files');
      expect(result).toContain('second.ts');
    });

    it('should always process at least one file, even if it exceeds limits', async () => {
      // Arrange
      const verySmallMaxTokens = 50;
      const customConfig = {
        OUTPUT_BUFFER_TOKENS_SOFT_THRESHOLD: 20,
        OUTPUT_BUFFER_TOKENS_HARD_THRESHOLD: 10  
      };
      const handler = new TokenHandler(DEFAULT_SYSTEM_PROMPT, verySmallMaxTokens, customConfig);

      // Create a file that will exceed both thresholds
      const files: FileInfo[] = [
        { filename: 'large.ts', patch: 'a'.repeat(400) } // ~100 tokens
      ];

      // Act
      const result = await handler.processFiles(files);

      // Assert
      // Should include the file
      expect(result).toContain('large.ts');
      expect(result).toContain('File:');

      // Verify that we're processing the file despite exceeding limits
      const promptTokens = Math.ceil(DEFAULT_SYSTEM_PROMPT.length / 4);
      const availableTokens = verySmallMaxTokens - customConfig.OUTPUT_BUFFER_TOKENS_SOFT_THRESHOLD - promptTokens;
      expect(availableTokens).toBeLessThan(Math.ceil(files[0].patch!.length / 4));
    });

    it('should handle empty file list', async () => {
      // Arrange
      const handler = new TokenHandler(DEFAULT_SYSTEM_PROMPT);

      // Act
      const result = await handler.processFiles([]);

      // Assert
      expect(result).toBe('No files to process');
    });

    it('should handle cases where all files exceed hard threshold', async () => {
      // Arrange
      const smallMaxTokens = 100;
      const largeSystemPrompt = 'a'.repeat(380); // ~95 tokens
      const customConfig = {
        OUTPUT_BUFFER_TOKENS_SOFT_THRESHOLD: 20,
        OUTPUT_BUFFER_TOKENS_HARD_THRESHOLD: 10  
      };
      const handler = new TokenHandler(largeSystemPrompt, smallMaxTokens, customConfig);

      // Create files that will all exceed the hard threshold
      const files: FileInfo[] = [
        { filename: 'file1.ts', patch: 'a'.repeat(400) }, // ~100 tokens
        { filename: 'file2.ts', patch: 'a'.repeat(200) }  // ~50 tokens
      ];

      // Act
      const result = await handler.processFiles(files);

      // Assert
      // Should include information about remaining files
      expect(result).toContain('Additional modified files');
      expect(result).toContain('file1.ts');
    });
  });
});
