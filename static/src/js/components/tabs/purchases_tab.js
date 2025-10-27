/** @odoo-module **/

import { Component, useState, onMounted, onWillUnmount } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";

export class PurchasesTab extends Component {
    setup() {
        this.state = useState({
            currentView: 'overview',
            showFilters: false,
            selectedSupplier: null,
            selectedProduct: null,
            filters: {
                date_range: '30_days',
                supplier_ids: [],
                product_category_ids: [],
                state: '',
                search: ''
            }
        });

        this.notification = useService("notification");
        
        onMounted(() => {
            this.restoreFiltersFromStorage();
            this.renderPurchaseCharts();
        });

        onWillUnmount(() => {
            this.destroyCharts();
        });
    }

    // Computed properties
    get purchasesSummary() {
        return this.props.data?.purchases_summary || {};
    }

    get supplierAnalysis() {
        return this.props.data?.supplier_analysis || {};
    }

    get productPurchasesAnalysis() {
        return this.props.data?.product_purchases_analysis || {};
    }

    get purchasePipeline() {
        return this.props.data?.purchase_pipeline || {};
    }

    get costAnalysis() {
        return this.props.data?.cost_analysis || {};
    }

    get performanceMetrics() {
        return this.props.data?.performance_metrics || {};
    }

    get filterOptions() {
        return this.props.data?.filter_options || {};
    }

    // Filter methods
    onToggleFilters() {
        this.state.showFilters = !this.state.showFilters;
    }

    onFilterChange(filterType, value) {
        this.state.filters[filterType] = value;
        this.debouncedFilterChange();
    }

    onSearchInputChange(ev) {
        this.state.filters.search = ev.target.value;
    }

    onSearchTrigger() {
        this.triggerFilterChange();
    }

    onSearchKeyPress(ev) {
        if (ev.key === 'Enter') {
            this.onSearchTrigger();
        }
    }

    onClearFilters() {
        this.state.filters = {
            date_range: '30_days',
            supplier_ids: [],
            product_category_ids: [],
            state: '',
            search: ''
        };
        this.triggerFilterChange();
    }

    debouncedFilterChange() {
        clearTimeout(this.filterTimeout);
        this.filterTimeout = setTimeout(() => {
            this.triggerFilterChange();
        }, 500);
    }

    triggerFilterChange() {
        this.saveFiltersToStorage();
        if (this.props.onFilterChange) {
            this.props.onFilterChange(this.state.filters);
        }
    }

    saveFiltersToStorage() {
        try {
            localStorage.setItem('purchases_filters', JSON.stringify(this.state.filters));
        } catch (e) {
            console.warn('Could not save filters to localStorage:', e);
        }
    }

    restoreFiltersFromStorage() {
        try {
            const saved = localStorage.getItem('purchases_filters');
            if (saved) {
                this.state.filters = { ...this.state.filters, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.warn('Could not restore filters from localStorage:', e);
        }
    }

    // View methods
    onChangeView(view) {
        this.state.currentView = view;
        setTimeout(() => {
            this.renderPurchaseCharts();
        }, 100);
    }

    onViewSupplierDetail(supplierId) {
        this.state.selectedSupplier = this.supplierAnalysis.suppliers?.find(s => s.id === supplierId);
    }

    onCloseSupplierDetail() {
        this.state.selectedSupplier = null;
    }

    onViewProductDetail(productId) {
        this.state.selectedProduct = this.productPurchasesAnalysis.products?.find(p => p.id === productId);
    }

    onCloseProductDetail() {
        this.state.selectedProduct = null;
    }

    // Utility methods
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

    formatNumber(num) {
        return new Intl.NumberFormat('en-US').format(num || 0);
    }

    formatPercentage(num) {
        return `${(num || 0).toFixed(1)}%`;
    }

    formatDate(dateString) {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-US');
    }

    getSupplierRatingClass(rating) {
        const classes = {
            'Excellent': 'bg-success',
            'Good': 'bg-primary',
            'Average': 'bg-warning',
            'Poor': 'bg-danger'
        };
        return classes[rating] || 'bg-secondary';
    }

    getStateClass(state) {
        const classes = {
            'draft': 'bg-secondary',
            'sent': 'bg-info',
            'to approve': 'bg-warning',
            'purchase': 'bg-primary',
            'done': 'bg-success',
            'cancel': 'bg-danger'
        };
        return classes[state] || 'bg-secondary';
    }

    getStateLabel(state) {
        const labels = {
            'draft': _t('Draft'),
            'sent': _t('RFQ Sent'),
            'to approve': _t('To Approve'),
            'purchase': _t('Purchase Order'),
            'done': _t('Done'),
            'cancel': _t('Cancelled')
        };
        return labels[state] || state;
    }

    showNotification(message, type = 'info') {
        this.notification.add(message, { type });
    }

    // Chart methods
    renderPurchaseCharts() {
        if (this.state.currentView === 'overview') {
            this.renderPurchaseTrendsChart();
            this.renderStatusDistributionChart();
        } else if (this.state.currentView === 'suppliers') {
            this.renderSupplierAnalysisChart();
            this.renderSupplierPerformanceChart();
        } else if (this.state.currentView === 'products') {
            this.renderProductCategoriesChart();
            this.renderTopProductsChart();
        } else if (this.state.currentView === 'pipeline') {
            this.renderPipelineChart();
        } else if (this.state.currentView === 'cost_analysis') {
            this.renderCostTrendsChart();
            this.renderBudgetAnalysisChart();
        }
    }

    renderPurchaseTrendsChart() {
        const canvas = document.getElementById('purchaseTrendsChart');
        if (!canvas) return;

        this.destroyChart('purchaseTrendsChart');

        const monthlyTrends = this.purchasesSummary.monthly_trends || {};
        const labels = Object.keys(monthlyTrends).sort();
        const orders = labels.map(month => monthlyTrends[month]?.orders || 0);
        const amounts = labels.map(month => monthlyTrends[month]?.amount || 0);

        this.charts = this.charts || {};
        this.charts.purchaseTrendsChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: _t('Orders'),
                    data: orders,
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    yAxisID: 'y'
                }, {
                    label: _t('Amount ($)'),
                    data: amounts,
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                }
            }
        });
    }

    renderStatusDistributionChart() {
        const canvas = document.getElementById('statusDistributionChart');
        if (!canvas) return;

        this.destroyChart('statusDistributionChart');

        const statusDistribution = this.purchasesSummary.status_distribution || {};
        const labels = Object.keys(statusDistribution);
        const data = Object.values(statusDistribution);
        const colors = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6c757d', '#17a2b8'];

        this.charts = this.charts || {};
        this.charts.statusDistributionChart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    renderSupplierAnalysisChart() {
        const canvas = document.getElementById('supplierAnalysisChart');
        if (!canvas) return;

        this.destroyChart('supplierAnalysisChart');

        const suppliers = this.supplierAnalysis.suppliers || [];
        const topSuppliers = suppliers.slice(0, 10);
        const labels = topSuppliers.map(s => s.name);
        const data = topSuppliers.map(s => s.total_amount);

        this.charts = this.charts || {};
        this.charts.supplierAnalysisChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: _t('Total Amount ($)'),
                    data: data,
                    backgroundColor: '#007bff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y'
            }
        });
    }

    renderSupplierPerformanceChart() {
        const canvas = document.getElementById('supplierPerformanceChart');
        if (!canvas) return;

        this.destroyChart('supplierPerformanceChart');

        const supplierSegments = this.supplierAnalysis.supplier_segments || {};
        const labels = Object.keys(supplierSegments);
        const data = Object.values(supplierSegments);
        const colors = ['#28a745', '#007bff', '#ffc107'];

        this.charts = this.charts || {};
        this.charts.supplierPerformanceChart = new Chart(canvas, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    renderProductCategoriesChart() {
        const canvas = document.getElementById('productCategoriesChart');
        if (!canvas) return;

        this.destroyChart('productCategoriesChart');

        const productCategories = this.productPurchasesAnalysis.product_categories || {};
        const labels = Object.keys(productCategories);
        const data = labels.map(cat => productCategories[cat].amount || 0);
        const colors = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6c757d'];

        this.charts = this.charts || {};
        this.charts.productCategoriesChart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    renderTopProductsChart() {
        const canvas = document.getElementById('topProductsChart');
        if (!canvas) return;

        this.destroyChart('topProductsChart');

        const products = this.productPurchasesAnalysis.products || [];
        const topProducts = products.slice(0, 10);
        const labels = topProducts.map(p => p.name);
        const data = topProducts.map(p => p.total_amount);

        this.charts = this.charts || {};
        this.charts.topProductsChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: _t('Total Amount ($)'),
                    data: data,
                    backgroundColor: '#28a745'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y'
            }
        });
    }

    renderPipelineChart() {
        const canvas = document.getElementById('pipelineChart');
        if (!canvas) return;

        this.destroyChart('pipelineChart');

        const pipelineData = this.purchasePipeline.pipeline_data || {};
        const labels = Object.keys(pipelineData);
        const counts = labels.map(stage => pipelineData[stage]?.count || 0);
        const amounts = labels.map(stage => pipelineData[stage]?.amount || 0);

        this.charts = this.charts || {};
        this.charts.pipelineChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: _t('Count'),
                    data: counts,
                    backgroundColor: '#007bff',
                    yAxisID: 'y'
                }, {
                    label: _t('Amount ($)'),
                    data: amounts,
                    backgroundColor: '#28a745',
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                }
            }
        });
    }

    renderCostTrendsChart() {
        const canvas = document.getElementById('costTrendsChart');
        if (!canvas) return;

        this.destroyChart('costTrendsChart');

        const monthlyCosts = this.costAnalysis.monthly_costs || {};
        const labels = Object.keys(monthlyCosts).sort();
        const data = labels.map(month => monthlyCosts[month] || 0);

        this.charts = this.charts || {};
        this.charts.costTrendsChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: _t('Monthly Costs ($)'),
                    data: data,
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    renderBudgetAnalysisChart() {
        const canvas = document.getElementById('budgetAnalysisChart');
        if (!canvas) return;

        this.destroyChart('budgetAnalysisChart');

        const totalSpent = this.costAnalysis.total_spent || 0;
        const budgetTarget = this.costAnalysis.budget_target || 0;
        const remaining = budgetTarget - totalSpent;

        this.charts = this.charts || {};
        this.charts.budgetAnalysisChart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: [_t('Spent'), _t('Remaining')],
                datasets: [{
                    data: [totalSpent, remaining > 0 ? remaining : 0],
                    backgroundColor: ['#dc3545', '#28a745']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 1,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    destroyChart(chartId) {
        if (this.charts && this.charts[chartId]) {
            this.charts[chartId].destroy();
            delete this.charts[chartId];
        }
    }

    destroyCharts() {
        if (this.charts) {
            Object.values(this.charts).forEach(chart => chart.destroy());
            this.charts = {};
        }
    }
}

PurchasesTab.template = "farm_management_dashboard.PurchasesTabTemplate";
PurchasesTab.props = {
    data: { type: Object, optional: true },
    onFilterChange: { type: Function, optional: true },
    rpcCall: { type: Function, optional: true }
};