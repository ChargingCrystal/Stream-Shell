/* AniList search results use the same neutral Stream Shell card vocabulary.
 * Covers and metadata are public; saving stores them in the independent local
 * external library, not the TMDB watchlist or the Mangayomi app database. */
function streamShellAniListCover(media, className) {
    if (!window.StreamShellAniList.validCover(media.coverUrl)) return null;
    const image = document.createElement("img");
    image.className = className;
    image.src = media.coverUrl;
    image.alt = "";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.decoding = "async";
    return image;
}

function streamShellAniListMeta(media, addedAt = null) {
    const parts = [
        media.mediaType === "anime" ? "Anime" : media.mediaType === "novel" ? "Novel" : "Manga",
        media.year || null,
        media.episodes ? `${media.episodes} episodes` : media.chapters ? `${media.chapters} chapters` : null,
        media.score != null ? `AniList ${media.score}%` : null,
        addedAt ? `Added ${formatDateTime(addedAt)}` : null
    ].filter(Boolean);
    return parts.join(" · ");
}

function streamShellAniListDetails(media) {
    const container = createElement("div", "ss-anilist-details");
    if (media.description) container.appendChild(createElement("p", "ss-anilist-description", media.description));
    if (media.genres?.length) container.appendChild(createElement("p", "ss-anilist-genres", media.genres.join(" · ")));
    if (media.originalTitle || media.nativeTitle)
        container.appendChild(createElement("p", "ss-anilist-alt", [media.originalTitle,media.nativeTitle].filter(Boolean).join(" · ")));
    return container;
}

function streamShellAniListResultCard(media, saved, generation) {
    const row = createElement("article", "media-item ss-anilist-row");
    const cover = streamShellAniListCover(media, "ss-anilist-cover") || createElement("div", "ss-anilist-cover ss-anilist-cover-empty", "◈");
    const main = createElement("div", "media-item-main");
    const heading = createElement("div", "media-item-title-row");
    heading.append(createElement("span", "media-item-title", media.title),
        createElement("span", "media-item-type", media.mediaType));
    main.append(heading, createElement("div", "media-item-meta", streamShellAniListMeta(media)));
    const actions = createElement("div", "media-item-actions");
    const save = createElement("button", "media-item-action ss-anilist-save", saved ? "✓" : "+");
    save.type = "button";
    save.disabled = saved;
    save.title = saved ? "Already in Library" : "Save to Stream Shell Library";
    save.setAttribute("aria-label", save.title);
    const details = createElement("button", "media-item-action", "ⓘ");
    details.type = "button"; details.title = "Show title details";
    details.setAttribute("aria-expanded", "false");
    const detailPanel = streamShellAniListDetails(media);
    detailPanel.hidden = true;
    details.addEventListener("click", () => {
        detailPanel.hidden = !detailPanel.hidden;
        details.setAttribute("aria-expanded", String(!detailPanel.hidden));
    });
    save.addEventListener("click", async () => {
        if (save.disabled) return;
        save.disabled = true;
        save.textContent = "…";
        try {
            // A details lookup enriches search's intentionally lightweight
            // response. Failed lookups must not prevent local saving.
            let enriched = media;
            try { enriched = await window.StreamShellAniList.details(media); }
            catch (error) { console.warn("AniList detail lookup unavailable, saving search data",error); }
            await window.StreamShellExternalLibrary.upsertAniList(enriched);
            void streamShellEnrichAniListMedia(enriched);
            save.textContent = "✓";
            save.title = "Saved in Library";
            await refreshWatchlistCache();
        } catch (error) {
            save.disabled = false;
            save.textContent = "+";
            save.title = String(error?.message || "Save failed");
            console.error("AniList save failed", error);
        }
    });
    const mangayomi = streamShellMangayomiSearchButton(media.title, media.mediaType);
    if (mangayomi) actions.appendChild(mangayomi);
    actions.append(details, save);
    row.append(cover, main, actions, detailPanel);
    return row;
}

async function renderAniListResults(entries, generation) {
    if (generation !== searchGeneration) return;
    const current = await window.StreamShellExternalLibrary.getAll();
    if (generation !== searchGeneration || mediaSearchSource?.value !== "tmdb") return;
    const ids = new Set(current.filter(i => i.source === "anilist").map(i => `${i.mediaType}:${i.anilistId}`));
    const visible = entries.filter(item => streamShellSearchMatchesType(item, "anilist"));
    streamShellSearchTypeSubtitle("anilist", `${visible.length} of ${entries.length} AniList results · metadata only`);
    if (!visible.length) {
        renderPanelMessage("No AniList results for the selected types", "Select another type or try the English, Romaji or original title.",{icon:"⌕"});
        return;
    }
    const list = createElement("div", "media-list");
    for (const item of visible)
        list.appendChild(streamShellAniListResultCard(item,ids.has(`${item.mediaType}:${item.anilistId}`),generation));
    mediaPanelBody.replaceChildren(list);
}
