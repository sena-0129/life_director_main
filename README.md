<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/41b65982-de02-4766-af93-4da699e84c5c

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create `.env.local` (参考 `.env.example`) 并设置：
   - `GEMINI_API_KEY`（对话/TTS）
   - `API_KEY`（图片/视频，可与上面相同）
3. 启动后端（默认 3001）：
   `npm run server:dev`
4. 启动前端（默认 3000，会把 `/api` 代理到后端）：
   `npm run dev`

## 上传文件（存数据库）

后端提供 `POST /api/uploads`：
- 如果配置了 `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`：文件存 Supabase Storage（bucket: `uploads`），元数据存 Supabase 的 `public.uploads` 表。
- 否则：文件保存到 `UPLOADS_DIR`（默认 `./data/uploads`），元数据写入本地 SQLite 的 `uploads` 表。
