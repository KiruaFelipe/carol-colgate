// registerScript.js
// 🔗 SUA URL /exec do Apps Script
const API = "https://script.google.com/macros/s/AKfycbwAJJG7ODNq4kqIqV6qhAf2gJre1f7b2diK7R0BKwi71e51xo4XFULhFH1M9rWillXJng/exec";

// ──────────────────────────────────────────────────────────────────────────────
// Seletores / estado
const qs = new URLSearchParams(location.search);
const codigo = (qs.get("c") || qs.get("codigo") || "").trim() || "SEM-CODIGO";

const pill = document.getElementById("pill");
const form = document.getElementById("form");
const msg = document.getElementById("msg");
const qrbox = document.getElementById("qrbox");
const btnBaixar = document.getElementById("btnBaixar");
const btnNovo = document.getElementById("btnNovo");
const btnLimpar = document.getElementById("btnLimpar");
const btnSubmit = document.getElementById("btnSubmit");

const eventTitle = document.getElementById("eventTitle");
const eventUniversity = document.getElementById("eventUniversity");
const eventDate = document.getElementById("eventDate");
const semestreSelect = document.getElementById("semestre");

let lastPNG = null;

// ──────────────────────────────────────────────────────────────────────────────
// UI inicial
pill.textContent = "Código: " + codigo;

function preencherSemestres() {
  const frag = document.createDocumentFragment();
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "Selecione…";
  frag.appendChild(opt0);
  for (let i = 1; i <= 12; i++) {
    const opt = document.createElement("option");
    opt.value = `${i}º`;
    opt.textContent = `${i}º`;
    frag.appendChild(opt);
  }
  semestreSelect.appendChild(frag);
}

// Concatena Data (dd/MM/yyyy) + Horario (HH:mm) -> "Horário Palestra dd/MM/yyyy HH:mm"
function montarHorarioPalestra(dataStr, horaStr) {
  const d = (dataStr || "").trim();
  const h = (horaStr || "").trim();
  if (!d && !h) return "";
  if (d && h) return `Horário Palestra ${d} ${h}`;
  if (d) return `Horário Palestra ${d}`;
  if (h) return `Horário Palestra ${h}`;
  return "";
}

// ──────────────────────────────────────────────────────────────────────────────
// Carrega dados do evento a partir da planilha
async function carregarPalestra() {
  if (codigo === "SEM-CODIGO") {
    msg.innerHTML = '<span class="err">Inclua ?c=CODIGO na URL.</span>';
    btnSubmit.disabled = true;
    return;
  }
  try {
    const r = await fetch(`${API}?codigo=${encodeURIComponent(codigo)}`);
    const res = await r.json();

    if (!res.ok) {
      eventTitle.textContent = "Palestra não encontrada";
      eventUniversity.textContent = "";
      eventDate.textContent = "";
      btnSubmit.disabled = true;
      msg.innerHTML = '<span class="err">Código inválido na planilha.</span>';
      return;
    }

    const p = res.palestra || {};
    eventTitle.textContent = p.descricao || p.DESCRICAO || p.CodigoPalestra || "Palestra";
    eventUniversity.textContent = p.Universidade ? `Universidade: ${p.Universidade}` : "";

    const horarioFmt = montarHorarioPalestra(p.Data, p.Horario);
    eventDate.textContent = horarioFmt;

    const ativo = (typeof p.ativo === "boolean")
      ? p.ativo
      : (p.ATIVO != null ? String(p.ATIVO).toLowerCase() === "true" : true);

    if (!ativo) {
      btnSubmit.disabled = true;
      msg.innerHTML = '<span class="err">Palestra inativa — geração de QR bloqueada.</span>';
    } else {
      btnSubmit.disabled = false;
      msg.innerHTML = '<span class="ok">Palestra ativa — pode gerar o QR.</span>';
    }
  } catch (e) {
    console.error(e);
    btnSubmit.disabled = true;
    msg.innerHTML = '<span class="err">Falha ao acessar a API.</span>';
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Envia todos os dados da inscrição
form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (btnSubmit.disabled) return;

  const email = document.getElementById("email").value.trim();
  const nome = document.getElementById("nome").value.trim();
  const periodo = document.getElementById("periodo").value;
  const perfil = document.getElementById("perfil").value;
  const semestre = document.getElementById("semestre").value;
  const anoFormatura = document.getElementById("anoFormatura").value.trim();

  const universidade = (eventUniversity.textContent || "").replace(/^Universidade:\s*/,'');
  const dataPalestra = (eventDate.textContent || "").replace(/^Horário Palestra\s*/, '').split(' ')[0] || '';
  const horarioPalestra = (eventDate.textContent || "").replace(/^Horário Palestra\s*/, '').split(' ')[1] || '';

  if (!email || !codigo || !nome || !periodo || !perfil || !semestre || !anoFormatura) {
    msg.innerHTML = '<span class="err">Preencha todos os campos.</span>';
    return;
  }
  if (!/^\d{4}$/.test(anoFormatura)) {
    msg.innerHTML = '<span class="err">Informe um ano válido com 4 dígitos (ex.: 2027).</span>';
    return;
  }

  msg.innerHTML = "Registrando…";

  try {
    // envia TODOS os dados conforme colunas da planilha
    const body = new URLSearchParams({
      action: "registrar",
      CodigoPalestra: codigo,
      Universidade: universidade,
      Nome: nome,
      Email: email,
      Perfil: perfil,
      Periodo: periodo,
      Semestre: semestre,
      AnoFormatura: anoFormatura,
      Data: dataPalestra,
      Horario: horarioPalestra
    }).toString();

    const resp = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    const data = await resp.json();
    if (!data.ok) {
      msg.innerHTML = `<span class="err">${data.error || "Erro ao registrar"}</span>`;
      return;
    }

    // Gera QR com email|codigo
    const conteudo = `${email}|${codigo}`;
    qrbox.innerHTML = "";
    const container = document.createElement("div");
    qrbox.appendChild(container);

    new QRCode(container, {
      text: conteudo,
      width: 250,
      height: 250,
      correctLevel: QRCode.CorrectLevel.M
    });

    setTimeout(() => {
      const img = container.querySelector("img");
      lastPNG = img ? img.src : null;
      btnBaixar.disabled = !lastPNG;
      btnNovo.disabled = false;
      const statusTxt = data.status === "existente" ? " (já cadastrado)" : " (novo)";
      msg.innerHTML = `<span class="ok">QR gerado${statusTxt}: <b>${conteudo}</b></span>`;
    }, 150);
  } catch (e) {
    console.error(e);
    msg.innerHTML = '<span class="err">Erro ao registrar. Tente novamente.</span>';
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Ações auxiliares
btnBaixar.onclick = () => {
  if (!lastPNG) return;
  const a = document.createElement("a");
  a.href = lastPNG;
  a.download = "qrcode.png";
  a.click();
};

btnNovo.onclick = () => {
  qrbox.innerHTML = '<div class="muted" style="text-align:center">Preencha o formulário e gere seu QR.</div>';
  msg.textContent = "";
  btnBaixar.disabled = true;
  btnNovo.disabled = true;
};

btnLimpar.onclick = () => {
  form.reset();
  msg.textContent = "";
  document.getElementById("nome").focus();
};

// ──────────────────────────────────────────────────────────────────────────────
// Boot
preencherSemestres();
carregarPalestra();
