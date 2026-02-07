/**
 * Comments Section
 * 1 field for additional comments
 */

export interface CommentsInfo {
  comments?: string;
}

export const COMMENTS_FIELDS = [
  'comments',
] as const;
