# CSFloat Smart Auto-Pricer 🚀

Une extension légère pour automatiser et optimiser tes ventes sur CSFloat.

## 🛠️ Installation

1. Télécharge la dernière version dans l'onglet **Releases** à droite.
2. Extrais le fichier `.zip` dans un dossier sur ton ordinateur.

### 🦊 Pour Firefox
1. Tape `about:debugging#/runtime/this-firefox` dans ta barre d'adresse.
2. Clique sur **Charger un module temporaire...**
3. Sélectionne le fichier `manifest.json` dans le dossier extrait.
> *Note : Les extensions temporaires sur Firefox sont supprimées à la fermeture du navigateur.*

### 🦁 Pour Brave / Chrome
1. Tape `brave://extensions/` (ou `chrome://extensions/`) dans ta barre d'adresse.
2. Active le **Mode développeur** en haut à droite.
3. Clique sur **Charger l'extension non empaquetée**.
4. Sélectionne le dossier que tu as extrait.

---

## ⚡ Fonctionnalités

* **⚡ Flash Auto-Price** : Active-toi sur la page `/sell`. Le script détecte tes items, consulte les Buy Orders en temps réel sans clignotement visuel, et remplit tes prix automatiquement.
* **🚀 Trade All** : Active-toi sur la page `/trades`. Un bouton global te permet d'accepter tous tes trades en attente en un seul clic avec un délai de sécurité automatique.

---

## ⚙️ Stealth Mode
L'extension utilise une injection CSS pour masquer les fenêtres de dialogue d'Angular (`.cdk-overlay-container`). Cela permet de garder ton interface propre pendant que le script travaille en arrière-plan.

*Développé avec passion pour la communauté CSFloat.*
