---
name: verifier-actualites
description: Vérifie le parcours public « Actualités » (liste → article → slug inconnu) sur un serveur local, avec un verdict binaire VERT/ROUGE. Use after any change touching src/app/(frontend)/actualites, src/components/Navigation.tsx, the frontend layout, the Actualites collection or the seed — and before declaring such a change done.
---

# Vérifier le parcours « Actualités »

Skill écrite en rejouant à la main, dans un navigateur, le parcours qu'elle décrit. Première brique d'une vérification par parcours : les tests e2e de `tests/e2e/` vérifient que les rubriques répondent 200, pas qu'on peut aller de la liste à un article.

## 1. Lancer la pile

- Postgres et MinIO tournent (`docker compose -f docker-compose.dev.yml up -d`) : `docker ps` pour s'en assurer.
- Serveur de dev **sur un port à soi** : `npm run dev -- --port 3011` (en arrière-plan). Attendre `/api/health` → 200.
- ⚠️ **Ne jamais réutiliser un serveur déjà ouvert sans savoir de quel dossier il sort.** Le 3000 peut être tenu par un autre worktree ou un autre projet : `lsof -a -p <pid> -d cwd` donne son dossier. Vérifier ce worktree-là ne dit rien de celui-ci.
- ⚠️ **Base à soi par worktree.** En dev, Payload aligne le schéma de la base sur celui de la branche lancée (« Pulling schema from database »), et plusieurs worktrees pointent sur la même base `pdlm`. Créer une base jetable (`createdb pdlm_<nom>_dev` dans le conteneur Postgres), la mettre dans le `.env` du worktree, puis `npx payload migrate` et `npm run seed`. `payload run` régénère `src/payload-types.ts` : `git checkout --` ce fichier s'il apparaît modifié.

## 2. Contrôles automatiques (le signal binaire)

```bash
python3 -I .claude/skills/verifier-actualites/verifier.py http://localhost:3011
```

Code retour 0 = VERT, 1 = ROUGE. Il contrôle :
- `/actualites` répond 200 et liste au moins une actualité ;
- le menu principal n'a **aucune entrée en double** ;
- chaque article de la liste répond 200, son `<h1>` reprend exactement le titre affiché dans la liste, son `<title>` commence par ce titre ;
- un slug inconnu répond **404** (pas 200 avec une page vide, pas 500).

**Fini = VERT.** Un échec se corrige dans le code, puis on relance : on ne déclare pas un travail terminé sur un ROUGE, et on n'assouplit pas un contrôle pour le faire passer sans le signaler dans la revue.

## 3. Contrôle visuel (navigateur piloté)

Le script ne voit pas le rendu. Une fois le VERT obtenu :
1. ouvrir `/actualites`, cliquer le premier article ;
2. ⚠️ la première visite d'une route **compile à la demande** (~1,5 s) : attendre que l'URL change avant de lire la page, sinon on relit la liste en croyant lire l'article ;
3. capture d'écran de l'article : titre, date, corps visibles, pied de page présent ;
4. `read_console_messages` avec `onlyErrors` : zéro erreur.

Échec visuel = décrire ce qu'on voit (capture à l'appui), pas ce qu'on suppose.

## Données

Le parcours repose sur la commune de démo **Saint-Exupéry-les-Bains** (`npm run seed`, `src/seed/contenu-demo.ts`) : 2 actualités publiées. Si la liste est vide, le seed n'a pas tourné : ce n'est pas un défaut du code.

## Historique

- **2026-10-21** : écrite ROUGE sur un point — « Documents » en double dans le menu (lien fixe de `Navigation.tsx` + même entrée dans le menu de la commune). Corrigé le jour même : `sansLiensFixes()` dans `Navigation.tsx` retire du menu communal les entrées simples qui redoublent un lien fixe (test : `tests/unit/navigation.spec.ts`). Le seed de `main` n'a plus ce doublon depuis `68e4336` : pour rejouer le cas, ajouter `{ label: 'Documents', url: '/documents' }` au menu de Saint-Exupéry dans une base jetable.
