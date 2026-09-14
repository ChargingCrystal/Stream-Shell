/*
 * ============================================================
 * SVG HELPERS
 * ============================================================
 */

function createSvgElement(
    name,
    attributes = {}
) {
    const element =
        document.createElementNS(
            "http://www.w3.org/2000/svg",
            name
        );


    for (
        const [key, value]
        of Object.entries(
            attributes
        )
    ) {
        element.setAttribute(
            key,
            String(
                value
            )
        );
    }


    return element;
}


function createAvailabilityIcon(
    state
) {
    const svg =
        createSvgElement(
            "svg",
            {
                viewBox:
                    "0 0 24 24",

                "aria-hidden":
                    "true"
            }
        );


    if (
        state ===
        "available"
    ) {
        svg.appendChild(
            createSvgElement(
                "circle",
                {
                    cx:
                        12,

                    cy:
                        12,

                    r:
                        8.5
                }
            )
        );


        svg.appendChild(
            createSvgElement(
                "path",
                {
                    d:
                        "M8.2 12.2L10.7 14.7L15.9 9.4"
                }
            )
        );


        return svg;
    }


    if (
        state ===
        "extra"
    ) {
        svg.appendChild(
            createSvgElement(
                "rect",
                {
                    x:
                        3.5,

                    y:
                        6,

                    width:
                        17,

                    height:
                        12,

                    rx:
                        2.8
                }
            )
        );


        svg.appendChild(
            createSvgElement(
                "path",
                {
                    d:
                        "M3.8 9.5H20.2"
                }
            )
        );


        svg.appendChild(
            createSvgElement(
                "path",
                {
                    d:
                        "M15.5 14.2H17.7"
                }
            )
        );


        return svg;
    }


    if (
        state ===
        "unavailable"
    ) {
        svg.appendChild(
            createSvgElement(
                "circle",
                {
                    cx:
                        12,

                    cy:
                        12,

                    r:
                        8.5
                }
            )
        );


        svg.appendChild(
            createSvgElement(
                "path",
                {
                    d:
                        "M8.5 12H15.5"
                }
            )
        );


        return svg;
    }


    svg.appendChild(
        createSvgElement(
            "circle",
            {
                cx:
                    12,

                cy:
                    12,

                r:
                    8.5
            }
        )
    );


    svg.appendChild(
        createSvgElement(
            "path",
            {
                d:
                    "M9.8 9.4C10.2 8.2 11.1 7.6 12.3 7.6C14 7.6 15 8.5 15 9.8C15 11.1 14.2 11.7 13.1 12.3C12.2 12.8 11.9 13.3 11.9 14.1"
            }
        )
    );


    svg.appendChild(
        createSvgElement(
            "circle",
            {
                cx:
                    11.9,

                cy:
                    16.7,

                r:
                    .75,

                fill:
                    "currentColor",

                stroke:
                    "none"
            }
        )
    );


    return svg;
}


