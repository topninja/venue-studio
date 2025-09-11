(function () {
    'use strict';

    var maps = [
        { id: 'addition-financial-arena', file: 'maps/addition_financial_arena_initial.json', label: 'Addition Financial Arena' },
        { id: 'marthas-vineyard', file: 'maps/marthas_vineyard.json', label: "Martha's Vineyard" },
        { id: 'sunbet-arena', file: 'maps/sunbet_arena.json', label: 'SunBet Arena' },
        { id: 'vystar-arena', file: 'maps/vystar_veterans_memorial_arena.json', label: 'VyStar Veterans Memorial Arena' },
        { id: 'yuengling-center', file: 'maps/yuengling_center_arena.json', label: 'Yuengling Center Arena' }
    ];

    var selectedMapKey = 'venue-studio.selected-map';
    var bootstrapKey = 'venue-studio.initial-map.v1';
    var header = document.querySelector('.studio-header');
    var select = document.getElementById('venue-map-select');
    var selectWrap = document.querySelector('.studio-select-wrap');
    var status = document.getElementById('map-load-status');
    var stats = document.getElementById('map-stats');
    var loadingOverlay = document.getElementById('studio-loading-overlay');
    var toast = document.getElementById('studio-toast');
    var toastTimer;
    var applyingBuiltInMap = false;

    function setStatus(message, state) {
        status.classList.remove('loading', 'error');
        if (state) status.classList.add(state);
        header.classList.toggle('loading', state === 'loading');
        selectWrap.classList.toggle('loading', state === 'loading');
        loadingOverlay.classList.toggle('visible', state === 'loading');
        loadingOverlay.setAttribute('aria-hidden', state === 'loading' ? 'false' : 'true');
        status.lastElementChild.textContent = message;
        status.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
    }

    function waitForPaint() {
        return new Promise(function (resolve) {
            window.requestAnimationFrame(function () {
                window.requestAnimationFrame(resolve);
            });
        });
    }

    function showToast(message) {
        window.clearTimeout(toastTimer);
        toast.textContent = message;
        toast.classList.add('visible');
        toastTimer = window.setTimeout(function () {
            toast.classList.remove('visible');
        }, 2600);
    }

    function updateStats(plan) {
        if (!plan || !Array.isArray(plan.zones)) {
            stats.textContent = 'Ready to design';
            return;
        }

        var rowCount = 0;
        var seatCount = 0;
        plan.zones.forEach(function (zone) {
            var rows = Array.isArray(zone.rows) ? zone.rows : [];
            rowCount += rows.length;
            rows.forEach(function (row) {
                seatCount += Array.isArray(row.seats) ? row.seats.length : 0;
            });
        });

        stats.textContent = plan.zones.length + ' zones  •  ' + rowCount + ' rows  •  ' + seatCount.toLocaleString() + ' seats';
    }

    function getStore() {
        return window.vapp && window.vapp.$store;
    }

    function commitPlan(store, planText) {
        var mutation = store._mutations && store._mutations['plan/loadPlan'] ? 'plan/loadPlan' : 'loadPlan';
        store.commit(mutation, { plan: planText });
    }

    function loadMap(mapId, announce) {
        var map = maps.find(function (item) { return item.id === mapId; }) || maps[0];
        var store = getStore();

        if (!store) return Promise.reject(new Error('The editor is still starting.'));

        select.disabled = true;
        setStatus('Loading map…', 'loading');

        return waitForPaint()
            .then(function () {
                return window.fetch(map.file, { cache: 'no-cache' });
            })
            .then(function (response) {
                if (!response.ok) throw new Error('Map request failed with status ' + response.status + '.');
                return response.text();
            })
            .then(function (planText) {
                var plan = JSON.parse(planText);
                if (!plan.size || !Array.isArray(plan.zones) || !Array.isArray(plan.categories)) {
                    throw new Error('The selected map is not a valid seating plan.');
                }

                applyingBuiltInMap = true;
                commitPlan(store, planText);
                applyingBuiltInMap = false;

                select.value = map.id;
                window.localStorage.setItem(selectedMapKey, map.id);
                window.localStorage.setItem(bootstrapKey, 'complete');
                updateStats(plan);
                setStatus('Saved locally');
                window.dispatchEvent(new Event('resize'));
                if (announce) showToast(map.label + ' loaded');
            })
            .catch(function (error) {
                applyingBuiltInMap = false;
                setStatus('Could not load map', 'error');
                showToast(error.message || 'Could not load the selected map.');
                throw error;
            })
            .finally(function () {
                select.disabled = false;
            });
    }

    function initialize(store) {
        var storedMap = window.localStorage.getItem(selectedMapKey);
        var hasBootstrapped = window.localStorage.getItem(bootstrapKey) === 'complete';

        select.value = storedMap && maps.some(function (map) { return map.id === storedMap; }) ? storedMap : 'custom';

        store.subscribe(function (mutation, state) {
            if (mutation.type.indexOf('loadPlan') !== -1 && !applyingBuiltInMap) {
                select.value = 'custom';
                window.localStorage.setItem(selectedMapKey, 'custom');
            }
            updateStats(state.plan && state.plan._plan);
        });

        updateStats(store.state.plan && store.state.plan._plan);

        select.addEventListener('change', function () {
            if (select.value !== 'custom') {
                loadMap(select.value, true).catch(function () {});
            }
        });

        if (!hasBootstrapped) {
            loadMap(maps[0].id, false).catch(function () {});
        } else {
            setStatus('Saved locally');
        }
    }

    function waitForEditor(attemptsRemaining) {
        var store = getStore();
        if (store) {
            initialize(store);
            return;
        }
        if (attemptsRemaining <= 0) {
            setStatus('Editor unavailable', 'error');
            return;
        }
        window.setTimeout(function () { waitForEditor(attemptsRemaining - 1); }, 50);
    }

    waitForEditor(200);
}());
