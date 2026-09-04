const input = document.querySelector("#image-input");
const fileZone = document.querySelector("#file-zone");
const selection = document.querySelector("#selection");
const selectionCount = document.querySelector("#selection-count");
const previewList = document.querySelector("#preview-list");
const clearButton = document.querySelector("#clear-button");
const uploadButton = document.querySelector("#upload-button");
const progress = document.querySelector("#progress");
const progressBar = document.querySelector("#progress-bar");
const progressTrack = document.querySelector(".progress__track");
const progressLabel = document.querySelector("#progress-label");
const progressPercent = document.querySelector("#progress-percent");
const message = document.querySelector("#message");
const drawTab = document.querySelector("#draw-tab");
const fileTab = document.querySelector("#file-tab");
const drawPanel = document.querySelector("#draw-panel");
const filePanel = document.querySelector("#file-panel");
const canvas = document.querySelector("#drawing-canvas");
const context = canvas.getContext("2d", { willReadFrequently: true });
const canvasHint = document.querySelector("#canvas-hint");
const brushColor = document.querySelector("#brush-color");
const brushSize = document.querySelector("#brush-size");
const brushSizeOutput = document.querySelector("#brush-size-output");
const penTool = document.querySelector("#pen-tool");
const eraserTool = document.querySelector("#eraser-tool");
const undoButton = document.querySelector("#undo-button");
const clearCanvasButton = document.querySelector("#clear-canvas-button");
const addDrawingButton = document.querySelector("#add-drawing-button");

let selectedFiles = [];
let previewUrls = [];
let drawing = false;
let drawingHasContent = false;
let activeTool = "pen";
let history = [];

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function clearPreviewUrls() {
  previewUrls.forEach((url) => URL.revokeObjectURL(url));
  previewUrls = [];
}

function renderSelection() {
  clearPreviewUrls();
  previewList.replaceChildren();

  if (!selectedFiles.length) {
    selection.hidden = true;
    uploadButton.disabled = true;
    return;
  }

  selection.hidden = false;
  uploadButton.disabled = false;
  selectionCount.textContent = `${selectedFiles.length}장 전송 대기`;

  selectedFiles.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    previewUrls.push(url);

    const item = document.createElement("article");
    item.className = "preview-item";
    item.innerHTML = `
      <img src="${url}" alt="" />
      <div class="preview-item__text">
        <strong></strong>
        <small>${formatBytes(file.size)}</small>
      </div>
      <button type="button" aria-label="선택에서 제거">×</button>
    `;
    item.querySelector("strong").textContent = file.name;
    item.querySelector("button").addEventListener("click", () => {
      selectedFiles.splice(index, 1);
      renderSelection();
    });
    previewList.append(item);
  });
}

function resetStatus() {
  message.hidden = true;
  message.className = "message";
  progress.hidden = true;
  setProgress(0);
}

function setProgress(value) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  progressBar.style.width = `${percent}%`;
  progressPercent.textContent = `${percent}%`;
  progressTrack.setAttribute("aria-valuenow", String(percent));
}

function showMessage(type, title, details = []) {
  message.className = `message message--${type}`;
  message.replaceChildren();
  const heading = document.createElement("strong");
  heading.textContent = title;
  message.append(heading);

  if (details.length) {
    const list = document.createElement("ul");
    details.forEach((detail) => {
      const item = document.createElement("li");
      item.textContent = detail;
      list.append(item);
    });
    message.append(list);
  }
  message.hidden = false;
}

function updateDrawingButtons() {
  undoButton.disabled = history.length === 0;
  clearCanvasButton.disabled = !drawingHasContent;
  addDrawingButton.disabled = !drawingHasContent;
  canvasHint.hidden = drawingHasContent;
}

function setBusy(isBusy) {
  input.disabled = isBusy;
  clearButton.disabled = isBusy;
  uploadButton.disabled = isBusy || !selectedFiles.length;
  fileZone.classList.toggle("is-disabled", isBusy);
  document.querySelectorAll(".drawing-controls button, .drawing-controls input, #add-drawing-button")
    .forEach((control) => { control.disabled = isBusy; });
  if (!isBusy) updateDrawingButtons();
}

input.addEventListener("change", () => {
  selectedFiles.push(...Array.from(input.files || []));
  input.value = "";
  resetStatus();
  renderSelection();
});

clearButton.addEventListener("click", () => {
  selectedFiles = [];
  input.value = "";
  resetStatus();
  renderSelection();
});

uploadButton.addEventListener("click", () => {
  if (!selectedFiles.length) return;

  const data = new FormData();
  selectedFiles.forEach((file) => data.append("images", file, file.name));
  data.append("destination", document.querySelector('input[name="destination"]:checked').value);

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/upload");
  xhr.responseType = "json";
  setBusy(true);
  message.hidden = true;
  progress.hidden = false;
  progressLabel.textContent = `${selectedFiles.length}장 전송 중…`;
  setProgress(0);

  xhr.upload.addEventListener("progress", (event) => {
    if (event.lengthComputable) setProgress((event.loaded / event.total) * 100);
  });

  xhr.addEventListener("load", () => {
    setBusy(false);
    setProgress(100);
    const body = xhr.response || {};
    const saved = Array.isArray(body.saved) ? body.saved : [];
    const rejected = Array.isArray(body.rejected) ? body.rejected : [];

    if (saved.length) {
      const folder = saved[0].folder;
      const details = rejected.map((item) => `${item.name}: ${item.reason}`);
      showMessage(rejected.length ? "warning" : "success", `${body.message} (${folder} 폴더)`, details);
      selectedFiles = [];
      input.value = "";
      renderSelection();
    } else {
      const details = rejected.map((item) => `${item.name}: ${item.reason}`);
      showMessage("error", body.message || "업로드하지 못했습니다.", details);
    }
  });

  xhr.addEventListener("error", () => {
    setBusy(false);
    progress.hidden = true;
    showMessage("error", "PC 서버에 연결할 수 없습니다. Wi-Fi 연결과 서버 실행 상태를 확인해 주세요.");
  });

  xhr.addEventListener("abort", () => {
    setBusy(false);
    progress.hidden = true;
    showMessage("error", "전송이 취소되었습니다.");
  });

  xhr.send(data);
});

function selectMode(mode) {
  const drawingMode = mode === "draw";
  drawTab.setAttribute("aria-selected", String(drawingMode));
  fileTab.setAttribute("aria-selected", String(!drawingMode));
  drawPanel.hidden = !drawingMode;
  filePanel.hidden = drawingMode;
}

drawTab.addEventListener("click", () => selectMode("draw"));
fileTab.addEventListener("click", () => selectMode("file"));

function canvasPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
    y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
  };
}

function saveCanvasState() {
  history.push({
    image: context.getImageData(0, 0, canvas.width, canvas.height),
    hasContent: drawingHasContent,
  });
  if (history.length > 10) history.shift();
  updateDrawingButtons();
}

function beginStroke(event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  saveCanvasState();
  drawing = true;
  drawingHasContent = true;

  const point = canvasPoint(event);
  context.beginPath();
  context.moveTo(point.x, point.y);
  context.lineTo(point.x + 0.01, point.y + 0.01);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = Number(brushSize.value);
  context.strokeStyle = brushColor.value;
  context.globalCompositeOperation = activeTool === "eraser" ? "destination-out" : "source-over";
  context.stroke();
  updateDrawingButtons();
}

function continueStroke(event) {
  if (!drawing) return;
  event.preventDefault();
  const point = canvasPoint(event);
  context.lineTo(point.x, point.y);
  context.stroke();
}

function endStroke(event) {
  if (!drawing) return;
  event.preventDefault();
  drawing = false;
  context.closePath();
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}

canvas.addEventListener("pointerdown", beginStroke);
canvas.addEventListener("pointermove", continueStroke);
canvas.addEventListener("pointerup", endStroke);
canvas.addEventListener("pointercancel", endStroke);

brushSize.addEventListener("input", () => {
  brushSizeOutput.value = brushSize.value;
  brushSizeOutput.textContent = brushSize.value;
});

function chooseTool(tool) {
  activeTool = tool;
  penTool.setAttribute("aria-pressed", String(tool === "pen"));
  eraserTool.setAttribute("aria-pressed", String(tool === "eraser"));
  canvas.classList.toggle("is-erasing", tool === "eraser");
}

penTool.addEventListener("click", () => chooseTool("pen"));
eraserTool.addEventListener("click", () => chooseTool("eraser"));

undoButton.addEventListener("click", () => {
  const previous = history.pop();
  if (!previous) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.putImageData(previous.image, 0, 0);
  drawingHasContent = previous.hasContent;
  updateDrawingButtons();
});

clearCanvasButton.addEventListener("click", () => {
  if (!drawingHasContent) return;
  saveCanvasState();
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawingHasContent = false;
  updateDrawingButtons();
});

function drawingFilename() {
  const now = new Date();
  const part = (value) => String(value).padStart(2, "0");
  return `drawing_${now.getFullYear()}${part(now.getMonth() + 1)}${part(now.getDate())}_${part(now.getHours())}${part(now.getMinutes())}${part(now.getSeconds())}.png`;
}

addDrawingButton.addEventListener("click", () => {
  if (!drawingHasContent) return;
  canvas.toBlob((blob) => {
    if (!blob) {
      showMessage("error", "그림을 이미지로 만들지 못했습니다. 다시 시도해 주세요.");
      return;
    }
    selectedFiles.push(new File([blob], drawingFilename(), { type: "image/png" }));
    resetStatus();
    renderSelection();
    history = [];
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawingHasContent = false;
    updateDrawingButtons();
    showMessage("success", "그림을 전송 목록에 추가했습니다. 계속 그리거나 PC로 전송하세요.");
  }, "image/png");
});

window.addEventListener("beforeunload", clearPreviewUrls);
updateDrawingButtons();
