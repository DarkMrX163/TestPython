import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express, { type Request, type Response } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

interface SessionRecord {
  accessToken: string;
  user: GitHubUser;
  createdAt: number;
}

const sessions = new Map<string, SessionRecord>();
const oauthStates = new Map<string, number>();

const SESSION_COOKIE = 'pyterm_gh_session';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  path: '/',
  maxAge: 1000 * 60 * 60 * 24 * 7,
};

function getBaseUrl(): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl && envUrl !== 'MY_APP_URL') {
    return envUrl.replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}

function getCallbackUrl(): string {
  return `${getBaseUrl()}/auth/github/callback`;
}

function getSession(req: Request): SessionRecord | null {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (!sid || typeof sid !== 'string') return null;
  return sessions.get(sid) ?? null;
}

function cleanExpiredStates(): void {
  const now = Date.now();
  for (const [state, createdAt] of oauthStates.entries()) {
    if (now - createdAt > 1000 * 60 * 15) {
      oauthStates.delete(state);
    }
  }
}

async function createServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // 1. GitHub configuration check
  app.get('/api/github/config', (_req: Request, res: Response) => {
    const configured = Boolean(
      process.env.GITHUB_CLIENT_ID?.trim() && process.env.GITHUB_CLIENT_SECRET?.trim()
    );
    res.json({
      configured,
      callbackUrl: getCallbackUrl(),
    });
  });

  // 2. Construct GitHub OAuth authorization URL
  app.get('/api/auth/github/url', (_req: Request, res: Response) => {
    const clientId = process.env.GITHUB_CLIENT_ID?.trim();
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
      res.status(503).json({
        error: 'GitHub OAuth не настроен на сервере. Добавьте GITHUB_CLIENT_ID и GITHUB_CLIENT_SECRET в переменные окружения.',
      });
      return;
    }

    cleanExpiredStates();
    const state = crypto.randomBytes(20).toString('hex');
    oauthStates.set(state, Date.now());

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: getCallbackUrl(),
      scope: 'gist read:user',
      state,
    });

    res.json({
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
    });
  });

  // 3. GitHub OAuth callback (handles both with and without trailing slash)
  const handleOAuthCallback = async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const errorParam = typeof req.query.error === 'string' ? req.query.error : '';

    const renderPopupResponse = (payload: Record<string, unknown>, message: string) => {
      const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(`<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>GitHub авторизация — PyTerm</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #0d1117;
        color: #e6edf3;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        padding: 24px;
        text-align: center;
      }
      .box {
        max-width: 420px;
        border: 1px solid #30363d;
        background: #161b22;
        padding: 24px;
        border-radius: 8px;
      }
    </style>
  </head>
  <body>
    <div class="box">
      <p>${message}</p>
    </div>
    <script>
      try {
        if (window.opener) {
          window.opener.postMessage(${safeJson}, '*');
          setTimeout(function() { window.close(); }, 350);
        } else {
          window.location.href = '/';
        }
      } catch (e) {
        window.location.href = '/';
      }
    </script>
  </body>
</html>`);
    };

    if (errorParam) {
      renderPopupResponse(
        { type: 'OAUTH_AUTH_ERROR', error: 'Авторизация в GitHub была отменена.' },
        'Авторизация отменена. Окно закроется автоматически.'
      );
      return;
    }

    if (!code || !state || !oauthStates.has(state)) {
      renderPopupResponse(
        { type: 'OAUTH_AUTH_ERROR', error: 'Недействительный код или параметр state.' },
        'Ошибка проверки безопасности OAuth. Попробуйте ещё раз.'
      );
      return;
    }

    oauthStates.delete(state);

    const clientId = process.env.GITHUB_CLIENT_ID?.trim();
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
      renderPopupResponse(
        { type: 'OAUTH_AUTH_ERROR', error: 'Сервер не настроен для GitHub OAuth.' },
        'Ошибка конфигурации сервера.'
      );
      return;
    }

    try {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: getCallbackUrl(),
        }),
      });

      const tokenData = (await tokenRes.json()) as {
        access_token?: string;
        error_description?: string;
        error?: string;
      };

      if (!tokenData.access_token) {
        renderPopupResponse(
          {
            type: 'OAUTH_AUTH_ERROR',
            error: tokenData.error_description || tokenData.error || 'Не удалось получить токен GitHub.',
          },
          'Не удалось получить токен GitHub. Закройте окно и попробуйте снова.'
        );
        return;
      }

      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'PyTerm-Quiz-App',
        },
      });

      if (!userRes.ok) {
        renderPopupResponse(
          { type: 'OAUTH_AUTH_ERROR', error: 'Не удалось загрузить профиль GitHub.' },
          'Не удалось загрузить профиль GitHub.'
        );
        return;
      }

      const ghUser = (await userRes.json()) as GitHubUser;
      const user: GitHubUser = {
        id: ghUser.id,
        login: ghUser.login,
        name: ghUser.name,
        avatar_url: ghUser.avatar_url,
        html_url: ghUser.html_url,
      };

      const sessionId = crypto.randomBytes(24).toString('hex');
      sessions.set(sessionId, {
        accessToken: tokenData.access_token,
        user,
        createdAt: Date.now(),
      });

      res.cookie(SESSION_COOKIE, sessionId, COOKIE_OPTIONS);
      renderPopupResponse(
        { type: 'OAUTH_AUTH_SUCCESS', user },
        `Подключено как @${user.login}. Окно закроется автоматически...`
      );
    } catch (err) {
      console.error('GitHub OAuth callback failed:', err);
      renderPopupResponse(
        { type: 'OAUTH_AUTH_ERROR', error: 'Сетевая ошибка при подключении к GitHub.' },
        'Сетевая ошибка при подключении к GitHub.'
      );
    }
  };

  app.get(['/auth/github/callback', '/auth/github/callback/'], handleOAuthCallback);

  // 4. Current GitHub session status
  app.get('/api/github/me', (req: Request, res: Response) => {
    const session = getSession(req);
    if (!session) {
      res.json({ connected: false, user: null });
      return;
    }
    res.json({ connected: true, user: session.user });
  });

  // 5. Disconnect GitHub session
  app.post('/api/github/disconnect', (req: Request, res: Response) => {
    const sid = req.cookies?.[SESSION_COOKIE];
    if (sid && typeof sid === 'string') {
      sessions.delete(sid);
    }
    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
    });
    res.json({ ok: true });
  });

  // 6. Save results to GitHub Gist (create or update)
  app.post('/api/github/save-results', async (req: Request, res: Response) => {
    const session = getSession(req);
    if (!session) {
      res.status(401).json({ error: 'Сначала подключите аккаунт GitHub.' });
      return;
    }

    const { progress, markdownReport, gistId, isPublic } = req.body as {
      progress?: unknown;
      markdownReport?: string;
      gistId?: string | null;
      isPublic?: boolean;
    };

    if (!progress || typeof markdownReport !== 'string') {
      res.status(400).json({ error: 'Некорректные данные прогресса для сохранения.' });
      return;
    }

    const description = `PyTerm: прогресс и достижения по Python (@${session.user.login})`;
    const files = {
      'python-quiz-report.md': { content: markdownReport },
      'pyterm-progress.json': { content: JSON.stringify(progress, null, 2) },
    };

    const ghHeaders = {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'PyTerm-Quiz-App',
    };

    try {
      let response: globalThis.Response;

      if (gistId && typeof gistId === 'string') {
        response = await fetch(`https://api.github.com/gists/${encodeURIComponent(gistId)}`, {
          method: 'PATCH',
          headers: ghHeaders,
          body: JSON.stringify({ description, files }),
        });

        // If previously saved gist was deleted on GitHub, create a fresh one
        if (response.status === 404) {
          response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: ghHeaders,
            body: JSON.stringify({
              description,
              public: Boolean(isPublic),
              files,
            }),
          });
        }
      } else {
        response = await fetch('https://api.github.com/gists', {
          method: 'POST',
          headers: ghHeaders,
          body: JSON.stringify({
            description,
            public: Boolean(isPublic),
            files,
          }),
        });
      }

      if (!response.ok) {
        const errText = await response.text();
        console.error('GitHub Gist save error:', response.status, errText);
        res.status(response.status).json({
          error: 'GitHub отклонил запрос на сохранение Gist. Попробуйте переподключить аккаунт.',
        });
        return;
      }

      const data = (await response.json()) as {
        id: string;
        html_url: string;
        updated_at: string;
        public: boolean;
      };

      res.json({
        gistId: data.id,
        gistUrl: data.html_url,
        updatedAt: data.updated_at,
        isPublic: data.public,
      });
    } catch (err) {
      console.error('Error saving Gist:', err);
      res.status(500).json({ error: 'Не удалось связаться с GitHub API.' });
    }
  });

  // 7. List saved PyTerm Gists
  app.get('/api/github/gists', async (req: Request, res: Response) => {
    const session = getSession(req);
    if (!session) {
      res.status(401).json({ error: 'Сначала подключите аккаунт GitHub.' });
      return;
    }

    try {
      const response = await fetch('https://api.github.com/gists?per_page=30', {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'PyTerm-Quiz-App',
        },
      });

      if (!response.ok) {
        res.status(response.status).json({ error: 'Не удалось получить список Gist с GitHub.' });
        return;
      }

      const gists = (await response.json()) as Array<{
        id: string;
        html_url: string;
        description: string | null;
        updated_at: string;
        public: boolean;
        files: Record<string, { filename: string }>;
      }>;

      const pytermGists = gists
        .filter((g) => Boolean(g.files && g.files['pyterm-progress.json']))
        .map((g) => ({
          id: g.id,
          url: g.html_url,
          description: g.description || 'PyTerm прогресс',
          updatedAt: g.updated_at,
          isPublic: g.public,
        }));

      res.json({ gists: pytermGists });
    } catch (err) {
      console.error('Error fetching gists:', err);
      res.status(500).json({ error: 'Ошибка сети при обращении к GitHub.' });
    }
  });

  // 8. Load a saved PyTerm Gist to restore progress
  app.get('/api/github/gists/:id', async (req: Request, res: Response) => {
    const session = getSession(req);
    if (!session) {
      res.status(401).json({ error: 'Сначала подключите аккаунт GitHub.' });
      return;
    }

    const gistId = String(req.params.id ?? '');
    if (!gistId) {
      res.status(400).json({ error: 'Не указан идентификатор Gist.' });
      return;
    }

    try {
      const response = await fetch(`https://api.github.com/gists/${encodeURIComponent(gistId)}`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'PyTerm-Quiz-App',
        },
      });

      if (!response.ok) {
        res.status(response.status).json({ error: 'Не удалось загрузить Gist с GitHub.' });
        return;
      }

      const data = (await response.json()) as {
        id: string;
        html_url: string;
        updated_at: string;
        files: Record<string, { content?: string }>;
      };

      const file = data.files?.['pyterm-progress.json'];
      if (!file?.content) {
        res.status(404).json({ error: 'Файл pyterm-progress.json не найден в этом Gist.' });
        return;
      }

      const progress = JSON.parse(file.content);
      res.json({
        gistId: data.id,
        gistUrl: data.html_url,
        updatedAt: data.updated_at,
        progress,
      });
    } catch (err) {
      console.error('Error loading gist:', err);
      res.status(500).json({ error: 'Ошибка при загрузке данных из Gist.' });
    }
  });

  // Mount Vite middleware in development or serve built dist/ in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PyTerm server running on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
