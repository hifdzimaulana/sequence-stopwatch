// ========== State ==========
let events = [];
let state = 'setup';
let currentIdx = 0;
let eventStartReal = 0;
let sequenceStartReal = 0;
let pauseAccumulated = 0;
let pauseStart = 0;
let intervalId = null;
let cumulativeOvertime = 0;
let sessionName = '';

// ========== Utilities ==========
function fmt(sec) {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

function fmtSign(sec) {
    const s = Math.floor(sec);
    const prefix = s >= 0 ? '+' : '-';
    const abs = Math.abs(s);
    const m = Math.floor(abs / 60);
    const ss = abs % 60;
    return `${prefix}${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

function totalPlannedSec() {
    return events.reduce((sum, e) => sum + e.plannedDuration, 0);
}

function getElapsed() {
    if (state === 'setup') return 0;
    return Math.max(0, (Date.now() - sequenceStartReal - pauseAccumulated) / 1000);
}

function getEventElapsed() {
    if (state === 'setup' || state === 'complete') return 0;
    let el = (Date.now() - eventStartReal) / 1000;
    if (state === 'paused') el -= (Date.now() - pauseStart);
    return Math.max(0, el);
}

function showToast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    const icons = { success: 'fa-circle-check', warning: 'fa-triangle-exclamation', error: 'fa-circle-xmark' };
    t.innerHTML = `<i class="fa-solid ${icons[type] || icons.success}"></i> ${msg}`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// ========== Setup ==========
function addEvent() {
    const nameEl = document.getElementById('eventName');
    const minEl = document.getElementById('eventMin');
    const secEl = document.getElementById('eventSec');
    const name = nameEl.value.trim();
    const mins = parseInt(minEl.value) || 0;
    const secs = parseInt(secEl.value) || 0;
    const duration = mins * 60 + secs;

    if (!name) { showToast('Enter an event name', 'warning'); nameEl.focus(); return; }
    if (duration <= 0) { showToast('Duration must be greater than 0', 'warning'); minEl.focus(); return; }

    events.push({ name, plannedDuration: duration });
    nameEl.value = ''; minEl.value = ''; secEl.value = '';
    nameEl.focus();
    renderSetupList();
    showToast(`"${name}" added`);
}

function removeEvent(idx) {
    events.splice(idx, 1);
    renderSetupList();
}

function renderSetupList() {
    const list = document.getElementById('eventList');
    const empty = document.getElementById('emptyState');
    const startArea = document.getElementById('startArea');

    if (events.length === 0) {
        list.innerHTML = ''; empty.style.display = ''; startArea.style.display = 'none'; return;
    }
    empty.style.display = 'none'; startArea.style.display = '';
    document.getElementById('totalPlanned').textContent = fmt(totalPlannedSec());
    document.getElementById('totalEvents').textContent = events.length;

    let html = '';
    const total = totalPlannedSec();
    let cum = 0;
    events.forEach((ev, i) => {
        const end = cum + ev.plannedDuration;
        const wPct = total > 0 ? (ev.plannedDuration / total * 100) : 0;
        const lPct = total > 0 ? (cum / total * 100) : 0;
        html += `
        <div class="event-row p-4">
            <div class="flex items-center gap-3">
                <div class="flex flex-col items-center" style="width: 28px;">
                    <span class="text-xs font-bold font-mono" style="color: var(--muted);">${i + 1}</span>
                    ${i < events.length - 1 ? '<div style="width:1px; height:16px; background: var(--border); margin-top: 4px;"></div>' : ''}
                </div>
                <div class="status-dot pending"></div>
                <div class="flex-1 min-w-0">
                    <p class="event-name font-semibold text-sm truncate">${ev.name}</p>
                    <p class="text-xs font-mono mt-1" style="color: var(--muted);">${fmt(ev.plannedDuration)} &nbsp;|&nbsp; ${fmt(cum)} → ${fmt(end)}</p>
                </div>
                <div class="hidden sm:block" style="width: 200px; margin-left: 12px;">
                    <div style="background: var(--bg); border-radius: 6px; height: 24px; position: relative;">
                        <div style="position: absolute; left: ${lPct}%; width: ${wPct}%; height: 100%; background: var(--accent-dim); border: 1px solid rgba(16,185,129,0.3); border-radius: 5px;"></div>
                    </div>
                </div>
                <button class="btn-icon" onclick="removeEvent(${i})" title="Remove"><i class="fa-solid fa-trash-can" style="font-size: 12px;"></i></button>
            </div>
        </div>`;
        cum = end;
    });
    list.innerHTML = html;
}

// ========== File I/O ==========
function saveToFile() {
    if (events.length === 0) { showToast('No events to save', 'warning'); return; }
    const currentSessionName = document.getElementById('sessionName').value.trim() || 'Untitled Session';
    let text = `# Sequence Stopwatch: ${currentSessionName}\n`;
    text += `# Events: ${events.length} | Duration: ${fmt(totalPlannedSec())}\n\n`;
    let cum = 0;
    events.forEach((ev, i) => {
        text += `${i + 1}. ${ev.name} | ${fmt(ev.plannedDuration)} (${fmt(cum)} -> ${fmt(cum + ev.plannedDuration)})\n`;
        cum += ev.plannedDuration;
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = 'sequence-stopwatch.txt';
    a.click();
    showToast('Saved to file');
}

function loadFromFile() { document.getElementById('fileInput').click(); }

function handleFileLoad(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        const lines = ev.target.result.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
        const loaded = [];
        for (const line of lines) {
            const match = line.match(/^\d+\.\s*(.+?)\s*\|\s*([\d:]+)\s*(?:\(|$)/);
            if (match) {
                const name = match[1].trim();
                const parts = match[2].trim().split(':').map(Number);
                let dur = 0;
                if (parts.length === 3) dur = parts[0]*3600 + parts[1]*60 + parts[2];
                else if (parts.length === 2) dur = parts[0]*60 + parts[1];
                else dur = parts[0];
                if (name && dur > 0) loaded.push({ name, plannedDuration: dur });
            }
        }
        if (loaded.length > 0) { events = loaded; renderSetupList(); showToast(`Loaded ${loaded.length} events`); }
        else showToast('Could not parse file', 'error');
    };
    reader.readAsText(file);
    e.target.value = '';
}

// ========== Timer Control ==========
function startTimer() {
    if (events.length === 0) return;
    sessionName = document.getElementById('sessionName').value.trim() || 'Untitled Session';
    state = 'running';
    currentIdx = 0;
    cumulativeOvertime = 0;
    pauseAccumulated = 0;
    sequenceStartReal = Date.now();
    eventStartReal = sequenceStartReal;

    events.forEach(ev => { ev.actualDuration = null; ev.overtime = null; });

    document.getElementById('setupView').style.display = 'none';
    document.getElementById('timerView').style.display = '';
    renderTimerList();
    updateTimerDisplay();
    intervalId = setInterval(updateTimerDisplay, 100);
}

function togglePause() {
    const btn = document.getElementById('btnPause');
    if (state === 'running') {
        state = 'paused';
        pauseStart = Date.now();
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Resume';
        btn.className = 'btn btn-primary flex-1';
        clearInterval(intervalId);
    } else if (state === 'paused') {
        pauseAccumulated += Date.now() - pauseStart;
        state = 'running';
        btn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
        btn.className = 'btn btn-warning flex-1';
        intervalId = setInterval(updateTimerDisplay, 100);
    }
}

function markDone() {
    const actualDur = getEventElapsed();
    finishCurrentEvent(actualDur);
}

function stopTimer() {
    clearInterval(intervalId);
    state = 'setup';
    sessionName = '';
    document.getElementById('timerView').style.display = 'none';
    document.getElementById('setupView').style.display = '';
    document.getElementById('overtimeBanner').style.display = 'none';
    renderSetupList();
    showToast('Sequence stopped', 'warning');
}

function finishCurrentEvent(actualDuration) {
    const ev = events[currentIdx];
    ev.actualDuration = actualDuration;
    ev.overtime = actualDuration - ev.plannedDuration;
    cumulativeOvertime += Math.max(0, ev.overtime);

    currentIdx++;
    if (currentIdx >= events.length) {
        completeSequence();
        return;
    }

    eventStartReal = Date.now();
    if (state === 'paused') {
        pauseStart = Date.now();
    }

    renderTimerList();

    if (ev.overtime > 0) {
        for (let i = currentIdx; i < events.length; i++) {
            const row = document.getElementById('timer-row-' + i);
            if (row) {
                setTimeout(() => row.classList.add('cascade-late'), (i - currentIdx) * 100);
                setTimeout(() => row.classList.remove('cascade-late'), (i - currentIdx) * 100 + 500);
            }
        }
    }
}

function completeSequence() {
    clearInterval(intervalId);
    state = 'complete';
    renderTimerList();

    setTimeout(() => {
        renderResultChart();
        renderResultSummary();
        document.getElementById('resultModal').style.display = '';
    }, 500);
}

// ========== Timer Display ==========
function updateTimerDisplay() {
    if (state !== 'running' && state !== 'paused') return;

    const elapsed = getElapsed();
    const ev = events[currentIdx];
    if (!ev) return;

    const eventElapsed = getEventElapsed();
    const progress = Math.min(1, eventElapsed / ev.plannedDuration);
    const isOvertime = eventElapsed > ev.plannedDuration;

    const ring = document.getElementById('progressRing');
    const circumference = 2 * Math.PI * 78;
    ring.style.strokeDashoffset = circumference * (1 - Math.min(progress, 1));
    ring.classList.toggle('overtime', isOvertime);

    const timerEl = document.getElementById('currentTimer');
    timerEl.textContent = fmt(eventElapsed);
    timerEl.style.color = isOvertime ? 'var(--danger)' : 'var(--accent)';

    document.getElementById('currentProgress').textContent =
        isOvertime ? `OT ${fmtSign(eventElapsed - ev.plannedDuration)}` : `${Math.floor(progress * 100)}%`;

    document.getElementById('currentEventName').textContent = `${currentIdx + 1}. ${ev.name}`;

    const doneBtn = document.getElementById('btnDone');
    if (isOvertime) {
        doneBtn.classList.add('overtime-state');
        doneBtn.innerHTML = `<i class="fa-solid fa-check"></i> Mark Done (${fmtSign(eventElapsed - ev.plannedDuration)} late)`;
    } else {
        doneBtn.classList.remove('overtime-state');
        doneBtn.innerHTML = `<i class="fa-solid fa-check"></i> Mark Done`;
    }

    document.getElementById('statPlanned').textContent = fmt(totalPlannedSec());
    document.getElementById('statActual').textContent = fmt(elapsed);
    const totalOT = elapsed - totalPlannedSec();
    const otEl = document.getElementById('statOvertime');
    otEl.textContent = fmtSign(totalOT);
    otEl.style.color = totalOT > 0 ? 'var(--danger)' : 'var(--success)';
    document.getElementById('statProgress').textContent = `${currentIdx}/${events.length}`;

    const banner = document.getElementById('overtimeBanner');
    if (totalOT > 0) {
        banner.style.display = 'flex';
        document.getElementById('bannerOvertime').textContent = fmtSign(totalOT);
    } else {
        banner.style.display = 'none';
    }

    updateTimelineBars(elapsed);
}

function updateTimelineBars(totalElapsed) {
    const totalPlanned = totalPlannedSec();
    if (totalPlanned <= 0) return;
    const maxTime = Math.max(totalPlanned, totalElapsed) * 1.08;
    updateTimeAxis(maxTime);
    const scale = 100 / maxTime;

    events.forEach((ev, i) => {
        const bar = document.getElementById('bar-fill-' + i);
        const statusDot = document.getElementById('dot-' + i);
        if (!bar) return;

        if (i < currentIdx) {
            const w = (ev.actualDuration || 0) * scale;
            bar.style.width = w + '%';
            bar.style.background = (ev.overtime || 0) > 0
                ? 'linear-gradient(90deg, var(--accent) 0%, var(--danger) 100%)'
                : 'var(--accent)';
            if (statusDot) statusDot.className = 'status-dot completed';
        } else if (i === currentIdx) {
            const w = getEventElapsed() * scale;
            bar.style.width = w + '%';
            bar.style.background = getEventElapsed() > ev.plannedDuration ? 'var(--danger)' : 'var(--accent)';
            if (statusDot) statusDot.className = 'status-dot active';
        } else {
            bar.style.width = '0%';
            if (statusDot) statusDot.className = 'status-dot pending';
        }
    });
}

function updateTimeAxis(maxTime) {
    const axis = document.getElementById('timeAxis');
    let tickInterval;
    if (maxTime < 120) tickInterval = 30;
    else if (maxTime < 300) tickInterval = 60;
    else if (maxTime < 900) tickInterval = 120;
    else if (maxTime < 1800) tickInterval = 300;
    else tickInterval = 600;

    const scale = 100 / maxTime;
    let html = '<div class="flex" style="position: relative; height: 18px;">';
    for (let t = 0; t <= maxTime; t += tickInterval) {
        html += `<span class="absolute text-xs font-mono" style="left: ${t * scale}%; transform: translateX(-50%); color: var(--border);">${fmt(t)}</span>`;
    }
    html += '</div>';
    axis.innerHTML = html;
}

// ========== Timer List Rendering ==========
function renderTimerList() {
    const container = document.getElementById('timerEventList');
    const totalPlanned = totalPlannedSec();
    const maxTime = Math.max(totalPlanned, 1) * 1.08;
    const scale = 100 / maxTime;

    let html = '';
    let cum = 0;

    events.forEach((ev, i) => {
        const barWidth = ev.plannedDuration * scale;
        const barLeft = cum * scale;
        const isCompleted = i < currentIdx;
        const isActive = i === currentIdx;
        const isLate = isCompleted && (ev.overtime || 0) > 0;

        let rowClass = '';
        if (isCompleted) rowClass = 'completed';
        if (isActive) rowClass = 'active';

        html += `
        <div id="timer-row-${i}" class="event-row ${rowClass} p-3">
            <div class="flex items-center gap-3 mb-2">
                <span class="text-xs font-bold font-mono" style="color: var(--muted); width: 20px;">${i + 1}</span>
                <div id="dot-${i}" class="status-dot ${isCompleted ? 'completed' : isActive ? 'active' : 'pending'}"></div>
                <span class="event-name font-semibold text-sm flex-1 truncate">${ev.name}</span>
                <span class="text-xs font-mono" style="color: var(--muted);">Plan: ${fmt(ev.plannedDuration)}</span>
                ${isCompleted ? `
                    <span class="text-xs font-mono" style="color: var(--text);">Actual: ${fmt(ev.actualDuration)}</span>
                    ${isLate ? `<span class="overtime-badge">${fmtSign(ev.overtime)}</span>` : ''}
                ` : ''}
            </div>
            <div class="pl-8">
                <div style="background: var(--bg); border-radius: 6px; height: 28px; position: relative; overflow: hidden;">
                    <div style="position: absolute; left: ${barLeft}%; width: ${barWidth}%; height: 100%; background: rgba(37,51,71,0.5); border-radius: 5px;"></div>
                    <div id="bar-fill-${i}" style="position: absolute; left: ${barLeft}%; width: 0%; height: 100%; top: 0; border-radius: 6px; transition: width 0.15s linear;"></div>
                </div>
            </div>
        </div>`;
        cum += ev.plannedDuration;
    });

    container.innerHTML = html;
    updateTimeAxis(maxTime);
}

// ========== Result Chart ==========
function renderResultChart() {
    const canvas = document.getElementById('resultChart');
    const dpr = window.devicePixelRatio || 1;
    const W = 720;
    const H = Math.max(400, events.length * 64 + 200);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0d1520';
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 12);
    ctx.fill();

    const padLeft = 100;
    const padRight = 50;
    const padTop = 110;
    const padBottom = 50;
    const barAreaW = W - padLeft - padRight;
    const rowH = Math.min(56, Math.max(36, (H - padTop - padBottom) / events.length));

    const totalPlanned = totalPlannedSec();
    const totalActual = events.reduce((s, e) => s + (e.actualDuration || 0), 0);
    const maxTime = Math.max(totalPlanned, totalActual, 1) * 1.08;

    ctx.fillStyle = '#dce4ed';
    ctx.font = 'bold 18px Space Grotesk, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${sessionName} — Result`, padLeft, 36);
    ctx.fillStyle = '#6b8299';
    ctx.font = '13px Space Grotesk, sans-serif';
    ctx.fillText(new Date().toLocaleString(), padLeft, 56);

    let tickInterval;
    if (maxTime < 120) tickInterval = 30;
    else if (maxTime < 300) tickInterval = 60;
    else if (maxTime < 900) tickInterval = 120;
    else if (maxTime < 1800) tickInterval = 300;
    else tickInterval = 600;

    ctx.textAlign = 'center';
    ctx.font = '11px JetBrains Mono, monospace';
    for (let t = 0; t <= maxTime; t += tickInterval) {
        const x = padLeft + (t / maxTime) * barAreaW;
        ctx.strokeStyle = 'rgba(37,51,71,0.5)';
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(x, padTop - 8); ctx.lineTo(x, padTop + events.length * rowH + 8); ctx.stroke();
        ctx.fillStyle = '#6b8299';
        ctx.fillText(fmt(t), x, padTop - 14);
    }

    let plannedCum = 0;
    let actualCum = 0;
    events.forEach((ev, i) => {
        const y = padTop + i * rowH;
        const barY = y + 8;
        const barH = rowH - 16;
        const planX = padLeft + (plannedCum / maxTime) * barAreaW;
        const actualX = padLeft + (actualCum / maxTime) * barAreaW;
        const planW = Math.max(4, (ev.plannedDuration / maxTime) * barAreaW);
        const actualW = Math.max(4, ((ev.actualDuration || 0) / maxTime) * barAreaW);
        const isLate = (ev.overtime || 0) > 0;

        ctx.fillStyle = 'rgba(37,51,71,0.6)';
        ctx.beginPath(); ctx.roundRect(planX, barY, planW, barH, 4); ctx.fill();
        ctx.strokeStyle = 'rgba(107,130,153,0.3)'; ctx.lineWidth = 1; ctx.stroke();

        if (isLate) {
            const onTimeW = Math.max(0, (ev.plannedDuration / maxTime) * barAreaW);
            ctx.fillStyle = '#10b981';
            ctx.beginPath(); ctx.roundRect(actualX, barY, onTimeW, barH, 4); ctx.fill();
            const otW = Math.max(0, (ev.overtime / maxTime) * barAreaW);
            if (otW > 0) {
                ctx.fillStyle = '#ef4444';
                ctx.beginPath(); ctx.roundRect(actualX + onTimeW, barY, otW, barH, [0, 4, 4, 0]); ctx.fill();
            }
        } else {
            ctx.fillStyle = '#10b981';
            ctx.beginPath(); ctx.roundRect(actualX, barY, actualW, barH, 4); ctx.fill();
        }

        ctx.fillStyle = '#dce4ed';
        ctx.font = '13px Space Grotesk, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(ev.name.length > 16 ? ev.name.substring(0, 15) + '…' : ev.name, padLeft - 14, barY + barH / 2 + 4);

        ctx.fillStyle = '#0b0f14';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.textAlign = 'left';
        if (actualW > 50) ctx.fillText(fmt(ev.actualDuration || 0), actualX + 6, barY + barH / 2 + 4);

        if (isLate) {
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 11px JetBrains Mono, monospace';
            ctx.textAlign = 'left';
            ctx.fillText(fmtSign(ev.overtime), actualX + actualW + 8, barY + barH / 2 + 4);
        }

        plannedCum += ev.plannedDuration;
        actualCum += ev.actualDuration || 0;
    });

    const sumY = padTop + events.length * rowH + 25;
    const planTotalW = (totalPlanned / maxTime) * barAreaW;
    ctx.fillStyle = 'rgba(107,130,153,0.3)';
    ctx.fillRect(padLeft, sumY, planTotalW, 3);

    const actualTotalW = (totalActual / maxTime) * barAreaW;
    ctx.fillStyle = totalActual > totalPlanned ? '#ef4444' : '#10b981';
    ctx.fillRect(padLeft, sumY + 7, actualTotalW, 3);

    const legY = sumY + 28;
    ctx.font = '11px Space Grotesk, sans-serif';
    ctx.textAlign = 'left';

    ctx.fillStyle = 'rgba(37,51,71,0.6)';
    ctx.fillRect(padLeft, legY, 12, 12);
    ctx.fillStyle = '#6b8299';
    ctx.fillText('Planned', padLeft + 18, legY + 10);

    ctx.fillStyle = '#10b981';
    ctx.fillRect(padLeft + 90, legY, 12, 12);
    ctx.fillStyle = '#6b8299';
    ctx.fillText('Actual', padLeft + 108, legY + 10);

    ctx.fillStyle = '#ef4444';
    ctx.fillRect(padLeft + 175, legY, 12, 12);
    ctx.fillStyle = '#6b8299';
    ctx.fillText('Overtime', padLeft + 193, legY + 10);

    const totalOT = totalActual - totalPlanned;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#dce4ed';
    ctx.font = 'bold 13px JetBrains Mono, monospace';
    ctx.fillText(`Planned: ${fmt(totalPlanned)}`, W - padRight, legY + 10);
    ctx.fillText(`Actual: ${fmt(totalActual)}`, W - padRight, legY + 26);
    ctx.fillStyle = totalOT > 0 ? '#ef4444' : '#22c55e';
    ctx.fillText(`Variance: ${fmtSign(totalOT)}`, W - padRight, legY + 42);
}

function renderResultSummary() {
    const totalPlanned = totalPlannedSec();
    const totalActual = events.reduce((s, e) => s + (e.actualDuration || 0), 0);
    const totalOT = totalActual - totalPlanned;
    const lateCount = events.filter(e => (e.overtime || 0) > 0).length;

    document.getElementById('resultSummary').innerHTML = `
        <div class="rounded-lg p-4 text-center" style="background: var(--surface);">
            <p class="text-xs" style="color: var(--muted);">Total Actual</p>
            <p class="text-lg font-bold font-mono" style="color: var(--text);">${fmt(totalActual)}</p>
        </div>
        <div class="rounded-lg p-4 text-center" style="background: ${totalOT > 0 ? 'var(--danger-dim)' : 'rgba(34,197,94,0.1)'};">
            <p class="text-xs" style="color: var(--muted);">Variance</p>
            <p class="text-lg font-bold font-mono" style="color: ${totalOT > 0 ? 'var(--danger)' : 'var(--success)'};">${fmtSign(totalOT)}</p>
        </div>
        <div class="rounded-lg p-4 text-center" style="background: var(--surface);">
            <p class="text-xs" style="color: var(--muted);">Late Events</p>
            <p class="text-lg font-bold font-mono" style="color: ${lateCount > 0 ? 'var(--warning)' : 'var(--success)'};">${lateCount}/${events.length}</p>
        </div>
    `;
}

function downloadChart() {
    const link = document.createElement('a');
    link.download = 'sequence-result.png';
    link.href = document.getElementById('resultChart').toDataURL('image/png');
    link.click();
    showToast('Chart downloaded');
}

function closeResult() {
    document.getElementById('resultModal').style.display = 'none';
    stopTimer();
}

// ========== Init ==========
renderSetupList();