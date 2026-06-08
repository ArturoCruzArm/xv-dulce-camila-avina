// selector-sb-inline.js — Supabase sync para selectores inline Foro 7
// Slug: xv-dulce-camila-avina | Storage key: xv_dulce_camila_avina
// v2: protección _sbLoaded, multi-session, no-delete-on-empty, merge inteligente
(function () {
    const SUPABASE_URL  = 'https://nzpujmlienzfetqcgsxz.supabase.co';
    const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56cHVqbWxpZW56ZmV0cWNnc3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2ODYzMzYsImV4cCI6MjA5MDI2MjMzNn0.xl3lsb-KYj5tVLKTnzpbsdEGoV9ySnswH4eyRuyEH1s';
    const EVENTO_SLUG   = 'xv-dulce-camila-avina';
    const SB_KEY        = 'xv_dulce_camila_avina';
    const SB_H = { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + SUPABASE_ANON, 'Content-Type': 'application/json' };

    const SESSION_KEY = 'foro7_sid';
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) { sid = crypto.randomUUID(); localStorage.setItem(SESSION_KEY, sid); }

    let eventoId   = null;
    let sbOk       = true;
    let _syncing   = false;
    let _sbLoaded  = false;   // true solo después de que sbLoad termina
    let _syncTimer = null;
    let _lastHash  = '';      // hash del último snapshot para evitar syncs duplicados

    async function getEventoId() {
        if (eventoId) return eventoId;
        var r = await fetch(SUPABASE_URL + '/rest/v1/eventos?slug=eq.' + EVENTO_SLUG + '&select=id&limit=1', { headers: SB_H });
        var rows = await r.json();
        eventoId = rows[0] ? rows[0].id : null;
        return eventoId;
    }

    // Hash simple para detectar cambios
    function quickHash(obj) {
        return JSON.stringify(obj);
    }

    // Filtra selecciones válidas (con categorías o notas)
    function filterValid(sels) {
        var clean = {};
        Object.entries(sels).forEach(function(e) {
            var s = e[1];
            if (s && ((s.categories && s.categories.length) || s.notes)) {
                clean[e[0]] = s;
            }
        });
        return clean;
    }

    // Sync: UPSERT por session_id, nunca DELETE global
    async function sbSync(sels) {
        if (!sbOk || !_sbLoaded) return;
        try {
            var eid = await getEventoId();
            if (!eid) return;

            var snapshot = filterValid(sels);

            // No borrar datos remotos si no hay selecciones locales
            if (!Object.keys(snapshot).length) return;

            // Evitar sync duplicado si nada cambió
            var hash = quickHash(snapshot);
            if (hash === _lastHash) return;
            _lastHash = hash;

            // UPSERT: insertar o actualizar por (evento_id, session_id)
            // Primero intentar actualizar la fila existente de esta sesión
            var existing = await fetch(
                SUPABASE_URL + '/rest/v1/selecciones?evento_id=eq.' + eid + '&session_id=eq.' + sid + '&select=id',
                { headers: SB_H }
            );
            var rows = await existing.json();

            if (rows.length > 0) {
                // UPDATE existente
                await fetch(
                    SUPABASE_URL + '/rest/v1/selecciones?id=eq.' + rows[0].id,
                    {
                        method: 'PATCH',
                        headers: Object.assign({}, SB_H, { 'Prefer': 'return=minimal' }),
                        body: JSON.stringify({ datos: snapshot })
                    }
                );
            } else {
                // INSERT nuevo
                await fetch(SUPABASE_URL + '/rest/v1/selecciones', {
                    method: 'POST',
                    headers: Object.assign({}, SB_H, { 'Prefer': 'return=minimal' }),
                    body: JSON.stringify([{
                        evento_id: eid,
                        session_id: sid,
                        foto_index: 0,
                        impresion: false,
                        invitacion: false,
                        descartada: false,
                        ampliacion: false,
                        datos: snapshot
                    }])
                });
            }
        } catch(e) { sbOk = false; }
    }

    // Merge inteligente: combina selecciones de todas las sesiones
    // La selección más completa (más categorías) gana por foto
    function mergeSelections(sesiones) {
        var merged = {};
        sesiones.forEach(function(datos) {
            if (!datos || typeof datos !== 'object') return;
            Object.entries(datos).forEach(function(e) {
                var key = e[0], sel = e[1];
                if (!sel) return;
                var existing = merged[key];
                if (!existing) {
                    merged[key] = sel;
                } else {
                    // Merge categorías (unión)
                    var cats = new Set((existing.categories || []).concat(sel.categories || []));
                    merged[key] = {
                        categories: Array.from(cats),
                        notes: sel.notes || existing.notes || ''
                    };
                }
            });
        });
        return merged;
    }

    async function sbLoad(isPoll) {
        if (!sbOk) return;
        try {
            var eid = await getEventoId();
            if (!eid) return;
            var r = await fetch(
                SUPABASE_URL + '/rest/v1/selecciones?evento_id=eq.' + eid + '&select=session_id,datos',
                { headers: SB_H }
            );
            var rows = await r.json();

            // Merge todas las sesiones remotas
            var allDatos = rows.map(function(row) { return row.datos; });
            var sb = mergeSelections(allDatos);

            var merged;
            if (isPoll) {
                // En poll: merge remoto + local (local tiene prioridad)
                var local = {};
                try { local = JSON.parse(localStorage.getItem(SB_KEY) || '{}'); } catch(e) {}
                merged = mergeSelections([sb, filterValid(local)]);
            } else {
                // Carga inicial: merge remoto + local
                var local = {};
                try { local = JSON.parse(localStorage.getItem(SB_KEY) || '{}'); } catch(e) {}
                merged = mergeSelections([sb, filterValid(local)]);
            }

            _syncing = true;
            try {
                localStorage.setItem(SB_KEY, JSON.stringify(merged));
                // Actualizar objeto selections del selector inline
                if (typeof selections !== 'undefined') {
                    Object.keys(selections).forEach(function(k) { delete selections[k]; });
                    Object.assign(selections, merged);
                }
                if (typeof renderGallery === 'function') renderGallery();
                if (typeof updateStats === 'function') updateStats();
            } finally { _syncing = false; }

            // Marcar como cargado ANTES del primer sync
            _sbLoaded = true;
            _lastHash = quickHash(filterValid(merged));

            if (!isPoll) {
                if (Object.keys(merged).length) sbSync(merged).catch(function(){});
                sbRegistrarVisita();
                mostrarBanner(merged);
            }
        } catch(e) { sbOk = false; _sbLoaded = true; }
    }

    async function sbRegistrarVisita() {
        try {
            var eid = await getEventoId();
            if (!eid) return;
            await fetch(SUPABASE_URL + '/rest/v1/visitas', {
                method: 'POST',
                headers: Object.assign({}, SB_H, { 'Prefer': 'return=minimal' }),
                body: JSON.stringify({ evento_id: eid, pagina: 'selector', session_id: sid })
            });
        } catch(e) {}
    }

    function mostrarBanner(sels) {
        if (document.getElementById('banner-sin-sel')) return;
        if (Object.keys(sels).some(function(k) { var s = sels[k]; return s && s.categories && s.categories.length; })) return;
        var cfg = window.CONFIG || window.LIMITS || {};
        var fecha = cfg.fechaEvento || cfg.fecha;
        if (fecha && new Date(fecha) > new Date()) return;
        var banner = document.createElement('div');
        banner.id = 'banner-sin-sel';
        banner.style.cssText = 'background:#78350f;color:#fcd34d;text-align:center;padding:12px 20px;font-size:.88rem;position:sticky;top:0;z-index:200;line-height:1.5;';
        banner.innerHTML = '\uD83D\uDCF8 <strong>\u00a1Tus fotos est\u00e1n listas!</strong> A\u00fan no has seleccionado ninguna. \u00a1Empieza ahora! <button onclick="this.parentElement.remove()" style="margin-left:12px;background:transparent;border:1px solid #fcd34d;color:#fcd34d;padding:1px 8px;border-radius:4px;cursor:pointer;">\u00d7</button>';
        document.body.insertBefore(banner, document.body.firstChild);
    }

    // Patch localStorage para detectar saves del selector inline
    var _origSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
        _origSet(key, value);
        if (key === SB_KEY && !_syncing && _sbLoaded) {
            clearTimeout(_syncTimer);
            _syncTimer = setTimeout(function() {
                try { sbSync(JSON.parse(value)); } catch(e) {}
            }, 600);
        }
    };

    document.addEventListener('DOMContentLoaded', function() {
        sbLoad(false);
        // Poll cada 15s para actualizar sin sobreescribir
        setInterval(function() {
            var open = window.modalOpen ||
                document.querySelector('.modal[style*="block"],.modal.active,.modal.show,#photoModal[style*="flex"],#photoModal[style*="block"]');
            if (!open) sbLoad(true);
        }, 15000);
    });
})();
