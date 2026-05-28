export const isDebugEnabled = (flag: string) =>
  process.env[flag] === 'true' || process.env[flag] === '1';
