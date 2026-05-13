# LexChain Pro — Données pour rapport technique

Ce document sert de source structurée pour la rédaction d’un rapport final au format LaTeX. Les titres, définitions et descriptions logiques sont pensés pour être repris par un autre outil de génération (y compris IA) tout en restant alignés sur le code du dépôt **LexChain Pro**.

---

## 1. Vue d’ensemble du projet

### 1.1 Définition de LexChain

**LexChain Pro** est une application décentralisée (dApp) orientée vers la gestion et la traçabilité de preuves numériques dans un cadre judiciaire ou institutionnel. Le système associe :

- le **stockage décentralisé** du fichier média sur **IPFS** (via **Pinata**) ;
- l’**ancrage sur une blockchain** (contrat intelligent Solidity) des **métadonnées** identifiant la preuve : identifiant de contenu IPFS (*CID*), empreinte cryptographique du fichier (*hash*), numéro de dossier, auteur de la soumission et horodatage.

L’objectif est de fournir une **chaîne de confiance** : la preuve reste consultable via son CID IPFS, tandis que le contrat garantit **qui** a enregistré quoi, **quand**, et sous quel **rôle**, sans permettre la modification des enregistrements existants pour un même identifiant de contenu.

### 1.2 Rôle dans le système judiciaire (contexte d’usage)

Dans un contexte judiciaire, LexChain ne remplace pas une procédure légale ni une qualification juridique des preuves. Il apporte plutôt :

- une **preuve technique d’intégrité** (liaison fichier ↔ hash ↔ enregistrement on-chain) ;
- une **séparation des responsabilités** via des rôles (administration, saisie par les forces habilitées, consultation par le magistrat) ;
- une **limitation de la divulgation** des métadonnées détaillées aux seuls comptes autorisés (juges et administrateurs) pour la lecture contractuelle `getEvidence`.

---

## 2. Pile technique (Technical Stack)

### 2.1 Next.js (frontend)

Le frontend est développé avec **Next.js** (version **16.2.5** dans le projet), en **TypeScript**, avec le modèle **App Router** (`app/`). Il fournit :

- l’interface utilisateur (tableau de bord, formulaire de soumission, panneau d’administration) ;
- des **routes API** Next.js pour servir l’ABI du contrat et proxifier l’upload vers Pinata ;
- le rendu côté client pour l’intégration **MetaMask** (`"use client"`).

### 2.2 Solidity et OpenZeppelin

Le contrat `**LexChain.sol`** est écrit en **Solidity ^0.8.28** et hérite de `**AccessControl`** (OpenZeppelin **^5.6.1**). Cela fournit la base du **contrôle d’accès par rôles** (`grantRole`, `revokeRole`, `hasRole`, etc.) et le rôle natif `**DEFAULT_ADMIN_ROLE`**.

### 2.3 Hardhat

**Hardhat** (version **^2.22.0**) est utilisé pour :

- compiler les contrats ;
- exécuter la suite de tests (`hardhat test`) ;
- déployer sur un réseau local (`hardhat node`, scripts de déploiement).

Le projet utilise le toolbox Hardhat pour les tests en JavaScript.

### 2.4 Ethers.js

Le frontend utilise **ethers.js** (version **^6.16.0**) pour :

- se connecter au fournisseur injecté (**MetaMask**) via `BrowserProvider` ;
- instancier le **contrat** avec l’ABI et l’adresse déployée ;
- signer les transactions (`connect(signer)`) pour `addEvidence`, attribution/révocation de rôles, etc.

### 2.5 Pinata et IPFS

**Pinata** est un service d’épinglage (*pinning*) sur **IPFS**. Le fichier est envoyé depuis le navigateur vers une route API Next.js (`/api/pinata-upload`), qui relaie le fichier vers Pinata avec un jeton d’authentification (**JWT**) configuré côté serveur (`PINATA_JWT`). Le retour fournit un **CID**, utilisé comme clé logique et lien vers une passerelle IPFS.

---

## 3. Architecture du contrat intelligent (Smart Contract Architecture)

### 3.1 Structure générale de `LexChain.sol`

Le contrat `**LexChain`** étend `**AccessControl**` et définit :


| Élément              | Description                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `POLICE_ROLE`        | Rôle identifié par `keccak256("POLICE_ROLE")` — droit de soumettre des preuves.                                           |
| `JUDGE_ROLE`         | Rôle identifié par `keccak256("JUDGE_ROLE")` — parmi les comptes autorisés à lire les détails via `getEvidence`.          |
| `DEFAULT_ADMIN_ROLE` | Rôle administrateur standard OpenZeppelin — octroyé au déployeur dans le constructeur ; permet de gérer les autres rôles. |
| `Evidence`           | Structure des métadonnées stockées par CID.                                                                               |
| `evidences`          | Mapping privé `string → Evidence`.                                                                                        |
| `EvidenceAdded`      | Événement émis à chaque nouvelle preuve enregistrée.                                                                      |


### 3.2 Logique RBAC (contrôle d’accès basé sur les rôles)

#### 3.2.1 Administrateur (`DEFAULT_ADMIN_ROLE`)

- Attribué au **déployeur** dans le constructeur (`_grantRole(DEFAULT_ADMIN_ROLE, msg.sender)`).
- Peut appeler les fonctions `**grantPoliceRole`** et `**grantJudgeRole**`, qui encapsulent `grantRole` pour les rôles métier.
- Peut utiliser les fonctions héritées `**grantRole**` et `**revokeRole**` d’**AccessControl** ; le frontend appelle `**revokeRole`** avec `POLICE_ROLE` ou `JUDGE_ROLE` pour révoquer les droits Police ou Juge.

#### 3.2.2 Police (`POLICE_ROLE`)

- Seuls les comptes dotés de `**POLICE_ROLE**` peuvent invoquer `**addEvidence**` (`onlyRole(POLICE_ROLE)`).

#### 3.2.3 Juge (`JUDGE_ROLE`)

- Les comptes avec `**JUDGE_ROLE**` sont habilités à la lecture détaillée via `**getEvidence**` (avec les administrateurs — voir section 4).

---

## 4. Fonctionnalités de sécurité (Security Features)

### 4.1 Garde d’immuabilité (Immutability Guard) — `require` sur le CID

Lors de `**addEvidence**`, avant toute écriture dans le mapping :

```text
require(bytes(evidences[_ipfsCID].ipfsCID).length == 0, "Evidence already exists");
```

**Effet :** si une entrée existe déjà pour ce `**_ipfsCID`**, la transaction **échoue** avec le message `**Evidence already exists`**. Aucune réécriture du `fileHash`, du numéro de dossier, de l’adresse `addedBy` ni du `timestamp` n’est possible pour ce CID après une première écriture réussie.

**Enjeu d’intégrité :** le CID IPFS sert de **clé primaire logique** ; empêcher la réutilisation de la même clé garantit que l’historique on-chain pour ce contenu ne peut pas être remplacé sous la même référence.

### 4.2 Accès restreint à la lecture — confidentialité pour `getEvidence`

La fonction `**getEvidence`** vérifie que l’appelant possède `**JUDGE_ROLE**` ou `**DEFAULT_ADMIN_ROLE**` via `**_isJudgeOrAdmin**`. Sinon, le contrat déclenche l’erreur personnalisée `**NotAuthorized()**`.

**Effet :** les métadonnées complètes retournées par le contrat ne sont pas exposées à un appel **public** anonyme ; seuls les comptes autorisés peuvent les obtenir avec `msg.sender` authentifié.

**Limite pour un rapport :** les événements `**EvidenceAdded`** restent visibles dans les journaux de transactions ; une confidentialité totale peut exiger des compléments (chiffrement hors chaîne, etc.).

---

## 5. Fonctions principales (Core Functions)

### 5.1 `addEvidence`

- **Signature :** `addEvidence(string _ipfsCID, string _fileHash, string _caseNumber)`
- **Modificateur :** `onlyRole(POLICE_ROLE)`
- **Comportement :**
  1. Garde d’immuabilité sur le CID.
  2. Enregistrement de `**Evidence`** dans `**evidences[_ipfsCID]**`.
  3. Émission de `**EvidenceAdded(ipfsCID, caseNumber, addedBy)**`.

### 5.2 `getEvidence`

- **Signature :** `getEvidence(string _ipfsCID) returns (Evidence memory)`
- **Visibilité :** `view`
- **Comportement :**
  1. Vérification `**_isJudgeOrAdmin(msg.sender)`** ; sinon `**NotAuthorized()**`.
  2. Retour de la structure `**Evidence**` pour le CID demandé.

### 5.3 `grantRole` (héritée d’AccessControl)

`**grantRole(bytes32 role, address account)**` — réservée aux administrateurs des rôles cibles. Le projet expose `**grantPoliceRole**` et `**grantJudgeRole**` avec `**onlyRole(DEFAULT_ADMIN_ROLE)**`.

### 5.4 `revokeRole` (héritée d’AccessControl)

`**revokeRole(bytes32 role, address account)**` — utilisée côté frontend pour retirer `**POLICE_ROLE**` ou `**JUDGE_ROLE**`.

### 5.5 Fonctions utilitaires

- `**grantPoliceRole(address)**` / `**grantJudgeRole(address)**`.

---

## 6. Logique frontend (Frontend Logic)

### 6.1 Connexion MetaMask

- Détection de `**window.ethereum**` (priorité MetaMask si plusieurs fournisseurs).
- `**BrowserProvider**` et `**eth_requestAccounts**`.
- Vérification du **Chain ID** (Hardhat local **31337** dans la configuration actuelle) ; `**wallet_switchEthereumChain`** / `**wallet_addEthereumChain**`.

### 6.2 Contrat et ABI

- Chargement de l’ABI via `**fetch("/api/contract")**`, instanciation `**new Contract(address, abi, provider)**`.

### 6.3 Rôles et affichage conditionnel

- `**hasRole**` pour admin / police / juge.
- Liste des preuves et appels `**getEvidence**` alignés sur **juge ou administrateur** (`canViewEvidence`).
- Transactions mutables avec `**signer`**.

### 6.4 Changement de compte (`accountsChanged`)

- Mise à jour de l’adresse, du réseau et **rafraîchissement des rôles** sans rechargement complet de la page.

---

## 7. Workflow — cycle de vie d’une preuve

1. **Configuration :** déploiement ; le déployeur reçoit `**DEFAULT_ADMIN_ROLE`**.
2. **Rôles :** l’administrateur accorde ou révoque `**POLICE_ROLE`** et `**JUDGE_ROLE**` (panneau admin).
3. **Upload :** un compte `**POLICE_ROLE`** envoie le fichier vers Pinata via l’API ; réception d’un **CID** ; hash calculé côté client.
4. **Ancrage :** transaction `**addEvidence(cid, hash, caseNumber)`** ; événement `**EvidenceAdded**`.
5. **Consultation :** compte **juge** ou **administrateur** interroge le registre (événements + `**getEvidence`**).

---

## 8. Schéma des données en chaîne (Database Schema — On-chain)

### 8.1 Structure `Evidence`


| Champ        | Type Solidity | Signification                           |
| ------------ | ------------- | --------------------------------------- |
| `ipfsCID`    | `string`      | CID IPFS ; clé du mapping.              |
| `fileHash`   | `string`      | Empreinte du fichier (ex. SHA-256 hex). |
| `caseNumber` | `string`      | Référence de dossier.                   |
| `addedBy`    | `address`     | Auteur de `addEvidence`.                |
| `timestamp`  | `uint256`     | Horodatage de bloc.                     |


### 8.2 Mapping `evidences`

- `**mapping(string => Evidence) private evidences**`
- Clé : `**ipfsCID**` (unicité logique renforcée par le `require` d’immuabilité).

### 8.3 Événement `EvidenceAdded`

- Paramètres : `**ipfsCID**`, `**caseNumber**`, `**addedBy**`.

---

## 9. Modélisation UML — Description détaillée des cas d’utilisation

*Cette section est rédigée pour permettre la génération de diagrammes de cas d’utilisation (acteurs, associations, contraintes) en LaTeX ou via un outil de modélisation.*

### 9.1 Liste canonique des acteurs


| Acteur                                  | Définition dans le système                                                                                                                    | Lien avec la blockchain / l’application                                                                                                                                                                                                                                   |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Administrateur (Admin)**              | Utilisateur dont l’adresse possède `**DEFAULT_ADMIN_ROLE*`* sur le contrat `LexChain`.                                                        | Octroi et révocation des rôles métier via **OpenZeppelin AccessControl** ; lecture autorisée de `**getEvidence`** ; même restriction UI que le juge pour le tableau de preuves détaillé.                                                                                  |
| **Officier de police (Police Officer)** | Utilisateur dont l’adresse possède `**POLICE_ROLE`** (et pas nécessairement les autres rôles).                                                | Seul acteur habilité à exécuter `**addEvidence**` on-chain ; peut uploader vers IPFS via l’application si le workflow UI est respecté.                                                                                                                                    |
| **Magistrat (Judge)**                   | Utilisateur dont l’adresse possède `**JUDGE_ROLE`**.                                                                                          | Habilité à appeler `**getEvidence**` et à consulter le registre détaillé dans l’UI ; ne peut pas soumettre de preuve sans `**POLICE_ROLE**`.                                                                                                                              |
| **Invité (Guest)**                      | Utilisateur sans portefeuille connecté, ou avec portefeuille connecté mais **sans** les rôles Admin, Police ni Juge pour l’action considérée. | Peut parcourir l’application dans la mesure où l’UI le permet ; **ne peut pas** soumettre de preuve on-chain sans `**POLICE_ROLE`** ; **ne peut pas** obtenir les métadonnées complètes via `**getEvidence`** ni voir le registre protégé dans l’UI telle qu’implémentée. |


### 9.2 Interactions par acteur (précision pour UML)

#### 9.2.1 Administrateur

- **Gérer les rôles (Manage Roles) :** interaction exclusive (côté politique métier) avec le **sous-système AccessControl** : appels `**grantPoliceRole`**, `**grantJudgeRole**`, et `**revokeRole(POLICE_ROLE|JUDGE_ROLE, address)**` depuis le frontend signé par l’admin. Précondition on-chain : `**onlyRole(DEFAULT_ADMIN_ROLE)**` pour les wrappers grant ; `**revokeRole**` suit les règles OpenZeppelin pour l’administrateur du rôle cible.
- **Consulter les preuves (View Evidence — registre détaillé) :** autorisé car `**getEvidence`** accepte `**DEFAULT_ADMIN_ROLE**` via `**_isJudgeOrAdmin**`. L’application masque la liste détaillée aux non-admin/non-juge.
- **Connexion réseau :** même flux que les autres acteurs (MetaMask, Chain ID 31337 en développement).

#### 9.2.2 Officier de police

- **Soumettre une preuve (Submit Evidence) :** **seul** cas d’utilisation d’écriture de preuve : sélection de fichier → hash local → upload Pinata → CID → transaction `**addEvidence(CID, hash, caseNumber)`** avec `**onlyRole(POLICE_ROLE)**`. Échec si l’adresse n’a pas le rôle Police.
- **Ne pas confondre avec la lecture judiciaire :** sans `**JUDGE_ROLE`** ni Admin, l’UI ne montre pas le registre détaillé comme pour un juge (alignement avec `**getEvidence**`).

#### 9.2.3 Magistrat

- **Consulter le registre de preuves (View Evidence Registry) :** lecture des enregistrements via `**getEvidence`** (après découverte des CID, p. ex. via événements `**EvidenceAdded**`) ; l’UI n’affiche la liste complète qu’aux comptes **Juge ou Admin**.
- **Aucune saisie de preuve** sans détention séparée de `**POLICE_ROLE`**.

#### 9.2.4 Invité

- **Parcourir l’application :** navigation générale possible ; messages invitant à connecter un portefeuille ou un compte **Juge/Admin** pour le tableau des preuves.
- **Tentative de lecture contractuelle :** un appel `**getEvidence`** depuis un portefeuille non autorisé provoque `**NotAuthorized()**` au niveau du contrat.

### 9.3 Contraintes résumées (pour notes de diagramme UML)

- **Manage Roles** → **Admin uniquement** (fonctions grant/revoke protégées par `**DEFAULT_ADMIN_ROLE`** ou équivalent OpenZeppelin).
- **Submit Evidence** → **Police uniquement** (`**onlyRole(POLICE_ROLE)`** sur `**addEvidence**`).
- **View Evidence (registre détaillé / `getEvidence`)** → **Judge ou Admin** (`**_isJudgeOrAdmin`**).

---

## 10. Modélisation UML — Flux de séquence détaillé (soumission de preuve numérique)

*Cette section décrit le parcours technique pas à pas pour un diagramme de séquence « Evidence Submission » aligné sur le code.*

### Étape 1 — Sélection du fichier et calcul local du hash

- **Acteur :** utilisateur disposant du rôle **Police** (côté métier) sur le portefeuille connecté.
- **Action :** dans le composant frontend de soumission, l’utilisateur choisit un fichier et saisit le **numéro de dossier** (`caseNumber`).
- **Traitement :** le navigateur lit le fichier en **ArrayBuffer**, calcule une empreinte **SHA-256** via `**crypto.subtle.digest*`*, encodée en chaîne hexadécimale préfixée (convention du projet : forme type `0x…`). Ce hash sert de `**fileHash**` pour l’ancrage contractuel.

### Étape 2 — Envoi du fichier vers l’API Pinata / IPFS et obtention du CID

- **Action :** le frontend construit un `**FormData`** contenant le fichier et envoie une requête **HTTP POST** à la route `**/api/pinata-upload`** (Next.js).
- **Traitement côté serveur :** la route transmet le fichier au service **Pinata** avec authentification (**JWT** serveur, variable d’environnement `**PINATA_JWT`**).
- **Réponse :** le service retourne un **CID IPFS** (identifiant de contenu). Ce CID devient `**_ipfsCID`** pour `**addEvidence**`.

### Étape 3 — Déclenchement de la transaction MetaMask `addEvidence`

- **Action :** le frontend obtient un `**signer`** ethers via le `**BrowserProvider**` connecté à MetaMask et appelle `**addEvidence(ipfsCID, fileHash, caseNumber)**` sur l’instance de contrat connectée au **signer**.
- **Traitement :** MetaMask affiche une demande de signature ; l’utilisateur confirme. La transaction est envoyée au **nœud JSON-RPC** (développement : **Hardhat** sur `localhost` ; production possible : autre fournisseur).

### Étape 4 — Vérification AccessControl (`POLICE_ROLE`)

- **Lieu :** contrat `**LexChain`**, fonction `**addEvidence**`, modificateur `**onlyRole(POLICE_ROLE)**`.
- **Résultat si échec :** revert OpenZeppelin `**AccessControlUnauthorizedAccount`** — la transaction n’est pas appliquée.
- **Résultat si succès :** le flux continue vers l’étape 5.

### Étape 5 — Garde d’immuabilité (Integrity Guard)

- **Lieu :** même fonction `**addEvidence`**, avant écriture dans le mapping.
- **Condition :** `**require(bytes(evidences[_ipfsCID].ipfsCID).length == 0, "Evidence already exists")`**.
- **Résultat si échec :** revert avec message `**Evidence already exists`** — aucune modification d’état pour ce CID.
- **Résultat si succès :** création de l’entrée `**Evidence`** dans `**evidences[_ipfsCID]**` et émission de `**EvidenceAdded**`.

### Étape 6 — Persistance blockchain et retour utilisateur

- **Blockchain :** le mineur/validateur du réseau (localement : nœud Hardhat) inclut la transaction dans un bloc ; l’état du contrat est mis à jour de façon durable.
- **Frontend :** attente du **receipt** (`tx.wait()`), affichage d’un message de succès et **rechargement** de la liste des preuves pour les comptes autorisés ; métadonnées d’affichage local (nom/type de fichier) éventuellement stockées en `**localStorage`** côté client (hors contrat).

---

## 11. Architecture technique — Vue en quatre couches

*Cette section formalise une architecture **4-tier** exploitable pour diagrammes de déploiement ou de composants en LaTeX. Les noms de couches correspondent à la demande de modélisation ; le détail d’implémentation reflète le dépôt actuel.*

### 11.1 Couche client (Client Layer)

- **Composants :** navigateur web, application **React** sous **Next.js**, extension **MetaMask**.
- **Responsabilités :** interface utilisateur ; calcul du hash fichier ; appels HTTP vers les routes API Next.js ; connexion `**BrowserProvider*`* ; signature des transactions ; écoute `**accountsChanged**` / `**chainChanged**` ; vérification `**hasRole**` pour l’UX ; affichage conditionnel du registre de preuves.

### 11.2 Couche passerelle (Gateway Layer)

- **Rôle :** exposer le **JSON-RPC Ethereum** au client via le fournisseur injecté.
- **Dans ce projet (développement) :** MetaMask envoie les transactions vers le **nœud Hardhat local** (`http://127.0.0.1:8545`, chain id **31337**). Il n’y a pas d’**Infura** obligatoire dans le dépôt ; en **production**, un service type **Infura**, **Alchemy** ou un nœud dédié jouerait le même rôle de **passerelle RPC** vers un réseau Ethereum (ou compatible).
- **Précision pour LaTeX :** nommer cette couche « **Ethereum JSON-RPC Provider** » ; citer **Hardhat** comme instance en développement et **Infura** comme exemple courant en production.

### 11.3 Couche stockage (Storage Layer — IPFS / Pinata)

- **Composants :** **Pinata** comme couche d’API au-dessus d’**IPFS** ; route `**/api/pinata-upload`** comme proxy serveur (clé secrète non exposée au navigateur).
- **Responsabilités :** stockage du **fichier binaire** ; retour du **CID** ; pas de stockage du fichier dans le contrat Solidity.

### 11.4 Couche blockchain (Blockchain Layer)

- **Composants :** réseau **Ethereum** (ou compatible EVM) ; contrat `**LexChain.sol`** déployé ; machine virtuelle **EVM** pour l’exécution.
- **Responsabilités :** persistance des **métadonnées** (`Evidence`), **RBAC** (AccessControl), **garde d’immuabilité**, **contrôle d’accès** à `**getEvidence`**, émission d’**événements**.

### 11.5 Flux inter-couches (résumé pour diagramme)

1. **Client** → (HTTPS) → **API Next.js** → **Pinata/IPFS** → CID vers **Client**.
2. **Client** → (JSON-RPC via MetaMask) → **Gateway** → **Blockchain** → exécution `**LexChain`**.
3. **Client** → lecture `**getEvidence`** / `**hasRole**` → **Gateway** → **Blockchain** uniquement pour l’état on-chain ; les fichiers restent dans **IPFS**.

---

## 12. Annexes utiles pour LaTeX

### 12.1 Versions des principaux composants (référence projet)


| Composant              | Version indicative |
| ---------------------- | ------------------ |
| Solidity               | ^0.8.28            |
| OpenZeppelin Contracts | ^5.6.1             |
| Hardhat                | ^2.22.0            |
| Next.js                | 16.2.5             |
| ethers.js              | ^6.16.0            |
| React                  | 19.2.4             |


### 12.2 Termes à indexer dans le rapport

LexChain, IPFS, Pinata, CID, RBAC, AccessControl, immutabilité, confidentialité, MetaMask, Hardhat, Next.js, ethers.js, JSON-RPC, EVM.

---

*Document destiné à la rédaction scientifique ou technique et à la génération automatisée de sections LaTeX — à valider par rapport au dépôt source avant publication.*