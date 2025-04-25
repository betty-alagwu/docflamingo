import { encode } from 'gpt-tokenizer';

export interface TokenConfig {
  OUTPUT_BUFFER_TOKENS_SOFT_THRESHOLD: number;
  OUTPUT_BUFFER_TOKENS_HARD_THRESHOLD: number;
  MAX_EXTRA_LINES: number;
}

export interface FileInfo {
  filename: string;
  patch?: string;
  tokens?: number;
}

export class TokenHandler {
  private promptTokens: number;
  private maxTokens: number;
  private config: TokenConfig;

  constructor(systemPrompt: string, maxTokens: number = 4000, config?: Partial<TokenConfig>) {
    this.promptTokens = this.countTokens(systemPrompt);
    this.maxTokens = maxTokens;
    this.config = {
      OUTPUT_BUFFER_TOKENS_SOFT_THRESHOLD: 3000, // Higher value (more lenient)
      OUTPUT_BUFFER_TOKENS_HARD_THRESHOLD: 2000, // Lower value (more restrictive)
      MAX_EXTRA_LINES: 10,
      ...config
    };
  }

  public countTokens(text: string): number {
    return encode(text).length;
  }

  public async processFiles(files: FileInfo[]): Promise<string> {
    const patches: string[] = [];
    let totalTokens = this.promptTokens; // Start with tokens from system prompt
    const remainingFiles: string[] = [];
    let processedAtLeastOneFile = false;

    if (files.length === 0) {
      return 'No files to process';
    }

    // Sort files by size (smallest first) to maximize the number of files we can process
    const sortedFiles = [...files].sort((a, b) => {
      const aTokens = a.patch ? this.countTokens(a.patch) : 0;
      const bTokens = b.patch ? this.countTokens(b.patch) : 0;
      return aTokens - bTokens;
    });

    for (const file of sortedFiles) {
      if (!file.patch) continue;

      // Count tokens for this file's patch
      const patchWithHeader = this.formatPatchWithHeader(file);
      const patchTokens = this.countTokens(patchWithHeader);

      // Always process at least one file, even if it exceeds the soft limit
      const isFirstFile = !processedAtLeastOneFile;

      // Check if we're hitting hard token limit (stricter threshold)
      // Hard threshold is lower than soft threshold (more restrictive)
      if (totalTokens > this.maxTokens - this.config.OUTPUT_BUFFER_TOKENS_HARD_THRESHOLD && !isFirstFile) {
        remainingFiles.push(file.filename);
        continue;
      }

      // Check if adding this patch would exceed soft token limit (more lenient threshold, higher value)
      if (totalTokens + patchTokens > this.maxTokens - this.config.OUTPUT_BUFFER_TOKENS_SOFT_THRESHOLD) {
        // Try to clip the patch
        const availableTokens = this.maxTokens - this.config.OUTPUT_BUFFER_TOKENS_SOFT_THRESHOLD - totalTokens;
        const clippedPatch = await this.clipPatch(file.patch, availableTokens);

        const clippedPatchTokens = this.countTokens(clippedPatch);
        if (totalTokens + clippedPatchTokens <= this.maxTokens - this.config.OUTPUT_BUFFER_TOKENS_SOFT_THRESHOLD || isFirstFile) {
          // For the first file, we'll add it even if it exceeds the soft limit
          patches.push(this.formatPatchWithHeader({ ...file, patch: clippedPatch }));
          totalTokens += clippedPatchTokens;
          processedAtLeastOneFile = true;
          continue;
        }

        // If we're here and it's the first file, we need to clip it even more aggressively
        if (isFirstFile) {
          // Use hard threshold (more restrictive) for the first file if needed
          // This is our last resort before emergency mode
          const hardAvailableTokens = this.maxTokens - this.config.OUTPUT_BUFFER_TOKENS_HARD_THRESHOLD - totalTokens;
          const heavilyClippedPatch = await this.clipPatch(file.patch, hardAvailableTokens);
          const heavilyClippedTokens = this.countTokens(heavilyClippedPatch);

          patches.push(this.formatPatchWithHeader({ ...file, patch: heavilyClippedPatch }));
          totalTokens += heavilyClippedTokens;
          processedAtLeastOneFile = true;
          continue;
        }

        remainingFiles.push(file.filename);
        continue;
      }

      // If we reach here, we can safely add the patch
      patches.push(patchWithHeader);
      totalTokens += patchTokens;
      processedAtLeastOneFile = true;
    }

    // If we still haven't processed any files, take the smallest file and clip it aggressively
    if (!processedAtLeastOneFile && sortedFiles.length > 0) {
      const smallestFile = sortedFiles[0];
      if (smallestFile.patch) {
        // Use a very small token budget to ensure we get at least something
        // In emergency mode, we use the hard threshold (more restrictive)
        const emergencyTokenBudget = Math.min(
          this.maxTokens - this.config.OUTPUT_BUFFER_TOKENS_HARD_THRESHOLD - totalTokens,
          1000 // Absolute maximum in emergency mode
        );

        const emergencyClippedPatch = await this.clipPatch(smallestFile.patch, emergencyTokenBudget);
        const emergencyTokens = this.countTokens(emergencyClippedPatch);

        patches.push(this.formatPatchWithHeader({ ...smallestFile, patch: emergencyClippedPatch }));
      }
    }

    // Add information about remaining files if any
    if (remainingFiles.length > 0) {
      const remainingFilesMessage = this.formatRemainingFilesMessage(remainingFiles);
      patches.push(remainingFilesMessage);
    }

    const result = patches.join('\n\n');
    return result;
  }

  /**
   * Clip a patch to fit within a token limit.
   * @param patch The patch to clip.
   * @param maxTokens The maximum number of tokens allowed.
   * @returns The clipped patch.
   */
  private async clipPatch(patch: string, maxTokens: number): Promise<string> {
    const lines = patch.split('\n');

    // If we have very few tokens available, just return the patch header
    if (maxTokens < 100 && lines.length > 0) {
      // Find the first patch header line
      const headerIndex = lines.findIndex(line => line.startsWith('@@ '));
      if (headerIndex >= 0) {
        return lines[headerIndex] + '\n\n[Patch severely truncated due to token limit]';
      }
      return '[Patch could not be included due to token limit]';
    }

    // Prioritize added lines (starting with '+') as they're more important for review
    const addedLines: {line: string, index: number}[] = [];
    const contextLines: {line: string, index: number}[] = [];

    // Separate added lines from context lines
    lines.forEach((line, index) => {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        addedLines.push({line, index});
      } else if (!line.startsWith('-') && !line.startsWith('---')) {
        contextLines.push({line, index});
      }
    });

    // Start with the patch header if it exists
    let clippedPatch = '';
    let currentTokens = 0;

    // Find and add the patch header
    const headerIndex = lines.findIndex(line => line.startsWith('@@ '));
    if (headerIndex >= 0) {
      clippedPatch = lines[headerIndex] + '\n';
      currentTokens = this.countTokens(clippedPatch);
    }

    // First add all added lines until we hit the token limit
    const includedLineIndices = new Set<number>();

    for (const {line, index} of addedLines) {
      const lineTokens = this.countTokens(line + '\n');
      if (currentTokens + lineTokens <= maxTokens) {
        clippedPatch += line + '\n';
        currentTokens += lineTokens;
        includedLineIndices.add(index);
      } else {
        break;
      }
    }

    // Then add context lines if we have tokens left
    for (const {line, index} of contextLines) {
      // Skip lines we've already included
      if (includedLineIndices.has(index)) continue;

      const lineTokens = this.countTokens(line + '\n');
      if (currentTokens + lineTokens <= maxTokens) {
        clippedPatch += line + '\n';
        currentTokens += lineTokens;
      } else {
        break;
      }
    }

    return clippedPatch + '\n[Patch truncated due to token limit]';
  }

  private formatPatchWithHeader(file: FileInfo): string {
    return `File: '${file.filename.trim()}'\n${file.patch?.trim()}`;
  }

  private formatRemainingFilesMessage(files: string[]): string {
    return `\n\nAdditional modified files (insufficient token budget to process):\n${
      files.map(f => `- ${f}`).join('\n')
    }`;
  }
}