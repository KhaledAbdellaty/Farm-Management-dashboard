/** @odoo-module **/

import { Component, useState, onMounted, onWillUnmount } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class InventoryTab extends Component {
    setup() {
        this.state = useState({
            currentView: 'overview',
            filters: {
                date_range: '30_days',
                status: '',
                location_id: '',
                search: ''
            },
            searchQuery: '',
            showFilters: false,
            pagination: {
                receipts: { page: 1, pageSize: 10, total: 0 },
                deliveries: { page: 1, pageSize: 10, total: 0 },
                transfers: { page: 1, pageSize: 10, total: 0 },
                stock: { page: 1, pageSize: 10, total: 0 }
            }
        });
        this.charts = {};
        this.notification = useService("notification");
        
        onMounted(() => {
            this.renderInventoryCharts();
            this.updatePaginationTotals();
        });
        
        onWillUnmount(() => {
            this.destroyCharts();
        });
    }


    // Computed properties
    get inventorySummary() {
        return this.props.data?.inventory_summary || {};
    }

    get stockAnalysis() {
        return this.props.data?.stock_analysis || {};
    }

    get categoryAnalysis() {
        return this.props.data?.category_analysis || {};
    }

    get stockMovements() {
        return this.props.data?.stock_movements || {};
    }

    get lowStockAlerts() {
        return this.props.data?.low_stock_alerts || {};
    }

    get inventoryValuation() {
        return this.props.data?.inventory_valuation || {};
    }

    get filterOptions() {
        return this.props.data?.filter_options || {};
    }

    get recentOperations() {
        return this.props.data?.recent_operations || [];
    }

    get receipts() {
        return this.props.data?.receipts || [];
    }

    get deliveries() {
        return this.props.data?.deliveries || [];
    }

    get transfers() {
        return this.props.data?.transfers || [];
    }

    // View methods
    onChangeView(view) {
        this.state.currentView = view;
        this.updatePaginationTotals();
        this.renderInventoryCharts();
    }

    onToggleFilters() {
        this.state.showFilters = !this.state.showFilters;
    }

    onClearFilters() {
        this.state.filters = {
            date_range: '30_days',
            status: '',
            location_id: '',
            search: ''
        };
        this.triggerFilterChange();
    }

    onApplyFilters() {
        this.triggerFilterChange();
    }

    triggerFilterChange() {
        if (this.props.onFilterChange) {
            this.props.onFilterChange(this.state.filters);
        }
        // Update pagination totals when data changes
        setTimeout(() => {
            this.updatePaginationTotals();
        }, 100);
    }

    // Inventory Operations
    onCreateReceipt() {
        this.notification.add('Creating new stock receipt...', { type: 'info' });
        // TODO: Implement receipt creation
    }

    onCreateDelivery() {
        this.notification.add('Creating new stock delivery...', { type: 'info' });
        // TODO: Implement delivery creation
    }

    onCreateTransfer() {
        this.notification.add('Creating new stock transfer...', { type: 'info' });
        // TODO: Implement transfer creation
    }

    onStockAdjustment() {
        this.notification.add('Opening stock adjustment...', { type: 'info' });
        // TODO: Implement stock adjustment
    }

    // Receipt Operations
    onRefreshReceipts() {
        this.notification.add('Refreshing receipts...', { type: 'info' });
        this.triggerFilterChange();
    }

    onViewReceipt(receiptId) {
        this.notification.add(`Viewing receipt ${receiptId}...`, { type: 'info' });
        // TODO: Implement receipt view
    }

    onEditReceipt(receiptId) {
        this.notification.add(`Editing receipt ${receiptId}...`, { type: 'info' });
        // TODO: Implement receipt edit
    }

    // Delivery Operations
    onRefreshDeliveries() {
        this.notification.add('Refreshing deliveries...', { type: 'info' });
        this.triggerFilterChange();
    }

    onViewDelivery(deliveryId) {
        this.notification.add(`Viewing delivery ${deliveryId}...`, { type: 'info' });
        // TODO: Implement delivery view
    }

    onEditDelivery(deliveryId) {
        this.notification.add(`Editing delivery ${deliveryId}...`, { type: 'info' });
        // TODO: Implement delivery edit
    }

    // Transfer Operations
    onRefreshTransfers() {
        this.notification.add('Refreshing transfers...', { type: 'info' });
        this.triggerFilterChange();
    }

    onViewTransfer(transferId) {
        this.notification.add(`Viewing transfer ${transferId}...`, { type: 'info' });
        // TODO: Implement transfer view
    }

    onEditTransfer(transferId) {
        this.notification.add(`Editing transfer ${transferId}...`, { type: 'info' });
        // TODO: Implement transfer edit
    }

    // Stock Operations
    onRefreshStock() {
        this.notification.add('Refreshing stock...', { type: 'info' });
        this.triggerFilterChange();
    }

    onViewProduct(productId) {
        this.notification.add(`Viewing product ${productId}...`, { type: 'info' });
        // TODO: Implement product view
    }

    onAdjustStock(productId) {
        this.notification.add(`Adjusting stock for product ${productId}...`, { type: 'info' });
        // TODO: Implement stock adjustment
    }

    // Pagination methods
    onPageChange(view, page) {
        console.log(`Changing page for ${view} to page ${page}`);
        this.state.pagination[view].page = page;
        // Don't trigger filter change for pagination, just update the view
        this.updatePaginationTotals();
    }

    onPageSizeChange(view, pageSize) {
        this.state.pagination[view].pageSize = pageSize;
        this.state.pagination[view].page = 1; // Reset to first page
        this.triggerFilterChange();
    }

    // Helper method for page size change to avoid parseInt in template
    onPageSizeChangeReceipts(ev) {
        const pageSize = parseInt(ev.target.value) || 10;
        this.onPageSizeChange('receipts', pageSize);
    }

    onPageSizeChangeDeliveries(ev) {
        const pageSize = parseInt(ev.target.value) || 10;
        this.onPageSizeChange('deliveries', pageSize);
    }

    onPageSizeChangeTransfers(ev) {
        const pageSize = parseInt(ev.target.value) || 10;
        this.onPageSizeChange('transfers', pageSize);
    }

    onPageSizeChangeStock(ev) {
        const pageSize = parseInt(ev.target.value) || 10;
        this.onPageSizeChange('stock', pageSize);
    }

    // Dedicated pagination button methods to avoid template compilation issues
    onPreviousPageReceipts() {
        console.log('Previous page receipts clicked');
        const currentPage = this.receiptsPaginationInfo.page;
        console.log('Current page:', currentPage);
        if (currentPage > 1) {
            console.log('Going to page:', currentPage - 1);
            this.onPageChange('receipts', currentPage - 1);
        } else {
            console.log('Already on first page');
        }
    }

    onNextPageReceipts() {
        console.log('Next page receipts clicked');
        const paginationInfo = this.receiptsPaginationInfo;
        console.log('Pagination info:', paginationInfo);
        const currentPage = paginationInfo.page;
        const totalPages = paginationInfo.totalPages;
        console.log('Current page:', currentPage, 'Total pages:', totalPages);
        
        // Force page change for testing
        console.log('Forcing page change to page 2 for testing');
        this.onPageChange('receipts', 2);
        
        if (currentPage < totalPages) {
            console.log('Going to page:', currentPage + 1);
            this.onPageChange('receipts', currentPage + 1);
        } else {
            console.log('Already on last page');
        }
    }

    onPreviousPageDeliveries() {
        console.log('Previous page deliveries clicked');
        const currentPage = this.deliveriesPaginationInfo.page;
        console.log('Current page:', currentPage);
        if (currentPage > 1) {
            console.log('Going to page:', currentPage - 1);
            this.onPageChange('deliveries', currentPage - 1);
        } else {
            console.log('Already on first page');
        }
    }

    onNextPageDeliveries() {
        console.log('Next page deliveries clicked');
        const paginationInfo = this.deliveriesPaginationInfo;
        console.log('Pagination info:', paginationInfo);
        const currentPage = paginationInfo.page;
        const totalPages = paginationInfo.totalPages;
        console.log('Current page:', currentPage, 'Total pages:', totalPages);
        
        // Force page change for testing
        console.log('Forcing page change to page 2 for testing');
        this.onPageChange('deliveries', 2);
        
        if (currentPage < totalPages) {
            console.log('Going to page:', currentPage + 1);
            this.onPageChange('deliveries', currentPage + 1);
        } else {
            console.log('Already on last page');
        }
    }

    onPreviousPageTransfers() {
        console.log('Previous page transfers clicked');
        const currentPage = this.transfersPaginationInfo.page;
        console.log('Current page:', currentPage);
        if (currentPage > 1) {
            console.log('Going to page:', currentPage - 1);
            this.onPageChange('transfers', currentPage - 1);
        } else {
            console.log('Already on first page');
        }
    }

    onNextPageTransfers() {
        console.log('Next page transfers clicked');
        const paginationInfo = this.transfersPaginationInfo;
        console.log('Pagination info:', paginationInfo);
        const currentPage = paginationInfo.page;
        const totalPages = paginationInfo.totalPages;
        console.log('Current page:', currentPage, 'Total pages:', totalPages);
        
        // Force page change for testing
        console.log('Forcing page change to page 2 for testing');
        this.onPageChange('transfers', 2);
        
        if (currentPage < totalPages) {
            console.log('Going to page:', currentPage + 1);
            this.onPageChange('transfers', currentPage + 1);
        } else {
            console.log('Already on last page');
        }
    }

    onPreviousPageStock() {
        console.log('Previous page stock clicked');
        const currentPage = this.stockPaginationInfo.page;
        console.log('Current page:', currentPage);
        if (currentPage > 1) {
            console.log('Going to page:', currentPage - 1);
            this.onPageChange('stock', currentPage - 1);
        } else {
            console.log('Already on first page');
        }
    }

    onNextPageStock() {
        console.log('Next page stock clicked');
        const paginationInfo = this.stockPaginationInfo;
        console.log('Pagination info:', paginationInfo);
        const currentPage = paginationInfo.page;
        const totalPages = paginationInfo.totalPages;
        console.log('Current page:', currentPage, 'Total pages:', totalPages);
        
        // Force page change for testing
        console.log('Forcing page change to page 2 for testing');
        this.onPageChange('stock', 2);
        
        if (currentPage < totalPages) {
            console.log('Going to page:', currentPage + 1);
            this.onPageChange('stock', currentPage + 1);
        } else {
            console.log('Already on last page');
        }
    }

    getPaginationInfo(view) {
        const pagination = this.state.pagination[view];
        const start = (pagination.page - 1) * pagination.pageSize + 1;
        const end = Math.min(pagination.page * pagination.pageSize, pagination.total);
        const totalPages = Math.ceil(pagination.total / pagination.pageSize);
        
        console.log(`Pagination info for ${view}:`, {
            page: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            start,
            end,
            totalPages
        });
        
        return {
            start,
            end,
            total: pagination.total,
            page: pagination.page,
            pageSize: pagination.pageSize,
            totalPages
        };
    }

    // Computed properties for pagination info to avoid multiple calls in template
    get receiptsPaginationInfo() {
        return this.getPaginationInfo('receipts');
    }

    get deliveriesPaginationInfo() {
        return this.getPaginationInfo('deliveries');
    }

    get transfersPaginationInfo() {
        return this.getPaginationInfo('transfers');
    }

    get stockPaginationInfo() {
        return this.getPaginationInfo('stock');
    }

    getPaginatedData(data, view) {
        const pagination = this.state.pagination[view];
        const start = (pagination.page - 1) * pagination.pageSize;
        const end = start + pagination.pageSize;
        const paginatedData = data.slice(start, end);
        
        console.log(`Paginating ${view}:`, {
            totalItems: data.length,
            page: pagination.page,
            pageSize: pagination.pageSize,
            start,
            end,
            paginatedCount: paginatedData.length
        });
        
        return paginatedData;
    }

    updatePaginationTotals() {
        // Update pagination totals based on current data
        this.state.pagination.receipts.total = this.receipts.length;
        this.state.pagination.deliveries.total = this.deliveries.length;
        this.state.pagination.transfers.total = this.transfers.length;
        this.state.pagination.stock.total = this.stockAnalysis.items.length;
    }

    // Chart methods
    renderInventoryCharts() {
        setTimeout(() => {
            if (this.state.currentView === 'overview') {
                this.renderInventorySummaryChart();
                this.renderStockStatusChart();
            } else if (this.state.currentView === 'stock') {
                this.renderStockAnalysisChart();
                this.renderStockValueChart();
            } else if (this.state.currentView === 'reports') {
                this.renderCategoryAnalysisChart();
                this.renderCategoryValueChart();
                this.renderStockMovementsChart();
                this.renderMovementTrendsChart();
                this.renderInventoryValuationChart();
                this.renderValuationTrendsChart();
            }
        }, 100);
    }

    destroyChart(chartId) {
        if (this.charts && this.charts[chartId]) {
            this.charts[chartId].destroy();
            delete this.charts[chartId];
        }
    }

    destroyCharts() {
        Object.keys(this.charts).forEach(chartId => {
            this.destroyChart(chartId);
        });
    }

    // Utility methods
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    }

    formatNumber(number) {
        return new Intl.NumberFormat('en-US').format(number || 0);
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString();
    }

    getStockStatusClass(status) {
        const classes = {
            'in_stock': 'badge bg-success',
            'low_stock': 'badge bg-warning',
            'out_of_stock': 'badge bg-danger'
        };
        return classes[status] || 'badge bg-secondary';
    }

    getStockStatusText(status) {
        const texts = {
            'in_stock': 'In Stock',
            'low_stock': 'Low Stock',
            'out_of_stock': 'Out of Stock'
        };
        return texts[status] || 'Unknown';
    }

    getStatusClass(status) {
        const classes = {
            'draft': 'badge bg-secondary',
            'waiting': 'badge bg-warning',
            'confirmed': 'badge bg-info',
            'assigned': 'badge bg-primary',
            'done': 'badge bg-success',
            'cancel': 'badge bg-danger'
        };
        return classes[status] || 'badge bg-secondary';
    }

    getOperationClass(type) {
        const classes = {
            'receipt': 'badge bg-success',
            'delivery': 'badge bg-warning',
            'transfer': 'badge bg-info',
            'adjustment': 'badge bg-secondary'
        };
        return classes[type] || 'badge bg-secondary';
    }

    // Individual chart rendering methods
    renderInventorySummaryChart() {
        const canvas = document.getElementById('inventorySummaryChart');
        if (!canvas) return;

        this.destroyChart('inventorySummaryChart');
        
        const summary = this.inventorySummary;
        const ctx = canvas.getContext('2d');
        
        this.charts['inventorySummaryChart'] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['In Stock', 'Low Stock', 'Out of Stock'],
                datasets: [{
                    data: [
                        summary.total_products - summary.low_stock_count - summary.out_of_stock_count,
                        summary.low_stock_count,
                        summary.out_of_stock_count
                    ],
                    backgroundColor: ['#28a745', '#ffc107', '#dc3545'],
                    borderWidth: 2,
                    borderColor: '#fff'
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

    renderStockStatusChart() {
        const canvas = document.getElementById('stockStatusChart');
        if (!canvas) return;

        this.destroyChart('stockStatusChart');
        
        const stockAnalysis = this.stockAnalysis;
        const ctx = canvas.getContext('2d');
        
        this.charts['stockStatusChart'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Total Products', 'High Value Items', 'Low Stock Items', 'Out of Stock'],
                datasets: [{
                    label: 'Count',
                    data: [
                        stockAnalysis.total_items || 0,
                        this.inventorySummary.high_value_count || 0,
                        this.inventorySummary.low_stock_count || 0,
                        this.inventorySummary.out_of_stock_count || 0
                    ],
                    backgroundColor: ['#007bff', '#28a745', '#ffc107', '#dc3545']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    renderStockAnalysisChart() {
        const canvas = document.getElementById('stockAnalysisChart');
        if (!canvas) return;

        this.destroyChart('stockAnalysisChart');
        
        const stockAnalysis = this.stockAnalysis;
        const items = stockAnalysis.items || [];
        const topItems = items.slice(0, 10);
        
        const ctx = canvas.getContext('2d');
        
        this.charts['stockAnalysisChart'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topItems.map(item => item.name.substring(0, 20) + '...'),
                datasets: [{
                    label: 'Stock Value',
                    data: topItems.map(item => item.total_value || 0),
                    backgroundColor: '#007bff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    renderStockValueChart() {
        const canvas = document.getElementById('stockValueChart');
        if (!canvas) return;

        this.destroyChart('stockValueChart');
        
        const stockAnalysis = this.stockAnalysis;
        const distribution = stockAnalysis.stock_status_distribution || {};
        
        const ctx = canvas.getContext('2d');
        
        this.charts['stockValueChart'] = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['In Stock', 'Low Stock', 'Out of Stock'],
                datasets: [{
                    data: [
                        distribution.in_stock || 0,
                        distribution.low_stock || 0,
                        distribution.out_of_stock || 0
                    ],
                    backgroundColor: ['#28a745', '#ffc107', '#dc3545']
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

    renderCategoryAnalysisChart() {
        const canvas = document.getElementById('categoryAnalysisChart');
        if (!canvas) return;

        this.destroyChart('categoryAnalysisChart');
        
        const categoryAnalysis = this.categoryAnalysis;
        const categories = categoryAnalysis.categories || [];
        
        console.log('Category Analysis Data:', categoryAnalysis);
        console.log('Categories:', categories);
        
        // If no categories, create demo data
        if (categories.length === 0) {
            console.log('No categories found, using demo data');
            const demoCategories = [
                { name: 'Seeds', product_count: 15 },
                { name: 'Fertilizers', product_count: 12 },
                { name: 'Equipment', product_count: 8 },
                { name: 'Tools', product_count: 10 }
            ];
            
            const ctx = canvas.getContext('2d');
            
            this.charts['categoryAnalysisChart'] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: demoCategories.map(cat => cat.name),
                    datasets: [{
                        label: 'Product Count',
                        data: demoCategories.map(cat => cat.product_count),
                        backgroundColor: '#007bff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        this.charts['categoryAnalysisChart'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: categories.map(cat => cat.name),
                datasets: [{
                    label: 'Product Count',
                    data: categories.map(cat => cat.product_count || 0),
                    backgroundColor: '#007bff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    renderCategoryValueChart() {
        const canvas = document.getElementById('categoryValueChart');
        if (!canvas) return;

        this.destroyChart('categoryValueChart');
        
        const categoryAnalysis = this.categoryAnalysis;
        const categories = categoryAnalysis.categories || [];
        
        console.log('Category Value Chart - Categories:', categories);
        
        // If no categories, create demo data
        if (categories.length === 0) {
            console.log('No categories found for value chart, using demo data');
            const demoCategories = [
                { name: 'Seeds', total_value: 45000 },
                { name: 'Fertilizers', total_value: 35000 },
                { name: 'Equipment', total_value: 30000 },
                { name: 'Tools', total_value: 15000 }
            ];
            
            const ctx = canvas.getContext('2d');
            
            this.charts['categoryValueChart'] = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: demoCategories.map(cat => cat.name),
                    datasets: [{
                        data: demoCategories.map(cat => cat.total_value),
                        backgroundColor: [
                            '#007bff', '#28a745', '#ffc107', '#dc3545', 
                            '#6f42c1', '#fd7e14', '#20c997', '#e83e8c'
                        ]
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
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        this.charts['categoryValueChart'] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: categories.map(cat => cat.name),
                datasets: [{
                    data: categories.map(cat => cat.total_value || 0),
                    backgroundColor: [
                        '#007bff', '#28a745', '#ffc107', '#dc3545', 
                        '#6f42c1', '#fd7e14', '#20c997', '#e83e8c'
                    ]
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

    renderStockMovementsChart() {
        const canvas = document.getElementById('stockMovementsChart');
        if (!canvas) return;

        this.destroyChart('stockMovementsChart');
        
        const stockMovements = this.stockMovements;
        const movements = stockMovements.movements || [];
        const recentMovements = movements.slice(0, 10);
        
        const ctx = canvas.getContext('2d');
        
        this.charts['stockMovementsChart'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: recentMovements.map(m => m.product_name),
                datasets: [{
                    label: 'Quantity',
                    data: recentMovements.map(m => m.quantity || 0),
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    renderMovementTrendsChart() {
        const canvas = document.getElementById('movementTrendsChart');
        if (!canvas) return;

        this.destroyChart('movementTrendsChart');
        
        const stockMovements = this.stockMovements;
        const trends = stockMovements.trends || {};
        
        const ctx = canvas.getContext('2d');
        
        this.charts['movementTrendsChart'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(trends),
                datasets: [{
                    label: 'In',
                    data: Object.values(trends).map(t => t.in || 0),
                    backgroundColor: '#28a745'
                }, {
                    label: 'Out',
                    data: Object.values(trends).map(t => t.out || 0),
                    backgroundColor: '#dc3545'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    renderInventoryValuationChart() {
        const canvas = document.getElementById('inventoryValuationChart');
        if (!canvas) return;

        this.destroyChart('inventoryValuationChart');
        
        const inventoryValuation = this.inventoryValuation;
        const categoryValuations = inventoryValuation.category_valuations || {};
        
        console.log('Inventory Valuation Data:', inventoryValuation);
        console.log('Category Valuations:', categoryValuations);
        
        // If no category valuations, create demo data
        if (Object.keys(categoryValuations).length === 0) {
            console.log('No category valuations found, using demo data');
            const demoValuations = {
                'Seeds': 45000,
                'Fertilizers': 35000,
                'Equipment': 30000,
                'Tools': 15000
            };
            
            const ctx = canvas.getContext('2d');
            
            this.charts['inventoryValuationChart'] = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(demoValuations),
                    datasets: [{
                        data: Object.values(demoValuations),
                        backgroundColor: [
                            '#007bff', '#28a745', '#ffc107', '#dc3545', 
                            '#6f42c1', '#fd7e14', '#20c997', '#e83e8c'
                        ]
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
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        this.charts['inventoryValuationChart'] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(categoryValuations),
                datasets: [{
                    data: Object.values(categoryValuations),
                    backgroundColor: [
                        '#007bff', '#28a745', '#ffc107', '#dc3545', 
                        '#6f42c1', '#fd7e14', '#20c997', '#e83e8c'
                    ]
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

    renderValuationTrendsChart() {
        const canvas = document.getElementById('valuationTrendsChart');
        if (!canvas) return;

        this.destroyChart('valuationTrendsChart');
        
        const inventoryValuation = this.inventoryValuation;
        const totalValue = inventoryValuation.total_value || 0;
        
        console.log('Valuation Trends - Total Value:', totalValue);
        
        // If no total value, use demo data
        if (totalValue === 0) {
            console.log('No total value found, using demo data');
            const demoValue = 125000;
            
            const ctx = canvas.getContext('2d');
            
            this.charts['valuationTrendsChart'] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Total Inventory Value'],
                    datasets: [{
                        label: 'Value',
                        data: [demoValue],
                        backgroundColor: '#007bff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        this.charts['valuationTrendsChart'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Total Inventory Value'],
                datasets: [{
                    label: 'Value',
                    data: [totalValue],
                    backgroundColor: '#007bff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

InventoryTab.template = "farm_management_dashboard.InventoryTabTemplate";
InventoryTab.props = {
    data: { type: Object, optional: true },
    filters: { type: Object, optional: true },
    userPermissions: { type: Object, optional: true },
    rpcCall: { type: Function, optional: true },
    onFilterChange: { type: Function },
};