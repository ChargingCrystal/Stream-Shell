/*
 * ============================================================
 * STREAM SHELL — SUBSCRIPTION ACCOUNT SCRAPER
 * ============================================================
 *
 * Reads only subscription status / renewal information that is
 * already rendered in the signed-in provider account page.
 * Raw page text is never stored or sent back to the Landing page.
 */

const STREAM_SHELL_DATE_LABELS = [
    {
        kind: "renews",
        pattern: /(?:next\s+billing(?:\s+cycle)?(?:\s+date)?|next\s+payment(?:\s+date)?|next\s+renewal(?:\s+date)?|renewal\s+date|billing\s+date|payment\s+date|renews\s+on|n[aä]chste(?:r|s)?\s+abrechnung(?:stermin|sdatum)?|n[aä]chste\s+zahlung|n[aä]chstes\s+zahlungsdatum|verl[aä]ngerungsdatum|verl[aä]ngert\s+sich\s+am|abrechnungsdatum|zahlungsdatum)/i
    },
    {
        kind: "ends",
        pattern: /(?:membership\s+(?:ends|expires)|subscription\s+(?:ends|expires)|ends\s+on|expires\s+on|valid\s+until|access\s+until|end\s+date|mitgliedschaft\s+endet|abo\s+endet|l[aä]uft\s+ab(?:\s+am)?|g[uü]ltig\s+bis|enddatum)/i
    }
];

const STREAM_SHELL_DATE_PATTERNS = [
    /\b\d{1,2}[.\/-]\d{1,2}[.\/-](?:\d{2}|\d{4})\b/i,
    /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/i,
    /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+\d{4})?\b/i,
    /\b\d{1,2}\.?\s+(?:januar|februar|m[aä]rz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)(?:\s+\d{4})?\b/i
];

const STREAM_SHELL_BILLING_SOURCES = [
    {
        label: "Google Play",
        pattern: /(?:(?:billed|billing|charged|managed|purchased|subscribed).{0,55}(?:google\s+play|play\s+store)|(?:google\s+play|play\s+store).{0,55}(?:billing|subscription|manage|payment)|(?:abgerechnet|bezahlt|verwaltet|gekauft|abonniert).{0,55}(?:google\s+play|play\s+store)|(?:google\s+play|play\s+store).{0,55}(?:abrechnung|abo|zahlung|verwalten))/i
    },
    {
        label: "Apple",
        pattern: /(?:(?:billed|billing|charged|managed|purchased|subscribed).{0,55}(?:apple|app\s+store)|(?:apple|app\s+store).{0,55}(?:billing|subscription|manage|payment)|(?:abgerechnet|bezahlt|verwaltet|gekauft|abonniert).{0,55}(?:apple|app\s+store))/i
    }
];


const STREAM_SHELL_PROVIDER_RULES = {
    netflix: {
        positive: [
            /member\s+since/i,
            /mitglied\s+seit/i,
            /plan\s+details/i,
            /plandetails/i,
            /membership\s*&\s*billing/i,
            /mitgliedschaft\s+und\s+abrechnung/i
        ],
        inactive: [
            /restart\s+(?:your\s+)?membership/i,
            /mitgliedschaft\s+(?:wieder\s+)?reaktivieren/i,
            /choose\s+a\s+plan/i,
            /abo\s+ausw[aä]hlen/i
        ]
    },
    youtube: {
        positive: [
            /youtube\s+(?:music\s+)?premium/i,
            /manage\s+membership/i,
            /mitgliedschaft\s+verwalten/i
        ],
        inactive: [
            /get\s+youtube\s+premium/i,
            /try\s+(?:it\s+)?free/i,
            /youtube\s+premium\s+holen/i,
            /kostenlos\s+testen/i
        ]
    },
    prime: {
        positive: [
            /prime\s+membership/i,
            /prime-mitgliedschaft/i,
            /manage\s+(?:my\s+)?prime/i,
            /prime-mitgliedschaft\s+verwalten/i
        ],
        inactive: [
            /start\s+(?:your\s+)?prime\s+membership/i,
            /join\s+prime/i,
            /prime\s+ausprobieren/i,
            /prime-mitglied\s+werden/i
        ]
    },
    disney: {
        positive: [
            /your\s+plans\s*&\s*billing/i,
            /plans?\s*&\s*billing/i,
            /current\s+subscription/i,
            /aktuelles\s+abo/i,
            /dein(?:e|)\s+abos?/i
        ],
        inactive: [
            /subscribe\s+to\s+disney\+/i,
            /restart\s+subscription/i,
            /no\s+active\s+subscription/i,
            /disney\+\s+abonnieren/i,
            /abo\s+reaktivieren/i,
            /kein\s+aktives\s+abo/i
        ]
    },
    crunchyroll: {
        positive: [
            /premium\s+membership/i,
            /current\s+plan/i,
            /membership\s+info/i,
            /mega\s+fan/i,
            /ultimate\s+fan/i,
            /aktueller\s+plan/i,
            /mitgliedschaftsinformation/i
        ],
        inactive: [
            /free\s+member/i,
            /upgrade\s+to\s+premium/i,
            /no\s+active\s+membership/i,
            /kostenlose\s+mitgliedschaft/i,
            /auf\s+premium\s+upgraden/i,
            /keine\s+aktive\s+mitgliedschaft/i
        ]
    }
};

function streamShellVisibleText() {
    return (document.body?.innerText || "")
        .replace(/\u00a0/g, " ")
        .replace(/\r/g, "");
}

function streamShellLines(text) {
    return text
        .split("\n")
        .map(line => line.replace(/\s+/g, " ").trim())
        .filter(Boolean);
}

function streamShellExtractDate(value) {
    for (const pattern of STREAM_SHELL_DATE_PATTERNS) {
        const match = value.match(pattern);
        if (match) {
            return match[0].trim();
        }
    }
    return null;
}

function streamShellFindRenewal(lines) {
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];

        for (const label of STREAM_SHELL_DATE_LABELS) {
            if (!label.pattern.test(line)) {
                continue;
            }

            const sameLineDate = streamShellExtractDate(line);
            if (sameLineDate) {
                return {
                    kind: label.kind,
                    value: sameLineDate
                };
            }

            for (
                let offset = 1;
                offset <= 4 && index + offset < lines.length;
                offset += 1
            ) {
                const candidate = lines[index + offset];
                const candidateDate = streamShellExtractDate(candidate);

                if (candidateDate) {
                    return {
                        kind: label.kind,
                        value: candidateDate
                    };
                }
            }
        }
    }

    return {
        kind: null,
        value: null
    };
}

function streamShellExtractBillingSource(text) {
    for (const source of STREAM_SHELL_BILLING_SOURCES) {
        if (source.pattern.test(text)) {
            return source.label;
        }
    }

    return null;
}


function streamShellLooksVerificationChallenge(provider, text) {
    if (provider !== "prime") {
        return false;
    }

    const path = `${location.pathname} ${location.hash} ${location.search}`.toLowerCase();

    const authRoute =
        /(?:\/ap\/signin|\/ap\/cvf|signin|auth|verification|verify|cvf)/i.test(path);

    if (!authRoute) {
        return false;
    }

    /*
     * Amazon can keep auth-looking URL state around briefly after a Passkey
     * succeeds. If real Prime account data is already rendered, prefer that
     * over the stale route and let normal classification continue.
     */
    const primeAccountDataVisible =
        STREAM_SHELL_DATE_LABELS.some(label => label.pattern.test(text)) ||
        /(?:manage\s+(?:my\s+)?prime|prime-mitgliedschaft\s+verwalten|next\s+(?:payment|billing)|n[aä]chste\s+(?:zahlung|abrechnung))/i.test(text);

    if (primeAccountDataVisible) {
        return false;
    }

    const challengeText =
        /(?:passkey|security\s+key|verify\s+(?:your\s+)?identity|confirm\s+(?:your\s+)?identity|verification\s+code|one[-\s]?time\s+(?:password|code)|best[aä]tig(?:e|en|ung).{0,30}(?:identit[aä]t|anmeldung)|sicherheitsschl[uü]ssel|einmalcode|passwort|sign\s+in|anmelden)/i.test(text);

    const challengeControl =
        Boolean(
            document.querySelector(
                'input[type="password"], input[autocomplete="one-time-code"], input[name*="otp" i], input[id*="otp" i], input[name*="code" i]'
            )
        );

    return challengeText || challengeControl || text.length < 800;
}


function streamShellLooksSignedOut(text, provider = null) {
    const path = `${location.pathname} ${location.hash}`.toLowerCase();

    const primeAccountDataVisible =
        provider === "prime" &&
        (
            STREAM_SHELL_DATE_LABELS.some(label => label.pattern.test(text)) ||
            /(?:manage\s+(?:my\s+)?prime|prime-mitgliedschaft\s+verwalten|next\s+(?:payment|billing)|n[aä]chste\s+(?:zahlung|abrechnung))/i.test(text)
        );

    if (
        !primeAccountDataVisible &&
        (
            /(?:login|signin|sign-in|auth)/.test(path) ||
            document.querySelector('input[type="password"]')
        )
    ) {
        return true;
    }

    if (text.length < 2500) {
        return /(?:sign\s+in|log\s+in|anmelden|einloggen)/i.test(text);
    }

    return false;
}

function streamShellHasAny(text, patterns) {
    return patterns.some(pattern => pattern.test(text));
}

function streamShellClassify(provider, text, renewal) {
    if (streamShellLooksVerificationChallenge(provider, text)) {
        return "verify";
    }

    if (streamShellLooksSignedOut(text, provider)) {
        return "signin";
    }

    const normalized = text.toLowerCase();

    const ending =
        renewal.kind === "ends" ||
        /(?:membership|subscription|mitgliedschaft|abo).{0,55}(?:cancelled|canceled|gekündigt|endet|expires|läuft\s+ab)/i.test(text);

    if (ending && renewal.value) {
        return "ending";
    }

    if (renewal.kind === "renews" && renewal.value) {
        return "active";
    }

    const rules = STREAM_SHELL_PROVIDER_RULES[provider];

    if (rules?.inactive && streamShellHasAny(text, rules.inactive)) {
        return "inactive";
    }

    if (rules?.positive && streamShellHasAny(text, rules.positive)) {
        return "active";
    }

    if (
        /(?:inactive|expired|not\s+active|abgelaufen|nicht\s+aktiv)/i.test(normalized)
    ) {
        return "inactive";
    }

    return "unknown";
}

function streamShellGooglePlaySegment(lines, patterns) {
    let best = null;

    for (let index = 0; index < lines.length; index += 1) {
        if (!patterns.some(pattern => pattern.test(lines[index]))) {
            continue;
        }

        const start = Math.max(0, index - 5);
        const end = Math.min(lines.length, index + 15);
        const segment = lines.slice(start, end);
        const text = segment.join("\n");

        let score = 1;

        if (/(?:manage|cancel|renew|payment|billing|subscription|active|expires|ends|verwalten|k[uü]ndigen|verl[aä]nger|zahlung|abrechnung|abo)/i.test(text)) {
            score += 3;
        }

        if (streamShellExtractDate(text)) {
            score += 2;
        }

        if (!best || score > best.score) {
            best = {
                score,
                lines: segment,
                text
            };
        }
    }

    return best;
}


function streamShellParseGooglePlayItem(lines, patterns) {
    const segment = streamShellGooglePlaySegment(lines, patterns);

    if (!segment) {
        return null;
    }

    const renewal = streamShellFindRenewal(segment.lines);
    const text = segment.text;

    let status = "active";

    if (/(?:expired|inactive|ended|abgelaufen|inaktiv|beendet)/i.test(text)) {
        status = "inactive";
    } else if (/(?:cancelled|canceled|will\s+end|ends\s+on|expires\s+on|gek[uü]ndigt|endet\s+am|l[aä]uft\s+ab)/i.test(text)) {
        status = "ending";
    }

    return {
        status,
        renewal: renewal.value,
        dateKind: renewal.kind,
        billingSource: "Google Play"
    };
}


function streamShellScrapeGooglePlaySubscriptions() {
    const text = streamShellVisibleText();
    const lines = streamShellLines(text);

    return {
        provider: "googleplay",
        status: streamShellLooksSignedOut(text) ? "signin" : "active",
        pageReady: text.length >= 120,
        sourceUrl: location.href,
        checkedAt: Date.now(),
        items: {
            youtube: streamShellParseGooglePlayItem(
                lines,
                [
                    /youtube\s+premium/i,
                    /youtube\s+music\s+premium/i
                ]
            ),
            discord: streamShellParseGooglePlayItem(
                lines,
                [
                    /discord/i,
                    /nitro(?:\s+basic)?/i
                ]
            )
        }
    };
}


function streamShellScrapeSubscription(provider) {
    if (provider === "googleplay") {
        return streamShellScrapeGooglePlaySubscriptions();
    }

    const text = streamShellVisibleText();
    const lines = streamShellLines(text);
    const renewal = streamShellFindRenewal(lines);
    const status = streamShellClassify(provider, text, renewal);

    return {
        provider,
        status,
        dateKind: renewal.kind,
        renewal: renewal.value,
        billingSource: streamShellExtractBillingSource(text),
        pageReady: text.length >= 120,
        sourceUrl: location.href,
        checkedAt: Date.now()
    };
}

chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
        if (message?.type !== "stream-shell-scrape-subscription") {
            return;
        }

        try {
            sendResponse({
                ok: true,
                result: streamShellScrapeSubscription(message.provider)
            });
        } catch (error) {
            sendResponse({
                ok: false,
                error: error?.message || "Subscription scrape failed."
            });
        }
    }
);
