# Backend API

Base URL: `/api`

## Health

- `GET /api/health`

## Profiles

- `GET /api/profiles`
- `POST /api/profiles`
  - body: `LifeProfile`
- `GET /api/profiles/:id`
- `PUT /api/profiles/:id`
  - body: partial `LifeProfile` (without `id`)
- `DELETE /api/profiles/:id`

## Stories

- `GET /api/profiles/:id/stories`
- `POST /api/profiles/:id/stories`
  - body: `LifeStory` without `id`/`profileId`
- `GET /api/stories/:id`
- `PUT /api/stories/:id`
- `DELETE /api/stories/:id`

## AI

- `POST /api/ai/chat`
  - body: `{ message: string, history?: any[] }`
  - resp: `{ text: string }`

- `POST /api/ai/tts`
  - body: `{ text: string }`
  - resp: `{ audioDataUrl: string | null }`

## RAG

- `POST /api/rag/run`
  - body: `{ userId: string, userInput: string, topK?: number }`
  - resp: `{ original: string, enhanced: string, relatedStories: any[], meta: any }`

- `POST /api/ai/video`
  - body: `{ prompt: string, imageDataUrl?: string, aspectRatio?: "16:9" | "9:16" }`
  - resp: `{ videoUrl: string | null }`

- `GET /api/ai/video/:id`
  - resp: `video/mp4`

## Auth (Optional)

If `BACKEND_TOKEN` is set on the backend, all `/api/*` (except `/api/health`) require:

- header: `Authorization: Bearer <BACKEND_TOKEN>`

## Uploads

- `POST /api/uploads`
  - content-type: `multipart/form-data`
  - form fields:
    - `file` (required)
    - `profileId` (optional, if you want to bind upload to a profile)
  - resp: upload metadata

Note: image uploads are disabled.

- `GET /api/uploads`
  - optional query: `profileId`

- `GET /api/uploads/:id`

- `GET /api/uploads/:id/file`
  - resp: the binary file

- `DELETE /api/uploads/:id`

### Storage

If `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set, uploaded files are stored in Supabase Storage bucket `uploads` (and metadata in table `uploads`). Otherwise they are stored on disk under `UPLOADS_DIR`.
