// ---------- Calcul (pur, testable) ----------

const CIBLE_HEURE = 16; // vendredi 16h

function minutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function aHeure(date, min) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, min, 0, 0);
}

/**
 * Renvoie le temps de travail restant (ms) et le temps réel restant (ms)
 * avant vendredi 16h. cfg = { debut, fin, pause, pauseRestante }
 */
function calcul(now, cfg) {
  const jour = now.getDay(); // 0 = dimanche, 5 = vendredi
  const delta = (5 - jour + 7) % 7;
  const cible = new Date(now.getFullYear(), now.getMonth(), now.getDate() + delta, CIBLE_HEURE, 0, 0, 0);

  if (now >= cible) return { fini: true, travail: 0, total: 0 };

  const debutMin = minutes(cfg.debut);
  const finMin = minutes(cfg.fin);
  const pauseMs = cfg.pause * 60000;
  const pauseRestanteMs = cfg.pauseRestante * 60000;

  let travail = 0;

  for (let i = 0; i <= delta; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const wd = date.getDay();
    if (wd === 0 || wd === 6) continue;

    const debut = aHeure(date, debutMin);
    let fin = aHeure(date, finMin);
    if (i === delta && cible < fin) fin = cible; // le vendredi, on s'arrête à 16h

    let depart = debut;
    let pause = pauseMs;

    if (i === 0 && now > debut) {
      depart = now;
      pause = pauseRestanteMs;
    }

    const brut = fin - depart;
    if (brut > 0) travail += Math.max(0, brut - pause);
  }

  return { fini: false, travail, total: cible - now };
}

function decouper(ms) {
  const total = Math.max(0, Math.floor(ms));
  const s = Math.floor(total / 1000);
  return {
    j: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

const deux = (n) => String(n).padStart(2, '0');

function formatNormal(ms) {
  const { j, h, m, s } = decouper(ms);
  return `${j} j ${deux(h)} h ${deux(m)} min ${deux(s)} s`;
}

function formatCedric(ms) {
  return `${Math.max(0, Math.floor(ms)).toLocaleString('fr-FR')} ms`;
}

function formatTotal(ms) {
  const { j, h, m } = decouper(ms);
  return `${j} j ${h} h ${deux(m)} min`;
}

// ---------- Interface ----------

if (typeof document !== 'undefined') {
  const CLE = 'vendredi-pichet';
  const defauts = { debut: '09:00', fin: '17:00', pause: 60, pauseRestante: 60, jourPause: '', cedric: false };

  const $ = (id) => document.getElementById(id);
  const cleJour = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

  function charger() {
    let cfg = { ...defauts };
    try {
      const brut = localStorage.getItem(CLE);
      if (brut) cfg = { ...cfg, ...JSON.parse(brut) };
    } catch (e) { /* stockage indisponible : on garde les défauts */ }

    // La pause restante repart de la pause complète chaque nouveau jour
    const aujourdhui = cleJour(new Date());
    if (cfg.jourPause !== aujourdhui) {
      cfg.pauseRestante = cfg.pause;
      cfg.jourPause = aujourdhui;
    }
    return cfg;
  }

  function sauver() {
    try { localStorage.setItem(CLE, JSON.stringify(cfg)); } catch (e) { /* ignoré */ }
  }

  const cfg = charger();

  function remplirFormulaire() {
    $('debut').value = cfg.debut;
    $('fin').value = cfg.fin;
    $('pause').value = cfg.pause;
    $('pauseRestante').value = cfg.pauseRestante;
    majBoutonCedric();
  }

  function majBoutonCedric() {
    $('cedric').setAttribute('aria-pressed', String(cfg.cedric));
    $('cedric-etat').textContent = cfg.cedric ? 'on' : 'off';
  }

  function lireFormulaire() {
    if ($('debut').value) cfg.debut = $('debut').value;
    if ($('fin').value) cfg.fin = $('fin').value;
    const p = parseInt($('pause').value, 10);
    const pr = parseInt($('pauseRestante').value, 10);
    if (!Number.isNaN(p)) cfg.pause = Math.max(0, p);
    if (!Number.isNaN(pr)) cfg.pauseRestante = Math.max(0, pr);
    cfg.jourPause = cleJour(new Date());
    sauver();
  }

  // Si on change la pause du jour et que rien n'a encore été entamé, on aligne la pause restante
  $('pause').addEventListener('input', () => {
    const avant = cfg.pause;
    const p = parseInt($('pause').value, 10);
    if (!Number.isNaN(p) && cfg.pauseRestante === avant) {
      $('pauseRestante').value = p;
    }
    lireFormulaire();
  });

  ['debut', 'fin', 'pauseRestante'].forEach((id) => $(id).addEventListener('input', lireFormulaire));

  $('cedric').addEventListener('click', () => {
    cfg.cedric = !cfg.cedric;
    sauver();
    majBoutonCedric();
  });

  function afficher() {
    const r = calcul(new Date(), cfg);
    const el = $('compteur');

    if (r.fini) {
      el.textContent = "C'est l'heure du pichet";
      el.className = 'compteur fini';
      $('detail').textContent = 'Rendez-vous lundi pour le prochain décompte.';
      return;
    }

    el.className = cfg.cedric ? 'compteur cedric' : 'compteur';
    el.textContent = cfg.cedric ? formatCedric(r.travail) : formatNormal(r.travail);
    $('detail').textContent = `Temps réel avant vendredi 16h : ${formatTotal(r.total)}`;
  }

  function boucle() {
    afficher();
    if (cfg.cedric) requestAnimationFrame(boucle);
    else setTimeout(boucle, 200);
  }

  remplirFormulaire();
  boucle();
}

if (typeof module !== 'undefined') module.exports = { calcul, minutes };
