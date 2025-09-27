/** @odoo-module **/

import { Component, onMounted, onWillUnmount } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { SmartButton } from "../common/smart_button";

export class OverviewTab extends Component {
    static template = "farm_management_dashboard.OverviewTabTemplate";
    static components = {
        SmartButton,
    };
    static props = {
        data: Object,
        filters: Object,
        userPermissions: Object,
        onFiltersChange: Function,
    };

    setup() {
        this.charts = {};
        
        onMounted(() => {
            // Small delay to ensure DOM is ready
            setTimeout(() => this.renderCharts(), 100);
        });

        onWillUnmount(() => {
            this.destroyCharts();
        });
    }
    
    get kpis() {
        return this.props.data.kpis || {};
    }
    
    get recentActivities() {
        return this.props.data.recent_activities || [];
    }
    
    get alerts() {
        return this.props.data.alerts || [];
    }
    
    get chartData() {
        return this.props.data.charts || {};
    }
    
    get userRole() {
        return this.props.userPermissions?.role || 'user';
    }
    
    get canViewFinancials() {
        return this.props.userPermissions?.permissions?.view_profits || false;
    }
    
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
    
    formatNumber(number) {
        return new Intl.NumberFormat('en-US').format(number || 0);
    }
    
    formatDate(dateString) {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString();
    }
    
    formatDateTime(dateTimeString) {
        if (!dateTimeString) return '';
        return new Date(dateTimeString).toLocaleString();
    }
    
    getKpiTrendClass(value) {
        if (value > 0) return 'text-success';
        if (value < 0) return 'text-danger';
        return 'text-muted';
    }
    
    getKpiTrendIcon(value) {
        if (value > 0) return 'fa-arrow-up';
        if (value < 0) return 'fa-arrow-down';
        return 'fa-minus';
    }
    
    getAlertClass(type) {
        const alertClasses = {
            'success': 'alert-success',
            'info': 'alert-info',
            'warning': 'alert-warning',
            'danger': 'alert-danger',
        };
        return alertClasses[type] || 'alert-info';
    }
    
    getAlertIcon(type) {
        const alertIcons = {
            'success': 'fa-check-circle',
            'info': 'fa-info-circle',
            'warning': 'fa-exclamation-triangle',
            'danger': 'fa-times-circle',
        };
        return alertIcons[type] || 'fa-info-circle';
    }

    // Chart rendering methods
    renderCharts() {
        console.log('📊 Rendering charts with data:', this.chartData);
        
        if (!window.Chart) {
            console.error('❌ Chart.js not loaded');
            return;
        }

        // Destroy existing charts first
        this.destroyCharts();

        // Projects by Stage Chart
        if (this.chartData.projects_by_stage && this.chartData.projects_by_stage.labels?.length > 0) {
            this.renderProjectsStageChart();
        } else {
            console.warn('⚠️ No projects by stage data available');
        }

        // Cost Trends Chart
        if (this.chartData.cost_trends && this.chartData.cost_trends.labels?.length > 0) {
            this.renderCostTrendsChart();
        } else {
            console.warn('⚠️ No cost trends data available');
        }
    }

    renderProjectsStageChart() {
        const canvas = document.getElementById('projectsStageChart');
        if (!canvas) {
            console.warn('❌ Canvas not found for projects stage chart');
            return;
        }

        const data = this.chartData.projects_by_stage;
        console.log('📊 Projects Stage Chart Data:', data);

        try {
            this.charts.projectsStage = new Chart(canvas, {
                type: 'doughnut',
                data: {
                    labels: data.labels || [],
                    datasets: [{
                        data: data.data || [],
                        backgroundColor: data.colors || ['#28a745', '#ffc107', '#17a2b8', '#6f42c1', '#fd7e14', '#20c997', '#6c757d'],
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed || 0;
                                    return `${label}: ${value} project${value !== 1 ? 's' : ''}`;
                                }
                            }
                        }
                    }
                }
            });
            console.log('✅ Projects Stage Chart rendered successfully');
        } catch (error) {
            console.error('❌ Error rendering projects stage chart:', error);
        }
    }

    renderCostTrendsChart() {
        const canvas = document.getElementById('costTrendsChart');
        if (!canvas) {
            console.warn('❌ Canvas not found for cost trends chart');
            return;
        }

        const data = this.chartData.cost_trends;
        console.log('📊 Cost Trends Chart Data:', data);

        try {
            this.charts.costTrends = new Chart(canvas, {
                type: 'line',
                data: {
                    labels: data.labels || [],
                    datasets: data.datasets || []
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '$' + value.toLocaleString();
                                }
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    }
                }
            });
            console.log('✅ Cost Trends Chart rendered successfully');
        } catch (error) {
            console.error('❌ Error rendering cost trends chart:', error);
        }
    }

    destroyCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                try {
                    chart.destroy();
                } catch (error) {
                    console.warn('Warning destroying chart:', error);
                }
            }
        });
        this.charts = {};
    }
    
    // Quick Actions for Overview Tab
    get quickActions() {
        console.log('🔧 Generating quick actions for overview tab');
        const actions = [
            // Farm Management Navigation
            {
                icon: 'fa-home',
                label: 'Manage Farms',
                type: 'primary',
                size: 'sm',
                action: 'farm.farm'
            },
            {
                icon: 'fa-map',
                label: 'Manage Fields',
                type: 'secondary',
                size: 'sm',
                action: 'farm.field'
            },
            
            // Cultivation Operations
            {
                icon: 'fa-project-diagram',
                label: 'Active Projects',
                type: 'success',
                size: 'sm',
                action: 'farm.cultivation.project'
            },
            {
                icon: 'fa-clipboard-list',
                label: "Today's Reports",
                type: 'warning',
                size: 'sm',
                action: 'farm.daily.report'
            },
            
            // Quick Create Actions
            {
                icon: 'fa-plus-circle',
                label: 'New Farm',
                type: 'primary',
                size: 'sm',
                action: 'farm.farm'
            },
            {
                icon: 'fa-plus-circle',
                label: 'New Project',
                type: 'success',
                size: 'sm',
                action: 'farm.cultivation.project'
            },
            {
                icon: 'fa-plus-circle',
                label: 'New Daily Report',
                type: 'warning',
                size: 'sm',
                action: 'farm.daily.report'
            }
        ];
        console.log('🔧 Generated quick actions:', actions);
        return actions;
    }
    
    // Smart Actions based on data context
    get smartActions() {
        const actions = [];
        
        // Low Stock Alerts
        if (this.props.data?.low_stock_items?.length > 0) {
            actions.push({
                icon: 'fa-exclamation-triangle',
                label: 'Low Stock Alerts',
                type: 'danger',
                size: 'sm',
                badge: this.props.data.low_stock_items.length,
                action: 'stock.quant'
            });
        }
        
        // Overdue Projects
        if (this.props.data?.overdue_projects?.length > 0) {
            actions.push({
                icon: 'fa-clock',
                label: 'Overdue Projects',
                type: 'warning',
                size: 'sm',
                badge: this.props.data.overdue_projects.length,
                action: 'farm.cultivation.project'
            });
        }
        
        return actions;
    }
}