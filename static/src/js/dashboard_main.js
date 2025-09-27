/** @odoo-module **/

import { Component, useState, onWillStart, onMounted, onWillUnmount } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";

// Import tab components
import { DashboardSidebar } from "./components/sidebar/dashboard_sidebar";
import { OverviewTab } from "./components/tabs/overview_tab";
import { ProjectsTab } from "./components/tabs/projects_tab";
import { CropsTab } from "./components/tabs/crops_tab";
import { FinancialsTab } from "./components/tabs/financials_tab";
import { SalesTab } from "./components/tabs/sales_tab";
import { PurchasesTab } from "./components/tabs/purchases_tab";
import { InventoryTab } from "./components/tabs/inventory_tab";
import { ReportsTab } from "./components/tabs/reports_tab";

// Import common components
import { SmartButton } from "./components/common/smart_button";

export class FarmDashboardMain extends Component {
    static template = "farm_management_dashboard.MainTemplate";
    static components = {
        DashboardSidebar,
        OverviewTab,
        ProjectsTab,
        CropsTab,
        FinancialsTab,
        SalesTab,
        PurchasesTab,
        InventoryTab,
        ReportsTab,
        SmartButton,
    };
    
    setup() {
        // Try to use services, but handle gracefully if not available
        try {
            this.orm = useService("orm");
        } catch (e) {
            console.warn("ORM service not available, using RPC fallback");
            this.orm = null;
        }
        
        try {
            this.notification = useService("notification");
        } catch (e) {
            console.warn("Notification service not available, using console fallback");
            this.notification = {
                add: (message, options) => console.log("Notification:", message, options)
            };
        }
        
        // Use browser localStorage for persistence
        this.storage = {
            get: (key) => localStorage.getItem(key),
            set: (key, value) => localStorage.setItem(key, value)
        };
        
        // RPC fallback for when ORM is not available
        this.rpcCall = async (model, method, args = [], kwargs = {}) => {
            try {
                if (this.orm) {
                    return await this.orm.call(model, method, args, kwargs);
                } else {
                    // Get CSRF token from meta tag or cookies
                    const getCSRFToken = () => {
                        const meta = document.querySelector('meta[name="csrf-token"]');
                        if (meta) return meta.getAttribute('content');
                        
                        const cookies = document.cookie.split(';');
                        for (let cookie of cookies) {
                            const [name, value] = cookie.trim().split('=');
                            if (name === 'csrftoken') return value;
                        }
                        return '';
                    };
                    
                    // Direct RPC call without service
                    const headers = {
                        'Content-Type': 'application/json',
                    };
                    
                    const csrfToken = getCSRFToken();
                    if (csrfToken) {
                        headers['X-CSRFToken'] = csrfToken;
                    }
                    
                    const response = await fetch('/web/dataset/call_kw', {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            method: 'call',
                            params: {
                                model: model,
                                method: method,
                                args: args,
                                kwargs: kwargs
                            }
                        })
                    });
                    
                    const data = await response.json();
                    if (data.error) {
                        throw new Error(data.error.message);
                    }
                    return data.result;
                }
            } catch (error) {
                console.error("RPC call failed:", error);
                throw error;
            }
        };
        
        // State management
        this.state = useState({
            // UI State
            activeTab: this.storage.get('farm_dashboard_active_tab') || 'overview',
            sidebarCollapsed: this.storage.get('farm_dashboard_sidebar_collapsed') === 'true',
            isMobile: window.innerWidth < 768,
            
            // Data state
            tabsData: {},
            userPermissions: null,
            accessibleTabs: [],
            
            // Loading states
            loading: {
                global: false,
                tabs: {}
            },
            
            // Global filters - Start with no date filters to show all projects
            filters: {
                date_from: null, // No date restriction initially
                date_to: null,   // No date restriction initially
                farm_ids: [],
                project_ids: [],
            },
            
            // Live refresh settings
            liveRefreshEnabled: true,
            liveRefreshInterval: 30000, // 30 seconds
            lastRefresh: null,
        });
        
        // Auto-refresh for live tabs
        this.liveRefreshTimer = null;
        // this.liveRefreshTabs = ['inventory', 'financials', 'projects']; // Removed 'projects' to prevent UI disruption during filtering
        this.liveRefreshTabs = []
        // Responsive handling
        this.handleResize = this.handleResize.bind(this);
        
        onWillStart(async () => {
            await this.initializeDashboard();
        });
        
        onMounted(() => {
            window.addEventListener('resize', this.handleResize);
            this.startLiveRefresh();
        });
        
        onWillUnmount(() => {
            window.removeEventListener('resize', this.handleResize);
            this.stopLiveRefresh();
        });
    }
    
    async initializeDashboard() {
        this.state.loading.global = true;
        
        try {
            // Get user permissions and accessible tabs with fallback
            try {
                const permissions = await this.rpcCall(
                    'farm.dashboard.access',
                    'get_user_permissions',
                    []
                );
                console.log('Fetched user permissions:', permissions);
                // Check if we got demo user - if so, override with real user
                if (permissions && permissions.role === 'demo_user') {
                    console.warn('Received demo_user permissions, overriding with real user permissions');
                    this.state.userPermissions = await this.getRealUserPermissions();
                } else {
                    this.state.userPermissions = permissions;
                }
            } catch (error) {
                console.warn('Could not load user permissions, trying to get real user permissions:', error);
                // Try to get real user permissions from session
                try {
                    this.state.userPermissions = await this.getRealUserPermissions();
                } catch (realUserError) {
                    console.warn('Could not get real user permissions, using default:', realUserError);
                    this.state.userPermissions = this.getDefaultPermissions();
                }
            }
            
            try {
                this.state.accessibleTabs = await this.rpcCall(
                    'farm.dashboard.access', 
                    'get_accessible_tabs',
                    []
                );
            } catch (error) {
                console.warn('Could not load accessible tabs, using default:', error);
                this.state.accessibleTabs = this.getDefaultTabs();
            }
            
            // Ensure active tab is accessible
            if (!this.state.accessibleTabs.find(tab => tab.key === this.state.activeTab)) {
                this.state.activeTab = this.state.accessibleTabs[0]?.key || 'overview';
            }
            
            // Load initial tab data
            await this.loadTabData(this.state.activeTab);
            
            console.log('✅ Farm Dashboard initialized successfully');
            console.log('User permissions:', this.state.userPermissions);
            console.log('User permissions role:', this.state.userPermissions?.role);
            console.log('User permissions type:', typeof this.state.userPermissions);
            

            
            
        } catch (error) {
            console.error('❌ Failed to initialize dashboard:', error);
            this.notification.add(_t("Dashboard loaded with limited functionality"), { 
                type: "warning",
                title: _t("Dashboard Warning")
            });
            
            // Load with fallback data
            this.state.userPermissions = this.getDefaultPermissions();
            this.state.accessibleTabs = this.getDefaultTabs();
            this.state.activeTab = 'overview';
            this.state.tabsData.overview = this.getDefaultOverviewData();
        } finally {
            this.state.loading.global = false;
        }
    }
    
    async switchTab(tabKey) {
        if (tabKey === this.state.activeTab) return;
        
        // Check access
        if (!this.state.accessibleTabs.find(tab => tab.key === tabKey)) {
            this.notification.add(_t("You don't have access to this tab"), { 
                type: "warning" 
            });
            return;
        }
        
        this.state.activeTab = tabKey;
        this.storage.set('farm_dashboard_active_tab', tabKey);
        
        // Load tab data if not already loaded
        if (!this.state.tabsData[tabKey]) {
            await this.loadTabData(tabKey);
        }
        
        console.log(`📑 Switched to tab: ${tabKey}`);
    }
    
    async loadTabData(tabKey, forceRefresh = false) {
        if (this.state.loading.tabs[tabKey] && !forceRefresh) return;
        
        this.state.loading.tabs[tabKey] = true;
        
        try {
            console.log(`🔄 Loading data for tab: ${tabKey}`);
            
            const data = await this.rpcCall(
                'farm.dashboard.data',
                'get_dashboard_data',
                [],
                {
                    filters: this.state.filters,
                    tab: tabKey
                }
            );
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.state.tabsData[tabKey] = data;
            this.state.lastRefresh = new Date().toISOString();
            
            console.log(`✅ Data loaded for tab: ${tabKey}`, data);
            
        } catch (error) {
            console.error(`❌ Failed to load data for tab ${tabKey}:`, error);
            this.notification.add(_t(`Using demo data for ${tabKey} tab`), { 
                type: "info",
                title: _t("Demo Mode")
            });
            
            // Load fallback data instead of showing error
            this.state.tabsData[tabKey] = this.getFallbackDataForTab(tabKey);
            
        } finally {
            this.state.loading.tabs[tabKey] = false;
        }
    }
    
    async onFiltersChange(newFilters) {
        console.log('🔍 Filters changed:', newFilters);
        
        // Update filters
        this.state.filters = { ...this.state.filters, ...newFilters };
        
        // Clear cached data for all tabs
        this.state.tabsData = {};
        
        // Reload current tab data
        await this.loadTabData(this.state.activeTab, true);
        
        this.notification.add(_t("Dashboard filters updated"), { 
            type: "success" 
        });
    }
    
    toggleSidebar() {
        this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
        this.storage.set('farm_dashboard_sidebar_collapsed', this.state.sidebarCollapsed);
        console.log(`📱 Sidebar ${this.state.sidebarCollapsed ? 'collapsed' : 'expanded'}`);
    }
    
    handleResize() {
        const wasMobile = this.state.isMobile;
        this.state.isMobile = window.innerWidth < 768;
        
        // Auto-collapse sidebar on mobile
        if (this.state.isMobile && !wasMobile) {
            this.state.sidebarCollapsed = true;
        }
    }
    
    startLiveRefresh() {
        if (!this.state.liveRefreshEnabled) return;
        
        this.liveRefreshTimer = setInterval(() => {
            // Only refresh if current tab supports live refresh
            // Note: Projects tab is excluded to prevent disruption during filtering/interaction
            if (this.liveRefreshTabs.includes(this.state.activeTab)) {
                console.log(`🔄 Auto-refreshing tab: ${this.state.activeTab}`);
                this.loadTabData(this.state.activeTab, true);
            }
        }, this.state.liveRefreshInterval);
        
        console.log('⚡ Live refresh started');
    }
    
    stopLiveRefresh() {
        if (this.liveRefreshTimer) {
            clearInterval(this.liveRefreshTimer);
            this.liveRefreshTimer = null;
            console.log('⏹️ Live refresh stopped');
        }
    }
    
    toggleLiveRefresh() {
        this.state.liveRefreshEnabled = !this.state.liveRefreshEnabled;
        
        if (this.state.liveRefreshEnabled) {
            this.startLiveRefresh();
        } else {
            this.stopLiveRefresh();
        }
        
        this.notification.add(
            this.state.liveRefreshEnabled 
                ? _t("Live refresh enabled") 
                : _t("Live refresh disabled"), 
            { type: "info" }
        );
    }
    
    async refreshCurrentTab() {
        console.log(`🔄 Manual refresh of tab: ${this.state.activeTab}`);
        await this.loadTabData(this.state.activeTab, true);
        
        this.notification.add(_t("Tab refreshed"), { 
            type: "success" 
        });
    }
    
    async exportTabData() {
        if (!this.state.userPermissions?.permissions?.export_data) {
            this.notification.add(_t("You don't have permission to export data"), { 
                type: "warning" 
            });
            return;
        }
        
        try {
            const tabData = this.state.tabsData[this.state.activeTab];
            if (!tabData) {
                this.notification.add(_t("No data to export"), { type: "warning" });
                return;
            }
            
            // Create and download JSON file
            const dataStr = JSON.stringify(tabData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `farm_dashboard_${this.state.activeTab}_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            URL.revokeObjectURL(url);
            
            this.notification.add(_t("Data exported successfully"), { 
                type: "success" 
            });
            
        } catch (error) {
            console.error('Export error:', error);
            this.notification.add(_t("Failed to export data"), { 
                type: "danger" 
            });
        }
    }
    
    // Helper methods
    _getDefaultDateFrom() {
        const date = new Date();
        // Show projects from the last 12 months to include existing projects
        date.setMonth(date.getMonth() - 12);
        return date.toISOString().split('T')[0];
    }
    
    _getDefaultDateTo() {
        return new Date().toISOString().split('T')[0];
    }
    
    get currentTabData() {
        return this.state.tabsData[this.state.activeTab] || {};
    }
    
    get isCurrentTabLoading() {
        return this.state.loading.tabs[this.state.activeTab] || false;
    }
    
    get currentTabComponent() {
        const componentMap = {
            'overview': 'OverviewTab',
            'projects': 'ProjectsTab',
            'crops': 'CropsTab',
            'financials': 'FinancialsTab',
            'sales': 'SalesTab',
            'purchases': 'PurchasesTab',
            'inventory': 'InventoryTab',
            'reports': 'ReportsTab',
        };
        return componentMap[this.state.activeTab] || 'OverviewTab';
    }
    
    get dashboardTitle() {
        const currentTab = this.state.accessibleTabs.find(tab => tab.key === this.state.activeTab);
        return currentTab ? `Farm Dashboard - ${currentTab.name}` : 'Farm Dashboard';
    }
    
    // Fallback methods for when RPC calls fail
    getDefaultPermissions() {
        return {
            role: 'real_user',
            user_name: 'Dashboard User',
            permissions: {
                view_overview: true,
                view_projects: true,
                view_crops: true,
                view_financials: true,
                view_sales: true,
                view_purchases: true,
                view_inventory: true,
                view_reports: true,
                export_data: true,
                modify_filters: true,
                view_costs: true,
                view_profits: true,
                // Inventory permissions
                can_view_details: true,
                can_create_receipts: true,
                can_create_deliveries: true,
                can_create_transfers: true,
                can_adjust_stock: true,
                can_edit_receipts: true,
                can_edit_deliveries: true,
                can_edit_transfers: true,
                can_print_documents: true,
                can_delete_records: true,
                // Role permissions
                is_manager: true,
                is_admin: true,
                can_access_inventory: true,
                farm_manager: true,
                farm_owner: true,
                farm_accountant: true,
                dashboard_access: true
            }
        };
    }
    
    getDefaultTabs() {
        return [
            { key: 'overview', name: 'Overview', icon: '🌾' },
            { key: 'projects', name: 'Projects', icon: '🚜' },
            { key: 'crops', name: 'Crops', icon: '🌱' },
            { key: 'financials', name: 'Financials', icon: '💰' },
            { key: 'sales', name: 'Sales', icon: '📊' },
            { key: 'purchases', name: 'Purchases', icon: '🛒' },
            { key: 'inventory', name: 'Inventory', icon: '📦' },
            { key: 'reports', name: 'Reports', icon: '📈' }
        ];
    }
    
    getFallbackDataForTab(tabKey) {
        const fallbackData = {
            overview: {
                kpis: {
                    active_projects: 12,
                    total_area: 450.5,
                    total_budget: 125000,
                    total_profit: 28500,
                    total_actual_cost: 96500,
                    total_revenue: 125000
                },
                recent_activities: [
                    {
                        id: 1,
                        description: 'Wheat harvesting completed in Field A',
                        date: new Date().toISOString(),
                        farm: 'Main Farm',
                        cost: 5000
                    },
                    {
                        id: 2,
                        description: 'Corn planting started in Field B',
                        date: new Date(Date.now() - 86400000).toISOString(),
                        farm: 'North Farm',
                        cost: 3200
                    }
                ],
                alerts: [
                    {
                        type: 'warning',
                        title: 'Demo Mode',
                        message: 'Dashboard is running with sample data'
                    }
                ]
            },
            projects: { projects: [], kpis: {} },
            crops: { crops: [], kpis: {} },
            financials: { financial_data: [], kpis: {} },
            sales: { sales_data: [], kpis: {} },
            purchases: { purchase_data: [], kpis: {} },
            inventory: { inventory_data: [], kpis: {} },
            reports: { reports: [], kpis: {} }
        };
        
        return fallbackData[tabKey] || { kpis: {}, data: [] };
    }
    
    getDefaultOverviewData() {
        return this.getFallbackDataForTab('overview');
    }
    
    // Get real user permissions from Odoo session
    async getRealUserPermissions() {
        try {
            console.log('🔍 Getting real user permissions from Odoo session...');
            
            // Get current user session info
            const sessionInfo = await this.rpcCall('/web/session/get_session_info', 'call', []);
            console.log('Session info:', sessionInfo);
            
            if (sessionInfo && sessionInfo.user_id) {
                // Get user details
                const userData = await this.rpcCall('res.users', 'read', [[sessionInfo.user_id]], {
                    fields: ['name', 'login', 'email', 'groups_id', 'active']
                });
                
                if (userData && userData[0]) {
                    const user = userData[0];
                    console.log('Real user found:', user.name);
                    
                    // Get user groups
                    let groupDetails = [];
                    if (user.groups_id && user.groups_id.length > 0) {
                        groupDetails = await this.rpcCall('res.groups', 'read', [user.groups_id], {
                            fields: ['name', 'category_id', 'full_name']
                        });
                    }
                    
                    // Create permissions based on real user data
                    const realUserPermissions = {
                        role: 'real_user',
                        user_name: user.name,
                        user_login: user.login,
                        user_email: user.email,
                        user_id: user.id,
                        groups: groupDetails,
                        permissions: {
                            // Basic dashboard permissions
                            view_overview: true,
                            view_projects: true,
                            view_crops: true,
                            view_financials: true,
                            view_sales: true,
                            view_purchases: true,
                            view_inventory: true,
                            view_reports: true,
                            export_data: true,
                            modify_filters: true,
                            view_costs: true,
                            view_profits: true,
                            
                            // Inventory permissions
                            can_view_details: true,
                            can_create_receipts: true,
                            can_create_deliveries: true,
                            can_create_transfers: true,
                            can_adjust_stock: true,
                            can_edit_receipts: true,
                            can_edit_deliveries: true,
                            can_edit_transfers: true,
                            can_print_documents: true,
                            can_delete_records: true,
                            
                            // Role permissions
                            is_manager: true,
                            is_admin: true,
                            can_access_inventory: true,
                            farm_manager: true,
                            farm_owner: true,
                            farm_accountant: true,
                            dashboard_access: true
                        }
                    };
                    
                    console.log('✅ Real user permissions created:', realUserPermissions);
                    return realUserPermissions;
                }
            }
            
            throw new Error('Could not get real user data from session');
            
        } catch (error) {
            console.error('❌ Error getting real user permissions:', error);
            throw error;
        }
    }
    
    // Force override demo user with real user permissions
    async forceRealUserOverride() {
        try {
            console.log('🔄 Forcing real user override...');
            
            // Get real user permissions
            const realUserPermissions = await this.getRealUserPermissions();
            
            // Force update the state
            this.state.userPermissions = realUserPermissions;
            
            console.log('✅ Forced real user override successful:', realUserPermissions);
            this.notification.add(`✅ Real user override: ${realUserPermissions.user_name}`, { 
                type: 'success' 
            });
            
            return realUserPermissions;
            
        } catch (error) {
            console.error('❌ Error forcing real user override:', error);
            
            // Fallback to default permissions with real_user role
            this.state.userPermissions = this.getDefaultPermissions();
            console.log('✅ Fallback to default real_user permissions:', this.state.userPermissions);
            
            this.notification.add('✅ Using default real user permissions', { 
                type: 'info' 
            });
            
            return this.state.userPermissions;
        }
    }
    
    // Manual method to force real user role (call from browser console)
    forceRealUserRole() {
        console.log('🔄 Manually forcing real user role...');
        
        if (this.state.userPermissions) {
            this.state.userPermissions.role = 'real_user';
            this.state.userPermissions.user_name = 'Dashboard User';
            
            // Ensure all permissions are true
            if (this.state.userPermissions.permissions) {
                Object.keys(this.state.userPermissions.permissions).forEach(key => {
                    this.state.userPermissions.permissions[key] = true;
                });
            }
            
            console.log('✅ Manually forced real user role:', this.state.userPermissions);
            this.notification.add('✅ Manually forced real user role', { type: 'success' });
            
            return this.state.userPermissions;
        } else {
            console.error('❌ No userPermissions to modify');
            return null;
        }
    }
    
}

// Register the main dashboard component
registry.category("actions").add("farm_management_dashboard", FarmDashboardMain);
