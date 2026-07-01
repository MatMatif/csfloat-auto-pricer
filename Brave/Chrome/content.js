// --- 1. FONCTIONS UTILITAIRES ULTRA-RAPIDES ---

// Attente de l'apparition (10ms)
function waitForElement(selector, timeout = 2000) {
    return new Promise((resolve, reject) => {
        const intervalTime = 10;
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
                reject(new Error("Timeout DOM"));
            }
        }, intervalTime);
    });
}

// Attente de la destruction (10ms) - Le secret anti-bug !
function waitForElementToDisappear(selector, timeout = 1000) {
    return new Promise((resolve) => {
        const intervalTime = 10;
        let timeSpent = 0;
        const interval = setInterval(() => {
            const el = document.querySelector(selector);
            // Dès que l'élément n'existe plus, on donne le feu vert
            if (!el) {
                clearInterval(interval);
                resolve();
            }
            timeSpent += intervalTime;
            if (timeSpent >= timeout) {
                clearInterval(interval);
                resolve(); 
            }
        }, intervalTime);
    });
}

function setAngularInputValue(inputElement, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    nativeInputValueSetter.call(inputElement, value);
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
}

// Fonction pour fermer proprement le pop-up Angular
function forceCloseDialog() {
    const backdrop = document.querySelector('.cdk-overlay-backdrop');
    if (backdrop) {
        backdrop.click(); // Clic natif sur le fond gris = Fermeture immédiate
    } else {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }
}

function enableStealthMode() {
    if (document.getElementById('csfloat-stealth')) return;
    const style = document.createElement('style');
    style.id = 'csfloat-stealth';
    
    // Ajout de "display: none" pour empêcher Angular de rendre le HTML visuel
    style.innerHTML = `
        .cdk-overlay-container, .cdk-overlay-backdrop {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
        }
        /* Bloque les animations de transition d'Angular */
        .mat-mdc-dialog-container {
            display: none !important;
            transition: none !important;
            animation: none !important;
        }
    `;
    document.head.appendChild(style);
}
function disableStealthMode() {
    const style = document.getElementById('csfloat-stealth');
    if (style) style.remove();
}

// --- 2. LOGIQUE PRINCIPALE HYPER-THREADÉE ---
async function autoPriceLightning() {
    const itemsInQueue = Array.from(document.querySelectorAll('app-sell-queue-item'));
    if (itemsInQueue.length === 0) {
        console.warn("Aucun item dans la file.");
        return;
    }

    enableStealthMode();
    console.log("⚡ Mode Éclair v2 Activé...");

    try {
        // 1. Groupement
        const groupedItems = new Map();
        for (let item of itemsInQueue) {
            const nameElement = item.querySelector('.name');
            const wearElement = item.querySelector('.wear .abbreviation');
            if (nameElement) {
                let fullName = nameElement.innerText.replace(/\s+/g, ' ').trim();
                if (wearElement) fullName += " " + wearElement.innerText;
                if (!groupedItems.has(fullName)) groupedItems.set(fullName, []);
                groupedItems.get(fullName).push(item);
            }
        }

        // 2. Traitement des groupes
        for (let [itemName, itemsList] of groupedItems.entries()) {
            const myQuantityToSell = itemsList.length;

            try {
                // SÉCURITÉ 1 : On nettoie le DOM de tout ancien pop-up bloqué avant de démarrer
                forceCloseDialog();
                await waitForElementToDisappear('.cdk-overlay-backdrop', 500);

                const firstItem = itemsList[0];
                const infoButton = firstItem.querySelector('button[mattooltip="Info"]');
                if (!infoButton) continue;

                // Clic pour charger les données
                infoButton.click();

                let targetPrice = 0;
                let accumulatedQty = 0;

                // Lecture rapide du tableau (timeout 2s)
                const rowSelector = 'tbody tr.mat-mdc-row';
                await waitForElement(rowSelector, 2000); 
                
                const buyOrderRows = document.querySelectorAll(rowSelector);
                for (let row of buyOrderRows) {
                    const priceCell = row.querySelector('.mat-column-price');
                    const qtyCell = row.querySelector('.mat-column-qty');
                    if (priceCell && qtyCell) {
                        let price = parseFloat(priceCell.innerText.replace(/[^0-9.-]+/g, ""));
                        let qty = parseInt(qtyCell.innerText.replace(/[^0-9]+/g, ""), 10);
                        
                        if (!isNaN(price) && !isNaN(qty)) {
                            accumulatedQty += qty;
                            targetPrice = price;
                            if (accumulatedQty >= myQuantityToSell) break; 
                        }
                    }
                }

                // SÉCURITÉ 2 : Fermeture chirurgicale immédiate
                forceCloseDialog();
                
                // SÉCURITÉ 3 : On gèle le script le temps que le pop-up disparaisse vraiment du HTML
                await waitForElementToDisappear('.cdk-overlay-backdrop', 1000);

                if (targetPrice > 0) {
                    for (let itemToUpdate of itemsList) {
                        const inputField = itemToUpdate.querySelector('input[formcontrolname="price"]');
                        if (inputField) setAngularInputValue(inputField, targetPrice);
                    }
                    console.log(`✅ ${itemName} -> ${targetPrice}$`);
                } else {
                    console.warn(`⚠️ Échec de calcul pour ${itemName}`);
                }

                // Micro-pause de respiration pour le CPU (20ms)
                await new Promise(r => setTimeout(r, 20)); 

            } catch (error) {
                console.error(`❌ Timeout sur ${itemName}:`, error.message);
                forceCloseDialog();
                await waitForElementToDisappear('.cdk-overlay-backdrop', 500);
            }
        }
    } finally {
        disableStealthMode();
        console.log("🏁 Cycle terminé.");
    }
}

// --- 3. INTERFACE ---
const button = document.createElement("button");
button.innerText = "⚡ Lightning Auto-Price";
button.style.position = "fixed";
button.style.bottom = "20px";
button.style.right = "20px";
button.style.zIndex = "9999";
button.style.padding = "15px 20px";
button.style.backgroundColor = "#FACC15"; 
button.style.color = "#000000"; 
button.style.border = "none";
button.style.borderRadius = "8px";
button.style.fontWeight = "bold";
button.style.cursor = "pointer";
button.style.boxShadow = "0px 4px 15px rgba(250, 204, 21, 0.4)";

button.addEventListener("click", () => {
    button.innerText = "⏳ Vroum...";
    button.disabled = true;
    autoPriceLightning().then(() => {
        button.innerText = "✅ Done !";
        setTimeout(() => {
            button.innerText = "⚡ Lightning Auto-Price";
            button.disabled = false;
        }, 1500);
    });
});

document.body.appendChild(button);