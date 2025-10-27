from odoo import fields, models, api, _
from odoo.exceptions import UserError, AccessError
import logging

_logger = logging.getLogger(__name__)


class FarmDashboard(models.Model):
    _name = 'farm.dashboard'
    _description = 'Farm Management Dashboard'
    _rec_name = 'name'
    _order = 'create_date desc'

    name = fields.Char(string='Dashboard Name', required=True, default='Farm Dashboard')
    user_id = fields.Many2one('res.users', string='User', default=lambda self: self.env.user)
    company_id = fields.Many2one('res.company', string='Company', default=lambda self: self.env.company)
    
    # Dashboard configuration
    active = fields.Boolean(string='Active', default=True)
    dashboard_type = fields.Selection([
        ('overview', 'Overview'),
        ('projects', 'Projects'),
        ('crops', 'Crops'),
        ('financials', 'Financials'),
        ('sales', 'Sales'),
        ('purchases', 'Purchases'),
        ('inventory', 'Inventory'),
        ('reports', 'Reports'),
    ], string='Dashboard Type', default='overview')
    
    # Access control
    access_level = fields.Selection([
        ('owner', 'Owner'),
        ('manager', 'Manager'),
        ('user', 'User'),
    ], string='Access Level', default='user')
    
    # Dashboard settings
    auto_refresh = fields.Boolean(string='Auto Refresh', default=False)
    refresh_interval = fields.Integer(string='Refresh Interval (seconds)', default=300)
    
    # Metadata
    create_date = fields.Datetime(string='Created On', readonly=True)
    create_uid = fields.Many2one('res.users', string='Created By', readonly=True)
    write_date = fields.Datetime(string='Last Updated', readonly=True)
    write_uid = fields.Many2one('res.users', string='Last Updated By', readonly=True)

    @api.model
    def get_dashboard_data(self):
        """Get dashboard data for the current user"""
        dashboard_data = self.env['farm.dashboard.data']
        return dashboard_data.get_overview_data()

    @api.model
    def check_access_rights(self, operation, raise_exception=True):
        """Check access rights for dashboard operations"""
        try:
            # Check if user has farm dashboard access
            if self.env.user.has_group('farm_management_dashboard.group_farm_dashboard_access'):
                return True
            # Check if user has farm management access
            if self.env.user.has_group('farm_management.group_farm_user'):
                return True
            # Admin always has access
            if self.env.user.has_group('base.group_system'):
                return True
                
            if raise_exception:
                raise AccessError(_('You do not have access to the farm dashboard.'))
            return False
        except Exception as e:
            if raise_exception:
                raise AccessError(_('Access denied: %s') % str(e))
            return False

    def action_refresh_dashboard(self):
        """Action to refresh dashboard data"""
        self.ensure_one()
        return {
            'type': 'ir.actions.client',
            'tag': 'reload',
        }

    @api.model
    def create_default_dashboard(self, user_id=None):
        """Create a default dashboard for a user"""
        if not user_id:
            user_id = self.env.user.id
            
        existing = self.search([('user_id', '=', user_id)], limit=1)
        if existing:
            return existing
            
        return self.create({
            'name': _('Farm Dashboard - %s') % self.env.user.name,
            'user_id': user_id,
            'dashboard_type': 'overview',
            'access_level': 'user',
        })

