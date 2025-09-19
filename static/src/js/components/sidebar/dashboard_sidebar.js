/** @odoo-module **/

import { Component } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";

export class DashboardSidebar extends Component {
    static template = "farm_management_dashboard.SidebarTemplate";
    static props = {
        activeTab: String,
        sidebarCollapsed: Boolean,
        accessibleTabs: Array,
        userPermissions: Object,
        onTabSwitch: Function,
        onToggleSidebar: Function,
        onRefresh: Function,
        onExport: Function,
        liveRefreshEnabled: Boolean,
        onToggleLiveRefresh: Function,
        isMobile: Boolean,
    };
    
    get sidebarClasses() {
        return [
            'farm-sidebar',
            this.props.sidebarCollapsed ? 'collapsed' : 'expanded',
            this.props.isMobile ? 'mobile' : 'desktop'
        ].join(' ');
    }
    
    get userRole() {
        return this.props.userPermissions?.role || 'user';
    }
    
    get userRoleLabel() {
        const roleLabels = {
            'owner': _t('Farm Owner'),
            'manager': _t('Farm Manager'), 
            'accountant': _t('Accountant'),
            'user': _t('User')
        };
        return roleLabels[this.userRole] || _t('User');
    }
    
    get userRoleIcon() {
        const roleIcons = {
            'owner': '👑',
            'manager': '🧑‍🌾',
            'accountant': '💼',
            'user': '👤'
        };
        return roleIcons[this.userRole] || '👤';
    }
    
    onTabClick(tabKey, event) {
        event.preventDefault();
        this.props.onTabSwitch(tabKey);
        
        // Auto-collapse sidebar on mobile after tab selection
        if (this.props.isMobile && !this.props.sidebarCollapsed) {
            this.props.onToggleSidebar();
        }
    }
    
    getTabClasses(tabKey) {
        return [
            'sidebar-tab',
            tabKey === this.props.activeTab ? 'active' : '',
        ].join(' ');
    }
    
    getTabBadge(tabKey) {
        // Add badges for tabs with notifications/counts
        const badges = {
            'projects': this.getProjectsBadge(),
            'inventory': this.getInventoryBadge(),
            'financials': this.getFinancialsBadge(),
        };
        return badges[tabKey] || '';
    }
    
    getProjectsBadge() {
        // This would be populated from parent component data
        // For now, return empty - will be implemented when data flows through
        return '';
    }
    
    getInventoryBadge() {
        // Badge for low stock items
        return '';
    }
    
    getFinancialsBadge() {
        // Badge for financial alerts
        return '';
    }
    
    get canExport() {
        return this.props.userPermissions?.permissions?.export_data || false;
    }
    
    get showLiveRefreshToggle() {
        const liveRefreshTabs = ['projects', 'inventory', 'financials'];
        return liveRefreshTabs.includes(this.props.activeTab);
    }
}

