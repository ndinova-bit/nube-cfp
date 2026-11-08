/* NUBE · lógica de conexión y cálculo. Sin DOM, para poder probarla aparte. */
(function (root) {
  const CFG = {
    url: 'https://dxgqtdaexlegsaohdywx.supabase.co',
    key: 'sb_publishable_q3iliYP60gR5bP6vtTwoHA_8FWqg7iz' // clave pública (publishable): la seguridad la dan el login y las políticas RLS
  };

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sum = (a, f) => (a || []).reduce((s, x) => s + (Number(f(x)) || 0), 0);

  function makeClient(env) {
    const { fetch, storage, now } = env;
    const KEY = 'nube_session';
    let sess = null;
    try { sess = JSON.parse(storage.getItem(KEY) || 'null'); } catch (e) { sess = null; }
    const save = s => { sess = s; if (s) storage.setItem(KEY, JSON.stringify(s)); else storage.removeItem(KEY); };

    function raw(path, opt, token) {
      const headers = { apikey: CFG.key, 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;
      return fetch(CFG.url + path, { method: opt.method || 'GET', headers, body: opt.body ? JSON.stringify(opt.body) : undefined });
    }
    const fromAuth = (j, email) => ({
      access_token: j.access_token, refresh_token: j.refresh_token,
      expires_at: now() / 1000 + (j.expires_in || 3600), email: email || (sess && sess.email) || ''
    });

    async function login(email, password) {
      const r = await raw('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw { status: r.status, code: j.error_code || j.error || 'login' };
      save(fromAuth(j, email));
      return sess;
    }
    async function refresh() {
      if (!sess || !sess.refresh_token) { save(null); throw { status: 401 }; }
      const r = await raw('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: sess.refresh_token } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { save(null); throw { status: 401 }; }
      save(fromAuth(j));
    }
    async function call(path, opt) {
      if (!sess) throw { status: 401 };
      if (sess.expires_at - 60 < now() / 1000) await refresh();
      let r = await raw(path, opt, sess.access_token);
      if (r.status === 401) { await refresh(); r = await raw(path, opt, sess.access_token); }
      const t = await r.text();
      if (!r.ok) throw { status: r.status, body: t };
      return t ? JSON.parse(t) : null;
    }
    async function logout() {
      try { if (sess) await raw('/auth/v1/logout', { method: 'POST' }, sess.access_token); } catch (e) { /* sin conexión: igual se borra local */ }
      save(null);
    }
    return {
      login, logout,
      rpc: (name, args) => call('/rest/v1/rpc/' + name, { method: 'POST', body: args || {} }),
      get: path => call(path, {}),
      hasSession: () => !!sess,
      email: () => (sess && sess.email) || ''
    };
  }

  /* Resumen para mostrar. Entrada: respuestas de panel_cifras, alertas_inasistencias y pendientes_gestion. */
  function summarize(cifras, riesgo, pend) {
    const rows = Array.isArray(cifras) ? cifras : [];
    const activos = sum(rows, r => r.activos), bajas = sum(rows, r => r.bajas);
    const regs = sum(rows, r => r.registros), pres = sum(rows, r => r.presentes);
    const tray = rows.filter(r => Number(r.activos) > 0)
      .sort((a, b) => b.activos - a.activos)
      .map(r => ({ nombre: r.trayecto, sede: r.sede, activos: Number(r.activos), pct: r.pct_asistencia == null ? null : Number(r.pct_asistencia) }));
    const risk = Array.isArray(riesgo) ? riesgo : [];
    const grupos = {};
    risk.forEach(x => { (grupos[x.trayecto] = grupos[x.trayecto] || []).push({ nombre: x.nombre, dni: x.dni, seguidas: x.seguidas, pct: x.pct, registros: x.registros, ultima: x.ultima_presencia }); });
    return {
      kpis: {
        activos, bajas, trayectos: rows.length, trayectosConAlumnos: tray.length,
        pct: regs ? Math.round(pres / regs * 100) : null, registros: regs,
        enRiesgo: new Set(risk.map(x => x.dni)).size
      },
      alertas: (Array.isArray(pend) ? pend : []).map(p => ({ tipo: p.tipo, detalle: p.detalle, cantidad: p.cantidad })),
      trayectos: tray,
      riesgo: Object.keys(grupos).sort().map(t => ({ trayecto: t, items: grupos[t] }))
    };
  }
  /* Lo único que se guarda en el teléfono para ver sin conexión: totales, sin nombres ni DNI. */
  const publicCache = s => ({ kpis: s.kpis, alertas: s.alertas, trayectos: s.trayectos });

  const api = { CFG, esc, sum, makeClient, summarize, publicCache };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NubeCore = api;
})(typeof self !== 'undefined' ? self : this);
