/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class SmartButton extends Component {
    static template = "farm_management_dashboard.SmartButtonTemplate";
    static props = {
        button: { type: Object, optional: true },
        context: { type: Object, optional: true },
        permissions: { type: Object, optional: true },
        onAction: { type: Function, optional: true },
        loading: { type: Boolean, optional: true }
    };
    
    setup() {
        try {
            this.notification = useService("notification");
        } catch (e) {
            console.warn('Notification service not available');
            this.notification = { add: (msg, opts) => console.log('Notification:', msg, opts) };
        }
        
        try {
            this.action = useService("action");
        } catch (e) {
            console.warn('Action service not available');
            this.action = null;
        }
        
        try {
            this.orm = useService("orm");
        } catch (e) {
            console.warn('ORM service not available');
            this.orm = null;
        }
        
    }
    
    get isVisible() {
        if (!this.props.button) {
            console.warn('⚠️ SmartButton: No button prop provided');
            return false;
        }
        console.log('🔧 SmartButton: Checking visibility for button:', this.props.button.label);
        return this.checkPermission() && this.checkCondition();
    }
    
    get isEnabled() {
        if (!this.props.button) return false;
        return this.checkPermission() && this.checkCondition() && !this.props.button.disabled && !this.props.loading;
    }
    
    get buttonClasses() {
        if (!this.props.button) return 'btn btn-sm btn-primary disabled';
        
        const baseClasses = ['btn'];
        
        // Size classes
        if (this.props.button.size) {
            baseClasses.push(`btn-${this.props.button.size}`);
        } else {
            baseClasses.push('btn-sm');
        }
        
        // Type classes
        if (this.props.button.type) {
            baseClasses.push(`btn-${this.props.button.type}`);
        } else {
            baseClasses.push('btn-primary');
        }
        
        // Disabled state
        if (!this.isEnabled) {
            baseClasses.push('disabled');
        }
        
        // Loading state
        if (this.props.loading) {
            baseClasses.push('loading');
        }
        
        return baseClasses.join(' ');
    }
    
    checkPermission() {
        if (!this.props.button || !this.props.button.permission) return true;
        if (!this.props.permissions) return true;
        return this.props.permissions[this.props.button.permission] === true;
    }
    
    checkCondition() {
        if (!this.props.button || !this.props.button.condition) return true;
        if (!this.props.context) return true;
        
        try {
            // Simple condition evaluation
            const condition = this.props.button.condition;
            if (typeof condition === 'function') {
                return condition(this.props.context || {});
            }
            if (typeof condition === 'string') {
                // Evaluate simple string conditions
                return this.evaluateStringCondition(condition);
            }
            return true;
        } catch (error) {
            console.warn('Error evaluating button condition:', error);
            return true;
        }
    }
    
    evaluateStringCondition(condition) {
        // Simple string condition evaluation
        // This is a basic implementation - can be enhanced for complex conditions
        try {
            // Replace context variables
            let evalCondition = condition;
            const context = this.props.context || {};
            Object.keys(context).forEach(key => {
                const value = context[key];
                evalCondition = evalCondition.replace(new RegExp(`\\b${key}\\b`, 'g'), 
                    typeof value === 'string' ? `"${value}"` : value);
            });
            
            // Evaluate the condition
            return eval(evalCondition);
        } catch (error) {
            console.warn('Error evaluating string condition:', error);
            return true;
        }
    }
    
    async onButtonClick() {
        if (!this.isEnabled || !this.props.button) return;
        
        try {
            if (this.props.button.action) {
                await this.executeAction(this.props.button.action);
            } else if (this.props.onAction) {
                await this.props.onAction(this.props.button);
            }
        } catch (error) {
            console.error('Error executing button action:', error);
            this.notification.add('Error executing action: ' + error.message, { 
                type: 'danger' 
            });
        }
    }
    
    async executeAction(action) {
        console.log('🔧 SmartButton: Executing action:', action);
        
        if (typeof action === 'string') {
            // For string actions, use a different approach that bypasses action service issues
            console.log('🔧 SmartButton: Using alternative navigation for model:', action);
            this.alternativeNavigation(action);
        } else if (typeof action === 'object' && action !== null) {
            // For object actions, try action service with error handling
            if (!this.action) {
                console.warn('⚠️ SmartButton: Action service not available for object action');
                this.notification.add('Action service not available', { type: 'warning' });
                return;
            }
            
            try {
                console.log('🔧 SmartButton: Using action service for object:', action);
                await this.action.doAction(action);
            } catch (error) {
                console.error('❌ SmartButton: Action service failed for object:', error);
                this.notification.add('Failed to execute action: ' + error.message, { type: 'danger' });
            }
        } else if (typeof action === 'function') {
            // Function action
            console.log('🔧 SmartButton: Executing function action');
            try {
                await action(this.props.context || {});
            } catch (error) {
                console.error('❌ SmartButton: Function action failed:', error);
                this.notification.add('Function action failed: ' + error.message, { type: 'danger' });
            }
        } else {
            console.error('❌ SmartButton: Invalid action type:', typeof action, action);
            this.notification.add('Invalid action type', { type: 'danger' });
        }
    }
    
    async alternativeNavigation(model) {
        console.log('🔧 SmartButton: Alternative navigation for model:', model);
        
        // Check if this button has custom filter info (like overdue projects)
        const button = this.props.button;
        if (button && button.filterInfo) {
            console.log('🔧 SmartButton: Using custom filter info:', button.filterInfo);
            await this.navigateWithCustomFilter(model, button.filterInfo);
            return;
        }
        
        // Try to use ORM service to get an existing action for the model
        if (this.orm) {
            try {
                console.log('🔧 SmartButton: Searching for existing action for model:', model);
                
                // Check if this is a "New" action by looking at the button label
                const isNewAction = this.props.button && this.props.button.label && 
                    this.props.button.label.toLowerCase().includes('new');
                
                let searchDomain;
                if (isNewAction) {
                    // For "New" buttons, search for form actions
                    searchDomain = [
                        ['res_model', '=', model],
                        ['view_mode', '=', 'form']
                    ];
                } else {
                    // For other buttons, search for list actions
                    searchDomain = [
                        ['res_model', '=', model],
                        ['view_mode', '=', 'list,form']
                    ];
                }
                
                const existingActions = await this.orm.searchRead('ir.actions.act_window', 
                    searchDomain, ['id', 'name'], { limit: 1 });
                
                if (existingActions.length > 0) {
                    console.log('🔧 SmartButton: Found existing action:', existingActions[0]);
                    if (this.action) {
                        await this.action.doAction(existingActions[0].id);
                        return;
                    }
                }
            } catch (ormError) {
                console.warn('⚠️ ORM search failed:', ormError);
            }
        }
        
        // If no existing action found, try to create a new one
        if (this.orm && this.action) {
            try {
                console.log('🔧 SmartButton: Creating new action for model:', model);
                
                // Check if this is a "New" action by looking at the button label
                const isNewAction = this.props.button && this.props.button.label && 
                    this.props.button.label.toLowerCase().includes('new');
                
                let actionConfig;
                if (isNewAction) {
                    // For "New" buttons, create a form action
                    actionConfig = {
                        name: `New ${model}`,
                        res_model: model,
                        view_mode: 'form',
                        target: 'current',
                        context: { 'default_': {} }
                    };
                } else {
                    // For other buttons, create a list action
                    actionConfig = {
                        name: `${model} List`,
                        res_model: model,
                        view_mode: 'list,form',
                        target: 'current'
                    };
                }
                
                const newAction = await this.orm.call('ir.actions.act_window', 'create', [actionConfig]);
                console.log('🔧 SmartButton: Created new action:', newAction);
                await this.action.doAction(newAction);
                return;
            } catch (createError) {
                console.warn('⚠️ Action creation failed:', createError);
            }
        }
        
        // If all else fails, show a notification
        console.log('🔧 SmartButton: All navigation methods failed, showing notification');
        this.notification.add(`Navigate to ${model} list view`, { 
            type: 'info',
            title: 'Navigation Required',
            message: `Please navigate to ${model} from the main menu to view the list.`
        });
    }

    async navigateWithCustomFilter(model, filterInfo) {
        console.log('🔧 SmartButton: Navigating with custom filter:', filterInfo);
        
        // Try to use ORM service to create a filtered action
        if (this.orm && this.action) {
            try {
                console.log('🔧 SmartButton: Creating filtered action with ORM');
                const actionConfig = {
                    name: `${model} List (Filtered)`,
                    res_model: model,
                    view_mode: 'list,form',
                    target: 'current',
                    domain: filterInfo.domain,
                    context: filterInfo.context
                };
                
                const newAction = await this.orm.call('ir.actions.act_window', 'create', [actionConfig]);
                console.log('🔧 SmartButton: Created filtered action:', newAction);
                await this.action.doAction(newAction);
                return;
            } catch (ormError) {
                console.warn('⚠️ ORM filtered action creation failed:', ormError);
            }
        }
        
        // Try direct action service as fallback
        if (this.action) {
            try {
                const action = {
                    type: 'ir.actions.act_window',
                    res_model: model,
                    view_mode: 'list,form',
                    target: 'current',
                    domain: filterInfo.domain,
                    context: filterInfo.context
                };
                console.log('🔧 SmartButton: Custom filter action:', action);
                await this.action.doAction(action);
                return; 
            } catch (actionError) {
                console.warn('⚠️ Custom filter action failed:', actionError);
            }
        }
        
        // Final fallback: show notification with filter info
        this.notification.add(`Navigate to ${model} with overdue filter`, { 
            type: 'info',
            title: 'Navigation Required',
            message: `Please navigate to ${model} and apply overdue filter manually.`
        });
    }
    
    async fallbackNavigation(action) {
        console.log('🔧 SmartButton: Using fallback navigation for action:', action);
        
        if (typeof action === 'string') {
            // Use the same approach as alternativeNavigation
            await this.alternativeNavigation(action);
        } else {
            console.warn('⚠️ SmartButton: Cannot handle fallback for action type:', typeof action);
            this.notification.add('Action not supported in fallback mode', { type: 'warning' });
        }
    }
}
