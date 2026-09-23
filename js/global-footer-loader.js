/**
 * GLOBAL Footer Loader - Automatisch auf JEDER Seite
 * Lädt Footer automatisch ohne manuelle Einbindung in HTML
 * Version 3.0 - Professional Gaming Design
 */

class AutoGlobalFooterLoader {
    constructor() {
        this.footerHTML = null;
        this.footerCSS = null;
        this.isLoaded = false;
        this.autoInit();
    }
    
    autoInit() {
        console.log('🦶 Auto Global Footer Loader gestartet');
        
        // Footer HTML und CSS definieren
        this.footerHTML = this.getFooterTemplate();
        this.footerCSS = this.getFooterStyles();
        
        // CSS sofort injizieren
        this.injectStyles();
        
        // Sofortige Initialisierung
        this.quickLoad();
        
        // Backup-Initialisierung für alle DOM-Zustände
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.safeLoad());
        } else {
            this.safeLoad();
        }
        
        // Backup für sehr späte Initialisierung
        setTimeout(() => this.ensureFooterExists(), 2000);
    }
    
    // Footer-spezifische Styles injizieren
    injectStyles() {
        if (document.getElementById('global-footer-styles')) return;
        
        const styleElement = document.createElement('style');
        styleElement.id = 'global-footer-styles';
        styleElement.textContent = this.footerCSS;
        document.head.appendChild(styleElement);
        console.log('💅 Footer Styles injiziert');
    }
    
    // Footer CSS Styles
    getFooterStyles() {
        return `
            /* Global Footer Styles - Professional Gaming Design */
            .global-footer {
                background: #0A0A0A;
                border-top: 1px solid rgba(0, 255, 136, 0.2);
                padding: 60px 48px 40px;
                margin-top: 80px;
                margin-left: 280px;
                margin-right: 0;
                margin-bottom: 0;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
                position: relative;
                overflow: hidden;
                transition: margin-left 0.3s ease;
                width: calc(100% - 280px);
            }
            
            @media (max-width: 768px) {
                .global-footer {
                    margin-left: 0;
                    width: 100%;
                }
            }
            
            .global-footer::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 1px;
                background: linear-gradient(90deg, 
                    transparent, 
                    rgba(0, 255, 136, 0.5), 
                    rgba(0, 255, 136, 0.8),
                    rgba(0, 255, 136, 0.5),
                    transparent
                );
                animation: footerGlow 3s ease-in-out infinite;
            }
            
            @keyframes footerGlow {
                0%, 100% { opacity: 0.5; }
                50% { opacity: 1; }
            }
            
            .footer-container {
                max-width: 1400px;
                margin: 0 auto;
                position: relative;
            }
            
            .footer-main {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 48px;
                margin-bottom: 48px;
            }
            
            .footer-section h4 {
                color: #00FF88;
                font-size: 14px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 2px;
                margin-bottom: 20px;
                font-family: 'Orbitron', monospace;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .footer-links {
                list-style: none;
                padding: 0;
                margin: 0;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .footer-link {
                color: #C0C0C0;
                text-decoration: none;
                transition: all 0.3s ease;
                position: relative;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 4px 0;
                font-size: 15px;
            }
            
            .footer-link::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 0;
                width: 0;
                height: 2px;
                background: #00FF88;
                transition: width 0.3s ease;
            }
            
            .footer-link:hover {
                color: #00FF88;
                transform: translateX(5px);
            }
            
            .footer-link:hover::after {
                width: 100%;
            }
            
            /* Special Sections */
            .footer-tools {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
            }
            
            .footer-tool-link {
                background: rgba(0, 255, 136, 0.05);
                border: 1px solid rgba(0, 255, 136, 0.2);
                padding: 12px 16px;
                border-radius: 8px;
                color: #C0C0C0;
                text-decoration: none;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 8px;
                font-weight: 600;
            }
            
            .footer-tool-link:hover {
                background: rgba(0, 255, 136, 0.1);
                border-color: #00FF88;
                color: #00FF88;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 255, 136, 0.3);
            }
            
            /* Footer Bottom */
            .footer-divider {
                height: 1px;
                background: linear-gradient(90deg, 
                    transparent, 
                    rgba(0, 255, 136, 0.2), 
                    transparent
                );
                margin: 40px 0 32px;
            }
            
            .footer-bottom {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 24px;
            }
            
            .footer-copyright {
                color: rgba(192, 192, 192, 0.6);
                font-size: 14px;
                line-height: 1.6;
            }
            
            .footer-copyright strong {
                color: #00FF88;
                font-weight: 600;
            }
            
            .footer-actions {
                display: flex;
                align-items: center;
                gap: 24px;
            }
            
            /* Status Indicator */
            .status-indicator {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 16px;
                background: rgba(0, 255, 136, 0.1);
                border: 1px solid rgba(0, 255, 136, 0.3);
                border-radius: 20px;
                color: #00FF88;
                font-size: 13px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            .status-dot {
                width: 8px;
                height: 8px;
                background: #00FF88;
                border-radius: 50%;
                animation: statusPulse 2s ease-in-out infinite;
            }
            
            @keyframes statusPulse {
                0%, 100% { 
                    opacity: 1;
                    transform: scale(1);
                }
                50% { 
                    opacity: 0.5;
                    transform: scale(1.2);
                }
            }
            
            .status-indicator.offline {
                background: rgba(255, 68, 68, 0.1);
                border-color: rgba(255, 68, 68, 0.3);
                color: #FF4444;
            }
            
            .status-indicator.offline .status-dot {
                background: #FF4444;
                animation: none;
            }
            
            /* Social Links */
            .social-links {
                display: flex;
                gap: 12px;
            }
            
            .social-link {
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0, 255, 136, 0.05);
                border: 1px solid rgba(0, 255, 136, 0.2);
                border-radius: 8px;
                color: #C0C0C0;
                text-decoration: none;
                transition: all 0.3s ease;
                font-size: 20px;
            }
            
            .social-link:hover {
                background: #00FF88;
                border-color: #00FF88;
                color: #0A0A0A;
                transform: translateY(-3px) rotate(5deg);
                box-shadow: 0 6px 20px rgba(0, 255, 136, 0.4);
            }
            
            /* Admin Badge */
            .admin-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                background: linear-gradient(135deg, #8B5CF6, #6366F1);
                color: white;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-left: 8px;
            }
            
            /* Responsive Design */
            @media (max-width: 768px) {
                .global-footer {
                    padding: 40px 20px 30px;
                }
                
                .footer-main {
                    grid-template-columns: 1fr;
                    gap: 32px;
                }
                
                .footer-tools {
                    grid-template-columns: 1fr;
                }
                
                .footer-bottom {
                    flex-direction: column;
                    text-align: center;
                }
                
                .footer-actions {
                    flex-direction: column;
                    width: 100%;
                }
                
                .social-links {
                    justify-content: center;
                }
            }
            
            /* Dark mode adjustments */
            body.light-mode .global-footer {
                background: #F8FAFC;
                border-top-color: rgba(74, 144, 226, 0.2);
            }
            
            body.light-mode .global-footer::before {
                background: linear-gradient(90deg, 
                    transparent, 
                    rgba(74, 144, 226, 0.5), 
                    rgba(74, 144, 226, 0.8),
                    rgba(74, 144, 226, 0.5),
                    transparent
                );
            }
            
            body.light-mode .footer-section h4 {
                color: #4A90E2;
            }
            
            body.light-mode .footer-link {
                color: #64748B;
            }
            
            body.light-mode .footer-link:hover {
                color: #4A90E2;
            }
            
            body.light-mode .footer-copyright {
                color: #94A3B8;
            }
        `;
    }
    
    // Schneller Load-Versuch
    quickLoad() {
        try {
            if (document.body && !this.isFooterPresent()) {
                this.injectFooter();
                console.log('⚡ Footer schnell geladen');
            }
        } catch (error) {
            console.log('⚠️ Schneller Load fehlgeschlagen, Backup wird verwendet');
        }
    }
    
    // Sicherer Load
    safeLoad() {
        if (this.isLoaded || this.isFooterPresent()) {
            console.log('🦶 Footer bereits vorhanden - übersprungen');
            return;
        }
        
        this.injectFooter();
    }
    
    // Sicherstellen dass Footer existiert
    ensureFooterExists() {
        if (!this.isFooterPresent()) {
            console.log('🔧 Footer fehlt - wird nachgeladen');
            this.injectFooter();
        }
    }
    
    // Prüfen ob Footer bereits vorhanden ist
    isFooterPresent() {
        return !!document.querySelector('.global-footer');
    }
    
    // Footer in die Seite einfügen
    injectFooter() {
        if (!document.body) {
            console.warn('⚠️ Kein Body-Element gefunden');
            return;
        }
        
        if (this.isFooterPresent()) {
            console.log('🦶 Footer bereits vorhanden');
            return;
        }
        
        // Footer am Ende des Body einfügen
        document.body.insertAdjacentHTML('beforeend', this.footerHTML);
        this.isLoaded = true;
        
        // Sidebar-Anpassung
        this.adjustForSidebar();
        
        console.log('✅ Global Footer automatisch eingefügt');
        
        // Footer-Features nach kleiner Verzögerung initialisieren
        setTimeout(() => this.initializeFooterFeatures(), 100);
    }
    
    // Footer an Sidebar anpassen
    adjustForSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const footer = document.querySelector('.global-footer');
        
        if (sidebar && footer) {
            // Prüfen ob Sidebar sichtbar ist
            const sidebarStyle = window.getComputedStyle(sidebar);
            if (sidebarStyle.display !== 'none' && sidebarStyle.visibility !== 'hidden') {
                const sidebarWidth = sidebar.offsetWidth;
                if (window.innerWidth > 768) {
                    footer.style.marginLeft = `${sidebarWidth}px`;
                    console.log(`📏 Footer an Sidebar angepasst: ${sidebarWidth}px`);
                }
            }
        }
        
        // Bei Fenstergrößenänderung anpassen
        window.addEventListener('resize', () => {
            if (footer) {
                if (window.innerWidth <= 768) {
                    footer.style.marginLeft = '0';
                } else if (sidebar) {
                    const sidebarWidth = sidebar.offsetWidth;
                    footer.style.marginLeft = `${sidebarWidth}px`;
                }
            }
        });
    }
    
    // Footer HTML Template
    getFooterTemplate() {
        return `
            <!-- GLOBAL FOOTER - Professional Gaming Design -->
            <footer class="global-footer">
                <div class="footer-container">
                    <div class="footer-main">
                        <!-- Navigation & Tools -->
                        <div class="footer-section">
                            <h4>🎮 GAMING TOOLS</h4>
                            <div class="footer-tools">
                                <a href="as-counter.html" class="footer-tool-link auto-tool-link" data-dashboard="dashboard-as-counter.html">
                                    ⚔️ AS Counter
                                </a>
                                <a href="raid-counter.html" class="footer-tool-link auto-tool-link" data-dashboard="dashboard-raid-counter.html">
                                    🏴‍☠️ Raid Counter
                                </a>
                                <a href="sabo-counter.html" class="footer-tool-link">
                                    💣 Sabo Counter
                                </a>
                                <a href="battle-counter.html" class="footer-tool-link">
                                    🧮 Battle Counter
                                </a>
                            </div>
                        </div>
                        
                        <!-- Quick Links -->
                        <div class="footer-section">
                            <h4>🚀 QUICK LINKS</h4>
                            <ul class="footer-links">
                                <li><a href="index.html" class="footer-link">🏠 Home</a></li>
                                <li><a href="dashboard.html" class="footer-link" id="auto-quick-dashboard">📊 Dashboard</a></li>
                                <li><a href="register.html" class="footer-link">🔐 Register</a></li>
                                <li><a href="changelog.html" class="footer-link">📝 Changelog</a></li>
                            </ul>
                        </div>
                        
                        <!-- Support & Legal -->
                        <div class="footer-section">
                            <h4>⚖️ SUPPORT & LEGAL</h4>
                            <ul class="footer-links">
                                <li><a href="hilfe.html" class="footer-link">❓ Help & FAQ</a></li>
                                <li><a href="impressum.html" class="footer-link">📄 Impressum</a></li>
                                <li><a href="datenschutz.html" class="footer-link">🔒 Privacy Policy</a></li>
                                <li><a href="kontakt.html" class="footer-link">✉️ Contact</a></li>
                            </ul>
                        </div>
                        
                        <!-- Admin Section -->
                        <div class="footer-section">
                            <h4>⚙️ ADMINISTRATION</h4>
                            <ul class="footer-links admin-links">
                                <li>
                                    <a href="admin-login.html" class="footer-link" id="auto-admin-login-link">
                                        🔐 Admin Login
                                    </a>
                                </li>
                                <li style="display: none;">
                                    <a href="admin-dashboard.html" class="footer-link" id="auto-admin-dashboard-link">
                                        🛡️ Admin Dashboard
                                        <span class="admin-badge">ADMIN</span>
                                    </a>
                                </li>
                                <li>
                                    <a href="roadmap.html" class="footer-link">
                                        🗺️ Roadmap
                                    </a>
                                </li>
                                <li>
                                    <a href="#" class="footer-link auto-theme-toggle">
                                        🌙 Toggle Theme
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>
                    
                    <div class="footer-divider"></div>
                    
                    <div class="footer-bottom">
                        <div class="footer-copyright">
                            <strong>© 2025 Spacenations Tools</strong><br>
                            Professional gaming tools for competitive Spacenations players<br>
                            <span style="font-size: 12px; opacity: 0.7;">
                                Version 3.0 | Built for gamers, by gamers ⚡
                            </span>
                        </div>
                        
                        <div class="footer-actions">
                            <!-- System Status -->
                            <div class="status-indicator" id="auto-system-status">
                                <span class="status-dot"></span>
                                <span>ONLINE</span>
                            </div>
                            
                            <!-- Social Links -->
                            <div class="social-links">
                                <a href="https://discord.gg/spacenations" class="social-link" title="Join our Discord" target="_blank">
                                    🎮
                                </a>
                                <a href="https://github.com/Trend4Media/Spacenations-Tools" class="social-link" title="GitHub Repository" target="_blank">
                                    ⚡
                                </a>
                                <a href="mailto:admin@spacenations-tools.de" class="social-link" title="Contact Support">
                                    ✉️
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        `;
    }
    
    // Footer-Features initialisieren
    initializeFooterFeatures() {
        this.setupAutoThemeToggle();
        // Admin-Links immer initialisieren (Admin-Login im Footer bleibt sichtbar)
        this.setupAutoAdminLinks();
        this.setupAutoDashboardLinks();
        this.setupAutoSystemStatus();
        this.setupAutoToolLinks();
        this.hideAdminUiOnIndexAtRuntime();
        
        console.log('⚙️ Auto-Footer-Features initialisiert');
    }
    
    // Auto Theme Toggle
    setupAutoThemeToggle() {
        const themeToggles = document.querySelectorAll('.auto-theme-toggle');
        themeToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                if (window.ThemeAPI) {
                    window.ThemeAPI.toggle();
                } else if (window.toggleTheme) {
                    window.toggleTheme();
                } else {
                    document.body.classList.toggle('light-mode');
                    localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
                }
            });
        });
    }
    
    // Auto Admin Links
    setupAutoAdminLinks() {
        const checkAuth = () => {
            if (window.AuthAPI) {
                window.AuthAPI.onAuthStateChange((user, userData) => {
                    const adminLoginLink = document.getElementById('auto-admin-login-link');
                    const adminDashboardLink = document.getElementById('auto-admin-dashboard-link');
                    
                    if (userData && (userData.globalRole === 'global_admin' || userData.isSuperAdmin === true)) {
                        if (adminLoginLink) adminLoginLink.parentElement.style.display = 'none';
                        if (adminDashboardLink) adminDashboardLink.parentElement.style.display = 'block';
                    } else {
                        if (adminLoginLink) adminLoginLink.parentElement.style.display = 'block';
                        if (adminDashboardLink) adminDashboardLink.parentElement.style.display = 'none';
                    }
                });
            } else {
                setTimeout(checkAuth, 1000);
            }
        };
        
        checkAuth();
    }
    
    // Auto Dashboard Links
    setupAutoDashboardLinks() {
        const checkAuth = () => {
            if (window.AuthAPI) {
                window.AuthAPI.onAuthStateChange((user, _userData) => {
                    const quickDashboard = document.getElementById('auto-quick-dashboard');
                    
                    if (user) {
                        if (quickDashboard) {
                            quickDashboard.innerHTML = '📊 Dashboard';
                            quickDashboard.href = 'dashboard.html';
                        }
                        this.updateAutoToolLinksForLoggedInUser();
                    } else {
                        if (quickDashboard) {
                            quickDashboard.innerHTML = '🔐 Login';
                            quickDashboard.href = 'index.html';
                        }
                        this.resetAutoToolLinksForLoggedOutUser();
                    }
                });
            } else {
                setTimeout(checkAuth, 1000);
            }
        };
        
        checkAuth();
    }
    
    // Auto Tool Links für eingeloggte User
    updateAutoToolLinksForLoggedInUser() {
        const toolLinks = document.querySelectorAll('.auto-tool-link');
        
        toolLinks.forEach(link => {
            const dashboardVersion = link.getAttribute('data-dashboard');
            if (dashboardVersion) {
                link.href = dashboardVersion;
                link.title = 'Dashboard Version - Auto-save enabled';
            }
        });
    }
    
    // Auto Tool Links für ausgeloggte User
    resetAutoToolLinksForLoggedOutUser() {
        const toolLinks = document.querySelectorAll('.auto-tool-link');
        
        toolLinks.forEach(link => {
            if (link.href.includes('dashboard-')) {
                const originalHref = link.href.replace('dashboard-', '');
                link.href = originalHref;
                link.title = 'Standard Version';
            }
        });
    }
    
    // Auto System Status
    setupAutoSystemStatus() {
        const statusIndicator = document.getElementById('auto-system-status');
        if (!statusIndicator) return;
        
        // Online-Status prüfen
        const updateStatus = () => {
            if (navigator.onLine) {
                statusIndicator.className = 'status-indicator';
                statusIndicator.innerHTML = '<span class="status-dot"></span><span>ONLINE</span>';
            } else {
                statusIndicator.className = 'status-indicator offline';
                statusIndicator.innerHTML = '<span class="status-dot"></span><span>OFFLINE</span>';
            }
        };
        
        updateStatus();
        
        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);
    }
    
    // Auto Tool Links Setup
    setupAutoToolLinks() {
        // Hier können weitere Tool-spezifische Links konfiguriert werden
        console.log('🔗 Auto Tool Links konfiguriert');
    }
    
    // Laufzeit-Hide für Admin/Setup-UI auf der Startseite
    hideAdminUiOnIndexAtRuntime() {
        try {
            const page = (window.location.pathname.split('/').pop().split('.')[0] || 'index');
            if (page !== 'index') return;
            
            // Header: entferne Admin/Logout Buttons, lasse "Zum Spiel" bestehen
            const navActions = document.querySelector('.header .nav .nav-actions');
            if (navActions) {
                const adminBtn = navActions.querySelector('.btn.btn-admin');
                const logoutBtn = navActions.querySelector('.btn.btn-logout');
                if (adminBtn && adminBtn.parentNode) adminBtn.parentNode.removeChild(adminBtn);
                if (logoutBtn && logoutBtn.parentNode) logoutBtn.parentNode.removeChild(logoutBtn);
            }
            
            // Sidebar: entferne gesamten Admin & System Block, falls noch vorhanden
            const adminTitle = Array.from(document.querySelectorAll('.sidebar-title'))
                .find(el => el.textContent && el.textContent.includes('Admin'));
            if (adminTitle) {
                // der nächste .sidebar-buttons-Block nach dem Titel
                const buttons = adminTitle.nextElementSibling;
                if (buttons && buttons.classList.contains('sidebar-buttons')) {
                    buttons.remove();
                }
                adminTitle.remove();
            }
            
            console.log('🧼 Admin/Setup UI auf Startseite zur Laufzeit entfernt');
        } catch (e) {
            console.warn('⚠️ Konnte Admin/Setup UI nicht zur Laufzeit entfernen:', e);
        }
    }
    
    // Force-Reload für dynamische Inhalte
    forceReload() {
        const existingFooter = document.querySelector('.global-footer');
        if (existingFooter) {
            existingFooter.remove();
        }
        
        this.isLoaded = false;
        this.safeLoad();
        
        console.log('🔄 Auto-Footer force-reloaded');
    }
    
    // Public API
    updateContent(updates) {
        if (!this.isLoaded) return;
        
        if (updates.status) {
            const statusIndicator = document.getElementById('auto-system-status');
            if (statusIndicator) {
                statusIndicator.innerHTML = `<span class="status-dot"></span><span>${updates.status.toUpperCase()}</span>`;
            }
        }
        
        if (updates.version) {
            const versionText = document.querySelector('.footer-copyright span');
            if (versionText) {
                versionText.innerHTML = `Version ${updates.version} | Built for gamers, by gamers ⚡`;
            }
        }
        
        console.log('📝 Auto-Footer aktualisiert:', updates);
    }
}

// SOFORTIGE automatische Initialisierung
if (!window.autoGlobalFooterLoader) {
    window.autoGlobalFooterLoader = new AutoGlobalFooterLoader();
}

// Globale API für Footer-Management
window.AutoFooterAPI = {
    // Footer neu laden
    reload: () => window.autoGlobalFooterLoader.forceReload(),
    
    // Footer-Inhalte aktualisieren
    update: (updates) => window.autoGlobalFooterLoader.updateContent(updates),
    
    // Prüfen ob Footer geladen ist
    isLoaded: () => window.autoGlobalFooterLoader.isLoaded,
    
    // Footer manuell laden
    load: () => window.autoGlobalFooterLoader.safeLoad(),
    
    // Status ändern
    setStatus: (status, type = 'online') => {
        const statusIndicator = document.getElementById('auto-system-status');
        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${type}`;
            statusIndicator.innerHTML = `<span class="status-dot"></span><span>${status.toUpperCase()}</span>`;
        }
    }
};

// Auto-Load Überwachung für dynamische Seiten
const autoFooterObserver = new MutationObserver(() => {
    if (!window.autoGlobalFooterLoader.isFooterPresent()) {
        console.log('🔍 Footer verschwunden - wird neu geladen');
        window.autoGlobalFooterLoader.ensureFooterExists();
    }
});

// Observer starten wenn DOM bereit
const startObserver = () => {
    if (document.body) {
        autoFooterObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
        console.log('👁️ Auto-Footer Observer gestartet');
    } else {
        setTimeout(startObserver, 500);
    }
};

startObserver();

console.log('🦶 Global Footer Loader v3.0 - Professional Gaming Design');
console.log('📋 API verfügbar: window.AutoFooterAPI');
console.log('✨ Footer wird AUTOMATISCH auf JEDER Seite geladen!');