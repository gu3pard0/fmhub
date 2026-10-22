// FM Hub, fase 5: «Datos y curiosidades» al estilo OptaJoe («Número. Hecho. Palabra final.»).
//
// No hay curiosidades escritas a mano: un motor recorre TODOS los datos de la partida, calcula cada métrica
// posible en cada ámbito y busca por sí mismo qué es noticia:
//   · récords y mínimos: el valor más alto (o más bajo) entre todos los comparables (jugador-temporada, carrera,
//     temporada del equipo, partido, rival, mes de finanzas, traspaso…), con lo que viene detrás como contexto;
//   · rachas de cualquier condición (resultado, marcar, encajar…) en cada ámbito, y las que siguen abiertas;
//   · primicias: lo que pasa por primera vez (contra un rival, en una categoría…);
//   · valores fuera de lo normal (muy lejos de la media de su grupo).
// Las métricas salen de los propios datos (cualquier campo numérico de las estadísticas, también los de
// detalle como pases o xG), y el texto se monta con lo que se encuentra. Cada candidata recibe una puntuación
// (rareza, tamaño del grupo comparado, actualidad) y se enseñan las mejores, sin repetir la misma métrica.
// Usa las utilidades y los índices de app.js (IDX, D, esc, miles, fecha…), que se carga después.
'use strict';

// ---------------------------------------------------------------- vocabulario (nombres de campos, no frases)
const NIVEL_LIGA = {'Premier League': 1, 'Sky Bet Championship': 2, 'Sky Bet League One': 3, 'Sky Bet League Two': 4,
                    'Vanarama National League': 5, 'Vanarama National League South': 6, 'Vanarama National League North': 6};
const LIGA_CORTA = c => (c || '').replace('Vanarama ', '').replace('Sky Bet ', '');
const NOMBRE_CAMPO = {partidos: 'partidos', titular: 'partidos de titular', suplente: 'partidos saliendo del banquillo', minutos: 'minutos',
  goles: 'goles', asistencias: 'asistencias', amarillas: 'tarjetas amarillas', rojas: 'tarjetas rojas', mvp: 'veces jugador del partido',
  nota_media: 'de nota media', goles_encajados: 'goles encajados', encajados: 'goles encajados', porterias_a_cero: 'porterías a cero',
  imbatidas: 'porterías a cero', penaltis_lanzados: 'penaltis lanzados', penaltis_marcados: 'penaltis marcados', xg: 'de xG', xa: 'de xA',
  xg_sin_penaltis: 'de xG sin penaltis', distancia_km: 'km recorridos', saldo: 'de saldo', neto: 'de beneficio neto', ingresos_totales: 'de ingresos',
  gastos_totales: 'de gastos', ingresos_sin_traspasos: 'de ingresos sin contar traspasos', gastos_sin_traspasos: 'de gastos sin contar traspasos',
  gasto_sueldos: 'en sueldos', gasto_traspasos_neto: 'de gasto neto en traspasos'};
const nombreCampo = k => NOMBRE_CAMPO[k] || k.replace(/_/g, ' ');
const MALO = new Set(['amarillas', 'rojas', 'goles_encajados', 'encajados', 'errores_gol', 'balones_perdidos', 'faltas_cometidas', 'fueras_de_juego']);
const INTERNO = new Set(['suma_notas', 'con_nota']);
// campos que sobre todo dependen de cuánto juega alguien (el portero titular siempre encaja más): cuentan menos
const POCO_INTERES = new Set(['goles_encajados', 'encajados', 'minutos', 'titular', 'suplente', 'partidos', 'penaltis_lanzados']);
const AMBITO_TIPO = {liga: 'en liga', copa: 'en copa', continental: 'en competición continental', total: 'en partidos oficiales'};

// ---------------------------------------------------------------- utilidades
const r90 = p => p.gf > p.gc ? 'W' : p.gf < p.gc ? 'L' : 'D';   // resultado sin contar tandas de penaltis
const LETRA = {W: 'V', D: 'E', L: 'D'};
const PUNTOS = {W: 3, D: 1, L: 0};
const dec = (v, n = 1) => Number(v).toFixed(n).replace('.', ',');
const tCorta = t => t ? t.slice(2) : '';
const corto = n => (n || '').split(' ').pop().slice(0, 9);
const media = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const desv = a => { const m = media(a); return Math.sqrt(media(a.map(v => (v - m) ** 2))) || 1; };
const fmtValor = (v, decimales) => decimales ? dec(v, decimales) : miles(v);
function rachaMax(ps, cond) {
  let mejor = {n: 0}, n = 0, ini = 0;
  ps.forEach((p, i) => { if (cond(p)) { if (!n) ini = i; n++; if (n > mejor.n) mejor = {n, ini, fin: i}; } else n = 0; });
  return mejor;
}
const rachaActual = (ps, cond) => { let n = 0; for (let i = ps.length - 1; i >= 0 && cond(ps[i]); i--) n++; return n; };

// ---------------------------------------------------------------- gráficos pequeños (SVG)
const GW = 300, GH = 80;
function gCasillas(ps, marca) {
  const n = ps.length, lado = Math.max(4, Math.min(22, Math.floor((GW - 4) / Math.max(n, 1)) - 2));
  const col = {W: 'var(--w)', D: 'var(--d)', L: 'var(--l)'};
  return `<svg viewBox="0 0 ${GW} ${GH}" class="g">${ps.map((p, i) => {
    const x = 2 + i * (lado + 2), dentro = !marca || (i >= marca[0] && i <= marca[1]);
    return `<rect x="${x}" y="${(GH - lado) / 2 - 8}" width="${lado}" height="${lado}" rx="3" fill="${col[r90(p)]}" opacity="${dentro ? 1 : .28}"><title>${esc(fecha(p.fecha))} ${esc(p.rival)} ${p.gf}-${p.gc}</title></rect>` +
      (lado >= 14 ? `<text x="${x + lado / 2}" y="${(GH - lado) / 2 - 4 + lado / 2}" text-anchor="middle" class="gl">${LETRA[r90(p)]}</text>` : '');
  }).join('')}<text x="2" y="${GH - 4}" class="ge">${esc(fecha(ps[0]?.fecha))}</text><text x="${GW - 2}" y="${GH - 4}" text-anchor="end" class="ge">${esc(fecha(ps[ps.length - 1]?.fecha))}</text></svg>`;
}
function gBarras(vals, etiquetas, resaltar, fmt = v => v) {
  const n = vals.length, max = Math.max(...vals.map(Math.abs), 1e-9), ancho = (GW - 4) / n;
  return `<svg viewBox="0 0 ${GW} ${GH}" class="g">${vals.map((v, i) => {
    const h = Math.max(2, (GH - 30) * Math.abs(v) / max), x = 2 + i * ancho;
    const r = i === resaltar;
    return `<rect x="${x + ancho * .15}" y="${GH - 16 - h}" width="${ancho * .7}" height="${h}" rx="2" fill="${r ? 'var(--gold)' : 'var(--mut)'}" opacity="${r ? 1 : .45}"/>` +
      `<text x="${x + ancho / 2}" y="${GH - 19 - h}" text-anchor="middle" class="gv">${esc(fmt(v))}</text>` +
      `<text x="${x + ancho / 2}" y="${GH - 4}" text-anchor="middle" class="ge">${esc(etiquetas[i])}</text>`;
  }).join('')}</svg>`;
}
function gLinea(vals, etiquetas, resaltar, fmt = v => v, invertir = false) {
  const n = vals.length, mn = Math.min(...vals), mx = Math.max(...vals), r = mx - mn || 1;
  const X = i => 16 + i * (GW - 32) / Math.max(1, n - 1);
  const Y = v => invertir ? 16 + (v - mn) * (GH - 44) / r : GH - 28 - (v - mn) * (GH - 44) / r;
  return `<svg viewBox="0 0 ${GW} ${GH}" class="g"><path d="${vals.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('')}" fill="none" stroke="var(--mut)" stroke-width="2"/>` +
    vals.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="${i === resaltar ? 5 : 3}" fill="${i === resaltar ? 'var(--gold)' : 'var(--mut)'}"/><text x="${X(i)}" y="${Y(v) - 8}" text-anchor="middle" class="gv">${esc(fmt(v))}</text><text x="${X(i)}" y="${GH - 4}" text-anchor="middle" class="ge">${esc(etiquetas[i])}</text>`).join('') + '</svg>';
}

// ---------------------------------------------------------------- el motor
// Una candidata: {n, hecho, fin, ctx, g, t, tipo, fam, score}. «fam» agrupa las de la misma métrica para no repetir.
function motor() {
  const club = IDX.club;
  const ofi = IDX.partidos.filter(p => p.oficial).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const temps = IDX.temporadas.filter(t => ofi.some(p => p.temporada === t));
  const ultima = temps[temps.length - 1];
  const ultimo = ofi[ofi.length - 1];
  const goles = p => IDX.golesPorPartido[p.clave] || [];
  const propios = p => goles(p).filter(g => (g.lado === 0) === p.casa && g.tipo !== 3);
  const out = [];
  const add = c => { if (c && c.n !== undefined && !(typeof c.n === 'number' && isNaN(c.n))) out.push(c); };
  const actual = t => t === ultima ? 1.5 : 1;   // lo de la última temporada interesa más
  // misma vara para todas: rareza (cuántas desviaciones se separa de la media), tamaño del grupo comparado y actualidad
  const puntua = (z, n, t, peso = 1) => (1 + Math.min(Math.max(z, 0), 4) / 2) * Math.min(1.3, .5 + Math.log2(Math.max(n, 2)) / 10) * actual(t) * peso;

  // ===== 1. Comparar un valor con todo su grupo: récord, mínimo o fuera de lo normal =====
  // items: [{v, sujeto, t, extra}] ; meta: {fam, que, ambito, decimales, minimo, grupo, tipo}
  function extremos(items, meta) {
    items = items.filter(x => x.v !== null && x.v !== undefined && !isNaN(x.v));
    if (items.length < (meta.minimo || 6)) return;
    const vals = items.map(x => x.v), m = media(vals), s = desv(vals);
    for (const sentido of meta.sentidos || [1]) {
      const ord = [...items].sort((a, b) => sentido * (b.v - a.v));
      const top = ord[0], seg = ord[1];
      if (sentido > 0 && top.v <= 0) continue;
      if (seg && top.v === seg.v && !meta.empates) continue;      // sin récord claro
      const z = Math.abs(top.v - m) / s;
      const malo = MALO.has(meta.campo) !== (sentido < 0);
      const cinco = ord.slice(0, 5);
      add({
        n: fmtValor(top.v, meta.decimales),
        hecho: `${meta.que(top)}${meta.ambito ? ' ' + meta.ambito(top) : ''}.`,
        fin: sentido > 0 ? (malo ? 'Nadie suma más (para mal).' : `Récord ${meta.grupo}.`) : (malo ? `Mínimo ${meta.grupo} (para mal).` : `Mínimo ${meta.grupo}.`),
        ctx: `${seg ? `Detrás: ${ord.slice(1, 3).map(x => `${fmtValor(x.v, meta.decimales)} (${x.etiqueta || x.sujeto}${x.t && !meta.sinT ? ', ' + x.t : ''})`).join(', ')}. ` : ''}${items.length} comparados${meta.nota ? '; ' + meta.nota : ''}.`,
        g: gBarras(cinco.map(x => x.v), cinco.map(x => x.corto || corto(x.sujeto)), 0, v => fmtValor(v, meta.decimales)),
        t: top.t || null, tipo: sentido > 0 ? 'Récord' : 'Mínimo', fam: meta.fam + (sentido > 0 ? '+' : '-'),
        score: puntua(z, items.length, top.t, meta.peso || 1),
      });
    }
  }

  // ===== 2. Jugadores: cada campo numérico de la tabla de carrera, por temporada y en su carrera en el club =====
  const filasJ = D.historial.filter(h => h.club === club && ['liga', 'copa', 'continental', 'total'].includes(h.tipo));
  const camposJ = new Set();
  const valoresFila = h => {
    const o = {}, det = J(h.detalle);
    for (const k of ['partidos', 'titular', 'suplente', 'minutos', 'goles', 'asistencias', 'amarillas', 'rojas', 'mvp', 'nota_media']) if (typeof h[k] === 'number') o[k] = h[k];
    for (const [k, v] of Object.entries(det)) if (typeof v === 'number' && !INTERNO.has(k)) o[k] = v;
    return o;
  };
  for (const h of filasJ) for (const k of Object.keys(valoresFila(h))) camposJ.add(k);
  for (const tipo of ['liga', 'copa', 'total']) {
    const filas = filasJ.filter(h => h.tipo === tipo).map(h => ({h, v: valoresFila(h)}));
    for (const campo of camposJ) {
      const esNota = campo === 'nota_media';
      const items = filas.filter(f => f.v[campo] !== undefined && (!esNota || (f.v.partidos || 0) >= 15))
        .map(f => ({v: f.v[campo], sujeto: f.h.jugador, t: f.h.temporada, iu: f.h.iu}));
      extremos(items, {fam: `jt-${campo}`, campo, decimales: esNota ? 2 : 0, grupo: 'de una temporada con Varela',
        que: x => `${esNota ? '' : nombreCampo(campo).charAt(0).toUpperCase() + nombreCampo(campo).slice(1) + ' de '}${esNota ? `${x.sujeto}, nota media` : x.sujeto} ${AMBITO_TIPO[tipo]} en ${x.t}`,
        sentidos: esNota ? [1, -1] : [1], nota: esNota ? 'mínimo 15 partidos' : '', peso: (tipo === 'total' ? 1 : .85) * (POCO_INTERES.has(campo) ? .55 : 1)});
      // por 90 minutos (mínimo 900 minutos)
      if (!esNota && campo !== 'minutos' && campo !== 'partidos' && campo !== 'titular' && campo !== 'suplente') {
        const p90 = filas.filter(f => f.v[campo] !== undefined && f.v[campo] >= 5 && (f.v.minutos || 0) >= 900)
          .map(f => ({v: f.v[campo] * 90 / f.v.minutos, sujeto: f.h.jugador, t: f.h.temporada}));
        extremos(p90, {fam: `j90-${campo}`, campo, decimales: 2, grupo: 'por 90 minutos en una temporada',
          que: x => `${nombreCampo(campo).charAt(0).toUpperCase() + nombreCampo(campo).slice(1)} por cada 90 minutos de ${x.sujeto} ${AMBITO_TIPO[tipo]} en ${x.t}`, nota: 'mínimo 900 minutos y 5 en la temporada', peso: .75 * (POCO_INTERES.has(campo) ? .5 : 1)});
      }
    }
  }
  // carrera en el club (suma de temporadas, filas «total» o, si no hay, «liga»)
  const carrera = {};
  for (const h of filasJ) {
    const c = (carrera[h.iu] ||= {sujeto: h.jugador, total: {}, liga: {}, temps: new Set()});
    if (h.tipo !== 'total' && h.tipo !== 'liga') continue;
    c.temps.add(h.temporada);
    for (const [k, v] of Object.entries(valoresFila(h))) if (k !== 'nota_media') c[h.tipo][k] = (c[h.tipo][k] || 0) + v;
  }
  for (const campo of camposJ) {
    if (campo === 'nota_media') continue;
    const items = Object.values(carrera).map(c => ({v: (Object.keys(c.total).length ? c.total : c.liga)[campo], sujeto: c.sujeto, etiqueta: `${c.sujeto}, ${c.temps.size} temp.`, corto: corto(c.sujeto)}));
    extremos(items, {fam: `jc-${campo}`, campo, grupo: 'en la era Varela', sinT: true,
      que: x => `${nombreCampo(campo).charAt(0).toUpperCase() + nombreCampo(campo).slice(1)} de ${x.sujeto} con el ${club}`, ambito: () => 'en partidos oficiales', peso: 1.1 * (POCO_INTERES.has(campo) ? .55 : 1)});
  }

  // ===== 3. Equipo por temporada en cada ámbito (oficiales, liga, casa, fuera y cada competición) =====
  const remontada = p => { let f = 0, c = 0, perdio = false; for (const g of goles(p)) { if ((g.lado === 0) === p.casa) f++; else c++; if (c > f) perdio = true; } return perdio && r90(p) === 'W'; };
  const remontado = p => { let f = 0, c = 0, gano = false; for (const g of goles(p)) { if ((g.lado === 0) === p.casa) f++; else c++; if (f > c) gano = true; } return gano && r90(p) === 'L'; };
  // [cálculo por partido, sentido (1 más es mejor, -1 más es peor, 0 neutra), también por partido]
  const MET_PARTIDO = {
    'victorias': [p => +(r90(p) === 'W'), 1, true], 'empates': [p => +(r90(p) === 'D'), 0, false], 'derrotas': [p => +(r90(p) === 'L'), -1, true],
    'goles a favor': [p => p.gf, 1, true], 'goles en contra': [p => p.gc, -1, true], 'porterías a cero': [p => +(p.gc === 0), 1, true],
    'partidos sin marcar': [p => +(p.gf === 0), -1, false], 'goleadas a favor (3+ goles de diferencia)': [p => +(p.gf - p.gc >= 3), 1, false],
    'goleadas en contra (3+ goles de diferencia)': [p => +(p.gc - p.gf >= 3), -1, false], 'partidos con 5 goles o más': [p => +(p.gf + p.gc >= 5), 0, false],
    'goles en el minuto 90 o después': [p => propios(p).filter(g => g.minuto >= 90).length, 1, false],
    'goles en los primeros 15 minutos': [p => propios(p).filter(g => g.minuto <= 15).length, 1, false],
    'remontadas (ganó tras ir perdiendo)': [p => +remontada(p), 1, false], 'partidos perdidos tras ir ganando': [p => +remontado(p), -1, false],
    'penaltis marcados': [p => propios(p).filter(g => g.tipo === 2).length, 0, false],
  };
  const ambitos = {'en partidos oficiales': p => true, 'en casa': p => p.casa, 'fuera de casa': p => !p.casa};
  for (const c of new Set(ofi.map(p => p.competicion))) ambitos['en ' + c] = p => p.competicion === c;
  for (const [amb, filtro] of Object.entries(ambitos)) {
    const porT = temps.map(t => ({t, ps: ofi.filter(p => p.temporada === t && filtro(p))})).filter(x => x.ps.length >= 6);
    if (porT.length < 3) continue;
    const completas = porT.filter(x => x.t !== ultima || x.ps.length >= Math.max(...porT.map(y => y.ps.length)) * .8);
    for (const [nombre, [f, sentidoBueno, porPartido]] of Object.entries(MET_PARTIDO)) {
      // totales (solo temporadas completas) y por partido (todas)
      for (const [modo, lista, conv, decs] of [['total', completas, x => x.ps.reduce((s, p) => s + f(p), 0), 0],
                                              ['por partido', porT, x => x.ps.reduce((s, p) => s + f(p), 0) / x.ps.length, 2]]) {
        if (lista.length < 3 || (modo === 'por partido' && !porPartido)) continue;
        const vals = lista.map(x => ({t: x.t, v: conv(x), j: x.ps.length}));
        const ord = [...vals].sort((a, b) => b.v - a.v);
        for (const [sentido, x, y] of [[1, ord[0], ord[1]], [-1, ord[ord.length - 1], ord[ord.length - 2]]]) {
          if (!x || x.v === y?.v || (sentido > 0 && x.v <= 0)) continue;
          const bueno = sentidoBueno * sentido;   // 1 buena noticia, -1 mala, 0 neutra
          const z = Math.abs(x.v - media(vals.map(v => v.v))) / desv(vals.map(v => v.v));
          const etiqueta = modo === 'por partido' ? `${nombre.charAt(0).toUpperCase() + nombre.slice(1)} por partido` : nombre.charAt(0).toUpperCase() + nombre.slice(1);
          add({n: fmtValor(x.v, decs), hecho: `${etiqueta} del ${club} ${amb} en ${x.t} (${x.j} partidos).`,
               fin: bueno > 0 ? 'La mejor temporada.' : bueno < 0 ? 'La peor temporada.' : sentido > 0 ? 'Máximo histórico.' : 'Mínimo histórico.',
               ctx: `Comparado con ${vals.length} temporadas: ${vals.map(v => `${tCorta(v.t)} ${fmtValor(v.v, decs)}`).join(' · ')}.`,
               g: gLinea(vals.map(v => Math.round(v.v * 100) / 100), vals.map(v => tCorta(v.t)), vals.indexOf(x), v => fmtValor(v, decs)),
               t: x.t, tipo: 'Temporadas', fam: `eq-${nombre}-${sentido}`,
               score: puntua(z + 1, vals.length * 6, x.t, (amb === 'en partidos oficiales' ? 1.1 : .8) * (modo === 'total' ? 1 : .85))});
        }
      }
    }
  }

  // ===== 4. Partidos: el más extremo en cada métrica (todos y en la última temporada) =====
  const MET_UNO = {'goles a favor': p => p.gf, 'goles en contra': p => p.gc, 'goles en un mismo partido': p => p.gf + p.gc,
    'goles de diferencia a favor': p => p.gf - p.gc, 'goles de diferencia en contra': p => p.gc - p.gf, 'espectadores': p => p.casa ? p.espectadores : null,
    'goles en el descuento': p => propios(p).filter(g => g.minuto >= 90).length};
  for (const [nombre, f] of Object.entries(MET_UNO)) {
    for (const [lista, grupo, t] of [[ofi, 'de la era Varela', null], [ofi.filter(p => p.temporada === ultima), `de ${ultima}`, ultima]]) {
      const items = lista.map(p => ({p, v: f(p)})).filter(x => x.v !== null && x.v !== undefined && x.v > 0);
      if (items.length < 8) continue;
      const ord = [...items].sort((a, b) => b.v - a.v);
      if (ord[0].v === ord[1].v) continue;
      const p = ord[0].p, z = (ord[0].v - media(items.map(x => x.v))) / desv(items.map(x => x.v));
      add({n: nombre === 'espectadores' ? miles(ord[0].v) : ord[0].v,
           hecho: `${nombre.charAt(0).toUpperCase() + nombre.slice(1)}: ${p.local} ${p.goles_local}-${p.goles_visitante} ${p.visitante}, ${fecha(p.fecha)} (${p.competicion}).`,
           fin: `El partido récord ${grupo}.`, ctx: `Le siguen ${ord.slice(1, 3).map(x => `${nombre === 'espectadores' ? miles(x.v) : x.v} ante el ${x.p.rival} (${tCorta(x.p.temporada)})`).join(' y ')}. ${items.length} partidos comparados.`,
           g: gBarras(ord.slice(0, 5).map(x => x.v), ord.slice(0, 5).map(x => corto(x.p.rival)), 0, v => nombre === 'espectadores' ? (v >= 1000 ? dec(v / 1000) + 'k' : v) : v),
           t: t || p.temporada, tipo: 'Partido', fam: `pa-${nombre}-${t ? 'u' : 'h'}`, score: puntua(z, items.length, t || p.temporada, (t ? .8 : 1.05) * (p === ultimo ? 1.6 : 1))});
    }
  }

  // ===== 5. Rachas de cualquier condición en cada ámbito; también las que siguen abiertas =====
  const COND = {'victorias seguidas': p => r90(p) === 'W', 'partidos seguidos sin perder': p => r90(p) !== 'L', 'partidos seguidos sin ganar': p => r90(p) !== 'W',
    'derrotas seguidas': p => r90(p) === 'L', 'empates seguidos': p => r90(p) === 'D', 'partidos seguidos marcando': p => p.gf > 0,
    'partidos seguidos marcando 2 goles o más': p => p.gf >= 2, 'porterías a cero seguidas': p => p.gc === 0, 'partidos seguidos encajando': p => p.gc > 0,
    'partidos seguidos sin marcar': p => p.gf === 0};
  const MALA = new Set(['partidos seguidos sin ganar', 'derrotas seguidas', 'partidos seguidos encajando', 'partidos seguidos sin marcar']);
  for (const [amb, filtro] of Object.entries({'': p => true, 'en casa': p => p.casa, 'fuera de casa': p => !p.casa, 'en liga': p => NIVEL_LIGA[p.competicion]})) {
    const ps = ofi.filter(filtro);
    if (ps.length < 20) continue;
    for (const [nombre, cond] of Object.entries(COND)) {
      const m = rachaMax(ps, cond);
      const porT = temps.map(t => rachaMax(ps.filter(p => p.temporada === t), cond).n);
      if (m.n >= 3) {
        const a = ps[m.ini], b = ps[m.fin], d0 = Math.max(0, m.ini - 3), ventana = ps.slice(d0, m.fin + 4);
        const veces = temps.filter(t => rachaMax(ps.filter(p => p.temporada === t), cond).n === m.n).length;
        add({n: m.n, hecho: `${nombre.charAt(0).toUpperCase() + nombre.slice(1)} del ${club}${amb ? ' ' + amb : ''}, del ${fecha(a.fecha)} al ${fecha(b.fecha)}.`,
             fin: MALA.has(nombre) ? 'La peor racha del club.' : veces > 1 ? 'Récord igualado.' : 'Récord del club.',
             ctx: `Mejor racha de cada temporada: ${temps.map((t, i) => `${tCorta(t)} ${porT[i]}`).join(' · ')}.`,
             g: gCasillas(ventana, [m.ini - d0, m.fin - d0]), t: a.temporada === b.temporada ? a.temporada : null, tipo: 'Racha',
             fam: `ra-${nombre}`, score: puntua((m.n - media(porT)) / desv(porT) + 1, ps.length, a.temporada === b.temporada ? a.temporada : null, (amb ? .75 : 1.1) * (MALA.has(nombre) ? .85 : 1) * (b === ultimo ? 1.6 : 1))});
      }
      const abierta = rachaActual(ps, cond);
      if (abierta >= 3 && abierta < m.n && abierta >= m.n * .6 && ps[ps.length - 1] === ultimo) {
        const vent = ps.slice(-Math.min(ps.length, abierta + 4));
        add({n: abierta, hecho: `${nombre.charAt(0).toUpperCase() + nombre.slice(1)} lleva el ${club}${amb ? ' ' + amb : ''} tras el ${ultimo.gf}-${ultimo.gc} ante el ${ultimo.rival}.`,
             fin: `A ${m.n - abierta} del récord.`, ctx: `El récord del club es ${m.n} (${fecha(ps[m.ini].fecha)} – ${fecha(ps[m.fin].fecha)}).`,
             g: gCasillas(vent, [vent.length - abierta, vent.length - 1]), t: ultimo.temporada, tipo: 'Racha abierta', fam: `rab-${nombre}`, score: puntua(2 + abierta / m.n, ps.length, ultimo.temporada, 1.2)});
      }
    }
  }

  // ===== 6. Rivales: el mejor y el peor en cada métrica (mínimo 3 partidos) y primicias ante rivales =====
  const rivales = {};
  for (const p of ofi) (rivales[p.rival] ||= []).push(p);
  const MET_RIVAL = {'puntos por partido': ps => ps.reduce((s, p) => s + PUNTOS[r90(p)], 0) / ps.length, 'victorias': ps => ps.filter(p => r90(p) === 'W').length,
    'derrotas': ps => ps.filter(p => r90(p) === 'L').length, 'goles a favor por partido': ps => ps.reduce((s, p) => s + p.gf, 0) / ps.length,
    'goles en contra por partido': ps => ps.reduce((s, p) => s + p.gc, 0) / ps.length};
  // agrupaciones: cualquier dato del partido que reparta los partidos en grupos (mínimo de partidos por grupo)
  const AGRUP = {
    rival: {clave: p => p.rival, min: 3, frase: r => `ante el ${r}`, bien: 'Su rival favorito.', mal: 'Bestia negra.', grupo: 'rivales con 3 duelos o más'},
    formacion: {clave: p => p.formacion, min: 8, frase: r => `jugando con el ${r}`, bien: 'Su sistema talismán.', mal: 'El sistema que peor le va.', grupo: 'formaciones propias con 8 partidos o más'},
    formacion_rival: {clave: p => p.formacion_rival, min: 8, frase: r => `contra rivales que forman con el ${r}`, bien: 'El sistema rival que mejor se le da.', mal: 'El sistema rival que más le cuesta.', grupo: 'formaciones rivales con 8 partidos o más'},
  };
  for (const [dim, A] of Object.entries(AGRUP)) {
  const grupos = {};
  for (const p of ofi) { const k = A.clave(p); if (k) (grupos[k] ||= []).push(p); }
  const con3 = Object.entries(grupos).filter(([, ps]) => ps.length >= A.min);
  for (const [nombre, f] of Object.entries(MET_RIVAL)) {
    const items = con3.map(([r, ps]) => ({r, ps, v: f(ps)}));
    if (items.length < (dim === 'rival' ? 5 : 3)) continue;
    const decs = nombre.includes('por partido') ? 2 : 0;
    for (const sentido of decs ? [1, -1] : [1]) {
      const ord = [...items].sort((a, b) => sentido * (b.v - a.v) || b.ps.length - a.ps.length);
      const x = ord[0];
      if (x.v === ord[1].v && x.ps.length === ord[1].ps.length) continue;
      const bueno = (nombre.includes('contra') || nombre === 'derrotas') ? sentido < 0 : sentido > 0;
      add({n: fmtValor(x.v, decs), hecho: `${nombre.charAt(0).toUpperCase() + nombre.slice(1)} del ${club} ${A.frase(x.r)} en ${x.ps.length} partidos oficiales.`,
           fin: bueno ? A.bien : A.mal, ctx: `El ${sentido > 0 ? 'mayor' : 'menor'} entre ${items.length} ${A.grupo}. Luego: ${ord.slice(1, 3).map(y => `${y.r} (${fmtValor(y.v, decs)})`).join(', ')}.`,
           g: gCasillas(x.ps.slice(-40)), t: null, tipo: dim === 'rival' ? 'Rivales' : 'Formaciones', fam: `ri-${dim}-${bueno ? 'b' : 'm'}`, score: puntua(Math.abs(x.v - media(items.map(y => y.v))) / desv(items.map(y => y.v)), items.length, null, 1.05)});
    }
  }
  }
  // primicias ante un rival en la última temporada: primera victoria o primera derrota tras varios duelos
  for (const [r, ps] of Object.entries(rivales)) {
    for (const [res, texto, fin] of [['W', 'ganar por primera vez al', 'Primera vez.'], ['L', 'perder por primera vez contra el', 'Primera derrota.']]) {
      const i = ps.findIndex(p => r90(p) === res);
      if (i >= 2 && ps[i].temporada === ultima) add({n: i + 1, hecho: `Partidos necesitó el ${club} para ${texto} ${r}: ${ps[i].gf}-${ps[i].gc} el ${fecha(ps[i].fecha)}.`,
        fin, ctx: `Antes: ${ps.slice(0, i).map(p => LETRA[r90(p)]).join(' ')}.`, g: gCasillas(ps.slice(0, i + 1), [i, i]), t: ultima, tipo: 'Primicia',
        fam: `pr-${res}-${r}`, score: puntua(1.5 + i / 2, 30, ultima, ps[i] === ultimo ? 1.6 : 1)});
    }
  }

  // ===== 7. Goleadores en un partido, gol más rápido y más tardío =====
  const golesJ = [];
  for (const p of ofi) {
    const c = {};
    for (const g of propios(p)) if (g.iu) c[g.iu] = (c[g.iu] || 0) + 1;
    for (const [iu, n] of Object.entries(c)) golesJ.push({v: n, sujeto: IDX.nombres[iu] || '¿?', t: p.temporada, p, etiqueta: `${IDX.nombres[iu] || '¿?'} vs ${p.rival}`});
  }
  extremos(golesJ, {fam: 'gj', campo: 'goles', grupo: 'de un jugador en un partido', minimo: 20,
    que: x => `Goles de ${x.sujeto} ante el ${x.p.rival} (${x.p.gf}-${x.p.gc}) el ${fecha(x.p.fecha)}`, peso: 1.2});
  const todosGoles = ofi.flatMap(p => propios(p).map(g => ({g, p})));
  if (todosGoles.length > 30) {
    const rap = todosGoles.reduce((a, b) => (b.g.minuto < a.g.minuto ? b : a));
    const tar = todosGoles.reduce((a, b) => (b.g.minuto * 100 + b.g.anadido > a.g.minuto * 100 + a.g.anadido ? b : a));
    for (const [x, que, fin] of [[rap, 'Minuto del gol más rápido del', 'Ni calentar.'], [tar, 'Minuto del gol más tardío del', 'Hasta el último segundo.']])
      add({n: x.g.minuto + (x.g.anadido ? '+' + x.g.anadido : ''), hecho: `${que} ${club} con Varela: ${x.g.jugador || '¿?'} ante el ${x.p.rival} (${fecha(x.p.fecha)}).`,
           fin, ctx: `Entre ${todosGoles.length} goles oficiales.`, g: null, t: x.p.temporada, tipo: 'Récord', fam: 'min-' + que, score: puntua(3, todosGoles.length, x.p.temporada)});
  }

  // ===== 8. Franjas de minutos: la que más pesa en cada temporada frente al resto =====
  const ET = ['1-15', '16-30', '31-45', '46-60', '61-75', '76-90+'];
  const franjas = temps.map(t => { const f = [0, 0, 0, 0, 0, 0]; for (const p of ofi.filter(x => x.temporada === t)) for (const g of propios(p)) f[Math.min(5, Math.floor(Math.max(0, g.minuto - 1) / 15))]++; return f; });
  const celdas = [];
  franjas.forEach((f, i) => { const tot = f.reduce((s, v) => s + v, 0); if (tot >= 20) f.forEach((v, j) => celdas.push({t: temps[i], j, v: 100 * v / tot, n: v, tot, f})); });
  if (celdas.length >= 12) {
    const x = celdas.reduce((a, b) => b.v > a.v ? b : a), z = (x.v - media(celdas.map(c => c.v))) / desv(celdas.map(c => c.v));
    if (z > 1.5) add({n: Math.round(x.v) + '%', hecho: `De los goles oficiales del ${club} en ${x.t} llegaron entre el minuto ${ET[x.j].replace('-', ' y el ')} (${x.n} de ${x.tot}).`,
      fin: 'Su franja.', ctx: `El mayor peso de una franja de 15 minutos en una temporada (${celdas.length} combinaciones).`, g: gBarras(x.f, ET, x.j), t: x.t, tipo: 'Minutos', fam: 'fr', score: puntua(z, celdas.length, x.t)});
  }

  // ===== 9. Clasificación y categorías: mejor puesto y primicias de categoría =====
  const cl = temps.map(t => D.clasificaciones.find(c => c.temporada === t && c.club === club)).filter(Boolean);
  for (let i = 1; i < cl.length; i++) {
    const nv = NIVEL_LIGA[cl[i].competicion], previos = cl.slice(0, i).map(c => NIVEL_LIGA[c.competicion]);
    if (nv && previos.every(v => v > nv)) add({n: i + 1, hecho: `Temporadas tardó el ${club} de Varela en llegar a la ${LIGA_CORTA(cl[i].competicion)} (${cl[i].temporada}); acabó ${cl[i].pos}.º con ${cl[i].pts} puntos.`,
      fin: 'Primera vez en la categoría.', ctx: cl.map(c => `${tCorta(c.temporada)}: ${c.pos}.º ${LIGA_CORTA(c.competicion)}`).join(' · '),
      g: gLinea(cl.map(c => NIVEL_LIGA[c.competicion] || 7), cl.map(c => tCorta(c.temporada)), i, v => ['', 'PL', 'Ch', 'L1', 'L2', 'NL', 'NLS', '?'][v], true),
      t: cl[i].temporada, tipo: 'Primicia', fam: 'cat', score: puntua(4, 40, cl[i].temporada, 1.2)});
  }

  // ===== 10. Atributos: mayor subida y bajada (suma) y mayor salto de un atributo =====
  const atr = [];
  const saltos = [];
  for (const [iu, hs] of Object.entries(IDX.atr)) {
    if (hs.length < 2) continue;
    const suma = v => Object.values(v).reduce((s, x) => s + x, 0);
    const a = hs[0], b = hs[hs.length - 1];
    const comunes = Object.keys(b.v).filter(k => a.v[k] > 1 && b.v[k] > 1);
    if (comunes.length >= 20) atr.push({v: comunes.reduce((s2, k) => s2 + b.v[k] - a.v[k], 0), sujeto: IDX.nombres[iu] || iu, iu});
    for (let i = 1; i < hs.length; i++) for (const k of Object.keys(hs[i].v)) {
      const d = hs[i].v[k] - (hs[i - 1].v[k] ?? hs[i].v[k]);
      if (Math.abs(d) <= 3 && hs[i - 1].v[k] > 1) saltos.push({v: d, sujeto: IDX.nombres[iu] || iu, k, de: hs[i - 1].v[k], a: hs[i].v[k], etiqueta: `${IDX.nombres[iu] || iu}: ${k}`});
    }
  }
  extremos(atr, {fam: 'atr', campo: 'atr', grupo: 'de progreso con FM Hub', sentidos: [1, -1], sinT: true, minimo: 8,
    que: x => `Puntos de atributos ${x.v >= 0 ? 'ha ganado' : 'ha perdido'} ${x.sujeto} desde la primera captura guardada`});
  extremos(saltos, {fam: 'salto', campo: 'salto', grupo: 'de un atributo entre dos capturas', sentidos: [1, -1], sinT: true, minimo: 30, empates: true,
    que: x => `${x.v > 0 ? 'Subida' : 'Bajada'} de ${NOMBRE_ATR[x.k] || x.k} de ${x.sujeto} de una captura a la siguiente (${x.de} → ${x.a})`, peso: .5});

  // ===== 10 bis. Cantera: jugadores de las promociones que han debutado con el primer equipo =====
  const promos = {};
  for (const t of D.traspasos.filter(x => x.tipo === 'cantera')) (promos[t.fecha] ||= []).push(t);
  const fechasPromo = Object.keys(promos).sort();
  if (fechasPromo.length) {
    const debut = t => D.historial.filter(h => h.iu === t.iu && h.club === club && (h.tipo === 'total' || h.tipo === 'liga') && h.partidos > 0)
      .sort((a, b) => a.temporada.localeCompare(b.temporada))[0];
    const porPromo = fechasPromo.map(f => ({f, ts: promos[f], deb: promos[f].map(t => ({t, h: debut(t)})).filter(x => x.h)}));
    const total = porPromo.reduce((s2, x) => s2 + x.deb.length, 0);
    const todos = porPromo.reduce((s2, x) => s2 + x.ts.length, 0);
    if (total) {
      const ult = [...porPromo].reverse().find(x => x.deb.length);
      const pj = x => x.deb.reduce((s2, d) => s2 + D.historial.filter(h => h.iu === d.t.iu && h.club === club && h.tipo === 'total').reduce((a, h) => a + (h.partidos || 0), 0), 0);
      add({n: total, hecho: `Canteranos de ${todos} promovidos en ${fechasPromo.length} promociones han debutado con el primer equipo del ${club}.`,
           fin: 'Hechos en casa.', ctx: porPromo.map(x => `${fecha(x.f)}: ${x.deb.length} de ${x.ts.length}${x.deb.length ? ' (' + x.deb.map(d => d.t.jugador).slice(0, 4).join(', ') + ')' : ''}`).join(' · '),
           g: gBarras(porPromo.map(x => x.deb.length), porPromo.map(x => x.f.slice(0, 4)), porPromo.indexOf(ult)), t: ult.deb[0].h.temporada, tipo: 'Cantera', fam: 'cantera',
           score: puntua(2.5, 30, ult.deb[0].h.temporada, 1.2)});
      const top = porPromo.flatMap(x => x.deb).map(d => ({sujeto: d.t.jugador, v: D.historial.filter(h => h.iu === d.t.iu && h.club === club && h.tipo === 'total').reduce((a, h) => a + (h.partidos || 0), 0)})).filter(x => x.v);
      if (top.length >= 2) {
        const o = top.sort((a, b) => b.v - a.v);
        add({n: o[0].v, hecho: `Partidos oficiales de ${o[0].sujeto} con el ${club}, el canterano que más ha jugado con Varela.`, fin: 'El orgullo de la cantera.',
             ctx: `Le siguen ${o.slice(1, 3).map(x => `${x.sujeto} (${x.v})`).join(' y ')}.`, g: gBarras(o.slice(0, 5).map(x => x.v), o.slice(0, 5).map(x => corto(x.sujeto)), 0),
             t: null, tipo: 'Cantera', fam: 'cantera-top', score: puntua(2, 30, null, 1.1)});
      }
    }
  }

  // ===== 11. Finanzas (meses) y traspasos =====
  const CAMPOS_F = Object.keys(D.finanzas[0] || {}).filter(k => k.endsWith('_eur') && !k.startsWith('presupuesto') && !k.startsWith('masa'));
  for (const campo of CAMPOS_F) {
    const items = D.finanzas.filter(f => !f.en_curso).map(f => ({v: f[campo], sujeto: f.mes, t: f.temporada, etiqueta: f.mes, corto: f.mes.slice(2)}));
    const nom = nombreCampo(campo.replace(/_eur$/, ''));
    extremos(items, {fam: 'fin-' + campo, campo, grupo: `de un mes en ${items.length} meses`, sentidos: [1, -1], minimo: 12, sinT: true,
      que: x => `Euros ${nom} del ${club} en ${x.sujeto}`, peso: .7});
  }
  const tras = D.traspasos.filter(t => t.precio_eur > 0 && t.tipo !== 'cantera');
  for (const [entra, que] of [[1, 'Euros pagó el'], [0, 'Euros ingresó el']]) {
    const items = tras.filter(t => !!t.entra === !!entra).map(t => ({v: t.precio_eur, sujeto: t.jugador, t: (() => { const a = +t.fecha.slice(0, 4), m = +t.fecha.slice(5, 7), i = m >= 7 ? a : a - 1; return `${i}/${String(i + 1).slice(2)}`; })(), t0: t}));
    if (items.length >= 2) extremos(items, {fam: 'tr' + entra, campo: 'precio', grupo: `de la era Varela`, minimo: 2,
      que: x => `${que} ${club} ${entra ? 'por' : 'por la venta de'} ${x.sujeto} (${entra ? 'de' : 'al'} ${x.t0.otro_club}, ${fecha(x.t0.fecha)})`, peso: .9});
  }

  // ===== 12. El dato del último partido: la candidata mejor puntuada que lo menciona, o su mejor puesto en alguna métrica =====
  if (ultimo) {
    const marca = `${ultimo.gf}-${ultimo.gc} ante el ${ultimo.rival}`;
    const sobre = out.filter(c => c.hecho.includes(fecha(ultimo.fecha)) || c.tipo === 'Racha abierta').sort((a, b) => b.score - a.score)[0];
    if (sobre) out.push({...sobre, tipo: 'Último partido', fam: 'ultimo', score: 99});
    else {
      let mejor = null;
      for (const [nombre, f] of Object.entries(MET_UNO)) {
        const v = f(ultimo);
        if (!v || v <= 0) continue;
        const temp = ofi.filter(p => p.temporada === ultimo.temporada).map(f).filter(x => x !== null);
        const pos = temp.filter(x => x > v).length + 1;
        if (!mejor || pos < mejor.pos) mejor = {nombre, v, pos, n: temp.length};
      }
      const antes = (rivales[ultimo.rival] || []).filter(p => p !== ultimo);
      out.push({n: mejor ? (mejor.nombre === 'espectadores' ? miles(mejor.v) : mejor.v) : ofi.length,
        hecho: mejor ? `${mejor.nombre.charAt(0).toUpperCase() + mejor.nombre.slice(1)} en el ${marca} (${fecha(ultimo.fecha)}).` : `Partidos oficiales del ${club} con Varela; el último, ${marca}.`,
        fin: mejor ? (mejor.pos === 1 ? 'El máximo de la temporada.' : `${mejor.pos}.º de ${mejor.n} esta temporada.`) : 'Último resultado.',
        ctx: antes.length ? `Antes ante el ${ultimo.rival}: ${antes.map(p => LETRA[r90(p)]).join(' ')}.` : `Primer partido oficial ante el ${ultimo.rival}.`,
        g: gCasillas(ofi.slice(-8), [7, 7]), t: ultimo.temporada, tipo: 'Último partido', fam: 'ultimo', score: 99});
    }
  }

  // ===== selección: las mejores, como mucho una por métrica y sentido =====
  const vistas = new Set(), lista = [];
  // variedad: primero la mejor de cada tipo, luego el resto por puntuación
  const orden = out.sort((a, b) => b.score - a.score);
  const tipos = new Set();
  const primeras = orden.filter(c => !tipos.has(c.tipo) && tipos.add(c.tipo));
  for (const c of [...primeras, ...orden]) {
    const firma = c.n + '|' + (c.t || '') + '|' + c.hecho.split(' de ').slice(1).join(' de ').slice(0, 50);
    if (vistas.has(c.fam) || vistas.has(firma) || vistas.has(c.hecho)) continue;
    vistas.add(c.fam); vistas.add(firma); vistas.add(c.hecho);
    lista.push(c);
  }
  // se cortan las 60 primeras (las mejores de cada tipo van delante) y se ordenan por puntuación
  return {lista: lista.slice(0, 60).sort((a, b) => b.score - a.score), ultima, candidatas: out.length};
}

// ---------------------------------------------------------------- vista
function curiosidades() {
  if (curiosidades.cache?.d !== D) curiosidades.cache = {d: D, ...motor()};
  return curiosidades.cache.lista;
}

function vistaCuriosidades() {
  const todas = curiosidades(), {ultima, candidatas} = curiosidades.cache;
  const filtro = vistaCuriosidades.f ||= 'todas';
  const lista = filtro === 'ultima' ? todas.filter(c => c.t === ultima) : todas;
  const chip = (k, t) => `<button class="chip" data-cf="${k}" aria-pressed="${filtro === k}">${t}</button>`;
  return `<section><div class="wrap"><h2 data-n="13">Datos y curiosidades</h2>
    <p class="sub">Curiosidades que no aportan nada, pero entretienen. Nadie las escribe: FM Hub recorre todos los datos (jugadores, temporadas, partidos, rachas, rivales, minutos, atributos, finanzas y traspasos), busca récords, mínimos, rachas y primicias y enseña las ${todas.length} más llamativas de ${miles(candidatas)} encontradas. Cambian solas con cada partido.</p>
    <div class="filters">${chip('todas', `Todas (${todas.length})`)}${chip('ultima', `Temporada ${esc(ultima || '')} (${todas.filter(c => c.t === ultima).length})`)}</div>
    <div class="curs">${lista.map(c => tarjeta(c, todas.indexOf(c))).join('') || '<p class="vacio">No hay curiosidades de esta temporada todavía.</p>'}</div>
  </div></section>`;
}

function tarjeta(c, i) {
  return `<article class="cur" id="cur-${i}">
    <div class="cur-tipo"><span>${esc(c.tipo)}</span><span>${c.t ? esc(c.t) : 'Histórico'}</span></div>
    <p class="cur-n">${esc(c.n)}.</p>
    <p class="cur-h">${esc(c.hecho)}</p>
    <p class="cur-f">${esc(c.fin)}</p>
    ${c.g ? `<div class="cur-g">${c.g}</div>` : ''}
    <p class="cur-ctx">${esc(c.ctx)}</p>
    <button class="btn sec cur-dl" data-cdl="${i}">Descargar imagen</button>
  </article>`;
}

// ---------------------------------------------------------------- tarjeta como imagen (PNG)
function partirTexto(texto, max) {
  const out = [];
  let linea = '';
  for (const p of String(texto).split(' ')) {
    if ((linea + ' ' + p).trim().length > max) { if (linea) out.push(linea); linea = p; }
    else linea = (linea + ' ' + p).trim();
  }
  if (linea) out.push(linea);
  return out;
}
async function descargarTarjeta(i) {
  const c = curiosidades()[i];
  const css = getComputedStyle(document.documentElement);
  const v = n => css.getPropertyValue('--' + n).trim();
  const color = s => s.replace(/var\(--([a-z]+)\)/g, (m, n) => v(n));
  const W = 1080, M = 80, fuente = "Archivo, 'Arial Black', Arial, sans-serif";
  let y = M + 40;
  const l = [];
  l.push(`<text x="${M}" y="${y}" font-family="'JetBrains Mono', monospace" font-size="26" letter-spacing="4" fill="${v('gold')}">${esc((c.tipo + ' · ' + (c.t || 'Histórico')).toUpperCase())}</text>`);
  y += 190;
  const tamN = String(c.n).length > 6 ? 150 : 210;
  l.push(`<text x="${M - 6}" y="${y}" font-family="${fuente}" font-weight="900" font-size="${tamN}" fill="${v('ink')}">${esc(c.n)}.</text>`);
  y += 80;
  for (const t of partirTexto(c.hecho, 38)) { l.push(`<text x="${M}" y="${y}" font-family="${fuente}" font-weight="700" font-size="44" fill="${v('ink')}">${esc(t)}</text>`); y += 56; }
  y += 10;
  l.push(`<text x="${M}" y="${y}" font-family="${fuente}" font-weight="900" font-size="44" fill="${v('gold')}">${esc(c.fin)}</text>`);
  y += 40;
  if (c.g) {
    const alto = (W - 2 * M) * GH / GW;
    l.push(color(c.g).replace('<svg ', `<svg x="${M}" y="${y}" width="${W - 2 * M}" height="${alto}" `)
      .replace(/class="gl"/g, 'font-family="monospace" font-size="11" font-weight="700" fill="#fff"')
      .replace(/class="gv"/g, `font-family="monospace" font-size="10" fill="${v('ink')}"`)
      .replace(/class="ge"/g, `font-family="monospace" font-size="9" fill="${v('mut')}"`)
      .replace(/<title>.*?<\/title>/g, ''));
    y += alto + 30;
  }
  for (const t of partirTexto(c.ctx, 62).slice(0, 5)) { l.push(`<text x="${M}" y="${y}" font-family="Arial, sans-serif" font-size="27" fill="${v('mut')}">${esc(t)}</text>`); y += 38; }
  const H = Math.max(W, y + 90);
  l.push(`<text x="${M}" y="${H - 50}" font-family="'JetBrains Mono', monospace" font-size="24" fill="${v('mut')}">FM HUB · ${esc(IDX.club.toUpperCase())} DE VARELA · FM24</text>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="${v('card')}"/><rect width="${W}" height="14" fill="${v('gold')}"/>${l.join('')}</svg>`;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  cv.getContext('2d').drawImage(img, 0, 0);
  const a = document.createElement('a');
  a.download = `fmhub_curiosidad_${i + 1}.png`;
  a.href = cv.toDataURL('image/png');
  a.click();
}

document.addEventListener('click', ev => {
  const b = ev.target.closest('button');
  if (!b) return;
  if (b.dataset.cf) { vistaCuriosidades.f = b.dataset.cf; pintar(); }
  if (b.dataset.cdl !== undefined) descargarTarjeta(+b.dataset.cdl).catch(e => alert('No se pudo crear la imagen: ' + e.message));
});
