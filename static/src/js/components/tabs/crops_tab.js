/** @odoo-module **/

import { Component, useState, onMounted, onWillUnmount } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { SmartButton } from "../common/smart_button";

export class CropsTab extends Component {
    static template = "farm_management_dashboard.CropsTabTemplate";
    static components = {
        SmartButton,
    };
    static props = {
        data: Object,
        filters: Object,
        userPermissions: Object,
        onFiltersChange: Function,
        rpcCall: { type: Function, optional: true },
    };
    
    setup() {
        this.state = useState({
            selectedCrop: null,
            selectedView: 'cards', // 'cards', 'table', 'performance'
            showFilters: false,
            showCropDetail: false,
            showCreateCrop: false,
            filters: {
                search: '',
                crop_id: '',
                season: '',
                sort_by: 'total_area',
                sort_order: 'desc'
            },
            newCrop: {
                name: '',
                code: '',
                growing_cycle: 90,
                uom_id: '',
                notes: ''
            },
            validationErrors: {}
        });
        
        this.notification = useService("notification");
        this.charts = {};
        
        onMounted(() => {
            this.restoreFiltersFromStorage();
            this.renderPerformanceCharts();
        });
        
        onWillUnmount(() => {
            this.destroyCharts();
        });
    }
    
    // ===== COMPUTED PROPERTIES =====
    
    get crops() {
        if (!this.props.data.crops) return [];
        
        let crops = [...this.props.data.crops];
        
        // Apply search filter
        if (this.state.filters.search) {
            const search = this.state.filters.search.toLowerCase();
            crops = crops.filter(crop => 
                crop.name.toLowerCase().includes(search) ||
                crop.code.toLowerCase().includes(search)
            );
        }
        
        // Apply crop filter
        if (this.state.filters.crop_id) {
            crops = crops.filter(crop => crop.id == this.state.filters.crop_id);
        }
        
        // Apply sorting
        const sortBy = this.state.filters.sort_by;
        const sortOrder = this.state.filters.sort_order;
        
        crops.sort((a, b) => {
            let aVal = a[sortBy] || 0;
            let bVal = b[sortBy] || 0;
            
            if (typeof aVal === 'string') {
                return sortOrder === 'asc' ? 
                    aVal.localeCompare(bVal) : 
                    bVal.localeCompare(aVal);
            }
            
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        });
        
        return crops;
    }
    
    get summary() {
        return this.props.data.summary || {};
    }
    
    get availableFilters() {
        return this.props.data.available_filters || {};
    }
    
    get harvestSchedule() {
        return this.props.data.harvest_schedule || {};
    }
    
    get yieldAnalysis() {
        return this.props.data.yield_analysis || {};
    }
    
    // Quick Actions for Crops Tab
    get quickActions() {
        console.log('🔧 Generating quick actions for crops tab');
        const actions = [
            { icon: 'fa-plus-circle', label: 'New Crop', type: 'primary', size: 'sm', action: 'farm.crop', permission: 'can_create_crops' },
            { icon: 'fa-seedling', label: 'Active Crops', type: 'success', size: 'sm', action: 'farm.crop', permission: 'can_view_details' },
            { icon: 'fa-clipboard-list', label: 'Crop BOMs', type: 'primary', size: 'sm', action: 'farm.crop.bom', permission: 'can_view_details' },
           
        ];
        console.log('🔧 Generated quick actions:', actions);
        return actions;
    }

    get smartActions() {
        const actions = [];
        
        // Add smart actions based on crop data
        if (this.props.data?.crops) {
            const crops = this.props.data.crops;
            
            // Check for high-yield crops
            const highYieldCrops = crops.filter(crop => crop.average_yield > 100);
            if (highYieldCrops.length > 0) {
                actions.push({
                    icon: 'fa-trophy',
                    label: 'High Yield Crops',
                    type: 'success',
                    size: 'sm',
                    action: 'farm.crop',
                    permission: 'can_view_details',
                    filterInfo: {
                        domain: [['average_yield', '>', 100]],
                        context: { 'search_default_high_yield': 1 }
                    }
                });
            }
            
            // Check for seasonal crops
            const seasonalCrops = crops.filter(crop => crop.season);
            if (seasonalCrops.length > 0) {
                actions.push({
                    icon: 'fa-leaf',
                    label: 'Seasonal Crops',
                    type: 'info',
                    size: 'sm',
                    action: 'farm.crop',
                    permission: 'can_view_details',
                    filterInfo: {
                        domain: [['season', '!=', false]],
                        context: { 'search_default_seasonal': 1 }
                    }
                });
            }
            
            // Check for crops needing attention
            const attentionCrops = crops.filter(crop => crop.health_status === 'warning' || crop.health_status === 'critical');
            if (attentionCrops.length > 0) {
                actions.push({
                    icon: 'fa-exclamation-triangle',
                    label: 'Crops Needing Attention',
                    type: 'warning',
                    size: 'sm',
                    action: 'farm.crop',
                    permission: 'can_view_details',
                    filterInfo: {
                        domain: [['health_status', 'in', ['warning', 'critical']]],
                        context: { 'search_default_attention': 1 }
                    }
                });
            }
        }
        
        console.log('🔧 Generated smart actions:', actions);
        return actions;
    }
    
    // ===== FILTER METHODS =====
    
    onToggleFilters() {
        this.state.showFilters = !this.state.showFilters;
    }
    
    onFilterChange(field, value) {
        this.state.filters[field] = value;
        this.saveFiltersToStorage();
        this.debouncedFilterChange();
    }
    
    onSearchInputChange(ev) {
        this.state.filters.search = ev.target.value;
        this.saveFiltersToStorage();
    }
    
    onSearchTrigger() {
        this.triggerFilterChange();
    }
    
    onSearchKeyPress(ev) {
        if (ev.key === 'Enter') {
            this.triggerFilterChange();
        }
    }
    
    onClearFilters() {
        this.state.filters = {
            search: '',
            crop_id: '',
            season: '',
            sort_by: 'total_area',
            sort_order: 'desc'
        };
        this.saveFiltersToStorage();
        this.triggerFilterChange();
    }
    
    debouncedFilterChange() {
        clearTimeout(this.filterTimeout);
        this.filterTimeout = setTimeout(() => {
            this.triggerFilterChange();
        }, 300);
    }
    
    triggerFilterChange() {
        if (this.props.onFiltersChange) {
            this.props.onFiltersChange(this.state.filters);
        }
    }
    
    saveFiltersToStorage() {
        const storageKey = 'farm_dashboard_crops_filters';
        try {
            localStorage.setItem(storageKey, JSON.stringify(this.state.filters));
        } catch (e) {
            console.warn('Could not save filters to localStorage:', e);
        }
    }
    
    restoreFiltersFromStorage() {
        const storageKey = 'farm_dashboard_crops_filters';
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const filters = JSON.parse(saved);
                Object.assign(this.state.filters, filters);
            }
        } catch (e) {
            console.warn('Could not restore filters from localStorage:', e);
        }
    }
    
    // ===== VIEW METHODS =====
    
    onChangeView(view) {
        this.state.selectedView = view;
        if (view === 'performance') {
            setTimeout(() => this.renderPerformanceCharts(), 100);
        }
    }
    
    onViewCropDetail(crop) {
        this.state.selectedCrop = crop;
        this.state.showCropDetail = true;
    }
    
    onCloseCropDetail() {
        this.state.selectedCrop = null;
        this.state.showCropDetail = false;
    }
    
    // ===== CHART METHODS =====
    
    renderPerformanceCharts() {
        if (!this.props.data.crop_performance) return;
        
        setTimeout(() => {
            this.renderProfitabilityChart();
            this.renderEfficiencyChart();
        }, 100);
    }
    
    renderProfitabilityChart() {
        const chartData = this.props.data.crop_performance.performance_chart;
        if (!chartData || !chartData.labels || chartData.labels.length === 0) return;
        
        const canvas = document.getElementById('cropProfitabilityChart');
        if (!canvas) return;
        
        // Destroy existing chart
        if (this.charts.profitability) {
            this.charts.profitability.destroy();
        }
        
        const ctx = canvas.getContext('2d');
        this.charts.profitability = new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Crop Profitability Analysis'
                    },
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Amount per Area'
                        }
                    }
                }
            }
        });
    }
    
    renderEfficiencyChart() {
        const chartData = this.props.data.crop_performance.efficiency_chart;
        if (!chartData || !chartData.labels || chartData.labels.length === 0) return;
        
        const canvas = document.getElementById('cropEfficiencyChart');
        if (!canvas) return;
        
        // Destroy existing chart
        if (this.charts.efficiency) {
            this.charts.efficiency.destroy();
        }
        
        const ctx = canvas.getContext('2d');
        this.charts.efficiency = new Chart(ctx, {
            type: 'doughnut',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Yield Efficiency by Crop'
                    },
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
    }
    
    destroyCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};
    }
    
    // ===== UTILITY METHODS =====
    
   // Formatting methods
    formatCurrency(amount) {  
        // Get currency settings from data if available
        const currencyData = this.props.data?.currency_data || {
            currency: 'USD',
            locale: 'en-US',
            symbol: '$',
            position: 'before',
            decimal_places: 2
        };
        
        // Convert locale from en_US format to en-US format for Intl API
        const locale = currencyData.locale ? currencyData.locale.replace('_', '-') : 'en-US';
        
        // Format with the appropriate number of decimal places
        const formattedAmount = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currencyData.name || currencyData.currency || 'USD',
            minimumFractionDigits: currencyData.decimal_places || 2,
            maximumFractionDigits: currencyData.decimal_places || 2
        }).format(amount || 0);
        
        // If position is 'after', move the currency symbol
        if (currencyData.position === 'after') {
            // Remove the currency symbol from the beginning and add it to the end
            return formattedAmount.replace(currencyData.symbol, '') + ' ' + currencyData.symbol;
        }
        
        return formattedAmount;
    }
    
    formatNumber(number, decimals = 2) {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        }).format(number || 0);
    }
    
    formatPercentage(value) {
        return `${this.formatNumber(value, 1)}%`;
    }
    
    getStateColor(state) {
        const colors = {
            'draft': 'secondary',
            'preparation': 'info',
            'sowing': 'primary',
            'growing': 'warning',
            'harvest': 'success',
            'sales': 'success',
            'done': 'success',
            'cancel': 'danger'
        };
        return colors[state] || 'secondary';
    }
    
    getStateName(state) {
        const names = {
            'draft': 'Planning',
            'preparation': 'Field Preparation', 
            'sowing': 'Planting/Sowing',
            'growing': 'Growing',
            'harvest': 'Harvest',
            'sales': 'Sales',
            'done': 'Completed',
            'cancel': 'Cancelled'
        };
        return names[state] || state;
    }
    
    getPriorityClass(priority) {
        const classes = {
            'overdue': 'text-danger fw-bold',
            'urgent': 'text-warning fw-bold',
            'upcoming': 'text-info'
        };
        return classes[priority] || '';
    }
    
    showNotification(message, type = 'info') {
        if (this.notification) {
            this.notification.add(message, { type, sticky: false });
        }
    }
}
