

pdfjsLib.GlobalWorkerOptions.workerSrc =
'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let originalPdfBytes = null;
let pdfDocument = null;

let stampImageData = null;

let currentX = 50;
let currentY = 50;

const pdfInput = document.getElementById("pdfInput");
const imageInput = document.getElementById("imageInput");
const pagesDiv = document.getElementById("pages");
const stamp = document.getElementById("stamp");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageIndicator = document.getElementById("pageIndicator");

let firstCanvas = null;
let currentPage = 1;

pdfInput.addEventListener("change", async function(e){

    const file = e.target.files[0];

    if(!file) return;

    const pdfArrayBuffer = await file.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfArrayBuffer);

    originalPdfBytes = pdfBytes.slice();

    pdfDocument = await pdfjsLib.getDocument({
        data: pdfBytes
    }).promise;

    renderPdf();

});

async function renderPdf(){
    if(!pdfDocument) return;

    currentPage = 1;
    await renderPage(currentPage);
    updatePageIndicator();
}

async function renderPage(pageNum){
    pagesDiv.innerHTML = "";
    firstCanvas = null;

    const page = await pdfDocument.getPage(pageNum);
    const viewport = page.getViewport({
        scale: 1.5
    });

    const wrapper = document.createElement("div");
    wrapper.className = "page-wrapper";

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    wrapper.appendChild(canvas);
    pagesDiv.appendChild(wrapper);

    await page.render({
        canvasContext: ctx,
        viewport: viewport
    }).promise;

    firstCanvas = canvas;
    wrapper.appendChild(stamp);
    stamp.style.left = currentX + "px";
    stamp.style.top = currentY + "px";
}

function updatePageIndicator(){
    if(!pdfDocument){
        pageIndicator.textContent = "Page 0 / 0";
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;
        return;
    }

    pageIndicator.textContent = `Page ${currentPage} / ${pdfDocument.numPages}`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= pdfDocument.numPages;
}

imageInput.addEventListener("change", function(e){

    const file = e.target.files[0];

    if(!file) return;

    const reader = new FileReader();

    reader.onload = function(ev){

        stamp.src = ev.target.result;
        stampImageData = ev.target.result;

        stamp.style.display = "block";
    };

    reader.readAsDataURL(file);

});

let dragging = false;
let offsetX = 0;
let offsetY = 0;

stamp.addEventListener("mousedown", function(e){

    dragging = true;

    offsetX = e.offsetX;
    offsetY = e.offsetY;

});

document.addEventListener("mousemove", function(e){

    if(!dragging) return;

    const parentRect =
        stamp.parentElement.getBoundingClientRect();

    currentX =
        e.clientX - parentRect.left - offsetX;

    currentY =
        e.clientY - parentRect.top - offsetY;

    stamp.style.left = currentX + "px";
    stamp.style.top = currentY + "px";

});

document.addEventListener("mouseup", function(){

    dragging = false;

});

prevPageBtn.addEventListener("click", async function(){
    if(!pdfDocument || currentPage <= 1) return;
    currentPage--;
    await renderPage(currentPage);
    updatePageIndicator();
});

nextPageBtn.addEventListener("click", async function(){
    if(!pdfDocument || currentPage >= pdfDocument.numPages) return;
    currentPage++;
    await renderPage(currentPage);
    updatePageIndicator();
});

document.getElementById("downloadBtn")
.addEventListener("click", async function(){

    if(!originalPdfBytes){

        alert("Upload PDF First");
        return;
    }

    if(!stampImageData){

        alert("Upload Signature Image First");
        return;
    }

    let pdfDoc;

    try {
        pdfDoc = await PDFLib.PDFDocument.load(
            new Uint8Array(originalPdfBytes)
        );
    } catch (err) {
        alert("Unable to load PDF for download. Please re-upload the PDF and try again.");
        console.error(err);
        return;
    }

    const pages = pdfDoc.getPages();

    const imageBytes = await fetch(stampImageData)
        .then(r => r.arrayBuffer());

    let embeddedImage;

    if (stampImageData.includes("image/png")) {
        embeddedImage = await pdfDoc.embedPng(imageBytes);
    } else {
        embeddedImage = await pdfDoc.embedJpg(imageBytes);
    }

    if (!firstCanvas) {
        alert("Unable to compute stamp position. Please upload the PDF again.");
        return;
    }

    const canvasRect = firstCanvas.getBoundingClientRect();
    const stampRect = stamp.getBoundingClientRect();

    const displayWidth = canvasRect.width;
    const displayHeight = canvasRect.height;

    if (!displayWidth || !displayHeight) {
        alert("Unable to compute the preview size. Re-upload the PDF and try again.");
        return;
    }

    const stampOffsetX = stampRect.left - canvasRect.left;
    const stampOffsetY = stampRect.top - canvasRect.top;
    const stampDisplayWidth = stampRect.width;
    const stampDisplayHeight = stampRect.height;

    pages.forEach(page => {
        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();

        const pdfX = (stampOffsetX / displayWidth) * pageWidth;
        const pdfY = pageHeight - ((stampOffsetY / displayHeight) * pageHeight) - (stampDisplayHeight / displayHeight) * pageHeight;
        const pdfWidth = (stampDisplayWidth / displayWidth) * pageWidth;
        const pdfHeight = (stampDisplayHeight / displayHeight) * pageHeight;

        page.drawImage(embeddedImage, {
            x: pdfX,
            y: pdfY,
            width: pdfWidth,
            height: pdfHeight
        });
    });

    const modifiedPdf =
        await pdfDoc.save();

    const blob =
        new Blob(
            [modifiedPdf],
            {
                type:"application/pdf"
            }
        );

    const url =
        URL.createObjectURL(blob);

    const a =
        document.createElement("a");

    a.href = url;
    a.download = "Stamped_PDF.pdf";

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);

});

