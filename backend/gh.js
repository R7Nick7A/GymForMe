const token = process.env.GH_TOKEN;
if (!token) { console.log('NO_TOKEN'); process.exit(1); }

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'trainapp',
  'X-GitHub-Api-Version': '2022-11-28',
};

async function api(method, path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: body ? { ...headers, 'Content-Type': 'application/json' } : headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  return { status: res.status, data };
}

const user = await api('GET', '/user');
if (user.status !== 200) {
  console.log('USER_ERROR', user.status, JSON.stringify(user.data).slice(0, 300));
  process.exit(1);
}
console.log('LOGIN:', user.data.login);
console.log('NAME:', user.data.name || '');

const repos = await api('GET', '/user/repos?per_page=100&sort=updated');
if (repos.status === 200 && Array.isArray(repos.data)) {
  console.log('REPOS:');
  for (const r of repos.data) console.log(`  ${r.full_name} (private=${r.private})`);
} else {
  console.log('REPOS_ERROR', repos.status, JSON.stringify(repos.data).slice(0, 200));
}

const name = process.env.REPO_NAME || 'trainapp';
const check = await api('GET', `/repos/${user.data.login}/${name}`);
if (check.status === 200) {
  console.log('REPO_EXISTS:', check.data.full_name);
  console.log('CLONE_URL:', check.data.clone_url);
} else if (check.status === 404) {
  console.log('REPO_MISSING:', name);
  const created = await api('POST', '/user/repos', {
    name,
    private: true,
    auto_init: false,
    description: 'Тренер — мониторинг тренировочного процесса',
  });
  if (created.status === 201) {
    console.log('CREATED:', created.data.full_name);
    console.log('CLONE_URL:', created.data.clone_url);
  } else {
    console.log('CREATE_ERROR', created.status, JSON.stringify(created.data).slice(0, 400));
  }
} else {
  console.log('CHECK_ERROR', check.status, JSON.stringify(check.data).slice(0, 300));
}
