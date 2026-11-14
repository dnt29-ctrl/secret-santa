# Le grand tirage de Noël 🎄

Un petit site statique, fait main et un peu kitsch, pour organiser le Secret Santa de Jade, Carla, Samia, Meven, Tristan, Eflamm et Camille.

## Mise en ligne

Dans le dépôt GitHub, ouvrez **Settings → Pages**, choisissez **Deploy from a branch**, sélectionnez `main` et le dossier `/ (root)`, puis cliquez sur **Save**.

## Utilisation

1. Ouvrez le site dans le navigateur qui servira à organiser le tirage.
2. Cliquez sur **Faire le tirage & préparer les liens**. Les sept liens secrets apparaissent ; copiez chacun et envoyez-le en privé à la bonne personne.
3. Gardez le **lien admin** affiché sur la page pour revenir à l’espace d’organisation dans le même navigateur.
4. Chaque participant ouvre son lien et clique sur le grand bouton pour révéler son destinataire.

Le tirage est conservé dans le stockage local du navigateur qui l'a créé. Le lien admin est un lien d'accès pratique, pas une authentification sécurisée. Pour refaire un tirage, revenez avec ce lien dans le navigateur d'origine et confirmez l'action : les anciens liens personnels ne seront alors plus valides. Ne partagez jamais le lien admin ni la liste des liens secrets dans le groupe.

Les liens personnels chiffrent le nom de la personne et son destinataire avec AES-GCM. La clé de déchiffrement se trouve dans le fragment (`#...`) du lien, qui n'est pas envoyé au serveur web. Envoyez le lien complet en privé.

## Règles

Personne ne se tire soi-même. Les couples Jade–Carla, Tristan–Eflamm et Samia–Meven ne se tirent pas l'un l'autre. Camille participe normalement ; chaque personne reçoit exactement un cadeau.
