// checkin.js
// 🔗 URL /exec do Apps Script
const API = "https://script.google.com/macros/s/AKfycbyrdhKxha2J5QDerL0h-beXu_BykQZ52sRYpd-ydgqGnJoTJCgp2aF2UDV_iRJ6TXVsqA/exec";

// Código da URL (?c=...)
const qs = new URLSearchParams(location.search);
const codigoUrl = (qs.get('c') || '').trim() || 'SEM-CODIGO';
document.getElementById('pill').textContent = 'Código: ' + codigoUrl;

// Seletores
const video = document.getElementById('video');
const startBtn = document.getElementById('start');
const stopBtn  = document.getElementById('stop');
const statusEl = document.getElementById('status');

const backdrop   = document.getElementById('backdrop');
const mEmail     = document.getElementById('mEmail');
const mCodigo    = document.getElementById('mCodigo');
const mTs        = document.getElementById('mTs');
const modalBadge = document.getElementById('modalBadge');
const btnCancelar   = document.getElementById('btnCancelar');
const btnConfirmar  = document.getElementById('btnConfirmar');
const modalInfo  = document.getElementById('modalInfo');
const toast      = document.getElementById('toast');

// Estado
let stream = null;
let running = false;
let modalOpen = false;
let lastPayload = null;
let scanningTimer = null;
const SCAN_INTERVAL = 250;          // ms entre leituras
const RESCAN_COOLDOWN_MS = 350;     // antiretrigger
let nextAllowedScanTs = 0;

// Canvas para leitura do QR
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

// Utilidades UI
function showToast(txt, ok = true, ms = 2000) {
  toast.style.background = ok ? '#0e9f6e' : '#dc2626';
  toast.textContent = txt;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), ms);
}

function setConfirmBusy(busy) {
  if (busy) {
    btnConfirmar.dataset._oldText = btnConfirmar.textContent;
    btnConfirmar.textContent = 'Confirmando…';
    btnConfirmar.disabled = true;
  } else {
    btnConfirmar.textContent = btnConfirmar.dataset._oldText || 'Confirmar presença';
    btnConfirmar.disabled = false;
  }
}

// Modal
function openModal(email, codigo){
  modalOpen = true;
  mEmail.textContent = email || '—';
  mCodigo.textContent = codigo || '—';
  mTs.textContent = new Date().toLocaleString();
  modalBadge.textContent = 'Palestra: ' + (codigo || '—');
  modalInfo.textContent = '';
  // Pausa somente a varredura — câmera continua aberta
  pauseScanning();
  backdrop.classList.add('show');
  backdrop.setAttribute('aria-hidden','false');
}
function closeModal(){
  modalOpen = false;
  backdrop.classList.remove('show');
  backdrop.setAttribute('aria-hidden','true');
  lastPayload = null; // permite novo QR
  nextAllowedScanTs = Date.now() + RESCAN_COOLDOWN_MS;
  resumeScanning();
}

// Scanner (intervalo)
function startScanning(){
  if (scanningTimer) return;
  scanningTimer = setInterval(scanTick, SCAN_INTERVAL);
}
function pauseScanning(){
  if (scanningTimer) { clearInterval(scanningTimer); scanningTimer = null; }
}
function resumeScanning(){
  if (running && !modalOpen) startScanning();
}
function stopScanning(){
  pauseScanning();
}

// Leitura de um frame
function scanTick(){
  if (!running || modalOpen) return;
  if (Date.now() < nextAllowedScanTs) return;

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const qr = jsQR(img.data, img.width, img.height, { inversionAttempts:'dontInvert' });

    if (qr && qr.data) {
      const parts = (qr.data || '').trim().split('|');
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        statusEl.innerHTML = '<span class="err"><b>Erro: QRCode Invalido</b></span> — <span class="muted">Situação: QrCode com o formato inválido</span>';
      } else {
        const email = parts[0];
        const codigo = parts[1];

        if (codigo !== codigoUrl) {
          statusEl.innerHTML = '<span class="err"><b>Erro: QrCode Palestra nao encontrada</b></span> — <span class="muted">Situação: Está no formato correto porém com o código errado</span>';
        } else {
          const payload = `${email}|${codigo}`;
          if (payload !== lastPayload) {
            lastPayload = payload;
            statusEl.innerHTML = '<span class="ok">QR detectado</span>';
            openModal(email, codigo);
          }
        }
      }
      nextAllowedScanTs = Date.now() + RESCAN_COOLDOWN_MS;
    }
  }
}

// Câmera
async function startCam(){
  try{
    if (running) return;
    statusEl.textContent = 'Abrindo câmera…';

    // reutiliza stream se possível
    const active = stream && stream.getTracks && stream.getTracks().some(t => t.readyState === 'live');
    if (!active) {
      stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' } });
    }
    video.srcObject = stream;
    await video.play().catch(()=>{});
    running = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusEl.textContent = 'Câmera ativa…';

    resumeScanning();
  }catch(e){
    console.error(e);
    statusEl.innerHTML = '<span class="err">Erro ao abrir câmera</span>';
  }
}
function stopCam(){
  running = false;
  stopScanning();
  if (video) {
    video.pause();
    video.srcObject = null;
  }
  if (stream && stream.getTracks) {
    stream.getTracks().forEach(t => t.stop());
  }
  stream = null;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  statusEl.textContent = 'Parado.';
}

// Eventos básicos
startBtn.onclick = startCam;
stopBtn.onclick  = stopCam;
backdrop.addEventListener('click',(e)=>{ if(e.target===backdrop) closeModal(); });
window.addEventListener('keydown',(e)=>{ if(e.key==='Escape') closeModal(); });

// Visibilidade da aba (pausa/resume suave)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseScanning();
    statusEl.textContent = 'Pausado (aba oculta)…';
  } else {
    nextAllowedScanTs = Date.now() + RESCAN_COOLDOWN_MS;
    resumeScanning();
    if (running) statusEl.textContent = 'Câmera ativa…';
  }
});

// Confirmar presença
btnConfirmar.addEventListener('click', async ()=>{
  setConfirmBusy(true);
  modalInfo.textContent = 'Registrando presença…';
  try{
    const email = mEmail.textContent.trim();
    const body = new URLSearchParams({
      action:'presenca',
      codigoPalestra: codigoUrl,
      email
    }).toString();

    const resp = await fetch(API, {
      method:'POST',
      headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      body
    });
    const data = await resp.json();

    if (!data.ok) {
      modalInfo.innerHTML = `<span class="err">${data.error || 'Falha ao confirmar'}</span>`;
      showToast('Erro ao confirmar presença', false, 2500);
      setTimeout(closeModal, 2000);
    } else if (data.status === 'ja_confirmada') {
      modalInfo.innerHTML = `<span class="ok">Presença já estava confirmada ✓</span>`;
      showToast('Presença já confirmada anteriormente ✓', true, 3200);
      setTimeout(closeModal, 2600); // ⏱ manter mais tempo visível
    } else {
      modalInfo.innerHTML = `<span class="ok">Presença confirmada ✓</span>`;
      showToast('Presença confirmada ✓', true, 2400);
      setTimeout(closeModal, 1600);
    }
  }catch(e){
    console.error(e);
    modalInfo.innerHTML = `<span class="err">Erro ao confirmar</span>`;
    showToast('Erro ao confirmar presença', false, 2500);
    setTimeout(closeModal, 2000);
  }finally{
    setConfirmBusy(false);
  }
});

btnCancelar.addEventListener('click', closeModal);

// Informações da palestra
(async () => {
  const titleEl = document.getElementById('eventTitle');
  const dateEl  = document.getElementById('eventDate');

  if (codigoUrl === 'SEM-CODIGO') {
    titleEl.textContent = 'Código não informado';
    startBtn.disabled = true;
    statusEl.innerHTML = '<span class="err">Inclua ?c=CODIGO na URL.</span>';
    return;
  }
  try {
    const r = await fetch(`${API}?codigo=${encodeURIComponent(codigoUrl)}`);
    const res = await r.json();
    if (!res.ok) throw new Error('Palestra não encontrada');
    if (!res.palestra.ativo) throw new Error('Palestra inativa');

    titleEl.textContent = res.palestra.descricao || 'Palestra';
    const dataStr = res.palestra.Data || '';
    const horaStr = res.palestra.Horario || '';
    dateEl.textContent  = (dataStr || horaStr) ? `Data/Horário: ${[dataStr, horaStr].filter(Boolean).join(' ')}` : '';
  } catch (e) {
    titleEl.textContent = '—';
    dateEl.textContent  = '';
    startBtn.disabled = true;
    statusEl.innerHTML = `<span class="err">${e.message}</span>`;
  }
})();

// Encerrar recursos ao sair
window.addEventListener('beforeunload', () => {
  stopCam();
});
