# Musculation – N'EPS numérique (CA5)

PWA de suivi des séances de musculation — Quentin Delisle. Même principe que l'appli Biathlon :
tablette enseignant ↔ tablettes élèves par QR codes, hors-ligne, données sur chaque appareil.

## Mise en ligne
Publier ce dossier sur GitHub Pages (HTTPS obligatoire pour la caméra). iPad : Safari → Partager → « Sur l'écran d'accueil ».
Mise à jour : changer `CACHE` dans `sw.js` pour forcer le rechargement des tablettes.

## Déroulement
1. **Préparer le cycle** (code 0000) : élèves (import Pronote), groupes (= tablettes), leçons (thème, 1 ou 2 piliers, suivi série ou exercice, échauffement), observables des piliers, machines de la salle, rôles « Coach d'un jour ».
2. **Leçon du jour** : appel (absent / dispensé / inaptitude partielle avec zones du corps, forme et motivation 1→10), machines HS, tirage des rôles, puis **📲 QR de la leçon**.
3. Tablettes élèves : **📷 Scanner la leçon** → l'observateur choisit l'élève, l'exercice, puis saisit les répétitions validées et les piliers sur la roue crantée (1 → 10).
4. Fin de leçon : **📤 Envoyer mes saisies** ; l'enseignant **📥 Récupérer les saisies** (tablettes élèves et Hippopogramme).
5. **Suivi et bilans** : fiches élèves (PDF), max de la classe, bilan par leçon, notes des évaluations, coach d'un jour, export Excel.

## Calculs
- Brzycki : 1RM = charge ÷ (1,0278 − 0,0278 × répétitions), de 2 à 15 répétitions.
- Pompes, tractions, dips, abdos, chaise romaine : max = nombre de répétitions ; répétitions de séance = % de ce max.
- Charge proposée par zone de 5 kg : 32 kg → « entre 30 et 35 kg ».
- Volume 4×10 à 75 % (en forme) ou 70 % · Puissance 6×6 à 80 % ou 6×4 à 90 % · Tonification 5×15 à 60 % · Affinement 5×20 à 50 % (+ 6 min cardio / endurance entre les exercices).

## Hippopogramme
Dans Hippopogramme : **📲 QR Musculation** ; dans Musculation : 📥 Récupérer les saisies, puis associer chaque nom à un élève.
