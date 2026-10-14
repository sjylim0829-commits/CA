const STORAGE_KEY = 'plant_activity_report_v1';

// 주요 DOM 요소
const reportPaper = document.getElementById('report-paper');
const autosaveStatus = document.getElementById('autosave-status');
const footerDateStamp = document.getElementById('footer-date-stamp');
const toastEl = document.getElementById('toast');

// 입력 필드 목록
const fieldIds = [
  'student-grade',
  'student-class',
  'student-number',
  'student-name',
  'plant-species',
  'plant-nickname',
  'start-year',
  'start-month',
  'start-day',
  'end-year',
  'end-month',
  'end-day',
  'q-environment',
  'q-role',
  'q-proud',
  'q-difficulty',
  'q-reflection',
];

// 미디어 탭 (사진 / 그림)
let currentMediaMode = 'photo'; // 'photo' | 'draw'
const mediaTabs = document.querySelectorAll('.media-tab');
const photoPanel = document.getElementById('photo-mode-panel');
const drawPanel = document.getElementById('draw-mode-panel');

// 사진 업로드 관련 요소
const photoInput = document.getElementById('photo-input');
const photoDropzone = document.getElementById('photo-dropzone');
const photoPlaceholder = document.getElementById('photo-placeholder');
const photoPreview = document.getElementById('photo-preview');
const photoControls = document.getElementById('photo-controls');
const btnChangePhoto = document.getElementById('btn-change-photo');
const btnRemovePhoto = document.getElementById('btn-remove-photo');

// 그림 그리기 캔버스 관련 요소
const canvas = document.getElementById('draw-canvas');
const ctx = canvas.getContext('2d');
const colorSwatches = document.querySelectorAll('.color-swatch');
const customColorPicker = document.getElementById('custom-color-picker');
const brushSizeInput = document.getElementById('brush-size');
const btnEraser = document.getElementById('btn-eraser');
const btnUndoCanvas = document.getElementById('btn-undo-canvas');
const btnClearCanvas = document.getElementById('btn-clear-canvas');

let isDrawing = false;
let isEraser = false;
let brushColor = '#2e7d32';
let brushSize = 6;
let undoStack = [];
const MAX_UNDO = 15;

// 모달 관련 요소
const resultModal = document.getElementById('result-modal');
const generatedReportImg = document.getElementById('generated-report-img');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnModalDownload = document.getElementById('btn-modal-download');
const btnModalCopy = document.getElementById('btn-modal-copy');
const btnModalShare = document.getElementById('btn-modal-share');

let lastGeneratedBlob = null;
let lastGeneratedDataUrl = null;

// 초기화 실행
document.addEventListener('DOMContentLoaded', () => {
  initFooterDate();
  initCanvas();
  loadSavedData();
  bindEvents();
  syncAllTextMirrors();
});

function initFooterDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  footerDateStamp.textContent = `작성일: ${y}. ${m}. ${d}.`;

  // 종료일 기본값이 비어 있으면 오늘 날짜로 세팅
  const endMonthEl = document.getElementById('end-month');
  const endDayEl = document.getElementById('end-day');
  if (!endMonthEl.value) endMonthEl.value = now.getMonth() + 1;
  if (!endDayEl.value) endDayEl.value = now.getDate();
}

// 토스트 메시지 표시
let toastTimer = null;
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 3000);
}

// 텍스트 영역 자동 높이 조절 및 캡처용 미러 동기화
function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.max(88, textarea.scrollHeight) + 'px';
  const mirror = document.querySelector(`.capture-text-mirror[data-for="${textarea.id}"]`);
  if (mirror) {
    mirror.textContent = textarea.value || ' ';
  }
}

function syncAllTextMirrors() {
  document.querySelectorAll('.report-textarea').forEach((ta) => {
    autoResizeTextarea(ta);
  });
}

// 미디어 모드 전환
function setMediaMode(mode) {
  currentMediaMode = mode;
  mediaTabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });
  photoPanel.classList.toggle('active', mode === 'photo');
  drawPanel.classList.toggle('active', mode === 'draw');
  saveData();
}

// 사진 파일 처리 (리사이즈 후 DataURL 변환하여 용량 최적화)
function handlePhotoFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('⚠️ 이미지 파일만 올릴 수 있어요.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1200;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tCtx = tempCanvas.getContext('2d');
      tCtx.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = tempCanvas.toDataURL('image/jpeg', 0.88);
      setPhotoPreview(compressedDataUrl);
      saveData();
      showToast('📸 화분 사진이 등록되었어요!');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function setPhotoPreview(dataUrl) {
  if (dataUrl) {
    photoPreview.src = dataUrl;
    photoPreview.classList.remove('hidden');
    photoPlaceholder.classList.add('hidden');
    photoControls.classList.remove('hidden');
  } else {
    photoPreview.removeAttribute('src');
    photoPreview.classList.add('hidden');
    photoPlaceholder.classList.remove('hidden');
    photoControls.classList.add('hidden');
  }
}

// 캔버스 초기화 및 그리기 기능
function initCanvas() {
  fillCanvasWhite();
  saveCanvasHistory();

  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches && e.touches[0]) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    isDrawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const moveDraw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = isEraser ? '#ffffff' : brushColor;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => {
    if (!isDrawing) return;
    isDrawing = false;
    ctx.closePath();
    saveCanvasHistory();
    saveData();
  };

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', moveDraw);
  window.addEventListener('mouseup', endDraw);

  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', moveDraw, { passive: false });
  window.addEventListener('touchend', endDraw);
}

function fillCanvasWhite() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function saveCanvasHistory() {
  if (undoStack.length >= MAX_UNDO) {
    undoStack.shift();
  }
  undoStack.push(canvas.toDataURL('image/png'));
}

// 로컬 스토리지 자동 저장 및 복원
function saveData() {
  try {
    const data = {
      mediaMode: currentMediaMode,
      photoDataUrl: photoPreview.getAttribute('src') || '',
      canvasDataUrl: canvas.toDataURL('image/png'),
      fields: {},
    };
    fieldIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) data.fields[id] = el.value;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    autosaveStatus.textContent = '자동 저장됨 ✓';
  } catch (err) {
    console.warn('자동 저장 용량 초과 또는 오류:', err);
  }
}

function loadSavedData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);

    if (data.fields) {
      fieldIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el && data.fields[id] !== undefined && data.fields[id] !== '') {
          el.value = data.fields[id];
        }
      });
    }

    if (data.photoDataUrl) {
      setPhotoPreview(data.photoDataUrl);
    }

    if (data.canvasDataUrl) {
      const img = new Image();
      img.onload = () => {
        fillCanvasWhite();
        ctx.drawImage(img, 0, 0);
        undoStack = [canvas.toDataURL('image/png')];
      };
      img.src = data.canvasDataUrl;
    }

    if (data.mediaMode) {
      setMediaMode(data.mediaMode);
    }
  } catch (err) {
    console.warn('저장된 데이터 불러오기 실패:', err);
  }
}

// 파일명 생성 함수
function getReportFileName() {
  const grade = document.getElementById('student-grade').value.trim();
  const cls = document.getElementById('student-class').value.trim();
  const num = document.getElementById('student-number').value.trim();
  const name = document.getElementById('student-name').value.trim() || '학생';

  const prefixParts = ['[1학급1화분]'];
  if (grade || cls || num) {
    prefixParts.push(`${grade || '0'}학년${cls || '0'}반${num || '0'}번`);
  }
  prefixParts.push(name);
  prefixParts.push('활동결과보고서.png');
  return prefixParts.join('_');
}

// html2canvas로 보고서 화면을 고화질 이미지로 생성
async function captureReportImage() {
  syncAllTextMirrors();
  reportPaper.classList.add('capturing');

  // 렌더링 반영 대기
  await new Promise((r) => setTimeout(r, 80));

  try {
    const capturedCanvas = await html2canvas(reportPaper, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      windowWidth: Math.max(document.documentElement.clientWidth, 880),
    });

    lastGeneratedDataUrl = capturedCanvas.toDataURL('image/png');
    lastGeneratedBlob = await new Promise((resolve) =>
      capturedCanvas.toBlob((blob) => resolve(blob), 'image/png')
    );

    generatedReportImg.src = lastGeneratedDataUrl;
    return { blob: lastGeneratedBlob, dataUrl: lastGeneratedDataUrl };
  } finally {
    reportPaper.classList.remove('capturing');
  }
}

// 기기에 이미지 파일 다운로드 실행
function triggerDownload(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Web Share API로 이미지 파일 공유 실행
async function shareGeneratedImage() {
  if (!lastGeneratedBlob) {
    await captureReportImage();
  }

  const filename = getReportFileName();
  const file = new File([lastGeneratedBlob], filename, { type: 'image/png' });
  const studentName = document.getElementById('student-name').value.trim() || '학생';
  const plantNickname = document.getElementById('plant-nickname').value.trim();

  const shareData = {
    title: '🪴 [1학급 1화분 키우기] 활동 결과 보고서',
    text: `${studentName}의 [1학급 1화분 키우기] 활동 결과 보고서${plantNickname ? ` (${plantNickname})` : ''}입니다.`,
    files: [file],
  };

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share(shareData);
      showToast('📤 공유 창을 열었어요!');
      return true;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('파일 공유 실패:', err);
      }
      return false;
    }
  } else {
    // 파일 직접 공유를 지원하지 않는 데스크톱 브라우저의 경우 클립보드 복사 시도
    const copied = await copyImageToClipboard();
    if (copied) {
      showToast('📋 이미지가 클립보드에 복사되었어요! 원하는 곳(클래스룸, 패들렛, 메신저)에 붙여넣기(Ctrl+V) 하세요.');
    } else {
      showToast('💡 이 브라우저에서는 파일 직접 공유 대신 [내 기기에 이미지 저장] 후 업로드해 주세요.');
    }
    return false;
  }
}

// 클립보드에 이미지 복사
async function copyImageToClipboard() {
  try {
    if (!lastGeneratedBlob) {
      await captureReportImage();
    }
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': lastGeneratedBlob }),
      ]);
      showToast('📋 보고서 이미지가 클립보드에 복사되었습니다! (Ctrl+V로 붙여넣기 가능)');
      return true;
    }
  } catch (err) {
    console.warn('클립보드 복사 실패:', err);
  }
  showToast('⚠️ 클립보드 복사를 지원하지 않는 환경입니다. 이미지를 저장해 주세요.');
  return false;
}

// 이벤트 바인딩
function bindEvents() {
  // 모든 입력창 변경 시 자동 저장
  fieldIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      if (el.classList.contains('report-textarea')) {
        autoResizeTextarea(el);
      }
      saveData();
    });
  });

  // 미디어 탭 전환
  mediaTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      setMediaMode(tab.dataset.mode);
    });
  });

  // 사진 업로드 이벤트
  photoDropzone.addEventListener('click', () => {
    photoInput.click();
  });

  btnChangePhoto.addEventListener('click', () => {
    photoInput.click();
  });

  btnRemovePhoto.addEventListener('click', () => {
    photoInput.value = '';
    setPhotoPreview('');
    saveData();
    showToast('🗑️ 사진을 지웠어요.');
  });

  photoInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handlePhotoFile(e.target.files[0]);
    }
  });

  photoDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    photoDropzone.classList.add('dragover');
  });

  photoDropzone.addEventListener('dragleave', () => {
    photoDropzone.classList.remove('dragover');
  });

  photoDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    photoDropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePhotoFile(e.dataTransfer.files[0]);
    }
  });

  // 그리기 도구 이벤트
  colorSwatches.forEach((swatch) => {
    swatch.addEventListener('click', () => {
      isEraser = false;
      btnEraser.classList.remove('btn-primary');
      btnEraser.classList.add('btn-outline');
      colorSwatches.forEach((s) => s.classList.remove('active'));
      swatch.classList.add('active');
      brushColor = swatch.dataset.color;
      customColorPicker.value = brushColor;
    });
  });

  customColorPicker.addEventListener('input', (e) => {
    isEraser = false;
    btnEraser.classList.remove('btn-primary');
    btnEraser.classList.add('btn-outline');
    colorSwatches.forEach((s) => s.classList.remove('active'));
    brushColor = e.target.value;
  });

  brushSizeInput.addEventListener('input', (e) => {
    brushSize = Number(e.target.value);
  });

  btnEraser.addEventListener('click', () => {
    isEraser = !isEraser;
    btnEraser.classList.toggle('btn-primary', isEraser);
    btnEraser.classList.toggle('btn-outline', !isEraser);
  });

  btnUndoCanvas.addEventListener('click', () => {
    if (undoStack.length > 1) {
      undoStack.pop();
      const prevDataUrl = undoStack[undoStack.length - 1];
      const img = new Image();
      img.onload = () => {
        fillCanvasWhite();
        ctx.drawImage(img, 0, 0);
        saveData();
      };
      img.src = prevDataUrl;
    } else {
      showToast('더 이상 되돌릴 수 없어요.');
    }
  });

  btnClearCanvas.addEventListener('click', () => {
    if (confirm('그린 그림을 모두 지울까요?')) {
      fillCanvasWhite();
      saveCanvasHistory();
      saveData();
      showToast('🎨 도화지를 깨끗하게 지웠어요.');
    }
  });

  // 초기화 버튼
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (!confirm('작성한 모든 내용과 사진/그림을 처음 상태로 초기화할까요?')) return;
    localStorage.removeItem(STORAGE_KEY);
    fieldIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('start-year').value = '2026';
    document.getElementById('end-year').value = '2026';
    initFooterDate();
    setPhotoPreview('');
    fillCanvasWhite();
    undoStack = [canvas.toDataURL('image/png')];
    setMediaMode('photo');
    syncAllTextMirrors();
    showToast('🔄 모든 내용이 초기화되었습니다.');
  });

  // 1) 이미지 저장 버튼 (상단 & 하단)
  const handleSaveOnly = async () => {
    showToast('📸 보고서 이미지를 생성하고 있어요...');
    const { dataUrl } = await captureReportImage();
    const filename = getReportFileName();
    triggerDownload(dataUrl, filename);
    resultModal.classList.remove('hidden');
    showToast('💾 기기에 보고서 이미지가 저장되었어요!');
  };

  document.getElementById('btn-save-image').addEventListener('click', handleSaveOnly);
  document.getElementById('btn-bottom-save').addEventListener('click', handleSaveOnly);

  // 2) 이미지 저장 후 공유 버튼 (상단 & 하단)
  const handleSaveAndShare = async () => {
    showToast('📸 보고서 이미지를 저장하고 공유 준비 중이에요...');
    const { dataUrl } = await captureReportImage();
    const filename = getReportFileName();
    // 먼저 기기에 이미지 자동 저장
    triggerDownload(dataUrl, filename);
    // 미리보기 모달 표시
    resultModal.classList.remove('hidden');
    // 공유 창 호출
    await shareGeneratedImage();
  };

  document.getElementById('btn-share-image').addEventListener('click', handleSaveAndShare);
  document.getElementById('btn-bottom-share').addEventListener('click', handleSaveAndShare);

  // 3) 보고서 제출(완성) 버튼 (상단 & 하단)
  const handleSubmitReport = async () => {
    const name = document.getElementById('student-name').value.trim();
    const qEnv = document.getElementById('q-environment').value.trim();
    const qRef = document.getElementById('q-reflection').value.trim();

    if (!name || !qEnv || !qRef) {
      const proceed = confirm(
        '아직 작성하지 않은 항목(이름 또는 활동 내용/소감)이 있습니다.\n그래도 현재 화면으로 보고서 이미지를 완성할까요?'
      );
      if (!proceed) return;
    }

    showToast('✨ 보고서를 이미지로 제작하고 있어요...');
    const { dataUrl } = await captureReportImage();
    const filename = getReportFileName();
    triggerDownload(dataUrl, filename);
    resultModal.classList.remove('hidden');
    showToast('🎉 보고서 이미지가 저장되었습니다! 공유 버튼으로 제출해 보세요.');
  };

  document.getElementById('btn-submit').addEventListener('click', handleSubmitReport);
  document.getElementById('btn-bottom-submit').addEventListener('click', handleSubmitReport);

  // 모달 내부 버튼
  btnCloseModal.addEventListener('click', () => {
    resultModal.classList.add('hidden');
  });

  resultModal.addEventListener('click', (e) => {
    if (e.target === resultModal) {
      resultModal.classList.add('hidden');
    }
  });

  btnModalDownload.addEventListener('click', () => {
    if (lastGeneratedDataUrl) {
      triggerDownload(lastGeneratedDataUrl, getReportFileName());
      showToast('💾 이미지를 다시 다운로드했어요!');
    }
  });

  btnModalCopy.addEventListener('click', () => {
    copyImageToClipboard();
  });

  btnModalShare.addEventListener('click', () => {
    shareGeneratedImage();
  });
}
