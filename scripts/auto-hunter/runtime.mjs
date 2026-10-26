/**
 * Adapta o ambiente Node para reaproveitar os serviços do front-end (src/services) sem alterações:
 * - localStorage/sessionStorage em memória
 * - fetch de rotas relativas "/api/*" executa diretamente os handlers serverless da pasta api/
 */
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
}

globalThis.localStorage = globalThis.localStorage || createMemoryStorage();
globalThis.sessionStorage = globalThis.sessionStorage || createMemoryStorage();

const nativeFetch = globalThis.fetch;

async function callApiHandler(urlStr) {
  const url = new URL(urlStr, 'http://localhost');
  const name = url.pathname.replace(/^\/api\//, '').replace(/[^a-z0-9-]/gi, '');
  const mod = await import(pathToFileURL(path.join(ROOT, 'api', `${name}.js`)).href);

  return new Promise((resolve, reject) => {
    let statusCode = 200;
    const headers = {};
    const res = {
      setHeader: (k, v) => { headers[k] = v; },
      status(code) { statusCode = code; return res; },
      json(body) { resolve(new Response(JSON.stringify(body), { status: statusCode, headers })); return res; },
      send(body) { resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: statusCode, headers })); return res; },
      end() { resolve(new Response(null, { status: statusCode, headers })); return res; }
    };
    const req = { method: 'GET', url: `${url.pathname}${url.search}`, headers: {}, query: Object.fromEntries(url.searchParams) };
    Promise.resolve(mod.default(req, res)).catch(reject);
  });
}

globalThis.fetch = (input, init) => {
  const urlStr = typeof input === 'string' ? input : input?.url;
  if (typeof urlStr === 'string' && urlStr.startsWith('/api/')) {
    return callApiHandler(urlStr);
  }
  return nativeFetch(input, init);
};

export { ROOT };
