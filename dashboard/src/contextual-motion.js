/*
 * ============================================================
 * CONTEXTUAL DASHBOARD MOTION
 * ============================================================
 */

function syncContextualSlotWidth(
    slot,
    control
) {
    if (
        !slot ||
        !control ||
        slot.hidden
    ) {
        return;
    }


    const width =
        Math.ceil(
            control
                .getBoundingClientRect()
                .width
        );


    if (
        width > 0
    ) {
        slot.style.setProperty(
            "--contextual-slot-width",
            `${width}px`
        );
    }
}


function setContextualControlVisible(
    slot,
    control,
    visible
) {
    if (
        !slot ||
        !control
    ) {
        return;
    }


    const shouldShow =
        Boolean(
            visible
        );


    slot.dataset.requestedVisible =
        shouldShow
            ? "true"
            : "false";


    if (
        shouldShow
    ) {
        if (
            slot.hidden
        ) {
            slot.hidden =
                false;


            control.hidden =
                false;


            slot.classList.remove(
                "visible"
            );


            slot.classList.add(
                "measuring"
            );


            const measuredWidth =
                Math.ceil(
                    control
                        .getBoundingClientRect()
                        .width
                );


            slot.classList.remove(
                "measuring"
            );


            if (
                measuredWidth > 0
            ) {
                slot.style.setProperty(
                    "--contextual-slot-width",
                    `${measuredWidth}px`
                );
            }


            void slot.offsetWidth;
        }


        syncContextualSlotWidth(
            slot,
            control
        );


        requestAnimationFrame(
            () => {
                if (
                    slot.dataset.requestedVisible ===
                    "true"
                ) {
                    slot.classList.add(
                        "visible"
                    );
                }
            }
        );


        return;
    }


    if (
        slot.hidden
    ) {
        return;
    }


    syncContextualSlotWidth(
        slot,
        control
    );


    slot.classList.remove(
        "visible"
    );


    const finish =
        () => {
            if (
                slot.dataset.requestedVisible ===
                "false" &&
                !slot.classList.contains(
                    "visible"
                )
            ) {
                slot.hidden =
                    true;


                control.hidden =
                    true;
            }
        };


    setTimeout(
        finish,
        220
    );
}
