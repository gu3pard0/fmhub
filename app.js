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
  const detalle = {};
  for (const d of D.detalle_partidos || []) detalle[d.fecha] = d;
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
    const det = detalle[p.fecha] || {};
    return {...p, casa, rival: casa ? p.visitante : p.local, gf, gc, res, pen, formacion: det.formacion || '', formacion_rival: det.formacion_rival || '',
            hora: det.hora || '', oficial: p.competicion !== 'Amistoso', clave: p.fecha + '|' + p.local + '|' + p.visitante};
  });
  // traspasos de verdad y promociones de la cantera (FM las apunta como altas sin club de origen)
  IDX.traspasos = D.traspasos.filter(t => t.tipo !== 'cantera');
  IDX.cantera = D.traspasos.filter(t => t.tipo === 'cantera');
  IDX.golesPorPartido = {};
  for (const g of D.goles) (IDX.golesPorPartido[g.fecha + '|' + g.local + '|' + g.visitante] ||= []).push(g);
  // FM guarda también los penaltis de la tanda como goles (al 90 o 120): de cada equipo solo cuentan
  // los primeros tantos como su marcador; el resto son de la tanda y se quitan
  for (const p of IDX.partidos) {
    const gs = IDX.golesPorPartido[p.clave];
    if (!gs) continue;
    gs.sort((a, b) => a.minuto - b.minuto || a.anadido - b.anadido || a.orden - b.orden);
    const n = [0, 0], max = [p.goles_local, p.goles_visitante];
    IDX.golesPorPartido[p.clave] = gs.filter(g => n[g.lado]++ < max[g.lado]);
  }
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
  IDX.enPlantilla = new Set(D.plantilla.map(p => p.iu));
  IDX.evol = {};
  for (const e of D.evolucion || []) (IDX.evol[e.iu] ||= []).push(e);
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
  const lect = D.fuentes?.ultima_lectura, hace = lect ? (Date.now() - new Date(lect)) / 60000 : Infinity;
  const viva = !window.FMHUB_ESTATICO && !window.FMHUB_PUBLICADO && hace < 5;
  $('#eyebrow').innerHTML = `<i class="dot ${viva ? 'on' : ''}" title="${viva ? 'FM Hub está leyendo el juego' : 'Sin lecturas recientes del juego'}"></i>FM Hub · ${esc(IDX.temporadaActual || '')}${IDX.fechaJuego ? ' · ' + esc(fecha(IDX.fechaJuego)) : ''}`;
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
  const nov = novedades().filter(n => V.inicio.moral || n.tag !== 'Moral');
  const k = cifrasClave();
  const tras = [...IDX.traspasos].slice(-6).reverse();
  const ultJugado = IDX.partidos.length ? IDX.partidos[IDX.partidos.length - 1].fecha : '';
  const prox = (D.proximos || []).find(x => x.fecha > ultJugado);
  const proxHtml = prox ? `<p class="prox">Próximo: ${prox.en_casa === 0 ? 'fuera ante el' : 'en casa ante el'} <b>${esc(prox.rival)}</b> · ${fecha(prox.fecha)}${prox.hora ? ' ' + esc(prox.hora) : ''} · ${esc(prox.competicion || '')}</p>`
    : '<p class="prox mini">Próximo partido: exporta el calendario de esta temporada desde FM (Ctrl+P en la pantalla de calendario) y aparecerá aquí.</p>';
  const qr = (window.FMHUB_ESTATICO || window.FMHUB_PUBLICADO) ? '' : `
    <div class="card"><h4 style="margin-top:0">Abrir en el móvil</h4>
      <div class="qr"><img src="qr.svg" alt="Código QR de la web"><div>
        <p class="mini">Escanéalo con la cámara del móvil (misma wifi). Dirección: <b class="mono" id="url">…</b></p>
        <p class="mini">Puedes instalarla como app desde el menú del navegador («Añadir a pantalla de inicio»).</p>
        <div class="fila-btn"><a class="btn" href="api/exportar-html">Descargar HTML autocontenido</a></div>
        <p class="mini">El HTML lleva todos los datos dentro: se puede abrir sin FM Hub o subir a cualquier hosting.</p>
      </div></div></div>`;
  // Exportar temporada para Claude (fase 4): solo en la web local, la genera FM Hub
  const ts = [...IDX.temporadas].reverse();
  const exp = (window.FMHUB_ESTATICO || window.FMHUB_PUBLICADO) ? '' : `
    <div class="card"><h4 style="margin-top:0">Exportar temporada para Claude</h4>
      <p class="mini">Un zip con todo lo de la temporada en JSON (partidos, goleadores, alineaciones, clasificación, plantilla, traspasos, economía, récords) y un resumen corto en .md para pegar en una conversación. También se guarda en la carpeta <b class="mono">exports</b>.</p>
      <div class="fila-btn"><select id="exp-t" class="btn sec" onchange="document.getElementById('exp-a').href='api/exportar-temporada?t='+encodeURIComponent(this.value)">${ts.map(t => `<option>${esc(t)}</option>`).join('')}</select>
        <a class="btn" id="exp-a" href="api/exportar-temporada?t=${encodeURIComponent(ts[0] || '')}">Exportar</a></div>
    </div>`;
  return `<section><div class="wrap">
    <h2 data-n="01">Hoy</h2><p class="sub">Forma de los últimos partidos oficiales, novedades de las últimas lecturas y estado de FM Hub.</p>
    <div class="form">${forma}</div>
    <div class="legend"><span><b style="background:var(--w)"></b>Victoria</span><span><b style="background:var(--d)"></b>Empate</span><span><b style="background:var(--l)"></b>Derrota</span></div>
    <div class="kpis">${k.map(([v, t]) => `<div class="card kpi"><b>${v}</b><span>${t}</span></div>`).join('')}</div>
    <div class="cols2" style="margin-top:18px">
      <div class="card"><h4 style="margin-top:0">Novedades</h4>
        <div class="filters"><button class="chip" data-nm="1" aria-pressed="${!!V.inicio.moral}">Cambios de moral</button></div>
        ${nov.length ? `<ul class="feed">${nov.slice(0, 24).map(n => `<li><time>${esc(n.cuando)}</time><span class="tag ${n.cls}">${n.tag}</span><span>${n.t}</span></li>`).join('')}</ul>` : '<p class="vacio">Sin cambios recientes.</p>'}</div>
      <div class="card"><h4 style="margin-top:0">Últimos partidos</h4>${proxHtml}${ult.map(p => `<div class="tri"><span class="d">${fecha(p.fecha)}</span><span><span class="ha">${p.casa ? 'C' : 'F'}</span>${esc(p.rival)} <span class="mini">${esc(p.competicion || '')}</span></span>${pillRes(p)}</div>`).join('')}
        <h4>Últimos traspasos</h4>${tras.map(t => `<div class="tri"><span class="d">${fecha(t.fecha)}</span><span class="${t.entra ? 'in' : 'out'}">${t.entra ? '↘' : '↗'} ${jug(t.iu, t.jugador)} <span class="mini">${esc(t.otro_club || 'libre')}</span></span><span class="f">${t.cesion ? 'cesión' : eur(t.precio_eur)}</span></div>`).join('')}</div>
    </div>
    <div class="cols2" style="margin-top:14px">${qr}${exp}
      ${D.registro ? `<div class="card"><h4 style="margin-top:0">Estado de FM Hub</h4>${fuentesHtml()}<pre class="registro">${esc(D.registro.join('\n')) || 'Sin registro.'}</pre></div>` : ''}
    </div>
  </div></section>`;
};

// Novedades al estilo de tracker.html: llegadas y salidas, goles, mejoras y bajadas de atributos, sueldo,
// contrato y moral. Lo de la partida lleva su fecha de juego; el resto, la fecha en que FM Hub lo leyó.
const cuando = f => f ? new Date(f).toLocaleString('es-ES', {day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'}) : '';
function novedades() {
  const out = [];
  for (const [iu, h] of Object.entries(IDX.atr)) {
    if (h.length < 2 || !IDX.enPlantilla.has(+iu)) continue;
    const a = h[h.length - 2].v, b = h[h.length - 1].v;
    for (const k of Object.keys(b))
      // un 1 suele ser una captura parcial (exportación sin esa columna), no un cambio real
      if (a[k] > 1 && b[k] > 1 && a[k] !== b[k] && Math.abs(a[k] - b[k]) <= 6)
        out.push({f: h[h.length - 1].fecha, tag: b[k] > a[k] ? 'Mejora' : 'Baja', cls: b[k] > a[k] ? 'g' : 'r', t: `${jug(+iu)}: ${NOMBRE_ATR[k] || k} ${a[k]} → ${b[k]}`});
  }
  for (const c of D.cambios || []) {
    if (!IDX.enPlantilla.has(c.iu)) continue;
    if (c.campo === 'sueldo') out.push({f: c.fecha, tag: 'Sueldo', cls: 'y', t: `${jug(c.iu, c.nombre)}: ${eur(c.antes)} → ${eur(c.despues)} al mes`});
    if (c.campo === 'contrato') out.push({f: c.fecha, tag: 'Contrato', cls: 'y', t: `${jug(c.iu, c.nombre)}: contrato hasta ${esc(c.antes)} → ${esc(c.despues)}`});
    if (c.campo === 'moral') out.push({f: c.fecha, tag: 'Moral', cls: 'y', t: `${jug(c.iu, c.nombre)}: moral ${esc(c.antes)} → ${esc(c.despues)}`});
  }
  for (const r of D.partido_jugador) if (!r.varios && r.goles)
    out.push({f: r.fecha, juego: true, tag: 'Gol', cls: 'g', t: `${jug(r.iu, r.jugador)} marcó${r.goles > 1 ? ' ' + r.goles + ' goles' : ''} ante el ${esc(r.local === IDX.club ? r.visitante : r.local)}`});
  const promo = {};
  for (const t of IDX.cantera) (promo[t.fecha] ||= []).push(t);
  for (const [f, ts] of Object.entries(promo).slice(-2)) out.push({f, juego: true, tag: 'Cantera', cls: 'g',
    t: `${ts.length} canteranos suben del filial: ${ts.map(t => jug(t.iu, t.jugador)).join(', ')}`});
  for (const t of IDX.traspasos.slice(-12)) out.push({f: t.fecha, juego: true, tag: t.entra ? 'Llegada' : 'Salida', cls: t.entra ? 'g' : 'r',
    t: `${jug(t.iu, t.jugador)} ${t.entra ? 'llega del' : 'se va al'} ${esc(t.otro_club || 'mercado libre')}${t.cesion ? ' (cesión)' : t.precio_eur ? ' por ' + eur(t.precio_eur) : ''}`});
  for (const n of out) n.cuando = n.juego ? fecha(n.f.slice(0, 10)) : cuando(n.f);
  // primero lo leído más recientemente; lo de la partida va junto a la última lectura, en orden de fecha de juego
  const ult = D.capturas.reduce((m, c) => c.fecha_real > m ? c.fecha_real : m, '');
  out.sort((x, y) => (y.juego ? ult : y.f).localeCompare(x.juego ? ult : x.f) || (y.f || '').localeCompare(x.f || ''));
  return out;
}

// Cifras clave de la plantilla (como tracker.html); en pretemporada, las de la última temporada oficial
function cifrasClave() {
  const P = D.plantilla;
  const tot = iu => (IDX.stats[iu] || {}).total;
  let fuente = IDX.temporadaActual, filas = P.map(p => ({iu: p.iu, n: p.nombre, ...(tot(p.iu) || {})}));
  if (!filas.some(f => f.partidos)) {
    const t = [...IDX.temporadas].reverse().find(x => D.historial.some(h => h.temporada === x && h.club === IDX.club && h.tipo === 'total' && h.partidos));
    fuente = t;
    filas = P.map(p => ({iu: p.iu, n: p.nombre, ...(D.historial.find(h => h.iu === p.iu && h.temporada === t && h.club === IDX.club && h.tipo === 'total') || {})}));
  }
  const max = (k, min = 0) => filas.filter(f => (f.partidos || 0) >= min && f[k]).sort((a, b) => b[k] - a[k])[0];
  const g = max('goles'), a = max('asistencias'), n = max('nota_media', 10);
  return [[num(P.length), 'jugadores en la plantilla'], [eur(P.reduce((s, p) => s + (p.sueldo_mes_eur || 0), 0)), 'sueldos al mes (suma)'],
    [g ? jug(g.iu, g.n) : '–', `máximo goleador ${esc(fuente || '')} · ${g ? g.goles : ''}`], [a ? jug(a.iu, a.n) : '–', `máximo asistente · ${a ? a.asistencias : ''}`],
    [n ? jug(n.iu, n.n) : '–', `mejor nota (10+ partidos) · ${n ? Number(n.nota_media).toFixed(2) : ''}`]];
}

// Fuentes (como la pestaña Fuentes de tracker.html)
function fuentesHtml() {
  const f = D.fuentes || {}, a = f.archivos || {};
  return `<p class="mini">Archivos reconocidos: plantillas <b>${num(a.plantilla || 0)}</b> · calendarios <b>${num(a.calendario || 0)}</b> · clasificaciones <b>${num(a.clasificacion || 0)}</b> · economía <b>${num(a.economia || 0)}</b> · otros <b>${num(a.otro || 0)}</b><br>
    Capturas: <b>${num(f.capturas_memoria || 0)}</b> de memoria y <b>${num(f.capturas_exportacion || 0)}</b> de exportaciones · última lectura del juego: <b>${esc(cuando(f.ultima_lectura))}</b> · último archivo: <b>${esc(cuando(f.ultimo_archivo))}</b></p>`;
}

// Suma de atributos y su cambio respecto a la captura anterior con atributos distintos (como tracker.html)
const sumaAtr = v => Object.values(v || {}).reduce((s, x) => s + x, 0);
// diferencias entre dos capturas, solo en atributos con valor real en las dos (un 1 suele ser una captura parcial)
const difsAtr = (a, b) => Object.keys(b).filter(k => a[k] > 1 && b[k] > 1).map(k => ({k, d: b[k] - a[k]}));
function deltaAtr(iu) {
  const h = IDX.atr[iu];
  if (!h || h.length < 2) return null;
  const d = difsAtr(h[h.length - 2].v, h[h.length - 1].v);
  return d.length >= 20 ? d.reduce((s, x) => s + x.d, 0) : null;
}
const cambio = v => v === null || v === undefined ? '–' : v > 0 ? `<span class="up">▲${v}</span>` : v < 0 ? `<span class="dn">▼${-v}</span>` : '<span class="mini">·</span>';
function mini(vals, fmt = v => v) {
  // línea pequeña (tracker.html): evolución de un valor en el tiempo
  if (vals.length < 2) return '<p class="mini">Aún solo hay una captura.</p>';
  const w = 320, h = 70, mn = Math.min(...vals), mx = Math.max(...vals), r = mx - mn || 1;
  const pts = vals.map((v, i) => `${(6 + i * (w - 12) / (vals.length - 1)).toFixed(1)},${(h - 10 - (v - mn) * (h - 22) / r).toFixed(1)}`);
  return `<svg viewBox="0 0 ${w} ${h}" class="spark"><polyline points="${pts.join(' ')}"/><text x="4" y="10">${esc(fmt(mx))}</text><text x="4" y="${h - 1}">${esc(fmt(mn))}</text></svg>`;
}

V.plantilla = () => {
  const filtro = V.plantilla.filtro ||= 'todos';
  const q = (V.plantilla.q || '').toLowerCase();
  const filas = D.plantilla.map(p => {
    const s = IDX.stats[p.iu] || {}, t = s.total || {}, x = IDX.export[p.iu] || {};
    return {...p, pos: x.posicion || '', g: grupoPos(x.posicion), edad: edad(p.fecha_nacimiento), part: t.partidos ?? 0,
            min: t.minutos ?? 0, gol: t.goles ?? 0, asis: t.asistencias ?? 0, nota: t.nota_media, ama: t.amarillas ?? 0,
            valor: x.valor || '', am: (s.amistosos || {}).partidos ?? 0, moral: x.moral || '', datr: deltaAtr(p.iu)};
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
      {k: 'moral', t: 'Moral'}, {k: 'datr', t: 'Δ atrib.', n: 1, h: p => cambio(p.datr)},
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
  const resF = V.partidos.r || null;
  if (resF) ps = ps.filter(p => p.res === resF);
  const of = ps.filter(p => p.oficial);
  const r = k => of.filter(p => p.res === k).length;
  const tabs = IDX.temporadas.map(t => `<button class="tab" data-pt="${t}" aria-selected="${t === temp}">${t}<small>${IDX.partidos.filter(p => p.temporada === t && p.oficial).length} oficiales</small></button>`).join('');
  return `<section><div class="wrap"><h2 data-n="03">Partidos</h2>
    <p class="sub">Todos los partidos con resultado, competición y goleadores con minuto (p = penalti, pp = en propia puerta).</p>
    <div class="tabs">${tabs}</div>
    <div class="filters">${[['W', 'Victorias'], ['D', 'Empates'], ['L', 'Derrotas']].map(([k, t]) => `<button class="chip" data-pr="${k}" aria-pressed="${resF === k}">${t}</button>`).join('')}</div>
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
      {k: 'formacion', t: 'Formación', cls: 'cmp', h: p => esc(p.formacion) + (p.formacion_rival ? `<br><span class="mini">rival: ${esc(p.formacion_rival)}</span>` : '')},
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
  const forms = {};
  for (const p of of) if (p.formacion) { const f = (forms[p.formacion] ||= {f: p.formacion, j: 0, v: 0, pts: 0}); f.j++; f.v += p.res === 'W'; f.pts += {W: 3, D: 1, L: 0}[p.gf > p.gc ? 'W' : p.gf < p.gc ? 'L' : 'D']; }
  const fl = Object.values(forms).sort((a, b) => b.j - a.j);
  const formHtml = fl.length ? `<div class="card" style="margin-top:14px"><h4 style="margin-top:0">Formaciones (calendario exportado)</h4>${fl.map(f => `<div class="tri"><span class="d">${f.j} PJ</span><span>${esc(f.f)}</span><span class="f">${f.v} V · ${(f.pts / f.j).toFixed(2)} pts/PJ</span></div>`).join('')}</div>` : '';
  const tabs = IDX.temporadas.map(t => `<button class="tab" data-tt="${t}" aria-selected="${t === temp}">${t}</button>`).join('');
  return `<section><div class="wrap"><h2 data-n="04">Temporadas</h2>
    <p class="sub">Clasificación final (o la última que FM tenía cargada) y máximos goleadores en partidos oficiales.</p>
    <div class="tabs">${tabs}</div>
    <div class="cols2">
      <div>${cl.length ? tabla('clas' + temp, [
        {k: 'pos', t: '#', n: 1}, {k: 'club', t: 'Equipo'}, {k: 'j', t: 'PJ', n: 1}, {k: 'g', t: 'G', n: 1}, {k: 'e', t: 'E', n: 1},
        {k: 'p', t: 'P', n: 1}, {k: 'gf', t: 'GF', n: 1}, {k: 'gc', t: 'GC', n: 1}, {k: 'pts', t: 'Pts', n: 1}],
        cl.map(c => ({...c, _cls: c.club === IDX.club ? 'propio' : ''})), {k: 'pos', d: 1}) : '<p class="vacio">No hay clasificación guardada de esta temporada (se guarda al abrir la tabla en FM).</p>'}</div>
      <div class="card"><h4 style="margin-top:0">Goleadores</h4><div class="bars">${top.map(t => `<div class="row"><span>${jug(t.iu, t.n)}</span><div class="bg"><div class="fg g" style="width:${100 * t.g / max}%"></div></div><b>${t.g}</b></div>`).join('') || '<p class="vacio">Sin goles.</p>'}</div>${formHtml}</div>
    </div>
  </div></section>`;
};

V.traspasos = () => {
  const porT = {};
  const tempDe = f => { const a = +f.slice(0, 4), m = +f.slice(5, 7), ini = m >= 7 ? a : a - 1; return `${ini}/${String(ini + 1).slice(2)}`; };
  for (const t of IDX.traspasos) (porT[tempDe(t.fecha)] ||= []).push(t);
  const cant = {};
  for (const t of IDX.cantera) (cant[tempDe(t.fecha)] ||= []).push(t);
  const gasto = (l, e) => l.filter(t => !!t.entra === e && !t.cesion).reduce((s, t) => s + (t.precio_eur || 0), 0);
  const bloque = (lista, entra) => lista.filter(t => !!t.entra === entra).map(t =>
    `<div class="tri"><span class="d">${fecha(t.fecha)}</span><span>${jug(t.iu, t.jugador)} <span class="mini">${entra ? 'de' : 'a'} ${esc(t.otro_club || 'agente libre')}${t.origen === 'varela.html' ? ' · de varela.html' : ''}</span></span><span class="f ${entra ? 'out' : 'in'}">${t.cesion ? 'cesión' : t.precio_eur ? eur(t.precio_eur) : 'libre'}</span></div>`).join('') || '<p class="vacio">Ninguno.</p>';
  return `<section><div class="wrap"><h2 data-n="05">Traspasos</h2>
    <p class="sub">Fichajes y salidas por temporada, como en el historial de traspasos de FM (sin cuerpo técnico). Importes como en pantalla. Las promociones de la cantera no son fichajes y van aparte. Los movimientos marcados «de varela.html» ya no están en la memoria de FM y salen de tu varela.html.</p>
    ${[...new Set([...Object.keys(porT), ...Object.keys(cant)])].sort().reverse().map(t => { porT[t] ||= []; return `<h4>${t} <span class="mini">· ${porT[t].filter(x => x.entra).length} llegadas (${eur(gasto(porT[t], true))}) · ${porT[t].filter(x => !x.entra).length} salidas (${eur(gasto(porT[t], false))})</span></h4>
      ${cant[t] ? `<details class="cant"><summary>Promoción de la cantera: ${cant[t].length} jugadores (${fecha(cant[t][0].fecha)})</summary><p>${cant[t].map(x => jug(x.iu, x.jugador)).join(' · ')}</p></details>` : ''}
      <div class="tr2"><div class="card"><h4 style="margin-top:0" class="in">Llegan</h4>${bloque(porT[t], true)}</div><div class="card"><h4 style="margin-top:0" class="out">Salen</h4>${bloque(porT[t], false)}</div></div>`; }).join('')}
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
  const dart = V.historial.dart ?? true, comp = V.historial.comp || 'total';
  // por jugador y temporada: fila «total» (todas las oficiales) o, si FM solo dio la de liga, la de liga
  const porJT = {};
  for (const h of D.historial) {
    if (h.tipo !== 'liga' && h.tipo !== 'total') continue;
    if (dart && h.club !== IDX.club) continue;
    const k = h.iu + '|' + h.temporada + '|' + h.orden;
    (porJT[k] ||= {})[h.tipo] = h;
  }
  const porJ = {};
  for (const r of Object.values(porJT)) {
    const h = comp === 'liga' ? r.liga : (r.total || r.liga);
    if (!h) continue;
    const j = (porJ[h.iu] ||= {iu: h.iu, n: h.jugador, temps: new Set(), pj: 0, tit: 0, min: 0, g: 0, a: 0, mvp: 0, ama: 0, nsum: 0, nj: 0});
    j.temps.add(h.temporada);
    j.pj += h.partidos || 0; j.tit += h.titular || 0; j.min += h.minutos || 0; j.g += h.goles || 0; j.a += h.asistencias || 0; j.mvp += h.mvp || 0; j.ama += h.amarillas || 0;
    if (h.nota_media && h.partidos) { j.nsum += h.nota_media * h.partidos; j.nj += h.partidos; }
  }
  const actuales = new Set(D.plantilla.map(p => p.iu));
  const filas = Object.values(porJ).filter(j => !q || (j.n || '').toLowerCase().includes(q))
    .map(j => ({...j, est: actuales.has(j.iu) ? 'en la plantilla' : 'exjugador', nt: j.temps.size, nota: j.nj ? j.nsum / j.nj : null, gpp: j.pj ? j.g / j.pj : null}));
  const ret = {};
  for (const r of D.retirados) (ret[r.jugador] ||= []).push(r);
  const chip = (attr, k, t, on) => `<button class="chip" data-${attr}="${k}" aria-pressed="${on}">${t}</button>`;
  return `<section><div class="wrap"><h2 data-n="07">Historial</h2>
    <p class="sub">Carrera de los jugadores actuales y de los que pasaron por el club, sacada de la tabla de carrera de FM. Elige si contar solo lo hecho con el ${esc(IDX.club)} o toda su carrera, y si todas las competiciones oficiales o solo la liga. Toca un nombre para ver todas sus temporadas.</p>
    <input class="search" id="buscarH" placeholder="Buscar jugador" value="${esc(V.historial.q || '')}">
    <div class="filters">${chip('hd', 'dart', 'Solo con el ' + esc(IDX.club), dart)}${chip('hd', 'todo', 'Toda la carrera', !dart)}</div>
    <div class="filters">${chip('hc', 'total', 'Partidos oficiales', comp === 'total')}${chip('hc', 'liga', 'Solo liga', comp === 'liga')}</div>
    ${tabla('hist', [{k: 'n', t: 'Jugador', h: j => jug(j.iu, j.n)}, {k: 'est', t: 'Estado'}, {k: 'nt', t: 'Temp.', n: 1},
      {k: 'pj', t: 'PJ', n: 1}, {k: 'tit', t: 'Tit', n: 1}, {k: 'min', t: 'Min', n: 1, h: j => num(j.min)}, {k: 'g', t: 'Goles', n: 1}, {k: 'a', t: 'Asis', n: 1},
      {k: 'gpp', t: 'Gol/PJ', n: 1, h: j => j.gpp === null ? '–' : j.gpp.toFixed(2)}, {k: 'nota', t: 'Nota', n: 1, h: j => j.nota ? j.nota.toFixed(2) : '–'},
      {k: 'mvp', t: 'MVP', n: 1}, {k: 'ama', t: 'Am', n: 1}], filas, {k: 'pj', d: -1})}
    <p class="mini">${comp === 'total' ? 'En las temporadas en que FM solo da la fila de liga (sobre todo las antiguas, copiadas de pantalla), se cuenta la liga.' : ''} Nota media ponderada por partidos.</p>
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
      const v = ultimo[k], d = primero[k] > 1 && v > 1 ? v - primero[k] : 0;
      return `<div class="arow"><span>${NOMBRE_ATR[k] || k}</span><div class="bg"><div class="fg" style="width:${v * 5}%;background:${color(v)}"></div></div><b>${v}${d ? `<span class="delta ${d > 0 ? 'up' : 'dn'}">${d > 0 ? '+' : ''}${d}</span>` : ''}</b></div>`;
    }).join('')}</div>`).join('')}</div>
    <p class="mini">Progreso desde la primera lectura (${hist.length ? fecha(hist[0].fecha.slice(0, 10)) : '–'}), con ${hist.length} cambios registrados entre capturas de memoria y exportaciones.</p>` : '<p class="vacio">Sin atributos guardados (solo de jugadores de la plantilla).</p>';
  const tipos = ['amistosos', 'liga', 'copa', 'continental', 'internacional', 'total'];
  const temporada = Object.keys(s).length ? tabla('jt' + iu, [{k: 'tipo', t: 'Competición'}, {k: 'partidos', t: 'PJ', n: 1}, {k: 'titular', t: 'Tit', n: 1},
    {k: 'minutos', t: 'Min', n: 1}, {k: 'goles', t: 'Gol', n: 1}, {k: 'asistencias', t: 'Asis', n: 1}, {k: 'amarillas', t: 'Am', n: 1}, {k: 'rojas', t: 'Roj', n: 1},
    {k: 'nota_media', t: 'Nota', n: 1, h: r => r.nota_media ? r.nota_media.toFixed(2) : '–'}, {k: 'xg', t: 'xG', n: 1, h: r => J(r.detalle).xg ?? '–'}],
    tipos.filter(t => s[t]).map(t => s[t])) : '<p class="vacio">Sin estadísticas de esta temporada.</p>';
  const vistas = {}, filasC = [];
  const soloDart = !!V.jugador.dart;
  for (const h of IDX.historial[iu] || []) {
    if (soloDart && h.club !== IDX.club) continue;
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
    ${hist.length > 1 || (IDX.evol[iu] || []).length > 1 ? `<div class="cols2"><div class="card"><h4 style="margin-top:0">Suma de atributos en el tiempo</h4>${mini(hist.filter(h => Object.values(h.v).filter(x => x > 1).length >= 20).map(h => sumaAtr(h.v)))}<p class="mini">${hist.length} capturas con cambios.</p></div>
      <div class="card"><h4 style="margin-top:0">Nota media en las exportaciones</h4>${mini((IDX.evol[iu] || []).filter(e => e.nota_media).map(e => e.nota_media), v => Number(v).toFixed(2))}<p class="mini">Nota media de la temporada en cada exportación de plantilla (vuelve a empezar cada temporada).</p></div></div>` : ''}
    <h4>Temporada ${esc(IDX.temporadaActual)}</h4>${temporada}
    <h4>Partido a partido</h4>${partidosJ}
    <h4>Carrera</h4>
    <div class="filters"><button class="chip" data-jc="1" aria-pressed="${soloDart}">Solo con el ${esc(IDX.club)}</button></div>
    ${filasC.length ? `<p class="meta">${(() => { const t = filasC.reduce((a, r) => { const h = r.total || r.liga; if (h) { a.pj += h.partidos || 0; a.g += h.goles || 0; a.as += h.asistencias || 0; a.min += h.minutos || 0; } return a; }, {pj: 0, g: 0, as: 0, min: 0}); return `<span><b>${filasC.length}</b> etapas</span><span><b>${num(t.pj)}</b> PJ</span><span><b>${num(t.g)}</b> goles</span><span><b>${num(t.as)}</b> asistencias</span><span><b>${num(t.min)}</b> min</span><span>${soloDart ? 'con el ' + esc(IDX.club) : 'en toda su carrera'} (oficiales, o liga si FM no da más)</span>`; })()}</p>` : ''}
    ${tablaC}
  </div></section>`;
};

V.progreso = () => {
  const filas = [];
  for (const p of D.plantilla) {
    const h = IDX.atr[p.iu];
    if (!h || h.length < 2) continue;
    const difs = difsAtr(h[0].v, h[h.length - 1].v);
    if (difs.length < 20) continue;
    const mejor = [...difs].sort((x, y) => y.d - x.d)[0], peor = [...difs].sort((x, y) => x.d - y.d)[0];
    filas.push({iu: p.iu, nombre: p.nombre, edad: edad(p.fecha_nacimiento), d: difs.reduce((s, x) => s + x.d, 0), caps: h.length, desde: h[0].fecha,
                mejor: mejor.d > 0 ? `${NOMBRE_ATR[mejor.k] || mejor.k} +${mejor.d}` : '–', peor: peor.d < 0 ? `${NOMBRE_ATR[peor.k] || peor.k} ${peor.d}` : '–'});
  }
  const cols = [{k: 'nombre', t: 'Jugador', h: r => jug(r.iu, r.nombre)}, {k: 'edad', t: 'Edad', n: 1}, {k: 'd', t: 'Δ atributos', n: 1, h: r => cambio(r.d)},
    {k: 'mejor', t: 'Mayor mejora'}, {k: 'peor', t: 'Mayor bajada'}, {k: 'caps', t: 'Cambios', n: 1}, {k: 'desde', t: 'Desde', h: r => fecha(r.desde.slice(0, 10))}];
  const sube = [...filas].sort((a, b) => b.d - a.d).slice(0, 10), baja = [...filas].sort((a, b) => a.d - b.d).slice(0, 10);
  return `<section><div class="wrap"><h2 data-n="08">Progreso</h2>
    <p class="sub">Cambio de atributos de cada jugador de la plantilla entre su primera y su última captura guardada (memoria y exportaciones). Cuantas más capturas, más fino.</p>
    <div class="cols2"><div><h4>Los que más han subido</h4>${tabla('psube', cols, sube, {k: 'd', d: -1})}</div><div><h4>Los que más han bajado</h4>${tabla('pbaja', cols, baja, {k: 'd', d: 1})}</div></div>
    <h4>Toda la plantilla</h4>${tabla('ptodos', cols, filas, {k: 'd', d: -1})}
  </div></section>`;
};

V.curiosidades = () => vistaCuriosidades();

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
  else if (ds.nm) V.inicio.moral = !V.inicio.moral;
  else if (ds.pt) { V.partidos.t = ds.pt; V.partidos.c = null; }
  else if (ds.pa) V.partidos.amis = !V.partidos.amis;
  else if (ds.pr) V.partidos.r = V.partidos.r === ds.pr ? null : ds.pr;
  else if (ds.hd) V.historial.dart = ds.hd === 'dart';
  else if (ds.hc) V.historial.comp = ds.hc;
  else if (ds.jc) V.jugador.dart = !V.jugador.dart;
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
