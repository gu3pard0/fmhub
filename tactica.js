// FM Hub · Mi táctica: el once que juegas, todas las opciones de cada puesto en tu orden y tus estrellas (calidad,
// como las del cuerpo técnico de FM). FM Hub lo cruza con lo que ve partido a partido (medias, minutos, sueldos,
// edades, contratos) y te dice dónde falta profundidad, a quién vender y a quién dar más minutos.
// Se guarda en data/tactica.json desde la web local; en la web publicada, solo en este navegador.
const TAC = (() => {
  const FORMACIONES = {
    // la de Airam: «Perfect Strangers 42112 WIWBA P107 EF» (dos mediocentros defensivos, extremo a la izquierda y
    // delantero interior por la derecha detrás de dos puntas)
    '4-2-2-2 asimétrica': [['POR', 50, 92], ['DF-I', 13, 76], ['DF-C', 37, 79], ['DF-C', 63, 79], ['DF-D', 87, 76], ['MC', 37, 56], ['MC', 63, 59],
      ['ME-I', 13, 47], ['MP-D', 87, 28], ['DL-C', 37, 11], ['DL-C', 63, 14]],
    '4-4-2': [['POR', 50, 90], ['DF-I', 14, 70], ['DF-C', 37, 75], ['DF-C', 63, 75], ['DF-D', 86, 70], ['ME-I', 14, 45], ['ME-C', 37, 49], ['ME-C', 63, 49], ['ME-D', 86, 45], ['DL-C', 37, 17], ['DL-C', 63, 17]],
    '4-2-3-1': [['POR', 50, 90], ['DF-I', 14, 70], ['DF-C', 37, 75], ['DF-C', 63, 75], ['DF-D', 86, 70], ['ME-C', 37, 55], ['ME-C', 63, 55], ['MP-I', 14, 32], ['MP-C', 50, 34], ['MP-D', 86, 32], ['DL-C', 50, 13]],
    '4-3-3': [['POR', 50, 90], ['DF-I', 14, 70], ['DF-C', 37, 75], ['DF-C', 63, 75], ['DF-D', 86, 70], ['MC', 50, 59], ['ME-C', 30, 44], ['ME-C', 70, 44], ['MP-I', 14, 21], ['DL-C', 50, 13], ['MP-D', 86, 21]],
    '4-1-4-1': [['POR', 50, 90], ['DF-I', 14, 70], ['DF-C', 37, 75], ['DF-C', 63, 75], ['DF-D', 86, 70], ['MC', 50, 59], ['ME-I', 14, 40], ['ME-C', 37, 42], ['ME-C', 63, 42], ['ME-D', 86, 40], ['DL-C', 50, 13]],
    '4-4-1-1': [['POR', 50, 90], ['DF-I', 14, 70], ['DF-C', 37, 75], ['DF-C', 63, 75], ['DF-D', 86, 70], ['ME-I', 14, 47], ['ME-C', 37, 51], ['ME-C', 63, 51], ['ME-D', 86, 47], ['MP-C', 50, 30], ['DL-C', 50, 13]],
    '4-3-1-2': [['POR', 50, 90], ['DF-I', 14, 70], ['DF-C', 37, 75], ['DF-C', 63, 75], ['DF-D', 86, 70], ['ME-C', 28, 49], ['MC', 50, 55], ['ME-C', 72, 49], ['MP-C', 50, 32], ['DL-C', 37, 15], ['DL-C', 63, 15]],
    '3-5-2': [['POR', 50, 90], ['DF-C', 27, 74], ['DF-C', 50, 77], ['DF-C', 73, 74], ['CR-I', 10, 49], ['MC', 50, 58], ['ME-C', 32, 42], ['ME-C', 68, 42], ['CR-D', 90, 49], ['DL-C', 37, 16], ['DL-C', 63, 16]],
    '3-4-3': [['POR', 50, 90], ['DF-C', 27, 74], ['DF-C', 50, 77], ['DF-C', 73, 74], ['ME-I', 12, 47], ['ME-C', 37, 50], ['ME-C', 63, 50], ['ME-D', 88, 47], ['MP-I', 17, 22], ['DL-C', 50, 14], ['MP-D', 83, 22]],
    '5-3-2': [['POR', 50, 90], ['CR-I', 10, 62], ['DF-C', 30, 75], ['DF-C', 50, 78], ['DF-C', 70, 75], ['CR-D', 90, 62], ['ME-C', 28, 45], ['ME-C', 50, 48], ['ME-C', 72, 45], ['DL-C', 37, 16], ['DL-C', 63, 16]],
  };
  // roles por defecto de cada formación (se cambian en el editor del puesto)
  const ROLES = {'4-2-2-2 asimétrica': ['PCI · De', 'CIN · At', 'DCT · De', 'DCT · De', 'LAT · At', 'VOL · At', 'MC · Ap', 'EXT · Ap', 'DLI · Ap', 'DLA · At', 'DP · Ap']};
  const PUESTOS = {POR: 'Portero', 'DF-D': 'Lateral derecho', 'DF-C': 'Central', 'DF-I': 'Lateral izquierdo', 'CR-D': 'Carrilero derecho', 'CR-I': 'Carrilero izquierdo',
    MC: 'Mediocentro defensivo', 'ME-D': 'Medio derecho', 'ME-C': 'Mediocentro', 'ME-I': 'Medio izquierdo', 'MP-D': 'Extremo derecho', 'MP-C': 'Mediapunta', 'MP-I': 'Extremo izquierdo', 'DL-C': 'Delantero centro'};
  // puestos parecidos (para proponer candidatos y para rellenar el once)
  const CERCA = {'DF-D': ['CR-D'], 'DF-I': ['CR-I'], 'CR-D': ['DF-D', 'ME-D'], 'CR-I': ['DF-I', 'ME-I'], MC: ['ME-C', 'DF-C'], 'ME-C': ['MC', 'MP-C'],
    'ME-D': ['MP-D', 'CR-D'], 'ME-I': ['MP-I', 'CR-I'], 'MP-D': ['ME-D', 'DL-C'], 'MP-I': ['ME-I', 'DL-C'], 'MP-C': ['ME-C', 'DL-C'], 'DL-C': ['MP-C'], 'DF-C': ['MC'], POR: []};
  const corto = c => c.includes('-') ? `${c.split('-')[0]} (${c.split('-')[1]})` : c;
  const d2 = v => v === null || v === undefined || isNaN(v) ? '–' : Number(v).toFixed(2).replace('.', ',');
  const LOCAL = !window.FMHUB_PUBLICADO && !window.FMHUB_ESTATICO;
  let t = null, sel = 0, estadoGuardado = '', temporizador = null;

  // «DF/CR (D), MC, ME/MP (D)» -> {DF-D, CR-D, MC, ME-D, MP-D}
  function posiciones(s) {
    const out = new Set();
    for (const parte of (s || '').split(',')) {
      const m = parte.trim().toUpperCase().match(/^([A-Z/]+)(?:\s*\(([A-Z]+)\))?$/);
      if (!m) continue;
      for (const rol of m[1].split('/')) {
        if (rol === 'POR' || rol === 'MC' || rol === 'LIB') { out.add(rol === 'LIB' ? 'DF-C' : rol); continue; }
        for (const lado of (m[2] || 'C').split('')) out.add(`${rol}-${lado}`);
      }
    }
    return out;
  }
  const posDe = iu => posiciones((IDX.export[iu] || {}).posicion || (D.plantilla.find(p => p.iu === iu) || {}).posicion);

  // lo que ve FM Hub de cada jugador: esta temporada pesa más que la anterior
  function rendimiento() {
    const ss = HIST.S(), prev = [...ss].reverse().find(s => s.completa && s.t !== IDX.temporadaActual);
    const pq = {}; for (const p of prev?.sq || []) pq[p.iu] = p;
    const out = {}, car = {}, antes = {};
    for (const x of ss) if (x.t !== IDX.temporadaActual) for (const q of x.sq) if (q.pj) antes[q.iu] = true;
    const inicio = `${String(IDX.temporadaActual || '').slice(0, 4)}-06-01`, llegada = {};
    for (const tr of IDX.traspasos) if (tr.entra && tr.iu && (!llegada[tr.iu] || tr.fecha > llegada[tr.iu])) llegada[tr.iu] = tr.fecha;
    for (const x of ss) for (const q of x.sq) if (q.avg && q.pj) { const c = (car[q.iu] ||= {s: 0, pj: 0, temps: 0}); c.s += q.avg * q.pj; c.pj += q.pj; c.temps++; }
    for (const p of D.plantilla) {
      const a = (IDX.stats[p.iu] || {}).total || {}, q = pq[p.iu] || {}, c = car[p.iu];
      const pjA = a.partidos || 0, pjP = q.pj || 0, nA = a.nota_media || 0, nP = q.avg || 0;
      const w = (nA ? pjA * 1.5 : 0) + (nP ? pjP : 0);
      out[p.iu] = {n: w >= 3 ? ((nA ? nA * pjA * 1.5 : 0) + (nP ? nP * pjP : 0)) / w : null, pjA, minA: a.minutos || 0, nA, pjP, nP, minP: q.min || 0, prevT: prev?.t,
        nCar: c && c.pj >= 5 ? c.s / c.pj : null, pjCar: c ? c.pj : 0, temps: c ? c.temps : 0,
        nuevo: llegada[p.iu] ? llegada[p.iu] >= inicio : !antes[p.iu], llegada: llegada[p.iu]};
    }
    return out;
  }

  // medianas del equipo (sin cedidos): media, sueldo y minutos máximos de la temporada
  function referencias(R) {
    const plantilla = D.plantilla.filter(p => !p.cedido_a);
    const med = arr => { const x = arr.filter(v => v).sort((a, b) => a - b); return x.length ? x[Math.floor(x.length / 2)] : 0; };
    return {plantilla, mNota: med(plantilla.map(p => R[p.iu].pjA + R[p.iu].pjP >= 8 ? R[p.iu].n : 0)) || 6.8,
            mSueldo: med(plantilla.map(p => p.sueldo_mes_eur)), maxMin: Math.max(1, ...plantilla.map(p => R[p.iu].minA))};
  }
  // «Mejor opción»: cuánto merece jugar en este puesto. Mezcla tu calidad (estrellas) con lo que ve FM Hub:
  // media de esta temporada (50 %), de la anterior (30 %) y de toda su etapa en el club (20 %) frente a la del
  // equipo (0,25 de media = 1 estrella), si es su puesto natural y los minutos que ya lleva.
  function prioridad(o, code, R, ref) {
    const r = R[o.iu] || {};
    const partes = [[r.pjA >= 3 && r.nA, .5], [r.pjP >= 5 && r.nP, .3], [r.pjCar >= 10 && r.nCar, .2]].filter(([v]) => v);
    const w = partes.reduce((a, [, k]) => a + k, 0);
    const media = w ? partes.reduce((a, [v, k]) => a + v * k, 0) / w : null;
    const calidad = o.estrellas || 2.5;
    const rend = media ? (media - ref.mNota) * 4 : 0;
    const pos = posDe(o.iu), encaje = pos.has(code) ? .5 : (CERCA[code] || []).some(c => pos.has(c)) ? 0 : -.75;
    const forma = r.minA / ref.maxMin * .3;
    return {total: calidad + rend + encaje + forma, media, calidad, rend, encaje};
  }

  // Nadie es titular en dos puestos. Se recorren los puestos empezando por `primero` (el que acabas de tocar
  // manda); si el titular de un puesto ya lo es en otro, baja a 2º y sube el primero libre de ese puesto.
  function unTitularPorJugador(primero = 0) {
    const usados = new Set(), orden = [primero, ...t.slots.keys()].filter((v, i, a) => a.indexOf(v) === i && t.slots[v]);
    for (const i of orden) {
      const op = t.slots[i].opciones;
      const j = op.findIndex(o => !usados.has(o.iu));
      if (j > 0) { const [libre] = op.splice(j, 1); op.unshift(libre); }
      if (j >= 0) usados.add(op[0].iu);
    }
  }
  // ordena todos los puestos y reparte los titulares: el jugador disputado se queda donde más puntúa
  function ordenarTodo(modo) {
    const R = rendimiento(), ref = referencias(R);
    const clave = (o, code) => modo === 'est' ? (o.estrellas || 0) * 100 + prioridad(o, code, R, ref).total
      : modo === 'media' ? (R[o.iu]?.n || 0) * 100 + prioridad(o, code, R, ref).total : prioridad(o, code, R, ref).total;
    for (const x of t.slots) x.opciones.sort((a, b) => clave(b, x.code) - clave(a, x.code));
    const usados = new Set(), pendientes = new Set(t.slots.keys());
    while (pendientes.size) {
      let mejor = null;
      for (const i of pendientes) {
        const o = t.slots[i].opciones.find(o => !usados.has(o.iu));
        const v = o ? clave(o, t.slots[i].code) : -Infinity;
        if (!mejor || v > mejor.v) mejor = {i, o, v};
      }
      pendientes.delete(mejor.i);
      if (!mejor.o) continue;
      usados.add(mejor.o.iu);
      const op = t.slots[mejor.i].opciones;
      op.splice(op.indexOf(mejor.o), 1); op.unshift(mejor.o);
    }
  }

  // ---------------------------------------------------------------- estado y guardado
  function nueva(f) { return {formacion: f, slots: FORMACIONES[f].map(([code], i) => ({code, rol: (ROLES[f] || [])[i] || '', opciones: []}))}; }
  function cargarTactica() {
    if (t) return;
    let guardada = D.tactica;
    if (!LOCAL) { try { const l = JSON.parse(localStorage.getItem('fmhub-tactica') || 'null'); if (l) guardada = l; } catch (e) {} }
    t = guardada && FORMACIONES[guardada.formacion] && Array.isArray(guardada.slots) ? JSON.parse(JSON.stringify(guardada)) : nueva('4-4-2');
    while (t.slots.length < 11) t.slots.push({code: 'ME-C', opciones: []});
    unTitularPorJugador();
    estadoGuardado = D.tactica?.actualizado ? `Guardada el ${new Date(D.tactica.actualizado).toLocaleString('es-ES', {dateStyle: 'short', timeStyle: 'short'})}` : 'Sin guardar todavía';
  }
  function guardar() {
    clearTimeout(temporizador);
    estadoGuardado = 'Guardando…'; marcarEstado();
    temporizador = setTimeout(async () => {
      if (!LOCAL) {
        try { localStorage.setItem('fmhub-tactica', JSON.stringify(t)); estadoGuardado = 'Guardada en este navegador'; } catch (e) { estadoGuardado = 'No se pudo guardar en este navegador'; }
        return marcarEstado();
      }
      try {
        const r = await fetch('api/tactica', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(t)});
        if (!r.ok) throw new Error(await r.text());
        const j = await r.json();
        D.tactica = {...t, actualizado: j.actualizado};
        estadoGuardado = `Guardada a las ${new Date(j.actualizado).toLocaleTimeString('es-ES', {hour: '2-digit', minute: '2-digit'})}`;
      } catch (e) { estadoGuardado = 'No se pudo guardar: ' + e.message; }
      marcarEstado();
    }, 500);
  }
  function marcarEstado() { const e = document.getElementById('tacEstado'); if (e) e.textContent = estadoGuardado; }

  // rellena el once con lo que ve FM Hub: por puesto natural y, dentro, por rendimiento y minutos
  function rellenar() {
    const R = rendimiento(), usados = new Set();
    const nota = iu => (R[iu].n || 0) + R[iu].minA / 1e4;
    const jugadores = D.plantilla.filter(p => !p.cedido_a).map(p => p.iu);
    for (const s of t.slots) {
      const nat = jugadores.filter(iu => posDe(iu).has(s.code)).sort((a, b) => nota(b) - nota(a));
      const cer = jugadores.filter(iu => !nat.includes(iu) && (CERCA[s.code] || []).some(c => posDe(iu).has(c))).sort((a, b) => nota(b) - nota(a));
      const lista = [...nat, ...cer];
      const tit = lista.find(iu => !usados.has(iu));
      if (tit) usados.add(tit);
      s.opciones = [tit, ...lista.filter(iu => iu !== tit)].filter(Boolean).slice(0, 4).map(iu => ({iu, estrellas: 0}));
    }
  }

  // ---------------------------------------------------------------- pintar
  function estrellas(v, idx) {
    let h = '';
    for (let k = 1; k <= 5; k++) h += `<button type="button" class="st ${v >= k ? 'on' : v >= k - .5 ? 'half' : ''}" data-tst="${idx}:${k}" aria-label="${k} estrellas">★</button>`;
    return `<span class="ests" title="${v ? String(v).replace('.', ',') + ' estrellas' : 'Sin estrellas: pulsa para ponerlas'}">${h}</span>`;
  }
  const verEst = v => v ? '★'.repeat(Math.floor(v)) + (v % 1 ? '½' : '') : '—';

  function vista() {
    cargarTactica();
    const R = rendimiento();
    const nombre = iu => (D.plantilla.find(p => p.iu === iu) || {}).nombre || IDX.nombres[iu] || '¿?';
    const pos = FORMACIONES[t.formacion];
    const campo = t.slots.map((s, i) => {
      const o = s.opciones[0], [, x, y] = pos[i] || ['', 50, 50];
      return `<button type="button" class="slot${i === sel ? ' sel' : ''}${o ? '' : ' vacio'}" data-tslot="${i}" style="left:${x}%;top:${y}%">
        <b>${s.rol ? esc(s.rol) : corto(s.code)}</b><span title="${o ? esc(nombre(o.iu)) : ''}">${o ? esc(nombre(o.iu).split(' ').slice(1).join(' ') || nombre(o.iu)) : 'Sin nadie'}</span><small>${o ? (o.estrellas ? verEst(o.estrellas) : 'sin ★') : ''}${s.opciones.length > 1 ? ` · +${s.opciones.length - 1}` : ''}</small></button>`;
    }).join('');
    const s = t.slots[sel];
    const enSlot = new Set(s.opciones.map(o => o.iu));
    const cand = D.plantilla.filter(p => !enSlot.has(p.iu));
    const grupoCand = (titulo, lista) => lista.length ? `<optgroup label="${titulo}">${lista.map(p => `<option value="${p.iu}">${esc(p.nombre)} · ${esc((IDX.export[p.iu] || {}).posicion || p.posicion || '')}${p.cedido_a ? ' · cedido' : ''}</option>`).join('')}</optgroup>` : '';
    const nat = cand.filter(p => posDe(p.iu).has(s.code)), cer = cand.filter(p => !nat.includes(p) && (CERCA[s.code] || []).some(c => posDe(p.iu).has(c)));
    const resto = cand.filter(p => !nat.includes(p) && !cer.includes(p));
    const titularEn = {}; t.slots.forEach((x, i) => { if (x.opciones[0]) titularEn[x.opciones[0].iu] = i; });
    const ref = referencias(R);
    const filas = s.opciones.map((o, k) => {
      const r = R[o.iu] || {}, natural = posDe(o.iu).has(s.code), pr = prioridad(o, s.code, R, ref);
      const otro = titularEn[o.iu] !== undefined && titularEn[o.iu] !== sel ? ` · titular en ${corto(t.slots[titularEn[o.iu]].code)}` : '';
      return `<div class="op"><span class="nro">${k === 0 ? 'Titular' : k + 1 + 'º'}</span><div class="opn">${jug(o.iu, nombre(o.iu))}<small>${natural ? '' : 'fuera de su puesto natural · '}${r.n ? `rinde ${d2(r.n)}` : 'sin partidos suficientes'}${r.pjA ? ` · ${r.pjA} partidos y ${miles(r.minA)} min esta temporada` : ''}${otro} · <span title="Calidad ${String(pr.calidad).replace('.', ',')} · rendimiento ${pr.rend >= 0 ? '+' : ''}${d2(pr.rend)} · puesto ${pr.encaje >= 0 ? '+' : ''}${d2(pr.encaje)}">prioridad ${d2(pr.total)}</span></small></div>
        ${estrellas(o.estrellas || 0, k)}<span class="opb"><button type="button" data-tup="${k}" aria-label="Subir" ${k ? '' : 'disabled'}>▲</button><button type="button" data-tdown="${k}" aria-label="Bajar" ${k < s.opciones.length - 1 ? '' : 'disabled'}>▼</button><button type="button" data-tdel="${k}" aria-label="Quitar">✕</button></span></div>`;
    }).join('');
    const editor = `<div class="card tac-ed"><div class="tac-edc"><h4 style="margin:0">${esc(PUESTOS[s.code] || s.code)}${s.rol ? ` · ${esc(s.rol)}` : ''}</h4>
        <span class="tac-edf"><label class="mini">Puesto <select data-tcode>${Object.keys(PUESTOS).map(c => `<option value="${c}" ${c === s.code ? 'selected' : ''}>${corto(c)} · ${PUESTOS[c]}</option>`).join('')}</select></label>
        <label class="mini">Rol <input data-trol value="${esc(s.rol || '')}" placeholder="p. ej. DLA · At" maxlength="24"></label></span></div>
      <p class="mini" style="margin:4px 0 10px">Ordena de más a menos: el primero es tu titular. Nadie puede ser titular en dos puestos: si ya lo es en otro, aquí como mucho es el 2º. Las estrellas son su calidad en este puesto (como las del cuerpo técnico); el rendimiento lo pone FM Hub.</p>
      ${filas || '<p class="vacio">Nadie todavía para este puesto.</p>'}
      <label class="tac-add">Añadir <select data-tadd><option value="">Elige un jugador…</option>${grupoCand('En su puesto natural', nat)}${grupoCand('Puestos parecidos', cer)}${grupoCand('Resto de la plantilla', resto)}</select></label></div>`;
    const vacia = t.slots.every(x => !x.opciones.length);
    return `<section><div class="wrap"><h2 data-n="12">Mi táctica</h2>
      <p class="sub">Pon tu once, todas las opciones de cada puesto en tu orden y sus estrellas (su calidad, no cómo juegan). FM Hub lo cruza con lo que ve en todos los partidos (medias, minutos, sueldos, edades y contratos) y te dice dónde falta profundidad, a quién vender y a quién dar más minutos.${LOCAL ? ' Se guarda solo en FM Hub.' : ' En la web publicada los cambios se quedan solo en este navegador.'}</p>
      <div class="tac-barra"><label>Táctica <input data-tnombre value="${esc(t.nombre || '')}" placeholder="Nombre de tu táctica en FM" maxlength="60"></label><label>Formación <select data-tform>${Object.keys(FORMACIONES).map(f => `<option ${f === t.formacion ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
        <button type="button" class="chip" data-trell>${vacia ? 'Rellenar con lo que ve FM Hub' : 'Volver a rellenar con lo que ve FM Hub'}</button></div>
      <div class="tac-ord"><span class="mini">Ordenar todos los puestos:</span><button type="button" class="chip" data-tord="est">Por estrellas</button><button type="button" class="chip" data-tord="media">Por media</button><button type="button" class="chip" data-tord="mejor" title="Mezcla tus estrellas con la media de esta temporada, la anterior y toda su etapa en el club, si es su puesto natural y los minutos que lleva">Mejor opción</button>
        <span class="mini" id="tacEstado">${esc(estadoGuardado)}</span></div>
      <div class="tac"><div class="campo"><div class="campo-lineas"></div>${campo}</div>${editor}</div>
      ${consejos(R, nombre)}
    </div></section>`;
  }

  // ---------------------------------------------------------------- lo que ve FM Hub
  function consejos(R, nombre) {
    const ref = referencias(R), {plantilla, mNota, mSueldo, maxMin} = ref;
    const fj = IDX.fechaJuego ? new Date(IDX.fechaJuego) : new Date();
    const titularEn = {}, mejor = {};   // dónde es titular y su mejor puesto (el más alto en tu orden)
    t.slots.forEach((s, i) => s.opciones.forEach((o, k) => {
      if (k === 0) titularEn[o.iu] = i;
      if (!mejor[o.iu] || k < mejor[o.iu].k) mejor[o.iu] = {i, k, est: o.estrellas || 0};
    }));
    const p = iu => D.plantilla.find(x => x.iu === iu) || {};
    const card = (cls, tag, titulo, cuerpo, peso) => ({peso, html: `<div class="card pc ${cls}"><span class="tag">${tag}</span><h4>${titulo}</h4><p>${cuerpo}</p></div>`});
    const out = [];
    const conEst = t.slots.some(s => s.opciones.some(o => o.estrellas));
    const estOnce = t.slots.map(s => s.opciones[0]?.estrellas).filter(Boolean);
    const nivel = estOnce.length ? Math.round(estOnce.reduce((a, b) => a + b, 0) / estOnce.length * 2) / 2 : null;
    const vistoPuesto = new Set(), renovar = [];
    t.slots.forEach((s, i) => {
      const [tit, ...resto] = s.opciones, nom = PUESTOS[s.code];
      // con dos puestos iguales (dos centrales, dos delanteros) los recambios son comunes
      const mismos = t.slots.filter(x => x.code === s.code);
      const recambios = [...new Map(mismos.flatMap(x => x.opciones.slice(1)).filter(o => titularEn[o.iu] === undefined).map(o => [o.iu, o])).values()];
      const repetido = vistoPuesto.has(s.code); vistoPuesto.add(s.code);
      if (!tit) { out.push(card('sign', `Prioridad · ${corto(s.code)}`, `No tienes a nadie de ${nom.toLowerCase()}`, `Busca un ${nom.toLowerCase()}${nivel ? ` de ${verEst(nivel)} o más` : ''}. Los nombres los eliges tú; aquí solo va el perfil.`, 0)); return; }
      if (repetido) { /* el aviso de profundidad ya salió con el primero de estos puestos */ }
      else if (!recambios.length) {
        const ocupados = [...new Map(mismos.flatMap(x => x.opciones.slice(1)).filter(o => titularEn[o.iu] !== undefined && t.slots[titularEn[o.iu]].code !== s.code).map(o => [o.iu, o])).values()].map(o => `${esc(nombre(o.iu))} (titular en ${corto(t.slots[titularEn[o.iu]].code)})`);
        out.push(card('sign', `Profundidad · ${corto(s.code)}`, `Te falta recambio de ${nom.toLowerCase()}`,
          `Detrás de ${mismos.length > 1 ? mismos.filter(x => x.opciones[0]).map(x => jug(x.opciones[0].iu, nombre(x.opciones[0].iu))).join(' y ') : jug(tit.iu, nombre(tit.iu))} no hay nadie libre${ocupados.length ? ': ' + ocupados.join(', ') + ' ya juega de titular en otro puesto' : ''}. Busca un ${nom.toLowerCase()}${tit.estrellas ? ` de ${verEst(Math.max(1, tit.estrellas - 1))} o más` : ''} para rotar y cubrir lesiones.`, 1));
      } else if (tit.estrellas && Math.max(...recambios.map(o => o.estrellas || 0)) && tit.estrellas - Math.max(...recambios.map(o => o.estrellas || 0)) >= 1.5) {
        const b = recambios.reduce((a, o) => (o.estrellas || 0) > (a.estrellas || 0) ? o : a);
        out.push(card('sign', `Profundidad · ${corto(s.code)}`, `Mucha caída si falta ${esc(nombre(tit.iu))}`,
          `De ${jug(tit.iu, nombre(tit.iu))} (${verEst(tit.estrellas)}) a ${jug(b.iu, nombre(b.iu))} (${verEst(b.estrellas)}). Un ${nom.toLowerCase()} de ${verEst(tit.estrellas - 1)} te daría una rotación sin bajar el nivel.`, 2));
      }
      // titular por rendimiento
      const rt = R[tit.iu];
      const mejorR = resto.filter(o => titularEn[o.iu] === undefined && R[o.iu]?.n && R[o.iu].pjA + R[o.iu].pjP >= 5).sort((a, b) => R[b.iu].n - R[a.iu].n)[0];
      if (mejorR && rt?.n && R[mejorR.iu].n >= rt.n + .15)
        out.push(card('min', `Más minutos · ${corto(s.code)}`, `${esc(nombre(mejorR.iu))} rinde más que tu titular`,
          `${jug(mejorR.iu, nombre(mejorR.iu))} lleva ${d2(R[mejorR.iu].n)} de media y ${jug(tit.iu, nombre(tit.iu))}, ${d2(rt.n)}. Dale la titularidad o al menos más minutos${mejorR.estrellas && tit.estrellas && mejorR.estrellas < tit.estrellas ? ', aunque le pusiste menos estrellas: está rindiendo por encima de su calidad' : ''}.`, 3));
      // relevo por edad
      const e = edad(p(tit.iu).fecha_nacimiento);
      if (e >= 31 && !resto.some(o => titularEn[o.iu] === undefined && (edad(p(o.iu).fecha_nacimiento) || 99) <= 27 && (!tit.estrellas || (o.estrellas || 0) >= tit.estrellas - 1)))
        out.push(card('now', `Relevo · ${corto(s.code)}`, `Planifica el relevo de ${esc(nombre(tit.iu))}`, `Tiene ${e} años y detrás no hay nadie joven de su nivel. Busca un ${PUESTOS[s.code].toLowerCase()} de 27 años o menos${tit.estrellas ? ` y ${verEst(Math.max(1, tit.estrellas - 1))} o más` : ''}.`, 5));
      // contrato del titular
      const fin = p(tit.iu).fin_contrato ? new Date(p(tit.iu).fin_contrato) : null;
      if (fin && (fin - fj) / 864e5 < 365) renovar.push(`${jug(tit.iu, nombre(tit.iu))} (${corto(s.code)}, hasta ${fecha(p(tit.iu).fin_contrato)})`);
    });
    if (renovar.length)
      out.push(card('now', 'Contratos', renovar.length > 1 ? `${renovar.length} titulares acaban contrato en menos de un año` : 'Un titular acaba contrato en menos de un año',
        `${renovar.join(', ')}. En <a href="#plan">Plan → A quién renovarías</a> tienes cuánto ofrecer a cada uno.`, 4));
    // estrellas frente a rendimiento
    for (const [iu, m] of Object.entries(mejor)) {
      const r = R[iu]; if (!r?.n || !m.est || r.pjA + r.pjP < 8) continue;
      if (m.est >= 4 && r.n < mNota - .1) out.push(card('now', 'Rinde por debajo', `${esc(nombre(+iu))}: ${verEst(m.est)} pero media de ${d2(r.n)}`, `La media del equipo es ${d2(mNota)}. Con su calidad debería rendir más: revisa su rol, su moral o si juega fuera de sitio.`, 6));
      if (m.est <= 2.5 && r.n >= mNota + .15) out.push(card('min', 'Rinde por encima', `${esc(nombre(+iu))}: ${verEst(m.est)} y media de ${d2(r.n)}`, `Rinde más que el equipo (${d2(mNota)}) con menos calidad de la que le das: merece más minutos o que le subas las estrellas.`, 6));
    }
    // vender: cobra mucho y casi no juega
    for (const q of plantilla) {
      const r = R[q.iu], m = mejor[q.iu];
      if (r.nuevo || titularEn[q.iu] !== undefined || !q.sueldo_mes_eur || q.sueldo_mes_eur < mSueldo * 1.2 || r.minA > maxMin * .35) continue;
      const puesto = m ? t.slots[m.i].code : null;
      const tope = Math.round(Math.min(q.sueldo_mes_eur * .6, mSueldo) / 50) * 50;
      out.push(card('sell', 'Vender', `${esc(q.nombre)} cobra mucho y casi no juega`,
        `${eur(q.sueldo_mes_eur)} al mes (la mediana es ${eur(mSueldo)}) y ${miles(r.minA)} minutos esta temporada${m ? `; en tu táctica es el ${m.k + 1}º de ${corto(puesto)}` : '; no está en tu táctica'}. Véndelo y busca${puesto ? ` un ${PUESTOS[puesto].toLowerCase()}` : ' un sustituto'}${m?.est ? ` de ${verEst(m.est)}` : ''} que cobre hasta ${eur(tope)}.`, 1.5));
    }
    // fuera de la táctica
    const fuera = plantilla.filter(q => !mejor[q.iu]);
    if (fuera.length && t.slots.some(s => s.opciones.length))
      out.push(card('min', 'Fuera de la táctica', `${fuera.length} jugador${fuera.length > 1 ? 'es' : ''} sin sitio`, fuera.map(q => `${jug(q.iu, q.nombre)}${(edad(q.fecha_nacimiento) || 99) <= 21 ? ' (cesión)' : ''}`).join(', ') + '. Si no cuentas con ellos, cesión para los jóvenes y venta para el resto libera sueldo.', 7));
    const vacia = !t.slots.some(s => s.opciones.length);
    const titulares = t.slots.map(s => s.opciones[0]).filter(Boolean);
    const conRecambio = t.slots.filter(s => s.opciones.slice(1).some(o => titularEn[o.iu] === undefined)).length;
    const sueldoBanquillo = plantilla.filter(q => titularEn[q.iu] === undefined).reduce((a, q) => a + (q.sueldo_mes_eur || 0), 0);
    const kpis = vacia ? '' : `<div class="grid g4" style="margin:14px 0">
      <div class="card kpi"><b style="font-size:22px">${nivel ? verEst(nivel) : '—'}</b><span>Nivel medio del once</span><small>${conEst ? 'según tus estrellas' : 'pon estrellas para verlo'}</small></div>
      <div class="card kpi"><b style="font-size:22px">${conRecambio}/${t.slots.length}</b><span>Puestos con recambio libre</span></div>
      <div class="card kpi"><b style="font-size:22px">${(rs => rs.length ? d2(media(rs)) : '—')(titulares.map(o => R[o.iu]?.n).filter(Boolean))}</b><span>Rendimiento del once</span><small>media de las medias (equipo: ${d2(mNota)})</small></div>
      <div class="card kpi"><b style="font-size:22px">${eur(sueldoBanquillo)}</b><span>Sueldos de los que no son titulares</span><small>al mes</small></div></div>`;
    out.sort((a, b) => a.peso - b.peso);
    return `<h4>Lo que ve FM Hub</h4>${kpis}${vacia ? '' : vistazo(R, nombre, ref, titularEn, mejor, fj)}${vacia ? '<p class="vacio">Pon tu once (o pulsa «Rellenar con lo que ve FM Hub») y aquí aparecerán los consejos.</p>'
      : `${conEst ? '' : '<p class="mini">Aún no has puesto estrellas: sin ellas FM Hub no puede comparar calidad con rendimiento ni decir de qué nivel buscar.</p>'}<div class="pgrid">${out.map(x => x.html).join('') || '<p class="vacio">Todo cubierto: cada puesto tiene recambio y nadie desentona.</p>'}</div>`}`;
  }

  // ---------------------------------------------------------------- tabla de un vistazo: qué hacer con cada jugador
  const ACCIONES = {renovar: ['Renovar', 'now', 1], vender: ['Vender', 'sell', 0], minutos: ['Más minutos', 'min', 2], ceder: ['Ceder', 'min', 4], dejar: ['Dejar ir', 'sell', 3],
    relevo: ['Buscar relevo', 'now', 5], debajo: ['Rinde por debajo', 'now', 6], pilar: ['Pilar', 'ok', 8], titular: ['Titular', 'ok', 9], rotacion: ['Rotación', 'neutro', 10],
    sinsitio: ['Sin sitio', 'sell', 7], cedido: ['Cedido', 'neutro', 11], nuevo: ['Recién llegado: se valora a final de temporada', 'neutro', 7.5]};
  let filtro = 'todos';
  function vistazo(R, nombre, ref, titularEn, mejor, fj) {
    const {mNota, mSueldo, maxMin} = ref;
    const filas = D.plantilla.map(p => {
      const r = R[p.iu], m = mejor[p.iu], tit = titularEn[p.iu] !== undefined, e = edad(p.fecha_nacimiento);
      const fin = p.fin_contrato ? new Date(p.fin_contrato) : null, acaba = fin && (fin - fj) / 864e5 < 365;
      const acc = [];
      if (p.cedido_a) acc.push('cedido');
      else {
        // en su primera temporada aún es pronto para juzgar si juega poco: se marca, pero no se propone vender
        if (!tit && p.sueldo_mes_eur >= mSueldo * 1.2 && r.minA <= maxMin * .35) acc.push(r.nuevo ? 'nuevo' : 'vender');
        const vende = acc.includes('vender');
        if (!vende && acaba && (tit || (r.n && r.n >= mNota))) acc.push('renovar');
        else if (!vende && acaba && !tit && !(e <= 21)) acc.push('dejar');
        // más minutos: rinde por encima del equipo o de su titular y juega poco
        const titDeSuPuesto = m && t.slots[m.i].opciones[0];
        const masQueTit = titDeSuPuesto && titDeSuPuesto.iu !== p.iu && r.n && R[titDeSuPuesto.iu]?.n && r.n >= R[titDeSuPuesto.iu].n + .15;
        if (!tit && r.n && r.pjA + r.pjP >= 5 && ((r.n >= mNota + .1 && r.minA < maxMin * .5) || masQueTit)) acc.push('minutos');
        if (!tit && e && e <= 21 && r.minA < maxMin * .2 && !acc.includes('minutos')) acc.push('ceder');
        if (tit && e >= 31) acc.push('relevo');
        if (m?.est >= 3.5 && r.n && r.pjA + r.pjP >= 8 && r.n < mNota - .1) acc.push('debajo');
        if (!m && !acc.length && !r.nuevo) acc.push('sinsitio');
        if (!acc.length) acc.push(tit ? (r.n && r.n >= mNota ? 'pilar' : 'titular') : 'rotacion');
      }
      acc.sort((a, b) => ACCIONES[a][2] - ACCIONES[b][2]);
      const donde = m ? `${m.k === 0 ? 'Titular' : m.k + 1 + 'º'} · ${t.slots[m.i].rol ? esc(t.slots[m.i].rol) : corto(t.slots[m.i].code)}` : (p.cedido_a ? 'Cedido en el ' + esc(p.cedido_a) : '—');
      return {p, r, m, e, acc, donde, orden: ACCIONES[acc[0]][2]};
    });
    const cuenta = k => filas.filter(f => f.acc.includes(k)).length;
    const filtros = [['todos', 'Todos', filas.length], ['minutos', 'Más minutos', cuenta('minutos')], ['vender', 'Vender', cuenta('vender')], ['renovar', 'Renovar', cuenta('renovar')],
      ['dejar', 'Dejar ir', cuenta('dejar')], ['ceder', 'Ceder', cuenta('ceder')], ['relevo', 'Buscar relevo', cuenta('relevo')]].filter(([k, , n]) => k === 'todos' || n);
    if (!filtros.some(([k]) => k === filtro)) filtro = 'todos';
    const vis = filas.filter(f => filtro === 'todos' || f.acc.includes(filtro)).sort((a, b) => a.orden - b.orden || (b.p.sueldo_mes_eur || 0) - (a.p.sueldo_mes_eur || 0));
    const nota = (n, pj) => n ? `${d2(n)}<small> ${pj}p</small>` : '—';
    return `<div class="tac-vis"><div class="calc" style="margin:4px 0 10px">${filtros.map(([k, txt, n]) => `<button type="button" class="chip" data-tfil="${k}" aria-pressed="${filtro === k}">${txt} · ${n}</button>`).join('')}</div>
      <div class="tw"><table class="tvis"><thead><tr><th>Jugador</th><th>Qué hacer</th><th>En tu táctica</th><th class="n">★</th><th class="n">Media temp.</th><th class="n">Media club</th><th class="n">Min temp.</th><th class="n">€/mes</th><th>Contrato</th><th class="n">Edad</th></tr></thead><tbody>
      ${vis.map(f => `<tr><td>${jug(f.p.iu, f.p.nombre)}</td><td>${f.acc.map(a => `<span class="acc ${ACCIONES[a][1]}">${ACCIONES[a][0]}</span>`).join(' ')}</td><td class="mini">${f.donde}</td>
        <td class="n">${f.m?.est ? verEst(f.m.est) : '—'}</td><td class="n">${nota(f.r.nA, f.r.pjA)}</td><td class="n">${f.r.nCar ? d2(f.r.nCar) : '—'}</td><td class="n">${miles(f.r.minA)}</td>
        <td class="n">${miles(f.p.sueldo_mes_eur || 0)}</td><td>${f.p.fin_contrato ? fecha(f.p.fin_contrato) : '—'}</td><td class="n">${f.e ?? '—'}</td></tr>`).join('')}</tbody></table></div>
      <p class="mini" style="margin:6px 0 14px">Media del equipo: ${d2(mNota)} · sueldo mediano: ${eur(mSueldo)}. «Media club» es la de toda su etapa en el Dartford. Debajo, el porqué de cada cosa.</p></div>`;
  }

  // ---------------------------------------------------------------- eventos
  document.addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b || !t) return;
    const ds = b.dataset, s = t.slots[sel];
    if (ds.tslot !== undefined) sel = +ds.tslot;
    else if (ds.tup !== undefined) { const k = +ds.tup; [s.opciones[k - 1], s.opciones[k]] = [s.opciones[k], s.opciones[k - 1]]; unTitularPorJugador(sel); guardar(); }
    else if (ds.tdown !== undefined) { const k = +ds.tdown; [s.opciones[k + 1], s.opciones[k]] = [s.opciones[k], s.opciones[k + 1]]; unTitularPorJugador(sel); guardar(); }
    else if (ds.tdel !== undefined) { s.opciones.splice(+ds.tdel, 1); unTitularPorJugador(sel); guardar(); }
    else if (ds.tst) { const [k, n] = ds.tst.split(':').map(Number), o = s.opciones[k]; o.estrellas = o.estrellas === n ? n - .5 : n; guardar(); }
    else if (ds.tord) { ordenarTodo(ds.tord); guardar(); }
    else if (ds.tfil) filtro = ds.tfil;
    else if (ds.trell !== undefined) { if (t.slots.some(x => x.opciones.length) && !confirm('¿Sustituir tu táctica por la que propone FM Hub? Se pierden tu orden y tus estrellas.')) return; rellenar(); guardar(); }
    else return;
    pintar();
  });
  document.addEventListener('change', ev => {
    const e = ev.target; if (!t) return;
    if (e.matches('[data-tform]')) {
      // al cambiar de formación se conservan las opciones de los puestos que siguen existiendo
      const viejos = t.slots.map(s => ({...s})), nuevos = nueva(e.value);
      for (const s of nuevos.slots) { const i = viejos.findIndex(v => v.code === s.code); if (i >= 0) { const v = viejos.splice(i, 1)[0]; s.opciones = v.opciones; if (!ROLES[e.value] && v.rol) s.rol = v.rol; } }
      nuevos.nombre = t.nombre;
      t = nuevos; sel = Math.min(sel, 10);
    } else if (e.matches('[data-tcode]')) t.slots[sel].code = e.value;
    else if (e.matches('[data-trol]')) t.slots[sel].rol = e.value.trim();
    else if (e.matches('[data-tnombre]')) t.nombre = e.value.trim();
    else if (e.matches('[data-tadd]') && e.value) t.slots[sel].opciones.push({iu: +e.value, estrellas: 0});
    else return;
    unTitularPorJugador(sel);
    guardar(); pintar();
  });

  return {vista, posiciones};
})();
