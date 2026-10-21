// FM Hub: web de solo lectura. Lee /api/datos (o los datos incrustados en el HTML autocontenido) y pinta
// las vistas: inicio y novedades, plantilla, partidos, temporadas, traspasos, finanzas, historial y ficha.
'use strict';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const miles = v => { const n = Math.round(Number(v)); return (n < 0 ? '-' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
const num = v => (v === null || v === undefined || v === '' || isNaN(v)) ? '–' : miles(v);
const eur = v => (v === null || v === undefined || isNaN(v)) ? '–' : miles(v) + ' €';
const fecha = f => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-ES', {day: 'numeric', month: 'short', year: 'numeric'}) : '';
const J = s => { try { return typeof s === 'string' ? JSON.parse(s) : (s || {}); } catch (e) { return {}; } };
const TECN = ['Cór','Cen','Reg','Rem','Ctr','Lib','Cab','Lej','Sq L','Mar','Pas','Pen','Ent','Téc'];
const MENT = ['Agr','Ant','Val','Ser','Cnc','Dec','Det','Tal','Lid','Dmq','Col','JEq','Vis','Sac'];
const FIS = ['Ace','Agi','Equ','Sal','Fís','Vel','Res','Fue'];
const POR = ['Aér','Mdo','Com','Exc','Blo','Saq','1v1','Puñ','Ref','SAL','Pue'];
const NOMBRE_ATR = {'Cór':'Córners','Cen':'Centros','Reg':'Regate','Rem':'Remate','Ctr':'Control','Lib':'Lanz. libres','Cab':'Cabeceo','Lej':'Tiros lejanos','Sq L':'Saques de banda','Mar':'Marcaje','Pas':'Pase','Pen':'Penaltis','Ent':'Entradas','Téc':'Técnica','Agr':'Agresividad','Ant':'Anticipación','Val':'Valentía','Ser':'Serenidad','Cnc':'Concentración','Dec':'Decisiones','Det':'Determinación','Tal':'Talento','Lid':'Liderazgo','Dmq':'Desmarques','Col':'Colocación','JEq':'Trabajo en equipo','Vis':'Visión','Sac':'Sacrificio','Ace':'Aceleración','Agi':'Agilidad','Equ':'Equilibrio','Sal':'Salto','Fís':'Forma física','Vel':'Velocidad','Res':'Resistencia','Fue':'Fuerza','Aér':'Juego aéreo','Mdo':'Mando de área','Com':'Comunicación','Exc':'Excentricidad','Blo':'Blocaje','Saq':'Saque de puerta','1v1':'Uno contra uno','Puñ':'Puños','Ref':'Reflejos','SAL':'Salidas','Pue':'Saque con la mano'};

let D = null;          // datos
const IDX = {};        // índices calculados una vez

// ---------------------------------------------------------------- carga
async function cargar() {
  if (window.FMHUB_DATOS) return window.FMHUB_DATOS;
  // Publicada en internet: los datos van en datos.json (FM Hub los sube cuando cambian; ?t= salta la caché de GitHub Pages)
  const r = await fetch(window.FMHUB_PUBLICADO ? 'datos.json?t=' + Date.now() : 'api/datos', {cache: 'no-store'});
  if (!r.ok) throw new Error('No se pudieron leer los datos (' + r.status + ')');
  return r.json();
}

function preparar() {
  const club = D.club.nombre;
  IDX.club = club;
  // Partidos desde el punto de vista del club
  IDX.partidos = D.partidos.map(p => {
    const casa = !!p.en_casa;
    const gf = casa ? p.goles_local : p.goles_visitante, gc = casa ? p.goles_visitante : p.goles_local;
    let res = gf > gc ? 'W' : gf < gc ? 'L' : 'D';
    let pen = '';
    if (p.penaltis_local !== null && p.penaltis_local !== undefined) {
      const pf = casa ? p.penaltis_local : p.penaltis_visitante, pc = casa ? p.penaltis_visitante : p.penaltis_local;
      res = pf > pc ? 'W' : 'L';
      pen = ` (${pf}-${pc} pen.)`;
    }
    return {...p, casa, rival: casa ? p.visitante : p.local, gf, gc, res, pen,
            oficial: p.competicion !== 'Amistoso', clave: p.fecha + '|' + p.local + '|' + p.visitante};
  });
  IDX.golesPorPartido = {};
  for (const g of D.goles) (IDX.golesPorPartido[g.fecha + '|' + g.local + '|' + g.visitante] ||= []).push(g);
  IDX.temporadas = [...new Set(IDX.partidos.map(p => p.temporada))].sort();
  IDX.stats = {};
  for (const e of D.estadisticas) (IDX.stats[e.iu] ||= {})[e.tipo] = e;
  IDX.export = {};
  for (const e of D.exportacion) IDX.export[e.iu] = J(e.detalle);
  IDX.atr = {};
  for (const a of D.atributos) (IDX.atr[a.iu] ||= []).push({fecha: a.fecha_real, origen: a.origen, v: J(a.atributos)});
  IDX.historial = {};
  for (const h of D.historial) (IDX.historial[h.iu] ||= []).push(h);
  IDX.pj = {};
  for (const r of D.partido_jugador) (IDX.pj[r.iu] ||= []).push(r);
  IDX.nombres = {};
  for (const h of D.historial) IDX.nombres[h.iu] = h.jugador;
  for (const t of D.traspasos) if (t.iu) IDX.nombres[t.iu] = t.jugador;
  for (const p of D.plantilla) IDX.nombres[p.iu] = p.nombre;
  const caps = D.capturas.filter(c => c.origen === 'memoria' && c.fecha_juego);
  IDX.fechaJuego = caps.length ? caps[caps.length - 1].fecha_juego : null;
  IDX.temporadaActual = caps.length ? caps[caps.length - 1].temporada : IDX.temporadas[IDX.temporadas.length - 1];
}

const jug = (iu, nombre) => iu ? `<a class="j" href="#jugador/${iu}">${esc(nombre || IDX.nombres[iu] || iu)}</a>` : esc(nombre || '');
const pillRes = p => `<span class="res ${p.res}">${p.gf}-${p.gc}</span>`;
function edad(nac) {
  if (!nac || !IDX.fechaJuego) return null;
  const a = new Date(nac), h = new Date(IDX.fechaJuego);
  let e = h.getFullYear() - a.getFullYear();
  if (h < new Date(h.getFullYear(), a.getMonth(), a.getDate())) e--;
  return e;
}
function grupoPos(pos) {
  const p = (pos || '').toUpperCase();
  if (p.startsWith('POR')) return 'POR';
  if (/^(DF|CR|LI|LD)/.test(p)) return 'DEF';   // DF defensa, CR carrilero
  if (/^(MC|ME|MP|MCD|CC|MD)/.test(p)) return 'MED';
  if (/^(DL|DC|DEL)/.test(p)) return 'DEL';    // DL delantero
  return 'OTR';
}
function golesTexto(p) {
  const gs = (IDX.golesPorPartido[p.clave] || []).filter(g => (g.lado === 0) === p.casa && g.tipo !== 3);
  return gs.map(g => `${esc(g.jugador || '¿?')} ${g.minuto}'${g.anadido ? '+' + g.anadido : ''}${g.tipo === 2 ? ' (p)' : g.tipo === 1 ? ' (pp)' : ''}`).join(', ');
}

// ---------------------------------------------------------------- tablas ordenables
function tabla(id, cols, filas, orden) {
  const st = (tabla.estado[id] ||= {k: orden?.k ?? null, d: orden?.d ?? -1});
  if (st.k !== null) {
    const c = cols.find(c => c.k === st.k);
    if (c) filas = [...filas].sort((a, b) => {
      const va = c.v ? c.v(a) : a[c.k], vb = c.v ? c.v(b) : b[c.k];
      if (va === vb) return 0;
      if (va === null || va === undefined || va === '') return 1;
      if (vb === null || vb === undefined || vb === '') return -1;
      return (va > vb ? 1 : -1) * st.d;
    });
  }
  const th = cols.map(c => `<th class="${c.n ? 'n' : ''}" data-t="${id}" data-k="${c.k}">${esc(c.t)}${st.k === c.k ? (st.d > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('');
  const tb = filas.map(f => `<tr class="${f._cls || ''}">` + cols.map(c => `<td class="${c.n ? 'n' : ''} ${c.cls || ''}">${c.h ? c.h(f) : esc(f[c.k] ?? '')}</td>`).join('') + '</tr>').join('');
  return `<div class="tw"><table><thead><tr>${th}</tr></thead><tbody>${tb || `<tr><td class="vacio" colspan="${cols.length}">Sin datos</td></tr>`}</tbody></table></div>`;
}
tabla.estado = {};
document.addEventListener('click', ev => {
  const th = ev.target.closest('th[data-t]');
  if (!th) return;
  const st = tabla.estado[th.dataset.t];
  st.d = st.k === th.dataset.k ? -st.d : -1;
  st.k = th.dataset.k;
  pintar();
});

// ---------------------------------------------------------------- cabecera
function cabecera() {
  const of = IDX.partidos.filter(p => p.oficial);
  const v = of.filter(p => p.res === 'W').length, e = of.filter(p => p.res === 'D').length, d = of.filter(p => p.res === 'L').length;
  $('#eyebrow').textContent = `FM Hub · ${IDX.temporadaActual || ''}${IDX.fechaJuego ? ' · ' + fecha(IDX.fechaJuego) : ''}`;
  $('#titulo').innerHTML = `${esc(IDX.club)} <em>de Varela</em>`;
  $('#lead').textContent = `Datos leídos de Football Manager 2024 mientras juegas. ${window.FMHUB_ESTATICO ? 'Copia autocontenida generada el ' + fecha(D.generado.slice(0, 10)) + '.' : 'Actualizado: ' + D.generado.replace('T', ' ').slice(0, 16) + '.'}`;
  const gf = of.reduce((s, p) => s + p.gf, 0), gc = of.reduce((s, p) => s + p.gc, 0);
  $('#bigs').innerHTML = [[of.length, 'partidos oficiales'], [v, 'victorias'], [e, 'empates'], [d, 'derrotas'], [gf, 'goles a favor'], [gc, 'goles en contra']]
    .map(([n, t]) => `<div class="big"><b>${num(n)}</b><span>${t}</span></div>`).join('');
  $('#pie').innerHTML = `FM Hub · solo lectura: no modifica el juego ni la partida · ${esc(D.generado.replace('T', ' ').slice(0, 16))}`;
}

// ---------------------------------------------------------------- vistas
const V = {};

V.inicio = () => {
  const of = IDX.partidos.filter(p => p.oficial);
  const forma = of.slice(-23).map(p => `<i class="${p.res}" title="${fecha(p.fecha)} ${esc(p.rival)} ${p.gf}-${p.gc}"></i>`).join('');
  const ult = IDX.partidos.slice(-6).reverse();
  const nov = novedades();
  const tras = [...D.traspasos].slice(-6).reverse();
  const qr = (window.FMHUB_ESTATICO || window.FMHUB_PUBLICADO) ? '' : `
    <div class="card"><h4 style="margin-top:0">Abrir en el móvil</h4>
      <div class="qr"><img src="qr.svg" alt="Código QR de la web"><div>
        <p class="mini">Escanéalo con la cámara del móvil (misma wifi). Dirección: <b class="mono" id="url">…</b></p>
        <p class="mini">Puedes instalarla como app desde el menú del navegador («Añadir a pantalla de inicio»).</p>
        <div class="fila-btn"><a class="btn" href="api/exportar-html">Descargar HTML autocontenido</a></div>
        <p class="mini">El HTML lleva todos los datos dentro: se puede abrir sin FM Hub o subir a cualquier hosting.</p>
      </div></div></div>`;
  return `<section><div class="wrap">
    <h2 data-n="01">Hoy</h2><p class="sub">Forma de los últimos partidos oficiales, novedades de las últimas lecturas y estado de FM Hub.</p>
    <div class="form">${forma}</div>
    <div class="legend"><span><b style="background:var(--w)"></b>Victoria</span><span><b style="background:var(--d)"></b>Empate</span><span><b style="background:var(--l)"></b>Derrota</span></div>
    <div class="cols2" style="margin-top:18px">
      <div class="card"><h4 style="margin-top:0">Novedades</h4>${nov.length ? `<ul class="nov">${nov.slice(0, 18).map(n => `<li><span class="i ${n.c}">${n.i}</span><span>${n.t}</span></li>`).join('')}</ul>` : '<p class="vacio">Sin cambios recientes.</p>'}</div>
      <div class="card"><h4 style="margin-top:0">Últimos partidos</h4>${ult.map(p => `<div class="tri"><span class="d">${fecha(p.fecha)}</span><span><span class="ha">${p.casa ? 'C' : 'F'}</span>${esc(p.rival)} <span class="mini">${esc(p.competicion || '')}</span></span>${pillRes(p)}</div>`).join('')}
        <h4>Últimos traspasos</h4>${tras.map(t => `<div class="tri"><span class="d">${fecha(t.fecha)}</span><span class="${t.entra ? 'in' : 'out'}">${t.entra ? '↘' : '↗'} ${jug(t.iu, t.jugador)} <span class="mini">${esc(t.otro_club || 'libre')}</span></span><span class="f">${t.cesion ? 'cesión' : eur(t.precio_eur)}</span></div>`).join('')}</div>
    </div>
    <div class="cols2" style="margin-top:14px">${qr}
      ${D.registro ? `<div class="card"><h4 style="margin-top:0">Estado de FM Hub</h4><pre class="registro">${esc(D.registro.join('\n')) || 'Sin registro.'}</pre></div>` : ''}
    </div>
  </div></section>`;
};

function novedades() {
  const out = [];
  for (const p of D.plantilla) {
    const h = IDX.atr[p.iu];
    if (!h || h.length < 2) continue;
    const a = h[h.length - 2].v, b = h[h.length - 1].v;
    for (const k of Object.keys(b)) {
      if (a[k] !== undefined && a[k] !== b[k] && Math.abs(a[k] - b[k]) <= 6)
        out.push({f: h[h.length - 1].fecha, c: b[k] > a[k] ? 'up' : 'dn', i: b[k] > a[k] ? '▲' : '▼',
                  t: `${jug(p.iu, p.nombre)}: ${NOMBRE_ATR[k] || k} ${a[k]} → ${b[k]}`});
    }
  }
  out.sort((x, y) => (y.f || '').localeCompare(x.f || ''));
  for (const r of D.partido_jugador.slice(-8).reverse()) if (!r.varios && r.goles)
    out.unshift({c: 'pt', i: '⚽', t: `${jug(r.iu, r.jugador)} marcó ${r.goles} el ${fecha(r.fecha)}`});
  return out;
}

V.plantilla = () => {
  const filtro = V.plantilla.filtro ||= 'todos';
  const q = (V.plantilla.q || '').toLowerCase();
  const filas = D.plantilla.map(p => {
    const s = IDX.stats[p.iu] || {}, t = s.total || {}, x = IDX.export[p.iu] || {};
    return {...p, pos: x.posicion || '', g: grupoPos(x.posicion), edad: edad(p.fecha_nacimiento), part: t.partidos ?? 0,
            min: t.minutos ?? 0, gol: t.goles ?? 0, asis: t.asistencias ?? 0, nota: t.nota_media, ama: t.amarillas ?? 0,
            valor: x.valor || '', am: (s.amistosos || {}).partidos ?? 0};
  }).filter(p => (filtro === 'todos' || p.g === filtro) && (!q || p.nombre.toLowerCase().includes(q)));
  const chips = [['todos', 'Todos'], ['POR', 'Porteros'], ['DEF', 'Defensas'], ['MED', 'Medios'], ['DEL', 'Delanteros']]
    .map(([k, t]) => `<button class="chip" data-pf="${k}" aria-pressed="${filtro === k}">${t}</button>`).join('');
  return `<section><div class="wrap"><h2 data-n="02">Plantilla</h2>
    <p class="sub">Temporada ${esc(IDX.temporadaActual)}: partidos oficiales, minutos y goles (los amistosos van aparte). Toca una columna para ordenar y un nombre para ver su ficha.</p>
    <input class="search" id="buscar" placeholder="Buscar jugador" value="${esc(V.plantilla.q || '')}">
    <div class="filters">${chips}</div>
    ${tabla('plantilla', [
      {k: 'nombre', t: 'Jugador', h: p => jug(p.iu, p.nombre) + (p.cedido_a ? ` <span class="pill">cedido: ${esc(p.cedido_a)}</span>` : '')},
      {k: 'pos', t: 'Pos'}, {k: 'edad', t: 'Edad', n: 1},
      {k: 'part', t: 'PJ', n: 1}, {k: 'min', t: 'Min', n: 1, h: p => num(p.min)}, {k: 'gol', t: 'Gol', n: 1}, {k: 'asis', t: 'Asis', n: 1},
      {k: 'nota', t: 'Nota', n: 1, h: p => p.nota ? p.nota.toFixed(2) : '–'}, {k: 'ama', t: 'Am', n: 1}, {k: 'am', t: 'Amist.', n: 1},
      {k: 'sueldo_mes_eur', t: 'Sueldo/mes', n: 1, h: p => eur(p.sueldo_mes_eur)},
      {k: 'fin_contrato', t: 'Contrato', h: p => fecha(p.fin_contrato)}, {k: 'valor', t: 'Valor (pantalla)', h: p => esc(p.valor)},
    ], filas, {k: 'min', d: -1})}
  </div></section>`;
};

V.partidos = () => {
  const temp = V.partidos.t ||= IDX.temporadaActual || IDX.temporadas[IDX.temporadas.length - 1];
  const amis = V.partidos.amis ?? false;
  let ps = IDX.partidos.filter(p => p.temporada === temp && (amis || p.oficial));
  const comps = [...new Set(ps.map(p => p.competicion))];
  const comp = V.partidos.c && comps.includes(V.partidos.c) ? V.partidos.c : null;
  if (comp) ps = ps.filter(p => p.competicion === comp);
  const of = ps.filter(p => p.oficial);
  const r = k => of.filter(p => p.res === k).length;
  const tabs = IDX.temporadas.map(t => `<button class="tab" data-pt="${t}" aria-selected="${t === temp}">${t}<small>${IDX.partidos.filter(p => p.temporada === t && p.oficial).length} oficiales</small></button>`).join('');
  return `<section><div class="wrap"><h2 data-n="03">Partidos</h2>
    <p class="sub">Todos los partidos con resultado, competición y goleadores con minuto (p = penalti, pp = en propia puerta).</p>
    <div class="tabs">${tabs}</div>
    <div class="filters"><button class="chip" data-pa="1" aria-pressed="${amis}">Con amistosos</button>
      ${comps.map(c => `<button class="chip" data-pc="${esc(c)}" aria-pressed="${comp === c}">${esc(c)}</button>`).join('')}</div>
    <p class="meta"><span><b>${of.length}</b> oficiales</span><span><b>${r('W')}</b> V</span><span><b>${r('D')}</b> E</span><span><b>${r('L')}</b> D</span>
      <span><b>${of.reduce((s, p) => s + p.gf, 0)}</b>–<b>${of.reduce((s, p) => s + p.gc, 0)}</b> goles</span></p>
    ${tabla('partidos', [
      {k: 'fecha', t: 'Fecha', h: p => fecha(p.fecha)}, {k: 'competicion', t: 'Competición', cls: 'cmp'},
      {k: 'rival', t: 'Rival', h: p => `<span class="ha">${p.casa ? 'C' : 'F'}</span>${esc(p.rival)}`},
      {k: 'res', t: 'Res.', h: p => pillRes(p) + esc(p.pen)},
      {k: 'espectadores', t: 'Público', n: 1, h: p => num(p.espectadores)},
      {k: 'gol', t: 'Goleadores', cls: 'sc', h: golesTexto},
    ], ps.map(p => ({...p, _cls: 'r' + p.res})), {k: 'fecha', d: 1})}
  </div></section>`;
};

V.temporadas = () => {
  const temp = V.temporadas.t ||= IDX.temporadas.filter(t => D.clasificaciones.some(c => c.temporada === t)).pop() || IDX.temporadaActual;
  const cl = D.clasificaciones.filter(c => c.temporada === temp);
  const of = IDX.partidos.filter(p => p.temporada === temp && p.oficial);
  const gol = {};
  for (const p of of) for (const g of (IDX.golesPorPartido[p.clave] || [])) if ((g.lado === 0) === p.casa && g.tipo !== 1 && g.tipo !== 3) {
    const k = g.iu || g.jugador; (gol[k] ||= {iu: g.iu, n: g.jugador, g: 0}).g++;
  }
  const top = Object.values(gol).sort((a, b) => b.g - a.g).slice(0, 10);
  const max = top[0]?.g || 1;
  const tabs = IDX.temporadas.map(t => `<button class="tab" data-tt="${t}" aria-selected="${t === temp}">${t}</button>`).join('');
  return `<section><div class="wrap"><h2 data-n="04">Temporadas</h2>
    <p class="sub">Clasificación final (o la última que FM tenía cargada) y máximos goleadores en partidos oficiales.</p>
    <div class="tabs">${tabs}</div>
    <div class="cols2">
      <div>${cl.length ? tabla('clas' + temp, [
        {k: 'pos', t: '#', n: 1}, {k: 'club', t: 'Equipo'}, {k: 'j', t: 'PJ', n: 1}, {k: 'g', t: 'G', n: 1}, {k: 'e', t: 'E', n: 1},
        {k: 'p', t: 'P', n: 1}, {k: 'gf', t: 'GF', n: 1}, {k: 'gc', t: 'GC', n: 1}, {k: 'pts', t: 'Pts', n: 1}],
        cl.map(c => ({...c, _cls: c.club === IDX.club ? 'propio' : ''})), {k: 'pos', d: 1}) : '<p class="vacio">No hay clasificación guardada de esta temporada (se guarda al abrir la tabla en FM).</p>'}</div>
      <div class="card"><h4 style="margin-top:0">Goleadores</h4><div class="bars">${top.map(t => `<div class="row"><span>${jug(t.iu, t.n)}</span><div class="bg"><div class="fg g" style="width:${100 * t.g / max}%"></div></div><b>${t.g}</b></div>`).join('') || '<p class="vacio">Sin goles.</p>'}</div></div>
    </div>
  </div></section>`;
};

V.traspasos = () => {
  const porT = {};
  for (const t of D.traspasos) {
    const a = +t.fecha.slice(0, 4), m = +t.fecha.slice(5, 7), ini = m >= 7 ? a : a - 1;
    (porT[`${ini}/${String(ini + 1).slice(2)}`] ||= []).push(t);
  }
  const bloque = (lista, entra) => lista.filter(t => !!t.entra === entra).map(t =>
    `<div class="tri"><span class="d">${fecha(t.fecha)}</span><span>${jug(t.iu, t.jugador)} <span class="mini">${entra ? 'de' : 'a'} ${esc(t.otro_club || 'agente libre')}</span></span><span class="f ${entra ? 'out' : 'in'}">${t.cesion ? 'cesión' : t.precio_eur ? eur(t.precio_eur) : 'libre'}</span></div>`).join('') || '<p class="vacio">Ninguno.</p>';
  return `<section><div class="wrap"><h2 data-n="05">Traspasos</h2>
    <p class="sub">Fichajes y salidas por temporada (sin cuerpo técnico). Importes como en pantalla.</p>
    ${Object.keys(porT).sort().reverse().map(t => `<h4>${t}</h4><div class="tr2"><div class="card"><h4 style="margin-top:0" class="in">Llegan</h4>${bloque(porT[t], true)}</div><div class="card"><h4 style="margin-top:0" class="out">Salen</h4>${bloque(porT[t], false)}</div></div>`).join('')}
  </div></section>`;
};

V.finanzas = () => {
  const f = D.finanzas;
  if (!f.length) return `<section><div class="wrap"><h2 data-n="06">Finanzas</h2><p class="vacio">Sin datos de finanzas.</p></div></section>`;
  const W = 900, H = 220, P = 30;
  const sal = f.map(x => x.saldo_eur), mn = Math.min(0, ...sal), mx = Math.max(...sal);
  const X = i => P + i * (W - 2 * P) / Math.max(1, f.length - 1), Y = v => H - P - (v - mn) * (H - 2 * P) / Math.max(1, mx - mn);
  const linea = f.map((x, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(x.saldo_eur).toFixed(1)}`).join('');
  const porT = {};
  for (const x of f) { const t = (porT[x.temporada] ||= {i: 0, g: 0, s: 0, n: 0}); t.i += x.ingresos_totales_eur; t.g += x.gastos_totales_eur; t.s += x.gasto_sueldos_eur; t.n++; }
  const ult = f[f.length - 1];
  return `<section><div class="wrap"><h2 data-n="06">Finanzas</h2>
    <p class="sub">Últimos ${f.length} meses leídos de FM (moneda interna × 1,16618; junio de 2028 cuadra al euro con la exportación de economía). El mes en curso todavía cambia.</p>
    <div class="kpis"><div class="card kpi"><b>${eur(ult.saldo_eur)}</b><span>saldo del mes en curso</span></div>
      <div class="card kpi"><b>${eur(Math.round(ult.presupuesto_salarial_semana * 5.067))}</b><span>presupuesto salarial / mes</span></div>
      <div class="card kpi"><b>${eur(Math.round(ult.masa_salarial_semana * 5.067))}</b><span>masa salarial / mes</span></div>
      <div class="card kpi"><b>${eur(ult.presupuesto_fichajes_restante_eur)}</b><span>presupuesto de fichajes restante</span></div></div>
    <div class="card chart"><h4 style="margin-top:0">Saldo mes a mes</h4>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Saldo mensual"><line class="eje" x1="${P}" x2="${W - P}" y1="${Y(0)}" y2="${Y(0)}"/><path class="linea" d="${linea}"/>
      ${f.map((x, i) => i % 6 === 0 ? `<text x="${X(i)}" y="${H - 8}" text-anchor="middle">${x.mes}</text>` : '').join('')}</svg></div>
    <h4>Por temporada (julio a junio)</h4>
    ${tabla('finT', [{k: 't', t: 'Temporada'}, {k: 'n', t: 'Meses', n: 1}, {k: 'i', t: 'Ingresos', n: 1, h: r => eur(r.i)}, {k: 'g', t: 'Gastos', n: 1, h: r => eur(r.g)},
      {k: 'neto', t: 'Neto', n: 1, h: r => `<span class="${r.neto >= 0 ? 'in' : 'out'}">${eur(r.neto)}</span>`}, {k: 's', t: 'Sueldos', n: 1, h: r => eur(r.s)}],
      Object.entries(porT).map(([t, v]) => ({t, ...v, neto: v.i - v.g})), {k: 't', d: -1})}
    <h4>Mes a mes</h4>
    ${tabla('finM', [{k: 'mes', t: 'Mes'}, {k: 'saldo_eur', t: 'Saldo', n: 1, h: r => eur(r.saldo_eur)}, {k: 'ingresos_totales_eur', t: 'Ingresos', n: 1, h: r => eur(r.ingresos_totales_eur)},
      {k: 'gastos_totales_eur', t: 'Gastos', n: 1, h: r => eur(r.gastos_totales_eur)}, {k: 'neto_eur', t: 'Neto', n: 1, h: r => eur(r.neto_eur)},
      {k: 'gasto_traspasos_neto_eur', t: 'Traspasos', n: 1, h: r => eur(r.gasto_traspasos_neto_eur)}], f, {k: 'mes', d: -1})}
  </div></section>`;
};

V.historial = () => {
  const q = (V.historial.q || '').toLowerCase();
  const porJ = {};
  for (const h of D.historial) if (h.tipo === 'liga' || h.tipo === 'total') {
    const j = (porJ[h.iu] ||= {iu: h.iu, n: h.jugador, temps: new Set(), dartford: new Set(), pj: 0, g: 0});
    j.temps.add(h.temporada);
    if (h.club === IDX.club) j.dartford.add(h.temporada);
    if (h.tipo === 'liga') { j.pj += h.partidos || 0; j.g += h.goles || 0; }
  }
  const actuales = new Set(D.plantilla.map(p => p.iu));
  const filas = Object.values(porJ).filter(j => !q || j.n.toLowerCase().includes(q)).map(j => ({...j, est: actuales.has(j.iu) ? 'en la plantilla' : 'exjugador', nt: j.temps.size, nd: j.dartford.size}));
  const ret = {};
  for (const r of D.retirados) (ret[r.jugador] ||= []).push(r);
  return `<section><div class="wrap"><h2 data-n="07">Historial</h2>
    <p class="sub">Carrera de los jugadores actuales y de los que pasaron por el club (partidos y goles de liga, como la tabla de carrera de FM). Toca un nombre para ver todas sus temporadas.</p>
    <input class="search" id="buscarH" placeholder="Buscar jugador" value="${esc(V.historial.q || '')}">
    ${tabla('hist', [{k: 'n', t: 'Jugador', h: j => jug(j.iu, j.n)}, {k: 'est', t: 'Estado'}, {k: 'nd', t: `Temp. ${IDX.club}`, n: 1},
      {k: 'nt', t: 'Temporadas', n: 1}, {k: 'pj', t: 'PJ liga', n: 1}, {k: 'g', t: 'Goles liga', n: 1}], filas, {k: 'nd', d: -1})}
    <h4>Retirados</h4><p class="mini">FM solo conserva su resumen por etapas (todas las competiciones).</p>
    <div class="cols2">${Object.entries(ret).map(([n, rs]) => `<div class="card"><h4 style="margin-top:0">${esc(n)}</h4>${rs.map(r => `<div class="tri"><span class="d">${esc(r.etapa)}</span><span>${esc(r.club)}</span><span class="f">${num(r.partidos)} PJ · ${num(r.goles)} G</span></div>`).join('')}</div>`).join('')}</div>
  </div></section>`;
};

V.jugador = iu => {
  iu = +iu;
  const p = D.plantilla.find(x => x.iu === iu);
  const nombre = p?.nombre || IDX.nombres[iu] || 'Jugador';
  const x = IDX.export[iu] || {}, s = IDX.stats[iu] || {};
  const hist = IDX.atr[iu] || [];
  const ultimo = hist.length ? hist[hist.length - 1].v : J(p?.atributos);
  const primero = hist.length ? hist[0].v : ultimo;
  const portero = (x.posicion || '').startsWith('POR');
  const grupos = portero ? [['Portero', POR], ['Mentales', MENT], ['Físicos', FIS]] : [['Técnicos', TECN], ['Mentales', MENT], ['Físicos', FIS]];
  const color = v => v >= 15 ? 'var(--w)' : v >= 10 ? 'var(--gold)' : v >= 6 ? 'var(--d)' : 'var(--l)';
  const atr = Object.keys(ultimo || {}).length ? `<div class="attrg">${grupos.map(([t, ks]) => `<div><h5>${t}</h5>${ks.filter(k => ultimo[k] !== undefined).map(k => {
      const v = ultimo[k], d = v - (primero[k] ?? v);
      return `<div class="arow"><span>${NOMBRE_ATR[k] || k}</span><div class="bg"><div class="fg" style="width:${v * 5}%;background:${color(v)}"></div></div><b>${v}${d ? `<span class="delta ${d > 0 ? 'up' : 'dn'}">${d > 0 ? '+' : ''}${d}</span>` : ''}</b></div>`;
    }).join('')}</div>`).join('')}</div>
    <p class="mini">Progreso desde la primera lectura (${hist.length ? fecha(hist[0].fecha.slice(0, 10)) : '–'}), con ${hist.length} cambios registrados entre capturas de memoria y exportaciones.</p>` : '<p class="vacio">Sin atributos guardados (solo de jugadores de la plantilla).</p>';
  const tipos = ['amistosos', 'liga', 'copa', 'continental', 'internacional', 'total'];
  const temporada = Object.keys(s).length ? tabla('jt' + iu, [{k: 'tipo', t: 'Competición'}, {k: 'partidos', t: 'PJ', n: 1}, {k: 'titular', t: 'Tit', n: 1},
    {k: 'minutos', t: 'Min', n: 1}, {k: 'goles', t: 'Gol', n: 1}, {k: 'asistencias', t: 'Asis', n: 1}, {k: 'amarillas', t: 'Am', n: 1}, {k: 'rojas', t: 'Roj', n: 1},
    {k: 'nota_media', t: 'Nota', n: 1, h: r => r.nota_media ? r.nota_media.toFixed(2) : '–'}, {k: 'xg', t: 'xG', n: 1, h: r => J(r.detalle).xg ?? '–'}],
    tipos.filter(t => s[t]).map(t => s[t])) : '<p class="vacio">Sin estadísticas de esta temporada.</p>';
  const vistas = {}, filasC = [];
  for (const h of IDX.historial[iu] || []) {
    const k = h.temporada + '|' + h.orden;
    if (!vistas[k]) { vistas[k] = {temporada: h.temporada, orden: h.orden, club: h.club, info: h.info, division: h.division, origen: h.origen}; filasC.push(vistas[k]); }
    vistas[k][h.tipo] = h;
  }
  const c = (r, t, campo) => r[t] ? (r[t][campo] ?? '–') : '–';
  const tablaC = filasC.length ? tabla('jc' + iu, [{k: 'temporada', t: 'Temporada'}, {k: 'club', t: 'Club', h: r => esc(r.club) + (r.info ? ` <span class="pill">${esc(r.info)}</span>` : '')},
    {k: 'lp', t: 'PJ liga', n: 1, v: r => r.liga?.partidos, h: r => c(r, 'liga', 'partidos')}, {k: 'lg', t: 'Gol liga', n: 1, v: r => r.liga?.goles, h: r => c(r, 'liga', 'goles')},
    {k: 'la', t: 'Asis liga', n: 1, h: r => c(r, 'liga', 'asistencias')}, {k: 'ln', t: 'Nota', n: 1, h: r => r.liga?.nota_media ? Number(r.liga.nota_media).toFixed(2) : '–'},
    {k: 'cp', t: 'PJ copa', n: 1, h: r => c(r, 'copa', 'partidos')}, {k: 'tp', t: 'PJ total', n: 1, h: r => c(r, 'total', 'partidos')},
    {k: 'tm', t: 'Min total', n: 1, h: r => num(r.total?.minutos)}, {k: 'origen', t: 'Fuente', h: r => `<span class="origen">${r.origen === 'memoria' ? 'detalle completo' : 'liga (pantalla)'}</span>`}],
    filasC, {k: 'temporada', d: -1}) : '<p class="vacio">Sin historial de carrera guardado.</p>';
  const pj = (IDX.pj[iu] || []).filter(r => !r.varios);
  const partidosJ = pj.length ? tabla('jp' + iu, [{k: 'fecha', t: 'Fecha', h: r => fecha(r.fecha)}, {k: 'rival', t: 'Partido', h: r => esc(r.local + ' – ' + r.visitante)},
    {k: 'titular', t: 'Tit', n: 1, h: r => r.titular ? 'sí' : 'no'}, {k: 'minutos', t: 'Min', n: 1}, {k: 'goles', t: 'Gol', n: 1}, {k: 'asistencias', t: 'Asis', n: 1},
    {k: 'amarillas', t: 'Am', n: 1}, {k: 'nota', t: 'Nota', n: 1}], pj, {k: 'fecha', d: -1}) : '<p class="mini">Se rellena solo partido a partido desde que FM Hub está en marcha.</p>';
  const meta = p ? [['Posición', x.posicion || '–'], ['Edad', edad(p.fecha_nacimiento) ?? '–'], ['Nacimiento', fecha(p.fecha_nacimiento)], ['Altura', p.altura_cm ? p.altura_cm + ' cm' : '–'],
    ['Sueldo', eur(p.sueldo_mes_eur) + '/mes'], ['Contrato hasta', fecha(p.fin_contrato)], ['Valor (pantalla)', x.valor || '–'], ['Cedido a', p.cedido_a || '–']] : [['Estado', 'exjugador']];
  return `<section><div class="wrap">
    <p><a class="j" href="javascript:history.back()">← Volver</a></p>
    <div class="ficha-cab"><h2>${esc(nombre)}</h2>${p ? '<span class="pill">en la plantilla</span>' : '<span class="pill">exjugador</span>'}</div>
    <div class="meta" style="margin-top:10px">${meta.map(([k, v]) => `<span>${k}: <b>${esc(v)}</b></span>`).join('')}</div>
    <h4>Atributos</h4>${atr}
    <h4>Temporada ${esc(IDX.temporadaActual)}</h4>${temporada}
    <h4>Partido a partido</h4>${partidosJ}
    <h4>Carrera</h4>${tablaC}
  </div></section>`;
};

// ---------------------------------------------------------------- navegación
function pintar() {
  const [ruta, arg] = (location.hash.slice(1) || 'inicio').split('/');
  const vista = V[ruta] ? ruta : 'inicio';
  document.querySelectorAll('#menu a').forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === '#' + vista ? 'page' : 'false'));
  const foco = document.activeElement?.id, pos = document.activeElement?.selectionStart;
  $('#vista').innerHTML = V[vista](arg);
  if (vista === 'inicio' && !window.FMHUB_ESTATICO && !window.FMHUB_PUBLICADO) fetch('api/url').then(r => r.json()).then(u => { const e = $('#url'); if (e) e.textContent = u.url; }).catch(() => {});
  if (foco) { const e = document.getElementById(foco); if (e) { e.focus(); try { e.setSelectionRange(pos, pos); } catch (er) {} } }
}

document.addEventListener('click', ev => {
  const b = ev.target.closest('button');
  if (!b) return;
  const ds = b.dataset;
  if (ds.pf) V.plantilla.filtro = ds.pf;
  else if (ds.pt) { V.partidos.t = ds.pt; V.partidos.c = null; }
  else if (ds.pa) V.partidos.amis = !V.partidos.amis;
  else if (ds.pc !== undefined) V.partidos.c = V.partidos.c === ds.pc ? null : ds.pc;
  else if (ds.tt) V.temporadas.t = ds.tt;
  else return;
  pintar();
});
document.addEventListener('input', ev => {
  if (ev.target.id === 'buscar') { V.plantilla.q = ev.target.value; pintar(); }
  if (ev.target.id === 'buscarH') { V.historial.q = ev.target.value; pintar(); }
});
window.addEventListener('hashchange', () => { pintar(); window.scrollTo(0, document.querySelector('nav.top').offsetTop); });

(async () => {
  try {
    D = await cargar();
    preparar();
    cabecera();
    pintar();
  } catch (e) {
    $('#titulo').textContent = 'No hay datos';
    $('#vista').innerHTML = `<section><div class="wrap"><p class="vacio">${esc(e.message)}. ¿Está FM Hub en marcha?</p></div></section>`;
  }
  if ('serviceWorker' in navigator && !window.FMHUB_ESTATICO && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  // Recarga sola los datos cada 2 minutos mientras está abierta (FM Hub los actualiza mientras juegas)
  if (!window.FMHUB_ESTATICO) setInterval(async () => { try { D = await cargar(); preparar(); cabecera(); if (!document.activeElement?.matches('input')) pintar(); } catch (e) {} }, 120000);
})();
