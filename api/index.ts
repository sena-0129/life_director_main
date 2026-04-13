export default async function handler(req: any, res: any) {
  try {
    const mod = await import('./app');
    return mod.default(req, res);
  } catch (e: any) {
    res.status(500).json({
      error: 'FUNCTION_BOOT_FAILED',
      message: e?.message || String(e),
      name: e?.name,
      stack: typeof e?.stack === 'string' ? e.stack.split('\n').slice(0, 12).join('\n') : undefined,
      git: process.env.VERCEL_GIT_COMMIT_SHA || null,
    });
  }
}

