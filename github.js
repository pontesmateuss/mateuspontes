/* Painel GitHub — integração pública, sem credenciais no navegador. */
(() => {
  const username = 'pontesmateuss';
  const cacheKey = `github-dashboard-v1:${username}`;
  const ttl = 15 * 60 * 1000;
  const panel = document.querySelector('.gh-dashboard');
  if (!panel) return;
  const $ = (id) => document.getElementById(`gh-${id}`);
  let snapshot = null;
  let days = 30;
  let busy = false;
  let retryAt = 0;
  const number = new Intl.NumberFormat('pt-BR');
  const dateKey = (value) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  const labelDate = (value) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short' }).format(new Date(value));
  const labels = { PushEvent: 'Código enviado', CreateEvent: 'Criação no repositório', PullRequestEvent: 'Pull request', IssuesEvent: 'Issue', IssueCommentEvent: 'Comentário em issue ou PR', WatchEvent: 'Estrela adicionada', ForkEvent: 'Fork criado', DeleteEvent: 'Branch ou tag removida', ReleaseEvent: 'Release', PullRequestReviewEvent: 'Revisão de código' };
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  async function request(path) {
    const response = await fetch(`https://api.github.com/users/${username}${path}`, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      if (response.status === 403 || response.status === 429) {
        const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
        const retry = Number(response.headers.get('retry-after')) * 1000;
        retryAt = Math.max(Date.now() + (retry || 60000), reset || 0);
        throw new Error('Limite de consultas do GitHub atingido. Tente mais tarde.');
      }
      throw new Error(response.status === 404 ? 'Perfil não encontrado no GitHub.' : 'Não foi possível consultar o GitHub agora.');
    }
    return response.json();
  }
  async function pages(path, maxPages = Infinity) {
    const result = [];
    for (let page = 1; page <= maxPages; page++) {
      const batch = await request(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      if (!Array.isArray(batch)) throw new Error('Resposta inesperada do GitHub.');
      result.push(...batch);
      if (batch.length < 100) break;
    }
    return result;
  }
  function renderActivity() {
    if (!snapshot) return;
    const today = dateKey(Date.now());
    const end = new Date(`${today}T12:00:00Z`);
    const buckets = Array.from({ length: days }, (_, index) => {
      const date = new Date(end);
      date.setUTCDate(date.getUTCDate() - days + index + 1);
      return { date, key: dateKey(date), count: 0 };
    });
    const counts = new Map(buckets.map((day) => [day.key, day]));
    const filtered = snapshot.events.filter((event) => counts.has(dateKey(event.created_at)));
    filtered.forEach((event) => counts.get(dateKey(event.created_at)).count++);
    const peak = Math.max(1, ...buckets.map((day) => day.count));
    const chart = $('chart');
    chart.replaceChildren();
    const bars = element('div', 'gh-bars');
    buckets.forEach((day, index) => {
      const column = element('div', 'gh-column');
      const bar = element('button', 'gh-bar');
      bar.type = 'button';
      const description = `${labelDate(day.date)}: ${day.count} evento${day.count === 1 ? '' : 's'}`;
      bar.setAttribute('aria-label', description);
      bar.title = description;
      bar.style.setProperty('--bar-height', `${day.count / peak * 100}%`);
      bar.dataset.empty = day.count === 0;
      bar.append(element('span', 'gh-tooltip', description));
      const showLabel = index === 0 || index === days - 1 || index % (days > 14 ? 7 : days > 7 ? 3 : 1) === 0;
      column.append(bar, element('span', 'gh-day', showLabel ? labelDate(day.date) : ''));
      bars.append(column);
    });
    chart.append(bars);
    $('events').textContent = number.format(filtered.length);
    const active = buckets.filter((day) => day.count).length;
    $('chart-summary').textContent = filtered.length ? `${number.format(filtered.length)} eventos retornados · ${active} dias com atividade · pico de ${peak} eventos em um dia` : 'Nenhum evento público retornado para este período.';
    const feed = $('feed');
    feed.replaceChildren();
    filtered.slice(0, 4).forEach((event) => {
      const item = element('li');
      const content = element('div');
      content.append(element('strong', '', labels[event.type] || 'Atividade pública'));
      const repo = event.repo?.name || '';
      if (/^[\w.-]+\/[\w.-]+$/.test(repo)) {
        const link = element('a', '', repo);
        link.href = `https://github.com/${repo}`;
        link.target = '_blank';
        link.rel = 'noopener';
        content.append(link);
      }
      const time = element('time', '', labelDate(event.created_at));
      time.dateTime = event.created_at;
      item.append(content, time);
      feed.append(item);
    });
    if (!filtered.length) feed.append(element('li', '', 'Sem eventos públicos neste período. Explore os repositórios no perfil.'));
  }
  function render() {
    $('name').textContent = snapshot.profile.name || username;
    // URL do avatar validada; textos remotos são inseridos com textContent.
    const avatar = new URL(snapshot.profile.avatar_url);
    if (avatar.protocol === 'https:' && avatar.hostname === 'avatars.githubusercontent.com') $('avatar').src = avatar.href;
    $('repos').textContent = number.format(snapshot.profile.public_repos);
    $('followers').textContent = number.format(snapshot.profile.followers);
    $('stars').textContent = number.format(snapshot.stars);
    renderActivity();
  }
  async function load(force = false) {
    if (busy) return;
    if (Date.now() < retryAt) {
      $('status').textContent = 'Limite de consultas atingido. Aguarde antes de atualizar novamente.';
      return;
    }
    if (!force && snapshot && Date.now() - snapshot.savedAt < ttl) return;
    busy = true;
    panel.setAttribute('aria-busy', 'true');
    $('refresh').disabled = true;
    $('status').textContent = 'Sincronizando dados públicos…';
    try {
      const [profile, repos, events] = await Promise.all([request(''), pages('/repos?type=owner'), pages('/events/public', 3)]);
      snapshot = { profile, stars: repos.reduce((sum, repo) => sum + repo.stargazers_count, 0), events, savedAt: Date.now() };
      render();
      try { localStorage.setItem(cacheKey, JSON.stringify(snapshot)); } catch { /* Armazenamento opcional. */ }
      $('status').textContent = `Sincronizado às ${new Date(snapshot.savedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · atualização a cada 15 min`;
      panel.dataset.state = 'ready';
    } catch (error) {
      panel.dataset.state = 'error';
      $('status').textContent = `${error.message || 'Falha de conexão.'}${snapshot ? ' Exibindo a última consulta salva.' : ' Use Atualizar para tentar novamente.'}`;
      if (!snapshot) {
        $('chart').replaceChildren(element('p', 'gh-placeholder', 'Atividade indisponível no momento.'));
        $('feed').replaceChildren(element('li', '', 'Não foi possível carregar os eventos.'));
      }
    } finally {
      busy = false;
      panel.setAttribute('aria-busy', 'false');
      $('refresh').disabled = false;
    }
  }
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey));
    if (cached && cached.profile?.login?.toLowerCase() === username && Array.isArray(cached.events) && Number.isFinite(cached.stars) && Number.isFinite(cached.savedAt)) {
      snapshot = cached;
      render();
      $('status').textContent = `Consulta salva em ${new Date(snapshot.savedAt).toLocaleString('pt-BR')} · atualização a cada 15 min`;
      panel.setAttribute('aria-busy', 'false');
      panel.dataset.state = 'ready';
    }
  } catch { snapshot = null; }
  document.querySelectorAll('[data-days]').forEach((button) => button.addEventListener('click', () => {
    days = Number(button.dataset.days);
    document.querySelectorAll('[data-days]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    renderActivity();
  }));
  $('refresh').addEventListener('click', () => load(true));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  setInterval(() => { if (!document.hidden) load(); }, ttl);
  load();
})();
