// --- 1. FONCTIONS UTILITAIRES ---

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function setAngularInputValue(inputElement, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    nativeInputValueSetter.call(inputElement, value);
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
}

// Attend qu'une fonction renvoie un élément (ou null au timeout)
async function waitFor(selectorFn, timeout = 2500) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const el = selectorFn();
        if (el) return el;
        await sleep(50);
    }
    return null;
}

// Premier élément dont le texte matche la regex
function findByText(root, selector, regex) {
    return Array.from(root.querySelectorAll(selector)).find(el => regex.test(el.textContent));
}

function closeAnyOverlay() {
    const backdrop = document.querySelector('.cdk-overlay-backdrop');
    if (backdrop) backdrop.click();
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

// NOUVEAU DOM : .wear (avec le float) est imbriqué DANS .name.
// On reconstruit le nom à partir de prefix + suffix + abréviation d'usure.
function getItemName(item) {
    const nameDiv = item.querySelector('app-item-name-row .name');
    if (!nameDiv) return null;
    const prefix = nameDiv.querySelector('.prefix')?.textContent.replace(/\s+/g, ' ').trim() || '';
    const suffix = nameDiv.querySelector('.suffix')?.textContent.replace(/\s+/g, ' ').trim() || '';
    const wear = nameDiv.querySelector('.wear .abbreviation')?.textContent.trim() || '';
    return [prefix, suffix, wear].filter(Boolean).join(' ');
}

// Le meilleur Buy Order est affiché directement dans chaque item de la queue :
//  - bandeau ".buy-order-notice" avec bouton ".buy-order-price" (ex: "$0.21")
//  - et/ou bouton ".instant-sale-info" dont l'aria-label contient le prix.
function getBuyOrderInfo(item) {
    const priceBtn = item.querySelector('.buy-order-notice .buy-order-price');
    if (priceBtn) {
        const price = parseFloat(priceBtn.textContent.replace(/[^0-9.]+/g, ''));
        if (!isNaN(price) && price > 0) return { price, applyButton: priceBtn };
    }
    const infoBtn = item.querySelector('button.instant-sale-info');
    if (infoBtn) {
        const label = infoBtn.getAttribute('aria-label') || '';
        const match = label.match(/\$\s*([\d.,]+)/);
        if (match) {
            const price = parseFloat(match[1].replace(/,/g, ''));
            if (!isNaN(price) && price > 0) return { price, applyButton: null };
        }
    }
    return null;
}

async function applyPrice(item, price, applyButton = null) {
    const input = item.querySelector('input[formcontrolname="price"]');
    if (!input) return false;

    // On clique d'abord sur le bouton du site s'il existe (il applique le prix
    // via son propre code Angular, donc proprement) ...
    if (applyButton) {
        applyButton.click();
        await sleep(150);
        const current = parseFloat((input.value || '').replace(',', '.'));
        if (!isNaN(current) && Math.abs(current - price) < 0.001) return true;
    }
    // ... sinon on force la valeur nous-mêmes.
    setAngularInputValue(input, price);
    return true;
}

// --- 2. FLASH AUTO-PRICE (sell queue) ---

async function autoPriceLightning() {
    const items = Array.from(document.querySelectorAll('app-sell-queue-item'));
    if (items.length === 0) return;

    const seenPerName = new Map();
    let updated = 0;
    let skipped = 0;

    for (const item of items) {
        const itemName = getItemName(item) || 'Item inconnu';
        try {
            const info = getBuyOrderInfo(item);

            if (!info) {
                // Pas de bandeau Buy Order : le nouveau site n'expose plus le
                // carnet d'ordres dans la sell queue, on ne touche pas au prix.
                skipped++;
                console.warn(`[Auto-Pricer] ${itemName} : pas d'info Buy Order affichée, prix non modifié.`);
                continue;
            }

            await applyPrice(item, info.price, info.applyButton);
            updated++;

            // La profondeur du carnet n'est plus visible : avertir si plusieurs
            // exemplaires identiques sont mis au même buy order.
            const count = (seenPerName.get(itemName) || 0) + 1;
            seenPerName.set(itemName, count);
            if (count === 2) {
                console.warn(`[Auto-Pricer] ${itemName} : plusieurs exemplaires au même Buy Order ($${info.price}). Tous ne partiront peut-être pas instantanément.`);
            }

            await sleep(50);
        } catch (error) {
            console.warn(`[Auto-Pricer] Item ignoré (${itemName}) : ${error.message}`);
        }
    }

    console.log(`[Auto-Pricer] Terminé : ${updated} prix mis à jour, ${skipped} item(s) sans Buy Order affiché.`);
}

// --- 3. AUCTION 7 JOURS (cartes d'inventaire) ---

// Lit les infos d'une carte d'inventaire (item-card)
function getCardInfo(card) {
    const name = card.querySelector('.item-name')?.textContent.replace(/\s+/g, ' ').trim() || 'Item';
    const priceText = card.querySelector('.price .value')?.textContent || '';
    const refPrice = parseFloat(priceText.replace(/[^0-9.]+/g, ''));
    const sellBtn = Array.from(card.querySelectorAll('button'))
        .find(b => /sell\s*item/i.test(b.textContent));
    return { name, refPrice: isNaN(refPrice) ? null : refPrice, sellBtn };
}

// ⚠️ Partie "menu" à confirmer : les mat-menu ne sont rendus qu'à l'ouverture,
// donc on cible les options PAR TEXTE ("Auction", "7 Days"...). Si une étape
// échoue, tout est loggé en console pour pouvoir ajuster les sélecteurs.
async function tryConfigureAuction(queueItem, name) {
    // Le menu 🛒 (shopping_cart) de l'item dans la queue devrait contenir le type de vente
    const cartBtn = Array.from(queueItem.querySelectorAll('.action-btns button'))
        .find(b => b.textContent.includes('shopping_cart'));
    if (!cartBtn) {
        console.warn(`[Auction] ${name} : menu 🛒 introuvable dans la sell queue.`);
        return false;
    }
    cartBtn.click();

    const menu = await waitFor(() => document.querySelector('.cdk-overlay-container .mat-mdc-menu-content'));
    if (!menu) {
        console.warn(`[Auction] ${name} : le menu ne s'est pas ouvert.`);
        return false;
    }

    const options = Array.from(menu.querySelectorAll('button, [mat-menu-item], .mat-mdc-menu-item'));
    console.log(`[Auction] ${name} : options du menu →`, options.map(o => o.textContent.replace(/\s+/g, ' ').trim()));

    const auctionOpt = options.find(o => /auction|ench[èe]re/i.test(o.textContent));
    if (!auctionOpt) {
        closeAnyOverlay();
        console.warn(`[Auction] ${name} : aucune option "Auction" dans ce menu (voir la liste ci-dessus). Essaie aussi l'autre menu (icône "public") et envoie-moi le HTML de .cdk-overlay-container.`);
        return false;
    }
    auctionOpt.click();
    await sleep(300);

    // Durée 7 jours : d'abord dans un éventuel overlay (sous-menu / mat-select ouvert),
    // sinon via un mat-select apparu dans l'item.
    let sevenDays = findByText(
        document,
        '.cdk-overlay-container button, .cdk-overlay-container mat-option, .cdk-overlay-container [mat-menu-item]',
        /\b7\s*(d(ays?)?|j(ours?)?)\b/i
    );
    if (!sevenDays) {
        const select = queueItem.querySelector('mat-select');
        if (select) {
            select.click();
            sevenDays = await waitFor(
                () => findByText(document, '.cdk-overlay-container mat-option', /\b7\b/),
                1500
            );
        }
    }

    if (sevenDays) {
        sevenDays.click();
        console.log(`[Auction] ${name} : durée 7 jours sélectionnée.`);
        return true;
    }

    console.warn(`[Auction] ${name} : durée "7 jours" non trouvée automatiquement — règle-la à la main et envoie-moi le HTML de l'interface auction pour que je l'automatise.`);
    return false;
}

async function listAsAuction7d(card) {
    const { name, refPrice, sellBtn } = getCardInfo(card);
    if (!sellBtn) throw new Error('bouton "Sell Item" introuvable sur la carte');

    // 1) Ajouter l'item à la sell queue et retrouver SA ligne
    const before = new Set(document.querySelectorAll('app-sell-queue-item'));
    sellBtn.click();
    const queueItem = await waitFor(() => {
        const items = Array.from(document.querySelectorAll('app-sell-queue-item'));
        return items.find(i => !before.has(i)) || null;
    }, 4000);
    if (!queueItem) throw new Error("l'item n'est pas apparu dans la sell queue");

    // 2) Prix recommandé (Reference Price de la carte)
    if (refPrice !== null) {
        await applyPrice(queueItem, refPrice);
        console.log(`[Auction] ${name} : prix recommandé appliqué ($${refPrice}).`);
    } else {
        console.warn(`[Auction] ${name} : Reference Price introuvable, prix non pré-rempli.`);
    }

    // 3) Mode Auction + durée 7 jours
    await tryConfigureAuction(queueItem, name);

    // NB : on NE clique PAS sur "Sell Items" — tu vérifies et valides toi-même.
}

function injectAuctionButtons() {
    document.querySelectorAll('item-card mat-card.item-card').forEach(card => {
        if (card.querySelector('.auction-7d-btn')) return;

        const { sellBtn } = getCardInfo(card);
        if (!sellBtn) return; // pas notre inventaire (pas de bouton "Sell Item")

        const actionDiv = sellBtn.closest('.action') || sellBtn.parentElement;

        const btn = document.createElement('button');
        btn.innerText = '🔨 Auction 7J';
        btn.className = 'auction-7d-btn';
        btn.style.width = '100%';
        btn.style.marginTop = '6px';
        btn.style.padding = '6px';
        btn.style.backgroundColor = '#222222';
        btn.style.color = '#FFB300';
        btn.style.border = '1px solid #FFB300';
        btn.style.borderRadius = '6px';
        btn.style.fontWeight = 'bold';
        btn.style.cursor = 'pointer';

        btn.addEventListener('click', async (e) => {
            e.stopPropagation(); // la carte est cliquable, on ne veut pas ouvrir l'item
            e.preventDefault();
            const oldText = btn.innerText;
            btn.disabled = true;
            btn.innerText = '⏳...';
            try {
                await listAsAuction7d(card);
                btn.innerText = '✅ En queue';
            } catch (err) {
                console.error('[Auction] Erreur :', err);
                btn.innerText = '❌ Erreur';
            }
            setTimeout(() => {
                btn.innerText = oldText;
                btn.disabled = false;
            }, 2000);
        });

        actionDiv.appendChild(btn);
    });
}

// --- INTERFACE : BOUTON "TRADE ALL" ---

function injectTradeAllButton() {
    const container = document.querySelector('app-my-trades-home .bar');

    if (container && !document.querySelector('.trade-all-btn')) {
        const btn = document.createElement("button");
        btn.innerText = "🚀 Trade All";
        btn.className = "mdc-button mat-mdc-button-base mdc-button--raised mat-mdc-raised-button mat-primary trade-all-btn";
        btn.style.marginLeft = "20px";
        btn.style.backgroundColor = "#FF4081";

        btn.addEventListener("click", () => {
            const tradeButtons = document.querySelectorAll('.trade-link');

            if (tradeButtons.length === 0) {
                alert("Aucun trade trouvé !");
                return;
            }

            tradeButtons.forEach((tradeBtn, index) => {
                setTimeout(() => {
                    tradeBtn.click();
                    console.log(`Trade #${index + 1} cliqué`);
                }, index * 300);
            });
        });

        container.appendChild(btn);
    }
}

// --- INTERFACE : BOUTON AUTO-PRICE ---

function checkAndCreateButton() {
    const isSellPage = window.location.href.includes('/sell');
    const existingButton = document.querySelector('.my-auto-price-btn');

    if (isSellPage && !existingButton) {
        const button = document.createElement("button");
        button.innerText = "⚡ Flash Auto-Price";
        button.className = "my-auto-price-btn";

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
            button.innerText = "⏳ Pricing...";
            button.disabled = true;
            try {
                await autoPriceLightning();
                button.innerText = "✅ Done !";
            } catch (e) {
                console.error("[Auto-Pricer] Erreur :", e);
                button.innerText = "❌ Erreur";
            }
            setTimeout(() => {
                button.innerText = "⚡ Flash Auto-Price";
                button.disabled = false;
            }, 1500);
        });

        document.body.appendChild(button);
    } else if (!isSellPage && existingButton) {
        existingButton.remove();
    }
}

// --- 4. LANCEMENT ET SURVEILLANCE ---
// Un SEUL observer débouncé pour tous les boutons.

let initializationTimer = null;

function safeInject() {
    if (initializationTimer) clearTimeout(initializationTimer);
    initializationTimer = setTimeout(() => {
        checkAndCreateButton();
        injectTradeAllButton();
        injectAuctionButtons();
    }, 500);
}

const observer = new MutationObserver(safeInject);
observer.observe(document.body, { childList: true, subtree: true });

safeInject();