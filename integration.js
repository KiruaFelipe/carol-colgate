/**
 * integration.js
 * Camada de integração (stub) para o protótipo Colgate.
 * - Não realiza chamadas reais por enquanto.
 * - Pode ser incluído em qualquer página sem efeitos colaterais.
 * - Centraliza pontos de configuração para futura API.
 *
 * Como usar (quando houver backend):
 *   Integration.configure({ baseUrl: 'https://api.seu-dominio.com' });
 *   await Integration.palestras.getAtivaPorCodigo('ABC123')
 *   await Integration.convidados.registrarOuObterQr({...})
 *   await Integration.presenca.confirmarPorEmailECodigo({ email, codigoPalestra })
 */

(function (global) {
  const VERSION = "0.1.0-stub";

  /** Configuração mutável da integração */
  const _config = {
    /** Base URL do backend quando existir (ex.: 'https://worker.seu-dominio.com/api') */
    baseUrl: "",
    /** Chave/Token se necessário futuramente */
    authToken: "",
    /** Timeout padrão de requests (ms) */
    timeoutMs: 15000,
    /** Liga/desliga logs no console */
    debug: true,
  };

  /** Utilidades internas */
  const _util = {
    assertString(name, v) {
      if (typeof v !== "string" || !v.trim()) {
        throw new Error(`[integration] Param inválido: ${name}`);
      }
    },
    assertObject(name, v) {
      if (typeof v !== "object" || v == null) {
        throw new Error(`[integration] Param inválido: ${name}`);
      }
    },
    log(...args) {
      if (_config.debug) console.log("[integration]", ...args);
    },
    warn(...args) {
      if (_config.debug) console.warn("[integration]", ...args);
    },
    notImplemented(hint = "") {
      _util.warn("Stub chamado. Sem integração ainda.", hint);
      // Retorna uma Promise resolvida (no-op) para não quebrar fluxo existente.
      return Promise.resolve({ ok: false, stub: true, msg: "Integração ainda não implementada" });
    },
    // Quando existir backend, use este helper de fetch:
    async request(path, { method = "GET", headers = {}, body, signal } = {}) {
      _util.assertString("path", path);
      if (!_config.baseUrl) {
        return _util.notImplemented(`Tentou chamar ${path} sem baseUrl configurada.`);
      }
      const url = new URL(path, _config.baseUrl).toString();
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), _config.timeoutMs);
      try {
        const res = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(!!_config.authToken && { Authorization: `Bearer ${_config.authToken}` }),
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: signal || ctrl.signal,
        });
        const text = await res.text();
        let json;
        try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
        return { status: res.status, ok: res.ok, data: json };
      } finally {
        clearTimeout(to);
      }
    },
  };

  /** API pública */
  const Integration = {
    version: VERSION,

    /** Ajusta as configs (ex.: baseUrl, authToken) */
    configure(opts = {}) {
      if (opts.baseUrl != null) _config.baseUrl = String(opts.baseUrl || "");
      if (opts.authToken != null) _config.authToken = String(opts.authToken || "");
      if (opts.timeoutMs != null) _config.timeoutMs = Number(opts.timeoutMs) || 15000;
      if (opts.debug != null) _config.debug = !!opts.debug;
      _util.log("Config aplicada:", { ..._config, authToken: _config.authToken ? "***" : "" });
    },

    /** Área de palestras */
    palestras: {
      /** Busca palestra ativa pelo código (futuro backend) */
      async getAtivaPorCodigo(codigoPalestra) {
        _util.assertString("codigoPalestra", codigoPalestra);
        // Exemplo de futura chamada:
        // return _util.request(`/palestras/ativa?codigo=${encodeURIComponent(codigoPalestra)}`);
        return _util.notImplemented("palestras.getAtivaPorCodigo");
      },
    },

    /** Área de convidados/cadastro */
    convidados: {
      /**
       * Cria ou retorna QR para um convidado (futuro backend)
       * @param {{ codigoPalestra:string, nome:string, email:string, periodo:string }} payload
       */
      async registrarOuObterQr(payload) {
        _util.assertObject("payload", payload);
        ["codigoPalestra", "nome", "email", "periodo"].forEach((k) => _util.assertString(k, payload[k]));
        // Exemplo de futura chamada:
        // return _util.request(`/convidados/registrar-ou-obter-qr`, { method: "POST", body: payload });
        return _util.notImplemented("convidados.registrarOuObterQr");
      },
    },

    /** Área de presença */
    presenca: {
      /**
       * Confirma presença a partir de email + codigoPalestra (futuro backend)
       * @param {{ email:string, codigoPalestra:string }} payload
       */
      async confirmarPorEmailECodigo(payload) {
        _util.assertObject("payload", payload);
        ["email", "codigoPalestra"].forEach((k) => _util.assertString(k, payload[k]));
        // Exemplo de futura chamada:
        // return _util.request(`/presencas/confirmar`, { method: "POST", body: payload });
        return _util.notImplemented("presenca.confirmarPorEmailECodigo");
      },

      /**
       * Confirma presença por token único (se mais tarde optarem por token/uuid)
       * @param {{ token:string }} payload
       */
      async confirmarPorToken(payload) {
        _util.assertObject("payload", payload);
        _util.assertString("token", payload.token);
        // return _util.request(`/presencas/confirmar-token`, { method:"POST", body: payload });
        return _util.notImplemented("presenca.confirmarPorToken");
      },
    },
  };

  // expõe no escopo global
  global.Integration = Integration;

  // opcional: permite configuração via query string (?api=...&debug=1)
  try {
    const sp = new URLSearchParams(global.location?.search || "");
    if (sp.has("api")) Integration.configure({ baseUrl: sp.get("api") });
    if (sp.has("debug")) Integration.configure({ debug: sp.get("debug") !== "0" });
  } catch {}

  _util.log(`integration.js v${VERSION} carregado. (stub)`);
})(window);
