document.addEventListener('DOMContentLoaded', () => {
    const audioUpload = document.getElementById('audioUpload');
    const player = document.getElementById('videoPlayer');
    const playbackSpeed = document.getElementById('playbackSpeed');
    const scriptInput = document.getElementById('scriptInput');
    const noteInput = document.getElementById('noteInput');
    const addAnchorBtn = document.getElementById('addAnchorBtn');
    const anchorList = document.getElementById('anchorList');
    const errorMessage = document.getElementById('playerErrorMessage');
    
    const editModeBtn = document.getElementById('editModeBtn');
    const syncModeBtn = document.getElementById('syncModeBtn');
    const viewModeBtn = document.getElementById('viewModeBtn');
    
    const subtitleViewer = document.getElementById('subtitleViewer');
    const syncViewer = document.getElementById('syncViewer');
    const syncList = document.getElementById('syncList');
    const syncMarkBtn = document.getElementById('syncMarkBtn');

    const playPauseBtn = document.getElementById('playPauseBtn');
    const rewindBtn = document.getElementById('rewindBtn');
    const forwardBtn = document.getElementById('forwardBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const currentTimeText = document.getElementById('currentTime');
    const durationText = document.getElementById('duration');
    const muteBtn = document.getElementById('muteBtn');

    const editContainer = document.getElementById('editContainer');
    const viewContainer = document.getElementById('viewContainer');
    const scriptInput2 = document.getElementById('scriptInput2');
    const toggleLayer1 = document.getElementById('toggleLayer1');
    const toggleLayer2 = document.getElementById('toggleLayer2');

    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');
    
    // --- 言語対応 (i18n) ---
    const userLang = navigator.language || navigator.userLanguage;
    if (!userLang.startsWith('ja')) {
        document.querySelectorAll('[data-en]').forEach(el => {
            el.textContent = el.getAttribute('data-en');
        });
        document.querySelectorAll('[data-en-placeholder]').forEach(el => {
            el.placeholder = el.getAttribute('data-en-placeholder');
        });
    }

    let anchors = JSON.parse(localStorage.getItem('echoflow_anchors')) || [];
    anchors.sort((a, b) => a.time - b.time);
    let subtitles = [];
    let syncData = [];
    let currentSyncIndex = 0;

    // --- 初期ロード ---
    scriptInput.value = localStorage.getItem('echoflow_script') || '';
    scriptInput2.value = localStorage.getItem('echoflow_script2') || '';
    noteInput.value = localStorage.getItem('echoflow_notes') || '';
    renderAnchors();

    // --- メディア読み込み ---
    audioUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            errorMessage.style.display = 'none';
            player.src = URL.createObjectURL(file);
            player.load();
        }
    });

    player.onloadedmetadata = () => { 
        durationText.textContent = formatTime(player.duration); 
        renderAnchorMarkers();
    };

    // --- タブ切り替え ---
    function switchTab(mode) {
        [editModeBtn, syncModeBtn, viewModeBtn].forEach(b => b.classList.remove('active'));
        [editContainer, syncViewer, viewContainer].forEach(v => v.style.display = 'none');

        if (mode === 'edit') {
            editModeBtn.classList.add('active');
            editContainer.style.display = 'block';
        } else if (mode === 'sync') {
            syncModeBtn.classList.add('active');
            syncViewer.style.display = 'block';
            prepareSync();
        } else if (mode === 'view') {
            viewModeBtn.classList.add('active');
            viewContainer.style.display = 'block';
            parseAndRenderSubtitles();
        }
    }

    editModeBtn.addEventListener('click', () => switchTab('edit'));
    syncModeBtn.addEventListener('click', () => switchTab('sync'));
    viewModeBtn.addEventListener('click', () => switchTab('view'));

    // --- 1. Sync ---
    function prepareSync() {
        const lines = scriptInput.value.split('\n').filter(l => l.trim() !== '');
        syncData = lines.map(line => ({
            original: line.replace(/^\[\d{2}:\d{2}(?:\.\d+)?\]\s*/, ''),
            time: null
        }));
        currentSyncIndex = 0;
        renderSyncList();
    }

    function renderSyncList() {
        syncList.innerHTML = '';
        syncData.forEach((item, i) => {
            const div = document.createElement('div');
            div.className = 'subtitle-line';
            if (i === currentSyncIndex) div.classList.add('sync-pending');
            const timeTag = item.time !== null ? `<span class="line-done-time">${formatTime(item.time)}</span>` : '';
            div.innerHTML = `${timeTag}${item.original}`;
            syncList.appendChild(div);
        });
    }

    function markCurrentTime() {
        if (currentSyncIndex < syncData.length) {
            syncData[currentSyncIndex].time = player.currentTime;
            currentSyncIndex++;
            renderSyncList();
            if (currentSyncIndex === syncData.length) { applySyncToScript(); }
        }
    }
    syncMarkBtn.addEventListener('click', markCurrentTime);

    function applySyncToScript() {
        const newScript = syncData.map(item => `[${formatTime(item.time)}] ${item.original}`).join('\n');
        scriptInput.value = newScript;
        localStorage.setItem('echoflow_script', newScript);
        const msg = userLang.startsWith('ja') ? '同期完了！Viewモードへ移動できます。' : 'Sync completed! You can move to View mode.';
        alert(msg);
    }

    // --- 2. View ---
    function parseAndRenderSubtitles() {
        subtitles = [];
        const lines1 = scriptInput.value.split('\n');
        const lines2 = scriptInput2.value.split('\n');
        // 全角・半角のブラケットやコロン、スペースに対応したより強力な正規表現
        const timeRegex = /[\[［]\s*(\d{1,2})\s*[:：]\s*(\d{1,2}(?:\.\d+)?)\s*[\]］](.*)/;
        subtitleViewer.innerHTML = '';
        
        lines1.forEach((line, i) => {
            const match = line.match(timeRegex);
            if (match) {
                const time = parseFloat(match[1]) * 60 + parseFloat(match[2]);
                const text1 = match[3].trim();
                const text2 = lines2[i] ? lines2[i].trim() : '';
                
                const index = subtitles.length;
                subtitles.push({ time, text1, text2 });
                
                const div = document.createElement('div');
                div.className = 'subtitle-line';
                div.id = `sub-line-${index}`;
                
                div.innerHTML = `
                    <div class="main-text layer1-content">${text1 || '...'}</div>
                    <div class="sub-text layer2-content">${text2}</div>
                `;
                
                div.addEventListener('click', () => { 
                    player.currentTime = time; 
                    player.play(); 
                    updatePlayButton(true); 
                });
                subtitleViewer.appendChild(div);
            }
        });
        applyLayerVisibility();
    }

    function applyLayerVisibility() {
        const layer1Els = document.querySelectorAll('.layer1-content');
        const layer2Els = document.querySelectorAll('.layer2-content');
        
        layer1Els.forEach(el => el.classList.toggle('hidden-layer', !toggleLayer1.checked));
        layer2Els.forEach(el => el.classList.toggle('hidden-layer', !toggleLayer2.checked));
    }

    toggleLayer1.addEventListener('change', applyLayerVisibility);
    toggleLayer2.addEventListener('change', applyLayerVisibility);

    player.addEventListener('timeupdate', () => {
        const percent = (player.currentTime / player.duration) * 100;
        progressBar.style.width = `${percent || 0}%`;
        currentTimeText.textContent = formatTime(player.currentTime);

        if (viewModeBtn.classList.contains('active') && subtitles.length > 0) {
            let activeIndex = -1;
            for (let i = 0; i < subtitles.length; i++) {
                if (player.currentTime >= subtitles[i].time) activeIndex = i;
                else break;
            }
            if (activeIndex !== -1) {
                const prev = subtitleViewer.querySelector('.active');
                if (prev) prev.classList.remove('active');
                const curr = document.getElementById(`sub-line-${activeIndex}`);
                if (curr) curr.classList.add('active');
            }
        }

        // アンカーの強調表示
        if (anchors.length > 0) {
            let activeAnchorId = null;
            for (let i = 0; i < anchors.length; i++) {
                if (player.currentTime >= anchors[i].time) {
                    activeAnchorId = anchors[i].id;
                } else {
                    break;
                }
            }

            if (activeAnchorId) {
                const prevAnchor = anchorList.querySelector('.active');
                const currAnchor = document.getElementById(`anchor-item-${activeAnchorId}`);
                
                if (prevAnchor && prevAnchor !== currAnchor) {
                    prevAnchor.classList.remove('active');
                }
                if (currAnchor && !currAnchor.classList.contains('active')) {
                    currAnchor.classList.add('active');
                    currAnchor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } else {
                const prevAnchor = anchorList.querySelector('.active');
                if (prevAnchor) prevAnchor.classList.remove('active');
            }

            // アンカーマーカーの更新（既読/未読の色分け反映）
            const markers = progressContainer.querySelectorAll('.anchor-marker');
            markers.forEach((marker, i) => {
                if (anchors[i] && player.currentTime >= anchors[i].time) {
                    marker.classList.remove('unplayed');
                } else {
                    marker.classList.add('unplayed');
                }
            });
        }
    });

    // --- 基本操作 ---
    playPauseBtn.addEventListener('click', togglePlay);
    async function togglePlay() {
        if (!player.src) return;
        player.paused ? (await player.play(), updatePlayButton(true)) : (player.pause(), updatePlayButton(false));
    }
    function updatePlayButton(isPlaying) {
        playPauseBtn.textContent = isPlaying ? '⏸' : '▶';
    }
    function skip(s) { player.currentTime = Math.max(0, Math.min(player.duration, player.currentTime + s)); }
    rewindBtn.addEventListener('click', () => skip(-5));
    forwardBtn.addEventListener('click', () => skip(5));
    playbackSpeed.addEventListener('change', (e) => player.playbackRate = parseFloat(e.target.value));
    progressContainer.addEventListener('click', (e) => { 
        if (player.duration) player.currentTime = (e.offsetX / progressContainer.clientWidth) * player.duration; 
    });

    muteBtn.addEventListener('click', () => {
        player.muted = !player.muted;
        muteBtn.textContent = player.muted ? '🔇' : '🔊';
        muteBtn.classList.toggle('active', player.muted);
    });

    // アンカー
    addAnchorBtn.addEventListener('click', () => {
        if (!player.src) return;
        anchors.push({ id: Date.now(), time: player.currentTime, note: '' });
        anchors.sort((a,b) => a.time - b.time);
        saveAnchors(); renderAnchors();
        renderAnchorMarkers();
    });

    function renderAnchorMarkers() {
        // 既存のマーカーを削除
        const oldMarkers = progressContainer.querySelectorAll('.anchor-marker');
        oldMarkers.forEach(m => m.remove());

        if (!player.duration || anchors.length === 0) return;

        anchors.forEach(a => {
            const marker = document.createElement('div');
            marker.className = 'anchor-marker';
            const percent = (a.time / player.duration) * 100;
            marker.style.left = `${percent}%`;
            
            // 再生位置より前か後かでクラスを分ける（オプション）
            if (a.time > player.currentTime) {
                marker.classList.add('unplayed');
            }

            progressContainer.appendChild(marker);
        });
    }
    function renderAnchors() {
        anchorList.innerHTML = '';
        anchors.forEach(a => {
            const item = document.createElement('div');
            item.className = 'anchor-item';
            item.id = `anchor-item-${a.id}`;
            item.innerHTML = `<div class="anchor-time">${formatTime(a.time)}</div><input type="text" value="${a.note}" data-id="${a.id}"><button class="anchor-delete" data-id="${a.id}">&times;</button>`;
            anchorList.appendChild(item);
        });
    }
    anchorList.addEventListener('click', (e) => {
        if (e.target.classList.contains('anchor-time')) { player.currentTime = parseFloat(e.target.parentElement.firstChild.textContent.split(':').reduce((m,s)=>m*60+s*1)); player.play(); updatePlayButton(true); }
        if (e.target.classList.contains('anchor-delete')) { 
            anchors = anchors.filter(a => a.id != e.target.dataset.id); 
            saveAnchors(); 
            renderAnchors(); 
            renderAnchorMarkers();
        }
    });
    anchorList.addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT') { const a = anchors.find(a=>a.id==e.target.dataset.id); if(a){a.note=e.target.value; saveAnchors();} }
    });

    function saveAnchors() { localStorage.setItem('echoflow_anchors', JSON.stringify(anchors)); }
    
    // --- データ保存・読込 ---
    exportBtn.addEventListener('click', () => {
        const data = {
            version: "1.0",
            script1: scriptInput.value,
            script2: scriptInput2.value,
            notes: noteInput.value,
            anchors: anchors,
            timestamp: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `echoflow_lesson_${new Date().getTime()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                const confirmMsg = userLang.startsWith('ja') ? '現在のデータを上書きして、教材を読み込みますか？' : 'Overwrite current data and load this lesson?';
                if (confirm(confirmMsg)) {
                    scriptInput.value = data.script1 || '';
                    scriptInput2.value = data.script2 || '';
                    noteInput.value = data.notes || '';
                    anchors = data.anchors || [];
                    anchors.sort((a, b) => a.time - b.time);
                    
                    localStorage.setItem('echoflow_script', scriptInput.value);
                    localStorage.setItem('echoflow_script2', scriptInput2.value);
                    localStorage.setItem('echoflow_notes', noteInput.value);
                    saveAnchors();
                    
                    renderAnchors();
                    renderAnchorMarkers();
                    const doneMsg = userLang.startsWith('ja') ? '読み込みが完了しました！' : 'Import completed!';
                    alert(doneMsg);
                }
            } catch (err) {
                const errMsg = userLang.startsWith('ja') ? 'ファイルの形式が正しくありません。' : 'Invalid file format.';
                alert(errMsg);
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset for next time
    });

    function formatTime(s) {
        if (isNaN(s)) return "00:00";
        const m = Math.floor(s/60); const sc = Math.floor(s%60);
        return `${m.toString().padStart(2,'0')}:${sc.toString().padStart(2,'0')}`;
    }

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName == 'TEXTAREA' || e.target.tagName == 'INPUT') return;
        if (e.code === 'Enter' && syncModeBtn.classList.contains('active')) { e.preventDefault(); markCurrentTime(); }
        if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
        if (e.code === 'ArrowLeft') { e.preventDefault(); skip(-5); }
        if (e.code === 'ArrowRight') { e.preventDefault(); skip(5); }
    });

    scriptInput.addEventListener('input', (e) => { localStorage.setItem('echoflow_script', e.target.value); });
    scriptInput2.addEventListener('input', (e) => { localStorage.setItem('echoflow_script2', e.target.value); });
    noteInput.addEventListener('input', (e) => { localStorage.setItem('echoflow_notes', e.target.value); });
});
