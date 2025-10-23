// 🔗 sua URL /exec do Apps Script
const API = "https://script.google.com/macros/s/AKfycbwAJJG7ODNq4kqIqV6qhAf2gJre1f7b2diK7R0BKwi71e51xo4XFULhFH1M9rWillXJng/exec";

// Código da URL (?c=...)
const qs = new URLSearchParams(location.search);
const codigoUrl = (qs.get('c') || '').trim() || 'SEM-CODIGO';
document.getElementById('pill').textContent = 'Código: ' + codigoUrl;

// Seletores
const video = document.getElementById('video');
const startBtn = document.getElementById('start');
const stopBtn  = document.getElementById('stop');
const statusEl = document.getElementById('status');

const backdrop = document.getElementById('backdrop');
const mEmail = document.getElementById('mEmail');
const mCodigo = document.getElementById('mCodigo');
const mTs = document.getElementById('mTs');
const modalBadge = document.getElementById('modalBadge');
const btnCancelar = document.getElementById('btnCancelar');
const btnConfirmar = document.getElementById('btnConfirmar');
const modalInfo = document.getElementById('modalInfo');
const toast = document.getElementById('toast');

// Estado
let stream = null;
let running = false;
let animId = null;
let lastPayload = null;
let modalOpen = false;
let closingTimer = null;

// Canvas para leitura do QR
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

// Utilidades
function showToast(txt, ok = true, ms = 2000) {
  toast.style.background = ok ? '#0e9f6e' : '#dc2626';
  toast.textContent = txt;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), ms);
}

function openModal(email, codigo) {
  modalOpen = true;
  mEmail.textContent = email || '—';
  mCodigo.textContent = codigo || '—';
  mTs.textContent = new Date().toLocaleString();
  modalBadge.textContent = 'Palestra: ' + (codigo || '—');
  modalInfo.textContent = '';
  backdrop.classList.add('show');
  backdrop.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  modalOpen = false;
  backdrop.classList.remove('show');
  backdrop.setAttribute('aria-hidden', 'true');
  if (closingTimer) { clearTimeout(closingTimer); closingTimer = null; }
}

// ---------- Informações da palestra ----------
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
    // Se sua API devolve Data e Horario separados, adapte aqui:
    dateEl.textContent  = res.palestra.dataBR ? `Data: ${res.palestra.dataBR}` : '';
  } catch (e) {
    titleEl.textContent = '—';
    dateEl.textContent  = '';
    startBtn.disabled = true;
    statusEl.innerHTML = `<span class="err">${e.message}</span>`;
  }
})();

// ---------- Câmera / QR ----------
async function startCam() {
  try {
    // Evita múltiplas inicializações simultâneas
    if (running) return;
    statusEl.textContent = 'Abrindo câmera…';

    // Se já existe stream ativa, apenas reanexa
    const hasActive = stream && stream.getTracks && stream.getTracks().some(t => t.readyState === 'live');
    if (hasActive) {
      video.srcObject = stream;
      await video.play().catch(() => {});
    } else {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream;
      await video.play().catch(() => {});
    }

    running = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusEl.textContent = 'Câmera ativa…';
    loop();
  } catch (e) {
    console.error(e);
    statusEl.innerHTML = '<span class="err">Erro ao abrir câmera</span>';
  }
}

function stopCam() {
  running = false;
  if (animId) cancelAnimationFrame(animId);
  animId = null;
  if (video) {
    video.pause();
    video.srcObject = null; // solta a referência do vídeo (stream continua em memória)
  }
  // Encerra os tracks com segurança
  if (stream && stream.getTracks) {
    stream.getTracks().forEach(t => t.stop());
  }
  stream = null; // força novo getUserMedia no próximo start
  startBtn.disabled = false;
  stopBtn.disabled = true;
  statusEl.textContent = 'Parado.';
}

function loop() {
  if (!running) return; // evita loops zombis
  if (modalOpen) { animId = requestAnimationFrame(loop); return; }

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const qr = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });

    if (qr && qr.data) {
      const parts = (qr.data || '').trim().split('|');
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        statusEl.innerHTML = '<span class="err"><b>Erro: QRCode Invalido</b></span> — <span class="muted">Situação: QrCode com o formato invalido</span>';
      } else {
        const email = parts[0];
        const codigo = parts[1];

        if (codigo !== codigoUrl) {
          statusEl.innerHTML = '<span class="err"><b>Erro: QrCode Palestra nao encontrada</b></span> — <span class="muted">Situação: Está no formato correto porem com o codigo errado</span>';
        } else {
          const payload = `${email}|${codigo}`;
          if (payload !== lastPayload) {
            lastPayload = payload;
            statusEl.innerHTML = '<span class="ok">QR detectado</span>';
            openModal(email, codigo);
          }
        }
      }
    }
  }
  animId = requestAnimationFrame(loop);
}

// Controles
startBtn.onclick = startCam;
stopBtn.onclick  = stopCam;

// Fecha modal clicando fora / ESC
backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// Pausa/resume quando a aba perde/recupera foco (melhora UX da câmera)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && running) {
    // pausa desenho (mas não fecha stream, evitando pedir permissão de novo)
    running = false;
    if (animId) cancelAnimationFrame(animId);
    statusEl.textContent = 'Pausado (aba oculta)…';
  } else if (!document.hidden && !running && !modalOpen) {
    // retoma loop se vídeo está pronto
    if (video.srcObject) {
      running = true;
      statusEl.textContent = 'Câmera ativa…';
      loop();
    }
  }
});

// Confirmar presença (POST action=presenca)
// Mantém modal aberto por mais tempo quando já confirmada
btnConfirmar.addEventListener('click', async () => {
  btnConfirmar.disabled = true;
  modalInfo.textContent = 'Registrando presença…';
  try {
    const email = mEmail.textContent.trim();
    const body = new URLSearchParams({
      action: 'presenca',
      codigoPalestra: codigoUrl,
      email
    }).toString();

    const resp = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const data = await resp.json();

    if (!data.ok) {
      modalInfo.innerHTML = `<span class="err">${data.error || 'Falha ao confirmar'}</span>`;
      showToast('Erro ao confirmar presença', false, 2500);
      // mantém modal um pouco para o operador ler o erro
      closingTimer = setTimeout(closeModal, 1800);
    } else if (data.status === 'ja_confirmada') {
      modalInfo.innerHTML = `<span class="ok">Presença já estava confirmada ✓</span>`;
      showToast('Presença já confirmada anteriormente ✓', true, 3000);
      // ✅ mantém aberto MAIS TEMPO quando já confirmada
      closingTimer = setTimeout(closeModal, 2500);
    } else {
      modalInfo.innerHTML = `<span class="ok">Presença confirmada ✓</span>`;
      showToast('Presença confirmada ✓', true, 2200);
      closingTimer = setTimeout(closeModal, 1500);
    }
  } catch (e) {
    console.error(e);
    modalInfo.innerHTML = `<span class="err">Erro ao confirmar</span>`;
    showToast('Erro ao confirmar presença', false, 2500);
    closingTimer = setTimeout(closeModal, 1800);
  } finally {
    btnConfirmar.disabled = false;
    // Não paramos a câmera: o operador segue lendo a fila
  }
});

btnCancelar.addEventListener('click', () => closeModal());

// Fechamento limpo ao sair/navegar
window.addEventListener('beforeunload', () => {
  if (stream && stream.getTracks) stream.getTracks().forEach(t => t.stop());
  if (animId) cancelAnimationFrame(animId);
});
