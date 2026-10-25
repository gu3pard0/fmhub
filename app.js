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

// preferencias de este navegador (pueden no estar disponibles: modo privado, almacenamiento bloqueado)
const leer = (k, def = null) => { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } };
const apuntar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

// ---------------------------------------------------------------- partidas
// Varias partidas (distintos archivos de guardado): si FM Hub publica partidas.json (o la web local responde
// api/partidas) con [{id, nombre, datos}], se elige cuál ver. Sin esa lista, una sola partida: datos.json.
const PARTIDA = {lista: [], id: null};
const clavePartida = k => PARTIDA.id ? `${k}:${PARTIDA.id}` : k;
async function cargarPartidas() {
  if (window.FMHUB_DATOS) return;
  try {
    const r = await fetch(window.FMHUB_PUBLICADO ? 'partidas.json?t=' + Date.now() : 'api/partidas', {cache: 'no-store'});
    if (r.ok) { const l = await r.json(); PARTIDA.lista = Array.isArray(l) ? l.filter(p => p && p.id) : []; }
  } catch (e) {}
  const pedida = new URLSearchParams(location.search).get('partida') || leer('fmhub-partida');
  PARTIDA.id = PARTIDA.lista.some(p => p.id === pedida) ? pedida : (PARTIDA.lista[0]?.id ?? null);
}

// ---------------------------------------------------------------- carga
async function cargar() {
  if (window.FMHUB_DATOS) return window.FMHUB_DATOS;
  // Publicada en internet: los datos van en datos.json (FM Hub los sube cuando cambian; ?t= salta la caché de GitHub Pages)
  const p = PARTIDA.lista.find(x => x.id === PARTIDA.id);
  const url = window.FMHUB_PUBLICADO ? (p?.datos || 'datos.json') + '?t=' + Date.now() : 'api/datos' + (p ? '?partida=' + encodeURIComponent(p.id) : '');
  const r = await fetch(url, {cache: 'no-store'});
  if (!r.ok) throw new Error('No se pudieron leer los datos (' + r.status + ')');
  return r.json();
}

// «24/8/1988 (35 años)» o «30/6/2029» -> «1988-08-24»; lo que ya viene como fecha ISO se deja igual
const isoDe = s => { if (!s) return null; const m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : String(s).slice(0, 10); };

// Si la última lectura trajo la plantilla vacía (pasa cuando FM está cargando o renovando contratos), se usa la
// última ficha guardada de cada jugador de esta temporada, sin los que se han ido de verdad
function plantillaDeRespaldo(temporada) {
  const ultimo = {};
  for (const t of D.traspasos) if (t.iu && (!ultimo[t.iu] || t.fecha >= ultimo[t.iu].fecha)) ultimo[t.iu] = t;
  const vistos = new Set(), out = [];
  for (const f of [...(D.plantillas || [])].reverse()) {
    if (f.temporada !== temporada || vistos.has(f.iu)) continue;
    vistos.add(f.iu);
    const u = ultimo[f.iu];
    if (u && !u.entra && !u.cesion && u.tipo !== 'cantera') continue;
    out.push({iu: f.iu, nombre: f.nombre, posicion: f.pos || '', fecha_nacimiento: isoDe(f.nacimiento), altura_cm: f.altura, peso_kg: f.peso,
              sueldo_mes_eur: f.sueldo, fin_contrato: isoDe(f.contrato), atributos: f.atributos, cedido_a: f.cedido_a, respaldo: true});
  }
  return out.reverse();
}
// lo mismo con las estadísticas de la temporada: la última captura de cada jugador y competición
function estadisticasDeRespaldo(temporada) {
  const ult = {};
  for (const r of D.por_temporada || []) {
    if (r.temporada !== temporada) continue;
    const k = r.iu + '|' + r.tipo;
    if (!ult[k] || r.captura_id > ult[k].captura_id) ult[k] = r;
  }
  return Object.values(ult);
}

function preparar() {
  const club = D.club.nombre;
  IDX.club = club;
  const caps = D.capturas.filter(c => c.origen === 'memoria' && c.fecha_juego);
  IDX.fechaJuego = caps.length ? caps[caps.length - 1].fecha_juego : null;
  // un «traspaso» al propio club no lo es: sale cuando una lectura no ve a alguien que sigue en la plantilla
  // (o al renovar o subir de categoría a alguien); tampoco cuentan los que no tienen jugador
  const antes = D.traspasos.length;
  D.traspasos = D.traspasos.filter(t => (t.jugador || t.iu) && t.otro_club !== club);
  IDX.falsos = antes - D.traspasos.length;
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
    return {...p, casa, rival: casa ? p.visitante : p.local, gf, gc, res, pen, formacion: det.formacion || '', formacion_rival: det.formacion_rival || '', ronda: det.ronda || '',
            hora: det.hora || '', oficial: p.competicion !== 'Amistoso', clave: p.fecha + '|' + p.local + '|' + p.visitante};
  });
  // traspasos de verdad y promociones de la cantera (FM las apunta como altas sin club de origen)
  // un traspaso no puede ser posterior a la fecha del juego (último partido + 120 días): si lo es, está mal leído
  const ultimoPartido = D.partidos.length ? D.partidos[D.partidos.length - 1].fecha : null;
  const limite = ultimoPartido ? new Date(new Date(ultimoPartido).getTime() + 120 * 864e5).toISOString().slice(0, 10) : '9999';
  D.traspasos = D.traspasos.filter(t => t.fecha <= limite);
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
  IDX.temporadaActual = caps.length ? caps[caps.length - 1].temporada : IDX.temporadas[IDX.temporadas.length - 1];
  IDX.respaldo = [];
  if (!D.plantilla.length && (D.plantillas || []).length) { D.plantilla = plantillaDeRespaldo(IDX.temporadaActual); if (D.plantilla.length) IDX.respaldo.push('la plantilla'); }
  if (!D.estadisticas.length && (D.por_temporada || []).length) { D.estadisticas = estadisticasDeRespaldo(IDX.temporadaActual); if (D.estadisticas.length) IDX.respaldo.push('las estadísticas'); }
  // alineaciones del calendario exportado (si se exportó con la columna de jugadores)
  IDX.alin = {};
  for (const a of D.alineaciones || []) (IDX.alin[a.fecha] ||= []).push(a);
  // el informe de cada partido capturado de FM (tools/capturar_partidos.py): quién jugó, dónde, minutos, nota…
  IDX.informe = {};
  for (const r of D.partido_informe || []) (IDX.informe[r.fecha] ||= []).push(r);
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
  for (const p of D.plantilla) if (p.posicion) IDX.export[p.iu] = {...(IDX.export[p.iu] || {}), posicion: p.posicion};
  IDX.evol = {};
  for (const e of D.evolucion || []) (IDX.evol[e.iu] ||= []).push(e);
}

// Aviso cuando se enseña la plantilla o las estadísticas guardadas porque la última lectura vino vacía
const avisoRespaldo = () => IDX.respaldo.length ? `<div class="wrap"><p class="aviso">La última lectura del juego no trajo ${IDX.respaldo.join(' ni ')} de la temporada: se enseña lo último guardado de ${esc(IDX.temporadaActual)}. Se corrige sola en cuanto FM Hub vuelva a leer el juego con la partida cargada.</p></div>` : '';

// Versión de los datos: v<temporada de la partida>.<jornada de liga>.<lectura desde esa jornada>
// (la 6.ª temporada, tras la jornada 15 y con 3 lecturas desde ese partido: v6.15.3)
function versiones() {
  const ss = HIST.S(), out = {};
  const nT = t => ss.findIndex(s => s.t === t) + 1;
  for (const c of D.capturas) {
    if (c.origen !== 'memoria' || !c.fecha_juego || !c.temporada) continue;
    const s = ss.find(x => x.t === c.temporada);
    const j = s ? s.lgPs.filter(p => p.fecha <= c.fecha_juego).length : 0;
    const k = `v${nT(c.temporada) || '?'}.${j}`;
    const v = (out[k] ||= {k, temporada: c.temporada, j, n: 0, fj: c.fecha_juego, desde: c.fecha_real, hasta: c.fecha_real});
    v.n++; if (c.fecha_real > v.hasta) v.hasta = c.fecha_real; if (c.fecha_real < v.desde) v.desde = c.fecha_real; if (c.fecha_juego > v.fj) v.fj = c.fecha_juego;
  }
  return Object.values(out).sort((a, b) => b.hasta.localeCompare(a.hasta));
}
const versionActual = () => { const v = versiones()[0]; return v ? `${v.k}.${v.n}` : ''; };
const haceCuanto = f => { const m = (Date.now() - new Date(f)) / 60000; return !isFinite(m) ? '' : m < 2 ? 'ahora mismo' : m < 60 ? `hace ${Math.round(m)} min` : m < 48 * 60 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} días`; };

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
// el orden elegido en cada tabla se recuerda en este navegador
tabla.estado = leer('fmhub-orden', {}) || {};
document.addEventListener('click', ev => {
  const th = ev.target.closest('th[data-t]');
  if (!th) return;
  const st = tabla.estado[th.dataset.t];
  st.d = st.k === th.dataset.k ? -st.d : -1;
  st.k = th.dataset.k;
  apuntar('fmhub-orden', tabla.estado);
  pintar();
});

// ---------------------------------------------------------------- cabecera
function cabecera() {
  const of = IDX.partidos.filter(p => p.oficial);
  const v = of.filter(p => p.res === 'W').length, e = of.filter(p => p.res === 'D').length, d = of.filter(p => p.res === 'L').length;
  const lect = D.fuentes?.ultima_lectura, hace = lect ? (Date.now() - new Date(lect)) / 60000 : Infinity;
  const viva = !window.FMHUB_ESTATICO && !window.FMHUB_PUBLICADO && hace < 5;
  const ver = D.version || versionActual();   // la de FM Hub (la misma que en su registro) si viene en los datos
  const selPartida = PARTIDA.lista.length > 1 ? ` · <select id="partida" class="sel-partida" aria-label="Partida">${PARTIDA.lista.map(p => `<option value="${esc(p.id)}" ${p.id === PARTIDA.id ? 'selected' : ''}>${esc(p.nombre || p.id)}</option>`).join('')}</select>` : '';
  $('#eyebrow').innerHTML = `<i class="dot ${viva ? 'on' : ''}" title="${viva ? 'FM Hub está leyendo el juego' : 'Sin lecturas recientes del juego'}"></i>FM Hub${ver ? ` <span class="ver" title="temporada de la partida · jornada de liga · lectura desde esa jornada">${esc(ver)}</span>` : ''} · ${esc(IDX.temporadaActual || '')}${IDX.fechaJuego ? ' · ' + esc(fecha(IDX.fechaJuego)) : ''}${selPartida}`;
  burbujaVersion(ver);
  $('#titulo').innerHTML = `${esc(IDX.club)} <em>de Varela</em>`;
  $('#lead').textContent = `${HIST.entradilla()} ${window.FMHUB_ESTATICO ? 'Copia autocontenida generada el ' + fecha(D.generado.slice(0, 10)) + '.' : 'Actualizado: ' + D.generado.replace('T', ' ').slice(0, 16) + ' (' + haceCuanto(D.generado) + ').'}`;
  const gf = of.reduce((s, p) => s + p.gf, 0), gc = of.reduce((s, p) => s + p.gc, 0);
  $('#bigs').innerHTML = HIST.bigsPalmares(of);
  $('#ladder').innerHTML = HIST.escalera();
  $('#pie').innerHTML = HIST.notas() + `<p class="mini">FM Hub ${esc(ver)} · solo lectura: no modifica el juego ni la partida · ${esc(D.generado.replace('T', ' ').slice(0, 16))}</p>`;
  if (!cabecera.hecha) { cabecera.hecha = true; contar(); }
}

// Burbuja fija con la versión de los datos y cuándo fue la última lectura del juego (encima de «Reportar un error»).
// Al tocarla lleva a la tarjeta Estado de FM Hub (versiones y registro)
function burbujaVersion(ver) {
  let b = document.getElementById('ver-burbuja');
  if (!b) {
    b = document.createElement('button');
    b.id = 'ver-burbuja'; b.type = 'button'; b.className = 'ver-burbuja';
    b.addEventListener('click', ev => {
      ev.stopPropagation();
      const ir = () => document.getElementById('estado')?.scrollIntoView({behavior: 'smooth', block: 'start'});
      if ((location.hash.slice(1) || 'inicio') === 'inicio') ir(); else { location.hash = 'inicio'; setTimeout(ir, 150); }
    });
    document.body.appendChild(b);
  }
  const lect = D.fuentes?.ultima_lectura;
  b.innerHTML = `<span class="mono">${esc(ver || 'sin versión')}</span>${lect ? `<small>${esc(haceCuanto(lect))}</small>` : ''}`;
  b.title = `Versión de los datos: temporada de la partida · jornada de liga · lectura desde esa jornada.${lect ? ' Última lectura del juego: ' + cuando(lect) + '.' : ''} Toca para ver el estado de FM Hub.`;
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
  const proxHtml = prox ? `<p class="prox">Próximo: ${prox.en_casa === 0 ? 'fuera ante el' : 'en casa ante el'} <b>${esc(prox.rival)}</b> · ${fecha(prox.fecha)}${prox.hora ? ' ' + esc(prox.hora) : ''} · ${esc(prox.competicion || '')}${prox.estadio ? ' · ' + esc(prox.estadio) : ''}</p>`
    : '<p class="prox mini">Próximo partido: aparece en cuanto FM Hub lea el calendario del juego (con FM abierto y la partida cargada).</p>';
  const qr = (window.FMHUB_ESTATICO || window.FMHUB_PUBLICADO) ? '' : `
    <div class="card"><h4 style="margin-top:0">Abrir en el móvil</h4>
      <div class="qr"><img src="qr.svg" alt="Código QR de la web"><div>
        <p class="mini">Escanéalo con la cámara del móvil (misma wifi). Dirección: <b class="mono" id="url">…</b></p>
        <p class="mini">Puedes instalarla como app desde el menú del navegador («Añadir a pantalla de inicio»).</p>
        <div class="fila-btn"><a class="btn" href="api/exportar-html">Descargar HTML autocontenido</a></div>
        <p class="mini">El HTML lleva todos los datos dentro: se puede abrir sin FM Hub o subir a cualquier hosting.</p>
      </div></div></div>`;
  return `<section><div class="wrap">
    <h2 data-n="00">Hoy</h2><p class="sub">Forma de los últimos partidos oficiales, novedades de las últimas lecturas y estado de FM Hub.</p>
    <div class="form">${forma}</div>
    <div class="legend"><span><b style="background:var(--w)"></b>Victoria</span><span><b style="background:var(--d)"></b>Empate</span><span><b style="background:var(--l)"></b>Derrota</span></div>
    <div class="kpis">${k.map(([v, t]) => `<div class="card kpi"><b>${v}</b><span>${t}</span></div>`).join('')}</div>
    <div class="cols2" style="margin-top:18px">
      <div class="card"><h4 style="margin-top:0">Novedades</h4>
        <div class="filters"><button class="chip" data-nm="1" aria-pressed="${!!V.inicio.moral}">Cambios de moral</button></div>
        ${nov.length ? `<ul class="feed">${nov.slice(0, V.inicio.todas ? nov.length : 24).map(n => `<li><time>${esc(n.cuando)}</time><span class="tag ${n.cls}">${n.tag}</span><span>${n.t}</span></li>`).join('')}</ul>${nov.length > 24 ? `<div class="fila-btn"><button class="chip" data-ntodas="1">${V.inicio.todas ? 'Ver solo las 24 últimas' : `Ver las ${nov.length}`}</button></div>` : ''}` : '<p class="vacio">Sin cambios recientes.</p>'}</div>
      <div class="card"><h4 style="margin-top:0">Últimos partidos</h4>${proxHtml}${ult.map(p => `<div class="tri"><span class="d">${fecha(p.fecha)}</span><span><span class="ha">${p.casa ? 'C' : 'F'}</span>${esc(p.rival)} <span class="mini">${esc(p.competicion || '')}</span></span>${pillRes(p)}</div>`).join('')}
        <h4>Últimos traspasos</h4>${tras.map(t => `<div class="tri"><span class="d">${fecha(t.fecha)}</span><span class="${t.entra ? 'in' : 'out'}">${t.entra ? '↘' : '↗'} ${jug(t.iu, t.jugador)} <span class="mini">${esc(t.otro_club || 'libre')}</span></span><span class="f">${t.cesion ? 'cesión' : eur(t.precio_eur)}</span></div>`).join('')}</div>
    </div>
    <div class="cols2" style="margin-top:14px">${qr}${HIST.exportacion()}${estadoHtml()}</div>
  </div></section>`;
};

// Estado de FM Hub: lo último arriba. Versiones (temporada.jornada) con sus lecturas y el registro del programa
// lo que le falta por capturar a FM Hub y qué abrir en FM (lo mismo que la pastilla «en directo» de la web local)
const capturaHistorial = iu => (D.pendientes || []).find(p => p.iu === iu);
function porCapturarHtml() {
  const ps = D.pendientes || [];
  if (!ps.length) return '';
  return `<h4>Por capturar (${ps.length})</h4><ul class="por-cap">${ps.map(p => `<li><b>${p.iu ? 'Historial de ' + jug(p.iu) : esc(p.titulo)}</b>
    <small>${esc(p.detalle)}</small>${p.como ? `<small class="como">Cómo: ${esc(p.como)}</small>` : ''}</li>`).join('')}</ul>`;
}
function estadoHtml() {
  const vs = versiones();
  // dos líneas por versión: la versión y la jornada arriba, las lecturas y la hora debajo (en una columna estrecha no caben en una)
  const lista = vs.slice(0, V.inicio.versiones ? vs.length : 6).map((v, i) => `<div class="ver-f${i === 0 ? ' act' : ''}"><b class="mono">${esc(v.k)}.${v.n}</b>
    <span>${v.j ? `Tras la jornada ${v.j}` : 'Pretemporada'} de ${esc(v.temporada)} · ${fecha(v.fj)}${i === 0 ? ' <span class="pill">actual</span>' : ''}</span>
    <small>${v.n} ${v.n === 1 ? 'lectura' : 'lecturas'} · la última el ${esc(cuando(v.hasta))}</small></div>`).join('');
  // el registro llega en orden de escritura (lo más antiguo primero): se le da la vuelta
  const reg = D.registro?.length ? `<h4>Registro</h4><pre class="registro">${esc([...D.registro].reverse().join('\n'))}</pre>` : '';
  return `<div class="card" id="estado"><h4 style="margin-top:0">Estado de FM Hub</h4>${fuentesHtml()}${porCapturarHtml()}
    ${vs.length ? `<h4>Versiones de los datos</h4><p class="mini">Formato <b>vT.J.L</b>: T, temporada de la partida; J, jornada de liga; L, lectura desde esa jornada. La más reciente arriba.</p>${lista}${vs.length > 6 ? `<div class="fila-btn"><button class="chip" data-nver="1">${V.inicio.versiones ? 'Ver menos' : `Ver las ${vs.length}`}</button></div>` : ''}` : ''}
    ${reg}</div>`;
}

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
    t: t.origen === 'plantilla' ? `${jug(t.iu, t.jugador)} ${t.entra ? 'llega a la plantilla' : t.otro_club ? 'se va al ' + esc(t.otro_club) + (t.cesion ? ' (cesión)' : t.precio_eur ? ' por ' + eur(t.precio_eur) : '') : 'deja la plantilla'}` :`${jug(t.iu, t.jugador)} ${t.entra ? 'llega del' : 'se va al'} ${esc(t.otro_club || 'mercado libre')}${t.cesion ? ' (cesión)' : t.precio_eur ? ' por ' + eur(t.precio_eur) : ''}`});
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
  return `<section><div class="wrap"><h2 data-n="03">Plantilla actual</h2>
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
  return `<section><div class="wrap"><h2 data-n="05">Partidos</h2>
    <p class="sub">Todos los partidos con resultado, competición y goleadores con minuto (p = penalti, pp = en propia puerta).</p>
    <div class="tabs">${tabs}</div>
    <div class="filters">${[['W', 'Victorias'], ['D', 'Empates'], ['L', 'Derrotas']].map(([k, t]) => `<button class="chip" data-pr="${k}" aria-pressed="${resF === k}">${t}</button>`).join('')}</div>
    <div class="filters"><button class="chip" data-pa="1" aria-pressed="${amis}">Con amistosos</button>
      ${comps.map(c => `<button class="chip" data-pc="${esc(c)}" aria-pressed="${comp === c}">${esc(c)}</button>`).join('')}</div>
    <p class="meta"><span><b>${of.length}</b> oficiales</span><span><b>${r('W')}</b> V</span><span><b>${r('D')}</b> E</span><span><b>${r('L')}</b> D</span>
      <span><b>${of.reduce((s, p) => s + p.gf, 0)}</b>–<b>${of.reduce((s, p) => s + p.gc, 0)}</b> goles</span></p>
    ${tabla('partidos', [
      {k: 'fecha', t: 'Fecha', h: p => fecha(p.fecha)}, {k: 'competicion', t: 'Competición', cls: 'cmp'},
      {k: 'rival', t: 'Rival', h: p => `<span class="ha">${p.casa ? 'C' : 'F'}</span><a class="j" href="#rivales/${encodeURIComponent(p.rival)}">${esc(p.rival)}</a>`},
      {k: 'res', t: 'Res.', h: p => pillRes(p) + esc(p.pen)},
      {k: 'espectadores', t: 'Público', n: 1, h: p => num(p.espectadores)},
      {k: 'gol', t: 'Goleadores', cls: 'sc', h: golesTexto},
      {k: 'formacion', t: 'Formación', cls: 'cmp', h: p => esc(p.formacion || IDX.informe[p.fecha]?.[0]?.formacion || '') + (p.formacion_rival ? `<br><span class="mini">rival: ${esc(p.formacion_rival)}</span>` : '')},
      ...(D.partido_informe?.length ? [{k: 'once', t: 'Once', h: p => IDX.informe[p.fecha] ? `<button class="chip" data-once="${p.fecha}">Ver once</button>` : '<span class="mini">—</span>'}] : []),
      ...(D.alineaciones?.length ? [{k: 'alin', t: 'Alineación', cls: 'sc', h: p => (IDX.alin[p.fecha] || []).map(a => jug(a.iu, a.jugador)).join(', ') || '—'}] : []),
    ], ps.map(p => ({...p, _cls: 'r' + p.res})), {k: 'fecha', d: 1})}
  </div></section>`;
};

V.traspasos = () => {
  const porT = {};
  const tempDe = f => { const a = +f.slice(0, 4), m = +f.slice(5, 7), ini = m >= 7 ? a : a - 1; return `${ini}/${String(ini + 1).slice(2)}`; };
  for (const t of IDX.traspasos) (porT[tempDe(t.fecha)] ||= []).push(t);
  const cant = {};
  for (const t of IDX.cantera) (cant[tempDe(t.fecha)] ||= []).push(t);
  const temps = [...new Set([...Object.keys(porT), ...Object.keys(cant)])].sort();
  const sel = V.traspasos.t && temps.includes(V.traspasos.t) ? V.traspasos.t : temps[temps.length - 1];
  const lista = porT[sel] || [];
  const gasto = e => lista.filter(t => !!t.entra === e && !t.cesion).reduce((s, t) => s + (t.precio_eur || 0), 0);
  const pl = (n, uno, varios = uno + 's') => `${n} ${n === 1 ? uno : varios}`;
  // los que FM Hub detecta porque aparecen o desaparecen de la plantilla: la fecha es la de la lectura en que se
  // notó; se da la horquilla desde la lectura anterior (entre esas dos fechas de juego se cerró), salvo que FM Hub
  // haya leído la fecha exacta en FM (fecha_fuente = 'contrato': inicio de su contrato con el club nuevo)
  const fechasJuego = [...new Set(D.capturas.map(c => c.fecha_juego).filter(Boolean))].sort();
  const desdeLectura = f => fechasJuego.filter(x => x < f).pop();
  const fila = t => t.origen === 'plantilla'
    ? `<div class="tri"><span class="d">${t.fecha_fuente ? '' : '≈ '}${fecha(t.fecha)}</span><span><b>${jug(t.iu, t.jugador)}</b> <span style="color:var(--mut)">${t.otro_club ? esc(t.otro_club) + (t.cesion ? ' (cesión)' : '') : t.entra ? 'llega a la plantilla' : 'deja la plantilla (buscando su nuevo club)'}</span>${!t.fecha_fuente && desdeLectura(t.fecha) ? `<br><span class="mini">entre el ${fecha(desdeLectura(t.fecha))} y el ${fecha(t.fecha)}</span>` : ''}</span><span class="f">${t.cesion ? 'cesión' : t.precio_eur ? eur(t.precio_eur) : 'sin precio'}</span></div>`
    : `<div class="tri"><span class="d">${fecha(t.fecha)}</span><span><b>${jug(t.iu, t.jugador)}</b> <span style="color:var(--mut)">${esc(t.otro_club || 'agente libre')}${t.origen === 'varela.html' ? ' · de varela.html' : ''}</span></span><span class="f">${t.cesion ? 'cesión' : t.precio_eur ? eur(t.precio_eur) : 'libre'}</span></div>`;
  const col = (titulo, cls, arr) => `<div class="card"><h4 style="margin-top:0" class="${cls}">${titulo} · ${arr.length}</h4>${arr.map(fila).join('') || '<p class="vacio">Ninguno.</p>'}</div>`;
  const entra = lista.filter(t => t.entra), sale = lista.filter(t => !t.entra);
  const resumen = `${gasto(true) ? 'Entradas ' + eur(gasto(true)) : 'Entradas a coste cero'} · ${gasto(false) ? 'salidas ' + eur(gasto(false)) : 'salidas sin ingresos'} · ${pl(entra.filter(t => !t.cesion).length, 'fichaje')}, ${pl(sale.filter(t => !t.cesion).length, 'baja')} y ${pl(sale.filter(t => t.cesion).length, 'cesión', 'cesiones')}`;
  return `<section><div class="wrap"><h2 data-n="09">Fichajes y salidas</h2>
    <p class="sub">Historial de traspasos por temporada, como en FM (sin cuerpo técnico). Importes en euros como en pantalla («75 mil €» son 75.000 €). Las promociones de la cantera no son fichajes y van aparte. Los marcados «de varela.html» ya no están en la memoria de FM.</p>
    <div class="tabs">${temps.map(t => `<button class="tab" data-trt="${t}" aria-selected="${t === sel}">${t}<small>${(k => k === 1 ? '1 fichaje' : k + ' fichajes')((porT[t] || []).filter(x => x.entra && !x.cesion).length)}</small></button>`).join('')}</div>
    <div class="tr2"><div class="card" style="grid-column:1/-1"><b>${esc(resumen)}</b></div>${col('Llegadas', 'in', entra)}${col('Salidas', 'out', sale)}</div>
    ${IDX.falsos ? `<p class="mini">Se ignoran ${IDX.falsos} ${IDX.falsos === 1 ? 'movimiento' : 'movimientos'} que no son fichajes: «salidas» al propio ${esc(IDX.club)} (jugadores que siguen aquí y que una lectura no vio, o renovaciones) y altas sin jugador.</p>` : ''}
    ${cant[sel] ? `<details class="cant" style="margin-top:12px"><summary>Promoción de la cantera: ${cant[sel].length} juveniles suben al primer equipo (${fecha(cant[sel][0].fecha)})</summary><p>${cant[sel].map(x => jug(x.iu, x.jugador)).join(' · ')}</p></details>` : ''}
    ${HIST.rentabilidad()}
  </div></section>`;
};

V.finanzas = () => {
  const f = D.finanzas;
  if (!f.length) return `<section><div class="wrap"><h2 data-n="10">Economía</h2><p class="vacio">Sin datos de finanzas.</p></div></section>`;
  const W = 900, H = 220, P = 30;
  const sal = f.map(x => x.saldo_eur), mn = Math.min(0, ...sal), mx = Math.max(...sal);
  const X = i => P + i * (W - 2 * P) / Math.max(1, f.length - 1), Y = v => H - P - (v - mn) * (H - 2 * P) / Math.max(1, mx - mn);
  const linea = f.map((x, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(x.saldo_eur).toFixed(1)}`).join('');
  const porT = {};
  for (const x of f) { const t = (porT[x.temporada] ||= {i: 0, g: 0, s: 0, n: 0}); t.i += x.ingresos_totales_eur; t.g += x.gastos_totales_eur; t.s += x.gasto_sueldos_eur; t.n++; }
  const ult = f[f.length - 1];
  return `<section><div class="wrap"><h2 data-n="10">Economía</h2>
    <p class="sub">Ingresos y gastos de la última temporada completa por partidas, y debajo los ${f.length} meses leídos de FM (moneda interna × 1,16618; junio de 2028 cuadra al euro con la exportación de economía). El mes en curso todavía cambia.</p>
    ${HIST.economia()}
    <h4>Ahora mismo</h4>
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
  const can = HIST.cantera(), act = HIST.enPlantilla();
  const soloAct = !!V.historial.act, sinCan = !!V.historial.nc;
  const filas = Object.values(porJ).filter(j => (!q || (j.n || '').toLowerCase().includes(q)) && (!soloAct || act.has(j.iu)) && (!sinCan || !can.has(j.iu)))
    .map(j => ({...j, est: (actuales.has(j.iu) ? 'en la plantilla' : 'exjugador') + (can.has(j.iu) ? ' · cantera' : ''), nt: j.temps.size, nota: j.nj ? j.nsum / j.nj : null, gpp: j.pj ? j.g / j.pj : null}));
  const ret = {};
  for (const r of D.retirados) (ret[r.jugador] ||= []).push(r);
  const chip = (attr, k, t, on) => `<button class="chip" data-${attr}="${k}" aria-pressed="${on}">${t}</button>`;
  return `<section><div class="wrap"><h2 data-n="04">Todos los jugadores</h2>
    <p class="sub">Carrera de los jugadores actuales y de los que pasaron por el club, sacada de la tabla de carrera de FM. Elige si contar solo lo hecho con el ${esc(IDX.club)} o toda su carrera, y si todas las competiciones oficiales o solo la liga. Toca un nombre para ver todas sus temporadas.</p>
    <input class="search" id="buscarH" placeholder="Buscar jugador" value="${esc(V.historial.q || '')}">
    <div class="filters">${chip('hd', 'dart', 'Solo con el ' + esc(IDX.club), dart)}${chip('hd', 'todo', 'Toda la carrera', !dart)}</div>
    <div class="filters">${chip('hc', 'total', 'Partidos oficiales', comp === 'total')}${chip('hc', 'liga', 'Solo liga', comp === 'liga')}</div>
    <div class="filters"><button class="chip" data-hact="1" aria-pressed="${soloAct}">Solo plantilla actual</button><button class="chip" data-hnc="1" aria-pressed="${sinCan}">Sin canteranos</button><span class="mini" style="align-self:center">${filas.length} jugadores</span></div>
    ${tabla('hist', [{k: 'n', t: 'Jugador', h: j => jug(j.iu, j.n) + (can.has(j.iu) ? ' <span class="ha">CANTERA</span>' : '') + (act.has(j.iu) ? ' <span class="ha" style="color:var(--w)">ACTUAL</span>' : '')}, {k: 'est', t: 'Estado'}, {k: 'nt', t: 'Temp.', n: 1, h: j => `<b style="margin-right:6px">${j.nt}</b>${[...j.temps].sort().map(t => `<span class="pill" style="margin-right:3px">${t.slice(2)}</span>`).join('')}`},
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
    filasC, {k: 'temporada', d: -1}) : (IDX.historial[iu] || []).length ? '<p class="vacio">Sin etapas con ese filtro.</p>'
      : IDX.enPlantilla.has(iu) ? `<p class="aviso-cap"><b>Falta su historial de carrera.</b> ${esc(capturaHistorial(iu)?.como || `Con FM Hub abierto, en FM: ficha de ${nombre} → Vista general → Historial de jugador.`)}</p>`
      : '<p class="vacio">Sin historial de carrera guardado (FM Hub solo puede copiarlo mientras el jugador está en tu plantilla).</p>';
  const pj = (IDX.pj[iu] || []).filter(r => !r.varios);
  const partidosJ = pj.length ? tabla('jp' + iu, [{k: 'fecha', t: 'Fecha', h: r => fecha(r.fecha)}, {k: 'rival', t: 'Partido', h: r => esc(r.local + ' – ' + r.visitante)},
    {k: 'titular', t: 'Tit', n: 1, h: r => r.titular ? 'sí' : 'no'}, {k: 'minutos', t: 'Min', n: 1}, {k: 'goles', t: 'Gol', n: 1}, {k: 'asistencias', t: 'Asis', n: 1},
    {k: 'amarillas', t: 'Am', n: 1}, {k: 'nota', t: 'Nota', n: 1}], pj, {k: 'fecha', d: -1}) : '<p class="mini">Se rellena solo partido a partido desde que FM Hub está en marcha.</p>';
  const meta = p ? [['Posición', x.posicion || '–'], ['Edad', edad(p.fecha_nacimiento) ?? '–'], ['Nacimiento', fecha(p.fecha_nacimiento)], ['Altura', p.altura_cm ? p.altura_cm + ' cm' : '–'],
    ['Sueldo', eur(p.sueldo_mes_eur) + '/mes'], ['Contrato hasta', fecha(p.fin_contrato)], ['Valor (pantalla)', x.valor || '–'], ['Cedido a', p.cedido_a || '–']] : [['Estado', 'exjugador']];
  return `<section><div class="wrap">
    <p class="volver"><a class="j" href="javascript:history.back()">← Volver</a></p>
    <div class="ficha-cab"><h2>${esc(nombre)}</h2>${p ? '<span class="pill">en la plantilla</span>' : '<span class="pill">exjugador</span>'}</div>
    <p class="mini" style="margin:6px 0 0"><a class="j" href="#comparar/${iu}">Comparar con otro jugador →</a></p>
    <div class="meta" style="margin-top:10px">${meta.map(([k, v]) => `<span>${k}: <b>${esc(v)}</b></span>`).join('')}</div>
    ${HIST.trayectoria(iu)}
    ${HIST.records(iu)}
    ${TAC.porPuestoHtml(iu)}
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
  return `<section><div class="wrap"><h2 data-n="12">Progreso</h2>
    <p class="sub">Cambio de atributos de cada jugador de la plantilla entre su primera y su última captura guardada (memoria y exportaciones). Cuantas más capturas, más fino.</p>
    <div class="cols2"><div><h4>Los que más han subido</h4>${tabla('psube', cols, sube, {k: 'd', d: -1})}</div><div><h4>Los que más han bajado</h4>${tabla('pbaja', cols, baja, {k: 'd', d: 1})}</div></div>
    <h4>Toda la plantilla</h4>${tabla('ptodos', cols, filas, {k: 'd', d: -1})}
  </div></section>`;
};

// ---------------------------------------------------------------- comparador de jugadores (#comparar/iu,iu,iu)
V.comparar = arg => {
  const ius = String(arg || '').split(',').map(Number).filter(Boolean).slice(0, 3);
  while (ius.length < 2) ius.push(0);
  const d2c = v => v === null || v === undefined || isNaN(v) ? '–' : Number(v).toFixed(2).replace('.', ',');
  const enPlantilla = D.plantilla.map(p => p.iu);
  const ex = Object.keys(IDX.nombres).map(Number).filter(iu => !enPlantilla.includes(iu)).sort((a, b) => (IDX.nombres[a] || '').localeCompare(IDX.nombres[b] || ''));
  const opciones = sel => `<option value="">Elige un jugador…</option><optgroup label="Plantilla">${[...D.plantilla].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(p => `<option value="${p.iu}" ${p.iu === sel ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</optgroup>
    <optgroup label="Exjugadores">${ex.map(iu => `<option value="${iu}" ${iu === sel ? 'selected' : ''}>${esc(IDX.nombres[iu])}</option>`).join('')}</optgroup>`;
  const selects = [...ius, ...(ius.length < 3 ? [0] : [])].map((iu, k) => `<label class="mini">Jugador ${k + 1} <select data-cmp="${k}">${opciones(iu)}</select></label>`).join('');
  const js = ius.filter(Boolean);
  const cab = `<section><div class="wrap"><h2 data-n="13">Comparar</h2>
    <p class="sub">Dos o tres jugadores lado a lado: ficha, esta temporada, su etapa en el club, estrellas y rendimiento por puesto y atributos. En verde, el mejor de cada fila.</p>
    <div class="filters cmp-sel">${selects}</div>`;
  if (js.length < 2) return cab + '<p class="vacio">Elige al menos dos jugadores.</p></div></section>';
  const datos = js.map(iu => {
    const p = D.plantilla.find(x => x.iu === iu), x = IDX.export[iu] || {}, s = (IDX.stats[iu] || {}).total || {};
    const temps = HIST.S().map(t => t.sq.find(q => q.iu === iu)).filter(q => q && q.pj);
    const club = temps.reduce((o, q) => ({pj: o.pj + q.pj, g: o.g + q.g, a: o.a + q.a, min: o.min + (q.min || 0), sn: o.sn + (q.avg ? q.avg * q.pj : 0), nn: o.nn + (q.avg ? q.pj : 0)}), {pj: 0, g: 0, a: 0, min: 0, sn: 0, nn: 0});
    const h = IDX.atr[iu] || [], atr = h.length ? h[h.length - 1].v : J(p?.atributos);
    let est = [], pp = [];
    try { est = TAC.estrellasPorPuesto(iu).slice(0, 4); pp = TAC.porPuesto(iu).filter(o => o.pj >= 3); } catch (e) {}
    return {iu, p, x, s, temps, club, atr, est, pp, nombre: p?.nombre || IDX.nombres[iu] || 'Jugador'};
  });
  // fila de la tabla: valores de cada jugador; `mejor` = 1 (más es mejor), -1 (menos es mejor) o 0 (sin resaltar)
  const fila = (t, vals, mejor = 1, fmt = v => v ?? '–') => {
    const nums = vals.map(v => typeof v === 'number' && !isNaN(v) ? v : null), ok = nums.filter(v => v !== null);
    const top = mejor && ok.length > 1 && new Set(ok).size > 1 ? (mejor > 0 ? Math.max(...ok) : Math.min(...ok)) : null;
    return `<tr><th>${t}</th>${vals.map((v, k) => `<td class="n${top !== null && nums[k] === top ? ' cmp-mejor' : ''}">${fmt(v)}</td>`).join('')}</tr>`;
  };
  const tabla = (t, filas) => `<h4>${t}</h4><div class="tw"><table class="cmp"><thead><tr><th></th>${datos.map(d => `<th>${jug(d.iu, d.nombre)}</th>`).join('')}</tr></thead><tbody>${filas.join('')}</tbody></table></div>`;
  const fichaT = tabla('Ficha', [
    fila('Estado', datos.map(d => d.p ? (d.p.cedido_a ? 'Cedido' : 'En la plantilla') : 'Exjugador'), 0),
    fila('Posición', datos.map(d => d.x.posicion || d.p?.posicion || '–'), 0),
    fila('Edad', datos.map(d => d.p ? edad(d.p.fecha_nacimiento) : null), 0),
    fila('Altura', datos.map(d => d.p?.altura_cm || null), 0, v => v ? v + ' cm' : '–'),
    fila('Sueldo', datos.map(d => d.p?.sueldo_mes_eur ?? null), 0, v => v === null ? '–' : eur(v) + '/mes'),
    fila('Contrato hasta', datos.map(d => d.p ? fecha(d.p.fin_contrato) : '–'), 0),
    fila('Valor (pantalla)', datos.map(d => d.x.valor || '–'), 0)]);
  const temporada = tabla(`Temporada ${esc(IDX.temporadaActual)}`, [
    fila('Partidos', datos.map(d => d.s.partidos ?? null), 1, num), fila('Titular', datos.map(d => d.s.titular ?? null), 1, num),
    fila('Minutos', datos.map(d => d.s.minutos ?? null), 1, num), fila('Goles', datos.map(d => d.s.goles ?? null), 1, num),
    fila('Asistencias', datos.map(d => d.s.asistencias ?? null), 1, num), fila('Nota media', datos.map(d => d.s.nota_media ?? null), 1, d2c),
    fila('Goles + asist. por 90 min', datos.map(d => d.s.minutos ? ((d.s.goles || 0) + (d.s.asistencias || 0)) * 90 / d.s.minutos : null), 1, d2c),
    fila('Amarillas · rojas', datos.map(d => d.s.partidos ? `${d.s.amarillas || 0} · ${d.s.rojas || 0}` : '–'), 0)]);
  const clubT = tabla(`En el ${esc(IDX.club)}`, [
    fila('Temporadas', datos.map(d => d.temps.length), 1), fila('Partidos', datos.map(d => d.club.pj), 1, num),
    fila('Goles', datos.map(d => d.club.g), 1, num), fila('Asistencias', datos.map(d => d.club.a), 1, num),
    fila('Minutos', datos.map(d => d.club.min), 1, num), fila('Media ponderada', datos.map(d => d.club.nn ? d.club.sn / d.club.nn : null), 1, d2c)]);
  const vEst = v => v ? '★'.repeat(Math.floor(v)) + (v % 1 ? '½' : '') : '—';
  const puestos = [...new Set(datos.flatMap(d => [...d.est.map(e => e.code), ...d.pp.map(o => o.code)]))];
  const puestoT = puestos.length ? tabla('Por puesto', puestos.flatMap(code => {
    const nom = TAC.PUESTOS[code] || code;
    return [fila(`${esc(nom)} · estrellas de FM Hub`, datos.map(d => d.est.find(e => e.code === code)?.a.est ?? null), 1, vEst),
            fila(`${esc(nom)} · nota jugando ahí`, datos.map(d => d.pp.find(o => o.code === code)?.nota ?? null), 1, v => v === null ? '–' : d2c(v)),
            fila(`${esc(nom)} · partidos ahí`, datos.map(d => d.pp.find(o => o.code === code)?.pj ?? null), 0, num)];
  })) + '<p class="mini">Estrellas de FM Hub: las que le pondría en cada puesto por sus atributos y lo que ha rendido ahí (sus 4 mejores puestos). Nota y partidos: oficiales, 3 o más en ese puesto (con los partidos capturados de FM).</p>' : '';
  const grupos = [['Técnicos', TECN], ['Mentales', MENT], ['Físicos', FIS], ['Portero', POR]];
  const atrT = grupos.map(([t, ks]) => {
    const filas = ks.filter(k => datos.some(d => d.atr?.[k] > 1)).map(k => fila(esc(NOMBRE_ATR[k] || k), datos.map(d => d.atr?.[k] > 1 ? d.atr[k] : null), 1));
    if (!filas.length) return '';
    const suma = fila(`<b>Suma ${t.toLowerCase()}</b>`, datos.map(d => { const v = ks.map(k => d.atr?.[k]).filter(x => x > 1); return v.length ? v.reduce((a, b) => a + b, 0) : null; }), 1);
    return tabla(`Atributos ${t.toLowerCase()}`, [suma, ...filas]);
  }).join('') || '<p class="vacio">Sin atributos guardados de estos jugadores (FM Hub solo los tiene de los de la plantilla).</p>';
  return cab + fichaT + temporada + clubT + puestoT + atrT + '</div></section>';
};
document.addEventListener('change', ev => {
  const s = ev.target.closest('select[data-cmp]');
  if (!s) return;
  const ius = [...document.querySelectorAll('select[data-cmp]')].map(x => +x.value).filter(Boolean);
  location.hash = '#comparar/' + [...new Set(ius)].join(',');
});

V.curiosidades = () => vistaCuriosidades();
V.viaje = () => HIST.viaje();
V.temporadas = () => HIST.temporadas();
V.rivales = arg => HIST.rivales(arg);
V.goles = () => HIST.goles();
V.hitos = () => HIST.hitos();
V.plan = () => HIST.plan();
V.tactica = () => TAC.vista();

// ---------------------------------------------------------------- ficha emergente, aparición suave y cifras animadas (como varela.html)
function ficha(iu) {
  ficha.iu = +iu;
  const p = D.plantilla.find(x => x.iu === +iu), x = IDX.export[iu] || {};
  const temps = HIST.S().filter(s => s.sq.some(q => q.iu === +iu && q.pj)).length;
  $('#mT').textContent = p?.nombre || IDX.nombres[iu] || 'Jugador';
  $('#mS').textContent = [x.nacionalidad, x.posicion, temps ? temps + (temps === 1 ? ' temporada en el club' : ' temporadas en el club') : '', HIST.cantera().has(+iu) ? 'Cantera' : '', p ? 'En la plantilla actual' : 'Exjugador'].filter(Boolean).join(' · ');
  $('#mB').innerHTML = V.jugador(iu);
  if ($('#modal').hidden) { ficha.foco = document.activeElement; $('#modal').hidden = false; document.body.style.overflow = 'hidden'; $('#modal').scrollTop = 0; $('#mX').focus(); }
}
// el once de un partido capturado de FM (puesto, minutos, nota, goles, tarjetas y cambios), en la ventana emergente
function verOnce(f) {
  const rs = IDX.informe[f] || [], p = IDX.partidos.find(x => x.fecha === f);
  ficha.iu = null;
  $('#mT').textContent = p ? `${p.local} ${p.goles_local}-${p.goles_visitante} ${p.visitante}` : fecha(f);
  $('#mS').textContent = [fecha(f), p?.competicion, rs[0]?.formacion, rs.some(r => r.dudoso) ? 'puede ser de otro partido (dudoso)' : ''].filter(Boolean).join(' · ');
  const fila = r => `<tr><td class="n">${r.dorsal ?? ''}</td><td>${r.iu ? jug(r.iu, r.jugador) : esc(r.jugador || 'id ' + r.id_interno)}</td>
    <td>${esc(r.puesto || '—')}${r.lado ? ` <small>${r.lado === 'I' ? 'izq.' : 'der.'}</small>` : ''}${r.puesto_final && r.puesto_final !== r.puesto ? ` <small>→ ${esc(r.puesto_final)}</small>` : ''}</td>
    <td class="n">${r.minutos ?? ''}</td><td class="n">${r.nota ? Number(r.nota).toFixed(2).replace('.', ',') : '—'}</td><td class="n">${r.goles || ''}</td>
    <td>${[r.amarilla ? `Am. ${r.amarilla}'` : '', r.roja ? `<b>Roja ${r.roja}'</b>` : ''].filter(Boolean).join(' · ')}</td>
    <td>${[r.entra ? `entra ${r.entra}'` : '', r.sale ? `sale ${r.sale}'` : ''].filter(Boolean).join(' · ')}</td></tr>`;
  const cab = '<thead><tr><th class="n">Nº</th><th>Jugador</th><th>Puesto</th><th class="n">Min</th><th class="n">Nota</th><th class="n">G</th><th>Tarjetas</th><th>Cambio</th></tr></thead>';
  $('#mB').innerHTML = `<section><div class="wrap"><h4>Titulares</h4><div class="tw"><table>${cab}<tbody>${rs.filter(r => r.titular).map(fila).join('')}</tbody></table></div>
    ${rs.some(r => !r.titular) ? `<h4>Entraron</h4><div class="tw"><table>${cab}<tbody>${rs.filter(r => !r.titular).map(fila).join('')}</tbody></table></div>` : ''}
    <p class="mini">Del informe del partido en FM (capturado con «Capturar partidos»). El puesto es donde empezó; la flecha, donde acabó. Sin rol: FM no lo guarda en el informe.</p></div></section>`;
  if ($('#modal').hidden) { ficha.foco = document.activeElement; $('#modal').hidden = false; document.body.style.overflow = 'hidden'; $('#modal').scrollTop = 0; $('#mX').focus(); }
}
function cerrarFicha() { $('#modal').hidden = true; ficha.iu = null; document.body.style.overflow = ''; try { ficha.foco?.focus(); } catch (e) {} }
document.addEventListener('click', ev => {
  const a = ev.target.closest('a.j[href^="#jugador/"]');
  if (a && location.hash.slice(1).split('/')[0] !== 'jugador') { ev.preventDefault(); ficha(a.getAttribute('href').split('/')[1]); return; }
  if (ev.target.closest('#modal a[href^="#"]:not([href^="#jugador/"])')) cerrarFicha();   // ir a otra sección desde la ficha
  const o = ev.target.closest('[data-once]');
  if (o) { verOnce(o.dataset.once); return; }
  if (ev.target.id === 'modal' || ev.target.closest('#mX')) cerrarFicha();
});
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('#modal').hidden) cerrarFicha(); });
function aparecer(raiz) {
  const els = raiz.querySelectorAll('.card,.tw,h4,.podium,.banner,.tl .it,.tr2>*,.trofeo,.cur');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } }), {rootMargin: '0px 0px -6% 0px'});
  els.forEach(e => { e.classList.add('reveal'); io.observe(e); });
}
function contar() {
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  document.querySelectorAll('.big b').forEach(b => {
    const txt = b.textContent;
    if (!/^\d+$/.test(txt)) return;
    const n = +txt; let t0 = null;
    const f = t => { t0 = t0 || t; const k = Math.min(1, (t - t0) / 900); b.textContent = Math.round(n * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
}

// recarga los datos sin perder la vista (cada 2 minutos, o al momento cuando FM Hub captura algo nuevo)
async function recargarDatos() {
  try { D = await cargar(); preparar(); cabecera(); if (!document.activeElement?.matches('input,select')) pintar(); } catch (e) {}
}

// ---------------------------------------------------------------- navegación
function pintar() {
  const [ruta, arg] = (location.hash.slice(1) || 'inicio').split('/');
  const vista = V[ruta] ? ruta : 'inicio';
  document.querySelectorAll('#menu a').forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === '#' + vista ? 'page' : 'false'));
  // en el móvil el menú se desliza: se centra en la sección activa
  const activo = document.querySelector('#menu a[aria-current=page]');
  if (activo && activo.parentElement.scrollWidth > activo.parentElement.clientWidth) activo.parentElement.scrollTo({left: activo.offsetLeft - activo.parentElement.clientWidth / 2 + activo.offsetWidth / 2, behavior: 'smooth'});
  const foco = document.activeElement?.id, pos = document.activeElement?.selectionStart;
  $('#vista').innerHTML = (['inicio', 'plantilla', 'progreso', 'plan', 'tactica'].includes(vista) ? avisoRespaldo() : '') + V[vista](arg);
  if (vista === 'inicio' && !window.FMHUB_ESTATICO && !window.FMHUB_PUBLICADO) fetch('api/url').then(r => r.json()).then(u => { const e = $('#url'); if (e) e.textContent = u.url; }).catch(() => {});
  if (foco) { const e = document.getElementById(foco); if (e) { e.focus(); try { e.setSelectionRange(pos, pos); } catch (er) {} } }
  aparecer($('#vista'));
  if (ficha.iu && !$('#modal').hidden) ficha(ficha.iu);
}

document.addEventListener('click', ev => {
  const b = ev.target.closest('button');
  if (!b) return;
  const ds = b.dataset;
  if (ds.pf) V.plantilla.filtro = ds.pf;
  else if (ds.nm) V.inicio.moral = !V.inicio.moral;
  else if (ds.ntodas) V.inicio.todas = !V.inicio.todas;
  else if (ds.nver) V.inicio.versiones = !V.inicio.versiones;
  else if (ds.pt) { V.partidos.t = ds.pt; V.partidos.c = null; }
  else if (ds.pa) V.partidos.amis = !V.partidos.amis;
  else if (ds.trt) V.traspasos.t = ds.trt;
  else if (ds.pr) V.partidos.r = V.partidos.r === ds.pr ? null : ds.pr;
  else if (ds.hd) V.historial.dart = ds.hd === 'dart';
  else if (ds.hc) V.historial.comp = ds.hc;
  else if (ds.hact) V.historial.act = !V.historial.act;
  else if (ds.hnc) V.historial.nc = !V.historial.nc;
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
// cambiar de partida: se recuerda en este navegador y se vuelve a cargar todo con sus datos
document.addEventListener('change', ev => {
  if (ev.target.id !== 'partida') return;
  apuntar('fmhub-partida', ev.target.value);
  // ?partida= de un enlace manda sobre lo recordado: se quita antes de recargar
  const u = new URL(location.href); u.searchParams.delete('partida');
  history.replaceState(null, '', u.toString());
  location.reload();
});
// atajos: «/» busca en la sección (si tiene buscador) y Escape vacía el buscador
document.addEventListener('keydown', ev => {
  const campo = document.querySelector('#vista input.search');
  if (ev.key === '/' && campo && !ev.target.matches('input,select,textarea')) { ev.preventDefault(); campo.focus(); campo.select(); }
  else if (ev.key === 'Escape' && ev.target === campo && campo.value) { campo.value = ''; campo.dispatchEvent(new Event('input', {bubbles: true})); }
});
window.addEventListener('hashchange', () => { pintar(); window.scrollTo(0, document.querySelector('nav.top').offsetTop); });

(async () => {
  try {
    await cargarPartidas();
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
  if (!window.FMHUB_ESTATICO) setInterval(recargarDatos, 120000);
})();
