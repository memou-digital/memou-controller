/**
 * GitHub REST API Service Client
 * Handles communication with @memou-templates and @memou-clients organizations.
 */

import { extractConfigFromScript, extractPhotoSlots, extractHtmlTitle, extractAudioTrack, extractPhotoCaptions } from './templateParser';

export interface GitHubRepoItem {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  defaultBranch: string;
  topics: string[];
  packageTier: 'BASIC' | 'PREMIUM' | 'DELUXE';
  thumbnailUrl: string | null;
  updatedAt: string;
}

export interface GitHubTemplateContent {
  owner: string;
  repo: string;
  title: string;
  config: Record<string, any> | null;
  configVarName: string | null;
  photoSlots: any[];
  images: { name: string; path: string; url: string; size: number }[];
  audio: { src: string; name: string; hasTag: boolean; isYouTube?: boolean; youtubeId?: string } | null;
  audioFiles: { name: string; path: string; url: string; size: number }[];
  rawFiles: {
    'index.html': string;
    'script.js': string;
    'style.css': string;
    'config.js'?: string;
    [key: string]: string | undefined;
  };
  fileShas: {
    'index.html'?: string;
    'script.js'?: string;
    'style.css'?: string;
    'config.js'?: string;
    [key: string]: string | undefined;
  };
}

export function getGithubConfig() {
  const token = process.env.GITHUB_TOKEN || '';
  const templatesOrg = process.env.GITHUB_TEMPLATES_ORG || 'memou-templates';
  const clientsOrg = process.env.GITHUB_CLIENTS_ORG || 'memou-clients';

  return { token, templatesOrg, clientsOrg };
}

function getHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'MEMOu-Controller-Studio',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/**
 * Verify GitHub Token and return authenticated user
 */
export async function verifyGithubToken(token?: string) {
  const activeToken = token || getGithubConfig().token;
  if (!activeToken) {
    return { ok: false, error: 'No GitHub token configured' };
  }

  try {
    const res = await fetch('https://api.github.com/user', {
      headers: getHeaders(activeToken),
    });

    if (!res.ok) {
      return { ok: false, status: res.status, error: 'Invalid GitHub token or expired' };
    }

    const user = await res.json();
    return { ok: true, user };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Failed to connect to GitHub' };
  }
}

/**
 * Detect package tier from repository name or topics
 */
function detectPackageTier(name: string, topics: string[] = []): 'BASIC' | 'PREMIUM' | 'DELUXE' {
  const lowerName = name.toLowerCase();
  const lowerTopics = topics.map((t) => t.toLowerCase());

  if (lowerTopics.includes('package-deluxe') || lowerTopics.includes('deluxe') || lowerName.includes('deluxe')) {
    return 'DELUXE';
  }
  if (lowerTopics.includes('package-premium') || lowerTopics.includes('premium') || lowerName.includes('premium')) {
    return 'PREMIUM';
  }
  return 'BASIC';
}

/**
 * List all template repositories from @memou-templates organization (or user repos)
 */
export async function listTemplateRepos(): Promise<{ ok: boolean; repos: GitHubRepoItem[]; error?: string }> {
  const { token, templatesOrg } = getGithubConfig();
  if (!token) {
    return { ok: false, repos: [], error: 'GITHUB_TOKEN belum diisi di .env.local' };
  }

  try {
    // Try fetching from organization first, fallback to user repos if org not found
    let url = `https://api.github.com/orgs/${templatesOrg}/repos?per_page=100&type=all`;
    let res = await fetch(url, { headers: getHeaders(token), cache: 'no-store' });

    if (res.status === 404) {
      // If organization not found, fetch authenticated user's repos
      url = 'https://api.github.com/user/repos?per_page=100&affiliation=owner';
      res = await fetch(url, { headers: getHeaders(token), cache: 'no-store' });
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, repos: [], error: err.message || 'Gagal memuat repositori GitHub' };
    }

    const rawRepos = await res.json();
    const repos: GitHubRepoItem[] = rawRepos
      .filter((r: any) => !r.fork)
      .map((r: any) => {
        const tier = detectPackageTier(r.name, r.topics);
        return {
          id: r.id,
          name: r.name,
          fullName: r.full_name,
          description: r.description,
          htmlUrl: r.html_url,
          defaultBranch: r.default_branch || 'main',
          topics: r.topics || [],
          packageTier: tier,
          thumbnailUrl: `/api/github/thumbnail/${r.full_name}?v=live_preview`,
          updatedAt: r.updated_at,
        };
      });

    return { ok: true, repos };
  } catch (err: any) {
    return { ok: false, repos: [], error: err.message || 'Network error connecting to GitHub' };
  }
}

/**
 * Fetch a single file content from GitHub repository (returns utf-8 string and sha)
 */
export async function getGithubFileContent(
  owner: string,
  repo: string,
  filePath: string,
  ref = 'main'
): Promise<{ content: string; sha: string } | null> {
  const { token } = getGithubConfig();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${ref}`;

  try {
    const res = await fetch(url, {
      headers: getHeaders(token),
      cache: 'no-store',
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.content) return null;

    // Decode base64 to utf-8 string
    const buffer = Buffer.from(data.content, 'base64');
    return {
      content: buffer.toString('utf-8'),
      sha: data.sha,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Fetch all files in assets/images folder from GitHub
 */
export async function listGithubImages(
  owner: string,
  repo: string,
  ref = 'main'
): Promise<{ name: string; path: string; url: string; size: number }[]> {
  const { token } = getGithubConfig();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/assets/images?ref=${ref}`;

  try {
    const res = await fetch(url, {
      headers: getHeaders(token),
      cache: 'no-store',
    });

    if (!res.ok) return [];

    const files = await res.json();
    if (!Array.isArray(files)) return [];

    return files
      .filter((f) => /\.(jpe?g|png|gif|webp|svg)$/i.test(f.name))
      .map((f) => ({
        name: f.name,
        path: f.path,
        url: f.download_url || `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${f.path}`,
        size: f.size || 0,
      }));
  } catch (e) {
    return [];
  }
}

/**
 * Fetch all audio files in assets/audio folder from GitHub
 */
export async function listGithubAudio(
  owner: string,
  repo: string,
  ref = 'main'
): Promise<{ name: string; path: string; url: string; size: number }[]> {
  const { token } = getGithubConfig();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/assets/audio?ref=${ref}`;

  try {
    const res = await fetch(url, {
      headers: getHeaders(token),
      cache: 'no-store',
    });

    if (!res.ok) return [];

    const files = await res.json();
    if (!Array.isArray(files)) return [];

    return files
      .filter((f) => /\.(mp3|m4a|wav|ogg|aac)$/i.test(f.name))
      .map((f) => ({
        name: f.name,
        path: f.path,
        url: f.download_url || `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${f.path}`,
        size: f.size || 0,
      }));
  } catch (e) {
    return [];
  }
}

/**
 * Load complete template data in-memory directly from GitHub
 */
export async function loadGithubTemplate(
  owner: string,
  repo: string,
  ref = 'main'
): Promise<GitHubTemplateContent | null> {
  const [indexFile, scriptFile, styleFile, configFile, images, audioFiles] = await Promise.all([
    getGithubFileContent(owner, repo, 'index.html', ref),
    getGithubFileContent(owner, repo, 'script.js', ref),
    getGithubFileContent(owner, repo, 'style.css', ref),
    getGithubFileContent(owner, repo, 'config.js', ref),
    listGithubImages(owner, repo, ref),
    listGithubAudio(owner, repo, ref),
  ]);

  if (!indexFile) return null;

  const htmlContent = indexFile.content;
  const scriptContent = scriptFile ? scriptFile.content : '';
  const styleContent = styleFile ? styleFile.content : '';
  const configContent = configFile ? configFile.content : '';

  const htmlTitle = extractHtmlTitle(htmlContent);
  let configInfo = extractConfigFromScript(scriptContent);
  if (!configInfo && configContent) {
    configInfo = extractConfigFromScript(configContent);
  }

  const photoSlots = extractPhotoSlots(htmlContent);
  const audio = extractAudioTrack(htmlContent, configInfo ? configInfo.config : null);

  // Auto-populate photo captions if not present in config
  const resolvedConfig = configInfo ? { ...configInfo.config } : null;
  if (resolvedConfig) {
    const detectedCaptions = extractPhotoCaptions(htmlContent);
    for (const [cKey, cVal] of Object.entries(detectedCaptions)) {
      if (resolvedConfig[cKey] === undefined) {
        resolvedConfig[cKey] = cVal;
      }
    }
  }

  return {
    owner,
    repo,
    title: htmlTitle,
    config: resolvedConfig,
    configVarName: configInfo ? configInfo.varName : null,
    photoSlots,
    images,
    audio,
    audioFiles,
    rawFiles: {
      'index.html': htmlContent,
      'script.js': scriptContent,
      'style.css': styleContent,
      ...(configFile ? { 'config.js': configContent } : {}),
    },
    fileShas: {
      'index.html': indexFile.sha,
      'script.js': scriptFile?.sha,
      'style.css': styleFile?.sha,
      ...(configFile ? { 'config.js': configFile.sha } : {}),
    },
  };
}

/**
 * Generate a new client repository from a template repository (GitHub Template API)
 */
export async function generateClientRepoFromTemplate(
  templateOwner: string,
  templateRepo: string,
  clientRepoName: string,
  description?: string
): Promise<{ ok: boolean; repo?: any; error?: string }> {
  const { token, clientsOrg } = getGithubConfig();
  if (!token) return { ok: false, error: 'No GitHub token configured' };

  const url = `https://api.github.com/repos/${templateOwner}/${templateRepo}/generate`;
  const cleanName = clientRepoName.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({
        owner: clientsOrg,
        name: cleanName,
        description: description || `Client celebration website created via MEMOu Studio`,
        include_all_branches: false,
        private: false,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      // Auto-heal: If template repository is not enabled as template, enable it automatically and retry!
      if (res.status === 404 || data.message?.includes('not a template') || data.message?.includes('Not Found')) {
        try {
          const patchRes = await fetch(`https://api.github.com/repos/${templateOwner}/${templateRepo}`, {
            method: 'PATCH',
            headers: getHeaders(token),
            body: JSON.stringify({ is_template: true }),
          });
          if (patchRes.ok) {
            const retryRes = await fetch(url, {
              method: 'POST',
              headers: getHeaders(token),
              body: JSON.stringify({
                owner: clientsOrg,
                name: cleanName,
                description: description || `Client celebration website created via MEMOu Studio`,
                include_all_branches: false,
                private: false,
              }),
            });
            const retryData = await retryRes.json();
            if (retryRes.ok) {
              return { ok: true, repo: retryData };
            }
          }
        } catch (healErr) {
          console.warn('Auto-heal is_template failed:', healErr);
        }
      }

      return { ok: false, error: data.message || 'Failed to generate client repository' };
    }

    return { ok: true, repo: data };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Error generating client repo' };
  }
}

/**
 * Commit a file to a repository on GitHub (Create or Update)
 */
export async function commitFileToGithub(
  owner: string,
  repo: string,
  filePath: string,
  contentBuffer: Buffer,
  message: string,
  sha?: string
): Promise<{ ok: boolean; commit?: any; error?: string }> {
  const { token } = getGithubConfig();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

  try {
    let targetSha = sha;

    // If sha is not provided, fetch current sha from GitHub
    if (!targetSha) {
      try {
        const getRes = await fetch(url, {
          headers: getHeaders(token),
          cache: 'no-store',
        });
        if (getRes.ok) {
          const fileData = await getRes.json();
          targetSha = fileData.sha;
        }
      } catch {
        // File may be new, no sha needed
      }
    }

    const payload: any = {
      message,
      content: contentBuffer.toString('base64'),
    };
    if (targetSha) payload.sha = targetSha;

    let res = await fetch(url, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(payload),
    });

    let data = await res.json();

    // If SHA conflict happens (is at X but expected Y, or 409 conflict), re-fetch latest SHA and retry once!
    if (!res.ok && (res.status === 409 || data.message?.includes('does not match') || data.message?.includes('is at'))) {
      try {
        const freshRes = await fetch(url, {
          headers: getHeaders(token),
          cache: 'no-store',
        });
        if (freshRes.ok) {
          const freshData = await freshRes.json();
          payload.sha = freshData.sha;
          res = await fetch(url, {
            method: 'PUT',
            headers: getHeaders(token),
            body: JSON.stringify(payload),
          });
          data = await res.json();
        }
      } catch (retryErr) {
        console.warn('Auto-retry with fresh sha failed:', retryErr);
      }
    }

    if (!res.ok) {
      return { ok: false, error: data.message || 'Failed to commit file to GitHub' };
    }

    return { ok: true, commit: data.commit };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Error committing file' };
  }
}

/**
 * Delete a repository on GitHub
 */
export async function deleteGithubRepo(
  owner: string,
  repo: string
): Promise<{ ok: boolean; error?: string }> {
  const { token } = getGithubConfig();
  if (!token) {
    return { ok: false, error: 'GITHUB_TOKEN belum diisi di file .env.local' };
  }

  const url = `https://api.github.com/repos/${owner}/${repo}`;

  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: getHeaders(token),
    });

    if (res.status === 204 || res.status === 200) {
      return { ok: true };
    }

    // If 404, check if repo actually doesn't exist
    if (res.status === 404) {
      const checkRes = await fetch(url, { headers: getHeaders(token) });
      if (checkRes.status === 404) {
        // Repo is already deleted or does not exist
        return { ok: true };
      }
    }

    const data = await res.json().catch(() => ({}));
    const acceptedScopes = res.headers.get('x-accepted-oauth-scopes') || '';
    
    let errorMsg = data.message || 'Failed to delete GitHub repository';

    if (res.status === 403 || acceptedScopes.includes('delete_repo') || data.message?.includes('admin rights')) {
      errorMsg = "Token GitHub Anda belum memiliki izin (scope) 'delete_repo'. Untuk dapat menghapus repo dari website controller, silakan buka GitHub (Settings > Developer settings > Personal access tokens), edit token Anda, centang izin 'delete_repo', lalu simpan.";
    }

    return { ok: false, error: errorMsg };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Error deleting repository' };
  }
}
