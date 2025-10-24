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
    
    /* Modern card-based layout inspired by the attached UI */
    .sources-container { display: flex; flex-direction: column; gap: 8px; margin-bottom: 1rem; }
    .source-card { 
        background: var(--vscode-editor-background); 
        border: 1px solid var(--vscode-panel-border); 
        border-radius: 6px; 
        padding: 12px 16px; 
        display: flex; 
        align-items: center; 
        justify-content: space-between; 
        gap: 16px;
        transition: background-color 0.1s ease;
    }
    .source-card:hover {
        background: var(--vscode-list-hoverBackground);
    }
    .source-card.disabled {
        opacity: 0.6;
    }
    .source-info { 
        flex: 1; 
        min-width: 0; 
        display: flex; 
        flex-direction: column; 
        gap: 4px;
    }
    .source-title { 
        font-weight: 600; 
        font-size: 14px; 
        color: var(--vscode-foreground);
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .source-card.disabled .source-title {
        text-decoration: line-through;
    }
    .source-url { 
        font-size: 12px; 
        color: var(--vscode-descriptionForeground);
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .source-card.disabled .source-url {
        font-style: italic;
    }
    .source-controls { 
        display: flex; 
        align-items: center; 
        gap: 12px;
        flex-shrink: 0;
    }
    
    /* Toggle switch styling */
    .toggle-switch {
        position: relative;
        display: inline-block;
        width: 44px;
        height: 24px;
    }
    .toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
    }
    .toggle-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: var(--vscode-input-background);
        border: 1px solid var(--vscode-input-border);
        transition: 0.2s;
        border-radius: 12px;
    }
    .toggle-slider:before {
        position: absolute;
        content: "";
        height: 18px;
        width: 18px;
        left: 2px;
        top: 2px;
        background-color: var(--vscode-input-foreground);
        transition: 0.2s;
        border-radius: 50%;
    }
    input:checked + .toggle-slider {
        background-color: var(--vscode-button-background);
        border-color: var(--vscode-button-background);
    }
    input:checked + .toggle-slider:before {
        transform: translateX(20px);
        background-color: var(--vscode-button-foreground);
    }
    .toggle-slider:hover {
        background-color: var(--vscode-input-hoverBackground, var(--vscode-input-background));
    }
    input:checked + .toggle-slider:hover {
        background-color: var(--vscode-button-hoverBackground);
    }
    
    /* Fallback table styles for compatibility */
    .sources-table { width:100%; border-collapse:collapse; font-size:0.95rem; display: none; }
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
    .form-row input[type="text"], .form-row input[type="url"], .form-row input { font-family: var(--vscode-font-family); font-size: small; }
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
    
    /* Empty state styling */
    .empty-state {
        text-align: center;
        padding: 2rem 1rem;
        color: var(--vscode-descriptionForeground);
        font-style: italic;
    }
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

    // Package Sources cards (modern UI)
    const sourcesContainer = document.createElement('div');
    sourcesContainer.className = 'sources-container';
    
    if (!model.sources.length) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.textContent = UI.NO_SOURCES;
        sourcesContainer.appendChild(emptyState);
    } else {
        for (const s of model.sources) {
            const card = document.createElement('div');
            card.className = 'source-card';
            card.dataset.key = s.key;

            // Apply disabled styling if source is disabled
            if (!s.enabled) {
                card.classList.add('disabled');
            }

            // Check if this source has package mappings
            const mapping = (model.mappings || []).find((m: any) => m.sourceKey === s.key);
            const mappingCount = mapping ? mapping.patterns.length : 0;
            const mappingText = mappingCount > 0 ? ` (${mappingCount} pattern${mappingCount !== 1 ? 's' : ''})` : '';
            const displayTitle = `${escapeHtml(s.key)}${mappingText}`;

            card.innerHTML = `
                <button data-act='expand' aria-label='${UI.EXPAND_MAPPINGS}' title='${UI.EXPAND_MAPPINGS}' aria-expanded='false' class='codicon codicon-chevron-right vscode-btn icon-only'></button>
                <div class="source-info">
                    <div class="source-title">${displayTitle}</div>
                    <div class="source-url">${escapeHtml(s.url)}</div>
                </div>
                <div class="source-controls">
                    <label class="toggle-switch">
                        <input type="checkbox" data-act="toggle" ${s.enabled ? 'checked' : ''} aria-label="${s.enabled ? UI.DISABLE_SOURCE : UI.ENABLE_SOURCE}">
                        <span class="toggle-slider"></span>
                    </label>
                    <button data-act='edit' aria-label='${UI.EDIT_SOURCE}' title='${UI.EDIT}' class='codicon codicon-edit vscode-btn icon-only'></button>
                    <button data-act='delete' aria-label='${UI.DELETE_SOURCE}' title='${UI.DELETE}' class='codicon codicon-trash vscode-btn icon-only'></button>
                </div>`;
            sourcesContainer.appendChild(card);
        }
    }
    container.appendChild(sourcesContainer);

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

    sourcesContainer.addEventListener('click', (e: any) => {
        const btn = e.target.closest('button, input[type="checkbox"]');
        if (!btn) { return; }
        const card = btn.closest('.source-card, .mappings-row');
        // For mapping rows the element may be the mappings-row which uses dataset.for
        const key = card?.dataset.key || card?.dataset.for;
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
            enterEditRow(card, key, model);
        } else if (act === 'expand') {
            toggleExpandRow(card, key, model);
        }
    });

    // Toggle expand/collapse: show mappings section directly under the source card
    function toggleExpandRow(card: HTMLElement, key: string, model: any) {
        const next = card.nextElementSibling as HTMLElement | null;
        if (next && next.classList.contains('mappings-row') && next.dataset.for === key) {
            // collapse
            next.remove();
            const btn = card.querySelector("button[data-act='expand']");
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
        // expand: build mappings section
        const mapping = (model.mappings || []).find((m: any) => m.sourceKey === key);
        const patterns = mapping ? mapping.patterns.slice() : [];
        const mappingsDiv = document.createElement('div');
        mappingsDiv.className = 'mappings-row source-card';
        mappingsDiv.dataset.for = key;
        mappingsDiv.style.marginTop = '4px';
        mappingsDiv.style.paddingLeft = '48px'; // Indent to align with content
        // Build inner HTML for patterns list + add pattern input
        let inner = `<div style="margin:0.2rem 0 .4rem 0; font-weight:600;">Patterns: ${patterns.length}</div>`;
        inner += `<ul class='patterns' style='margin:0 0 .4rem 0; padding:0; list-style:none;'>`;
        for (const p of patterns) {
            // Render the pattern as a single interactive button styled like a badge.
            // This ensures clicking anywhere on the badge triggers the delete request.
            inner += `<li style='display:flex; justify-content:flex-start; align-items:center; gap:.5rem; padding:2px 5px;'><div class='pattern-label'><button type='button' data-act='requestDeletePattern' data-key='${escapeHtml(key)}' data-pattern='${escapeHtml(p)}' aria-label='${UI.REMOVE_PATTERN}' title='${UI.REMOVE_PATTERN}' class='pattern-badge-btn'>${escapeHtml(p)}<i class='codicon codicon-close'></i></button></div></li>`;
        }
        inner += `</ul>`;
        inner += `<div class='add-pattern' style='display:flex; gap:.5rem; align-items:center;'><input type='text' placeholder='${UI.ADD_PATTERN}' class='small-input' aria-label='${UI.ADD_PATTERN}' /> <button data-act='addPattern' data-key='${escapeHtml(key)}' aria-label='${UI.ADD_PATTERN}' title='${UI.ADD_PATTERN}' class='codicon codicon-add vscode-btn icon-only'></button></div>`;
        mappingsDiv.innerHTML = inner;
        card.parentElement!.insertBefore(mappingsDiv, card.nextSibling);
        // Support adding pattern by pressing Enter in the input field (same behavior as the add button)
        try {
            const patternInput = mappingsDiv.querySelector("input[type='text']") as HTMLInputElement | null;
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
        const btn = card.querySelector("button[data-act='expand']");
        if (btn) {
            btn.classList.remove('codicon-chevron-right');
            btn.classList.add('codicon-chevron-down');
            btn.classList.add('expanded');
            btn.setAttribute('aria-expanded', 'true');
            btn.setAttribute('aria-label', UI.COLLAPSE_MAPPINGS);
            btn.title = UI.COLLAPSE_MAPPINGS;
        }
    }

    // mapping click handling moved into sourcesContainer click listener above
}

function enterEditRow(card: HTMLElement, key: string, model: any) {
    const source = model.sources.find((s: any) => s.key === key);
    if (!source) { return; }
    
    // Replace the card content with edit form
    const expandBtn = card.querySelector("button[data-act='expand']");
    const expandBtnHtml = expandBtn ? expandBtn.outerHTML : '';
    
    card.innerHTML = `
        ${expandBtnHtml}
        <div class="source-info" style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
            <input value='${escapeHtml(source.key)}' class='small-input' placeholder='${UI.KEY}' aria-label='Edit source key' style='width: 100%;' />
            <input value='${escapeHtml(source.url)}' class='full-input' placeholder='${UI.URL}' aria-label='Edit source URL' style='width: 100%;' />
        </div>
        <div class="source-controls">
            <button data-act='saveEdit' aria-label='${UI.SAVE}' title='${UI.SAVE}' class='codicon codicon-save vscode-btn icon-only'></button>
            <button data-act='cancelEdit' aria-label='${UI.CANCEL}' title='${UI.CANCEL}' class='codicon codicon-discard vscode-btn icon-only'></button>
        </div>`;
        
    card.addEventListener('click', function handler(e: any) {
        const b = e.target.closest('button');
        if (!b) { return; }
        const act = b.getAttribute('data-act');
        if (act === 'saveEdit') {
            const keyInput = card.querySelector('input[aria-label="Edit source key"]') as HTMLInputElement;
            const urlInput = card.querySelector('input[aria-label="Edit source URL"]') as HTMLInputElement;
            const newKey = keyInput.value.trim();
            const newUrl = urlInput.value.trim();
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

