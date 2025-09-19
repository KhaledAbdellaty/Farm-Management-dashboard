from odoo import fields, models, api, _
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)


class FarmDashboardKPI(models.AbstractModel):
    _name = 'farm.dashboard.kpi'
    _description = 'Farm Dashboard KPI Calculations'
    
    @api.model
    def calculate_overview_kpis(self, filters=None):
        """Calculate KPIs for overview tab"""
        filters = filters or {}
        domain = self._build_domain(filters)
        
        # Get projects data with single read_group query
        project_data = self.env['farm.cultivation.project'].read_group(
            domain,
            ['state', 'budget:sum', 'actual_cost:sum', 'revenue:sum', 'field_area:sum'],
            ['state']
        )
        
        # Calculate totals
        totals = {
            'total_projects': 0,
            'active_projects': 0,
            'total_area': 0,
            'total_budget': 0,
            'total_actual_cost': 0,
            'total_revenue': 0,
            'total_profit': 0,
        }
        
        # Get active states from dashboard data model
        active_states = self.env['farm.dashboard.data']._get_active_project_states()
        
        for data in project_data:
            state = data['state']
            count = data['state_count']
            
            totals['total_projects'] += count
            if state in active_states:
                totals['active_projects'] += count
            
            totals['total_area'] += data['field_area'] or 0
            totals['total_budget'] += data['budget'] or 0
            totals['total_actual_cost'] += data['actual_cost'] or 0
            totals['total_revenue'] += data['revenue'] or 0
        
        totals['total_profit'] = totals['total_revenue'] - totals['total_actual_cost']
        
        return totals
    
    @api.model
    def calculate_projects_kpis(self, filters=None):
        """Calculate KPIs for projects tab"""
        filters = filters or {}
        domain = self._build_domain(filters)
        
        projects = self.env['farm.cultivation.project'].search(domain)
        
        return {
            'total_projects': len(projects),
            'active_projects': len(projects.filtered(lambda p: self.env['farm.dashboard.data']._is_project_active(p.state))),
            'completed_projects': len(projects.filtered(lambda p: p.state == 'done')),
            'overdue_projects': len(projects.filtered(lambda p: p.planned_end_date and p.planned_end_date < fields.Date.today() and p.state not in ['done', 'cancel'])),
            'avg_project_duration': self._calculate_avg_duration(projects),
            'completion_rate': self._calculate_completion_rate(projects),
        }
    
    @api.model
    def calculate_financial_kpis(self, filters=None):
        """Calculate KPIs for financial tab"""
        filters = filters or {}
        domain = self._build_domain(filters)
        
        projects = self.env['farm.cultivation.project'].search(domain)
        
        total_budget = sum(projects.mapped('budget'))
        total_actual = sum(projects.mapped('actual_cost'))
        total_revenue = sum(projects.mapped('revenue'))
        total_profit = sum(projects.mapped('profit'))
        
        return {
            'total_budget': total_budget,
            'total_actual_cost': total_actual,
            'total_revenue': total_revenue,
            'total_profit': total_profit,
            'budget_variance': (total_actual - total_budget) / total_budget * 100 if total_budget else 0,
            'profit_margin': total_profit / total_revenue * 100 if total_revenue else 0,
            'roi': total_profit / total_actual * 100 if total_actual else 0,
        }
    
    @api.model
    def calculate_inventory_kpis(self, filters=None):
        """Calculate KPIs for inventory tab"""
        # Get agricultural products
        agricultural_products = self.env['product.product'].search([
            ('categ_id.name', 'in', ['Agricultural', 'Seeds', 'Fertilizers', 'Pesticides'])
        ])
        
        total_products = len(agricultural_products)
        low_stock_count = 0
        total_value = 0
        
        for product in agricultural_products:
            if product.qty_available < 10:  # Simple threshold
                low_stock_count += 1
            total_value += product.qty_available * product.standard_price
        
        return {
            'total_products': total_products,
            'low_stock_items': low_stock_count,
            'total_inventory_value': total_value,
            'stock_turnover': self._calculate_stock_turnover(),
        }
    
    @api.model
    def calculate_sales_kpis(self, filters=None):
        """Calculate KPIs for sales tab"""
        filters = filters or {}
        domain = self._build_domain(filters)
        
        projects = self.env['farm.cultivation.project'].search(domain)
        sales_orders = self.env['sale.order'].search([
            ('cultivation_project_id', 'in', projects.ids)
        ])
        
        return {
            'total_sales_orders': len(sales_orders),
            'total_sales_amount': sum(sales_orders.mapped('amount_total')),
            'avg_order_value': sum(sales_orders.mapped('amount_total')) / len(sales_orders) if sales_orders else 0,
            'confirmed_orders': len(sales_orders.filtered(lambda so: so.state in ['sale', 'done'])),
        }
    
    @api.model
    def calculate_purchases_kpis(self, filters=None):
        """Calculate KPIs for purchases tab"""
        date_from = filters.get('date_from', fields.Date.today() - timedelta(days=30))
        
        purchase_orders = self.env['purchase.order'].search([
            ('date_order', '>=', date_from),
            ('state', 'in', ['purchase', 'done'])
        ])
        
        return {
            'total_purchase_orders': len(purchase_orders),
            'total_purchase_amount': sum(purchase_orders.mapped('amount_total')),
            'pending_receipts': len(purchase_orders.filtered(lambda po: po.state == 'purchase')),
            'avg_delivery_time': self._calculate_avg_delivery_time(purchase_orders),
        }
    
    # Helper methods
    @api.model
    def _build_domain(self, filters):
        """Build domain based on filters"""
        domain = []
        if filters.get('date_from'):
            domain.append(('start_date', '>=', filters['date_from']))
        if filters.get('date_to'):
            domain.append(('start_date', '<=', filters['date_to']))
        if filters.get('farm_ids'):
            domain.append(('farm_id', 'in', filters['farm_ids']))
        return domain
    
    @api.model
    def _calculate_avg_duration(self, projects):
        """Calculate average project duration"""
        completed_projects = projects.filtered(lambda p: p.state == 'done' and p.actual_end_date and p.start_date)
        if not completed_projects:
            return 0
        
        total_days = sum((p.actual_end_date - p.start_date).days for p in completed_projects)
        return total_days / len(completed_projects)
    
    @api.model
    def _calculate_completion_rate(self, projects):
        """Calculate project completion rate"""
        if not projects:
            return 0
        
        completed = len(projects.filtered(lambda p: p.state == 'done'))
        return completed / len(projects) * 100
    
    @api.model
    def _calculate_stock_turnover(self):
        """Calculate stock turnover rate"""
        # Simplified calculation - would need more complex logic for real implementation
        return 0
    
    @api.model
    def _calculate_avg_delivery_time(self, purchase_orders):
        """Calculate average delivery time for purchase orders"""
        # Simplified calculation
        return 0

