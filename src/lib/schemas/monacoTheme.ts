import { z } from 'zod';

const MonacoThemeRuleSchema = z.object({
  token: z.string(),
  foreground: z.string().optional(),
  background: z.string().optional(),
  fontStyle: z.string().optional()
});

export const MonacoThemeDataSchema = z.object({
  base: z.enum(['vs', 'vs-dark', 'hc-black']).optional(),
  inherit: z.boolean().optional(),
  rules: z.array(MonacoThemeRuleSchema).optional(),
  colors: z.record(z.string(), z.string()).optional()
});

export type MonacoThemeData = z.infer<typeof MonacoThemeDataSchema>;

export function parseMonacoThemeData(payload: string): MonacoThemeData {
  const parsedJson = JSON.parse(payload) as unknown;
  return MonacoThemeDataSchema.parse(parsedJson);
}
