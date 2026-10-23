import { z } from 'zod';

// Formato de erro da API (RFC 7807, application/problem+json). O frontend e o MCP leem
// qualquer erro da mesma forma, venha ele de onde vier.
export const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  detail: z.string().optional(),
});

export type Problem = z.infer<typeof problemSchema>;
