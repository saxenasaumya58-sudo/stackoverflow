const values = new Map();
const requests = new Map();

export function readClientCache(key) {
  return values.get(key);
}

export function writeClientCache(key, value) {
  values.set(key, value);
  return value;
}

export function clearClientCache() {
  values.clear();
}

export function fetchClientCache(key, fetcher, { revalidate = false } = {}) {
  if (!revalidate && values.has(key)) return Promise.resolve(values.get(key));
  if (requests.has(key)) return requests.get(key);

  const request = Promise.resolve()
    .then(fetcher)
    .then((value) => writeClientCache(key, value))
    .finally(() => requests.delete(key));
  requests.set(key, request);
  return request;
}
