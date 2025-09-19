from odoo import fields, models, api, _


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
    
    @api.model
    def create(self, vals):
        """Set default permissions based on role"""
        if 'role' in vals:
            role_permissions = self._get_role_permissions(vals['role'])
            vals.update(role_permissions)
        return super().create(vals)
    
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
        
        access_record = self.search([
            ('user_id', '=', user_id),
            ('active', '=', True)
        ], limit=1)
        
        if access_record:
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
        else:
            # Default permissions for users without specific access record
            # For demo purposes, allow access to all tabs
            return {
                'role': 'demo_user',
                'tabs': {
                    'overview': True,
                    'projects': True,
                    'crops': True,
                    'financials': True,
                    'sales': True,
                    'purchases': True,
                    'inventory': True,
                    'reports': True,
                },
                'permissions': {
                    'export_data': False,  # Keep export restricted for security
                    'modify_filters': True,
                    'view_costs': True,
                    'view_profits': True,
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
            ('overview', '📊 Overview'),
            ('projects', '🌱 Projects'),
            ('crops', '🌾 Crops'),
            ('financials', '💰 Financials'),
            ('sales', '🛒 Sales'),
            ('purchases', '📦 Purchases'),
            ('inventory', '📋 Inventory'),
            ('reports', '📈 Reports'),
        ]
        
        for tab_key, tab_label in tab_info:
            if permissions['tabs'].get(tab_key, False):
                accessible_tabs.append({
                    'key': tab_key,
                    'label': tab_label,
                    'icon': tab_label.split()[0],  # Extract emoji
                    'name': tab_label.split()[1]   # Extract name
                })
        
        return accessible_tabs

