// SRU Confessions - Client API Integration

// If opened directly as a file (file://), target local backend server on port 5000
const API_BASE = (typeof window !== 'undefined' && window.location.protocol === 'file:') 
    ? 'http://localhost:5000' 
    : '';

let currentSearch = '';
let searchDebounceTimeout = null;

// Helper: Escape HTML to prevent XSS
function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Helper: Safely parse response without crashing on non-JSON
async function parseResponse(res) {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        try {
            return await res.json();
        } catch {
            return { error: `Server returned invalid JSON (HTTP ${res.status})` };
        }
    }
    const text = await res.text();
    return { error: text || `Server error (${res.status} ${res.statusText || 'Not Found'})` };
}

// Helper: Display Alert Toast inside Form
function showAlert(formElement, message, isSuccess = true) {
    // Remove any existing messages
    const oldMsg = formElement.querySelector('.success-message, .error-message');
    if (oldMsg) oldMsg.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = isSuccess ? 'success-message' : 'error-message';
    msgDiv.textContent = message;

    formElement.insertBefore(msgDiv, formElement.firstChild);

    setTimeout(() => {
        msgDiv.remove();
    }, 6000);
}

// -------------------------------------------------------------------
// 1. CONFESSION SUBMISSION (PUBLIC)
// -------------------------------------------------------------------
const feedbackForm = document.getElementById('feedbackForm');
const confessionTextarea = document.getElementById('confession');
const charCountSpan = document.getElementById('charCount');

if (confessionTextarea && charCountSpan) {
    confessionTextarea.addEventListener('input', function() {
        const count = this.value.length;
        charCountSpan.textContent = `${count} / 3000`;
        if (count > 2900) {
            charCountSpan.style.color = '#e53935';
        } else {
            charCountSpan.style.color = '';
        }
    });
}

if (feedbackForm) {
    feedbackForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const confessionInput = document.getElementById('confession');
        const submitBtn = feedbackForm.querySelector('button[type="submit"]');
        const text = confessionInput.value.trim();

        if (!text) {
            showAlert(feedbackForm, 'Please enter your confession before submitting.', false);
            return;
        }

        // Set Loading state
        submitBtn.disabled = true;
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.textContent = 'Submitting...';

        try {
            const res = await fetch(`${API_BASE}/api/confessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confession: text })
            });

            const data = await parseResponse(res);

            if (!res.ok) {
                let errText = data.error || `Error ${res.status}: Failed to submit confession.`;
                if (res.status === 404 && window.location.protocol === 'file:') {
                    errText = 'Backend is not running. Please run "npm start" in terminal and open http://localhost:5000';
                }
                throw new Error(errText);
            }

            showAlert(feedbackForm, '✨ Confession submitted successfully and anonymously!', true);
            feedbackForm.reset();
            if (charCountSpan) charCountSpan.textContent = '0 / 3000';

        } catch (err) {
            console.error('Submission error:', err);
            let userMsg = err.message;
            if (err.message && err.message.includes('Failed to fetch')) {
                userMsg = 'Cannot connect to backend server. Please make sure the server is running with "npm start" at http://localhost:5000';
            }
            showAlert(feedbackForm, userMsg, false);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });
}

// -------------------------------------------------------------------
// 2. ADMIN AUTHENTICATION
// -------------------------------------------------------------------
const adminLoginForm = document.getElementById('adminLoginForm');
const loginError = document.getElementById('loginError');

if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const submitBtn = adminLoginForm.querySelector('button[type="submit"]');

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';
        loginError.innerHTML = '';

        try {
            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await parseResponse(res);

            if (!res.ok) {
                throw new Error(data.error || 'Invalid credentials!');
            }

            // Save JWT token
            localStorage.setItem('sru_admin_token', data.token);
            localStorage.setItem('sru_admin_user', JSON.stringify(data.user));

            closeAdminModal();
            showAdminPanel();

        } catch (err) {
            loginError.innerHTML = `<div class="error-message">${escapeHTML(err.message)}</div>`;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    });
}

// Auto-check stored token on page load
async function checkAuthSession() {
    const token = localStorage.getItem('sru_admin_token');
    if (!token) return false;

    try {
        const res = await fetch(`${API_BASE}/api/auth/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            return true;
        } else {
            localStorage.removeItem('sru_admin_token');
            localStorage.removeItem('sru_admin_user');
            return false;
        }
    } catch {
        return false;
    }
}

// -------------------------------------------------------------------
// 3. ADMIN PANEL & CONFESSION MANAGEMENT
// -------------------------------------------------------------------
function showAdminPanel() {
    document.getElementById('userView').style.display = 'none';
    const adminView = document.getElementById('adminView');
    adminView.classList.add('active');

    loadAdminConfessions();
}

async function loadAdminConfessions(query = currentSearch) {
    const tableContainer = document.getElementById('feedbackTable');
    const token = localStorage.getItem('sru_admin_token');

    if (!token) {
        logout();
        return;
    }

    tableContainer.innerHTML = '<p style="padding:40px;text-align:center;color:var(--muted);">Loading confessions...</p>';

    try {
        const url = `${API_BASE}/api/admin/confessions?search=${encodeURIComponent(query || '')}`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401 || res.status === 403) {
            alert('Session expired. Please log in again.');
            logout();
            return;
        }

        const data = await parseResponse(res);
        if (!res.ok) throw new Error(data.error || 'Failed to fetch confessions.');

        const confessions = data.confessions || [];
        const stats = data.stats || { total: 0, today: 0 };

        // Update Stats Pills
        const totalStatElem = document.getElementById('totalConfessionsCount');
        const todayStatElem = document.getElementById('todayConfessionsCount');
        if (totalStatElem) totalStatElem.textContent = stats.total;
        if (todayStatElem) todayStatElem.textContent = stats.today;

        if (confessions.length === 0) {
            tableContainer.innerHTML = `
                <div style="padding:50px;text-align:center;color:var(--muted);">
                    <p style="font-size:1.1rem;margin-bottom:8px;">${query ? 'No matching confessions found.' : 'No confessions yet.'}</p>
                    <small>Submitted confessions will automatically appear here.</small>
                </div>
            `;
            return;
        }

        let tableHTML = `
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th style="width: 80px;">#ID</th>
                            <th>Confession</th>
                            <th style="width: 170px;">Date & Time</th>
                            <th style="width: 90px; text-align: center;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        confessions.forEach(item => {
            tableHTML += `
                <tr id="confession-row-${item.id}">
                    <td style="color:var(--muted);font-weight:600;">#${item.id}</td>
                    <td class="confession-content">${escapeHTML(item.confession)}</td>
                    <td class="confession-time">${escapeHTML(item.timestamp || item.created_at)}</td>
                    <td class="confession-actions" style="text-align: center;">
                        <button class="delete-btn" onclick="deleteConfession(${item.id})" title="Delete confession">
                            Delete
                        </button>
                    </td>
                </tr>
            `;
        });

        tableHTML += `
                    </tbody>
                </table>
            </div>
        `;

        tableContainer.innerHTML = tableHTML;

    } catch (err) {
        console.error('Error loading confessions:', err);
        tableContainer.innerHTML = `
            <div class="error-message">
                Failed to load confessions: ${escapeHTML(err.message)}
                <br>
                <button class="refresh-btn" style="margin-top:10px;" onclick="loadAdminConfessions()">Retry</button>
            </div>
        `;
    }
}

// Delete a confession
async function deleteConfession(id) {
    if (!confirm(`Are you sure you want to permanently delete confession #${id}?`)) {
        return;
    }

    const token = localStorage.getItem('sru_admin_token');
    if (!token) {
        logout();
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/admin/confessions/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await parseResponse(res);
        if (!res.ok) throw new Error(data.error || 'Failed to delete confession.');

        // Smoothly remove row or refresh table
        const row = document.getElementById(`confession-row-${id}`);
        if (row) {
            row.style.transition = 'all 0.3s ease';
            row.style.opacity = '0';
            setTimeout(() => {
                row.remove();
                loadAdminConfessions();
            }, 300);
        } else {
            loadAdminConfessions();
        }

    } catch (err) {
        alert(err.message || 'Error deleting confession');
    }
}

// Search input handling with debounce
function handleSearchInput(e) {
    clearTimeout(searchDebounceTimeout);
    currentSearch = e.target.value.trim();
    searchDebounceTimeout = setTimeout(() => {
        loadAdminConfessions(currentSearch);
    }, 350);
}

// Refresh table
function refreshConfessions() {
    loadAdminConfessions(currentSearch);
}

// Logout
function logout() {
    localStorage.removeItem('sru_admin_token');
    localStorage.removeItem('sru_admin_user');

    document.getElementById('adminView').classList.remove('active');
    document.getElementById('userView').style.display = 'block';
}

// -------------------------------------------------------------------
// 4. MODAL CONTROLS
// -------------------------------------------------------------------
async function openAdminModal() {
    const isAuthenticated = await checkAuthSession();
    if (isAuthenticated) {
        showAdminPanel();
        return;
    }

    document.getElementById('adminModal').classList.add('active');
    setTimeout(() => {
        const usernameField = document.getElementById('username');
        if (usernameField) usernameField.focus();
    }, 100);
}

function closeAdminModal() {
    document.getElementById('adminModal').classList.remove('active');
    const form = document.getElementById('adminLoginForm');
    if (form) form.reset();
    const err = document.getElementById('loginError');
    if (err) err.innerHTML = '';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('adminModal');
    if (event.target === modal) {
        closeAdminModal();
    }
};

// Check if user was already logged in on initial load
document.addEventListener('DOMContentLoaded', async () => {
    const hasToken = localStorage.getItem('sru_admin_token');
    if (hasToken) {
        const isValid = await checkAuthSession();
        if (isValid) {
            const adminBtn = document.querySelector('.admin-btn');
            if (adminBtn) adminBtn.textContent = 'Admin Panel ↗';
        }
    }
});
