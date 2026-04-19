// content.js - Shopping Block Overhaul
// Robust Checkout Detection & "Think About It" Overlay

let overlayShown = false;
let thinkDuration = 30; // Default
let isWhitelisted = false;

// Initialize
chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
    if (response) {
        thinkDuration = response.thinkDuration || 30;
        const hostname = window.location.hostname.toLowerCase();
        isWhitelisted = response.whitelist && response.whitelist.some(w => hostname === w || hostname.endsWith("." + w));
    }

    if (!isWhitelisted) {
        startDetection();
    }
});

function startDetection() {
    // Immediate check
    checkPage();

    // Check again when everything is fully loaded
    window.addEventListener('load', checkPage);

    // Monitor for changes (crucial for SPAs like Amazon, Walmart, etc.)
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            checkPage();
        } else {
            debouncedCheckDOM();
        }
    });

    if (document.body) {
        observer.observe(document.body, { subtree: true, childList: true });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, { subtree: true, childList: true });
        });
    }
}

let timeoutId;
function debouncedCheckDOM() {
    clearTimeout(timeoutId);
    // Faster debounce for immediate feedback
    timeoutId = setTimeout(checkPage, 200);
}

function checkPage() {
    const inCheckout = isCheckoutArea();

    if (!inCheckout) {
        overlayShown = false; // Reset so it can show again if they return to checkout
        return;
    }

    if (overlayShown) return;

    showThinkOverlay();
}

function isCheckoutArea() {
    const url = window.location.href.toLowerCase();
    const hostname = window.location.hostname.toLowerCase();

    // 0. Exclude common non-shopping sites to prevent false positives (like YouTube, Social Media, etc.)
    const exclusions = ['youtube.com', 'google.com', 'gmail.com', 'twitter.com', 'x.com', 'facebook.com', 'reddit.com', 'github.com', 'linkedin.com', 'netflix.com'];
    if (exclusions.some(domain => hostname === domain || hostname.endsWith('.' + domain))) {
        return false;
    }

    const bodyText = document.body ? document.body.innerText.toLowerCase() : "";
    const pageTitle = document.title.toLowerCase();

    // 1. URL & Title Regex (Extreme confidence)
    // Catches /shop/bag, /cart.html, /checkout, etc.
    const checkoutRegex = /(checkout|shopping[_-]cart|pay(ment|now)|basket|bag(?!\.png|\.jpg)|purchase|order[_-]summary|order[_-]pay|place[_-]order|complete[_-]order)/i;
    if (checkoutRegex.test(url) || checkoutRegex.test(pageTitle)) {
        // Double check it's not a false positive (like a blog post ABOUT checkout)
        // If the URL has these and we see "total" or "item" in the text, it's a match
        if (bodyText.includes('total') || bodyText.includes('item') || bodyText.includes('price')) {
            return true;
        }
    }

    // 2. High-Confidence Button/Action Text
    const actionKeywords = [
        'place order', 'complete purchase', 'pay now', 'complete order',
        'finish purchase', 'proceed to payment', 'confirm and pay',
        'checkout', 'buy now', 'review bag', 'review order', 'secure checkout',
        'proceed to checkout', 'check out now'
    ];
    
    const elements = document.querySelectorAll('button, input[type="button"], input[type="submit"], a, [role="button"]');
    for (let el of elements) {
        const text = (el.innerText || el.value || "").toLowerCase().trim();
        if (actionKeywords.some(kw => text === kw || text.includes(kw))) {
            return true;
        }
    }

    // 3. E-commerce Specific Markers (The "Smoking Gun" of a cart)
    const financialPatterns = [
        'subtotal', 'order total', 'estimated total', 'tax', 'shipping', 'order summary',
        'items in bag', 'items in cart'
    ];
    
    let matches = 0;
    financialPatterns.forEach(p => {
        if (bodyText.includes(p)) matches++;
    });
    
    if (matches >= 3) return true;

    // 4. Payment fields (Highly accurate)
    if (document.querySelector('input[autocomplete="cc-number"], input[name*="cardnumber"], #stripe-card-element, .braintree-hosted-fields, [id*="payment"], [class*="payment"]')) {
        return true;
    }

    // 5. Common E-commerce Platform IDs
    if (document.querySelector('[id*="shopping-cart"], [class*="shopping-cart"], [id*="checkout"], [class*="checkout"], .cart-container, .checkout-container')) {
        if (!url.includes('help') && !url.includes('faq')) {
            return true;
        }
    }

    return false;
}

function showThinkOverlay() {
    if (overlayShown) return;
    overlayShown = true;

    const overlay = document.createElement('div');
    overlay.id = 'shopping-block-overlay';

    // Use the extension's icon if possible, or a generic shopping bag
    const iconUrl = chrome.runtime.getURL('assets/icon-128.png');

    overlay.innerHTML = `
        <div class="card">
            <div class="pill-logo">
                <img src="${iconUrl}" alt="Shopping Block Icon">
                <span>Shopping Block</span>
            </div>
            <button id="think-countdown-btn" class="countdown-btn">Think about it for: ${thinkDuration}s</button>
        </div>
    `;

    document.body.appendChild(overlay);

    // Force reflow for transition
    overlay.offsetHeight;
    overlay.classList.add('fade-in');

    // Disable scrolling
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const btn = overlay.querySelector('#think-countdown-btn');
    let timeLeft = thinkDuration;

    const timer = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(timer);
            btn.innerText = "It's Okay";
            btn.classList.add('ready');
            btn.style.cursor = 'pointer';
        } else {
            btn.innerText = `Think about it for: ${formatTime(timeLeft)}`;
        }
    }, 1000);

    function formatTime(seconds) {
        if (seconds < 60) return `${seconds}s`;
        
        const w = Math.floor(seconds / 604800);
        const d = Math.floor((seconds % 604800) / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;

        let parts = [];
        if (w > 0) parts.push(`${w}w`);
        if (d > 0) parts.push(`${d}d`);
        if (h > 0) parts.push(`${h}h`);
        if (m > 0) parts.push(`${m}m`);
        if (s > 0 || parts.length === 0) parts.push(`${s}s`);

        return parts.slice(0, 3).join(' ');
    }

    btn.onclick = () => {
        if (timeLeft <= 0) {
            overlay.classList.remove('fade-in');
            setTimeout(() => {
                overlay.remove();
                document.body.style.overflow = originalOverflow;
            }, 800);
        }
    };
}
