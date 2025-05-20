import { z } from 'zod';

export const githubAccountSchema = z.object({
  login: z.string(),
});

export const githubInstallationSchema = z.object({
  id: z.number(),
  account: githubAccountSchema,
});

export const githubInstallationsSchema = z.array(githubInstallationSchema);

export const githubUserSchema = z.object({
  login: z.string(),
  id: z.number(),
  avatar_url: z.string().optional(),
  html_url: z.string().optional(),
  type: z.string().optional(),
});

export const githubRepoSchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string().optional(),
  owner: githubUserSchema.optional(),
});

export const githubCommitRefSchema = z.object({
  sha: z.string(),
  ref: z.string(),
  label: z.string().optional(),
  repo: githubRepoSchema.optional(),
});

export const githubPullRequestSchema = z.object({
  title: z.string(),
  body: z.string().nullable(),
  number: z.number(),
  state: z.string(),
  merged: z.boolean().optional(),
  url: z.string(),
  id: z.number(),
  html_url: z.string(),
  diff_url: z.string(),
  patch_url: z.string(),
  node_id: z.string().optional(),
  user: githubUserSchema.optional(),
  head: githubCommitRefSchema.optional(),
  base: githubCommitRefSchema.optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  closed_at: z.string().nullable().optional(),
  merged_at: z.string().nullable().optional(),
  commits: z.number().optional(),
  additions: z.number().optional(),
  deletions: z.number().optional(),
  changed_files: z.number().optional(),
});

export const githubFileChangeSchema = z.object({
  filename: z.string(),
  status: z.string(),
  additions: z.number().optional(),
  deletions: z.number().optional(),
  changes: z.number().optional(),
  patch: z.string().optional(),
});

export const githubCommitComparisonSchema = z.object({
  files: z.array(githubFileChangeSchema).optional(),
  merge_base_commit: z.object({
    sha: z.string(),
  }),
});

export const githubPullRequestCommentSchema = z.object({
  id: z.number(),
  body: z.string().nullable(),
  user: githubUserSchema.optional(),
  created_at: z.string(),
  updated_at: z.string(),
  in_reply_to_id: z.number().optional(),
  path: z.string().optional(),
  commit_id: z.string().optional(),
  pull_request_review_id: z.number().nullable().optional(),
  position: z.number().optional(),
  line: z.number().optional(),
  side: z.string().optional(),
  diff_hunk: z.string().optional(),
  original_position: z.number().optional(),
  start_line: z.number().nullable().optional(),
  original_line: z.number().optional(),
  subject_type: z.string().optional(),
});

export type GitHubPullRequest = z.infer<typeof githubPullRequestSchema>;
export type GitHubPullRequestComment = z.infer<typeof githubPullRequestCommentSchema>;
export type GitHubFileChange = z.infer<typeof githubFileChangeSchema>;
export type GitHubCommitComparison = z.infer<typeof githubCommitComparisonSchema>;
export type GitHubUser = z.infer<typeof githubUserSchema>;
export type GitHubRepo = z.infer<typeof githubRepoSchema>;
export type GitHubCommitRef = z.infer<typeof githubCommitRefSchema>;
export type GitHubInstallation = z.infer<typeof githubInstallationSchema>;
