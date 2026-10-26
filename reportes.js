// FM Hub · Reportar un error: pulsas «Reportar», tocas lo que está mal en la página y escribes qué debería poner.
// El reporte lleva lo que se ve, dónde está (sección, apartado, fila), en qué parte del código se pinta y la
// versión de los datos, y se abre como issue en el repositorio del programa (fmhubapp, privado) o se copia, para que
// Claude busque la causa en el código en vez de cambiar solo el número. «Enviar» se lo pasa a FM Hub (api/reportes),
// que lo apunta en data/reportes.jsonl y abre el issue solo con la clave de GitHub; desde la web publicada, también
// si FM Hub está abierto en este PC. Si no se puede, enlace a GitHub con el reporte relleno. Los enviados se recuerdan en este navegador.
// Usa las utilidades de app.js (D, IDX, esc, fecha, leer, apuntar, versionActual, PARTIDA, ficha). Se carga después.
'use strict';

const REP = (() => {
  // dónde mirar en el código según la sección (ruta del menú)
  const CODIGO = {
    inicio: 'app.js → V.inicio, novedades(), cifrasClave(), estadoHtml()', viaje: 'historia.js → viaje(), titulos(), recorridos()',
    temporadas: 'historia.js → temporadas(), plantillaDe(), narrativa()', plantilla: 'app.js → V.plantilla (y preparar() si falta alguien)',
    historial: 'app.js → V.historial', partidos: 'app.js → V.partidos, golesTexto()', rivales: 'historia.js → rivales()', goles: 'historia.js → goles()',
    hitos: 'historia.js → hitos(), mejorOnce(), totalesClub()', traspasos: 'app.js → V.traspasos, preparar() (filtro de traspasos) · historia.js → rentabilidad()',
    finanzas: 'app.js → V.finanzas · historia.js → economia()', plan: 'historia.js → plan(), renovaciones()',
    tactica: 'tactica.js → vista(), cambios(), consejos(), vistazo(), prioridad()', progreso: 'app.js → V.progreso, difsAtr()',
    curiosidades: 'curiosidades.js → vistaCuriosidades()', jugador: 'app.js → V.jugador · historia.js → trayectoria(), records()', comparar: 'app.js → V.comparar · tactica.js → estrellasPorPuesto(), porPuesto()',
  };
  // los issues van al repositorio con el código del programa (el de la web publicada solo recibe los datos)
  const REPO = 'https://github.com/gu3pard0/fmhubapp';
  // a dónde se mandan: a FM Hub (la web local, o desde la publicada el de este PC); la copia autocontenida no tiene
  const DESTINO = window.FMHUB_ESTATICO ? null : window.FMHUB_PUBLICADO ? 'http://127.0.0.1:8765/api/reportes' : 'api/reportes';
  const PIEZAS = 'td,th,li,.tri,.kpi,.big,.pod,.trofeo,.op,.slot,.it,.arow,.pc,.cur,p,h2,h3,h4,h5,h6,.pill,.tab,.chip,svg';
  let activo = false, marcado = null;

  const texto = el => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
  // los títulos tal cual están escritos (innerText los devuelve en mayúsculas si el estilo los pone así)
  const titulo = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const corta = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
  // el último título (h4/h5) que aparece antes del elemento en la página: el apartado donde está
  function apartado(el) {
    const raiz = el.closest('section') || document.body;
    let ultimo = null;
    for (const h of raiz.querySelectorAll('h3,h4,h5')) { if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING || h.contains(el)) ultimo = h; }
    return ultimo ? titulo(ultimo) : '';
  }
  function contexto(el) {
    const [ruta] = (location.hash.slice(1) || 'inicio').split('/');
    const enFicha = !!el.closest('#modal');
    const seccion = enFicha ? `Ficha de ${titulo(document.getElementById('mT'))}` : titulo(el.closest('section')?.querySelector('h2')) || ruta;
    const fila = el.closest('tr,.tri,.op,li');
    const cab = fila?.closest('table')?.querySelector('thead tr');
    const col = el.closest('td,th') && cab ? titulo(cab.children[[...fila.children].indexOf(el.closest('td,th'))]) : '';
    return {seccion, apartado: apartado(el), ruta: location.hash || '#inicio', fila: fila ? corta(texto(fila), 400) : '', columna: col,
            codigo: CODIGO[enFicha ? 'jugador' : ruta] || `vista «${ruta}»`, pone: corta(texto(el), 600)};
  }

  // ---------------------------------------------------------------- modo «toca lo que está mal»
  function empezar() {
    activo = true;
    document.body.classList.add('rep-modo');
    barra(`Toca lo que está mal en la página · <button type="button" class="chip" data-repgen>Es algo general</button> <button type="button" class="chip" data-repfin>Cancelar</button>`);
  }
  function terminar() {
    activo = false;
    document.body.classList.remove('rep-modo');
    marcado?.classList.remove('rep-sobre'); marcado = null;
    document.getElementById('rep-barra')?.remove();
  }
  function barra(html) {
    let b = document.getElementById('rep-barra');
    if (!b) { b = document.createElement('div'); b.id = 'rep-barra'; b.setAttribute('role', 'status'); document.body.appendChild(b); }
    b.innerHTML = html;
  }
  // lo más pequeño que tenga sentido: el propio texto tocado si es corto (un precio, una fecha), si no su bloque
  const pieza = t => {
    if (t.closest('#rep-boton,#rep-barra,#rep-dlg,#ver-burbuja')) return null;
    if (t.nodeType === 1 && !t.matches('section,main,div.wrap,body,html') && !t.querySelector('div,p,table,ul') && texto(t).length && texto(t).length <= 80) return t;
    return t.closest(PIEZAS) || t;
  };
  document.addEventListener('mouseover', ev => {
    if (!activo) return;
    const p = pieza(ev.target);
    if (p === marcado) return;
    marcado?.classList.remove('rep-sobre'); marcado = p; p?.classList.add('rep-sobre');
  });
  // en modo reporte el toque no abre enlaces ni pulsa botones: elige qué reportar
  document.addEventListener('click', ev => {
    if (ev.target.closest('[data-repfin]')) { terminar(); return; }
    if (ev.target.closest('[data-repgen]')) {   // algo de toda la web o una idea, no de un sitio concreto (#97)
      terminar();
      dialogo({general: true, seccion: 'General (toda la web)', apartado: '', ruta: location.hash || '#inicio', fila: '', columna: '',
               codigo: 'general: toda la web (app.js, historia.js, tactica.js, vivo.js…) o FM Hub', pone: ''});
      return;
    }
    if (!activo) return;
    const p = pieza(ev.target);
    if (!p) return;
    ev.preventDefault(); ev.stopPropagation();
    const c = contexto(p);
    terminar();
    dialogo(c);
  }, true);
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape') return;
    if (activo) terminar();
    else if (document.getElementById('rep-dlg')) cerrar();
  });

  // ---------------------------------------------------------------- formulario
  function dialogo(c) {
    cerrar();
    const d = document.createElement('div');
    d.id = 'rep-dlg'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'rep-t');
    const enviados = leer('fmhub-reportes', []) || [];
    d.innerHTML = `<form class="rep-c" novalidate>
      <h3 id="rep-t">Reportar un error</h3>
      <p class="mini">${esc(c.seccion)}${c.apartado ? ' · ' + esc(c.apartado) : ''}${c.columna ? ' · columna «' + esc(c.columna) + '»' : ''}</p>
      ${c.general ? '<input type="hidden" name="pone" value="">' : `<label>Lo que pone<textarea name="pone" rows="3">${esc(c.pone)}</textarea></label>`}
      <label>${c.general ? 'Qué pasa o qué cambiarías' : 'Lo que debería poner'}<textarea name="deberia" rows="${c.general ? 5 : 3}" placeholder="${c.general ? 'p. ej. «tarda mucho en actualizarse» o «estaría bien poder…»' : 'p. ej. «194.586 €, vendido el 18 jul 2028»'}" required></textarea></label>
      <label>Por qué lo sabes o qué más ves raro <span class="mini">(opcional)</span><textarea name="por" rows="2" placeholder="p. ej. «en FM, en el historial de traspasos, sale así»"></textarea></label>
      <p class="mini">Se manda con la sección, la fila, la parte del código que lo pinta (${esc(c.codigo)}) y la versión de los datos, para que se arregle la causa y no solo el número.</p>
      <p class="rep-err mini" hidden>Escribe qué debería poner.</p>
      <div class="fila-btn"><button class="btn" type="submit" value="github">Enviar</button><button class="btn sec" type="submit" value="copiar">Copiar texto</button><button class="btn sec" type="button" data-repx>Cancelar</button></div>
      ${enviados.length ? `<details class="cant"><summary>Enviados desde este navegador · ${enviados.length}</summary><ul class="rep-lista">${enviados.slice(-10).reverse().map(r => `<li><time>${esc(new Date(r.cuando).toLocaleString('es-ES', {dateStyle: 'short', timeStyle: 'short'}))}</time> ${esc(r.titulo)}</li>`).join('')}</ul></details>` : ''}
    </form>`;
    document.body.appendChild(d);
    document.body.style.overflow = 'hidden';
    d.querySelector('[name=deberia]').focus();
    d.addEventListener('click', ev => { if (ev.target === d || ev.target.closest('[data-repx]')) cerrar(); });
    d.querySelector('form').addEventListener('submit', async ev => {
      ev.preventDefault();
      const f = ev.target, como = ev.submitter?.value || 'github';
      const r = {...c, pone: f.pone.value.trim(), deberia: f.deberia.value.trim(), por: f.por.value.trim()};
      if (!r.deberia) { f.querySelector('.rep-err').hidden = false; f.deberia.focus(); return; }
      const titulo = corta(c.general ? `Reporte general: ${r.deberia}` : `Reporte: ${r.seccion}${r.apartado ? ' · ' + r.apartado : ''} — «${r.pone || '…'}» debería ser «${r.deberia}»`, 140);
      const cuerpo = cuerpoIssue(r);
      apuntar('fmhub-reportes', [...enviados, {cuando: new Date().toISOString(), titulo}].slice(-50));
      // a FM Hub: lo apunta en el PC (data/reportes.jsonl) y, con «Enviar», abre el issue en GitHub solo. Desde la web
      // publicada también, si FM Hub está abierto en este PC; si no se puede, se abre GitHub con el reporte relleno
      const destino = DESTINO;
      const datos = {titulo, cuerpo, ...r, version: versionActual(), partida: PARTIDA.id};
      const mandar = enviar => destino ? fetch(destino, {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({...datos, enviar}), signal: AbortSignal.timeout?.(40000)}).then(x => x.json()) : Promise.reject(new Error('sin FM Hub'));
      if (como === 'copiar') {
        if (!window.FMHUB_PUBLICADO) mandar(false).catch(() => {});
        const listo = () => { cerrar(); aviso('Reporte copiado: pégalo en tu conversación con Claude.'); };
        (navigator.clipboard?.writeText(`${titulo}\n\n${cuerpo}`) || Promise.reject()).then(listo, () => { f.pone.value = `${titulo}\n\n${cuerpo}`; f.pone.select(); aviso('No se pudo copiar solo: el texto está seleccionado arriba.'); });
        return;
      }
      const url = `${REPO}/issues/new?labels=reporte&title=${encodeURIComponent(titulo)}&body=${encodeURIComponent(corta(cuerpo, 6000))}`;
      if (!destino) {   // copia autocontenida: sin FM Hub detrás, como siempre
        window.open(url, '_blank', 'noopener');
        cerrar();
        return aviso('Se abre GitHub con el reporte relleno: dale a «Submit new issue».');
      }
      const boton = ev.submitter; if (boton) { boton.disabled = true; boton.textContent = 'Enviando…'; }
      let res = null;
      try { res = await mandar(true); } catch (e) { res = {error: window.FMHUB_PUBLICADO ? 'FM Hub no está abierto en este PC' : 'sin respuesta de FM Hub', sinFMHub: true}; }
      cerrar();
      if (res?.sinFMHub) {
        // sin FM Hub al alcance: se queda en este navegador y se manda solo en cuanto lo esté (#94)
        apuntar('fmhub-rep-pendientes', [...(leer('fmhub-rep-pendientes', []) || []), {...datos, cuando: new Date().toISOString()}].slice(-30));
        barra(`Reporte guardado en este navegador: se enviará solo en cuanto abras esta web con FM Hub abierto en este PC. Si lo quieres ya: <a href="${esc(url)}" target="_blank" rel="noopener">abrir en GitHub con el reporte relleno</a>. <button type="button" class="chip" data-repfin>Vale</button>`);
      } else if (res?.issue) {
        const n = res.issue.split('/').pop();
        barra(`Reporte enviado: <a href="${esc(res.issue)}" target="_blank" rel="noopener">issue #${esc(n)}</a>. Ya no hace falta nada más. <button type="button" class="chip" data-repfin>Vale</button>`);
      } else {
        barra(`No se pudo enviar solo (${esc(res?.error || 'error')}). <a href="${esc(url)}" target="_blank" rel="noopener">Abrir en GitHub con el reporte relleno</a> y dale a «Submit new issue». <button type="button" class="chip" data-repfin>Vale</button>`);
      }
    });
  }
  function cerrar() { document.getElementById('rep-dlg')?.remove(); if (document.getElementById('modal')?.hidden !== false) document.body.style.overflow = ''; }
  function aviso(t) { barra(`${esc(t)} <button type="button" class="chip" data-repfin>Vale</button>`); setTimeout(() => { if (!activo) document.getElementById('rep-barra')?.remove(); }, 6000); }

  function cuerpoIssue(r) {
    const datos = D ? `datos.json del ${D.generado.replace('T', ' ').slice(0, 16)} · ${versionActual()} · ${IDX.temporadaActual}${IDX.fechaJuego ? ' (' + fecha(IDX.fechaJuego) + ' en el juego)' : ''}` : 'sin datos';
    return [
      `**Sección:** ${r.seccion} (\`${r.ruta}\`)${r.apartado ? ` · apartado «${r.apartado}»` : ''}${r.columna ? ` · columna «${r.columna}»` : ''}`,
      r.general ? '' : `**Lo que pone:** ${r.pone || '(vacío)'}`,
      r.general ? `**Qué pasa o qué cambiaría:** ${r.deberia}` : `**Lo que debería poner:** ${r.deberia}`,
      r.por ? `**Por qué / más detalles:** ${r.por}` : '',
      r.fila && r.fila !== r.pone ? `**Fila completa:** ${r.fila}` : '',
      `**Dónde se pinta:** ${r.codigo}`,
      `**Datos:** ${datos}${PARTIDA.id ? ' · partida ' + PARTIDA.id : ''}`,
      '',
      '> Para Claude: no cambies solo este número. Busca en el código (y en cómo FM Hub lee o guarda ese dato) qué produce este texto, arregla la causa y comprueba que no pasa lo mismo en otras secciones.',
    ].filter(x => x !== '').join('\n\n');
  }

  // los reportes que no se pudieron enviar (FM Hub cerrado, #94): en cuanto FM Hub responde desde este navegador, se mandan
  let vaciando = false;
  async function vaciarPendientes() {
    const pend = leer('fmhub-rep-pendientes', []) || [];
    if (!DESTINO || !pend.length || vaciando) return;
    vaciando = true;
    const quedan = [], hechos = [];
    for (const p of pend) {
      try {
        const res = await fetch(DESTINO, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...p, enviar: true}),
                                          signal: AbortSignal.timeout?.(40000)}).then(x => x.json());
        hechos.push(res.issue || null);   // FM Hub ya lo tiene (si GitHub falló, queda en su data/reportes.jsonl)
      } catch (e) { quedan.push(p); }
    }
    apuntar('fmhub-rep-pendientes', quedan);
    vaciando = false;
    if (hechos.length) {
      const enl = hechos.filter(Boolean).map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">#${esc(u.split('/').pop())}</a>`).join(', ');
      barra(`${hechos.length === 1 ? 'Enviado el reporte que estaba pendiente' : `Enviados ${hechos.length} reportes que estaban pendientes`}${enl ? ': ' + enl : ''}. <button type="button" class="chip" data-repfin>Vale</button>`);
    }
  }
  setTimeout(vaciarPendientes, 3000);
  setInterval(vaciarPendientes, 120000);

  // botón fijo (abajo a la izquierda: abajo a la derecha está la pastilla de FM Hub en directo)
  const b = document.createElement('button');
  b.id = 'rep-boton'; b.type = 'button'; b.className = 'rep-boton'; b.title = 'Reportar un error: toca lo que está mal y escribe qué debería poner';
  b.innerHTML = '<span aria-hidden="true">⚑</span> Reportar un error';
  b.addEventListener('click', ev => { ev.stopPropagation(); activo ? terminar() : empezar(); });
  document.body.appendChild(b);

  return {empezar, terminar};
})();
