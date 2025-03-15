export function decodeBase64(input: string): string {
 // Remove any line breaks or whitespace that might be present in the input
 const cleanInput = input.replace(/[\n\r\s]/g, '');
 
 return Buffer.from(cleanInput, 'base64').toString('utf-8');
}

export function extendPatch(
 originalFileStr: string,
 patchStr: string,
 patchExtraLinesBefore = 0,
 patchExtraLinesAfter = 0,
 filename: string = ""
): string {
 if (
   !patchStr ||
   (patchExtraLinesBefore === 0 && patchExtraLinesAfter === 0) ||
   !originalFileStr
 ) {
   return patchStr;
 }

 originalFileStr = decodeBase64(originalFileStr);

 try {
   const extendedPatchStr = processPatchLines(
     patchStr,
     originalFileStr,
     patchExtraLinesBefore,
     patchExtraLinesAfter
   );
   return extendedPatchStr;
 } catch (e: any) {
   throw new Error(`Error processing patch for file ${filename}: ${e.message}`);
 }
}

export function processPatchLines(
 patchStr: string,
 originalFileStr: string,
 extraBefore: number,
 extraAfter: number
): string {
 const MAX_EXTRA_LINES = 10;
 extraBefore = Math.min(extraBefore, MAX_EXTRA_LINES);
 extraAfter = Math.min(extraAfter, MAX_EXTRA_LINES);

 const originalLines = originalFileStr.split("\n");
 const patchLines = patchStr.split("\n");
 const extendedPatchLines: string[] = [];
 let i = 0;

 while (i < patchLines.length) {
   const line = patchLines[i];
   const hunkHeaderMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
   if (hunkHeaderMatch) {
     const oldStart = parseInt(hunkHeaderMatch[1], 10);
     const oldCount = hunkHeaderMatch[2] ? parseInt(hunkHeaderMatch[2], 10) : 1;
     const newStart = parseInt(hunkHeaderMatch[3], 10);
     const newCount = hunkHeaderMatch[4] ? parseInt(hunkHeaderMatch[4], 10) : 1;

     const extendedOldStart = Math.max(1, oldStart - extraBefore);
     const extraLinesBeforeCount = oldStart - extendedOldStart;
     const extendedOldCount = oldCount + extraLinesBeforeCount + extraAfter;

     const extendedHunkHeader = `@@ -${extendedOldStart},${extendedOldCount} +${newStart},${newCount} @@`;
     extendedPatchLines.push(extendedHunkHeader);

     // Add extra context lines before the hunk.
     for (let j = extendedOldStart - 1; j < oldStart - 1; j++) {
       if (j >= 0 && j < originalLines.length) {
         extendedPatchLines.push(" " + originalLines[j]);
       }
     }

     i++;
     while (i < patchLines.length && !patchLines[i].startsWith("@@")) {
       extendedPatchLines.push(patchLines[i]);
       i++;
     }

     // Add extra context lines after the hunk.
     const hunkEndIndex = oldStart - 1 + oldCount;
     for (let j = hunkEndIndex; j < hunkEndIndex + extraAfter; j++) {
       if (j >= 0 && j < originalLines.length) {
         extendedPatchLines.push(" " + originalLines[j]);
       }
     }
   } else {
     extendedPatchLines.push(line);
     i++;
   }
 }
 return extendedPatchLines.join("\n");
}

