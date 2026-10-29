/* =====================================================================
   Musculation — Suivi des séances, des max et des piliers
   N'EPS numérique — CA5 — Quentin Delisle
   PWA hors-ligne : données stockées sur l'appareil (localStorage),
   échanges entre tablettes par QR codes (même principe que l'appli Biathlon).
   ===================================================================== */
'use strict';

const APP_VERSION = '1.4.1';
const ROOT_KEY = 'neps_muscu_v1';
const QR_CHUNK = 440;           // caractères base45 par QR

/* ---------------------------------------------------------------------
   Machines de la salle (mêmes noms et mêmes images que l'appli Hippopogramme)
   k : 'ch' = machine chargée (max en kg) · 'pdc' = poids de corps (max en répétitions) · 'cardio'
   g : groupe musculaire · z : zones du corps sollicitées (inaptitudes)
   --------------------------------------------------------------------- */
const GROUPS = {
  pec: { n:'Pectoraux', c:'#E3262B' }, dos: { n:'Dos', c:'#1E5FD8' }, epa: { n:'Épaules', c:'#8A2BE2' },
  bras: { n:'Bras', c:'#FF7A00' }, jam: { n:'Jambes', c:'#1FA24A' }, tronc: { n:'Abdos / Tronc', c:'#14B8A6' },
  cardio: { n:'Cardio / Endurance', c:'#8A94A6' } };
const Z_ARMS = ['epD','epG','brD','brG','maD','maG'], Z_LEGS = ['cuD','cuG','geD','geG','moD','moG','piD','piG'];
const MACHINES = [
  { id:'dc', n:'Développé couché', img:'machines/Developpe Couche.png', g:'pec', k:'ch', z:[...Z_ARMS] },
  { id:'chest_press', n:'Chest Press', img:'machines/Chest Press.png', g:'pec', k:'ch', z:[...Z_ARMS] },
  { id:'butterfly', n:'Butterfly', img:'machines/Butterfly.png', g:'pec', k:'ch', z:['epD','epG','brD','brG'] },
  { id:'pompes', n:'Pompes', img:'machines/Pompes.png', g:'pec', k:'pdc', z:[...Z_ARMS] },
  { id:'dips', n:'Dips', img:'machines/Dips.png', g:'pec', k:'pdc', z:[...Z_ARMS] },
  { id:'tirage_vertical', n:'Tirage Vertical', img:'machines/Tirage Vertical.png', g:'dos', k:'ch', z:[...Z_ARMS] },
  { id:'tirage_assis', n:'Tirage assis', img:'machines/Tirage Assis.png', g:'dos', k:'ch', z:[...Z_ARMS, 'dos'] },
  { id:'rowing', n:'Rowing', img:'machines/Rowing.png', g:'dos', k:'ch', z:[...Z_ARMS, 'dos', 'lom'] },
  { id:'tractions', n:'Tractions', img:'machines/Tractions.png', g:'dos', k:'pdc', z:[...Z_ARMS] },
  { id:'dorso', n:'Dorso lombaire', img:'machines/Dorso Lombaire.png', g:'dos', k:'ch', z:['dos','lom','han'] },
  { id:'shoulder', n:'Shoulder Press', img:'machines/Shoulder Press.png', g:'epa', k:'ch', z:[...Z_ARMS, 'cou'] },
  { id:'deltoides', n:'Deltoïdes', img:'machines/Deltoides.png', g:'epa', k:'ch', z:['epD','epG','brD','brG'] },
  { id:'biceps_curl', n:'Biceps Curl', img:'machines/Biceps Curl.png', g:'bras', k:'ch', z:['brD','brG','maD','maG'] },
  { id:'presse', n:'Presse oblique', img:'machines/Presse Oblique.png', g:'jam', k:'ch', z:[...Z_LEGS, 'han', 'lom'] },
  { id:'squat', n:'Squat', img:'machines/Squat.png', g:'jam', k:'ch', z:[...Z_LEGS, 'han', 'lom', 'dos'] },
  { id:'legcurl', n:'Leg Extension', img:'machines/Leg Extension.png', g:'jam', k:'ch', z:['cuD','cuG','geD','geG'] },
  { id:'ischios', n:'Ischios', img:'machines/ischios.png', g:'jam', k:'ch', z:['cuD','cuG','geD','geG','lom'] },
  { id:'chaise_romaine', n:'Chaise Romaine', img:'machines/Chaise Romaine.png', g:'tronc', k:'pdc', z:['epD','epG','brD','brG','han','lom','ven'] },
  { id:'abdos', n:'Abdos', img:'machines/Abdos.png', g:'tronc', k:'pdc', z:['ven','cou','lom'] },
  { id:'velo', n:'Vélo', img:'machines/Velo.png', g:'cardio', k:'cardio', z:['cuD','cuG','geD','geG','han'] },
  { id:'tapis', n:'Tapis de course', img:'machines/Tapis de course.png', g:'cardio', k:'cardio', z:[...Z_LEGS, 'han'] },
  { id:'ellip', n:'Elliptique', img:'machines/Elliptique.png', g:'cardio', k:'cardio', z:[...Z_LEGS, 'han'] },
];
const machine = id => MACHINES.find(m => m.id === id) || null;
const mName = id => machine(id)?.n || id || '?';
const isPdc = id => machine(id)?.k === 'pdc';
const mImg = (m, cls='m-img') => { m = typeof m === 'string' ? machine(m) : m;
  if (!m) return `<span class="${cls} m-ico">✏️</span>`;
  return m.img ? `<img class="${cls}" src="${esc(m.img)}" alt="${esc(m.n)}" loading="lazy" onerror="this.style.visibility='hidden'">` : `<span class="${cls} m-ico">${m.ico || '🏋️'}</span>`; };

/* Exercices d'échauffement (circuit training, cardio) */
const WU_EX = [
  { id:'mc', n:'Mountain climber', ico:'🧗', z:[...Z_ARMS, 'geD','geG','han'] },
  { id:'cs', n:'Corde à sauter', ico:'🪢', z:['moD','moG','piD','piG','geD','geG'] },
  { id:'jj', n:'Jumping jack', ico:'🤸', z:['piD','piG','geD','geG','moD','moG','epD','epG'] },
  { id:'bu', n:'Burpees', ico:'🔥', z:[...Z_ARMS, ...Z_LEGS, 'lom'] },
  { id:'po', n:'Pompes', ico:'💪', z:[...Z_ARMS] },
  { id:'ab', n:'Abdos', ico:'🧘', z:['ven','cou','lom'] },
  { id:'sq', n:'Squats', ico:'🦵', z:[...Z_LEGS, 'han', 'lom'] },
  { id:'ga', n:'Gainage (planche)', ico:'🧱', z:['epD','epG','brD','brG','lom','ven'] },
  { id:'mg', n:'Montées de genoux', ico:'🏃', z:[...Z_LEGS, 'han'] },
  { id:'fe', n:'Fentes', ico:'🦿', z:[...Z_LEGS, 'han'] },
  { id:'tf', n:'Talons-fesses', ico:'🏃‍♀️', z:[...Z_LEGS] },
];
const wuEx = id => WU_EX.find(x => x.id === id) || machine(id);
const PDC_3x3 = ['pompes','tractions','dips','abdos','chaise_romaine'];
const ENDU = ['velo','tapis','ellip'];
const WU_TYPES = { none:'Pas d\'échauffement guidé', circuit:'Circuit Training', '3x3':'3 × 3 minutes' };

/* ---------------------------------------------------------------------
   Mobiles (protocoles) et thèmes des leçons
   --------------------------------------------------------------------- */
const MOB = {
  vol: { n:'Esthétique / Volume', ico:'💎', s:4, r:10, rest:90, pct:75, pctLow:70, nbEx:4, rule:'2x2', ry:'Lent sur le temps moteur et lent sur le temps de retour',
         d:'2 groupes musculaires · 2 exercices par groupe · 4 séries de 10 · récup 1 min 30 · 70 à 75 % du max' },
  p66: { n:'Sportif / Puissance · 6 × 6', ico:'⚡', s:6, r:6, rest:180, pct:80, nbEx:3, rule:'diff', ry:'Rapide sur le temps moteur, très lent sur le temps de retour',
         d:'3 exercices sur 3 groupes différents · 6 séries de 6 · récup 3 min · 80 % du max' },
  p64: { n:'Sportif / Puissance · 6 × 4', ico:'⚡', s:6, r:4, rest:180, pct:90, nbEx:3, rule:'diff', ry:'Rapide sur le temps moteur, très lent sur le temps de retour',
         d:'3 exercices sur 3 groupes différents · 6 séries de 4 · récup 3 min · 90 % du max' },
  ton: { n:'Santé / Tonification', ico:'🌿', s:5, r:15, rest:30, pct:60, nbEx:3, rule:'free', inter:'cardio', ry:'Assez rapide sur le temps moteur, lent sur le temps de retour',
         d:'3 exercices · 5 séries de 15 · récup 30 s · 60 % du max · 6 min de cardio entre chaque exercice' },
  aff: { n:'Santé / Affinement', ico:'🔥', s:5, r:20, rest:30, pct:50, nbEx:3, rule:'free', inter:'endu', ry:'Normal sur le temps moteur et normal sur le temps de retour',
         d:'3 exercices · 5 séries de 20 · récup 30 s · 50 % du max · 6 min d\'endurance entre chaque exercice' },
};
const MOB_IDS = ['vol','p66','p64','ton','aff'];
const THEMES = {
  max:     { n:'Prise de Max', ico:'🏋️', c:'#0062C4' },
  vol:     { n:'Esthétique / Volume', ico:'💎', c:'#8A2BE2', mobs:['vol'] },
  pui:     { n:'Sportif / Puissance', ico:'⚡', c:'#E3401B', mobs:['p66','p64'] },
  aff:     { n:'Santé / Affinement', ico:'🔥', c:'#F07000', mobs:['aff'] },
  ton:     { n:'Santé / Tonification', ico:'🌿', c:'#1FA24A', mobs:['ton'] },
  amax:    { n:'Améliore tes Max', ico:'🚀', c:'#0B4F1C' },
  evi:     { n:'Évaluation intermédiaire', ico:'📝', c:'#8E1B3A', mobs:MOB_IDS },
  evf:     { n:'Évaluation finale', ico:'🏆', c:'#0B2A6B', mobs:MOB_IDS, proj:true },
  projet:  { n:'Tester son projet', ico:'🧪', c:'#14B8A6', mobs:MOB_IDS, proj:true },
  coach:   { n:'Coach d\'un jour', ico:'🎭', c:'#FF4FA3', mobs:MOB_IDS },
  hippo:   { n:'Hippopogramme', ico:'🦛', c:'#5B6478' },
};
const THEME_IDS = Object.keys(THEMES);
const isMaxTheme = th => th === 'max' || th === 'amax';

/* ---------------------------------------------------------------------
   Piliers (observés par un camarade, échelle de 10 paliers) — 3 observables modifiables
   --------------------------------------------------------------------- */
const DEFAULT_PILIERS = [
  { id:'plac', n:'Se placer correctement pour réussir', ico:'📐', cr:['Machine réglée à sa taille (siège, appuis, butées)', 'Alignement segmentaire : tête, dos et bassin alignés', 'Prises sécuritaires et appuis symétriques'] },
  { id:'ampl', n:'Maintenir une amplitude continue', ico:'↕️', cr:['Amplitude complète à chaque répétition', 'Pas d\'arrêt ni de rebond aux extrémités du mouvement', 'Rythme réalisé en fonction du mobile (retour contrôlé)'] },
  { id:'comp', n:'Éviter les compensations', ico:'🎯', cr:['Pas d\'élan ni d\'à-coups', 'Le dos reste plaqué, pas de cambrure', 'Seuls les segments travaillés bougent'] },
  { id:'fati', n:'Repérer les signes de fatigue', ico:'🔋', cr:['Expiration sur les temps moteurs, pas d\'apnée', 'Perte de vitesse ou d\'amplitude repérée et annoncée', 'Charge allégée ou série arrêtée si la technique se dégrade'] },
  { id:'enco', n:'Encourager pour favoriser l\'engagement', ico:'📣', cr:['Compte les répétitions à voix haute', 'Encourage pendant les dernières répétitions', 'Donne un retour positif et un conseil après la série'], prof:true },
  { id:'secu', n:'Sécurité', ico:'🛡️', cr:['Charge et goupille vérifiées avant la série', 'Charge accompagnée jusqu\'au retour, jamais lâchée', 'Zone de travail dégagée, matériel rangé après usage'], secu:true },
];
const PIL_V = 1;

/* ---------------------------------------------------------------------
   Coach d'un jour : rôles à tirer au sort (texte modifiable par l'enseignant)
   --------------------------------------------------------------------- */
const DEFAULT_ROLES = [
  { id:'surp', n:'Perdre du poids', t:'Je mesure 1m70 pour 72 kg, j\'ai l\'impression que les autres regardent un peu trop mes hanches et mon ventre. J\'aimerais réellement perdre un peu de poids et je fais fréquemment des régimes mais je n\'arrive pas à les tenir. Ça fait plusieurs années que je n\'ai pas fait de sport, d\'ailleurs si je cours plus de 5 minutes, ça me fait mal aux genoux.' },
  { id:'pomp', n:'Futur pompier', t:'Depuis que je suis tout petit je veux devenir pompier ! Oui oui, le casque qui brille et le camion rouge me font rêver. Mais pour ça je dois réussir un concours et faire un nombre incalculable d\'exercices sur les bras, comme des tractions avec rétablissement par exemple. Actuellement impossible à envisager car je n\'arrive même pas à passer mon menton au-dessus de la barre. Par contre je veux bien un programme, mais je ne veux pas faire uniquement des tractions…' },
  { id:'nage', n:'Nageur sprinteur', t:'Je suis nageur, spécialiste en brasse, et je trouve que ma propulsion bras est insuffisante. Je fais essentiellement des efforts courts, comme du 100 m. Je veux surtout progresser vite car l\'évaluation pour l\'option Natation est bientôt… mon temps doit s\'améliorer. Que faire ?' },
  { id:'dos', n:'Mal de dos', t:'Depuis que je suis tout petit, j\'entends mes parents me dire qu\'ils ont mal au dos, ils montrent surtout leurs lombaires mais je pense que tout le dos est concerné. Ils sont trop souvent posés dans le canapé et pas assez en activité, je n\'aimerais pas être aussi mou. Il paraît que travailler le dos sans travailler les abdos (antagonistes) est contre-productif. Que dois-je faire ?' },
  { id:'bad', n:'Joueur de badminton', t:'Je suis joueur de badminton depuis maintenant quelques années, compétiteur acharné mais… j\'ai une frappe de poussin (comme un enfant de 12 ans quoi…). J\'ai juste envie de travailler sur mon bras car le reste va bien. Que dois-je choisir ? Nous sommes quand même sur une activité de vitesse de bras !' },
  { id:'plag', n:'Concours de plage', t:'J\'ai UN objectif, m\'inscrire au concours de Mister ou Miss plage de Mr Hulot cet été ! Mais si, vous savez, c\'est à Saint-Marc-sur-Mer. Du coup, je vais avoir besoin d\'un coup de pouce (non je ne parle pas de dopage) car je suis bâti en V mais dans le mauvais sens. Que feriez-vous à ma place (abandonner est exclu) ?' },
  { id:'foot', n:'Footballeur · frappe puissante', t:'Je fais du football depuis des années, mais j\'admire toujours ceux qui font des frappes puissantes loin du but. Moi, mon geste est bon, mais n\'amène pas forcément de vitesse dans le ballon, du coup je peine à atteindre le but tant ma frappe manque d\'énergie. Que puis-je faire ?' },
  { id:'rugb', n:'Rugbyman en mêlée', t:'Je joue pilier dans l\'équipe de rugby du lycée. En mêlée je recule à chaque fois et dans les rucks je me fais déblayer facilement. Mon entraîneur me dit que je manque de force dans les jambes et dans le dos. Je veux pousser plus fort, mais sans me blesser le dos.' },
  { id:'esca', n:'Grimpeuse', t:'Je fais de l\'escalade en club. Dans les voies longues, mes avant-bras et mon dos « brûlent » bien avant le haut, et je dois redescendre. Je ne veux pas prendre de volume, je veux juste tenir plus longtemps accrochée. Comment m\'entraîner en salle de musculation ?' },
  { id:'danse', n:'Danseuse', t:'Je danse (modern jazz) six heures par semaine. Ma prof me dit que je manque de gainage et de tonicité dans les sauts : mes réceptions sont molles et je perds l\'équilibre. Je veux rester fine et souple mais être plus tonique.' },
  { id:'ski', n:'Préparation ski', t:'Cet hiver je pars une semaine au ski avec ma famille. L\'an dernier, au bout de deux descentes j\'avais les cuisses en feu et j\'ai fini la semaine avec mal aux genoux. Je veux préparer mes jambes pour profiter de toute la semaine.' },
  { id:'abdo', n:'Abdos Mister Univers', t:'Mon rêve : avoir des abdos dessinés comme les candidats de Mister Univers. Je fais 200 crunchs tous les soirs dans ma chambre mais je ne vois aucun changement, et en plus j\'ai parfois mal au bas du dos. Qu\'est-ce que je fais mal ?' },
  { id:'hand', n:'Handballeuse arrière', t:'Je suis arrière dans mon équipe de handball. Mes tirs de loin sont précis mais trop lents : les gardiennes ont le temps de les arrêter. Je veux un tir plus rapide sans me faire mal à l\'épaule.' },
  { id:'sac', n:'Dos rond et sac lourd', t:'Je porte un sac de 10 kg tous les jours et je passe des heures penché sur mon téléphone. On me dit que je me tiens « tout voûté » et j\'ai souvent mal entre les omoplates. Je veux me redresser et avoir un dos plus solide.' },
  { id:'cycl', n:'Cycliste du dimanche', t:'Je fais du vélo le week-end avec mon père, 40 km environ. Dans les côtes je lâche toujours le groupe et j\'ai les jambes lourdes le lendemain. Je voudrais tenir plus longtemps et affiner mes cuisses.' },
];

/* ---------------------------------------------------------------------
   Calculs : formule de Brzycki, zones de charge
   1RM = charge / (1,0278 − 0,0278 × répétitions)   (2 à 15 répétitions)
   --------------------------------------------------------------------- */
const brzycki = (kg, r) => (r <= 1 ? kg : kg / (1.0278 - 0.0278 * r));
const BRZ_MAX_R = 15;
const r05 = v => Math.round(v * 2) / 2;
const fmtKg = v => v == null || isNaN(v) ? '—' : String(r05(v)).replace('.', ',') + ' kg';
/* zone de charge proposée : 32 kg → entre 30 et 35 kg ; 37 kg → entre 35 et 40 kg ; 35 kg → 35 kg */
function kgZone(kg){
  if (kg == null || isNaN(kg) || kg <= 0) return null;
  const lo = Math.floor(kg / 5 + 1e-6) * 5;
  if (Math.abs(kg - lo) < 0.26) return { lo, hi: lo, t:`${lo} kg` };
  return { lo, hi: lo + 5, t:`entre ${lo} et ${lo + 5} kg` };
}
const fmtRest = s => s >= 60 ? `${Math.floor(s/60)}'${s % 60 ? String(s % 60).padStart(2, '0') : ''}` : `${s}''`;

/* ---------------------------------------------------------------------
   État : ROOT = { deviceId, pin, role, active, classes:{}, piliers, roles, mOff }
   S = classe active
   --------------------------------------------------------------------- */
function rnd(n){ const a='abcdefghijkmnpqrstuvwxyz23456789'; let s=''; for(let i=0;i<n;i++) s+=a[Math.floor(Math.random()*a.length)]; return s; }
const COLORS = [
  {k:'rouge', n:'Rouge', c:'#E3262B'}, {k:'bleu', n:'Bleu', c:'#1E5FD8'}, {k:'jaune', n:'Jaune', c:'#FFD400'}, {k:'vert', n:'Vert', c:'#1FA24A'},
  {k:'orange', n:'Orange', c:'#FF7A00'}, {k:'violet', n:'Violet', c:'#8A2BE2'}, {k:'rose', n:'Rose', c:'#FF4FA3'}, {k:'blanc', n:'Blanc', c:'#FFFFFF'},
  {k:'noir', n:'Noir', c:'#1A1A1A'}, {k:'cyan', n:'Cyan', c:'#00B8D9'}, {k:'marron', n:'Marron', c:'#8B5A2B'}, {k:'gris', n:'Gris', c:'#8A94A6'} ];
const MAX_GROUPS = 12;
const colorOf = k => COLORS.find(c => c.k === k);
const DEFAULT_SETTINGS = { nbLessons:10, current:1, className:'', nbGroups:1, groupColors: COLORS.map(c => c.k) };
function newClassState(name, id){
  return { id: id || rnd(4), settings:{ ...DEFAULT_SETTINGS, className: name || '', groupColors:[...DEFAULT_SETTINGS.groupColors] },
    students:[], lessons:{}, results:{}, projects:{}, mx:{}, hist:{} };
}
function normClass(c){
  c.settings = { ...DEFAULT_SETTINGS, ...(c.settings||{}) };
  ['students','lessons','results','projects','mx','hist'].forEach(k => { if (!c[k]) c[k] = (k === 'students' ? [] : {}); });
  c.students.forEach(x => { if (x.grp == null) x.grp = 0; });
  return c;
}
let ROOT, S;
function loadRoot(){
  try { ROOT = JSON.parse(localStorage.getItem(ROOT_KEY)); } catch(e){ ROOT = null; }
  if (!ROOT || !ROOT.classes) ROOT = { v:1, deviceId: rnd(4), pin:'0000', active:null, classes:{} };
  if (!ROOT.deviceId) ROOT.deviceId = rnd(4);
  if (!ROOT.pin) ROOT.pin = '0000';
  if (!ROOT.piliers || (ROOT.pilV || 0) < PIL_V) { ROOT.piliers = DEFAULT_PILIERS.map(p => ({ ...p, cr:[...p.cr] })); ROOT.pilV = PIL_V; }
  { const e = ROOT.piliers.find(p => p.id === 'enco'); if (e) e.prof = true; }
  if (!ROOT.suiviE) { Object.values(ROOT.classes).forEach(c => Object.values(c.lessons || {}).forEach(L => { L.suivi = 'e'; })); ROOT.suiviE = true; }
  if (!ROOT.roles) ROOT.roles = DEFAULT_ROLES.map(r => ({ ...r }));
  if (!ROOT.mOff) ROOT.mOff = [];
  Object.values(ROOT.classes).forEach(normClass);
  if (!Object.keys(ROOT.classes).length) { const c = newClassState('Classe 1'); ROOT.classes[c.id] = c; }
  if (!ROOT.classes[ROOT.active]) ROOT.active = Object.keys(ROOT.classes)[0];
  useClass(ROOT.active);
}
function useClass(id){ ROOT.active = id; S = ROOT.classes[id]; S.deviceId = ROOT.deviceId; try { computeNames(); } catch(e){} }
const className = c => (c || S).settings.className || 'Classe';
function save(){
  try { localStorage.setItem(ROOT_KEY, JSON.stringify(ROOT)); }
  catch(e){ toast('⚠️ Enregistrement impossible sur cet appareil'); }
  computeNames();
}
const UI = { view:'home', profTab:'menu', profUnlocked:false, filter:null, sid:null, sel:null, open:{} };
const isProfRole = () => ROOT.role === 'prof';
const piliers = () => ROOT.piliers;
const pilier = id => ROOT.piliers.find(p => p.id === id) || null;
const role = id => ROOT.roles.find(r => r.id === id) || null;
const salleMachines = () => MACHINES.filter(m => !ROOT.mOff.includes(m.id));
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = v => (v == null || isNaN(v)) ? '—' : (Math.round(v*10)/10).toString().replace('.', ',');
const now = () => Date.now();
function toast(msg, ms=2200){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('show'), ms); }
function capName(s){ return String(s||'').toLowerCase().replace(/(^|[\s\-'’])([a-zà-ÿ])/g, (m,a,b)=>a+b.toUpperCase()).trim(); }

function modal(html, {onOpen, wide}={}){
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-bg"><div class="modal" ${wide?'style="max-width:760px"':''}>${html}</div></div>`;
  const bg = root.firstElementChild;
  bg.addEventListener('click', e => { if (e.target === bg) closeModal(); });
  if (onOpen) onOpen(bg.firstElementChild);
  return bg.firstElementChild;
}
function closeModal(){ stopScan(); $('#modal-root').innerHTML=''; }
function confirmBox(title, text, okLabel='Valider', danger=false){
  return new Promise(res => {
    const m = modal(`<h2>${esc(title)}</h2><p>${text}</p>
      <div class="btn-row spread"><button class="btn ghost" data-r="0">Annuler</button>
      <button class="btn ${danger?'red':'primary'}" data-r="1">${esc(okLabel)}</button></div>`);
    m.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { closeModal(); res(b.dataset.r==='1'); });
  });
}
function choiceBox(title, text, choices){
  return new Promise(res => {
    const m = modal(`<h2>${esc(title)}</h2><p>${text}</p><div class="btn-row">${
      choices.map((c,i)=>`<button class="btn ${c.cls||''}" data-i="${i}">${esc(c.label)}</button>`).join('')
    }<button class="btn ghost" data-i="-1">Annuler</button></div>`);
    m.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { closeModal(); const i=+b.dataset.i; res(i<0?null:choices[i].value); });
  });
}
function numberBox(title, value, {step=0.5, min=0, max=200, unit='m'}={}){
  return new Promise(res => {
    const m = modal(`<h2>${esc(title)}</h2>
      <div class="center"><input type="number" inputmode="decimal" step="${step}" min="${min}" max="${max}" id="nb-in" value="${value ?? ''}" style="font-size:36px;text-align:center;max-width:220px"> <b style="font-size:26px">${unit}</b></div>
      <div class="btn-row spread" style="margin-top:16px"><button class="btn ghost" data-r="0">Annuler</button><button class="btn primary" data-r="1">Valider</button></div>`);
    const inp = m.querySelector('#nb-in'); setTimeout(()=>{inp.focus(); inp.select();}, 50);
    const done = ok => { const v = parseFloat(String(inp.value).replace(',', '.')); closeModal(); res(ok && !isNaN(v) ? Math.min(max, Math.max(min, v)) : null); };
    m.querySelector('[data-r="0"]').onclick = () => done(false);
    m.querySelector('[data-r="1"]').onclick = () => done(true);
    inp.addEventListener('keydown', e => { if (e.key==='Enter') done(true); });
  });
}
let NAMES = {};
function computeNames(){
  NAMES = {};
  const by = {};
  S.students.forEach(s => { const p=(s.prenom||s.disp||'').toLowerCase(); (by[p]=by[p]||[]).push(s); });
  S.students.forEach(s => {
    if (!s.prenom) { NAMES[s.id] = s.disp || '?'; return; }       // tablettes : nom d'affichage reçu du prof
    const same = by[s.prenom.toLowerCase()];
    if (same.length < 2) { NAMES[s.id] = s.prenom; return; }
    let n = 1, label;
    do { label = s.prenom + ' ' + (s.nom||'').slice(0,n).toUpperCase() + '.'; n++; }
    while (n <= (s.nom||'').length && same.some(o => o!==s && o.prenom.toLowerCase()===s.prenom.toLowerCase() && (o.nom||'').slice(0,n-1).toUpperCase()===(s.nom||'').slice(0,n-1).toUpperCase()));
    NAMES[s.id] = label;
  });
}
const nameOf = id => NAMES[id] || '?';
const student = id => S.students.find(s => s.id === id);
function sortedStudents(){ return [...S.students].sort((a,b)=> nameOf(a.id).localeCompare(nameOf(b.id),'fr')); }
function newStudentId(){ let id; do { id = rnd(4); } while (S.students.some(s=>s.id===id)); return id; }
const ZONES = [
  {k:'tete', n:'Tête', x:100, y:12}, {k:'cou', n:'Cou', x:100, y:58},
  {k:'epD', n:'Épaule droite', x:64, y:78}, {k:'epG', n:'Épaule gauche', x:136, y:78},
  {k:'brD', n:'Bras / coude droit', x:43, y:136}, {k:'brG', n:'Bras / coude gauche', x:157, y:136},
  {k:'maD', n:'Poignet / main droite', x:36, y:194}, {k:'maG', n:'Poignet / main gauche', x:164, y:194},
  {k:'ven', n:'Ventre', x:100, y:168}, {k:'han', n:'Hanches / aine', x:100, y:206},
  {k:'cuD', n:'Cuisse droite', x:84, y:258}, {k:'cuG', n:'Cuisse gauche', x:116, y:258},
  {k:'geD', n:'Genou droit', x:85, y:296}, {k:'geG', n:'Genou gauche', x:115, y:296},
  {k:'moD', n:'Mollet / tibia droit', x:85, y:330}, {k:'moG', n:'Mollet / tibia gauche', x:115, y:330},
  {k:'piD', n:'Cheville / pied droit', x:80, y:370}, {k:'piG', n:'Cheville / pied gauche', x:120, y:370},
  {k:'dos', n:'Dos'}, {k:'lom', n:'Bas du dos'}
];
const zoneMask = list => (list||[]).reduce((m, k) => { const i = ZONES.findIndex(z => z.k === k); return i < 0 ? m : (m | (1 << i)) >>> 0; }, 0);
const maskZones = m => ZONES.filter((z, i) => (m >>> i) & 1).map(z => z.k);
const zoneName = k => ZONES.find(z => z.k === k)?.n || k;
function scaleColor(v){ return ['#D0161B','#E3401B','#F07000','#F59E0B','#FFD000','#C8D93A','#86DC96','#3FB65C','#1E8E3E','#0B4F1C'][Math.max(1,Math.min(10,Math.round(v)))-1]; }
/* Échelles 1 → 10 (du moins bien au mieux). État : inspiré de l'échelle de Borg (ressenti de fatigue / forme). */
const SCALES = {
  forme: [['😵','Épuisé'],['😫','Très fatigué'],['😩','Fatigué'],['😕','Un peu fatigué'],['😐','Moyen'],['🙂','Correct'],['😊','Bien'],['😄','Très bien'],['💪','En pleine forme'],['🤩','Au top']],
  motiv: [['😴','Aucune envie'],['🥱','Très peu'],['😒','Peu'],['😕','Bof'],['😐','Moyenne'],['🙂','Assez'],['😊','Motivé'],['😃','Très motivé'],['🔥','À fond'],['🚀','Ultra motivé']],
};
function scale10(label, ico, val, attrs, kind='forme'){
  const sc = SCALES[kind];
  return `<div class="sc10"><div class="sc10-l">${ico} ${label}${val?` <span class="sc10-sel">${sc[val-1][0]} ${sc[val-1][1]}</span>`:''}</div><div class="sc10-r">${Array.from({length:10},(_,i)=>i+1).map(v =>
    `<button class="${val===v?'on':''}" style="${val===v?`background:${scaleColor(v)};border-color:${scaleColor(v)};color:${v>=5&&v<=7?'#0A1633':'#fff'}`:''}" ${attrs} data-v="${v}" title="${sc[v-1][1]}"><span class="sc10-i">${sc[v-1][0]}</span><span class="sc10-n">${v}</span></button>`).join('')}</div></div>`;
}
function bodySVG(sel){
  const on = k => sel.includes(k);
  let z = '';
  ZONES.filter(q => q.x).forEach(q => { z += `<g data-zone="${q.k}" class="bz ${on(q.k)?'on':''}"><circle cx="${q.x}" cy="${q.y}" r="${q.k==='tete'?14:13}"/>${on(q.k)?`<text x="${q.x}" y="${q.y+5}" text-anchor="middle" class="ouch">!</text>`:''}</g>`; });
  const skin = '#FFD3A8', line = '#5A3A22';
  return `<svg viewBox="0 0 200 400" class="body-svg">
    <g stroke="${line}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- jambes -->
      <path d="M78 205 L74 300 L76 362 L94 362 L96 300 L99 210 Z" fill="${skin}"/>
      <path d="M122 205 L126 300 L124 362 L106 362 L104 300 L101 210 Z" fill="${skin}"/>
      <!-- baskets -->
      <path d="M70 360 Q70 352 80 352 L96 352 L98 372 Q99 384 86 384 L64 384 Q56 384 58 376 Q60 368 70 368 Z" fill="#F07000"/>
      <path d="M130 360 Q130 352 120 352 L104 352 L102 372 Q101 384 114 384 L136 384 Q144 384 142 376 Q140 368 130 368 Z" fill="#F07000"/>
      <!-- short -->
      <path d="M66 185 L134 185 L138 240 L104 240 L100 212 L96 240 L62 240 Z" fill="#0062C4"/>
      <!-- bras -->
      <path d="M64 76 Q46 100 42 140 Q38 168 36 190" fill="none" stroke-width="16" stroke="${line}"/>
      <path d="M64 76 Q46 100 42 140 Q38 168 36 190" fill="none" stroke-width="11" stroke="${skin}"/>
      <path d="M136 76 Q154 100 158 140 Q162 168 164 190" fill="none" stroke-width="16" stroke="${line}"/>
      <path d="M136 76 Q154 100 158 140 Q162 168 164 190" fill="none" stroke-width="11" stroke="${skin}"/>
      <circle cx="36" cy="192" r="9" fill="${skin}"/><circle cx="164" cy="192" r="9" fill="${skin}"/>
      <!-- maillot -->
      <path d="M64 72 Q100 60 136 72 L142 104 L130 108 L134 190 L66 190 L70 108 L58 104 Z" fill="#0A5BD3"/>
      <path d="M86 66 Q100 80 114 66" fill="none"/>
      
      <!-- cou + tête -->
      <rect x="92" y="50" width="16" height="16" fill="${skin}"/>
      <circle cx="100" cy="30" r="26" fill="${skin}"/>
      <path d="M76 22 Q80 2 100 4 Q122 2 126 22 Q114 12 100 16 Q88 10 76 22 Z" fill="#7A4A22"/>
      <circle cx="73" cy="32" r="5" fill="${skin}"/><circle cx="127" cy="32" r="5" fill="${skin}"/>
    </g>
    <circle cx="90" cy="28" r="3.6" fill="#1A1A1A"/><circle cx="110" cy="28" r="3.6" fill="#1A1A1A"/>
    <circle cx="91.3" cy="26.7" r="1.2" fill="#fff"/><circle cx="111.3" cy="26.7" r="1.2" fill="#fff"/>
    <circle cx="84" cy="38" r="4" fill="#FF8C9A" opacity=".55"/><circle cx="116" cy="38" r="4" fill="#FF8C9A" opacity=".55"/>
    <path d="M88 38 Q100 50 112 38 Q100 44 88 38 Z" fill="#B3263A" stroke="#5A3A22" stroke-width="2"/>
    <text x="16" y="70" class="lr">D</text><text x="176" y="70" class="lr">G</text>${z}</svg>`;
}
/* ---------------------------------------------------------------------
   Leçons, appel, inaptitudes, machines disponibles
   --------------------------------------------------------------------- */
function lesson(n){
  n = +n;
  if (!S.lessons[n]) S.lessons[n] = {};
  const L = S.lessons[n];
  if (!L.th) L.th = n === 1 ? 'max' : 'vol';
  if (!Array.isArray(L.pil)) L.pil = [];
  if (L.pil.some(id => pilier(id)?.prof)) L.pil = L.pil.filter(id => !pilier(id)?.prof);
  if (!L.suivi) L.suivi = 'e';
  if (!L.wu) L.wu = { t:'circuit', nb:6, dur:30 };
  ['att','z','wb','role','ev','evp','cn','crit','grpOv'].forEach(k => { if (!L[k] || typeof L[k] !== 'object') L[k] = {}; });
  if (!Array.isArray(L.hs)) L.hs = [];
  return L;
}
const curLesson = () => Math.min(S.settings.current || 1, S.settings.nbLessons);
const thOf = n => lesson(n).th;
const themeName = th => THEMES[th]?.n || '?';
const lessonTitle = n => { const t = THEMES[thOf(n)]; return t ? `${t.ico} ${t.n}` : ''; };
const lessonLabel = n => `Leçon ${n}/${S.settings.nbLessons} · ${lessonTitle(n)}`;
const attOf = (n, sid) => lesson(n).att[sid] || null;            // 'abs' | 'disp' (inapte totale) | 'inap' (inaptitude partielle)
const present = (n, sid) => !['abs','disp'].includes(attOf(n, sid));
const ATT = { abs:{ n:'Absent', cls:'abs' }, disp:{ n:'Inapte (dispensé)', cls:'disp' }, inap:{ n:'Inaptitude partielle', cls:'inapte' } };
function res(n, sid){ return (S.results[n] && S.results[n][sid]) || null; }
function setRes(n, sid, fn){
  S.results[n] = S.results[n] || {};
  const r = S.results[n][sid] || { ex:[] };
  r.ex = r.ex || [];
  fn(r); r.ts = now(); r.d = S.deviceId;
  S.results[n][sid] = r; save();
}
/* zones d'inaptitude : déclarées à l'appel (prof) ou sur la tablette (élève) */
const zonesOf = (n, sid) => [...new Set([...(lesson(n).z[sid] || []), ...(res(n, sid)?.z || [])])];
const hasInap = (n, sid) => attOf(n, sid) === 'inap' || zonesOf(n, sid).length > 0;
/* forme / motivation : à l'appel (prof) ou sur la tablette (élève) */
const foOf = (n, sid) => res(n, sid)?.fo ?? lesson(n).wb[sid]?.fo ?? null;
const moOf = (n, sid) => res(n, sid)?.mo ?? lesson(n).wb[sid]?.mo ?? null;
/* machine disponible pour l'élève ? (null = oui, sinon raison) */
function blockOf(n, sid, mid){
  const m = machine(mid); if (!m) return 'inconnue';
  if (ROOT.mOff.includes(mid)) return 'absente de la salle';
  if (lesson(n).hs.includes(mid)) return 'hors service';
  const z = zonesOf(n, sid);
  if (z.length && m.z.some(k => z.includes(k))) return 'inaptitude';
  return null;
}
function wuBlocked(n, sid, id){ const x = wuEx(id); const z = zonesOf(n, sid); if (!x) return 'inconnu';
  if (machine(id)) return blockOf(n, sid, id);
  return z.length && x.z.some(k => z.includes(k)) ? 'inaptitude' : null; }

/* ---------------------------------------------------------------------
   Piliers de la leçon (1 ou 2 ; évaluation finale : au choix, + Sécurité)
   Sur les tablettes élèves, L.pilS = copie reçue du prof (avec les observables retenus)
   --------------------------------------------------------------------- */
function lessonPils(n){
  const L = lesson(n);
  if (Array.isArray(L.pilS) && !isProfRole()) return L.pilS;
  return L.pil.map(id => { const p = pilier(id); if (!p || p.prof) return null;
    const keep = L.crit[id]; const cr = Array.isArray(keep) && keep.length ? p.cr.filter((_, i) => keep.includes(i)) : p.cr.filter(Boolean);
    return { id:p.id, n:p.n, ico:p.ico, cr }; }).filter(Boolean);
}
/* Échelle de Borg (ressenti de l'effort, 1 à 10) */
const BORG = [{ n:'aucun effort', c:'#DCE6F2', f:'#0A1633' }, { n:'très très facile', c:'#8EA9C9', f:'#0A1633' }, { n:'très facile', c:'#9BCB6B', f:'#0A1633' }, { n:'facile', c:'#7DBB4F', f:'#0A1633' },
  { n:'effort modéré', c:'#D6E05A', f:'#0A1633' }, { n:'moyen', c:'#FFE14D', f:'#0A1633' }, { n:'un peu dur', c:'#F6C04E', f:'#0A1633' }, { n:'dur', c:'#F29B3A', f:'#0A1633' },
  { n:'très dur', c:'#EC6A35', f:'#fff' }, { n:'très très dur', c:'#E0393A', f:'#fff' }, { n:'maximal', c:'#B71C1C', f:'#fff' }];
const borgOf = E => vals(E.bg);
function borgMean(n, sid){ const r = res(n, sid); if (!r) return null; return avg((r.ex || []).flatMap(borgOf)); }
const chipB = v => v == null ? '<span class="muted">—</span>' : (k => `<span class="wv" style="background:${BORG[k].c};color:${BORG[k].f}" title="${BORG[k].n}">${fmt(v)}</span>`)(Math.max(1, Math.min(10, Math.round(v))));
const maxPils = n => thOf(n) === 'evf' ? 6 : 2;

/* ---------------------------------------------------------------------
   Max : historique par élève et par machine
   S.mx[sid][m] = [{ v, n, mode }] reçus du prof (tablettes) ; résultats locaux : entrées « max »
   --------------------------------------------------------------------- */
function maxHist(sid, mid){
  const out = [];
  (S.mx[sid]?.[mid] || []).forEach(x => out.push({ ...x, src:'prof' }));
  Object.keys(S.results).forEach(n => { const r = S.results[n]?.[sid]; if (!r) return;
    (r.ex || []).forEach(E => { if (E.k === 'max' && E.m === mid && E.v > 0) {
      const i = out.findIndex(x => x.n === +n && x.src === 'prof'); if (i >= 0) out.splice(i, 1);
      out.push({ v:E.v, n:+n, mode:E.mode, kg:E.kg, r:E.r, ts:E.ts || r.ts || 0, src:E.src || 'local' }); } }); });
  return out.sort((a, b) => a.n - b.n || (a.ts || 0) - (b.ts || 0));
}
function maxAt(sid, mid, n){ const h = maxHist(sid, mid).filter(x => x.n <= n); return h.length ? h[h.length - 1] : null; }
const maxVal = (sid, mid, n) => maxAt(sid, mid, n)?.v ?? null;
function maxedMachines(sid, n){ const ids = new Set(Object.keys(S.mx[sid] || {}));
  Object.keys(S.results).forEach(k => (S.results[k]?.[sid]?.ex || []).forEach(E => { if (E.k === 'max' && E.m && E.v > 0) ids.add(E.m); }));
  return MACHINES.filter(m => ids.has(m.id) && (n == null || maxVal(sid, m.id, n) != null)).map(m => m.id); }
const MAX_MODES = { '1rm':'1RM (charge max en 1 fois)', brz:'Formule de Brzycki', reps:'Nombre de répétitions' };
function maxFromEntry(E){
  if (E.mode === 'reps') return E.r > 0 ? E.r : null;
  if (E.mode === '1rm') return E.kg > 0 ? E.kg : null;
  if (E.mode === 'brz') return E.kg > 0 && E.r >= 1 && E.r <= BRZ_MAX_R ? Math.round(brzycki(E.kg, E.r) * 10) / 10 : null;
  return null;
}
const fmtMax = (mid, v) => v == null ? '—' : isPdc(mid) ? `${v} rép.` : fmtKg(v);

/* ---------------------------------------------------------------------
   Mobile de l'élève et charges à réaliser
   --------------------------------------------------------------------- */
function mobOf(n, sid){
  const T = THEMES[thOf(n)]; if (!T || !T.mobs) return null;
  const r = res(n, sid);
  if (r?.mob && T.mobs.includes(r.mob)) return r.mob;
  return T.mobs.length === 1 ? T.mobs[0] : null;
}
const enForme = (n, sid) => { const r = res(n, sid); if (r?.ef != null) return !!r.ef; const f = foOf(n, sid); return f == null ? true : f >= 6; };
function target(n, sid, E){
  if (E.k === 'coach' || E.k === 'free') {
    const kg = E.kg > 0 ? E.kg : null;
    return { s:E.s || 0, r:E.r || 0, rest:E.rest || 0, pct:E.pct || null, kg, zone: kg ? kgZone(kg) : null, custom:true };
  }
  const mob = E.mob || mobOf(n, sid); const M = MOB[mob]; if (!M) return null;
  const pct = mob === 'vol' ? (enForme(n, sid) ? M.pct : M.pctLow) : M.pct;
  const mx = E.m ? maxVal(sid, E.m, n) : null;
  if (isPdc(E.m)) { const r = mx ? Math.max(1, Math.round(mx * pct / 100)) : M.r;
    return { s:M.s, r, rest:M.rest, pct, kg:null, zone:null, pdc:true, noMax: !mx, mx }; }
  const kg = mx ? mx * pct / 100 : null;
  return { s:M.s, r:M.r, rest:M.rest, pct, kg, zone: kgZone(kg), noMax: !mx, mx };
}
const ryOf = (n, sid, E) => (E.k === 'coach' ? MOB[res(n, sid)?.coach?.mob] : MOB[E.mob || mobOf(n, sid)])?.ry || '';
const tgtTxt = t => !t ? '' : `${t.s}s × ${t.r}reps${t.zone ? ' · ' + t.zone.t : t.kg && t.custom ? ' · ' + fmtKg(t.kg) : t.noMax && !t.pdc ? ' · ⚠️ pas de max' : ''}${t.rest ? ' · ⏳ ' + fmtRest(t.rest) : ''}`;
/* Groupes musculaires autorisés pour le prochain exercice du thème */
function slotRule(n, sid, list){
  const mob = mobOf(n, sid); const M = MOB[mob]; if (!M) return { ok: () => true, full:false, hint:'' };
  const th = list.filter(E => E.k === 'th');
  const i = th.length, gs = th.map(E => machine(E.m)?.g);
  if (M.rule === '2x2') {
    if (i >= 4) return { ok: () => false, full:true, hint:'4 exercices faits' };
    if (i === 1 || i === 3) return { ok: g => g === gs[i-1], full:false, hint:`2ᵉ exercice du groupe ${GROUPS[gs[i-1]]?.n || ''}` };
    if (i === 2) return { ok: g => g !== gs[0], full:false, hint:'Groupe musculaire n°2 (différent du premier)' };
    return { ok: () => true, full:false, hint:'Groupe musculaire n°1 · exercice 1' };
  }
  if (M.rule === 'diff') {
    if (i >= M.nbEx) return { ok: () => false, full:true, hint:`${M.nbEx} exercices faits` };
    return { ok: g => !gs.includes(g), full:false, hint: i ? 'Groupe musculaire différent des précédents' : 'Exercice 1' };
  }
  if (i >= M.nbEx) return { ok: () => false, full:true, hint:`${M.nbEx} exercices faits` };
  return { ok: () => true, full:false, hint:`Exercice ${i + 1} / ${M.nbEx} · groupe libre` };
}

/* ---------------------------------------------------------------------
   Observations et bilans
   --------------------------------------------------------------------- */
const vals = arr => (arr || []).filter(v => v != null && !isNaN(v));
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
/* Piliers : chaque critère est situé de Jamais à Toujours (1RM : Oui / Non), la note /10 en découle (au dixième) */
const CRIT_PTS = [0, 2, 4, 6, 8, 10];
const isBin = E => E.k === 'max' && E.mode === '1rm';
function critNote(arr, bin){ const v = (arr || []).filter(x => x != null); if (!v.length) return null; return Math.round(avg(v.map(f => bin ? (f ? 10 : 0) : CRIT_PTS[f])) * 10) / 10; }
function critSucc(arr, nc, bin){ const v = (arr || []).slice(0, nc); if (v.length < nc || v.some(x => x == null)) return null;
  const f = v.map(x => bin ? (x ? 5 : 0) : x), note = critNote(arr, bin);
  if (f.every(x => x >= 4)) return 'vf'; if (f.every(x => x >= 3)) return 'vc'; return note >= 5 ? 'j' : note >= 3 ? 'o' : 'r'; }
const noteSucc = v => v == null ? null : v >= 8 ? 'vf' : v >= 6 ? 'vc' : v >= 5 ? 'j' : v >= 3 ? 'o' : 'r';
const obMean = (E, pid) => avg(vals(E.ob?.[pid]));
function pilMeans(n, sid){                     // moyenne de chaque pilier sur la leçon
  const out = {}; const r = res(n, sid); if (!r) return out;
  lessonPils(n).forEach(p => { const v = vals((r.ex || []).flatMap(E => vals(E.ob?.[p.id]))); if (v.length) out[p.id] = avg(v); });
  return out;
}
/* notes de piliers données par un observateur pendant une leçon (ob = null : tous les observateurs) */
function obsGiven(n, ob){ const out = [];
  Object.values(S.results[n] || {}).forEach(r => (r.ex || []).forEach(E => { if (!E.by || E.by === 'x' || (ob && E.by !== ob)) return; Object.values(E.ob || {}).forEach(a => out.push(...vals(a))); }));
  return out; }
/* binômes : dernier élève observé par chaque observateur (d'après les saisies) */
function pairsFromResults(){ const best = {};
  Object.values(S.results).forEach(byS => Object.entries(byS).forEach(([sid, r]) => (r.ex || []).forEach(E => { if (!E.by || E.by === 'x') return; const ts = E.ts || r.ts || 0;
    if (!best[E.by] || ts > best[E.by].ts) best[E.by] = { sid, ts }; })));
  return Object.fromEntries(Object.entries(best).map(([k, v]) => [k, v.sid])); }
const repsDone = E => vals(E.sets).reduce((a, b) => a + b, 0);
const setsDone = E => vals(E.sets).length;
function exDone(n, sid, E){ if (E.k === 'max') return E.v > 0; const t = target(n, sid, E); return t && t.s ? setsDone(E) >= t.s : setsDone(E) > 0; }
function lessonState(n, sid){                  // pour les tuiles : nb d'exercices faits / prévus
  const r = res(n, sid), list = r?.ex || [];
  const done = list.filter(E => exDone(n, sid, E)).length;
  const M = MOB[mobOf(n, sid)];
  const plan = M ? M.nbEx : null;
  return { done, nb: list.length, plan, any: !!(r && (list.length || r.wu?.ex?.length || r.fo || r.mo || r.coach)) };
}
const scaleText = v => v >= 5 && v <= 7 ? '#0A1633' : '#fff';
const chipV = v => v == null ? '<span class="muted">—</span>' : `<span class="wv" style="background:${scaleColor(v)};color:${scaleText(v)}">${fmt(v)}</span>`;
/* note d'évaluation (prof) : moyenne des piliers notés de 1 à 10 → note /10 */
function evalNote(n, sid){ const e = lesson(n).ev[sid]; if (!e) return null; const ids = evalPils(n, sid); const v = vals(ids.map(id => e[id])); return v.length && v.length === ids.length ? Math.round(avg(v) * 10) / 10 : null; }
function evalPils(n, sid){ const L = lesson(n); if (thOf(n) === 'evi') return (L.evp[sid] && L.evp[sid].length ? L.evp[sid] : L.pil).slice(0, 3); return [...L.pil, ...piliers().filter(p => p.prof && !L.pil.includes(p.id)).map(p => p.id)]; }
/* ---------------------------------------------------------------------
   Roue crantée (molette circulaire graduée) : répétitions validées et piliers (1 → 10)
   --------------------------------------------------------------------- */
const DIAL_START = -135, DIAL_SPAN = 270, CX = 100, CY = 100, DR = 80;
function pol(r, a){ const t = a*Math.PI/180; return [CX + r*Math.sin(t), CY - r*Math.cos(t)]; }
function arc(r, a0, a1){ const [x0,y0]=pol(r,a0),[x1,y1]=pol(r,a1); return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${a1-a0>180?1:0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; }
/* cfg : { v, min, max, t (repère cible), kind:'reps'|'pil', lbl } */
function dialColor(cfg, v){
  if (v == null) return '#9AA3B5';
  if (cfg.kind === 'pil') return scaleColor(v);
  if (cfg.kind === 'borg') return BORG[v]?.c || '#9AA3B5';
  const T = cfg.t || cfg.tgt; if (T) { const q = v / T; return q >= 1 ? '#1E8E3E' : q >= .8 ? '#86DC96' : q >= .6 ? '#FFD000' : q >= .4 ? '#F07000' : '#D0161B'; }
  return '#0062C4';
}
const dialFg = (cfg, v) => { if (cfg.kind === 'borg') return v == null ? '#fff' : BORG[v].f; const c = dialColor(cfg, v); return ['#86DC96','#FFD000','#C8D93A','#F59E0B'].includes(c) || (cfg.kind === 'pil' && v >= 5 && v <= 7) ? '#0A1633' : '#fff'; };
function dialInner(cfg){
  const { v, min, max } = cfg, span = max - min, step = DIAL_SPAN / span, col = dialColor(cfg, v);
  const nb = span + 1, [rr, ro, fs] = nb <= 11 ? [14, 18, 16] : nb <= 16 ? [11, 15, 13] : nb <= 21 ? [9, 13, 11] : [7.5, 12, 9.5];
  const showEvery = nb > 26 ? 5 : nb > 21 ? 2 : 1;
  let s = `<path d="${arc(DR, DIAL_START, -DIAL_START)}" stroke="#DCE2EE" stroke-width="20" fill="none" stroke-linecap="round"/>`;
  if (v != null && v > min) s += `<path d="${arc(DR, DIAL_START, DIAL_START + (v - min)*step)}" stroke="${col}" stroke-width="20" fill="none" stroke-linecap="round"/>`;
  for (let i = min; i <= max; i++) {
    const ang = DIAL_START + (i - min)*step, [x,y] = pol(DR, ang), on = v === i, isT = cfg.t === i;
    const lab = on || isT || (i - min) % showEvery === 0 || i === max;
    if (isT) s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${ro+4}" fill="none" stroke="#F07000" stroke-width="4" stroke-dasharray="4 3"/>`;
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${on?ro:lab?rr:rr*.45}" fill="${on?col:'#fff'}" stroke="${on?'#0A1633':'#0062C46B'}" stroke-width="2.5"/>`;
    if (lab) s += `<text x="${x.toFixed(1)}" y="${(y+(on?6:4.5)).toFixed(1)}" text-anchor="middle" font-size="${on?fs+3:fs}" fill="${on?dialFg(cfg, v):'#0062C4'}">${i}</text>`;
  }
  s += `<circle cx="100" cy="94" r="30" fill="${v==null?'#fff':col}" stroke="${v==null?'#DCE2EE':'#0A1633'}" stroke-width="2.5"/>
        <text x="100" y="107" text-anchor="middle" font-size="36" fill="${v==null?'#9AA3B5':dialFg(cfg, v)}">${v==null?'–':v}</text>
        <text x="100" y="142" text-anchor="middle" font-size="14" fill="#5B6478">${esc(cfg.lbl || '')}</text>`;
  return s;
}
/* data-* de la molette : kind, e (entrée), i (série), p (pilier), min, max, t */
function dialHTML(cfg, attrs){
  return `<svg class="dial" viewBox="0 0 200 200" ${attrs} data-v="${cfg.v ?? ''}" data-min="${cfg.min}" data-max="${cfg.max}" data-t="${cfg.t ?? ''}" data-tgt="${cfg.tgt ?? ''}" data-kind="${cfg.kind}" data-lbl="${esc(cfg.lbl||'')}">${dialInner(cfg)}</svg>`;
}
function bindDials(onSet){
  document.querySelectorAll('svg.dial').forEach(svg => {
    const min = +svg.dataset.min, max = +svg.dataset.max, t = svg.dataset.t === '' ? null : +svg.dataset.t, step = DIAL_SPAN / (max - min);
    const cfg = { min, max, t, tgt: svg.dataset.tgt === '' ? null : +svg.dataset.tgt, kind: svg.dataset.kind, lbl: svg.dataset.lbl };
    let dragging = false, cur = svg.dataset.v === undefined || svg.dataset.v === '' ? null : +svg.dataset.v;
    const valFromEvent = e => {
      const b = svg.getBoundingClientRect();
      const x = (e.clientX - b.left) * 200 / b.width - CX, y = (e.clientY - b.top) * 200 / b.height - CY;
      if (Math.hypot(x, y) < 30) return null;
      let ang = Math.atan2(x, -y) * 180 / Math.PI;
      if (ang > 157.5) ang = 135; if (ang < -157.5) ang = -135;
      return Math.max(min, Math.min(max, min + Math.round((ang - DIAL_START) / step)));
    };
    const show = v => { svg.innerHTML = dialInner({ ...cfg, v }); };
    svg.addEventListener('pointerdown', e => { e.preventDefault(); dragging = true; svg.setPointerCapture(e.pointerId);
      const v = valFromEvent(e); if (v != null) { cur = v; show(v); } });
    svg.addEventListener('pointermove', e => { if (!dragging) return; const v = valFromEvent(e); if (v != null && v !== cur) { cur = v; show(v); } });
    const end = () => { if (!dragging) return; dragging = false; if (cur != null && String(cur) !== svg.dataset.v) { svg.dataset.v = cur; onSet(svg.dataset, cur); } };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  });
}

/* ---------------------------------------------------------------------
   Chrono de récupération (bandeau en bas de l'écran)
   --------------------------------------------------------------------- */
/* plusieurs chronos en même temps (ex. Puissance : on enchaîne un autre exercice pendant les 3 min de récupération) */
const RESTS = {}; let restTick = null;
function startRest(sec, label, key){
  if (!sec) return; key = key || 'g' + rnd(3);
  RESTS[key] = { end: now() + sec * 1000, sec, label, done: 0 };
  drawRests(); if (!restTick) restTick = setInterval(drawRests, 500);
}
function stopRest(key){ if (key) delete RESTS[key]; else Object.keys(RESTS).forEach(k => delete RESTS[k]); drawRests(); }
function drawRests(){
  let box = document.getElementById('rests');
  Object.keys(RESTS).forEach(k => { const R = RESTS[k]; if (R.done && now() - R.done > 8000) delete RESTS[k]; });
  const ks = Object.keys(RESTS).sort((a, b) => RESTS[a].end - RESTS[b].end);
  if (!ks.length) { box?.remove(); clearInterval(restTick); restTick = null; return; }
  if (!box) { box = document.createElement('div'); box.id = 'rests'; box.className = 'rests'; document.body.appendChild(box); }
  box.innerHTML = ks.map(k => { const R = RESTS[k], left = Math.max(0, Math.round((R.end - now()) / 1000));
    if (!left && !R.done) { R.done = now(); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); }
    return `<div class="rest ${left ? '' : 'over'}"><span class="rest-i">⏳</span><div class="rest-m"><b>${left ? 'Récupération' : '⏰ C\'est reparti'}${R.label ? ' · ' + esc(R.label) : ''}</b><div class="rest-bar"><span style="width:${100 - left / R.sec * 100}%"></span></div></div>
      <span class="rest-t">${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</span><button class="btn small" data-action="restStop" data-k="${k}">✕</button></div>`; }).join('');
}
/* ---------------------------------------------------------------------
   Rendu général
   --------------------------------------------------------------------- */
function setTop(main, sub, right=''){
  $('#tb-main').textContent = main; $('#tb-sub').textContent = '🏫 ' + className() + (sub ? ' · ' + sub : ''); $('#tb-right').innerHTML = right;
}
function go(view, opts={}){ Object.assign(UI, opts); UI.view = view; render(); window.scrollTo(0,0); }
function rerender(){ const y = window.scrollY; render(); window.scrollTo(0, y); }
function render(){
  stopScan();
  let v = UI.view; const m = $('#main');
  if (!ROOT.role) { setTop('Musculation · CA5', 'Choix du rôle de la tablette'); m.innerHTML = viewRole(); return; }
  const prof = isProfRole();
  if (!prof && !['home','saisie','entry','send','receive','suivi','suiviDetail'].includes(v)) v = UI.view = 'home';
  if (prof && !UI.profUnlocked && v !== 'home') v = UI.view = 'home';
  if (prof && UI.profUnlocked && v === 'home') { v = UI.view = 'prof'; UI.profTab = 'menu'; }
  const homeBtn = `<button class="btn small" data-action="go" data-view="home">⌂ Accueil</button>`;
  const menuBtn = `<button class="btn small" data-action="profTab" data-tab="menu">☰ Menu</button>`;
  if (v === 'home') { setTop('Musculation · CA5', prof ? 'Tablette enseignant' : 'Tablette élève'); m.innerHTML = prof ? viewHomeProfLocked() : viewHomeEleve(); }
  else if (v === 'saisie') { setTop('Séance · Leçon ' + curLesson(), lessonTitle(curLesson()), prof ? menuBtn : homeBtn); m.innerHTML = (prof ? sectHeader('jour') : '') + viewSaisie(); }
  else if (v === 'entry') { setTop(nameOf(UI.sid), lessonLabel(curLesson()), `<button class="btn small" data-action="go" data-view="saisie">▦ Élèves</button>`); m.innerHTML = viewEntry(); bindEntry(); }
  else if (v === 'suivi') { setTop('Suivi des élèves', 'Choisir un élève', prof ? menuBtn : homeBtn); m.innerHTML = (prof ? sectHeader('bilans') : '') + viewSuiviTiles(); }
  else if (v === 'suiviDetail') { setTop('Suivi · ' + nameOf(UI.sid), '', `<button class="btn small" data-action="go" data-view="suivi">▦ Élèves</button>`); m.innerHTML = viewSuiviDetail(UI.sid); }
  else if (v === 'prof') { setTop('Espace enseignant', lessonLabel(curLesson()), `<button class="btn small" data-action="toEleve" title="Passer en espace élève">🧒</button>`); m.innerHTML = viewProf(); afterProf(); }
  else if (v === 'send') { setTop('Envoyer mes saisies', 'QR code à scanner par l\'enseignant', homeBtn); m.innerHTML = viewSend(); afterSend(); }
  else if (v === 'receive') { setTop('Scanner la leçon', 'QR affiché par l\'enseignant', homeBtn); m.innerHTML = viewReceive(); afterReceive(); }
}

/* ---------------------------------------------------------------------
   Accueil
   --------------------------------------------------------------------- */
function viewRole(){
  return `<div class="home">
    <img class="home-logo" src="logo-app.png" alt="N'EPS numérique – Musculation">
    <div class="home-lesson"><div class="big">Cette tablette est…</div></div>
    <div class="home-grid two">
      <button class="home-btn prof" data-action="setRole" data-r="prof"><span class="ico">👩‍🏫</span>Tablette enseignant<small>Cycle · appel · QR de la leçon · récupérer · bilans</small></button>
      <button class="home-btn saisie" data-action="setRole" data-r="eleve"><span class="ico">🧒</span>Tablette élève<small>Scanner la leçon · observer · saisir · envoyer</small></button>
    </div></div>`;
}
function lessonBanner(n){
  const T = THEMES[thOf(n)], L = lesson(n), pres = S.students.filter(s => present(n, s.id)).length, pils = lessonPils(n);
  return `<div class="home-lesson" style="border-color:${T.c}"><div class="big">Leçon ${n} / ${S.settings.nbLessons}</div>
    <div class="theme-badge" style="background:${T.c}">${T.ico} ${esc(T.n)}</div>
    ${pils.length ? `<div class="muted" style="font-weight:800;margin-top:6px">${pils.map(p => `${p.ico} ${esc(p.n)}`).join(' · ')}</div>` : ''}
    <div class="muted" style="font-weight:700">${L.suivi === 'e' ? '📋 Suivi par exercice' : '🔁 Suivi série par série'} · ${pres}/${S.students.length} présent(s)${L.hs.length ? ` · 🚫 ${L.hs.map(mName).join(', ')}` : ''}</div></div>`;
}
function viewHomeEleve(){
  const has = S.students.length && ROOT.seance && ROOT.seance.cid === S.id;
  const n = curLesson();
  return `<div class="home">
    <img class="home-logo" src="logo-app.png" alt="N'EPS numérique – Musculation">
    ${has ? `<div class="class-chips"><span class="class-chip on">🏫 ${esc(className())}</span></div>${lessonBanner(n)}
      <div class="muted" style="font-size:14px">Leçon scannée le ${new Date(ROOT.seance.at).toLocaleDateString('fr-FR')} à ${new Date(ROOT.seance.at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>`
      : `<div class="home-lesson"><div class="big">Aucune leçon</div><div style="font-weight:800">Scanne le QR de la leçon affiché par ton enseignant.</div></div>`}
    <div class="home-grid row4">
      <button class="home-btn scan" data-action="go" data-view="receive"><span class="ico">📷</span>Scanner la leçon</button>
      <button class="home-btn saisie" data-action="goSaisie" ${has ? '' : 'disabled'}><span class="ico">✍️</span>Observer / saisir</button>
      <button class="home-btn stats" data-action="go" data-view="suivi" ${has ? '' : 'disabled'}><span class="ico">📈</span>Mon suivi</button>
      <button class="home-btn send" data-action="go" data-view="send" ${has ? '' : 'disabled'}><span class="ico">📤</span>Envoyer mes saisies</button>
    </div></div>`;
}
function viewHomeProfLocked(){
  return `<div class="home">
    <img class="home-logo" src="logo-app.png" alt="N'EPS numérique – Musculation">
    <div class="class-chips"><span class="class-chip on">🏫 ${esc(className())}</span></div>
    ${lessonBanner(curLesson())}
    <div class="home-grid one"><button class="home-btn prof" data-action="openProf"><span class="ico">🔒</span>Espace enseignant</button></div></div>`;
}

/* ---------------------------------------------------------------------
   Tuiles élèves (groupes = tablettes)
   --------------------------------------------------------------------- */
const nbGroups = () => Math.max(1, Math.min(MAX_GROUPS, +S.settings.nbGroups || 1));
const groupColor = g => (g >= 1 && g <= nbGroups() && nbGroups() > 1) ? colorOf(S.settings.groupColors[g-1]) : null;
const groupName = g => `Groupe ${g}`;
function grpOf(sid, n){ const L = lesson(n || curLesson()), ov = L.grpOv[sid]; return ov != null ? +ov : (student(sid)?.grp || 0); }
function band(sid){ const c = groupColor(grpOf(sid)); return c ? `<span class="band" style="background:${c.c};box-shadow:inset -2px 0 0 rgba(0,0,0,.35)"></span>` : '<span class="band"></span>'; }
const passFilter = s => !UI.filter || UI.filter === 'all' || grpOf(s.id) === UI.filter;
function viewSaisie(){
  const n = curLesson();
  if (!S.students.length) return `<div class="card strong center">Aucun élève. Scanne d'abord le QR de la leçon depuis l'accueil.</div>`;
  if (nbGroups() > 1 && !UI.filter) {
    return `<div class="grp-pick">${Array.from({length:nbGroups()},(_,i)=>i+1).map(g => { const c = groupColor(g);
      const nb = S.students.filter(x => grpOf(x.id, n) === g && present(n, x.id)).length;
      return `<button class="grp-btn" data-action="pickGroup" data-g="${g}"><span class="sw" style="background:${c?c.c:'#ccc'}"></span>${groupName(g)}<small>${nb} élève(s)</small></button>`; }).join('')}
      <button class="grp-btn all" data-action="pickGroup" data-g="all">Toute la classe</button></div>`;
  }
  const grpBtn = nbGroups() > 1 ? `<button class="btn small" data-action="pickGroup" data-g="">🎽 ${UI.filter && UI.filter !== 'all' ? groupName(UI.filter) + ' · changer' : 'Changer de groupe'}</button>` : '';
  const list = sortedStudents().filter(s => present(n, s.id) && passFilter(s));
  const ob = S.curObs;
  /* 1. Qui es-tu ? (l'observateur tient la tablette) */
  if (!ob) return `<div class="card strong"><div class="row"><b style="font-size:22px" class="grow">👤 Qui es-tu ?</b>${grpBtn}</div>
      <div class="muted" style="font-weight:700">Tu tiens la tablette et tu observes un camarade. Touche ton prénom.</div></div>
    <div class="tiles">${list.map(s => `<button class="tile obs-tile" data-action="pickObs" data-sid="${s.id}">${band(s.id)}<span class="name">${esc(nameOf(s.id))}</span>${S.pairs?.[s.id] && student(S.pairs[s.id]) ? `<span class="meta">observe d'habitude ${esc(nameOf(S.pairs[s.id]))}</span>` : ''}</button>`).join('')}
      <button class="tile obs-tile" data-action="pickObs" data-sid="x"><span class="name">👩‍🏫 Enseignant</span><span class="meta">ou observateur absent de la liste</span></button></div>`;
  /* 2. Qui observes-tu ? (le partenaire habituel en premier) */
  const pair = S.pairs?.[ob], others = list.filter(s => s.id !== ob && s.id !== pair);
  const sug = pair && list.some(s => s.id === pair) ? pair : null;
  return `<div class="card strong obs-bar"><div class="row"><span class="obs-who">👤 Observateur : <b>${ob === 'x' ? 'Enseignant' : esc(nameOf(ob))}</b></span>
      <button class="btn small" data-action="changeObs">🔁 Changer d'observateur</button>${grpBtn}</div>${ob !== 'x' ? obsFeedback(n, ob) : ''}</div>
    <div class="card strong"><b style="font-size:22px">👀 Qui observes-tu ?</b>${sug ? '' : '<div class="muted" style="font-weight:700">Ton choix sera proposé en premier les prochaines fois.</div>'}</div>
    ${sug ? `<div class="sug-wrap"><div class="sug-h">⭐ Ton partenaire habituel</div><div class="tiles one">${saisieTile(n, student(sug), true)}</div><div class="sug-h muted">Ou quelqu'un d'autre :</div></div>` : ''}
    <div class="tiles">${others.map(s => saisieTile(n, s)).join('') || '<p>Aucun autre élève dans ce groupe.</p>'}</div>`;
}
/* Retour à l'observateur : moyenne des notes qu'il a données (piliers) comparée à celle de la classe */
function obsFeedback(n, ob){
  const mine = obsGiven(n, ob), all = obsGiven(n, null);
  if (!mine.length) return `<div class="obs-fb muted">📊 Tes notes du jour s'afficheront ici : moyenne des notes que tu donnes sur les piliers.</div>`;
  const m = avg(mine), c = all.length > mine.length ? avg(all) : null, d = c == null ? 0 : m - c;
  const tip = c == null ? '' : d > 1.5 ? '🤔 Tu notes plus large que les autres observateurs : vérifie bien chaque critère avant de donner 9 ou 10.'
    : d < -1.5 ? '🤔 Tu notes plus sévèrement que les autres observateurs : compte bien les critères réussis.' : '👍 Tes notes sont proches de celles des autres observateurs.';
  return `<div class="obs-fb">📊 Tes notes aujourd'hui : moyenne ${chipV(m)} sur ${mine.length} note(s)${c != null ? ` · moyenne des observateurs ${chipV(c)}` : ''}${tip ? `<div>${tip}</div>` : ''}</div>`;
}
function saisieTile(n, s, sug){
  const st = lessonState(n, s.id), M = MOB[mobOf(n, s.id)], z = zonesOf(n, s.id);
  const done = st.plan ? st.done >= st.plan : false;
  return `<button class="tile ${done ? 'done' : ''} ${sug ? 'sug' : ''}" data-action="entry" data-sid="${s.id}">${band(s.id)}${done ? '<span class="check">✓</span>' : ''}
    <span class="name">${esc(nameOf(s.id))}</span>
    ${M ? `<span class="target">${M.ico} ${esc(M.n)}</span>` : ''}
    ${z.length || attOf(n, s.id) === 'inap' ? `<span class="tag inapte">🩹 ${esc(z.map(zoneName).join(', ') || 'Inaptitude')}</span>` : ''}
    <span class="meta">🏋️ ${st.done} exercice(s) fait(s)${st.plan ? ' / ' + st.plan : ''}</span></button>`;
}

/* ---------------------------------------------------------------------
   Fiche de séance d'un élève (tenue par l'observateur)
   --------------------------------------------------------------------- */
const findE = (n, sid, eid) => (res(n, sid)?.ex || []).find(E => E.id === eid) || null;
function viewEntry(){
  const n = curLesson(), sid = UI.sid, s = student(sid), L = lesson(n), th = thOf(n), T = THEMES[th];
  if (!s) return '<p>Élève introuvable.</p>';
  const r = res(n, sid) || {};
  const list = sortedStudents().filter(x => present(n, x.id) && passFilter(x));
  const i = list.findIndex(x => x.id === sid), prev = list[i-1], next = list[i+1];
  let h = `<div class="entry-name">${band(sid)}<div class="who">${esc(nameOf(sid))}</div><span class="saved" id="saved-flag"></span>
    <span class="theme-badge" style="background:${T.c}">${T.ico} ${esc(T.n)}</span>
    ${S.curObs ? `<span class="obs-by">👀 observé par <b>${S.curObs === 'x' ? 'l\'enseignant' : esc(nameOf(S.curObs))}</b></span>` : ''}
    <button class="btn" data-action="go" data-view="saisie" style="margin-left:auto">← Élèves</button></div>`;
  h += startBlock(n, sid, r);
  if (th !== 'coach') h += wuBlock(n, sid, r);
  if (th === 'hippo') h += `<div class="card strong center"><h2>🦛 Séance Hippopogramme</h2><p style="font-weight:700">Aujourd'hui, la séance se fait avec l'appli <b>Hippopogramme</b>.<br>À la fin, ton enseignant récupère les résultats en scannant le QR de la tablette Hippopogramme.</p></div>`;
  else {
    if (th === 'coach') h += coachBlock(n, sid, r) + (coachRole(n, sid, r) ? wuBlock(n, sid, r) : '');
    if (T.mobs && th !== 'coach') h += mobBlock(n, sid, r);
    if (th === 'evi') h += `<div class="advice info">📝 <b>Évaluation intermédiaire</b> : ton enseignant t'observe et te note sur ${lessonPils(n).length > 1 ? 'les piliers' : 'le pilier'} du jour. L'observateur saisit tes séries comme d'habitude.</div>`;
    if (th === 'evf') h += `<div class="advice info">🏆 <b>Évaluation finale</b> : réalise ton projet <b>exactement</b> comme tu l'as écrit. L'observateur te juge sur les critères ci-dessous.</div>`;
    h += pilReminder(n);
    h += `<div class="ex-list">${(r.ex || []).map((E, k) => exCard(n, sid, E, k)).join('')}</div>`;
    h += addBar(n, sid, r);
  }
  h += `<div class="nav-bottom">
      <button class="btn" data-action="entry" data-sid="${prev?.id||''}" ${prev?'':'disabled'}>← ${prev?esc(nameOf(prev.id)):'Précédent'}</button>
      <button class="btn primary" data-action="go" data-view="saisie">▦ Retour aux élèves</button>
      <button class="btn" data-action="entry" data-sid="${next?.id||''}" ${next?'':'disabled'}>${next?esc(nameOf(next.id)):'Suivant'} →</button></div>`;
  return h;
}
function flagSaved(){ const f=$('#saved-flag'); if (f){ f.textContent='✓ Enregistré'; clearTimeout(f._h); f._h=setTimeout(()=>f.textContent='',1500);} }
/* Début de cours : inaptitude éventuelle */
function startBlock(n, sid, r){
  const z = zonesOf(n, sid), at = attOf(n, sid);
  return `<div class="row inap-row">${at === 'inap' || z.length ? `<span class="tag inapte" style="font-size:16px">🩹 Inaptitude : ${esc(z.map(zoneName).join(', ') || 'partielle')}</span>` : ''}
      <button class="btn small ${r.z?.length ? 'red' : ''}" data-action="inapOpen">🩹 ${r.z?.length ? 'Modifier mon inaptitude' : 'Je déclare une inaptitude'}</button>
      ${z.length ? '<span class="muted" style="font-weight:700;font-size:15px">Machines adaptées · tu peux ajouter un ✏️ exercice adapté, choisi avec ton enseignant.</span>' : ''}</div>`;
}
/* Échauffement : Circuit Training ou 3 × 3 minutes */
function wuBlock(n, sid, r){
  const coach = thOf(n) === 'coach', LW = lesson(n).wu || {};
  const W = coach ? { t: r.wu?.t || (LW.t && LW.t !== 'none' ? LW.t : 'circuit'), nb: LW.nb || 6, dur: LW.dur || 30 } : LW; if (!W.t || W.t === 'none') return '';
  const w = r.wu || {}, ok = !!w.ok, open = UI.open['wu'] ?? !ok;
  const chip = (id, on, act, extra='') => { const x = wuEx(id), b = wuBlocked(n, sid, id);
    return `<button class="wu-chip ${on ? 'on' : ''} ${b ? 'blk' : ''}" data-action="${act}" data-id="${id}" ${extra} ${b ? 'disabled' : ''} title="${b ? esc(b) : ''}">${x.img ? mImg(x, 'wu-img') : `<span class="wu-ico">${x.ico}</span>`}<span>${esc(x.n)}</span></button>`; };
  let body = '';
  if (W.t === 'circuit') {
    const sel = w.ex || [];
    body = `<div class="muted" style="font-weight:700">${W.nb} exercices de ${W.dur} s · par deux : l'un fait, l'autre observe, puis on échange. ${coach ? 'Choisis les exercices que ton cobaye va faire' : 'Choisis tes exercices'} (${sel.length}/${W.nb}).</div>
      <div class="wu-grid">${WU_EX.map(x => chip(x.id, sel.includes(x.id), 'wuToggle')).join('')}</div>`;
  } else {
    const row = (k, t, ids) => `<h3 style="margin-top:10px">${t}</h3><div class="wu-grid">${ids.map(id => chip(id, w[k] === id, 'wuPick', `data-k="${k}"`)).join('')}</div>`;
    body = `<div class="muted" style="font-weight:700">3 minutes sur chaque atelier. ${coach ? 'Choisis un exercice par atelier pour ton cobaye.' : 'Choisis un exercice par atelier.'}</div>
      ${row('p', '1️⃣ 3 min · machine à poids de corps', PDC_3x3)}${row('c', '2️⃣ 3 min · cardio (circuit training)', WU_EX.map(x => x.id))}${row('e', '3️⃣ 3 min · endurance', ENDU)}`;
  }
  const sum = W.t === 'circuit' ? (w.ex || []).map(id => wuEx(id)?.n).join(', ') : ['p','c','e'].map(k => w[k] ? wuEx(w[k])?.n : null).filter(Boolean).join(' · ');
  return `<section class="wu-sec ${ok ? 'ok' : ''} ${open ? '' : 'folded'}"><h2 data-action="fold" data-k="wu">🔥 ${coach ? 'Échauffement que je fais faire à mon cobaye' : 'Échauffement'} · ${esc(WU_TYPES[W.t])} ${!open && sum ? `<span class="fold-sum">${esc(sum)}</span>` : ''}${ok ? ' <span class="tag ok">✓ fait</span>' : ''}<span class="fold-ico">${open ? '▲' : '▼'}</span></h2>
    ${open ? (coach ? `<div class="seg" style="max-width:460px;margin-bottom:8px">${['circuit','3x3'].map(k => `<button class="${W.t === k ? 'on norm' : ''}" data-action="wuType" data-t="${k}">${esc(WU_TYPES[k])}</button>`).join('')}</div>` : '') + body + `<div class="btn-row" style="margin-top:10px"><button class="btn ${ok ? 'green' : 'primary'}" data-action="wuDone">${ok ? '✓ Échauffement fait' : coach ? '✓ Échauffement réalisé par mon cobaye' : '✓ J\'ai fini mon échauffement'}</button></div>` : ''}</section>`;
}
/* Choix du mobile (Puissance 6×6 / 6×4 ; projet et évaluations : les 5 mobiles) */
function mobBlock(n, sid, r){
  const th = thOf(n), T = THEMES[th], mob = mobOf(n, sid), M = MOB[mob];
  let h = `<section class="mob-sec">`;
  if (T.mobs.length > 1) h += `<h2>🎯 ${th === 'pui' ? 'Je choisis ma formule' : 'Je choisis mon mobile'}</h2><div class="mob-grid">${T.mobs.map(k => `<button class="mob-btn ${mob === k ? 'on' : ''}" data-action="setMob" data-m="${k}"><b>${MOB[k].ico} ${esc(MOB[k].n)}</b><small>${esc(MOB[k].d)}</small></button>`).join('')}</div>`;
  else if (M) h += `<h2>${M.ico} ${esc(M.n)}</h2><div class="muted" style="font-weight:800">${esc(M.d)}</div>`;
  if (M?.ry) h += `<div class="ry-box">🎵 <b>Rythme</b> : ${esc(M.ry)}</div>`;
  if (mob === 'vol') { const ef = enForme(n, sid);
    h += `<div class="row" style="margin-top:10px"><b>Aujourd'hui :</b><div class="seg" style="min-width:320px"><button class="${ef ? 'on norm' : ''}" data-action="setEf" data-v="1">💪 En forme · 75 %</button><button class="${!ef ? 'on easy' : ''}" data-action="setEf" data-v="0">😐 Pas en forme · 70 %</button></div></div>`; }
  if (T.proj) { const P = S.projects[sid];
    h += `<div class="proj-box"><b>📋 Mon projet</b> ${P ? `<span class="muted" style="font-weight:700">${esc(MOB[P.mob]?.n || '')} · ${(P.ms || []).map(mName).join(', ')}</span>` : '<span class="muted">pas encore enregistré</span>'}
      <div class="btn-row" style="margin-top:6px">${P && !(r.ex || []).some(E => E.k === 'th') ? `<button class="btn small primary" data-action="loadProj">📋 Reprendre mon projet</button>` : ''}
      <button class="btn small" data-action="saveProj" ${mob ? '' : 'disabled'}>💾 Enregistrer ma séance comme projet</button></div></div>`; }
  return h + `</section>`;
}
/* Rappel des piliers observés et de leurs observables */
function pilReminder(n){
  const P = lessonPils(n); if (!P.length) return '';
  const L = lesson(n);
  return `<section class="pil-sec"><h2>👀 À observer · ${L.suivi === 'e' ? 'en fin d\'exercice' : 'à la fin de chaque série'}</h2><div class="pil-grid">${P.map(p => `<div class="pil-card"><b>${p.ico} ${esc(p.n)}</b><ul>${p.cr.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>`).join('')}</div>
    <div class="muted" style="font-weight:700;font-size:15px">Roue de 1 à 10 : 1 = jamais réussi · 10 = toujours parfaitement réussi.</div></section>`;
}
/* Boutons d'ajout */
function addBar(n, sid, r){
  const th = thOf(n), mob = mobOf(n, sid), list = r.ex || [], inap = hasInap(n, sid);
  const rule = mob ? slotRule(n, sid, list) : null;
  let b = '';
  if (th === 'coach') b += `<button class="btn primary big-add" data-action="addEx" data-k="coach">➕ Exercice de mon programme</button>`;
  else if (mob) b += `<button class="btn primary big-add" data-action="addEx" data-k="th" ${rule.full ? 'disabled' : ''}>➕ Exercice du thème${rule.hint ? `<small>${esc(rule.hint)}</small>` : ''}</button>`;
  else if (T_needsMob(th)) b += `<div class="advice warn">Choisis d'abord ${th === 'pui' ? 'ta formule' : 'ton mobile'} ci-dessus.</div>`;
  if (th !== 'hippo') b += `<button class="btn ${isMaxTheme(th) ? 'primary big-add' : 'orange'}" data-action="addEx" data-k="max">🏋️ Besoin de prendre un Max</button>`;
  if (inap) b += `<button class="btn" data-action="addEx" data-k="free">✏️ Exercice adapté (inaptitude)</button>`;
  return `<div class="add-bar">${b}</div>`;
}
const T_needsMob = th => !!THEMES[th]?.mobs && th !== 'coach';

/* ---------------------------------------------------------------------
   Carte d'un exercice
   --------------------------------------------------------------------- */
const KIND_TAG = { th:['Thème','proj'], max:['Prise de Max','mod'], free:['Adapté','inapte'], coach:['Mon programme','easy'] };
function exCard(n, sid, E, k){
  const m = machine(E.m), done = exDone(n, sid, E), g = m ? GROUPS[m.g] : null;
  const name = m ? m.n : (E.nm || 'Exercice adapté');
  const open = UI.open[E.id] ?? !done;
  const t = E.k === 'max' ? null : target(n, sid, E);
  let h = `<article class="ex-card ${done ? 'done' : ''} ${open ? '' : 'folded'}" id="ex-${E.id}">
    <header class="ex-head" data-action="fold" data-k="${E.id}">${mImg(m)}<div class="ex-t"><div class="ex-n">${k + 1}. ${esc(name)} <span class="tag ${KIND_TAG[E.k][1]}">${KIND_TAG[E.k][0]}</span>${g ? ` <span class="gchip" style="--gc:${g.c}">${esc(g.n)}</span>` : ''}</div>
      <div class="ex-tgt">${E.k === 'max' ? (E.v ? `Max : <b>${fmtMax(E.m, E.v)}</b>` : esc(MAX_MODES[E.mode] || '')) : esc(tgtTxt(t))}${done && E.k !== 'max' ? ` · ✓ ${repsDone(E)} rép.` : ''}</div></div>
      <span class="fold-ico">${open ? '▲' : '▼'}</span></header>`;
  if (open) {
    if (E.k === 'max') h += maxBody(n, sid, E);
    else h += setsBody(n, sid, E, t);
    h += `<div class="btn-row spread ex-foot"><button class="btn small ghost" data-action="delEx" data-e="${E.id}">🗑 Retirer</button>
      ${done ? `<button class="btn small" data-action="fold" data-k="${E.id}">▲ Replier</button>` : ''}</div>`;
  }
  h += `</article>`;
  if (E.k === 'th' && MOB[E.mob || mobOf(n, sid)]?.inter) h += interCard(n, sid, E);
  return h;
}
/* Prise de max : 1RM / Brzycki / répétitions */
function maxBody(n, sid, E){
  const pdc = isPdc(E.m), modes = pdc ? ['reps'] : ['1rm','brz'];
  const prev = maxHist(sid, E.m).filter(x => !(x.n === n && x.src !== 'prof')).pop();
  let h = `<div class="max-body"><div class="seg max-seg">${modes.map(md => `<button class="${E.mode === md ? 'on norm' : ''}" data-action="maxMode" data-e="${E.id}" data-v="${md}">${esc(MAX_MODES[md])}</button>`).join('')}</div>`;
  if (E.mode === '1rm') h += `<div class="kg-in"><span class="lbl">Charge la plus lourde soulevée 1 fois</span>${numIn('maxKg', E, E.kg, 'kg', 0.5, 400)}</div>`;
  if (E.mode === 'brz') h += `<div class="kg-in"><span class="lbl">Charge soulevée</span>${numIn('maxKg', E, E.kg, 'kg', 0.5, 400)}<b class="x">×</b>${numIn('maxR', E, E.r, 'répétitions', 1, BRZ_MAX_R)}<span class="lbl">(2 à ${BRZ_MAX_R})</span></div>`;
  if (E.mode === 'reps') h += `<div class="kg-in"><span class="lbl">Nombre de répétitions réalisées</span>${numIn('maxR', E, E.r, 'répétitions', 1, 150)}</div>`;
  const v = maxFromEntry(E);
  h += `<div class="max-res ${v ? 'on' : ''}"><div><span class="lbl">${E.mode === 'brz' ? 'Max estimé (Brzycki)' : 'Mon max'}</span><b>${v ? fmtMax(E.m, v) : '—'}</b></div>
    ${prev ? `<div><span class="lbl">Avant (L${prev.n})</span><b>${fmtMax(E.m, prev.v)}</b></div>${v ? `<div><span class="lbl">Évolution</span><b class="${v >= prev.v ? 'up' : 'down'}">${v >= prev.v ? '▲' : '▼'} ${pdc ? Math.round(v - prev.v) + ' rép.' : fmtKg(Math.abs(v - prev.v))}</b></div>` : ''}` : ''}</div>`;
  if (E.mode === 'brz') h += `<div class="muted brz-note">1RM = charge ÷ (1,0278 − 0,0278 × répétitions)${E.kg && E.r ? ` = ${fmt(E.kg)} ÷ (1,0278 − 0,0278 × ${E.r})` : ''}. Plus il y a de répétitions, moins l'estimation est fiable : au-delà de 15, elle ne l'est plus.</div>`;
  if (v && !pdc) h += `<div class="pct-row">${[50,60,70,75,80,90].map(p => `<span><small>${p} %</small>${kgZone(v * p / 100)?.t.replace('entre ', '') || '—'}</span>`).join('')}</div>`;
  if (v && pdc) h += `<div class="pct-row">${[50,60,70,75,80,90].map(p => `<span><small>${p} %</small>${Math.max(1, Math.round(v * p / 100))} rép.</span>`).join('')}</div>`;
  h += `</div>` + (v ? pilDials(n, E, 0, 'Fin de la prise de max') + nextBtn(n, sid, E) : '');
  return h;
}
/* boîte de saisie au clavier (charge, répétitions…) */
function numIn(f, E, v, unit, step, max, extra=''){
  return `<label class="num-in"><input type="number" inputmode="${step < 1 ? 'decimal' : 'numeric'}" step="${step}" min="0" max="${max}" data-field="${f}" data-e="${E.id}" ${extra} value="${v ?? ''}" placeholder="–"><span>${unit}</span></label>`;
}
/* Piliers : roue crantée (0 → 10) + échelle des critères + fréquence + couleur de réussite, l'une sous l'autre */
const FREQ = ['Jamais','Rarement','Parfois','Souvent','Très souvent','Toujours'];
const critLv = v => v == null ? null : v >= 9 ? 3 : v >= 6 ? 2 : v >= 3 ? 1 : 0;
const BANDS = [[3,'Tous les critères appliqués','9 ou 10'],[2,'Il manque un critère','6 à 8'],[1,'Il manque deux critères','3 à 5'],[0,'Aucun critère','0 à 2']];
const bandLbl = v => v == null ? 'palier' : ['aucun critère','manque 2 critères','manque 1 critère','tous les critères'][critLv(v)];
const SUCC = { vf:{ n:'Réussite', c:'#0B4F1C', f:'#fff' }, vc:{ n:'Presque réussi', c:'#86DC96', f:'#0A1633' }, j:{ n:'En cours', c:'#FFD000', f:'#0A1633' }, o:{ n:'Fragile', c:'#F07000', f:'#fff' }, r:{ n:'Non réussi', c:'#D0161B', f:'#fff' } };
function succOf(v, fq){
  if (v == null) return null; const c = critLv(v);
  if (fq == null) return c === 3 ? 'vf' : c === 2 ? 'j' : c === 1 ? 'o' : 'r';
  if (c === 3 && fq >= 4) return 'vf';
  if (c === 3 && fq === 3) return 'vc';
  if ((c === 3 && fq >= 1) || (c === 2 && fq >= 3)) return 'j';
  if ((c === 2 && fq >= 1) || (c === 1 && fq >= 3)) return 'o';
  return 'r';
}
const succChip = k => k ? `<span class="succ" style="background:${SUCC[k].c};color:${SUCC[k].f}">${SUCC[k].n}</span>` : '';
const withFreq = E => !(E.k === 'max' && E.mode === '1rm');
function pilDials(n, E, i, title){
  const P = lessonPils(n), bin = isBin(E), bg = E.bg?.[i] ?? null;
  const opts = bin ? [['Non', 0], ['Oui', 1]] : FREQ.map((f, k) => [f, k]);
  return `<div class="pil-dials"><div class="pd-h">👀 ${esc(title)}</div>${P.map(p => { const oc = E.oc?.[p.id]?.[i] || [], note = E.ob?.[p.id]?.[i] ?? null;
    const done = p.cr.every((_, c) => oc[c] != null), sk = done ? critSucc(oc, p.cr.length, bin) : null;
    let low = -1; if (done) p.cr.forEach((_, c) => { if (low < 0 || oc[c] < oc[low]) low = c; });
    const tip = done && sk !== 'vf' ? `💡 Pour progresser : « ${esc(p.cr[low])} » (${bin ? 'non réussi' : FREQ[oc[low]].toLowerCase()}).` : done ? '👍 Tous les critères sont appliqués très souvent ou toujours : bravo !' : '';
    return `<div class="crit-card"><div class="crit-head"><b>${p.ico} ${esc(p.n)}</b><span class="crit-note ${note != null ? 'on' : ''}" style="${sk ? `background:${SUCC[sk].c};color:${SUCC[sk].f}` : ''}">${note != null ? fmt(note) : '–'}<small>/10</small></span>${succChip(sk)}</div>
      ${p.cr.map((c, k) => `<div class="crit-line"><span class="crit-t">${esc(c)}</span><div class="crit-opts ${bin ? 'bin' : ''}">${opts.map(([t, v]) => `<button class="fq ${oc[k] === v ? 'on' : ''}" data-action="crit" data-e="${E.id}" data-i="${i}" data-p="${p.id}" data-c="${k}" data-v="${v}">${t}</button>`).join('')}</div></div>`).join('')}
      ${tip ? `<div class="crit-tip">${tip}</div>` : ''}</div>`; }).join('')}
    <div class="pil-row"><div class="dial-card borg"><h3>🥵 Ressenti de l'élève</h3>${dialHTML({ v: bg, min:1, max:10, kind:'borg', lbl: bg ? BORG[bg].n : 'échelle de Borg' }, `data-e="${E.id}" data-i="${i}"`)}</div>
      <div class="pil-scale borg-scale"><div class="fq-h">Échelle de Borg · on demande à l'élève : « C'était comment ? » · touche le niveau ou la roue</div>
        <div class="borg-list">${BORG.slice(1).map((b, k) => `<button class="borg-l ${bg === k + 1 ? 'on' : ''}" style="--bc:${b.c};--bf:${b.f}" data-action="borg" data-e="${E.id}" data-i="${i}" data-v="${k + 1}"><b>${k + 1}</b> ${esc(b.n)}</button>`).join('')}</div></div></div></div>`;
}
/* Séries : suivi série par série (molette répétitions + piliers) ou en fin d'exercice */
function setsBody(n, sid, E, t){
  const L = lesson(n), nbS = t?.s || 0, r = t?.r || 10;
  let h = '';
  if (E.k === 'free' || E.k === 'coach') h += customFields(n, sid, E, t);
  if (t?.noMax && !t.pdc) h += `<div class="advice warn">⚠️ Pas encore de max sur ${esc(mName(E.m))} : touche <b>🏋️ Besoin de prendre un Max</b> pour calculer ta charge${E.k === 'coach' ? ', ou écris la charge toi-même' : ''}.</div>`;
  if (t?.zone) h += `<div class="load-box"><span>🏋️ Charge</span><b>${esc(t.zone.t)}</b><small>${t.pct} % de ${fmtKg(t.mx)}${t.kg ? ' = ' + fmtKg(t.kg) : ''}</small></div>`;
  if (ryOf(n, sid, E)) h += `<div class="ry-box">🎵 <b>Rythme</b> : ${esc(ryOf(n, sid, E))}</div>`;
  if (t?.pdc && t.mx) h += `<div class="load-box"><span>🤸 Poids de corps</span><b>${t.r} rép. par série</b><small>${t.pct} % de ton max de ${t.mx} rép.</small></div>`;
  if (!nbS) return h + `<div class="muted">Indique le nombre de séries.</div>`;
  const sets = Array.from({length:nbS}, (_, i) => E.sets?.[i] ?? null);
  const maxR = r;
  if (L.suivi === 'e') {                                                   // suivi par exercice
    h += `<div class="set-rows">${sets.map((v, i) => `<div class="set-row ${v != null ? 'ok' : ''}"><b>Série ${i + 1}</b>
        <div class="kg-step sm"><button data-action="setStep" data-e="${E.id}" data-i="${i}" data-d="-1">−</button><span class="kg-val">${v ?? '–'}</span><button data-action="setStep" data-e="${E.id}" data-i="${i}" data-d="1">+</button></div>
        <span class="muted">/ ${r}</span></div>`).join('')}</div>
      <div class="btn-row"><button class="btn green" data-action="setAll" data-e="${E.id}">✓ Toutes les séries réussies (${nbS} × ${r})</button>${t.rest ? `<button class="btn" data-action="restGo" data-s="${t.rest}" data-k="${E.id}" data-l="${esc(E.m ? mName(E.m) : E.nm || '')}">⏳ Récup ${fmtRest(t.rest)}</button>` : ''}</div>`;
    if (sets.some(v => v == null)) h += `<div class="muted" style="font-weight:700;margin-top:8px">👀 Le niveau d'atteinte des piliers et l'échelle de Borg s'afficheront quand toutes les séries seront saisies.</div>`;
    else h += pilDials(n, E, 0, 'Exercice terminé · niveau d\'atteinte et ressenti') + nextBtn(n, sid, E);
    return h;
  }
  /* série par série */
  if (t.rest >= 180 && (res(n, sid)?.ex || []).filter(x => x.k === 'th').length < (MOB[E.mob || mobOf(n, sid)]?.nbEx || 0)) h += `<div class="advice info">⏳ Pendant les ${fmtRest(t.rest)} de récupération, tu peux faire une série sur un autre exercice d'un autre groupe musculaire : ajoute-le avec ➕, plusieurs chronos tournent en même temps.</div>`;
  const first = sets.findIndex(v => v == null);
  let cur = UI.cur?.[E.id]; if (cur == null || cur >= nbS) cur = first < 0 ? nbS - 1 : first;
  h += `<div class="pass-sum">${sets.map((v, i) => `<button class="pass-chip ${i === cur ? 'cur' : ''} ${v != null ? 'done' : ''}" data-action="setGo" data-e="${E.id}" data-i="${i}"><small>Série ${i + 1}</small><b>${v ?? '–'}</b></button>`).join('')}
    ${first < 0 ? `<span class="pass-ok">✓ ${nbS} séries · ${repsDone(E)} rép.</span>` : ''}</div>`;
  h += `<div class="dials set-dials"><div class="dial-card"><h3>🔁 Série ${cur + 1} / ${nbS} · répétitions validées</h3>
      ${dialHTML({ v: sets[cur], min:0, max:maxR, t:null, tgt:r, kind:'reps', lbl:'répétitions' }, `data-e="${E.id}" data-i="${cur}"`)}
      <button class="btn small green" data-action="setOk" data-e="${E.id}" data-i="${cur}">✓ ${r} réussies</button></div></div>
    ${pilDials(n, E, cur, `Série ${cur + 1} · niveau d'atteinte des piliers`)}`;
  h += `<div class="btn-row" style="justify-content:center;margin-top:8px"><button class="btn primary" data-action="setNext" data-e="${E.id}" data-i="${cur}" ${sets[cur] == null ? 'disabled' : ''}>${cur + 1 < nbS ? `Valider la série ${cur + 1} et lancer la récup (${fmtRest(t.rest)}) →` : '✓ Terminer l\'exercice et passer au suivant'}</button></div>`;
  return h;
}
/* Bouton de fin d'exercice : replie l'exercice et propose le suivant */
function nextBtn(n, sid, E){
  return `<div class="btn-row" style="justify-content:center;margin-top:10px"><button class="btn primary big-next" data-action="exNext" data-e="${E.id}">✓ Terminer l'exercice et passer au suivant →</button></div>`;
}
/* Exercice adapté (inaptitude) ou exercice du programme (Coach d'un jour) : paramètres modifiables */
function customFields(n, sid, E, t){
  const fld = (f, label, unit, step, max) => `<div class="cf"><span class="lbl">${label}</span>${numIn('cf', E, E[f], unit, step, max, `data-f="${f}"`)}</div>`;
  return `${E.k === 'free' ? `<label class="field">Exercice réalisé (choisi avec l'enseignant)<input type="text" data-field="exName" data-e="${E.id}" value="${esc(E.nm || '')}" placeholder="ex. : gainage latéral, tirage élastique…"></label>` : ''}
    <div class="cf-grid">${fld('s', 'Séries', '', 1, 20)}${fld('r', 'Répétitions', '', 1, 100)}${E.m && isPdc(E.m) ? '' : fld('kg', 'Charge', 'kg', 0.5, 400)}${fld('rest', 'Récupération', 's', 5, 600)}</div>`;
}
/* Entre deux exercices : 6 min d'endurance (Affinement) ou de cardio (Tonification) */
function interCard(n, sid, E){
  const M = MOB[E.mob || mobOf(n, sid)], it = E.it || {};
  const ids = M.inter === 'endu' ? ENDU : WU_EX.map(x => x.id);
  return `<div class="inter-card ${it.ok ? 'ok' : ''}"><b>⏱️ 6 min ${M.inter === 'endu' ? 'd\'endurance' : 'de cardio'}</b>
    <div class="wu-grid sm">${ids.map(id => { const x = wuEx(id), b = wuBlocked(n, sid, id);
      return `<button class="wu-chip ${it.x === id ? 'on' : ''} ${b ? 'blk' : ''}" data-action="interPick" data-e="${E.id}" data-id="${id}" ${b ? 'disabled' : ''}>${x.img ? mImg(x, 'wu-img') : `<span class="wu-ico">${x.ico}</span>`}<span>${esc(x.n)}</span></button>`; }).join('')}</div>
    <div class="btn-row"><button class="btn small" data-action="restGo" data-s="360" data-l="6 min ${M.inter === 'endu' ? 'endurance' : 'cardio'}">⏱️ Lancer 6 min</button><button class="btn small ${it.ok ? 'green' : ''}" data-action="interOk" data-e="${E.id}">${it.ok ? '✓ Fait' : 'Marquer comme fait'}</button></div></div>`;
}
/* Coach d'un jour : le rôle tiré au sort et la production écrite */
const coachRole = (n, sid, r) => { const rid = r?.coach?.c || lesson(n).role[sid]; return role(rid) || lesson(n).roleS?.[rid] || null; };
function coachBlock(n, sid, r){
  const C = r.coach || {}, R = coachRole(n, sid, r);
  if (!R) return `<section class="coach-sec"><h2>🎭 Coach d'un jour</h2><p style="font-weight:700">Aucun rôle tiré au sort pour l'instant.</p>
    <button class="btn primary" data-action="drawRole">🎲 Tirer mon rôle au sort</button></section>`;
  const ta = (f, label, ph) => `<label class="field">${label}<textarea data-field="coach" data-f="${f}" placeholder="${esc(ph)}">${esc(C[f] || '')}</textarea></label>`;
  return `<section class="coach-sec"><h2>🎭 Coach d'un jour · ${esc(R.n)}</h2><blockquote class="role-txt">${esc(R.t)}</blockquote>
    ${ta('comp', 'Ce que je comprends des envies du rôle', 'Il / elle veut…')}
    ${ta('trav', 'Je pense que ce rôle doit travailler sur', 'Les groupes musculaires, la qualité…')}
    <div class="field">Je choisis le mobile<div class="mob-grid">${MOB_IDS.map(k => `<button class="mob-btn sm ${C.mob === k ? 'on' : ''}" data-action="coachMob" data-m="${k}"><b>${MOB[k].ico} ${esc(MOB[k].n)}</b></button>`).join('')}</div></div>
    <label class="field">🧪 Mon cobaye (l'élève qui réalise mon programme)<select data-field="coachCob"><option value="">— moi-même —</option>${sortedStudents().filter(s => s.id !== sid && present(n, s.id)).map(s => `<option value="${s.id}" ${C.cob === s.id ? 'selected' : ''}>${esc(nameOf(s.id))}</option>`).join('')}</select></label>
    <div class="muted" style="font-weight:700">Choisis ci-dessous l'échauffement de ton cobaye, puis écris les exercices avec <b>➕ Exercice de mon programme</b> : séries, répétitions, charge et récupération sont proposées à partir du mobile et du max de ton cobaye, tu peux les modifier.</div>
    ${ta('cons', 'Quels conseils pour les prochaines semaines donnerais-tu à ce rôle ?', 'Conseils…')}</section>`;
}

/* ---------------------------------------------------------------------
   Choix d'une machine (grille d'images)
   --------------------------------------------------------------------- */
function pickMachine({ title, hint, ids, n, sid, extra, onPick }){
  const list = (ids || salleMachines().map(m => m.id)).map(machine).filter(Boolean);
  const card = m => { const b = blockOf(n, sid, m.id) || (extra ? extra(m) : null), mx = maxVal(sid, m.id, n), g = GROUPS[m.g];
    return `<button class="mpick ${b ? 'blk' : ''}" data-id="${m.id}" ${b ? 'disabled' : ''}>${mImg(m)}<b>${esc(m.n)}</b>
      <span class="gchip" style="--gc:${g.c}">${esc(g.n)}</span><small>${b ? '🚫 ' + esc(b) : mx ? 'max ' + fmtMax(m.id, mx) : 'pas de max'}</small></button>`; };
  const byG = Object.keys(GROUPS).map(g => ({ g, ms: list.filter(m => m.g === g) })).filter(x => x.ms.length);
  const md = modal(`<h2>${esc(title)}</h2>${hint ? `<div class="advice info">${esc(hint)}</div>` : ''}
    ${byG.map(x => `<h3 class="g-h" style="--gc:${GROUPS[x.g].c}">${esc(GROUPS[x.g].n)}</h3><div class="mpick-grid">${x.ms.map(card).join('')}</div>`).join('')}
    <div class="btn-row" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" data-close>Annuler</button></div>`, { wide:true });
  md.querySelector('[data-close]').onclick = closeModal;
  md.querySelectorAll('.mpick[data-id]').forEach(b => b.onclick = () => { closeModal(); onPick(b.dataset.id); });
}
/* ---------------------------------------------------------------------
   Fiche de séance : molettes et actions
   --------------------------------------------------------------------- */
const PIL_LBL = ['Jamais','Très rarement','Rarement','Parfois','1 fois sur 2','Assez souvent','Souvent','Très souvent','Presque toujours','Toujours'];
function updE(eid, fn){
  const n = curLesson(), sid = UI.sid;
  if (UI.open[eid] == null) UI.open[eid] = true;
  setRes(n, sid, r => { const E = r.ex.find(x => x.id === eid); if (!E) return; fn(E, r); E.ts = now(); });
}
function bindEntry(){
  bindDials((d, v) => {
    const i = +d.i; UI.cur = UI.cur || {}; if (!d.p || UI.cur[d.e] == null) UI.cur[d.e] = i;
    updE(d.e, E => {
      if (d.kind === 'borg') { E.bg = E.bg || []; E.bg[i] = v; if (S.curObs) E.by = S.curObs; }
      else if (d.p) { E.ob = E.ob || {}; E.ob[d.p] = E.ob[d.p] || []; E.ob[d.p][i] = v; if (S.curObs) E.by = S.curObs; }
      else { E.sets = E.sets || []; E.sets[i] = v; }
    });
    flagSaved(); rerender();
  });
}
function inapModal(){
  const n = curLesson(), sid = UI.sid;
  let sel = [...(res(n, sid)?.z || [])];
  const fromProf = lesson(n).z[sid] || [];
  const m = modal(`<h2>🩹 Inaptitude de ${esc(nameOf(sid))}</h2>
    ${fromProf.length ? `<div class="advice info">Déjà signalé à l'appel : ${esc(fromProf.map(zoneName).join(', '))}</div>` : ''}
    <div class="pain-wrap"><div id="body-box"></div><div class="pain-side"><div class="btn-row" id="extra-z"></div><p id="pain-list" style="font-weight:800"></p>
      <p class="muted" style="font-size:15px;font-weight:700">Touche les zones concernées. Les machines qui les sollicitent ne seront plus proposées. Ton enseignant en sera informé.</p></div></div>
    <div class="btn-row spread" style="margin-top:10px"><button class="btn" data-p="none">Aucune inaptitude</button><button class="btn primary" data-p="ok">Valider</button></div>`, { wide:true });
  const draw = () => {
    m.querySelector('#body-box').innerHTML = bodySVG(sel);
    m.querySelector('#extra-z').innerHTML = ZONES.filter(q => !q.x).map(q => `<button class="btn ${sel.includes(q.k)?'red':''}" data-z="${q.k}">${q.n}</button>`).join('');
    m.querySelector('#pain-list').textContent = sel.length ? sel.map(zoneName).join(' · ') : 'Aucune zone';
    m.querySelectorAll('[data-zone],[data-z]').forEach(el => el.onclick = () => { const k = el.dataset.zone || el.dataset.z; sel = sel.includes(k) ? sel.filter(x => x !== k) : [...sel, k]; draw(); });
  };
  draw();
  const done = list => { setRes(n, sid, r => { r.z = list; }); closeModal(); rerender(); flagSaved(); };
  m.querySelector('[data-p="none"]').onclick = () => done([]);
  m.querySelector('[data-p="ok"]').onclick = () => done(sel);
}
function newE(k, extra){ return { id: rnd(5), k, sets:[], ob:{}, ts: now(), ...extra }; }
function addExercise(k){
  const n = curLesson(), sid = UI.sid, r = res(n, sid) || { ex:[] }, th = thOf(n);
  const noCardio = m => m.k === 'cardio' ? 'cardio : échauffement' : null;
  if (k === 'free') { setRes(n, sid, r => r.ex.push(newE('free', { nm:'', s:3, r:10, rest:60 }))); return rerender(); }
  if (k === 'max') return pickMachine({ title:'🏋️ Prise de Max · choisis la machine', hint:'Choisis ensuite le type de prise de max : 1RM, formule de Brzycki ou nombre de répétitions (pompes, tractions, dips, abdos).', n, sid, extra: noCardio,
    onPick: id => { setRes(n, sid, r => r.ex.push(newE('max', { m:id, mode: isPdc(id) ? 'reps' : (th === 'amax' || th === 'max' ? '1rm' : 'brz') }))); rerender(); } });
  if (k === 'th') { const rule = slotRule(n, sid, r.ex || []), mob = mobOf(n, sid);
    return pickMachine({ title:`➕ ${MOB[mob].ico} ${MOB[mob].n} · choisis l'exercice`, hint: rule.hint, n, sid,
      extra: m => noCardio(m) || (rule.ok(m.g) ? null : 'groupe non prévu'),
      onPick: id => { setRes(n, sid, r => r.ex.push(newE('th', { m:id, mob }))); rerender(); } }); }
  if (k === 'coach') { const C = r.coach || {};
    if (!C.mob) return toast('Choisis d\'abord le mobile du rôle');
    const who = C.cob && student(C.cob) ? C.cob : sid;
    return pickMachine({ title:'➕ Exercice du programme', hint:`Mobile : ${MOB[C.mob].n}`, n, sid, extra: noCardio,
      onPick: id => { const M = MOB[C.mob], mx = maxVal(who, id, n), pct = M.pct;
        const kg = !isPdc(id) && mx ? r05(mx * pct / 100) : null, reps = isPdc(id) && mx ? Math.max(1, Math.round(mx * pct / 100)) : M.r;
        setRes(n, sid, r => r.ex.push(newE('coach', { m:id, s:M.s, r:reps, kg, rest:M.rest, pct }))); rerender(); } }); }
}
function typeNum(title, value, opts){ return numberBox(title, value, opts); }

const A_ELEVE = {
  well: d => { const n = curLesson(), v = +d.v; setRes(n, UI.sid, r => { r[d.f] = r[d.f] === v ? null : v; }); rerender(); flagSaved(); },
  inapOpen: () => inapModal(),
  fold: (d, el) => { const box = el.closest('.folded, section, article'); const isFolded = box?.classList.contains('folded'); UI.open[d.k] = !!isFolded; rerender(); },
  wuToggle: d => { const max = lesson(curLesson()).wu.nb || 6;
    setRes(curLesson(), UI.sid, r => { r.wu = r.wu || { t: thOf(curLesson()) === 'coach' ? (lesson(curLesson()).wu.t !== 'none' ? lesson(curLesson()).wu.t : 'circuit') : lesson(curLesson()).wu.t }; const a = r.wu.ex || [];
      r.wu.ex = a.includes(d.id) ? a.filter(x => x !== d.id) : a.length >= max ? (toast(`${max} exercices maximum`), a) : [...a, d.id]; }); rerender(); flagSaved(); },
  wuPick: d => { setRes(curLesson(), UI.sid, r => { r.wu = r.wu || { t: thOf(curLesson()) === 'coach' ? (lesson(curLesson()).wu.t !== 'none' ? lesson(curLesson()).wu.t : 'circuit') : lesson(curLesson()).wu.t }; r.wu[d.k] = r.wu[d.k] === d.id ? null : d.id; }); rerender(); flagSaved(); },
  wuDone: () => { setRes(curLesson(), UI.sid, r => { r.wu = r.wu || { t: thOf(curLesson()) === 'coach' ? (lesson(curLesson()).wu.t !== 'none' ? lesson(curLesson()).wu.t : 'circuit') : lesson(curLesson()).wu.t }; r.wu.t = thOf(curLesson()) === 'coach' ? (r.wu.t || 'circuit') : lesson(curLesson()).wu.t; r.wu.ok = !r.wu.ok; }); UI.open.wu = false; rerender(); flagSaved(); },
  setMob: d => { const n = curLesson(); if ((res(n, UI.sid)?.ex || []).some(E => E.k === 'th' && E.mob && E.mob !== d.m && !['p66','p64'].includes(d.m))) toast('Les exercices déjà saisis gardent leur ancien mobile');
    setRes(n, UI.sid, r => { r.mob = d.m; (r.ex || []).forEach(E => { if (E.k === 'th' && !vals(E.sets).length) E.mob = d.m; }); }); rerender(); flagSaved(); },
  setEf: d => { setRes(curLesson(), UI.sid, r => { r.ef = d.v === '1'; }); rerender(); flagSaved(); },
  saveProj: () => { const n = curLesson(), sid = UI.sid, r = res(n, sid) || {}, mob = mobOf(n, sid);
    const ms = (r.ex || []).filter(E => E.k === 'th').map(E => E.m);
    if (!ms.length) return toast('Ajoute d\'abord les exercices de ta séance');
    S.projects[sid] = { mob, ms, ts: now(), d: S.deviceId }; save(); toast('✓ Projet enregistré : ' + MOB[mob].n); rerender(); },
  loadProj: () => { const n = curLesson(), sid = UI.sid, P = S.projects[sid]; if (!P) return;
    let skip = 0;
    setRes(n, sid, r => { if (THEMES[thOf(n)].mobs.includes(P.mob)) r.mob = P.mob;
      P.ms.forEach(id => { if (blockOf(n, sid, id)) { skip++; return; } r.ex.push(newE('th', { m:id, mob:P.mob })); }); });
    toast(skip ? `✓ Projet chargé · ${skip} machine(s) indisponible(s) aujourd'hui` : '✓ Projet chargé'); rerender(); },
  addEx: d => addExercise(d.k),
  delEx: async d => { if (!(await confirmBox('Retirer cet exercice ?', 'Les séries et observations saisies seront effacées.', 'Retirer', true))) return;
    setRes(curLesson(), UI.sid, r => { r.ex = r.ex.filter(E => E.id !== d.e); }); rerender(); },
  maxMode: d => { updE(d.e, E => { E.mode = d.v; if (d.v === '1rm') E.r = 1; else if (E.r === 1) E.r = null; E.v = maxFromEntry(E); }); rerender(); flagSaved(); },
  kgStep: d => { updE(d.e, E => { E.kg = Math.max(0, Math.min(400, (E.kg || 20) + (E.kg ? +d.d : 0))); E.v = maxFromEntry(E); }); rerender(); flagSaved(); },
  kgType: async d => { const E = findE(curLesson(), UI.sid, d.e); const v = await numberBox('Charge (kg)', E?.kg, { step:0.5, min:0, max:400, unit:'kg' });
    if (v != null) { updE(d.e, E => { E.kg = v; E.v = maxFromEntry(E); }); rerender(); flagSaved(); } },
  rStep: d => { updE(d.e, E => { E.r = Math.max(+d.min, Math.min(+d.max, (E.r || (E.mode === 'brz' ? 5 : 10)) + (E.r ? +d.d : 0))); E.v = maxFromEntry(E); }); rerender(); flagSaved(); },
  rType: async d => { const E = findE(curLesson(), UI.sid, d.e); const v = await numberBox('Répétitions', E?.r, { step:1, min:+d.min, max:+d.max, unit:'rép.' });
    if (v != null) { updE(d.e, E => { E.r = Math.round(v); E.v = maxFromEntry(E); }); rerender(); flagSaved(); } },
  setGo: d => { UI.cur = UI.cur || {}; UI.cur[d.e] = +d.i; rerender(); },
  setOk: d => { const n = curLesson(), E = findE(n, UI.sid, d.e), t = target(n, UI.sid, E); UI.cur = UI.cur || {}; UI.cur[d.e] = +d.i; updE(d.e, E => { E.sets = E.sets || []; E.sets[+d.i] = t.r; }); rerender(); flagSaved(); },
  setNext: d => { const n = curLesson(), E = findE(n, UI.sid, d.e), t = target(n, UI.sid, E), i = +d.i;
    UI.cur = UI.cur || {}; const nxt = Array.from({length:t.s}, (_, k) => k).find(k => k > i && E.sets?.[k] == null);
    UI.cur[d.e] = nxt ?? i;
    if (nxt != null) startRest(t.rest, `${nameOf(UI.sid)} · ${E.m ? mName(E.m) : E.nm} · série ${nxt + 1}`, UI.sid + E.id);
    else return A_ELEVE.exNext(d);
    rerender(); },
  exNext: d => { const n = curLesson(), sid = UI.sid, r = res(n, sid) || { ex:[] }, E = findE(n, sid, d.e);
    UI.open[d.e] = false; if (E && E.k !== 'max') toast('✓ Exercice terminé : ' + repsDone(E) + ' répétitions');
    const nx = r.ex.find(x => x.id !== d.e && !exDone(n, sid, x));
    if (nx) { UI.open[nx.id] = true; rerender(); setTimeout(() => document.getElementById('ex-' + nx.id)?.scrollIntoView({ behavior:'smooth', block:'start' }), 50); return; }
    rerender();
    const mob = mobOf(n, sid), th = thOf(n);
    if (th === 'coach') return;
    if (mob && !slotRule(n, sid, r.ex).full) return addExercise('th');
    toast('🎉 Séance terminée !', 3000); },
  setStep: d => { const n = curLesson(), E0 = findE(n, UI.sid, d.e), t = target(n, UI.sid, E0);
    updE(d.e, E => { E.sets = E.sets || []; const v = E.sets[+d.i]; E.sets[+d.i] = v == null ? t.r : Math.max(0, Math.min(t.r, v + (+d.d))); }); rerender(); flagSaved(); },
  setAll: d => { const n = curLesson(), E0 = findE(n, UI.sid, d.e), t = target(n, UI.sid, E0);
    updE(d.e, E => { E.sets = Array.from({length:t.s}, (_, i) => E.sets?.[i] ?? t.r); }); rerender(); flagSaved(); },
  cfStep: d => { updE(d.e, E => { const f = d.f, base = { s:3, r:10, kg:20, rest:60 }[f]; let v = E[f] == null ? base : +E[f] + (+d.d);
    v = Math.max(f === 'kg' ? 0 : f === 'rest' ? 0 : 1, Math.min(f === 'kg' ? 400 : f === 'rest' ? 600 : 50, v)); E[f] = f === 'kg' ? r05(v) : v; }); rerender(); flagSaved(); },
  cfType: async d => { const E = findE(curLesson(), UI.sid, d.e), lab = { s:'Séries', r:'Répétitions', kg:'Charge (kg)', rest:'Récupération (secondes)' }[d.f];
    const v = await numberBox(lab, E?.[d.f], { step: d.f === 'kg' ? 0.5 : 1, min:0, max: d.f === 'rest' ? 600 : 400, unit: d.f === 'kg' ? 'kg' : d.f === 'rest' ? 's' : '' });
    if (v != null) { updE(d.e, E => { E[d.f] = d.f === 'kg' ? r05(v) : Math.round(v); }); rerender(); flagSaved(); } },
  interPick: d => { updE(d.e, E => { E.it = E.it || {}; E.it.x = E.it.x === d.id ? null : d.id; }); rerender(); flagSaved(); },
  interOk: d => { updE(d.e, E => { E.it = E.it || {}; E.it.ok = !E.it.ok; }); rerender(); flagSaved(); },
  restGo: d => startRest(+d.s, `${nameOf(UI.sid)}${d.l ? ' · ' + d.l : ''}`, d.k ? UI.sid + d.k : null),
  fq: d => { updE(d.e, E => { E.fq = E.fq || {}; E.fq[d.p] = E.fq[d.p] || []; const v = +d.v; E.fq[d.p][+d.i] = E.fq[d.p][+d.i] === v ? null : v; if (S.curObs) E.by = S.curObs; }); rerender(); flagSaved(); },
  crit: d => { const n = curLesson(), E0 = findE(n, UI.sid, d.e), p = lessonPils(n).find(x => x.id === d.p); if (!E0 || !p) return;
    updE(d.e, E => { const i = +d.i, c = +d.c, v = +d.v; E.oc = E.oc || {}; E.oc[d.p] = E.oc[d.p] || []; const row = Array.from({ length: p.cr.length }, (_, k) => E.oc[d.p][i]?.[k] ?? null);
      row[c] = row[c] === v ? null : v; E.oc[d.p][i] = row;
      E.ob = E.ob || {}; E.ob[d.p] = E.ob[d.p] || []; E.ob[d.p][i] = critNote(row, isBin(E));
      E.fq = E.fq || {}; E.fq[d.p] = E.fq[d.p] || []; const f = row.filter(x => x != null); E.fq[d.p][i] = isBin(E) || !f.length ? null : Math.round(avg(f));
      if (S.curObs) E.by = S.curObs; }); rerender(); flagSaved(); },
  borg: d => { updE(d.e, E => { const i = +d.i, v = +d.v; E.bg = E.bg || []; E.bg[i] = E.bg[i] === v ? null : v; if (S.curObs) E.by = S.curObs; }); rerender(); flagSaved(); },
  pickObs: d => { S.curObs = d.sid; save(); rerender(); },
  changeObs: () => { delete S.curObs; save(); render(); window.scrollTo(0, 0); },
  restStop: d => stopRest(d.k),
  wuType: d => { setRes(curLesson(), UI.sid, r => { r.wu = { t:d.t, ok:false }; }); rerender(); flagSaved(); },
  drawRole: () => { const n = curLesson(), used = new Set(Object.values(lesson(n).role));
    S.students.forEach(s => { const c = res(n, s.id)?.coach?.c; if (c) used.add(c); });
    const pool = availableRoles(n), free = pool.filter(r => !used.has(r.id)), pick = (free.length ? free : pool);
    if (!pick.length) return toast('Aucun rôle disponible');
    const R = pick[Math.floor(Math.random() * pick.length)];
    setRes(n, UI.sid, r => { r.coach = { ...(r.coach || {}), c: R.id }; }); toast('🎲 ' + R.n); rerender(); },
  coachMob: d => { setRes(curLesson(), UI.sid, r => { r.coach = r.coach || {}; r.coach.mob = r.coach.mob === d.m ? null : d.m; }); rerender(); flagSaved(); },
};
/* rôles connus sur cet appareil (tablette : rôles reçus avec la leçon) */
function availableRoles(n){ const L = lesson(n); if (L.roleS && !isProfRole()) return Object.entries(L.roleS).map(([id, r]) => ({ id, ...r })); return ROOT.roles; }
function classPicker(){
  const cls = Object.values(ROOT.classes);
  return `<div class="class-chips" style="justify-content:flex-start">${cls.map(c=>`<button class="class-chip ${c.id===S.id?'on':''}" data-action="selClass" data-id="${c.id}">🏫 ${esc(className(c))}</button>`).join('')}</div>`;
}
function subTabs(items){
  return `<div class="tabs">${items.map(([k,l])=>`<button class="tab ${UI.profTab===k?'on':''}" data-action="profTab" data-tab="${k}">${l}</button>`).join('')}</div>`;
}
function pinPad(onOk, title='🔒 Code enseignant'){
  let code = '';
  const m = modal(`<h2 class="center">${title}</h2><div class="pin-dots">${'<span></span>'.repeat(4)}</div>
    <div class="pin-pad">${[1,2,3,4,5,6,7,8,9,'⌫',0,'✕'].map(k=>`<button data-k="${k}">${k}</button>`).join('')}</div>
    <p class="center muted" style="font-size:14px">Code par défaut : 0000 (modifiable dans Bilans → Export & sauvegarde)</p>`);
  const dots = m.querySelectorAll('.pin-dots span');
  m.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    const k = b.dataset.k;
    if (k === '✕') return closeModal();
    if (k === '⌫') code = code.slice(0,-1); else if (code.length < 4) code += k;
    dots.forEach((d,i)=>d.classList.toggle('f', i < code.length));
    if (code.length === 4) {
      if (code === String(ROOT.pin || '0000')) { closeModal(); onOk(); }
      else { toast('Code incorrect'); code=''; dots.forEach(d=>d.classList.remove('f')); }
    }
  });
}
const appURL = () => location.href.split('#')[0].split('?')[0].replace(/index\.html$/, '');
function appQRImg(size=6){ const qr = qrcode(0, 'M'); qr.addData(appURL()); qr.make(); return qr.createDataURL(size, 24); }
function appQRCard(){
  if (!/^https?:/.test(location.protocol)) return '';
  return `<div class="card compact app-qr"><img src="${appQRImg(5)}" alt="QR d'accès à l'application" data-action="appQR">
    <div><b>📲 Accès à l'application</b><div class="muted" style="font-weight:700">Scannez avec l'appareil photo d'une tablette ou d'un téléphone pour ouvrir l'appli, puis « Ajouter à l'écran d'accueil ».</div>
      <div class="app-url">${esc(appURL())}</div><button class="btn small" data-action="appQR">🔍 Agrandir</button></div></div>`;
}
function profClasses(){
  const cls = Object.values(ROOT.classes);
  return `<div class="card compact"><div class="row">
      <label class="field grow">Nom de la classe<input type="text" data-field="className" value="${esc(S.settings.className)}"></label>
      <label class="field grow">Nouvelle classe<input type="text" id="new-class" placeholder="2nde 4"></label>
      <button class="btn green" data-action="addClass" style="align-self:flex-end">＋ Ajouter</button>
      ${cls.length > 1 ? `<button class="btn red" data-action="delClass" style="align-self:flex-end">🗑 Supprimer « ${esc(className())} »</button>` : ''}</div></div>`;
}
function stepper(action, attrs, val, disp){
  return `<div class="stepper"><button data-action="${action}" ${attrs} data-d="-1">−</button><span class="val">${disp ?? val}</span><button data-action="${action}" ${attrs} data-d="1">+</button></div>`;
}
function rangeField(label, val, attrs, min, max, extra='', step=1){
  return `<div class="rf"><div class="rf-h"><span class="rf-l">${label}</span> <b class="rv">${fmt(val)}</b>${extra}</div>
    <input type="range" min="${min}" max="${max}" step="${step}" value="${val}" ${attrs}></div>`;
}
function profEleves(){
  const list = sortedStudents();
  return `<div class="card strong"><h2>Importer la liste (Pronote)</h2>
      <div class="btn-row"><label class="btn primary">📂 Choisir un fichier<input type="file" id="file-students" accept=".xlsx,.xls,.csv,.txt" hidden></label></div></div>
    <div class="card"><h2>Ajouter un élève</h2><div class="row">
      <label class="field grow">Nom<input type="text" id="add-nom" placeholder="DUPONT"></label>
      <label class="field grow">Prénom<input type="text" id="add-prenom" placeholder="Léa"></label>
      <button class="btn green" data-action="addStudent" style="align-self:flex-end">＋ Ajouter</button></div></div>
    <div class="card"><div class="btn-row spread"><h2 style="margin:0">${list.length} élève(s)</h2>${list.length?'<button class="btn small red" data-action="clearStudents">Vider la liste</button>':''}</div>
      <table class="simple" style="margin-top:8px"><tr><th>Affiché</th><th>Nom complet</th><th></th></tr>
      ${list.map(s=>`<tr><td><b>${esc(nameOf(s.id))}</b></td><td>${esc((s.nom||'').toUpperCase())} ${esc(s.prenom||s.disp||'')}</td>
        <td style="text-align:right"><button class="btn small ghost" data-action="delStudent" data-sid="${s.id}">🗑 Retirer</button></td></tr>`).join('')}</table></div>`;
}
function profGroupes(){
  const G = nbGroups();
  const zone = (g, label) => {
    const items = sortedStudents().filter(s => (s.grp||0) === g), c = g ? groupColor(g) : null;
    const picker = g ? `<div class="gcolors">${COLORS.map(k => `<button class="gc ${S.settings.groupColors[g-1]===k.k?'on':''}" style="background:${k.c}" data-action="groupColor" data-g="${g}" data-c="${k.k}" aria-label="${k.n}"></button>`).join('')}</div>` : '';
    return `<div class="gzone" data-zone="${g}"><h3 data-action="dropSel" data-zone="${g}">${c?`<span class="dot" style="background:${c.c}"></span>`:''}${label} <span class="muted">(${items.length})</span></h3>${picker}
      <div class="gitems">${items.map(s=>`<div class="gitem ${UI.sel===s.id?'sel':''}" data-gid="${s.id}" style="${c?`border-left:12px solid ${c.c}`:''}">${esc(nameOf(s.id))}</div>`).join('')}</div></div>`;
  };
  return `<div class="card strong"><h2>Groupes · ${esc(className())}</h2>
      <h3>Choisir le nombre de groupes</h3>
      <div class="lesson-picker">${Array.from({length:MAX_GROUPS},(_,i)=>i+1).map(n=>`<button class="lp ${n===G?'on':''}" data-action="setGroups" data-n="${n}">${n}</button>`).join('')}</div>
      ${G > 1 ? `<button class="btn small ghost" data-action="clearGroups" style="margin-top:10px">Tout retirer</button>` : ''}</div>
    ${G > 1 ? `<div class="groups">${zone(0, 'Sans groupe')}${Array.from({length:G},(_,i)=>zone(i+1, groupName(i+1))).join('')}</div>` : ''}`;
}
function moveToGroup(sid, g){
  const s = student(sid); if (!s) return;
  if (UI.profTab === 'lgroupes') { const L = lesson(curLesson()); if ((s.grp||0) === g) delete L.grpOv[sid]; else L.grpOv[sid] = g; }
  else s.grp = g;
}
function bindGroups(){
  let drag = null;
  document.querySelectorAll('.gitem').forEach(el => {
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      drag = { id: el.dataset.gid, x0: e.clientX, y0: e.clientY, el, ghost: null, moved: false };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!drag || drag.el !== el) return;
      if (!drag.moved && Math.hypot(e.clientX-drag.x0, e.clientY-drag.y0) < 8) return;
      if (!drag.moved) { drag.moved = true; drag.ghost = el.cloneNode(true); drag.ghost.classList.add('drag-ghost'); document.body.appendChild(drag.ghost); el.style.opacity = .3; }
      drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px';
      document.querySelectorAll('.gzone').forEach(z => z.classList.remove('hover'));
      const z = document.elementFromPoint(e.clientX, e.clientY)?.closest('.gzone'); if (z) z.classList.add('hover');
      // défilement automatique près des bords
      if (e.clientY < 90) window.scrollBy(0, -12); else if (e.clientY > innerHeight - 60) window.scrollBy(0, 12);
    });
    const end = e => {
      if (!drag || drag.el !== el) return;
      const d = drag; drag = null;
      if (d.ghost) d.ghost.remove();
      document.querySelectorAll('.gzone').forEach(z => z.classList.remove('hover'));
      if (!d.moved) { UI.sel = UI.sel === d.id ? null : d.id; render(); return; }
      const z = document.elementFromPoint(e.clientX, e.clientY)?.closest('.gzone');
      if (z) { moveToGroup(d.id, +z.dataset.zone || 0); UI.sel = null; save(); }
      render();
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  });
}
/* =====================================================================
   Espace enseignant : menu + 4 rubriques
   ===================================================================== */
function openProf(){
  if (UI.profUnlocked) { UI.profTab = UI.profTab || 'menu'; return go('prof'); }
  pinPad(() => { UI.profUnlocked = true; UI.profTab = 'menu'; go('prof'); });
}
const PSECT = {
  prep:   { ico:'🛠', t:'Préparer le cycle', tabs:[['classes','👥 Classe & élèves'],['groupes','🎽 Groupes'],['cycle','📅 Cycle & leçons'],['piliers','🏛 Piliers & observables'],['machines','🏋️ Machines de la salle'],['roles','🎭 Rôles Coach d\'un jour']] },
  jour:   { ico:'📅', t:'Leçon du jour', tabs:[['appel','✅ Appel'],['hs','🚫 Machines HS'],['tirage','🎲 Coach : tirage'],['evalJ','📝 Évaluer'],['qr','📲 QR de la leçon'],['saisieP','✍️ Saisie (dépannage)']] },
  recup:  { ico:'📥', t:'Récupérer les saisies', tabs:[] },
  bilans: { ico:'📊', t:'Suivi et bilans', tabs:[['suiviP','👤 Suivi élève'],['maxes','🏋️ Max de la classe'],['bilanL','🔎 Bilan par leçon'],['evals','📝 Notes des évaluations'],['coachB','🎭 Coach d\'un jour'],['export','📁 Export & sauvegarde']] } };
const PREDIR = { saisieP:'saisie', suiviP:'suivi' };
function sectOf(tab){ if (tab === 'recup') return 'recup'; return Object.keys(PSECT).find(k => PSECT[k].tabs.some(t => t[0] === tab)) || null; }
function sectHeader(sec){
  const P = PSECT[sec], N = S.settings.nbLessons, cur = curLesson();
  return `<div class="btn-row" style="margin-bottom:10px"><button class="btn small" data-action="profTab" data-tab="menu">← Menu enseignant</button></div>
    <div class="card strong compact"><h2>${P.ico} ${P.t}</h2>${classPicker()}
      ${sec === 'jour' ? `<h3>Leçon du jour</h3><div class="lesson-picker">${Array.from({length:N},(_,i)=>i+1).map(n=>`<button class="lp ${n===cur?'on':''}" data-action="setCurrent" data-n="${n}" title="${esc(themeName(thOf(n)))}"><span>${n}</span><small>${THEMES[thOf(n)].ico}</small></button>`).join('')}</div>
        <div class="muted" style="font-weight:800;margin-top:4px">${esc(lessonTitle(cur))}${lessonPils(cur).length ? ' · ' + lessonPils(cur).map(p => p.ico + ' ' + esc(p.n)).join(' · ') : ''}</div>` : ''}</div>
    ${P.tabs.length ? subTabs(P.tabs.filter(([k]) => k !== 'tirage' || thOf(cur) === 'coach').filter(([k]) => k !== 'evalJ' || ['evi','evf','coach'].includes(thOf(cur)))) : ''}`;
}
function viewProf(){
  let t = UI.profTab || 'menu';
  if (t === 'menu' || PREDIR[t]) { UI.profTab = 'menu'; return profMenu(); }
  const sec = sectOf(t); if (!sec) { UI.profTab = 'menu'; return profMenu(); }
  const B = { classes: () => profClasses() + profEleves(), groupes: profGroupes, cycle: profCycle, piliers: profPiliers, machines: profMachines, roles: profRoles,
    appel: profAppel, hs: profHS, tirage: profTirage, evalJ: () => profEvals(curLesson()), qr: profSeanceQR, recup: profRecup,
    maxes: profMaxes, bilanL: profBilanL, evals: () => profEvals(), coachB: profCoachB, export: () => profExport() + profTransfert() };
  return sectHeader(sec) + (B[t] ? B[t]() : '');
}
function profMenu(){
  const n = curLesson(), pres = S.students.filter(s => present(n, s.id)).length;
  const got = S.students.filter(s => lessonState(n, s.id).any).length;
  return `<div class="card strong compact center"><b style="font-size:20px">🏫 ${esc(className())}</b> · ${esc(lessonLabel(n))} · ${pres}/${S.students.length} présent(s) · ${got} fiche(s) reçue(s)</div>
    <div class="pmenu steps">
      <button class="pm-btn" data-action="profTab" data-tab="cycle"><span class="step">1</span><span class="ico">🛠</span>Préparer le cycle<small>Élèves · groupes · leçons, thèmes et piliers · machines · rôles</small></button>
      <button class="pm-btn" data-action="profTab" data-tab="appel"><span class="step">2</span><span class="ico">📅</span>Leçon du jour<small>Appel · inaptitudes · machines HS · 📲 QR</small></button>
      <button class="pm-btn" data-action="profTab" data-tab="recup"><span class="step">3</span><span class="ico">📥</span>Récupérer les saisies<small>Tablettes élèves · Hippopogramme</small></button>
      <button class="pm-btn" data-action="profTab" data-tab="suiviP"><span class="step">4</span><span class="ico">📊</span>Suivi et bilans<small>Fiches élèves · max · évaluations · coach d'un jour · export</small></button>
    </div>
    <div class="btn-row" style="justify-content:center;margin-top:12px"><button class="btn small" data-action="demoClass">🧪 Classe de démonstration</button></div>
    ${appQRCard()}`;
}

/* ---------------------------------------------------------------------
   Préparer : cycle & leçons
   --------------------------------------------------------------------- */
function profCycle(){
  const N = S.settings.nbLessons, cur = curLesson();
  let rows = '';
  for (let n = 1; n <= N; n++) {
    const L = lesson(n), th = L.th, T = THEMES[th], mp = maxPils(n);
    const pilChips = piliers().filter(p => !p.prof && (!p.secu || th === 'evf' || L.pil.includes(p.id))).map(p => `<button class="pchip ${L.pil.includes(p.id) ? 'on' : ''}" data-action="pilToggle" data-n="${n}" data-p="${p.id}">${p.ico} ${esc(p.n)}</button>`).join('');
    const crit = th === 'evf' && L.pil.length ? `<div class="crit-box"><b>Critères retenus pour l'évaluation finale</b>${L.pil.map(id => { const p = pilier(id); if (!p) return ''; const keep = L.crit[id];
      return `<div class="crit-row"><span>${p.ico} ${esc(p.n)}</span>${p.cr.map((c, i) => `<button class="cchip ${!keep || !keep.length || keep.includes(i) ? 'on' : ''}" data-action="critToggle" data-n="${n}" data-p="${id}" data-i="${i}">${esc(c)}</button>`).join('')}</div>`; }).join('')}</div>` : '';
    const W = L.wu;
    rows += `<div class="lrow"><div class="lesson-num ${n===cur?'cur':''}" style="background:${T.c}">${n}</div><div class="lrow-main">
      <div class="lrow-top"><label class="pil-sel">${T.ico}<select data-field="th" data-n="${n}">${THEME_IDS.map(k => `<option value="${k}" ${th===k?'selected':''}>${esc(THEMES[k].n)}</option>`).join('')}</select></label>
        <label class="pil-sel">👀<select data-field="suivi" data-n="${n}"><option value="s" ${L.suivi==='s'?'selected':''}>Suivi série par série</option><option value="e" ${L.suivi==='e'?'selected':''}>Suivi par exercice (fin d'exercice)</option></select></label>
        <label class="pil-sel">🔥<select data-field="wuT" data-n="${n}">${Object.entries(WU_TYPES).map(([k, v]) => `<option value="${k}" ${W.t===k?'selected':''}>${esc(v)}</option>`).join('')}</select></label>
        ${W.t === 'circuit' ? `<label class="pil-sel">nb<select data-field="wuNb" data-n="${n}">${[4,5,6,7,8,9,10].map(v => `<option ${+W.nb===v?'selected':''}>${v}</option>`).join('')}</select></label>
          <label class="pil-sel">⏱<select data-field="wuDur" data-n="${n}">${[30,45,60].map(v => `<option value="${v}" ${+W.dur===v?'selected':''}>${v} s</option>`).join('')}</select></label>` : ''}</div>
      <div class="lrow-pil"><span class="muted" style="font-weight:800">${th === 'evf' ? 'Piliers évalués (dont 🛡️ Sécurité) :' : `Piliers (${L.pil.length}/${mp}) :`}</span> ${pilChips}</div>${crit}</div></div>`;
  }
  return `<div class="card strong compact"><div class="row"><div class="rf"><div class="rf-h"><span class="rf-l">📅 Nombre de leçons</span></div>${stepper('nbLessons','',N)}</div>
      <div class="muted grow" style="font-weight:700">Pour chaque leçon : le thème, 1 ou 2 piliers observés par un camarade, le mode de suivi (selon le nombre de tablettes) et l'échauffement.</div></div></div>
    <div class="card compact"><h2>Leçons</h2>${rows}</div>
    <div class="card compact"><h2>📖 Les mobiles</h2><table class="simple"><tr><th>Mobile</th><th>Séries × rép.</th><th>Charge</th><th>Récup</th><th>Rythme</th><th>Organisation</th></tr>
      ${MOB_IDS.map(k => { const M = MOB[k]; return `<tr><td><b>${M.ico} ${esc(M.n)}</b></td><td>${M.s} × ${M.r}</td><td>${M.pctLow ? M.pctLow + ' à ' : ''}${M.pct} %</td><td>${fmtRest(M.rest)}</td><td>${esc(M.ry)}</td><td>${esc(M.d.split(' · ')[0])}${M.inter ? ' · 6 min ' + (M.inter === 'endu' ? 'endurance' : 'cardio') + ' entre les exercices' : ''}</td></tr>`; }).join('')}</table>
      <div class="muted" style="font-weight:700;margin-top:6px">Charge proposée par zone de 5 kg (32 kg → entre 30 et 35 kg). Exercices au poids de corps : répétitions = % du max de répétitions.</div></div>`;
}
function profPiliers(){
  return `<div class="card strong"><h2>🏛 Piliers et observables</h2><div class="muted" style="font-weight:700">3 observables par pilier, affichés à l'observateur sur la tablette. Le pilier 🛡️ Sécurité est proposé pour l'évaluation finale.</div></div>
    ${piliers().map(p => `<div class="card compact"><div class="row"><span style="font-size:28px">${p.ico}</span>${p.prof ? '<span class="tag mod">📝 évaluation enseignant uniquement</span>' : ''}<input type="text" class="grow" data-field="pilName" data-p="${p.id}" value="${esc(p.n)}"></div>
      <div class="th-cr">${[0,1,2].map(i => `<input type="text" data-field="pilCr" data-p="${p.id}" data-i="${i}" value="${esc(p.cr[i] || '')}" placeholder="Observable ${i+1}">`).join('')}</div></div>`).join('')}
    <div class="btn-row"><button class="btn small ghost" data-action="pilReset">↺ Revenir aux observables proposés</button></div>`;
}
function profMachines(){
  return `<div class="card strong"><h2>🏋️ Machines de la salle</h2><div class="muted" style="font-weight:700">Touchez une machine pour la retirer (ou la remettre) dans toute l'appli. Pour une panne d'un jour : Leçon du jour → 🚫 Machines HS.</div></div>
    ${Object.keys(GROUPS).map(g => `<h3 class="g-h" style="--gc:${GROUPS[g].c}">${esc(GROUPS[g].n)}</h3><div class="mpick-grid">${MACHINES.filter(m => m.g === g).map(m => { const off = ROOT.mOff.includes(m.id);
      return `<button class="mpick ${off ? 'blk' : 'sel'}" data-action="mOff" data-id="${m.id}">${mImg(m)}<b>${esc(m.n)}</b><small>${off ? '❌ absente' : '✓ dans la salle'} · ${m.k === 'pdc' ? 'max en répétitions' : m.k === 'cardio' ? 'cardio' : 'max en kg'}</small></button>`; }).join('')}</div>`).join('')}`;
}
function profRoles(){
  return `<div class="card strong"><h2>🎭 Rôles · Coach d'un jour</h2><div class="muted" style="font-weight:700">Un rôle est tiré au sort par élève : il écrit le programme qui répond à la demande, le réalise, et vous le notez.</div></div>
    ${ROOT.roles.map(r => `<div class="card compact"><div class="row"><input type="text" class="grow" data-field="roleName" data-r="${r.id}" value="${esc(r.n)}"><button class="btn small red" data-action="roleDel" data-r="${r.id}">🗑</button></div>
      <textarea data-field="roleTxt" data-r="${r.id}" style="margin-top:8px">${esc(r.t)}</textarea></div>`).join('')}
    <div class="btn-row"><button class="btn green" data-action="roleAdd">＋ Nouveau rôle</button><button class="btn small ghost" data-action="roleReset">↺ Rôles proposés</button></div>`;
}

/* ---------------------------------------------------------------------
   Leçon du jour : appel (forme, motivation, inaptitudes), machines HS, tirage des rôles
   --------------------------------------------------------------------- */
function profAppel(){
  const n = curLesson(), L = lesson(n), cnt = k => S.students.filter(s => attOf(n, s.id) === k).length;
  return `<div class="card strong"><h2>✅ Appel · Leçon ${n}</h2><div class="muted" style="font-weight:700">${S.students.length - cnt('abs') - cnt('disp')} présent(s) · ${cnt('abs')} absent(s) · ${cnt('disp')} dispensé(s) · ${cnt('inap')} inaptitude(s) partielle(s).
      « Inapte partiel » : touchez les zones concernées, les machines qui les sollicitent sont retirées.</div></div>
    <div class="tiles">${sortedStudents().map(s => { const a = attOf(n, s.id), w = L.wb[s.id] || {}, z = L.z[s.id] || [];
      return `<div class="att-tile ${a ? ATT[a].cls : ''}">${band(s.id)}<div class="name">${esc(nameOf(s.id))}</div>
        <div class="btn-row"><button class="btn ${a==='abs'?'abs-on':''}" data-action="att" data-sid="${s.id}" data-v="abs">Absent</button>
        <button class="btn ${a==='disp'?'disp-on':''}" data-action="att" data-sid="${s.id}" data-v="disp">Dispensé</button>
        <button class="btn ${a==='inap'?'inapte-on':''}" data-action="att" data-sid="${s.id}" data-v="inap">Inapte partiel</button></div>
        ${a === 'inap' ? `<button class="btn small well-btn" data-action="appelWell" data-sid="${s.id}">🩹 ${z.length ? `<b style="color:#D0161B">${esc(z.map(zoneName).join(', '))}</b>` : 'Choisir les zones'}</button>` : ''}</div>`; }).join('')}</div>`;
}
function appelWellModal(sid){
  const n = curLesson(), L = lesson(n);
  const w = { ...(L.wb[sid] || {}) }; let sel = [...(L.z[sid] || [])];
  const m = modal(`<h2>🩹 ${esc(nameOf(sid))} · inaptitude partielle : zones concernées</h2>
    <div class="pain-wrap"><div id="body-box"></div><div class="pain-side"><div class="btn-row" id="extra-z"></div><p id="pain-list" style="font-weight:800"></p></div></div>
    <div class="btn-row spread" style="margin-top:10px"><button class="btn" data-p="cancel">Annuler</button><button class="btn primary" data-p="ok">Valider</button></div>`, { wide:true });
  const draw = () => {
    m.querySelector('#body-box').innerHTML = bodySVG(sel);
    m.querySelector('#extra-z').innerHTML = ZONES.filter(q => !q.x).map(q => `<button class="btn ${sel.includes(q.k)?'red':''}" data-z="${q.k}">${q.n}</button>`).join('');
    m.querySelector('#pain-list').textContent = sel.length ? sel.map(zoneName).join(' · ') + ' → machines adaptées' : 'Aucune zone';
    m.querySelectorAll('[data-zone],[data-z]').forEach(el => el.onclick = () => { const k = el.dataset.zone || el.dataset.z; sel = sel.includes(k) ? sel.filter(x => x !== k) : [...sel, k]; draw(); });
  };
  draw();
  m.querySelector('[data-p="cancel"]').onclick = () => closeModal();
  m.querySelector('[data-p="ok"]').onclick = () => {
    if (sel.length) { L.z[sid] = sel; if (!L.att[sid]) L.att[sid] = 'inap'; } else { delete L.z[sid]; if (L.att[sid] === 'inap') delete L.att[sid]; }
    save(); closeModal(); render(); };
}
function profHS(){
  const n = curLesson(), L = lesson(n);
  return `<div class="card strong"><h2>🚫 Machines hors service · Leçon ${n}</h2><div class="muted" style="font-weight:700">Une machine hors service n'apparaît plus dans les choix des élèves pour cette leçon (à faire avant d'afficher le QR).</div></div>
    <div class="mpick-grid">${salleMachines().map(m => { const hs = L.hs.includes(m.id);
      return `<button class="mpick ${hs ? 'blk hs' : 'sel'}" data-action="hsToggle" data-id="${m.id}">${mImg(m)}<b>${esc(m.n)}</b><small>${hs ? '🚫 hors service' : '✓ disponible'}</small></button>`; }).join('')}</div>`;
}
function profTirage(){
  const n = curLesson(), L = lesson(n), list = sortedStudents().filter(s => present(n, s.id));
  return `<div class="card strong"><h2>🎲 Coach d'un jour · tirage des rôles</h2>
      <div class="muted" style="font-weight:700">${ROOT.roles.length} rôles disponibles (modifiables dans Préparer → 🎭 Rôles). Chaque élève reçoit un rôle différent tant que c'est possible. Les élèves sans rôle pourront le tirer sur la tablette.</div>
      <div class="btn-row" style="margin-top:10px"><button class="btn primary" data-action="drawAll">🎲 Tirer au sort pour les présents</button>${Object.keys(L.role).length ? '<button class="btn small ghost" data-action="drawClear">Effacer le tirage</button>' : ''}</div></div>
    <div class="tiles">${list.map(s => `<div class="att-tile">${band(s.id)}<div class="name">${esc(nameOf(s.id))}</div>
      <select data-field="roleOf" data-sid="${s.id}"><option value="">— pas de rôle —</option>${ROOT.roles.map(r => `<option value="${r.id}" ${L.role[s.id]===r.id?'selected':''}>${esc(r.n)}</option>`).join('')}</select></div>`).join('')}</div>`;
}
function profSeanceQR(){
  const n = curLesson(), off = S.students.filter(s => !present(n, s.id)).length;
  return `<div class="card strong"><h2>📲 QR de la leçon · Leçon ${n}</h2>
      <div class="muted" style="font-weight:700">${esc(lessonTitle(n))} · ${S.students.length} élève(s) · ${off} absent(s)/dispensé(s) · ${lesson(n).hs.length} machine(s) HS · les max de chaque élève sont transmis.</div>
      <div class="advice info">Sur chaque tablette élève : <b>📷 Scanner la leçon</b>. Faites l'appel, déclarez les machines HS${thOf(n) === 'coach' ? ' et tirez les rôles' : ''} <b>avant</b> d'afficher ce QR.</div>
      <div id="qr-seance" class="center">Préparation…</div>
      <div class="btn-row" style="justify-content:center;margin-top:10px"><button class="btn small" data-action="fileSeance">📤 Partager la leçon en fichier</button></div></div>`;
}

/* ---------------------------------------------------------------------
   Évaluations : intermédiaire (1 à 3 piliers par élève) et finale (piliers + Sécurité)
   Note de chaque pilier de 1 à 10 → note /10 = moyenne
   --------------------------------------------------------------------- */
function evalLessons(){ const l = []; for (let n = 1; n <= S.settings.nbLessons; n++) if (['evi','evf'].includes(thOf(n))) l.push(n); return l; }
function profEvals(fixed){
  if (fixed && thOf(fixed) === 'coach') return profCoachB(fixed);
  const ls = evalLessons();
  if (!ls.length) return `<div class="card">Aucune leçon « Évaluation intermédiaire » ou « Évaluation finale » dans le cycle (Préparer → 📅 Cycle & leçons).</div>`;
  const n = fixed || (ls.includes(UI.evN) ? UI.evN : ls[0]), L = lesson(n), th = thOf(n);
  const pick = fixed ? '' : `<div class="lesson-picker">${ls.map(k => `<button class="lp ${k===n?'on':''}" data-action="evN" data-n="${k}"><span>${k}</span><small>${THEMES[thOf(k)].ico}</small></button>`).join('')}</div>`;
  const head = `<div class="card strong"><h2>${THEMES[th].ico} ${esc(THEMES[th].n)} · Leçon ${n}</h2>${pick}
    <div class="muted" style="font-weight:700;margin-top:6px">${th === 'evi' ? 'Choisissez 1 à 3 piliers pour chaque élève, puis placez le curseur de 1 à 10 pour chaque pilier : la note /10 est la moyenne.'
      : `Piliers et critères retenus dans le cycle : ${L.pil.map(id => pilier(id)?.n).filter(Boolean).join(' · ') || '<b>aucun</b> (Préparer → Cycle & leçons)'}. Note de 1 à 10 par pilier → note /10.`}</div></div>`;
  const list = sortedStudents();
  return head + `<div class="ev-list">${list.map(s => { const at = attOf(n, s.id);
    if (at === 'abs' || at === 'disp') return `<div class="ev-card off">${band(s.id)}<b>${esc(nameOf(s.id))}</b> <span class="tag abs">${ATT[at].n}</span></div>`;
    const ids = evalPils(n, s.id), e = L.ev[s.id] || {}, note = evalNote(n, s.id), om = pilMeans(n, s.id);
    const chips = th === 'evi' ? `<div class="ev-chips">${piliers().map(p => `<button class="pchip sm ${ids.includes(p.id) ? 'on' : ''}" data-action="evpToggle" data-n="${n}" data-sid="${s.id}" data-p="${p.id}">${p.ico} ${esc(p.n)}</button>`).join('')}</div>` : '';
    return `<div class="ev-card">${band(s.id)}<div class="ev-h"><b>${esc(nameOf(s.id))}</b>${MOB[mobOf(n, s.id)] ? `<span class="muted">${MOB[mobOf(n, s.id)].ico} ${esc(MOB[mobOf(n, s.id)].n)}</span>` : ''}<span class="ev-note ${note != null ? 'on' : ''}">${note != null ? fmt(note) : '—'}<small>/10</small></span></div>${chips}
      ${ids.map(id => { const p = pilier(id); if (!p) return ''; const v = e[id];
        return `<div class="ev-row"><span class="ev-p">${p.ico} ${esc(p.n)}${om[id] != null ? `<small>observateur : ${fmt(om[id])}</small>` : ''}</span>
          <input type="range" min="1" max="10" step="1" value="${v ?? 5}" class="${v == null ? 'unset' : ''}" data-field="evV" data-n="${n}" data-sid="${s.id}" data-p="${id}" style="--rc:${v ? scaleColor(v) : '#C9D1E0'}">
          <b class="ev-v" style="background:${v ? scaleColor(v) : '#fff'};color:${v ? scaleText(v) : '#5B6478'}">${v ?? '–'}</b></div>`; }).join('')}</div>`; }).join('')}</div>`;
}
/* =====================================================================
   Suivi élève (tablette et prof), max de la classe, bilans, coach d'un jour
   ===================================================================== */
function viewSuiviTiles(){
  if (!S.students.length) return `<div class="card">Aucun élève.</div>`;
  return `<div class="tiles">${sortedStudents().map(s => { const ms = maxedMachines(s.id);
    return `<button class="tile" data-action="suiviDetail" data-sid="${s.id}">${band(s.id)}<span class="name">${esc(nameOf(s.id))}</span>
      <span class="meta">🏋️ ${ms.length} max enregistré(s)</span></button>`; }).join('')}</div>`;
}
/* Résumé d'une leçon pour un élève (local ou reçu du prof) */
function lessonSummary(n, sid){
  const r = res(n, sid), h = S.hist[sid]?.[n];
  if (r) { const pm = pilMeans(n, sid);
    return { th: thOf(n), at: attOf(n, sid), mob: mobOf(n, sid), bg: borgMean(n, sid), ex: (r.ex || []).length + (r.hip || []).length,
      reps: (r.ex || []).reduce((a, E) => a + (E.k === 'max' ? 0 : repsDone(E)), 0), pil: avg(Object.values(pm)), og: avg(obsGiven(n, sid)), r, wu: r.wu }; }
  if (h) return { th: h[0], at: h[1] || null, mob: h[2] || null, ex: h[3] || 0, reps: h[4] || 0, pil: h[5] ? h[5] / 10 : null, bg: h[6] ? h[6] / 10 : null, og: h[8] ? h[8] / 10 : null };
  const at = attOf(n, sid), og = avg(obsGiven(n, sid)); return at || og != null ? { th: thOf(n), at, og } : null;
}
function maxTable(sid, n){
  const ms = maxedMachines(sid);
  if (!ms.length) return `<div class="muted" style="font-weight:700">Aucun max enregistré pour l'instant.</div>`;
  return `<div class="pj-table-wrap"><table class="pj-table"><tr><th>Machine</th><th>Max actuel</th><th>Historique</th><th>Progrès</th></tr>
    ${ms.map(id => { const h = maxHist(sid, id), last = h[h.length - 1], first = h[0], d = last.v - first.v;
      return `<tr><td>${mImg(id, 'm-mini')} <b>${esc(mName(id))}</b></td><td><b class="big-v">${fmtMax(id, last.v)}</b><small class="muted"> L${last.n} · ${last.mode === 'brz' ? 'Brzycki' : last.mode === 'reps' ? 'rép.' : last.mode === 'hip' ? 'Hippopogramme' : '1RM'}</small></td>
        <td>${h.map(x => `<span class="hchip">L${x.n} : ${fmtMax(id, x.v)}</span>`).join(' ')}</td>
        <td>${h.length > 1 ? `<b class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${isPdc(id) ? Math.abs(Math.round(d)) + ' rép.' : fmtKg(Math.abs(d))}</b>` : '—'}</td></tr>`; }).join('')}</table></div>`;
}
function exLine(n, sid, E){
  if (E.k === 'max') return `🏋️ <b>${esc(mName(E.m))}</b> · prise de max ${E.mode === 'brz' ? `(${fmtKg(E.kg)} × ${E.r}, Brzycki)` : E.mode === '1rm' ? '(1RM)' : '(répétitions)'} : <b>${fmtMax(E.m, E.v)}</b>`;
  const t = target(n, sid, E), nm = E.m ? mName(E.m) : (E.nm || 'Exercice adapté');
  const pils = Object.keys(E.ob || {}).map(id => { const v = obMean(E, id); if (v == null) return ''; const f = vals(E.fq?.[id]), k = noteSucc(v);
    return `<span class="pil-mini" style="background:${SUCC[k].c};color:${SUCC[k].f}" title="${esc(pilier(id)?.n || '')}${f.length ? ' · ' + FREQ[Math.round(avg(f))] : ''}">${pilier(id)?.ico || '👀'} ${fmt(v)}</span>`; }).filter(Boolean).join(' ') + (E.by && E.by !== 'x' && student(E.by) ? ` <span class="muted">(obs. ${esc(nameOf(E.by))})</span>` : '');
  return `${E.k === 'free' ? '✏️' : E.k === 'coach' ? '🎭' : '💪'} <b>${esc(nm)}</b> · ${esc(tgtTxt(t))} · réalisé : ${vals(E.sets).join(' / ') || '—'}${pils ? ' · ' + pils : ''}${E.it?.x ? ` · ⏱️ 6 min ${esc(wuEx(E.it.x)?.n || '')}${E.it.ok ? ' ✓' : ''}` : ''}`;
}
const wuTxt = w => !w ? '' : w.t === '3x3' || w.p || w.c || w.e ? ['p','c','e'].map(k => w[k] ? wuEx(w[k])?.n : null).filter(Boolean).join(' · ') : (w.ex || []).map(id => wuEx(id)?.n).filter(Boolean).join(', ');
function viewSuiviDetail(sid){
  const s = student(sid); if (!s) return '<p>Élève introuvable.</p>';
  const N = S.settings.nbLessons;
  let rows = '';
  for (let n = 1; n <= N; n++) { const x = lessonSummary(n, sid); if (!x) continue; const T = THEMES[x.th] || {};
    rows += `<tr><td><b>L${n}</b></td><td>${T.ico || ''} ${esc(T.n || '')}${x.mob && (THEMES[x.th]?.mobs || []).length > 1 ? `<div class="muted" style="font-size:13px">${esc(MOB[x.mob]?.n || '')}</div>` : ''}</td>
      <td>${x.at ? `<span class="tag ${ATT[x.at].cls}">${esc(ATT[x.at].n)}</span>` : ''}</td><td class="c">${chipB(x.bg)}</td>
      <td class="c">${x.ex || '—'}</td><td class="c">${x.reps || '—'}</td><td class="c">${chipV(x.pil)}</td><td class="c">${chipV(x.og)}</td></tr>`;
    if (x.r && isProfRole() || x.r && UI.view === 'suiviDetail') { const det = (x.r.ex || []).map(E => `<div>${exLine(n, sid, E)}</div>`).join('') + (x.r.hip || []).map(h => `<div>${hipLine(h)}</div>`).join('') + (wuTxt(x.wu) ? `<div>🔥 Échauffement : ${esc(wuTxt(x.wu))}</div>` : '');
      if (det) rows += `<tr class="det"><td></td><td colspan="7">${det}</td></tr>`; } }
  const notes = evalLessons().map(n => ({ n, v: evalNote(n, sid) })).filter(x => x.v != null);
  const coach = []; for (let n = 1; n <= N; n++) if (thOf(n) === 'coach' && lesson(n).cn[sid]?.v) coach.push({ n, v: lesson(n).cn[sid].v });
  const P = S.projects[sid];
  return `<div class="card strong"><div class="row"><h2 class="grow" style="margin:0">${band(sid)} ${esc(nameOf(sid))}</h2>${isProfRole() ? `<button class="btn small" data-action="printFiche" data-sid="${sid}">🖨️ Fiche PDF</button>` : ''}</div>
      ${P ? `<div style="margin-top:6px;font-weight:800">📋 Projet : ${esc(MOB[P.mob]?.n || '')} · ${(P.ms || []).map(mName).join(', ')}</div>` : ''}
      ${notes.length || coach.length ? `<div class="row" style="margin-top:8px">${notes.map(x => `<span class="note-chip">${THEMES[thOf(x.n)].ico} L${x.n} : <b>${fmt(x.v)}/10</b></span>`).join('')}${coach.map(x => `<span class="note-chip">🎭 L${x.n} : <b>${fmt(x.v)}/10</b></span>`).join('')}</div>` : ''}</div>
    <div class="card"><h2>🏋️ Mes max</h2>${maxTable(sid)}</div>
    <div class="card"><h2>📅 Mon cycle</h2><div class="pj-table-wrap"><table class="pj-table"><tr><th>Leçon</th><th>Thème</th><th>Statut</th><th class="c">🥵 Borg</th><th class="c">Exercices</th><th class="c">Rép.</th><th class="c">👀 Piliers reçus</th><th class="c">📊 Notes données</th></tr>${rows || '<tr><td colspan="8">Pas encore de séance.</td></tr>'}</table></div></div>`;
}

function profMaxes(){
  const list = sortedStudents(), ms = MACHINES.filter(m => list.some(s => maxVal(s.id, m.id, 99) != null));
  if (!ms.length) return `<div class="card">Aucun max enregistré pour l'instant.</div>`;
  return `<div class="card strong"><h2>🏋️ Max de la classe</h2><div class="muted" style="font-weight:700">Max actuel (▲ progrès depuis le premier max). Machines chargées en kg, poids de corps en répétitions.</div>
    <div class="pj-table-wrap"><table class="pj-table mx-table"><tr><th>Élève</th>${ms.map(m => `<th class="c">${mImg(m, 'm-mini')}<div>${esc(m.n)}</div></th>`).join('')}</tr>
    ${list.map(s => `<tr><td><b>${esc(nameOf(s.id))}</b></td>${ms.map(m => { const h = maxHist(s.id, m.id); if (!h.length) return '<td class="c muted">—</td>';
      const d = h[h.length-1].v - h[0].v; return `<td class="c"><b>${fmtMax(m.id, h[h.length-1].v)}</b>${h.length > 1 ? `<div class="${d >= 0 ? 'up' : 'down'}" style="font-size:13px">${d >= 0 ? '▲' : '▼'} ${isPdc(m.id) ? Math.abs(Math.round(d)) : fmt(Math.abs(d))}</div>` : ''}</td>`; }).join('')}</tr>`).join('')}</table></div></div>`;
}
function profBilanL(){
  const N = S.settings.nbLessons, n = UI.bilN && UI.bilN <= N ? UI.bilN : curLesson(), P = lessonPils(n);
  return `<div class="card strong compact"><h2>🔎 Bilan de la leçon</h2><div class="lesson-picker">${Array.from({length:N},(_,i)=>i+1).map(k=>`<button class="lp ${k===n?'on':''}" data-action="bilN" data-n="${k}"><span>${k}</span><small>${THEMES[thOf(k)].ico}</small></button>`).join('')}</div>
      <div class="muted" style="font-weight:800;margin-top:4px">${esc(lessonTitle(n))}${P.length ? ' · ' + P.map(p => p.ico + ' ' + esc(p.n)).join(' · ') : ''}</div></div>
    <div class="card"><div class="pj-table-wrap"><table class="pj-table"><tr><th>Élève</th><th>Statut</th><th class="c">🥵 Borg</th><th>🔥 Échauffement</th><th>Séance</th>${P.map(p => `<th class="c">${p.ico}</th>`).join('')}<th class="c" title="Moyenne des notes données en tant qu'observateur">📊 Notes<br>données</th></tr>
    ${sortedStudents().map(s => { const at = attOf(n, s.id), r = res(n, s.id), pm = pilMeans(n, s.id), z = zonesOf(n, s.id);
      return `<tr><td><b>${esc(nameOf(s.id))}</b></td><td>${at ? `<span class="tag ${ATT[at].cls}">${esc(ATT[at].n)}</span>` : ''}${z.length ? `<div class="muted" style="font-size:13px">🩹 ${esc(z.map(zoneName).join(', '))}</div>` : ''}</td>
        <td class="c">${chipB(borgMean(n, s.id))}</td><td style="font-size:14px">${esc(wuTxt(r?.wu))}${r?.wu?.ok ? ' ✓' : ''}</td>
        <td style="font-size:14px">${(r?.ex || []).map(E => `<div>${exLine(n, s.id, E)}</div>`).join('') + (r?.hip || []).map(h => `<div>${hipLine(h)}</div>`).join('') || (at ? '' : '<span class="muted">rien reçu</span>')}</td>
        ${P.map(p => `<td class="c">${chipV(pm[p.id])}</td>`).join('')}<td class="c">${(g => g.length ? chipV(avg(g)) + `<div class="muted" style="font-size:12px">${g.length} note(s)</div>` : '<span class="muted">—</span>')(obsGiven(n, s.id))}</td></tr>`; }).join('')}</table></div>
      <div class="muted" style="font-weight:700;margin-top:6px">📊 Notes données : moyenne des notes de piliers que l'élève a mises en tant qu'observateur (moyenne de la classe : ${fmt(avg(obsGiven(n, null)))}).</div></div>`;
}
function profCoachB(fixed){
  const ls = []; for (let k = 1; k <= S.settings.nbLessons; k++) if (thOf(k) === 'coach') ls.push(k);
  if (!ls.length) return `<div class="card">Aucune leçon « Coach d'un jour » dans le cycle.</div>`;
  const n = fixed || (ls.includes(UI.coN) ? UI.coN : ls[0]), L = lesson(n);
  return `<div class="card strong"><h2>🎭 Coach d'un jour · Leçon ${n}</h2>${fixed ? '' : `<div class="lesson-picker">${ls.map(k => `<button class="lp ${k===n?'on':''}" data-action="coN" data-n="${k}">${k}</button>`).join('')}</div>`}
      <div class="muted" style="font-weight:700">Production de chaque élève et note /10 (curseur).</div></div>
    ${sortedStudents().filter(s => present(n, s.id)).map(s => { const r = res(n, s.id) || {}, C = r.coach || {}, R = role(C.c || L.role[s.id]), cn = L.cn[s.id] || {};
      const f = (k, l) => C[k] ? `<div class="co-f"><span>${l}</span>${esc(C[k])}</div>` : '';
      return `<div class="card compact co-card"><div class="row"><h3 class="grow" style="margin:0">${esc(nameOf(s.id))} · ${R ? esc(R.n) : '<span class="muted">pas de rôle</span>'}</h3>
        <span class="ev-note ${cn.v ? 'on' : ''}">${cn.v ?? '—'}<small>/10</small></span></div>
        ${f('comp', 'Ce qu\'il/elle comprend')}${f('trav', 'Doit travailler sur')}${C.mob ? `<div class="co-f"><span>Mobile</span>${esc(MOB[C.mob].n)}</div>` : ''}${C.cob ? `<div class="co-f"><span>Cobaye</span>${esc(nameOf(C.cob))}</div>` : ''}${wuTxt(r.wu) ? `<div class="co-f"><span>Échauffement (${esc(WU_TYPES[r.wu.t] || '')})</span>${esc(wuTxt(r.wu))}</div>` : f('wu', 'Échauffement')}
        ${(r.ex || []).length ? `<div class="co-f"><span>Exercices</span>${r.ex.map(E => `<div>${exLine(n, s.id, E)}</div>`).join('')}</div>` : ''}${f('cons', 'Conseils')}
        <div class="ev-row"><span class="ev-p">📝 Note</span><input type="range" min="0" max="10" step="0.5" value="${cn.v ?? 5}" class="${cn.v == null ? 'unset' : ''}" data-field="coachNote" data-n="${n}" data-sid="${s.id}"><b class="ev-v">${cn.v ?? '–'}</b></div>
        <input type="text" data-field="coachCom" data-n="${n}" data-sid="${s.id}" value="${esc(cn.com || '')}" placeholder="Commentaire (facultatif)"></div>`; }).join('')}`;
}

/* ---------------------------------------------------------------------
   Récupérer : tablettes élèves + Hippopogramme
   --------------------------------------------------------------------- */
function waitList(){
  const n = curLesson(), pres = sortedStudents().filter(s => present(n, s.id));
  const ok = pres.filter(s => lessonState(n, s.id).any), miss = pres.filter(s => !lessonState(n, s.id).any);
  const pc = pres.length ? Math.round(ok.length / pres.length * 100) : 0;
  const LR = UI.lastRecv && UI.lastRecv.cid === S.id ? UI.lastRecv : null;
  return `${LR ? `<div class="last-recv"><div class="lr-h">📥 Dernier QR reçu${LR.from ? ` · ${esc(String(LR.from))}` : ''} · ${LR.ids.length} élève(s)</div>
      ${LR.ids.filter(id => student(id)).map(id => { const st = lessonState(n, id); return `<div class="lr-row">${band(id)}<span class="lr-n">${esc(nameOf(id))}</span><span class="cnt ${st.plan && st.done >= st.plan ? 'ok' : 'part'}">🏋️ ${st.done}${st.plan ? '/' + st.plan : ''}</span></div>`; }).join('')}</div>` : ''}
    <div class="recv-prog"><div class="rp-bar"><span style="width:${pc}%"></span></div><div class="rp-txt"><b>${ok.length} / ${pres.length}</b> fiches reçues · ${pc} %</div></div>
    <h2>⏳ En attente <span class="muted">· ${miss.length}/${pres.length}</span></h2>
    ${miss.length ? `<div class="wait-list">${miss.map(s => `<div class="wait-it">${band(s.id)}<span class="wn">${esc(nameOf(s.id))}</span></div>`).join('')}</div>` : '<div class="advice good">✓ Toutes les fiches de la leçon sont arrivées.</div>'}`;
}
function profRecup(){
  return `<div class="recup-grid"><div class="card strong"><h2>📥 Scanner les tablettes</h2>
      <div class="muted" style="font-weight:700">Tablettes élèves : <b>📤 Envoyer mes saisies</b> · Hippopogramme : <b>📲 QR pour l'appli Musculation</b>. Scannez le QR ici (leçon ${curLesson()}).</div>
      <div id="scan-area"></div>
      <div class="btn-row" style="justify-content:center;margin-top:12px"><button class="btn primary" data-action="profTab" data-tab="recup">↻ Actualiser</button>
        <label class="btn">📂 Importer un fichier (.json)<input type="file" id="file-sync" accept=".json,application/json" hidden></label></div></div>
    <div class="card strong" id="wait-box">${waitList()}</div></div>`;
}
function profExport(){
  return `<div class="card strong"><h2>📊 Export Excel</h2><button class="btn green" data-action="exportXlsx">📊 Exporter en .xlsx</button>
      <div class="muted" style="font-weight:700;margin-top:6px">Synthèse · max · séances (une ligne par exercice) · piliers · appel · échauffements · évaluations · coach d'un jour.</div></div>
    <div class="card strong"><h2>🖨️ Fiches élèves (PDF)</h2><div class="muted" style="font-weight:700">Une fiche par élève : max, cycle complet, séances détaillées. Dans la fenêtre d'impression : « Enregistrer en PDF ».</div>
      <button class="btn green" data-action="printFiches" style="margin-top:8px">🖨️ Toute la classe (${S.students.length} élèves)</button></div>
    <div class="card"><h2>Sauvegarde complète</h2><div class="btn-row">
      <button class="btn" data-action="backup">💾 Sauvegarder (.json)</button>
      <label class="btn">♻️ Restaurer<input type="file" id="file-restore" accept=".json,application/json" hidden></label></div></div>
    <div class="card"><h2>Code enseignant</h2><div class="row">
      <label class="field"><span>Nouveau code (4 chiffres)</span><input type="password" inputmode="numeric" maxlength="4" id="new-pin" style="max-width:180px"></label>
      <button class="btn" data-action="setPin" style="align-self:flex-end">Changer</button></div></div>
    <div class="card"><h2>Réinitialiser</h2><div class="btn-row">
      <button class="btn small ghost" data-action="clearResults">Effacer tous les résultats</button>
      <button class="btn small red" data-action="resetAll">Réinitialiser cette classe</button></div>
      <p class="muted" style="font-size:14px">Version ${APP_VERSION} · appareil ${esc(S.deviceId)}</p></div>`;
}
function profTransfert(){
  return `<div class="card"><h2>🔁 Vers une autre tablette enseignant</h2>
      <div class="btn-row"><button class="btn" data-action="fileFull">📤 Partager la classe en fichier</button></div>
      <div class="muted" style="font-size:14px;font-weight:700">À importer dans « 📥 Récupérer les saisies » de l'autre tablette enseignant.</div></div>
    <div class="card"><h2>Rôle de cette tablette</h2><button class="btn small" data-action="setRole" data-r="eleve">🧒 Passer en tablette élève</button></div>`;
}

/* ---------------------------------------------------------------------
   Fiches PDF (impression)
   --------------------------------------------------------------------- */
function printFiches(ids){
  let root = document.getElementById('print-root'); if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
  const was = UI.view; UI.view = 'suiviDetail';
  root.innerHTML = ids.map(sid => `<div class="print-page"><div class="print-h">Musculation · ${esc(className())} · fiche de suivi</div>${viewSuiviDetail(sid)}</div>`).join('');
  UI.view = was;
  document.body.classList.add('printing');
  setTimeout(() => { window.print(); setTimeout(() => { document.body.classList.remove('printing'); root.innerHTML = ''; }, 500); }, 300);
}
async function readSheetRows(file){
  if (!window.XLSX) throw new Error('Bibliothèque Excel non chargée');
  const buf = await file.arrayBuffer();
  let wb;
  if (/\.(csv|txt)$/i.test(file.name)) {
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf);
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/)[0] || '';
    const FS = (first.match(/;/g)||[]).length >= (first.match(/,/g)||[]).length && first.includes(';') ? ';' : (first.includes('\t') ? '\t' : ',');
    wb = XLSX.read(text, { type:'string', FS, raw:true });
  } else wb = XLSX.read(buf, { type:'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header:1, raw:false, defval:'' });
}
const HEADER_RX = /^(nom|noms|élève|élèves|eleve|eleves|nom\s*(et)?\s*pr[ée]nom|pr[ée]nom|identit[ée]|classe)\b/i;
const isNameLike = s => !!s && /^[A-Za-zÀ-ÖØ-öø-ÿ'’\- .]+$/.test(s) && !/\d/.test(s);
function parseStudents(rows){
  const out = [];
  rows.forEach((row, i) => {
    const a = String(row[0]||'').trim().replace(/\s+/g,' '), b = String(row[1]||'').trim().replace(/\s+/g,' ');
    if (!a) return;
    if (HEADER_RX.test(a) && (i < 3 || !b || HEADER_RX.test(b))) return;
    if (!isNameLike(a)) return;
    let nom, prenom;
    if (b && isNameLike(b) && !HEADER_RX.test(b)) { nom = a; prenom = b; }
    else {
      const tk = a.split(' ');
      const isUp = t => t === t.toUpperCase() && /[A-ZÀ-Ý]/.test(t);
      let k = 0; while (k < tk.length && isUp(tk[k])) k++;
      if (k === 0) { nom = tk[0]; prenom = tk.slice(1).join(' '); }          // pas de majuscules : 1er mot = nom
      else if (k === tk.length) { nom = tk.slice(0, Math.max(1,k-1)).join(' '); prenom = tk.slice(Math.max(1,k-1)).join(' '); }
      else { nom = tk.slice(0,k).join(' '); prenom = tk.slice(k).join(' '); }
      if (!prenom) { prenom = nom; }
    }
    out.push({ nom: nom.toUpperCase(), prenom: capName(prenom) });
  });
  return out;
}
async function importStudentsFile(file){
  try {
    const list = parseStudents(await readSheetRows(file));
    if (!list.length) return toast('Aucun élève reconnu dans ce fichier');
    let mode = 'add';
    if (S.students.length) {
      mode = await choiceBox('Importer ' + list.length + ' élève(s)', `La liste contient déjà ${S.students.length} élève(s).`,
        [{label:'Ajouter à la liste', value:'add', cls:'primary'}, {label:'Remplacer la liste', value:'replace', cls:'red'}]);
      if (!mode) return;
    }
    if (mode === 'replace') { S.students = []; S.results = {}; S.projects = {}; Object.values(S.lessons).forEach(L => { L.att={}; L.z={}; L.wb={}; L.role={}; L.ev={}; L.evp={}; L.cn={}; }); S.mx = {}; S.hist = {}; }
    let added = 0;
    list.forEach(p => {
      if (S.students.some(s => s.nom === p.nom && (s.prenom||'').toLowerCase() === p.prenom.toLowerCase())) return;
      S.students.push({ id: newStudentId(), nom: p.nom, prenom: p.prenom, g: null }); added++;
    });
    save(); render(); toast(`✓ ${added} élève(s) importé(s)`);
  } catch(e){ console.error(e); toast('⚠️ Lecture impossible : ' + e.message, 3500); }
}
/* Base45 : alphabet du mode « alphanumérique » des QR codes (≈ 30 % de données en plus par QR) */
const B45 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
function b45enc(u8){ let s = '';
  for (let i = 0; i < u8.length; i += 2) {
    if (i + 1 < u8.length) { let x = u8[i]*256 + u8[i+1]; const c = x % 45; x = (x-c)/45; const d = x % 45; const e = (x-d)/45; s += B45[c] + B45[d] + B45[e]; }
    else { const x = u8[i], c = x % 45, d = (x-c)/45; s += B45[c] + B45[d]; }
  } return s; }
function b45dec(s){ const out = [];
  for (let i = 0; i < s.length; i += 3) {
    const c = B45.indexOf(s[i]), d = B45.indexOf(s[i+1]);
    if (i + 2 < s.length) { const x = c + d*45 + B45.indexOf(s[i+2])*2025; out.push(x >> 8, x & 255); }
    else out.push(c + d*45);
  } return new Uint8Array(out); }
async function streamBytes(u8, ts){ const st = new Blob([u8]).stream().pipeThrough(ts); return new Uint8Array(await new Response(st).arrayBuffer()); }
function chunkQR(payload, type, max=QR_CHUNK){
  const id = rnd(3).toUpperCase(), parts = [];
  const n = Math.max(1, Math.ceil(payload.length / max));
  const per = Math.ceil(payload.length / n);          // morceaux égaux = QR les moins denses possible
  for (let i = 0; i < n; i++) parts.push(`MU:${type}:${id}:${i+1}:${n}:` + payload.slice(i*per, (i+1)*per));
  return parts;
}
function qrDataURL(text){
  const qr = qrcode(0, 'L'); qr.addData(text, 'Alphanumeric'); qr.make();
  return qr.createDataURL(10, 40);   // marge blanche = 4 modules (zone de silence obligatoire)
}
/* Lecture d'un morceau scanné : « MU:F:ID:i:n:données » */
function parsePart(txt){
  if (txt && txt.startsWith('MU|')) { const f = txt.split('|'); if (f.length < 6) return null;
    return { type:f[1], id:'L'+f[2], i:+f[3], n:+f[4], data:f.slice(5).join('|') }; }
  if (!txt || !txt.startsWith('MU:')) return null;
  const f = txt.split(':');
  if (f.length < 6) return null;
  return { type:f[1], id:f[2], i:+f[3], n:+f[4], data:f.slice(5).join(':') };
}

/* Affichage d'une série de QR (défilement automatique) */
let qrTimer = null;
function showQRSeries(parts, container, title){
  let i = 0, auto = parts.length > 1, speed = 1000;          // 1 QR par seconde (la série tourne en boucle)
  const imgs = parts.map(qrDataURL);
  const draw = () => {
    container.innerHTML = `<div class="qr-box">
      ${title?`<h2 class="center">${title}</h2>`:''}
      <img src="${imgs[i]}" alt="QR code ${i+1}/${parts.length}">
      <div class="qr-part">${parts.length>1?`QR ${i+1} / ${parts.length}`:'QR unique'}</div>
      ${parts.length>1?`<div class="qr-nums">${parts.map((_,k)=>`<button class="${k===i?'on':''}" data-q="${k}">${k+1}</button>`).join('')}</div>
        <div class="btn-row"><button class="btn" data-q="prev">←</button>
        <button class="btn ${auto?'orange':''}" data-q="auto">${auto?'⏸ Pause':'▶ Défilement auto'}</button>
        <button class="btn" data-q="next">→</button></div>`:''}
      
    </div>`;
    container.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
      const q = b.dataset.q;
      if (q === 'auto') auto = !auto;
      else if (q === 'prev') { auto = false; i = (i - 1 + parts.length) % parts.length; }
      else if (q === 'next') { auto = false; i = (i + 1) % parts.length; }
      else { auto = false; i = +q; }
      draw();
    });
  };
  clearInterval(qrTimer);
  qrTimer = setInterval(() => { if (!document.body.contains(container)) return clearInterval(qrTimer); if (auto) { i = (i+1) % parts.length; draw(); } }, speed);
  draw();
}

/* Scanner : caméra (détecteur natif si disponible, sinon jsQR sur le centre de l'image en pleine résolution)
   + secours « photo du QR » (appareil photo natif, mise au point automatique) */
let scan = null;
function stopScan(){
  if (!scan) return;
  scan.stopped = true;
  clearTimeout(scan.timer);
  if (scan.stream) scan.stream.getTracks().forEach(t => t.stop());
  scan = null;
}
let nativeDetector, scanCamIdx = 0, scanCamId = null;
async function getNativeDetector(){
  if (nativeDetector !== undefined) return nativeDetector;
  nativeDetector = null;
  try { if ('BarcodeDetector' in window && (await BarcodeDetector.getSupportedFormats()).includes('qr_code')) nativeDetector = new BarcodeDetector({ formats:['qr_code'] }); } catch(e){}
  return nativeDetector;
}
/* jsQR lit mal les images floues/bruitées en pleine résolution : on réduit l'image par moyennage
   (filtre « boîte », qui efface le bruit du capteur) à plusieurs échelles, en alternant d'une image à l'autre. */
const SCAN_SCALES = [0.4, 0.3, 0.5, 0.24, 0.62, 0.35, 0.8, 0.45];
function grabGray(ctx, cv, src, sx, sy, sw, sh, maxSide){
  const k = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.round(sw*k), h = Math.round(sh*k);
  cv.width = w; cv.height = h; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data, g = new Float32Array(w*h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = d[j]*0.3 + d[j+1]*0.59 + d[j+2]*0.11;
  return { g, w, h };
}
function boxDown(G, f){
  const { g, w, h } = G;
  if (f >= 0.999) return G;
  const nw = Math.max(1, Math.round(w*f)), nh = Math.max(1, Math.round(h*f));
  const o = new Float32Array(nw*nh), c = new Float32Array(nw*nh);
  for (let y = 0; y < h; y++) { const yy = Math.min(nh-1, (y*f)|0), row = yy*nw;
    for (let x = 0; x < w; x++) { const i = row + Math.min(nw-1, (x*f)|0); o[i] += g[y*w+x]; c[i]++; } }
  for (let i = 0; i < o.length; i++) o[i] /= c[i] || 1;
  return { g:o, w:nw, h:nh };
}
function jsqrGray(G, both){
  const { g, w, h } = G, d = new Uint8ClampedArray(w*h*4);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) { d[j] = d[j+1] = d[j+2] = g[i]; d[j+3] = 255; }
  const c = jsQR(d, w, h, { inversionAttempts: both ? 'attemptBoth' : 'dontInvert' });
  return c && c.data ? c.data : null;
}
function jsqrOn(ctx, w, h, both){
  const img = ctx.getImageData(0, 0, w, h);
  const c = jsQR(img.data, w, h, { inversionAttempts: both ? 'attemptBoth' : 'dontInvert' });
  return c && c.data ? c.data : null;
}
/* Lecteur ZXing (moteur de lecture professionnel, compilé en WebAssembly, embarqué dans l'appli) */
let zxReady = false;
try {
  if (window.ZXingWASM) ZXingWASM.prepareZXingModule({ overrides:{ locateFile:(path, prefix) => path.endsWith('.wasm') ? new URL('lib/' + path, document.baseURI).href : prefix + path }, fireImmediately:true })
    .then(() => { zxReady = true; }).catch(e => console.warn('ZXing', e));
} catch(e){}
async function zxRead(imgData, hard=true){
  if (!zxReady) return null;
  try { const r = await ZXingWASM.readBarcodes(imgData, { formats:['QRCode'], tryHarder:hard, maxNumberOfSymbols:1 });
    const ok = r.find(x => x.isValid && x.text); return ok ? ok.text : null; } catch(e){ return null; }
}
async function decodeImageSource(src, sw, sh, cv, ctx, frame, all=false){
  const det = await getNativeDetector();
  if (det) { try { const r = await det.detect(src); if (r && r.length) return r.map(x => x.rawValue); } catch(e){} }
  const side = Math.min(sw, sh) * 0.92, sx = (sw - side)/2, sy = (sh - side)/2;
  if (zxReady) {
    // ZXing : cadre central, puis image entière de temps en temps
    const k = Math.min(1, (all ? 1000 : 800) / side), w = Math.round(side*k);
    cv.width = w; cv.height = w; ctx.drawImage(src, sx, sy, side, side, 0, 0, w, w);
    let t = await zxRead(ctx.getImageData(0, 0, w, w), all || frame % 3 !== 1);
    if (t) return [t];
    if (all || frame % 3 === 2) {
      const k2 = Math.min(1, 1280 / Math.max(sw, sh)), w2 = Math.round(sw*k2), h2 = Math.round(sh*k2);
      cv.width = w2; cv.height = h2; ctx.drawImage(src, 0, 0, sw, sh, 0, 0, w2, h2);
      t = await zxRead(ctx.getImageData(0, 0, w2, h2));
      if (t) return [t];
    }
    if (!all && frame % 2 === 0) return [];        // une image sur deux : aussi jsQR (ci-dessous)
  }
  const G = grabGray(ctx, cv, src, sx, sy, side, side, 1100);
  const scales = all ? SCAN_SCALES : [SCAN_SCALES[frame % SCAN_SCALES.length], SCAN_SCALES[(frame+3) % SCAN_SCALES.length]];
  for (const f of scales) {
    const t = jsqrGray(boxDown(G, f * side / G.w), all || frame % 5 === 4);
    if (t) return [t];
  }
  if (all || frame % 4 === 3) {                      // image entière (QR hors du cadre)
    const F = grabGray(ctx, cv, src, 0, 0, sw, sh, 1100);
    for (const f of (all ? [0.35, 0.5, 0.7] : [0.5])) { const t = jsqrGray(boxDown(F, f), all); if (t) return [t]; }
  }
  return [];
}
async function startScan(container, expectType, onDone){
  stopScan();
  container.innerHTML = `<div class="scan-wrap"><video playsinline webkit-playsinline muted autoplay></video><div class="scan-frame"></div></div>
    <div style="max-width:560px;margin:12px auto">
      <div class="scan-parts"></div>
      <p class="center" style="font-weight:900;font-size:20px" id="scan-msg">Démarrage de la caméra…</p>
      <div class="btn-row" style="justify-content:center"><button class="btn" data-cam>🔄 Caméra</button><label class="btn orange">📷 Photo du QR<input type="file" accept="image/*" capture="environment" hidden class="scan-photo"></label></div>
      <p class="center" id="scan-diag" style="font-size:12px;color:var(--grey);margin-top:8px"></p></div>`;
  const video = container.querySelector('video'), msg = container.querySelector('#scan-msg'), partsEl = container.querySelector('.scan-parts');
  const me = scan = { stopped:false, parts:{}, id:null, n:0, frame:0 };
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d', { willReadFrequently:true });
  const showParts = () => { const got = Object.keys(me.parts).length, pc = me.n ? Math.round(got / me.n * 100) : 0;
    partsEl.innerHTML = me.n > 1 ? `<div class="scan-prog"><div class="scan-bar" style="width:${pc}%"></div><span>${pc} %</span></div>` : ''; };
  let finished = false;
  const handle = async texts => {
    for (const txt of texts) {
      const pt = parsePart(txt);
      if (!pt) { msg.textContent = 'QR non reconnu (ce n\'est pas un QR de l\'appli Musculation).'; continue; }
      const okTypes = [].concat(expectType || []);
      if (okTypes.length && !okTypes.includes(pt.type)) { msg.textContent = okTypes.includes('R') ? 'Ce QR est destiné aux tablettes élèves (📷 Scanner la leçon).' : 'Ce QR est destiné à la tablette enseignant (📥 Récupérer les saisies).'; continue; }
      if (pt.id === me.doneId) continue;            // QR déjà traité (encore devant la caméra)
      if (me.id !== pt.id) { me.id = pt.id; me.parts = {}; me.n = pt.n; }
      if (!me.parts[pt.i]) { me.parts[pt.i] = pt.data; if (navigator.vibrate) navigator.vibrate(40); }
      const got = Object.keys(me.parts).length;
      showParts();
      const miss = Array.from({length:me.n},(_,k)=>k+1).filter(k=>!me.parts[k]);
      msg.textContent = me.n > 1 ? (got < me.n ? `Import : ${Math.round(got / me.n * 100)} % · laissez défiler les QR devant la caméra` : 'Import : 100 %') : 'QR reçu !';
      if (got === me.n && !finished) {
        finished = true;
        const payload = Array.from({length: me.n}, (_, k) => me.parts[k+1]).join('');
        me.doneId = me.id; me.id = null; me.parts = {};
        let r;
        try { r = await onDone(await decodePacket(payload)); }
        catch(e) { console.warn(e); toast('⚠️ ' + e.message, 3500); r = 'continue'; }
        if (r === 'continue' && scan === me && !me.stopped) {     // la caméra reste allumée pour le QR suivant
          finished = false; showParts(); msg.textContent = '✓ Reçu'; me.timer = setTimeout(tick, 400);
        } else if (scan === me) stopScan();
        return;
      }
    }
  };
  // secours photo
  container.querySelector('.scan-photo').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    msg.textContent = 'Lecture de la photo…';
    try {
      const bmp = await createImageBitmap(f);
      const pcv = document.createElement('canvas'), pctx = pcv.getContext('2d', { willReadFrequently:true });
      const r = await decodeImageSource(bmp, bmp.width, bmp.height, pcv, pctx, 0, true);
      if (r.length) await handle(r); else msg.textContent = '⚠️ QR non trouvé sur la photo : recommencez en cadrant le QR bien net, en entier.';
    } catch(err) { msg.textContent = '⚠️ Photo illisible'; }
  });
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    msg.innerHTML = '⚠️ Caméra indisponible : utilisez 📷 Photo du QR.'; return;
  }
  const diag = container.querySelector('#scan-diag');
  container.querySelector('[data-cam]').onclick = async () => {
    try { const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
      if (cams.length < 2) return toast('Une seule caméra');
      scanCamIdx = (scanCamIdx + 1) % cams.length; scanCamId = cams[scanCamIdx].deviceId;
      startScan(container, expectType, onDone); } catch(e){}
  };
  // Plusieurs réglages essayés dans l'ordre (certains appareils donnent une image noire en haute résolution)
  const attempts = scanCamId
    ? [{ deviceId:{ exact: scanCamId } }]
    : [{ facingMode:'environment' }, { facingMode:{ ideal:'environment' }, width:{ ideal:1280 }, height:{ ideal:720 } }, true];
  let lastErr = null;
  for (const vc of attempts) {
    try { me.stream = await navigator.mediaDevices.getUserMedia({ video: vc, audio:false }); break; }
    catch(e) { lastErr = e; }
  }
  if (!me.stream) {
    const n = lastErr && lastErr.name;
    msg.innerHTML = n === 'NotAllowedError' ? '⚠️ Caméra refusée : autorisez la caméra pour ce site dans les réglages, ou utilisez 📷 Photo du QR.'
      : '⚠️ Caméra impossible à ouvrir (' + esc(n || 'erreur') + ') : utilisez 📷 Photo du QR.';
    return;
  }
  if (me.stopped) { me.stream.getTracks().forEach(t=>t.stop()); return; }
  const track = me.stream.getVideoTracks()[0];
  try { await track.applyConstraints({ advanced:[{ focusMode:'continuous' }] }); } catch(e){}
  video.setAttribute('playsinline', ''); video.setAttribute('muted', ''); video.muted = true; video.autoplay = true;
  video.srcObject = me.stream;
  const playIt = () => video.play().catch(()=>{});
  video.onloadedmetadata = playIt; playIt();
  msg.textContent = 'Visez le QR code…';
  const reader = () => nativeDetector ? 'lecteur Android' : zxReady ? 'lecteur ZXing' : 'lecteur jsQR';
  const t0 = Date.now(); let lastDiag = 0, decodes = 0, dark = 0, switched = false;
  const probe = document.createElement('canvas'), pctx = probe.getContext('2d', { willReadFrequently:true }); probe.width = 32; probe.height = 18;
  const tick = async () => {
    if (me.stopped || finished) return;
    const now = Date.now();
    if (video.readyState >= 2 && video.videoWidth) {
      me.frame++;
      // image noire ? (mauvais objectif sur certains appareils) → on passe à une autre caméra
      if (me.frame % 10 === 1) {
        pctx.drawImage(video, 0, 0, 32, 18); const d = pctx.getImageData(0, 0, 32, 18).data; let m = 0;
        for (let i = 0; i < d.length; i += 4) m += d[i] + d[i+1] + d[i+2]; m /= (d.length/4*3);
        dark = m < 6 ? dark + 1 : 0;
        if (dark >= 4 && !switched) { switched = true; toast('Image noire : autre caméra…');
          try { const cams = (await navigator.mediaDevices.enumerateDevices()).filter(x => x.kind === 'videoinput');
            if (cams.length > 1) { const cur = track.getSettings().deviceId; const i = cams.findIndex(c => c.deviceId === cur);
              scanCamIdx = (i + 1) % cams.length; scanCamId = cams[scanCamIdx].deviceId; return startScan(container, expectType, onDone); } } catch(e){}
          msg.textContent = '⚠️ Image noire : touchez 🔄 Caméra ou utilisez 📷 Photo du QR.'; }
      }
      try { const r = await decodeImageSource(video, video.videoWidth, video.videoHeight, cv, ctx, me.frame); decodes++; if (r.length) await handle(r); } catch(e){ console.warn(e); }
    } else if (now - t0 > 4000 && me.frame === 0) {
      msg.textContent = '⚠️ La caméra ne renvoie pas d\'image : touchez 🔄 Caméra ou utilisez 📷 Photo du QR.';
      playIt();
    }
    if (diag && now - lastDiag > 1000) {
      const el = (now - (lastDiag || t0)) / 1000;
      diag.textContent = `Caméra ${video.videoWidth}×${video.videoHeight} · ${Math.round(decodes/el)} analyses/s · ${reader()} · v${APP_VERSION}`;
      lastDiag = now; decodes = 0;
    }
    if (!me.stopped && !finished) me.timer = setTimeout(tick, 60);
  };
  tick();
}
async function downloadJSON(obj, name){
  const blob = new Blob([JSON.stringify(obj)], { type:'application/json' });
  try {
    const file = new File([blob], name, { type:'application/json' });
    if (navigator.canShare && navigator.canShare({ files:[file] })) { await navigator.share({ files:[file], title:name }); return; }
  } catch(e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
/* =====================================================================
   Échanges entre tablettes (QR codes ou fichiers)
   S = leçon (prof → tablettes) · R = saisies (tablette → prof) · H = Hippopogramme (→ prof)
   ===================================================================== */
async function encodePacket(obj){
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (window.CompressionStream) { try { return 'Z' + b45enc(await streamBytes(raw, new CompressionStream('deflate-raw'))); } catch(e){} }
  return 'J' + b45enc(raw);
}
async function decodePacket(str){
  const flag = str[0], bytes = b45dec(str.slice(1));
  let raw = bytes;
  if (flag === 'Z') { if (!window.DecompressionStream) throw new Error('Appareil trop ancien pour décompresser'); raw = await streamBytes(bytes, new DecompressionStream('deflate-raw')); }
  return JSON.parse(new TextDecoder().decode(raw));
}
const nz = v => v == null ? 0 : v;
function buildSeance(n){
  n = n || curLesson(); const L = lesson(n), list = sortedStudents();
  const mx = {}, hist = {}, pj = {};
  list.forEach(s => {
    MACHINES.forEach(m => { const h = maxHist(s.id, m.id).filter(x => x.n <= n); if (h.length) (mx[s.id] = mx[s.id] || {})[m.id] = h.slice(-4).map(x => [Math.round(x.v * 10) / 10, x.n, x.mode || '']); });
    for (let k = 1; k < n; k++) { const x = lessonSummary(k, s.id); if (!x) continue;
      (hist[s.id] = hist[s.id] || {})[k] = [x.th, x.at || 0, x.mob || 0, x.ex || 0, x.reps || 0, x.pil != null ? Math.round(x.pil * 10) : 0, x.bg != null ? Math.round(x.bg * 10) : 0, 0, x.og != null ? Math.round(x.og * 10) : 0]; }
    const P = S.projects[s.id]; if (P) pj[s.id] = { mob:P.mob, ms:P.ms, ts:P.ts || 1 };
  });
  const roles = L.th === 'coach' ? Object.fromEntries(ROOT.roles.map(r => [r.id, { n:r.n, t:r.t }])) : null;
  return { k:'seance', v:1, cid:S.id, cn:className(), pin:ROOT.pin, nbL:S.settings.nbLessons, cur:n, ng:nbGroups(), gc:S.settings.groupColors.slice(0, nbGroups()), off:ROOT.mOff,
    L:{ th:L.th, pil:lessonPils(n), suivi:L.suivi, wu:L.wu, hs:L.hs },
    st: list.map(s => [s.id, nameOf(s.id), grpOf(s.id, n), attOf(n, s.id) || 0, zoneMask(L.z[s.id] || []), nz(L.wb[s.id]?.fo), nz(L.wb[s.id]?.mo), L.role[s.id] || 0]),
    mx, hist, pj, roles, pr: { ...(S.pairs || {}), ...pairsFromResults() } };
}
function targetClass(cid, name, create){
  if (cid && ROOT.classes[cid]) return ROOT.classes[cid];
  if (cid && create) { const c = newClassState(name || 'Classe', cid); ROOT.classes[cid] = c; return c; }
  return S;
}
const hasFullNames = c => c.students.some(s => s.nom);
function applySeance(p){
  const c = targetClass(p.cid, p.cn, true);
  if (hasFullNames(c)) throw new Error('QR de la leçon : à scanner sur les tablettes élèves');
  useClass(c.id);
  S.settings.className = p.cn; S.settings.nbLessons = p.nbL; S.settings.current = p.cur; S.settings.nbGroups = p.ng || 1;
  (p.gc || []).forEach((k, i) => S.settings.groupColors[i] = k);
  ROOT.pin = p.pin || ROOT.pin; ROOT.mOff = p.off || [];
  S.students = p.st.map(a => ({ id:a[0], disp:a[1], grp:a[2] || 0 }));
  const L = lesson(p.cur);
  L.th = p.L.th; L.pilS = p.L.pil || []; L.pil = L.pilS.map(x => x.id); L.suivi = p.L.suivi; L.wu = p.L.wu || { t:'none' }; L.hs = p.L.hs || [];
  L.att = {}; L.z = {}; L.wb = {}; L.role = {}; L.roleS = p.roles || null; L.grpOv = {};
  p.st.forEach(a => { const [id, , , at, zm, fo, mo, ro] = a;
    if (at) L.att[id] = at; const z = maskZones(zm); if (z.length) L.z[id] = z;
    if (fo || mo) L.wb[id] = { fo: fo || null, mo: mo || null }; if (ro) L.role[id] = ro; });
  S.mx = {}; Object.entries(p.mx || {}).forEach(([sid, ms]) => { S.mx[sid] = {}; Object.entries(ms).forEach(([m, arr]) => { S.mx[sid][m] = arr.map(x => ({ v:x[0], n:x[1], mode:x[2] })); }); });
  S.hist = p.hist || {}; S.pairs = { ...(S.pairs || {}), ...(p.pr || {}) }; delete S.curObs;
  Object.entries(p.pj || {}).forEach(([sid, P]) => { const loc = S.projects[sid]; if (!(loc && loc.d === S.deviceId && (loc.ts || 0) > (P.ts || 0))) S.projects[sid] = { ...P, d:'prof' }; });
  ROOT.seance = { cid:S.id, n:p.cur, at:now() };
  save(); toast(`✓ Leçon reçue : ${className()} · leçon ${p.cur}`, 3500);
  UI.filter = null; go('home');
  return 'done';
}
function buildMine(all){
  const R = {}, P = {}; let count = 0; const cur = curLesson();
  Object.entries(S.results).forEach(([n, byS]) => { if (!all && +n !== cur) return;
    Object.entries(byS).forEach(([sid, r]) => { if (r.d === S.deviceId) { (R[n] = R[n] || {})[sid] = r; count++; } }); });
  Object.entries(S.projects).forEach(([sid, p]) => { if (p.d === S.deviceId) P[sid] = p; });
  return { pkt:{ k:'res', cid:S.id, from:S.deviceId, at:now(), R, P }, count };
}
function mergeRes(R, P){
  let n = 0;
  Object.entries(R || {}).forEach(([l, byS]) => Object.entries(byS || {}).forEach(([sid, r]) => {
    S.results[l] = S.results[l] || {}; const cur = S.results[l][sid];
    if (!cur || (r.ts || 0) > (cur.ts || 0)) { S.results[l][sid] = r; n++; } }));
  Object.entries(P || {}).forEach(([sid, p]) => { const cur = S.projects[sid]; if (!cur || (p.ts || 0) > (cur.ts || 0)) { S.projects[sid] = p; n++; } });
  return n;
}
async function applyPacket(p){
  if (!p || !p.k) throw new Error('Données non reconnues');
  if (p.k === 'seance') { if (isProfRole()) throw new Error('QR de la leçon : à scanner sur les tablettes élèves'); return applySeance(p); }
  if (p.k === 'res') {
    const c = targetClass(p.cid, null, false), prev = S.id; useClass(c.id);
    const n = mergeRes(p.R, p.P); useClass(prev); save();
    toast(`✓ ${className(c)} · tablette ${p.from} : ${n} fiche(s) récupérée(s)`, 3500); return n;
  }
  if (p.k === 'hippo') { if (!isProfRole()) throw new Error('QR Hippopogramme : à scanner sur la tablette enseignant'); hippoImport(p); return 'done'; }
  if (p.k === 'full') {
    const c = targetClass(p.c.id, p.c.settings.className, true), prev = S.id;
    if (hasFullNames(c) && c.id !== p.c.id) { useClass(c.id); const n = mergeRes(p.c.results, p.c.projects); useClass(prev); save(); return n; }
    ROOT.classes[p.c.id] = normClass(p.c); useClass(p.c.id); save(); toast('✓ Classe ' + className() + ' importée', 3000); go('prof'); return 'done';
  }
  throw new Error('Type de données inconnu');
}

/* ---------------------------------------------------------------------
   Hippopogramme : association des prénoms et import des séries (machine, répétitions, charge)
   --------------------------------------------------------------------- */
const normN = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
function guessStudent(name){
  const k = normN(name); if (!k) return null;
  const c = S.students.filter(s => [s.prenom, (s.prenom || '') + (s.nom || ''), (s.nom || '') + (s.prenom || ''), nameOf(s.id)].some(x => normN(x) === k));
  if (c.length === 1) return c[0].id;
  const d = S.students.filter(s => normN(s.prenom) && k.startsWith(normN(s.prenom)));
  return d.length === 1 ? d[0].id : null;
}
function hippoImport(p){
  stopScan();
  const n = curLesson(), people = (p.p || []).filter(x => (x[1] || []).length);
  if (!people.length) return toast('Aucun résultat dans ce QR Hippopogramme');
  const map = people.map(x => guessStudent(x[0]));
  const opts = sel => `<option value="">— ne pas importer —</option>${sortedStudents().map(s => `<option value="${s.id}" ${sel === s.id ? 'selected' : ''}>${esc(nameOf(s.id))}</option>`).join('')}`;
  const m = modal(`<h2>🦛 Résultats Hippopogramme → leçon ${n}</h2><div class="muted" style="font-weight:700">Associez chaque nom saisi dans Hippopogramme à un élève de ${esc(className())}.</div>
    <div class="hip-list">${people.map((x, i) => `<div class="hip-row"><div><b>${esc(x[0])}</b><small>${x[1].length} série(s) · ${[...new Set(x[1].map(r => mName(r[0])))].join(', ')}</small></div><select data-i="${i}">${opts(map[i])}</select></div>`).join('')}</div>
    <label class="row" style="margin-top:10px;font-weight:800"><input type="checkbox" id="hip-max" style="width:28px;height:28px"> Mettre à jour les max avec la formule de Brzycki (meilleure série de 15 répétitions ou moins, seulement si elle dépasse le max actuel)</label>
    <div class="btn-row spread" style="margin-top:12px"><button class="btn ghost" data-p="0">Annuler</button><button class="btn primary" data-p="1">Importer</button></div>`, { wide:true });
  m.querySelector('[data-p="0"]').onclick = closeModal;
  m.querySelector('[data-p="1"]').onclick = () => {
    const upd = m.querySelector('#hip-max').checked; let nb = 0, nm = 0;
    m.querySelectorAll('select[data-i]').forEach(sel => { const sid = sel.value; if (!sid) return; const rows = people[+sel.dataset.i][1];
      setRes(n, sid, r => { r.hip = rows.map(a => ({ m:a[0], r:a[1], kg:a[2] })); nb++;
        if (upd) { const best = {};
          rows.forEach(a => { const [mid, reps, kg] = a; if (!machine(mid) || !kg || !reps || reps > BRZ_MAX_R) return; const v = Math.round(brzycki(kg, reps) * 10) / 10;
            if (!best[mid] || v > best[mid].v) best[mid] = { v, kg, r:reps }; });
          Object.entries(best).forEach(([mid, b]) => { const cur = maxVal(sid, mid, n); if (isPdc(mid) || (cur != null && b.v <= cur)) return;
            r.ex.push({ id:rnd(5), k:'max', m:mid, mode:'brz', kg:b.kg, r:b.r, v:b.v, src:'hip', ts:now(), sets:[], ob:{} }); nm++; }); } }); });
    save(); closeModal(); toast(`✓ Hippopogramme : ${nb} élève(s) importé(s)${upd ? ` · ${nm} max mis à jour` : ''}`, 4000); render(); };
}
const hipLine = h => `🦛 <b>${esc(mName(h.m))}</b> ${h.r} × ${fmtKg(h.kg)}`;

/* Vues d'échange côté tablette */
function viewSend(){
  const { count } = buildMine();
  return `<div class="card strong center"><b style="font-size:20px">${count} fiche(s) d'élève saisie(s) sur cette tablette (leçon ${curLesson()})</b></div>
    <div id="qr-area" class="center">Préparation…</div>
    <div class="btn-row" style="justify-content:center;margin-top:12px"><button class="btn" data-action="fileMine">📤 Partager en fichier (AirDrop…) à la place</button></div>`;
}
async function afterSend(){
  const payload = await encodePacket(buildMine().pkt);
  const area = $('#qr-area'); if (!area) return;
  showQRSeries(chunkQR(payload, 'R', 300), area, '');
}
function viewReceive(){
  return `<div class="card strong center"><b style="font-size:20px">📷 Scanne le QR de la leçon affiché par l'enseignant</b></div>
    <div id="scan-area"></div>
    <div class="btn-row" style="justify-content:center;margin-top:12px"><label class="btn">📂 Importer un fichier (.json)<input type="file" id="file-sync" accept=".json,application/json" hidden></label></div>`;
}
function afterReceive(){ startScan($('#scan-area'), ['S'], async p => applyPacket(p)); }
function afterProf(){
  if (UI.profTab === 'groupes') bindGroups();
  if (UI.profTab === 'qr') (async () => { const area = $('#qr-seance'); const payload = await encodePacket(buildSeance(curLesson()));
    if (area && UI.profTab === 'qr' && UI.view === 'prof') showQRSeries(chunkQR(payload, 'S', QR_CHUNK), area, `Leçon ${curLesson()} · ${esc(className())}`); })();
  if (UI.profTab === 'recup') startScan($('#scan-area'), ['R','H'], async p => { const r = await applyPacket(p);
    if (p.k === 'res') { UI.lastRecv = { ids: Object.keys(p.R?.[curLesson()] || {}), ts: now(), cid: S.id, from: p.from }; const w = $('#wait-box'); if (w) w.innerHTML = waitList(); return 'continue'; }
    return r; });
}
async function importSyncFile(file){
  try {
    const obj = JSON.parse(await file.text());
    if (obj.k) await applyPacket(obj);
    else if (obj.classes) {
      if (!(await confirmBox('Restaurer la sauvegarde ?', 'Toutes les classes de cet appareil seront remplacées.', 'Restaurer', true))) return;
      const dev = ROOT.deviceId; ROOT = obj; ROOT.deviceId = dev; loadRootFix(); save(); toast('✓ Sauvegarde restaurée'); go('home');
    } else throw new Error('Fichier non reconnu');
    render();
  } catch(e){ toast('⚠️ ' + e.message, 3500); }
}
function loadRootFix(){ Object.values(ROOT.classes).forEach(normClass); if (!ROOT.piliers) ROOT.piliers = DEFAULT_PILIERS.map(p => ({ ...p, cr:[...p.cr] })); if (!ROOT.roles) ROOT.roles = DEFAULT_ROLES.map(r => ({ ...r })); if (!ROOT.mOff) ROOT.mOff = [];
  useClass(ROOT.classes[ROOT.active] ? ROOT.active : Object.keys(ROOT.classes)[0]); }
/* =====================================================================
   Cycle de démonstration complet : 12 leçons terminées, tous les thèmes
   ===================================================================== */
const DEMO_BASE = { dc:45, chest_press:50, butterfly:35, tirage_vertical:45, tirage_assis:45, rowing:40, dorso:30, shoulder:30, deltoides:20, biceps_curl:20,
  presse:120, squat:70, legcurl:45, ischios:35, pompes:20, dips:10, tractions:5, abdos:30, chaise_romaine:12 };
const DEMO_COACH = {
  surp:['aff',['presse','tirage_vertical','chest_press'],'Perdre du poids sans avoir mal aux genoux, reprendre une activité régulière.','L\'endurance et la dépense d\'énergie, sans impact sur les genoux : vélo, elliptique, charges légères.','Garder 2 à 3 séances par semaine, marcher, éviter les régimes : manger équilibré.'],
  pomp:['p66',['tirage_vertical','tractions','dips'],'Réussir des tractions pour le concours de pompier.','Le dos (grand dorsal) et les bras, avec des exercices proches de la traction.','Faire des tractions assistées ou négatives deux fois par semaine.'],
  nage:['p64',['tirage_vertical','dips','tirage_assis'],'Être plus rapide sur 100 m brasse, surtout avec les bras.','La puissance des bras et du dos : tirages et poussées rapides.','Garder des séances courtes et explosives, ne pas tout faire la veille de l\'épreuve.'],
  dos:['ton',['dorso','abdos','tirage_assis'],'Ne pas avoir mal au dos comme ses parents.','Le gainage : lombaires ET abdominaux (antagonistes), avec des charges légères.','Bouger tous les jours, bien se placer quand on porte une charge.'],
  bad:['p66',['shoulder','tirage_vertical','biceps_curl'],'Frapper plus fort au badminton.','La vitesse du bras : épaules, dos, avec une exécution rapide.','Travailler vite mais avec une charge maîtrisée, s\'échauffer les épaules.'],
  plag:['vol',['dc','chest_press','tirage_vertical','rowing'],'Avoir un dos large et des épaules pour le concours de plage.','Le haut du corps : pectoraux et dos en volume.','Être régulier, bien manger et bien dormir pour que les muscles grossissent.'],
  foot:['p64',['presse','legcurl','squat'],'Frapper plus fort dans le ballon.','La puissance des cuisses (quadriceps) et le gainage.','Garder la technique de frappe, ajouter des sauts et des sprints.'],
  rugb:['p66',['presse','dorso','rowing'],'Pousser plus fort en mêlée sans se faire mal au dos.','Jambes et dos en puissance, gainage.','Toujours le dos plat sous la charge, travailler le gainage.'],
  esca:['ton',['tirage_vertical','tirage_assis','biceps_curl'],'Tenir plus longtemps accrochée sans prendre de volume.','L\'endurance de force du dos et des bras : séries longues, charge légère.','Grimper souvent, étirer les avant-bras.'],
  danse:['ton',['legcurl','abdos','chaise_romaine'],'Être plus tonique dans les sauts et les réceptions.','Le gainage et les jambes en tonification.','Gainer tous les jours, travailler les réceptions.'],
  ski:['ton',['presse','legcurl','ischios'],'Tenir une semaine de ski sans avoir les cuisses en feu.','L\'endurance de force des cuisses.','Commencer 6 semaines avant, ajouter du vélo.'],
  abdo:['vol',['abdos','chaise_romaine','dorso','tirage_assis'],'Avoir des abdos dessinés sans mal au dos.','Les abdos ET les lombaires, moins de répétitions mais mieux faites.','Les abdos se voient si le ventre est sec : alimentation et cardio.'],
  hand:['p64',['shoulder','chest_press','tirage_vertical'],'Tirer plus vite sans se blesser l\'épaule.','La puissance des épaules et des pectoraux, l\'équilibre avec le dos.','Échauffer longuement l\'épaule avant chaque match.'],
  sac:['ton',['rowing','tirage_assis','dorso'],'Se redresser et avoir le dos moins douloureux.','Le haut du dos et les lombaires.','Alléger le sac, le porter sur les deux épaules, lever les yeux du téléphone.'],
  cycl:['aff',['presse','legcurl','tirage_assis'],'Tenir dans les côtes et affiner les cuisses.','L\'endurance des jambes avec des séries longues et du vélo.','Rouler plus souvent, même moins longtemps.'],
};
function makeDemoFull(){
  const names = [['MARTIN','Léa'],['BERNARD','Hugo'],['DUBOIS','Chloé'],['THOMAS','Lucas'],['ROBERT','Inès'],['RICHARD','Tom'],['PETIT','Jade'],['DURAND','Nathan'],
    ['LEROY','Emma'],['MOREAU','Louis'],['SIMON','Manon'],['LAURENT','Enzo'],['LEFEBVRE','Lina'],['MICHEL','Théo'],['GARCIA','Zoé'],['DAVID','Noah'],['BERTRAND','Camille'],['ROUX','Adam'],['VINCENT','Sarah'],['FOURNIER','Yanis']];
  const old = Object.values(ROOT.classes).find(c => c.settings.className === 'Démo cycle complet'); if (old) delete ROOT.classes[old.id];
  const c = newClassState('Démo cycle complet'); ROOT.classes[c.id] = c; useClass(c.id);
  const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1)), pick = a => a[Math.floor(Math.random() * a.length)], cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
  S.settings.nbLessons = 12; S.settings.nbGroups = 3;
  names.forEach((x, i) => S.students.push({ id:newStudentId(), nom:x[0], prenom:x[1], grp: Math.floor(i / 7) + 1 }));
  const C1 = { t:'circuit', nb:6, dur:30 }, C3 = { t:'3x3' };
  const plan = [['max',['plac'],'e',C1],['vol',['plac','ampl'],'e',C1],['pui',['comp'],'e',C3],['ton',['ampl','fati'],'e',C1],['aff',['fati'],'e',C3],['hippo',[],'e',C1],
    ['amax',['plac'],'e',C1],['evi',['plac','comp'],'e',C1],['coach',['comp'],'e',C1],['projet',['ampl'],'e',C1],['vol',['ampl','comp'],'e',C3],['evf',['plac','comp','secu'],'e',C1]];
  plan.forEach(([th, pil, suivi, wu], i) => { const L = lesson(i + 1); L.th = th; L.pil = [...pil]; L.suivi = suivi; L.wu = { ...wu }; });
  lesson(3).hs = ['butterfly']; lesson(10).hs = ['rowing']; lesson(12).crit = { comp:[0,2] };
  const st = S.students, P = {};
  st.forEach((s, i) => P[s.id] = { k: 0.7 + Math.random() * 0.6, sk: R(3, 6), mo: R(4, 8), mob: pick(MOB_IDS), part: st[i % 2 ? i - 1 : Math.min(i + 1, st.length - 1)].id });
  const trueMax = (sid, m, n) => { const b = DEMO_BASE[m]; if (!b) return null; const v = b * P[sid].k * (1 + 0.012 * n); return isPdc(m) ? Math.round(v) : v; };
  const MAXSET = [['dc','chest_press'],['tirage_vertical','rowing','tirage_assis'],['shoulder','deltoides'],['biceps_curl'],['presse','legcurl','ischios','squat'],['abdos','chaise_romaine'],['pompes','tractions','dips']];
  const rate = (n, sid, wf) => { const v = cl(Math.round(P[sid].sk + (n / 12) * 3 + R(-2, 2)), 0, 10); return wf ? [v, cl(Math.round(v / 2) + R(-1, 0), 0, 5)] : [v, null]; };
  const obsFill = (n, sid, E) => { const L = lesson(n), nb = L.suivi === 's' ? Math.max(1, (E.sets || []).length) : 1, wf = withFreq(E);
    E.ob = {}; E.fq = {}; E.oc = {}; const bin = isBin(E);
    lessonPils(n).forEach(pl => { const p = pl.id; E.ob[p] = []; E.fq[p] = []; E.oc[p] = [];
      for (let i = 0; i < nb; i++) { const base = cl(Math.round((P[sid].sk + (n / 12) * 3) / 2), 0, 5);
        const row = pl.cr.map(() => bin ? (Math.random() < base / 5 ? 1 : 0) : cl(base + R(-1, 1), 0, 5));
        E.oc[p][i] = row; E.ob[p][i] = critNote(row, bin); E.fq[p][i] = bin ? null : Math.round(avg(row)); } });
    E.bg = Array.from({ length: nb }, (_, i) => cl(R(4, 7) + Math.round(i * 3 / nb), 1, 10)); E.by = P[sid].part; };
  const addMax = (n, sid, r, m) => { const tm = trueMax(sid, m, n); if (tm == null || blockOf(n, sid, m)) return;
    let E; if (isPdc(m)) E = { id:rnd(5), k:'max', m, mode:'reps', r: Math.max(1, tm + R(-1, 1)), sets:[] };
    else if (Math.random() < .35) E = { id:rnd(5), k:'max', m, mode:'1rm', kg: r05(tm), r:1, sets:[] };
    else { const reps = R(4, 10), kg = r05(tm * (1.0278 - 0.0278 * reps)); E = { id:rnd(5), k:'max', m, mode:'brz', kg, r:reps, sets:[] }; }
    E.v = maxFromEntry(E); obsFill(n, sid, E); r.ex.push(E); };
  const addTh = (n, sid, r, mob, prefer) => { const M = MOB[mob];
    for (let i = 0; i < M.nbEx; i++) { const rule = slotRule(n, sid, r.ex);
      let cand = salleMachines().filter(m => m.k !== 'cardio' && !blockOf(n, sid, m.id) && rule.ok(m.g) && !r.ex.some(E => E.m === m.id));
      const pref = (prefer || []).filter(id => cand.some(m => m.id === id)); const withMax = cand.filter(m => maxVal(sid, m.id, n) != null);
      const m = pref.length ? pref[0] : (withMax.length ? pick(withMax) : cand.length ? pick(cand) : null)?.id; if (!m) break;
      const E = { id:rnd(5), k:'th', m, mob, sets:[], ts: now() }; r.ex.push(E);
      const t = target(n, sid, E); E.sets = Array.from({ length:t.s }, (_, j) => cl(t.r - (j >= t.s - 2 ? R(0, 2) : 0) - (Math.random() < .1 ? R(1, 3) : 0), 0, t.r));
      if (M.inter) E.it = { x: M.inter === 'endu' ? pick(ENDU) : pick(WU_EX).id, ok:true };
      obsFill(n, sid, E); } };
  const genWu = (W, sid, n) => W.t === '3x3' ? { t:'3x3', ok:true, p: pick(PDC_3x3.filter(id => !wuBlocked(n, sid, id))) || null, c: pick(WU_EX.filter(x => !wuBlocked(n, sid, x.id))).id, e: pick(ENDU.filter(id => !wuBlocked(n, sid, id))) || null }
    : { t:'circuit', ok:true, ex: shuffle(WU_EX.filter(x => !wuBlocked(n, sid, x.id))).slice(0, W.nb || 6).map(x => x.id) };
  const roles = shuffle(ROOT.roles);
  for (let n = 1; n <= 12; n++) {
    const L = lesson(n), th = L.th; S.results[n] = {};
    st.forEach((s, si) => {
      const sid = s.id;
      if (n > 1 && Math.random() < .04) { L.att[sid] = 'abs'; return; }
      if (n === 5 && si === 6) { L.att[sid] = 'disp'; return; }
      if ((n === 3 || n === 4) && si === 3) { L.att[sid] = 'inap'; L.z[sid] = ['geD','geG']; }
      const fo = cl(R(4, 9) + (Math.random() < .1 ? -3 : 0), 1, 10);
      const r = { ex:[], ts: now() - (13 - n) * 7 * 864e5 + si * 1000, d:'prof' };
      S.results[n][sid] = r;
      r.wu = th === 'coach' ? null : genWu(L.wu, sid, n);
      if (th === 'max') MAXSET.forEach(g => { const m = pick(g.filter(id => !blockOf(n, sid, id))); if (m) addMax(n, sid, r, m); });
      else if (th === 'amax') shuffle(maxedMachines(sid, n)).slice(0, 4).forEach(m => addMax(n, sid, r, m));
      else if (th === 'hippo') r.hip = shuffle(Object.keys(DEMO_BASE).filter(m => !isPdc(m) && !ROOT.mOff.includes(m))).slice(0, R(4, 6)).map(m => ({ m, r: R(6, 12), kg: Math.round(trueMax(sid, m, n) * 0.6 / 2.5) * 2.5 }));
      else if (th === 'coach') {
        const R0 = roles[si % roles.length], D = DEMO_COACH[R0.id] || ['ton',[],'',''], cob = P[sid].part;
        L.role[sid] = R0.id;
        r.coach = { c:R0.id, comp:D[2], trav:D[3], mob:D[0], cob, cons:D[4] };
        r.wu = genWu({ t: pick(['circuit','3x3']), nb:6 }, cob, n);
        D[1].forEach(m => { if (blockOf(n, sid, m)) return; const M = MOB[D[0]], mx = maxVal(cob, m, n);
          const E = { id:rnd(5), k:'coach', m, s:M.s, r: isPdc(m) && mx ? Math.max(1, Math.round(mx * M.pct / 100)) : M.r, kg: !isPdc(m) && mx ? r05(mx * M.pct / 100) : null, rest:M.rest, pct:M.pct, ts: now() };
          E.sets = Array.from({ length:E.s }, () => cl(E.r - R(0, 2), 0, E.r)); obsFill(n, sid, E); r.ex.push(E); });
        L.cn[sid] = { v: cl(r05(5 + Math.random() * 4.5), 0, 10), com: pick(['Programme cohérent avec la demande.','Bon choix de mobile, conseils à développer.','Exercices adaptés, charges bien calculées.','Échauffement trop court pour ce rôle.']) };
      } else {
        const mob = th === 'pui' ? pick(['p66','p64']) : ['projet','evi','evf'].includes(th) ? P[sid].mob : THEMES[th].mobs[0];
        r.mob = mob; if (mob === 'vol') r.ef = fo >= 6;
        const prefer = th === 'evf' && S.projects[sid] ? S.projects[sid].ms : null;
        addTh(n, sid, r, mob, prefer);
        if (hasInap(n, sid)) { const E = { id:rnd(5), k:'free', nm:'Gainage latéral', s:3, r:30, rest:60, sets:[30,30,25], ts: now() }; obsFill(n, sid, E); r.ex.push(E); }
        if (th === 'projet') S.projects[sid] = { mob, ms: r.ex.filter(E => E.k === 'th').map(E => E.m), ts: r.ts, d:'prof' };
        if (th === 'evi') { const ids = shuffle(['plac','ampl','comp','fati']).slice(0, R(1, 3)); L.evp[sid] = ids; L.ev[sid] = {}; ids.forEach(p => L.ev[sid][p] = cl(Math.round(P[sid].sk + 1 + R(-1, 2)), 1, 10)); }
        if (th === 'evf') { L.ev[sid] = {}; L.pil.forEach(p => L.ev[sid][p] = cl(Math.round(P[sid].sk + 3 + R(-1, 1)), 1, 10)); }
      }
      r.ex.forEach((E, k) => { E.ts = r.ts + k * 60000; });
    });
  }
  S.settings.current = 12;
}
/* =====================================================================
   Export Excel
   ===================================================================== */
function exportXlsx(){
  if (!window.XLSX) return toast('Bibliothèque Excel non chargée');
  const N = S.settings.nbLessons, list = sortedStudents(), id2 = s => [s.nom || '', s.prenom || s.disp || ''];
  const r1 = v => v == null || isNaN(v) ? '' : Math.round(v * 10) / 10;
  const book = XLSX.utils.book_new(), add = (rows, name, w) => { const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = rows[0].map((_, i) => ({ wch: (w && w[i]) || (i < 2 ? 16 : 14) })); XLSX.utils.book_append_sheet(book, ws, name); };
  const evL = evalLessons(), coL = []; for (let n = 1; n <= N; n++) if (thOf(n) === 'coach') coL.push(n);
  /* Synthèse */
  const h = ['Nom','Prénom','Groupe','Présent','Absent','Dispensé','Inapt. partielle','Borg moy. (ressenti)','Projet : mobile','Projet : machines',
    ...piliers().map(p => 'Pilier · ' + p.n), ...evL.map(n => `L${n} ${themeName(thOf(n))} /10`), ...coL.map(n => `L${n} Coach d'un jour /10`)];
  const syn = [h];
  list.forEach(s => { const c = { p:0, abs:0, disp:0, inap:0 }, fo = [], mo = [], pv = {};
    for (let n = 1; n <= N; n++) { const at = attOf(n, s.id); if (at) c[at]++; else if (res(n, s.id)) c.p++;
      fo.push(...(res(n, s.id)?.ex || []).flatMap(borgOf));
      const r = res(n, s.id); (r?.ex || []).forEach(E => Object.entries(E.ob || {}).forEach(([pid, a]) => { (pv[pid] = pv[pid] || []).push(...vals(a)); })); }
    const P = S.projects[s.id];
    syn.push([...id2(s), s.grp && nbGroups() > 1 ? groupName(s.grp) : '', c.p, c.abs, c.disp, c.inap, r1(avg(fo)), P ? MOB[P.mob]?.n || '' : '', P ? (P.ms || []).map(mName).join(', ') : '',
      ...piliers().map(p => r1(avg(pv[p.id] || []))), ...evL.map(n => evalNote(n, s.id) ?? ''), ...coL.map(n => lesson(n).cn[s.id]?.v ?? '')]); });
  add(syn, 'Synthèse');
  /* Max */
  const mxA = MACHINES.filter(m => list.some(s => maxHist(s.id, m.id).length));
  add([['Nom','Prénom', ...mxA.map(m => m.n + (m.k === 'pdc' ? ' (rép.)' : ' (kg)'))], ...list.map(s => [...id2(s), ...mxA.map(m => r1(maxVal(s.id, m.id, 99)))])], 'Max actuels');
  const mh = [['Nom','Prénom','Machine','Leçon','Mode','Charge (kg)','Répétitions','Max']];
  list.forEach(s => MACHINES.forEach(m => maxHist(s.id, m.id).forEach(x => mh.push([...id2(s), m.n, x.n, x.mode === 'brz' ? 'Brzycki' : x.mode === 'reps' ? 'Répétitions' : '1RM', x.kg ?? '', x.r ?? '', r1(x.v)]))));
  add(mh, 'Historique des max');
  /* Séances */
  let maxS = 6; Object.values(S.results).forEach(b => Object.values(b).forEach(r => (r.ex || []).forEach(E => { maxS = Math.max(maxS, (E.sets || []).length); })));
  const se = [['Nom','Prénom','Leçon','Thème','Mobile','Type','Exercice','Groupe musculaire','Séries','Rép. prévues','% du max','Charge proposée','Récup (s)',
    ...Array.from({length:maxS}, (_, i) => `Série ${i+1}`), 'Total rép.', ...piliers().map(p => p.n), ...piliers().map(p => p.n + ' · fréquence'), 'Borg', 'Observateur', 'Entre exercices']];
  list.forEach(s => { for (let n = 1; n <= N; n++) { const r = res(n, s.id); if (!r) continue;
    (r.ex || []).forEach(E => { const m = machine(E.m), t = E.k === 'max' ? null : target(n, s.id, E);
      se.push([...id2(s), n, themeName(thOf(n)), MOB[E.mob || mobOf(n, s.id)]?.n || '', { th:'Thème', max:'Prise de max', free:'Adapté', coach:'Coach' }[E.k], m ? m.n : E.nm || '', m ? GROUPS[m.g].n : '',
        t?.s ?? '', t?.r ?? (E.k === 'max' ? E.r ?? '' : ''), t?.pct ?? '', E.k === 'max' ? `max ${r1(E.v)}` : t?.zone?.t || '', t?.rest ?? '',
        ...Array.from({length:maxS}, (_, i) => E.sets?.[i] ?? ''), E.k === 'max' ? '' : repsDone(E), ...piliers().map(p => r1(obMean(E, p.id))), ...piliers().map(p => (f => f.length ? FREQ[Math.round(avg(f))] : '')(vals(E.fq?.[p.id]))), r1(avg(borgOf(E))), E.by ? (E.by === 'x' ? 'Enseignant' : nameOf(E.by)) : '', E.it?.x ? (wuEx(E.it.x)?.n || '') + (E.it.ok ? ' ✓' : '') : '']); });
    (r.hip || []).forEach(x => se.push([...id2(s), n, 'Hippopogramme', '', 'Hippopogramme', mName(x.m), GROUPS[machine(x.m)?.g]?.n || '', 1, x.r, '', x.kg, '', x.r])); } });
  add(se, 'Séances');
  /* Appel et échauffements */
  const ap = [['Nom','Prénom','Leçon','Thème','Statut','Zones (inaptitude)','Borg moy.','Échauffement','Exercices','Fait']];
  list.forEach(s => { for (let n = 1; n <= N; n++) { const r = res(n, s.id), at = attOf(n, s.id); if (!r && !at && !lesson(n).wb[s.id]) continue;
    ap.push([...id2(s), n, themeName(thOf(n)), at ? ATT[at].n : 'Présent', zonesOf(n, s.id).map(zoneName).join(', '), r1(borgMean(n, s.id)),
      r?.wu ? WU_TYPES[r.wu.t] || '' : '', wuTxt(r?.wu), r?.wu?.ok ? 'oui' : '']); } });
  add(ap, 'Appel & échauffement');
  /* Évaluations */
  if (evL.length) { const ev = [['Nom','Prénom','Leçon','Évaluation', ...piliers().map(p => p.n), 'Note /10']];
    evL.forEach(n => list.forEach(s => { const e = lesson(n).ev[s.id] || {}, ids = evalPils(n, s.id);
      ev.push([...id2(s), n, themeName(thOf(n)), ...piliers().map(p => ids.includes(p.id) ? e[p.id] ?? '' : ''), attOf(n, s.id) === 'abs' ? 'ABS' : attOf(n, s.id) === 'disp' ? 'DISP' : evalNote(n, s.id) ?? '']); }));
    add(ev, 'Évaluations'); }
  /* Coach d'un jour */
  if (coL.length) { const co = [['Nom','Prénom','Leçon','Rôle','Ce qu\'il comprend','Doit travailler sur','Mobile','Échauffement','Exercices','Conseils','Note /10','Commentaire']];
    coL.forEach(n => list.forEach(s => { const r = res(n, s.id) || {}, C = r.coach || {}, R = role(C.c || lesson(n).role[s.id]), cn = lesson(n).cn[s.id] || {};
      if (!R && !r.ex) return;
      co.push([...id2(s), n, R?.n || '', C.comp || '', C.trav || '', MOB[C.mob]?.n || '', (C.cob ? 'Cobaye : ' + nameOf(C.cob) + ' · ' : '') + (wuTxt(r.wu) || C.wu || ''), (r.ex || []).map(E => `${E.m ? mName(E.m) : E.nm} ${E.k === 'max' ? 'max ' + r1(E.v) : `${E.s}×${E.r}${E.kg ? ' ' + E.kg + ' kg' : ''}${E.rest ? ' récup ' + E.rest + ' s' : ''}`}`).join(' | '), C.cons || '', cn.v ?? '', cn.com || '']); }));
    add(co, 'Coach d\'un jour', [16,16,8,22,40,40,22,30,50,40,10,30]); }
  /* Leçons */
  const ls = [['Leçon','Thème','Piliers','Suivi','Échauffement','Machines HS']];
  for (let n = 1; n <= N; n++) { const L = lesson(n); ls.push([n, themeName(L.th), lessonPils(n).map(p => `${p.n} : ${p.cr.join(' · ')}`).join(' | '), L.suivi === 'e' ? 'Par exercice' : 'Série par série',
    WU_TYPES[L.wu.t] + (L.wu.t === 'circuit' ? ` (${L.wu.nb} × ${L.wu.dur} s)` : ''), L.hs.map(mName).join(', ')]); }
  add(ls, 'Leçons', [8,26,80,16,26,30]);
  XLSX.writeFile(book, `Musculation_${(S.settings.className || 'classe').replace(/[^\wÀ-ÿ-]+/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('✓ Fichier Excel créé');
}

/* =====================================================================
   Classe de démonstration
   ===================================================================== */
function makeDemo(){
  const names = [['MARTIN','Léa'],['BERNARD','Hugo'],['DUBOIS','Chloé'],['THOMAS','Lucas'],['ROBERT','Inès'],['RICHARD','Tom'],['PETIT','Jade'],['DURAND','Nathan'],
    ['LEROY','Emma'],['MOREAU','Louis'],['SIMON','Manon'],['LAURENT','Enzo'],['LEFEBVRE','Lina'],['MICHEL','Théo'],['GARCIA','Zoé'],['DAVID','Noah'],['BERTRAND','Camille'],['ROUX','Adam']];
  const old = Object.values(ROOT.classes).find(c => c.settings.className === 'Démo Muscu'); if (old) delete ROOT.classes[old.id];
  const c = newClassState('Démo Muscu'); ROOT.classes[c.id] = c; useClass(c.id);
  S.settings.nbLessons = 10; S.settings.current = 4; S.settings.nbGroups = 3;
  names.forEach((x, i) => S.students.push({ id:newStudentId(), nom:x[0], prenom:x[1], grp: i % 3 + 1 }));
  const plan = ['max','vol','pui','ton','aff','amax','evi','projet','coach','evf'];
  plan.forEach((th, i) => { const L = lesson(i + 1); L.th = th; L.pil = [['plac'],['plac','ampl'],['comp'],['ampl','fati'],['fati'],['plac'],['plac','comp'],['ampl'],['comp'],['plac','comp','secu']][i];
    L.suivi = 'e'; L.wu = i % 3 === 2 ? { t:'3x3' } : { t:'circuit', nb:6, dur:30 }; });
  const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1)), pick = a => a[Math.floor(Math.random() * a.length)];
  const base = { dc:[25,55], chest_press:[30,70], tirage_vertical:[30,60], presse:[80,180], legcurl:[25,60], shoulder:[15,40], biceps_curl:[10,30], pompes:[8,35], tractions:[1,12], rowing:[25,55], ischios:[20,45], abdos:[20,60] };
  const obsOf = si => S.students[si % 2 ? si - 1 : Math.min(si + 1, S.students.length - 1)].id;   // binômes 1-2, 3-4…
  S.students.forEach((s, si) => {
    const L1 = lesson(1); if (si === 5) L1.att[s.id] = 'abs';
    for (let n = 1; n <= 3; n++) { const L = lesson(n);
      if (L.att[s.id] === 'abs') continue;
      if (n === 2 && si === 3) { L.att[s.id] = 'inap'; L.z[s.id] = ['geD']; }
      S.results[n] = S.results[n] || {};
      const r = { ex:[], ts: now() - (4 - n) * 864e5, d:'prof', wu:{ t:L.wu.t, ok:true, ...(L.wu.t === 'circuit' ? { ex:['mc','cs','jj','po','ab','sq'] } : { p:'pompes', c:'jj', e:'velo' }) } };
      if (n === 1) Object.keys(base).filter(() => Math.random() < .6).forEach(mid => { const [a, b] = base[mid];
        if (isPdc(mid)) r.ex.push({ id:rnd(5), k:'max', m:mid, mode:'reps', r:R(a, b), v:0, sets:[], ob:{ plac:[R(4, 9)] } });
        else { const kg = r05(R(a, b) * .85), reps = R(3, 8); r.ex.push({ id:rnd(5), k:'max', m:mid, mode:'brz', kg, r:reps, sets:[], ob:{ plac:[R(4, 9)] } }); } });
      r.ex.forEach(E => { if (E.k === 'max') E.v = maxFromEntry(E); });
      S.results[n][s.id] = r;
      if (n === 2) { r.mob = 'vol'; const g1 = pick([['dc','chest_press'],['tirage_vertical','rowing']]), g2 = pick([['presse','legcurl'],['shoulder','biceps_curl']]);
        [...g1, ...g2].forEach(mid => { if (blockOf(2, s.id, mid)) return; r.ex.push({ id:rnd(5), k:'th', m:mid, mob:'vol', by: obsOf(si), sets:[10,10,R(8,10),R(6,10)], ob:{ plac:[R(4,10),R(4,10),R(4,10),R(4,10)], ampl:[R(3,9),R(3,9),R(3,9),R(3,9)] }, bg:[R(4,6),R(5,7),R(6,8),R(7,9)], fq:{ plac:[R(2,5),R(2,5),R(2,5),R(2,5)], ampl:[R(1,5),R(1,5),R(1,5),R(1,5)] } }); }); }
      if (n === 3) { r.mob = pick(['p66','p64']); ['dc','presse','tirage_vertical'].forEach(mid => { if (blockOf(3, s.id, mid)) return; const M = MOB[r.mob];
        r.ex.push({ id:rnd(5), k:'th', m:mid, mob:r.mob, by: obsOf(si), sets:Array.from({length:M.s}, () => R(M.r - 2, M.r)), bg:[R(6,9)], ob:{ comp:[R(3,10)] }, fq:{ comp:[R(1,5)] } }); }); }
    }
  });
  lesson(4).hs = ['butterfly'];
}

/* =====================================================================
   Actions (délégation d'événements)
   ===================================================================== */
const A = {
  ...A_ELEVE,
  go: d => go(d.view),
  openProf: () => openProf(),
  profTab: d => { UI.sel = null; UI.profTab = d.tab;
    if (PREDIR[d.tab]) { if (d.tab === 'saisieP') UI.filter = null; return go(PREDIR[d.tab]); }
    UI.view = 'prof'; render(); window.scrollTo(0,0); },
  toEleve: () => { ROOT.role = 'eleve'; UI.profUnlocked = false; UI.profTab = 'menu'; save(); go('home'); toast('🧒 Espace élève · retour enseignant : appui long sur le logo'); },
  appQR: () => { const m = modal(`<h2 class="center">📲 Accès à l'application</h2><div class="center"><img src="${appQRImg(12)}" alt="QR" style="width:min(80vw,460px);height:auto"></div>
      <p class="center app-url">${esc(appURL())}</p><div class="btn-row" style="justify-content:center"><button class="btn primary" data-close>Fermer</button></div>`, { wide:true });
    m.querySelector('[data-close]').onclick = closeModal; },
  setRole: d => {
    if (d.r === 'prof') return pinPad(() => { ROOT.role = 'prof'; UI.profUnlocked = true; UI.profTab = 'menu'; save(); go('prof'); });
    const doIt = () => { ROOT.role = 'eleve'; UI.profUnlocked = false; save(); go('home'); toast('🧒 Tablette élève'); };
    if (ROOT.role === 'prof') confirmBox('Passer en tablette élève ?', 'Les données restent sur la tablette. Pour revenir : appui long sur le logo + code.', 'Passer en élève').then(ok => ok && doIt()); else doIt(); },
  switchRole: () => pinPad(() => { ROOT.role = 'prof'; UI.profUnlocked = true; UI.profTab = 'menu'; save(); go('prof'); }, '🔒 Code enseignant · passer en tablette enseignant'),
  goSaisie: () => { UI.filter = null; go('saisie'); },
  pickGroup: d => { UI.filter = d.g === 'all' ? 'all' : d.g ? +d.g : null; go('saisie'); },
  entry: d => { if (d.sid) { if (S.curObs && S.curObs !== 'x' && S.curObs !== d.sid) { S.pairs = S.pairs || {}; S.pairs[S.curObs] = d.sid; save(); } UI.open = {}; UI.cur = {}; go('entry', { sid: d.sid }); } },
  suiviDetail: d => go('suiviDetail', { sid: d.sid }),
  selClass: d => { useClass(d.id); UI.filter = null; save(); render(); },
  addClass: () => { const name = ($('#new-class').value || '').trim(); if (!name) return toast('Nom de la classe ?');
    const c = newClassState(name); ROOT.classes[c.id] = c; useClass(c.id); save(); toast('✓ ' + name + ' créée'); render(); },
  delClass: async () => { if (Object.keys(ROOT.classes).length < 2) return;
    if (!(await confirmBox('Supprimer « ' + className() + ' » ?', 'Élèves, leçons et résultats de cette classe seront effacés de cet appareil.', 'Supprimer', true))) return;
    delete ROOT.classes[S.id]; useClass(Object.keys(ROOT.classes)[0]); save(); render(); },
  demoClass: async () => { const ch = await choiceBox('🧪 Classes de démonstration', '<b>Démo cycle complet</b> : 20 élèves, 3 groupes, 12 leçons terminées (tous les thèmes : max, volume, puissance, tonification, affinement, Hippopogramme, améliore tes max, évaluation intermédiaire, coach d\'un jour, projet, évaluation finale), notes et bilans remplis.<br><b>Démo en cours</b> : 18 élèves, leçons 1 à 3 saisies, leçon du jour : 4.',
      [{ label:'Démo cycle complet', value:'full', cls:'primary' }, { label:'Démo en cours (leçon 4)', value:'cur' }]);
    if (!ch) return; if (ch === 'full') makeDemoFull(); else makeDemo(); save(); toast('🧪 ' + className()); render(); },
  // prof : cycle
  setCurrent: d => { S.settings.current = +d.n; save(); render(); toast(`Leçon ${d.n} sélectionnée`); },
  nbLessons: d => { S.settings.nbLessons = Math.max(2, Math.min(30, S.settings.nbLessons + (+d.d))); if (S.settings.current > S.settings.nbLessons) S.settings.current = S.settings.nbLessons; save(); render(); },
  pilToggle: d => { const L = lesson(+d.n), mp = maxPils(+d.n);
    if (L.pil.includes(d.p)) L.pil = L.pil.filter(x => x !== d.p);
    else if (L.pil.length >= mp) { if (mp === 2) { L.pil = [L.pil[1], d.p]; toast('2 piliers maximum : le plus ancien est retiré'); } else return toast(mp + ' piliers maximum'); }
    else L.pil.push(d.p); save(); render(); },
  critToggle: d => { const L = lesson(+d.n), p = pilier(d.p); let k = L.crit[d.p]; if (!k || !k.length) k = p.cr.map((_, i) => i);
    const i = +d.i; k = k.includes(i) ? k.filter(x => x !== i) : [...k, i].sort();
    if (!k.length) return toast('Gardez au moins un critère'); L.crit[d.p] = k.length === p.cr.length ? [] : k; save(); render(); },
  pilReset: async () => { if (!(await confirmBox('Revenir aux observables proposés ?', 'Les noms et observables modifiés seront remplacés.', 'Rétablir', true))) return;
    ROOT.piliers = DEFAULT_PILIERS.map(p => ({ ...p, cr:[...p.cr] })); save(); render(); },
  mOff: d => { ROOT.mOff = ROOT.mOff.includes(d.id) ? ROOT.mOff.filter(x => x !== d.id) : [...ROOT.mOff, d.id]; save(); rerender(); },
  roleAdd: () => { ROOT.roles.push({ id:rnd(4), n:'Nouveau rôle', t:'' }); save(); render(); setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 50); },
  roleDel: async d => { const r = role(d.r); if (!r || !(await confirmBox('Supprimer « ' + esc(r.n) + ' » ?', '', 'Supprimer', true))) return; ROOT.roles = ROOT.roles.filter(x => x.id !== d.r); save(); render(); },
  roleReset: async () => { if (!(await confirmBox('Rôles proposés ?', 'La liste des rôles est remplacée par les 15 rôles proposés.', 'Rétablir', true))) return; ROOT.roles = DEFAULT_ROLES.map(r => ({ ...r })); save(); render(); },
  // prof : leçon du jour
  att: d => { const L = lesson(curLesson()); L.att[d.sid] = L.att[d.sid] === d.v ? undefined : d.v; if (!L.att[d.sid]) delete L.att[d.sid];
    if (L.att[d.sid] === 'inap' && !(L.z[d.sid] || []).length) { save(); return appelWellModal(d.sid); }
    if (L.att[d.sid] !== 'inap') delete L.z[d.sid]; save(); rerender(); },
  appelWell: d => appelWellModal(d.sid),
  hsToggle: d => { const L = lesson(curLesson()); L.hs = L.hs.includes(d.id) ? L.hs.filter(x => x !== d.id) : [...L.hs, d.id]; save(); rerender(); },
  drawAll: async () => { const n = curLesson(), L = lesson(n);
    if (Object.keys(L.role).length && !(await confirmBox('Refaire le tirage ?', 'Les rôles déjà attribués seront remplacés.', 'Tirer au sort'))) return;
    const pool = [...ROOT.roles].sort(() => Math.random() - .5); let i = 0; L.role = {};
    sortedStudents().filter(s => present(n, s.id)).sort(() => Math.random() - .5).forEach(s => { L.role[s.id] = pool[i % pool.length].id; i++; });
    save(); render(); toast('🎲 Rôles tirés au sort'); },
  drawClear: () => { lesson(curLesson()).role = {}; save(); render(); },
  fileSeance: () => downloadJSON(buildSeance(curLesson()), `Musculation_lecon${curLesson()}.json`),
  // évaluations / bilans
  evN: d => { UI.evN = +d.n; render(); },
  coN: d => { UI.coN = +d.n; render(); },
  bilN: d => { UI.bilN = +d.n; render(); },
  evpToggle: d => { const n = +d.n, L = lesson(n); let a = evalPils(n, d.sid).slice();
    if (a.includes(d.p)) { if (a.length <= 1) return toast('Au moins 1 pilier'); a = a.filter(x => x !== d.p); }
    else { if (a.length >= 3) return toast('3 piliers maximum'); a.push(d.p); }
    L.evp[d.sid] = a; save(); rerender(); },
  // échanges
  fileFull: () => downloadJSON({ k:'full', c:S }, `Musculation_${(className()).replace(/[^\wÀ-ÿ-]+/g, '_')}.json`),
  fileMine: () => downloadJSON(buildMine(true).pkt, `Musculation_saisies_${S.deviceId}.json`),
  // export / réglages
  exportXlsx: () => exportXlsx(),
  printFiches: () => printFiches(sortedStudents().map(s => s.id)),
  printFiche: d => printFiches([d.sid]),
  backup: () => downloadJSON(ROOT, `Musculation_sauvegarde_${new Date().toISOString().slice(0,10)}.json`),
  setPin: () => { const v = $('#new-pin').value.trim(); if (!/^\d{4}$/.test(v)) return toast('4 chiffres requis'); ROOT.pin = v; save(); $('#new-pin').value=''; toast('✓ Code modifié'); },
  clearResults: async () => { if (await confirmBox('Effacer tous les résultats ?', 'Séances, max, projets et notes seront supprimés (la liste et les leçons restent).', 'Effacer', true)) { S.results = {}; S.projects = {}; S.mx = {}; S.hist = {}; Object.values(S.lessons).forEach(L => { L.ev = {}; L.cn = {}; }); save(); render(); } },
  resetAll: async () => { if (await confirmBox('Effacer « ' + className() + ' » ?', 'Élèves, leçons et résultats de cette classe repartent à zéro.', 'Tout effacer', true)) {
    const c = newClassState(className(), S.id); ROOT.classes[S.id] = c; useClass(c.id); save(); go('home'); } },
  // élèves / groupes
  addStudent: () => { const nom = $('#add-nom').value.trim(), pre = $('#add-prenom').value.trim();
    if (!pre) return toast('Indiquez au moins le prénom');
    S.students.push({ id:newStudentId(), nom: nom.toUpperCase(), prenom: capName(pre), grp:0 }); save(); render(); toast('✓ ' + capName(pre) + ' ajouté(e)'); },
  delStudent: async d => { if (await confirmBox('Retirer ' + nameOf(d.sid) + ' ?', 'Ses résultats n\'apparaîtront plus.', 'Retirer', true)) { S.students = S.students.filter(s => s.id !== d.sid); save(); render(); } },
  clearStudents: async () => { if (await confirmBox('Vider la liste ?', 'Tous les élèves et leurs résultats seront supprimés de cet appareil.', 'Vider', true)) { S.students = []; S.results = {}; S.projects = {}; S.mx = {}; save(); render(); } },
  dropSel: d => { if (!UI.sel) return; moveToGroup(UI.sel, +d.zone || 0); save(); UI.sel = null; render(); },
  clearGroups: () => { S.students.forEach(s => s.grp = 0); save(); render(); },
  setGroups: d => { S.settings.nbGroups = +d.n; S.students.forEach(s => { if (s.grp > +d.n) s.grp = 0; }); UI.filter = null; save(); render(); },
  groupColor: d => { S.settings.groupColors[+d.g - 1] = d.c; save(); render(); },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = A[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el.dataset, el); }
});
document.addEventListener('change', e => {
  const t = e.target, d = t.dataset;
  if (t.id === 'file-students' && t.files[0]) { importStudentsFile(t.files[0]); t.value=''; return; }
  if ((t.id === 'file-sync' || t.id === 'file-restore') && t.files[0]) { importSyncFile(t.files[0]); t.value=''; return; }
  const f = d.field; if (!f) return;
  if (f === 'className') { S.settings.className = t.value.trim() || 'Classe'; save(); render(); }
  if (f === 'th') { const L = lesson(d.n); L.th = t.value; if (L.th !== 'evf') { L.pil = L.pil.filter(id => !pilier(id)?.secu).slice(0, 2); } save(); render(); }
  if (f === 'suivi') { lesson(d.n).suivi = t.value === 'e' ? 'e' : 's'; save(); }
  if (f === 'wuT') { const L = lesson(d.n); L.wu = { t:t.value, nb:L.wu.nb || 6, dur:L.wu.dur || 30 }; save(); render(); }
  if (f === 'wuNb') { lesson(d.n).wu.nb = +t.value; save(); }
  if (f === 'wuDur') { lesson(d.n).wu.dur = +t.value; save(); }
  if (f === 'pilName') { const p = pilier(d.p); if (p) { p.n = t.value.trim() || p.n; save(); } }
  if (f === 'pilCr') { const p = pilier(d.p); if (p) { p.cr[+d.i] = t.value.trim(); save(); } }
  if (f === 'roleName') { const r = role(d.r); if (r) { r.n = t.value.trim() || r.n; save(); } }
  if (f === 'roleTxt') { const r = role(d.r); if (r) { r.t = t.value.trim(); save(); } }
  if (f === 'roleOf') { const L = lesson(curLesson()); if (t.value) L.role[d.sid] = t.value; else delete L.role[d.sid]; save(); }
  if (f === 'evV') { const L = lesson(d.n); L.ev[d.sid] = L.ev[d.sid] || {}; L.ev[d.sid][d.p] = +t.value; save(); rerender(); }
  if (f === 'coachNote') { const L = lesson(d.n); L.cn[d.sid] = { ...(L.cn[d.sid] || {}), v:+t.value }; save(); rerender(); }
  if (f === 'coachCom') { const L = lesson(d.n); L.cn[d.sid] = { ...(L.cn[d.sid] || {}), com:t.value.trim() }; save(); }
  if (f === 'maxKg' || f === 'maxR') { const v = t.value === '' ? null : parseFloat(String(t.value).replace(',', '.'));
    updE(d.e, E => { if (f === 'maxKg') E.kg = v == null || isNaN(v) ? null : Math.max(0, Math.min(400, r05(v)));
      else E.r = v == null || isNaN(v) ? null : Math.max(1, Math.min(E.mode === 'brz' ? BRZ_MAX_R : 150, Math.round(v))); E.v = maxFromEntry(E); });
    if (f === 'maxR' && d && t.value && +t.value > BRZ_MAX_R && findE(curLesson(), UI.sid, d.e)?.mode === 'brz') toast(`Brzycki : ${BRZ_MAX_R} répétitions maximum`);
    flagSaved(); rerender(); return; }
  if (f === 'cf') { const v = t.value === '' ? null : parseFloat(String(t.value).replace(',', '.'));
    updE(d.e, E => { E[d.f] = v == null || isNaN(v) ? null : d.f === 'kg' ? r05(v) : Math.round(v); }); flagSaved(); rerender(); return; }
  if (f === 'exName') { updE(d.e, E => { E.nm = t.value.trim(); }); flagSaved(); }
  if (f === 'coachCob') { setRes(curLesson(), UI.sid, r => { r.coach = r.coach || {}; r.coach.cob = t.value || null; }); flagSaved(); rerender(); return; }
  if (f === 'coach') { setRes(curLesson(), UI.sid, r => { r.coach = r.coach || {}; r.coach[d.f] = t.value.trim(); }); flagSaved(); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.type === 'range') { const b = t.parentElement.querySelector('.ev-v, .rv'); if (b) { b.textContent = fmt(+t.value); if (b.classList.contains('ev-v') && t.max === '10' && t.min === '1') { b.style.background = scaleColor(+t.value); b.style.color = scaleText(+t.value); } } t.classList.remove('unset'); }
});

/* ---------------------------------------------------------------------
   Démarrage
   --------------------------------------------------------------------- */
loadRoot();
const verEl = document.getElementById('app-version'); if (verEl) verEl.textContent = 'Version ' + APP_VERSION;
(() => { const logo = document.querySelector('.tb-home'); if (!logo) return; let t = null, long = false;
  const start = () => { long = false; clearTimeout(t); t = setTimeout(() => { long = true; if (!isProfRole()) A.switchRole(); }, 2000); };
  const stop = () => clearTimeout(t);
  logo.addEventListener('pointerdown', start); ['pointerup','pointerleave','pointercancel'].forEach(e => logo.addEventListener(e, stop));
  logo.addEventListener('contextmenu', e => e.preventDefault());
  logo.addEventListener('click', e => { if (long) { e.stopPropagation(); e.preventDefault(); long = false; } }, true); })();
render();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller; let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloading) { reloading = true; location.reload(); } });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache:'none' })
    .then(reg => { reg.update(); setInterval(() => reg.update(), 30*60*1000); document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update(); }); }).catch(()=>{}));
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(()=>{});
