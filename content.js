// --- 1. FONCTIONS UTILITAIRES ---

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

function waitForElementToDisappear(selector, timeout = 1000) {
    return new Promise((resolve) => {
        const intervalTime = 10;
        let timeSpent = 0;
        const interval = setInterval(() => {
            const el = document.querySelector(selector);
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

function forceCloseDialog() {
    const backdrop = document.querySelector('.cdk-overlay-backdrop');
    if (backdrop) {
        backdrop.click();
    } else {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }
}

function enableStealthMode() {
    if (document.getElementById('csfloat-stealth')) return;
    const style = document.createElement('style');
    style.id = 'csfloat-stealth';
    style.innerHTML = `
        .cdk-overlay-container, .cdk-overlay-backdrop {
            display: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
        }
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

// --- 2. LOGIQUE PRINCIPALE ---
async function autoPriceLightning() {
    const itemsInQueue = Array.from(document.querySelectorAll('app-sell-queue-item'));
    if (itemsInQueue.length === 0) return;

    enableStealthMode();

    try {
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

        for (let [itemName, itemsList] of groupedItems.entries()) {
            const myQuantityToSell = itemsList.length;

            try {
                forceCloseDialog();
                await waitForElementToDisappear('.cdk-overlay-backdrop', 500);

                const firstItem = itemsList[0];
                const infoButton = firstItem.querySelector('button[mattooltip="Info"]');
                if (!infoButton) continue;

                infoButton.click();

                const rowSelector = 'tbody tr.mat-mdc-row';
                await waitForElement(rowSelector, 2000); 
                
                let targetPrice = 0;
                let accumulatedQty = 0;
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

                forceCloseDialog();
                await waitForElementToDisappear('.cdk-overlay-backdrop', 1000);

                if (targetPrice > 0) {
                    for (let itemToUpdate of itemsList) {
                        const inputField = itemToUpdate.querySelector('input[formcontrolname="price"]');
                        if (inputField) setAngularInputValue(inputField, targetPrice);
                    }
                }
                await new Promise(r => setTimeout(r, 20)); 

            } catch (error) {
                forceCloseDialog();
            }
        }
    } finally {
        disableStealthMode();
    }
}

function injectTradeAllButton() {
    // On cible le conteneur où on veut ajouter le bouton
    const container = document.querySelector('app-my-trades-home .bar');
    
    if (container && !document.querySelector('.trade-all-btn')) {
        const btn = document.createElement("button");
        btn.innerText = "🚀 Trade All";
        btn.className = "mdc-button mat-mdc-button-base mdc-button--raised mat-mdc-raised-button mat-primary trade-all-btn";
        btn.style.marginLeft = "20px";
        btn.style.backgroundColor = "#FF4081"; // Couleur distincte pour bien voir
        
        btn.addEventListener("click", () => {
            // On récupère tous les boutons de trade de la page
            const tradeButtons = document.querySelectorAll('.trade-link');
            
            if (tradeButtons.length === 0) {
                alert("Aucun trade trouvé !");
                return;
            }

            // On boucle sur chaque bouton avec un léger délai pour éviter de saturer le navigateur
            tradeButtons.forEach((tradeBtn, index) => {
                setTimeout(() => {
                    tradeBtn.click();
                    console.log(`Trade #${index + 1} cliqué`);
                }, index * 300); // 300ms de délai entre chaque clic
            });
        });

        container.appendChild(btn);
    }
}

// Surveillance pour ré-injecter si l'interface change
const tradeObserver = new MutationObserver(injectTradeAllButton);
tradeObserver.observe(document.body, { childList: true, subtree: true });

// Lancement
setTimeout(injectTradeAllButton, 2000);

// --- INTERFACE : BOUTON INTELLIGENT ---
function checkAndCreateButton() {
    const isSellPage = window.location.href.includes('/sell');
    const existingButton = document.querySelector('.my-auto-price-btn');

    // Si on est sur la bonne page ET que le bouton n'existe pas encore
    if (isSellPage && !existingButton) {
        const button = document.createElement("button");
        button.innerText = "⚡ Flash Auto-Price";
        button.className = "my-auto-price-btn"; // Classe pour l'identifier
        
        // Styles
        button.style.position = "fixed";
        button.style.bottom = "20px";
        button.style.right = "20px";
        button.style.zIndex = "99999";
        button.style.padding = "15px 20px";
        button.style.backgroundColor = "#222222"; 
        button.style.color = "#00FF00"; 
        button.style.border = "2px solid #00FF00";
        button.style.borderRadius = "8px";
        button.style.fontWeight = "bold";
        button.style.cursor = "pointer";
        button.style.boxShadow = "0px 4px 15px rgba(0, 255, 0, 0.2)";

        button.addEventListener("click", async () => {
            button.innerText = "⏳ Hacking...";
            button.disabled = true;
            await autoPriceLightning();
            button.innerText = "✅ Done !";
            setTimeout(() => {
                button.innerText = "⚡ Flash Auto-Price";
                button.disabled = false;
            }, 1500);
        });

        document.body.appendChild(button);
    } 
    // Si on n'est PAS sur la page de vente, on supprime le bouton s'il existe
    else if (!isSellPage && existingButton) {
        existingButton.remove();
    }
}

// --- 3. LANCEMENT ET SURVEILLANCE ---

// On vérifie l'URL et la présence du bouton toutes les 500ms
// Remplace toute la fin de ton fichier par ceci :

let initializationTimer = null;

function safeInject() {
    // Annule la précédente demande d'injection (Debounce)
    if (initializationTimer) clearTimeout(initializationTimer);
    
    // Attend 500ms après la dernière modification du DOM pour injecter
    // Cela laisse le temps à l'autre extension de finir son travail
    initializationTimer = setTimeout(() => {
        checkAndCreateButton();
        injectTradeAllButton();
    }, 500);
}

// On observe les changements du DOM
const observer = new MutationObserver(safeInject);
observer.observe(document.body, { childList: true, subtree: true });

// Lancement initial
safeInject();