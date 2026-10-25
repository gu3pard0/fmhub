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

  // lo que ve FM Hub de cada jugador: esta temporada pesa más que la anterior. `sin` quita del cálculo unos
  // partidos ({fechas, quitar}: ver sinPartidos) para ver cómo estaba todo antes de ellos.
  // De cada partido se apunta dónde jugó: el puesto de tu once guardado ese día si era tu titular ahí.
  function rendimiento(sin = null) {
    const porJug = {};
    for (const f of D.partido_jugador || [])
      if (f.temporada === IDX.temporadaActual && f.tipo !== 'amistosos' && !f.varios && f.nota && f.fecha && !sin?.fechas.has(f.fecha))
        (porJug[f.iu] ||= []).push({fecha: f.fecha, nota: f.nota, min: f.minutos || 0, tit: !!f.titular, code: puestoDe(f.fecha, f.iu, f.titular)});
    for (const l of Object.values(porJug)) l.sort((a, b) => b.fecha < a.fecha ? -1 : 1);
    const ss = HIST.S(), prev = [...ss].reverse().find(s => s.completa && s.t !== IDX.temporadaActual);
    const pq = {}; for (const p of prev?.sq || []) pq[p.iu] = p;
    const out = {}, car = {}, antes = {};
    for (const x of ss) if (x.t !== IDX.temporadaActual) for (const q of x.sq) if (q.pj) antes[q.iu] = true;
    const inicio = `${String(IDX.temporadaActual || '').slice(0, 4)}-06-01`, llegada = {};
    for (const tr of IDX.traspasos) if (tr.entra && tr.iu && (!llegada[tr.iu] || tr.fecha > llegada[tr.iu])) llegada[tr.iu] = tr.fecha;
    for (const x of ss) for (const q of x.sq) if (q.avg && q.pj) { const c = (car[q.iu] ||= {s: 0, pj: 0, temps: 0}); c.s += q.avg * q.pj; c.pj += q.pj; c.temps++; }
    for (const p of D.plantilla) {
      let a = (IDX.stats[p.iu] || {}).total || {};
      const q = pq[p.iu] || {}, c = car[p.iu], x = sin?.quitar[p.iu];
      if (x && a.partidos) {
        const pj = Math.max(0, a.partidos - x.partidos);
        a = {partidos: pj, minutos: Math.max(0, (a.minutos || 0) - x.minutos),
             nota_media: pj && a.nota_media ? (a.nota_media * a.partidos - (x.sumaNota + (x.partidos - x.conNota) * a.nota_media)) / pj : 0};
      }
      const pjA = a.partidos || 0, pjP = q.pj || 0, nA = a.nota_media || 0, nP = q.avg || 0;
      const w = (nA ? pjA * 1.5 : 0) + (nP ? pjP : 0);
      out[p.iu] = {n: w >= 3 ? ((nA ? nA * pjA * 1.5 : 0) + (nP ? nP * pjP : 0)) / w : null, pjA, minA: a.minutos || 0, nA, pjP, nP, minP: q.min || 0, prevT: prev?.t,
        nCar: c && c.pj >= 5 ? c.s / c.pj : null, pjCar: c ? c.pj : 0, temps: c ? c.temps : 0,
        nuevo: llegada[p.iu] ? llegada[p.iu] >= inicio : !antes[p.iu], llegada: llegada[p.iu], partidos: porJug[p.iu] || []};
      out[p.iu].carrera = carreraPorPuesto()[p.iu] || {};
      const u5 = out[p.iu].partidos.slice(0, 5);
      out[p.iu].forma = u5.length >= 2 ? u5.reduce((a, x) => a + x.nota, 0) / u5.length : null;
      out[p.iu].nForma = u5.length;
    }
    return out;
  }

  // dónde jugó de verdad en las temporadas anteriores (los partidos capturados de FM con «Capturar partidos»):
  // {iu: {puesto: {n (nota media), pj, min}}}, partidos oficiales de 45 minutos o más con nota
  function carreraPorPuesto() {
    if (carreraPorPuesto.d === D) return carreraPorPuesto.v;
    const of = {}; for (const x of IDX.partidos) of[x.fecha] = x;
    const v = {};
    for (const r of D.partido_informe || []) {
      const x = of[r.fecha];
      if (!r.iu || !r.puesto || !r.nota || (r.minutos || 0) < 45 || !x || !x.oficial || x.temporada === IDX.temporadaActual) continue;
      const o = ((v[r.iu] ||= {})[r.puesto] ||= {s: 0, pj: 0, min: 0});
      o.s += r.nota; o.pj++; o.min += r.minutos || 0;
    }
    for (const l of Object.values(v)) for (const o of Object.values(l)) o.n = o.s / o.pj;
    carreraPorPuesto.d = D; carreraPorPuesto.v = v;
    return v;
  }
  const PJ_CARRERA = 5;   // partidos en un puesto en temporadas anteriores para que cuente lo que rindió ahí

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
  function puestoEn(fecha, iu) {
    let e = null;
    for (const h of t?.historial || []) if (h.desde <= fecha) e = h;
    return e ? e.tit[iu] : undefined;
  }
  // dónde jugó cada uno en cada partido según el programa (fase2_posiciones.py): titulares por tu once guardado
  // ese día, suplentes con el puesto del que sustituyen. Con datos antiguos sin esa tabla, tu once (solo titulares)
  function dondeJugo(fecha, iu) {
    if (dondeJugo.d !== D) { dondeJugo.d = D; dondeJugo.v = {}; for (const f of D.partido_posicion || []) dondeJugo.v[f.fecha + '|' + f.iu] = f; }
    return dondeJugo.v[fecha + '|' + iu];
  }
  const puestoDe = (fecha, iu, titular) => D.partido_posicion ? dondeJugo(fecha, iu)?.puesto || undefined : titular ? puestoEn(fecha, iu) : undefined;
  // rendimiento en este puesto: partidos de 45 minutos o más jugados aquí (de titular o heredando el puesto)
  function enPuesto(r, iu, code) {
    const l = (r.partidos || []).filter(x => x.min >= 45 && x.code === code);
    return l.length ? {n: l.reduce((a, x) => a + x.nota, 0) / l.length, pj: l.length} : null;
  }
  // estrellas por puesto (las que le pondría FM Hub): lo que pide cada puesto de los atributos de FM (pesos de 1 a 3),
  // comparado con el resto de la plantilla en ese mismo puesto (la mediana, 2,5 estrellas; cada desviación, una más o
  // menos), lo lejos que queda de su mejor puesto y lo que ha rendido de verdad en ese puesto (hasta una estrella
  // arriba o abajo, entera con 5 partidos)
  const PESOS = {
    POR: {Ref: 3, '1v1': 2, Mdo: 2, Blo: 2, 'Aér': 2, Col: 2, Agi: 2, Com: 1, Cnc: 1, Dec: 1, SAL: 1, 'Puñ': 1, Pue: 1, Saq: 1},
    'DF-C': {Mar: 3, Ent: 3, Cab: 3, Col: 3, Sal: 2, Fue: 2, Ant: 2, Cnc: 2, Val: 1, Dec: 1, Ser: 1, Vel: 1},
    LAT: {Ent: 2, Mar: 2, Col: 2, Vel: 2, Ace: 2, Res: 2, Cen: 2, Sac: 2, Ant: 1, Cnc: 1, Dec: 1, JEq: 1, Pas: 1},
    CR: {Cen: 3, Res: 3, Vel: 2, Ace: 2, Sac: 2, Ent: 2, Reg: 1, Pas: 1, Dmq: 1, JEq: 1, Col: 1, 'Téc': 1},
    MC: {Pas: 3, Dec: 3, Vis: 2, 'Téc': 2, Ctr: 2, JEq: 2, Res: 2, Sac: 1, Ent: 1, Col: 1, Ant: 1, Ser: 1, Lej: 1},
    MCD: {Col: 3, Ent: 2, Ant: 2, Pas: 2, Dec: 2, Cnc: 2, JEq: 2, Sac: 2, Mar: 1, Res: 1, Fue: 1},
    ME: {Cen: 3, Reg: 2, Vel: 2, Ace: 2, Res: 2, Sac: 2, Pas: 2, 'Téc': 1, JEq: 1, Dmq: 1, Ctr: 1},
    EXT: {Reg: 3, Ace: 3, Vel: 2, 'Téc': 2, Cen: 2, Dmq: 2, Ctr: 2, Agi: 2, Rem: 1, Pas: 1, Dec: 1, Tal: 1},
    MP: {Pas: 3, Vis: 3, 'Téc': 2, Ctr: 2, Reg: 2, Dec: 2, Dmq: 2, Ser: 1, Lej: 1, Rem: 1, Agi: 1, Tal: 1},
    DL: {Rem: 3, Dmq: 3, Ser: 2, Ctr: 2, Ace: 2, Ant: 2, Cab: 1, 'Téc': 1, Dec: 1, Vel: 1, Fue: 1, Agi: 1},
  };
  const pesosDe = code => PESOS[{POR: 'POR', 'DF-C': 'DF-C', 'DF-D': 'LAT', 'DF-I': 'LAT', 'CR-D': 'CR', 'CR-I': 'CR', MC: 'MC', 'ME-C': 'MCD',
    'ME-D': 'ME', 'ME-I': 'ME', 'MP-D': 'EXT', 'MP-I': 'EXT', 'MP-C': 'MP', 'DL-C': 'DL'}[code] || 'MC'];
  const atributosDe = iu => { const h = IDX.atr[iu]; return h?.length ? h[h.length - 1].v : J((D.plantilla.find(p => p.iu === iu) || {}).atributos) || {}; };
  function notaAtributos(iu, code) {
    const w = pesosDe(code), a = atributosDe(iu);
    let s = 0, k = 0;
    for (const [at, p] of Object.entries(w)) if (a[at] > 1) { s += a[at] * p; k += p; }
    return k >= 6 ? s / k : null;   // sin bastantes atributos de ese puesto, no se puntúa
  }
  function estrellasAuto(iu, code, R, ref) {
    const c = estrellasAuto.c?.d === D ? estrellasAuto.c : (estrellasAuto.c = {d: D, plantilla: {}});
    if (!c.plantilla[code]) {
      // frente a los que juegan ese puesto en la plantilla (natural o uno cercano; de portero, solo los porteros): frente a
      // todos, cualquier portero sale de 5 estrellas (los de campo tienen atributos de portero muy bajos)
      const juegan = c => code === 'POR' ? posDe(c).has('POR') : !posDe(c).has('POR') && (posDe(c).has(code) || (CERCA[code] || []).some(x => posDe(c).has(x)));
      let quienes = D.plantilla.filter(p => !p.cedido_a && juegan(p.iu));
      if (quienes.length < 3 && code !== 'POR') quienes = D.plantilla.filter(p => !p.cedido_a && !posDe(p.iu).has('POR'));
      const v = quienes.map(p => notaAtributos(p.iu, code)).filter(x => x !== null).sort((a, b) => a - b);
      const med = v.length ? v[Math.floor(v.length / 2)] : null, m = v.reduce((a, b) => a + b, 0) / (v.length || 1);
      c.plantilla[code] = {med, sd: Math.max(1, Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length || 1)))};
    }
    const {med, sd} = c.plantilla[code], na = notaAtributos(iu, code);
    if (na === null || med === null) return null;
    // y frente a su mejor puesto: cada punto de atributos por debajo de lo que tiene para su mejor puesto, 0,6 estrellas
    // menos (un gran delantero no es igual de bueno de extremo, ni un central de lateral)
    if (!(iu in (c.mejor ||= {}))) {
      const portero = posDe(iu).has('POR');
      c.mejor[iu] = Math.max(...Object.keys(PUESTOS).filter(x => (x === 'POR') === portero).map(x => notaAtributos(iu, x) ?? 0));
    }
    let est = 2.5 + (na - med) / sd - Math.max(0, c.mejor[iu] - na) * .6;
    const ev = evidencia(R[iu] || {}, code);
    const ajuste = ev ? Math.max(-1, Math.min(1, (ev.n - ref.mNota) * 1.5)) * Math.min(1, ev.pj / 5) : 0;
    est = Math.max(.5, Math.min(5, Math.round((est + ajuste) * 2) / 2));
    return {est, atributos: na, ajuste, ev};
  }
  const K_PUESTO = 3;   // partidos «de su media» frente a los que lleva en un puesto (cuánto pesa lo de ese puesto)
  // todo lo que ha jugado en un puesto (45 minutos o más): esta temporada y las anteriores (partidos capturados)
  function evidencia(r, code) {
    const ep = enPuesto(r, null, code), ec = (r.carrera || {})[code];
    const pj = (ep?.pj || 0) + (ec?.pj || 0);
    return pj ? {pj, n: ((ep ? ep.n * ep.pj : 0) + (ec ? ec.n * ec.pj : 0)) / pj} : null;
  }
  // su nivel en general: la media de FM Hub (esta temporada y la anterior) o, si no hay, la de todo lo que ha jugado
  function mediaPropia(r) {
    if (r.n) return r.n;
    const todos = [...(r.partidos || []).filter(x => x.min >= 45).map(x => [x.nota, 1]), ...Object.values(r.carrera || {}).map(o => [o.n, o.pj])];
    const pj = todos.reduce((a, [, k]) => a + k, 0);
    return pj ? todos.reduce((a, [v, k]) => a + v * k, 0) / pj : null;
  }
  // «para probar»: puestos que no son el suyo donde ha jugado poco (1 o 2 partidos) pero muy por encima de su media
  function pruebas(R) {
    const out = [];
    for (const p of D.plantilla) {
      if (p.cedido_a) continue;
      const r = R[p.iu] || {}, propia = mediaPropia(r), pos = posDe(p.iu);
      if (!propia) continue;
      const codes = new Set([...(r.partidos || []).map(x => x.code), ...Object.keys(r.carrera || {})].filter(Boolean));
      for (const code of codes) {
        const ev = evidencia(r, code);
        if (ev && !pos.has(code) && ev.pj <= 2 && ev.n >= propia + .5) out.push({iu: p.iu, code, n: ev.n, pj: ev.pj, propia});
      }
    }
    return out.sort((a, b) => (b.n - b.propia) - (a.n - a.propia));
  }

  // forma en un puesto (últimos 5 partidos): lo que jugó aquí cuenta entero; de suplente o fuera de tu once
  // guardado (no se sabe dónde), la mitad; en otro puesto de tu once, un cuarto. Así un partidazo en un puesto no
  // le hace primera opción en otros tres
  const PESO_DONDE = (x, code) => x.code === code ? 1 : x.code === undefined ? .5 : .25;
  function formaEn(r, code) {
    const u5 = (r.partidos || []).slice(0, 5), w = u5.reduce((a, x) => a + PESO_DONDE(x, code), 0);
    return u5.length >= 2 && w ? {n: u5.reduce((a, x) => a + x.nota * PESO_DONDE(x, code), 0) / w, w} : null;
  }
  function prioridad(o, code, R, ref) {
    const r = R[o.iu] || {};
    // forma (últimos 5 partidos) hasta 30 %, temporada 30 %, temporada anterior 20 %, toda su etapa en el club 20 %.
    // La forma pesa entera con el equivalente a 3 partidos en este puesto; con menos, menos (un partido no basta)
    const fp = formaEn(r, code);
    const partes = [[fp?.n, .3 * Math.min(1, (fp?.w || 0) / 3)], [r.pjA >= 3 && r.nA, .3], [r.pjP >= 5 && r.nP, .2], [r.pjCar >= 10 && r.nCar, .2]].filter(([v, k]) => v && k);
    const w = partes.reduce((a, [, k]) => a + k, 0);
    let media = w ? partes.reduce((a, [v, k]) => a + v * k, 0) / w : null;
    // lo que ha rendido en este puesto (esta temporada y las anteriores) cuenta desde el primer partido, y más cuantos
    // más juegue aquí: 1 partido, un cuarto de su media; 3, la mitad; 9, tres cuartos (un partido no lo decide todo)
    const ep = enPuesto(r, o.iu, code), ec = (r.carrera || {})[code], ev = evidencia(r, code);
    if (ev) media = media ? (media * K_PUESTO + ev.n * ev.pj) / (K_PUESTO + ev.pj) : ev.n;
    // tus estrellas mandan. Sin ellas, si en este puesto has puesto estrellas a otros, es que no tiene nivel para el
    // primer equipo (o solo de cantera): la mínima. Si no has puesto a nadie, 2 (neutro). Las de FM Hub solo se enseñan
    const auto = estrellasAuto(o.iu, code, R, ref);
    const puestas = t.slots.filter(x => x.code === code).flatMap(x => x.opciones).map(x => x.estrellas).filter(Boolean);
    const calidad = o.estrellas || (puestas.length ? 1 : 2);
    // con pocos minutos la media dice poco: pesa según los minutos jugados (con ~900, unos 10 partidos, ya pesa la mitad)
    const minutos = (r.minA || 0) + .6 * (r.minP || 0), peso = minutos / (minutos + 900);
    const rend = media ? (media - ref.mNota) * 4 * peso : 0;
    // su puesto: el natural de FM, o uno que ya ha jugado mucho de verdad (10 partidos o más en el club). Fuera de su
    // puesto, si aquí rinde por encima de su media, la penalización se va quitando: un tercio con un partido medio punto
    // por encima, entera con tres (como si fuera su puesto); si aquí rinde por debajo, se queda
    const pos = posDe(o.iu), jugado = ec && ec.pj >= 10;
    let encaje = pos.has(code) || jugado ? .5 : (CERCA[code] || []).some(c => pos.has(c)) ? 0 : -.75;
    const propia = mediaPropia(r) || ref.mNota, bueno = ev ? ev.n - propia : 0;
    if (encaje < .5 && ev && bueno > 0) encaje += (.5 - encaje) * Math.min(1, ev.pj / 3) * Math.min(1, bueno / .5);
    const forma = r.minA / ref.maxMin * .3;
    return {total: calidad + rend + encaje + forma, media, calidad, rend, encaje, ep, ec: ec && ec.pj >= PJ_CARRERA ? ec : null, ev, auto, peso, fp, sinEst: !o.estrellas};
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
  // «Mejor opción» no cambia titulares por un partido: ordena a los demás de cada puesto por prioridad y solo cambia el
  // titular donde hay un cambio sostenido (el mismo que propone «¿Cambiar algún titular?»)
  function ordenarTodo(modo) {
    const R = rendimiento(), ref = referencias(R);
    const cedidos = new Set(D.plantilla.filter(p => p.cedido_a).map(p => p.iu));   // los cedidos no pueden jugar: al final
    const clave = (o, code) => (cedidos.has(o.iu) ? -1e5 : 0) + (modo === 'est' ? (o.estrellas || 0) * 100 + prioridad(o, code, R, ref).total
      : modo === 'media' ? (R[o.iu]?.n || 0) * 100 + prioridad(o, code, R, ref).total : prioridad(o, code, R, ref).total);
    if (modo === 'mejor') {
      const nuevo = {};
      for (const pr of cambiosSostenidos(R, ref)) nuevo[pr.i] = pr.mejor.iu;
      t.slots.forEach((x, i) => {
        if (!x.opciones.length) return;
        const tit = x.opciones.find(o => o.iu === (nuevo[i] ?? x.opciones[0].iu));
        x.opciones = [tit, ...x.opciones.filter(o => o !== tit).sort((a, b) => clave(b, x.code) - clave(a, x.code))];
      });
      return unTitularPorJugador();
    }
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
    if (!LOCAL) { try { const l = JSON.parse(localStorage.getItem(clavePartida('fmhub-tactica')) || 'null'); if (l) guardada = l; } catch (e) {} }
    t = guardada && FORMACIONES[guardada.formacion] && Array.isArray(guardada.slots) ? JSON.parse(JSON.stringify(guardada)) : nueva('4-4-2');
    while (t.slots.length < 11) t.slots.push({code: 'ME-C', opciones: []});
    unTitularPorJugador();
    estadoGuardado = D.tactica?.actualizado ? `Guardada el ${new Date(D.tactica.actualizado).toLocaleString('es-ES', {dateStyle: 'short', timeStyle: 'short'})}` : 'Sin guardar todavía';
  }
  function apuntarOnce() {
    const tit = {};
    for (const x of t.slots) if (x.opciones[0]) tit[x.opciones[0].iu] = x.code;
    const h = (t.historial ||= []), u = h[h.length - 1], desde = (IDX.fechaJuego || new Date().toISOString()).slice(0, 10);
    if (u && JSON.stringify(u.tit) === JSON.stringify(tit)) return;
    if (u && u.desde === desde) u.tit = tit; else h.push({desde, tit});
    if (h.length > 300) h.splice(0, h.length - 300);
  }
  function guardar() {
    apuntarOnce();
    clearTimeout(temporizador);
    estadoGuardado = 'Guardando…'; marcarEstado();
    temporizador = setTimeout(async () => {
      if (!LOCAL) {
        try { localStorage.setItem(clavePartida('fmhub-tactica'), JSON.stringify(t)); estadoGuardado = 'Guardada en este navegador'; } catch (e) { estadoGuardado = 'No se pudo guardar en este navegador'; }
        return marcarEstado();
      }
      try {
        const r = await fetch('api/tactica' + (PARTIDA.id ? '?partida=' + encodeURIComponent(PARTIDA.id) : ''), {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(t)});
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
      return `<div class="op"><span class="nro">${k === 0 ? 'Titular' : k + 1 + 'º'}</span><div class="opn">${jug(o.iu, nombre(o.iu))}<small>${natural ? '' : 'fuera de su puesto natural · '}${r.n ? `rinde ${d2(r.n)}` : 'sin partidos suficientes'}${r.pjA ? ` · ${r.pjA} partidos y ${miles(r.minA)} min esta temporada` : ''}${pr.fp ? ` · forma aquí ${d2(pr.fp.n)} (últ. ${r.nForma})` : ''}${pr.ep ? ` · aquí ${d2(pr.ep.n)} en ${pr.ep.pj} p.` : ''}${pr.ec ? ` · aquí antes ${d2(pr.ec.n)} en ${pr.ec.pj} p.` : ''}${pr.ev && !natural && pr.ev.pj <= 2 ? ` · ¡a probar aquí! ${d2(pr.ev.n)} en ${pr.ev.pj} p.` : ''}${pr.sinEst ? ` · sin ★: cuenta como ${verEst(pr.calidad)}${pr.calidad === 1 ? ' (sin nivel para el primer equipo)' : ''}` : ''}${pr.auto ? ` · <span title="Solo informativo: no se usa para la prioridad (mandan tus estrellas). Atributos para ${esc(PUESTOS[s.code] || s.code)}: ${d2(pr.auto.atributos)} sobre 20, frente a los que juegan este puesto en tu plantilla${pr.auto.ajuste ? ` · lo que rinde aquí: ${pr.auto.ajuste > 0 ? '+' : ''}${d2(pr.auto.ajuste)} estrellas` : ''}">FM Hub diría ${verEst(pr.auto.est)}</span>` : ''}${pr.media && pr.peso < .35 ? ' · pocos minutos: su media pesa poco' : ''}${otro} · <span title="Calidad ${d2(pr.calidad)} · peso de su media ${Math.round(pr.peso * 100)} % · rendimiento ${pr.rend >= 0 ? '+' : ''}${d2(pr.rend)} · puesto ${pr.encaje >= 0 ? '+' : ''}${d2(pr.encaje)}">prioridad ${d2(pr.total)}</span></small></div>
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
      <div class="tac-ord"><span class="mini">Ordenar todos los puestos:</span><button type="button" class="chip" data-tord="est">Por estrellas</button><button type="button" class="chip" data-tord="media">Por media</button><button type="button" class="chip" data-tord="mejor" title="Ordena cada puesto por prioridad (tus estrellas y lo que rinde: forma de los últimos 5 partidos, sobre todo en ese puesto, esta temporada, la anterior, su etapa en el club y lo que rindió en ese puesto en temporadas anteriores según los partidos capturados de FM; si es su puesto natural o uno que ya ha jugado mucho, y los minutos que lleva). Solo cambia un titular si hay un cambio sostenido, el mismo que propone «¿Cambiar algún titular?». Al terminar te enseña el resumen de cambios">Mejor opción</button>
        <span class="mini" id="tacEstado">${esc(estadoGuardado)}</span></div>
      <div class="tac"><div class="campo"><div class="campo-lineas"></div>${campo}</div>${editor}</div>
      ${vacia ? '' : cambios(R, nombre)}
      ${dondeRinden(nombre)}
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

  // ---------------------------------------------------------------- tras el último partido: dónde jugó cada uno
  // Un partido no cambia el plan de plantilla: aquí se ve dónde jugó cada uno y cuánto le mueve en ese puesto.
  // Solo se propone cambiar un titular si otro va claramente por delante ahora (MARGEN de prioridad) y ya iba por
  // delante antes de los N_SOSTENIDO últimos partidos: rendimiento sostenido, no un partidazo suelto.
  const N_SOSTENIDO = 3, MARGEN = .3;
  // partidos oficiales de esta temporada con notas por jugador, del más reciente al más antiguo
  function fechasOficiales() {
    return [...new Set((D.partido_jugador || []).filter(f => f.temporada === IDX.temporadaActual && f.tipo !== 'amistosos' && !f.varios && f.partidos && f.fecha).map(f => f.fecha))].sort().reverse();
  }
  // lo que hay que restar de las estadísticas de la temporada para quitar esos partidos
  function sinPartidos(fechas) {
    const quitar = {}, set = new Set(fechas);
    for (const f of D.partido_jugador || []) {
      if (!set.has(f.fecha) || f.temporada !== IDX.temporadaActual || f.tipo === 'amistosos' || f.varios || !f.partidos) continue;
      const q = (quitar[f.iu] ||= {partidos: 0, minutos: 0, sumaNota: 0, conNota: 0});
      q.partidos += f.partidos; q.minutos += f.minutos || 0;
      if (f.nota) { q.sumaNota += f.nota * f.partidos; q.conNota += f.partidos; }
    }
    return {fechas: set, quitar};
  }
  // cambios de titular sostenidos: [{i (puesto), x, tit, mejor, ahora: [prioridad del que entra, del titular]}]
  function cambiosSostenidos(R, ref) {
    const fechas = fechasOficiales(), props = [];
    if (fechas.length <= N_SOSTENIDO) return props;
    const Rn = rendimiento(sinPartidos(fechas.slice(0, N_SOSTENIDO))), refn = referencias(Rn);
    const ced = new Set(D.plantilla.filter(q => q.cedido_a).map(q => q.iu));
    const titularEn = {}; t.slots.forEach((x, i) => { if (x.opciones[0]) titularEn[x.opciones[0].iu] = i; });
    const vistos = new Set();
    t.slots.forEach((x, i) => {
      const tit = x.opciones[0];
      if (!tit || vistos.has(tit.iu)) return;
      vistos.add(tit.iu);
      const p = o => prioridad(o, x.code, R, ref).total, p0 = o => prioridad(o, x.code, Rn, refn).total;
      const mejor = x.opciones.slice(1).filter(o => !ced.has(o.iu) && titularEn[o.iu] === undefined).sort((a, b) => p(b) - p(a))[0];
      if (mejor && p(mejor) - p(tit) >= MARGEN && p0(mejor) > p0(tit)) props.push({i, x, tit, mejor, ahora: [p(mejor), p(tit)]});
    });
    return props;
  }
  function cambios(R, nombre) {
    const fechas = fechasOficiales();
    if (!fechas.length) return '';
    const fu = fechas[0], ref = referencias(R), R1 = rendimiento(sinPartidos([fu])), ref1 = referencias(R1);
    const pa = (D.partidos || []).find(x => x.fecha === fu);
    const rival = pa ? (pa.en_casa ? pa.visitante : pa.local) : '';
    const marcador = pa ? (pa.en_casa ? `${pa.goles_local}-${pa.goles_visitante}` : `${pa.goles_visitante}-${pa.goles_local}`) : '';
    const titulo = `Tras el último partido${pa ? `: ${marcador} ${pa.en_casa ? 'ante el' : 'en casa del'} ${esc(rival)}` : ''} (${fecha(fu)})`;
    const slotDe = code => t.slots.find(x => x.code === code);
    const jugaron = (D.partido_jugador || []).filter(f => f.fecha === fu && f.temporada === IDX.temporadaActual && f.tipo !== 'amistosos' && !f.varios && f.partidos)
      .sort((a, b) => (b.titular || 0) - (a.titular || 0) || (b.minutos || 0) - (a.minutos || 0));
    const filaJ = f => {
      const code = puestoDe(fu, f.iu, f.titular), s = code && slotDe(code), dj = dondeJugo(fu, f.iu) || {};
      const como = dj.fuente === 'heredada' ? `entró en el ${dj.entra}' por ${esc(nombre(dj.sustituye_a))}` : dj.fuente === 'FM' ? 'según FM' : dj.fuente || (code ? 'tu once' : '');
      // con el once leído de FM: su rol y deber reales y el lado en los puestos repetidos
      const real = dj.rol && (dj.fuente === 'FM' || dj.fuente === 'heredada') && /·/.test(dj.rol);
      const etiqueta = real ? `${esc(dj.rol)} · ${corto(code)}${dj.lado ? (dj.lado === 'I' ? ' izq.' : ' der.') : ''}` : s?.rol ? esc(s.rol) : corto(code);
      const donde = code ? `${etiqueta} <small>(${como})</small>` : f.titular ? 'Titular, sin puesto conocido' : 'Entró desde el banquillo';
      // cuánto le mueve este partido en el puesto donde jugó (si es una de tus opciones de ese puesto)
      const o = code && s?.opciones.find(x => x.iu === f.iu);
      let efecto = code ? '<small>no es opción de ese puesto en tu táctica</small>' : '<small>no se sabe dónde jugó: cuenta a medias en sus puestos</small>';
      if (o) {
        const d = prioridad(o, code, R, ref).total - prioridad(o, code, R1, ref1).total;
        efecto = Math.abs(d) < .005 ? '<small>sin cambio</small>' : `<b style="color:var(--${d > 0 ? 'w' : 'l'})">${d > 0 ? '+' : '−'}${d2(Math.abs(d))}</b> <small>de prioridad en ${corto(code)}</small>`;
      }
      return `<tr><td>${jug(f.iu, nombre(f.iu))}</td><td>${donde}</td><td class="n">${f.minutos || 0}</td><td class="n">${f.nota ? d2(f.nota) : '—'}</td><td>${efecto}</td></tr>`;
    };
    // ¿algún cambio de titular sostenido? (va antes que el detalle del último partido)
    const props = cambiosSostenidos(R, ref);
    const propsHtml = props.length ? `<div class="pgrid">${props.map(({x, tit, mejor, ahora}) => `<div class="card pc min"><span class="tag">Cambio sostenido · ${x.rol ? esc(x.rol) : corto(x.code)}</span><h4>${esc(nombre(mejor.iu))} por delante de ${esc(nombre(tit.iu))}</h4>
        <p>${jug(mejor.iu, nombre(mejor.iu))} tiene ${d2(ahora[0])} de prioridad en este puesto y tu titular, ${d2(ahora[1])}; y ya iba por delante antes de los ${N_SOSTENIDO} últimos partidos.</p></div>`).join('')}</div>
      <div class="fila-btn"><button type="button" class="btn" data-tord="mejor">Aplicar ${props.length === 1 ? 'este cambio' : `estos ${props.length} cambios`} (Mejor opción)</button><span class="mini">Cambia esos titulares, ordena al resto de cada puesto por prioridad y te enseña el resumen para hacerlo en el juego.</span></div>`
      : `<p class="mini">${fechas.length > N_SOSTENIDO ? `Nada que cambiar en tu once.` : `Aún hay pocos partidos oficiales esta temporada para hablar de tendencias.`} Solo se propone un cambio de titular cuando otro va claramente por delante en ese puesto (${d2(MARGEN)} de prioridad o más) y ya iba por delante antes de los ${N_SOSTENIDO} últimos partidos: un partido suelto no basta.</p>`;
    return `<h4>¿Cambiar algún titular?</h4>${propsHtml}
      <h4>${titulo}</h4>
      <p class="sub" style="margin:0 0 8px">Dónde jugó cada uno y cuánto le mueve el partido en ese puesto. Lo que hace en un puesto cuenta entero solo para ese puesto (a medias si no se sabe dónde jugó y un cuarto para sus otros puestos), así que un partidazo de extremo no le pone primero de delantero. Tu orden no se toca.</p>
      ${jugaron.length ? `<div class="tw"><table class="tvis"><thead><tr><th>Jugador</th><th>Dónde jugó</th><th class="n">Min</th><th class="n">Nota</th><th>Efecto en ese puesto</th></tr></thead><tbody>${jugaron.map(filaJ).join('')}</tbody></table></div>` : ''}
      <p class="mini" style="margin:6px 0 0">«Dónde jugó»: los titulares, por el once que FM Hub leyó del juego antes del partido (puesto, rol y deber reales: «según FM»); si no lo tiene, por tu once guardado aquí o el hueco de tu táctica que mejor les encaja. Los suplentes heredan el puesto del jugador por el que entran (se sabe por los minutos).</p>
`;
  }

  // lo mismo que «¿Cambiar algún titular?» y «Tras el último partido», resumido para la pastilla de FM Hub en directo
  // (vivo.js): {fecha, titulo, props: [{puesto, entra, sale, ahora}], jugaron: [{iu, nombre, donde, min, nota}]} o null
  function avisoUltimo() {
    cargarTactica();
    const fechas = fechasOficiales();
    if (!fechas.length) return null;
    const fu = fechas[0], R = rendimiento(), ref = referencias(R);
    const nombre = iu => (D.plantilla.find(p => p.iu === iu) || {}).nombre || IDX.nombres[iu] || '¿?';
    const pa = (D.partidos || []).find(x => x.fecha === fu);
    const rival = pa ? (pa.en_casa ? pa.visitante : pa.local) : '';
    const marcador = pa ? (pa.en_casa ? `${pa.goles_local}-${pa.goles_visitante}` : `${pa.goles_visitante}-${pa.goles_local}`) : '';
    const props = t.slots.some(x => x.opciones.length) ? cambiosSostenidos(R, ref).map(({x, tit, mejor, ahora}) =>
      ({puesto: x.rol || corto(x.code), entra: nombre(mejor.iu), sale: nombre(tit.iu), ahora})) : null;
    const jugaron = (D.partido_jugador || []).filter(f => f.fecha === fu && f.tipo !== 'amistosos' && !f.varios && f.partidos)
      .sort((a, b) => (b.titular || 0) - (a.titular || 0) || (b.minutos || 0) - (a.minutos || 0))
      .map(f => { const dj = dondeJugo(fu, f.iu) || {}, code = puestoDe(fu, f.iu, f.titular);
        return {iu: f.iu, nombre: nombre(f.iu), donde: code ? corto(code) + (dj.lado ? (dj.lado === 'I' ? ' izq.' : ' der.') : '') : (f.titular ? '¿?' : 'suplente'),
                entra: dj.fuente === 'heredada' || (!f.titular && dj.entra) ? dj.entra : null, min: f.minutos || 0, nota: f.nota}; });
    const brillaron = (D.partido_jugador || []).filter(f => f.fecha === fu && f.tipo !== 'amistosos' && !f.varios && f.partidos && f.nota && (f.minutos || 0) >= 45)
      .map(f => ({f, code: puestoDe(fu, f.iu, f.titular), propia: mediaPropia(R[f.iu] || {})}))
      .filter(x => x.code && x.propia && !posDe(x.f.iu).has(x.code) && x.f.nota >= x.propia + .5)
      .map(x => ({nombre: nombre(x.f.iu), puesto: corto(x.code), nota: x.f.nota, propia: x.propia}));
    return {fecha: fu, titulo: `${marcador} ${pa ? (pa.en_casa ? 'ante el ' : 'en casa del ') + rival : ''}`.trim(), props, jugaron, brillaron, pocos: fechas.length <= N_SOSTENIDO};
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
    else if (ds.tord) { const antes = t.slots.map(x => x.opciones.map(o => o.iu)); ordenarTodo(ds.tord); guardar(); pintar(); resumenCambios(antes, ds.tord); return; }
    else if (ds.tcopiar !== undefined) { const txt = document.getElementById('tacResumen')?.innerText || ''; navigator.clipboard?.writeText(txt).then(() => { b.textContent = 'Copiado'; }, () => {}); return; }
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

  // ---------------------------------------------------------------- resumen de lo que cambia al ordenar (para hacerlo en FM)
  const MODOS = {est: 'Por estrellas', media: 'Por media', mejor: 'Mejor opción'};
  function resumenCambios(antes, modo) {
    const nombre = iu => (D.plantilla.find(p => p.iu === iu) || {}).nombre || IDX.nombres[iu] || '¿?';
    const puesto = x => `${x.rol ? x.rol + ' · ' : ''}${corto(x.code)}`;
    const filas = t.slots.map((x, i) => ({x, a: antes[i] || [], d: x.opciones.map(o => o.iu)})).filter(f => f.a.join() !== f.d.join());
    const titulares = filas.filter(f => f.a[0] !== f.d[0]);
    // en «Ahora», cuántos puestos sube (▲) o baja (▼) cada uno respecto a antes
    const lista = (l, antes) => `<ol class="tac-ol">${l.map((iu, k) => { const k0 = antes ? antes.indexOf(iu) : k, d = k0 < 0 ? 0 : k0 - k;
      return `<li>${esc(nombre(iu))}${d > 0 ? ` <span class="up">▲${d}</span>` : d < 0 ? ` <span class="dn">▼${-d}</span>` : ''}</li>`; }).join('')}</ol>`;
    const html = !filas.length ? '<p>Tu orden ya era ese: no hay nada que cambiar.</p>' : `<div id="tacResumen">
      <h4 style="margin-top:0">En el juego: ${titulares.length ? (titulares.length === 1 ? '1 cambio de titular' : titulares.length + ' cambios de titular') : 'los mismos titulares'}</h4>
      ${titulares.length ? `<ul class="facts" style="grid-template-columns:1fr">${titulares.map(f => `<li><b>${esc(puesto(f.x))}</b>: sale ${esc(nombre(f.a[0]))}, entra <b>${esc(nombre(f.d[0]))}</b></li>`).join('')}</ul>` : '<p class="mini">Solo cambia el orden de los suplentes de algún puesto.</p>'}
      <h4>Orden de cada puesto que cambia</h4>
      <div class="tw"><table class="tvis"><thead><tr><th>Puesto</th><th>Antes</th><th>Ahora</th></tr></thead><tbody>
      ${filas.map(f => `<tr><td><b>${esc(puesto(f.x))}</b></td><td>${lista(f.a)}</td><td>${lista(f.d, f.a)}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="fila-btn"><button type="button" class="btn sec" data-tcopiar>Copiar el resumen</button></div>`;
    $('#mT').textContent = 'Cambios en tu táctica';
    $('#mS').textContent = `${MODOS[modo] || modo}${modo === 'mejor' ? ': solo cambia titulares donde hay un cambio sostenido; el resto de cada puesto, por prioridad' : ''}`;
    $('#mB').innerHTML = html;
    ficha.iu = null;
    if ($('#modal').hidden) { ficha.foco = document.activeElement; $('#modal').hidden = false; document.body.style.overflow = 'hidden'; $('#modal').scrollTop = 0; $('#mX').focus(); }
  }

  // ---------------------------------------------------------------- dónde rinde mejor cada uno
  // por puesto: partidos oficiales jugados ahí (de titular o heredando el puesto), minutos, nota media y goles
  function porPuesto(iu) {
    const g = {};
    for (const f of D.partido_jugador || []) {
      if (f.iu !== iu || f.varios || !f.fecha || !f.partidos || f.tipo === 'amistosos') continue;
      const code = puestoDe(f.fecha, iu, f.titular);
      if (!code) continue;
      const o = (g[code] ||= {code, pj: 0, min: 0, sn: 0, nn: 0, g: 0, a: 0, her: 0, temps: new Set()});
      o.pj++; o.min += f.minutos || 0; o.g += f.goles || 0; o.a += f.asistencias || 0; o.temps.add(f.temporada);
      if (dondeJugo(f.fecha, iu)?.fuente === 'heredada') o.her++;
      if (f.nota) { o.sn += f.nota; o.nn++; }
    }
    // partidos sin datos partido a partido (anteriores a FM Hub) pero con su informe capturado de FM
    const conPj = new Set((D.partido_jugador || []).filter(f => f.iu === iu && !f.varios).map(f => f.fecha));
    for (const r of D.partido_informe || []) {
      if (r.iu !== iu || conPj.has(r.fecha) || !r.puesto) continue;
      const p = IDX.partidos.find(x => x.fecha === r.fecha);
      if (p && !p.oficial) continue;
      const o = (g[r.puesto] ||= {code: r.puesto, pj: 0, min: 0, sn: 0, nn: 0, g: 0, a: 0, her: 0, temps: new Set()});
      o.pj++; o.min += r.minutos || 0; o.g += r.goles || 0; if (p) o.temps.add(p.temporada);
      if (r.nota) { o.sn += r.nota; o.nn++; }
    }
    return Object.values(g).map(o => ({...o, nota: o.nn ? o.sn / o.nn : null})).sort((a, b) => b.min - a.min);
  }
  const PJ_FIABLE = 3;   // partidos con nota en un puesto para fiarse de su media ahí
  // estrellas de FM Hub en cada puesto (las 6 mejores), para la ficha del jugador
  function estrellasPorPuesto(iu) {
    const R = rendimiento(), ref = referencias(R);
    return Object.keys(PUESTOS).filter(c => c !== 'POR' || posDe(iu).has('POR'))
      .map(code => ({code, a: estrellasAuto(iu, code, R, ref)})).filter(x => x.a).sort((a, b) => b.a.est - a.a.est || b.a.atributos - a.a.atributos);
  }
  function estrellasHtml(iu) {
    const l = estrellasPorPuesto(iu).slice(0, 6);
    return l.length ? `<h4>Estrellas por puesto</h4><p class="meta">${l.map(x => `<span title="Atributos para el puesto: ${d2(x.a.atributos)} sobre 20${x.a.ajuste ? ` · lo que ha rendido ahí: ${x.a.ajuste > 0 ? '+' : ''}${d2(x.a.ajuste)}` : ''}">${corto(x.code)} <b>${verEst(x.a.est)}</b></span>`).join('')}</p>
      <p class="mini">Las que le pondría FM Hub en cada puesto: sus atributos de FM para lo que pide ese puesto, frente a los que juegan ese puesto en tu plantilla y frente a su mejor puesto, y lo que ha rendido de verdad ahí. Solo informativas: en la táctica mandan las tuyas.</p>` : '';
  }
  function porPuestoHtml(iu) {
    const l = porPuesto(iu);
    if (!l.length) return estrellasHtml(iu);
    const fiables = l.filter(o => o.nn >= PJ_FIABLE), mejor = fiables.length > 1 ? [...fiables].sort((a, b) => b.nota - a.nota)[0] : null;
    return `${estrellasHtml(iu)}<h4>Por puesto</h4><div class="tw"><table class="tvis"><thead><tr><th>Puesto</th><th class="n">PJ</th><th class="n">Min</th><th class="n">Nota</th><th class="n">G</th><th class="n">A</th><th class="n">Entrando de suplente</th></tr></thead><tbody>
      ${l.map(o => `<tr><td>${esc(PUESTOS[o.code] || o.code)} <small>${corto(o.code)}</small>${mejor && o === mejor ? ' <span class="acc ok">Donde mejor rinde</span>' : ''}</td><td class="n">${o.pj}</td><td class="n">${miles(o.min)}</td><td class="n">${o.nota ? d2(o.nota) + (o.nn < PJ_FIABLE ? ' <small>(pocos)</small>' : '') : '—'}</td><td class="n">${o.g}</td><td class="n">${o.a}</td><td class="n">${o.her || '—'}</td></tr>`).join('')}</tbody></table></div>
      <p class="mini">Partidos oficiales desde que FM Hub lee partido a partido, más los capturados de FM con «Capturar partidos» (con su puesto real). En el resto, el puesto lo calcula FM Hub (el once leído de FM o tu once guardado; los suplentes heredan el del jugador por el que entran).</p>`;
  }
  // la plantilla entera: puesto más jugado y puesto donde mejor rinde (si son distintos, es una pista)
  function dondeRinden(nombre) {
    const filas = D.plantilla.filter(p => !p.cedido_a).map(p => {
      const l = porPuesto(p.iu), fiables = l.filter(o => o.nn >= PJ_FIABLE);
      const mas = l[0], mejor = fiables.length ? [...fiables].sort((a, b) => b.nota - a.nota)[0] : null;
      return {p, l, mas, mejor};
    }).filter(f => f.mas);
    if (!filas.length && !pruebas(rendimiento()).length) return '';
    filas.sort((a, b) => (b.mejor && b.mas && b.mejor !== b.mas) - (a.mejor && a.mas && a.mejor !== a.mas) || b.mas.min - a.mas.min);
    const prs = pruebas(rendimiento());
    const probar = prs.length ? `<h5>Para probar</h5><ul class="facts">${prs.slice(0, 8).map(x => `<li>${jug(x.iu, nombre(x.iu))} de <b>${corto(x.code)}</b>: ${d2(x.n)} en ${x.pj} ${x.pj === 1 ? 'partido' : 'partidos'} (su media, ${d2(x.propia)}), y no es su puesto. Ya sube en sus opciones de ese puesto; si repite, más.</li>`).join('')}</ul>` : '';
    return `<h4>Dónde rinde mejor cada uno</h4>${probar}<p class="sub" style="margin:0 0 8px">Por puesto jugado en los partidos oficiales (de titular o entrando por otro). Arriba, los que rinden mejor en un puesto distinto del que más juegan.</p>
      <div class="tw"><table class="tvis"><thead><tr><th>Jugador</th><th>Más jugado</th><th>Donde mejor rinde</th><th>Todos los puestos</th></tr></thead><tbody>
      ${filas.map(({p, l, mas, mejor}) => `<tr><td>${jug(p.iu, nombre(p.iu))}</td><td>${corto(mas.code)} <small>${mas.pj} p.${mas.nota ? ' · ' + d2(mas.nota) : ''}</small></td>
        <td>${mejor ? `${mejor !== mas ? '<b>' : ''}${corto(mejor.code)}${mejor !== mas ? '</b>' : ''} <small>${d2(mejor.nota)} en ${mejor.nn} p.</small>` : '<small>pocos partidos</small>'}</td>
        <td class="mini">${l.map(o => `${corto(o.code)} ${o.pj}${o.nota ? ' (' + d2(o.nota) + ')' : ''}`).join(' · ')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  return {vista, posiciones, porPuestoHtml, avisoUltimo, estrellasPorPuesto, porPuesto, PUESTOS, corto};
})();
