from odoo import fields, models, api, _
from odoo.exceptions import UserError, AccessError
import logging

_logger = logging.getLogger(__name__)


class FarmDashboard(models.Model):
    """Farm Management Dashboard
    
    Main model for farm dashboard configurations and settings.
    Manages user-specific dashboard layouts and preferences.
    """
    _name = 'farm.dashboard'
    _description = _('Farm Management Dashboard')
    _rec_name = 'name'
    _order = 'create_date desc'

    name = fields.Char(
        string=_('Dashboard Name'), 
        required=True, 
        default=_('Farm Dashboard')
    )
    user_id = fields.Many2one(
        'res.users', 
        string=_('User'), 
        default=lambda self: self.env.user,
        required=True,
        index=True
    )
    company_id = fields.Many2one(
        'res.company', 
        string=_('Company'), 
        required=True,
        default=lambda self: self.env.company,
        index=True
    )
    
    # Dashboard configuration
    active = fields.Boolean(string=_('Active'), default=True)
    dashboard_type = fields.Selection([
        ('overview', _('Overview')),
        ('projects', _('Projects')),
        ('crops', _('Crops')),
        ('financials', _('Financials')),
        ('sales', _('Sales')),
        ('purchases', _('Purchases')),
        ('inventory', _('Inventory')),
        ('reports', _('Reports')),
    ], string=_('Dashboard Type'), default='overview', required=True)
    
    # Access control
    access_level = fields.Selection([
        ('owner', _('Owner')),
        ('manager', _('Manager')),
        ('user', _('User')),
    ], string=_('Access Level'), default='user', required=True)
    
    # Dashboard settings
    auto_refresh = fields.Boolean(string=_('Auto Refresh'), default=False)
    refresh_interval = fields.Integer(
        string=_('Refresh Interval (seconds)'), 
        default=300
    )
    
    # Metadata
    create_date = fields.Datetime(string=_('Created On'), readonly=True)
    create_uid = fields.Many2one(
        'res.users', 
        string=_('Created By'), 
        readonly=True
    )
    write_date = fields.Datetime(string=_('Last Updated'), readonly=True)
    write_uid = fields.Many2one(
        'res.users', 
        string=_('Last Updated By'), 
        readonly=True
    )

    @api.model
    def get_dashboard_data(self, filters=None, tab=None):
        """Get dashboard data for the current user
        
        This is the main entry point for fetching dashboard data.
        Delegates to farm.dashboard.data model for actual data retrieval.
        
        Args:
            filters (dict): Optional filters to apply
            tab (str): Tab name (overview, projects, crops, etc.)
            
        Returns:
            dict: Dashboard data with KPIs, charts, and metrics
        """
        # Check access before fetching data
        if not self._check_dashboard_access():
            raise AccessError(_('You do not have permission to access the farm dashboard.'))
        
        # Delegate to farm.dashboard.data for data fetching
        dashboard_data = self.env['farm.dashboard.data']
        return dashboard_data.get_dashboard_data(filters, tab)

    def _check_dashboard_access(self):
        """Internal method to check if current user has dashboard access
        
        Returns:
            bool: True if user has access, False otherwise
        """
        user = self.env.user
        
        # System admin always has access
        if user.has_group('base.group_system'):
            return True
            
        # Check farm dashboard specific groups
        if user.has_group('farm_management_dashboard.group_farm_dashboard_access'):
            return True
            
        # Check farm management module groups as fallback
        if user.has_group('farm_management.group_farm_user'):
            return True
            
        return False

    @api.model
    def check_access_rights(self, operation, raise_exception=True):
        """Override to enforce access control on all operations
        
        Args:
            operation (str): Operation type ('read', 'write', 'create', 'unlink')
            raise_exception (bool): Whether to raise exception on access denial
            
        Returns:
            bool: True if access granted
            
        Raises:
            AccessError: If access denied and raise_exception is True
        """
        try:
            # Always check parent access rights first
            res = super(FarmDashboard, self).check_access_rights(operation, raise_exception=False)
            
            # Additional check for dashboard access
            if not self._check_dashboard_access():
                if raise_exception:
                    raise AccessError(
                        _('You do not have access to farm dashboards. '
                          'Please contact your administrator to grant you the required permissions.')
                    )
                return False
                
            return res
        except AccessError as e:
            if raise_exception:
                raise
            return False

    def check_access_rule(self, operation):
        """Override to add record-level access control
        
        Args:
            operation (str): Operation type ('read', 'write', 'create', 'unlink')
        """
        super(FarmDashboard, self).check_access_rule(operation)
        
        # For read operations, apply additional filtering
        if operation == 'read':
            user = self.env.user
            # Owners and managers can see all dashboards in their company
            if not user.has_group('farm_management_dashboard.group_farm_owner'):
                if not user.has_group('farm_management_dashboard.group_farm_manager'):
                    # Regular users only see their own dashboards
                    for record in self:
                        if record.user_id != user and record.company_id == user.company_id:
                            raise AccessError(
                                _('You can only view your own dashboards.')
                            )

    def action_refresh_dashboard(self):
        """Action to refresh dashboard data
        
        Returns:
            dict: Action to reload the dashboard
        """
        self.ensure_one()
        
        # Check access
        if not self._check_dashboard_access():
            raise AccessError(_('You do not have permission to refresh this dashboard.'))
            
        return {
            'type': 'ir.actions.client',
            'tag': 'reload',
        }

    @api.model
    def create_default_dashboard(self, user_id=None):
        """Create a default dashboard for a user
        
        Args:
            user_id (int, optional): User ID. Defaults to current user.
            
        Returns:
            farm.dashboard: Created or existing dashboard record
        """
        if not user_id:
            user_id = self.env.user.id
            
        # Check if user should have access
        target_user = self.env['res.users'].browse(user_id)
        if not (target_user.has_group('farm_management_dashboard.group_farm_dashboard_access') or
                target_user.has_group('farm_management.group_farm_user') or
                target_user.has_group('base.group_system')):
            raise AccessError(
                _('Cannot create dashboard for user without dashboard access rights.')
            )
            
        existing = self.search([('user_id', '=', user_id)], limit=1)
        if existing:
            return existing
            
        return self.create({
            'name': _('Farm Dashboard - %s') % target_user.name,
            'user_id': user_id,
            'dashboard_type': 'overview',
            'access_level': 'user',
        })

    @api.model
    def search_read(self, domain=None, fields=None, offset=0, limit=None, order=None):
        """Override search_read to filter dashboards based on access
        
        Returns only dashboards the current user has permission to see.
        """
        user = self.env.user
        
        # Add domain filter for user access
        if not user.has_group('farm_management_dashboard.group_farm_owner'):
            if not user.has_group('farm_management_dashboard.group_farm_manager'):
                # Regular users only see their own dashboards
                domain = domain or []
                domain = [('user_id', '=', user.id)] + domain
        
        # Add company filter
        domain = domain or []
        if not user.has_group('base.group_system'):
            domain = [('company_id', 'in', user.company_ids.ids)] + domain
                
        return super(FarmDashboard, self).search_read(
            domain=domain, 
            fields=fields, 
            offset=offset, 
            limit=limit, 
            order=order
        )

