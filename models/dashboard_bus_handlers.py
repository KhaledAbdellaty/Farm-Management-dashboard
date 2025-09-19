from odoo import models, api, fields, _
import logging

_logger = logging.getLogger(__name__)


class DashboardBusHandlers(models.AbstractModel):
    """Handlers for real-time dashboard updates via Odoo bus"""
    _name = 'farm.dashboard.bus.handlers'
    _description = 'Farm Dashboard Bus Handlers'
    
    def _get_dashboard_channel(self, company_id=None):
        """Get the dashboard channel name for bus notifications"""
        if not company_id:
            company_id = self.env.company.id
        return f'farm_dashboard_{company_id}'
    
    def _send_dashboard_notification(self, message_type, data, company_id=None):
        """Send notification to dashboard clients"""
        try:
            channel = self._get_dashboard_channel(company_id)
            self.env['bus.bus']._sendone(channel, {
                'type': message_type,
                'data': data,
                'timestamp': fields.Datetime.now().isoformat()
            })
            _logger.debug(f"Sent dashboard notification: {message_type} to channel {channel}")
        except Exception as e:
            _logger.error(f"Failed to send dashboard notification: {str(e)}")
    
    def _invalidate_dashboard_cache(self, company_id=None):
        """Send cache invalidation notification"""
        self._send_dashboard_notification('invalidate_cache', {}, company_id)
    
    def _update_kpi_data(self, kpi_name, value, company_id=None):
        """Send KPI update notification"""
        self._send_dashboard_notification('kpi_update', {
            'kpi': kpi_name,
            'value': value
        }, company_id)


class CultivationProjectBusHandler(models.Model):
    """Bus handler for cultivation project changes"""
    _inherit = 'farm.cultivation.project'
    
    @api.model_create_multi
    def create(self, vals_list):
        """Send notification when cultivation projects are created"""
        result = super().create(vals_list)
        
        for record in result:
            # Send project creation notification
            self.env['farm.dashboard.bus.handlers']._send_dashboard_notification(
                'project_created',
                {
                    'project_id': record.id,
                    'project_name': record.name,
                    'farm_id': record.farm_id.id,
                    'state': record.state,
                    'budget': record.budget,
                },
                record.company_id.id
            )
            
            # Invalidate dashboard cache
            self.env['farm.dashboard.bus.handlers']._invalidate_dashboard_cache(record.company_id.id)
        
        return result
    
    def write(self, vals):
        """Send notification when cultivation projects are updated"""
        # Store old values for comparison
        old_values = {}
        for record in self:
            old_values[record.id] = {
                'state': record.state,
                'budget': record.budget,
                'actual_cost': record.actual_cost,
                'revenue': record.revenue,
            }
        
        result = super().write(vals)
        
        # Send notifications for significant changes
        for record in self:
            old_vals = old_values.get(record.id, {})
            
            # Check for state changes
            if 'state' in vals and old_vals.get('state') != record.state:
                self.env['farm.dashboard.bus.handlers']._send_dashboard_notification(
                    'project_state_changed',
                    {
                        'project_id': record.id,
                        'project_name': record.name,
                        'old_state': old_vals.get('state'),
                        'new_state': record.state,
                    },
                    record.company_id.id
                )
            
            # Check for budget/cost changes
            if any(field in vals for field in ['budget', 'actual_cost', 'revenue']):
                self.env['farm.dashboard.bus.handlers']._send_dashboard_notification(
                    'project_financial_updated',
                    {
                        'project_id': record.id,
                        'project_name': record.name,
                        'budget': record.budget,
                        'actual_cost': record.actual_cost,
                        'revenue': record.revenue,
                        'profit': record.profit,
                    },
                    record.company_id.id
                )
            
            # Invalidate dashboard cache
            self.env['farm.dashboard.bus.handlers']._invalidate_dashboard_cache(record.company_id.id)
        
        return result
    
    def unlink(self):
        """Send notification when cultivation projects are deleted"""
        # Store project info before deletion
        project_info = []
        for record in self:
            project_info.append({
                'project_id': record.id,
                'project_name': record.name,
                'company_id': record.company_id.id,
            })
        
        result = super().unlink()
        
        # Send deletion notifications
        for info in project_info:
            self.env['farm.dashboard.bus.handlers']._send_dashboard_notification(
                'project_deleted',
                info,
                info['company_id']
            )
            self.env['farm.dashboard.bus.handlers']._invalidate_dashboard_cache(info['company_id'])
        
        return result


class DailyReportBusHandler(models.Model):
    """Bus handler for daily report changes"""
    _inherit = 'farm.daily.report'
    
    def write(self, vals):
        """Send notification when daily reports are updated"""
        result = super().write(vals)
        
        # Send notification for state changes
        if 'state' in vals:
            for record in self:
                self.env['farm.dashboard.bus.handlers']._send_dashboard_notification(
                    'daily_report_state_changed',
                    {
                        'report_id': record.id,
                        'report_name': record.name,
                        'project_id': record.project_id.id,
                        'project_name': record.project_id.name,
                        'new_state': record.state,
                        'operation_type': record.operation_type,
                    },
                    record.company_id.id
                )
                
                # Invalidate dashboard cache
                self.env['farm.dashboard.bus.handlers']._invalidate_dashboard_cache(record.company_id.id)
        
        return result


class StockMoveBusHandler(models.Model):
    """Bus handler for stock move changes"""
    _inherit = 'stock.move'
    
    def write(self, vals):
        """Send notification when stock moves are validated"""
        result = super().write(vals)
        
        # Send notification for state changes to 'done'
        if 'state' in vals and vals['state'] == 'done':
            for record in self:
                # Only send for farm-related moves
                if record.daily_report_id or (record.picking_id and 'farm' in record.picking_id.origin.lower()):
                    self.env['farm.dashboard.bus.handlers']._send_dashboard_notification(
                        'stock_move_validated',
                        {
                            'move_id': record.id,
                            'product_id': record.product_id.id,
                            'product_name': record.product_id.name,
                            'quantity': record.product_uom_qty,
                            'location_from': record.location_id.name,
                            'location_to': record.location_dest_id.name,
                        },
                        record.company_id.id
                    )
                    
                    # Invalidate dashboard cache
                    self.env['farm.dashboard.bus.handlers']._invalidate_dashboard_cache(record.company_id.id)
        
        return result


class AnalyticLineBusHandler(models.Model):
    """Bus handler for analytic line changes"""
    _inherit = 'account.analytic.line'
    
    @api.model_create_multi
    def create(self, vals_list):
        """Send notification when analytic lines are created"""
        result = super().create(vals_list)
        
        for record in result:
            # Only send for farm-related analytic lines
            if record.daily_report_id or (record.account_id and 'farm' in record.account_id.name.lower()):
                self.env['farm.dashboard.bus.handlers']._send_dashboard_notification(
                    'analytic_line_created',
                    {
                        'line_id': record.id,
                        'account_id': record.account_id.id,
                        'account_name': record.account_id.name,
                        'amount': record.amount,
                        'date': record.date.isoformat() if record.date else None,
                    },
                    record.company_id.id
                )
                
                # Invalidate dashboard cache
                self.env['farm.dashboard.bus.handlers']._invalidate_dashboard_cache(record.company_id.id)
        
        return result


class PurchaseOrderBusHandler(models.Model):
    """Bus handler for purchase order changes"""
    _inherit = 'purchase.order'
    
    def write(self, vals):
        """Send notification when purchase orders are updated"""
        result = super().write(vals)
        
        # Send notification for state changes
        if 'state' in vals:
            for record in self:
                self.env['farm.dashboard.bus.handlers']._send_dashboard_notification(
                    'purchase_order_state_changed',
                    {
                        'order_id': record.id,
                        'order_name': record.name,
                        'partner_name': record.partner_id.name,
                        'new_state': record.state,
                        'amount_total': record.amount_total,
                    },
                    record.company_id.id
                )
                
                # Invalidate dashboard cache
                self.env['farm.dashboard.bus.handlers']._invalidate_dashboard_cache(record.company_id.id)
        
        return result


class SaleOrderBusHandler(models.Model):
    """Bus handler for sale order changes"""
    _inherit = 'sale.order'
    
    def write(self, vals):
        """Send notification when sale orders are updated"""
        result = super().write(vals)
        
        # Send notification for state changes
        if 'state' in vals:
            for record in self:
                self.env['farm.dashboard.bus.handlers']._send_dashboard_notification(
                    'sale_order_state_changed',
                    {
                        'order_id': record.id,
                        'order_name': record.name,
                        'partner_name': record.partner_id.name,
                        'new_state': record.state,
                        'amount_total': record.amount_total,
                    },
                    record.company_id.id
                )
                
                # Invalidate dashboard cache
                self.env['farm.dashboard.bus.handlers']._invalidate_dashboard_cache(record.company_id.id)
        
        return result


class ProjectTaskBusHandler(models.Model):
    """Bus handler for project task changes"""
    _inherit = 'project.task'
    
    def write(self, vals):
        """Send notification when project tasks are updated"""
        result = super().write(vals)
        
        # Send notification for stage changes
        if 'stage_id' in vals:
            for record in self:
                # Only send for farm-related projects
                if record.project_id and 'farm' in record.project_id.name.lower():
                    self.env['farm.dashboard.bus.handlers']._send_dashboard_notification(
                        'task_stage_changed',
                        {
                            'task_id': record.id,
                            'task_name': record.name,
                            'project_id': record.project_id.id,
                            'project_name': record.project_id.name,
                            'new_stage': record.stage_id.name,
                        },
                        record.company_id.id
                    )
                    
                    # Invalidate dashboard cache
                    self.env['farm.dashboard.bus.handlers']._invalidate_dashboard_cache(record.company_id.id)
        
        return result


class MaintenanceRequestBusHandler(models.Model):
    """Bus handler for maintenance request changes"""
    _inherit = 'maintenance.request'
    
    def write(self, vals):
        """Send notification when maintenance requests are updated"""
        result = super().write(vals)
        
        # Send notification for stage changes
        if 'stage_id' in vals:
            for record in self:
                self.env['farm.dashboard.bus.handlers']._send_dashboard_notification(
                    'maintenance_request_stage_changed',
                    {
                        'request_id': record.id,
                        'request_name': record.name,
                        'equipment_name': record.equipment_id.name if record.equipment_id else 'N/A',
                        'new_stage': record.stage_id.name,
                    },
                    record.company_id.id
                )
                
                # Invalidate dashboard cache
                self.env['farm.dashboard.bus.handlers']._invalidate_dashboard_cache(record.company_id.id)
        
        return result

