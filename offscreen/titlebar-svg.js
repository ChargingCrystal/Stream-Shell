/* Local native PNG / provider SVG -> neutral monochrome PNG raster for the titlebar. Runs in the existing
 * offscreen DOM document; does not read/change/close audio sessions. */
const TITLEBAR_ICON_SIZE = 32;
const TITLEBAR_ICON_B64_LIMIT = 16000;
const TITLEBAR_ART_PATH = /^(?:native\/titlebar-icons\/custom\/custom_[a-z0-9_-]{1,32}\.png|assets\/providers\/custom\/custom_[a-z0-9_-]{1,32}_icon\.svg)$/;

async function convertTitlebarArtworkToPng(path) {
    if (typeof path !== "string" || !TITLEBAR_ART_PATH.test(path)) {
        return {ok:false,reason:"invalid-path"};
    }
    const url = chrome.runtime.getURL(path);
    // Both PNG primary and SVG fallback are local extension assets.
    let response;
    try { response = await fetch(url, {cache:"no-store"}); }
    catch { return {ok:false,reason:"file-unavailable"}; }
    if (!response.ok) return {ok:false,reason:"file-missing"};
    const file = await response.blob();
    if (file.size < 1 || file.size > 262144) return {ok:false,reason:"image-size-limit"};

    const image = new Image();
    try {
        // Load the same chrome-extension:// URL that the Dashboard uses;
        // Local image URLs decode in a DOM context; the output is always normalized.
        image.src = url;
        await image.decode();
        const width = image.naturalWidth, height = image.naturalHeight;
        if (!width || !height || width > 4096 || height > 4096) {
            return {ok:false,reason:"image-dimensions"};
        }
        const canvas = document.createElement("canvas");
        canvas.width = TITLEBAR_ICON_SIZE;
        canvas.height = TITLEBAR_ICON_SIZE;
        const ctx = canvas.getContext("2d", {willReadFrequently:true});
        if (!ctx) return {ok:false,reason:"no-canvas"};
        const scale = Math.min(canvas.width / width, canvas.height / height);
        const w = width * scale, h = height * scale;
        ctx.drawImage(image, (canvas.width-w)/2, (canvas.height-h)/2, w, h);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // Detect a flat opaque image background (e.g. a colored logo tile).
        // Merely keeping alpha would turn text-on-tile into a solid gray box.
        const data = pixels.data;
        const pixelAt = (x,y) => (y*canvas.width+x)*4;
        const probes = [pixelAt(16,1),pixelAt(16,30),pixelAt(1,16),pixelAt(30,16)];
        const base = probes.map(i => [data[i],data[i+1],data[i+2],data[i+3]]);
        const flatBackground = base.every(p => p[3] > 230 &&
            Math.max(Math.abs(p[0]-base[0][0]),Math.abs(p[1]-base[0][1]),
                     Math.abs(p[2]-base[0][2])) < 20);
        // First determine if the background really contains a distinct symbol.
        let hasForeground = false;
        if (flatBackground) {
            for (let i=0; i<data.length; i+=4) {
                if (data[i+3] > 128 && Math.max(
                    Math.abs(data[i]-base[0][0]),Math.abs(data[i+1]-base[0][1]),
                    Math.abs(data[i+2]-base[0][2])) > 55) {
                    hasForeground = true;
                    break;
                }
            }
        }
        let nontransparent = 0;
        for (let i=0; i<data.length; i+=4) {
            if (flatBackground && hasForeground) {
                const difference = Math.max(
                    Math.abs(data[i]-base[0][0]),Math.abs(data[i+1]-base[0][1]),
                    Math.abs(data[i+2]-base[0][2]));
                data[i+3] = Math.round(data[i+3]*Math.min(1,difference/100));
            }
            if (data[i+3]) nontransparent++;
            // Never take the color from the source image or the theme.
            // All icon pixels remain the same neutral gray; only alpha varies.
            data[i] = 213;
            data[i+1] = 208;
            data[i+2] = 221;
        }
        if (!nontransparent) return {ok:false,reason:"empty-image"};
        ctx.putImageData(pixels,0,0);
        const pngBase64=canvas.toDataURL("image/png").split(",",2)[1] || "";
        if (!pngBase64 || pngBase64.length > TITLEBAR_ICON_B64_LIMIT)
            return {ok:false,reason:"png-size-limit"};
        return {ok:true,pngBase64};
    } catch {
        return {ok:false,reason:"image-render-failed"};
    }
}

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
    if (message?.target !== "stream-shell-titlebar-svg-offscreen") return;
    if (sender.id !== chrome.runtime.id || message.type !== "titlebar-render-icon") {
        sendResponse({ok:false,reason:"unauthorized"});
        return;
    }
    convertTitlebarArtworkToPng(message.path)
        .then(sendResponse)
        .catch(()=>sendResponse({ok:false,reason:"render-exception"}));
    return true;
});
