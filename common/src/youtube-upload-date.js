    function extractYouTubeUploadTimestamp() {
        const videoId =
            getYouTubeVideoId();


        if (
            videoId &&
            youtubeUploadDateCache.has(
                videoId
            )
        ) {
            return youtubeUploadDateCache.get(
                videoId
            );
        }


        let fallback =
            "";


        const metaSelectors = [
            'meta[itemprop="uploadDate"]',
            'meta[itemprop="datePublished"]'
        ];


        for (
            const selector
            of metaSelectors
        ) {
            const value =
                String(
                    document
                        .querySelector(
                            selector
                        )
                        ?.getAttribute(
                            "content"
                        ) ||
                        ""
                ).trim();


            if (
                !value
            ) {
                continue;
            }


            if (
                /T\d{2}:\d{2}/
                    .test(
                        value
                    )
            ) {
                if (
                    videoId
                ) {
                    youtubeUploadDateCache.set(
                        videoId,
                        value
                    );
                }


                return value;
            }


            fallback =
                fallback ||
                value;
        }


        const scriptScanKey =
            videoId ||
            "__no-video__";

        const scriptScanAttempts =
            youtubeUploadDateScriptScanAttempts.get(
                scriptScanKey
            ) ||
            0;


        if (
            scriptScanAttempts >=
                5
        ) {
            return fallback;
        }


        youtubeUploadDateScriptScanAttempts.set(
            scriptScanKey,
            scriptScanAttempts + 1
        );


        const scripts =
            document.scripts ||
            [];


        for (
            const script
            of scripts
        ) {
            const scriptText =
                script.textContent ||
                "";


            if (
                !scriptText.includes(
                    "uploadDate"
                ) &&
                !scriptText.includes(
                    "publishDate"
                )
            ) {
                continue;
            }


            const uploadMatch =
                scriptText.match(
                    /"uploadDate"\s*:\s*"([^"\\]+(?:\\.[^"\\]*)*)"/
                );


            const publishMatch =
                scriptText.match(
                    /"publishDate"\s*:\s*"([^"\\]+(?:\\.[^"\\]*)*)"/
                );


            const raw =
                (
                    uploadMatch?.[1] ||
                    publishMatch?.[1] ||
                    ""
                )
                    .replace(
                        /\\u0026/g,
                        "&"
                    )
                    .replace(
                        /\\\//g,
                        "/"
                    );


            if (
                !raw
            ) {
                continue;
            }


            if (
                /T\d{2}:\d{2}/
                    .test(
                        raw
                    )
            ) {
                if (
                    videoId
                ) {
                    youtubeUploadDateCache.set(
                        videoId,
                        raw
                    );
                }


                return raw;
            }


            fallback =
                fallback ||
                raw;
        }


        if (
            videoId &&
            fallback
        ) {
            youtubeUploadDateCache.set(
                videoId,
                fallback
            );
        }


        return fallback;
    }


    function formatYouTubeAbsoluteDate(
        raw
    ) {
        const dateOnly =
            /^\d{4}-\d{2}-\d{2}$/
                .test(
                    raw
                );


        const date =
            dateOnly
                ? new Date(
                    `${raw}T12:00:00`
                )
                : new Date(
                    raw
                );


        if (
            !Number.isFinite(
                date.getTime()
            )
        ) {
            return "";
        }


        const format =
            String(
                youtubeUtilitySettings[
                    YOUTUBE_UPLOAD_DATE_FORMAT_KEY
                ] ||
                "friendly"
            );


        const time =
            dateOnly
                ? ""
                : new Intl.DateTimeFormat(
                    "en-US",
                    {
                        hour:
                            "numeric",

                        minute:
                            "2-digit",

                        hour12:
                            true
                    }
                ).format(
                    date
                );


        let datePart =
            "";


        if (
            format ===
                "numeric"
        ) {
            datePart =
                new Intl.DateTimeFormat(
                    "en-US",
                    {
                        month:
                            "2-digit",

                        day:
                            "2-digit",

                        year:
                            "numeric"
                    }
                ).format(
                    date
                );

        } else if (
            format ===
                "iso"
        ) {
            const year =
                date.getFullYear();


            const month =
                String(
                    date.getMonth() +
                    1
                ).padStart(
                    2,
                    "0"
                );


            const day =
                String(
                    date.getDate()
                ).padStart(
                    2,
                    "0"
                );


            datePart =
                `${year}-${month}-${day}`;

        } else {

            datePart =
                new Intl.DateTimeFormat(
                    "en-US",
                    {
                        month:
                            "short",

                        day:
                            "numeric",

                        year:
                            "numeric"
                    }
                ).format(
                    date
                );
        }


        if (
            time
        ) {
            return `${datePart} · ${time}`;
        }


        return datePart;
    }


    function formatYouTubeRelativeDate(
        raw
    ) {
        if (
            /^\d{4}-\d{2}-\d{2}$/
                .test(
                    raw
                )
        ) {
            return "";
        }


        if (
            youtubeUtilitySettings[
                YOUTUBE_UPLOAD_DATE_RELATIVE_ENABLED_KEY
            ] !==
                true
        ) {
            return "";
        }


        const days =
            Math.max(
                0,
                Number(
                    youtubeUtilitySettings[
                        YOUTUBE_UPLOAD_DATE_RELATIVE_DAYS_KEY
                    ]
                ) ||
                0
            );


        if (
            days <= 0
        ) {
            return "";
        }


        const date =
            new Date(
                raw
            );


        const ageMs =
            Date.now() -
            date.getTime();


        if (
            !Number.isFinite(
                ageMs
            ) ||
            ageMs < 0 ||
            ageMs >=
                days *
                86400000
        ) {
            return "";
        }


        const hours =
            Math.max(
                1,
                Math.round(
                    ageMs /
                    3600000
                )
            );


        if (
            hours < 24
        ) {
            return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
        }


        const relativeDays =
            Math.max(
                1,
                Math.round(
                    hours /
                    24
                )
            );


        return `${relativeDays} ${relativeDays === 1 ? "day" : "days"} ago`;
    }


    function restoreYouTubeUploadDate() {
        if (
            youtubeUploadDateElement
        ) {
            try {
                if (
                    youtubeUploadDateElement.isConnected
                ) {
                    youtubeUploadDateElement.textContent =
                        youtubeUploadDateOriginalText ??
                        youtubeUploadDateElement.textContent;


                    youtubeUploadDateElement.removeAttribute(
                        "data-stream-shell-original-upload-date"
                    );


                    youtubeUploadDateElement.removeAttribute(
                        "data-stream-shell-upload-date"
                    );
                }
            } catch {
            }
        }


        youtubeUploadDateElement =
            null;

        youtubeUploadDateOriginalText =
            null;


        document
            .getElementById(
                "stream-shell-youtube-upload-date"
            )
            ?.remove();
    }


    function findYouTubeUploadDateLabel() {
        const selectors = [
            "#info-strings yt-formatted-string",
            "ytd-watch-info-text yt-formatted-string",
            "ytd-watch-info-text span"
        ];


        const candidates =
            Array.from(
                document.querySelectorAll(
                    selectors.join(
                        ","
                    )
                )
            );


        return candidates
            .filter(
                element => {
                    const text =
                        String(
                            element.textContent ||
                            ""
                        ).trim();


                    return /\bago\b|\bvor\b|\b20\d{2}\b|premiered|streamed|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i
                        .test(
                            text
                        );
                }
            )
            .at(-1) ||
            null;
    }


    function applyYouTubeUploadDate() {
        if (isProviderSafeModeEnabled("youtube")) {
            restoreYouTubeUploadDate();
            return;
        }

        if (
            youtubeUtilitySettings[
                YOUTUBE_UPLOAD_DATE_ENABLED_KEY
            ] ===
                false ||
            location.pathname !==
                "/watch"
        ) {
            restoreYouTubeUploadDate();
            return;
        }


        const raw =
            extractYouTubeUploadTimestamp();


        if (
            !raw
        ) {
            return;
        }


        const text =
            formatYouTubeRelativeDate(
                raw
            ) ||
            formatYouTubeAbsoluteDate(
                raw
            );


        if (
            !text
        ) {
            return;
        }


        const label =
            findYouTubeUploadDateLabel();


        if (
            label
        ) {
            if (
                youtubeUploadDateElement !==
                    label
            ) {
                restoreYouTubeUploadDate();

                youtubeUploadDateElement =
                    label;

                youtubeUploadDateOriginalText =
                    String(
                        label.textContent ||
                        ""
                    );
            }


            if (
                !label.hasAttribute(
                    "data-stream-shell-original-upload-date"
                )
            ) {
                label.setAttribute(
                    "data-stream-shell-original-upload-date",
                    youtubeUploadDateOriginalText ||
                    ""
                );
            }


            label.textContent =
                text;


            label.setAttribute(
                "data-stream-shell-upload-date",
                raw
            );


            label.title =
                formatYouTubeAbsoluteDate(
                    raw
                );


            return;
        }


        const container =
            document.querySelector(
                "#info-strings"
            ) ||
            document.querySelector(
                "ytd-watch-info-text"
            );


        if (
            !container
        ) {
            return;
        }


        let fallback =
            document.getElementById(
                "stream-shell-youtube-upload-date"
            );


        if (
            !fallback
        ) {
            fallback =
                document.createElement(
                    "span"
                );


            fallback.id =
                "stream-shell-youtube-upload-date";


            container.appendChild(
                fallback
            );
        }


        fallback.textContent =
            ` • ${text}`;


        fallback.title =
            formatYouTubeAbsoluteDate(
                raw
            );
    }


