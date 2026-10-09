/*
 * Modelo preliminar de ROI por costo-hora de usuario (Autodesk México, precios sin IVA).
 * Se usa en index.html (PDF del resumen ejecutivo) y en diagnosticos.html (consulta).
 * Los precios y supuestos reflejan modelo_roi_autodesk.xlsx. Es una estimación preliminar.
 */
(function (root) {
  var SUPUESTOS = {
    factorCosto: 1.35,          // prestaciones y cargas
    horasProductivas: 2000,     // horas al año por persona
    semanas: 48,                // semanas laborales al año
    sueldoGenerador: 300000,    // referencia, MXN al año
    sueldoConsultor: 300000,    // referencia, MXN al año
    anosDepreciacion: 4,
    equipoBaja: 45000,          // MXN sin IVA
    equipoMedia: 70869,         // MXN sin IVA
    horasAhorradasSemana: 10,   // horas por persona por semana
    tasaDescuento: 0.12,
    anosAnalisis: 3
  };

  var PRECIOS = {
    aec: 39547,                 // AEC Collection, MXN/año por usuario
    formaBuildEssentials: 8603,
    infraworks: 26920,
    navisworks: 14310,
    bimCollaboratePro: 13765,
    formaDataManagement: 6730
  };

  var NIVELES_IMPLEMENTACION = [
    { clave: 'estandar', nombre: 'Estandarizar y entrenar', costo: 300000, meses: 5 },
    { clave: 'medio', nombre: 'Flujos definidos y colaboración con Forma', costo: 600000, meses: 10 },
    { clave: 'avanzado', nombre: 'Procesos de construcción hasta as built / gemelo digital', costo: 1000000, meses: 14 }
  ];

  function countUsers(users, role) {
    var total = 0;
    Object.keys(users || {}).forEach(function (phase) {
      var n = Number((users[phase] || {})[role]);
      if (isFinite(n) && n > 0) total += Math.floor(n);
    });
    return total;
  }

  var TIPO_CAMBIO = 19; // MXN por USD

  function usd(mxn) { return Math.round((Number(mxn) || 0) / TIPO_CAMBIO); }

  function fmt(n) { return 'USD ' + usd(n).toLocaleString('en-US'); }

  // users: { 'pre-project': {creators, consumers}, design: {...}, execution: {...}, 'post-project': {...} }
  function calcular(users) {
    var s = SUPUESTOS;
    var creadoresPre = Number(((users || {})['pre-project'] || {}).creators) || 0;
    var creadoresDisenoEjec = (Number(((users || {}).design || {}).creators) || 0) +
                              (Number(((users || {}).execution || {}).creators) || 0);
    var creadoresPost = Number(((users || {})['post-project'] || {}).creators) || 0;
    var consultores = countUsers(users, 'consumers');

    var costoHora = s.sueldoGenerador * s.factorCosto / s.horasProductivas;
    var costoHoraConsultor = s.sueldoConsultor * s.factorCosto / s.horasProductivas;
    var horasAno = s.horasAhorradasSemana * s.semanas;
    var equipoMedia = s.equipoMedia / s.anosDepreciacion;
    var equipoBaja = s.equipoBaja / s.anosDepreciacion;

    var perfiles = [
      { nombre: 'Generador pre-proyecto', personas: creadoresPre, productos: 'Forma Build Essentials + InfraWorks', licencia: PRECIOS.formaBuildEssentials + PRECIOS.infraworks, equipo: equipoMedia, equipoGama: 'media', hora: costoHora },
      { nombre: 'Generador diseño y ejecución', personas: creadoresDisenoEjec, productos: 'AEC Collection', licencia: PRECIOS.aec, equipo: equipoMedia, equipoGama: 'media', hora: costoHora },
      { nombre: 'Generador post-proyecto', personas: creadoresPost, productos: 'BIM Collaborate Pro (incluye Tandem)', licencia: PRECIOS.bimCollaboratePro, equipo: equipoBaja, equipoGama: 'baja', hora: costoHora },
      { nombre: 'Consultor (solo consulta)', personas: consultores, productos: 'Forma Data Management', licencia: PRECIOS.formaDataManagement, equipo: equipoBaja, equipoGama: 'baja', hora: costoHoraConsultor }
    ];

    var personas = 0, costoAnual = 0, beneficioAnual = 0;
    perfiles = perfiles.map(function (p) {
      var costoPersona = p.licencia + p.equipo;
      var costo = costoPersona * p.personas;
      var beneficio = horasAno * p.hora * p.personas;
      personas += p.personas;
      costoAnual += costo;
      beneficioAnual += beneficio;
      return {
        nombre: p.nombre,
        productos: p.productos,
        personas: p.personas,
        licenciaPersona: Math.round(p.licencia),
        equipoPersona: Math.round(p.equipo),
        equipoGama: p.equipoGama,
        costoPersona: Math.round(costoPersona),
        costoTotal: Math.round(costo),
        beneficioTotal: Math.round(beneficio),
        horasEquilibrio: p.hora > 0 ? Math.round(costoPersona / p.hora) : 0
      };
    });

    var netoAnual = beneficioAnual - costoAnual;
    var factorAnualidad = s.tasaDescuento > 0
      ? (1 - Math.pow(1 + s.tasaDescuento, -s.anosAnalisis)) / s.tasaDescuento
      : s.anosAnalisis;

    var escenarios = NIVELES_IMPLEMENTACION.map(function (n) {
      var vpn = -n.costo + netoAnual * factorAnualidad;
      return {
        nivel: n.nombre,
        costo: n.costo,
        meses: n.meses,
        mesesRecuperacion: netoAnual > 0 ? Math.round((n.costo / (netoAnual / 12)) * 10) / 10 : null,
        vpn: Math.round(vpn)
      };
    });

    return {
      personas: personas,
      costoAnual: Math.round(costoAnual),
      beneficioAnual: Math.round(beneficioAnual),
      netoAnual: Math.round(netoAnual),
      horasAnoPorPersona: horasAno,
      perfiles: perfiles,
      escenarios: escenarios,
      supuestos: { horasSemana: s.horasAhorradasSemana, semanas: s.semanas, costoHora: Math.round(costoHora), tasa: s.tasaDescuento, anos: s.anosAnalisis }
    };
  }

  function resumenTexto(users) {
    var r = calcular(users);
    if (r.personas === 0) {
      return 'Estimación de ROI: no hay personas registradas por fase, por lo que no se puede calcular el beneficio. Se requiere completar el cuestionario de usuarios por fase.';
    }
    var base = 'Estimación preliminar de ROI por costo-hora de usuario: ' + r.personas + ' personas registradas. ' +
      'Costo anual de licencias y equipo: ' + fmt(r.costoAnual) + '. Beneficio anual por ' + r.supuestos.horasSemana + ' horas ahorradas por semana (' + r.horasAnoPorPersona + ' horas al año por persona, con costo-hora de ' + fmt(r.supuestos.costoHora) + '): ' + fmt(r.beneficioAnual) + '. Beneficio neto anual: ' + fmt(r.netoAnual) + '.';
    var impl = r.escenarios.map(function (e) {
      var rec = e.mesesRecuperacion === null ? 'no se recupera con los supuestos actuales' : 'se recupera en unos ' + e.mesesRecuperacion + ' meses';
      return e.nivel + ' (' + fmt(e.costo) + ', ' + e.meses + ' meses de implementación): ' + rec + '.';
    }).join(' ');
    return base + ' Según el nivel de implementación: ' + impl;
  }

  var api = { SUPUESTOS: SUPUESTOS, PRECIOS: PRECIOS, NIVELES_IMPLEMENTACION: NIVELES_IMPLEMENTACION, TIPO_CAMBIO: TIPO_CAMBIO, usd: usd, calcular: calcular, resumenTexto: resumenTexto };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AutodeskROI = api;
})(typeof window !== 'undefined' ? window : globalThis);
