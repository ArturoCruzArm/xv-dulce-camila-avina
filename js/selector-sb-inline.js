// selector-sb-inline.js — Supabase sync para selectores inline Foro 7
// Slug: xv-dulce-camila-avina | Storage key: xv_dulce_camila_avina
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
    let _syncTimer = null;

    async function getEventoId() {
        if (eventoId) return eventoId;
        const r = await fetch(SUPABASE_URL + '/rest/v1/eventos?slug=eq.' + EVENTO_SLUG + '&select=id&limit=1', { headers: SB_H });
        const rows = await r.json();
        eventoId = rows[0] ? rows[0].id : null;
        return eventoId;
    }

    // Sync selections snapshot to Supabase (single row, foto_index=0, datos=full object)
    async function sbSync(sels) {
        if (!sbOk) return;
        try {
            const eid = await getEventoId();
            if (!eid) return;
            await fetch(SUPABASE_URL + '/rest/v1/selecciones?evento_id=eq.' + eid, { method: 'DELETE', headers: SB_H });
            const entries = Object.entries(sels).filter(function(e) {
                var s = e[1];
                return s && ((s.categories && s.categories.length) || s.notes);
            });
            if (!entries.length) return;
            // Store as individual rows keyed by filename index, plus full snapshot in datos
            var snapshot = {};
            entries.forEach(function(e) { snapshot[e[0]] = e[1]; });
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
        } catch(e) { sbOk = false; }
    }

    async function sbLoad(isPoll) {
        if (!sbOk) return;
        try {
            const eid = await getEventoId();
            if (!eid) return;
            const r = await fetch(
                SUPABASE_URL + '/rest/v1/selecciones?evento_id=eq.' + eid + '&select=foto_index,datos',
                { headers: SB_H }
            );
            const rows = await r.json();

            // Merge all datos snapshots from Supabase
            var sb = {};
            rows.forEach(function(row) {
                if (row.datos && typeof row.datos === 'object') {
                    Object.assign(sb, row.datos);
                }
            });

            var merged;
            if (isPoll) {
                merged = sb;
            } else {
                var local = {};
                try { local = JSON.parse(localStorage.getItem(SB_KEY) || '{}'); } catch(e) {}
                merged = Object.assign({}, sb);
                Object.entries(local).forEach(function(e) {
                    var s = e[1];
                    if (s && ((s.categories && s.categories.length) || s.notes)) merged[e[0]] = s;
                });
            }

            _syncing = true;
            try {
                localStorage.setItem(SB_KEY, JSON.stringify(merged));
                if (typeof renderGallery === 'function') renderGallery();
            } finally { _syncing = false; }

            if (!isPoll) {
                if (Object.keys(merged).length) sbSync(merged).catch(function(){});
                sbRegistrarVisita();
                mostrarBanner(merged);
            }
        } catch(e) { sbOk = false; }
    }

    async function sbRegistrarVisita() {
        try {
            const eid = await getEventoId();
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

    // Patch localStorage to detect saves from inline selector
    var _origSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
        _origSet(key, value);
        if (key === SB_KEY && !_syncing) {
            clearTimeout(_syncTimer);
            _syncTimer = setTimeout(function() {
                try { sbSync(JSON.parse(value)); } catch(e) {}
            }, 600);
        }
    };

    document.addEventListener('DOMContentLoaded', function() {
        sbLoad(false);
        setInterval(function() {
            var open = window.modalOpen ||
                document.querySelector('.modal[style*="block"],.modal.active,.modal.show,#photoModal[style*="flex"],#photoModal[style*="block"]');
            if (!open) sbLoad(true);
        }, 30000);
    });
})();
