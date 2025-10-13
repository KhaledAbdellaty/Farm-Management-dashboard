from odoo import api, fields, models, _
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)

class FarmDashboardData(models.Model):
    _inherit = 'farm.dashboard.data'
    
    @api.model
    def get_project_reports(self, project_id):
        """
        Get comprehensive daily reports for a specific cultivation project
        
        Args:
            project_id (int): The ID of the project to get reports for
            
        Returns:
            dict: Daily reports with detailed information from farm.daily.report model
        """
        _logger.info(f"Fetching comprehensive reports for project ID {project_id}")
        try:
            # Validate project exists
            project = self.env['farm.cultivation.project'].browse(project_id)
            if not project.exists():
                _logger.warning(f"Project with ID {project_id} not found")
                return {'success': False, 'error': 'Project not found'}
            
            # Get all daily reports for this project
            if 'farm.daily.report' not in self.env:
                return {'success': False, 'error': 'Daily report model not available'}
            
            reports = self.env['farm.daily.report'].search([
                ('project_id', '=', project_id)
            ], order='date desc')
            
            if not reports:
                _logger.info(f"No daily reports found for project {project_id}")
                return {'success': True, 'reports': [], 'project_name': project.name}
            
            _logger.info(f"Found {len(reports)} daily reports for project {project_id}")
            
            # Prepare comprehensive report data with all necessary fields
            report_data = []
            for report in reports:
                # Get product category from related product if available
                product_category = None
                product_category_id = None
                
                if hasattr(report, 'product_id') and report.product_id:
                    if hasattr(report.product_id, 'categ_id') and report.product_id.categ_id:
                        product_category = report.product_id.categ_id.name
                        product_category_id = report.product_id.categ_id.id
                
                # Use explicit product_category field if present
                if hasattr(report, 'product_category_id') and report.product_category_id:
                    product_category = report.product_category_id.name
                    product_category_id = report.product_category_id.id
                
                # Get user information
                user_id = report.create_uid.id if report.create_uid else None
                user_name = report.create_uid.name if report.create_uid else 'Unknown'
                
                # Include responsible user if available
                if hasattr(report, 'user_id') and report.user_id:
                    user_id = report.user_id.id
                    user_name = report.user_id.name
                
                # Get operation type label from selection field
                operation_type_label = report.operation_type
                if hasattr(report._fields.get('operation_type', None), 'selection'):
                    selection_dict = dict(report._fields['operation_type'].selection)
                    operation_type_label = selection_dict.get(report.operation_type, report.operation_type)
                
                # Get cost information
                cost = 0
                if hasattr(report, 'actual_cost'):
                    cost = report.actual_cost or 0
                elif hasattr(report, 'amount'):
                    cost = report.amount or 0
                elif hasattr(report, 'cost'):
                    cost = report.cost or 0
                
                # Compile comprehensive report data
                report_data.append({
                    'id': report.id,
                    'operation_type': report.operation_type,
                    'operation_type_label': operation_type_label,
                    'description': report.description or f"{operation_type_label} operation",
                    'date': report.date.isoformat() if report.date else None,
                    'cost': cost,
                    'state': report.state if hasattr(report, 'state') else 'done',
                    'product_id': report.product_id.id if hasattr(report, 'product_id') and report.product_id else None,
                    'product_name': report.product_id.name if hasattr(report, 'product_id') and report.product_id else None,
                    'product_category': product_category or 'Other',
                    'product_category_id': product_category_id,
                    'user_id': user_id,
                    'user_name': user_name,
                    'notes': report.notes if hasattr(report, 'notes') else None,
                    'quantity': report.quantity if hasattr(report, 'quantity') else None,
                    'unit_of_measure': report.uom_id.name if hasattr(report, 'uom_id') and report.uom_id else None,
                    'create_date': report.create_date.isoformat() if report.create_date else None,
                    'write_date': report.write_date.isoformat() if report.write_date else None,
                })
            
            # Calculate cost breakdown by category
            cost_breakdown = {}
            for report in report_data:
                category = report['product_category']
                if category not in cost_breakdown:
                    cost_breakdown[category] = 0
                cost_breakdown[category] += report['cost']
            
            return {
                'success': True,
                'reports': report_data,
                'cost_breakdown': cost_breakdown,
                'project_name': project.name,
                'project_id': project.id,
                'report_count': len(report_data),
                'total_cost': sum(r['cost'] for r in report_data)
            }
            
        except Exception as e:
            _logger.error(f"Error fetching project reports: {str(e)}")
            return {'success': False, 'error': str(e)}