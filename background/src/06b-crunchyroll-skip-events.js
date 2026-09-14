async function fetchCrunchyrollSkipEvents(
    episodeId
) {
    const id = String(episodeId || "")
        .trim()
        .toUpperCase();

    if (!/^[A-Z0-9]+$/.test(id)) {
        return null;
    }

    try {
        const response = await fetch(
            `https://static.crunchyroll.com/skip-events/production/${encodeURIComponent(id)}.json`,
            {
                cache: "force-cache",
                credentials: "omit"
            }
        );

        if (!response.ok) {
            return null;
        }

        const payload = await response.json();

        if (!payload || typeof payload !== "object") {
            return null;
        }

        const normalized = {};

        for (const kind of ["recap", "intro", "credits", "preview"]) {
            const start = Number(payload[kind]?.start);
            const end = Number(payload[kind]?.end);

            if (
                Number.isFinite(start) &&
                Number.isFinite(end) &&
                end > start
            ) {
                normalized[kind] = {
                    start,
                    end
                };
            }
        }

        return normalized;
    } catch {
        return null;
    }
}
