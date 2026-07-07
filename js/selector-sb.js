// selector-sb.js - Supabase sync + Realtime para Foro 7
// Slug: xv-dulce-camila-avina | Storage key: xv_dulce_camila_avina_photo_selections
(function () {
    var SUPABASE_URL  = 'https://nzpujmlienzfetqcgsxz.supabase.co';
    var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56cHVqbWxpZW56ZmV0cWNnc3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2ODYzMzYsImV4cCI6MjA5MDI2MjMzNn0.xl3lsb-KYj5tVLKTnzpbsdEGoV9ySnswH4eyRuyEH1s';
    var EVENTO_SLUG   = 'xv-dulce-camila-avina';
    var SB_KEY        = 'xv_dulce_camila_avina_photo_selections';
    var SB_H = { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + SUPABASE_ANON, 'Content-Type': 'application/json' };
    var CURRENT_CODE_VERSION = 3;

    var SESSION_KEY = 'foro7_sid';
    var sid = localStorage.getItem(SESSION_KEY);
    if (!sid) { sid = crypto.randomUUID(); localStorage.setItem(SESSION_KEY, sid); }

    var eventoId = null;
    var sbDisponible = true;
    var _lastSync = 0;
    var _reloading = false;
    var CLOCK_KEY = SB_KEY + '_clocks_v1';
    var clockState = loadClockState();

    function loadClockState() {
        try { return JSON.parse(localStorage.getItem(CLOCK_KEY) || '{}'); } catch(e) { return {}; }
    }

    function saveClockState() {
        try { localStorage.setItem(CLOCK_KEY, JSON.stringify(clockState)); } catch(e) {}
    }

    function baseSelection(sel) {
        return {
            ampliacion: !!(sel && sel.ampliacion),
            impresion: !!(sel && sel.impresion),
            invitacion: !!(sel && sel.invitacion),
            descartada: !!(sel && sel.descartada)
        };
    }

    function hasAny(sel) {
        sel = baseSelection(sel);
        return sel.ampliacion || sel.impresion || sel.invitacion || sel.descartada;
    }

    function readMeta(rowOrSelection) {
        var datos = rowOrSelection && rowOrSelection.datos ? rowOrSelection.datos : rowOrSelection;
        var meta = datos && datos._sync ? datos._sync : {};
        return {
            clock: Number(meta.clock || 0),
            updatedAt: meta.updatedAt || '',
            sid: meta.sid || '',
            deleted: !!meta.deleted
        };
    }

    function rememberClock(fotoIndex, clock) {
        if (!clock) return;
        var key = String(fotoIndex);
        clockState[key] = Math.max(Number(clockState[key] || 0), Number(clock || 0));
    }

    function nextClock(fotoIndex, remoteClock) {
        clockState = loadClockState();
        var key = String(fotoIndex);
        var next = Math.max(Number(clockState[key] || 0), Number(remoteClock || 0)) + 1;
        clockState[key] = next;
        saveClockState();
        return next;
    }

    function selectionWithMeta(sel, clock, deleted) {
        var clean = baseSelection(sel);
        clean._sync = {
            clock: clock,
            sid: sid,
            updatedAt: new Date().toISOString(),
            deleted: !!deleted
        };
        return clean;
    }

    function rowToSelection(row) {
        var sel = (row.datos && Object.keys(row.datos).length)
            ? row.datos
            : { impresion: row.impresion, invitacion: row.invitacion, descartada: row.descartada, ampliacion: row.ampliacion };
        return baseSelection(sel);
    }

    async function getEventoId() {
        if (eventoId) return eventoId;
        var r = await fetch(SUPABASE_URL + '/rest/v1/eventos?slug=eq.' + EVENTO_SLUG + '&select=id&limit=1', { headers: SB_H });
        var rows = await r.json();
        eventoId = rows[0] ? rows[0].id : null;
        return eventoId;
    }

    async function getRemoteSelection(eid, fotoIndex) {
        var r = await fetch(
            SUPABASE_URL + '/rest/v1/selecciones?evento_id=eq.' + eid + '&foto_index=eq.' + fotoIndex + '&select=foto_index,datos,impresion,invitacion,descartada,ampliacion&limit=1',
            { headers: SB_H }
        );
        if (!r.ok) return null;
        var rows = await r.json();
        return rows[0] || null;
    }

    async function writeRow(row) {
        _lastSync = Date.now();
        var r = await fetch(SUPABASE_URL + '/rest/v1/selecciones?on_conflict=evento_id,foto_index', {
            method: 'POST',
            headers: Object.assign({}, SB_H, { 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
            body: JSON.stringify([row])
        });
        if (!r.ok) throw new Error('UPSERT ' + r.status);
        _lastSync = Date.now();
    }

    async function sbSaveSelection(fotoIndex, sel) {
        if (!sbDisponible || !hasAny(sel)) return;
        try {
            var eid = await getEventoId();
            if (!eid) return;
            var remote = await getRemoteSelection(eid, fotoIndex);
            var remoteMeta = readMeta(remote);
            clockState = loadClockState();
            var localClock = Number(clockState[String(fotoIndex)] || 0);

            if (remoteMeta.clock > localClock && remoteMeta.sid !== sid) {
                await sbReloadFromDB(eid);
                return;
            }

            var clock = nextClock(fotoIndex, remoteMeta.clock);
            var datos = selectionWithMeta(sel, clock, false);
            await writeRow({
                evento_id: eid, session_id: sid, foto_index: fotoIndex,
                impresion: datos.impresion, invitacion: datos.invitacion,
                descartada: datos.descartada, ampliacion: datos.ampliacion,
                datos: datos, code_version: CURRENT_CODE_VERSION
            });
        } catch(e) {
            console.warn('[Supabase] Save error:', e.message);
        }
    }

    async function sbUpsertSelections() {
        if (!sbDisponible) return;
        var sels = typeof photoSelections !== 'undefined' ? Object.assign({}, photoSelections) : {};
        Object.entries(sels).forEach(function(e) {
            var idx = parseInt(e[0], 10);
            if (hasAny(e[1])) sbSaveSelection(idx, e[1]);
        });
    }

    async function sbDeleteSelection(fotoIndex) {
        if (!sbDisponible) return;
        try {
            var eid = await getEventoId();
            if (!eid) return;
            var remote = await getRemoteSelection(eid, fotoIndex);
            var remoteMeta = readMeta(remote);
            clockState = loadClockState();
            var localClock = Number(clockState[String(fotoIndex)] || 0);

            if (remoteMeta.clock > localClock && remoteMeta.sid !== sid) {
                await sbReloadFromDB(eid);
                return;
            }

            var clock = nextClock(fotoIndex, remoteMeta.clock);
            var datos = selectionWithMeta({}, clock, true);
            await writeRow({
                evento_id: eid, session_id: sid, foto_index: fotoIndex,
                impresion: false, invitacion: false,
                descartada: false, ampliacion: false,
                datos: datos, code_version: CURRENT_CODE_VERSION
            });
        } catch(e) {
            console.warn('[Supabase] Delete error:', e.message);
        }
    }

    async function sbDeleteAll() {
        if (!sbDisponible) return;
        try {
            var eid = await getEventoId();
            if (!eid) return;
            var rows = await fetchRows(eid);
            _lastSync = Date.now();
            await Promise.all(rows.map(function(row) {
                return sbDeleteSelection(row.foto_index);
            }));
            _lastSync = Date.now();
        } catch(e) {
            console.warn('[Supabase] DeleteAll error:', e.message);
        }
    }

    function applyRows(rows) {
        var sb = {};
        rows.forEach(function(row) {
            var meta = readMeta(row);
            rememberClock(row.foto_index, meta.clock);
            var sel = rowToSelection(row);
            if (hasAny(sel)) sb[row.foto_index] = sel;
        });
        saveClockState();
        if (typeof photoSelections !== 'undefined') photoSelections = sb;
        try { localStorage.setItem(SB_KEY, JSON.stringify(sb)); } catch(e) {}
        if (typeof renderGallery === 'function') renderGallery();
        if (typeof updateStats === 'function') updateStats();
        if (typeof updateFilterButtons === 'function') updateFilterButtons();
        return sb;
    }

    async function fetchRows(eid) {
        var r = await fetch(
            SUPABASE_URL + '/rest/v1/selecciones?evento_id=eq.' + eid + '&select=foto_index,datos,impresion,invitacion,descartada,ampliacion',
            { headers: SB_H }
        );
        if (!r.ok) throw new Error(r.status);
        return r.json();
    }

    async function sbLoad() {
        try {
            var eid = await getEventoId();
            if (!eid) { sbDisponible = false; return; }

            var rows = await fetchRows(eid);
            var hasRemoteRows = rows.length > 0;
            var local = {};
            if (!hasRemoteRows) {
                try { local = JSON.parse(localStorage.getItem(SB_KEY) || '{}'); } catch(e) {}
            }

            var sb = applyRows(rows);

            if (!hasRemoteRows && Object.keys(local).length > 0) {
                photoSelections = local;
                try { localStorage.setItem(SB_KEY, JSON.stringify(local)); } catch(e) {}
                if (typeof renderGallery === 'function') renderGallery();
                if (typeof updateStats === 'function') updateStats();
                if (typeof updateFilterButtons === 'function') updateFilterButtons();
                await sbUpsertSelections();
                sb = local;
            }

            sbRegistrarVisita();
            mostrarBanner(hasRemoteRows ? sb : (photoSelections || {}));
            sbSubscribe(eid);
        } catch(e) {
            console.warn('[Supabase] Usando localStorage:', e.message);
            sbDisponible = false;
        }
    }

    function sbSubscribe(eid) {
        if (!window.supabase || !window.supabase.createClient) return;
        try {
            var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
                auth: { persistSession: false }
            });
            client.channel('sel-' + EVENTO_SLUG)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'selecciones',
                    filter: 'evento_id=eq.' + eid
                }, function() {
                    if (Date.now() - _lastSync < 1500) return;
                    sbReloadFromDB(eid);
                })
                .subscribe();
        } catch(e) { console.warn('[sb] Realtime error:', e); }
    }

    async function sbReloadFromDB(eid) {
        if (_reloading) return;
        _reloading = true;
        try {
            eid = eid || await getEventoId();
            if (!eid) return;
            var rows = await fetchRows(eid);
            applyRows(rows);
        } catch(e) {
            console.warn('[Supabase] Reload error:', e.message);
        } finally {
            _reloading = false;
        }
    }

    async function sbRegistrarVisita(pagina) {
        try {
            var eid = await getEventoId();
            if (!eid) return;
            await fetch(SUPABASE_URL + '/rest/v1/visitas', {
                method: 'POST',
                headers: Object.assign({}, SB_H, { 'Prefer': 'return=minimal' }),
                body: JSON.stringify({ evento_id: eid, pagina: pagina || 'selector', session_id: sid })
            });
        } catch(e) {}
    }

    function mostrarBanner(sels) {
        if (document.getElementById('banner-sin-sel')) return;
        if (Object.keys(sels || {}).length > 0) return;
        var banner = document.createElement('div');
        banner.id = 'banner-sin-sel';
        banner.style.cssText = 'background:#78350f;color:#fcd34d;text-align:center;padding:12px 20px;font-size:.88rem;position:sticky;top:0;z-index:200;line-height:1.5;';
        banner.innerHTML = '\uD83D\uDCF8 <strong>\u00a1Tus fotos est\u00e1n listas!</strong> A\u00fan no has seleccionado ninguna. \u00a1Empieza ahora! <button onclick="this.parentElement.remove()" style="margin-left:12px;background:transparent;border:1px solid #fcd34d;color:#fcd34d;padding:1px 8px;border-radius:4px;cursor:pointer;">\u00d7</button>';
        document.body.insertBefore(banner, document.body.firstChild);
    }

    window.sbUpsertSelections = sbUpsertSelections;
    window.sbSaveSelection = sbSaveSelection;
    window.sbDeleteSelection = sbDeleteSelection;
    window.sbDeleteAll = sbDeleteAll;
    window.sbRegistrarVisita = sbRegistrarVisita;
    window.sbRefreshSelections = function() { return sbReloadFromDB(); };
    window.sbDisponible = function() { return sbDisponible; };

    document.addEventListener('DOMContentLoaded', function() {
        sbLoad();
        setInterval(function() {
            if (!document.hidden) sbReloadFromDB();
        }, 30000);
    });
})();
