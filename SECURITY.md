# Politique de sécurité

## Signaler une vulnérabilité

**Ne pas ouvrir d'issue publique.** Une vulnérabilité de sécurité doit être
signalée en privé, avec :

- une description du problème et de son impact (quelle donnée, quelle
  commune, quel rôle est exposé) ;
- les étapes de reproduction, ou une preuve de concept minimale ;
- la version ou le commit concerné.

Un accusé de réception est visé sous 5 jours ouvrés. Le correctif suit la
gravité du constat (cf. « Critère de qualification » ci-dessous) — critique
et élevé traités en priorité, avec coordination sur la date de divulgation
publique une fois le correctif disponible.

En l'absence de programme de _bug bounty_, aucune contrepartie financière
n'est proposée. Un remerciement nominatif dans le changelog est proposé au
rapporteur, sur accord.

## Périmètre couvert

- Isolation des données entre communes (fuite d'une commune vers une autre,
  contournement du rôle contextualisé).
- Élévation de privilèges (rédacteur → admin, admin d'une commune → admin
  d'une autre commune, accès anonyme à une écriture protégée).
- Contournement du journal d'audit (action sensible non tracée, ou tracée
  avec un auteur/une commune incorrects).
- Exécution de code, injection (SQL, XSS stocké via un champ éditorial ou un
  fichier déposé), SSRF, CSRF.
- Politique de fichiers : type de fichier accepté au-delà de ce que documente
  le [README](README.md#politique-de-fichiers), accès en écriture ou en
  listing anonyme au stockage objet.
- Exposition réseau au-delà de ce que documente le déploiement de référence
  (`docker-compose.yml`) — un port interne atteignable depuis l'extérieur.

Hors périmètre en v0.1 (limites documentées et assumées, pas des
vulnérabilités) : absence d'URLs de fichiers signées (confidentialité par
obscurité de l'URL pour un média de brouillon), absence d'antivirus sur les
documents déposés, absence de limitation de débit avancée au-delà du
verrouillage de compte après échecs de connexion.

## Critère de qualification (durcissement vérifiable)

Aucun constat **critique** ou **élevé** ne doit rester non corrigé, ni
non couvert par une exception explicitement approuvée, justifiée par écrit et
bornée dans le temps. Les constats moyens et faibles sont triés et suivis,
sans bloquer une publication.

## Procédure de mise à jour

- Les dépendances npm sont auditées en continu (`npm audit
--audit-level=high` bloquant en CI) ; `dependabot.yml` propose les mises à
  jour de sécurité.
- Les images Docker déployées (application, PostgreSQL, MinIO, migration)
  sont épinglées par version ou par digest et scannées (Trivy) ; un
  rescan périodique est nécessaire même sans changement de code, une CVE
  pouvant être publiée après le build.
- `PAYLOAD_SECRET` et les mots de passe d'infrastructure
  (`POSTGRES_PASSWORD`, `S3_APP_PASSWORD`, `MINIO_ROOT_PASSWORD`) doivent
  être régénérés en cas de doute sur leur exposition (dépôt de secret par
  erreur, ancien collaborateur ayant eu accès à `.env`) — une rotation
  invalide toutes les sessions actives.

## Révocation des accès

- **Compte utilisateur** (rédacteur, admin communal, opérateur) : un
  opérateur supprime le compte depuis l'admin (_Utilisateurs_). La
  suppression est journalisée (auteur et action conservés dans le journal
  d'audit, y compris si le compte supprimé est journalisé après coup).
- **Opérateur quittant l'organisation hébergeuse** : supprimer son compte
  immédiatement — un opérateur a accès à toutes les communes. Vérifier
  qu'au moins un autre opérateur reste actif avant la suppression.
- **Accès infrastructure** (SSH serveur, identifiants MinIO/PostgreSQL,
  `.env` de production) : révoquer et régénérer les secrets concernés dès
  qu'une personne ayant eu cet accès quitte l'organisation ou le prestataire
  — la rotation d'un secret d'infrastructure ne se déduit pas de la
  suppression d'un compte applicatif, ce sont deux mécanismes distincts.
- **Session active** : la déconnexion d'un compte ne révoque pas les jetons
  déjà émis avant une rotation de `PAYLOAD_SECRET` ; en cas de compromission
  avérée, la rotation du secret est le seul moyen d'invalider toutes les
  sessions existantes.
