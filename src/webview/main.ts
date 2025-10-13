// @ts-nocheck
// Webview minimal scaffolding (Step 6): render sources table and Save button.

declare const acquireVsCodeApi: () => { postMessage(msg: unknown): void; setState(data: any): void; getState(): any };
const vscodeApi = acquireVsCodeApi();

let currentModel: any | undefined;

// UI Constants (webview context cannot import from ../constants.ts)
const UI = {
    PACKAGE_SOURCES: 'Package Sources',
    KEY: 'Key',
    URL: 'URL',
    ENABLED: 'Enabled',
    ACTIONS: 'Actions',
    NO_SOURCES: '(No sources)',
    YES: 'Yes',
    NO: 'No',
    EDIT_SOURCE: 'Edit source',
    EDIT: 'Edit',
    DISABLE_SOURCE: 'Disable source',
    ENABLE_SOURCE: 'Enable source',
    DISABLE: 'Disable',
    ENABLE: 'Enable',
    DELETE_SOURCE: 'Delete source',
    DELETE: 'Delete',
    ADD_SOURCE: 'Add source',
    PACKAGE_SOURCE_MAPPINGS: 'Package Source Mappings',
    PATTERN: 'pattern',
    PATTERNS: 'patterns',
    REMOVE_PATTERN: 'Remove pattern',
    ADD_PATTERN: 'Add pattern',
    SAVE: 'Save',
    CANCEL: 'Cancel',
    LOADING: 'Loading nuget.config...',
    UNKNOWN_ERROR: 'Unknown error',
    SAVE_FAILED_PREFIX: 'Save failed: '
};

function $(sel: string) { return document.querySelector(sel); }

let __stylesInjected = false;
function ensureStyles() {
    if (__stylesInjected) { return; }
    __stylesInjected = true;
    const css = `
    :root { --nce-gap: .5rem; }
    html,body { height:100%; margin:0; }
    #nuget-config-editor-root { padding: 1rem; font-family: var(--vscode-font-family); color:var(--vscode-foreground); }
    #nuget-config-editor-root h2 { font-size: 1.1rem; margin: 0 0 .5rem 0; }
    .mappings-panel { margin: 1rem 0 0 0; }
    .mapping-src { margin: .5em 0; padding: .5em; background: var(--vscode-editorWidget-background); border-radius: 6px; display:block; }
    .mapping-header { display:flex; justify-content:space-between; align-items:center; gap:.5rem; margin-bottom:.45rem; }
    .mapping-header .src-key { font-weight:700; }
    .patterns { margin: 0; padding: 0; list-style: none; display:block; }
    .patterns li { display:flex; align-items:center; justify-content:space-between; gap:.5rem; padding:2px 0; }
    .pattern-label { display:inline-flex; align-items:center; gap:.25rem; }
    .badge { background:var(--vscode-badge-background); color:var(--vscode-badge-foreground); padding:2px 6px; border-radius:2px; font-size:0.85em; vertical-align:baseline; }
    .add-pattern { display:flex; gap:.5rem; align-items:center; margin-top:.35rem; }
    .sources-table { width:100%; border-collapse:collapse; font-size:0.95rem; }
    .sources-table th, .sources-table td { text-align:left; padding:8px 6px; vertical-align:middle; border-top:1px solid var(--vscode-editorWidget-border); }
    .sources-table thead th { font-weight:600; color:var(--vscode-foreground); }
    .sources-table th:last-child, .sources-table td:last-child { width:160px; }
    /* Disabled source row styling */
    .sources-table tbody tr.disabled-source td:first-child { text-decoration: line-through; opacity: 0.7; }
    .sources-table tbody tr.disabled-source .urlCell { color: var(--vscode-descriptionForeground); font-style: italic; }
    /* Status indicators with icons */
    .status-indicator { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.9em; }
    .status-indicator.enabled { color: var(--vscode-testing-iconPassed); }
    .status-indicator.disabled { color: var(--vscode-testing-iconFailed); }
    .actions-cell { display:flex; gap:.4rem; align-items:center; flex-wrap:nowrap; justify-content:flex-start; white-space:nowrap; }
    .form-row { display:flex; gap:.5rem; align-items:baseline; }
    .form-row input[type="text"], .form-row input[type="url"], .form-row input { font-family: var(--vscode-font-family); font-size: 0.95rem; }
    .small-input { flex:0 0 140px; min-width:90px; height:32px; padding:4px 8px; border-radius:4px; border:1px solid var(--vscode-input-border); background:var(--vscode-input-background); color:var(--vscode-input-foreground); }
    .full-input { flex:1 1 auto; min-width:140px; height:32px; padding:4px 8px; border-radius:4px; border:1px solid var(--vscode-input-border); background:var(--vscode-input-background); color:var(--vscode-input-foreground); }
    /* Icon-style buttons that resemble VS Code icon buttons (icon-only) */
    .vscode-btn { background: transparent; border: none; padding:0; width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center; border-radius:4px; color:var(--vscode-icon-foreground); cursor:pointer; transition: background .08s ease, transform .02s ease; }
    .vscode-btn:hover { background: var(--vscode-button-hoverBackground); color: var(--vscode-button-foreground); }
    .vscode-btn:active { background: var(--vscode-button-activeBackground); color: var(--vscode-button-foreground); transform: translateY(1px); }
    .vscode-btn:focus { outline: none; box-shadow: 0 0 0 1px var(--vscode-focusBorder); color: var(--vscode-button-foreground); }
    .vscode-btn.icon-only { padding:0; }
    /* Slightly larger-looking save button (text or icon+text) */
    .vscode-btn.save { width:auto; height:auto; padding:6px 10px; display:inline-flex; gap:6px; align-items:center; }
    .nuget-error { color: var(--vscode-editorError-foreground); }
    `;
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
}

function render(model: any) {
    currentModel = model;
    const container = $('#nuget-config-editor-root');
    if (!container) { return; }
    // Ensure any legacy loading element is removed
    const legacyLoading = document.getElementById('loading');
    if (legacyLoading) { legacyLoading.remove(); }
    ensureStyles();
    container.innerHTML = '';
    // Package Sources heading and table first
    const heading = document.createElement('h2');
    heading.textContent = UI.PACKAGE_SOURCES;
    container.appendChild(heading);

    // Package Sources table (render first)
    const table = document.createElement('table');
    table.className = 'sources-table';
    table.innerHTML = `<thead><tr><th>${UI.KEY}</th><th>${UI.URL}</th><th>${UI.ENABLED}</th><th>${UI.ACTIONS}</th></tr></thead>`;
    const tbody = document.createElement('tbody');
    if (!model.sources.length) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="4" style="opacity:.7;">${UI.NO_SOURCES}</td>`;
        tbody.appendChild(tr);
    } else {
        for (const s of model.sources) {
            const tr = document.createElement('tr');
            tr.dataset.key = s.key;
            
            // Apply disabled styling if source is disabled
            if (!s.enabled) {
                tr.classList.add('disabled-source');
            }
            
            // Enhanced status indicator with icon and text
            const statusIcon = s.enabled ? 'codicon-check-all' : 'codicon-circle-slash';
            const statusClass = s.enabled ? 'enabled' : 'disabled';
            const statusText = s.enabled ? UI.YES : UI.NO;
            
            tr.innerHTML = `<td>${escapeHtml(s.key)}</td>`+
                `<td class="urlCell">${escapeHtml(s.url)}</td>`+
                `<td><span class="status-indicator ${statusClass}"><i class="codicon ${statusIcon}"></i>${statusText}</span></td>`+
                `<td class="actions-cell">`+
                `<button data-act='edit' aria-label='${UI.EDIT_SOURCE}' title='${UI.EDIT}' class='codicon codicon-edit vscode-btn icon-only'></button>`+
                `<button data-act='toggle' aria-label='${s.enabled ? UI.DISABLE_SOURCE : UI.ENABLE_SOURCE}' title='${s.enabled ? UI.DISABLE : UI.ENABLE}' class='codicon ${s.enabled ? 'codicon-circle-slash' : 'codicon-check'} vscode-btn icon-only'></button>`+
                `<button data-act='delete' aria-label='${UI.DELETE_SOURCE}' title='${UI.DELETE}' class='codicon codicon-trash vscode-btn icon-only'></button>`+
                `</td>`;
            tbody.appendChild(tr);
        }
    }
    table.appendChild(tbody);
    container.appendChild(table);

    // Add Source form - place this right after the package sources table
    const addForm = document.createElement('div');
    addForm.className = 'form-row';
    addForm.innerHTML = `<input placeholder='${UI.KEY}' class='small-input' aria-label='Source key' />`+
        `<input placeholder='${UI.URL}' class='full-input' aria-label='Source URL' />`+
        `<button aria-label='${UI.ADD_SOURCE}' title='${UI.ADD_SOURCE}' class='codicon codicon-add vscode-btn icon-only'></button>`;
    const [keyInput, urlInput, addBtn] = Array.from(addForm.querySelectorAll('input,button')) as [HTMLInputElement, HTMLInputElement, HTMLButtonElement];
    addBtn.addEventListener('click', () => {
        if (!keyInput.value.trim() || !urlInput.value.trim()) { return; }
        vscodeApi.postMessage({ type: 'edit', ops: [{ kind: 'addSource', key: keyInput.value.trim(), url: urlInput.value.trim() }] });
        keyInput.value = '';
        urlInput.value = '';
    });
    // add a little spacing and append to container right after the table
    const addWrapper = document.createElement('div');
    addWrapper.style.marginTop = '.5rem';
    addWrapper.appendChild(addForm);
    container.appendChild(addWrapper);

    // Mappings Panel (render after sources)
    const mappingsHeading = document.createElement('h2');
    mappingsHeading.textContent = UI.PACKAGE_SOURCE_MAPPINGS;
    container.appendChild(mappingsHeading);

    const mappingsPanel = document.createElement('div');
    mappingsPanel.className = 'mappings-panel';
    for (const src of model.sources) {
        const mapping = (model.mappings || []).find((m: any) => m.sourceKey === src.key);
        const patterns = mapping ? mapping.patterns : [];
        const srcDiv = document.createElement('div');
        srcDiv.className = 'mapping-src';
        // header with key and count
        const header = document.createElement('div');
        header.className = 'mapping-header';
        header.innerHTML = `<div><span class='src-key'>${escapeHtml(src.key)}</span> <span style="opacity:.7; margin-left:.5rem;">(${patterns.length} ${patterns.length!==1 ? UI.PATTERNS : UI.PATTERN})</span></div>`;
        srcDiv.appendChild(header);
        // Patterns list
        const patList = document.createElement('ul');
        patList.className = 'patterns';
        for (const pat of patterns) {
            const li = document.createElement('li');
            li.innerHTML = `<div class='pattern-label'><span class='badge'>${escapeHtml(pat)}</span></div><div><button data-act='removePattern' data-key='${src.key}' data-pattern='${escapeHtml(pat)}' aria-label='${UI.REMOVE_PATTERN}' title='${UI.REMOVE_PATTERN}' class='codicon codicon-close vscode-btn icon-only'></button></div>`;
            patList.appendChild(li);
        }
        // Add pattern input
        const addPatDiv = document.createElement('div');
        addPatDiv.className = 'add-pattern';
        addPatDiv.innerHTML = `<input type='text' placeholder='${UI.ADD_PATTERN}' class='small-input' aria-label='${UI.ADD_PATTERN}' /> <button data-act='addPattern' data-key='${src.key}' aria-label='${UI.ADD_PATTERN}' title='${UI.ADD_PATTERN}' class='codicon codicon-add vscode-btn icon-only'></button>`;
        srcDiv.appendChild(patList);
        srcDiv.appendChild(addPatDiv);
        mappingsPanel.appendChild(srcDiv);
    }
    container.appendChild(mappingsPanel);

    // Actions container (edits are applied immediately via messages)

    tbody.addEventListener('click', (e: any) => {
        const btn = e.target.closest('button');
        if (!btn) { return; }
        const tr = btn.closest('tr');
        const key = tr?.dataset.key;
        if (!key) { return; }
        const act = btn.getAttribute('data-act');
        if (act === 'toggle') {
            const src = model.sources.find((s: any) => s.key === key);
            vscodeApi.postMessage({ type: 'edit', ops: [{ kind: 'toggleSource', key, enabled: !src.enabled }] });
        } else if (act === 'delete') {
            // Webviews are sandboxed and confirm() is ignored; ask the host to show a native confirmation
            vscodeApi.postMessage({ type: 'requestDelete', key });
        } else if (act === 'edit') {
            enterEditRow(tr, key, model);
        }
    });

    // Mappings panel events
    mappingsPanel.addEventListener('click', (e: any) => {
        const btn = e.target.closest('button');
        if (!btn) { return; }
        const act = btn.getAttribute('data-act');
        const key = btn.getAttribute('data-key');
        if (!key) { return; }
        if (act === 'removePattern') {
            const pattern = btn.getAttribute('data-pattern');
            if (!pattern) { return; }
            const mapping = (model.mappings || []).find((m: any) => m.sourceKey === key);
            if (!mapping) { return; }
            const newPatterns = mapping.patterns.filter((p: string) => p !== pattern);
            vscodeApi.postMessage({ type: 'edit', ops: [{ kind: 'setMappings', key, patterns: newPatterns }] });
        } else if (act === 'addPattern') {
            const input = btn.parentElement.querySelector('input');
            if (!input) { return; }
            const val = input.value.trim();
            if (!val) { return; }
            const mapping = (model.mappings || []).find((m: any) => m.sourceKey === key);
            const patterns = mapping ? mapping.patterns.slice() : [];
            if (patterns.includes(val)) { return; }
            patterns.push(val);
            // Use the expected top-level 'type' property so the host handles this message
            vscodeApi.postMessage({ type: 'edit', ops: [{ kind: 'setMappings', key, patterns }] });
            input.value = '';
        }
    });
}

function enterEditRow(tr: HTMLTableRowElement, key: string, model: any) {
    const source = model.sources.find((s: any) => s.key === key);
    if (!source) { return; }
    const cells = tr.querySelectorAll('td');
    const keyCell = cells[0];
    const urlCell = cells[1];
    const enabledCell = cells[2];
    const actionsCell = cells[3];
    keyCell.innerHTML = `<input value='${escapeHtml(source.key)}' class='small-input' aria-label='Edit source key' />`;
    urlCell.innerHTML = `<input value='${escapeHtml(source.url)}' class='full-input' aria-label='Edit source URL' />`;
    
    // Preserve the enhanced status display during edit
    const statusIcon = source.enabled ? 'codicon-check-all' : 'codicon-circle-slash';
    const statusClass = source.enabled ? 'enabled' : 'disabled';
    const statusText = source.enabled ? UI.YES : UI.NO;
    enabledCell.innerHTML = `<span class="status-indicator ${statusClass}"><i class="codicon ${statusIcon}"></i>${statusText}</span>`;
    
    actionsCell.innerHTML = `<button data-act='saveEdit' aria-label='${UI.SAVE}' title='${UI.SAVE}' class='codicon codicon-save vscode-btn icon-only'></button> <button data-act='cancelEdit' aria-label='${UI.CANCEL}' title='${UI.CANCEL}' class='codicon codicon-discard vscode-btn icon-only'></button>`;
    actionsCell.addEventListener('click', function handler(e: any) {
        const b = e.target.closest('button');
        if (!b) { return; }
        const act = b.getAttribute('data-act');
        if (act === 'saveEdit') {
            const newKey = (keyCell.querySelector('input') as HTMLInputElement).value.trim();
            const newUrl = (urlCell.querySelector('input') as HTMLInputElement).value.trim();
            if (newKey && newUrl) {
                vscodeApi.postMessage({ type: 'edit', ops: [{ kind: 'updateSource', key, newKey, url: newUrl }] });
            }
        } else if (act === 'cancelEdit') {
            vscodeApi.postMessage({ type: 'requestReparse' });
        }
    }, { once: true });
}

function escapeHtml(str: string) {
    return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]!));
}

function showError(message: string) {
    const container = $('#nuget-config-editor-root');
    if (!container) { return; }
    container.innerHTML = `<div style="color: var(--vscode-editorError-foreground);">${escapeHtml(message)}</div>`;
}

window.addEventListener('DOMContentLoaded', () => {
    const root = document.createElement('div');
    root.id = 'nuget-config-editor-root';
    root.style.padding = '1rem';
    root.style.fontFamily = 'var(--vscode-font-family)';
    root.textContent = UI.LOADING;
    document.body.appendChild(root);
    vscodeApi.postMessage({ type: 'ready' });
});

window.addEventListener('message', (ev: any) => {
    const msg = ev.data as any;
    switch (msg?.type) {
        case 'init':
            render(msg.model);
            vscodeApi.setState({ model: msg.model });
            break;
        case 'externalAddSource':
            // host triggered add via command
            vscodeApi.postMessage({ type: 'edit', ops: [{ kind: 'addSource', key: msg.key, url: msg.url }] });
            break;
        case 'error':
            showError(msg.error || UI.UNKNOWN_ERROR);
            break;
        case 'validation':
            // Display first validation error (future: richer UI)
            if (msg.issues?.length) {
                showError(msg.issues[0].message);
            }
            break;
        case 'saveResult':
            if (msg.ok) {
                // Optionally flash saved state
            } else {
                showError(UI.SAVE_FAILED_PREFIX + msg.error);
            }
            break;
    }
});

// Attempt to restore previous state if available (hot reload scenarios)
try {
    const state = vscodeApi.getState();
    if (state?.model) {
        // Render cached model until host sends fresh init
        window.addEventListener('DOMContentLoaded', () => render(state.model));
    }
} catch {}

