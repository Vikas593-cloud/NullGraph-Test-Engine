export function setupConsoleController() {
    const consolePanel = document.getElementById('console-panel');
    const consoleHeader = document.getElementById('console-header');
    const consoleBody = document.getElementById('console-body');
    const toggleIcon = document.getElementById('console-toggle-icon');

    if (!consolePanel || !consoleHeader || !consoleBody || !toggleIcon) return;

    let isCollapsed = false;
    const defaultHeight = "150px";

    const toggleConsole = () => {
        isCollapsed = !isCollapsed;
        if (isCollapsed) {
            consolePanel.style.height = "28px"; // Height of just the header
            consoleBody.style.display = "none";
            toggleIcon.setAttribute('data-lucide', 'chevron-up');
        } else {
            consolePanel.style.height = defaultHeight;
            consoleBody.style.display = "flex";
            toggleIcon.setAttribute('data-lucide', 'chevron-down');
        }
        // Re-trigger Lucide icons to swap the chevron direction
        // @ts-ignore
        if (window.lucide) window.lucide.createIcons();
    };

    consoleHeader.addEventListener('click', toggleConsole);
}

// Update your clearConsole to also clear the main overlay error if you want them synced
export function clearConsole() {
    const consoleLogs = document.getElementById('console-logs');
    if (consoleLogs) {
        consoleLogs.innerHTML = '';
    }
}

// Modify your showLog implementation to ensure errors stand out cleanly
export function showLog(message: string, type: 'log' | 'warn' | 'error' = 'log') {
    const consoleLogs = document.getElementById('console-logs');
    if (consoleLogs) {
        const logEntry = document.createElement('div');
        logEntry.textContent = message;
        logEntry.style.marginBottom = '4px';
        logEntry.style.borderBottom = '1px solid #2a2a2a';
        logEntry.style.paddingBottom = '4px';
        logEntry.style.wordWrap = 'break-word';
        logEntry.style.whiteSpace = 'pre-wrap'; // Preserves line breaks nicely

        if (type === 'warn') {
            logEntry.style.color = '#cca700';
            logEntry.style.backgroundColor = 'rgba(204, 167, 0, 0.05)';
        }
        if (type === 'error') {
            logEntry.style.color = '#f48771';
            logEntry.style.backgroundColor = 'rgba(244, 135, 113, 0.05)';

            // If collapsed, automatically open the console to show the error
            const consolePanel = document.getElementById('console-panel');
            const consoleBody = document.getElementById('console-body');
            if (consolePanel && consolePanel.style.height === "28px") {
                consolePanel.style.height = "150px";
                if (consoleBody) consoleBody.style.display = "flex";
                const toggleIcon = document.getElementById('console-toggle-icon');
                if (toggleIcon) toggleIcon.setAttribute('data-lucide', 'chevron-down');
                // @ts-ignore
                if (window.lucide) window.lucide.createIcons();
            }
        }

        consoleLogs.appendChild(logEntry);
        consoleLogs.scrollTop = consoleLogs.scrollHeight;
    }
}