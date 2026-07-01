// Fonction pour attendre un élément
function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const intervalTime = 100;
        let timeSpent = 0;
        const interval = setInterval(() => {
            const el = document.querySelector(selector);
            if (el && el.innerText.trim() !== "") {
                clearInterval(interval);
                resolve(el);
            }
            timeSpent += intervalTime;
            if (timeSpent >= timeout) {
                clearInterval(interval);
                reject(new Error("Timeout sur le sélecteur: " + selector));
            }
        }, intervalTime);
    });
}

// Fonction pour injecter la valeur dans Angular
function setAngularInputValue(inputElement, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    nativeInputValueSetter.call(inputElement, value);
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
}

// Nouvelle fonction principale
async function autoPriceSmart() {
    console.log("Démarrage du CSFloat Smart Auto-Pricer...");

    const itemsInQueue = Array.from(document.querySelectorAll('app-sell-queue-item'));
    if (itemsInQueue.length === 0) {
        console.warn("Aucun item dans la file.");
        return;
    }

    // 1. Groupement des objets par Nom + Wear
    // ex: "Glock-18 Printstream Factory New" -> [element1, element2, element3]
    const groupedItems = new Map();

    for (let item of itemsInQueue) {
        // Cibler les classes exactes trouvées dans tes logs précédents
        const nameElement = item.querySelector('.name'); // Contient le préfixe et le suffixe
        const wearElement = item.querySelector('.wear .abbreviation'); // Contient FN, MW, FT, etc.
        
        if (nameElement) {
            let fullName = nameElement.innerText.replace(/\s+/g, ' ').trim(); // Enlève les sauts de ligne
            // Si le wear est présent (ex: FN), on l'ajoute pour différencier
            if (wearElement) {
                 fullName += " " + wearElement.innerText;
            }

            if (!groupedItems.has(fullName)) {
                groupedItems.set(fullName, []);
            }
            groupedItems.get(fullName).push(item);
        }
    }

    console.log(`Trouvé ${groupedItems.size} types d'objets différents à évaluer.`);

    // 2. Traitement de chaque groupe
    for (let [itemName, itemsList] of groupedItems.entries()) {
        const myQuantityToSell = itemsList.length;
        console.log(`\nÉvaluation de: ${itemName} (Quantité à vendre: ${myQuantityToSell})`);

        try {
            // Prendre le premier item du groupe pour ouvrir les infos
            const firstItem = itemsList[0];
            const infoButton = firstItem.querySelector('button[mattooltip="Info"]');
            
            if (!infoButton) {
                console.warn(`Bouton info manquant pour ${itemName}`);
                continue;
            }

            // Cliquer pour ouvrir le Dialog
            infoButton.click();

            // Attendre le tableau des Buy Orders (on attend spécifiquement les lignes)
            const rowSelector = 'tbody tr.mat-mdc-row';
            await waitForElement(rowSelector);

            // Récupérer toutes les lignes de Buy Orders
            const buyOrderRows = document.querySelectorAll(rowSelector);
            let targetPrice = 0;
            let accumulatedQty = 0;

            // 3. Logique de calcul du prix basé sur l'offre et la demande
            for (let row of buyOrderRows) {
                const priceCell = row.querySelector('.mat-column-price');
                const qtyCell = row.querySelector('.mat-column-qty');

                if (priceCell && qtyCell) {
                    let price = parseFloat(priceCell.innerText.replace(/[^0-9.-]+/g, ""));
                    let qty = parseInt(qtyCell.innerText.replace(/[^0-9]+/g, ""), 10);

                    accumulatedQty += qty;
                    targetPrice = price; // On retient le prix de cette ligne

                    // Si on a trouvé assez d'acheteurs pour notre stock, on s'arrête de descendre dans le tableau
                    if (accumulatedQty >= myQuantityToSell) {
                        break; 
                    }
                }
            }

            console.log(`Prix calculé pour ${itemName}: ${targetPrice}$ (Acheteurs trouvés: ${accumulatedQty})`);

            // 4. Fermer le pop-up proprement en trouvant le bouton "Fermer" (la croix)
            // Dans Angular/Material, le Dialog se ferme souvent en cliquant à l'extérieur (le "backdrop")
            const backdrop = document.querySelector('.cdk-overlay-backdrop');
            if (backdrop) {
                backdrop.click();
            } else {
                // Plan B : simuler Echap
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            }

            // Pause stricte pour laisser le Dialog disparaître du DOM
            await new Promise(r => setTimeout(r, 400));

            // 5. Appliquer ce prix à TOUS les objets de ce groupe dans la queue
            for (let itemToUpdate of itemsList) {
                const inputField = itemToUpdate.querySelector('input[formcontrolname="price"]');
                if (inputField) {
                    setAngularInputValue(inputField, targetPrice);
                }
            }

            // Petite pause avant d'ouvrir le prochain type d'objet
            await new Promise(r => setTimeout(r, 200));

        } catch (error) {
            console.error(`Erreur lors du traitement de ${itemName}:`, error);
            // Sécurité de fermeture en cas de plantage
            const backdrop = document.querySelector('.cdk-overlay-backdrop');
            if (backdrop) backdrop.click();
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        }
    }

    console.log("\n✅ Tous les prix ont été optimisés et mis à jour !");
}

// ----------------------------------------------------
// UI : Ajout du bouton sur la page
// ----------------------------------------------------
const button = document.createElement("button");
button.innerText = "🧠 Smart Auto-Price";
button.style.position = "fixed";
button.style.bottom = "20px";
button.style.right = "20px";
button.style.zIndex = "9999";
button.style.padding = "15px 20px";
button.style.backgroundColor = "#EB4B4C"; // Rouge CSFloat pour le nouveau script
button.style.color = "white";
button.style.border = "none";
button.style.borderRadius = "8px";
button.style.fontWeight = "bold";
button.style.cursor = "pointer";
button.style.boxShadow = "0px 4px 6px rgba(0,0,0,0.3)";

button.addEventListener("click", () => {
    button.innerText = "⏳ Calcul en cours...";
    button.disabled = true;
    autoPriceSmart().then(() => {
        button.innerText = "✅ Terminé !";
        setTimeout(() => {
            button.innerText = "🧠 Smart Auto-Price";
            button.disabled = false;
        }, 3000);
    });
});

document.body.appendChild(button);
