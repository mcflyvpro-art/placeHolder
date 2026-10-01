import 'server-only';
import sodium from 'libsodium-wrappers';
import { env } from '@/lib/env';

const API = 'https://api.github.com';

async function gh<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = env.githubToken;
  if (!token) throw new Error('GITHUB_TOKEN absent');
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...init.headers,
    },
    cache: 'no-store',
  });
  if (!res.ok && res.status !== 204) throw new Error(`GitHub ${res.status} ${path}: ${(await res.text()).slice(0, 300)}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

const owner = () => env.githubOwner;

export async function generateFromTemplate(name: string) {
  await gh(`/repos/${owner()}/${env.githubTemplate}/generate`, {
    method: 'POST',
    body: JSON.stringify({ owner: owner(), name, private: true, include_all_branches: false, description: 'Site client — placeHolder' }),
  });
  // La génération est asynchrone : on attend que la branche main existe.
  for (let i = 0; i < 20; i++) {
    try {
      return await gh<{ commit: { sha: string } }>(`/repos/${owner()}/${name}/branches/main`);
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error('Repo GitHub non prêt');
}

export async function setVariable(repo: string, name: string, value: string) {
  try {
    await gh(`/repos/${owner()}/${repo}/actions/variables/${name}`, { method: 'PATCH', body: JSON.stringify({ name, value }) });
  } catch {
    await gh(`/repos/${owner()}/${repo}/actions/variables`, { method: 'POST', body: JSON.stringify({ name, value }) });
  }
}

export async function setSecret(repo: string, name: string, value: string) {
  await sodium.ready;
  const key = await gh<{ key: string; key_id: string }>(`/repos/${owner()}/${repo}/actions/secrets/public-key`);
  const sealed = sodium.crypto_box_seal(sodium.from_string(value), sodium.from_base64(key.key, sodium.base64_variants.ORIGINAL));
  await gh(`/repos/${owner()}/${repo}/actions/secrets/${name}`, {
    method: 'PUT',
    body: JSON.stringify({ encrypted_value: sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL), key_id: key.key_id }),
  });
}

export type RepoFile = { path: string; content: string | Uint8Array };

/** Un seul commit pour tous les fichiers (Git Data API). */
export async function commitFiles(repo: string, files: RepoFile[], message: string) {
  const ref = await gh<{ object: { sha: string } }>(`/repos/${owner()}/${repo}/git/ref/heads/main`);
  const parent = await gh<{ tree: { sha: string } }>(`/repos/${owner()}/${repo}/git/commits/${ref.object.sha}`);
  const tree = await Promise.all(
    files.map(async (f) => {
      const isText = typeof f.content === 'string';
      const blob = await gh<{ sha: string }>(`/repos/${owner()}/${repo}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify(
          isText
            ? { content: f.content, encoding: 'utf-8' }
            : { content: Buffer.from(f.content as Uint8Array).toString('base64'), encoding: 'base64' },
        ),
      });
      return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
    }),
  );
  const newTree = await gh<{ sha: string }>(`/repos/${owner()}/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: parent.tree.sha, tree }),
  });
  const commit = await gh<{ sha: string }>(`/repos/${owner()}/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: newTree.sha, parents: [ref.object.sha] }),
  });
  await gh(`/repos/${owner()}/${repo}/git/refs/heads/main`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
  return commit.sha;
}

export async function dispatchDeploy(repo: string) {
  await gh(`/repos/${owner()}/${repo}/actions/workflows/deploy.yml/dispatches`, { method: 'POST', body: JSON.stringify({ ref: 'main' }) });
}

export async function transferRepo(repo: string, newOwner: string) {
  await gh(`/repos/${owner()}/${repo}/transfer`, { method: 'POST', body: JSON.stringify({ new_owner: newOwner }) });
}

export const repoUrl = (repo: string) => `https://github.com/${owner()}/${repo}`;
export const cloneCommand = (slug: string) => `ph site ${slug}`;
