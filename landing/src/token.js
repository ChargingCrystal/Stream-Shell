/*
 * ============================================================
 * TOKEN
 * ============================================================
 */

async function renderTokenSetup(
    afterSave = null
) {
    searchHeaderTitle.textContent =
        "Connect TMDB";


    mediaPanelSubtitle.textContent =
        "Save your Read Access Token once";


    mediaPanelBody.replaceChildren();


    const wrapper =
        createElement(
            "div",
            "token-setup"
        );


    const card =
        createElement(
            "div",
            "token-setup-card"
        );


    const title =
        createElement(
            "div",
            "token-setup-title",
            "TMDB Read Access Token"
        );


    const text =
        createElement(
            "div",
            "token-setup-text",
            "Stream Shell uses TMDB for titles, metadata and JustWatch streaming availability. The token is stored locally in chrome.storage."
        );


    const row =
        createElement(
            "div",
            "token-input-row"
        );


    const input =
        createElement(
            "input",
            "tmdb-token-input"
        );


    input.type =
        "password";


    input.placeholder =
        "eyJhbGciOiJIUzI1NiJ9...";


    input.autocomplete =
        "off";


    const saveButton =
        createElement(
            "button",
            "tmdb-token-save",
            "Save"
        );


    saveButton.type =
        "button";


    const status =
        createElement(
            "div",
            "token-setup-status"
        );


    row.append(
        input,
        saveButton
    );


    card.append(
        title,
        text,
        row,
        status
    );


    wrapper.appendChild(
        card
    );


    mediaPanelBody.appendChild(
        wrapper
    );


    async function save() {
        const token =
            input.value.trim();


        if (
            !token
        ) {
            status.className =
                "token-setup-status error";


            status.textContent =
                "Paste a token first.";


            return;
        }


        saveButton.disabled =
            true;


        status.className =
            "token-setup-status";


        status.textContent =
            "Validating token...";


        try {
            await window
                .StreamShellMediaApi
                .saveToken(
                    token
                );


            status.className =
                "token-setup-status success";


            status.textContent =
                "Token validated and stored locally.";


            if (
                typeof afterSave ===
                "function"
            ) {
                setTimeout(
                    afterSave,
                    280
                );
            }

        } catch (error) {

            console.error(
                "TMDB token validation failed:",
                error
            );


            status.className =
                "token-setup-status error";


            status.textContent =
                error?.code ===
                    "TMDB_TOKEN_INVALID"
                    ? "TMDB rejected this token."
                    : "The token could not be validated.";

        } finally {

            saveButton.disabled =
                false;
        }
    }


    saveButton.addEventListener(
        "click",
        save
    );


    input.addEventListener(
        "keydown",
        event => {
            if (
                event.key ===
                "Enter"
            ) {
                event.preventDefault();

                save();
            }
        }
    );


    input.focus();
}


