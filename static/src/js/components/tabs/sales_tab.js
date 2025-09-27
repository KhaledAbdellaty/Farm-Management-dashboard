/** @odoo-module **/

import { Component, useState, onMounted, onWillUnmount } from "@odoo/owl";

export class SalesTab extends Component {
    static template = "farm_management_dashboard.SalesTabTemplate";
    
    setup() {
        this.state = useState({
            selectedView: 'overview',
            showFilters: false,
            selectedCustomer: null,
            selectedOrder: null,
            isLoading: false,
            error: null,
        });
        
        // Initialize charts container
        this.charts = {};
        
        // Bind methods
        this.onChangeView = this.onChangeView.bind(this);
        this.onToggleFilters = this.onToggleFilters.bind(this);
        this.onViewCustomer = this.onViewCustomer.bind(this);
        this.onCloseCustomerDetail = this.onCloseCustomerDetail.bind(this);
        this.onViewOrder = this.onViewOrder.bind(this);
        this.onCloseOrderDetail = this.onCloseOrderDetail.bind(this);
        
        onMounted(() => {
            this.renderSalesCharts();
        });
        
        onWillUnmount(() => {
            this.destroyCharts();
        });
    }
    
    // Computed properties
    get salesSummary() {
        return this.props.data?.sales_summary || {};
    }
    
    get customerAnalysis() {
        return this.props.data?.customer_analysis || {};
    }
    
    get productAnalysis() {
        return this.props.data?.product_analysis || {};
    }
    
    get salesPipeline() {
        return this.props.data?.sales_pipeline || {};
    }
    
    get harvestSales() {
        return this.props.data?.harvest_sales || {};
    }
    
    get salesPerformance() {
        return this.props.data?.sales_performance || {};
    }
    
    get filterOptions() {
        return this.props.data?.filter_options || {};
    }
    
    // View management methods
    onChangeView(view) {
        this.state.selectedView = view;
        setTimeout(() => {
            this.renderSalesCharts();
        }, 100);
    }
    
    onToggleFilters() {
        this.state.showFilters = !this.state.showFilters;
    }
    
    onViewCustomer(customerId) {
        const customer = this.customerAnalysis.customers?.find(c => c.id === customerId);
        this.state.selectedCustomer = customer;
    }
    
    onCloseCustomerDetail() {
        this.state.selectedCustomer = null;
    }
    
    onViewOrder(orderId) {
        let selectedOrder = null;
        Object.values(this.salesPipeline.pipeline_stages || {}).forEach(stage => {
            const order = stage.orders?.find(o => o.id === orderId);
            if (order) {
                selectedOrder = order;
            }
        });
        this.state.selectedOrder = selectedOrder;
    }
    
    onCloseOrderDetail() {
        this.state.selectedOrder = null;
    }
    
    // Chart rendering methods
    renderSalesCharts() {
        this.destroyCharts();
        
        if (this.state.selectedView === 'overview') {
            this.renderRevenueChart();
            this.renderOrderStatusChart();
        } else if (this.state.selectedView === 'customers') {
            this.renderCustomerSegmentChart();
        } else if (this.state.selectedView === 'products') {
            this.renderProductCategoryChart();
        } else if (this.state.selectedView === 'pipeline') {
            this.renderPipelineChart();
        } else if (this.state.selectedView === 'harvest') {
            this.renderHarvestRevenueChart();
        }
    }
    
    renderRevenueChart() {
        const canvas = document.getElementById('revenueChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const trends = this.salesSummary.monthly_trends || {};
        const labels = Object.keys(trends).sort();
        const revenueData = labels.map(month => trends[month]?.revenue || 0);
        
        this.charts.revenue = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue ($)',
                    data: revenueData,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }
    
    renderOrderStatusChart() {
        const canvas = document.getElementById('orderStatusChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const statusData = this.salesSummary.status_distribution || {};
        
        this.charts.orderStatus = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(statusData),
                datasets: [{
                    data: Object.values(statusData),
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom' },
                    title: { display: true, text: 'Order Status Distribution' }
                }
            }
        });
    }
    
    renderCustomerSegmentChart() {
        const canvas = document.getElementById('customerSegmentChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const segments = this.customerAnalysis.customer_segments || {};
        
        this.charts.customerSegment = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(segments),
                datasets: [{
                    data: Object.values(segments),
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom' },
                    title: { display: true, text: 'Customer Segments' }
                }
            }
        });
    }
    
    renderProductCategoryChart() {
        const canvas = document.getElementById('productCategoryChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const categories = this.productAnalysis.product_categories || {};
        const labels = Object.keys(categories);
        const revenueData = labels.map(cat => categories[cat].total_revenue);
        
        this.charts.productCategory = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue ($)',
                    data: revenueData,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }
    
    renderPipelineChart() {
        const canvas = document.getElementById('pipelineChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const stages = this.salesPipeline.pipeline_stages || {};
        const labels = Object.keys(stages);
        const countData = labels.map(stage => stages[stage].count || 0);
        
        this.charts.pipeline = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Count',
                    data: countData,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true } }
            }
        });
    }
    
    renderHarvestRevenueChart() {
        const canvas = document.getElementById('harvestRevenueChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const harvests = this.harvestSales.harvest_sales || [];
        const labels = harvests.map(h => h.crop_name);
        const revenueData = harvests.map(h => h.total_sales);
        
        this.charts.harvestRevenue = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue ($)',
                    data: revenueData,
                    backgroundColor: 'rgba(76, 175, 80, 0.6)',
                    borderColor: 'rgba(76, 175, 80, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }
    
    destroyCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts = {};
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
        if (typeof num !== 'number') return '0';
        return new Intl.NumberFormat('en-US').format(num);
    }
    
    formatPercentage(num) {
        if (typeof num !== 'number') return '0%';
        return num.toFixed(1) + '%';
    }
    
    formatDate(dateString) {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString();
    }
    
    getCustomerTypeClass(type) {
        const classes = {
            'VIP': 'bg-danger',
            'Premium': 'bg-warning',
            'Regular': 'bg-secondary'
        };
        return classes[type] || 'bg-secondary';
    }
    
    getOrderStatusClass(status) {
        const classes = {
            'draft': 'bg-secondary',
            'sent': 'bg-info',
            'sale': 'bg-success',
            'done': 'bg-primary',
            'cancel': 'bg-danger'
        };
        return classes[status] || 'bg-secondary';
    }
    
    getGrowthClass(growth) {
        if (growth > 0) return 'text-success';
        if (growth < 0) return 'text-danger';
        return 'text-muted';
    }
    
    getGrowthIcon(growth) {
        if (growth > 0) return 'fa-arrow-up';
        if (growth < 0) return 'fa-arrow-down';
        return 'fa-minus';
    }
}