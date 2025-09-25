/** @odoo-module **/

import { Component, useState, onMounted, onWillUnmount } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { SmartButton } from "../common/smart_button";

export class FinancialsTab extends Component {
    static template = "farm_management_dashboard.FinancialsTabTemplate";
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
            selectedView: 'overview', // 'overview', 'budget_analysis', 'profitability', 'cash_flow', 'cost_breakdown'
            selectedProject: null,
            showFilters: false,
            showProjectDetail: false,
            filters: {
                search: '',
                farm_id: '',
                crop_id: '',
                cost_type: '',
                date_from: '',
                date_to: '',
                sort_by: 'profit',
                sort_order: 'desc'
            },
            selectedTimeRange: '6months', // '3months', '6months', '1year', 'ytd'
        });
        
        this.notification = useService("notification");
        this.charts = {};
        
        onMounted(() => {
            this.restoreFiltersFromStorage();
            this.renderFinancialCharts();
        });
        
        onWillUnmount(() => {
            this.destroyCharts();
        });
    }
    
    // ===== COMPUTED PROPERTIES =====
    
    get analyticalAccounts() {
        return this.props.data.analytical_accounts || {};
    }
    
    get invoicesBills() {
        return this.props.data.invoices_bills || {};
    }
    
    get payments() {
        return this.props.data.payments || {};
    }
    
    get financialStatements() {
        return this.props.data.financial_statements || {};
    }
    
    get cashFlowStatement() {
        return this.props.data.cash_flow_statement || {};
    }
    
    get agedAnalysis() {
        return this.props.data.aged_analysis || {};
    }
    
    get journalAnalysis() {
        return this.props.data.journal_analysis || {};
    }
    
    get taxAnalysis() {
        return this.props.data.tax_analysis || {};
    }
    
    get farmBudgetAnalysis() {
        return this.props.data.farm_budget_analysis || {};
    }
    
    get financialKPIs() {
        return this.props.data.financial_kpis || {};
    }
    
    get financialAlerts() {
        return this.props.data.financial_alerts || [];
    }
    
    get summary() {
        return this.props.data.summary || {};
    }
    
    // Quick Actions for Financials Tab
    get quickActions() {
        console.log('🔧 Generating quick actions for financials tab');
        const actions = [
            { icon: 'fa-plus-circle', label: 'New Invoice', type: 'primary', size: 'sm', action: 'account.move', permission: 'can_create_invoices' },
            { icon: 'fa-receipt', label: 'New Bill', type: 'success', size: 'sm', action: 'account.move', permission: 'can_create_bills' },
            { icon: 'fa-credit-card', label: 'New Payment', type: 'primary', size: 'sm', action: 'account.payment', permission: 'can_create_payments' },
            { icon: 'fa-chart-line', label: 'Financial Reports', type: 'secondary', size: 'sm', action: 'account.move', permission: 'can_view_financials' },
            { icon: 'fa-calculator', label: 'Budget Planning', type: 'secondary', size: 'sm', action: 'account.analytic.account', permission: 'can_view_financials' }
        ];
        console.log('🔧 Generated quick actions:', actions);
        return actions;
    }

    get smartActions() {
        const actions = [];
        
        // Add smart actions based on financial data
        if (this.props.data?.financial_alerts && Array.isArray(this.props.data.financial_alerts)) {
            const alerts = this.props.data.financial_alerts;
            if (alerts.length > 0) {
                actions.push({
                    icon: 'fa-exclamation-triangle',
                    label: 'Financial Alerts',
                    type: 'warning',
                    size: 'sm',
                    action: 'account.move',
                    permission: 'can_view_financials',
                    filterInfo: {
                        domain: [['state', 'in', ['draft', 'posted']]],
                        context: { 'search_default_alerts': 1 }
                    }
                });
            }
        }
        
        // Check for overdue invoices
        if (this.props.data?.aged_analysis && Array.isArray(this.props.data.aged_analysis)) {
            const overdueInvoices = this.props.data.aged_analysis.filter(item => item.overdue_amount > 0);
            if (overdueInvoices.length > 0) {
                actions.push({
                    icon: 'fa-clock',
                    label: 'Overdue Invoices',
                    type: 'danger',
                    size: 'sm',
                    action: 'account.move',
                    permission: 'can_view_financials',
                    filterInfo: {
                        domain: [['invoice_date_due', '<', new Date().toISOString().split('T')[0]]],
                        context: { 'search_default_overdue': 1 }
                    }
                });
            }
        }
        
        // Check for high-value transactions
        if (this.props.data?.financial_kpis) {
            const kpis = this.props.data.financial_kpis;
            if (kpis.total_revenue > 10000) {
                actions.push({
                    icon: 'fa-dollar-sign',
                    label: 'High Value Transactions',
                    type: 'success',
                    size: 'sm',
                    action: 'account.move',
                    permission: 'can_view_financials',
                    filterInfo: {
                        domain: [['amount_total', '>', 1000]],
                        context: { 'search_default_high_value': 1 }
                    }
                });
            }
        }
        
        console.log('🔧 Generated smart actions:', actions);
        return actions;
    }
    
    // ===== VIEW METHODS =====
    
    onChangeView(view) {
        this.state.selectedView = view;
        setTimeout(() => this.renderFinancialCharts(), 100);
    }
    
    onToggleFilters() {
        this.state.showFilters = !this.state.showFilters;
    }
    
    onViewProjectDetail(project) {
        this.state.selectedProject = project;
        this.state.showProjectDetail = true;
    }
    
    onCloseProjectDetail() {
        this.state.selectedProject = null;
        this.state.showProjectDetail = false;
    }
    
    restoreFiltersFromStorage() {
        // Simplified for now
    }
    
    // ===== CHART METHODS =====
    
    renderFinancialCharts() {
        setTimeout(() => {
            if (this.state.selectedView === 'overview') {
                this.renderRevenueExpenseChart();
                this.renderAgedAnalysisChart();
            } else if (this.state.selectedView === 'analytical_accounts') {
                this.renderAnalyticalAccountsChart();
            } else if (this.state.selectedView === 'invoices_bills') {
                this.renderInvoicesBillsChart();
                this.renderInvoicesStatusChart();
            } else if (this.state.selectedView === 'cash_flow') {
                this.renderCashFlowChart();
                this.renderPaymentMethodsChart();
            } else if (this.state.selectedView === 'financial_statements') {
                this.renderProfitLossChart();
                this.renderBalanceSheetChart();
            }
        }, 100);
    }
    
    renderRevenueExpenseChart() {
        const canvas = document.getElementById('revenueExpenseChart');
        if (!canvas) return;
        
        if (this.charts.revenueExpense) {
            this.charts.revenueExpense.destroy();
        }
        
        const ctx = canvas.getContext('2d');
        this.charts.revenueExpense = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Revenue', 'Expenses', 'Net Income'],
                datasets: [{
                    label: 'Amount',
                    data: [
                        this.summary.total_revenue || 0,
                        this.summary.total_expenses || 0,
                        this.summary.net_income || 0
                    ],
                    backgroundColor: [
                        'rgba(75, 192, 192, 0.8)',
                        'rgba(255, 99, 132, 0.8)',
                        'rgba(54, 162, 235, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Revenue vs Expenses Analysis'
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
                }
            }
        });
    }
    
    renderAgedAnalysisChart() {
        if (!this.agedAnalysis.receivables) return;
        
        const canvas = document.getElementById('agedAnalysisChart');
        if (!canvas) return;
        
        if (this.charts.agedAnalysis) {
            this.charts.agedAnalysis.destroy();
        }
        
        const receivables = this.agedAnalysis.receivables;
        const payables = this.agedAnalysis.payables;
        
        const ctx = canvas.getContext('2d');
        this.charts.agedAnalysis = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['0-30 Days', '31-60 Days', '61-90 Days', '90+ Days'],
                datasets: [
                    {
                        label: 'Receivables',
                        data: [
                            receivables['0-30'] || 0,
                            receivables['31-60'] || 0,
                            receivables['61-90'] || 0,
                            receivables['90+'] || 0
                        ],
                        backgroundColor: 'rgba(75, 192, 192, 0.8)'
                    },
                    {
                        label: 'Payables',
                        data: [
                            -(payables['0-30'] || 0),
                            -(payables['31-60'] || 0),
                            -(payables['61-90'] || 0),
                            -(payables['90+'] || 0)
                        ],
                        backgroundColor: 'rgba(255, 99, 132, 0.8)'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Aged Receivables & Payables'
                    }
                },
                scales: {
                    y: {
                        ticks: {
                            callback: function(value) {
                                return '$' + Math.abs(value).toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }
    
    renderAnalyticalAccountsChart() {
        if (!this.analyticalAccounts.accounts) return;
        
        const canvas = document.getElementById('analyticalAccountsChart');
        if (!canvas) return;
        
        if (this.charts.analyticalAccounts) {
            this.charts.analyticalAccounts.destroy();
        }
        
        const accounts = this.analyticalAccounts.accounts.slice(0, 10); // Top 10
        
        const ctx = canvas.getContext('2d');
        this.charts.analyticalAccounts = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: accounts.map(a => a.name),
                datasets: [{
                    label: 'Balance',
                    data: accounts.map(a => a.balance),
                    backgroundColor: accounts.map(a => a.balance >= 0 ? 'rgba(75, 192, 192, 0.8)' : 'rgba(255, 99, 132, 0.8)')
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // This makes it horizontal
                plugins: {
                    title: {
                        display: true,
                        text: 'Analytical Accounts Balance'
                    }
                },
                scales: {
                    x: {
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
    
    renderCashFlowChart() {
        if (!this.payments.daily_cash_flow) return;
        
        const canvas = document.getElementById('cashFlowChart');
        if (!canvas) return;
        
        if (this.charts.cashFlow) {
            this.charts.cashFlow.destroy();
        }
        
        const dailyData = Object.entries(this.payments.daily_cash_flow).slice(-30); // Last 30 days
        
        const ctx = canvas.getContext('2d');
        this.charts.cashFlow = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dailyData.map(([date]) => date),
                datasets: [
                    {
                        label: 'Inbound',
                        data: dailyData.map(([, data]) => data.inbound),
                        borderColor: 'rgba(75, 192, 192, 1)',
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        fill: false
                    },
                    {
                        label: 'Outbound',
                        data: dailyData.map(([, data]) => -data.outbound),
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Daily Cash Flow (Last 30 Days)'
                    }
                },
                scales: {
                    y: {
                        ticks: {
                            callback: function(value) {
                                return '$' + Math.abs(value).toLocaleString();
                            }
                        }
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
    
    renderInvoicesBillsChart() {
        const canvas = document.getElementById('invoicesBillsChart');
        if (!canvas || !this.invoicesBills.customer_invoices || !this.invoicesBills.vendor_bills) return;
        
        if (this.charts.invoicesBills) {
            this.charts.invoicesBills.destroy();
        }
        
        // Combine monthly trends from both invoices and bills
        const invoiceTrends = this.invoicesBills.customer_invoices.monthly_trends || {};
        const billTrends = this.invoicesBills.vendor_bills.monthly_trends || {};
        
        // Create combined labels and data
        const allMonths = new Set([...Object.keys(invoiceTrends), ...Object.keys(billTrends)]);
        const labels = Array.from(allMonths).sort();
        const invoiceData = labels.map(month => invoiceTrends[month]?.amount || 0);
        const billData = labels.map(month => billTrends[month]?.amount || 0);
        
        const ctx = canvas.getContext('2d');
        this.charts.invoicesBills = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Invoices',
                        data: invoiceData,
                        borderColor: 'rgba(75, 192, 192, 1)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        tension: 0.4
                    },
                    {
                        label: 'Bills',
                        data: billData,
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Monthly Invoice & Bill Trends'
                    }
                },
                scales: {
                    y: {
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
    
    renderInvoicesStatusChart() {
        const canvas = document.getElementById('invoicesStatusChart');
        if (!canvas || !this.invoicesBills.customer_invoices) return;
        
        if (this.charts.invoicesStatus) {
            this.charts.invoicesStatus.destroy();
        }
        
        // Create status distribution from available data
        const invoices = this.invoicesBills.customer_invoices;
        const bills = this.invoicesBills.vendor_bills || {};
        
        const statusData = {
            labels: ['Invoices', 'Bills'],
            data: [invoices.count || 0, bills.count || 0]
        };
        
        const ctx = canvas.getContext('2d');
        this.charts.invoicesStatus = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: statusData.labels,
                datasets: [{
                    data: statusData.data,
                    backgroundColor: [
                        'rgba(75, 192, 192, 0.8)',  // Invoices - Teal
                        'rgba(255, 99, 132, 0.8)'   // Bills - Red
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    renderPaymentMethodsChart() {
        const canvas = document.getElementById('paymentMethodsChart');
        if (!canvas || !this.payments.payment_methods) return;
        
        if (this.charts.paymentMethods) {
            this.charts.paymentMethods.destroy();
        }
        
        // Convert payment methods object to arrays
        const methods = this.payments.payment_methods || {};
        const methodData = {
            labels: Object.keys(methods),
            data: Object.values(methods).map(m => m.amount || 0)
        };
        
        const ctx = canvas.getContext('2d');
        this.charts.paymentMethods = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: methodData.labels || [],
                datasets: [{
                    data: methodData.data || [],
                    backgroundColor: [
                        'rgba(54, 162, 235, 0.8)',
                        'rgba(255, 99, 132, 0.8)',
                        'rgba(255, 205, 86, 0.8)',
                        'rgba(75, 192, 192, 0.8)',
                        'rgba(153, 102, 255, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                return `${label}: $${value.toLocaleString()}`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    renderProfitLossChart() {
        // Profit & Loss chart - currently handled by template tables
        // Could be implemented as a bar chart showing revenue vs expenses
        console.log('Profit & Loss chart rendering - handled by template');
    }
    
    renderBalanceSheetChart() {
        // Balance Sheet chart - currently handled by template tables  
        // Could be implemented as a horizontal bar chart showing assets vs liabilities
        console.log('Balance Sheet chart rendering - handled by template');
    }
    
    // Helper methods for template
    getInvoiceStatusClass(state) {
        const statusClasses = {
            'draft': 'bg-secondary',
            'open': 'bg-warning',
            'in_payment': 'bg-info',
            'paid': 'bg-success',
            'cancel': 'bg-danger'
        };
        return statusClasses[state] || 'bg-secondary';
    }
    
    getInvoiceStatusLabel(state) {
        const statusLabels = {
            'draft': 'Draft',
            'open': 'Open',
            'in_payment': 'In Payment',
            'paid': 'Paid',
            'cancel': 'Cancelled'
        };
        return statusLabels[state] || state.charAt(0).toUpperCase() + state.slice(1);
    }
    
    getPaymentStatusClass(state) {
        const statusClasses = {
            'draft': 'bg-secondary',
            'posted': 'bg-success',
            'sent': 'bg-info',
            'reconciled': 'bg-primary',
            'cancelled': 'bg-danger'
        };
        return statusClasses[state] || 'bg-secondary';
    }
    
    getPaymentStatusLabel(state) {
        const statusLabels = {
            'draft': 'Draft',
            'posted': 'Posted',
            'sent': 'Sent',
            'reconciled': 'Reconciled',
            'cancelled': 'Cancelled'
        };
        return statusLabels[state] || state.charAt(0).toUpperCase() + state.slice(1);
    }
    
    // ===== UTILITY METHODS =====
    
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount || 0);
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
    
    getVarianceClass(variance) {
        if (variance > 0) return 'text-danger'; // Over budget
        if (variance < -5) return 'text-success'; // Under budget
        return 'text-warning'; // Close to budget
    }
    
    getProfitClass(profit) {
        if (profit > 0) return 'text-success';
        return 'text-danger';
    }
    
    getAlertClass(severity) {
        const classes = {
            'high': 'alert-danger',
            'medium': 'alert-warning',
            'low': 'alert-info',
            'info': 'alert-info'
        };
        return classes[severity] || 'alert-secondary';
    }
    
    showNotification(message, type = 'info') {
        if (this.notification) {
            this.notification.add(message, { type, sticky: false });
        }
    }
    
    formatDate(dateString) {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString();
    }
    
    formatDateTime(dateTimeString) {
        if (!dateTimeString) return '';
        return new Date(dateTimeString).toLocaleString();
    }
}
