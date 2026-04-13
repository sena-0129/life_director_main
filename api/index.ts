import baseHandler from '../server/vercelApiHandler';

export default async function handler(req: any, res: any) {
  try {
    return await Promise.resolve(baseHandler(req, res));
  } catch (e: any) {
    res.status(500).json({
      error: 'FUNCTION_RUNTIME_FAILED',
      message: e?.message || String(e),
      name: e?.name,
      stack: typeof e?.stack === 'string' ? e.stack.split('\n').slice(0, 12).join('\n') : undefined,
      git: process.env.VERCEL_GIT_COMMIT_SHA || null,
    });
  }
}
