export interface parsedPatchesInterface {
 file: string; 
 line: number; 
 content: string; 
 type: 'added' | 'removed'
} []