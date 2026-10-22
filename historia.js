// FM Hub: las secciones de varela.html (la referencia de Airam) con datos en vivo, sin nada escrito a mano:
// escalera de divisiones y palmarés, el viaje (puntos, goles, primera y segunda vuelta), temporada a temporada,
// rivales, cuándo se marca (con mapa de calor), hitos y récords, mejor once, rentabilidad de los fichajes,
// economía y plan de plantilla. Todo se recalcula con cada lectura de FM Hub.
// Usa las utilidades de app.js (IDX, D, esc, miles, num, eur, fecha, jug, tabla, pintar) y de curiosidades.js
// (r90, LETRA, PUNTOS, rachaMax, NIVEL_LIGA, LIGA_CORTA, media). Se carga antes que app.js.
'use strict';

const HIST = (() => {
  const ACC = ['#c8661f', '#b9461f', '#b32d4a', '#2a63ad', '#35517a', '#2f7d6d', '#6b4fa3', '#8a5a2b'];
  const CODIGO_LIGA = {1: 'PL', 2: 'CH', 3: 'L1', 4: 'L2', 5: 'NL', 6: 'NLS'};
  const NOMBRE_NIVEL = {1: 'Premier League', 2: 'Championship', 3: 'League One', 4: 'League Two', 5: 'National League', 6: 'National League South'};
  const BK = ['1–15', '16–30', '31–45', '46–60', '61–75', '76–90+'];
  const tramo = m => m <= 15 ? 0 : m <= 30 ? 1 : m <= 45 ? 2 : m <= 60 ? 3 : m <= 75 ? 4 : 5;
  const d2 = v => v === null || v === undefined || isNaN(v) ? '–' : Number(v).toFixed(2).replace('.', ',');
  const sh = t => t ? t.slice(2) : '';
  const wdl = ps => { let w = 0, d = 0, l = 0; for (const p of ps) { const r = r90(p); r === 'W' ? w++ : r === 'D' ? d++ : l++; } return {w, d, l}; };
  const pts = ps => ps.reduce((s, p) => s + PUNTOS[r90(p)], 0);
  // filtro global de competiciones (como la barra de varela.html)
  const CF = {LG: true, CUP: true, PO: true, AM: false};
  const ckOk = c => c === 'LG' ? CF.LG : c === 'AM' ? CF.AM : c === 'PO' ? CF.PO : CF.CUP;
  const barraCF = () => `<div class="filters"><span class="fl">Partidos de:</span>${[['LG', 'Liga'], ['CUP', 'Copas'], ['PO', 'Playoffs'], ['AM', 'Amistosos']].map(([k, t]) =>
    `<button class="chip" data-hcf="${k}" aria-pressed="${CF[k]}">${CF[k] ? '✓' : '✕'} ${t}</button>`).join('')}</div>`;
  // valor de mercado como lo enseña FM («18m € - 75m €»: m = miles): punto medio en euros
  const valorEur = s => { if (!s) return null; const t = [...String(s).matchAll(/(\d+(?:[.,]\d+)?)\s*([mMk]?)\s*€/g)].map(m => parseFloat(m[1].replace('.', '').replace(',', '.')) * (m[2] === 'M' ? 1e6 : m[2] ? 1e3 : 1)); return t.length ? t.reduce((a, b) => a + b) / t.length : null; };
  const kEur = n => n === null || n === undefined ? '–' : Math.abs(n) >= 1e6 ? d2(n / 1e6) + ' M €' : Math.abs(n) >= 1e3 ? (Math.round(n / 100) / 10).toString().replace('.', ',') + ' mil €' : miles(n) + ' €';

  // ---------------------------------------------------------------- temporadas (todo calculado de los datos)
  function S() {
    if (S.cache?.d === D) return S.cache.v;
    const lista = [];
    for (const t of IDX.temporadas) {
      const ps = IDX.partidos.filter(p => p.temporada === t);
      const tabla = D.clasificaciones.filter(c => c.temporada === t && c.competicion && NIVEL_LIGA[c.competicion]).sort((a, b) => a.pos - b.pos);
      const lg = tabla.find(c => c.club === IDX.club) || null;
      const cuenta = {};
      for (const p of ps) if (p.oficial && NIVEL_LIGA[p.competicion]) cuenta[p.competicion] = (cuenta[p.competicion] || 0) + 1;
      const liga = lg?.competicion || Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      const nEq = tabla.filter(c => c.competicion === liga).length || 24;
      const regular = 2 * (nEq - 1);
      let j = 0;
      for (const p of ps) {
        if (!p.oficial) p.ck = 'AM';
        else if (p.competicion === liga) { j++; p.j = j; p.ck = j <= regular ? 'LG' : 'PO'; }
        else p.ck = /Copa FA/.test(p.competicion) ? 'FA' : /Trofeo FA/.test(p.competicion) ? 'TR' : /Carabao/.test(p.competicion) ? 'CC' : /Bristol|Trophy|EFL/.test(p.competicion) ? 'EF' : 'OT';
      }
      const lgPs = ps.filter(p => p.ck === 'LG');
      lista.push({t, ps, liga, nivel: NIVEL_LIGA[liga] || null, corto: CODIGO_LIGA[NIVEL_LIGA[liga]] || LIGA_CORTA(liga), tabla: tabla.filter(c => c.competicion === liga),
                  lg, completa: !!lg && lg.j === regular, regular, lgPs, sq: plantillaDe(t)});
    }
    lista.forEach((s, i) => { s.i = i; s.sig = lista[i + 1] || null; s.ant = lista[i - 1] || null; s.acc = ACC[i % ACC.length]; s.res = resultado(s); });
    S.cache = {d: D, v: lista};
    return lista;
  }
  const conTabla = () => S().filter(s => s.lg);
  function resultado(s) {
    const r = [];
    if (s.completa && s.lg.pos === 1) r.push('Campeón');
    if (asciende(s)) r.push(s.lg?.pos === 1 ? 'ascenso' : 'Ascenso');
    else if (desciende(s)) r.push('Descenso');
    const po = s.ps.filter(p => p.ck === 'PO');
    if (po.length) { const u = po[po.length - 1]; r.push(`playoff: ${po.length} partidos, último ${u.gf}-${u.gc} ante el ${u.rival}`); }
    if (!r.length && s.lg) r.push(s.completa ? `${s.lg.pos}.º` : `en curso (${s.lg.pos}.º)`);
    if (!s.lg) r.push('en curso');
    return r.join(' · ').replace(/^ascenso/, 'Ascenso');
  }
  // plantilla de una temporada: estadísticas de la tabla de carrera de FM (con el club) + ficha de esa temporada
  function plantillaDe(t) {
    const fichas = {};
    for (const p of D.plantillas || []) if (p.temporada === t) fichas[p.iu] = p;
    const filas = {};
    for (const h of D.historial) {
      if (h.temporada !== t || h.club !== IDX.club || (h.tipo !== 'total' && h.tipo !== 'liga')) continue;
      const o = (filas[h.iu] ||= {});
      o[h.tipo] = h;
    }
    const out = [];
    const ius = new Set([...Object.keys(filas).map(Number), ...Object.keys(fichas).map(Number)]);
    for (const iu of ius) {
      const h = filas[iu]?.total || filas[iu]?.liga || {};
      const f = fichas[iu] || {};
      const x = (t === IDX.temporadaActual ? IDX.export[iu] : null) || {};
      const det = J(h.detalle);
      const pos = f.pos || x.posicion || (D.plantilla.find(p => p.iu === iu) ? (IDX.export[iu] || {}).posicion : null) || '';
      out.push({iu, n: h.jugador || f.nombre || IDX.nombres[iu] || '¿?', pos, gr: grupoPos(pos), edad: f.edad, nac: f.nac, dorsal: f.dorsal,
                pj: h.partidos || 0, tit: h.titular || 0, sb: h.suplente || 0, g: h.goles || 0, a: h.asistencias || 0, avg: h.nota_media || 0,
                min: h.minutos || 0, yc: h.amarillas || 0, rc: h.rojas || 0, mvp: h.mvp || 0, cs: det.porterias_a_cero ?? det.imbatidas ?? 0,
                sueldo: f.sueldo, contrato: f.contrato, valor: f.valor, xg: f.xg, atr: J(f.atributos), altura: f.altura, peso: f.peso});
    }
    return out;
  }
  // sube o baja de categoría (solo si las dos temporadas tienen liga conocida)
  const asciende = s => !!(s?.sig?.nivel && s.nivel && s.sig.nivel < s.nivel);
  const desciende = s => !!(s?.sig?.nivel && s.nivel && s.sig.nivel > s.nivel);
  // ronda del partido según el calendario exportado de FM, en corto: «Cuartos», «Semifinal (ida)», «Ronda 2»…
  function ronda(p) {
    const r = p.ronda || '';
    if (!r || NIVEL_LIGA[p.competicion] && !/playoff/i.test(r)) return '';
    const vuelta = /^Ida/i.test(r) ? ' (ida)' : /^Vuelta/i.test(r) ? ' (vuelta)' : /^Replay/i.test(r) ? ' (repetición)' : '';
    const po = /playoff/i.test(r) ? ' del playoff' : '';
    if (/1\/8/.test(r)) return 'Octavos' + po + vuelta;
    if (/1\/4/.test(r)) return 'Cuartos' + po + vuelta;
    if (/Semifinal/i.test(r)) return 'Semifinal' + po + vuelta;
    if (/\bFinal\b/i.test(r)) return 'Final' + po + vuelta;
    const g = r.match(/Gr\.\s*(\w+)/); if (g) return `Fase de grupos (${g[1]})`;
    const n = r.match(/(\d+)ª/); if (n) return `${/Clasif/i.test(r) ? 'Previa ' : 'Ronda '}${n[1]}${vuelta}`;
    return r;
  }
  const esFinal = p => /^Final/.test(ronda(p));
  // imagen del trofeo: web/trofeos/<nombre>.png (o .jpg/.webp) si existe; si no, una copa dibujada
  const slugTrofeo = (nombre, liga) => {
    const n = (nombre + ' ' + (liga || '')).toLowerCase();
    if (/playoff/.test(n)) return 'playoff-' + (CODIGO_LIGA[NIVEL_LIGA[liga]] || 'liga').toLowerCase();
    for (const [re, s] of [[/national league south/, 'national-league-south'], [/national league north/, 'national-league-north'], [/national league/, 'national-league'],
      [/league two/, 'league-two'], [/league one/, 'league-one'], [/championship/, 'championship'], [/premier league/, 'premier-league'],
      [/copa fa|fa cup/, 'copa-fa'], [/trofeo fa|fa trophy/, 'trofeo-fa'], [/carabao|league cup/, 'carabao-cup'], [/bristol|efl trophy|trophy/, 'efl-trophy']]) if (re.test(n)) return s;
    return n.replace(/[^a-z0-9]+/g, '-');
  };
  function imagenTrofeo(slug) {
    const est = window.FMHUB_TROFEOS?.[slug];
    if (est) return `<img class="trofeo-img" src="${est}" alt="">`;
    const f = (D.trofeos || []).find(x => x.replace(/\.[a-z]+$/, '') === slug);
    if (f) return `<img class="trofeo-img" src="trofeos/${encodeURIComponent(f)}" alt="">`;
    return `<svg class="trofeo-img" viewBox="0 0 64 80" aria-hidden="true"><defs><linearGradient id="oro" x1="0" x2="1"><stop offset="0" stop-color="#8a5f12"/><stop offset=".45" stop-color="#f3d27a"/><stop offset=".6" stop-color="#e2b54a"/><stop offset="1" stop-color="#7a520e"/></linearGradient></defs>
      <path d="M18 6h28v14c0 10-6 18-14 18S18 30 18 20z" fill="url(#oro)"/><path d="M18 10H8c0 10 5 16 12 17M46 10h10c0 10-5 16-12 17" fill="none" stroke="url(#oro)" stroke-width="3.5"/>
      <rect x="29" y="37" width="6" height="12" fill="url(#oro)"/><path d="M22 49h20l3 9H19z" fill="url(#oro)"/><rect x="15" y="58" width="34" height="12" rx="2" fill="#2a2116"/><rect x="21" y="62" width="22" height="4" rx="1" fill="url(#oro)" opacity=".8"/></svg>`;
  }
  // trofeos de verdad: ligas ganadas y finales ganadas (de copa o del playoff de ascenso)
  function titulos() {
    const out = [];
    for (const s of S()) {
      if (s.completa && s.lg.pos === 1) out.push({t: s.t, nombre: `Campeón de la ${LIGA_CORTA(s.liga)}`, detalle: `${s.lg.pts} puntos`, f: s.lgPs[s.lgPs.length - 1]?.fecha, tipo: 'liga', slug: slugTrofeo(s.liga)});
      for (const p of s.ps) if (p.oficial && esFinal(p) && !/vuelta|ida/.test(ronda(p)) && p.res === 'W')
        out.push({t: s.t, nombre: p.ck === 'PO' ? `Campeón del playoff de ${LIGA_CORTA(s.liga)}` : `Campeón de la ${p.competicion}`, detalle: `final: ${p.gf}-${p.gc} al ${p.rival}${p.pen || ''}`, f: p.fecha, tipo: 'copa', slug: p.ck === 'PO' ? slugTrofeo('playoff', s.liga) : slugTrofeo(p.competicion)});
      // sin ronda conocida: en una copa eliminatoria ya terminada, ganar el último partido es ganar la final
      // (en el EFL Trophy hace falta haber pasado la fase de grupos: al menos 6 partidos)
      const porCopa = {};
      for (const p of s.ps) if (p.oficial && p.ck !== 'LG' && p.ck !== 'PO') (porCopa[p.competicion] ||= []).push(p);
      for (const [c, ps] of Object.entries(porCopa)) {
        const u = ps[ps.length - 1];
        if (ronda(u) || out.some(x => x.f === u.fecha)) continue;
        const terminada = s.completa || (D.proximos || []).every(x => x.competicion !== c);
        const ganado = u.res === 'W' || (u.global && u.global.a_favor > u.global.en_contra);
        if (terminada && ganado && !(/Trophy|Trofeo/.test(c) && ps.length < 6))
          out.push({t: s.t, nombre: `Campeón de la ${c}`, detalle: `último partido: ${u.gf}-${u.gc} al ${u.rival}${u.pen || ''}`, f: u.fecha, tipo: 'copa', slug: slugTrofeo(c)});
      }
      // finales a doble partido: gana la eliminatoria quien lleva ventaja en el global (o los penaltis)
      const vueltas = s.ps.filter(p => p.oficial && esFinal(p) && /vuelta/.test(ronda(p)));
      for (const p of vueltas) if (p.res === 'W' || (p.global && p.global[0] > p.global[1])) out.push({t: s.t, nombre: `Campeón de la ${p.competicion}`, detalle: `final a doble partido ante el ${p.rival}`, f: p.fecha, tipo: 'copa', slug: slugTrofeo(p.competicion)});
    }
    return out;
  }
  // prestigio de cada trofeo (para ordenar el palmarés): primero las ligas de más categoría y las copas grandes
  const PRESTIGIO = {'premier-league': 100, 'copa-fa': 95, 'championship': 85, 'carabao-cup': 80, 'playoff-ch': 78, 'league-one': 70,
    'playoff-l1': 66, 'league-two': 60, 'efl-trophy': 56, 'playoff-l2': 54, 'national-league': 50, 'trofeo-fa': 46, 'playoff-nl': 44,
    'national-league-north': 40, 'national-league-south': 40, 'playoff-nls': 36};
  const prestigio = x => PRESTIGIO[x.slug] ?? 30;

  // mejor ronda alcanzada en cada copa (por temporada)
  function recorridos() {
    const out = [];
    for (const s of S()) {
      const g = {};
      for (const p of s.ps) if (p.oficial && p.ck !== 'LG') (g[p.ck === 'PO' ? `Playoff de ${LIGA_CORTA(s.liga)}` : p.competicion] ||= []).push(p);
      for (const [c, ps] of Object.entries(g)) { const u = ps[ps.length - 1]; out.push({t: s.t, c, ps, u, r: ronda(u), gano: titulos().some(x => x.t === s.t && x.f === u.fecha)}); }
    }
    return out;
  }
  const PESO_RONDA = r => /^Final/.test(r) ? 6 : /^Semifinal/.test(r) ? 5 : /^Cuartos/.test(r) ? 4 : /^Octavos/.test(r) ? 3 : /Ronda (\d)/.test(r) ? 1 + (+r.match(/Ronda (\d)/)[1]) / 10 : /grupos/.test(r) ? .5 : 0;
  const cantera = () => new Set((D.traspasos || []).filter(t => t.tipo === 'cantera').map(t => t.iu));
  const enPlantilla = () => new Set(D.plantilla.map(p => p.iu));

  // ---------------------------------------------------------------- palmarés y escalera (cabecera)
  function palmares() {
    const ss = S(), tt = conTabla();
    const ligas = tt.filter(s => s.completa && s.lg.pos === 1);
    const asc = ss.filter(asciende);
    const maxPts = tt.filter(s => s.completa).reduce((m, s) => Math.max(m, s.lg.pts), 0);
    const veces = tt.filter(s => s.completa && s.lg.pts === maxPts).length;
    return {ligas, asc, maxPts, veces, titulos: titulos().sort((a, b) => prestigio(b) - prestigio(a) || b.t.localeCompare(a.t))};
  }
  function escalera() {
    const tt = conTabla();
    if (tt.length < 2) return '';
    const W = 1000, H = 230, n = tt.length, paso = (W - 160) / Math.max(1, n - 1);
    const niveles = tt.map(s => s.nivel || 6), nmin = Math.min(...niveles), nmax = Math.max(...niveles);
    const X = i => 90 + i * paso, Y = nv => nmax === nmin ? 90 : 40 + (nv - nmin) / (nmax - nmin) * 100;
    let p = `M20,${Y(niveles[0]) + 22}`;
    tt.forEach((s, i) => { p += ` L${X(i) - 50},${Y(niveles[i]) + 22} L${X(i) + 50},${Y(niveles[i]) + 22}`; if (i < n - 1) p += ` L${X(i + 1) - 50},${Y(niveles[i + 1]) + 22}`; });
    let o = `<path d="${p}" fill="none" stroke="var(--gold)" stroke-width="3" stroke-linejoin="round" opacity=".5"/>`;
    tt.forEach((s, i) => {
      const x = X(i), y = Y(niveles[i]);
      const c = s.completa && s.lg.pos === 1 ? 'var(--gold)' : asciende(s) ? '#e7c068' : '#8a8575';
      o += `<rect x="${x - 48}" y="${y + 22}" width="96" height="${H - y - 22}" fill="rgba(255,255,255,.05)"/><circle cx="${x}" cy="${y + 22}" r="9" fill="${c}"/>`;
      o += `<text x="${x}" y="${y - 8}" text-anchor="middle" class="big2">${s.lg.pos}º · ${s.lg.pts} pts</text><text x="${x}" y="${y + 8}" text-anchor="middle">${esc(NOMBRE_NIVEL[s.nivel] || LIGA_CORTA(s.liga))}</text>`;
      o += `<text x="${x}" y="${H - 8}" text-anchor="middle" style="font-weight:600">${s.t}${s.completa ? '' : ' (en curso)'}</text>`;
      if (s.completa && s.lg.pos === 1) o += `<text x="${x}" y="${y + 44}" text-anchor="middle" style="fill:var(--gold);font-size:11px">★ CAMPEÓN</text>`;
      else if (asciende(s)) o += `<text x="${x}" y="${y + 44}" text-anchor="middle" style="fill:var(--gold);font-size:11px">▲ ASCENSO</text>`;
    });
    return `<div class="ladder"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Escalera de divisiones">${o}</svg></div>`;
  }
  function bigsPalmares(of) {
    // como el historial del mánager en FM: una tanda de penaltis cuenta como victoria o derrota
    const v = of.filter(p => p.res === 'W').length, e = of.filter(p => p.res === 'D').length, d = of.length - v - e;
    const pal = palmares();
    const gf = of.reduce((s, p) => s + p.gf, 0), gc = of.reduce((s, p) => s + p.gc, 0);
    return [[num(of.length), 'partidos oficiales'], [`${v}·${e}·${d}`, `V · E · D (${of.length ? Math.round(100 * v / of.length) : 0}%)`], [`${gf}–${gc}`, 'goles a favor – en contra'],
      [pal.titulos.length, pal.titulos.length === 1 ? 'título' : 'títulos'], [pal.asc.length, pal.asc.length === 1 ? 'ascenso' : 'ascensos'],
      [pal.maxPts || '–', `puntos, récord del club${pal.veces > 1 ? ` (x${pal.veces})` : ''}`]]
      .map(([n, t]) => `<div class="big"><b>${n}</b><span>${t}</span></div>`).join('');
  }

  // ---------------------------------------------------------------- gráficos (como varela.html, con n temporadas)
  function grafBarrasTemporadas(vals, etiquetas, sub, colores, max) {
    const n = vals.length, W = Math.max(520, n * 100), H = 250, pad = 30, bw = Math.min(62, (W - pad * 2) / n * .62), g = (W - pad * 2 - bw * n) / Math.max(1, n - 1);
    const mx = max || Math.max(...vals, 1) * 1.1;
    let o = '';
    for (let k = 0; k <= 4; k++) { const v = Math.round(mx * k / 4), y = H - 40 - v / mx * 170; o += `<line x1="${pad - 6}" x2="${W - 8}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="2" y="${y + 3}">${v}</text>`; }
    vals.forEach((v, i) => { const h = v / mx * 170, x = pad + i * (bw + g), y = H - 40 - h;
      o += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="4" fill="${colores[i]}"/><text x="${x + bw / 2}" y="${y - 6}" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:13px">${v}</text><text x="${x + bw / 2}" y="${H - 24}" text-anchor="middle" style="fill:var(--ink)">${esc(etiquetas[i])}</text><text x="${x + bw / 2}" y="${H - 11}" text-anchor="middle">${esc(sub[i])}</text>`; });
    return `<svg viewBox="0 0 ${W} ${H}" role="img">${o}</svg>`;
  }
  function grafPares(pares, etiquetas, cols, leyenda, max, fmt = v => v) {
    const n = pares.length, W = Math.max(520, n * 100), H = 240, pad = 30, gw = Math.min(88, (W - pad * 2) / n * .8), gp = (W - pad * 2 - gw * n) / Math.max(1, n - 1);
    const mx = max || Math.max(...pares.flat(), 1) * 1.1;
    let o = '';
    for (let k = 0; k <= 3; k++) { const v = mx * k / 3, y = H - 40 - v / mx * 160; o += `<line x1="${pad - 6}" x2="${W - 8}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="2" y="${y + 3}">${fmt(mx > 10 ? Math.round(v) : Math.round(v * 100) / 100)}</text>`; }
    pares.forEach((par, i) => { const x = pad + i * (gw + gp), w = gw / 2 - 2;
      par.forEach((v, k) => { const h = v / mx * 160, xx = x + k * (w + 4); o += `<rect x="${xx}" y="${H - 40 - h}" width="${w}" height="${h}" rx="3" fill="${cols[k]}"/><text x="${xx + w / 2}" y="${H - 46 - h}" text-anchor="middle" style="fill:var(--ink)">${fmt(v)}</text>`; });
      o += `<text x="${x + gw / 2}" y="${H - 22}" text-anchor="middle" style="fill:var(--ink)">${esc(etiquetas[i])}</text>`; });
    return `<svg viewBox="0 0 ${W} ${H}" role="img">${o}</svg><div class="legend">${leyenda.map((l, k) => `<span><b style="background:${cols[k]}"></b>${l}</span>`).join('')}</div>`;
  }
  function vueltas(s) {
    const lg = s.lgPs, m = Math.floor(s.regular / 2);
    return [lg.slice(0, m), lg.slice(m)].map(h => { const r = wdl(h); return {n: h.length, ...r, gf: h.reduce((a, p) => a + p.gf, 0), ga: h.reduce((a, p) => a + p.gc, 0), pts: 3 * r.w + r.d}; });
  }
  function grafAcumulado(s) {
    let c = 0;
    const p = [0, ...s.lgPs.map(x => (c += PUNTOS[r90(x)]))];
    const W = 620, H = 230, pl = 34, pr = 10, pt = 10, pb = 26, mx = Math.max(60, Math.ceil((c + 8) / 30) * 30), n = Math.max(s.lgPs.length, 1);
    const X = i => pl + i / n * (W - pl - pr), Y = v => H - pb - v / mx * (H - pt - pb);
    let o = '';
    for (let v = 0; v <= mx; v += 30) o += `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="2" y="${Y(v) + 3}">${v}</text>`;
    for (let i = 0; i <= n; i += 10) o += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle">J${i}</text>`;
    o += `<polyline fill="none" stroke="var(--line)" stroke-width="1.5" stroke-dasharray="4 4" points="${X(0)},${Y(0)} ${X(n)},${Y(n * 2)}"/>`;
    o += `<path d="M${X(0)},${Y(0)} ${p.map((v, i) => `L${X(i)},${Y(v)}`).join(' ')} L${X(p.length - 1)},${Y(0)}Z" fill="var(--gold)" opacity=".16"/><polyline fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linejoin="round" points="${p.map((v, i) => X(i) + ',' + Y(v)).join(' ')}"/>`;
    o += `<circle cx="${X(p.length - 1)}" cy="${Y(c)}" r="4" fill="var(--gold)"/><text x="${X(p.length - 1) - 8}" y="${Y(c) - 8}" text-anchor="end" style="fill:var(--ink);font-weight:600;font-size:12px">${c} pts</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img">${o}</svg><div class="legend"><span><b style="background:var(--gold)"></b>Puntos acumulados</span><span>Línea discontinua: 2 puntos por partido</span></div>`;
  }
  const barras = (lista, cls = '') => { const m = Math.max(...lista.map(x => x[1]), 1); return `<div class="bars">${lista.map(x => `<div class="row"><span>${x[0]}</span><div class="bg"><div class="fg ${cls}" style="width:${x[1] / m * 100}%"></div></div><b>${x[1]}</b></div>`).join('') || '<p class="vacio">Sin datos.</p>'}</div>`; };
  const golesPropios = p => (IDX.golesPorPartido[p.clave] || []).filter(g => (g.lado === 0) === p.casa && g.tipo !== 3);
  const golesTxt = p => golesPropios(p).map(g => `${g.iu ? jug(g.iu, g.jugador) : esc(g.jugador || '¿?')} ${g.minuto}'${g.anadido ? '+' + g.anadido : ''}${g.tipo === 2 ? ' (p)' : ''}`).join(', ') || '—';
  const pillR = p => `<span class="res ${r90(p)}">${p.gf}–${p.gc}${p.pen ? ' (p)' : ''}</span>`;
  const rivalLink = r => `<a class="j" href="#rivales/${encodeURIComponent(r)}">${esc(r)}</a>`;

  // ---------------------------------------------------------------- 01 · El viaje
  function viaje() {
    const tt = conTabla(), pal = palmares();
    const col = tt.map(s => s.lg.pos === 1 && s.completa ? 'var(--gold)' : asciende(s) ? 'color-mix(in srgb,var(--gold) 60%,var(--bar))' : 'var(--bar)');
    const hv = tt.filter(s => s.lgPs.length >= 4).map(s => ({s, v: vueltas(s)}));
    const mejoresCopas = {};
    for (const x of recorridos()) { const k = x.c.replace(/^Playoff de .*/, 'Playoff de ascenso'); const m = mejoresCopas[k]; if (!m || PESO_RONDA(x.r) > PESO_RONDA(m.r) || (PESO_RONDA(x.r) === PESO_RONDA(m.r) && x.ps.length > m.ps.length)) mejoresCopas[k] = x; }
    return `<section><div class="wrap"><h2 data-n="01">El viaje</h2>
      <p class="sub">Puntos de liga por temporada, goles a favor y en contra y cómo cambia el equipo entre la primera y la segunda vuelta. Se calcula solo con cada temporada nueva.</p>
      <div class="palm">${pal.titulos.map(x => `<div class="trofeo">${imagenTrofeo(x.slug)}<div><b>${esc(x.nombre)}</b><small>${x.t} · ${esc(x.detalle)}</small></div></div>`).join('') || '<div class="card vacio">Todavía sin títulos.</div>'}</div>
      <p class="mini" style="margin:6px 0 0">Palmarés: solo títulos ganados (ligas, finales de copa y de playoff), del más prestigioso al menos. Una copa cuenta como ganada si su último partido fue la final o, cuando no se sabe la ronda, si se ganó el último partido de una copa ya terminada.</p>
      <div class="grid g2" style="margin-top:14px">
        <div class="card"><h4 style="margin-top:0">Ascensos</h4><ul class="facts" style="grid-template-columns:1fr">${pal.asc.map(s => `<li>▲ <b>${s.t}</b>: de la ${esc(LIGA_CORTA(s.liga))} a la ${esc(LIGA_CORTA(s.sig.liga))}${s.lg ? ` (${s.lg.pos}.º, ${s.lg.pts} pts${s.ps.some(p => p.ck === 'PO') ? ', vía playoff' : ''})` : ''}</li>`).join('') || '<li>Sin ascensos todavía.</li>'}</ul></div>
        <div class="card"><h4 style="margin-top:0">Mejor recorrido en cada copa</h4><ul class="facts" style="grid-template-columns:1fr">${Object.entries(mejoresCopas).map(([k, x]) => `<li><b>${esc(k)}</b>: ${x.gano ? '★ campeón' : esc(x.r || x.ps.length + ' partidos')} en ${x.t}${x.gano ? '' : ` · eliminado por el ${esc(x.u.rival)} (${x.u.gf}-${x.u.gc}${x.u.pen ? esc(x.u.pen) : ''})`}</li>`).join('') || '<li>Sin partidos de copa.</li>'}</ul></div>
      </div>
      <div class="grid g2" style="margin-top:14px">
        <div class="card"><h4 style="margin-top:0">Puntos en liga</h4>${grafBarrasTemporadas(tt.map(s => s.lg.pts), tt.map(s => sh(s.t)), tt.map(s => `${s.corto} · ${s.lg.pos}º`), col)}</div>
        <div class="card"><h4 style="margin-top:0">Goles en liga (a favor / en contra)</h4>${grafPares(tt.map(s => [s.lg.gf, s.lg.gc]), tt.map(s => sh(s.t)), ['var(--w)', 'var(--l)'], ['A favor', 'En contra'])}</div>
      </div>
      ${hv.length ? `<div class="card" style="margin-top:14px"><h4 style="margin-top:0">Primera vuelta frente a segunda vuelta (puntos por partido)</h4>
        ${grafPares(hv.map(x => x.v.map(q => q.n ? Math.round(q.pts / q.n * 100) / 100 : 0)), hv.map(x => sh(x.s.t)), ['var(--bar)', 'var(--gold)'], ['1.ª vuelta', '2.ª vuelta'], 3, d2)}
        <p class="sub" style="margin:8px 0 0;font-size:13px">${hv.map(x => `${x.s.t}: ${x.v[0].pts} → ${x.v[1].pts} pts`).join(' · ')}.</p></div>` : ''}
    </div></section>`;
  }

  // ---------------------------------------------------------------- 02 · Temporada a temporada
  let actual = null, filtroRes = 'all';
  function narrativa(s) {
    const of = s.ps.filter(p => p.oficial), r = wdl(of);
    const top = [...s.sq].sort((a, b) => b.g - a.g)[0], asis = [...s.sq].sort((a, b) => b.a - a.a)[0];
    const mv = [...of].sort((a, b) => (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf)[0];
    const racha = rachaMax(of, p => r90(p) === 'W');
    const tt = conTabla(), maxPts = Math.max(...tt.filter(x => x.completa).map(x => x.lg.pts), 0);
    const f = [];
    if (s.lg) f.push(`${s.res.split(' · ')[0] === 'Campeón' ? 'Campeón' : s.completa ? `${s.lg.pos}.º` : `${s.lg.pos}.º por ahora`} de la ${LIGA_CORTA(s.liga)} con ${s.lg.pts} puntos${s.completa && s.lg.pts === maxPts ? ', récord del club' : ''}.`);
    if (asciende(s)) f.push(`Ascenso a la ${LIGA_CORTA(s.sig.liga)}.`);
    if (of.length) f.push(`${of.length} partidos oficiales: ${r.w} victorias, ${r.d} empates y ${r.l} derrotas.`);
    if (top?.g) f.push(`${top.n} marca ${top.g} goles${asis?.a ? ` y ${asis.n} da ${asis.a} asistencias` : ''}.`);
    if (racha.n >= 3) f.push(`Mejor racha: ${racha.n} victorias seguidas.`);
    if (mv && mv.gf - mv.gc >= 3) f.push(`Mayor victoria: ${mv.gf}-${mv.gc} al ${mv.rival}.`);
    const fich = IDX.traspasos.filter(t => t.entra && t.precio_eur && tempDe(t.fecha) === s.t).sort((a, b) => b.precio_eur - a.precio_eur)[0];
    if (fich) f.push(`Fichaje más caro: ${fich.jugador} (${kEur(fich.precio_eur)}).`);
    return f.join(' ') || 'Temporada en curso: todavía sin partidos oficiales. Se irá rellenando sola con cada lectura de FM Hub.';
  }
  const tempDe = f => { const a = +f.slice(0, 4), m = +f.slice(5, 7), i = m >= 7 ? a : a - 1; return `${i}/${String(i + 1).slice(2)}`; };
  function zonas(s) {
    const z = {};
    const sig = s.sig?.tabla?.length ? s.sig : null;
    for (const f of s.tabla) {
      if (f.pos === 1 && s.completa) { z[f.club] = 'C'; continue; }
      if (!sig || !s.completa) continue;
      const esta = sig.tabla.some(x => x.club === f.club);
      if (sig.nivel < s.nivel) { if (esta && f.club !== IDX.club) z[f.club] = 'A'; else if (f.club === IDX.club) z[f.club] = 'A'; }
      else if (sig.nivel === s.nivel) { if (!esta) z[f.club] = f.pos <= s.tabla.length / 2 ? 'A' : 'D'; }
      else if (esta) z[f.club] = 'D';
    }
    return z;
  }
  function temporadas() {
    const ss = S();
    if (actual === null || !ss[actual]) actual = ss.length - 1 - (ss[ss.length - 1].ps.some(p => p.oficial) ? 0 : 1);
    actual = Math.max(0, actual);
    const s = ss[actual];
    const of = s.ps.filter(p => p.oficial), comp = s.ps.filter(p => ckOk(p.ck)), lg = s.lgPs;
    const T = wdl(comp), L = wdl(lg), H = wdl(lg.filter(p => p.casa)), A = wdl(lg.filter(p => !p.casa));
    const gf = comp.reduce((a, p) => a + p.gf, 0), gc = comp.reduce((a, p) => a + p.gc, 0);
    const att = lg.filter(p => p.casa && p.espectadores), avgA = att.length ? Math.round(att.reduce((a, p) => a + p.espectadores, 0) / att.length) : 0;
    const cs = comp.filter(p => p.gc === 0).length;
    const base = comp.length ? comp : s.ps;
    const bw = [...base].sort((a, b) => (b.gf - b.gc) - (a.gf - a.gc))[0], bl = [...base].sort((a, b) => (a.gf - a.gc) - (b.gf - b.gc))[0];
    const wn = rachaMax(comp, p => r90(p) === 'W').n, un = rachaMax(comp, p => r90(p) !== 'L').n;
    const sq = s.sq.filter(p => p.pj > 0);
    const top = k => [...sq].sort((a, b) => b[k] - a[k] || b.pj - a.pj).filter(p => p[k] > 0).slice(0, 8);
    const honor = (k, min = 0) => [...sq].filter(p => p.pj >= min && p[k]).sort((a, b) => b[k] - a[k])[0];
    const z = zonas(s);
    const cupGrupos = {};
    for (const p of of) if (p.ck !== 'LG') (cupGrupos[p.ck === 'PO' ? 'Playoff' : p.competicion] ||= []).push(p);
    const ctx = s.tabla.slice(0, 3).map((f, k) => `${k ? (k + 1) + 'º ' : 'Campeón '}${f.club}`).join(' · ');
    const hv = s.lgPs.length ? vueltas(s) : null;
    let h = `<section><div class="wrap"><h2 data-n="02">Temporada a temporada</h2>
      <p class="sub">Elige una temporada: forma partido a partido, puntos acumulados, primera y segunda vuelta, goleadores, cuadro de honor, copas, clasificación con ascensos y descensos, todos los partidos y la plantilla.</p>
      <div class="tabs" id="htabs">${ss.map((x, i) => `<button class="tab" data-hst="${i}" aria-selected="${i === actual}" style="--acc:${x.acc}">${x.t}<small>${esc(x.corto || '')}${x.lg ? ` · ${x.lg.pos}º · ${x.lg.pts} pts` : ''}</small></button>`).join('')}</div>
      ${barraCF()}
      <div style="--acc:${s.acc}"><div class="banner" data-y="${sh(s.t)}"><div class="sh"><h3>${s.t}</h3>${s.liga ? `<span class="pill">${esc(s.liga)}</span>` : ''}<span class="pill">${esc(s.res)}</span></div>
        <p class="narr" style="color:#fff;margin:10px 0 0;position:relative">${esc(narrativa(s))}</p></div>
      ${ctx ? `<p class="sub" style="margin-top:4px"><b>Contexto:</b> ${esc(ctx)}</p>` : ''}
      <div class="grid g4" style="margin-top:14px">
        <div class="card kpi"><b>${s.lg ? s.lg.pos + 'º' : '–'}</b><span>Posición${s.completa ? ' final' : ''}</span><small>${s.lg ? `${s.lg.pts} puntos · ${d2(s.lg.pts / Math.max(1, s.lg.j))} por partido` : ''}</small></div>
        <div class="card kpi"><b>${L.w}-${L.d}-${L.l}</b><span>Liga (V-E-D)</span><small>${s.lg ? `GF ${s.lg.gf} · GC ${s.lg.gc} · DG ${s.lg.gf - s.lg.gc > 0 ? '+' : ''}${s.lg.gf - s.lg.gc}` : ''}</small></div>
        <div class="card kpi"><b>${comp.length}</b><span>Partidos (según filtros)</span><small>${T.w}V ${T.d}E ${T.l}D · ${gf}-${gc} goles</small></div>
        <div class="card kpi"><b>${cs}</b><span>Porterías a cero</span><small>según filtros</small></div>
        <div class="card kpi"><b>${H.w}-${H.d}-${H.l}</b><span>En casa (liga)</span><small>${avgA ? 'asistencia media ' + miles(avgA) : ''}</small></div>
        <div class="card kpi"><b>${A.w}-${A.d}-${A.l}</b><span>Fuera (liga)</span><small>Racha: ${wn} victorias · ${un} sin perder</small></div>
        ${bw ? `<div class="card kpi"><b>${bw.gf}-${bw.gc}</b><span>Mayor victoria</span><small>${esc(bw.rival)} · ${fecha(bw.fecha)}</small></div>` : ''}
        ${bl ? `<div class="card kpi"><b>${bl.gf}-${bl.gc}</b><span>Peor derrota</span><small>${esc(bl.rival)} · ${fecha(bl.fecha)}</small></div>` : ''}</div>`;
    if (lg.length) {
      h += `<h4>Los ${lg.length} partidos de liga</h4><div class="card"><div class="form" style="grid-template-columns:repeat(${Math.min(23, Math.ceil(lg.length / 2))},1fr)">${lg.map(p => `<i class="${r90(p)}" title="J${p.j} · ${p.casa ? 'Casa' : 'Fuera'} · ${esc(p.rival)} ${p.gf}-${p.gc}"></i>`).join('')}</div>
        <div class="legend"><span><b style="background:var(--w)"></b>Victoria</span><span><b style="background:var(--d)"></b>Empate</span><span><b style="background:var(--l)"></b>Derrota</span></div></div>
        <h4>Puntos acumulados</h4><div class="card">${grafAcumulado(s)}</div>`;
      if (hv) h += `<h4>Primera vuelta frente a segunda</h4><div class="grid g2">${hv.map((q, k) => `<div class="card kpi"><span>${k ? `2ª vuelta · J${Math.floor(s.regular / 2) + 1}–J${s.regular}` : `1ª vuelta · J1–J${Math.floor(s.regular / 2)}`}</span><b>${q.pts} pts</b><small>${q.w}V ${q.d}E ${q.l}D · GF ${q.gf} · GC ${q.ga} · ${d2(q.n ? q.pts / q.n : 0)} pts/partido${q.n < s.regular / 2 ? ` (${q.n} jugados)` : ''}</small></div>`).join('')}</div>`;
    }
    const tg = top('g');
    if (tg.length) h += `<h4>Podio de goleadores</h4><div class="podium">${tg.slice(0, 3).map((p, k) => `<div class="pod"><div class="rk">#${k + 1}</div><b>${p.g}</b><span>${jug(p.iu, p.n)}</span><small>${p.pj} PJ${p.avg ? ' · media ' + d2(p.avg) : ''}</small></div>`).join('')}</div>
      <div class="cols2"><div><h4>Goleadores (oficiales)</h4><div class="card">${barras(tg.map(p => [jug(p.iu, p.n), p.g]), 'g')}</div></div><div><h4>Asistencias</h4><div class="card">${barras(top('a').map(p => [jug(p.iu, p.n), p.a]))}</div></div></div>`;
    const hon = [['g', 'Máximo goleador', 'goles'], ['a', 'Más asistencias', ''], ['cs', 'Más porterías a cero', ''], ['avg', 'Mejor media (15+ PJ)', '', 15], ['mvp', 'Más veces jugador del partido', ''], ['yc', 'Más amarillas', '']]
      .map(([k, t, u, mn]) => { const p = honor(k, mn || 0); return p ? `<div class="card kpi"><b style="font-size:18px">${jug(p.iu, p.n)}</b><span>${t} · ${k === 'avg' ? d2(p.avg) : p[k]}${u ? ' ' + u : ''}</span></div>` : ''; }).join('');
    const atMax = att.length ? att.reduce((a, b) => b.espectadores > a.espectadores ? b : a) : null;
    if (hon) h += `<h4>Cuadro de honor</h4><div class="grid g4">${hon}${atMax ? `<div class="card kpi"><b style="font-size:18px">${miles(atMax.espectadores)}</b><span>Mayor asistencia · ${esc(atMax.rival)}, ${fecha(atMax.fecha)}</span></div>` : ''}</div>`;
    if (Object.keys(cupGrupos).length) { const tits = titulos(); h += `<h4>Copas y otras competiciones</h4><div class="card"><table class="copas"><tbody>${Object.entries(cupGrupos).map(([c, ps]) => { const u = ps[ps.length - 1], r = wdl(ps), gano = tits.some(x => x.f === u.fecha); return `<tr><td><b>${esc(c)}</b></td><td>${gano ? '<b style="color:var(--gold)">★ Campeón</b>' : esc(ronda(u) || '—')} · ${gano ? 'final' : 'eliminado'} ante el ${rivalLink(u.rival)} ${pillR(u)}${u.pen ? ' penaltis' + esc(u.pen) : ''}</td><td class="mini">${ps.length} partidos · ${r.w}V ${r.d}E ${r.l}D</td></tr>`; }).join('')}</tbody></table></div>`; }
    if (s.tabla.length) h += `<h4>Clasificación${s.completa ? ' final' : ''}</h4><div class="tw"><table><thead><tr><th class="n">Pos</th><th></th><th>Equipo</th><th class="n">PJ</th><th class="n">G</th><th class="n">E</th><th class="n">P</th><th class="n">GF</th><th class="n">GC</th><th class="n">DG</th><th class="n">Pts</th></tr></thead><tbody>${s.tabla.map(r => { const zz = z[r.club]; const me = r.club === IDX.club; return `<tr style="${me ? 'background:var(--goldbg);font-weight:700' : ''}"><td class="n">${r.pos}</td><td style="width:22px"><span class="pill" style="${zz === 'D' ? 'background:var(--lbg);color:var(--l)' : zz ? 'background:var(--wbg);color:var(--w)' : 'visibility:hidden'}">${zz || '·'}</span></td><td>${me ? esc(r.club) : rivalLink(r.club)}</td><td class="n">${r.j}</td><td class="n">${r.g}</td><td class="n">${r.e}</td><td class="n">${r.p}</td><td class="n">${r.gf}</td><td class="n">${r.gc}</td><td class="n">${r.gf - r.gc > 0 ? '+' : ''}${r.gf - r.gc}</td><td class="n"><b>${r.pts}</b></td></tr>`; }).join('')}</tbody></table></div><div class="legend"><span>C campeón · A ascenso · D descenso (deducidos de quién juega en qué liga la temporada siguiente)</span></div>`;
    const lista = comp.filter(p => filtroRes === 'all' || r90(p) === filtroRes);
    h += `<h4>Partido a partido · ${comp.length} encuentros</h4><div class="filters">${[['all', 'Cualquier resultado'], ['W', 'Victorias'], ['D', 'Empates'], ['L', 'Derrotas']].map(([k, t]) => `<button class="chip" data-hres="${k}" aria-pressed="${filtroRes === k}">${t}</button>`).join('')}</div>
      <div class="tw scroll"><table><thead><tr><th>Fecha</th><th>Competición</th><th>Rival</th><th class="n">Res.</th><th class="n">Asist.</th><th>Goleadores</th><th>Formación</th></tr></thead><tbody>${lista.map(p => `<tr class="r${r90(p)}"><td class="mono" style="font-size:12px">${fecha(p.fecha)}</td><td class="cmp">${p.ck === 'LG' ? 'Liga · J' + p.j : p.ck === 'PO' ? 'Playoff · ' + esc(ronda(p)) : esc(p.competicion) + (ronda(p) ? ' · ' + esc(ronda(p)) : '')}</td><td><span class="ha">${p.casa ? 'CASA' : 'FUERA'}</span>${rivalLink(p.rival)}</td><td class="n">${pillR(p)}</td><td class="n">${p.espectadores ? miles(p.espectadores) : '—'}</td><td class="sc">${golesTxt(p)}</td><td class="cmp">${esc(p.formacion || '')}</td></tr>`).join('') || '<tr><td colspan="7">Sin partidos con esos filtros.</td></tr>'}</tbody></table></div>`;
    const ord = {POR: 0, DEF: 1, MED: 2, DEL: 3, OTR: 4}, GN = {POR: 'Porteros', DEF: 'Defensas', MED: 'Centrocampistas', DEL: 'Delanteros', OTR: 'Otros'};
    const sqAll = [...s.sq].sort((a, b) => ord[a.gr] - ord[b.gr] || b.pj - a.pj);
    const can = cantera();
    let ultG = '';
    h += `<h4>Plantilla ${s.t} · ${sqAll.length} jugadores</h4><p class="sub" style="margin:0 0 10px">Toca un jugador para abrir su ficha con trayectoria y atributos.</p><div class="tw scroll"><table><thead><tr><th>Jugador</th><th>Posición</th><th class="n">Edad</th><th class="n">PJ</th><th class="n">G</th><th class="n">A</th><th class="n">Media</th><th class="n">Min</th><th class="n">Am</th><th class="n">Ro</th><th class="n">€/mes</th><th>Contrato</th><th>Valor</th></tr></thead><tbody>${sqAll.map(p => {
      const cab = p.gr !== ultG ? `<tr><td colspan="13" style="background:var(--bg);font:800 11px Archivo;letter-spacing:.08em;text-transform:uppercase;color:var(--gold)">${GN[p.gr]}</td></tr>` : '';
      ultG = p.gr;
      return cab + `<tr><td><b>${jug(p.iu, p.n)}</b>${can.has(p.iu) ? ' <span class="ha">CANTERA</span>' : ''}</td><td class="cmp">${esc(p.pos || '—')}</td><td class="n">${p.edad || '—'}</td><td class="n">${p.pj}${p.sb ? ` <span style="color:var(--mut)">(${p.sb})</span>` : ''}</td><td class="n">${p.g}</td><td class="n">${p.a || '—'}</td><td class="n">${p.avg ? d2(p.avg) : '—'}</td><td class="n">${p.min ? miles(p.min) : '—'}</td><td class="n">${p.yc || '—'}</td><td class="n">${p.rc || '—'}</td><td class="n">${p.sueldo ? miles(p.sueldo) : '—'}</td><td class="cmp">${esc(p.contrato || '—')}</td><td class="cmp">${esc(p.valor || '—')}</td></tr>`;
    }).join('')}</tbody></table></div>
      <p class="mini">Partidos y goles de la tabla de carrera de FM (todas las oficiales con el club). Sueldo, contrato, valor y posición: última ficha de esa temporada.</p></div></div></section>`;
    return h;
  }

  // ---------------------------------------------------------------- 04 · Rivales
  let rivalSel = null, rivalF = 'OF';
  const rivalOk = p => rivalF === 'ALL' ? true : rivalF === 'OF' ? p.oficial : rivalF === 'LG' ? p.ck === 'LG' || p.ck === 'PO' : rivalF === 'CUP' ? p.oficial && p.ck !== 'LG' && p.ck !== 'PO' : !p.oficial;
  function rivales(arg) {
    S();
    if (arg) rivalSel = decodeURIComponent(arg);
    const RV = {};
    for (const p of IDX.partidos) (RV[p.rival] ||= []).push(p);
    const top = Object.entries(RV).map(([r, ps]) => [r, ps.filter(rivalOk).length]).filter(x => x[1]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 16);
    let h = `<section><div class="wrap"><h2 data-n="06">Rivales</h2>
      <p class="sub">Elige un equipo y mira todos los partidos que le jugó el ${esc(IDX.club)} de Varela: resultados, goleadores, asistencia y cómo quedó cada uno en la liga. También puedes tocar el nombre de cualquier rival en las tablas de partidos.</p>
      <input class="search" id="rvQ" list="rvList" placeholder="Escribe un equipo" autocomplete="off" value="${esc(rivalSel || '')}"><datalist id="rvList">${Object.keys(RV).sort().map(r => `<option value="${esc(r)}">`).join('')}</datalist>
      <div class="filters">${[['OF', 'Oficiales'], ['LG', 'Liga'], ['CUP', 'Copas'], ['AM', 'Amistosos'], ['ALL', 'Todos']].map(([k, t]) => `<button class="chip" data-hrvf="${k}" aria-pressed="${rivalF === k}">${t}</button>`).join('')}</div>
      <div class="filters"><span class="fl">Más enfrentados:</span>${top.map(([r, n]) => `<a class="chip" href="#rivales/${encodeURIComponent(r)}">${esc(r)} · ${n}</a>`).join('')}</div>`;
    const L = (RV[rivalSel] || []).filter(rivalOk);
    if (!rivalSel || !RV[rivalSel]) return h + '<div class="card" style="color:var(--mut)">Elige un equipo arriba para ver su historial contra el ' + esc(IDX.club) + '.</div></div></section>';
    if (!L.length) return h + '<div class="card">Sin partidos con ese filtro.</div></div></section>';
    const t = wdl(L), n = L.length, gf = L.reduce((a, p) => a + p.gf, 0), ga = L.reduce((a, p) => a + p.gc, 0);
    const hm = L.filter(p => p.casa), aw = L.filter(p => !p.casa), Hh = wdl(hm), Aa = wdl(aw);
    const bw = [...L].sort((a, b) => (b.gf - b.gc) - (a.gf - a.gc))[0], bl = [...L].sort((a, b) => (a.gf - a.gc) - (b.gf - b.gc))[0];
    h += `<div class="banner" style="--acc:#2b3b52" data-y="VS"><div class="sh"><h3>${esc(IDX.club)} – ${esc(rivalSel)}</h3><span class="pill">${n} partidos</span><span class="pill">${fecha(L[0].fecha)} → ${fecha(L[n - 1].fecha)}</span></div></div>
      <div class="grid g4" style="margin-top:14px">
        <div class="card kpi"><b>${t.w}-${t.d}-${t.l}</b><span>Victorias · empates · derrotas</span><small>${Math.round(t.w / n * 100)}% de victorias · ${d2((3 * t.w + t.d) / n)} pts/partido</small></div>
        <div class="card kpi"><b>${gf}-${ga}</b><span>Goles a favor y en contra</span><small>DG ${gf - ga > 0 ? '+' : ''}${gf - ga} · ${L.filter(p => p.gc === 0).length} porterías a cero</small></div>
        <div class="card kpi"><b>${Hh.w}-${Hh.d}-${Hh.l}</b><span>En casa (${hm.length})</span><small>GF ${hm.reduce((a, p) => a + p.gf, 0)} · GC ${hm.reduce((a, p) => a + p.gc, 0)}</small></div>
        <div class="card kpi"><b>${Aa.w}-${Aa.d}-${Aa.l}</b><span>Fuera (${aw.length})</span><small>GF ${aw.reduce((a, p) => a + p.gf, 0)} · GC ${aw.reduce((a, p) => a + p.gc, 0)}</small></div>
        <div class="card kpi"><b>${bw.gf}-${bw.gc}</b><span>Mayor victoria</span><small>${fecha(bw.fecha)} · ${bw.casa ? 'en casa' : 'fuera'}</small></div>
        <div class="card kpi"><b>${bl.gf}-${bl.gc}</b><span>Peor resultado</span><small>${fecha(bl.fecha)} · ${bl.casa ? 'en casa' : 'fuera'}</small></div></div>
      <h4>Secuencia de resultados</h4><div class="card"><div class="form" style="grid-template-columns:repeat(auto-fill,minmax(22px,1fr))">${L.map(p => `<i class="${r90(p)}" title="${fecha(p.fecha)} · ${p.casa ? 'Casa' : 'Fuera'} · ${p.gf}-${p.gc}"></i>`).join('')}</div></div>`;
    const lr = [];
    for (const s of S()) { const f = s.tabla.find(x => x.club === rivalSel); if (f) lr.push([s, f]); }
    if (lr.length) h += `<h4>Cómo quedó en la liga</h4><div class="tw"><table><thead><tr><th>Temporada</th><th>División</th><th class="n">Pos. ${esc(rivalSel)}</th><th class="n">Pts</th><th class="n">GF–GC</th><th class="n">Pos. ${esc(IDX.club)}</th><th class="n">Pts ${esc(IDX.club)}</th></tr></thead><tbody>${lr.map(([s, f]) => `<tr><td><b>${s.t}</b></td><td class="cmp">${esc(s.liga)}</td><td class="n">${f.pos}º</td><td class="n">${f.pts}</td><td class="n">${f.gf}–${f.gc}</td><td class="n">${s.lg.pos}º</td><td class="n">${s.lg.pts}</td></tr>`).join('')}</tbody></table></div>`;
    const sc = {};
    for (const p of L) for (const g of golesPropios(p)) { const k = g.iu || g.jugador; (sc[k] ||= {iu: g.iu, n: g.jugador, g: 0}).g++; }
    const tops = Object.values(sc).sort((a, b) => b.g - a.g).slice(0, 8);
    if (tops.length) h += `<h4>Quién les marcó más</h4><div class="card">${barras(tops.map(x => [x.iu ? jug(x.iu, x.n) : esc(x.n || '¿?'), x.g]), 'g')}</div>`;
    h += `<h4>Los ${n} partidos</h4><div class="tw scroll"><table><thead><tr><th>Fecha</th><th>Temp.</th><th>Competición</th><th>Sede</th><th class="n">Res.</th><th class="n">Asist.</th><th>Goleadores</th></tr></thead><tbody>${L.map(p => `<tr class="r${r90(p)}"><td class="mono" style="font-size:12px">${fecha(p.fecha)}</td><td class="cmp">${sh(p.temporada)}</td><td class="cmp">${p.ck === 'LG' ? 'Liga · J' + p.j : p.ck === 'PO' ? 'Playoff' : esc(p.competicion)}</td><td><span class="ha">${p.casa ? 'CASA' : 'FUERA'}</span></td><td class="n">${pillR(p)}</td><td class="n">${p.espectadores ? miles(p.espectadores) : '—'}</td><td class="sc">${golesTxt(p)}</td></tr>`).join('')}</tbody></table></div>`;
    return h + '</div></section>';
  }

  // ---------------------------------------------------------------- 05 · Cuándo se marca (y mapa de calor)
  let golesSel = -1;
  function goles() {
    const ss = S();
    const per = ss.map(s => { const b = [0, 0, 0, 0, 0, 0]; for (const p of s.ps) if (ckOk(p.ck)) for (const g of golesPropios(p)) b[tramo(g.minuto)]++; return b; });
    const sel = golesSel < 0 ? per.reduce((a, b) => a.map((v, i) => v + b[i]), [0, 0, 0, 0, 0, 0]) : per[golesSel];
    const tot = sel.reduce((a, b) => a + b, 0) || 1, mx = Math.max(...sel, 1);
    const W = 520, H = 230, pad = 26, bw = 62, gp = (W - pad * 2 - bw * 6) / 5;
    let o = '';
    sel.forEach((v, i) => { const h = v / mx * 150, x = pad + i * (bw + gp); o += `<rect x="${x}" y="${H - 40 - h}" width="${bw}" height="${h}" rx="4" fill="${i >= 4 ? 'var(--gold)' : 'var(--bar)'}"/><text x="${x + bw / 2}" y="${H - 46 - h}" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:13px">${v}</text><text x="${x + bw / 2}" y="${H - 26}" text-anchor="middle" style="fill:var(--ink)">${BK[i]}'</text><text x="${x + bw / 2}" y="${H - 12}" text-anchor="middle">${Math.round(v / tot * 100)}%</text>`; });
    const first = sel[0] + sel[1] + sel[2], late = sel[5];
    const ms = (golesSel < 0 ? ss : [ss[golesSel]]).flatMap(s => s.ps).filter(p => ckOk(p.ck));
    const cc = [0, 0, 0, 0];
    ms.forEach(p => cc[Math.min(3, p.gc)]++);
    const n = ms.length || 1, cm = Math.max(...cc, 1), enc = ms.reduce((a, p) => a + p.gc, 0);
    const mxr = Math.max(...per.flat(), 1);
    return `<section><div class="wrap"><h2 data-n="07">Cuándo se marca y se encaja</h2>
      <p class="sub">Reparto de los goles del ${esc(IDX.club)} por tramos del partido y cuántos encajó en cada partido. Respeta el filtro de competiciones.</p>
      ${barraCF()}
      <div class="tabs">${[['Todas', -1], ...ss.map((s, i) => [s.t, i])].map(([t, i]) => `<button class="tab" data-hgs="${i}" aria-selected="${golesSel === i}" style="min-width:90px">${t}</button>`).join('')}</div>
      <div class="grid g2"><div class="card"><h4 style="margin-top:0">Goles marcados por tramo</h4><svg viewBox="0 0 ${W} ${H}" role="img">${o}</svg>
        <ul class="facts" style="margin-top:12px"><li>1ª parte: <b>${first}</b> goles (${Math.round(first / tot * 100)}%) · 2ª parte: <b>${tot - first}</b> (${Math.round((tot - first) / tot * 100)}%)</li><li>Último cuarto de hora (76–90+): <b>${late}</b> goles (${Math.round(late / tot * 100)}%)</li><li>Antes del descanso y al final (31–45 y 76–90+): <b>${sel[2] + sel[5]}</b> (${Math.round((sel[2] + sel[5]) / tot * 100)}%)</li><li>Total contabilizado: <b>${sel.reduce((a, b) => a + b, 0)}</b> goles (sin goles en propia puerta ni tandas de penaltis)</li></ul></div>
      <div class="card"><h4 style="margin-top:0">Goles encajados por partido</h4><div class="bars">${cc.map((v, i) => `<div class="row" style="grid-template-columns:150px 1fr 70px"><span>${['0 (portería a cero)', '1 gol', '2 goles', '3 o más'][i]}</span><div class="bg"><div class="fg ${i === 0 ? 'g' : ''}" style="width:${v / cm * 100}%;${i >= 2 ? 'background:var(--l)' : ''}"></div></div><b style="width:auto">${v} · ${Math.round(v / n * 100)}%</b></div>`).join('')}</div>
        <p class="sub" style="margin:10px 0 0;font-size:13px">En ${ms.length} partidos: <b>${enc}</b> goles encajados (${d2(enc / n)} por partido).</p></div></div>
      <h4>Mapa de calor por temporada (goles marcados)</h4><div class="tw"><table class="heat"><thead><tr><th>Temporada</th>${BK.map(b => `<th style="text-align:center">${b}'</th>`).join('')}<th style="text-align:center">Total</th></tr></thead><tbody>${per.map((b, i) => `<tr><td><b>${ss[i].t}</b></td>${b.map(v => `<td style="background:color-mix(in srgb,var(--gold) ${Math.round(v / mxr * 70)}%,transparent)">${v}</td>`).join('')}<td><b>${b.reduce((a, c) => a + c, 0)}</b></td></tr>`).join('')}</tbody></table></div>
    </div></section>`;
  }

  // ---------------------------------------------------------------- 06 · Hitos y récords + mejor once
  function totalesClub() {
    const o = {};
    for (const h of D.historial) {
      if (h.club !== IDX.club || (h.tipo !== 'total' && h.tipo !== 'liga')) continue;
      const k = h.iu + '|' + h.temporada + '|' + h.orden;
      (o[k] ||= {})[h.tipo] = h;
    }
    const J2 = {};
    for (const r of Object.values(o)) {
      const h = r.total || r.liga;
      const j = (J2[h.iu] ||= {iu: h.iu, n: h.jugador, pj: 0, g: 0, a: 0, min: 0, ns: 0, nj: 0, temps: new Set()});
      j.pj += h.partidos || 0; j.g += h.goles || 0; j.a += h.asistencias || 0; j.min += h.minutos || 0; j.temps.add(h.temporada);
      if (h.nota_media && h.partidos) { j.ns += h.nota_media * h.partidos; j.nj += h.partidos; }
    }
    return Object.values(J2).map(j => ({...j, avg: j.nj ? j.ns / j.nj : 0}));
  }
  function posicionDe(iu) {
    const x = IDX.export[iu]?.posicion;
    if (x) return x;
    const p = [...(D.plantillas || [])].reverse().find(f => f.iu === iu && f.pos);
    return p ? p.pos : '';
  }
  function hitos() {
    const ss = S(), of = IDX.partidos.filter(p => p.oficial);
    const ev = [];
    if (of.length) {
      ev.push([of[0].fecha, `Primer partido oficial de Varela: ${of[0].gf}-${of[0].gc} ${of[0].casa ? 'al' : 'en casa del'} ${of[0].rival}.`]);
      const pw = of.find(p => r90(p) === 'W'); if (pw) ev.push([pw.fecha, `Primera victoria oficial: ${pw.gf}-${pw.gc} al ${pw.rival}.`]);
    }
    for (const k of [100, 200, 300, 400, 500]) if (of[k - 1]) { const p = of[k - 1]; ev.push([p.fecha, `Partido oficial número ${k}: ${p.gf}-${p.gc} ante el ${p.rival}.`]); }
    let maxM = 0, maxA = 0;
    of.forEach((p, i) => {
      const m = p.gf - p.gc;
      if (m > maxM) { if (i > 15 && m >= 4) ev.push([p.fecha, `Victoria récord: ${p.gf}-${p.gc} al ${p.rival}.`]); maxM = m; }
      // solo cuando supera el récord anterior en un 10 % (el público crece cada temporada)
      if (p.casa && p.espectadores > maxA) { if (i > 30 && p.espectadores > maxA * 1.1) ev.push([p.fecha, `Récord de asistencia en casa: ${miles(p.espectadores)} ante el ${p.rival}.`]); if (p.espectadores > maxA * 1.1 || i <= 30) maxA = p.espectadores; }
    });
    let rec = 0, n = 0, ini = null;
    of.forEach((p, i) => { if (r90(p) === 'W') { if (!n) ini = p; n++; } else { if (n > rec && n >= 5) ev.push([ini.fecha, `Empieza una racha de ${n} victorias seguidas, récord del club (hasta el ${fecha(of[i - 1].fecha)}).`]); rec = Math.max(rec, n); n = 0; } });
    let maxG = 0;
    for (const s of ss) {
      const ult = s.lgPs[s.lgPs.length - 1];
      if (s.completa && ult) {
        if (s.lg.pos === 1) ev.push([ult.fecha, `Campeones de la ${LIGA_CORTA(s.liga)} con ${s.lg.pts} puntos.`]);
        else ev.push([ult.fecha, `Fin de la liga ${s.t}: ${s.lg.pos}.º en la ${LIGA_CORTA(s.liga)} con ${s.lg.pts} puntos.`]);
        if (asciende(s)) ev.push([ult.fecha, `Ascenso a la ${LIGA_CORTA(s.sig.liga)}.`]);
      }
      const top = [...s.sq].sort((a, b) => b.g - a.g)[0];
      if (top && top.g > maxG) { if (s.i > 0 && ult) ev.push([ult.fecha, `${top.n} bate el récord de goles en una temporada: ${top.g}.`]); maxG = top.g; }
      const po = s.ps.filter(p => p.ck === 'PO'); if (po.length) { const u = po[po.length - 1]; ev.push([u.fecha, `Playoff de ${LIGA_CORTA(s.liga)}: ${u.gf}-${u.gc} ante el ${u.rival}${r90(u) === 'W' ? '' : ', eliminados'}.`]); }
    }
    let maxF = 0, maxV = 0;
    for (const t of IDX.traspasos) {
      if (t.entra && t.precio_eur > maxF) { ev.push([t.fecha, `Fichaje récord: ${t.jugador} (${t.otro_club || 'libre'}), ${kEur(t.precio_eur)}.`]); maxF = t.precio_eur; }
      if (!t.entra && !t.cesion && t.precio_eur > maxV) { ev.push([t.fecha, `Venta récord: ${t.jugador} al ${t.otro_club}, ${kEur(t.precio_eur)}.`]); maxV = t.precio_eur; }
    }
    const promo = {};
    for (const t of IDX.cantera) (promo[t.fecha] ||= []).push(t);
    for (const [f, ts] of Object.entries(promo)) ev.push([f, `Promoción de la cantera: ${ts.length} juveniles suben al primer equipo.`]);
    ev.sort((a, b) => a[0].localeCompare(b[0]));
    // récords del club
    const tt = conTabla().filter(s => s.completa);
    const maxDe = (f, mn = false) => { const v = tt.map(f); const x = mn ? Math.min(...v) : Math.max(...v); return [x, tt.filter((s, i) => v[i] === x).map(s => s.t).join(' y ')]; };
    const R = [];
    if (tt.length) {
      const [p1, t1] = maxDe(s => s.lg.pts); R.push(['Más puntos en una liga', `${p1} · ${t1}`]);
      const [p2, t2] = maxDe(s => s.lg.g); R.push(['Más victorias en una liga', `${p2} · ${t2}`]);
      const [p3, t3] = maxDe(s => s.lg.p, true); R.push(['Menos derrotas en una liga', `${p3} · ${t3}`]);
      const [p4, t4] = maxDe(s => s.lg.gf); R.push(['Más goles en una liga', `${p4} · ${t4}`]);
    }
    const rw = rachaMax(of, p => r90(p) === 'W'); if (rw.n) R.push(['Racha de victorias', `${rw.n} seguidas (${fecha(of[rw.ini].fecha)} – ${fecha(of[rw.fin].fecha)})`]);
    const ru = rachaMax(of, p => r90(p) !== 'L'); if (ru.n) R.push(['Racha sin perder', `${ru.n} partidos (${fecha(of[ru.ini].fecha)} – ${fecha(of[ru.fin].fecha)})`]);
    if (of.length) {
      const bw = [...of].sort((a, b) => (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf)[0], bl = [...of].sort((a, b) => (a.gf - a.gc) - (b.gf - b.gc) || b.gc - a.gc)[0];
      R.push(['Victoria más amplia', `${bw.gf}-${bw.gc} · ${bw.rival}, ${fecha(bw.fecha)}`], ['Derrota más amplia', `${bl.gf}-${bl.gc} · ${bl.rival}, ${fecha(bl.fecha)}`]);
      const at = of.filter(p => p.casa && p.espectadores).sort((a, b) => b.espectadores - a.espectadores)[0]; if (at) R.push(['Mayor asistencia en casa', `${miles(at.espectadores)} · ${at.rival}, ${fecha(at.fecha)}`]);
      const gl = of.flatMap(p => golesPropios(p).map(g => ({g, p})));
      if (gl.length) { const f = gl.reduce((a, b) => b.g.minuto < a.g.minuto ? b : a); R.push(['Gol más rápido', `minuto ${f.g.minuto} · ${f.g.jugador || '¿?'}, ${f.p.rival}`]); }
      let mj = null;
      for (const p of of) { const c = {}; for (const g of golesPropios(p)) if (g.iu) c[g.iu] = (c[g.iu] || 0) + 1; for (const [iu, k] of Object.entries(c)) if (!mj || k > mj.k) mj = {iu, k, p}; }
      if (mj) R.push(['Más goles en un partido', `${mj.k} · ${IDX.nombres[mj.iu]} (${mj.p.gf}-${mj.p.gc} ${mj.p.rival}, ${fecha(mj.p.fecha)})`]);
    }
    const tc = totalesClub();
    const tg = [...tc].sort((a, b) => b.g - a.g)[0]; if (tg) R.push(['Máximo goleador', `${tg.n} · ${tg.g} goles`]);
    const tp = [...tc].sort((a, b) => b.pj - a.pj)[0]; if (tp) R.push(['Más partidos', `${tp.n} · ${tp.pj}`]);
    const ts = ss.flatMap(s => s.sq.map(p => ({...p, t: s.t}))).sort((a, b) => b.g - a.g)[0]; if (ts) R.push(['Más goles en una temporada', `${ts.g} · ${ts.n} (${ts.t})`]);
    const jov = ss.flatMap(s => s.sq.filter(p => p.pj > 0 && p.edad).map(p => ({...p, t: s.t})));
    if (jov.length) { const a = jov.reduce((x, y) => y.edad < x.edad ? y : x), b = jov.reduce((x, y) => y.edad > x.edad ? y : x); R.push(['Jugador más joven en jugar', `${a.n} · ${a.edad} años (${a.t})`], ['Jugador más veterano', `${b.n} · ${b.edad} años (${b.t})`]); }
    const mf = IDX.traspasos.filter(t => t.entra && t.precio_eur).sort((a, b) => b.precio_eur - a.precio_eur)[0]; if (mf) R.push(['Mayor fichaje', `${mf.jugador} · ${kEur(mf.precio_eur)}`]);
    const mv = IDX.traspasos.filter(t => !t.entra && !t.cesion && t.precio_eur).sort((a, b) => b.precio_eur - a.precio_eur)[0]; if (mv) R.push(['Mayor venta', `${mv.jugador} · ${kEur(mv.precio_eur)}`]);
    return `<section><div class="wrap"><h2 data-n="08">Hitos y récords</h2>
      <p class="sub">La línea del tiempo del club bajo Varela y los récords, calculados con todos los partidos, plantillas y traspasos guardados.</p>
      <div class="cols2"><div class="card"><h4 style="margin-top:0">Línea del tiempo</h4><div class="tl">${ev.map(([f, t]) => `<div class="it"><div class="dt">${fecha(f)}</div><div class="tx">${esc(t)}</div></div>`).join('')}</div></div>
      <div><div class="card"><h4 style="margin-top:0">Récords del club</h4>${R.map(r => `<div class="tri" style="grid-template-columns:1fr auto"><span>${esc(r[0])}</span><span class="f">${esc(r[1])}</span></div>`).join('')}</div>
      ${mejorOnce()}</div></div></div></section>`;
  }
  function mejorOnce() {
    const tc = totalesClub().filter(j => j.pj >= 30);
    if (tc.length < 11) return '';
    const hueco = pos => {
      const p = (pos || '').split(',')[0].trim().toUpperCase(), lado = (p.match(/\(([DIC]+)\)/) || [])[1] || '';
      if (p.startsWith('POR')) return 'POR';
      if (/^(DF|CR|LI|LD)/.test(p)) return lado === 'C' || lado === 'DC' || lado === 'IC' || !lado ? 'DFC' : lado.includes('D') && !lado.includes('I') ? 'LD' : lado.includes('I') && !lado.includes('D') ? 'LI' : 'LAT';
      if (/^(MCD|MC)/.test(p)) return 'MC';
      if (/^(ME|MP)/.test(p)) return lado === 'C' ? 'MC' : lado.includes('D') && !lado.includes('I') ? 'MD' : lado.includes('I') && !lado.includes('D') ? 'MI' : 'BANDA';
      if (/^DL/.test(p)) return 'DL';
      return '';
    };
    const nota = j => j.avg + Math.min(j.pj, 150) / 150 * .3;
    const cand = tc.map(j => ({...j, h: hueco(posicionDe(j.iu))})).sort((a, b) => nota(b) - nota(a));
    const usados = new Set(), coger = (huecos, n) => { const out = []; for (const c of cand) { if (out.length >= n) break; if (!usados.has(c.iu) && huecos.includes(c.h)) { usados.add(c.iu); out.push(c); } } return out; };
    const por = coger(['POR'], 1), ld = coger(['LD', 'LAT'], 1), li = coger(['LI', 'LAT'], 1), dfc = coger(['DFC'], 2), md = coger(['MD', 'BANDA'], 1), mi = coger(['MI', 'BANDA'], 1), mc = coger(['MC'], 2), dl = coger(['DL'], 2);
    const xi = [['POR', por[0], 50, 86], ['DF', ld[0], 84, 72], ['DF', dfc[0], 62, 74], ['DF', dfc[1], 38, 74], ['DF', li[0], 16, 72], ['MC', mc[0], 62, 52], ['MC', mc[1], 38, 52], ['MP', md[0], 84, 30], ['MP', mi[0], 16, 30], ['DL', dl[0], 62, 10], ['DL', dl[1], 38, 10]].filter(x => x[1]);
    let o = `<rect width="100" height="105" fill="#2c6b3c"/>`;
    for (let i = 0; i < 7; i++) o += `<rect y="${i * 15}" width="100" height="7.5" fill="#fff" opacity=".04"/>`;
    o += `<g fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".4"><rect x="3" y="3" width="94" height="99"/><line x1="3" y1="52" x2="97" y2="52"/><circle cx="50" cy="52" r="9"/><rect x="25" y="3" width="50" height="16"/><rect x="25" y="86" width="50" height="16"/></g>`;
    for (const [, j, x, y] of xi) { const ini = j.n.split(' ').map(w => w[0]).join('').slice(0, 3); o += `<a href="#jugador/${j.iu}"><circle cx="${x}" cy="${y + 5}" r="4.4" fill="#16140f" stroke="#e7c068" stroke-width=".6"/><text x="${x}" y="${y + 6.4}" text-anchor="middle" class="pi">${esc(ini)}</text><text x="${x}" y="${y + 13}" text-anchor="middle">${esc(j.n.split(' ').slice(-1)[0])}</text></a>`; }
    return `<div class="card" style="margin-top:14px"><h4 style="margin-top:0">Mejor once de la era Varela (4-4-2)</h4><div class="pitchw"><svg viewBox="0 0 100 105" role="img" aria-label="Mejor once">${o}</svg></div>
      <div style="margin-top:10px">${xi.map(([p, j]) => `<div class="tri" style="grid-template-columns:36px 1fr auto"><span class="d">${p}</span><span>${jug(j.iu, j.n)}</span><span class="f">${j.pj} · ${j.g} · ${d2(j.avg)}</span></div>`).join('')}</div>
      <p class="sub" style="margin:8px 0 0;font-size:12px">Partidos · goles · media con el club. Elegido por FM Hub: nota media ponderada (y un poco por partidos jugados), mínimo 30 partidos, cada uno en su posición principal según su ficha.</p></div>`;
  }

  // ---------------------------------------------------------------- 07 · Rentabilidad de los fichajes
  let rentK = 'pj', rentD = -1;
  function rentabilidad() {
    const tc = {};
    for (const j of totalesClub()) tc[j.iu] = j;
    const ultimaFicha = iu => [...(D.plantillas || [])].reverse().find(f => f.iu === iu) || {};
    const vistos = new Set();
    const filas = IDX.traspasos.filter(t => t.entra && !t.cesion && t.iu && !vistos.has(t.iu) && vistos.add(t.iu)).map(t => {
      const j = tc[t.iu] || {pj: 0, g: 0, a: 0, avg: 0, temps: new Set()};
      const f = ultimaFicha(t.iu), act = D.plantilla.find(p => p.iu === t.iu);
      const sueldo = act?.sueldo_mes_eur || f.sueldo || 0;
      const val = valorEur(IDX.export[t.iu]?.valor || f.valor);
      const fee = t.precio_eur || 0, plus = val === null ? null : val - fee;
      const cost = fee + sueldo * 12 * Math.max(1, j.temps.size || 0);
      const u = j.pj >= 25, r = j.avg >= 6.85, v = val !== null && plus >= 0;
      return {iu: t.iu, n: t.jugador, fecha: t.fecha, de: t.otro_club, fee, sueldo, pj: j.pj, g: j.g, a: j.a, avg: j.avg, val, plus, cost, cpp: j.pj ? cost / j.pj : null, sc: u + r + v, u, r, v, sigue: !!act};
    });
    const pagados = filas.filter(x => x.fee > 0), tot = pagados.reduce((a, x) => a + x.fee, 0), tp = pagados.reduce((a, x) => a + (x.plus || 0), 0);
    const best = filas.filter(x => x.pj >= 25).sort((a, b) => a.cpp - b.cpp)[0];
    const lab = ['Flojo', 'Dudoso', 'Bueno', 'Excelente'];
    return `<h4 style="margin-top:34px">Rentabilidad de cada fichaje</h4>
      <p class="sub" style="margin:0 0 12px">Todos los fichajes con lo que costaron, lo que rindieron con el club y cuánto valen ahora (valor de pantalla de FM). La valoración suma un punto por cada condición: <b>uso</b> (25 partidos o más), <b>rendimiento</b> (media de 6,85 o más) y <b>valor</b> (hoy vale más de lo que costó). El coste estimado suma el precio y 12 mensualidades por temporada en el club.</p>
      <div class="grid g4" style="margin-bottom:12px">${[[filas.length, 'fichajes en total'], [filas.length - pagados.length, 'llegaron gratis'], [kEur(tot), 'pagado en traspasos'], [(tp >= 0 ? '+' : '−') + kEur(Math.abs(tp)), 'plusvalía de los de pago (valor − precio)'], [best ? best.n : '—', 'menor coste por partido (25+ PJ)']].map(k => `<div class="card kpi"><b style="font-size:20px">${esc(k[0])}</b><span>${k[1]}</span></div>`).join('')}</div>
      ${tabla('rent', [{k: 'n', t: 'Jugador', h: x => jug(x.iu, x.n) + ` <span class="ha">${fecha(x.fecha)}</span>${x.sigue ? '' : ' <span class="ha">YA NO ESTÁ</span>'}`},
        {k: 'fee', t: 'Precio', n: 1, h: x => x.fee ? kEur(x.fee) : 'libre'}, {k: 'sueldo', t: '€/mes', n: 1, h: x => x.sueldo ? miles(x.sueldo) : '—'}, {k: 'pj', t: 'PJ', n: 1}, {k: 'g', t: 'G', n: 1}, {k: 'a', t: 'A', n: 1},
        {k: 'avg', t: 'Media', n: 1, h: x => x.avg ? d2(x.avg) : '—'}, {k: 'val', t: 'Valor hoy', n: 1, h: x => kEur(x.val)}, {k: 'plus', t: 'Plusvalía', n: 1, h: x => x.plus === null ? '—' : `<span style="color:var(--${x.plus >= 0 ? 'w' : 'l'})">${x.plus >= 0 ? '+' : '−'}${kEur(Math.abs(x.plus))}</span>`},
        {k: 'cost', t: 'Coste est.', n: 1, h: x => kEur(x.cost)}, {k: 'cpp', t: '€/partido', n: 1, h: x => x.cpp ? miles(x.cpp) + ' €' : '—'},
        {k: 'sc', t: 'Valoración', h: x => `<span class="vd v${x.sc}" title="${x.u ? '✓' : '✕'} uso · ${x.r ? '✓' : '✕'} rendimiento · ${x.v ? '✓' : '✕'} valor">${x.pj < 10 ? 'Sin base' : lab[x.sc]}</span>`}], filas, {k: 'pj', d: -1})}`;
  }

  // ---------------------------------------------------------------- 08 · Economía (desglose)
  function economia() {
    const eco = D.economia || [];
    if (!eco.length) return '';
    const tExp = eco[0].temporada, tPrev = tExp ? `${+tExp.slice(0, 4) - 1}/${tExp.slice(2, 4)}` : null;
    const ing = eco.filter(r => r.tipo === 'ingresos' && r.temporada_pasada_eur > 0), gas = eco.filter(r => r.tipo === 'gastos' && r.temporada_pasada_eur > 0);
    const meses = D.finanzas.filter(f => f.temporada === tPrev);
    const ti = meses.reduce((a, f) => a + (f.ingresos_totales_eur || 0), 0), tg = meses.reduce((a, f) => a + (f.gastos_totales_eur || 0), 0);
    const ult = D.finanzas[D.finanzas.length - 1] || {};
    const eb = l => { const s = [...l].sort((a, b) => b.temporada_pasada_eur - a.temporada_pasada_eur).slice(0, 14), m = Math.max(...s.map(x => x.temporada_pasada_eur), 1); return s.map(x => `<div class="row" style="grid-template-columns:150px 1fr 100px"><span title="${esc(x.concepto)}">${esc(x.concepto)}</span><div class="bg"><div class="fg ${x.tipo === 'ingresos' ? 'g' : ''}" style="width:${x.temporada_pasada_eur / m * 100}%"></div></div><b style="width:auto;white-space:nowrap">${eur(x.temporada_pasada_eur)}</b></div>`).join(''); };
    return `<h4>Economía ${esc(tPrev || '')}: partidas de ingresos y gastos</h4>
      <p class="sub" style="margin:0 0 12px">Partidas de la pantalla de finanzas de FM (columna «temporada pasada»). Algunas son subapartados de otras, así que no se suman.</p>
      <div class="grid g4" style="margin-bottom:14px">${[[eur(ti), 'Ingresos totales (suma mensual)'], [eur(ti - tg), 'Resultado del ejercicio'], [eur((gas.find(x => /Sueldos de jug/.test(x.concepto)) || {}).temporada_pasada_eur), 'Sueldos de jugadores'],
        [eur(Math.round((ult.masa_salarial_semana || 0) * 5.067)), `Masa salarial mensual (tope ${eur(Math.round((ult.presupuesto_salarial_semana || 0) * 5.067))})`]].map(k => `<div class="card kpi"><b style="font-size:22px">${k[0]}</b><span>${k[1]}</span></div>`).join('')}</div>
      <div class="grid g2"><div class="card"><h4 style="margin-top:0">Ingresos · partidas principales</h4><div class="bars">${eb(ing)}</div></div><div class="card"><h4 style="margin-top:0">Gastos · partidas principales</h4><div class="bars">${eb(gas)}</div></div></div>`;
  }

  // ---------------------------------------------------------------- 09 · Plan de plantilla (perfiles, nunca fichajes con nombre)
  const calcSel = new Set();
  let calcIni = false, calcMasa = null, calcPres = null;
  function plan() {
    const ss = S();
    const prev = [...ss].reverse().find(s => s.completa) || ss[ss.length - 1];
    const prevSq = {};
    for (const p of prev.sq) prevSq[p.iu] = p;
    const fj = IDX.fechaJuego ? new Date(IDX.fechaJuego) : new Date();
    const finDe = c => { if (!c) return null; const m = c.match(/(\d{4})-(\d{2})-(\d{2})/) || c.match(/(\d+)\/(\d+)\/(\d{4})/); if (!m) return null; return m[0].includes('-') ? new Date(c.slice(0, 10)) : new Date(+m[3], +m[2] - 1, +m[1]); };
    const filas = D.plantilla.map(p => {
      const a = J(p.atributos), x = IDX.export[p.iu] || {}, q = prevSq[p.iu] || {}, act = (IDX.stats[p.iu] || {}).total || {};
      const m = ks => { const v = ks.map(k => a[k]).filter(v => v > 1); return v.length ? Math.round(v.reduce((s, y) => s + y, 0) / v.length * 10) / 10 : null; };
      // para el plan, quien también puede jugar de delantero centro (DL) cuenta como delantero
      const pos = x.posicion || '', gr = /\bDL\b/.test(pos) && !/^(POR|DF)/.test(pos) ? 'DEL' : grupoPos(pos), fin = finDe(p.fin_contrato);
      return {iu: p.iu, n: p.nombre, pos, gr, edad: edad(p.fecha_nacimiento), min: q.min || 0, pj: q.pj || 0, avgPrev: q.avg || 0, avgAct: act.nota_media || 0, g: q.g || 0,
              sueldo: p.sueldo_mes_eur || 0, contrato: p.fin_contrato, fin, valor: x.valor, val: valorEur(x.valor),
              pase: gr === 'POR' ? null : m(['Pas', 'Ctr', 'Téc', 'Dec', 'Vis', 'JEq']), pres: gr === 'POR' ? null : m(['Agr', 'Ant', 'Sac', 'Res', 'Det', 'JEq']), rit: gr === 'POR' ? null : m(['Ace', 'Vel'])};
    });
    const med = arr => { const s = arr.filter(v => v).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
    const mSueldo = med(filas.map(f => f.sueldo)), mNota = med(filas.filter(f => f.pj >= 10).map(f => f.avgPrev)), mMin = med(filas.map(f => f.min));
    const unAño = new Date(fj); unAño.setFullYear(unAño.getFullYear() + 1);
    for (const f of filas) {
      f.tag = f.sueldo >= mSueldo * 1.4 && f.pj >= 10 && f.avgPrev && f.avgPrev < mNota ? 'sale'
        : f.fin && f.fin <= unAño ? 'dec'
        : f.pj >= 3 && f.avgPrev >= mNota + .15 && f.min < mMin ? 'min'
        : f.gr === 'DEF' && f.rit !== null && f.rit <= 8.5 ? 'rev' : 'core';
    }
    const salidas = filas.filter(f => f.tag === 'sale').sort((a, b) => b.sueldo * (mNota - b.avgPrev) - a.sueldo * (mNota - a.avgPrev));
    const noRenovar = filas.filter(f => f.tag === 'dec');
    if (!calcIni) { salidas.slice(0, 3).forEach(f => calcSel.add(f.iu)); calcIni = true; }
    const ult = D.finanzas[D.finanzas.length - 1] || {};
    if (calcMasa === null) calcMasa = Math.round((ult.masa_salarial_semana || 0) * 5.067);
    if (calcPres === null) calcPres = Math.round((ult.presupuesto_salarial_semana || 0) * 5.067);
    const card = (cls, tag, title, body) => `<div class="card pc ${cls}"><span class="tag">${tag}</span><h4>${title}</h4><p>${body}</p></div>`;
    const comparable = f => filas.filter(o => o.gr === f.gr && o.iu !== f.iu && o.sueldo && o.sueldo <= f.sueldo * .6 && o.avgPrev >= f.avgPrev && o.pj >= 10).sort((a, b) => b.avgPrev - a.avgPrev)[0];
    const sells = salidas.slice(0, 6).map((f, i) => { const c = comparable(f); return card('sell', `${i + 1} · ${f.edad >= 29 ? 'Vender' : 'Vender o renegociar'}`, jug(f.iu, f.n),
      `${eur(f.sueldo)} al mes${f.contrato ? ' hasta ' + fecha(f.contrato) : ''} (la mediana de la plantilla es ${eur(mSueldo)}). Media de ${d2(f.avgPrev)} en ${prev.t} con ${num(f.min)} minutos, por debajo de la mediana del equipo (${d2(mNota)}).${c ? ` ${esc(c.n)} cobra ${eur(c.sueldo)} y rindió ${d2(c.avgPrev)}.` : ''}${f.valor ? ` Valor en pantalla: ${esc(f.valor)}.` : ''}`); });
    const mins = filas.filter(f => f.tag === 'min').sort((a, b) => b.avgPrev - a.avgPrev).slice(0, 5).map(f => card('min', 'Más minutos', jug(f.iu, f.n),
      `${d2(f.avgPrev)} de media en ${prev.t} (mediana ${d2(mNota)}) con solo ${num(f.min)} minutos${f.g ? ` y ${f.g} goles` : ''}. ${f.edad ? f.edad + ' años' : ''}${f.sueldo ? ', cobra ' + eur(f.sueldo) : ''}.${f.pres !== null ? ` Pase ${d2(f.pase)} · presión ${d2(f.pres)} · ritmo ${d2(f.rit)}.` : ''}`));
    // perfiles: líneas con peor rendimiento o menos jugadores (sin nombres de fichajes)
    const NECESIDAD = {POR: 2, DEF: 7, MED: 7, DEL: 4};
    const grupos = Object.keys(NECESIDAD).map(g => { const l = filas.filter(f => f.gr === g); const r = l.filter(f => f.pj >= 10); return {g, n: l.length, nota: media(r.map(f => f.avgPrev)) || 0, pase: media(l.map(f => f.pase).filter(Boolean)), pres: media(l.map(f => f.pres).filter(Boolean)), rit: media(l.map(f => f.rit).filter(Boolean)), sueldo: med(l.map(f => f.sueldo)), falta: NECESIDAD[g] - l.filter(f => f.tag !== 'sale').length}; });
    const NOMBRE_G = {POR: 'Portero', DEF: 'Defensa', MED: 'Centrocampista', DEL: 'Delantero'};
    const need = grupos.sort((a, b) => (b.falta - a.falta) || (a.nota - b.nota)).map((g, i) => card(i < 2 ? 'sign' : 'min', i < 2 ? `Prioridad ${i + 1} · ${NOMBRE_G[g.g]}` : 'Revisar', `${NOMBRE_G[g.g]}: ${g.n} en plantilla${g.falta > 0 ? `, ${g.falta === 1 ? 'falta 1' : 'faltan ' + g.falta} para una rotación sana` : ''}`,
      `Media del grupo en ${prev.t}: ${d2(g.nota)}.${g.g !== 'POR' ? ` Perfil a buscar por encima de lo que hay: pase ≥ ${d2(Math.ceil((g.pase || 10) + 1))}, presión ≥ ${d2(Math.ceil((g.pres || 10) + 1))}, ritmo ≥ ${d2(Math.ceil((g.rit || 10) + 1))} (medias actuales del grupo: ${d2(g.pase)} · ${d2(g.pres)} · ${d2(g.rit)}).` : ' Mira reflejos, mando de área y uno contra uno por encima de los del titular actual.'} Sueldo orientativo: hasta ${eur(Math.round(g.sueldo * 1.3 / 100) * 100)} al mes. Los nombres los buscas tú: aquí solo va el perfil.`));
    const info = [...salidas.map(f => ({...f, k: 'venta'})), ...noRenovar.map(f => ({...f, k: 'fin'}))];
    const on = info.filter(x => calcSel.has(x.iu)), libera = on.reduce((a, x) => a + x.sueldo, 0), ingreso = on.filter(x => x.k === 'venta').reduce((a, x) => a + (x.val || 0), 0);
    const masa = calcMasa - libera, margen = calcPres - masa;
    const c = (v, hi, lo) => v === null || v === undefined ? '—' : `<span style="${v >= hi ? 'color:var(--w);font-weight:700' : v <= lo ? 'color:var(--l);font-weight:700' : ''}">${d2(v)}</span>`;
    const tg = {sale: ['Salida', 0], dec: ['Contrato', 1], min: ['Más minutos', 3], rev: ['Revisar', 1], core: ['Pilar', 2]};
    const porAño = {};
    for (const f of filas) if (f.fin) porAño[f.fin.getFullYear()] = (porAño[f.fin.getFullYear()] || 0) + 1;
    const caros = [...filas].sort((a, b) => b.sueldo - a.sueldo).slice(0, 4);
    const renov = renovaciones(filas, fj, mSueldo, mNota, mMin, calcPres - calcMasa);
    return `<section><div class="wrap"><h2 data-n="11">Plan de plantilla</h2>
      <p class="sub">Primero quién podría irse, después qué perfiles hacen falta y a quién dar más minutos. Lo calcula FM Hub con números y atributos visibles (rendimiento de ${esc(prev.t)}, sueldos, contratos y valor). No ve lesiones, moral ni tu táctica, así que la decisión final es tuya. Los fichajes concretos los buscas tú: aquí solo van perfiles.</p>
      <div class="card"><h4 style="margin:0 0 6px;color:var(--ink);font:800 17px Archivo;text-transform:none;letter-spacing:0">Cómo se mide</h4><ul style="margin:6px 0 0;padding-left:18px;font-size:13.5px">
        <li><b>Pase</b> = media de pase, control, técnica, decisiones, visión y trabajo en equipo. <b>Presión</b> = agresividad, anticipación, sacrificio, resistencia, determinación y trabajo en equipo. <b>Ritmo</b> = aceleración y velocidad.</li>
        <li><b>Salida:</b> cobra al menos 1,4 veces la mediana (${eur(mSueldo)}) y rinde por debajo de la mediana del equipo (${d2(mNota)}). <b>Contrato:</b> acaba en menos de un año. <b>Más minutos:</b> rinde por encima de la mediana y juega menos que la mayoría. <b>Revisar:</b> defensa con ritmo de 8,5 o menos.</li></ul></div>
      <h4>1 · Quiénes podrían irse</h4><div class="pgrid">${sells.join('') || '<p class="vacio">Nadie cumple los criterios de salida.</p>'}</div>
      <h4>2 · A quién renovarías</h4>${renov}
      <h4>3 · Qué perfiles hacen falta</h4><div class="pgrid">${need.join('')}</div>
      <h4>4 · Cuentas: cuánto se libera</h4><div class="card"><p class="sub" style="margin:0 0 10px">Activa o quita salidas y ajusta la masa salarial y el presupuesto si los cambias en FM.</p>
        <div class="calc">${info.map(x => `<button class="chip" data-hcalc="${x.iu}" aria-pressed="${calcSel.has(x.iu)}">${x.k === 'fin' ? 'No renovar' : 'Vender'} · ${esc(x.n)} · ${miles(x.sueldo)} €</button>`).join('') || '<span class="mini">No hay salidas propuestas.</span>'}</div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin:10px 0;font-size:13px"><label>Masa salarial (€/mes) <input id="hcM" type="number" value="${calcMasa}" style="width:110px;padding:4px 6px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink)"></label><label>Presupuesto salarial (€/mes) <input id="hcP" type="number" value="${calcPres}" style="width:110px;padding:4px 6px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink)"></label></div>
        <div class="grid g4"><div class="card kpi"><b style="font-size:22px">−${miles(libera)} €</b><span>Sueldos liberados al mes</span></div><div class="card kpi"><b style="font-size:22px">${miles(masa)} €</b><span>Masa salarial resultante</span></div><div class="card kpi"><b style="font-size:22px;color:var(--${margen >= 0 ? 'w' : 'l'})">${margen >= 0 ? '+' : '−'}${miles(Math.abs(margen))} €</b><span>Margen frente al presupuesto</span><small>${margen >= 0 ? 'Para fichar sin pasarte' : 'Aún por encima del presupuesto'}</small></div><div class="card kpi"><b style="font-size:22px">${kEur(ingreso)}</b><span>Valor de mercado de lo que se vende</span><small>Orientativo; el precio real lo marca la oferta</small></div></div></div>
      <h4>5 · A quién dar más minutos</h4><div class="pgrid">${mins.join('') || '<p class="vacio">Nadie destaca con pocos minutos.</p>'}</div>
      <h4>6 · Radiografía de la plantilla</h4>${tabla('radio', [{k: 'n', t: 'Jugador', h: f => jug(f.iu, f.n)}, {k: 'pos', t: 'Posición', cls: 'cmp'}, {k: 'edad', t: 'Edad', n: 1}, {k: 'min', t: `Min. ${sh(prev.t)}`, n: 1, h: f => num(f.min)},
        {k: 'avgPrev', t: `Media ${sh(prev.t)}`, n: 1, h: f => f.avgPrev ? d2(f.avgPrev) : '—'}, {k: 'avgAct', t: 'Media actual', n: 1, h: f => f.avgAct ? d2(f.avgAct) : '—'},
        {k: 'pase', t: 'Pase', n: 1, h: f => c(f.pase, 11, 8)}, {k: 'pres', t: 'Presión', n: 1, h: f => c(f.pres, 12, 9.5)}, {k: 'rit', t: 'Ritmo', n: 1, h: f => c(f.rit, 13, 8.5)},
        {k: 'sueldo', t: '€/mes', n: 1, h: f => miles(f.sueldo)}, {k: 'contrato', t: 'Contrato', h: f => fecha(f.contrato)}, {k: 'tag', t: 'Valoración', h: f => `<span class="vd v${tg[f.tag][1]}">${tg[f.tag][0]}</span>`}], filas, {k: 'min', d: -1})}
      <p class="sub" style="margin:8px 0 0;font-size:12px">Verde = alto, rojo = bajo (pase ≥11 / ≤8; presión ≥12 / ≤9,5; ritmo ≥13 / ≤8,5). Son medias de atributos del juego; los porteros no tienen estas cifras.</p>
      <h4>7 · Otras cosas a vigilar</h4><div class="pgrid">
        ${card('now', 'Renovaciones', 'Cuándo acaban los contratos', Object.entries(porAño).sort().map(([a, n]) => `${n} en ${a}`).join(' · ') + '. A quien vayas a conservar, renuévalo antes de que le quede un año y pierda valor de venta.')}
        ${card('min', 'Masa salarial por rendimiento', 'Quién cobra más', caros.map(f => `${esc(f.n)} (${miles(f.sueldo)} €, media ${f.avgPrev ? d2(f.avgPrev) : '—, aún sin jugar'})`).join(' · ') + '. Es lo primero que mirar si hay que recortar.')}</div>
    </div></section>`;
  }

  // ---------------------------------------------------------------- 09b · Renovaciones: a quién, por cuánto y por cuántos años
  // Solo con datos visibles: rendimiento (media y minutos), edad, sueldo actual, sueldos del resto de la plantilla y
  // fecha de fin de contrato. La horquilla sale de lo que cobran en la plantilla los que rinden como él, sin pasar
  // de una subida razonable sobre lo que ya cobra; nunca del valor interno del jugador.
  function renovaciones(filas, fj, mSueldo, mNota, mMin, margen) {
    const meses = d => (d - fj) / (30.44 * 864e5);
    const r50 = v => Math.round(v / 50) * 50;
    const maxSueldo = Math.max(0, ...filas.map(f => f.sueldo));
    const cand = filas.filter(f => f.fin && meses(f.fin) <= 18 && meses(f.fin) > -1);
    if (!cand.length) return `<p class="vacio">Nadie acaba contrato en los próximos 18 meses. Cuando falte año y medio, aparecerán aquí.</p>`;
    const nota = f => f.avgPrev || f.avgAct || 0;
    const años = e => !e ? '2–3 años' : e <= 21 ? '4–5 años' : e <= 24 ? '3–4 años' : e <= 28 ? '3 años' : e <= 31 ? '2 años' : '1 año (con otro opcional si cumple)';
    const out = cand.map(f => {
      const m = meses(f.fin), n = nota(f), juega = f.min >= mMin * .8, rinde = n && n >= mNota, joven = f.edad && f.edad <= 23;
      let tipo, cls;
      if (f.tag === 'sale') { tipo = 'Dejar ir'; cls = 'sell'; }
      else if ((rinde && juega) || (joven && rinde)) { tipo = 'Renovar ya'; cls = 'sign'; }
      else if (joven || (n && n >= mNota - .15) || juega) { tipo = 'Renovar si es barato'; cls = 'min'; }
      else { tipo = 'Dejar ir'; cls = 'sell'; }
      // referencia: lo que cobran en la plantilla los que rinden como él o mejor
      const pares = filas.filter(o => o.iu !== f.iu && o.sueldo && nota(o) && n && nota(o) >= n - .1 && nota(o) <= n + .3);
      const ref = pares.length ? pares.map(o => o.sueldo).sort((a, b) => a - b)[Math.floor(pares.length / 2)] : mSueldo;
      const tope = cls === 'sign' ? (joven ? 1.6 : 1.4) : 1.15;
      let desde = r50(Math.max(f.sueldo, Math.min(ref * .9, f.sueldo * 1.1)));
      let hasta = r50(Math.max(desde * 1.1, Math.min(Math.max(ref, f.sueldo) * 1.1, f.sueldo * tope)));
      if (!f.sueldo) hasta = r50(Math.max(desde, ref));
      // ya cobra bastante más que los que rinden como él: renovar sin subir (o pedirle una rebaja)
      const caro = f.sueldo > ref * 1.3 && cls !== 'sell';
      if (caro) { desde = r50(Math.max(ref * 1.2, f.sueldo * .85)); hasta = f.sueldo; }
      const cedido = (D.plantilla.find(p => p.iu === f.iu) || {}).cedido_a;
      const urg = m <= 6 ? `<b style="color:var(--l)">Urgente:</b> le quedan ${Math.max(0, Math.round(m))} meses; en los últimos 6 meses puede firmar por otro club gratis.`
        : m <= 12 ? `Le queda menos de un año: renueva antes de que baje su valor de venta.` : `Le quedan ${Math.round(m)} meses: hay margen, pero renovar pronto suele salir más barato.`;
      const rend = n ? `media de ${d2(n)} (la del equipo es ${d2(mNota)}) con ${num(f.min)} minutos` : 'aún sin partidos que valorar';
      const sube = hasta - f.sueldo;
      return {f, tipo, cls, m, sube: cls === 'sell' ? 0 : sube, html: `<div class="card pc ${cls}"><span class="tag">${tipo}${m <= 6 ? ' · urgente' : ''}</span><h4>${jug(f.iu, f.n)}</h4>
        <p>${f.edad ? f.edad + ' años · ' : ''}${esc(f.pos || '')} · contrato hasta ${fecha(f.contrato)}${cedido ? ` · cedido en el ${esc(cedido)}` : ''}. Cobra ${eur(f.sueldo)} al mes; ${rend}.</p>
        ${cls === 'sell' ? `<p>No compensa: ${n && n < mNota ? 'rinde por debajo del equipo' : 'apenas juega'}${f.sueldo > mSueldo ? ' y cobra más que la mediana (' + eur(mSueldo) + ')' : ''}. Deja que acabe el contrato o véndelo antes para sacar algo.</p>`
          : `<div class="ofr"><div><span>Ofrécele</span><b>${eur(desde)} – ${eur(hasta)}</b><small>al mes</small></div><div><span>Duración</span><b>${años(f.edad)}</b></div><div><span>No pases de</span><b>${eur(hasta)}</b><small>${hasta > maxSueldo ? 'sería el que más cobra' : sube > 0 ? '+' + eur(sube) + ' sobre lo actual' : 'sin subida'}</small></div></div>
          <p class="mini" style="margin:6px 0 0">Referencia: los que rinden como él en la plantilla cobran en torno a ${eur(ref)}.${caro ? ' Ya cobra bastante más que ellos: renueva sin subirle el sueldo, o intenta bajarlo.' : cls === 'min' ? ' Es rotación: si pide más del tope, déjalo ir.' : ''}</p>`}
        <p class="mini" style="margin:6px 0 0">${urg}</p></div>`};
    }).sort((a, b) => ({sign: 0, min: 1, sell: 2}[a.cls] - {sign: 0, min: 1, sell: 2}[b.cls]) || a.m - b.m);
    const coste = out.reduce((s, x) => s + x.sube, 0);
    return `<p class="sub" style="margin:0 0 10px">Contratos que acaban en los próximos 18 meses. La horquilla sale de lo que ya cobran en tu plantilla los que rinden parecido, con una subida razonable sobre su sueldo actual. Empieza la negociación por abajo; el máximo es para no romper la escala salarial.</p>
      <div class="pgrid">${out.map(x => x.html).join('')}</div>
      <p class="mini" style="margin:8px 0 0">Si renuevas a todos los que se proponen por el máximo, la masa salarial sube ${eur(coste)} al mes${isFinite(margen) && margen ? ` (margen actual frente al presupuesto: ${eur(margen)})` : ''}.</p>`;
  }

  // ---------------------------------------------------------------- ficha: trayectoria con el club (como varela.html)
  function trayectoria(iu) {
    const ent = S().map(s => ({s, p: s.sq.find(p => p.iu === iu)})).filter(x => x.p && (x.p.pj || x.p.sueldo));
    if (!ent.length) return '';
    const t = ent.reduce((o, {p}) => ({pj: o.pj + p.pj, g: o.g + p.g, a: o.a + p.a, min: o.min + p.min, yc: o.yc + p.yc, rc: o.rc + p.rc, sa: o.sa + (p.avg ? p.avg * p.pj : 0), sw: o.sw + (p.avg ? p.pj : 0)}), {pj: 0, g: 0, a: 0, min: 0, yc: 0, rc: 0, sa: 0, sw: 0});
    const mx = Math.max(1, ...ent.map(e => Math.max(e.p.g, e.p.a)));
    const f = [];
    const best = ent.filter(e => e.p.avg && e.p.pj >= 10).sort((a, b) => b.p.avg - a.p.avg)[0]; if (best) f.push(`Mejor media: <b>${d2(best.p.avg)}</b> en ${best.s.t} (${best.p.pj} partidos)`);
    const bg = [...ent].sort((a, b) => b.p.g - a.p.g)[0]; if (bg?.p.g) f.push(`Más goles en una temporada: <b>${bg.p.g}</b> en ${bg.s.t}`);
    const ba = [...ent].sort((a, b) => b.p.a - a.p.a)[0]; if (ba?.p.a) f.push(`Más asistencias en una temporada: <b>${ba.p.a}</b> en ${ba.s.t}`);
    const gl = IDX.partidos.filter(p => p.oficial).flatMap(p => golesPropios(p).filter(g => g.iu === iu).map(g => ({g, p})));
    if (gl.length) {
      const g0 = gl[0]; f.push(`Primer gol oficial: <b>${fecha(g0.p.fecha)}</b> contra el ${esc(g0.p.rival)} (min. ${g0.g.minuto})`);
      const porP = {}; for (const x of gl) porP[x.p.clave] = (porP[x.p.clave] || 0) + 1;
      const hat = Object.values(porP).filter(n => n >= 3).length; if (hat) f.push(`Tripletes o más: <b>${hat}</b>`);
      const pen = gl.filter(x => x.g.tipo === 2).length; if (pen) f.push(`Goles de penalti: <b>${pen}</b>`);
      const late = gl.filter(x => x.g.minuto >= 90).length; if (late) f.push(`Goles en el minuto 90 o después: <b>${late}</b>`);
      const fast = gl.reduce((a, b) => b.g.minuto < a.g.minuto ? b : a); f.push(`Gol más madrugador: <b>min. ${fast.g.minuto}</b> contra el ${esc(fast.p.rival)} (${fecha(fast.p.fecha)})`);
      const lg = gl.filter(x => NIVEL_LIGA[x.p.competicion]).length; f.push(`Goles por competición: <b>${lg}</b> en liga · <b>${gl.length - lg}</b> en copas y playoffs`);
      const hm = gl.filter(x => x.p.casa).length; f.push(`Casa / fuera: <b>${hm}</b> / <b>${gl.length - hm}</b>`);
      const rv = {}; for (const x of gl) rv[x.p.rival] = (rv[x.p.rival] || 0) + 1;
      const tr = Object.entries(rv).sort((a, b) => b[1] - a[1])[0]; if (tr[1] >= 2) f.push(`Rival al que más ha marcado: <b>${esc(tr[0])}</b> (${tr[1]} goles)`);
    }
    for (const x of D.traspasos.filter(t => t.iu === iu)) f.push(x.tipo === 'cantera' ? `Subió de la cantera el <b>${fecha(x.fecha)}</b>` : x.entra ? `Llegó el <b>${fecha(x.fecha)}</b> ${x.otro_club ? 'desde ' + esc(x.otro_club) : '(libre)'}${x.precio_eur ? ' · ' + kEur(x.precio_eur) : ''}` : `Salió el <b>${fecha(x.fecha)}</b> a ${esc(x.otro_club || '¿?')}${x.cesion ? ' (cesión)' : x.precio_eur ? ' · ' + kEur(x.precio_eur) : ''}`);
    return `<div class="prof"><h5>Trayectoria en el ${esc(IDX.club)} · ${ent.map(e => sh(e.s.t)).join(' · ')}</h5><div class="pk">
      <div><b>${ent.length}</b><span>${ent.length === 1 ? 'temporada' : 'temporadas'} en el club</span></div><div><b>${t.pj}</b><span>partidos</span></div><div><b>${t.g}</b><span>goles</span></div><div><b>${t.a}</b><span>asistencias</span></div>
      <div><b>${t.sw ? d2(t.sa / t.sw) : '—'}</b><span>media ponderada</span></div><div><b>${num(t.min)}</b><span>minutos</span></div><div><b>${t.pj ? d2(t.g / t.pj) : '—'}</b><span>goles por partido</span></div><div><b>${t.yc}·${t.rc}</b><span>amarillas · rojas</span></div></div>
      <h5>Goles y asistencias por temporada</h5><div class="sb">${ent.map(e => `<div class="c"><span>${e.p.g}·${e.p.a}</span><div style="display:flex;align-items:flex-end;gap:3px;width:100%;justify-content:center;height:60px"><i style="width:40%;max-width:18px;background:var(--gold);border-radius:3px 3px 0 0;height:${e.p.g / mx * 100}%;min-height:2px"></i><i style="width:40%;max-width:18px;background:var(--bar);opacity:.7;border-radius:3px 3px 0 0;height:${e.p.a / mx * 100}%;min-height:2px"></i></div><span>${sh(e.s.t)}</span></div>`).join('')}</div>
      <div class="legend"><span><b style="background:var(--gold)"></b>Goles</span><span><b style="background:var(--bar);opacity:.7"></b>Asistencias</span></div>
      <h5>Temporada a temporada</h5><div class="pt-w"><table class="pt"><thead><tr><th>Temp.</th><th>Posición</th><th class="n">Edad</th><th class="n">PJ</th><th class="n">G</th><th class="n">A</th><th class="n">Media</th><th class="n">Min</th><th class="n">Am/Ro</th><th class="n">€/mes</th><th>Contrato</th><th>Valor</th></tr></thead><tbody>${ent.map(({s, p}) => `<tr><td><b>${sh(s.t)}</b></td><td class="cmp">${esc(p.pos || '—')}</td><td class="n">${p.edad || '—'}</td><td class="n">${p.pj}${p.sb ? ` (${p.sb})` : ''}</td><td class="n">${p.g}</td><td class="n">${p.a || '—'}</td><td class="n">${p.avg ? d2(p.avg) : '—'}</td><td class="n">${p.min ? miles(p.min) : '—'}</td><td class="n">${p.yc || p.rc ? p.yc + '/' + p.rc : '—'}</td><td class="n">${p.sueldo ? miles(p.sueldo) : '—'}</td><td class="cmp">${esc(p.contrato || '—')}</td><td class="cmp">${esc(p.valor || '—')}</td></tr>`).join('')}</tbody></table></div>
      ${f.length ? `<h5>Datos interesantes</h5><ul class="facts">${f.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}</div>`;
  }

  // ---------------------------------------------------------------- cabecera y notas (como varela.html)
  function entradilla() {
    const ss = S(), tt = conTabla(), pal = palmares();
    const of = IDX.partidos.filter(p => p.oficial);
    const n = ss.filter(s => s.ps.some(p => p.oficial)).length;
    const num_ = k => ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'][k] || k;
    const desde = tt[0], hasta = tt[tt.length - 1];
    const t = pal.titulos.length, a = pal.asc.length;
    return `${n === 1 ? 'Una temporada' : num_(n).charAt(0).toUpperCase() + num_(n).slice(1) + ' temporadas'}, ${miles(of.length)} partidos oficiales${t ? `, ${t === 1 ? 'un título' : num_(t) + ' títulos'}` : ''}${a ? ` y ${a === 1 ? 'un ascenso' : num_(a) + ' ascensos'}` : ''}${desde && hasta && desde.liga !== hasta.liga ? `: de la ${LIGA_CORTA(desde.liga)} a la ${LIGA_CORTA(hasta.liga)}` : ''}. Cada partido, cada plantilla y cada atributo, leídos del propio juego mientras juegas.`;
  }
  function notas() {
    const ss = S(), of = IDX.partidos.filter(p => p.oficial);
    const r = wdl(of), v = of.filter(p => p.res === 'W').length, e = of.filter(p => p.res === 'D').length;
    return `<h2 style="font-size:24px;color:var(--ink)">Notas sobre los datos</h2><ul>
      <li>Todo se lee de la memoria del juego mientras juegas (las exportaciones antiguas solo completan lo que la memoria ya no guarda). Las tandas de penaltis cuentan como victoria o derrota, igual que en el historial del mánager (${v}V-${e}E-${of.length - v - e}D; sin tandas serían ${r.w}-${r.d}-${r.l}).</li>
      <li>Partidos, goles y medias de cada jugador: tabla de carrera de FM. Sueldo, contrato, posición y atributos: la ficha del jugador en memoria (de temporadas antiguas, las exportaciones que había). El valor de mercado es el último que se vio en pantalla.</li>
      <li>Clasificaciones copiadas de las tablas del juego al abrirlas. Ascensos y descensos de los rivales se deducen de en qué liga juega cada uno la temporada siguiente.</li>
      <li>Próximo partido y calendario: de la memoria del juego. Rondas de copa y formaciones: de los calendarios antiguos que había; sin ellos, una copa se da por ganada si se gana su último partido.</li>
      <li>Los goles por jugador de la tabla de carrera pueden diferir en alguno de la suma de goleadores de los partidos (goles en propia puerta y goles sin jugador identificado).</li>
      <li>Saldo, ingresos y gastos mes a mes: de la memoria. El desglose por partidas, del que había guardado.</li></ul>`;
  }

  // ---------------------------------------------------------------- exportación para Claude (también en la web pública)
  function exportacion() {
    const ts = [...IDX.temporadas].reverse();
    const pub = window.FMHUB_PUBLICADO, est = window.FMHUB_ESTATICO;
    const url = t => pub ? `exports/fm_export_${t === 'todo' ? 'todo' : t.replace('/', '-')}.zip` : `api/exportar-temporada?t=${encodeURIComponent(t)}`;
    if (est) return `<div class="card"><h4 style="margin-top:0">Exportar para Claude</h4><p class="mini">En esta copia sin conexión no se pueden generar los zips: usa la web de FM Hub o la publicada.</p></div>`;
    return `<div class="card"><h4 style="margin-top:0">Exportar para Claude</h4>
      <p class="mini">Un zip con todo lo avanzado (todas las temporadas, cada una con partidos, goleadores, alineaciones, clasificación, plantilla, traspasos, economía y récords en JSON, más un resumen en .md para pegar en una conversación), o solo la temporada que elijas.${pub ? ' FM Hub los actualiza con cada publicación.' : ' También se guardan en la carpeta <b class="mono">exports</b>.'}</p>
      <div class="fila-btn"><a class="btn" href="${url('todo')}" download>Exportar todo</a>
        <select id="exp-t" class="btn sec" onchange="document.getElementById('exp-a').href=this.value">${ts.map(t => `<option value="${url(t)}">${esc(t)}</option>`).join('')}</select>
        <a class="btn sec" id="exp-a" href="${url(ts[0] || '')}" download>Exportar temporada</a></div></div>`;
  }

  // ---------------------------------------------------------------- eventos
  document.addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    const ds = b.dataset;
    if (ds.hcf) CF[ds.hcf] = !CF[ds.hcf];
    else if (ds.hst !== undefined) { actual = +ds.hst; filtroRes = 'all'; }
    else if (ds.hres) filtroRes = ds.hres;
    else if (ds.hrvf) rivalF = ds.hrvf;
    else if (ds.hgs !== undefined) golesSel = +ds.hgs;
    else if (ds.hcalc) { const iu = +ds.hcalc; calcSel.has(iu) ? calcSel.delete(iu) : calcSel.add(iu); }
    else return;
    pintar();
  });
  document.addEventListener('change', ev => {
    if (ev.target.id === 'hcM') { calcMasa = +ev.target.value || 0; pintar(); }
    if (ev.target.id === 'hcP') { calcPres = +ev.target.value || 0; pintar(); }
    if (ev.target.id === 'rvQ' && ev.target.value) location.hash = 'rivales/' + encodeURIComponent(ev.target.value);
  });

  return {S, ronda, titulos, entradilla, notas, viaje, temporadas, rivales, goles, hitos, rentabilidad, economia, plan, trayectoria, exportacion, escalera, bigsPalmares, cantera, enPlantilla};
})();
