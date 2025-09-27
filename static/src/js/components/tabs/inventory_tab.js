/** @odoo-module **/

import { Component, useState, onMounted, onWillUnmount } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { SmartButton } from "../common/smart_button";

export class InventoryTab extends Component {
    static template = "farm_management_dashboard.InventoryTabTemplate";
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
        
        // Local permission override system
        this.localPermissions = null;
        this.useLocalPermissions = false;
        
        onMounted(() => {
            this.renderInventoryCharts();
            this.updatePaginationTotals();
            // Check if dashboard main has already set real user permissions
            this.checkDashboardPermissions();
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
    
    // Quick Actions for Inventory Tab
    get quickActions() {
        console.log('🔧 Generating quick actions for inventory tab');
        const actions = [
            { icon: 'fa-plus-circle', label: 'New Product', type: 'primary', size: 'sm', action: 'product.product', permission: 'can_create_products' },
            { icon: 'fa-boxes', label: 'Stock Operations', type: 'success', size: 'sm', action: 'stock.picking', permission: 'can_access_inventory' },
            { icon: 'fa-warehouse', label: 'Warehouse Management', type: 'primary', size: 'sm', action: 'stock.warehouse', permission: 'can_access_inventory' },
            { icon: 'fa-chart-bar', label: 'Inventory Reports', type: 'secondary', size: 'sm', action: 'stock.quant', permission: 'can_view_details' },
            { icon: 'fa-exclamation-triangle', label: 'Low Stock Alerts', type: 'warning', size: 'sm', action: 'stock.quant', permission: 'can_view_details' }
        ];
        console.log('🔧 Generated quick actions:', actions);
        return actions;
    }

    get smartActions() {
        const actions = [];
        
        // Add smart actions based on inventory data
        if (this.props.data?.low_stock_alerts && Array.isArray(this.props.data.low_stock_alerts)) {
            const lowStockItems = this.props.data.low_stock_alerts;
            if (lowStockItems.length > 0) {
                actions.push({
                    icon: 'fa-exclamation-triangle',
                    label: 'Low Stock Items',
                    type: 'warning',
                    size: 'sm',
                    action: 'stock.quant',
                    permission: 'can_view_details',
                    filterInfo: {
                        domain: [['quantity', '<', 10]],
                        context: { 'search_default_low_stock': 1 }
                    }
                });
            }
        }
        
        // Check for high-value inventory
        if (this.props.data?.inventory_valuation && Array.isArray(this.props.data.inventory_valuation)) {
            const highValueItems = this.props.data.inventory_valuation.filter(item => item.value > 1000);
            if (highValueItems.length > 0) {
                actions.push({
                    icon: 'fa-dollar-sign',
                    label: 'High Value Items',
                    type: 'success',
                    size: 'sm',
                    action: 'stock.quant',
                    permission: 'can_view_details',
                    filterInfo: {
                        domain: [['value', '>', 1000]],
                        context: { 'search_default_high_value': 1 }
                    }
                });
            }
        }
        
        // Check for recent stock movements
        if (this.props.data?.recent_operations && Array.isArray(this.props.data.recent_operations)) {
            const recentMovements = this.props.data.recent_operations;
            if (recentMovements.length > 0) {
                actions.push({
                    icon: 'fa-exchange-alt',
                    label: 'Recent Movements',
                    type: 'info',
                    size: 'sm',
                    action: 'stock.move',
                    permission: 'can_view_details',
                    filterInfo: {
                        domain: [['date', '>=', new Date().toISOString().split('T')[0]]],
                        context: { 'search_default_recent': 1 }
                    }
                });
            }
        }
        
        console.log('🔧 Generated smart actions:', actions);
        return actions;
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

    // Permission checks
    canCreateReceipt() {
        // If no userPermissions object, assume full permissions for testing
        if (!this.props.userPermissions) {
            return true;
        }
        
        // Check if user is demo_user - give full permissions for demo
        if (this.props.userPermissions.role === 'demo_user') {
            return true;
        }
        
        return this.props.userPermissions?.can_create_receipts || 
               this.props.userPermissions?.is_manager || 
               this.props.userPermissions?.is_admin ||
               this.props.userPermissions?.can_access_inventory ||
               this.props.userPermissions?.permissions?.can_create_receipts;
    }

    canCreateDelivery() {
        // If no userPermissions object, assume full permissions for testing
        if (!this.props.userPermissions) {
            return true;
        }
        
        // Check if user is demo_user - give full permissions for demo
        if (this.props.userPermissions.role === 'demo_user') {
            return true;
        }
        
        return this.props.userPermissions?.can_create_deliveries || 
               this.props.userPermissions?.is_manager || 
               this.props.userPermissions?.is_admin ||
               this.props.userPermissions?.can_access_inventory ||
               this.props.userPermissions?.permissions?.can_create_deliveries;
    }

    canCreateTransfer() {
        // If no userPermissions object, assume full permissions for testing
        if (!this.props.userPermissions) {
            return true;
        }
        
        // Check if user is demo_user - give full permissions for demo
        if (this.props.userPermissions.role === 'demo_user') {
            return true;
        }
        
        return this.props.userPermissions?.can_create_transfers || 
               this.props.userPermissions?.is_manager || 
               this.props.userPermissions?.is_admin ||
               this.props.userPermissions?.can_access_inventory ||
               this.props.userPermissions?.permissions?.can_create_transfers;
    }

    canAdjustStock() {
        // If no userPermissions object, assume full permissions for testing
        if (!this.props.userPermissions) {
            return true;
        }
        
        // Check if user is demo_user - give full permissions for demo
        if (this.props.userPermissions.role === 'demo_user') {
            return true;
        }
        
        return this.props.userPermissions?.can_adjust_stock || 
               this.props.userPermissions?.is_manager || 
               this.props.userPermissions?.is_admin ||
               this.props.userPermissions?.can_access_inventory ||
               this.props.userPermissions?.permissions?.can_adjust_stock;
    }

    canEditReceipt() {
        // If no userPermissions object, assume full permissions for testing
        if (!this.props.userPermissions) {
            return true;
        }
        
        // Check if user is demo_user - give full permissions for demo
        if (this.props.userPermissions.role === 'demo_user') {
            return true;
        }
        
        return this.props.userPermissions?.can_edit_receipts || 
               this.props.userPermissions?.is_manager || 
               this.props.userPermissions?.is_admin ||
               this.props.userPermissions?.can_access_inventory ||
               this.props.userPermissions?.permissions?.can_edit_receipts;
    }

    canEditDelivery() {
        // If no userPermissions object, assume full permissions for testing
        if (!this.props.userPermissions) {
            return true;
        }
        
        // Check if user is demo_user - give full permissions for demo
        if (this.props.userPermissions.role === 'demo_user') {
            return true;
        }
        
        return this.props.userPermissions?.can_edit_deliveries || 
               this.props.userPermissions?.is_manager || 
               this.props.userPermissions?.is_admin ||
               this.props.userPermissions?.can_access_inventory ||
               this.props.userPermissions?.permissions?.can_edit_deliveries;
    }

    canEditTransfer() {
        // If no userPermissions object, assume full permissions for testing
        if (!this.props.userPermissions) {
            return true;
        }
        
        // Check if user is demo_user - give full permissions for demo
        if (this.props.userPermissions.role === 'demo_user') {
            return true;
        }
        
        return this.props.userPermissions?.can_edit_transfers || 
               this.props.userPermissions?.is_manager || 
               this.props.userPermissions?.is_admin ||
               this.props.userPermissions?.can_access_inventory ||
               this.props.userPermissions?.permissions?.can_edit_transfers;
    }

    canViewDetails() {
        // Use local permissions if available
        if (this.useLocalPermissions && this.localPermissions) {
            console.log('Using local permissions for canViewDetails');
            return this.localPermissions.permissions?.can_view_details || true;
        }
        
        // Debug permission check
        console.log('Permission check - userPermissions:', this.props.userPermissions);
        console.log('Permission check - can_view_details:', this.props.userPermissions?.can_view_details);
        
        // If no userPermissions object, assume full permissions for testing
        if (!this.props.userPermissions) {
            console.log('No userPermissions found, assuming full permissions for testing');
            return true;
        }
        
        // Check if user is demo_user - give full permissions for demo
        if (this.props.userPermissions.role === 'demo_user') {
            console.log('Demo user detected - granting full permissions for testing');
            return true;
        }
        
        // Check if user is real_user - use real permissions
        if (this.props.userPermissions.role === 'real_user') {
            console.log('Real user detected - using real permissions');
            const hasPermission = this.props.userPermissions?.permissions?.can_view_details ||
                                 this.props.userPermissions?.permissions?.is_manager ||
                                 this.props.userPermissions?.permissions?.is_admin ||
                                 this.props.userPermissions?.permissions?.farm_manager ||
                                 this.props.userPermissions?.permissions?.farm_owner ||
                                 this.props.userPermissions?.permissions?.dashboard_access;
            console.log('Real user permission result:', hasPermission);
            return hasPermission;
        }
        
        // Check for view details permission with multiple fallbacks
        const hasPermission = this.props.userPermissions?.can_view_details || 
                             this.props.userPermissions?.is_manager || 
                             this.props.userPermissions?.is_admin ||
                             this.props.userPermissions?.can_access_inventory ||
                             this.props.userPermissions?.farm_manager ||
                             this.props.userPermissions?.farm_owner ||
                             this.props.userPermissions?.dashboard_access ||
                             this.props.userPermissions?.permissions?.can_view_details;
        
        console.log('Final permission result:', hasPermission);
        return hasPermission;
    }

    canPrintDocuments() {
        // If no userPermissions object, assume full permissions for testing
        if (!this.props.userPermissions) {
            return true;
        }
        
        // Check if user is demo_user - give full permissions for demo
        if (this.props.userPermissions.role === 'demo_user') {
            return true;
        }
        
        return this.props.userPermissions?.can_print_documents || 
               this.props.userPermissions?.is_manager || 
               this.props.userPermissions?.is_admin ||
               this.props.userPermissions?.can_access_inventory ||
               this.props.userPermissions?.permissions?.can_print_documents;
    }

    canDeleteRecords() {
        // If no userPermissions object, assume full permissions for testing
        if (!this.props.userPermissions) {
            return true;
        }
        
        // Check if user is demo_user - give full permissions for demo
        if (this.props.userPermissions.role === 'demo_user') {
            return true;
        }
        
        return this.props.userPermissions?.can_delete_records || 
               this.props.userPermissions?.is_manager || 
               this.props.userPermissions?.is_admin ||
               this.props.userPermissions?.permissions?.can_delete_records;
    }

    // Additional permission checks for specific actions
    canPrintReceipt() {
        return this.canPrintDocuments() && this.canViewDetails();
    }

    canPrintDelivery() {
        return this.canPrintDocuments() && this.canViewDetails();
    }

    canPrintTransfer() {
        return this.canPrintDocuments() && this.canViewDetails();
    }

    canDuplicateReceipt() {
        return this.canCreateReceipt() && this.canViewDetails();
    }

    canDuplicateDelivery() {
        return this.canCreateDelivery() && this.canViewDetails();
    }

    canDuplicateTransfer() {
        return this.canCreateTransfer() && this.canViewDetails();
    }

    canCancelReceipt() {
        return this.canEditReceipt();
    }

    canCancelDelivery() {
        return this.canEditDelivery();
    }

    canCancelTransfer() {
        return this.canEditTransfer();
    }

    canValidateReceipt() {
        return this.canEditReceipt();
    }

    canValidateDelivery() {
        return this.canEditDelivery();
    }

    canValidateTransfer() {
        return this.canEditTransfer();
    }

    // Inventory Operations with permission checks
    onCreateReceipt() {
        if (!this.canCreateReceipt()) {
            this.notification.add('You do not have permission to create receipts', { type: 'warning' });
            return;
        }
        this.notification.add('Creating new stock receipt...', { type: 'info' });
        // TODO: Implement receipt creation
    }

    onCreateDelivery() {
        if (!this.canCreateDelivery()) {
            this.notification.add('You do not have permission to create deliveries', { type: 'warning' });
            return;
        }
        this.notification.add('Creating new stock delivery...', { type: 'info' });
        // TODO: Implement delivery creation
    }

    onCreateTransfer() {
        if (!this.canCreateTransfer()) {
            this.notification.add('You do not have permission to create transfers', { type: 'warning' });
            return;
        }
        this.notification.add('Creating new stock transfer...', { type: 'info' });
        // TODO: Implement transfer creation
    }

    onStockAdjustment() {
        if (!this.canAdjustStock()) {
            this.notification.add('You do not have permission to adjust stock', { type: 'warning' });
            return;
        }
        this.notification.add('Opening stock adjustment...', { type: 'info' });
        // TODO: Implement stock adjustment
    }

    // Receipt Operations
    onRefreshReceipts() {
        this.notification.add('Refreshing receipts...', { type: 'info' });
        this.triggerFilterChange();
    }

    onViewReceipt(receiptId) {
        if (!this.canViewDetails()) {
            this.notification.add('You do not have permission to view receipt details', { type: 'warning' });
            return;
        }
        this.notification.add(`Viewing receipt ${receiptId}...`, { type: 'info' });
        // TODO: Implement receipt view
    }

    onEditReceipt(receiptId) {
        if (!this.canEditReceipt()) {
            this.notification.add('You do not have permission to edit receipts', { type: 'warning' });
            return;
        }
        this.notification.add(`Editing receipt ${receiptId}...`, { type: 'info' });
        // TODO: Implement receipt edit
    }

    // Delivery Operations
    onRefreshDeliveries() {
        this.notification.add('Refreshing deliveries...', { type: 'info' });
        this.triggerFilterChange();
    }

    onViewDelivery(deliveryId) {
        if (!this.canViewDetails()) {
            this.notification.add('You do not have permission to view delivery details', { type: 'warning' });
            return;
        }
        this.notification.add(`Viewing delivery ${deliveryId}...`, { type: 'info' });
        // TODO: Implement delivery view
    }

    onEditDelivery(deliveryId) {
        if (!this.canEditDelivery()) {
            this.notification.add('You do not have permission to edit deliveries', { type: 'warning' });
            return;
        }
        this.notification.add(`Editing delivery ${deliveryId}...`, { type: 'info' });
        // TODO: Implement delivery edit
    }

    // Transfer Operations
    onRefreshTransfers() {
        this.notification.add('Refreshing transfers...', { type: 'info' });
        this.triggerFilterChange();
    }

    onViewTransfer(transferId) {
        if (!this.canViewDetails()) {
            this.notification.add('You do not have permission to view transfer details', { type: 'warning' });
            return;
        }
        this.notification.add(`Viewing transfer ${transferId}...`, { type: 'info' });
        // TODO: Implement transfer view
    }

    onEditTransfer(transferId) {
        if (!this.canEditTransfer()) {
            this.notification.add('You do not have permission to edit transfers', { type: 'warning' });
            return;
        }
        this.notification.add(`Editing transfer ${transferId}...`, { type: 'info' });
        // TODO: Implement transfer edit
    }

    // Stock Operations
    onRefreshStock() {
        this.notification.add('Refreshing stock...', { type: 'info' });
        this.triggerFilterChange();
    }

    onViewProduct(productId) {
        if (!this.canViewDetails()) {
            this.notification.add('You do not have permission to view product details', { type: 'warning' });
            return;
        }
        this.notification.add(`Viewing product ${productId}...`, { type: 'info' });
        // TODO: Implement product view
    }

    onAdjustStock(productId) {
        if (!this.canAdjustStock()) {
            this.notification.add('You do not have permission to adjust stock', { type: 'warning' });
            return;
        }
        this.notification.add(`Adjusting stock for product ${productId}...`, { type: 'info' });
        // TODO: Implement stock adjustment
    }

    // Additional action methods with permission checks
    onPrintReceipt(receiptId) {
        if (!this.canPrintReceipt()) {
            this.notification.add('You do not have permission to print receipts', { type: 'warning' });
            return;
        }
        this.notification.add(`Printing receipt ${receiptId}...`, { type: 'info' });
        // TODO: Implement receipt printing
    }

    onPrintDelivery(deliveryId) {
        if (!this.canPrintDelivery()) {
            this.notification.add('You do not have permission to print deliveries', { type: 'warning' });
            return;
        }
        this.notification.add(`Printing delivery ${deliveryId}...`, { type: 'info' });
        // TODO: Implement delivery printing
    }

    onPrintTransfer(transferId) {
        if (!this.canPrintTransfer()) {
            this.notification.add('You do not have permission to print transfers', { type: 'warning' });
            return;
        }
        this.notification.add(`Printing transfer ${transferId}...`, { type: 'info' });
        // TODO: Implement transfer printing
    }

    onDuplicateReceipt(receiptId) {
        if (!this.canDuplicateReceipt()) {
            this.notification.add('You do not have permission to duplicate receipts', { type: 'warning' });
            return;
        }
        this.notification.add(`Duplicating receipt ${receiptId}...`, { type: 'info' });
        // TODO: Implement receipt duplication
    }

    onDuplicateDelivery(deliveryId) {
        if (!this.canDuplicateDelivery()) {
            this.notification.add('You do not have permission to duplicate deliveries', { type: 'warning' });
            return;
        }
        this.notification.add(`Duplicating delivery ${deliveryId}...`, { type: 'info' });
        // TODO: Implement delivery duplication
    }

    onDuplicateTransfer(transferId) {
        if (!this.canDuplicateTransfer()) {
            this.notification.add('You do not have permission to duplicate transfers', { type: 'warning' });
            return;
        }
        this.notification.add(`Duplicating transfer ${transferId}...`, { type: 'info' });
        // TODO: Implement transfer duplication
    }

    onCancelReceipt(receiptId) {
        if (!this.canCancelReceipt()) {
            this.notification.add('You do not have permission to cancel receipts', { type: 'warning' });
            return;
        }
        this.notification.add(`Cancelling receipt ${receiptId}...`, { type: 'info' });
        // TODO: Implement receipt cancellation
    }

    onCancelDelivery(deliveryId) {
        if (!this.canCancelDelivery()) {
            this.notification.add('You do not have permission to cancel deliveries', { type: 'warning' });
            return;
        }
        this.notification.add(`Cancelling delivery ${deliveryId}...`, { type: 'info' });
        // TODO: Implement delivery cancellation
    }

    onCancelTransfer(transferId) {
        if (!this.canCancelTransfer()) {
            this.notification.add('You do not have permission to cancel transfers', { type: 'warning' });
            return;
        }
        this.notification.add(`Cancelling transfer ${transferId}...`, { type: 'info' });
        // TODO: Implement transfer cancellation
    }

    onValidateReceipt(receiptId) {
        if (!this.canValidateReceipt()) {
            this.notification.add('You do not have permission to validate receipts', { type: 'warning' });
            return;
        }
        this.notification.add(`Validating receipt ${receiptId}...`, { type: 'info' });
        // TODO: Implement receipt validation
    }

    onValidateDelivery(deliveryId) {
        if (!this.canValidateDelivery()) {
            this.notification.add('You do not have permission to validate deliveries', { type: 'warning' });
            return;
        }
        this.notification.add(`Validating delivery ${deliveryId}...`, { type: 'info' });
        // TODO: Implement delivery validation
    }

    onValidateTransfer(transferId) {
        if (!this.canValidateTransfer()) {
            this.notification.add('You do not have permission to validate transfers', { type: 'warning' });
            return;
        }
        this.notification.add(`Validating transfer ${transferId}...`, { type: 'info' });
        // TODO: Implement transfer validation
    }

    // ========================================
    // STAGE 1: BASIC INTERACTIVE ACTIONS
    // ========================================
    
    // Stage 1.1: Receipt Interactive Actions
    onReceiptRowClick(receipt) {
        console.log('Receipt row clicked:', receipt);
        this.notification.add(`Receipt ${receipt.reference} clicked`, { type: 'info' });
        // Stage 1: Basic click detection
    }

    onReceiptReferenceClick(receipt) {
        console.log('Receipt reference clicked:', receipt.reference);
        if (!this.canViewDetails()) {
            this.notification.add('You do not have permission to view receipt details', { type: 'warning' });
            return;
        }
        this.notification.add(`Opening receipt details for ${receipt.reference}`, { type: 'info' });
        // Stage 1: Reference click with permission check
    }

    onReceiptSupplierClick(supplier) {
        console.log('Receipt supplier clicked:', supplier);
        this.notification.add(`Opening supplier details for ${supplier}`, { type: 'info' });
        // Stage 1: Supplier click navigation
    }

    onReceiptStatusClick(receipt) {
        console.log('Receipt status clicked:', receipt.status);
        this.notification.add(`Status change options for ${receipt.reference}`, { type: 'info' });
        // Stage 1: Status change options
    }

    // Stage 1.2: Delivery Interactive Actions
    onDeliveryRowClick(delivery) {
        console.log('Delivery row clicked:', delivery);
        this.notification.add(`Delivery ${delivery.reference} clicked`, { type: 'info' });
        // Stage 1: Basic click detection
    }

    onDeliveryReferenceClick(delivery) {
        console.log('Delivery reference clicked:', delivery.reference);
        if (!this.canViewDetails()) {
            this.notification.add('You do not have permission to view delivery details', { type: 'warning' });
            return;
        }
        this.notification.add(`Opening delivery details for ${delivery.reference}`, { type: 'info' });
        // Stage 1: Reference click with permission check
    }

    onDeliveryCustomerClick(customer) {
        console.log('Delivery customer clicked:', customer);
        this.notification.add(`Opening customer details for ${customer}`, { type: 'info' });
        // Stage 1: Customer click navigation
    }

    onDeliveryStatusClick(delivery) {
        console.log('Delivery status clicked:', delivery.status);
        this.notification.add(`Status change options for ${delivery.reference}`, { type: 'info' });
        // Stage 1: Status change options
    }

    // Stage 1.3: Transfer Interactive Actions
    onTransferRowClick(transfer) {
        console.log('Transfer row clicked:', transfer);
        this.notification.add(`Transfer ${transfer.reference} clicked`, { type: 'info' });
        // Stage 1: Basic click detection
    }

    onTransferReferenceClick(transfer) {
        console.log('Transfer reference clicked:', transfer.reference);
        if (!this.canViewDetails()) {
            this.notification.add('You do not have permission to view transfer details', { type: 'warning' });
            return;
        }
        this.notification.add(`Opening transfer details for ${transfer.reference}`, { type: 'info' });
        // Stage 1: Reference click with permission check
    }

    onTransferLocationClick(location, type) {
        console.log('Transfer location clicked:', location, type);
        this.notification.add(`Opening ${type} location details for ${location}`, { type: 'info' });
        // Stage 1: Location click navigation
    }

    onTransferStatusClick(transfer) {
        console.log('Transfer status clicked:', transfer.status);
        this.notification.add(`Status change options for ${transfer.reference}`, { type: 'info' });
        // Stage 1: Status change options
    }

    // Stage 1.4: Stock Interactive Actions
    onStockRowClick(item) {
        console.log('Stock row clicked:', item);
        this.notification.add(`Stock item ${item.product_name} clicked`, { type: 'info' });
        // Stage 1: Basic click detection
    }

    onProductNameClick(product) {
        console.log('Product name clicked:', product);
        if (!this.canViewDetails()) {
            this.notification.add('You do not have permission to view product details', { type: 'warning' });
            return;
        }
        this.notification.add(`Opening product details for ${product}`, { type: 'info' });
        // Stage 1: Product click with permission check
    }

    onProductCategoryClick(category) {
        console.log('Product category clicked:', category);
        this.notification.add(`Filtering by category: ${category}`, { type: 'info' });
        // Stage 1: Category filter
    }

    onStockQuantityClick(item) {
        console.log('Stock quantity clicked:', item.quantity);
        this.notification.add(`Stock movements for ${item.product_name}`, { type: 'info' });
        // Stage 1: Quantity click for movements
    }

    onStockValueClick(item) {
        console.log('Stock value clicked:', item.value);
        this.notification.add(`Valuation details for ${item.product_name}`, { type: 'info' });
        // Stage 1: Value click for valuation
    }

    // ========================================
    // STAGE 2: ADVANCED INTERACTIVE ACTIONS
    // ========================================
    
    // Stage 2.1: Multi-Select Actions
    onSelectReceipt(receipt, selected) {
        console.log('Receipt selection changed:', receipt.reference, selected);
        this.notification.add(`Receipt ${receipt.reference} ${selected ? 'selected' : 'deselected'}`, { type: 'info' });
        // Stage 2: Multi-select functionality
    }

    onSelectDelivery(delivery, selected) {
        console.log('Delivery selection changed:', delivery.reference, selected);
        this.notification.add(`Delivery ${delivery.reference} ${selected ? 'selected' : 'deselected'}`, { type: 'info' });
        // Stage 2: Multi-select functionality
    }

    onSelectTransfer(transfer, selected) {
        console.log('Transfer selection changed:', transfer.reference, selected);
        this.notification.add(`Transfer ${transfer.reference} ${selected ? 'selected' : 'deselected'}`, { type: 'info' });
        // Stage 2: Multi-select functionality
    }

    onSelectStockItem(item, selected) {
        console.log('Stock item selection changed:', item.product_name, selected);
        this.notification.add(`Stock item ${item.product_name} ${selected ? 'selected' : 'deselected'}`, { type: 'info' });
        // Stage 2: Multi-select functionality
    }

    // Stage 2.2: Bulk Actions
    onBulkActionReceipts(action) {
        console.log('Bulk action on receipts:', action);
        if (!this.canEditReceipt()) {
            this.notification.add('You do not have permission for bulk receipt actions', { type: 'warning' });
            return;
        }
        this.notification.add(`Performing bulk action: ${action} on selected receipts`, { type: 'info' });
        // Stage 2: Bulk operations
    }

    onBulkActionDeliveries(action) {
        console.log('Bulk action on deliveries:', action);
        if (!this.canEditDelivery()) {
            this.notification.add('You do not have permission for bulk delivery actions', { type: 'warning' });
            return;
        }
        this.notification.add(`Performing bulk action: ${action} on selected deliveries`, { type: 'info' });
        // Stage 2: Bulk operations
    }

    onBulkActionTransfers(action) {
        console.log('Bulk action on transfers:', action);
        if (!this.canEditTransfer()) {
            this.notification.add('You do not have permission for bulk transfer actions', { type: 'warning' });
            return;
        }
        this.notification.add(`Performing bulk action: ${action} on selected transfers`, { type: 'info' });
        // Stage 2: Bulk operations
    }

    onBulkActionStock(action) {
        console.log('Bulk action on stock:', action);
        if (!this.canAdjustStock()) {
            this.notification.add('You do not have permission for bulk stock actions', { type: 'warning' });
            return;
        }
        this.notification.add(`Performing bulk action: ${action} on selected stock items`, { type: 'info' });
        // Stage 2: Bulk operations
    }

    // Stage 2.3: Quick Actions
    onQuickCreateReceipt() {
        console.log('Quick create receipt');
        if (!this.canCreateReceipt()) {
            this.notification.add('You do not have permission to create receipts', { type: 'warning' });
            return;
        }
        this.notification.add('Opening quick receipt creation form', { type: 'info' });
        // Stage 2: Quick creation
    }

    onQuickCreateDelivery() {
        console.log('Quick create delivery');
        if (!this.canCreateDelivery()) {
            this.notification.add('You do not have permission to create deliveries', { type: 'warning' });
            return;
        }
        this.notification.add('Opening quick delivery creation form', { type: 'info' });
        // Stage 2: Quick creation
    }

    onQuickCreateTransfer() {
        console.log('Quick create transfer');
        if (!this.canCreateTransfer()) {
            this.notification.add('You do not have permission to create transfers', { type: 'warning' });
            return;
        }
        this.notification.add('Opening quick transfer creation form', { type: 'info' });
        // Stage 2: Quick creation
    }

    onQuickStockAdjustment() {
        console.log('Quick stock adjustment');
        if (!this.canAdjustStock()) {
            this.notification.add('You do not have permission to adjust stock', { type: 'warning' });
            return;
        }
        this.notification.add('Opening quick stock adjustment form', { type: 'info' });
        // Stage 2: Quick adjustment
    }

    // Stage 2.4: Context Menu Actions
    onReceiptContextMenu(receipt, action) {
        console.log('Receipt context menu action:', action, receipt);
        this.notification.add(`Context action: ${action} on receipt ${receipt.reference}`, { type: 'info' });
        // Stage 2: Context menu actions
    }

    onDeliveryContextMenu(delivery, action) {
        console.log('Delivery context menu action:', action, delivery);
        this.notification.add(`Context action: ${action} on delivery ${delivery.reference}`, { type: 'info' });
        // Stage 2: Context menu actions
    }

    onTransferContextMenu(transfer, action) {
        console.log('Transfer context menu action:', action, transfer);
        this.notification.add(`Context action: ${action} on transfer ${transfer.reference}`, { type: 'info' });
        // Stage 2: Context menu actions
    }

    onStockContextMenu(item, action) {
        console.log('Stock context menu action:', action, item);
        this.notification.add(`Context action: ${action} on stock item ${item.product_name}`, { type: 'info' });
        // Stage 2: Context menu actions
    }

    // ========================================
    // STAGE 3: ODOO INTEGRATION ACTIONS
    // ========================================
    
    // Stage 3.1: Odoo Form Navigation
    onOpenReceiptForm(receiptId) {
        console.log('Opening receipt form:', receiptId);
        if (!this.canViewDetails()) {
            this.notification.add('You do not have permission to view receipt details', { type: 'warning' });
            return;
        }
        this.notification.add(`Opening receipt form for ID: ${receiptId}`, { type: 'info' });
        // Stage 3: Odoo form navigation
        // TODO: Implement Odoo action
        // this.env.services.action.doAction({...});
    }

    onOpenDeliveryForm(deliveryId) {
        console.log('Opening delivery form:', deliveryId);
        if (!this.canViewDetails()) {
            this.notification.add('You do not have permission to view delivery details', { type: 'warning' });
            return;
        }
        this.notification.add(`Opening delivery form for ID: ${deliveryId}`, { type: 'info' });
        // Stage 3: Odoo form navigation
    }

    onOpenTransferForm(transferId) {
        console.log('Opening transfer form:', transferId);
        if (!this.canViewDetails()) {
            this.notification.add('You do not have permission to view transfer details', { type: 'warning' });
            return;
        }
        this.notification.add(`Opening transfer form for ID: ${transferId}`, { type: 'info' });
        // Stage 3: Odoo form navigation
    }

    onOpenProductForm(productId) {
        console.log('Opening product form:', productId);
        if (!this.canViewDetails()) {
            this.notification.add('You do not have permission to view product details', { type: 'warning' });
            return;
        }
        this.notification.add(`Opening product form for ID: ${productId}`, { type: 'info' });
        // Stage 3: Odoo form navigation
    }

    onOpenSupplierForm(supplierId) {
        console.log('Opening supplier form:', supplierId);
        this.notification.add(`Opening supplier form for ID: ${supplierId}`, { type: 'info' });
        // Stage 3: Odoo form navigation
    }

    onOpenCustomerForm(customerId) {
        console.log('Opening customer form:', customerId);
        this.notification.add(`Opening customer form for ID: ${customerId}`, { type: 'info' });
        // Stage 3: Odoo form navigation
    }

    onOpenLocationForm(locationId) {
        console.log('Opening location form:', locationId);
        this.notification.add(`Opening location form for ID: ${locationId}`, { type: 'info' });
        // Stage 3: Odoo form navigation
    }

    // Stage 3.2: Odoo List Views
    onOpenReceiptsList() {
        console.log('Opening receipts list view');
        this.notification.add('Opening receipts list view', { type: 'info' });
        // Stage 3: Odoo list view navigation
    }

    onOpenDeliveriesList() {
        console.log('Opening deliveries list view');
        this.notification.add('Opening deliveries list view', { type: 'info' });
        // Stage 3: Odoo list view navigation
    }

    onOpenTransfersList() {
        console.log('Opening transfers list view');
        this.notification.add('Opening transfers list view', { type: 'info' });
        // Stage 3: Odoo list view navigation
    }

    onOpenStockList() {
        console.log('Opening stock list view');
        this.notification.add('Opening stock list view', { type: 'info' });
        // Stage 3: Odoo list view navigation
    }

    // Stage 3.3: Odoo Wizards
    onOpenStockAdjustmentWizard(productId) {
        console.log('Opening stock adjustment wizard:', productId);
        if (!this.canAdjustStock()) {
            this.notification.add('You do not have permission to adjust stock', { type: 'warning' });
            return;
        }
        this.notification.add(`Opening stock adjustment wizard for product: ${productId}`, { type: 'info' });
        // Stage 3: Odoo wizard navigation
    }

    onOpenInventoryWizard() {
        console.log('Opening inventory wizard');
        if (!this.canAdjustStock()) {
            this.notification.add('You do not have permission to perform inventory operations', { type: 'warning' });
            return;
        }
        this.notification.add('Opening inventory wizard', { type: 'info' });
        // Stage 3: Odoo wizard navigation
    }

    onOpenStockMoveWizard() {
        console.log('Opening stock move wizard');
        if (!this.canCreateTransfer()) {
            this.notification.add('You do not have permission to create stock moves', { type: 'warning' });
            return;
        }
        this.notification.add('Opening stock move wizard', { type: 'info' });
        // Stage 3: Odoo wizard navigation
    }

    // Stage 3.4: Odoo Reports
    onOpenInventoryReport() {
        console.log('Opening inventory report');
        if (!this.canViewDetails()) {
            this.notification.add('You do not have permission to view reports', { type: 'warning' });
            return;
        }
        this.notification.add('Opening inventory report', { type: 'info' });
        // Stage 3: Odoo report navigation
    }

    onOpenStockValuationReport() {
        console.log('Opening stock valuation report');
        if (!this.canViewDetails()) {
            this.notification.add('You do not have permission to view reports', { type: 'warning' });
            return;
        }
        this.notification.add('Opening stock valuation report', { type: 'info' });
        // Stage 3: Odoo report navigation
    }

    onOpenStockMovementsReport() {
        console.log('Opening stock movements report');
        if (!this.canViewDetails()) {
            this.notification.add('You do not have permission to view reports', { type: 'warning' });
            return;
        }
        this.notification.add('Opening stock movements report', { type: 'info' });
        // Stage 3: Odoo report navigation
    }

    // ========================================
    // STAGE 4: CUSTOM DETAIL SCREENS
    // ========================================
    
    // Stage 4.1: Receipt Detail Screen
    onShowReceiptDetails(receipt) {
        console.log('Showing receipt details:', receipt);
        if (!this.canViewDetails()) {
            this.notification.add('You do not have permission to view receipt details', { type: 'warning' });
            return;
        }
        this.notification.add(`Opening receipt details for ${receipt.reference}`, { type: 'info' });
        // Stage 4: Custom detail screen
        // TODO: Implement custom detail modal/screen
    }

    onShowDeliveryDetails(delivery) {
        console.log('Showing delivery details:', delivery);
        if (!this.canViewDetails()) {
            this.notification.add('You do not have permission to view delivery details', { type: 'warning' });
            return;
        }
        this.notification.add(`Opening delivery details for ${delivery.reference}`, { type: 'info' });
        // Stage 4: Custom detail screen
    }

    onShowTransferDetails(transfer) {
        console.log('Showing transfer details:', transfer);
        if (!this.canViewDetails()) {
            this.notification.add('You do not have permission to view transfer details', { type: 'warning' });
            return;
        }
        this.notification.add(`Opening transfer details for ${transfer.reference}`, { type: 'info' });
        // Stage 4: Custom detail screen
    }

    onShowProductDetails(product) {
        console.log('Showing product details:', product);
        if (!this.canViewDetails()) {
            this.notification.add('You do not have permission to view product details', { type: 'warning' });
            return;
        }
        this.notification.add(`Opening product details for ${product.name}`, { type: 'info' });
        // Stage 4: Custom detail screen
    }

    // Stage 4.2: Stock Movement History
    onShowStockMovements(product) {
        console.log('Showing stock movements:', product);
        if (!this.canViewDetails()) {
            this.notification.add('You do not have permission to view stock movements', { type: 'warning' });
            return;
        }
        this.notification.add(`Opening stock movements for ${product.name}`, { type: 'info' });
        // Stage 4: Stock movement history screen
    }

    onShowStockValuation(product) {
        console.log('Showing stock valuation:', product);
        if (!this.canViewDetails()) {
            this.notification.add('You do not have permission to view stock valuation', { type: 'warning' });
            return;
        }
        this.notification.add(`Opening stock valuation for ${product.name}`, { type: 'info' });
        // Stage 4: Stock valuation screen
    }

    // Stage 4.3: Status Change Dialogs
    onShowStatusChangeDialog(record, type) {
        console.log('Showing status change dialog:', record, type);
        this.notification.add(`Opening status change dialog for ${type} ${record.reference}`, { type: 'info' });
        // Stage 4: Status change dialog
    }

    onShowBulkStatusChangeDialog(records, type) {
        console.log('Showing bulk status change dialog:', records, type);
        this.notification.add(`Opening bulk status change dialog for ${records.length} ${type} records`, { type: 'info' });
        // Stage 4: Bulk status change dialog
    }

    // ========================================
    // STAGE 5: TESTING FRAMEWORK
    // ========================================
    
    // Stage 5.1: Test All Interactive Actions
    testAllInteractiveActions() {
        console.log('Testing all interactive actions...');
        this.notification.add('Starting comprehensive interactive actions test', { type: 'info' });
        
        // Test Stage 1: Basic Interactive Actions
        this.testStage1Actions();
        
        // Test Stage 2: Advanced Interactive Actions
        this.testStage2Actions();
        
        // Test Stage 3: Odoo Integration Actions
        this.testStage3Actions();
        
        // Test Stage 4: Custom Detail Screens
        this.testStage4Actions();
        
        this.notification.add('All interactive actions test completed', { type: 'success' });
    }

    testStage1Actions() {
        console.log('Testing Stage 1: Basic Interactive Actions');
        
        // Test receipt actions
        const mockReceipt = { reference: 'REC/2024/001', supplier_name: 'ABC Seeds', status: 'draft' };
        this.onReceiptRowClick(mockReceipt);
        this.onReceiptReferenceClick(mockReceipt);
        this.onReceiptSupplierClick(mockReceipt.supplier_name);
        this.onReceiptStatusClick(mockReceipt);
        
        // Test delivery actions
        const mockDelivery = { reference: 'DEL/2024/001', customer_name: 'John Farm', status: 'done' };
        this.onDeliveryRowClick(mockDelivery);
        this.onDeliveryReferenceClick(mockDelivery);
        this.onDeliveryCustomerClick(mockDelivery.customer_name);
        this.onDeliveryStatusClick(mockDelivery);
        
        // Test transfer actions
        const mockTransfer = { reference: 'TRF/2024/001', from_location: 'Warehouse A', to_location: 'Warehouse B', status: 'done' };
        this.onTransferRowClick(mockTransfer);
        this.onTransferReferenceClick(mockTransfer);
        this.onTransferLocationClick(mockTransfer.from_location, 'from');
        this.onTransferLocationClick(mockTransfer.to_location, 'to');
        this.onTransferStatusClick(mockTransfer);
        
        // Test stock actions
        const mockStockItem = { product_name: 'Wheat Seeds', category: 'Seeds', quantity: 100, value: 1500 };
        this.onStockRowClick(mockStockItem);
        this.onProductNameClick(mockStockItem.product_name);
        this.onProductCategoryClick(mockStockItem.category);
        this.onStockQuantityClick(mockStockItem);
        this.onStockValueClick(mockStockItem);
        
        console.log('Stage 1 testing completed');
    }

    testStage2Actions() {
        console.log('Testing Stage 2: Advanced Interactive Actions');
        
        // Test multi-select actions
        const mockReceipt = { reference: 'REC/2024/001' };
        this.onSelectReceipt(mockReceipt, true);
        this.onSelectReceipt(mockReceipt, false);
        
        // Test bulk actions
        this.onBulkActionReceipts('validate');
        this.onBulkActionDeliveries('cancel');
        this.onBulkActionTransfers('process');
        this.onBulkActionStock('adjust');
        
        // Test quick actions
        this.onQuickCreateReceipt();
        this.onQuickCreateDelivery();
        this.onQuickCreateTransfer();
        this.onQuickStockAdjustment();
        
        // Test context menu actions
        this.onReceiptContextMenu(mockReceipt, 'edit');
        this.onDeliveryContextMenu({ reference: 'DEL/2024/001' }, 'print');
        this.onTransferContextMenu({ reference: 'TRF/2024/001' }, 'duplicate');
        this.onStockContextMenu({ product_name: 'Wheat Seeds' }, 'adjust');
        
        console.log('Stage 2 testing completed');
    }

    testStage3Actions() {
        console.log('Testing Stage 3: Odoo Integration Actions');
        
        // Test form navigation
        this.onOpenReceiptForm(1);
        this.onOpenDeliveryForm(2);
        this.onOpenTransferForm(3);
        this.onOpenProductForm(4);
        this.onOpenSupplierForm(5);
        this.onOpenCustomerForm(6);
        this.onOpenLocationForm(7);
        
        // Test list views
        this.onOpenReceiptsList();
        this.onOpenDeliveriesList();
        this.onOpenTransfersList();
        this.onOpenStockList();
        
        // Test wizards
        this.onOpenStockAdjustmentWizard(1);
        this.onOpenInventoryWizard();
        this.onOpenStockMoveWizard();
        
        // Test reports
        this.onOpenInventoryReport();
        this.onOpenStockValuationReport();
        this.onOpenStockMovementsReport();
        
        console.log('Stage 3 testing completed');
    }

    testStage4Actions() {
        console.log('Testing Stage 4: Custom Detail Screens');
        
        // Test detail screens
        const mockReceipt = { reference: 'REC/2024/001' };
        const mockDelivery = { reference: 'DEL/2024/001' };
        const mockTransfer = { reference: 'TRF/2024/001' };
        const mockProduct = { name: 'Wheat Seeds' };
        
        this.onShowReceiptDetails(mockReceipt);
        this.onShowDeliveryDetails(mockDelivery);
        this.onShowTransferDetails(mockTransfer);
        this.onShowProductDetails(mockProduct);
        
        // Test stock analysis
        this.onShowStockMovements(mockProduct);
        this.onShowStockValuation(mockProduct);
        
        // Test status dialogs
        this.onShowStatusChangeDialog(mockReceipt, 'receipt');
        this.onShowBulkStatusChangeDialog([mockReceipt, mockDelivery], 'records');
        
        console.log('Stage 4 testing completed');
    }

    // Stage 5.2: Individual Stage Testing
    testStage1Only() {
        console.log('Testing Stage 1 only...');
        this.testStage1Actions();
        this.notification.add('Stage 1 testing completed', { type: 'success' });
    }

    testStage2Only() {
        console.log('Testing Stage 2 only...');
        this.testStage2Actions();
        this.notification.add('Stage 2 testing completed', { type: 'success' });
    }

    testStage3Only() {
        console.log('Testing Stage 3 only...');
        this.testStage3Actions();
        this.notification.add('Stage 3 testing completed', { type: 'success' });
    }

    testStage4Only() {
        console.log('Testing Stage 4 only...');
        this.testStage4Actions();
        this.notification.add('Stage 4 testing completed', { type: 'success' });
    }

    // ========================================
    // PERMISSION TESTING AND DEBUGGING
    // ========================================
    
    // Test permission system
    testPermissionSystem() {
        console.log('Testing permission system...');
        console.log('userPermissions object:', this.props.userPermissions);
        
        // Test all permission methods
        const permissions = {
            canViewDetails: this.canViewDetails(),
            canCreateReceipt: this.canCreateReceipt(),
            canCreateDelivery: this.canCreateDelivery(),
            canCreateTransfer: this.canCreateTransfer(),
            canAdjustStock: this.canAdjustStock(),
            canEditReceipt: this.canEditReceipt(),
            canEditDelivery: this.canEditDelivery(),
            canEditTransfer: this.canEditTransfer(),
            canPrintDocuments: this.canPrintDocuments(),
            canDeleteRecords: this.canDeleteRecords()
        };
        
        console.log('Permission results:', permissions);
        this.notification.add('Permission system test completed - check console for results', { type: 'info' });
        
        return permissions;
    }

    // Override permissions for testing (temporary method)
    overridePermissionsForTesting() {
        console.log('Overriding permissions for testing...');
        
        // Create a mock permissions object with all permissions
        const mockPermissions = {
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
            is_manager: true,
            is_admin: true,
            can_access_inventory: true
        };
        
        // Temporarily override the props (this is for testing only)
        this.props.userPermissions = mockPermissions;
        
        console.log('Permissions overridden:', mockPermissions);
        this.notification.add('Permissions overridden for testing - all actions should now work', { type: 'success' });
        
        return mockPermissions;
    }

    // Test a specific interactive action with permission check
    testReceiptReferenceClick() {
        console.log('Testing receipt reference click with permission check...');
        
        const mockReceipt = { reference: 'REC/2024/001', supplier_name: 'ABC Seeds', status: 'draft' };
        
        // Test the permission check first
        const hasPermission = this.canViewDetails();
        console.log('Has permission to view details:', hasPermission);
        
        if (hasPermission) {
            this.onReceiptReferenceClick(mockReceipt);
            this.notification.add('Receipt reference click test completed successfully', { type: 'success' });
        } else {
            this.notification.add('Permission denied for receipt reference click', { type: 'warning' });
        }
    }

    // ========================================
    // USER ROLE DETECTION AND DEBUGGING
    // ========================================
    
    // Detect current user role from Odoo system
    async detectUserRole() {
        console.log('Detecting user role from Odoo system...');
        
        try {
            // Get current user information
            const userInfo = await this.props.rpcCall('/web/session/get_session_info');
            console.log('Current user info:', userInfo);
            console.log('User ID:', userInfo.uid);
            console.log('User name:', userInfo.name);
            console.log('User login:', userInfo.login);
            
            // Get user groups/roles
            const userGroups = await this.props.rpcCall('/web/dataset/call_kw', {
                model: 'res.users',
                method: 'read',
                args: [[userInfo.uid]],
                kwargs: {
                    fields: ['groups_id', 'name', 'login', 'email', 'active']
                }
            });
            
            console.log('User groups:', userGroups);
            
            // Get group details
            if (userGroups && userGroups[0] && userGroups[0].groups_id) {
                const groupDetails = await this.props.rpcCall('/web/dataset/call_kw', {
                    model: 'res.groups',
                    method: 'read',
                    args: [userGroups[0].groups_id],
                    kwargs: {
                        fields: ['name', 'category_id', 'full_name']
                    }
                });
                
                console.log('Group details:', groupDetails);
                
                // Analyze roles
                const roles = this.analyzeUserRoles(groupDetails);
                console.log('Detected roles:', roles);
                
                // Update userPermissions with real user data
                this.updateUserPermissionsWithRealData(userGroups[0], groupDetails, roles);
                
                this.notification.add(`Real user detected: ${userGroups[0].name} (${userGroups[0].login})`, { type: 'success' });
                
                return {
                    user: userGroups[0],
                    groups: groupDetails,
                    roles: roles
                };
            }
            
        } catch (error) {
            console.error('Error detecting user role:', error);
            this.notification.add('Error detecting user role: ' + error.message, { type: 'danger' });
        }
    }

    // Update userPermissions with real user data
    updateUserPermissionsWithRealData(user, groups, roles) {
        console.log('Updating userPermissions with real user data...');
        
        // Create real user permissions object
        const realUserPermissions = {
            role: 'real_user',
            user_id: user.id,
            user_name: user.name,
            user_login: user.login,
            user_email: user.email,
            is_active: user.active,
            groups: groups,
            roles: roles,
            permissions: {
                can_view_details: this.hasRoleInGroups(groups, ['Farm Manager', 'Farm Owner', 'Administrator', 'Manager']),
                can_create_receipts: this.hasRoleInGroups(groups, ['Farm Manager', 'Farm Owner', 'Administrator', 'Manager']),
                can_create_deliveries: this.hasRoleInGroups(groups, ['Farm Manager', 'Farm Owner', 'Administrator', 'Manager']),
                can_create_transfers: this.hasRoleInGroups(groups, ['Farm Manager', 'Farm Owner', 'Administrator', 'Manager']),
                can_adjust_stock: this.hasRoleInGroups(groups, ['Farm Manager', 'Farm Owner', 'Administrator', 'Manager']),
                can_edit_receipts: this.hasRoleInGroups(groups, ['Farm Manager', 'Farm Owner', 'Administrator', 'Manager']),
                can_edit_deliveries: this.hasRoleInGroups(groups, ['Farm Manager', 'Farm Owner', 'Administrator', 'Manager']),
                can_edit_transfers: this.hasRoleInGroups(groups, ['Farm Manager', 'Farm Owner', 'Administrator', 'Manager']),
                can_print_documents: this.hasRoleInGroups(groups, ['Farm Manager', 'Farm Owner', 'Administrator', 'Manager']),
                can_delete_records: this.hasRoleInGroups(groups, ['Farm Manager', 'Farm Owner', 'Administrator']),
                is_manager: this.hasRoleInGroups(groups, ['Manager', 'Farm Manager']),
                is_admin: this.hasRoleInGroups(groups, ['Administrator', 'Farm Owner']),
                can_access_inventory: this.hasRoleInGroups(groups, ['Inventory', 'Stock Manager', 'Farm Manager', 'Farm Owner']),
                farm_manager: this.hasRoleInGroups(groups, ['Farm Manager']),
                farm_owner: this.hasRoleInGroups(groups, ['Farm Owner']),
                farm_accountant: this.hasRoleInGroups(groups, ['Farm Accountant']),
                dashboard_access: this.hasRoleInGroups(groups, ['Farm Dashboard Access', 'Farm Manager', 'Farm Owner'])
            }
        };
        
        console.log('Real user permissions created:', realUserPermissions);
        
        // Update the props (this is for testing - in real implementation, this would come from parent)
        this.props.userPermissions = realUserPermissions;
        
        this.notification.add(`User permissions updated for ${user.name}`, { type: 'info' });
        
        return realUserPermissions;
    }

    // Check if user has specific roles in groups
    hasRoleInGroups(groups, roleNames) {
        if (!groups || !roleNames) return false;
        
        return groups.some(group => {
            const groupName = group.name || '';
            return roleNames.some(roleName => 
                groupName.includes(roleName) || 
                groupName.toLowerCase().includes(roleName.toLowerCase())
            );
        });
    }

    // Analyze user roles from group data
    analyzeUserRoles(groups) {
        const roles = [];
        
        groups.forEach(group => {
            const groupName = group.name || '';
            const categoryName = group.category_id ? group.category_id[1] : '';
            
            // Farm Management roles
            if (groupName.includes('Farm Manager') || groupName.includes('Farm Management')) {
                roles.push({
                    type: 'farm_manager',
                    name: 'Farm Manager',
                    description: 'Full access to farm management operations',
                    permissions: ['all']
                });
            }
            
            if (groupName.includes('Farm Accountant')) {
                roles.push({
                    type: 'farm_accountant',
                    name: 'Farm Accountant',
                    description: 'Financial and accounting access',
                    permissions: ['financial', 'reports', 'view']
                });
            }
            
            if (groupName.includes('Farm Owner')) {
                roles.push({
                    type: 'farm_owner',
                    name: 'Farm Owner',
                    description: 'Complete system access',
                    permissions: ['all']
                });
            }
            
            if (groupName.includes('Farm Dashboard Access')) {
                roles.push({
                    type: 'dashboard_access',
                    name: 'Dashboard Access',
                    description: 'Access to farm dashboard',
                    permissions: ['dashboard', 'view']
                });
            }
            
            // Inventory roles
            if (categoryName.includes('Inventory') || groupName.includes('Inventory')) {
                roles.push({
                    type: 'inventory_user',
                    name: 'Inventory User',
                    description: 'Inventory management access',
                    permissions: ['inventory', 'stock', 'view']
                });
            }
            
            if (groupName.includes('Stock Manager')) {
                roles.push({
                    type: 'stock_manager',
                    name: 'Stock Manager',
                    description: 'Full stock management access',
                    permissions: ['inventory', 'stock', 'all']
                });
            }
            
            // Technical roles
            if (groupName.includes('Administrator') || groupName.includes('Admin')) {
                roles.push({
                    type: 'administrator',
                    name: 'Administrator',
                    description: 'System administrator access',
                    permissions: ['all']
                });
            }
            
            if (groupName.includes('Manager')) {
                roles.push({
                    type: 'manager',
                    name: 'Manager',
                    description: 'Management level access',
                    permissions: ['manage', 'view', 'edit']
                });
            }
        });
        
        return roles;
    }

    // Check if user has specific role
    hasRole(roleType) {
        // This would need to be called after detectUserRole()
        // For now, return true for testing
        console.log(`Checking for role: ${roleType}`);
        return true;
    }

    // Get user role summary
    getUserRoleSummary() {
        console.log('Getting user role summary...');
        
        const summary = {
            hasFarmManager: this.hasRole('farm_manager'),
            hasFarmAccountant: this.hasRole('farm_accountant'),
            hasFarmOwner: this.hasRole('farm_owner'),
            hasDashboardAccess: this.hasRole('dashboard_access'),
            hasInventoryAccess: this.hasRole('inventory_user'),
            hasStockManager: this.hasRole('stock_manager'),
            isAdministrator: this.hasRole('administrator'),
            isManager: this.hasRole('manager')
        };
        
        console.log('User role summary:', summary);
        this.notification.add('User role summary generated - check console', { type: 'info' });
        
        return summary;
    }

    // Debug current permissions and roles
    debugUserPermissions() {
        console.log('=== USER PERMISSIONS DEBUG ===');
        console.log('userPermissions prop:', this.props.userPermissions);
        console.log('Current user context:', this.env?.services?.user);
        
        // Check if demo user
        if (this.props.userPermissions?.role === 'demo_user') {
            console.log('DEMO USER DETECTED - Full permissions granted for testing');
            console.log('Demo user permissions structure:', this.props.userPermissions);
            console.log('Available tabs:', this.props.userPermissions?.tabs);
            console.log('Available permissions:', this.props.userPermissions?.permissions);
        }
        
        // Test all permission methods
        const permissionResults = {
            canViewDetails: this.canViewDetails(),
            canCreateReceipt: this.canCreateReceipt(),
            canCreateDelivery: this.canCreateDelivery(),
            canCreateTransfer: this.canCreateTransfer(),
            canAdjustStock: this.canAdjustStock(),
            canEditReceipt: this.canEditReceipt(),
            canEditDelivery: this.canEditDelivery(),
            canEditTransfer: this.canEditTransfer(),
            canPrintDocuments: this.canPrintDocuments(),
            canDeleteRecords: this.canDeleteRecords()
        };
        
        console.log('Permission results:', permissionResults);
        
        // Get role summary
        const roleSummary = this.getUserRoleSummary();
        
        this.notification.add('User permissions debug completed - check console for details', { type: 'info' });
        
        return {
            permissions: permissionResults,
            roles: roleSummary
        };
    }

    // Debug demo user specifically
    debugDemoUser() {
        console.log('=== DEMO USER DEBUG ===');
        console.log('User role:', this.props.userPermissions?.role);
        console.log('Full userPermissions object:', this.props.userPermissions);
        
        if (this.props.userPermissions?.role === 'demo_user') {
            console.log('✅ Demo user detected - should have full permissions');
            console.log('Available tabs:', this.props.userPermissions?.tabs);
            console.log('Available permissions:', this.props.userPermissions?.permissions);
            
            // Test all permissions
            const demoPermissions = {
                canViewDetails: this.canViewDetails(),
                canCreateReceipt: this.canCreateReceipt(),
                canCreateDelivery: this.canCreateDelivery(),
                canCreateTransfer: this.canCreateTransfer(),
                canAdjustStock: this.canAdjustStock(),
                canEditReceipt: this.canEditReceipt(),
                canEditDelivery: this.canEditDelivery(),
                canEditTransfer: this.canEditTransfer(),
                canPrintDocuments: this.canPrintDocuments(),
                canDeleteRecords: this.canDeleteRecords()
            };
            
            console.log('Demo user permission results:', demoPermissions);
            
            // Check if all permissions are true
            const allPermissionsGranted = Object.values(demoPermissions).every(perm => perm === true);
            console.log('All permissions granted:', allPermissionsGranted);
            
            if (allPermissionsGranted) {
                this.notification.add('✅ Demo user has full permissions - all actions should work', { type: 'success' });
            } else {
                this.notification.add('❌ Demo user missing some permissions - check console', { type: 'warning' });
            }
            
            return demoPermissions;
        } else {
            console.log('❌ Not a demo user - role:', this.props.userPermissions?.role);
            this.notification.add('Not a demo user - using standard permission checks', { type: 'info' });
            return null;
        }
    }

    // Switch from demo user to real user
    async switchToRealUser() {
        console.log('=== SWITCHING TO REAL USER ===');
        console.log('Current role:', this.props.userPermissions?.role);
        
        if (this.props.userPermissions?.role === 'demo_user') {
            console.log('Switching from demo user to real user...');
            
            try {
                // Detect real user role
                const realUserData = await this.detectUserRole();
                
                if (realUserData) {
                    console.log('✅ Successfully switched to real user');
                    console.log('Real user data:', realUserData);
                    
                    this.notification.add(`✅ Switched to real user: ${realUserData.user.name}`, { type: 'success' });
                    
                    return realUserData;
                } else {
                    console.log('❌ Failed to detect real user');
                    this.notification.add('❌ Failed to detect real user - check console', { type: 'danger' });
                    return null;
                }
            } catch (error) {
                console.error('Error switching to real user:', error);
                this.notification.add('Error switching to real user: ' + error.message, { type: 'danger' });
                return null;
            }
        } else {
            console.log('Already using real user or different role:', this.props.userPermissions?.role);
            this.notification.add(`Already using ${this.props.userPermissions?.role} - no switch needed`, { type: 'info' });
            return this.props.userPermissions;
        }
    }

    // Get current user information
    async getCurrentUserInfo() {
        console.log('=== GETTING CURRENT USER INFO ===');
        
        try {
            // Get session info
            const sessionInfo = await this.props.rpcCall('/web/session/get_session_info');
            console.log('Session info:', sessionInfo);
            
            // Get user details
            const userDetails = await this.props.rpcCall('/web/dataset/call_kw', {
                model: 'res.users',
                method: 'read',
                args: [[sessionInfo.uid]],
                kwargs: {
                    fields: ['name', 'login', 'email', 'active', 'groups_id']
                }
            });
            
            console.log('User details:', userDetails);
            
            this.notification.add(`Current user: ${userDetails[0]?.name} (${userDetails[0]?.login})`, { type: 'info' });
            
            return {
                session: sessionInfo,
                user: userDetails[0]
            };
        } catch (error) {
            console.error('Error getting current user info:', error);
            this.notification.add('Error getting current user info: ' + error.message, { type: 'danger' });
            return null;
        }
    }

    // Check if dashboard main has already set real user permissions
    checkDashboardPermissions() {
        console.log('🔍 Checking dashboard permissions...');
        console.log('Props userPermissions:', this.props.userPermissions);
        
        if (this.props.userPermissions) {
            if (this.props.userPermissions.role === 'real_user') {
                console.log('✅ Dashboard already has real_user permissions - using them');
                this.localPermissions = this.props.userPermissions;
                this.useLocalPermissions = true;
                return;
            } else if (this.props.userPermissions.role === 'demo_user') {
                console.log('⚠️ Dashboard has demo_user - enabling full permissions for testing');
                this.localPermissions = {
                    role: 'real_user',
                    user_name: 'Dashboard User',
                    permissions: {
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
                        is_manager: true,
                        is_admin: true,
                        can_access_inventory: true,
                        farm_manager: true,
                        farm_owner: true,
                        farm_accountant: true,
                        dashboard_access: true
                    }
                };
                this.useLocalPermissions = true;
                return;
            }
        }
        
        console.log('ℹ️ Using props permissions as-is');
    }

    // Auto-detect real user on component mount
    async autoDetectRealUser() {
        console.log('=== AUTO-DETECTING REAL USER ===');
        
        try {
            // Get current user info
            const currentUserInfo = await this.getCurrentUserInfo();
            
            if (currentUserInfo && currentUserInfo.user) {
                console.log('✅ Auto-detected real user:', currentUserInfo.user.name);
                
                // Get user groups
                const userGroups = await this.props.rpcCall('/web/dataset/call_kw', {
                    model: 'res.users',
                    method: 'read',
                    args: [[currentUserInfo.user.id]],
                    kwargs: {
                        fields: ['groups_id', 'name', 'login', 'email', 'active']
                    }
                });
                
                if (userGroups && userGroups[0] && userGroups[0].groups_id) {
                    // Get group details
                    const groupDetails = await this.props.rpcCall('/web/dataset/call_kw', {
                        model: 'res.groups',
                        method: 'read',
                        args: [userGroups[0].groups_id],
                        kwargs: {
                            fields: ['name', 'category_id', 'full_name']
                        }
                    });
                    
                    // Create and set local permissions
                    this.localPermissions = this.createRealUserPermissions(userGroups[0], groupDetails);
                    this.useLocalPermissions = true;
                    
                    console.log('✅ Auto-detected real user permissions:', this.localPermissions);
                    this.notification.add(`✅ Auto-detected real user: ${userGroups[0].name}`, { type: 'success' });
                    
                    return this.localPermissions;
                }
            }
            
            console.log('❌ Could not auto-detect real user, using demo permissions');
            return null;
            
        } catch (error) {
            console.error('Error auto-detecting real user:', error);
            console.log('Using demo permissions as fallback');
            return null;
        }
    }

    // Force real user detection and override demo user
    async forceRealUserDetection() {
        console.log('=== FORCING REAL USER DETECTION ===');
        console.log('Current userPermissions:', this.props.userPermissions);
        
        try {
            // Get current user info first
            const currentUserInfo = await this.getCurrentUserInfo();
            
            if (currentUserInfo && currentUserInfo.user) {
                console.log('✅ Real user found:', currentUserInfo.user.name);
                
                // Get user groups
                const userGroups = await this.props.rpcCall('/web/dataset/call_kw', {
                    model: 'res.users',
                    method: 'read',
                    args: [[currentUserInfo.user.id]],
                    kwargs: {
                        fields: ['groups_id', 'name', 'login', 'email', 'active']
                    }
                });
                
                console.log('User groups:', userGroups);
                
                if (userGroups && userGroups[0] && userGroups[0].groups_id) {
                    // Get group details
                    const groupDetails = await this.props.rpcCall('/web/dataset/call_kw', {
                        model: 'res.groups',
                        method: 'read',
                        args: [userGroups[0].groups_id],
                        kwargs: {
                            fields: ['name', 'category_id', 'full_name']
                        }
                    });
                    
                    console.log('Group details:', groupDetails);
                    
                    // Create real user permissions and set as local permissions
                    this.localPermissions = this.createRealUserPermissions(userGroups[0], groupDetails);
                    this.useLocalPermissions = true;
                    
                    console.log('✅ Forced real user permissions:', this.localPermissions);
                    
                    this.notification.add(`✅ Forced real user: ${userGroups[0].name} - Local permissions updated`, { type: 'success' });
                    
                    return this.localPermissions;
                }
            }
            
            this.notification.add('❌ Could not detect real user', { type: 'warning' });
            return null;
            
        } catch (error) {
            console.error('Error forcing real user detection:', error);
            this.notification.add('Error forcing real user detection: ' + error.message, { type: 'danger' });
            return null;
        }
    }

    // Create real user permissions object
    createRealUserPermissions(user, groups) {
        console.log('Creating real user permissions for:', user.name);
        
        const realUserPermissions = {
            role: 'real_user',
            user_id: user.id,
            user_name: user.name,
            user_login: user.login,
            user_email: user.email,
            is_active: user.active,
            groups: groups,
            permissions: {
                can_view_details: this.hasRoleInGroups(groups, ['Farm Manager', 'Farm Owner', 'Administrator', 'Manager', 'Inventory']),
                can_create_receipts: this.hasRoleInGroups(groups, ['Farm Manager', 'Farm Owner', 'Administrator', 'Manager']),
                can_create_deliveries: this.hasRoleInGroups(groups, ['Farm Manager', 'Farm Owner', 'Administrator', 'Manager']),
                can_create_transfers: this.hasRoleInGroups(groups, ['Farm Manager', 'Farm Owner', 'Administrator', 'Manager']),
                can_adjust_stock: this.hasRoleInGroups(groups, ['Farm Manager', 'Farm Owner', 'Administrator', 'Manager']),
                can_edit_receipts: this.hasRoleInGroups(groups, ['Farm Manager', 'Farm Owner', 'Administrator', 'Manager']),
                can_edit_deliveries: this.hasRoleInGroups(groups, ['Farm Manager', 'Farm Owner', 'Administrator', 'Manager']),
                can_edit_transfers: this.hasRoleInGroups(groups, ['Farm Manager', 'Farm Owner', 'Administrator', 'Manager']),
                can_print_documents: this.hasRoleInGroups(groups, ['Farm Manager', 'Farm Owner', 'Administrator', 'Manager']),
                can_delete_records: this.hasRoleInGroups(groups, ['Farm Manager', 'Farm Owner', 'Administrator']),
                is_manager: this.hasRoleInGroups(groups, ['Manager', 'Farm Manager']),
                is_admin: this.hasRoleInGroups(groups, ['Administrator', 'Farm Owner']),
                can_access_inventory: this.hasRoleInGroups(groups, ['Inventory', 'Stock Manager', 'Farm Manager', 'Farm Owner']),
                farm_manager: this.hasRoleInGroups(groups, ['Farm Manager']),
                farm_owner: this.hasRoleInGroups(groups, ['Farm Owner']),
                farm_accountant: this.hasRoleInGroups(groups, ['Farm Accountant']),
                dashboard_access: this.hasRoleInGroups(groups, ['Farm Dashboard Access', 'Farm Manager', 'Farm Owner'])
            }
        };
        
        console.log('Real user permissions created:', realUserPermissions);
        return realUserPermissions;
    }

    // Test permissions after forcing real user
    testRealUserPermissions() {
        console.log('=== TESTING REAL USER PERMISSIONS ===');
        
        const permissionResults = {
            canViewDetails: this.canViewDetails(),
            canCreateReceipt: this.canCreateReceipt(),
            canCreateDelivery: this.canCreateDelivery(),
            canCreateTransfer: this.canCreateTransfer(),
            canAdjustStock: this.canAdjustStock(),
            canEditReceipt: this.canEditReceipt(),
            canEditDelivery: this.canEditDelivery(),
            canEditTransfer: this.canEditTransfer(),
            canPrintDocuments: this.canPrintDocuments(),
            canDeleteRecords: this.canDeleteRecords()
        };
        
        console.log('Real user permission results:', permissionResults);
        
        const allPermissionsGranted = Object.values(permissionResults).every(perm => perm === true);
        console.log('All permissions granted:', allPermissionsGranted);
        
        if (allPermissionsGranted) {
            this.notification.add('✅ Real user has all permissions - interactive actions should work', { type: 'success' });
        } else {
            this.notification.add('❌ Real user missing some permissions - check console', { type: 'warning' });
        }
        
        return permissionResults;
    }

    // Check current permission status
    checkPermissionStatus() {
        console.log('=== CHECKING PERMISSION STATUS ===');
        console.log('Props userPermissions:', this.props.userPermissions);
        console.log('Local permissions:', this.localPermissions);
        console.log('Use local permissions:', this.useLocalPermissions);
        
        const status = {
            propsRole: this.props.userPermissions?.role,
            localRole: this.localPermissions?.role,
            useLocal: this.useLocalPermissions,
            hasLocalPermissions: !!this.localPermissions,
            currentPermissions: {
                canViewDetails: this.canViewDetails(),
                canCreateReceipt: this.canCreateReceipt(),
                canCreateDelivery: this.canCreateDelivery(),
                canCreateTransfer: this.canCreateTransfer(),
                canAdjustStock: this.canAdjustStock()
            }
        };
        
        console.log('Permission status:', status);
        this.notification.add('Permission status checked - see console for details', { type: 'info' });
        
        return status;
    }

    // Enable full permissions for testing
    enableFullPermissions() {
        console.log('=== ENABLING FULL PERMISSIONS ===');
        
        this.localPermissions = {
            role: 'full_permissions',
            user_name: 'Full Access User',
            permissions: {
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
                is_manager: true,
                is_admin: true,
                can_access_inventory: true,
                farm_manager: true,
                farm_owner: true,
                farm_accountant: true,
                dashboard_access: true
            }
        };
        
        this.useLocalPermissions = true;
        
        console.log('✅ Full permissions enabled:', this.localPermissions);
        this.notification.add('✅ Full permissions enabled - all actions should work', { type: 'success' });
        
        return this.localPermissions;
    }

    // Comprehensive permission and role debugging
    async debugEverything() {
        console.log('=== COMPREHENSIVE DEBUG STARTING ===');
        
        // 1. Debug current permissions
        console.log('1. Current userPermissions object:');
        console.log(this.props.userPermissions);
        
        // 2. Test permission methods
        console.log('2. Testing all permission methods:');
        const permissions = this.debugUserPermissions();
        
        // 3. Force real user detection
        console.log('3. Forcing real user detection:');
        try {
            const realUser = await this.forceRealUserDetection();
            console.log('Real user detection result:', realUser);
        } catch (error) {
            console.log('Error forcing real user detection:', error);
        }
        
        // 4. Test permissions after real user detection
        console.log('4. Testing permissions after real user detection:');
        this.testRealUserPermissions();
        
        // 5. Test a specific action
        console.log('5. Testing receipt reference click:');
        this.testReceiptReferenceClick();
        
        // 6. Test interactive actions
        console.log('6. Testing interactive actions:');
        this.testStage1Actions();
        
        this.notification.add('Comprehensive debug completed - check console for all details', { type: 'info' });
        
        return {
            originalPermissions: permissions,
            debugComplete: true
        };
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