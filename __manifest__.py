{
    'name': 'Farm Management Dashboard',
    'version': '18.0.1.1.0',
    'summary': 'Comprehensive dashboard for Farm Management System with realtime updates and budget vs actual tracking',
    'description': """
        Farm Management Dashboard
        =========================
        
        This module provides a comprehensive dashboard for the Farm Management System featuring:
        
        * **Real-time KPIs**: Live updates of farm operations, cultivation projects, and financial metrics
        * **Budget vs Actual Analysis**: Detailed cost tracking and variance analysis per cultivation project
        * **Multi-tab Interface**: Organized tabs for each module dependency (Stock, Sales, Purchase, etc.)
        * **Advanced Filtering**: Date ranges, company, farms, crops, fields, and analytical accounts
        * **Interactive Charts**: Visual representation of farm data with drill-down capabilities
        * **Quick Actions**: Fast access to common farm operations
        
        **Key Features:**
        - Active cultivation projects tracking
        - Total hectares in production
        - Stock on hand for critical inputs
        - Budget vs actual cost analysis
        - Equipment availability and maintenance
        - Labor and machinery utilization
        - Sales and purchase order tracking
        - Real-time notifications via Odoo bus
        
        **Technical Features:**
        - WebSocket-based real-time updates
        - Multi-company support
        - Comprehensive security controls
        - Internationalization ready
        - Performance optimized with read_group aggregations
    """,
    'category': 'Agriculture',
    'author': 'Your Company',
    'website': 'https://www.yourcompany.com',
    'license': 'LGPL-3',
    'depends': [
        'farm_management',
        'stock',
        'account',
        'analytic',
        'project',
        'hr_timesheet',
        'web',
        'sale',
        'purchase',
        'product',
        'maintenance',
        'hr',
        'mrp',
    ],
    'application': False,
    'installable': True,
    'auto_install': False,
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        'views/dashboard_actions_menus.xml',
    ],
    'demo': [
        # Demo data removed - using new ORM-based dashboard
    ],
    'assets': {
        'web.assets_backend': [
            # External libraries
            'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js',
            
            # Templates FIRST - must load before JS components
            'farm_management_dashboard/static/src/xml/dashboard_main.xml',
            'farm_management_dashboard/static/src/xml/components/overview_tab.xml',
            
            # Individual tab templates for better maintainability
            'farm_management_dashboard/static/src/xml/tabs/projects_tab.xml',
            'farm_management_dashboard/static/src/xml/tabs/crops_tab.xml',
            'farm_management_dashboard/static/src/xml/tabs/financials_tab.xml',
            'farm_management_dashboard/static/src/xml/tabs/sales_tab.xml',
            'farm_management_dashboard/static/src/xml/tabs/purchases_tab.xml',
            'farm_management_dashboard/static/src/xml/tabs/inventory_tab.xml',
            'farm_management_dashboard/static/src/xml/tabs/reports_tab.xml',
            
            # Common component templates
            'farm_management_dashboard/static/src/xml/components/smart_button.xml',
            
            # Then JS components
            'farm_management_dashboard/static/src/js/components/sidebar/dashboard_sidebar.js',
            'farm_management_dashboard/static/src/js/components/tabs/overview_tab.js',
            'farm_management_dashboard/static/src/js/components/tabs/projects_tab.js',
            'farm_management_dashboard/static/src/js/components/tabs/crops_tab.js',
            'farm_management_dashboard/static/src/js/components/tabs/financials_tab.js',
            'farm_management_dashboard/static/src/js/components/tabs/sales_tab.js',
            'farm_management_dashboard/static/src/js/components/tabs/purchases_tab.js',
            'farm_management_dashboard/static/src/js/components/tabs/inventory_tab.js',
            'farm_management_dashboard/static/src/js/components/tabs/reports_tab.js',
            
            # Common components and services
            'farm_management_dashboard/static/src/js/components/common/smart_button.js',
            'farm_management_dashboard/static/src/js/services/quick_actions_service.js',
            
            # Main dashboard component LAST
            'farm_management_dashboard/static/src/js/dashboard_main.js',
            
            # Styles
            'farm_management_dashboard/static/src/css/dashboard_main.css',
        ],
    },
    'images': ['static/description/index.html'],
}                