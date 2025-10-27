from odoo import fields, models, api, _
import logging

_logger = logging.getLogger(__name__)

class FarmDashboardAccess(models.Model):
    _name = 'farm.dashboard.access'
    _description = 'Farm Dashboard Access Control'
    
    name = fields.Char('Name', required=True)
    user_id = fields.Many2one('res.users', 'User', required=True)
    role = fields.Selection([
        ('owner', 'Farm Owner'),
        ('manager', 'Farm Manager'),
        ('accountant', 'Accountant'),
    ], string='Dashboard Role', required=True)
    
    # Tab access permissions
    can_access_overview = fields.Boolean('Overview Access', default=True)
    can_access_projects = fields.Boolean('Projects Access', default=True)
    can_access_crops = fields.Boolean('Crops Access', default=True)
    can_access_financials = fields.Boolean('Financials Access', default=False)
    can_access_sales = fields.Boolean('Sales Access', default=False)
    can_access_purchases = fields.Boolean('Purchases Access', default=False)
    can_access_inventory = fields.Boolean('Inventory Access', default=False)
    can_access_reports = fields.Boolean('Reports Access', default=True)
    
    # Additional permissions
    can_export_data = fields.Boolean('Export Data', default=False)
    can_modify_filters = fields.Boolean('Modify Global Filters', default=True)
    can_view_costs = fields.Boolean('View Cost Details', default=False)
    can_view_profits = fields.Boolean('View Profit Details', default=False)
    
    active = fields.Boolean('Active', default=True)
    company_id = fields.Many2one('res.company', 'Company', default=lambda self: self.env.company)
    
    @api.model_create_multi
    def create(self, vals_list):
        """Set default permissions based on role"""
        for vals in vals_list:
            if 'role' in vals:
                role_permissions = self._get_role_permissions(vals['role'])
                vals.update(role_permissions)
        return super().create(vals_list)
    
    def write(self, vals):
        """Update permissions when role changes"""
        if 'role' in vals:
            role_permissions = self._get_role_permissions(vals['role'])
            vals.update(role_permissions)
        return super().write(vals)
    
    @api.model
    def _get_role_permissions(self, role):
        """Get default permissions for each role"""
        permissions = {
            'owner': {
                'can_access_overview': True,
                'can_access_projects': True,
                'can_access_crops': True,
                'can_access_financials': True,
                'can_access_sales': True,
                'can_access_purchases': True,
                'can_access_inventory': True,
                'can_access_reports': True,
                'can_export_data': True,
                'can_modify_filters': True,
                'can_view_costs': True,
                'can_view_profits': True,
            },
            'manager': {
                'can_access_overview': True,
                'can_access_projects': True,
                'can_access_crops': True,
                'can_access_financials': True,
                'can_access_sales': True,
                'can_access_purchases': True,
                'can_access_inventory': True,
                'can_access_reports': True,
                'can_export_data': True,
                'can_modify_filters': True,
                'can_view_costs': True,
                'can_view_profits': False,  # Managers see costs but not detailed profits
            },
            'accountant': {
                'can_access_overview': True,
                'can_access_projects': False,
                'can_access_crops': False,
                'can_access_financials': True,
                'can_access_sales': True,
                'can_access_purchases': True,
                'can_access_inventory': True,
                'can_access_reports': True,
                'can_export_data': True,
                'can_modify_filters': False,
                'can_view_costs': True,
                'can_view_profits': True,
            }
        }
        return permissions.get(role, {})
    
    @api.model
    def get_user_permissions(self, user_id=None):
        """Get permissions for current or specified user"""
        if not user_id:
            user_id = self.env.user.id
        # Convert to integer ID if a recordset was provided
        if hasattr(user_id, '_name') and user_id._name == 'res.users':
            user_id = user_id.id
        _logger.info(f"Fetching permissions for user_id: {user_id}")
        
        # Get the user record
        user = self.env['res.users'].sudo().browse(user_id)
        _logger.info(f"Current model: {self._name}, User: {user.name}")
        
        # First determine the user's role based on security groups - consistent with dashboard_data._get_user_role
        role = None
        if user.has_group('base.group_system') or user.has_group('base.group_erp_manager'):
            # Admin users get owner role
            role = 'owner'
            _logger.info(f"User {user_id} is admin, assigned role: {role}")
        elif user.has_group('farm_management_dashboard.group_farm_owner'):
            role = 'owner'
            _logger.info(f"User {user_id} has Farm Owner group")
        elif user.has_group('farm_management_dashboard.group_farm_manager'):
            role = 'manager'
            _logger.info(f"User {user_id} has Farm Manager group")
        elif user.has_group('farm_management_dashboard.group_farm_accountant'):
            role = 'accountant'
            _logger.info(f"User {user_id} has Farm Accountant group")
        
        # If no role could be determined from security groups, don't provide access by default
        if not role:
            _logger.info(f"User {user_id} has no farm dashboard roles - no access granted")
            # Return minimal access - no access to dashboard tabs
            return {
                'role': 'no_access',
                'tabs': {
                    'overview': False,
                    'projects': False,
                    'crops': False, 
                    'financials': False,
                    'sales': False,
                    'purchases': False,
                    'inventory': False,
                    'reports': False,
                },
                'permissions': {
                    'export_data': False,
                    'modify_filters': False,
                    'view_costs': False,
                    'view_profits': False,
                }
            }
        
        # Now that we have determined the user's role from security groups,
        # check if there is a custom access record
        domain = [('user_id', '=', user_id), ('active', '=', True)]
        access_record = self.search(domain, limit=1)
        
        # If there's an existing record that doesn't match the security group role,
        # update it to maintain consistency
        if access_record and access_record.role != role:
            try:
                _logger.info(f"Updating access record role from {access_record.role} to {role}")
                access_record.sudo().write({'role': role})
            except Exception as e:
                _logger.error(f"Failed to update access record role: {e}")
        
        # If no custom record exists, create one
        if not access_record:
            try:
                _logger.info(f"Creating new access record with role: {role}")
                access_record = self.sudo().create({
                    'name': f"Auto-generated for {user.name}",
                    'user_id': user_id,
                    'role': role,
                    # The rest will be set by the create method's role defaults
                })
                _logger.info(f"Created new access record: {access_record}")
            except Exception as e:
                _logger.error(f"Failed to create access record: {e}")
        
        # If we have an access record, use its permissions
        if access_record:
            _logger.info(f"Access record role: {access_record.role}")
            return {
                'role': access_record.role,
                'tabs': {
                    'overview': access_record.can_access_overview,
                    'projects': access_record.can_access_projects,
                    'crops': access_record.can_access_crops,
                    'financials': access_record.can_access_financials,
                    'sales': access_record.can_access_sales,
                    'purchases': access_record.can_access_purchases,
                    'inventory': access_record.can_access_inventory,
                    'reports': access_record.can_access_reports,
                },
                'permissions': {
                    'export_data': access_record.can_export_data,
                    'modify_filters': access_record.can_modify_filters,
                    'view_costs': access_record.can_view_costs,
                    'view_profits': access_record.can_view_profits,
                }
            }
        
        # Fallback permissions if creation fails - use the role-based defaults
        permissions = self._get_role_permissions(role)
        return {
            'role': role,
            'tabs': {
                'overview': permissions.get('can_access_overview', True),
                'projects': permissions.get('can_access_projects', True),
                'crops': permissions.get('can_access_crops', True),
                'financials': permissions.get('can_access_financials', True),
                'sales': permissions.get('can_access_sales', True),
                'purchases': permissions.get('can_access_purchases', True),
                'inventory': permissions.get('can_access_inventory', True),
                'reports': permissions.get('can_access_reports', True),
            },
            'permissions': {
                'export_data': permissions.get('can_export_data', False),
                'modify_filters': permissions.get('can_modify_filters', True),
                'view_costs': permissions.get('can_view_costs', True),
                'view_profits': permissions.get('can_view_profits', False),
            }
        }
    
    @api.model
    def check_tab_access(self, tab_name, user_id=None):
        """Check if user can access specific tab"""
        permissions = self.get_user_permissions(user_id)
        return permissions['tabs'].get(tab_name, False)
    
    @api.model
    def get_accessible_tabs(self, user_id=None):
        """Get list of tabs accessible to user"""
        permissions = self.get_user_permissions(user_id)
        accessible_tabs = []
        
        tab_info = [
            ('overview', '🌾', _('Overview')),
            ('projects', '🚜', _('Projects')),
            ('crops', '🌱', _('Crops')),
            ('financials', '💰', _('Financials')),
            ('sales', '📊', _('Sales')),
            ('purchases', '🛒', _('Purchases')),
            ('inventory', '📦', _('Inventory')),
            ('reports', '📈', _('Reports')),
        ]
        
        for tab_key, tab_icon, tab_name in tab_info:
            if permissions['tabs'].get(tab_key, False):
                accessible_tabs.append({
                    'key': tab_key,
                    'label': f"{tab_icon} {tab_name}",
                    'icon': tab_icon,
                    'name': tab_name
                })
        
        return accessible_tabs

