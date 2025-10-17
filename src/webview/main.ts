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
    EXPAND_MAPPINGS: 'Expand mappings',
    COLLAPSE_MAPPINGS: 'Collapse mappings',
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
    .patterns { margin: 0; padding: 0; list-style: none; display:flex; }
    .patterns li { display:flex; align-items:center; justify-content:space-between; gap:.5rem; padding:2px 0; }
    .pattern-label { display:inline-flex; align-items:center; gap:.25rem; }
    .badge { background:var(--vscode-badge-background); color:var(--vscode-badge-foreground); padding:2px 6px; border-radius:2px; font-size:0.85em; vertical-align:baseline; }
    /* Pattern badge that is an interactive button (large clickable area) */
    .pattern-badge-btn { background:var(--vscode-badge-background); color:var(--vscode-badge-foreground); padding:6px 10px; border-radius:2px; font-size:0.85em; display:inline-flex; align-items:center; gap:.35rem; border:none; cursor:pointer; min-height:22px; }
    .pattern-badge-btn:focus { outline: none; box-shadow: 0 0 0 1px var(--vscode-focusBorder); }
    .pattern-badge-btn .codicon { font-size: 0.95em; }
    .add-pattern { display:flex; gap:.5rem; align-items:center; margin-top:.35rem; }
    .sources-table { width:100%; border-collapse:collapse; font-size:0.95rem; }
    .sources-table th, .sources-table td { text-align:left; padding:8px 6px; vertical-align:middle; border-top:1px solid var(--vscode-editorWidget-border); }
    .sources-table thead th { font-weight:600; color:var(--vscode-foreground); }
    .sources-table th:last-child, .sources-table td:last-child { width:160px; }
    /* Disabled source row styling */
    .sources-table tbody tr.disabled-source .keyCell { text-decoration: line-through; opacity: 0.7; }
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
    /* Make focused buttons visible (match hover background + focus ring) */
    .vscode-btn:focus { outline: none; background: var(--vscode-button-hoverBackground); color: var(--vscode-button-foreground); box-shadow: 0 0 0 1px var(--vscode-focusBorder); }
    .vscode-btn.icon-only { padding:0; }
    /* Expanded state for the expand/collapse button: solid background and foreground to remain visible */
    .vscode-btn.expanded { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    /* Slightly larger-looking save button (text or icon+text) */
    .vscode-btn.save { width:auto; height:auto; padding:6px 10px; display:inline-flex; gap:6px; align-items:center; }
    .vscode-btn.save:focus { background: var(--vscode-button-hoverBackground); color: var(--vscode-button-foreground); }
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
    // Columns: expand, Key, URL, Enabled, Actions
    table.innerHTML = `<thead><tr><th></th><th>${UI.KEY}</th><th>${UI.URL}</th><th>${UI.ENABLED}</th><th>${UI.ACTIONS}</th></tr></thead>`;
    const tbody = document.createElement('tbody');
    if (!model.sources.length) {
        const tr = document.createElement('tr');
        // colspan matches number of columns in header
        tr.innerHTML = `<td colspan="5" style="opacity:.7;">${UI.NO_SOURCES}</td>`;
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

            tr.innerHTML = `
                <td><button data-act='expand' aria-label='${UI.EXPAND_MAPPINGS}' title='${UI.EXPAND_MAPPINGS}' aria-expanded='false' class='codicon codicon-chevron-right vscode-btn icon-only'></button></td>
                <td class="keyCell">${escapeHtml(s.key)}</td>
                <td class="urlCell">${escapeHtml(s.url)}</td>
                <td><span class="status-indicator ${statusClass}"><i class="codicon ${statusIcon}"></i>${statusText}</span></td>
                <td class="actions-cell">
                    <button data-act='edit' aria-label='${UI.EDIT_SOURCE}' title='${UI.EDIT}' class='codicon codicon-edit vscode-btn icon-only'></button>
                    <button data-act='toggle' aria-label='${s.enabled ? UI.DISABLE_SOURCE : UI.ENABLE_SOURCE}' title='${s.enabled ? UI.DISABLE : UI.ENABLE}' class='codicon ${s.enabled ? 'codicon-circle-slash' : 'codicon-check'} vscode-btn icon-only'></button>
                    <button data-act='delete' aria-label='${UI.DELETE_SOURCE}' title='${UI.DELETE}' class='codicon codicon-trash vscode-btn icon-only'></button>
                </td>`;
            tbody.appendChild(tr);
        }
    }
    table.appendChild(tbody);
    container.appendChild(table);

    // Add Source form - prominent primary button style (keeps minimal styles)
    const addForm = document.createElement('div');
    addForm.className = 'form-row';
    addForm.innerHTML = `<input placeholder='${UI.KEY}' class='small-input' aria-label='Source key' />`+
        `<input placeholder='${UI.URL}' class='full-input' aria-label='Source URL' />`+
        `<button aria-label='${UI.ADD_SOURCE}' title='${UI.ADD_SOURCE}' class='vscode-btn save'>${UI.ADD_SOURCE}</button>`;
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

    // Note: mappings are rendered inline per-row when expanded. No global mappings panel here.

    // Actions container (edits are applied immediately via messages)

    tbody.addEventListener('click', (e: any) => {
        const btn = e.target.closest('button, input[type="checkbox"]');
        if (!btn) { return; }
        const tr = btn.closest('tr');
        // For mapping rows the tr may be the mappings-row which uses dataset.for
        const key = tr?.dataset.key || tr?.dataset.for;
        const act = (btn.getAttribute && btn.getAttribute('data-act')) || (btn.type === 'checkbox' ? 'toggle' : null);

        // Toggle action (either checkbox or action button)
        if (act === 'toggle' && key) {
            const src = model.sources.find((s: any) => s.key === key);
            const enabled = (btn.type === 'checkbox') ? (btn.checked) : (!src.enabled);
            vscodeApi.postMessage({ type: 'edit', ops: [{ kind: 'toggleSource', key, enabled }] });
            return;
        }

        // Mapping actions (remove/add) when clicked inside mappings row
        // Also handle requestDeletePattern which asks the host to confirm and perform deletion
        if (act === 'removePattern' || act === 'addPattern' || act === 'requestDeletePattern') {
            // Determine source key from button attribute or mappings-row dataset
            const mapKey = btn.getAttribute('data-key') || tr?.dataset.for;
            if (!mapKey) { return; }
            if (act === 'removePattern') {
                const pattern = btn.getAttribute('data-pattern');
                if (!pattern) { return; }
                const mapping = (model.mappings || []).find((m: any) => m.sourceKey === mapKey);
                if (!mapping) { return; }
                const newPatterns = mapping.patterns.filter((p: string) => p !== pattern);
                vscodeApi.postMessage({ type: 'edit', ops: [{ kind: 'setMappings', key: mapKey, patterns: newPatterns }] });
            } else if (act === 'requestDeletePattern') {
                const pattern = btn.getAttribute('data-pattern');
                if (!pattern) { return; }
                // Ask the host to show native confirmation and perform deletion
                vscodeApi.postMessage({ type: 'requestDeletePattern', key: mapKey, pattern });
            } else if (act === 'addPattern') {
                const input = tr.querySelector('input');
                if (!input) { return; }
                const val = input.value.trim();
                if (!val) { return; }
                const mapping = (model.mappings || []).find((m: any) => m.sourceKey === mapKey);
                const patterns = mapping ? mapping.patterns.slice() : [];
                if (patterns.includes(val)) { return; }
                patterns.push(val);
                vscodeApi.postMessage({ type: 'edit', ops: [{ kind: 'setMappings', key: mapKey, patterns }] });
                input.value = '';
            }
            return;
        }

        if (!key) { return; }
        if (act === 'delete') {
            // Webviews are sandboxed and confirm() is ignored; ask the host to show a native confirmation
            vscodeApi.postMessage({ type: 'requestDelete', key });
        } else if (act === 'edit') {
            enterEditRow(tr, key, model);
        } else if (act === 'expand') {
            toggleExpandRow(tr, key, model);
        }
    });

    // Toggle expand/collapse: show mappings row directly under the source row
    function toggleExpandRow(tr: HTMLTableRowElement, key: string, model: any) {
        const next = tr.nextElementSibling as HTMLTableRowElement | null;
        if (next && next.classList.contains('mappings-row') && next.dataset.for === key) {
            // collapse
            next.remove();
            const btn = tr.querySelector("button[data-act='expand']");
            if (btn) {
                btn.classList.remove('codicon-chevron-down');
                btn.classList.add('codicon-chevron-right');
                btn.classList.remove('expanded');
                btn.setAttribute('aria-expanded', 'false');
                btn.setAttribute('aria-label', UI.EXPAND_MAPPINGS);
                btn.title = UI.EXPAND_MAPPINGS;
            }
            return;
        }
        // expand: build mappings row
        const mapping = (model.mappings || []).find((m: any) => m.sourceKey === key);
        const patterns = mapping ? mapping.patterns.slice() : [];
        const columns = table.querySelectorAll('thead th').length;
        const mtr = document.createElement('tr');
        mtr.className = 'mappings-row';
        mtr.dataset.for = key;
        const td = document.createElement('td');
        td.colSpan = columns;
        td.style.padding = '0.5rem 0.75rem';
        // Build inner HTML for patterns list + add pattern input
        let inner = `<div style="margin:0.2rem 0 .4rem 0; font-weight:600;">${UI.PACKAGE_SOURCE_MAPPINGS} — ${escapeHtml(key)} (${patterns.length})</div>`;
        inner += `<ul class='patterns' style='margin:0 0 .4rem 0; padding:0; list-style:none;'>`;
        for (const p of patterns) {
            // Render the pattern as a single interactive button styled like a badge.
            // This ensures clicking anywhere on the badge triggers the delete request.
            inner += `<li style='display:flex; justify-content:flex-start; align-items:center; gap:.5rem; padding:2px 5px;'><div class='pattern-label'><button type='button' data-act='requestDeletePattern' data-key='${escapeHtml(key)}' data-pattern='${escapeHtml(p)}' aria-label='${UI.REMOVE_PATTERN}' title='${UI.REMOVE_PATTERN}' class='pattern-badge-btn'>${escapeHtml(p)}<i class='codicon codicon-close'></i></button></div></li>`;
        }
        inner += `</ul>`;
        inner += `<div class='add-pattern' style='display:flex; gap:.5rem; align-items:center;'><input type='text' placeholder='${UI.ADD_PATTERN}' class='small-input' aria-label='${UI.ADD_PATTERN}' /> <button data-act='addPattern' data-key='${escapeHtml(key)}' aria-label='${UI.ADD_PATTERN}' title='${UI.ADD_PATTERN}' class='codicon codicon-add vscode-btn icon-only'></button></div>`;
        td.innerHTML = inner;
        mtr.appendChild(td);
        tr.parentElement!.insertBefore(mtr, tr.nextSibling);
        // Support adding pattern by pressing Enter in the input field (same behavior as the add button)
        try {
            const patternInput = mtr.querySelector("input[type='text']") as HTMLInputElement | null;
            if (patternInput) {
                patternInput.addEventListener('keydown', (e: KeyboardEvent) => {
                    if (e.key === 'Enter') {
                        const val = patternInput.value.trim();
                        if (!val) { return; }
                        const mapping = (model.mappings || []).find((m: any) => m.sourceKey === key);
                        const patterns = mapping ? mapping.patterns.slice() : [];
                        if (patterns.includes(val)) { return; }
                        patterns.push(val);
                        vscodeApi.postMessage({ type: 'edit', ops: [{ kind: 'setMappings', key, patterns }] });
                        patternInput.value = '';
                        e.preventDefault();
                    }
                });
            }
        } catch (err) {
            // Defensive: avoid breaking webview if DOM APIs behave unexpectedly
        }
        const btn = tr.querySelector("button[data-act='expand']");
        if (btn) {
            btn.classList.remove('codicon-chevron-right');
            btn.classList.add('codicon-chevron-down');
            btn.classList.add('expanded');
            btn.setAttribute('aria-expanded', 'true');
            btn.setAttribute('aria-label', UI.COLLAPSE_MAPPINGS);
            btn.title = UI.COLLAPSE_MAPPINGS;
        }
    }

    // mapping click handling moved into tbody click listener above
}

function enterEditRow(tr: HTMLTableRowElement, key: string, model: any) {
    const source = model.sources.find((s: any) => s.key === key);
    if (!source) { return; }
    const cells = tr.querySelectorAll('td');
    // columns: [0]=expand, [1]=key, [2]=url, [3]=enabled, [4]=actions
    const keyCell = cells[1];
    const urlCell = cells[2];
    const enabledCell = cells[3];
    const actionsCell = cells[4];
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

